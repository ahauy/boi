import type { RegisterRequestDto } from "@palmsight/shared";

export interface RegisterFormValues extends RegisterRequestDto {
  confirmPassword: string;
  termsAccepted: boolean;
}

export type { RegisterRequestDto, RegisterResponseDto } from "@palmsight/shared";
