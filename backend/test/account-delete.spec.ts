import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as crypto from 'crypto';
import { Types } from 'mongoose';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import { CloudinaryService } from '../src/readings/cloudinary.service';

/**
 * DELETE /me: người dùng tự xoá tài khoản khách của mình trong app.
 */
describe('DELETE /me (xoá tài khoản trong app)', () => {
  let testApp: TestAppInstance;
  let cloudinary: CloudinaryService;
  let deleted: string[];

  const randomIp = () =>
    `10.${crypto.randomInt(1, 250)}.${crypto.randomInt(1, 250)}.${crypto.randomInt(1, 250)}`;
  const androidId = () => `android-${crypto.randomBytes(8).toString('hex')}`;

  beforeAll(async () => {
    testApp = await createTestApp();
    cloudinary = testApp.app.get(CloudinaryService, { strict: false });
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  beforeEach(() => {
    deleted = [];
    vi.spyOn(cloudinary, 'deleteImage').mockImplementation(async (publicId) => {
      deleted.push(publicId as string);
      return true;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const openApp = (deviceId: string) =>
    fetch(`${testApp.baseUrl}/api/v1/auth/device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-client': 'native', 'x-forwarded-for': randomIp() },
      body: JSON.stringify({ deviceId }),
    });

  const install = async (deviceId = androidId()) => {
    const res = await openApp(deviceId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    return { deviceId, token: body.accessToken as string, id: new Types.ObjectId(body.user.id) };
  };

  const del = (token: string) =>
    fetch(`${testApp.baseUrl}/api/v1/me`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  const getMe = (token: string) =>
    fetch(`${testApp.baseUrl}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } });
  const userDoc = (id: Types.ObjectId) => testApp.connection.collection('users').findOne({ _id: id });
  const seedReading = (userId: Types.ObjectId, extra: Record<string, unknown>) =>
    testApp.connection.collection('readings').insertOne({
      userId,
      idempotencyKey: crypto.randomUUID(),
      status: 'DONE',
      deletedAt: null,
      createdAt: new Date(),
      ...extra,
    });

  it('cần đăng nhập: không token thì 401', async () => {
    const res = await fetch(`${testApp.baseUrl}/api/v1/me`, { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('xoá đúng tài khoản của token, không đụng tài khoản khác', async () => {
    const a = await install();
    const b = await install();

    expect((await del(a.token)).status).toBe(204);

    expect((await userDoc(a.id))?.deletedAt).toBeInstanceOf(Date);
    expect((await userDoc(b.id))?.deletedAt).toBeNull();
    expect((await getMe(b.token)).status).toBe(200);
  });

  it('sau khi xoá: token cũ hết dùng được, dữ liệu cá nhân bị xoá, dấu thiết bị còn để chặn quà', async () => {
    const a = await install();
    await testApp.connection.collection('users').updateOne(
      { _id: a.id },
      { $set: { avatarUrl: 'https://res.cloudinary.com/t/x.jpg', avatarPublicId: 'palmsight/avatars/x' } },
    );

    expect((await del(a.token)).status).toBe(204);

    const doc = await userDoc(a.id);
    expect(doc?.displayName).toBe('Người dùng đã xoá');
    expect(doc?.avatarUrl).toBeNull();
    expect(doc?.avatarPublicId).toBeNull();
    expect(doc?.signupIpHash).toBeNull();
    expect(doc?.deviceIdHash).toBeTruthy();
    expect(deleted).toContain('palmsight/avatars/x');

    const me = await getMe(a.token);
    expect(me.status).toBeGreaterThanOrEqual(400);
    expect(((await me.json()) as any).creditBalance).toBeUndefined();
    expect((await del(a.token)).status).toBeGreaterThanOrEqual(400);
  });

  it('mở lại app trên cùng thiết bị: tài khoản mới, không quà khởi đầu', async () => {
    const a = await install();
    expect((await del(a.token)).status).toBe(204);

    const res = await openApp(a.deviceId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.isNewUser).toBe(true);
    expect(body.user.id).not.toBe(a.id.toString());
    expect(body.user.creditBalance).toBe(0);
  });

  it('xoá luôn ảnh lòng bàn tay trên Cloudinary và nội dung lần xem', async () => {
    const a = await install();
    await seedReading(a.id, {
      result: { summary: 'x' },
      imagePublicId: 'palmsight/reading_a',
      imageUrl: 'https://res.cloudinary.com/t/reading_a.jpg',
      annotatedImagePublicId: 'palmsight/reading_a_ann',
      annotatedImageUrl: 'https://res.cloudinary.com/t/reading_a_ann.jpg',
    });

    expect((await del(a.token)).status).toBe(204);

    expect(deleted).toEqual(expect.arrayContaining(['palmsight/reading_a', 'palmsight/reading_a_ann']));
    const reading = await testApp.connection.collection('readings').findOne({ userId: a.id });
    expect(reading?.result).toBeNull();
    expect(reading?.imageUrl).toBeNull();
    expect(reading?.deletedAt).toBeInstanceOf(Date);
  });

  it('ảnh xoá lỗi: 502 IMAGE_DELETE_FAILED, tài khoản còn nguyên; thử lại thành công', async () => {
    const a = await install();
    await seedReading(a.id, {
      result: { summary: 'giữ' },
      imagePublicId: 'palmsight/reading_fail',
      imageUrl: 'https://res.cloudinary.com/t/reading_fail.jpg',
    });
    vi.spyOn(cloudinary, 'deleteImage').mockResolvedValue(false);

    const fail = await del(a.token);
    expect(fail.status).toBe(502);
    expect(((await fail.json()) as any).error.code).toBe('IMAGE_DELETE_FAILED');
    expect((await userDoc(a.id))?.deletedAt).toBeNull();
    expect((await getMe(a.token)).status).toBe(200);
    expect((await testApp.connection.collection('readings').findOne({ userId: a.id }))?.result).toEqual({
      summary: 'giữ',
    });

    vi.spyOn(cloudinary, 'deleteImage').mockResolvedValue(true);
    expect((await del(a.token)).status).toBe(204);
    expect((await userDoc(a.id))?.deletedAt).toBeInstanceOf(Date);
  });

  it('giới hạn tần suất: quá 5 lần/giờ thì 429', async () => {
    const a = await install();
    await seedReading(a.id, { imagePublicId: 'palmsight/reading_rl' });
    vi.spyOn(cloudinary, 'deleteImage').mockResolvedValue(false);

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await del(a.token)).status);
    expect(statuses.slice(0, 5).every((s) => s === 502)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
