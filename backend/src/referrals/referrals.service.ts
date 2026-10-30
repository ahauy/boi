import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import { CreditLedgerService } from '../credits/credit-ledger.service';
import { Referral, ReferralDocument } from '../schemas/referral.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { maskDisplayName } from './mask-display-name.util';

@Injectable()
export class ReferralsService {
  constructor(
    @InjectModel(Referral.name)
    private readonly referralModel: Model<ReferralDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly creditLedgerService: CreditLedgerService,
    @Optional()
    private readonly configService?: ConfigService,
  ) {}

  async enterReferral(
    user: UserDocument,
    code: string,
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

    // Gate 6: Daily Cap check (REFERRAL_DAILY_CAP = 10):
    // Calculate start of today in Vietnam time (UTC+7)
    const now = new Date();
    const vnTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const startOfVnDayUtc = new Date(
      Date.UTC(vnTime.getUTCFullYear(), vnTime.getUTCMonth(), vnTime.getUTCDate()) -
        7 * 60 * 60 * 1000,
    );

    const dailyCap = Number(
      this.configService?.get('REFERRAL_DAILY_CAP') ??
        CREDIT_AMOUNTS.REFERRAL_DAILY_CAP,
    );

    const rewardedTodayCount = await this.referralModel.countDocuments({
      referrerId: referrer._id,
      status: ReferralStatus.REWARDED,
      createdAt: { $gte: startOfVnDayUtc },
    });

    const status =
      rewardedTodayCount >= dailyCap
        ? ReferralStatus.CAPPED
        : ReferralStatus.REWARDED;

    // Transaction Safety:
    // Execute in a single MongoDB transaction (ClientSession)
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      // 1. Insert referral record
      const [referralDoc] = await this.referralModel.create(
        [
          {
            referrerId: referrer._id,
            refereeId: user._id,
            codeUsed: normalizedCode,
            status,
          },
        ],
        { session },
      );

      // 2. Update referee creditBalance: +1 credit (REFEREE_REWARD)
      const refereeUpdate = await this.userModel.updateOne(
        { _id: user._id, deletedAt: null },
        { $inc: { creditBalance: CREDIT_AMOUNTS.REFEREE_REWARD } },
        { session },
      );
      if (refereeUpdate.matchedCount !== 1) {
        throw new NotFoundException({
          code: 'USER_NOT_FOUND',
          message: 'Người dùng không tồn tại.',
        });
      }

      const updatedReferee = await this.userModel
        .findById(user._id)
        .session(session)
        .lean();

      await this.creditLedgerService.recordWithSession(
        {
          userId: user._id,
          amount: CREDIT_AMOUNTS.REFEREE_REWARD,
          type: CreditTransactionType.REFEREE_BONUS,
          balanceAfter: updatedReferee!.creditBalance,
          referralId: referralDoc._id,
        },
        session,
      );

      // 3. If status === ReferralStatus.REWARDED:
      if (status === ReferralStatus.REWARDED) {
        const referrerUpdate = await this.userModel.updateOne(
          { _id: referrer._id, deletedAt: null },
          { $inc: { creditBalance: CREDIT_AMOUNTS.REFERRAL_REWARD } },
          { session },
        );
        if (referrerUpdate.matchedCount !== 1) {
          throw new NotFoundException({
            code: 'USER_NOT_FOUND',
            message: 'Chủ mã không tồn tại.',
          });
        }

        const updatedReferrer = await this.userModel
          .findById(referrer._id)
          .session(session)
          .lean();

        await this.creditLedgerService.recordWithSession(
          {
            userId: referrer._id,
            amount: CREDIT_AMOUNTS.REFERRAL_REWARD,
            type: CreditTransactionType.REFERRAL_BONUS,
            balanceAfter: updatedReferrer!.creditBalance,
            referralId: referralDoc._id,
          },
          session,
        );
      }

      // 4. If status === ReferralStatus.CAPPED:
      // Referrer does NOT receive credits (0 credits added).

      await session.commitTransaction();

      return {
        accepted: true,
        referrer: { displayName: referrer.displayName },
        creditsEarned: CREDIT_AMOUNTS.REFEREE_REWARD,
        creditBalance: updatedReferee!.creditBalance,
      };
    } catch (err: any) {
      await session.abortTransaction();
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

    const [referralDocs, totalRewarded] = await Promise.all([
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

      const creditsEarned = doc.status === ReferralStatus.REWARDED ? 2 : 0;

      return {
        displayName,
        status: doc.status,
        creditsEarned,
        createdAt: new Date(doc.createdAt).toISOString(),
      };
    });

    const totalCreditsEarned = totalRewarded * 2;

    return {
      totalRewarded,
      totalCreditsEarned,
      items,
      nextCursor,
    };
  }
}
