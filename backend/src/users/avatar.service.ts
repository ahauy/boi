import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import sharp from 'sharp';
import type { MeResponseDto } from '@palmsight/shared';
import { UserDocument, User } from '../schemas/user.schema';
import { CloudinaryService } from '../readings/cloudinary.service';
import { UsersService } from './users.service';

const AVATAR_SIZE = 512;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
// Chặn ảnh nén cực lớn (decompression bomb) trước khi sharp giải mã
const MAX_INPUT_PIXELS = 40_000_000;

const fail = (status: HttpStatus, code: string, message: string) =>
  new HttpException({ code, message }, status);

@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly cloudinary: CloudinaryService,
    private readonly usersService: UsersService,
  ) {}

  async replaceAvatar(user: UserDocument, file?: Express.Multer.File): Promise<MeResponseDto> {
    if (!file?.buffer?.length) {
      throw new HttpException(
        {
          code: 'VALIDATION_ERROR',
          message: 'Dữ liệu gửi lên không hợp lệ.',
          details: { fields: [{ field: 'avatar', message: 'Thiếu ảnh đại diện.' }] },
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!this.cloudinary.isConfigured()) {
      throw fail(HttpStatus.SERVICE_UNAVAILABLE, 'AVATAR_UNAVAILABLE', 'Tính năng ảnh đại diện tạm thời chưa khả dụng.');
    }

    const processed = await this.processImage(file.buffer);

    // publicId ngẫu nhiên: không đoán được, không chứa id/tên người dùng
    let uploaded: { url: string; publicId: string };
    try {
      uploaded = await this.cloudinary.uploadImageStrict(processed, 'image/jpeg', {
        folder: this.cloudinary.getAvatarFolder(),
        publicId: crypto.randomBytes(16).toString('hex'),
      });
    } catch (error) {
      this.logger.warn(`Upload avatar thất bại: ${(error as Error).message}`);
      throw fail(HttpStatus.BAD_GATEWAY, 'AVATAR_UPLOAD_FAILED', 'Không tải được ảnh đại diện lên, vui lòng thử lại.');
    }

    // new:false trả bản trước khi ghi, nhờ đó lấy đúng publicId cũ kể cả khi có hai request song song
    let previous: UserDocument | null;
    try {
      previous = await this.userModel.findOneAndUpdate(
        { _id: user._id, deletedAt: null },
        { $set: { avatarUrl: uploaded.url, avatarPublicId: uploaded.publicId } },
        { new: false },
      );
    } catch (error) {
      this.logger.error(`Lưu avatar thất bại: ${(error as Error).message}`);
      await this.safeDelete(uploaded.publicId);
      throw fail(HttpStatus.BAD_GATEWAY, 'AVATAR_UPLOAD_FAILED', 'Không lưu được ảnh đại diện, vui lòng thử lại.');
    }
    if (!previous) {
      await this.safeDelete(uploaded.publicId);
      throw fail(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Tài khoản không còn tồn tại.');
    }

    // Xoá ảnh cũ sau khi lưu; nếu xoá thất bại, rollback lại avatar cũ và xoá ảnh mới để không tạo ảnh mồ côi
    if (previous.avatarPublicId && previous.avatarPublicId !== uploaded.publicId) {
      let deleted = false;
      try {
        deleted = await this.cloudinary.deleteImage(previous.avatarPublicId);
      } catch {
        deleted = false;
      }
      if (!deleted) {
        this.logger.warn(`Không xoá được ảnh đại diện cũ ${previous.avatarPublicId}, hoàn tác cập nhật avatar.`);
        await this.userModel.updateOne(
          { _id: user._id, avatarPublicId: uploaded.publicId },
          { $set: { avatarUrl: previous.avatarUrl, avatarPublicId: previous.avatarPublicId } },
        );
        await this.safeDelete(uploaded.publicId);
        throw fail(HttpStatus.BAD_GATEWAY, 'AVATAR_UPDATE_FAILED', 'Không gỡ được ảnh đại diện cũ trên Cloudinary, vui lòng thử lại.');
      }
    }

    const fresh = await this.userModel.findById(user._id);
    return this.usersService.getProfileDto(fresh ?? previous);
  }

  async removeAvatar(user: UserDocument): Promise<MeResponseDto> {
    const current = await this.userModel.findOne({ _id: user._id, deletedAt: null });
    if (!current) {
      throw fail(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Tài khoản không còn tồn tại.');
    }
    // Ảnh Google/Facebook (không có publicId) không phải ảnh của ta: giữ nguyên, trả 200 như cũ
    if (!current.avatarPublicId) {
      return this.usersService.getProfileDto(current);
    }

    const publicId = current.avatarPublicId;
    if (!(await this.cloudinary.deleteImage(publicId))) {
      throw fail(HttpStatus.BAD_GATEWAY, 'AVATAR_DELETE_FAILED', 'Không gỡ được ảnh đại diện, vui lòng thử lại.');
    }
    // Điều kiện publicId để không ghi đè nếu request khác vừa đổi ảnh
    const updated = await this.userModel.findOneAndUpdate(
      { _id: user._id, deletedAt: null, avatarPublicId: publicId },
      { $set: { avatarUrl: null, avatarPublicId: null } },
      { new: true },
    );
    return this.usersService.getProfileDto(updated ?? (await this.userModel.findById(user._id)) ?? current);
  }

  private async safeDelete(publicId: string): Promise<void> {
    try {
      if (!(await this.cloudinary.deleteImage(publicId))) {
        this.logger.warn(`Không xoá được ảnh Cloudinary ${publicId}`);
      }
    } catch (error) {
      this.logger.warn(`Không xoá được ảnh Cloudinary ${publicId}: ${(error as Error).message}`);
    }
  }

  private async processImage(input: Buffer): Promise<Buffer> {
    try {
      const options = { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' as const };
      // Định dạng do sharp đọc từ magic bytes, không tin mimetype hay đuôi file
      const meta = await sharp(input, options).metadata();
      if (!meta.format || !ALLOWED_FORMATS.has(meta.format) || !meta.width || !meta.height) {
        throw new Error('unsupported');
      }
      // EXIF orientation 5-8 hoán đổi rộng/cao; metadata() chưa tính phần này
      const pageHeight = meta.pageHeight ?? meta.height;
      const swapped = (meta.orientation ?? 1) >= 5;
      const w = swapped ? pageHeight : meta.width;
      const h = swapped ? meta.width : pageHeight;
      // Không phóng to ảnh nhỏ: cạnh vuông tối đa 512 nhưng không vượt cạnh ngắn của ảnh gốc
      const side = Math.max(1, Math.min(AVATAR_SIZE, w, h));
      // Không gọi withMetadata nên EXIF/ICC bị bỏ; flatten để PNG trong suốt không thành nền đen
      return await sharp(input, options)
        .rotate()
        .resize(side, side, { fit: 'cover', position: 'centre' })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 82 })
        .toBuffer();
    } catch {
      throw fail(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        'AVATAR_INVALID_TYPE',
        'Ảnh đại diện phải là ảnh JPEG, PNG hoặc WebP hợp lệ.',
      );
    }
  }
}
