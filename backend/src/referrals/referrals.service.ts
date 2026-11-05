import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, Types } from 'mongoose';
import {
  CREDIT_AMOUNTS,
  CreditTransactionType,
  EnterReferralResponseDto,
  PaginationQueryDto,
  REFERRAL_CODE_REGEX,
  ReferralListResponseDto,
  ReferralStatus,
} from '@palmsight/shared';
import { hashIp } from '../common/client-ip.util';
import { CreditLedgerService } from '../credits/credit-ledger.service';
import {
  computeDeviceIdHash,
  DEFAULT_IDENTITY_HASH_SECRET,
} from '../common/device-id-hash.util';
import { Device, DeviceDocument } from '../schemas/device.schema';
import { Referral, ReferralDocument } from '../schemas/referral.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { maskDisplayName } from './mask-display-name.util';
import { startOfReferralDay } from './referral-day.util';
import { ReferralNetworkQuotaService } from './referral-network-quota.service';

// Thưởng chủ mã trước khi referrals lưu referrerReward.
const LEGACY_REFERRER_REWARD = 2;

@Injectable()
export class ReferralsService {
  constructor(
    @InjectModel(Referral.name)
    private readonly referralModel: Model<ReferralDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Device.name)
    private readonly deviceModel: Model<DeviceDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly creditLedgerService: CreditLedgerService,
    private readonly referralNetworkQuota: ReferralNetworkQuotaService,
    @Optional()
    private readonly configService?: ConfigService,
  ) {}

  async enterReferral(
    user: UserDocument,
    code: string,
    rawDeviceHeader?: string,
    clientIp?: string | null,
  ): Promise<EnterReferralResponseDto> {
    const normalizedCode = code.trim().toUpperCase();

    // Gate 1: REFERRAL_NOT_ALLOWED (403): If user.referralBlocked === true (account recreated from deleted identity).
    if (user.referralBlocked === true) {
      throw new ForbiddenException({
        code: 'REFERRAL_NOT_ALLOWED',
        message: 'Tài khoản này không thể nhập mã giới thiệu.',
      });
    }

    // Gate 2: REFERRAL_CODE_NOT_FOUND (404): If !REFERRAL_CODE_REGEX.test(normalizedCode) OR referrer user does not exist in DB OR referrer user has deletedAt !== null.
    if (!REFERRAL_CODE_REGEX.test(normalizedCode)) {
      throw new NotFoundException({
        code: 'REFERRAL_CODE_NOT_FOUND',
        message: 'Mã không tồn tại, kiểm tra lại.',
      });
    }

    const referrer = await this.userModel.findOne({ referralCode: normalizedCode });
    if (!referrer || referrer.deletedAt != null) {
      throw new NotFoundException({
        code: 'REFERRAL_CODE_NOT_FOUND',
        message: 'Mã không tồn tại, kiểm tra lại.',
      });
    }

    // Gate 3: REFERRAL_SELF (422): If referrer._id.toString() === user._id.toString().
    if (referrer._id.toString() === user._id.toString()) {
      throw new UnprocessableEntityException({
        code: 'REFERRAL_SELF',
        message: 'Bạn không thể nhập mã của chính mình.',
      });
    }

    // Gate 4: REFERRAL_ALREADY_USED (409): If referrals collection already has a record with refereeId === user._id.
    const alreadyRedeemed = await this.referralModel.findOne({ refereeId: user._id });
    if (alreadyRedeemed) {
      throw new ConflictException({
        code: 'REFERRAL_ALREADY_USED',
        message: 'Tài khoản đã nhập mã giới thiệu trước đó.',
      });
    }

    // Gate 5: REFERRAL_CYCLE (422): If referrals collection already has a record with referrerId === user._id AND refereeId === referrer._id (user previously referred the referrer).
    const cycle = await this.referralModel.findOne({
      referrerId: user._id,
      refereeId: referrer._id,
    });
    if (cycle) {
      throw new UnprocessableEntityException({
        code: 'REFERRAL_CYCLE',
        message: 'Không thể nhập mã của người bạn đã mời.',
      });
    }

    // Gate 6: REFERRAL_DEVICE_USED (409): mỗi thiết bị chỉ nhập mã một lần.
    // Không có định danh thiết bị (web, tài khoản email/Google) thì chỉ còn giới hạn theo tài khoản ở Gate 4.
    const deviceIdHash = this.resolveDeviceIdHash(user, rawDeviceHeader);
    if (deviceIdHash) {
      await this.assertDeviceNotRedeemed(deviceIdHash, user._id);
      await this.ensureDevice(deviceIdHash);
    }

    // Gate 7: trần thưởng của chủ mã trong ngày (giờ Việt Nam).
    const dailyCap = Number(
      this.configService?.get('REFERRAL_DAILY_CAP') ??
        CREDIT_AMOUNTS.REFERRAL_DAILY_CAP,
    );

    const networkSlot = await this.referralNetworkQuota.prepare(
      clientIp
        ? hashIp(
            this.configService?.get<string>('IDENTITY_HASH_SECRET') ??
              DEFAULT_IDENTITY_HASH_SECRET,
            clientIp,
          )
        : null,
    );

    // Ghi referral, dấu thiết bị và credits trong một transaction: lỗi ở bước nào cũng không để lại gì.
    const session = await this.connection.startSession();

    try {
      let creditBalance = 0;

      await session.withTransaction(async () => {
        creditBalance = 0;

        // Ghi vào chủ mã trước khi đếm: các lượt nhập cùng mã xung đột ở đây và lần retry đếm lại trên snapshot mới.
        await this.userModel.updateOne(
          { _id: referrer._id },
          { $set: { updatedAt: new Date() } },
          { session },
        );

        const rewardedTodayCount = await this.referralModel
          .countDocuments({
            referrerId: referrer._id,
            status: ReferralStatus.REWARDED,
            createdAt: { $gte: startOfReferralDay() },
          })
          .session(session);

        const status =
          rewardedTodayCount >= dailyCap
            ? ReferralStatus.CAPPED
            : ReferralStatus.REWARDED;

        const [referralDoc] = await this.referralModel.create(
          [
            {
              referrerId: referrer._id,
              refereeId: user._id,
              codeUsed: normalizedCode,
              status,
              referrerReward:
                status === ReferralStatus.REWARDED
                  ? CREDIT_AMOUNTS.REFERRAL_REWARD
                  : 0,
            },
          ],
          { session },
        );

        // Cộng cho người nhập trước khi đánh dấu thiết bị để giữ thứ tự khoá user rồi device như currency.
        const refereeTx = await this.creditLedgerService.credit(
          {
            userId: user._id,
            amount: CREDIT_AMOUNTS.REFEREE_REWARD,
            type: CreditTransactionType.REFEREE_BONUS,
            reason: 'referee_bonus',
            referralId: referralDoc._id,
          },
          session,
        );
        creditBalance = refereeTx.balanceAfter;

        if (deviceIdHash) {
          const claimed = await this.deviceModel.findOneAndUpdate(
            { deviceIdHash, referralRedeemedAt: null },
            {
              $set: {
                referralRedeemedAt: new Date(),
                referralRedeemedUserId: user._id,
              },
            },
            { session },
          );
          if (!claimed) throw this.deviceUsedError();
        }

        // Đặt sau referral và thiết bị để lỗi tài khoản, thiết bị được ưu tiên báo; ném lỗi thì rollback tất cả.
        if (
          networkSlot &&
          !(await this.referralNetworkQuota.take(networkSlot, session))
        ) {
          throw this.networkLimitError();
        }

        if (status === ReferralStatus.REWARDED) {
          await this.creditLedgerService.credit(
            {
              userId: referrer._id,
              amount: CREDIT_AMOUNTS.REFERRAL_REWARD,
              type: CreditTransactionType.REFERRAL_BONUS,
              reason: 'referral_bonus',
              referralId: referralDoc._id,
            },
            session,
          );
        }
      });

      return {
        accepted: true,
        referrer: { displayName: referrer.displayName },
        creditsEarned: CREDIT_AMOUNTS.REFEREE_REWARD,
        creditBalance,
      };
    } catch (err: any) {
      if (err?.code === 11000) {
        throw new ConflictException({
          code: 'REFERRAL_ALREADY_USED',
          message: 'Tài khoản đã nhập mã giới thiệu trước đó.',
        });
      }
      throw err;
    } finally {
      await session.endSession();
    }
  }

  // Ưu tiên định danh gắn với tài khoản guest: đổi header không né được kiểm tra.
  private resolveDeviceIdHash(
    user: UserDocument,
    rawDeviceHeader?: string,
  ): string | null {
    if (user.deviceIdHash) return user.deviceIdHash;
    if (!rawDeviceHeader?.trim()) return null;
    const secret =
      this.configService?.get<string>('IDENTITY_HASH_SECRET') ??
      DEFAULT_IDENTITY_HASH_SECRET;
    return computeDeviceIdHash(secret, rawDeviceHeader);
  }

  private async assertDeviceNotRedeemed(
    deviceIdHash: string,
    userId: Types.ObjectId,
  ): Promise<void> {
    const device = await this.deviceModel
      .findOne({ deviceIdHash })
      .select('referralRedeemedAt')
      .lean();
    if (device?.referralRedeemedAt) throw this.deviceUsedError();

    // Lượt nhập trước khi có dấu thiết bị chỉ truy được qua guest sở hữu thiết bị này.
    const deviceOwner = await this.userModel
      .findOne({ deviceIdHash, _id: { $ne: userId } })
      .select('_id')
      .lean();
    if (
      deviceOwner &&
      (await this.referralModel.exists({ refereeId: deviceOwner._id }))
    ) {
      throw this.deviceUsedError();
    }
  }

  private async ensureDevice(deviceIdHash: string): Promise<void> {
    try {
      await this.deviceModel.updateOne(
        { deviceIdHash },
        { $setOnInsert: { deviceIdHash } },
        { upsert: true },
      );
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
    }
  }

  private networkLimitError(): HttpException {
    return new HttpException(
      {
        code: 'REFERRAL_NETWORK_LIMIT',
        message: 'Mạng này đã nhập quá nhiều mã giới thiệu hôm nay. Vui lòng thử lại vào ngày mai.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  private deviceUsedError(): ConflictException {
    return new ConflictException({
      code: 'REFERRAL_DEVICE_USED',
      message: 'Thiết bị này đã nhập mã giới thiệu trước đó.',
    });
  }

  async getReferrals(
    userId: Types.ObjectId,
    query?: PaginationQueryDto,
  ): Promise<ReferralListResponseDto> {
    const filter: FilterQuery<ReferralDocument> = { referrerId: userId };

    if (query?.cursor) {
      if (!Types.ObjectId.isValid(query.cursor)) {
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Cursor phân trang không hợp lệ.',
          details: {
            fields: [
              { field: 'cursor', message: 'Cursor phải là ObjectId hợp lệ' },
            ],
          },
        });
      }
      filter._id = { $lt: new Types.ObjectId(query.cursor) };
    }

    const limit = Math.min(Math.max(Number(query?.limit) || 20, 1), 50);

    const [referralDocs, totalRewarded, earnedTotals] = await Promise.all([
      this.referralModel
        .find(filter)
        .sort({ _id: -1 })
        .limit(limit + 1)
        .lean()
        .exec(),
      this.referralModel.countDocuments({
        referrerId: userId,
        status: ReferralStatus.REWARDED,
      }),
      this.referralModel.aggregate<{ total: number }>([
        { $match: { referrerId: userId, status: ReferralStatus.REWARDED } },
        {
          $group: {
            _id: null,
            total: {
              $sum: { $ifNull: ['$referrerReward', LEGACY_REFERRER_REWARD] },
            },
          },
        },
      ]),
    ]);

    const hasMore = referralDocs.length > limit;
    const itemsToProcess = hasMore ? referralDocs.slice(0, limit) : referralDocs;
    const nextCursor = hasMore
      ? itemsToProcess[itemsToProcess.length - 1]._id.toString()
      : null;

    const refereeIds = itemsToProcess.map((doc) => doc.refereeId);
    const referees = await this.userModel
      .find({ _id: { $in: refereeIds } })
      .select('_id displayName deletedAt')
      .lean()
      .exec();

    const refereeMap = new Map<
      string,
      { displayName: string; deletedAt?: Date | null }
    >(referees.map((user) => [user._id.toString(), user]));

    const items = itemsToProcess.map((doc) => {
      const referee = refereeMap.get(doc.refereeId.toString());
      const isDeleted = !referee || referee.deletedAt != null;
      const displayName = isDeleted
        ? 'Người dùng đã xoá'
        : maskDisplayName(referee.displayName);

      const creditsEarned =
        doc.status === ReferralStatus.REWARDED
          ? (doc.referrerReward ?? LEGACY_REFERRER_REWARD)
          : 0;

      return {
        displayName,
        status: doc.status,
        creditsEarned,
        createdAt: new Date(doc.createdAt).toISOString(),
      };
    });

    const totalCreditsEarned = earnedTotals[0]?.total ?? 0;

    return {
      totalRewarded,
      totalCreditsEarned,
      items,
      nextCursor,
    };
  }
}
