import { beforeEach, describe, expect, it } from "vitest";
import { PetInstance, User } from "@pixel-pet-arena/shared";
import { useSessionStore } from "./store";

const demoUser: User = {
  id: "user-install-alpha",
  displayName: "Trainer A",
  loginProvider: "demo",
  premiumStatus: "free",
  installId: "install-alpha",
};

const demoPet: PetInstance = {
  id: "pet-1",
  ownerId: "user-install-alpha",
  templateId: "fire-1",
  nickname: "Nova",
  level: 1,
  experience: 35,
  lifeState: "alive",
  careState: {
    hunger: 60,
    mood: 60,
    hygiene: 60,
    energy: 60,
    bond: 60,
  },
  inventoryLoadout: {},
  cosmeticLoadout: {},
  lastSimulatedAt: "2026-03-11T00:00:00.000Z",
  freeRevivesRemaining: 3,
  createdAt: "2026-03-11T00:00:00.000Z",
};

describe("session store", () => {
  beforeEach(() => {
    useSessionStore.setState({
      user: undefined,
      token: undefined,
      pet: undefined,
      provider: "demo",
      language: "ko",
    });
  });

  it("stores session and pet state", () => {
    useSessionStore.getState().setSession(demoUser, "token-alpha");
    useSessionStore.getState().setPet(demoPet);

    const state = useSessionStore.getState();

    expect(state.user).toEqual(demoUser);
    expect(state.token).toBe("token-alpha");
    expect(state.pet).toEqual(demoPet);
  });

  it("clears session state without losing language preference", () => {
    useSessionStore.getState().setLanguage("en");
    useSessionStore.getState().setSession(demoUser, "token-alpha");
    useSessionStore.getState().setPet(demoPet);

    useSessionStore.getState().clearSession();

    const state = useSessionStore.getState();
    expect(state.user).toBeUndefined();
    expect(state.token).toBeUndefined();
    expect(state.pet).toBeUndefined();
    expect(state.language).toBe("en");
  });
});
