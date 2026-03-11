import { create } from "zustand";
import { LoginProvider, PetInstance, User } from "@pixel-pet-arena/shared";

export type AppLanguage = "ko" | "en";

type SessionState = {
  user?: User;
  token?: string;
  pet?: PetInstance;
  provider: LoginProvider;
  language: AppLanguage;
  setSession: (user: User, token: string) => void;
  setPet: (pet: PetInstance) => void;
  setLanguage: (language: AppLanguage) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  provider: "demo",
  language: "ko",
  setSession: (user, token) => set({ user, token }),
  setPet: (pet) => set({ pet }),
  setLanguage: (language) => set({ language }),
  clearSession: () => set({ user: undefined, token: undefined, pet: undefined }),
}));
