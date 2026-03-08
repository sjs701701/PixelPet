import { create } from "zustand";
import { LoginProvider, PetInstance, User } from "@pixel-pet-arena/shared";

type SessionState = {
  user?: User;
  token?: string;
  pet?: PetInstance;
  provider: LoginProvider;
  setSession: (user: User, token: string) => void;
  setPet: (pet: PetInstance) => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  provider: "google",
  setSession: (user, token) => set({ user, token }),
  setPet: (pet) => set({ pet }),
}));
