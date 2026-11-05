import {
  Injectable,
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession, FilterQuery } from 'mongoose';
import {
  CreditTransaction,
  CreditTransactionDocument,
} from '../schemas/credit-transaction.schema';
import { User, UserDocument } from '../schemas/user.schema';
import {
  CreditTransactionType,
  ECONOMY_DEFAULTS,
  CreditTransactionListResponseDto,
  PaginationQueryDto,
} from '@palmsight/shared';

export interface RecordCreditTransactionDto {
  userId: Types.ObjectId;
  amount: number;
  type: CreditTransactionType;
  reason?: string;
  balanceAfter: number;
  readingId?: Types.ObjectId;
  referralId?: Types.ObjectId;
  adClaimId?: Types.ObjectId;
  note?: string;
}

export interface CreditOperationDto {
  userId: Types.ObjectId;
  amount: number;
  type: CreditTransactionType;
  reason?: string;
  readingId?: Types.ObjectId;
  referralId?: Types.ObjectId;
  adClaimId?: Types.ObjectId;
  note?: string;
  extraUserSet?: Record<string, unknown>;
}

export interface DebitOperationDto {
  userId: Types.ObjectId;
  amount: number;
  type: CreditTransactionType;
  reason?: string;
  readingId?: Types.ObjectId;
  referralId?: Types.ObjectId;
  adClaimId?: Types.ObjectId;
  note?: string;
}

export function mapTypeToReason(type: CreditTransactionType, explicitReason?: string): string {
  if (explicitReason) return explicitReason;
  switch (type) {
    case CreditTransactionType.SIGNUP_BONUS:
    case CreditTransactionType.STARTER:
      return 'starter';
    case CreditTransactionType.READING_SPEND:
    case CreditTransactionType.SINGLE:
      return 'single';
    case CreditTransactionType.READING_REFUND:
    case CreditTransactionType.REFUND:
      return 'refund';
    case CreditTransactionType.REWARDED_AD:
    case CreditTransactionType.AD_REWARD:
      return 'ad_reward';
    case CreditTransactionType.ADMIN_ADJUST:
    case CreditTransactionType.OPERATOR:
      return 'operator';
    case CreditTransactionType.REFERRAL_BONUS:
    case CreditTransactionType.REFEREE_BONUS:
      return type.toLowerCase();
    case CreditTransactionType.CHECKIN:
      return 'checkin';
    case CreditTransactionType.CHECKIN_MILESTONE:
      return 'checkin_milestone';
    case CreditTransactionType.CHECKIN_RESTORE:
      return 'checkin_restore';
    case CreditTransactionType.WHEEL:
      return 'wheel';
    case CreditTransactionType.WHEEL_SPIN:
      return 'wheel_spin';
    case CreditTransactionType.VIP_DAILY:
      return 'vip_daily';
    case CreditTransactionType.GUEST_MERGE:
      return 'guest_merge';
    default:
      return String(type);
  }
}

@Injectable()
export class CreditLedgerService {
  constructor(
    @InjectModel(CreditTransaction.name)
    private readonly creditTransactionModel: Model<CreditTransactionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    private readonly configService: ConfigService,
  ) {}

  getStarterGrantAmount(): number {
    const val =
      this.configService.get<string | number>('STARTER_GRANT') ??
      this.configService.get<string | number>('SIGNUP_BONUS_CREDITS');
    return val !== undefined ? Number(val) : ECONOMY_DEFAULTS.STARTER_GRANT;
  }

  getPricePerAction(): number {
    const val =
      this.configService.get<string | number>('PRICE_PER_ACTION') ??
      this.configService.get<string | number>('READING_COST_CREDITS');
    return val !== undefined ? Number(val) : ECONOMY_DEFAULTS.PRICE_PER_ACTION;
  }

  getMaxActionsPerTap(): number {
    const val = this.configService.get<string | number>('MAX_ACTIONS_PER_TAP');
    return val !== undefined ? Number(val) : ECONOMY_DEFAULTS.MAX_ACTIONS_PER_TAP;
  }

  async recordWithSession(
    dto: RecordCreditTransactionDto,
    session?: ClientSession,
  ): Promise<CreditTransactionDocument> {
    const reason = mapTypeToReason(dto.type, dto.reason);
    const [record] = await this.creditTransactionModel.create(
      [
        {
          userId: dto.userId,
          amount: dto.amount,
          type: dto.type,
          reason,
          balanceAfter: dto.balanceAfter,
          readingId: dto.readingId,
          referralId: dto.referralId,
          adClaimId: dto.adClaimId,
          note: dto.note,
        },
      ],
      session ? { session } : undefined,
    );

    return record;
  }

  async credit(
    dto: CreditOperationDto,
    session?: ClientSession,
  ): Promise<CreditTransactionDocument> {
    if (!Number.isInteger(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Amount must be a positive integer',
      });
    }

    const updateObj: Record<string, unknown> = {
      $inc: { creditBalance: dto.amount },
    };
    if (dto.extraUserSet && Object.keys(dto.extraUserSet).length > 0) {
      updateObj.$set = dto.extraUserSet;
    }

    const updatedUser = await this.userModel
      .findOneAndUpdate(
        { _id: dto.userId, deletedAt: null },
        updateObj,
        session ? { session, new: true } : { new: true },
      )
      .lean();

