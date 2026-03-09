import { create } from "zustand";
import { LoginProvider, PetInstance, User } from "@pixel-pet-arena/shared";

export type AppLanguage = "ko" | "en";

type SessionState = {
  user?: User;
  token?: string;
  pet?: PetInstance;
  petNickname?: string;
  provider: LoginProvider;
  language: AppLanguage;
  setSession: (user: User, token: string) => void;
  setPet: (pet: PetInstance) => void;
  setPetNickname: (petNickname?: string) => void;
  setLanguage: (language: AppLanguage) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  provider: "google",
  language: "ko",
  setSession: (user, token) => set({ user, token }),
  setPet: (pet) => set({ pet }),
  setPetNickname: (petNickname) => set({ petNickname }),
  setLanguage: (language) => set({ language }),
}));
