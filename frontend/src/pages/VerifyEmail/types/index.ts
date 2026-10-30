import type {
  VerifyEmailRequestDto,
  AuthResponseDto,
  ResendVerificationRequestDto,
} from "@palmsight/shared";

export type VerifyState = "idle" | "loading" | "success" | "error";

export type {
  VerifyEmailRequestDto,
  AuthResponseDto,
  ResendVerificationRequestDto,
};
