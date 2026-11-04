import { NestFactory } from "@nestjs/core";
import { ForbiddenException, Logger, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { ApiExceptionFilter } from "./common/filters/api-exception.filter";

const DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:8082",
  "http://127.0.0.1:8082",
  "http://localhost:4000",
];

export function createCorsOriginValidator(
  nodeEnv: string,
  publicBaseUrl: string
) {
  const allowedOrigins = (publicBaseUrl || "")
    .split(",")
    .map((url) => url.trim().replace(/\/+$/, ""))
    .filter(Boolean);

  return (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void
  ) => {
    if (!origin) {
      return callback(null, true);
    }

    if (nodeEnv === "production") {
      if (publicBaseUrl === "*" || !publicBaseUrl) {
        return callback(
          new Error("CORS wildcard * is strictly forbidden in production")
        );
      }
      const normalizedOrigin = origin.replace(/\/+$/, "");
      if (
        allowedOrigins.includes(normalizedOrigin) ||
        /^https:\/\/([a-zA-Z0-9-]+\.)*vercel\.app$/.test(normalizedOrigin)
      ) {
        return callback(null, true);
      }
      return callback(
        new ForbiddenException(`Origin ${origin} not allowed by CORS`)
      );
    }

    if (
      DEV_ORIGINS.includes(origin) ||
      allowedOrigins.includes(origin.replace(/\/+$/, "")) ||
      /^https?:\/\/([a-zA-Z0-9-]+\.)*ngrok-free\.app(?::\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }

    return callback(
      new ForbiddenException(`Origin ${origin} not allowed by CORS`)
    );
  };
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");
  const configService = app.get(ConfigService);

  const nodeEnv = configService.get<string>("NODE_ENV", "development");
  const publicBaseUrl = configService.get<string>(
    "PUBLIC_BASE_URL",
    "http://localhost:5173"
  );
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

  app.enableCors({
    credentials: true,
    origin: createCorsOriginValidator(nodeEnv, publicBaseUrl),
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "Idempotency-Key",
      "Origin",
      "ngrok-skip-browser-warning",
      "X-Request-Id",
      "X-Refresh-Token",
      "X-Client",
      "X-Device-Id",
    ],
    exposedHeaders: [
      "Set-Cookie",
      "Retry-After",
      "Idempotent-Replayed",
      "X-Request-Id",
    ],
    maxAge: 86400,
  });

  const cookieSecret = configService.get<string>(
    "GUEST_TRIAL_SECRET",
    "palmsight-guest-trial-secret-2026"
  );
  app.use(cookieParser(cookieSecret));
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
