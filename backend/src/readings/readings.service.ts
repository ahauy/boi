import {
  Injectable,
  Logger,
  Optional,
  HttpException,
  HttpStatus,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadGatewayException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel, InjectConnection } from "@nestjs/mongoose";
import { Model, Connection, Types, FilterQuery } from "mongoose";
import {
  ReadingSchool,
  HandOrientation,
  ReadingStatus,
  normalizeReadingTopics,
  createReadingRequestSchema,
  parsePalmLinesInput,
  PalmLineDto,
  ReadingListResponseDto,
  ReadingDto,
  PaginationQueryDto,
} from "@palmsight/shared";
import { Reading, ReadingDocument } from "../schemas/reading.schema";
import { User, UserDocument } from "../schemas/user.schema";
import { CreditLedgerService } from "../credits/credit-ledger.service";
import { ImageProcessorService } from "./image-processor.service";
import { CloudinaryService } from "./cloudinary.service";
import { AiService } from "../ai/ai.service";
import {
  STUCK_TIMEOUT_MS,
  resolveObjectId,
  assertValidIdempotencyKey,
  formatReading,
} from "./utils/readings.util";

/** Dấu riêng cho "bản ghi đã bị xoá giữa chừng", để không lẫn với NotFoundException khác (ví dụ USER_NOT_FOUND). */
class ReadingErasedError extends NotFoundException {}

@Injectable()
export class ReadingsService {
  private readonly logger = new Logger(ReadingsService.name);
  private readonly cloudinary: CloudinaryService;
  private clockFn: () => Date = () => new Date();

  constructor(
    @InjectModel(Reading.name)
    private readonly readingModel: Model<ReadingDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly creditLedgerService: CreditLedgerService,
    private readonly imageProcessorService: ImageProcessorService,
    private readonly aiService: AiService,
    @Optional() cloudinaryService?: CloudinaryService,
    @Optional() private readonly configService?: ConfigService
  ) {
    this.cloudinary = cloudinaryService ?? new CloudinaryService();
  }

  setClock(fn: () => Date): void {
    this.clockFn = fn;
  }

  resetClock(): void {
    this.clockFn = () => new Date();
  }

  private now(): Date {
    return this.clockFn();
  }

  private isVipSchoolGatingEnabled(): boolean {
    const raw = this.configService?.get<string | boolean>(
      "ENFORCE_VIP_SCHOOLS",
      "true"
    );
    return raw !== false && raw !== "false";
  }

  private async uploadReadingAssets(
    readingId: Types.ObjectId,
    mainBuffer: Buffer,
    annotatedFile?: Express.Multer.File
  ): Promise<{
    imageUrl: string | null;
    imagePublicId: string | null;
    annotatedImageUrl: string | null;
    annotatedImagePublicId: string | null;
  }> {
    const mainUploaded = await this.cloudinary.uploadImage(mainBuffer, {
      publicId: `reading_${readingId.toString()}`,
    });

    let annotatedUploaded: { url: string; publicId: string } | null = null;
    if (annotatedFile) {
      try {
        const processedAnnotated =
          await this.imageProcessorService.validateAndProcess(annotatedFile);
        annotatedUploaded = await this.cloudinary.uploadImage(
          processedAnnotated.buffer,
          {
            publicId: `reading_${readingId.toString()}_lines`,
          }
        );
      } catch {
        annotatedUploaded = null;
      }
    }

    return {
      imageUrl: mainUploaded?.url ?? null,
      imagePublicId: mainUploaded?.publicId ?? null,
      annotatedImageUrl: annotatedUploaded?.url ?? null,
      annotatedImagePublicId: annotatedUploaded?.publicId ?? null,
    };
  }