    if (!updatedUser) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'Người dùng không tồn tại.',
      });
    }

    return this.recordWithSession(
      {
        userId: dto.userId,
        amount: dto.amount,
        type: dto.type,
        reason: dto.reason,
        balanceAfter: updatedUser.creditBalance,
        readingId: dto.readingId,
        referralId: dto.referralId,
        adClaimId: dto.adClaimId,
        note: dto.note,
      },
      session,
    );
  }

  async debit(
    dto: DebitOperationDto,
    session?: ClientSession,
  ): Promise<CreditTransactionDocument> {
    if (!Number.isInteger(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Amount must be a positive integer',
      });
    }

    const updatedUser = await this.userModel
      .findOneAndUpdate(
        {
          _id: dto.userId,
          deletedAt: null,
          creditBalance: { $gte: dto.amount },
        },
        { $inc: { creditBalance: -dto.amount } },
        session ? { session, new: true } : { new: true },
      )
      .lean();

    if (!updatedUser) {
      const q = this.userModel.findById(dto.userId);
      if (session) q.session(session);
      const user = await q.lean();
      throw new HttpException(
        {
          code: 'INSUFFICIENT_CREDITS',
          message: 'Bạn không đủ credits để xem bói.',
          details: {
            required: dto.amount,
            balance: user?.creditBalance ?? 0,
          },
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return this.recordWithSession(
      {
        userId: dto.userId,
        amount: -dto.amount,
        type: dto.type,
        reason: dto.reason,
        balanceAfter: updatedUser.creditBalance,
        readingId: dto.readingId,
        referralId: dto.referralId,
        adClaimId: dto.adClaimId,
        note: dto.note,
      },
      session,
    );
  }

  async grantSignupBonus(
    userId: Types.ObjectId,
    session?: ClientSession,
    amount?: number,
  ): Promise<CreditTransactionDocument> {
    const grantAmount = amount ?? this.getStarterGrantAmount();
    return this.credit(
      {
        userId,
        amount: grantAmount,
        type: CreditTransactionType.SIGNUP_BONUS,
        reason: 'starter',
        extraUserSet: { starterGrantedAt: new Date() },
      },
      session,
    );
  }

  async spendForReading(
    userId: Types.ObjectId,
    readingId: Types.ObjectId,
    session?: ClientSession,
    actionCount = 1,
  ): Promise<CreditTransactionDocument> {
    if (
      !Number.isInteger(actionCount) ||
      actionCount < 1 ||
      actionCount > this.getMaxActionsPerTap()
    ) {
      throw new BadRequestException({
        code: 'MAX_ACTIONS_EXCEEDED',
        message: `Số lượng hành động phải từ 1 đến ${this.getMaxActionsPerTap()}.`,
      });
    }

    const totalCost = actionCount * this.getPricePerAction();
    return this.debit(
      {
        userId,
        amount: totalCost,
        type: CreditTransactionType.READING_SPEND,
        reason: 'single',
        readingId,
      },
      session,
    );
  }

  async refundReading(
    userId: Types.ObjectId,
    readingId: Types.ObjectId,
    session?: ClientSession,
  ): Promise<CreditTransactionDocument> {
    const refundQuery = this.creditTransactionModel.findOne({
      readingId,
      type: {
        $in: [
          CreditTransactionType.READING_REFUND,
          CreditTransactionType.REFUND,
        ],
      },
    });
    if (session) refundQuery.session(session);
    const existingRefund = await refundQuery.lean();

    if (existingRefund) {
      throw new ConflictException({
        code: 'ALREADY_REFUNDED',
        message: 'Lượt xem bói này đã được hoàn trả trước đó.',
      });
    }

    const spendQuery = this.creditTransactionModel.findOne({
      userId,
      readingId,
      type: {
        $in: [
          CreditTransactionType.READING_SPEND,
          CreditTransactionType.SINGLE,
        ],
      },
    });
    if (session) spendQuery.session(session);
    const spendTx = await spendQuery.lean();

    const refundAmount = spendTx
      ? Math.abs(spendTx.amount)
      : this.getPricePerAction();

    return this.credit(
      {
        userId,
        amount: refundAmount,
        type: CreditTransactionType.READING_REFUND,
        reason: 'refund',
        readingId,
      },
      session,
    );
  }

  async grantRewardedAd(
    userId: Types.ObjectId,
    claimId: Types.ObjectId,
    credits: number,
    session?: ClientSession,
  ): Promise<CreditTransactionDocument> {
    return this.credit(
      {
        userId,
        amount: credits,
        type: CreditTransactionType.REWARDED_AD,
        reason: 'ad_reward',
        adClaimId: claimId,
      },
      session,
    );
  }

  async getTransactions(
    userId: Types.ObjectId,
    query?: PaginationQueryDto,
  ): Promise<CreditTransactionListResponseDto> {
    const filter: FilterQuery<CreditTransactionDocument> = { userId };

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

    const docs = await this.creditTransactionModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec();

    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const nextCursor = hasMore ? items[items.length - 1]._id.toString() : null;

    return {
      items: items.map((doc) => ({
        id: doc._id.toString(),
        type: doc.type,
        reason: doc.reason,
        amount: doc.amount,
        balanceAfter: doc.balanceAfter,
        readingId: doc.readingId ? doc.readingId.toString() : undefined,
        referralId: doc.referralId ? doc.referralId.toString() : undefined,
        note: doc.note,
        createdAt: doc.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }
}
