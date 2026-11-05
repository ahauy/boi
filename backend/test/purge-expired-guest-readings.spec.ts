import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { Types } from 'mongoose';
import { createTestApp, closeTestApp, TestAppInstance } from './test-helper';
import { purgeExpiredGuestReadings } from '../scripts/purge-expired-guest-readings';
import { CloudinaryService } from '../src/readings/cloudinary.service';
import { ReadingStatus, ReadingSchool, HandOrientation } from '@palmsight/shared';

describe('A1: Purge Expired Guest Readings & Cloudinary Assets', () => {
  let testApp: TestAppInstance;

  beforeAll(async () => {
    testApp = await createTestApp();
  });

  afterAll(async () => {
    await closeTestApp(testApp);
  });

  beforeEach(async () => {
    await testApp.connection.collection('readings').deleteMany({});
    await testApp.connection.collection('guest_trials').deleteMany({});
  });

  it('purges expired guest readings from Cloudinary first, then deletes document and guest trial', async () => {
    const expiredReadingId = new Types.ObjectId();
    const activeReadingId = new Types.ObjectId();

    const deletedPublicIds: string[] = [];
    const mockCloudinary = {
      isConfigured: () => true,
      deleteImage: vi.fn(async (publicId: string) => {
        deletedPublicIds.push(publicId);
        return true;
      }),
    } as unknown as CloudinaryService;

    // Seed expired guest reading
    await testApp.connection.collection('readings').insertOne({
      _id: expiredReadingId,
      userId: null,
      isGuest: true,
      status: ReadingStatus.GUEST_PREVIEW,
      school: ReadingSchool.WESTERN,
      hand: HandOrientation.LEFT,
      topics: ['heartLine'],
      imagePublicId: 'guest_img_expired_1',
      annotatedImagePublicId: 'guest_annotated_expired_1',
      previewExpiresAt: new Date(Date.now() - 60_000), // 1 min ago
      createdAt: new Date(Date.now() - 7 * 24 * 3600 * 1000),
    });

    // Seed linked guest trial
    await testApp.connection.collection('guest_trials').insertOne({
      readingId: expiredReadingId,
      guestTokenHash: 'hash123',
      expiresAt: new Date(Date.now() - 60_000),
    });

    // Seed unexpired guest reading
    await testApp.connection.collection('readings').insertOne({
      _id: activeReadingId,
      userId: null,
      isGuest: true,
      status: ReadingStatus.GUEST_PREVIEW,
      school: ReadingSchool.WESTERN,
      hand: HandOrientation.LEFT,
      topics: ['heartLine'],
      imagePublicId: 'guest_img_active_2',
      annotatedImagePublicId: 'guest_annotated_active_2',
      previewExpiresAt: new Date(Date.now() + 60_000), // in future
      createdAt: new Date(),
    });

    const result = await purgeExpiredGuestReadings(
      testApp.connection,
      mockCloudinary,
      { limit: 10 }
    );

    expect(result.ok).toBe(true);
    expect(result.processed).toBe(1);
    expect(result.imagesDeleted).toBe(2);
    expect(deletedPublicIds).toContain('guest_img_expired_1');
    expect(deletedPublicIds).toContain('guest_annotated_expired_1');

    // Expired reading and guest trial deleted
    const expiredInDb = await testApp.connection.collection('readings').findOne({ _id: expiredReadingId });
    expect(expiredInDb).toBeNull();
    const trialInDb = await testApp.connection.collection('guest_trials').findOne({ readingId: expiredReadingId });
    expect(trialInDb).toBeNull();

    // Active reading still exists
    const activeInDb = await testApp.connection.collection('readings').findOne({ _id: activeReadingId });
    expect(activeInDb).not.toBeNull();
  });

  it('keeps reading document in DB if Cloudinary deletion fails so it can be retried', async () => {
    const expiredReadingId = new Types.ObjectId();

    const mockCloudinary = {
      isConfigured: () => true,
      deleteImage: vi.fn(async () => false), // fails
    } as unknown as CloudinaryService;

    await testApp.connection.collection('readings').insertOne({
      _id: expiredReadingId,
      userId: null,
      isGuest: true,
      status: ReadingStatus.GUEST_PREVIEW,
      school: ReadingSchool.WESTERN,
      hand: HandOrientation.LEFT,
      topics: ['heartLine'],
      imagePublicId: 'failed_to_delete_img',
      previewExpiresAt: new Date(Date.now() - 60_000),
      createdAt: new Date(),
    });

    const result = await purgeExpiredGuestReadings(
      testApp.connection,
      mockCloudinary,
    );

    expect(result.ok).toBe(false);
    expect(result.processed).toBe(0);
    expect(result.failedImages).toContain('failed_to_delete_img');

    // Document is NOT deleted
    const docInDb = await testApp.connection.collection('readings').findOne({ _id: expiredReadingId });
    expect(docInDb).not.toBeNull();
  });
});