  async createReading(
    userId: any,
    idempotencyKey: string | undefined,
    body: any,
    file?: Express.Multer.File,
    annotatedFile?: Express.Multer.File
  ): Promise<{
    reading: Record<string, unknown>;
    creditBalance: number;
    idempotentReplayed: boolean;
  }> {
    assertValidIdempotencyKey(idempotencyKey);

    const userObjId = resolveObjectId(userId);

    const existing = await this.readingModel.findOne({
      userId: userObjId,
      idempotencyKey,
    });

    if (existing) {
      if (existing.deletedAt) {
        throw new NotFoundException({
          code: "NOT_FOUND",
          message: "Lần xem bói này đã bị xoá.",
        });
      }

      if (existing.status === ReadingStatus.PROCESSING) {
        throw new ConflictException({
          code: "READING_IN_PROGRESS",
          message: "Lần xem bói trước vẫn đang xử lý.",
          details: { readingId: existing._id.toString() },
        });
      }

      const user = await this.userModel.findById(userObjId).lean();
      const currentBalance = user?.creditBalance ?? 0;

      if (existing.status === ReadingStatus.FAILED) {
        throw new HttpException(
          {
            code: "AI_UNAVAILABLE",
            message: "Hệ thống bận, đã hoàn lại GEM. Vui lòng thử lại.",
            details: {
              readingId: existing._id.toString(),
              refunded: true,
              creditBalance: currentBalance,
            },
          },
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      return {
        reading: formatReading(existing),
        creditBalance: currentBalance,
        idempotentReplayed: true,
      };
    }

    let validatedInput: any;
    try {
      validatedInput = await createReadingRequestSchema.validate(body, {
        abortEarly: false,
        stripUnknown: false,
      });
    } catch (err: any) {
      const fields = (err.inner || []).map((e: any) => ({
        field: e.path,
        message: e.message,
      }));
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu yêu cầu không hợp lệ.",
        details: {
          fields:
            fields.length > 0
              ? fields
              : [{ field: "root", message: err.message }],
        },
      });
    }

    if (
      this.isVipSchoolGatingEnabled() &&
      (validatedInput.school === ReadingSchool.EASTERN ||
        validatedInput.school === ReadingSchool.VEDIC)
    ) {
      const requestingUser = await this.userModel.findById(userObjId).lean();
      const now = this.now();
      const vipActive = Boolean(
        requestingUser?.vipExpiresAt &&
          requestingUser.vipExpiresAt.getTime() > now.getTime()
      );
      if (!vipActive) {
        throw new ForbiddenException({
          code: "vip_required",
          message:
            "Trường phái chỉ tay Phương Đông và Ấn Độ (Vedic) chỉ dành cho thành viên VIP.",
        });
      }
    }

    let palmLines: PalmLineDto[] | null = null;
    try {
      palmLines = parsePalmLinesInput(validatedInput.palmLines);
    } catch {
      palmLines = null;
    }

    const processedImage = await this.imageProcessorService.validateAndProcess(
      file
    );

    const normalizedTopics = normalizeReadingTopics(
      validatedInput.school,
      validatedInput.topics
    );

    const readingId = new Types.ObjectId();
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      await this.creditLedgerService.spendForReading(
        userObjId,
        readingId,
        session,
        validatedInput.actionCount ?? 1
      );

      await this.readingModel.create(
        [
          {
            _id: readingId,
            userId: userObjId,
            idempotencyKey,
            school: validatedInput.school,
            topics: normalizedTopics,
            hand: validatedInput.hand,
            status: ReadingStatus.PROCESSING,
            createdAt: new Date(),
          },
        ],
        { session }
      );

      await session.commitTransaction();
    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      await session.endSession();
    }

