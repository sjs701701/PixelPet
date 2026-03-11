import { beforeEach, describe, expect, it } from "vitest";
import {
  clearStoredSession,
  getDemoDisplayName,
  getOrCreateInstallId,
  parseStoredUser,
  persistStoredSession,
  readStoredSession,
} from "./auth/session-storage";

type MemoryStorage = {
  data: Map<string, string>;
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  multiGet: (keys: readonly string[]) => Promise<readonly (readonly [string, string | null])[]>;
  multiSet: (entries: readonly (readonly [string, string])[]) => Promise<void>;
  multiRemove: (keys: readonly string[]) => Promise<void>;
};

function createMemoryStorage(): MemoryStorage {
  const data = new Map<string, string>();

  return {
    data,
    async getItem(key) {
      return data.has(key) ? data.get(key)! : null;
    },
    async setItem(key, value) {
      data.set(key, value);
    },
    async multiGet(keys) {
      return keys.map((key) => [key, data.has(key) ? data.get(key)! : null]);
    },
    async multiSet(entries) {
      for (const [key, value] of entries) {
        data.set(key, value);
      }
    },
    async multiRemove(keys) {
      for (const key of keys) {
        data.delete(key);
      }
    },
  };
}

describe("mobile session storage", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("creates and reuses the install id", async () => {
    const installId = await getOrCreateInstallId(storage);
    const nextInstallId = await getOrCreateInstallId(storage);

    expect(installId).toMatch(/^install-/);
    expect(nextInstallId).toBe(installId);
    expect(getDemoDisplayName(installId)).toMatch(/^Trainer /);
  });

  it("persists and restores the stored session", async () => {
    const user = {
      id: "user-install-alpha",
      displayName: "Trainer A",
      loginProvider: "demo" as const,
      premiumStatus: "free" as const,
      installId: "install-alpha",
    };

    await persistStoredSession(user, "token-alpha", storage);
    const session = await readStoredSession(storage);

    expect(session.hasStoredSession).toBe(true);
    expect(session.token).toBe("token-alpha");
    expect(session.user).toEqual(user);
  });

  it("clears saved session values", async () => {
    const user = {
      id: "user-install-alpha",
      displayName: "Trainer A",
      loginProvider: "demo" as const,
      premiumStatus: "free" as const,
      installId: "install-alpha",
    };

    await persistStoredSession(user, "token-alpha", storage);
    await clearStoredSession(storage);

    const session = await readStoredSession(storage);
    expect(session.hasStoredSession).toBe(false);
    expect(session.token).toBeUndefined();
    expect(session.user).toBeUndefined();
  });

  it("ignores broken saved user payloads", async () => {
    await storage.multiSet([
      ["pixelpet.sessionToken", "token-alpha"],
      ["pixelpet.user", "{\"broken\":true}"],
    ]);

    const session = await readStoredSession(storage);

    expect(session.hasStoredSession).toBe(true);
    expect(session.token).toBe("token-alpha");
    expect(session.user).toBeUndefined();
    expect(parseStoredUser("{\"broken\":true}")).toBeUndefined();
  });
});
