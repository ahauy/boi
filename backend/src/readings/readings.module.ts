import {
  Module,
  NestModule,
  MiddlewareConsumer,
  RequestMethod,
} from "@nestjs/common";
import multer from "multer";
import { MongooseModule } from "@nestjs/mongoose";
import { Reading, ReadingSchema } from "../schemas/reading.schema";
import { User, UserSchema } from "../schemas/user.schema";
import { GuestTrial, GuestTrialSchema } from "../schemas/guest-trial.schema";
import { AuthModule } from "../auth/auth.module";
import { CreditsModule } from "../credits/credits.module";
import { AiModule } from "../ai/ai.module";
import { ImageProcessorService } from "./image-processor.service";
import { CloudinaryService } from "./cloudinary.service";
import { ReadingsService } from "./readings.service";
import { ReadingsController } from "./readings.controller";
import { ReadingsGuestController } from "./readings.guest.controller";
import { GuestTrialGuard } from "./guards/guest-trial.guard";
import { GuestTrialRateLimitGuard } from "./guards/guest-trial-rate-limit.guard";

const guestUploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
}).fields([
  { name: "image", maxCount: 1 },
  { name: "annotatedImage", maxCount: 1 },
]);

@Module({
  imports: [
    AuthModule,
    CreditsModule,
    AiModule,
    MongooseModule.forFeature([
      { name: Reading.name, schema: ReadingSchema },
      { name: User.name, schema: UserSchema },
      { name: GuestTrial.name, schema: GuestTrialSchema },
    ]),
  ],
  controllers: [ReadingsController, ReadingsGuestController],
  providers: [
    ImageProcessorService,
    CloudinaryService,
    ReadingsService,
    GuestTrialGuard,
    GuestTrialRateLimitGuard,
  ],
  exports: [ReadingsService, ImageProcessorService, CloudinaryService],
})
export class ReadingsModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(guestUploadMiddleware)
      .forRoutes({ path: "readings/guest", method: RequestMethod.POST });
  }
}