    const start = Date.now();
    try {
      const { result, provider, model } = await this.aiService.readPalm(
        processedImage.base64,
        {
          school: validatedInput.school as ReadingSchool,
          topics: normalizedTopics,
          hand: validatedInput.hand as HandOrientation,
          language: validatedInput.language,
        }
      );
      const latencyMs = Date.now() - start;

      if (result.isPalm === false) {
        const refundSession = await this.connection.startSession();
        refundSession.startTransaction();
        try {
          await this.creditLedgerService.refundReading(
            userObjId,
            readingId,
            refundSession
          );
          await this.readingModel.updateOne(
            { _id: readingId, deletedAt: null },
            {
              status: ReadingStatus.REJECTED,
              rejectReason:
                result.rejectReason ||
                "Không nhìn rõ lòng bàn tay. Hãy chụp lại nơi đủ sáng.",
              aiProvider: provider,
              aiModel: model,
              latencyMs,
              completedAt: new Date(),
            },
            { session: refundSession }
          );
          await refundSession.commitTransaction();
        } catch (refundErr) {
          await refundSession.abortTransaction();
          throw refundErr;
        } finally {
          await refundSession.endSession();
        }

        const user = await this.userModel.findById(userObjId).lean();
        const updated = await this.readingModel.findById(readingId).lean();
        return {
          reading: formatReading(updated!),
          creditBalance: user?.creditBalance ?? 0,
          idempotentReplayed: false,
        };
      }

      // Tài khoản có thể bị xoá trong lúc AI chạy: đừng tải ảnh của người đã xoá lên nữa.
      if (!(await this.readingModel.exists({ _id: readingId, deletedAt: null }))) {
        throw this.readingDeletedError();
      }

      const uploadedAssets = await this.uploadReadingAssets(
        readingId,
        processedImage.buffer,
        annotatedFile
      );

      // `deletedAt: null` chặn ghi kết quả/ảnh vào bản ghi vừa bị xoá giữa chừng.
      const written = await this.readingModel.updateOne(
        { _id: readingId, deletedAt: null },
        {
          status: ReadingStatus.DONE,
          result,
          imageUrl: uploadedAssets.imageUrl,
          imagePublicId: uploadedAssets.imagePublicId,
          annotatedImageUrl: uploadedAssets.annotatedImageUrl,
          annotatedImagePublicId: uploadedAssets.annotatedImagePublicId,
          palmLines,
          aiProvider: provider,
          aiModel: model,
          latencyMs,
          completedAt: new Date(),
        }
      );

      if (written.matchedCount === 0) {
        // Bản ghi đã bị xoá khi ảnh vừa lên Cloudinary: dọn ảnh, không ghi gì thêm. Tài khoản
        // đã xoá nên cũng không hoàn GEM (không còn ai dùng số dư đó).
        await this.discardOrphanedAssets([
          uploadedAssets.imagePublicId,
          uploadedAssets.annotatedImagePublicId,
        ]);
        throw this.readingDeletedError();
      }

      const user = await this.userModel.findById(userObjId).lean();
      const updated = await this.readingModel.findById(readingId).lean();
      return {
        reading: formatReading(updated!),
        creditBalance: user?.creditBalance ?? 0,
        idempotentReplayed: false,
      };
    } catch (aiErr) {
      if (aiErr instanceof ReadingErasedError) throw aiErr;
      const latencyMs = Date.now() - start;
      const refundSession = await this.connection.startSession();
      refundSession.startTransaction();
      let currentBalance = 0;

      try {
        const tx = await this.creditLedgerService.refundReading(
          userObjId,
          readingId,
          refundSession
        );
        currentBalance = tx.balanceAfter;
        await this.readingModel.updateOne(
          { _id: readingId, deletedAt: null },
          {
            status: ReadingStatus.FAILED,
            errorCode: "AI_UNAVAILABLE",
            latencyMs,
            completedAt: new Date(),
          },
          { session: refundSession }
        );
        await refundSession.commitTransaction();
      } catch {
        await refundSession.abortTransaction();
      } finally {
        await refundSession.endSession();
      }

      throw new HttpException(
        {
          code: "AI_UNAVAILABLE",
          message: "Hệ thống bận, đã hoàn lại GEM. Vui lòng thử lại.",
          details: {
            readingId: readingId.toString(),
            refunded: true,
            creditBalance: currentBalance,
          },
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }
  }

  private readingDeletedError(): NotFoundException {
    return new ReadingErasedError({
      code: "NOT_FOUND",
      message: "Lần xem bói này đã bị xoá.",
    });
  }

  private async discardOrphanedAssets(
    publicIds: Array<string | null>
  ): Promise<void> {
    for (const publicId of publicIds) {
      if (!publicId) continue;
      try {
        if (!(await this.cloudinary.deleteImage(publicId))) {
          this.logger.warn(`Không gỡ được ảnh mồ côi ${publicId} trên Cloudinary`);
        }
      } catch (err) {
        this.logger.warn(
          `Lỗi khi gỡ ảnh mồ côi ${publicId}: ${(err as Error).message}`
        );
      }
    }
  }

  async getReadings(
    userId: any,
    query?: PaginationQueryDto
  ): Promise<ReadingListResponseDto> {
    const userObjId = resolveObjectId(userId);
    await this.cleanupStuckReadings(userObjId);

    const filter: FilterQuery<ReadingDocument> = {
      userId: userObjId,
      deletedAt: null,
    };

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

    const docs = await this.readingModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean()
      .exec();

    const hasMore = docs.length > limit;
    const items = hasMore ? docs.slice(0, limit) : docs;
    const nextCursor = hasMore ? items[items.length - 1]._id.toString() : null;

    return {
      items: items.map((doc: any) => ({
        id: doc._id.toString(),
        status: doc.status,
        school: doc.school,
        topics: doc.topics,
        hand: doc.hand,
        summary:
          doc.status === ReadingStatus.DONE
            ? doc.result?.summary ?? null
            : null,
        imageUrl: doc.imageUrl ?? null,
        annotatedImageUrl: doc.annotatedImageUrl ?? null,
        createdAt: doc.createdAt.toISOString(),
      })),
      nextCursor,
    };
  }

  async getReadingById(userId: any, id: string): Promise<ReadingDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Lần xem bói không tồn tại hoặc đã bị xoá.",
      });
    }

    const userObjId = resolveObjectId(userId);
    await this.cleanupStuckReadings(userObjId);

    const doc = await this.readingModel
      .findOne({
        _id: new Types.ObjectId(id),
        userId: userObjId,
        deletedAt: null,
      })
      .lean();

    if (!doc) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Lần xem bói không tồn tại hoặc đã bị xoá.",
      });
    }

    return {
      id: doc._id.toString(),
      status: doc.status,
      school: doc.school,
      topics: doc.topics,
      hand: doc.hand,
      result: (doc.result as any) ?? null,
      imageUrl: doc.imageUrl ?? null,
      annotatedImageUrl: doc.annotatedImageUrl ?? null,
      palmLines: (doc.palmLines as PalmLineDto[]) ?? null,
      rejectReason: doc.rejectReason ?? null,
      createdAt: doc.createdAt.toISOString(),
      completedAt: doc.completedAt?.toISOString() ?? null,
    };
  }

  async deleteReading(userId: any, id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Lần xem bói không tồn tại hoặc đã bị xoá.",
      });
    }

    const userObjId = resolveObjectId(userId);
    const readingObjId = new Types.ObjectId(id);

    const doc = await this.readingModel.findOne({
      _id: readingObjId,
      userId: userObjId,
      deletedAt: null,
    });

    if (!doc) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Lần xem bói không tồn tại hoặc đã bị xoá.",
      });
    }

    if (doc.status === ReadingStatus.PROCESSING) {
      throw new ConflictException({
        code: "READING_IN_PROGRESS",
        message: "Không thể xoá khi đang xử lý bói toán.",
      });
    }

    const del1 = doc.imagePublicId
      ? await this.cloudinary.deleteImage(doc.imagePublicId)
      : true;
    const del2 = doc.annotatedImagePublicId
      ? await this.cloudinary.deleteImage(doc.annotatedImagePublicId)
      : true;

    const updates: Record<string, any> = {};

    if (del1) {
      updates.imageUrl = null;
      updates.imagePublicId = null;
    }
    if (del2) {
      updates.annotatedImageUrl = null;
      updates.annotatedImagePublicId = null;
    }

    if (del1 && del2) {
      updates.result = null;
      updates.palmLines = null;
      // Chủ đề đã chọn lộ mối quan tâm; bản ghi đã xoá không có nơi nào đọc lại.
      updates.topics = [];
      updates.deletedAt = new Date();
      await this.readingModel.updateOne(
        { _id: readingObjId, deletedAt: null },
        { $set: updates }
      );
    } else {
      // Chưa xoá hết ảnh: giữ nguyên kết quả và deletedAt để lần xem vẫn dùng được
      // và lần thử lại không mất dấu ảnh còn sót.
      if (Object.keys(updates).length > 0) {
        await this.readingModel.updateOne({ _id: readingObjId }, { $set: updates });
      }
      throw new BadGatewayException({
        code: "IMAGE_DELETE_FAILED",
        message: "Không xoá được ảnh trên hệ thống lưu trữ. Vui lòng thử lại.",
      });
    }
  }

  private async cleanupStuckReadings(userId: Types.ObjectId): Promise<void> {
    const stuckCutoff = new Date(Date.now() - STUCK_TIMEOUT_MS);
    const stuckList = await this.readingModel
      .find({
        userId,
        status: ReadingStatus.PROCESSING,
        createdAt: { $lt: stuckCutoff },
        deletedAt: null,
      })
      .exec();

    for (const stuck of stuckList) {
      const session = await this.connection.startSession();
      session.startTransaction();
      try {
        await this.creditLedgerService.refundReading(
          userId,
          stuck._id,
          session
        );
        await this.readingModel.updateOne(
          { _id: stuck._id },
          {
            status: ReadingStatus.FAILED,
            errorCode: "TIMEOUT",
            completedAt: new Date(),
          },
          { session }
        );
        await session.commitTransaction();
      } catch {
        await session.abortTransaction();
      } finally {
        await session.endSession();
      }
    }
  }
}
