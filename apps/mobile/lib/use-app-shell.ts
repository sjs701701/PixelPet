import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "@tanstack/react-query";
import { PET_TEMPLATES } from "@pixel-pet-arena/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  acceptPetDeath,
  ApiError,
  getApiEndpointSummary,
  getFriendlyApiErrorMessage,
  getMyPet,
  getPremiumStatus,
  performCare,
  queueBattleDev,
  revivePet,
  rollInitialPet,
  signInDemo,
  togglePremiumDev,
} from "./api";
import {
  clearStoredSession,
  getDemoDisplayName,
  getOrCreateInstallId,
  persistStoredSession,
  readStoredSession,
} from "./auth";
import { AppLanguage, useSessionStore } from "./store";

const LANGUAGE_KEY = "pixelpet.language";
const SPLASH_MS = 1200;
const RESTORE_MS = 350;

export type StartupPhase = "splash" | "restore" | "login" | "app";
export type TabKey = "home" | "battle" | "collection" | "profile";
export type LoginStatus = "idle" | "loading" | "error";
export type ProfileSessionState = "active" | "signed-out";
export type ProfileSaveState = "local-only" | "not-ready";

function isUnauthorizedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

function getPremiumErrorMessage(error: unknown, language: AppLanguage) {
  if (error instanceof ApiError && error.status === 403) {
    return language === "ko"
      ? "개발용 프리미엄 토글이 서버에서 꺼져 있습니다. PIXELPET_PREMIUM_DEV=true 로 서버를 실행해야 합니다."
      : "Premium dev toggle is disabled on the server. Restart the server with PIXELPET_PREMIUM_DEV=true.";
  }

  return getFriendlyApiErrorMessage(error, language);
}

export function useAppShellState() {
  const [tab, setTab] = useState<TabKey>("home");
  const [startupPhase, setStartupPhase] = useState<StartupPhase>("splash");
  const [authError, setAuthError] = useState<unknown>(null);
  const [premiumDevEnabled, setPremiumDevEnabled] = useState(false);
  const [premiumError, setPremiumError] = useState<unknown>(null);
  const { user, token, pet, language, setSession, setPet, setLanguage, clearSession } =
    useSessionStore();

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
      if (cancelled) return;

      if (!storedSession.token || !storedSession.user) {
        if (storedSession.hasStoredSession) {
          await clearStoredSession();
        }
        setAuthError(null);
        clearSession();
        setStartupPhase("login");
        return;
      }

      try {
        const restoredPet = await getMyPet(storedSession.token);
        if (cancelled) return;

        setSession(storedSession.user, storedSession.token);
        if (restoredPet) {
          setPet(restoredPet);
        }

        setTab("home");
        setStartupPhase("app");
      } catch (error) {
        if (cancelled) return;

        if (isUnauthorizedError(error)) {
          await clearStoredSession();
          setAuthError(null);
        } else {
          setAuthError(error);
        }

        clearSession();
        setStartupPhase("login");
      }
    }

    restoreSession().catch(async (error) => {
      if (cancelled) return;
      await clearStoredSession();
      setAuthError(error);
      clearSession();
      setStartupPhase("login");
    });

    return () => {
      cancelled = true;
    };
  }, [clearSession, setPet, setSession, startupPhase]);

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
        setPremiumDevEnabled(false);
        setPremiumError(error);
      });

    return () => {
      cancelled = true;
    };
  }, [setSession, token, user]);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const installId = await getOrCreateInstallId();
      const session = await signInDemo(getDemoDisplayName(installId), installId);
      const currentPet = await getMyPet(session.accessToken);
      await persistStoredSession(session.user, session.accessToken);
      setSession(session.user, session.accessToken);
      if (currentPet) {
        setPet(currentPet);
      }
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
      const firstPet = await rollInitialPet(token, nickname);
      setPet(firstPet);
      return firstPet;
    },
  });

  const careMutation = useMutation({
    mutationFn: async (action: "feed" | "clean" | "play" | "rest") => {
      if (!token || !pet) throw new Error("No active pet");
      const nextPet = await performCare(token, pet.id, action);
      setPet(nextPet);
      return nextPet;
    },
  });

  const reviveMutation = useMutation({
    mutationFn: async () => {
      if (!token || !pet) throw new Error("No active pet");
      const revivedPet = await revivePet(token, pet.id);
      setPet(revivedPet);
      return revivedPet;
    },
  });

  const acceptDeathMutation = useMutation({
    mutationFn: async () => {
      if (!token || !pet) throw new Error("No active pet");
      await acceptPetDeath(token, pet.id);
      setPet(undefined);
      return null;
    },
  });

  const queueMutation = useMutation({
    mutationFn: async () => {
      if (!token || !pet) throw new Error("No active pet");
      return queueBattleDev(token, pet.id);
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
      return result;
    },
    onMutate: () => {
      setPremiumError(null);
    },
    onError: (error) => {
      setPremiumError(error);
    },
  });

  const handleRefreshPet = useCallback(async () => {
    if (!token) {
      setPet(undefined);
      return null;
    }

    const refreshedPet = await getMyPet(token);
    setPet(refreshedPet ?? undefined);
    return refreshedPet;
  }, [setPet, token]);

  const handleLogout = useCallback(() => {
    setAuthError(null);
    setPremiumError(null);
    setPremiumDevEnabled(false);
    loginMutation.reset();
    firstPetMutation.reset();
    careMutation.reset();
    reviveMutation.reset();
    acceptDeathMutation.reset();
    queueMutation.reset();
    premiumToggleMutation.reset();
    clearStoredSession().catch(() => undefined);
    clearSession();
    setTab("home");
    setStartupPhase("login");
  }, [
    acceptDeathMutation,
    careMutation,
    clearSession,
    firstPetMutation,
    loginMutation,
    premiumToggleMutation,
    queueMutation,
    reviveMutation,
  ]);

  const petTemplate = useMemo(
    () => PET_TEMPLATES.find((template) => template.id === pet?.templateId),
    [pet],
  );
  const homeShowcaseTemplate = useMemo(
    () => petTemplate ?? PET_TEMPLATES.find((template) => template.id === "fire-1"),
    [petTemplate],
  );
  const collectionPreview = useMemo(() => PET_TEMPLATES.slice(0, 8), []);

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
    carePending: careMutation.isPending,
    revivePending: reviveMutation.isPending,
    acceptDeathPending: acceptDeathMutation.isPending,
    queuePending: queueMutation.isPending,
    queueResult: queueMutation.data,
    apiSummary: getApiEndpointSummary(language),
    premiumDevEnabled,
    premiumTogglePending: premiumToggleMutation.isPending,
    premiumErrorMessage: premiumError ? getPremiumErrorMessage(premiumError, language) : undefined,
    handleLogin: () => loginMutation.mutate(),
    handleLogout,
    handleRefreshPet,
    handleGetFirstPet: (nickname?: string) => firstPetMutation.mutateAsync(nickname),
    handleCare: (action: "feed" | "clean" | "play" | "rest") => careMutation.mutateAsync(action),
    handleTogglePremiumDev: (enabled: boolean) => premiumToggleMutation.mutateAsync(enabled),
    handleRevivePet: () => reviveMutation.mutateAsync(),
    handleAcceptDeath: () => acceptDeathMutation.mutateAsync(),
    handleQueue: () => queueMutation.mutate(),
    resetQueue: () => queueMutation.reset(),
  };
}
