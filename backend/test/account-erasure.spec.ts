import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import * as crypto from 'crypto';
import sharp from 'sharp';
import { Types } from 'mongoose';
import {
  HandOrientation,
  ImageQuality,
  PalmResult,
  ReadingSchool,
  ReadingStatus,
} from '@palmsight/shared';
import { createTestApp, closeTestApp, createGuest, TestAppInstance } from './test-helper';
import { deleteUserAccount } from '../src/users/account-deletion';
import { CloudinaryService } from '../src/readings/cloudinary.service';
import { AiService } from '../src/ai/ai.service';
import { ReadingsService } from '../src/readings/readings.service';
import { BillingService } from '../src/billing/billing.service';
import { UsersService } from '../src/users/users.service';
import { CreditLedgerService } from '../src/credits/credit-ledger.service';
import { reconcileCreditLedger } from '../scripts/db-check';

/**
 * B2: xoá tài khoản phải xoá hết định danh không cần thiết nhưng giữ đúng thứ phục vụ chống farm,
 * đối soát hoá đơn và sổ GEM. Mọi collection được kiểm theo từng trường.
 */
const IDENTITY_SECRET = 'test-identity-secret-at-least-32-chars-long';

describe('B2: xoá dữ liệu khi xoá tài khoản', () => {
  let testApp: TestAppInstance;
  let cloudinary: CloudinaryService;
  let aiService: AiService;
  let imageBuffer: Buffer;

  const palmResult: PalmResult = {
    isPalm: true,
    rejectReason: null,
    school: ReadingSchool.WESTERN,
    hand: HandOrientation.LEFT,
    imageQuality: ImageQuality.GOOD,
    topics: ['heartLine'],
    sections: [
      { key: 'heartLine', title: 'Đường tình cảm', observation: 'Rõ nét', meaning: 'Chân thành' },
    ],
    aspects: {},
    summary: 'Kết quả luận giải phải bị xoá cùng tài khoản.',
    advice: 'Giữ tinh thần tích cực.',
    disclaimer: 'Mang tính giải trí.',
  };

  const col = (name: string) => testApp.connection.collection(name);

  /** Cloudinary giả cho đường xoá tài khoản: ghi lại publicId được gỡ. */
  const makeStub = (onDelete?: (id: string) => Promise<void> | void) => {
    const removed: string[] = [];
    const stub = {
      removed,
      deleteImage: vi.fn(async (id: string) => {
        removed.push(id);
        if (onDelete) await onDelete(id);
        return true;
      }),
    };
    return stub;
  };

  const erase = (userId: string | Types.ObjectId, stub = makeStub()) =>
    deleteUserAccount(testApp.connection, userId, undefined, IDENTITY_SECRET, stub as any);

  const postReading = (token: string, key = crypto.randomUUID()) => {
    const form = new FormData();
    form.append('school', ReadingSchool.WESTERN);
    form.append('hand', HandOrientation.LEFT);
    form.append('aiConsent', 'true');
    form.append('image', new Blob([imageBuffer], { type: 'image/jpeg' }), 'palm.jpg');
    return fetch(`${testApp.baseUrl}/api/v1/readings`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': key },
      body: form,
    });
  };

  const verify = (token: string, purchaseToken: string, extra: Record<string, unknown> = {}) =>
    fetch(`${testApp.baseUrl}/api/v1/billing/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        productId: 'weeklyid',
        purchaseToken,
        isTrial: false,
        priceAmountMicros: 6_990_000,
        priceCurrencyCode: 'USD',
        ...extra,
      }),
    });

  beforeAll(async () => {
    testApp = await createTestApp({
      starterGrant: 5,
      pricePerAction: 1,
      starterNetworkDailyCap: 100,
      anonymousSignupDailyCap: 100,
    });
    cloudinary = testApp.app.get(CloudinaryService, { strict: false });
    aiService = testApp.app.get(AiService);
    imageBuffer = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 120, g: 150, b: 200 } },
    })
      .jpeg()
      .toBuffer();
  }, 60000);

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('trường bị xoá/ẩn và trường được giữ theo từng collection', () => {
    it('users: xoá định danh, VIP và trạng thái hằng ngày; giữ mã băm thiết bị, mã giới thiệu và số dư', async () => {
      const g = await createGuest(testApp);
      const id = new Types.ObjectId(g.id);
      await col('users').updateOne(
        { _id: id },
        {
          $set: {
            billingRef: 'billing-ref-hmac',
            vipExpiresAt: new Date(Date.now() + 86_400_000),
            vipProductId: 'weeklyid',
            vipWillRenew: true,
            vipDailyDay: '2026-11-04',
            checkinDay: '2026-11-04',
            checkinStreak: 3,
            lastCheckinAmount: 2,
            freeSpinDay: '2026-11-04',
            signupIpHash: 'ip-hash-signup',
          },
        },
      );
      const before = (await col('users').findOne({ _id: id }))!;

      expect((await erase(id)).ok).toBe(true);

      const after = (await col('users').findOne({ _id: id }))!;
      // Xoá/ẩn
      expect(after.displayName).toBe('Người dùng đã xoá');
      expect(after.signupIpHash).toBeNull();
      expect(after.billingRef).toBeNull();
      expect(after.vipExpiresAt).toBeNull();
      expect(after.vipProductId).toBeNull();
      expect(after.vipWillRenew).toBe(false);
      expect(after.vipDailyDay).toBeNull();
      expect(after.checkinDay).toBeNull();
      expect(after.checkinStreak).toBe(0);
      expect(after.lastCheckinAmount).toBe(0);
      expect(after.freeSpinDay).toBeNull();
      expect(after.deletedAt).toBeInstanceOf(Date);
      // Giữ: chống farm + sổ GEM
      expect(after.deviceIdHash).toBe(before.deviceIdHash);
      expect(after.deviceIdHash).toEqual(expect.any(String));
      expect(after.referralCode).toBe(before.referralCode);
      expect(after.creditBalance).toBe(before.creditBalance);
      expect(after.starterGrantedAt).toEqual(before.starterGrantedAt);
      expect(after.isAnonymous).toBe(true);
    });

    it('devices: bỏ starterIpHash, giữ dấu quà khởi đầu/điểm danh/vòng quay/mã giới thiệu của thiết bị', async () => {
      const g = await createGuest(testApp);
      const id = new Types.ObjectId(g.id);
      const user = (await col('users').findOne({ _id: id }))!;
      await col('devices').updateOne(
        { deviceIdHash: user.deviceIdHash },
        {
          $set: {
            checkinDay: '2026-11-04',
            checkinUserId: id,
            freeSpinDay: '2026-11-04',
            freeSpinUserId: id,
            referralRedeemedAt: new Date(),
            referralRedeemedUserId: id,
            starterIpHash: 'ip-hash-starter',
          },
        },
      );

      await erase(id);

      const dev = (await col('devices').findOne({ deviceIdHash: user.deviceIdHash }))!;
      expect(dev.starterIpHash).toBeNull();
      expect(dev.starterGrantedAt).toBeInstanceOf(Date);
      expect(dev.starterUserId.toString()).toBe(id.toString());
      expect(dev.checkinDay).toBe('2026-11-04');
      expect(dev.checkinUserId.toString()).toBe(id.toString());
      expect(dev.freeSpinDay).toBe('2026-11-04');
      expect(dev.freeSpinUserId.toString()).toBe(id.toString());
      expect(dev.referralRedeemedAt).toBeInstanceOf(Date);
      expect(dev.referralRedeemedUserId.toString()).toBe(id.toString());
    });

    it('readings: xoá kết quả, ảnh, đường chỉ tay và lý do từ chối; giữ khung metadata', async () => {
      const g = await createGuest(testApp);
      const id = new Types.ObjectId(g.id);
      const readingId = new Types.ObjectId();
      await col('readings').insertOne({
        _id: readingId,
        userId: id,
        idempotencyKey: crypto.randomUUID(),
        school: ReadingSchool.WESTERN,
        topics: ['heartLine'],
        hand: HandOrientation.LEFT,
        status: ReadingStatus.REJECTED,
        result: { summary: 'x' },
        rejectReason: 'Ảnh có người mặc áo đỏ đứng cạnh cửa sổ',
        imageUrl: 'https://img/x.jpg',
        imagePublicId: 'pub-x',
        palmLines: [{ a: 1 }],
        aiProvider: 'gemini',
        deletedAt: null,
        createdAt: new Date(),
      });

      await erase(id);

      const r = (await col('readings').findOne({ _id: readingId }))!;
      expect(r.result).toBeNull();
      expect(r.rejectReason).toBeNull();
      expect(r.imageUrl).toBeNull();
      expect(r.imagePublicId).toBeNull();
      expect(r.palmLines).toBeNull();
      // Chủ đề đã chọn lộ mối quan tâm của người dùng và không có nơi nào đọc lại bản ghi đã xoá
      expect(r.topics).toEqual([]);
      expect(r.deletedAt).toBeInstanceOf(Date);
      expect(r.status).toBe(ReadingStatus.REJECTED);
      expect(r.aiProvider).toBe('gemini');
    });

    it('credit_transactions: xoá note tự do; giữ nguyên số tiền, loại, số dư sau và liên kết (sổ GEM vẫn khớp)', async () => {
      const g = await createGuest(testApp);
      const id = new Types.ObjectId(g.id);
      await col('credit_transactions').insertOne({
        userId: id,
        amount: 2,
        type: 'ADMIN_ADJUST',
        reason: 'admin',
        balanceAfter: 7,
        note: 'CSKH ticket #42, khách nguyen.van.a@example.com',
        createdAt: new Date(),
      });
      await col('users').updateOne({ _id: id }, { $inc: { creditBalance: 2 } });
      const txBefore = await col('credit_transactions').find({ userId: id }).toArray();

      await erase(id);

      const txAfter = await col('credit_transactions').find({ userId: id }).toArray();
      expect(txAfter).toHaveLength(txBefore.length);
      for (const t of txAfter) expect(t.note).toBeUndefined();
      const adj = txAfter.find((t) => t.type === 'ADMIN_ADJUST')!;
      expect(adj.amount).toBe(2);
      expect(adj.balanceAfter).toBe(7);
      expect(adj.reason).toBe('admin');
      const rec = await reconcileCreditLedger(testApp.connection);
      expect(rec.mismatches.filter((m: any) => String(m.userId) === g.id)).toHaveLength(0);
    });

    it('ad_rewards: giữ (kèm deviceIdHash) cho trần quảng cáo theo thiết bị; hết hạn tự xoá bằng TTL purgeAt 48 giờ', async () => {
      const g = await createGuest(testApp);
      const id = new Types.ObjectId(g.id);
      const user = (await col('users').findOne({ _id: id }))!;
      const purgeAt = new Date(Date.now() + 48 * 3_600_000);
      await col('ad_rewards').insertOne({
        userId: id,
        deviceIdHash: user.deviceIdHash,
        kind: 'BONUS',
        status: 'REWARDED',
        rewardDay: '2026-11-04',
        amount: 2,
        purgeAt,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await erase(id);

      const ad = (await col('ad_rewards').findOne({ userId: id }))!;
      expect(ad.deviceIdHash).toBe(user.deviceIdHash);
      expect(ad.purgeAt).toEqual(purgeAt);
    });

    it('referrals: giữ nguyên (trần thưởng theo ngày của chủ mã, một lượt/tài khoản, chống vòng)', async () => {
      const a = await createGuest(testApp);
      const b = await createGuest(testApp);
      const referral = await col('referrals').insertOne({
        referrerId: new Types.ObjectId(a.id),
        refereeId: new Types.ObjectId(b.id),
        codeUsed: a.user.referralCode,
        status: 'REWARDED',
        referrerReward: 2,
        createdAt: new Date(),
      });

      await erase(b.id);

      const r = (await col('referrals').findOne({ _id: referral.insertedId }))!;
      expect(r.refereeId.toString()).toBe(b.id);
      expect(r.referrerId.toString()).toBe(a.id);
      expect(r.codeUsed).toBe(a.user.referralCode);
    });

    it('referral_network_counters: không bị đụng tới (không gắn tài khoản, tự hết hạn bằng TTL)', async () => {
      const g = await createGuest(testApp);
      const day = new Date('2026-11-03T17:00:00Z');
      await col('referral_network_counters').insertOne({
        ipHash: `ip-${crypto.randomUUID()}`,
        day,
        count: 2,
        expiresAt: new Date(Date.now() + 86_400_000),
      });
      const before = await col('referral_network_counters').countDocuments();
      await erase(g.id);
      expect(await col('referral_network_counters').countDocuments()).toBe(before);
    });

    it('sessions: xoá hết phiên đăng nhập', async () => {
      const g = await createGuest(testApp);
      expect(await col('sessions').countDocuments({ userId: new Types.ObjectId(g.id) })).toBeGreaterThan(0);
      await erase(g.id);
      expect(await col('sessions').countDocuments({ userId: new Types.ObjectId(g.id) })).toBe(0);
    });

    it('play_subscriptions / billing_events: xoá GAID, ADID, rawResponse, payload; giữ dữ liệu đối soát', async () => {
      const g = await createGuest(testApp);
      const id = new Types.ObjectId(g.id);
      const purchaseToken = `erase_token_${crypto.randomUUID()}`;
      expect((await verify(g.accessToken, purchaseToken, { gaid: 'GAID-A', adjustAdid: 'ADID-A' })).status).toBe(200);
      // Server không còn lưu GAID/ADID khi mua, kể cả khi client cũ vẫn gửi lên
      const stored = (await col('play_subscriptions').findOne({ purchaseToken }))!;
      expect(stored.gaid ?? null).toBeNull();
      expect(stored.adjustAdid ?? null).toBeNull();
      // Dữ liệu cũ (ghi trước khi ngừng lưu) vẫn phải bị xoá khi xoá tài khoản
      await col('play_subscriptions').updateOne(
        { purchaseToken },
        { $set: { gaid: 'GAID-A', adjustAdid: 'ADID-A', rawResponse: { email: 'a@b.c' } } },
      );
      await col('billing_events').insertOne({
        eventId: `ev-${crypto.randomUUID()}`,
        purchaseToken,
        notificationType: 2,
        productId: 'weeklyid',
        processedAt: new Date(),
        payload: { purchaseToken },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const subBefore = (await col('play_subscriptions').findOne({ purchaseToken }))!;
      expect(subBefore.gaid).toBe('GAID-A');

      await erase(id);

      const sub = (await col('play_subscriptions').findOne({ purchaseToken }))!;
      expect(sub.gaid).toBeNull();
      expect(sub.adjustAdid).toBeNull();
      expect(sub.rawResponse).toBeNull();
      // Giữ cho đối soát
      expect(sub.userId.toString()).toBe(g.id);
      expect(sub.purchaseToken).toBe(purchaseToken);
      expect(sub.productId).toBe('weeklyid');
      expect(sub.orderId).toBe(subBefore.orderId);
      expect(sub.expiresAt).toEqual(subBefore.expiresAt);
      expect(sub.priceAmountMicros).toBe(6_990_000);
      expect(sub.priceCurrencyCode).toBe('USD');
      expect(sub.firstPurchaseCounted).toBe(true);
      const ev = (await col('billing_events').findOne({ purchaseToken }))!;
      expect(ev.payload).toBeNull();
      expect(ev.notificationType).toBe(2);
      expect(ev.productId).toBe('weeklyid');
    });
  });

  describe('chống farm vẫn nguyên sau khi xoá', () => {
    it('cùng thiết bị mở lại app: tài khoản mới 0 GEM, bị chặn mã giới thiệu, không quà khởi đầu; dấu thiết bị còn', async () => {
      const first = await createGuest(testApp);
      expect(first.user.creditBalance).toBe(5);
      await erase(first.id);

      const second = await createGuest(testApp, { deviceId: first.deviceId });
      expect(second.isNewUser).toBe(true);
      expect(second.id).not.toBe(first.id);
      expect(second.user.creditBalance).toBe(0);
      const u2 = (await col('users').findOne({ _id: new Types.ObjectId(second.id) }))!;
      expect(u2.referralBlocked).toBe(true);
      expect(u2.starterGrantedAt).toBeNull();
      const dev = (await col('devices').findOne({ deviceIdHash: u2.deviceIdHash }))!;
      expect(dev.starterGrantedAt).toBeInstanceOf(Date);
      expect(dev.starterUserId.toString()).toBe(first.id);
      // Tài khoản cũ nhường deviceIdHash nhưng vẫn lưu hash đã chuyển
      const u1 = (await col('users').findOne({ _id: new Types.ObjectId(first.id) }))!;
      expect(u1.deviceIdHash).toBeNull();
      expect(u1.deletedDeviceIdHash).toBe(u2.deviceIdHash);
    });

    it('cùng thiết bị: lượt nhập mã giới thiệu cũ vẫn khoá thiết bị sau khi xoá', async () => {
      const referrer = await createGuest(testApp);
      const first = await createGuest(testApp);
      const redeem = (token: string, code: string) =>
        fetch(`${testApp.baseUrl}/api/v1/me/referral`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ code }),
        });
      const res = await redeem(first.accessToken, referrer.user.referralCode);
      expect(res.status).toBe(201);

      await erase(first.id);

      const second = await createGuest(testApp, { deviceId: first.deviceId });
      const again = await redeem(second.accessToken, referrer.user.referralCode);
      expect(again.status).toBeGreaterThanOrEqual(400);
      expect(await col('referrals').countDocuments({ refereeId: new Types.ObjectId(first.id) })).toBe(1);
    });
  });

  describe('lần xem đang PROCESSING lúc xoá tài khoản', () => {
    it('xoá trong lúc AI chạy: không ghi kết quả/ảnh vào bản ghi đã xoá, không tải ảnh lên', async () => {
      const g = await createGuest(testApp);
      const id = new Types.ObjectId(g.id);
      const upload = vi
        .spyOn(cloudinary, 'uploadImage')
        .mockResolvedValue({ url: 'https://img/leak.jpg', publicId: 'leak-main' } as any);
      const del = vi.spyOn(cloudinary, 'deleteImage').mockResolvedValue(true);
      vi.spyOn(aiService, 'readPalm').mockImplementation(async () => {
        expect((await erase(id)).ok).toBe(true);
        return { result: palmResult, provider: 'mock', model: 'mock' } as any;
      });

      const res = await postReading(g.accessToken);
      expect(res.status).toBeGreaterThanOrEqual(400);

      const reading = (await col('readings').findOne({ userId: id }))!;
      expect(reading.deletedAt).toBeInstanceOf(Date);
      expect(reading.result).toBeNull();
      expect(reading.imageUrl).toBeNull();
      expect(reading.imagePublicId).toBeNull();
      expect(reading.status).not.toBe(ReadingStatus.DONE);
      expect(upload).not.toHaveBeenCalled();
      expect(del).not.toHaveBeenCalled();
    });

    it('xoá trong lúc AI trả REJECTED: không ghi lý do từ chối hay trạng thái vào bản ghi đã xoá', async () => {
      const g = await createGuest(testApp);
      const id = new Types.ObjectId(g.id);
      const upload = vi.spyOn(cloudinary, 'uploadImage');
      // Sổ GEM từ chối hoàn cho tài khoản đã xoá nên bước ghi trạng thái không bao giờ chạy tới; giả lập hoàn thành
      // công để kiểm riêng chốt `deletedAt: null` của lệnh ghi trạng thái.
      vi.spyOn(testApp.app.get(CreditLedgerService), 'refundReading').mockResolvedValue({ balanceAfter: 0 } as any);
      vi.spyOn(aiService, 'readPalm').mockImplementation(async () => {
        expect((await erase(id)).ok).toBe(true);
        return {
          result: { ...palmResult, isPalm: false, rejectReason: 'Ảnh có người mặc áo đỏ đứng cạnh cửa sổ' },
          provider: 'mock',
          model: 'mock',
        } as any;
      });

      await postReading(g.accessToken);

      const reading = (await col('readings').findOne({ userId: id }))!;
      expect(reading.deletedAt).toBeInstanceOf(Date);
      expect(reading.rejectReason ?? null).toBeNull();
      expect(reading.status).not.toBe(ReadingStatus.REJECTED);
      expect(reading.completedAt ?? null).toBeNull();
      expect(reading.aiProvider ?? null).toBeNull();
      expect(upload).not.toHaveBeenCalled();
    });

    it('xoá trong lúc AI lỗi (FAILED): không ghi errorCode hay trạng thái vào bản ghi đã xoá', async () => {
      const g = await createGuest(testApp);
      const id = new Types.ObjectId(g.id);
      // Sổ GEM từ chối hoàn cho tài khoản đã xoá nên bước ghi trạng thái không bao giờ chạy tới; giả lập hoàn thành
      // công để kiểm riêng chốt `deletedAt: null` của lệnh ghi trạng thái.
      vi.spyOn(testApp.app.get(CreditLedgerService), 'refundReading').mockResolvedValue({ balanceAfter: 0 } as any);
      vi.spyOn(aiService, 'readPalm').mockImplementation(async () => {
        expect((await erase(id)).ok).toBe(true);
        throw new Error('provider down');
      });

      const res = await postReading(g.accessToken);
      expect(res.status).toBe(503);

      const reading = (await col('readings').findOne({ userId: id }))!;
      expect(reading.deletedAt).toBeInstanceOf(Date);
      expect(reading.status).not.toBe(ReadingStatus.FAILED);
      expect(reading.errorCode ?? null).toBeNull();
      expect(reading.completedAt ?? null).toBeNull();
    });

    it('deleteReading một lần xem còn hiệu lực: xoá kết quả, ảnh và đặt topics về []', async () => {
      const g = await createGuest(testApp);
      const id = new Types.ObjectId(g.id);
      const readingId = new Types.ObjectId();
      await col('readings').insertOne({
        _id: readingId,
        userId: id,
        idempotencyKey: crypto.randomUUID(),
        school: ReadingSchool.WESTERN,
        topics: ['heartLine', 'career'],
        hand: HandOrientation.LEFT,
        status: ReadingStatus.DONE,
        result: { summary: 'x' },
        palmLines: [{ a: 1 }],
        imagePublicId: 'pub-del',
        imageUrl: 'https://img/del.jpg',
        deletedAt: null,
        createdAt: new Date(),
      });
      const del = vi.spyOn(cloudinary, 'deleteImage').mockResolvedValue(true);

      await testApp.app.get(ReadingsService).deleteReading(id, readingId.toString());

      expect(del).toHaveBeenCalledWith('pub-del');
      const after = (await col('readings').findOne({ _id: readingId }))!;
      expect(after.deletedAt).toBeInstanceOf(Date);
      expect(after.result).toBeNull();
      expect(after.imagePublicId).toBeNull();
      expect(after.topics).toEqual([]);
    });

    it('deleteReading với bản ghi đã xoá: 404, không gọi Cloudinary và không ghi lại deletedAt', async () => {
      const g = await createGuest(testApp);
      const id = new Types.ObjectId(g.id);
      const erasedAt = new Date('2026-01-01T00:00:00Z');
      const readingId = new Types.ObjectId();
      await col('readings').insertOne({
        _id: readingId,
        userId: id,
        idempotencyKey: crypto.randomUUID(),
        school: ReadingSchool.WESTERN,
        topics: [],
        hand: HandOrientation.LEFT,
        status: ReadingStatus.DONE,
        // Còn sót ảnh: nếu code không lọc deletedAt thì sẽ đi xoá ảnh và ghi đè deletedAt
        imagePublicId: 'leftover-pub',
        imageUrl: 'https://img/leftover.jpg',
        deletedAt: erasedAt,
        createdAt: new Date(),
      });
      const del = vi.spyOn(cloudinary, 'deleteImage').mockResolvedValue(true);
      const readings = testApp.app.get(ReadingsService);

      await expect(readings.deleteReading(id, readingId.toString())).rejects.toMatchObject({
        status: 404,
      });

      expect(del).not.toHaveBeenCalled();
      const after = (await col('readings').findOne({ _id: readingId }))!;
      expect(after.deletedAt).toEqual(erasedAt);
      expect(after.imagePublicId).toBe('leftover-pub');
    });

    it('xoá trong lúc đang tải ảnh: ảnh vừa tải bị dọn trên Cloudinary và DB không giữ kết quả', async () => {
      const g = await createGuest(testApp);
      const id = new Types.ObjectId(g.id);
      vi.spyOn(aiService, 'readPalm').mockResolvedValue({
        result: palmResult,
        provider: 'mock',
        model: 'mock',
      } as any);
      vi.spyOn(cloudinary, 'uploadImage').mockImplementation(async (_b, opts) => {
        // Tài khoản bị xoá đúng lúc ảnh đang lên Cloudinary
        expect((await erase(id)).ok).toBe(true);
        return { url: 'https://img/late.jpg', publicId: String(opts?.publicId) } as any;
      });
      const del = vi.spyOn(cloudinary, 'deleteImage').mockResolvedValue(true);

      const res = await postReading(g.accessToken);
      expect(res.status).toBeGreaterThanOrEqual(400);

      const reading = (await col('readings').findOne({ userId: id }))!;
      expect(reading.deletedAt).toBeInstanceOf(Date);
      expect(reading.result).toBeNull();
      expect(reading.imageUrl).toBeNull();
      expect(reading.imagePublicId).toBeNull();
      expect(reading.status).not.toBe(ReadingStatus.DONE);
      expect(del).toHaveBeenCalledWith(`reading_${reading._id.toString()}`);
      // Không ghi thêm sổ GEM: chỉ còn lượt trừ ban đầu, không hoàn cho tài khoản đã xoá
      const tx = await col('credit_transactions').find({ readingId: reading._id }).toArray();
      expect(tx.map((t) => t.type)).toEqual(['READING_SPEND']);
    });

    it('ảnh ghi xong ngay giữa lúc tài khoản đang bị xoá vẫn được gỡ khỏi Cloudinary và DB', async () => {
      const g = await createGuest(testApp);
      const id = new Types.ObjectId(g.id);
      const early = new Types.ObjectId();
      const late = new Types.ObjectId();
      const base = { userId: id, school: 'WESTERN', topics: ['heartLine'], hand: 'LEFT', deletedAt: null, createdAt: new Date() };
      await col('readings').insertMany([
        { _id: early, ...base, idempotencyKey: crypto.randomUUID(), status: 'DONE', imageUrl: 'https://img/e.jpg', imagePublicId: 'early-pub' },
        { _id: late, ...base, idempotencyKey: crypto.randomUUID(), status: 'PROCESSING' },
      ]);
      // Khi Cloudinary đang gỡ ảnh cũ, lần xem PROCESSING kia hoàn tất và ghi ảnh mới
      const stub = makeStub(async (publicId) => {
        if (publicId === 'early-pub') {
          await col('readings').updateOne(
            { _id: late },
            { $set: { status: 'DONE', imageUrl: 'https://img/l.jpg', imagePublicId: 'late-pub' } },
          );
        }
      });

      const out = await erase(id, stub);

      expect(out.ok).toBe(true);
      expect(stub.removed).toEqual(expect.arrayContaining(['early-pub', 'late-pub']));
      const l = (await col('readings').findOne({ _id: late }))!;
      expect(l.imagePublicId).toBeNull();
      expect(l.imageUrl).toBeNull();
      expect(l.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe('khôi phục VIP sau khi xoá tài khoản (mô tả hành vi hiện tại)', () => {
    it('cùng thiết bị mở tài khoản mới rồi khôi phục bằng purchaseToken cũ: token và VIP chuyển sang tài khoản mới, GAID cũ không còn', async () => {
      const a = await createGuest(testApp);
      const purchaseToken = `restore_after_erase_${crypto.randomUUID()}`;
      const buy = await verify(a.accessToken, purchaseToken, { gaid: 'GAID-OLD', adjustAdid: 'ADID-OLD' });
      expect(buy.status).toBe(200);
      const subA = (await col('play_subscriptions').findOne({ purchaseToken }))!;
      expect(subA.gaid ?? null).toBeNull();
      // Dữ liệu cũ ghi trước khi ngừng lưu
      await col('play_subscriptions').updateOne({ purchaseToken }, { $set: { gaid: 'GAID-OLD', adjustAdid: 'ADID-OLD' } });

      await erase(a.id);

      // Sau xoá: token vẫn thuộc A (đối soát) nhưng không còn định danh quảng cáo
      const mid = (await col('play_subscriptions').findOne({ purchaseToken }))!;
      expect(mid.userId.toString()).toBe(a.id);
      expect(mid.gaid).toBeNull();
      expect(mid.adjustAdid).toBeNull();

      const b = await createGuest(testApp, { deviceId: a.deviceId });
      expect(b.user.creditBalance).toBe(0);
      const restore = await verify(b.accessToken, purchaseToken, { gaid: 'GAID-NEW' });
      expect(restore.status).toBe(200);
      const body = (await restore.json()) as any;
      expect(body.restored).toBe(true);
      expect(body.firstPurchase).toBe(false);
      expect(body.vip.active).toBe(true);

      const subs = await col('play_subscriptions').find({ purchaseToken }).toArray();
      expect(subs).toHaveLength(1);
      expect(subs[0].userId.toString()).toBe(b.id);
      // GAID cũ không quay lại và server không lưu GAID mới gửi lên
      expect(subs[0].gaid ?? null).toBeNull();
      expect(subs[0].adjustAdid ?? null).toBeNull();

      const uA = (await col('users').findOne({ _id: new Types.ObjectId(a.id) }))!;
      expect(uA.vipExpiresAt).toBeNull();
      expect(uA.vipProductId).toBeNull();
      expect(uA.billingRef).toBeNull();
      const uB = (await col('users').findOne({ _id: new Types.ObjectId(b.id) }))!;
      expect(uB.vipExpiresAt).toBeInstanceOf(Date);
      expect(uB.billingRef).toEqual(expect.any(String));
    });

    it('cùng thiết bị, khác tài khoản, cùng ngày: khôi phục VIP không nhận lại +50 hằng ngày, cả ở /billing/verify lẫn /me; hôm sau nhận được', async () => {
      const billing = testApp.app.get(BillingService);
      const users = testApp.app.get(UsersService);
      const me = async (token: string) =>
        (await (
          await fetch(`${testApp.baseUrl}/api/v1/me`, { headers: { Authorization: `Bearer ${token}` } })
        ).json()) as any;
      try {
        const a = await createGuest(testApp);
        const purchaseToken = `restore_daily_${crypto.randomUUID()}`;
        const buy = (await (await verify(a.accessToken, purchaseToken)).json()) as any;
        expect(buy.grantedNow).toBe(true);
        const userA = (await col('users').findOne({ _id: new Types.ObjectId(a.id) }))!;
        const deviceBefore = (await col('devices').findOne({ deviceIdHash: userA.deviceIdHash }))!;
        expect(deviceBefore.vipDailyUserId.toString()).toBe(a.id);
        await erase(a.id);
        // Dấu thiết bị còn nguyên sau khi xoá (đó là điều chặn farm)
        const deviceAfter = (await col('devices').findOne({ deviceIdHash: userA.deviceIdHash }))!;
        expect(deviceAfter.vipDailyDay).toBe(deviceBefore.vipDailyDay);

        const b = await createGuest(testApp, { deviceId: a.deviceId });
        const restore = (await (await verify(b.accessToken, purchaseToken)).json()) as any;
        expect(restore.vip.active).toBe(true);
        expect(restore.grantedNow).toBe(false);
        expect(restore.vipDailyGranted).toBeUndefined();
        expect(restore.balance).toBe(0);

        // /me cùng ngày cũng không cấp
        const sameDay = await me(b.accessToken);
        expect(sameDay.vipDailyGranted).toBeUndefined();
        expect(sameDay.creditBalance).toBe(0);

        // Hôm sau: nhận bình thường, một lần
        const tomorrow = new Date(Date.now() + 26 * 3600 * 1000);
        billing.setClock(() => tomorrow);
        users.setClock(() => tomorrow);
        const nextDay = await me(b.accessToken);
        expect(nextDay.vipDailyGranted).toBe(50);
        expect(nextDay.creditBalance).toBe(50);
        const again = await me(b.accessToken);
        expect(again.vipDailyGranted).toBeUndefined();
        expect(again.creditBalance).toBe(50);
        const deviceNext = (await col('devices').findOne({ deviceIdHash: userA.deviceIdHash }))!;
        expect(deviceNext.vipDailyUserId.toString()).toBe(b.id);
      } finally {
        billing.resetClock();
        users.resetClock();
      }
    });

    it('tài khoản không có deviceIdHash giữ hành vi cũ: chỉ giới hạn theo tài khoản, vẫn nhận +50', async () => {
      const a = await createGuest(testApp);
      const purchaseToken = `restore_nodevice_${crypto.randomUUID()}`;
      expect(((await (await verify(a.accessToken, purchaseToken)).json()) as any).grantedNow).toBe(true);
      await erase(a.id);

      const b = await createGuest(testApp, { deviceId: a.deviceId });
      await col('users').updateOne({ _id: new Types.ObjectId(b.id) }, { $set: { deviceIdHash: null } });
      const restore = (await (await verify(b.accessToken, purchaseToken)).json()) as any;
      expect(restore.grantedNow).toBe(true);
      expect(restore.balance).toBe(restore.vipDailyGranted);
    });

    it('RTDN đến sau khi xoá: không ghi lại payload và không bật lại VIP trên tài khoản đã xoá; vẫn cập nhật hạn để đối soát', async () => {
      const a = await createGuest(testApp);
      const purchaseToken = `rtdn_after_erase_${crypto.randomUUID()}`;
      expect((await verify(a.accessToken, purchaseToken)).status).toBe(200);
      await erase(a.id);

      const eventId = `rtdn-${crypto.randomUUID()}`;
      const data = Buffer.from(
        JSON.stringify({
          packageName: 'com.palmsight.app',
          eventTimeMillis: String(Date.now()),
          subscriptionNotification: { version: '1.0', notificationType: 2, purchaseToken, subscriptionId: 'weeklyid' },
        }),
      ).toString('base64');
      const res = await fetch(`${testApp.baseUrl}/api/v1/billing/rtdn?token=test-rtdn-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: { messageId: eventId, data } }),
      });
      expect(res.status).toBe(200);

      const ev = (await col('billing_events').findOne({ eventId }))!;
      expect(ev.purchaseToken).toBe(purchaseToken);
      expect(ev.payload).toBeNull();
      const sub = (await col('play_subscriptions').findOne({ purchaseToken }))!;
      expect(sub.rawResponse).toBeNull();
      expect(sub.expiresAt).toBeInstanceOf(Date);
      const uA = (await col('users').findOne({ _id: new Types.ObjectId(a.id) }))!;
      expect(uA.vipExpiresAt).toBeNull();
      expect(uA.vipProductId).toBeNull();
    });
  });
});
