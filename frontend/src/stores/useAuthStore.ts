import { create } from "zustand";
import type { UserSummaryDto } from "@palmsight/shared";
import type { AuthUser } from "@/providers/AuthenticationProvider";
import httpService from "@/services/httpService";

export interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setAuthSession: (session: {
    accessToken: string;
    user: AuthUser | UserSummaryDto;
  }) => void;
  clearAuthSession: () => void;
  updateUser: (fields: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user:
    typeof window !== "undefined"
      ? (httpService.getUserStorage() as AuthUser | null)
      : null,
  setAuthSession: ({ accessToken, user }) =>
    set({ accessToken, user: user as AuthUser }),
  clearAuthSession: () => set({ accessToken: null, user: null }),
  updateUser: (fields) =>
    set((state) => ({
      user: state.user ? { ...state.user, ...fields } : null,
    })),
}));

export default useAuthStore;
