import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "@tanstack/react-query";
import { PET_TEMPLATES, getTemplateById } from "@pixel-pet-arena/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  acceptPetDeath,
  ApiError,
  getApiEndpointSummary,
  getFriendlyApiErrorMessage,
  getMyPet,
  getPremiumStatus,
  queueBattleDev,
  rollInitialPet,
  signInDemo,
  syncPetSnapshot,
  togglePremiumDev,
} from "./api";
import {
  clearStoredSession,
  getDemoDisplayName,
  getOrCreateInstallId,
  persistStoredSession,
  readStoredSession,
} from "./auth";
import {
  LocalPetState,
  applyOfflineAcceptDeath,
  applyOfflineCareAction,
  applyOfflineRevive,
  clearLocalPetState,
  createLocalPetState,
  hasPendingPetSync,
  markLocalPetStateSynced,
  persistLocalPetState,
  projectLocalPetState,
  readLocalPetState,
} from "./offline-pet";
import { AppLanguage, useSessionStore } from "./store";

const LANGUAGE_KEY = "pixelpet.language";
const SPLASH_MS = 1200;
const RESTORE_MS = 350;
const SYNC_RETRY_MS = 30_000;

export type StartupPhase = "splash" | "restore" | "login" | "app";
export type TabKey = "home" | "battle" | "collection" | "profile";
export type LoginStatus = "idle" | "loading" | "error";
export type ProfileSessionState = "active" | "signed-out";
export type ProfileSaveState = "local-only" | "not-ready";

function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

function isNetworkError(error: unknown) {
  return error instanceof ApiError && error.code === "network";
}

function getPremiumErrorMessage(error: unknown, language: AppLanguage) {
  return getFriendlyApiErrorMessage(error, language);
}

