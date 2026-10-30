import {
  Injectable,
  HttpException,
  HttpStatus,
  BadRequestException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types, ClientSession, FilterQuery } from "mongoose";
import {
  CreditTransaction,
  CreditTransactionDocument,
} from "../schemas/credit-transaction.schema";
import { User, UserDocument } from "../schemas/user.schema";
import {
  CreditTransactionType,
  CREDIT_AMOUNTS,
  CreditTransactionListResponseDto,
  PaginationQueryDto,
} from "@palmsight/shared";

export interface RecordCreditTransactionDto {
  userId: Types.ObjectId;
  amount: number;
  type: CreditTransactionType;
  balanceAfter: number;
  readingId?: Types.ObjectId;
  referralId?: Types.ObjectId;
  note?: string;
}

@Injectable()
export class CreditLedgerService {
  constructor(
    @InjectModel(CreditTransaction.name)
    private readonly creditTransactionModel: Model<CreditTransactionDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>
  ) {}

  async recordWithSession(
    dto: RecordCreditTransactionDto,
    session: ClientSession
  ): Promise<CreditTransactionDocument> {
    const [record] = await this.creditTransactionModel.create(
      [
        {
          userId: dto.userId,
          amount: dto.amount,
          type: dto.type,
          balanceAfter: dto.balanceAfter,
          readingId: dto.readingId,
          referralId: dto.referralId,
          note: dto.note,
        },
      ],
      { session }
    );

    return record;
  }

  async grantSignupBonus(
    userId: Types.ObjectId,
    session: ClientSession
  ): Promise<CreditTransactionDocument> {
    const res = await this.userModel.updateOne(
      { _id: userId, deletedAt: null },
      { $inc: { creditBalance: CREDIT_AMOUNTS.SIGNUP_BONUS } },
      { session }
    );
    if (res.matchedCount !== 1) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "Người dùng không tồn tại.",
      });
    }

    const user = await this.userModel.findById(userId).session(session).lean();
    return this.recordWithSession(
      {
        userId,
        amount: CREDIT_AMOUNTS.SIGNUP_BONUS,
        type: CreditTransactionType.SIGNUP_BONUS,
        balanceAfter: user!.creditBalance,
      },
      session
    );
  }

  async spendForReading(
    userId: Types.ObjectId,
    readingId: Types.ObjectId,
    session: ClientSession
  ): Promise<CreditTransactionDocument> {
    const res = await this.userModel.updateOne(
      {
        _id: userId,
        deletedAt: null,
        creditBalance: { $gte: CREDIT_AMOUNTS.READING_COST },
      },
      { $inc: { creditBalance: -CREDIT_AMOUNTS.READING_COST } },
      { session }
    );

    if (res.matchedCount === 0 || res.modifiedCount === 0) {
      const user = await this.userModel
        .findById(userId)
        .session(session)
        .lean();
      throw new HttpException(
        {
          code: "INSUFFICIENT_CREDITS",
          message: "Bạn không đủ credits để xem bói.",
          details: {
            required: CREDIT_AMOUNTS.READING_COST,
            balance: user?.creditBalance ?? 0,
          },
        },
        HttpStatus.PAYMENT_REQUIRED
      );
    }

    const user = await this.userModel.findById(userId).session(session).lean();
    return this.recordWithSession(
      {
        userId,
        amount: -CREDIT_AMOUNTS.READING_COST,
        type: CreditTransactionType.READING_SPEND,
        balanceAfter: user!.creditBalance,
        readingId,
      },
      session
    );
  }

  async refundReading(
    userId: Types.ObjectId,
    readingId: Types.ObjectId,
    session: ClientSession
  ): Promise<CreditTransactionDocument> {
    const res = await this.userModel.updateOne(
      { _id: userId, deletedAt: null },
      { $inc: { creditBalance: CREDIT_AMOUNTS.READING_COST } },
      { session }
    );
    if (res.matchedCount !== 1) {
      throw new NotFoundException({
        code: "USER_NOT_FOUND",
        message: "Người dùng không tồn tại.",
      });
    }

    const user = await this.userModel.findById(userId).session(session).lean();
    return this.recordWithSession(
      {
        userId,
        amount: CREDIT_AMOUNTS.READING_COST,
        type: CreditTransactionType.READING_REFUND,
        balanceAfter: user!.creditBalance,
        readingId,
      },
      session
    );
  }

  async getTransactions(
    userId: Types.ObjectId,
    query?: PaginationQueryDto
  ): Promise<CreditTransactionListResponseDto> {
    const filter: FilterQuery<CreditTransactionDocument> = { userId };

    if (query?.cursor) {
      if (!Types.ObjectId.isValid(query.cursor)) {
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: "Cursor phân trang không hợp lệ.",
          details: {
            fields: [
              { field: "cursor", message: "Cursor phải là ObjectId hợp lệ" },
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
