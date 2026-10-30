import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { changePasswordSchema } from "@palmsight/shared";
import type {
  MeResponseDto,
  CreditTransactionListResponseDto,
  ChangePasswordRequestDto,
  EnterReferralRequestDto,
  EnterReferralResponseDto,
  ReferralListResponseDto,
} from "@palmsight/shared";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/guards/jwt-auth.guard";
import { UserRateLimit, UserRateLimitGuard } from "../auth/guards/user-rate-limit.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { PasswordService } from "../auth/password.service";
import { UserDocument } from "../schemas/user.schema";
import { UsersService } from "./users.service";
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
    private readonly referralsService: ReferralsService
  ) {}

  @Get()
  getMe(@CurrentUser() user: UserDocument): Promise<MeResponseDto> {
    return this.usersService.getMe(user);
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
    @Body() body: EnterReferralRequestDto
  ): Promise<EnterReferralResponseDto> {
    const validated = await enterReferralBodySchema.validate(body, {
      abortEarly: false,
    });
    return this.referralsService.enterReferral(user, validated.code);
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