export function useAppShellState() {
  const [tab, setTab] = useState<TabKey>("home");
  const [startupPhase, setStartupPhase] = useState<StartupPhase>("splash");
  const [authError, setAuthError] = useState<unknown>(null);
  const [premiumDevEnabled, setPremiumDevEnabled] = useState(false);
  const [premiumError, setPremiumError] = useState<unknown>(null);
  const [offlineMode, setOfflineMode] = useState(false);
  const [syncError, setSyncError] = useState<unknown>(null);
  const [syncPending, setSyncPending] = useState(false);
  const [localPetState, setLocalPetState] = useState<LocalPetState | undefined>();
  const localPetStateRef = useRef<LocalPetState | undefined>(undefined);
  const { user, token, pet, language, setSession, setPet, setLanguage, clearSession } =
    useSessionStore();

  useEffect(() => {
    localPetStateRef.current = localPetState;
    setSyncPending(hasPendingPetSync(localPetState));
  }, [localPetState]);

  const premiumAssist = user?.premiumStatus === "premium";

  const commitLocalPetState = useCallback(async (next?: LocalPetState) => {
    localPetStateRef.current = next;
    setLocalPetState(next);
    setPet(next?.pet);
    await persistLocalPetState(next);
    return next;
  }, [setPet]);

  const projectCurrentLocalPet = useCallback(async (now: Date | string = new Date()) => {
    const current = localPetStateRef.current;
    if (!current) {
      return undefined;
    }

    const projected = projectLocalPetState(current, now, premiumAssist);
    if (JSON.stringify(projected) !== JSON.stringify(current)) {
      await commitLocalPetState(projected);
    }
    return projected;
  }, [commitLocalPetState, premiumAssist]);

  const syncLocalPetState = useCallback(async (now: Date | string = new Date()) => {
    if (!token) {
      return null;
    }

    const deviceId = user?.installId ?? await getOrCreateInstallId();
    const current = await projectCurrentLocalPet(now);
    if (!current) {
      return null;
    }

    try {
      setSyncError(null);

      if (current.pendingDeletedPetId) {
        await acceptPetDeath(token, current.pendingDeletedPetId);
        await commitLocalPetState(markLocalPetStateSynced(current, now));
        setOfflineMode(false);
        return null;
      }

      if (!current.pet) {
        return null;
      }

      const syncedPet = await syncPetSnapshot(token, current.pet.id, {
        snapshot: current.pet,
        deviceId,
        pendingCareActions: current.pendingCareActions,
        timeIntegrity: current.timeIntegrity,
      });
      await commitLocalPetState(markLocalPetStateSynced(current, now, syncedPet));
      setOfflineMode(false);
      return syncedPet;
    } catch (error) {
      setSyncError(error);
      if (isNetworkError(error)) {
        setOfflineMode(true);
      }
      throw error;
    }
  }, [commitLocalPetState, projectCurrentLocalPet, token, user?.installId]);

  useEffect(() => {
    async function loadLanguage() {
      const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (saved === "ko" || saved === "en") setLanguage(saved);
    }
    loadLanguage().catch(() => undefined);
  }, [setLanguage]);

  useEffect(() => {
    AsyncStorage.setItem(LANGUAGE_KEY, language).catch(() => undefined);
  }, [language]);

  useEffect(() => {
    if (startupPhase !== "splash") return;
    const timer = setTimeout(() => setStartupPhase("restore"), SPLASH_MS);
    return () => clearTimeout(timer);
  }, [startupPhase]);

  useEffect(() => {
    if (startupPhase !== "restore") return;
    let cancelled = false;

    async function restoreSession() {
      setAuthError(null);
      await new Promise((resolve) => setTimeout(() => resolve(undefined), RESTORE_MS));

      const storedSession = await readStoredSession();
      const cachedPetState = await readLocalPetState();
      if (cancelled) return;

      if (!storedSession.token || !storedSession.user) {
        if (storedSession.hasStoredSession) {
          await clearStoredSession();
        }
        await clearLocalPetState();
        setAuthError(null);
        clearSession();
        setStartupPhase("login");
        return;
      }

      setSession(storedSession.user, storedSession.token);

      const projectedCache = cachedPetState
        ? projectLocalPetState(cachedPetState, new Date(), storedSession.user.premiumStatus === "premium")
        : undefined;

      if (projectedCache) {
        await commitLocalPetState(projectedCache);
      } else {
        await commitLocalPetState(undefined);
      }

      setTab("home");
      setStartupPhase("app");

      try {
        if (projectedCache) {
          await syncLocalPetState(new Date());
        } else {
          const restoredPet = await getMyPet(storedSession.token);
          if (cancelled) return;

          if (restoredPet) {
            const nextState = createLocalPetState(
              restoredPet,
              storedSession.user.installId,
              new Date(),
            );
            await commitLocalPetState(nextState);
          } else {
            await commitLocalPetState(undefined);
          }
          setOfflineMode(false);
        }
      } catch (error) {
        if (cancelled) return;

        if (isUnauthorizedError(error)) {
          await clearStoredSession();
          await clearLocalPetState();
          setAuthError(null);
          clearSession();
          setStartupPhase("login");
          return;
        }

        if (isNetworkError(error)) {
          setOfflineMode(true);
          setAuthError(null);
          return;
        }

        setAuthError(error);
      }
    }

    restoreSession().catch(async (error) => {
      if (cancelled) return;
      if (isUnauthorizedError(error)) {
        await clearStoredSession();
        await clearLocalPetState();
        clearSession();
        setStartupPhase("login");
        return;
      }

      setAuthError(error);
      setStartupPhase("login");
    });

    return () => {
      cancelled = true;
    };
  }, [clearSession, commitLocalPetState, setSession, startupPhase, syncLocalPetState]);

  useEffect(() => {
    if (!token) {
      setPremiumDevEnabled(false);
      setPremiumError(null);
      return;
    }

    let cancelled = false;

    getPremiumStatus(token)
      .then(async (status) => {
        if (cancelled) return;
        setPremiumDevEnabled(status.devModeEnabled);
        setPremiumError(null);
        setOfflineMode(false);

        if (user && user.premiumStatus !== status.premiumStatus) {
          const updatedUser = {
            ...user,
            premiumStatus: status.premiumStatus,
          };
          setSession(updatedUser, token);
          await persistStoredSession(updatedUser, token);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        if (isNetworkError(error)) {
          setOfflineMode(true);
          setPremiumError(null);
          return;
        }
        setPremiumDevEnabled(false);
        setPremiumError(error);
      });

    return () => {
      cancelled = true;
    };
  }, [setSession, token, user]);

  useEffect(() => {
    if (!token || startupPhase !== "app") {
      return;
    }

    if (!offlineMode && !hasPendingPetSync(localPetState)) {
      return;
    }

    const interval = setInterval(() => {
      syncLocalPetState(new Date()).catch(() => undefined);
    }, SYNC_RETRY_MS);

    return () => clearInterval(interval);
  }, [localPetState, offlineMode, startupPhase, syncLocalPetState, token]);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const installId = await getOrCreateInstallId();
      const session = await signInDemo(getDemoDisplayName(installId), installId);
      const currentPet = await getMyPet(session.accessToken);
      await persistStoredSession(session.user, session.accessToken);
      setSession(session.user, session.accessToken);

      if (currentPet) {
        await commitLocalPetState(createLocalPetState(currentPet, installId, new Date()));
      } else {
        await commitLocalPetState(undefined);
      }

      setOfflineMode(false);
      return { ...session, pet: currentPet };
    },
    onMutate: () => {
      setAuthError(null);
    },
    onSuccess: () => {
      setAuthError(null);
      setStartupPhase("app");
      setTab("home");
    },
    onError: (error) => {
      setAuthError(error);
    },
  });

  const firstPetMutation = useMutation({
    mutationFn: async (nickname?: string) => {
      if (!token) throw new Error("No session");
      const installId = user?.installId ?? await getOrCreateInstallId();
      const firstPet = await rollInitialPet(token, nickname);
      await commitLocalPetState(createLocalPetState(firstPet, installId, new Date()));
      setOfflineMode(false);
      return firstPet;
    },
  });

  const reviveMutation = useMutation({
    mutationFn: async () => {
      const current = await projectCurrentLocalPet(new Date());
      if (!current) throw new Error("No active pet");

      const next = applyOfflineRevive(current, new Date(), premiumAssist);
      await commitLocalPetState(next);

      if (!offlineMode && token) {
        syncLocalPetState(new Date()).catch(() => undefined);
      }

      return next.pet;
    },
  });

  const acceptDeathMutation = useMutation({
    mutationFn: async () => {
      const current = await projectCurrentLocalPet(new Date());
      if (!current) throw new Error("No active pet");

      const next = applyOfflineAcceptDeath(current, new Date(), premiumAssist);
      await commitLocalPetState(next);

      if (!offlineMode && token) {
        syncLocalPetState(new Date()).catch(() => undefined);
      }

      return null;
    },
  });

  const queueMutation = useMutation({
    mutationFn: async () => {
      if (!token || !pet) throw new Error("No active pet");
      if (offlineMode) {
        throw new ApiError("Battle requires an online connection", 0, "network");
      }

      await syncLocalPetState(new Date());
      return queueBattleDev(token, pet.id);
    },
    onError: (error) => {
      if (isNetworkError(error)) {
        setOfflineMode(true);
      }
    },
  });

  const premiumToggleMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!token || !user) {
        throw new Error("No session");
      }

      const result = await togglePremiumDev(token, enabled);
      await persistStoredSession(result.user, token);
      setSession(result.user, token);
      setPremiumDevEnabled(result.devModeEnabled);
      setOfflineMode(false);
      return result;
    },
    onMutate: () => {
      setPremiumError(null);
    },
    onError: (error) => {
      if (isNetworkError(error)) {
        setOfflineMode(true);
        return;
      }
      setPremiumError(error);
    },
  });

  const handleCare = useCallback(async (
    action: "feed" | "clean" | "play" | "rest",
    startedAt?: number,
    durationMs?: number,
  ) => {
    const current = await projectCurrentLocalPet(new Date());
    if (!current) {
      throw new Error("No active pet");
    }

    const installId = user?.installId ?? await getOrCreateInstallId();
    const completedAt = new Date();
    const next = applyOfflineCareAction({
      current,
      action,
      deviceId: installId,
      premiumAssist,
      startedAt: startedAt ? new Date(startedAt) : completedAt,
      completedAt,
      durationMs: durationMs ?? 0,
    });

    await commitLocalPetState(next);

    if (!offlineMode && token) {
      syncLocalPetState(new Date()).catch(() => undefined);
    }

    return next.pet;
  }, [commitLocalPetState, offlineMode, premiumAssist, projectCurrentLocalPet, syncLocalPetState, token, user?.installId]);

  const handleRefreshPet = useCallback(async () => {
    if (!token) {
      await commitLocalPetState(undefined);
      return null;
    }

    try {
      const refreshedPet = await getMyPet(token);
      setOfflineMode(false);

      if (!refreshedPet) {
        await commitLocalPetState(markLocalPetStateSynced(localPetStateRef.current, new Date()));
        return null;
      }

      await commitLocalPetState(
        markLocalPetStateSynced(localPetStateRef.current, new Date(), refreshedPet),
      );
      return refreshedPet;
    } catch (error) {
      if (isNetworkError(error)) {
        setOfflineMode(true);
        const projected = await projectCurrentLocalPet(new Date());
        return projected?.pet ?? null;
      }
      throw error;
    }
  }, [commitLocalPetState, projectCurrentLocalPet, token]);

  const handleLogout = useCallback(() => {
    setAuthError(null);
    setPremiumError(null);
    setPremiumDevEnabled(false);
    setOfflineMode(false);
    setSyncError(null);
    loginMutation.reset();
    firstPetMutation.reset();
    reviveMutation.reset();
    acceptDeathMutation.reset();
    queueMutation.reset();
    premiumToggleMutation.reset();
    clearStoredSession().catch(() => undefined);
    clearLocalPetState().catch(() => undefined);
    clearSession();
    setLocalPetState(undefined);
    setTab("home");
    setStartupPhase("login");
  }, [
    acceptDeathMutation,
    clearSession,
    firstPetMutation,
    loginMutation,
    premiumToggleMutation,
    queueMutation,
    reviveMutation,
  ]);

  const petTemplate = useMemo(
    () => (pet?.templateId ? getTemplateById(pet.templateId) : undefined),
    [pet],
  );
  const homeShowcaseTemplate = useMemo(
    () => petTemplate ?? PET_TEMPLATES[0],
    [petTemplate],
  );
  const collectionPreview = useMemo(() => PET_TEMPLATES, []);

  const loginStatus: LoginStatus = loginMutation.isPending
    ? "loading"
    : authError
      ? "error"
      : "idle";
  const profileSessionState: ProfileSessionState = user && token ? "active" : "signed-out";
  const profileSaveState: ProfileSaveState = user ? "local-only" : "not-ready";

  return {
    tab,
    setTab,
    startupPhase,
    user,
    token,
    pet,
    language,
    setLanguage,
    petTemplate,
    homeShowcaseTemplate,
    collectionPreview,
    loginStatus,
    profileSessionState,
    profileSaveState,
    authErrorMessage: authError ? getFriendlyApiErrorMessage(authError, language) : undefined,
    firstPetPending: firstPetMutation.isPending,
    firstPetErrorMessage: firstPetMutation.isError
      ? getFriendlyApiErrorMessage(firstPetMutation.error, language)
      : undefined,
    carePending: false,
    revivePending: reviveMutation.isPending,
    acceptDeathPending: acceptDeathMutation.isPending,
    queuePending: queueMutation.isPending,
    queueResult: queueMutation.data,
    apiSummary: getApiEndpointSummary(language),
    premiumDevEnabled,
    premiumTogglePending: premiumToggleMutation.isPending,
    premiumErrorMessage: premiumError ? getPremiumErrorMessage(premiumError, language) : undefined,
    offlineMode,
    syncPending,
    syncErrorMessage: syncError ? getFriendlyApiErrorMessage(syncError, language) : undefined,
    timeIntegrity: localPetState?.timeIntegrity ?? "ok",
    handleLogin: () => loginMutation.mutate(),
    handleLogout,
    handleRefreshPet,
    handleGetFirstPet: (nickname?: string) => firstPetMutation.mutateAsync(nickname),
    handleCare,
    handleTogglePremiumDev: (enabled: boolean) => premiumToggleMutation.mutateAsync(enabled),
    handleRevivePet: () => reviveMutation.mutateAsync(),
    handleAcceptDeath: () => acceptDeathMutation.mutateAsync(),
    handleQueue: () => queueMutation.mutate(),
    resetQueue: () => queueMutation.reset(),
  };
}
