import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "@tanstack/react-query";
import { PET_TEMPLATES } from "@pixel-pet-arena/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  getApiEndpointSummary,
  getFriendlyApiErrorMessage,
  getMyPet,
  performCare,
  queueBattleDev,
  rollInitialPet,
  signInDemo,
} from "./api";
import {
  clearStoredSession,
  getDemoDisplayName,
  getOrCreateInstallId,
  persistStoredSession,
  readStoredSession,
} from "./auth";
import { useSessionStore } from "./store";

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

export function useAppShellState() {
  const [tab, setTab] = useState<TabKey>("home");
  const [startupPhase, setStartupPhase] = useState<StartupPhase>("splash");
  const [authError, setAuthError] = useState<unknown>(null);
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

  const queueMutation = useMutation({
    mutationFn: async () => {
      if (!token || !pet) throw new Error("No active pet");
      return queueBattleDev(token, pet.id);
    },
  });

  const handleLogout = useCallback(() => {
    setAuthError(null);
    loginMutation.reset();
    firstPetMutation.reset();
    careMutation.reset();
    queueMutation.reset();
    clearStoredSession().catch(() => undefined);
    clearSession();
    setTab("home");
    setStartupPhase("login");
  }, [careMutation, clearSession, firstPetMutation, loginMutation, queueMutation]);

  const petTemplate = useMemo(
    () => PET_TEMPLATES.find((template) => template.id === pet?.templateId),
    [pet],
  );
  const homeShowcaseTemplate = useMemo(
    () => PET_TEMPLATES.find((template) => template.id === "fire-1") ?? petTemplate,
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
    queuePending: queueMutation.isPending,
    queueResult: queueMutation.data,
    apiSummary: getApiEndpointSummary(language),
    handleLogin: () => loginMutation.mutate(),
    handleLogout,
    handleGetFirstPet: (nickname?: string) => firstPetMutation.mutateAsync(nickname),
    handleCare: (action: "feed" | "clean" | "play" | "rest") => careMutation.mutate(action),
    handleQueue: () => queueMutation.mutate(),
    resetQueue: () => queueMutation.reset(),
  };
}
