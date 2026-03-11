import AsyncStorage from "@react-native-async-storage/async-storage";
import { User } from "@pixel-pet-arena/shared";

export const INSTALL_ID_KEY = "pixelpet.installId";
export const SESSION_TOKEN_KEY = "pixelpet.sessionToken";
export const SESSION_USER_KEY = "pixelpet.user";

export type StoredSession = {
  hasStoredSession: boolean;
  token?: string;
  user?: User;
};

type SessionStorage = Pick<
  typeof AsyncStorage,
  never
> & {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
  multiGet: (keys: readonly string[]) => Promise<readonly (readonly [string, string | null])[]>;
  multiSet: (entries: readonly (readonly [string, string])[]) => Promise<unknown>;
  multiRemove: (keys: readonly string[]) => Promise<unknown>;
};

export function createInstallId(now = Date.now(), random = Math.random()) {
  return `install-${now.toString(36)}-${random.toString(36).slice(2, 10)}`;
}

export async function getOrCreateInstallId(storage: SessionStorage = AsyncStorage) {
  const existing = await storage.getItem(INSTALL_ID_KEY);
  if (existing) {
    return existing;
  }

  const next = createInstallId();
  await storage.setItem(INSTALL_ID_KEY, next);
  return next;
}

export function getDemoDisplayName(installId: string) {
  return `Trainer ${installId.slice(-4).toUpperCase()}`;
}

export function parseStoredUser(value: string | null): User | undefined {
  if (!value) return undefined;

  try {
    const parsed = JSON.parse(value) as User;
    if (typeof parsed.id !== "string" || typeof parsed.displayName !== "string") {
      return undefined;
    }
    return parsed;
  } catch {
    return undefined;
  }
}

export async function readStoredSession(storage: SessionStorage = AsyncStorage): Promise<StoredSession> {
  const entries = await storage.multiGet([SESSION_TOKEN_KEY, SESSION_USER_KEY]);
  const values = Object.fromEntries(entries);
  const token = values[SESSION_TOKEN_KEY] ?? undefined;
  const user = parseStoredUser(values[SESSION_USER_KEY] ?? null);

  return {
    hasStoredSession: Boolean(values[SESSION_TOKEN_KEY] || values[SESSION_USER_KEY]),
    token,
    user,
  };
}

export async function persistStoredSession(
  user: User,
  token: string,
  storage: SessionStorage = AsyncStorage,
) {
  await storage.multiSet([
    [SESSION_TOKEN_KEY, token],
    [SESSION_USER_KEY, JSON.stringify(user)],
  ]);
}

export async function clearStoredSession(storage: SessionStorage = AsyncStorage) {
  await storage.multiRemove([SESSION_TOKEN_KEY, SESSION_USER_KEY]);
}
