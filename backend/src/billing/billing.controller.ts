import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  BillingVerifyRequestDto,
  BillingVerifyResponseDto,
} from '@palmsight/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { UserDocument } from '../schemas/user.schema';
import {
  BillingService,
  RtdnWebhookPayload,
  RtdnWebhookResult,
} from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  verifyPurchase(
    @CurrentUser() user: UserDocument,
    @Body() body: BillingVerifyRequestDto,
  ): Promise<BillingVerifyResponseDto> {
    return this.billingService.verifyPurchase(user, body);
  }

  @Post('rtdn')
  @HttpCode(HttpStatus.OK)
  handleRtdnWebhook(
    @Query('token') token: string | undefined,
    @Body() body: RtdnWebhookPayload,
  ): Promise<RtdnWebhookResult> {
    this.billingService.assertRtdnToken(token);
    return this.billingService.handleRtdnWebhook(body);
  }
}
