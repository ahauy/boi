import * as crypto from 'crypto';
import { Connection, Types } from 'mongoose';
import { DeletedIdentityKind } from '@palmsight/shared';
import {
  UserSchema,
  DeletedIdentitySchema,
  SessionSchema,
  ReadingSchema,
  PlaySubscriptionSchema,
  BillingEventSchema,
  DeviceSchema,
  CreditTransactionSchema,
} from '../schemas';
import { CloudinaryService } from '../readings/cloudinary.service';

/**
 * Logic xoá tài khoản dùng chung cho `DELETE /me` (người dùng tự xoá trong app) và
 * `scripts/users-delete.ts` (xoá thủ công). Chỉ có một bản để hai đường không lệch nhau.
 */

export interface DeleteUserAccountResult {
  /** true khi tài khoản đã xoá và mọi ảnh đã gỡ khỏi Cloudinary. */
  ok: boolean;
  /** true khi dữ liệu trong DB đã được xoá/ẩn danh. false nghĩa là chưa đụng tới DB. */
  deleted: boolean;
  message: string;
  identitiesRecorded: number;
  unremovedImages?: string[];
}

export async function deleteUserAccount(
  conn: Connection,
  userId: string | Types.ObjectId,
  note?: string,
  identitySecret?: string,
  cloudinary: CloudinaryService = new CloudinaryService(),
): Promise<DeleteUserAccountResult> {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new Error(`Invalid user ID: ${userId}`);
  }

  const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

  const userModel = conn.models.User || conn.model('User', UserSchema);
  const deletedIdentityModel =
    conn.models.DeletedIdentity || conn.model('DeletedIdentity', DeletedIdentitySchema);
  const sessionModel = conn.models.Session || conn.model('Session', SessionSchema);
  const readingModel = conn.models.Reading || conn.model('Reading', ReadingSchema);
  const playSubscriptionModel =
    conn.models.PlaySubscription || conn.model('PlaySubscription', PlaySubscriptionSchema);
  const billingEventModel =
    conn.models.BillingEvent || conn.model('BillingEvent', BillingEventSchema);

  const deviceModel = conn.models.Device || conn.model('Device', DeviceSchema);
  const creditTransactionModel =
    conn.models.CreditTransaction || conn.model('CreditTransaction', CreditTransactionSchema);

  const secret =
    identitySecret || process.env.IDENTITY_HASH_SECRET || 'palmsight-identity-secret';

  // Kiểm tra tồn tại trước khi đụng tới Cloudinary: tài khoản đã xoá thì không làm gì.
  const existing = await userModel
    .findOne({ _id: userObjectId, deletedAt: null })
    .select('avatarPublicId')
    .lean();
  if (!existing) {
    throw new Error(`User not found or already deleted: ${userId}`);
  }

  const userReadings = await readingModel
    .find({ userId: userObjectId })
    .select('imagePublicId annotatedImagePublicId')
    .lean();

  // Xoá ảnh TRƯỚC khi ghi DB: ảnh lỗi thì tài khoản còn nguyên để người dùng thử lại, thay vì
  // xoá xong mới phát hiện ảnh mồ côi mà không còn đường nào quay lại. Cloudinary coi
  // "not found" là thành công nên chạy lại sau lỗi một phần vẫn an toàn.
  const imagePublicIds: string[] = [
    ...userReadings.flatMap((doc: any) => [doc.imagePublicId, doc.annotatedImagePublicId]),
    (existing as any).avatarPublicId,
  ].filter(
    (id): id is string =>
      typeof id === 'string' && Boolean(id.trim()) && !id.startsWith('local:'),
  );

  const unremovedImages: string[] = [];
  if (imagePublicIds.length > 0) {
    const results = await Promise.allSettled(
      imagePublicIds.map((id) => cloudinary.deleteImage(id)),
    );
    results.forEach((res, index) => {
      if (res.status === 'rejected' || !res.value) {
        unremovedImages.push(imagePublicIds[index]);
      }
    });
  }

  if (unremovedImages.length > 0) {
    return {
      ok: false,
      deleted: false,
      message: `Account for user ${userId} NOT deleted: ${unremovedImages.length} images failed to delete on Cloudinary: ${unremovedImages.join(', ')}. Nothing was changed in the database; run again.`,
      identitiesRecorded: 0,
      unremovedImages,
    };
  }

  const session = await conn.startSession();
  session.startTransaction();

  try {
    const user = await userModel
      .findOne({ _id: userObjectId, deletedAt: null })
      .session(session);

    if (!user) {
      throw new Error(`User not found or already deleted: ${userId}`);
    }

    const identitiesToRecord: Array<{ kind: DeletedIdentityKind; input: string }> = [];

    if (user.email) {
      identitiesToRecord.push({
        kind: DeletedIdentityKind.EMAIL,
        input: user.email.toLowerCase(),
      });
    }

    if (Array.isArray(user.identities)) {
      for (const id of user.identities) {
        if (id.provider && id.providerUserId) {
          identitiesToRecord.push({
            kind: id.provider as unknown as DeletedIdentityKind,
            input: `${id.provider}:${id.providerUserId}`,
          });
        }
        if (
          id.email &&
          (!user.email || id.email.toLowerCase() !== user.email.toLowerCase())
        ) {
          identitiesToRecord.push({
            kind: DeletedIdentityKind.EMAIL,
            input: id.email.toLowerCase(),
          });
        }
      }
    }

    const uniqueIdentities = new Map<
      string,
      { kind: DeletedIdentityKind; valueHmac: string }
    >();

    for (const item of identitiesToRecord) {
      const valueHmac = crypto
        .createHmac('sha256', secret)
        .update(item.input)
        .digest('hex');

      if (!uniqueIdentities.has(valueHmac)) {
        uniqueIdentities.set(valueHmac, { kind: item.kind, valueHmac });
      }
    }

    const now = new Date();
    let identitiesRecorded = 0;

    for (const item of uniqueIdentities.values()) {
      try {
        await deletedIdentityModel.updateOne(
          { valueHmac: item.valueHmac },
          {
            $setOnInsert: {
              kind: item.kind,
              valueHmac: item.valueHmac,
              deletedAt: now,
            },
          },
          { upsert: true, session },
        );
        identitiesRecorded++;
      } catch (err: unknown) {
        const error = err as { code?: number; message?: string };
        if (error.code === 11000 || error.message?.includes('E11000')) {
          identitiesRecorded++;
        } else {
          throw err;
        }
      }
    }

    await sessionModel.deleteMany({ userId: userObjectId }, { session });

    // Lần xem PROCESSING có thể vừa ghi ảnh giữa lúc xoá ảnh ở trên và transaction này. Đọc lại
    // trong transaction để gỡ nốt ảnh đó trước khi xoá tham chiếu; nếu nó ghi sau snapshot thì
    // updateMany bên dưới xung đột ghi và transaction bị huỷ để người dùng thử lại.
    const lateReadings = await readingModel
      .find({ userId: userObjectId })
      .select('imagePublicId annotatedImagePublicId')
      .session(session)
      .lean();
    const alreadyRemoved = new Set(imagePublicIds);
    const lateImageIds = lateReadings
      .flatMap((doc: any) => [doc.imagePublicId, doc.annotatedImagePublicId])
      .filter(
        (id): id is string =>
          typeof id === 'string' &&
          Boolean(id.trim()) &&
          !id.startsWith('local:') &&
          !alreadyRemoved.has(id),
      );
    if (lateImageIds.length > 0) {
      const lateResults = await Promise.allSettled(
        lateImageIds.map((id) => cloudinary.deleteImage(id)),
      );
      const lateFailed = lateImageIds.filter((_, index) => {
        const res = lateResults[index];
        return res.status === 'rejected' || !res.value;
      });
      if (lateFailed.length > 0) {
        await session.abortTransaction();
        return {
          ok: false,
          deleted: false,
          message: `Account for user ${userId} NOT deleted: ${lateFailed.length} images failed to delete on Cloudinary: ${lateFailed.join(', ')}. Nothing was changed in the database; run again.`,
          identitiesRecorded: 0,
          unremovedImages: lateFailed,
        };
      }
    }

    await readingModel.updateMany(
      { userId: userObjectId },
      {
        $set: {
          result: null,
          rejectReason: null,
          imageUrl: null,
          annotatedImageUrl: null,
          imagePublicId: null,
          annotatedImagePublicId: null,
          palmLines: null,
          // Chủ đề đã chọn lộ mối quan tâm; bản ghi đã xoá không có nơi nào đọc lại (mọi truy vấn lọc deletedAt:null).
          topics: [],
          deletedAt: now,
        },
      },
      { session },
    );

    const userSubs = await playSubscriptionModel
      .find({ userId: userObjectId })
      .select('purchaseToken')
      .session(session)
      .lean();
    const purchaseTokens = (userSubs || [])
      .map((s: any) => s.purchaseToken)
      .filter((t: any): t is string => typeof t === 'string' && Boolean(t.trim()));

    await playSubscriptionModel.updateMany(
      { userId: userObjectId },
      {
        $set: {
          gaid: null,
          adjustAdid: null,
          rawResponse: null,
        },
      },
      { session },
    );

    if (purchaseTokens.length > 0) {
      await billingEventModel.updateMany(
        { purchaseToken: { $in: purchaseTokens } },
        {
          $set: {
            payload: null,
          },
        },
        { session },
      );
    }

    // Sổ GEM giữ nguyên số tiền, loại và số dư; chỉ bỏ ghi chú tự do vì có thể chứa định danh.
    await creditTransactionModel.updateMany(
      { userId: userObjectId, note: { $exists: true } },
      { $unset: { note: '' } },
      { session },
    );

    // Dấu thiết bị (quà khởi đầu, điểm danh, vòng quay, mã giới thiệu) phải còn để chống farm;
    // chỉ hash IP lúc nhận quà là không có nơi nào đọc nên xoá.
    if (user.deviceIdHash) {
      await deviceModel.updateOne(
        { deviceIdHash: user.deviceIdHash },
        { $set: { starterIpHash: null } },
        { session },
      );
    }

    await userModel.updateOne(
      { _id: userObjectId },
      {
        $set: {
          billingRef: null,
          vipExpiresAt: null,
          vipProductId: null,
          vipWillRenew: false,
          vipDailyDay: null,
          checkinDay: null,
          checkinStreak: 0,
          lastCheckinAmount: 0,
          freeSpinDay: null,
          displayName: 'Người dùng đã xoá',
          username: null,
          email: null,
          passwordHash: null,
          passwordUpdatedAt: null,
          avatarUrl: null,
          avatarPublicId: null,
          signupIpHash: null,
          identities: [],
          deletedAt: now,
        },
      },
      { session },
    );

    await session.commitTransaction();

    return {
      ok: true,
      deleted: true,
      message: `Account for user ${userId} deleted successfully.${note ? ` Note: ${note}` : ''}`,
      identitiesRecorded,
      unremovedImages: [],
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}
