import { AuthProvider } from '../enums';

export interface UserSummaryDto {
  id: string;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  creditBalance: number;
  referralCode: string;
}

export interface UserReferralInfoDto {
  canEnterCode: boolean;
  enteredCode: string | null;
}

export interface UserDto {
  id: string;
  displayName: string;
  username: string | null;
  email: string | null;
  avatarUrl: string | null;
  creditBalance: number;
  referralCode: string;
  referralLink: string;
  hasPassword: boolean;
  providers: AuthProvider[];
  referral: UserReferralInfoDto;
}

export type MeResponseDto = UserDto;

export interface ChangePasswordRequestDto {
  currentPassword: string;
  newPassword: string;
}

export interface IdentityDto {
  provider: AuthProvider;
  providerUserId: string;
  email: string | null;
  linkedAt: string;
}
