import { MongoMemoryReplSet } from "mongodb-memory-server";
import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { MongooseModule, getConnectionToken } from "@nestjs/mongoose";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";

import { ApiExceptionFilter } from "../src/common/filters/api-exception.filter";
import { AuthModule } from "../src/auth/auth.module";
import { UsersModule } from "../src/users/users.module";
import { CreditsModule } from "../src/credits/credits.module";
import { HealthModule } from "../src/health/health.module";
import { ReadingsModule } from "../src/readings/readings.module";
import { MailService } from "../src/mail/mail.service";
import { GoogleAuthVerifier } from "../src/auth/google-auth.verifier";
import { FacebookAuthVerifier } from "../src/auth/facebook-auth.verifier";

export interface TestAppInstance {
  app: INestApplication;
  baseUrl: string;
  replSet: MongoMemoryReplSet;
  connection: mongoose.Connection;
  sentEmails: Array<{ to: string; displayName: string; rawToken: string }>;
  sentResetEmails: Array<{ to: string; displayName: string; rawToken: string }>;
  mailServiceMock: {
    sendVerificationEmail: (
      to: string,
      displayName: string,
      rawToken: string
    ) => Promise<void>;
    sendPasswordResetEmail: (
      to: string,
      displayName: string,
      rawToken: string
    ) => Promise<void>;
  };
}

export interface TestAppOptions {
  googleVerifier?: Pick<GoogleAuthVerifier, "verify"> &
    Partial<Pick<GoogleAuthVerifier, "verifyCode">>;
  facebookVerifier?: Pick<FacebookAuthVerifier, "verify">;
}

export async function createTestApp(
  options: TestAppOptions = {}
): Promise<TestAppInstance> {
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const mongoUri = replSet.getUri();

  const sentEmails: Array<{
    to: string;
    displayName: string;
    rawToken: string;
  }> = [];
  const sentResetEmails: Array<{
    to: string;
    displayName: string;
    rawToken: string;
  }> = [];
  const mailServiceMock = {
    sendVerificationEmail: async (
      to: string,
      displayName: string,
      rawToken: string
    ) => {
      sentEmails.push({ to, displayName, rawToken });
    },
    sendPasswordResetEmail: async (
      to: string,
      displayName: string,
      rawToken: string
    ) => {
      sentResetEmails.push({ to, displayName, rawToken });
    },
    renderVerificationEmailTemplate: (_params: any) => "mock-html",
  };

  let moduleBuilder = Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [
          () => ({
            MONGODB_URI: mongoUri,
            JWT_ACCESS_SECRET:
              "test-jwt-secret-palm-sight-at-least-32-chars-long",
            JWT_ACCESS_TTL_SECONDS: 900,
            REFRESH_TOKEN_TTL_DAYS: 30,
            EMAIL_VERIFY_TTL_HOURS: 24,
            IDENTITY_HASH_SECRET: "test-identity-secret-at-least-32-chars-long",
            SIGNUP_BONUS_CREDITS: 3,
            REFERRAL_REWARD_CREDITS: 2,
            REFEREE_REWARD_CREDITS: 1,
            REFERRAL_DAILY_CAP: 10,
            PUBLIC_BASE_URL: "http://localhost:5173",
            GOOGLE_CLIENT_ID:
              "test-google-client-id.apps.googleusercontent.com",
            FACEBOOK_APP_ID: "test-facebook-app-id",
            FACEBOOK_APP_SECRET: "test-facebook-app-secret",
            NODE_ENV: "test",
          }),
        ],
      }),
      MongooseModule.forRootAsync({
        inject: [ConfigService],
        useFactory: (config: ConfigService) => ({
          uri: config.getOrThrow<string>("MONGODB_URI"),
          autoIndex: false,
        }),
      }),
      HealthModule,
      CreditsModule,
      AuthModule,
      UsersModule,
      ReadingsModule,
    ],
  })
    .overrideProvider(MailService)
    .useValue(mailServiceMock);

  if (options.googleVerifier) {
    moduleBuilder = moduleBuilder
      .overrideProvider(GoogleAuthVerifier)
      .useValue(options.googleVerifier);
  }

  if (options.facebookVerifier) {
    moduleBuilder = moduleBuilder
      .overrideProvider(FacebookAuthVerifier)
      .useValue(options.facebookVerifier);
  }

  const moduleRef: TestingModule = await moduleBuilder.compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser("ps-guest-trial-test-secret"));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.setGlobalPrefix("api/v1");
  await app.listen(0);

  const baseUrl = await app.getUrl();

  const connection = moduleRef.get<mongoose.Connection>(getConnectionToken());

  const collectionNames = [
    "pending_registrations",
    "users",
    "sessions",
    "referrals",
    "credit_transactions",
    "deleted_identities",
    "readings",
    "guest_trials",
  ];
  for (const col of collectionNames) {
    try {
      await connection.createCollection(col);
    } catch {
      continue;
    }
  }

  return {
    app,
    baseUrl,
    replSet,
    connection,
    sentEmails,
    sentResetEmails,
    mailServiceMock,
  };
}

export async function closeTestApp(instance: TestAppInstance): Promise<void> {
  if (instance.app) {
    await instance.app.close();
  }
  await mongoose.disconnect();
  if (instance.replSet) {
    await instance.replSet.stop();
  }
}
