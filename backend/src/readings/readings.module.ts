import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Reading, ReadingSchema } from "../schemas/reading.schema";
import { User, UserSchema } from "../schemas/user.schema";
import { AuthModule } from "../auth/auth.module";
import { CreditsModule } from "../credits/credits.module";
import { AiModule } from "../ai/ai.module";
import { PalmLinesModule } from "../palm-lines/palm-lines.module";
import { ImageProcessorService } from "./image-processor.service";
import { CloudinaryService } from "./cloudinary.service";
import { ReadingsService } from "./readings.service";
import { ReadingsController } from "./readings.controller";
import { UserRateLimitGuard } from "../auth/guards/user-rate-limit.guard";

@Module({
  imports: [
    AuthModule,
    CreditsModule,
    AiModule,
    PalmLinesModule,
    MongooseModule.forFeature([
      { name: Reading.name, schema: ReadingSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [ReadingsController],
  providers: [
    ImageProcessorService,
    CloudinaryService,
    ReadingsService,
    UserRateLimitGuard,
  ],
  exports: [ReadingsService, ImageProcessorService, CloudinaryService],
})
export class ReadingsModule {}
