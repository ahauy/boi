import type { RegisterRequestDto } from "@palmsight/shared";

export interface RegisterFormValues extends RegisterRequestDto {
  confirmPassword: string;
  termsAccepted: boolean;
  ageConfirmed: boolean;
}

export type { RegisterRequestDto, RegisterResponseDto } from "@palmsight/shared";
