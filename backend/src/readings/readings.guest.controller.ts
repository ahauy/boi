import {
  Controller,
  Post,
  Get,
  UseGuards,
  UploadedFile,
  Body,
  Headers,
  Req,
  Res,
  Param,
  HttpStatus,
  HttpCode,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { ReadingsService } from "./readings.service";
import { GuestTrialGuard } from "./guards/guest-trial.guard";
import { GuestTrialRateLimitGuard } from "./guards/guest-trial-rate-limit.guard";

type GuestRequestWithFiles = Request & {
  clientIp?: string;
  fingerprintHash?: string;
  file?: Express.Multer.File;
  files?:
    | Express.Multer.File[]
    | {
        image?: Express.Multer.File[];
        annotatedImage?: Express.Multer.File[];
      };
};

@Controller("readings/guest")
export class ReadingsGuestController {
  constructor(
    private readonly readingsService: ReadingsService,
    private readonly configService: ConfigService
  ) {}

  @Post()
  @UseGuards(GuestTrialGuard, GuestTrialRateLimitGuard)
  async createGuestReading(
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: GuestRequestWithFiles,
    @Res() res: Response
  ) {
    const clientIp =
      req.clientIp ||
      (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
      req.socket.remoteAddress ||
      "127.0.0.1";
    const fingerprintHash = req.fingerprintHash || "";

    const fieldFiles =
      req.files && !Array.isArray(req.files) ? req.files : undefined;
    const effectiveFile = file || req.file || fieldFiles?.image?.[0];
    const annotatedFile = fieldFiles?.annotatedImage?.[0];

    const outcome = await this.readingsService.createGuestReading(
      idempotencyKey,
      body,
      effectiveFile,
      clientIp,
      fingerprintHash,
      annotatedFile
    );

    if (outcome.idempotentReplayed) {
      res.setHeader("Idempotent-Replayed", "true");
    }

    if (outcome.isRejected) {
      return res.status(HttpStatus.OK).json({ reading: outcome.reading });
    }

    const isProd = this.configService.get("NODE_ENV") === "production";
    if (outcome.claimToken) {
      res.cookie("ps_guest_trial", outcome.claimToken, {
        signed: true,
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        path: "/api/v1",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    return res.status(HttpStatus.CREATED).json({
      reading: outcome.reading,
      claimToken: outcome.claimToken,
    });
  }

  @Get(":token")
  @HttpCode(HttpStatus.OK)
  async getGuestReadingPreview(@Param("token") token: string) {
    return this.readingsService.getGuestReadingPreview(token);
  }
}
