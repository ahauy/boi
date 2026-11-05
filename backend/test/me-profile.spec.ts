import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { Types } from 'mongoose';
import sharp from 'sharp';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import { CloudinaryService } from '../src/readings/cloudinary.service';
import { deleteUserAccount } from '../scripts/users-delete';

const JWT_SECRET = 'test-jwt-secret-palm-sight-at-least-32-chars-long';
const IDENTITY_SECRET = 'test-identity-secret-at-least-32-chars-long';
const GOOGLE_AVATAR = 'https://lh3.googleusercontent.com/a/google-photo';

describe('PATCH /me, POST/DELETE /me/avatar', () => {
  let testApp: TestAppInstance;
  let cloudinary: CloudinaryService;
  let uploads: Array<{ buffer: Buffer; mimeType: string; folder?: string; publicId?: string }>;
  let deletes: string[];
  let seq = 0;

  beforeAll(async () => {
    testApp = await createTestApp();
    cloudinary = testApp.app.get(CloudinaryService, { strict: false });
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  // Cloudinary luôn được mock: không bao giờ có request thật ra ngoài
  beforeEach(() => {
    uploads = [];
    deletes = [];
    vi.spyOn(cloudinary, 'isConfigured').mockReturnValue(true);
    vi.spyOn(cloudinary, 'uploadImageStrict').mockImplementation(async (buffer, mimeType, options) => {
      uploads.push({ buffer, mimeType, folder: options.folder, publicId: options.publicId });
      const publicId = `${options.folder}/${options.publicId}`;
      return { url: `https://res.cloudinary.com/test/image/upload/v1/${publicId}.jpg`, publicId };
    });
    vi.spyOn(cloudinary, 'deleteImage').mockImplementation(async (publicId) => {
      deletes.push(publicId as string);
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const seedUser = async (overrides: Record<string, unknown> = {}) => {
    const n = ++seq;
    const { insertedId } = await testApp.connection.collection('users').insertOne({
      displayName: `User ${n}`,
      username: `profile_user_${n}`,
      email: `profile${n}@example.com`,
      passwordHash: null,
      referralCode: crypto.randomBytes(4).toString('hex').toUpperCase(),
      creditBalance: 3,
      referralBlocked: false,
      identities: [],
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
    const token = new JwtService({ secret: JWT_SECRET }).sign({
      sub: insertedId.toString(),
      sid: new Types.ObjectId().toString(),
    });
    return { id: insertedId, token };
  };

  const getUserDoc = (id: Types.ObjectId) => testApp.connection.collection('users').findOne({ _id: id });

  const patchMe = (token: string | null, body: unknown, raw = false) =>
    fetch(`${testApp.baseUrl}/api/v1/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: raw ? (body as string) : JSON.stringify(body),
    });

  const postAvatar = (token: string, file?: { data: Buffer | Uint8Array; name: string; type: string }, field = 'avatar') => {
    const form = new FormData();
    if (file) form.append(field, new Blob([file.data as any], { type: file.type }), file.name);
    return fetch(`${testApp.baseUrl}/api/v1/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  };

  const deleteAvatar = (token: string) =>
    fetch(`${testApp.baseUrl}/api/v1/me/avatar`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

  const solid = (width: number, height: number) =>
    sharp({ create: { width, height, channels: 3, background: '#336699' } });

  const jpeg = (width = 800, height = 600) => solid(width, height).jpeg().toBuffer();

  describe('PATCH /me', () => {
    it('sửa tên hợp lệ, trả UserDto giống GET /me, không đụng username', async () => {
      const { id, token } = await seedUser();
      const res = await patchMe(token, { displayName: '  Nguyễn   Văn A  ' });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.displayName).toBe('Nguyễn Văn A');
      expect(body.username).toBe(`profile_user_${seq}`);
      expect(body.hasCustomAvatar).toBe(false);
      expect(body).not.toHaveProperty('avatarPublicId');

      const me = (await (await fetch(`${testApp.baseUrl}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } })).json()) as any;
      expect(me.displayName).toBe('Nguyễn Văn A');
      expect(Object.keys(body).sort()).toEqual(Object.keys(me).sort());
      expect((await getUserDoc(id))!.displayName).toBe('Nguyễn Văn A');
    });

    it('không cộng VIP hằng ngày khi sửa tên (getMe mới là chỗ cộng)', async () => {
      const { id, token } = await seedUser({
        vipExpiresAt: new Date(Date.now() + 86400_000),
        vipDailyDay: null,
      });
      const res = await patchMe(token, { displayName: 'Vip User' });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.grantedNow).toBe(false);
      expect(body.creditBalance).toBe(3);
      expect((await getUserDoc(id))!.vipDailyDay ?? null).toBeNull();
      expect(await testApp.connection.collection('credit_transactions').countDocuments({ userId: id })).toBe(0);
    });

    it.each([
      ['rỗng', { displayName: '' }],
      ['chỉ khoảng trắng', { displayName: '     ' }],
      ['quá dài (51)', { displayName: 'a'.repeat(51) }],
      ['ký tự điều khiển', { displayName: 'a\u0000b' }],
      ['tab', { displayName: 'a\tb' }],
      ['zero-width', { displayName: 'a​b' }],
      ['bidi override', { displayName: 'a‮b' }],
      ['thiếu trường', {}],
      ['không phải chuỗi', { displayName: 123 }],
      ['trường lạ username', { displayName: 'An', username: 'hacker' }],
      ['trường lạ id', { displayName: 'An', id: new Types.ObjectId().toString() }],
    ])('400 VALIDATION_ERROR: %s', async (_name, payload) => {
      const { id, token } = await seedUser();
      const before = (await getUserDoc(id))!;
      const res = await patchMe(token, payload);
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(Array.isArray(body.error.details.fields)).toBe(true);
      const after = (await getUserDoc(id))!;
      expect(after.displayName).toBe(before.displayName);
      expect(after.username).toBe(before.username);
    });

    it('thân request không phải JSON object hợp lệ cũng trả 400', async () => {
      const { token } = await seedUser();
      expect((await patchMe(token, '[]', true)).status).toBe(400);
    });

    it('không sửa được người khác: token của A chỉ đổi A, id trong body bị từ chối', async () => {
      const a = await seedUser({ displayName: 'Người A' });
      const b = await seedUser({ displayName: 'Người B' });
      const res = await patchMe(a.token, { displayName: 'Bị đổi', id: b.id.toString() });
      expect(res.status).toBe(400);
      expect((await getUserDoc(b.id))!.displayName).toBe('Người B');

      expect((await patchMe(a.token, { displayName: 'A mới' })).status).toBe(200);
      expect((await getUserDoc(a.id))!.displayName).toBe('A mới');
      expect((await getUserDoc(b.id))!.displayName).toBe('Người B');

      // Không có route nhận id trên đường dẫn
      const byId = await fetch(`${testApp.baseUrl}/api/v1/me/${b.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'X' }),
      });
      expect(byId.status).toBe(404);
      expect((await getUserDoc(b.id))!.displayName).toBe('Người B');
    });

    it('401 khi không có token hoặc tài khoản đã xoá', async () => {
      expect((await patchMe(null, { displayName: 'An' })).status).toBe(401);
      const { id, token } = await seedUser();
      await testApp.connection.collection('users').updateOne({ _id: id }, { $set: { deletedAt: new Date() } });
      expect((await patchMe(token, { displayName: 'An' })).status).toBe(401);
    });

    it('429 sau 10 lần/phút/user', async () => {
      const { token } = await seedUser();
      for (let i = 0; i < 10; i++) {
        expect((await patchMe(token, { displayName: `Tên ${i}` })).status).toBe(200);
      }
      const res = await patchMe(token, { displayName: 'Lần 11' });
      expect(res.status).toBe(429);
      expect(((await res.json()) as any).error.code).toBe('RATE_LIMITED');
      // user khác không bị ảnh hưởng
      const other = await seedUser();
      expect((await patchMe(other.token, { displayName: 'Ổn' })).status).toBe(200);
    });
  });

  describe('POST /me/avatar', () => {
    it('ảnh hợp lệ: 200, lưu avatarUrl + avatarPublicId, trả hasCustomAvatar, không lộ publicId', async () => {
      const { id, token } = await seedUser();
      const res = await postAvatar(token, { data: await jpeg(), name: 'me.jpg', type: 'image/jpeg' });
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.hasCustomAvatar).toBe(true);
      expect(body.avatarUrl).toMatch(/^https:\/\//);
      expect(body).not.toHaveProperty('avatarPublicId');

      const doc = (await getUserDoc(id))!;
      expect(doc.avatarUrl).toBe(body.avatarUrl);
      expect(doc.avatarPublicId).toMatch(/^palmsight\/avatars\/[0-9a-f]{32}$/);
      // publicId không chứa dữ liệu cá nhân
      expect(doc.avatarPublicId).not.toContain(id.toString());
      expect(uploads).toHaveLength(1);
      expect(uploads[0].folder).toBe('palmsight/avatars');
      expect(uploads[0].mimeType).toBe('image/jpeg');
    });

    it('nhận png và webp, bỏ qua mimetype/đuôi file đã khai báo', async () => {
      const { token } = await seedUser();
      const png = await solid(300, 300).png().toBuffer();
      const webp = await solid(300, 300).webp().toBuffer();
      // khai báo sai mimetype và đuôi nhưng nội dung là ảnh thật
      expect((await postAvatar(token, { data: png, name: 'a.txt', type: 'text/plain' })).status).toBe(200);
      expect((await postAvatar(token, { data: webp, name: 'a.jpg', type: 'application/pdf' })).status).toBe(200);
    });

    it('xử lý ảnh: xoay theo EXIF, bỏ EXIF, vuông và <= 512', async () => {
      const { token } = await seedUser();
      // 600x300: nửa trái đỏ, nửa phải xanh; orientation 6 = hiển thị xoay 90 độ theo chiều kim đồng hồ,
      // nên sau khi xoay nửa trái (đỏ) nằm trên, nửa phải (xanh) nằm dưới
      const left = await sharp({ create: { width: 300, height: 300, channels: 3, background: '#ff0000' } }).png().toBuffer();
      const original = await sharp({ create: { width: 600, height: 300, channels: 3, background: '#0000ff' } })
        .composite([{ input: left, left: 0, top: 0 }])
        .withExif({ IFD0: { Copyright: 'nguoi-dung-bi-mat' } })
        .withMetadata({ orientation: 6 })
        .jpeg()
        .toBuffer();
      const inputMeta = await sharp(original).metadata();
      expect(inputMeta.orientation).toBe(6);
      expect(inputMeta.exif).toBeDefined();

      const res = await postAvatar(token, { data: original, name: 'exif.jpg', type: 'image/jpeg' });
      expect(res.status).toBe(200);
      const out = uploads[0].buffer;
      const meta = await sharp(out).metadata();
      expect(meta.format).toBe('jpeg');
      expect(meta.width).toBe(meta.height);
      expect(meta.width!).toBeLessThanOrEqual(512);
      expect(meta.exif).toBeUndefined();
      expect(meta.icc).toBeUndefined();
      expect(meta.orientation).toBeUndefined();
      expect(out.includes(Buffer.from('nguoi-dung-bi-mat'))).toBe(false);

      const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
      const px = (x: number, y: number) => {
        const o = (y * info.width + x) * info.channels;
        return [data[o], data[o + 1], data[o + 2]];
      };
      const top = px(Math.floor(info.width / 2), 5);
      const bottom = px(Math.floor(info.width / 2), info.height - 6);
      expect(top[0]).toBeGreaterThan(200); // đỏ ở trên
      expect(top[2]).toBeLessThan(80);
      expect(bottom[2]).toBeGreaterThan(200); // xanh ở dưới
      expect(bottom[0]).toBeLessThan(80);
    });

    it('ảnh lớn bị cắt cover xuống đúng 512x512; ảnh nhỏ không bị phóng to', async () => {
      const { token } = await seedUser();
      await postAvatar(token, { data: await jpeg(2000, 1000), name: 'big.jpg', type: 'image/jpeg' });
      const big = await sharp(uploads[0].buffer).metadata();
      expect([big.width, big.height]).toEqual([512, 512]);

      const other = await seedUser();
      await postAvatar(other.token, { data: await jpeg(100, 60), name: 'small.jpg', type: 'image/jpeg' });
      const small = await sharp(uploads[1].buffer).metadata();
      expect([small.width, small.height]).toEqual([60, 60]);
    });

    it('415 AVATAR_INVALID_TYPE: file text đổi đuôi .jpg, PDF, gif; không upload gì', async () => {
      const { id, token } = await seedUser();
      const cases = [
        { data: Buffer.from('đây không phải ảnh, chỉ là chữ'), name: 'fake.jpg', type: 'image/jpeg' },
        { data: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF'), name: 'doc.png', type: 'image/png' },
        { data: await solid(20, 20).gif().toBuffer(), name: 'a.gif', type: 'image/gif' },
      ];
      // mỗi lần dùng user riêng để không chạm giới hạn 5 lần/phút
      for (const [i, c] of cases.entries()) {
        const u = i === 0 ? { id, token } : await seedUser();
        const res = await postAvatar(u.token, c);
        expect(res.status).toBe(415);
        expect(((await res.json()) as any).error.code).toBe('AVATAR_INVALID_TYPE');
      }
      expect(uploads).toHaveLength(0);
      expect((await getUserDoc(id))!.avatarUrl ?? null).toBeNull();
    });

    it('413 AVATAR_TOO_LARGE: file > 5 MB (đúng định dạng lỗi của ApiExceptionFilter)', async () => {
      const { token } = await seedUser();
      const res = await postAvatar(token, {
        data: crypto.randomBytes(5 * 1024 * 1024 + 1024),
        name: 'huge.jpg',
        type: 'image/jpeg',
      });
      expect(res.status).toBe(413);
      const body = (await res.json()) as any;
      expect(body.error.code).toBe('AVATAR_TOO_LARGE');
      expect(typeof body.error.message).toBe('string');
      expect(uploads).toHaveLength(0);
    });

    it('400 VALIDATION_ERROR: thiếu file, sai tên trường, nhiều file, không phải multipart', async () => {
      const { token } = await seedUser();
      const img = { data: await jpeg(50, 50), name: 'a.jpg', type: 'image/jpeg' };

      const missing = await postAvatar(token);
      expect(missing.status).toBe(400);
      expect(((await missing.json()) as any).error.code).toBe('VALIDATION_ERROR');

      const wrongField = await postAvatar(token, img, 'image');
      expect(wrongField.status).toBe(400);
      expect(((await wrongField.json()) as any).error.code).toBe('VALIDATION_ERROR');

      const form = new FormData();
      form.append('avatar', new Blob([img.data as any]), 'a.jpg');
      form.append('avatar', new Blob([img.data as any]), 'b.jpg');
      const two = await fetch(`${testApp.baseUrl}/api/v1/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      expect(two.status).toBe(400);

      const json = await fetch(`${testApp.baseUrl}/api/v1/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: '{}',
      });
      expect(json.status).toBe(400);
      expect(((await json.json()) as any).error.code).toBe('VALIDATION_ERROR');
      expect(uploads).toHaveLength(0);
    });

    it('503 AVATAR_UNAVAILABLE khi Cloudinary chưa cấu hình', async () => {
      vi.spyOn(cloudinary, 'isConfigured').mockReturnValue(false);
      const { id, token } = await seedUser();
      const res = await postAvatar(token, { data: await jpeg(), name: 'a.jpg', type: 'image/jpeg' });
      expect(res.status).toBe(503);
      expect(((await res.json()) as any).error.code).toBe('AVATAR_UNAVAILABLE');
      expect(uploads).toHaveLength(0);
      expect((await getUserDoc(id))!.avatarUrl ?? null).toBeNull();
    });

    it('thay ảnh: ảnh cũ chỉ bị xoá SAU khi ảnh mới đã lưu vào DB', async () => {
      const oldId = 'palmsight/avatars/' + 'a'.repeat(32);
      const { id, token } = await seedUser({
        avatarUrl: `https://res.cloudinary.com/test/image/upload/v1/${oldId}.jpg`,
        avatarPublicId: oldId,
      });
      let publicIdInDbWhenOldDeleted: unknown;
      (cloudinary.deleteImage as any).mockImplementation(async (publicId: string) => {
        deletes.push(publicId);
        if (publicId === oldId) publicIdInDbWhenOldDeleted = (await getUserDoc(id))!.avatarPublicId;
        return true;
      });

      const res = await postAvatar(token, { data: await jpeg(), name: 'new.jpg', type: 'image/jpeg' });
      expect(res.status).toBe(200);
      const doc = (await getUserDoc(id))!;
      expect(doc.avatarPublicId).not.toBe(oldId);
      expect(deletes).toEqual([oldId]);
      expect(publicIdInDbWhenOldDeleted).toBe(doc.avatarPublicId);
    });

    it('lỗi xoá ảnh cũ không làm hỏng request, ảnh mới vẫn được lưu', async () => {
      const oldId = 'palmsight/avatars/' + 'b'.repeat(32);
      const { id, token } = await seedUser({ avatarUrl: 'https://res.cloudinary.com/x.jpg', avatarPublicId: oldId });
      (cloudinary.deleteImage as any).mockRejectedValue(new Error('cloudinary down'));
      const res = await postAvatar(token, { data: await jpeg(), name: 'new.jpg', type: 'image/jpeg' });
      expect(res.status).toBe(200);
      expect((await getUserDoc(id))!.avatarPublicId).not.toBe(oldId);
    });

    it('lỗi upload: 502 AVATAR_UPLOAD_FAILED, giữ nguyên avatar cũ và không xoá ảnh cũ', async () => {
      const oldId = 'palmsight/avatars/' + 'c'.repeat(32);
      const oldUrl = 'https://res.cloudinary.com/test/old.jpg';
      const { id, token } = await seedUser({ avatarUrl: oldUrl, avatarPublicId: oldId });
      (cloudinary.uploadImageStrict as any).mockRejectedValue(new Error('timeout'));
      const res = await postAvatar(token, { data: await jpeg(), name: 'new.jpg', type: 'image/jpeg' });
      expect(res.status).toBe(502);
      expect(((await res.json()) as any).error.code).toBe('AVATAR_UPLOAD_FAILED');
      const doc = (await getUserDoc(id))!;
      expect(doc.avatarUrl).toBe(oldUrl);
      expect(doc.avatarPublicId).toBe(oldId);
      expect(deletes).toEqual([]);
    });

    it('lỗi lưu DB sau khi đã upload: dọn ảnh mới, giữ avatar cũ, không xoá ảnh cũ', async () => {
      const oldId = 'palmsight/avatars/' + 'd'.repeat(32);
      const oldUrl = 'https://res.cloudinary.com/test/old2.jpg';
      const { id, token } = await seedUser({ avatarUrl: oldUrl, avatarPublicId: oldId });
      const userModel = testApp.connection.model('User');
      vi.spyOn(userModel, 'findOneAndUpdate').mockImplementationOnce((() => {
        throw new Error('db write failed');
      }) as any);
      const res = await postAvatar(token, { data: await jpeg(), name: 'new.jpg', type: 'image/jpeg' });
      expect(res.status).toBe(502);
      expect(((await res.json()) as any).error.code).toBe('AVATAR_UPLOAD_FAILED');
      expect(uploads).toHaveLength(1);
      expect(deletes).toEqual([`${uploads[0].folder}/${uploads[0].publicId}`]);
      const doc = (await getUserDoc(id))!;
      expect(doc.avatarUrl).toBe(oldUrl);
      expect(doc.avatarPublicId).toBe(oldId);
    });

    it('chỉ đổi avatar của chính mình; 401 khi không có token', async () => {
      const a = await seedUser();
      const b = await seedUser({ avatarUrl: GOOGLE_AVATAR });
      await postAvatar(a.token, { data: await jpeg(), name: 'a.jpg', type: 'image/jpeg' });
      expect((await getUserDoc(b.id))!.avatarUrl).toBe(GOOGLE_AVATAR);
      const res = await fetch(`${testApp.baseUrl}/api/v1/me/avatar`, { method: 'POST', body: new FormData() });
      expect(res.status).toBe(401);
    });

    it('429 sau 5 lần/phút/user', async () => {
      const { token } = await seedUser();
      const img = { data: await jpeg(100, 100), name: 'a.jpg', type: 'image/jpeg' };
      for (let i = 0; i < 5; i++) expect((await postAvatar(token, img)).status).toBe(200);
      const res = await postAvatar(token, img);
      expect(res.status).toBe(429);
      expect(((await res.json()) as any).error.code).toBe('RATE_LIMITED');
    });
  });

  describe('DELETE /me/avatar', () => {
    it('gỡ ảnh đã tải lên: xoá trên Cloudinary rồi đặt avatarUrl/avatarPublicId về null', async () => {
      const publicId = 'palmsight/avatars/' + 'e'.repeat(32);
      const { id, token } = await seedUser({
        avatarUrl: `https://res.cloudinary.com/test/${publicId}.jpg`,
        avatarPublicId: publicId,
      });
      const res = await deleteAvatar(token);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.avatarUrl).toBeNull();
      expect(body.hasCustomAvatar).toBe(false);
      expect(deletes).toEqual([publicId]);
      const doc = (await getUserDoc(id))!;
      expect(doc.avatarUrl).toBeNull();
      expect(doc.avatarPublicId).toBeNull();
    });

    it('ảnh Google/Facebook (không có avatarPublicId) không bị xoá: 200, no-op', async () => {
      const { id, token } = await seedUser({ avatarUrl: GOOGLE_AVATAR });
      const res = await deleteAvatar(token);
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.avatarUrl).toBe(GOOGLE_AVATAR);
      expect(body.hasCustomAvatar).toBe(false);
      expect(deletes).toEqual([]);
      expect((await getUserDoc(id))!.avatarUrl).toBe(GOOGLE_AVATAR);
    });

    it('Cloudinary xoá lỗi: 502, giữ nguyên avatar để thử lại', async () => {
      const publicId = 'palmsight/avatars/' + 'f'.repeat(32);
      const { id, token } = await seedUser({ avatarUrl: 'https://res.cloudinary.com/t.jpg', avatarPublicId: publicId });
      (cloudinary.deleteImage as any).mockResolvedValue(false);
      const res = await deleteAvatar(token);
      expect(res.status).toBe(502);
      expect(((await res.json()) as any).error.code).toBe('AVATAR_DELETE_FAILED');
      expect((await getUserDoc(id))!.avatarPublicId).toBe(publicId);
    });

    it('người dùng chưa có avatar: 200 no-op; 401 khi không có token', async () => {
      const { token } = await seedUser();
      const res = await deleteAvatar(token);
      expect(res.status).toBe(200);
      expect(((await res.json()) as any).avatarUrl).toBeNull();
      expect((await fetch(`${testApp.baseUrl}/api/v1/me/avatar`, { method: 'DELETE' })).status).toBe(401);
    });
  });

  describe('xoá tài khoản (scripts/users-delete)', () => {
    const fakeCloudinary = (impl?: (id?: string | null) => Promise<boolean>) => {
      const del = vi.fn(impl ?? (async () => true));
      return { isConfigured: () => true, deleteImage: del } as unknown as CloudinaryService & { deleteImage: typeof del };
    };

    it('xoá avatar trên Cloudinary sau commit và đặt avatarUrl/avatarPublicId về null', async () => {
      const publicId = 'palmsight/avatars/' + '1'.repeat(32);
      const { id } = await seedUser({ avatarUrl: `https://res.cloudinary.com/t/${publicId}.jpg`, avatarPublicId: publicId });
      const cld = fakeCloudinary();
      const result = await deleteUserAccount(testApp.connection, id, undefined, IDENTITY_SECRET, cld);
      expect(result.ok).toBe(true);
      expect(cld.deleteImage).toHaveBeenCalledWith(publicId);
      const doc = (await getUserDoc(id))!;
      expect(doc.avatarUrl).toBeNull();
      expect(doc.avatarPublicId).toBeNull();
      expect(doc.deletedAt).toBeInstanceOf(Date);
    });

    it('lỗi Cloudinary không làm hỏng việc xoá tài khoản', async () => {
      const publicId = 'palmsight/avatars/' + '2'.repeat(32);
      const { id } = await seedUser({ avatarUrl: 'https://res.cloudinary.com/t/x.jpg', avatarPublicId: publicId });
      const cld = fakeCloudinary(async () => {
        throw new Error('cloudinary down');
      });
      const result = await deleteUserAccount(testApp.connection, id, undefined, IDENTITY_SECRET, cld);
      expect(result.ok).toBe(true);
      const doc = (await getUserDoc(id))!;
      expect(doc.deletedAt).toBeInstanceOf(Date);
      expect(doc.avatarPublicId).toBeNull();
    });

    it('avatar Google: avatarUrl bị null khi xoá tài khoản nhưng không gọi xoá Cloudinary', async () => {
      const { id } = await seedUser({ avatarUrl: GOOGLE_AVATAR });
      const cld = fakeCloudinary();
      await deleteUserAccount(testApp.connection, id, undefined, IDENTITY_SECRET, cld);
      expect((await getUserDoc(id))!.avatarUrl).toBeNull();
      expect(cld.deleteImage.mock.calls.every(([arg]) => !arg)).toBe(true);
    });
  });
});
