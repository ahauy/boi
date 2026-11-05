import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { changePasswordSchema, updateProfileSchema } from "@palmsight/shared";
import type {
  MeResponseDto,
  CreditTransactionListResponseDto,
  ChangePasswordRequestDto,
  UpdateProfileRequestDto,
  EnterReferralRequestDto,
  EnterReferralResponseDto,
  ReferralListResponseDto,
} from "@palmsight/shared";
import { resolveClientIp } from "../common/client-ip.util";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/guards/jwt-auth.guard";
import { UserRateLimit, UserRateLimitGuard } from "../auth/guards/user-rate-limit.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { PasswordService } from "../auth/password.service";
import { UserDocument } from "../schemas/user.schema";
import { UsersService } from "./users.service";
import { AvatarService } from "./avatar.service";
import { AvatarUploadInterceptor } from "./avatar-upload.interceptor";
import { CreditLedgerService } from "../credits/credit-ledger.service";
import { ReferralsService } from "../referrals/referrals.service";
import { enterReferralBodySchema } from "../referrals/schemas";

@Controller("me")
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly creditLedgerService: CreditLedgerService,
    private readonly passwordService: PasswordService,
    private readonly referralsService: ReferralsService,
    private readonly configService: ConfigService,
    private readonly avatarService: AvatarService
  ) {}

  @Get()
  getMe(@CurrentUser() user: UserDocument): Promise<MeResponseDto> {
    return this.usersService.getMe(user);
  }

  // Chỉ sửa chính mình: user luôn lấy từ token, không nhận id từ body/params
  @Patch()
  @UseGuards(UserRateLimitGuard)
  @UserRateLimit({ limit: 10, windowMs: 60 * 1000 })
  async updateProfile(
    @CurrentUser() user: UserDocument,
    @Body() body: UpdateProfileRequestDto
  ): Promise<MeResponseDto> {
    const validated = await updateProfileSchema.validate(body ?? {}, { abortEarly: false });
    return this.usersService.updateDisplayName(user, validated.displayName);
  }

  @Post("avatar")
  @HttpCode(HttpStatus.OK)
  @UseGuards(UserRateLimitGuard)
  @UserRateLimit({ limit: 5, windowMs: 60 * 1000 })
  @UseInterceptors(AvatarUploadInterceptor)
  uploadAvatar(
    @CurrentUser() user: UserDocument,
    @UploadedFile() file?: Express.Multer.File
  ): Promise<MeResponseDto> {
    return this.avatarService.replaceAvatar(user, file);
  }

  @Delete("avatar")
  @UseGuards(UserRateLimitGuard)
  @UserRateLimit({ limit: 5, windowMs: 60 * 1000 })
  removeAvatar(@CurrentUser() user: UserDocument): Promise<MeResponseDto> {
    return this.avatarService.removeAvatar(user);
  }

  @Get("credit-transactions")
  getCreditTransactions(
    @CurrentUser() user: UserDocument,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string
  ): Promise<CreditTransactionListResponseDto> {
    return this.creditLedgerService.getTransactions(user._id, {
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get("referrals")
  getReferrals(
    @CurrentUser() user: UserDocument,
    @Query("cursor") cursor?: string,
    @Query("limit") limit?: string
  ): Promise<ReferralListResponseDto> {
    return this.referralsService.getReferrals(user._id, {
      cursor,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post("referral")
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(UserRateLimitGuard)
  @UserRateLimit({ limit: 5, windowMs: 60 * 60 * 1000 })
  async enterReferral(
    @CurrentUser() user: UserDocument,
    @Body() body: EnterReferralRequestDto,
    @Req() req: AuthenticatedRequest,
    @Headers("x-device-id") deviceId?: string
  ): Promise<EnterReferralResponseDto> {
    const validated = await enterReferralBodySchema.validate(body, {
      abortEarly: false,
    });
    return this.referralsService.enterReferral(
      user,
      validated.code,
      deviceId,
      resolveClientIp(req, this.configService)
    );
  }

  @Put("password")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(UserRateLimitGuard)
  @UserRateLimit({ limit: 5, windowMs: 60 * 60 * 1000 })
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() body: ChangePasswordRequestDto
  ): Promise<void> {
    const validated = await changePasswordSchema.validate(body, { abortEarly: false });
    await this.passwordService.changePassword(req.user, req.sessionId, validated);
  }
}
