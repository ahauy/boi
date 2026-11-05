import { NestFactory } from "@nestjs/core";
import { Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");
  const configService = app.get(ConfigService);

  const nodeEnv = configService.get<string>("NODE_ENV", "development");
  if (nodeEnv === "production" && !configService.get("IDENTITY_HASH_SECRET")) {
    throw new Error("IDENTITY_HASH_SECRET must be set in production");
  }
  const port = Number(
    configService.get<number | string>("PORT") ||
      configService.get<number | string>("API_PORT", 4000)
  );

  app.use(
    helmet({
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          fontSrc: ["'self'", "https:", "data:"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", "https:", "'unsafe-inline'"],
          upgradeInsecureRequests: [],
        },
      },
      xFrameOptions: { action: "sameorigin" },
      xContentTypeOptions: true,
    })
  );

  // Không bật CORS: API chỉ phục vụ app mobile (không chạy trong trình duyệt) nên không cần
  // cho phép origin web nào. Trình duyệt gọi chéo nguồn sẽ bị chặn mặc định.
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    })
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.setGlobalPrefix("api/v1");
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`PalmSight API is running on port ${port} in ${nodeEnv} mode`);
}

if (!process.env.VITEST) {
  void bootstrap();
}
