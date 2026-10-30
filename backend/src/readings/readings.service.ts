import {
  Injectable,
  Optional,
  HttpException,
  HttpStatus,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { InjectModel, InjectConnection } from "@nestjs/mongoose";
import { Model, Connection, Types, FilterQuery } from "mongoose";
import * as crypto from "crypto";
import {
  ReadingSchool,
  HandOrientation,
  ReadingStatus,
  normalizeReadingTopics,
  createReadingRequestSchema,
  guestReadingRequestSchema,
  parsePalmLinesInput,
  PalmLineDto,
  GuestReadingPreviewDto,
  ReadingListResponseDto,
  ReadingDto,
  PaginationQueryDto,
} from "@palmsight/shared";
import { Reading, ReadingDocument } from "../schemas/reading.schema";
import { User, UserDocument } from "../schemas/user.schema";
import { GuestTrial, GuestTrialDocument } from "../schemas/guest-trial.schema";
import { CreditLedgerService } from "../credits/credit-ledger.service";
import { ImageProcessorService } from "./image-processor.service";
import { CloudinaryService } from "./cloudinary.service";
import { AiService } from "../ai/ai.service";
import { truncatePalmResultForGuest } from "./utils/truncate-palm-result.util";
import {
  UUID_V4_REGEX,
  STUCK_TIMEOUT_MS,
  resolveObjectId,
  assertValidIdempotencyKey,
  formatReading,
  buildGuestPreviewResponse,
} from "./utils/readings.util";

@Injectable()
export class ReadingsService {
  private readonly cloudinary: CloudinaryService;

  constructor(
    @InjectModel(Reading.name)
    private readonly readingModel: Model<ReadingDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(GuestTrial.name)
    private readonly guestTrialModel: Model<GuestTrialDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly creditLedgerService: CreditLedgerService,
    private readonly imageProcessorService: ImageProcessorService,
    private readonly aiService: AiService,
    @Optional() cloudinaryService?: CloudinaryService
  ) {
    this.cloudinary = cloudinaryService ?? new CloudinaryService();
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
            message: "Hệ thống bận, đã hoàn 1 credit. Thử lại sau ít phút.",
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
        session
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
            { _id: readingId },
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

      const uploadedAssets = await this.uploadReadingAssets(
        readingId,
        processedImage.buffer,
        annotatedFile
      );

      await this.readingModel.updateOne(
        { _id: readingId },
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

      const user = await this.userModel.findById(userObjId).lean();
      const updated = await this.readingModel.findById(readingId).lean();
      return {
        reading: formatReading(updated!),
        creditBalance: user?.creditBalance ?? 0,
        idempotentReplayed: false,
      };
    } catch {
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
          { _id: readingId },
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
          message: "Hệ thống bận, đã hoàn 1 credit. Thử lại sau ít phút.",
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

    await Promise.all([
      this.cloudinary.deleteImage(doc.imagePublicId),
      this.cloudinary.deleteImage(doc.annotatedImagePublicId),
    ]);

    await this.readingModel.updateOne(
      { _id: readingObjId },
      {
        result: null,
        imageUrl: null,
        annotatedImageUrl: null,
        imagePublicId: null,
        annotatedImagePublicId: null,
        palmLines: null,
        deletedAt: new Date(),
      }
    );
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

  private async validateGuestInput(
    body: any,
    file?: Express.Multer.File,
    idempotencyKey?: string
  ) {
    assertValidIdempotencyKey(idempotencyKey);

    if (!file) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Vui lòng chọn ảnh bàn tay để tiếp tục.",
        details: {
          fields: [{ field: "image", message: "Ảnh bàn tay là bắt buộc." }],
        },
      });
    }

    try {
      const validated = await guestReadingRequestSchema.validate(body, {
        abortEarly: false,
      });
      const topics = normalizeReadingTopics(validated.school, validated.topics);
      let palmLines: PalmLineDto[] | null = null;
      try {
        palmLines = parsePalmLinesInput(validated.palmLines);
      } catch {
        palmLines = null;
      }
      return { validated, topics, palmLines };
    } catch (err: any) {
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu yêu cầu không hợp lệ.",
        details: {
          fields: (err.inner || []).map((e: any) => ({
            field: e.path,
            message: e.message,
          })),
        },
      });
    }
  }

  private async checkGuestIdempotency(idempotencyKey: string) {
    const existing = await this.readingModel.findOne({
      idempotencyKey,
      isGuest: true,
    });
    if (!existing) return null;

    if (existing.status === ReadingStatus.PROCESSING) {
      throw new ConflictException({
        code: "READING_IN_PROGRESS",
        message: "Lần xem bói trước vẫn đang xử lý.",
      });
    }

    if (existing.status === ReadingStatus.GUEST_PREVIEW) {
      const truncated = truncatePalmResultForGuest(existing.result as any);
      return {
        reading: buildGuestPreviewResponse(existing, truncated),
        claimToken: null,
        isRejected: false,
        idempotentReplayed: true,
      };
    }

    if (existing.status === ReadingStatus.REJECTED) {
      return {
        reading: {
          id: existing._id.toString(),
          status: ReadingStatus.REJECTED,
          rejectReason: existing.rejectReason ?? null,
        },
        claimToken: null,
        isRejected: true,
        idempotentReplayed: true,
      };
    }

    if (existing.status === ReadingStatus.FAILED) {
      throw new HttpException(
        {
          code: "AI_SERVICE_UNAVAILABLE",
          message: "Hệ thống AI đang bận. Vui lòng thử lại sau ít phút!",
        },
        HttpStatus.BAD_GATEWAY
      );
    }

    return null;
  }

  async createGuestReading(
    idempotencyKey: string | undefined,
    body: any,
    file: Express.Multer.File | undefined,
    clientIp: string,
    fingerprintHash: string,
    annotatedFile?: Express.Multer.File
  ): Promise<{
    reading:
      | GuestReadingPreviewDto
      | { id: string; status: ReadingStatus; rejectReason: string | null };
    claimToken: string | null;
    isRejected: boolean;
    idempotentReplayed?: boolean;
  }> {
    const { validated, topics, palmLines } = await this.validateGuestInput(
      body,
      file,
      idempotencyKey
    );

    const replayed = await this.checkGuestIdempotency(idempotencyKey!);
    if (replayed) return replayed;

    const processedImage = await this.imageProcessorService.validateAndProcess(
      file!
    );

    const [reading] = await this.readingModel.create([
      {
        userId: null,
        isGuest: true,
        idempotencyKey: idempotencyKey!,
        school: validated.school,
        hand: validated.hand,
        topics,
        status: ReadingStatus.PROCESSING,
      },
    ]);

    const { result, provider, model, latencyMs } = await this.executeGuestAi(
      reading._id,
      processedImage.base64,
      {
        school: validated.school as ReadingSchool,
        topics,
        hand: validated.hand as HandOrientation,
      }
    );

    if (!result.isPalm) {
      return this.handleGuestRejection(
        reading._id,
        result,
        latencyMs,
        provider,
        model
      );
    }

    const uploadedAssets = await this.uploadReadingAssets(
      reading._id,
      processedImage.buffer,
      annotatedFile
    );

    return this.persistGuestTrialSuccess(
      reading,
      validated,
      topics,
      result,
      latencyMs,
      clientIp,
      fingerprintHash,
      uploadedAssets,
      palmLines,
      provider,
      model
    );
  }

  private async executeGuestAi(
    readingId: Types.ObjectId,
    base64: string,
    options: { school: ReadingSchool; topics: string[]; hand: HandOrientation }
  ) {
    const startTime = Date.now();
    try {
      const output = await this.aiService.readPalm(base64, options);
      return { ...output, latencyMs: Date.now() - startTime };
    } catch {
      const latencyMs = Date.now() - startTime;
      await this.readingModel.updateOne(
        { _id: readingId },
        {
          status: ReadingStatus.FAILED,
          errorCode: "AI_SERVICE_UNAVAILABLE",
          latencyMs,
          completedAt: new Date(),
        }
      );
      throw new HttpException(
        {
          code: "AI_SERVICE_UNAVAILABLE",
          message: "Hệ thống AI đang bận. Vui lòng thử lại sau ít phút!",
        },
        HttpStatus.BAD_GATEWAY
      );
    }
  }

  private async handleGuestRejection(
    readingId: Types.ObjectId,
    aiResult: any,
    latencyMs: number,
    provider?: string,
    model?: string
  ) {
    const rejectReason =
      aiResult.rejectReason ||
      "Không nhận diện được lòng bàn tay. Vui lòng chụp rõ lòng bàn tay và thử lại!";

    await this.readingModel.updateOne(
      { _id: readingId },
      {
        status: ReadingStatus.REJECTED,
        rejectReason,
        aiProvider: provider || aiResult.aiProvider,
        aiModel: model || aiResult.aiModel,
        latencyMs,
        completedAt: new Date(),
      }
    );

    return {
      reading: {
        id: readingId.toString(),
        status: ReadingStatus.REJECTED,
        rejectReason,
      },
      claimToken: null,
      isRejected: true,
      idempotentReplayed: false,
    };
  }

  private async persistGuestTrialSuccess(
    reading: ReadingDocument,
    validated: any,
    topics: string[],
    aiResult: any,
    latencyMs: number,
    clientIp: string,
    fingerprintHash: string,
    uploadedAssets: {
      imageUrl: string | null;
      imagePublicId: string | null;
      annotatedImageUrl: string | null;
      annotatedImagePublicId: string | null;
    },
    palmLines: PalmLineDto[] | null,
    provider?: string,
    model?: string
  ) {
    const claimToken = crypto.randomUUID();
    const guestTokenHash = crypto
      .createHash("sha256")
      .update(claimToken)
      .digest("hex");
    const ipHash = crypto.createHash("sha256").update(clientIp).digest("hex");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      await this.readingModel.updateOne(
        { _id: reading._id },
        {
          guestTokenHash,
          status: ReadingStatus.GUEST_PREVIEW,
          result: aiResult,
          imageUrl: uploadedAssets.imageUrl,
          imagePublicId: uploadedAssets.imagePublicId,
          annotatedImageUrl: uploadedAssets.annotatedImageUrl,
          annotatedImagePublicId: uploadedAssets.annotatedImagePublicId,
          palmLines,
          aiProvider: provider || aiResult.aiProvider,
          aiModel: model || aiResult.aiModel,
          latencyMs,
          previewExpiresAt: expiresAt,
          completedAt: new Date(),
        },
        { session }
      );

      await this.guestTrialModel.create(
        [
          {
            fingerprintHash,
            ipHash,
            guestTokenHash,
            readingId: reading._id,
            isClaimed: false,
            expiresAt,
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

    const truncated = truncatePalmResultForGuest(aiResult);
    const readingPreview = buildGuestPreviewResponse(
      {
        _id: reading._id,
        school: validated.school,
        hand: validated.hand,
        topics,
        status: ReadingStatus.GUEST_PREVIEW,
        imageUrl: uploadedAssets.imageUrl,
        annotatedImageUrl: uploadedAssets.annotatedImageUrl,
        palmLines,
        previewExpiresAt: expiresAt,
        createdAt: reading.createdAt,
      },
      truncated,
      claimToken
    );

    return {
      reading: readingPreview,
      claimToken,
      isRejected: false,
      idempotentReplayed: false,
    };
  }

  async getGuestReadingPreview(
    claimToken: string
  ): Promise<GuestReadingPreviewDto> {
    if (!claimToken || !UUID_V4_REGEX.test(claimToken)) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Bài bói thử nghiệm không tồn tại hoặc đã hết hạn lưu trữ.",
      });
    }

    const guestTokenHash = crypto
      .createHash("sha256")
      .update(claimToken)
      .digest("hex");
    const reading = await this.readingModel.findOne({
      guestTokenHash,
      previewExpiresAt: { $gt: new Date() },
    });

    if (!reading || !reading.result) {
      throw new NotFoundException({
        code: "NOT_FOUND",
        message: "Bài bói thử nghiệm không tồn tại hoặc đã hết hạn lưu trữ.",
      });
    }

    const truncated = truncatePalmResultForGuest(reading.result as any);
    return buildGuestPreviewResponse(reading, truncated, claimToken);
  }
}
