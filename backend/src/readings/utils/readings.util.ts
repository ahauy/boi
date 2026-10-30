import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { GuestReadingPreviewDto } from '@palmsight/shared';

export const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const STUCK_TIMEOUT_MS = 2 * 60 * 1000;

export const resolveObjectId = (val: any): Types.ObjectId => {
  if (val instanceof Types.ObjectId) return val;
  if (typeof val === 'string') return new Types.ObjectId(val);
  if (val && typeof val === 'object' && val._id) return new Types.ObjectId(val._id);
  return new Types.ObjectId(String(val));
};

export const assertValidIdempotencyKey = (idempotencyKey?: string): string => {
  if (!idempotencyKey) {
    throw new BadRequestException({
      code: 'IDEMPOTENCY_KEY_REQUIRED',
      message: 'Thiếu header Idempotency-Key.',
    });
  }

  if (!UUID_V4_REGEX.test(idempotencyKey)) {
    throw new BadRequestException({
      code: 'VALIDATION_ERROR',
      message: 'Header Idempotency-Key không đúng định dạng UUID v4.',
      details: {
        fields: [{ field: 'Idempotency-Key', message: 'Phải là UUID v4 hợp lệ' }],
      },
    });
  }

  return idempotencyKey;
};

export const formatReading = (doc: any): Record<string, unknown> => ({
  id: doc._id.toString(),
  status: doc.status,
  school: doc.school,
  topics: doc.topics,
  hand: doc.hand,
  result: doc.result ?? null,
  imageUrl: doc.imageUrl ?? null,
  annotatedImageUrl: doc.annotatedImageUrl ?? null,
  palmLines: doc.palmLines ?? null,
  rejectReason: doc.rejectReason ?? undefined,
  createdAt: doc.createdAt?.toISOString?.() ?? doc.createdAt,
  completedAt: doc.completedAt?.toISOString?.() ?? doc.completedAt,
});

export const buildGuestPreviewResponse = (
  reading: any,
  truncated: any,
  claimToken?: string | null,
): GuestReadingPreviewDto => ({
  id: reading._id.toString(),
  school: reading.school,
  hand: reading.hand,
  topics: reading.topics,
  status: reading.status,
  summary: truncated.summary,
  sections: truncated.sections,
  aspects: truncated.aspects,
  advice: truncated.advice,
  disclaimer: truncated.disclaimer,
  imageUrl: reading.imageUrl ?? null,
  annotatedImageUrl: reading.annotatedImageUrl ?? null,
  palmLines: reading.palmLines ?? null,
  previewExpiresAt: reading.previewExpiresAt
    ? typeof reading.previewExpiresAt === 'string'
      ? reading.previewExpiresAt
      : reading.previewExpiresAt.toISOString()
    : '',
  createdAt: typeof reading.createdAt === 'string'
    ? reading.createdAt
    : reading.createdAt.toISOString(),
  ...(claimToken ? { claimToken } : {}),
});
