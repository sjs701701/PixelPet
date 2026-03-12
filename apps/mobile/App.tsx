import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, AppState, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  BaseStats,
  CareAction,
  CareState,
  ElementType,
  PET_TEMPLATES,
  PetGrowthCurveId,
  PetLifeState,
  PetTraitId,
  TimeIntegrityState,
  getBattleStatBlock,
  getElementAdvantageTier,
  getCareActionDurationMs,
  getEvolutionStage,
  getExpRequiredForLevel,
} from "@pixel-pet-arena/shared";
import { PetSprite } from "./components/PetSprite";
import { PixelCard } from "./components/PixelCard";
import { PixelIcon } from "./components/PixelIcon";
import { getCopy, getElementLabel } from "./lib/i18n";
import { formatTimeToDeath, getCriticalReason, getPetLifeCopy } from "./lib/pet-life";
import { getTraitCopy } from "./lib/pet-traits";
import {
  getBattleDetails,
  submitBattleAction,
} from "./lib/api";
import { AppLanguage, useSessionStore } from "./lib/store";
import {
  LoginStatus,
  ProfileSaveState,
  ProfileSessionState,
  TabKey,
  useAppShellState,
} from "./lib/use-app-shell";
import { ThemeContext, useTheme } from "./theme/ThemeContext";
import { ThemeColors, ThemeMode, getTheme } from "./theme/colors";

const queryClient = new QueryClient();
const THEME_KEY = "pixelpet.theme";
const STAT_THRESHOLD = 30;
const FONT = "Mona12";
const FONT_BOLD = "Mona12-Bold";

/** Retro flicker button — blink 2 times then fire onPress */
const FLICKER_STEPS = 4;
const FLICKER_INTERVAL = 40;

type ActiveCareTask = {
  id: number;
  action: CareAction;
  durationMs: number;
  startedAt: number;
  endsAt: number;
  status: "running" | "completing";
};

function FlickerButton({
  onPress,
  disabled,
  style,
  testID,
  hitSlop,
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  style?: any;
  testID?: string;
  hitSlop?: number;
  children: (inverted: boolean) => React.ReactNode;
}) {
  const { c } = useTheme();
  const [inverted, setInverted] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const animatingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current);
    };
  }, []);

  const handlePress = useCallback(() => {
    if (disabled || animatingRef.current) return;
    animatingRef.current = true;
    let count = 0;
    setInverted(true);
    intervalRef.current = setInterval(() => {
      count++;
      if (count >= FLICKER_STEPS) {
        if (intervalRef.current !== null) clearInterval(intervalRef.current);
        intervalRef.current = null;
        setInverted(false);
        animatingRef.current = false;
        onPress?.();
        return;
      }
      setInverted((v) => !v);
    }, FLICKER_INTERVAL) as unknown as number;
  }, [disabled, onPress]);

  return (
    <Pressable
      testID={testID}
      style={[style, inverted ? { backgroundColor: c.text } : undefined]}
      disabled={disabled}
      onPress={handlePress}
      hitSlop={hitSlop}
    >
      {children(inverted)}
    </Pressable>
  );
}

function AppShell() {
  const { c, mode } = useTheme();
  const {
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
    authErrorMessage,
    firstPetPending,
    firstPetErrorMessage,
    carePending,
    revivePending,
    acceptDeathPending,
    queuePending,
    queueResult,
    apiSummary,
    premiumDevEnabled,
    premiumTogglePending,
    premiumErrorMessage,
    offlineMode,
    syncPending,
    syncErrorMessage,
    timeIntegrity,
    handleLogin,
    handleLogout,
    handleRefreshPet,
    handleGetFirstPet,
    handleCare,
    handleTogglePremiumDev,
    handleRevivePet,
    handleAcceptDeath,
    handleQueue,
    resetQueue,
  } = useAppShellState();
  const t = getCopy(language);
  const [dismissedDangerKey, setDismissedDangerKey] = useState<string>();
  const [activeCareTask, setActiveCareTask] = useState<ActiveCareTask>();
  const [pendingCareTab, setPendingCareTab] = useState<TabKey>();
  const [careLeaveModalOpen, setCareLeaveModalOpen] = useState(false);
  const dangerPopupKey = useMemo(() => {
    if (!pet || (pet.lifeState !== "critical" && pet.lifeState !== "dead")) {
      return undefined;
    }

    return `${pet.id}:${pet.lifeState}:${pet.criticalSince ?? ""}:${pet.diedAt ?? ""}`;
  }, [pet]);

  useEffect(() => {
    if (!user?.id || !dangerPopupKey) {
      setDismissedDangerKey(undefined);
    }
  }, [dangerPopupKey, user?.id]);

  useEffect(() => {
    if (startupPhase !== "app" || !pet?.id) {
      setActiveCareTask(undefined);
      setCareLeaveModalOpen(false);
      setPendingCareTab(undefined);
    }
  }, [pet?.id, startupPhase]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState !== "active") {
        setActiveCareTask((current) => (current?.status === "running" ? undefined : current));
        setCareLeaveModalOpen(false);
        setPendingCareTab(undefined);
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!activeCareTask || activeCareTask.status !== "running") {
      return;
    }

    const delay = Math.max(0, activeCareTask.endsAt - Date.now());
    const timeout = setTimeout(() => {
      setActiveCareTask((current) => (
        current?.id === activeCareTask.id
          ? { ...current, status: "completing" }
          : current
      ));

      handleCare(activeCareTask.action, activeCareTask.startedAt, activeCareTask.durationMs)
        .catch(() => undefined)
        .finally(() => {
          setActiveCareTask((current) => (current?.id === activeCareTask.id ? undefined : current));
        });
    }, delay);

    return () => clearTimeout(timeout);
  }, [activeCareTask, handleCare]);

  const careActionLabels = useMemo<Record<CareAction, string>>(() => ({
    feed: t.home.feed,
    clean: t.home.clean,
    play: t.home.play,
    rest: t.home.rest,
  }), [t]);

  const handleStartCare = useCallback((action: CareAction) => {
    if (!pet?.id || activeCareTask || carePending || pet.lifeState === "dead") {
      return;
    }

    const startedAt = Date.now();
    const durationMs = getCareActionDurationMs(action, user?.premiumStatus === "premium");

    setActiveCareTask({
      id: startedAt,
      action,
      durationMs,
      startedAt,
      endsAt: startedAt + durationMs,
      status: "running",
    });
  }, [activeCareTask, carePending, pet?.id, pet?.lifeState, user?.premiumStatus]);

  const handleDismissCareLeave = useCallback(() => {
    setCareLeaveModalOpen(false);
    setPendingCareTab(undefined);
  }, []);

  const handleConfirmCancelAndMove = useCallback(() => {
    const nextTab = pendingCareTab;
    setActiveCareTask(undefined);
    setCareLeaveModalOpen(false);
    setPendingCareTab(undefined);
    if (nextTab) {
      setTab(nextTab);
    }
  }, [pendingCareTab, setTab]);

  const handleTabPress = useCallback((nextTab: TabKey) => {
    if (nextTab === tab) {
      return;
    }

    if (activeCareTask?.status === "running") {
      setPendingCareTab(nextTab);
      setCareLeaveModalOpen(true);
      return;
    }

    setTab(nextTab);
  }, [activeCareTask?.status, setTab, tab]);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "home", label: t.tabs.home },
    { key: "battle", label: t.tabs.battle },
    { key: "collection", label: t.tabs.collection },
    { key: "profile", label: t.tabs.profile },
  ];

  if (startupPhase === "splash") return <SplashScreen />;
  if (startupPhase === "restore") return <RestoreScreen />;
  if (startupPhase === "login") {
    return (
      <LoginScreen
        status={loginStatus}
        errorMessage={authErrorMessage}
        onLogin={handleLogin}
      />
    );
  }

  return (
    <View style={[styles.page, { backgroundColor: c.bg }]}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === "home" ? (
          <HomeTab
            petId={pet?.id}
            petTemplateId={homeShowcaseTemplate?.id}
            petTemplateName={homeShowcaseTemplate?.name}
            petNickname={pet?.nickname}
            petTemplateElement={homeShowcaseTemplate?.element}
            petBaseStats={homeShowcaseTemplate?.baseStats}
            petTraitId={homeShowcaseTemplate?.traitId}
            petGrowthCurveId={homeShowcaseTemplate?.growthCurveId}
            petFlavorText={homeShowcaseTemplate?.flavorText}
            petLifeState={pet?.lifeState}
            petCriticalSince={pet?.criticalSince}
            petFreeRevivesRemaining={pet?.freeRevivesRemaining}
            petLevel={pet?.level}
            petExp={pet?.experience}
            careState={pet?.careState}
            offlineMode={offlineMode}
            syncPending={syncPending}
            syncErrorMessage={syncErrorMessage}
            dangerPopupKey={dangerPopupKey}
            dismissedDangerKey={dismissedDangerKey}
            firstPetPending={firstPetPending}
            firstPetErrorMessage={firstPetErrorMessage}
            carePending={carePending}
            revivePending={revivePending}
            acceptDeathPending={acceptDeathPending}
            activeCareTask={activeCareTask}
            onDismissDangerPopup={(key) => setDismissedDangerKey(key)}
            onGetFirstPet={handleGetFirstPet}
            onStartCare={handleStartCare}
            onRevive={handleRevivePet}
            onAcceptDeath={handleAcceptDeath}
          />
        ) : null}
        {tab === "battle" ? (
          <BattleTab
            petTemplateName={petTemplate?.name}
            petTemplateElement={petTemplate?.element}
            petTemplateId={petTemplate?.id}
            petLifeState={pet?.lifeState}
            petLevel={pet?.level}
            offlineMode={offlineMode}
            syncPending={syncPending}
            syncErrorMessage={syncErrorMessage}
            timeIntegrity={timeIntegrity}
            queuePending={queuePending}
            queueResult={queueResult}
            onRefreshPet={handleRefreshPet}
            onQueue={handleQueue}
            onResetQueue={resetQueue}
            token={token}
            userId={user?.id}
          />
        ) : null}
        {tab === "collection" ? (
          <CollectionTab
            currentTemplateId={pet?.templateId}
            collectionPreview={collectionPreview}
          />
        ) : null}
        {tab === "profile" ? (
          <ProfileTab
            onLanguageChange={setLanguage}
            onLogout={handleLogout}
            apiSummary={apiSummary}
            userName={user?.displayName}
            provider={user?.loginProvider}
            premiumStatus={user?.premiumStatus}
            premiumDevEnabled={premiumDevEnabled}
            premiumTogglePending={premiumTogglePending}
            premiumErrorMessage={premiumErrorMessage}
            sessionState={profileSessionState}
            saveState={profileSaveState}
            onTogglePremiumDev={handleTogglePremiumDev}
          />
        ) : null}
        <View style={styles.bottomSpacer} />
      </ScrollView>
      <View style={[styles.tabDock, { backgroundColor: c.bg, borderTopColor: c.divider }]}>
        {tabs.map((item) => {
          const active = item.key === tab;
          return (
            <Pressable key={item.key} onPress={() => handleTabPress(item.key)} style={styles.tabButton}>
              <Text style={[styles.tabLabel, { color: active ? c.text : c.grayDark }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Modal
        visible={careLeaveModalOpen}
        transparent
        animationType="fade"
        onRequestClose={handleDismissCareLeave}
      >
        <Pressable style={styles.modalOverlay} onPress={handleDismissCareLeave}>
          <Pressable
            style={[styles.modalBox, { backgroundColor: c.bg, borderColor: c.divider }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {(language === "ko"
                ? `이동하면 진행중인 ${activeCareTask ? careActionLabels[activeCareTask.action] : ""} 가 취소됩니다.`
                : `Moving now will cancel the current ${activeCareTask ? careActionLabels[activeCareTask.action].toLowerCase() : "care"} action.`)}
            </Text>
            <View style={styles.nicknameActions}>
              <FlickerButton
                style={[styles.modalButton, { borderColor: c.divider }]}
                onPress={handleDismissCareLeave}
              >
                {(inv) => (
                  <Text style={[styles.modalButtonText, { color: inv ? c.bg : c.gray }]}>
                    {language === "ko" ? "계속 진행" : "keep going"}
                  </Text>
                )}
              </FlickerButton>
              <FlickerButton
                style={[styles.modalButton, { borderColor: c.divider }]}
                onPress={handleConfirmCancelAndMove}
              >
                {(inv) => (
                  <Text style={[styles.modalButtonText, { color: inv ? c.bg : c.text }]}>
                    {language === "ko" ? "취소 후 이동" : "cancel and move"}
                  </Text>
                )}
              </FlickerButton>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ───── Splash ───── */

function SplashScreen() {
  const { c, mode } = useTheme();
  const { language } = useSessionStore();
  return (
    <View style={[styles.splashPage, { backgroundColor: c.bg }]}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Text style={[styles.splashKicker, { color: c.gray }]}>
        {language === "ko" ? "시스템 부팅 중..." : "system booting..."}
      </Text>
      <Text style={[styles.splashTitle, { color: c.text }]}>PIXEL PET</Text>
      <Text style={[styles.splashTitle, { color: c.text }]}>ARENA</Text>
    </View>
  );
}

function RestoreScreen() {
  const { c, mode } = useTheme();
  const { language } = useSessionStore();
  const t = getCopy(language);
  return (
    <View style={[styles.splashPage, { backgroundColor: c.bg }]}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Text style={[styles.splashKicker, { color: c.gray }]}>pixel pet arena</Text>
      <Text style={[styles.loginHeadline, { color: c.text }]}>{t.auth.restoreTitle}</Text>
      <Text style={[styles.loginCopy, { color: c.gray }]}>{t.auth.restoreBody}</Text>
    </View>
  );
}

/* ───── Login ───── */

function LoginScreen({
  status,
  errorMessage,
  onLogin,
}: {
  status: LoginStatus;
  errorMessage?: string;
  onLogin: () => void;
}) {
  const { c, mode } = useTheme();
  const { language } = useSessionStore();
  const t = getCopy(language);
  const loading = status === "loading";
  const hasError = status === "error" && Boolean(errorMessage);
  const statusText =
    status === "loading"
      ? t.auth.statusLoading
      : status === "error"
        ? t.auth.statusError
        : t.auth.statusIdle;
  return (
    <View style={[styles.splashPage, { backgroundColor: c.bg }]}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Text style={[styles.splashKicker, { color: c.gray }]}>pixel pet arena</Text>
      <Text style={[styles.loginHeadline, { color: c.text }]}>{t.auth.title}</Text>
      <Text style={[styles.loginCopy, { color: c.gray }]}>{t.auth.body}</Text>
      <Text style={[styles.sectionLabel, { color: hasError ? c.accent : c.gray }]}>{statusText}</Text>
      <FlickerButton
        style={[styles.enterButton, { borderColor: c.divider }, loading && styles.actionButtonDisabled]}
        disabled={loading}
        onPress={onLogin}
      >
        {(inv) => (
          <Text style={[styles.enterButtonText, { color: inv ? c.bg : c.text }]}>
            {loading ? t.auth.connecting : t.auth.enter}
          </Text>
        )}
      </FlickerButton>
      {hasError ? (
        <Text style={[styles.errorText, { color: c.accent }]}>{errorMessage}</Text>
      ) : null}
    </View>
  );
}

/* ───── Home ───── */

function HomeTab({
  petId,
  petTemplateId,
  petTemplateName,
  petNickname,
  petTemplateElement,
  petBaseStats,
  petTraitId,
  petGrowthCurveId,
  petFlavorText,
  petLifeState,
  petCriticalSince,
  petFreeRevivesRemaining,
  petLevel,
  petExp,
  careState,
  offlineMode,
  syncPending,
  syncErrorMessage,
  dangerPopupKey,
  dismissedDangerKey,
  firstPetPending,
  firstPetErrorMessage,
  carePending,
  revivePending,
  acceptDeathPending,
  activeCareTask,
  onDismissDangerPopup,
  onGetFirstPet,
  onStartCare,
  onRevive,
  onAcceptDeath,
}: {
  petId?: string;
  petTemplateId?: string;
  petTemplateName?: string;
  petNickname?: string;
  petTemplateElement?: ElementType;
  petBaseStats?: BaseStats;
  petTraitId?: PetTraitId;
  petGrowthCurveId?: PetGrowthCurveId;
  petFlavorText?: string;
  petLifeState?: PetLifeState;
  petCriticalSince?: string;
  petFreeRevivesRemaining?: number;
  petLevel?: number;
  petExp?: number;
  careState?: CareState;
  offlineMode: boolean;
  syncPending: boolean;
  syncErrorMessage?: string;
  dangerPopupKey?: string;
  dismissedDangerKey?: string;
  firstPetPending: boolean;
  firstPetErrorMessage?: string;
  carePending: boolean;
  revivePending: boolean;
  acceptDeathPending: boolean;
  activeCareTask?: ActiveCareTask;
  onDismissDangerPopup: (key: string) => void;
  onGetFirstPet: (nickname?: string) => Promise<unknown>;
  onStartCare: (action: CareAction) => void;
  onRevive: () => Promise<unknown>;
  onAcceptDeath: () => Promise<unknown>;
}) {
  const { c } = useTheme();
  const { language } = useSessionStore();
  const t = getCopy(language);
  const hasPet = Boolean(petTemplateName && petTemplateElement && careState);
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [traitInfoOpen, setTraitInfoOpen] = useState(false);
  const [dangerModalOpen, setDangerModalOpen] = useState(false);
  const [dangerNow, setDangerNow] = useState(() => new Date());
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameInputKey, setNicknameInputKey] = useState(0);
  const displayName = petNickname ?? petTemplateName;
  const hasTraitInfo = Boolean(
    hasPet &&
    petTemplateName &&
    petTemplateElement &&
    petBaseStats &&
    petTraitId &&
    petGrowthCurveId,
  );
  const dangerState = petLifeState === "critical" || petLifeState === "dead";
  const requiredExp = getExpRequiredForLevel(petLevel ?? 0);
  const petLifeCopy = getPetLifeCopy(language, petLifeState ?? "alive");
  const traitCopy = getTraitCopy(language, petTraitId);
  const statSectionTitle = language === "ko" ? "기본 전투 스탯" : "base battle stats";
  const traitSectionTitle = language === "ko" ? "재능" : "trait";
  const closeLabel = language === "ko" ? "닫기" : "close";
  const reviveLabel = language === "ko" ? "무료 부활" : "free revive";
  const restartLabel = language === "ko" ? "새로 시작" : "restart";
  const pendingLabel = language === "ko" ? "처리 중..." : "working...";
  const paidReviveLabel = language === "ko" ? "유료 부활 예정" : "paid revive later";
  const remainingReviveLabel = language === "ko" ? "남은 무료 부활권" : "free revives left";
  const timeLeftLabel = language === "ko" ? "사망까지" : "time to death";
  const previewStats = useMemo(() => {
    if (!petBaseStats || !petTraitId || !petGrowthCurveId) {
      return undefined;
    }

    return getBattleStatBlock({
      baseStats: petBaseStats,
      traitId: petTraitId,
      growthCurveId: petGrowthCurveId,
      level: petLevel ?? 0,
      evolutionStage: getEvolutionStage(petLevel ?? 0),
    });
  }, [petBaseStats, petGrowthCurveId, petLevel, petTraitId]);

  const statCards = [
    { key: "hp", label: "HP", value: previewStats?.hp ?? 0 },
    { key: "attack", label: "ATK", value: previewStats?.attack ?? 0 },
    { key: "defense", label: "DEF", value: previewStats?.defense ?? 0 },
    { key: "speed", label: "SPD", value: previewStats?.speed ?? 0 },
  ];

  function handleOpenNickname() { setNicknameInputKey((v) => v + 1); setNicknameOpen(true); }
  function handleCancelNickname() {
    if (firstPetPending) return;
    setNicknameOpen(false);
    setNicknameDraft("");
    setNicknameInputKey((v) => v + 1);
  }
  async function handleConfirmFirstPet() {
    try {
      await onGetFirstPet(nicknameDraft);
      setNicknameOpen(false);
      setNicknameDraft("");
      setNicknameInputKey((v) => v + 1);
    } catch {
      return;
    }
  }

  function handleCloseDangerModal() {
    setDangerModalOpen(false);
    if (dangerPopupKey) {
      onDismissDangerPopup(dangerPopupKey);
    }
  }

  useEffect(() => {
    if (!hasTraitInfo) {
      setTraitInfoOpen(false);
    }
  }, [hasTraitInfo]);

  useEffect(() => {
    if (!dangerState) {
      setDangerModalOpen(false);
      return;
    }

    if (traitInfoOpen || nicknameOpen || !dangerPopupKey || dismissedDangerKey === dangerPopupKey) {
      return;
    }

    setDangerNow(new Date());
    setDangerModalOpen(true);
  }, [dangerPopupKey, dangerState, dismissedDangerKey, nicknameOpen, traitInfoOpen]);

  useEffect(() => {
    if (!dangerModalOpen || petLifeState !== "critical") {
      return;
    }

    const interval = setInterval(() => {
      setDangerNow(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, [dangerModalOpen, petLifeState]);

  const careActions: { key: CareAction; icon: string; label: string }[] = [
    { key: "feed", icon: "feed", label: t.home.feed },
    { key: "clean", icon: "clean", label: t.home.clean },
    { key: "play", icon: "play", label: t.home.play },
    { key: "rest", icon: "rest", label: t.home.rest },
  ];

  return (
    <>
      <Text style={[styles.sectionLabel, { color: c.grayDark }]}>
        {hasPet ? t.home.activePet : t.home.noPet}
      </Text>
      {/* Section 1 — Pet Info */}
      {hasPet && petTemplateElement && petTemplateName ? (
        <View style={styles.petInfoRow}>
          <View style={styles.petImageArea}>
            <PetSprite
              element={petTemplateElement}
              name={displayName ?? petTemplateName}
              templateId={petTemplateId}
              level={petLevel ?? 0}
              size={18}
            />
          </View>
          <View style={styles.petMetaArea}>
            <Text style={[styles.metaLabel, { color: c.gray }]}>
              {language === "ko" ? "속성" : "element"}
            </Text>
            <Text style={[styles.metaValue, { color: c.text }]}>
              {getElementLabel(language, petTemplateElement)}
            </Text>
            <View style={styles.metaLabelRow}>
              <Text style={[styles.metaLabelInline, { color: c.gray }]}>
                {language === "ko" ? "종족" : "species"}
              </Text>
              {hasTraitInfo ? (
                <Pressable
                  testID="pet-trait-info-button"
                  style={({ pressed }) => [styles.infoButton, { borderColor: c.divider }, pressed && { backgroundColor: c.text }]}
                  hitSlop={8}
                  onPress={() => setTraitInfoOpen(true)}
                >
                  {({ pressed }) => (
                    <Text style={[styles.infoButtonText, { color: pressed ? c.bg : c.text }]}>i</Text>
                  )}
                </Pressable>
              ) : null}
            </View>
            <Text style={[styles.metaValueBold, { color: c.text }]}>{petTemplateName}</Text>
            {petNickname ? (
              <>
                <Text style={[styles.metaLabel, { color: c.gray }]}>
                  {language === "ko" ? "이름" : "name"}
                </Text>
                <Text style={[styles.metaValue, { color: c.text }]}>{petNickname}</Text>
              </>
            ) : null}
            <Text style={[styles.metaValueBold, { color: c.text, marginTop: 14 }]}>Lv. {petLevel ?? 0}</Text>
            <DotExpBar value={petExp ?? 0} maxValue={requiredExp} />
            <View style={styles.petStatusRow}>
              {offlineMode ? (
                <Text style={[styles.statusChip, { color: c.accent, borderColor: c.accent }]}>
                  {language === "ko" ? "OFFLINE" : "OFFLINE"}
                </Text>
              ) : null}
              {syncPending ? (
                <Text style={[styles.statusChip, { color: c.gray, borderColor: c.divider }]}>
                  {language === "ko" ? "동기화 대기" : "SYNC PENDING"}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.emptySection}>
          <Text style={[styles.emptyHeadline, { color: c.text }]}>
            {language === "ko" ? "첫 펫을 받으세요" : "get your first pet"}
          </Text>
          <Text style={[styles.emptyBody, { color: c.gray }]}>
            {language === "ko"
              ? "랜덤 스타터 펫을 받고\n홈 화면을 활성화하세요."
              : "roll a random starter pet\nand activate your home base."}
          </Text>
          <Text style={[styles.bodyMuted, { color: c.grayDark }]}>{t.home.firstPetFlow}</Text>
          <FlickerButton style={[styles.enterButton, { borderColor: c.divider }]} onPress={handleOpenNickname}>
            {(inv) => (
              <Text style={[styles.enterButtonText, { color: inv ? c.bg : c.text }]}>
                {language === "ko" ? "첫 펫 받기" : "get first pet"}
              </Text>
            )}
          </FlickerButton>
          <Modal
            visible={nicknameOpen}
            transparent
            animationType="fade"
            onRequestClose={handleCancelNickname}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalBox, { backgroundColor: c.bg, borderColor: c.divider }]}>
                <Text style={[styles.modalTitle, { color: c.text }]}>
                  {language === "ko" ? "이름 지어주기" : "name your pet"}
                </Text>
                <TextInput
                  key={nicknameInputKey}
                  onChangeText={setNicknameDraft}
                  placeholder={language === "ko" ? "예: 장군" : "e.g. general"}
                  placeholderTextColor={c.grayDark}
                  style={[styles.nicknameInput, { borderBottomColor: c.divider, color: c.text }]}
                  maxLength={12}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus
                />
                {/* <Text style={[styles.bodyMuted, { color: c.gray }]}>{t.home.nicknameStep}</Text> */}
                <View style={styles.nicknameActions}>
                  <FlickerButton
                    style={[styles.modalButton, { borderColor: c.divider }, firstPetPending && styles.actionButtonDisabled]}
                    disabled={firstPetPending}
                    onPress={handleCancelNickname}
                  >
                    {(inv) => (
                      <Text style={[styles.modalButtonText, { color: inv ? c.bg : c.gray }]}>
                        {language === "ko" ? "취소" : "cancel"}
                      </Text>
                    )}
                  </FlickerButton>
                  <FlickerButton
                    style={[styles.modalButton, { borderColor: c.divider }, firstPetPending && styles.actionButtonDisabled]}
                    disabled={firstPetPending}
                    onPress={handleConfirmFirstPet}
                  >
                    {(inv) => (
                      <Text style={[styles.modalButtonText, { color: inv ? c.bg : c.text }]}>
                        {firstPetPending
                          ? (language === "ko" ? "생성 중..." : "rolling...")
                          : (language === "ko" ? "확인" : "confirm")}
                      </Text>
                    )}
                  </FlickerButton>
                </View>
                {firstPetErrorMessage ? (
                  <Text style={[styles.errorText, { color: c.accent }]}>
                    {firstPetErrorMessage}
                  </Text>
                ) : null}
              </View>
            </View>
          </Modal>
        </View>
      )}

      {/* Section 2 — Status Bars */}
      <Modal
        visible={traitInfoOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTraitInfoOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setTraitInfoOpen(false)}>
          <Pressable
            testID="pet-trait-modal"
            style={[styles.modalBox, { backgroundColor: c.bg, borderColor: c.divider }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.traitModalTitle, { color: c.text }]}>{petTemplateName}</Text>
            {petTemplateElement ? (
              <Text style={[styles.traitModalSubtitle, { color: c.gray }]}>
                {getElementLabel(language, petTemplateElement)}
              </Text>
            ) : null}

            <View style={styles.modalInfoBlock}>
              <Text style={[styles.modalSectionLabel, { color: c.grayDark }]}>{statSectionTitle}</Text>
              <View style={styles.traitStatsGrid}>
                {statCards.map((stat) => (
                  <View key={stat.key} style={[styles.traitStatCard, { borderColor: c.divider }]}>
                    <Text style={[styles.traitStatLabel, { color: c.gray }]}>{stat.label}</Text>
                    <Text style={[styles.traitStatValue, { color: c.text }]}>{stat.value}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.modalInfoBlock}>
              <Text style={[styles.modalSectionLabel, { color: c.grayDark }]}>{traitSectionTitle}</Text>
              <Text style={[styles.traitName, { color: c.text }]}>{traitCopy.name}</Text>
              <Text style={[styles.traitSummary, { color: c.gray }]}>{traitCopy.summary}</Text>
              <Text style={[styles.traitBattleEffect, { color: c.text }]}>{traitCopy.battleEffect}</Text>
            </View>

            {petFlavorText ? (
              <View style={[styles.traitStoryBox, { borderColor: c.divider, backgroundColor: c.barTrack }]}>
                <Text style={[styles.traitStory, { color: c.gray }]}>{petFlavorText}</Text>
              </View>
            ) : null}

            <FlickerButton
              testID="pet-trait-modal-close"
              style={[styles.modalButtonSingle, { borderColor: c.divider }]}
              onPress={() => setTraitInfoOpen(false)}
            >
              {(inv) => (
                <Text style={[styles.modalButtonText, { color: inv ? c.bg : c.text }]}>{closeLabel}</Text>
              )}
            </FlickerButton>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={dangerModalOpen}
        transparent
        animationType="fade"
        onRequestClose={handleCloseDangerModal}
      >
        <Pressable style={styles.modalOverlay} onPress={handleCloseDangerModal}>
          <Pressable
            style={[styles.modalBox, { backgroundColor: c.bg, borderColor: c.divider }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: c.text }]}>{petLifeCopy.title}</Text>
            <Text style={[styles.modalSubtitle, { color: c.gray }]}>{petLifeCopy.body}</Text>
            {petLifeState === "critical" && careState ? (
              <View style={styles.modalInfoBlock}>
                <Text style={[styles.modalSectionLabel, { color: c.grayDark }]}>{timeLeftLabel}</Text>
                <Text style={[styles.traitName, { color: c.text }]}>
                  {formatTimeToDeath(
                    language,
                    {
                      lifeState: petLifeState,
                      criticalSince: petCriticalSince,
                    },
                    dangerNow,
                  )}
                </Text>
                <Text style={[styles.traitSummary, { color: c.gray }]}>
                  {getCriticalReason(language, { careState })}
                </Text>
              </View>
            ) : null}
            {petLifeState === "dead" ? (
              <View style={styles.modalInfoBlock}>
                <Text style={[styles.modalSectionLabel, { color: c.grayDark }]}>{remainingReviveLabel}</Text>
                <Text style={[styles.traitName, { color: c.text }]}>{petFreeRevivesRemaining ?? 0}</Text>
                {(petFreeRevivesRemaining ?? 0) <= 0 ? (
                  <Text style={[styles.traitSummary, { color: c.gray }]}>{paidReviveLabel}</Text>
                ) : null}
              </View>
            ) : null}
            <View style={styles.dangerActions}>
              {petLifeState === "dead" && (petFreeRevivesRemaining ?? 0) > 0 ? (
                <FlickerButton
                  style={[styles.modalButton, { borderColor: c.divider }, (revivePending || acceptDeathPending) && styles.actionButtonDisabled]}
                  disabled={revivePending || acceptDeathPending}
                  onPress={() => {
                    onRevive().then(handleCloseDangerModal).catch(() => undefined);
                  }}
                >
                  {(inv) => (
                    <Text style={[styles.modalButtonText, { color: inv ? c.bg : c.text }]}>
                      {revivePending ? pendingLabel : reviveLabel}
                    </Text>
                  )}
                </FlickerButton>
              ) : null}
              {petLifeState === "dead" ? (
                <FlickerButton
                  style={[styles.modalButton, { borderColor: c.divider }, (revivePending || acceptDeathPending) && styles.actionButtonDisabled]}
                  disabled={revivePending || acceptDeathPending}
                  onPress={() => {
                    onAcceptDeath().then(handleCloseDangerModal).catch(() => undefined);
                  }}
                >
                  {(inv) => (
                    <Text style={[styles.modalButtonText, { color: inv ? c.bg : c.text }]}>
                      {acceptDeathPending ? pendingLabel : restartLabel}
                    </Text>
                  )}
                </FlickerButton>
              ) : null}
              {petLifeState !== "dead" ? (
                <FlickerButton style={[styles.modalButtonSingle, { borderColor: c.divider }]} onPress={handleCloseDangerModal}>
                  {(inv) => (
                    <Text style={[styles.modalButtonText, { color: inv ? c.bg : c.text }]}>{closeLabel}</Text>
                  )}
                </FlickerButton>
              ) : null}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={[styles.divider, { backgroundColor: c.divider }]} />
      <View style={styles.statusSection}>
        <StatBar label={t.home.hunger} value={careState?.hunger ?? 0} />
        <StatBar label={t.home.mood} value={careState?.mood ?? 0} />
        <StatBar label={t.home.hygiene} value={careState?.hygiene ?? 0} />
        <StatBar label={t.home.energy} value={careState?.energy ?? 0} />
        <StatBar label={t.home.bond} value={careState?.bond ?? 0} />
      </View>

      {/* Section 3 — Action Buttons */}
      <View style={[styles.divider, { backgroundColor: c.divider }]} />
      <View style={styles.actionRow}>
        {careActions.map(({ key, icon, label }) => {
          const isActiveTask = activeCareTask?.action === key && activeCareTask.status === "running";
          const disabled = !hasPet || Boolean(activeCareTask) || carePending || petLifeState === "dead";
          return (
            <View key={key} style={styles.actionButtonWrap}>
              <Pressable
                style={[styles.actionButton, { borderColor: c.divider }, disabled && styles.actionButtonDisabled]}
                disabled={disabled}
                onPress={() => onStartCare(key)}
              >
                {({ pressed }) => (
                  <View style={styles.actionInner}>
                    <PixelIcon name={icon} color={pressed ? c.text : c.gray} size={32} />
                    <Text style={[styles.actionLabel, { color: pressed ? c.text : c.gray }]}>
                      {label}
                    </Text>
                  </View>
                )}
              </Pressable>
              <CooldownOverlay
                key={isActiveTask ? activeCareTask.startedAt : `care-idle-${key}`}
                active={isActiveTask}
                duration={isActiveTask ? activeCareTask.durationMs : 0}
              />
            </View>
          );
        })}
      </View>
    </>
  );
}

/* ───── DotExpBar ───── */

const EXP_DOTS = 10;

function DotExpBar({ value, maxValue }: { value: number; maxValue: number }) {
  const { c } = useTheme();
  const safeMax = Math.max(1, maxValue);
  const pct = Math.max(0, Math.min(1, value / safeMax));
  const filled = Math.round(pct * EXP_DOTS);

  return (
    <View style={styles.dotExpRow}>
      {Array.from({ length: EXP_DOTS }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dotExpCell,
            { backgroundColor: i < filled ? c.text : c.divider },
          ]}
        />
      ))}
    </View>
  );
}

/* ───── StatBar ───── */

function StatBar({ label, value }: { label: string; value: number }) {
  const { c } = useTheme();
  const clamped = Math.max(0, Math.min(100, value));
  const displayValue = Math.round(clamped);
  const isLow = clamped < STAT_THRESHOLD;
  const fillColor = isLow ? c.accent : c.barFill;
  const labelColor = isLow ? c.accent : c.gray;

  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: labelColor }]}>{label}</Text>
      <View style={[styles.statTrack, { backgroundColor: c.barTrack }]}>
        <View style={[styles.statFill, { width: `${clamped}%`, backgroundColor: fillColor }]} />
      </View>
      <Text style={[styles.statValue, { color: isLow ? c.accent : c.text }]}>{displayValue}</Text>
    </View>
  );
}

/* ───── CooldownOverlay ───── */

function CooldownOverlay({ active, duration }: { active: boolean; duration: number }) {
  const { c } = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const [remaining, setRemaining] = useState(0);
  const startRef = useRef(0);

  useEffect(() => {
    if (!active) { setRemaining(0); return; }

    anim.setValue(0);
    startRef.current = Date.now();
    setRemaining(Math.ceil(duration / 1000));

    Animated.timing(anim, {
      toValue: 1,
      duration,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const left = Math.ceil((duration - elapsed) / 1000);
      if (left <= 0) { clearInterval(interval); setRemaining(0); }
      else setRemaining(left);
    }, 200);

    return () => clearInterval(interval);
  }, [active, duration, anim]);

  if (!active) return null;

  const overlayColor = c.bg === "#0A0A0A" ? "rgba(10,10,10,0.7)" : "rgba(245,245,240,0.7)";

  // Clockwise sweep: top-right → bottom-right → bottom-left → top-left
  const q1Opacity = anim.interpolate({ inputRange: [0, 0.25, 1], outputRange: [1, 0, 0] });
  const q2Opacity = anim.interpolate({ inputRange: [0, 0.25, 0.5, 1], outputRange: [1, 1, 0, 0] });
  const q3Opacity = anim.interpolate({ inputRange: [0, 0.5, 0.75, 1], outputRange: [1, 1, 0, 0] });
  const q4Opacity = anim.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] });

  return (
    <View style={cdStyles.container} pointerEvents="none">
      <View style={cdStyles.grid}>
        <Animated.View style={[cdStyles.quadrant, { backgroundColor: overlayColor, opacity: q4Opacity }]} />
        <Animated.View style={[cdStyles.quadrant, { backgroundColor: overlayColor, opacity: q1Opacity }]} />
        <Animated.View style={[cdStyles.quadrant, { backgroundColor: overlayColor, opacity: q3Opacity }]} />
        <Animated.View style={[cdStyles.quadrant, { backgroundColor: overlayColor, opacity: q2Opacity }]} />
      </View>
      <View style={cdStyles.timerWrap}>
        <Text style={[cdStyles.timerText, { color: c.text }]}>{remaining}</Text>
      </View>
    </View>
  );
}

const cdStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  grid: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  quadrant: {
    width: "50%",
    height: "50%",
  },
  timerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  timerText: {
    fontSize: 16,
    fontFamily: FONT_BOLD,
  },
});

/* ───── Battle ───── */

const ELEMENT_EMOJI: Record<ElementType, string> = {
  fire: "🔥", water: "💧", grass: "🌿", electric: "⚡", digital: "💠",
};

type BattleFighterInfo = {
  userId: string;
  name: string;
  element: ElementType;
  level: number;
  lifeState: PetLifeState;
  evolutionStage: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  skillName?: string;
};

type BattleTurnEntry = {
  actorUserId: string;
  action: "attack" | "guard" | "skill";
  damage: number;
  missed: boolean;
};
type BattleState = {
  battleId: string;
  turn: number;
  fighters: [BattleFighterInfo, BattleFighterInfo];
  logs: BattleTurnEntry[];
  result?: { winnerUserId: string; loserUserId: string };
};

function BattleTab({
  petTemplateName,
  petTemplateElement,
  petTemplateId,
  petLifeState,
  petLevel,
  offlineMode,
  syncPending,
  syncErrorMessage,
  timeIntegrity,
  queuePending,
  queueResult,
  onRefreshPet,
  onQueue,
  onResetQueue,
  token,
  userId,
}: {
  petTemplateName?: string;
  petTemplateElement?: ElementType;
  petTemplateId?: string;
  petLifeState?: PetLifeState;
  petLevel?: number;
  offlineMode: boolean;
  syncPending: boolean;
  syncErrorMessage?: string;
  timeIntegrity: TimeIntegrityState;
  queuePending: boolean;
  queueResult?: { matched: boolean; battleId?: string };
  onRefreshPet: () => Promise<unknown>;
  onQueue: () => void;
  onResetQueue: () => void;
  token?: string;
  userId?: string;
}) {
  const { c } = useTheme();
  const { language } = useSessionStore();
  const t = getCopy(language);
  const [battleState, setBattleState] = useState<BattleState | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [queueGate, setQueueGate] = useState<"level-zero" | "critical" | "offline" | "time-integrity">();
  const enteredBattleRef = useRef<string | null>(null);
  const battleLocked = petLifeState === "dead";
  const battleTooYoung = (petLevel ?? 0) <= 0;
  const battleRuleCopy = language === "ko"
    ? "속성 우위와 상태, 스킬 빗맞음이 함께 반영됩니다."
    : "Element advantage, life state, and skill miss chance all affect battle.";

  // Auto-enter battle when matched (only once per battleId)
  useEffect(() => {
    if (queueResult?.matched && queueResult.battleId && token && enteredBattleRef.current !== queueResult.battleId) {
      enteredBattleRef.current = queueResult.battleId;
      getBattleDetails(token, queueResult.battleId).then((data) => {
        setBattleState(data);
      });
    }
  }, [queueResult, token]);

  async function handleAction(action: "attack" | "guard" | "skill") {
    if (!battleState || !token || actionPending) return;
    setActionPending(true);
    try {
      const result = await submitBattleAction(token, battleState.battleId, action);
      setBattleState(result);
      if (result.result) {
        await onRefreshPet();
      }
    } finally {
      setActionPending(false);
    }
  }

  function handleBackToLobby() {
    enteredBattleRef.current = null;
    setBattleState(null);
    onResetQueue();
  }

  function handleQueuePress() {
    if (!petTemplateName || battleLocked) {
      return;
    }

    if (offlineMode) {
      setQueueGate("offline");
      return;
    }

    if (timeIntegrity === "tampered") {
      setQueueGate("time-integrity");
      return;
    }

    if (battleTooYoung) {
      setQueueGate("level-zero");
      return;
    }

    if (petLifeState === "critical") {
      setQueueGate("critical");
      return;
    }

    onQueue();
  }

  function handleDismissQueueGate() {
    setQueueGate(undefined);
  }

  function handleConfirmQueueGate() {
    if (queueGate === "critical") {
      onQueue();
    }
    setQueueGate(undefined);
  }

  // ───── Active Battle Screen ─────
  if (battleState) {
    const myId = userId ?? "";
    const player = battleState.fighters.find((f) => f.userId === myId) ?? battleState.fighters[0];
    const opponent = battleState.fighters.find((f) => f.userId !== myId) ?? battleState.fighters[1];
    const isFinished = !!battleState.result;
    const isWinner = battleState.result?.winnerUserId === myId;
    const playerHpPct = Math.max(0, (player.hp / player.maxHp) * 100);
    const opponentHpPct = Math.max(0, (opponent.hp / opponent.maxHp) * 100);

    function hpBarColor(pct: number) {
      if (pct <= 20) return c.accent;
      if (pct <= 50) return "#FFA500";
      return c.barFill;
    }

    return (
      <>
        {/* Turn indicator */}
        <Text style={[bStyles.turnLabel, { color: c.gray }]}>
          {isFinished
            ? (isWinner ? t.battle.victory : t.battle.defeat)
            : t.battle.turn(battleState.turn)}
        </Text>

        {/* Opponent (top) — Pokemon style: info right-aligned */}
        <View style={bStyles.opponentArea}>
          <View style={bStyles.fighterInfoBox}>
            <View style={bStyles.nameRow}>
              <Text style={[bStyles.fighterName, { color: c.text }]}>{opponent.name}</Text>
              <Text style={[bStyles.elementBadge, { color: c.gray }]}>{ELEMENT_EMOJI[opponent.element]}</Text>
            </View>
            <Text style={[bStyles.levelText, { color: c.gray }]}>Lv.{opponent.level}</Text>
            <View style={bStyles.hpRow}>
              <Text style={[bStyles.hpLabel, { color: c.gray }]}>{t.battle.hp}</Text>
              <View style={[bStyles.hpTrack, { backgroundColor: c.barTrack }]}>
                <View style={[bStyles.hpFill, { width: `${opponentHpPct}%`, backgroundColor: hpBarColor(opponentHpPct) }]} />
              </View>
            </View>
            <Text style={[bStyles.hpNumbers, { color: c.gray }]}>{opponent.hp} / {opponent.maxHp}</Text>
          </View>
        </View>

        {/* VS divider */}
        <View style={bStyles.vsRow}>
          <View style={[bStyles.vsDivider, { backgroundColor: c.divider }]} />
          <Text style={[bStyles.vsText, { color: c.gray }]}>{t.battle.vs}</Text>
          <View style={[bStyles.vsDivider, { backgroundColor: c.divider }]} />
        </View>

        {/* Player (bottom) — Pokemon style: info left-aligned */}
        <View style={bStyles.playerArea}>
          <View style={bStyles.fighterInfoBox}>
            <View style={bStyles.nameRow}>
              <Text style={[bStyles.fighterName, { color: c.text }]}>{player.name}</Text>
              <Text style={[bStyles.elementBadge, { color: c.gray }]}>{ELEMENT_EMOJI[player.element]}</Text>
            </View>
            <Text style={[bStyles.levelText, { color: c.gray }]}>Lv.{player.level}</Text>
            <View style={bStyles.hpRow}>
              <Text style={[bStyles.hpLabel, { color: c.gray }]}>{t.battle.hp}</Text>
              <View style={[bStyles.hpTrack, { backgroundColor: c.barTrack }]}>
                <View style={[bStyles.hpFill, { width: `${playerHpPct}%`, backgroundColor: hpBarColor(playerHpPct) }]} />
              </View>
            </View>
            <Text style={[bStyles.hpNumbers, { color: c.gray }]}>{player.hp} / {player.maxHp}</Text>
          </View>
          {/* Stat chips */}
          <View style={bStyles.statChips}>
            <Text style={[bStyles.statChip, { color: c.gray, borderColor: c.divider }]}>{t.battle.atk} {player.attack}</Text>
            <Text style={[bStyles.statChip, { color: c.gray, borderColor: c.divider }]}>{t.battle.def} {player.defense}</Text>
            <Text style={[bStyles.statChip, { color: c.gray, borderColor: c.divider }]}>{t.battle.spd} {player.speed}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: c.divider }]} />

        {/* Action buttons or result */}
        {isFinished ? (
          <View style={bStyles.resultArea}>
            <Text style={[bStyles.resultText, { color: isWinner ? c.text : c.accent }]}>
              {isWinner ? t.battle.victory : t.battle.defeat}
            </Text>
            <FlickerButton style={[styles.enterButton, { borderColor: c.divider }]} onPress={handleBackToLobby}>
              {(inv) => (
                <Text style={[styles.battleBtnText, { color: inv ? c.bg : c.text }]}>{t.battle.backToLobby}</Text>
              )}
            </FlickerButton>
          </View>
        ) : (
          <View style={bStyles.actionArea}>
            <Pressable
              style={({ pressed }) => [bStyles.actionBtn, { borderColor: c.divider }, pressed && { backgroundColor: c.text }]}
              disabled={actionPending}
              onPress={() => handleAction("attack")}
            >
              {({ pressed }) => (
                <Text style={[bStyles.actionBtnText, { color: pressed ? c.bg : c.text }]}>{t.battle.attack}</Text>
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [bStyles.actionBtn, { borderColor: c.divider }, pressed && { backgroundColor: c.text }]}
              disabled={actionPending}
              onPress={() => handleAction("skill")}
            >
              {({ pressed }) => (
                <Text style={[bStyles.actionBtnText, { color: pressed ? c.bg : c.text }]}>
                  {player.skillName ?? t.battle.skill}
                </Text>
              )}
            </Pressable>
            <Pressable
              style={({ pressed }) => [bStyles.actionBtn, { borderColor: c.divider }, pressed && { backgroundColor: c.text }]}
              disabled={actionPending}
              onPress={() => handleAction("guard")}
            >
              {({ pressed }) => (
                <Text style={[bStyles.actionBtnText, { color: pressed ? c.bg : c.text }]}>{t.battle.guard}</Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Battle log */}
        {battleState.logs.length > 0 ? (
          <View style={bStyles.logArea}>
            <Text style={[bStyles.logTitle, { color: c.gray }]}>{t.battle.battleLog}</Text>
            {battleState.logs.map((log, i) => {
              const isPlayer = log.actorUserId === myId;
              const actorName = isPlayer ? player.name : opponent.name;
              return (
                <Text key={i} style={[bStyles.logEntry, { color: isPlayer ? c.text : c.gray }]}>
                  {actorName}: {
                    log.action === "guard"
                      ? t.battle.guarded
                      : log.missed
                        ? (language === "ko" ? "빗맞음" : "MISS")
                        : t.battle.dmg(log.damage)
                  }
                </Text>
              );
            })}
          </View>
        ) : null}
      </>
    );
  }

  // ───── Battle Lobby ─────
  const elements: ElementType[] = ["fire", "water", "grass", "electric", "digital"];
  const fighterLabel = petTemplateName && petTemplateElement
    ? `${petTemplateName} / ${getElementLabel(language, petTemplateElement)}`
    : t.battle.none;

  return (
    <>
      <View style={styles.battleHeader}>
        <Text style={[styles.battleTitle, { color: c.text }]}>{t.battle.title}</Text>
        <Text style={[styles.battleBody, { color: c.text }]}>{t.battle.currentFighter(fighterLabel)}</Text>
        <Text style={[styles.battleMuted, { color: c.gray }]}>{battleRuleCopy}</Text>
        <FlickerButton
          style={[styles.enterButton, { borderColor: c.divider }, (!petTemplateName || battleLocked || queuePending) && styles.actionButtonDisabled]}
          disabled={!petTemplateName || battleLocked || queuePending}
          onPress={handleQueuePress}
        >
          {(inv) => (
            <Text style={[styles.battleBtnText, { color: inv ? c.bg : c.text }]}>
              {queuePending ? t.battle.matching : t.battle.enterQueue}
            </Text>
          )}
        </FlickerButton>
        {queueResult && !queueResult.matched ? (
          <Text style={[styles.battleBody, { color: c.text }]}>
            {t.battle.waiting}
          </Text>
        ) : null}
        {battleLocked ? (
          <Text style={[styles.battleMuted, { color: c.accent }]}>
            {language === "ko" ? "사망 상태에서는 배틀에 들어갈 수 없습니다." : "Dead pets cannot enter battle."}
          </Text>
        ) : null}
        {!battleLocked && offlineMode ? (
          <Text style={[styles.battleMuted, { color: c.accent }]}>
            {language === "ko"
              ? "배틀은 인터넷 연결 후 이용할 수 있습니다."
              : "Battles are only available while connected to the internet."}
          </Text>
        ) : null}
        {!battleLocked && !offlineMode && syncPending ? (
          <Text style={[styles.battleMuted, { color: c.gray }]}>
            {language === "ko"
              ? "배틀 시작 전에 로컬 펫 상태를 서버와 동기화합니다."
              : "The current pet state will sync before the battle begins."}
          </Text>
        ) : null}
        {!battleLocked && timeIntegrity === "tampered" ? (
          <Text style={[styles.battleMuted, { color: c.accent }]}>
            {language === "ko"
              ? "기기 시간이 비정상적으로 변경되어 배틀이 잠시 제한됩니다. 온라인 동기화 후 다시 시도하세요."
              : "Battle is paused until the device time is validated online."}
          </Text>
        ) : null}
        {!battleLocked && battleTooYoung ? (
          <Text style={[styles.battleMuted, { color: c.gray }]}>
            {language === "ko"
              ? "Lv.1이 되면 배틀에 참여할 수 있습니다."
              : "Reach Lv.1 to enter battle."}
          </Text>
        ) : null}
        {syncErrorMessage ? (
          <Text style={[styles.errorText, { color: c.accent }]}>{syncErrorMessage}</Text>
        ) : null}
      </View>

      <View style={[styles.divider, { backgroundColor: c.divider }]} />
      <Text style={[styles.battleGridLabel, { color: c.grayDark }]}>{t.battle.elementGrid}</Text>
      <View style={styles.elementList}>
        {elements.map((element) => {
          const strong = elements.find((target) => getElementAdvantageTier(element, target) === "strong");
          const weak = elements.find((target) => getElementAdvantageTier(element, target) === "weak");
          return (
            <View key={element} style={[styles.elementCard, { borderBottomColor: c.divider }]}>
              <View style={styles.elementHeader}>
                <Text style={styles.elementEmoji}>{ELEMENT_EMOJI[element]}</Text>
                <Text style={[styles.elementNameBig, { color: c.text }]}>{getElementLabel(language, element)}</Text>
              </View>
              <View style={styles.elementAdvantages}>
                <View style={styles.elementAdvCol}>
                  <Text style={[styles.elementAdvLabel, { color: c.gray }]}>{t.battle.strong}</Text>
                  <Text style={styles.elementAdvEmoji}>{strong ? ELEMENT_EMOJI[strong] : "-"}</Text>
                  <Text style={[styles.elementAdvValue, { color: c.text }]}>{strong ? getElementLabel(language, strong) : "-"}</Text>
                </View>
                <View style={styles.elementAdvCol}>
                  <Text style={[styles.elementAdvLabel, { color: c.gray }]}>{t.battle.edge}</Text>
                  <Text style={styles.elementAdvEmoji}>{weak ? ELEMENT_EMOJI[weak] : "-"}</Text>
                  <Text style={[styles.elementAdvValue, { color: c.text }]}>{weak ? getElementLabel(language, weak) : "-"}</Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>
      <Modal
        visible={Boolean(queueGate)}
        transparent
        animationType="fade"
        onRequestClose={handleDismissQueueGate}
      >
        <Pressable style={styles.modalOverlay} onPress={handleDismissQueueGate}>
          <Pressable
            style={[styles.modalBox, { backgroundColor: c.bg, borderColor: c.divider }]}
            onPress={(event) => event.stopPropagation()}
          >
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {queueGate === "level-zero"
                ? (language === "ko" ? "아직 어려요" : "Too Young")
                : queueGate === "critical"
                  ? (language === "ko" ? "위기 상태" : "Critical State")
                  : queueGate === "offline"
                    ? (language === "ko" ? "오프라인 모드" : "Offline Mode")
                    : (language === "ko" ? "시간 확인 필요" : "Time Check Needed")}
            </Text>
            <Text style={[styles.modalSubtitle, { color: c.gray }]}>
              {queueGate === "level-zero"
                ? (language === "ko"
                  ? "현재 펫은 아직 너무 어려서 배틀에 참여할 수 없습니다. Lv.1이 되면 참여할 수 있습니다."
                  : "This pet is still too young for battle. It can enter once it reaches Lv.1.")
                : queueGate === "critical"
                  ? (language === "ko"
                    ? "현재 펫은 위기 상태라 전투 능력치가 감소합니다. 그래도 배틀을 시작하시겠습니까?"
                    : "This pet is in a critical state, so its battle stats are reduced. Start the battle anyway?")
                  : queueGate === "offline"
                    ? (language === "ko"
                      ? "배틀은 인터넷 연결 후 이용할 수 있습니다."
                      : "Battles are only available while connected to the internet.")
                    : (language === "ko"
                      ? "기기 시간이 비정상적으로 변경되어 배틀이 잠시 제한됩니다. 온라인 동기화 후 다시 시도하세요."
                      : "Battle is paused until the device time is validated online.")}
            </Text>
            <View style={styles.nicknameActions}>
              {queueGate === "critical" ? (
                <>
                  <FlickerButton
                    style={[styles.modalButton, { borderColor: c.divider }]}
                    onPress={handleDismissQueueGate}
                  >
                    {(inv) => (
                      <Text style={[styles.modalButtonText, { color: inv ? c.bg : c.gray }]}>
                        {language === "ko" ? "취소" : "cancel"}
                      </Text>
                    )}
                  </FlickerButton>
                  <FlickerButton
                    style={[styles.modalButton, { borderColor: c.divider }]}
                    onPress={handleConfirmQueueGate}
                  >
                    {(inv) => (
                      <Text style={[styles.modalButtonText, { color: inv ? c.bg : c.text }]}>
                        {language === "ko" ? "계속 진행" : "continue"}
                      </Text>
                    )}
                  </FlickerButton>
                </>
              ) : (
                <FlickerButton
                  style={[styles.modalButtonSingle, { borderColor: c.divider }]}
                  onPress={handleDismissQueueGate}
                >
                  {(inv) => (
                    <Text style={[styles.modalButtonText, { color: inv ? c.bg : c.text }]}>
                      {language === "ko" ? "확인" : "ok"}
                    </Text>
                  )}
                </FlickerButton>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      {syncErrorMessage ? (
        <Text style={[styles.errorText, { color: c.accent }]}>{syncErrorMessage}</Text>
      ) : null}
    </>
  );
}

/* ───── Battle Styles ───── */
const bStyles = StyleSheet.create({
  turnLabel: { fontSize: 12, fontFamily: FONT_BOLD, textAlign: "center", letterSpacing: 2, marginBottom: 8 },
  opponentArea: { alignItems: "flex-end", marginBottom: 16 },
  playerArea: { alignItems: "flex-start", marginTop: 16 },
  fighterInfoBox: { gap: 4, minWidth: 200 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  fighterName: { fontSize: 14, fontFamily: FONT_BOLD },
  elementBadge: { fontSize: 16 },
  levelText: { fontSize: 11, fontFamily: FONT },
  hpRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  hpLabel: { fontSize: 10, fontFamily: FONT_BOLD, width: 24 },
  hpTrack: { flex: 1, height: 8 },
  hpFill: { height: 8 },
  hpNumbers: { fontSize: 10, fontFamily: FONT, textAlign: "right" },
  statChips: { flexDirection: "row", gap: 8, marginTop: 8 },
  statChip: { fontSize: 10, fontFamily: FONT, borderWidth: 2, paddingHorizontal: 8, paddingVertical: 4 },
  vsRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 8 },
  vsDivider: { flex: 1, height: 2 },
  vsText: { fontSize: 16, fontFamily: FONT_BOLD, letterSpacing: 4 },
  actionArea: { flexDirection: "row", gap: 10, marginTop: 16 },
  actionBtn: { flex: 1, borderWidth: 2, paddingVertical: 14, alignItems: "center" },
  actionBtnText: { fontSize: 12, fontFamily: FONT_BOLD, letterSpacing: 1 },
  resultArea: { alignItems: "center", gap: 16, marginTop: 16 },
  resultText: { fontSize: 20, fontFamily: FONT_BOLD, letterSpacing: 2 },
  logArea: { marginTop: 16, gap: 6 },
  logTitle: { fontSize: 11, fontFamily: FONT_BOLD, letterSpacing: 1, marginBottom: 4 },
  logEntry: { fontSize: 10, fontFamily: FONT, lineHeight: 18 },
});

/* ───── Collection ───── */

function CollectionTab({
  currentTemplateId,
  collectionPreview,
}: {
  currentTemplateId?: string;
  collectionPreview: typeof PET_TEMPLATES;
}) {
  const { c } = useTheme();
  const { language } = useSessionStore();
  const t = getCopy(language);
  return (
    <>
      <Text style={[styles.sectionTitle, { color: c.text }]}>{t.collection.title}</Text>
      <Text style={[styles.bodyMuted, { color: c.gray }]}>{t.collection.body}</Text>
      <View style={styles.collectionGrid}>
        {collectionPreview.map((template) => {
          const active = template.id === currentTemplateId;
          return (
            <View key={template.id} style={[styles.collectionItem, { borderBottomColor: active ? c.text : c.divider }]}>
              <PetSprite
                element={template.element}
                name={getElementLabel(language, template.element)}
                templateId={template.id}
                stage={1}
                size={7}
              />
              <Text style={[styles.collectionName, { color: c.text }]}>{template.name}</Text>
              <Text style={[styles.collectionMeta, { color: c.grayDark }]}>{t.common.rarity[template.rarity]}</Text>
              <Text style={[styles.collectionMotif, { color: c.gray }]}>{template.motif}</Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

/* ───── Profile ───── */

function ProfileTab({
  onLanguageChange,
  onLogout,
  onTogglePremiumDev,
  apiSummary,
  userName,
  provider,
  premiumStatus,
  premiumDevEnabled,
  premiumTogglePending,
  premiumErrorMessage,
  sessionState,
  saveState,
}: {
  onLanguageChange: (language: AppLanguage) => void;
  onLogout: () => void;
  onTogglePremiumDev: (enabled: boolean) => Promise<unknown>;
  apiSummary: string;
  userName?: string;
  provider?: string;
  premiumStatus?: string;
  premiumDevEnabled: boolean;
  premiumTogglePending: boolean;
  premiumErrorMessage?: string;
  sessionState: ProfileSessionState;
  saveState: ProfileSaveState;
}) {
  const { c, mode, toggle } = useTheme();
  const { language } = useSessionStore();
  const t = getCopy(language);
  const premiumModeLabel = language === "ko" ? "프리미엄 모드" : "PREMIUM MODE";
  const premiumToggleDisabledLabel = language === "ko"
    ? "서버에서 개발용 프리미엄 토글이 꺼져 있습니다."
    : "The server-side premium dev toggle is disabled.";
  const premiumTitle = language === "ko" ? "프리미엄 프로토타입" : "Premium Prototype";
  const premiumBody1 = language === "ko"
    ? "이 빌드에는 실제 프리미엄 판매나 결제 연결이 없습니다."
    : "This build does not sell premium access or connect to app-store billing.";
  const premiumBody2 = language === "ko"
    ? "테스트 단계에서는 설정 탭에서 바로 프리미엄 개발 모드를 켜고 끌 수 있습니다."
    : "During testing, premium dev mode can be toggled directly from this settings screen.";
  const premiumBody3 = language === "ko"
    ? "영수증 검증과 실제 구매 흐름은 나중에 따로 붙일 예정입니다."
    : "Receipt verification and real purchase flow are postponed until later.";
  return (
    <>
      <Text style={[styles.profileTitle, { color: c.text }]}>{t.profile.title}</Text>
      <View style={styles.profileInfo}>
        <ProfileRow label={t.profile.name} value={userName ?? t.profile.defaultName} />
        <ProfileRow label={t.profile.login} value={(provider ?? "demo").toUpperCase()} />
        <ProfileRow
          label={premiumModeLabel}
          right={(
            <ProfileSwitch
              value={premiumStatus === "premium"}
              disabled={!premiumDevEnabled || premiumTogglePending}
              onToggle={() => {
                onTogglePremiumDev(premiumStatus !== "premium").catch(() => undefined);
              }}
            />
          )}
        />
        <ProfileRow
          label={t.profile.sessionStateLabel}
          value={sessionState === "active" ? t.profile.sessionActive : t.profile.sessionInactive}
        />
        <ProfileRow
          label={t.profile.saveStateLabel}
          value={saveState === "local-only" ? t.profile.saveLocalOnly : t.profile.savePending}
        />
      </View>

      <View style={[styles.divider, { backgroundColor: c.divider }]} />
      <Text style={[styles.profileSectionLabel, { color: c.grayDark }]}>{t.profile.sessionTitle}</Text>
      <Text style={[styles.profileBody, { color: c.gray }]}>{t.profile.sessionBody}</Text>
      <Text style={[styles.profileBody, { color: c.gray }]}>{apiSummary}</Text>
      <View style={styles.langRow}>
        <Pressable onPress={onLogout}>
          {({ pressed }) => (
            <Text style={[styles.profileOption, { color: c.text }, pressed && styles.profileOptionPressed]}>{t.profile.logout}</Text>
          )}
        </Pressable>
      </View>

      <View style={[styles.divider, { backgroundColor: c.divider }]} />
      <Text style={[styles.profileSectionLabel, { color: c.grayDark }]}>
        {language === "ko" ? "테마" : "theme"}
      </Text>
      <View style={styles.langRow}>
        <Pressable onPress={toggle}>
          {({ pressed }) => (
            <Text style={[styles.profileOption, { color: c.text }, pressed && styles.profileOptionPressed]}>
              {mode === "dark"
                ? (language === "ko" ? "라이트 모드로 전환" : "switch to light")
                : (language === "ko" ? "다크 모드로 전환" : "switch to dark")}
            </Text>
          )}
        </Pressable>
      </View>

      <View style={[styles.divider, { backgroundColor: c.divider }]} />
      <Text style={[styles.profileSectionLabel, { color: c.grayDark }]}>{t.profile.settingsTitle}</Text>
      <Text style={[styles.profileBody, { color: c.gray }]}>{t.profile.settingsBody}</Text>
      <View style={styles.langRow}>
        <Pressable onPress={() => onLanguageChange("ko")}>
          {({ pressed }) => (
            <Text style={[styles.profileOption, { color: language === "ko" ? c.text : c.grayDark }, pressed && styles.profileOptionPressed]}>
              {t.profile.korean}
            </Text>
          )}
        </Pressable>
        <Pressable onPress={() => onLanguageChange("en")}>
          {({ pressed }) => (
            <Text style={[styles.profileOption, { color: language === "en" ? c.text : c.grayDark }, pressed && styles.profileOptionPressed]}>
              {t.profile.english}
            </Text>
          )}
        </Pressable>
      </View>

      <View style={[styles.divider, { backgroundColor: c.divider }]} />
      <Text style={[styles.profileSectionLabel, { color: c.grayDark }]}>{premiumTitle}</Text>
      <Text style={[styles.profileBody, { color: c.gray }]}>{premiumBody1}</Text>
      <Text style={[styles.profileBody, { color: c.gray }]}>{premiumBody2}</Text>
      <Text style={[styles.profileBody, { color: c.gray }]}>{premiumBody3}</Text>
      {!premiumDevEnabled ? (
        <Text style={[styles.profileBody, { color: c.gray }]}>{premiumToggleDisabledLabel}</Text>
      ) : null}
      {premiumErrorMessage ? (
        <Text style={[styles.errorText, { color: c.accent }]}>{premiumErrorMessage}</Text>
      ) : null}
    </>
  );
}

function ProfileRow({
  label,
  value,
  right,
}: {
  label: string;
  value?: string;
  right?: React.ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={[styles.profileRow, { borderBottomColor: c.divider }]}>
      <Text style={[styles.profileLabel, { color: c.gray }]}>{label}</Text>
      {right ?? <Text style={[styles.profileValue, { color: c.text }]}>{value}</Text>}
    </View>
  );
}

function ProfileSwitch({
  value,
  disabled,
  onToggle,
}: {
  value: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  const { c } = useTheme();
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(progress, {
      toValue: value ? 1 : 0,
      stiffness: 240,
      damping: 18,
      mass: 0.9,
      overshootClamping: false,
      useNativeDriver: false,
    }).start();
  }, [progress, value]);

  const trackBackgroundColor = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [c.barTrack, c.text],
  });
  const thumbTranslateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 22],
  });
  const thumbScale = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 0.92, 1],
  });

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      onPress={onToggle}
      disabled={disabled}
      style={({ pressed }) => [
        styles.profileSwitch,
        { borderColor: c.divider },
        disabled && styles.actionButtonDisabled,
        pressed && !disabled && styles.profileSwitchPressed,
      ]}
    >
      <Animated.View
        style={[
          styles.profileSwitchTrack,
          {
            backgroundColor: trackBackgroundColor,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.profileSwitchThumb,
            {
              backgroundColor: value ? c.bg : c.text,
              transform: [{ translateX: thumbTranslateX }, { scaleX: thumbScale }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

/* ───── Root ───── */

export default function App() {
  const [fontsLoaded] = useFonts({
    Mona12: require("./assets/fonts/Mona12.ttf"),
    "Mona12-Bold": require("./assets/fonts/Mona12-Bold.ttf"),
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === "dark" || saved === "light") setThemeMode(saved);
    }).catch(() => undefined);
  }, []);

  const toggle = useCallback(() => {
    setThemeMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      AsyncStorage.setItem(THEME_KEY, next).catch(() => undefined);
      return next;
    });
  }, []);

  const themeValue = useMemo(() => ({
    mode: themeMode,
    c: getTheme(themeMode),
    toggle,
  }), [themeMode, toggle]);

  if (!fontsLoaded) return null;

  return (
    <ThemeContext.Provider value={themeValue}>
      <QueryClientProvider client={queryClient}>
        <AppShell />
      </QueryClientProvider>
    </ThemeContext.Provider>
  );
}

/* ───── Styles ───── */

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: { paddingHorizontal: 24, paddingTop: 56, gap: 24 },
  splashPage: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 6 },
  bottomSpacer: { height: 96 },

  splashKicker: { fontSize: 14, fontFamily: FONT, letterSpacing: 2, marginBottom: 16 },
  splashTitle: { fontSize: 32, fontFamily: FONT_BOLD, letterSpacing: 4 },

  loginHeadline: { fontSize: 24, fontFamily: FONT_BOLD, marginTop: 16 },
  loginCopy: { fontSize: 13, fontFamily: FONT, lineHeight: 26, textAlign: "center", maxWidth: 320, marginTop: 10 },
  enterButton: { marginTop: 24, borderWidth: 2, paddingHorizontal: 40, paddingVertical: 16 },
  enterButtonText: { fontSize: 14, fontFamily: FONT, letterSpacing: 2, textTransform: "lowercase" },

  divider: { height: 2 },
  sectionTitle: { fontSize: 14, fontFamily: FONT_BOLD, letterSpacing: 1 },
  sectionLabel: { fontSize: 10, fontFamily: FONT, letterSpacing: 2, textTransform: "lowercase" },
  bodyText: { fontSize: 10, fontFamily: FONT, lineHeight: 22 },
  bodyMuted: { fontSize: 9, fontFamily: FONT, lineHeight: 20 },

  petInfoRow: { flexDirection: "row", minHeight: 240 },
  petImageArea: { width: "70%", justifyContent: "center", alignItems: "center", paddingVertical: 40 },
  petImageBorder: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2 },
  petMetaArea: { width: "30%", paddingLeft: 16, justifyContent: "center", gap: 6 },
  metaLabel: { fontSize: 12, fontFamily: FONT, textTransform: "lowercase", marginTop: 10 },
  metaLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  metaLabelInline: { fontSize: 12, fontFamily: FONT, textTransform: "lowercase" },
  metaValue: { fontSize: 14, fontFamily: FONT },
  metaValueBold: { fontSize: 14, fontFamily: FONT_BOLD },
  metaValueItalic: { fontSize: 12, fontFamily: FONT, fontStyle: "italic", textTransform: "lowercase" },
  infoButton: { width: 20, height: 20, borderWidth: 2, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  infoButtonText: { fontSize: 10, fontFamily: FONT_BOLD, lineHeight: 10, textAlign: "center", textTransform: "lowercase" },
  expMeta: { fontSize: 10, fontFamily: FONT, marginTop: 4 },
  petStatusRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 10 },
  statusChip: { fontSize: 10, fontFamily: FONT_BOLD, borderWidth: 2, paddingHorizontal: 8, paddingVertical: 4 },
  statusLink: { borderWidth: 2, paddingHorizontal: 8, paddingVertical: 4 },
  statusLinkText: { fontSize: 10, fontFamily: FONT, textTransform: "lowercase" },

  dotExpRow: { flexDirection: "row", gap: 2, marginTop: 2 },
  dotExpCell: { width: 5, height: 5 },

  emptySection: { gap: 12 },
  emptyHeadline: { fontSize: 16, fontFamily: FONT_BOLD },
  emptyBody: { fontSize: 10, fontFamily: FONT, lineHeight: 22 },

  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.7)", padding: 24 },
  modalBox: { width: "100%", borderWidth: 2, padding: 24, gap: 16 },
  modalTitle: { fontSize: 13, fontFamily: FONT_BOLD, letterSpacing: 1, textAlign: "center" },
  modalSubtitle: { fontSize: 11, fontFamily: FONT, textAlign: "center", lineHeight: 18 },
  modalInfoBlock: { gap: 10 },
  modalSectionLabel: { fontSize: 10, fontFamily: FONT_BOLD, letterSpacing: 2, textTransform: "lowercase" },
  nicknameInput: { borderBottomWidth: 2, fontSize: 12, fontFamily: FONT, paddingVertical: 8 },
  nicknameActions: { flexDirection: "row", gap: 16, justifyContent: "center" },
  modalButton: { flex: 1, borderWidth: 2, paddingVertical: 14, alignItems: "center" },
  modalButtonSingle: { borderWidth: 2, paddingVertical: 14, alignItems: "center" },
  modalButtonText: { fontSize: 11, fontFamily: FONT, letterSpacing: 1 },
  traitStatsGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12 },
  traitStatCard: { width: "47%", borderWidth: 2, paddingVertical: 10, paddingHorizontal: 12, gap: 6 },
  traitStatLabel: { fontSize: 10, fontFamily: FONT, letterSpacing: 1 },
  traitStatValue: { fontSize: 16, fontFamily: FONT_BOLD },
  traitName: { fontSize: 14, fontFamily: FONT_BOLD },
  traitModalTitle: { fontSize: 14, fontFamily: FONT_BOLD, letterSpacing: 1, textAlign: "center" },
  traitModalSubtitle: { fontSize: 12, fontFamily: FONT, textAlign: "center", lineHeight: 18 },
  traitSummary: { fontSize: 12, fontFamily: FONT, lineHeight: 18 },
  traitBattleEffect: { fontSize: 12, fontFamily: FONT_BOLD, lineHeight: 18 },
  traitStoryBox: { borderWidth: 2, paddingVertical: 14, paddingHorizontal: 12 },
  traitStory: { fontSize: 11, fontFamily: FONT, lineHeight: 18 },
  dangerActions: { flexDirection: "row", gap: 12 },
  actionTextGray: { fontSize: 10, fontFamily: FONT, textTransform: "lowercase" },
  actionTextWhite: { fontSize: 10, fontFamily: FONT, textTransform: "lowercase" },

  statusSection: { gap: 18 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  statLabel: { width: 80, fontSize: 12, fontFamily: FONT, textTransform: "lowercase" },
  statTrack: { flex: 1, height: 8 },
  statFill: { height: 8 },
  statValue: { width: 36, fontSize: 14, fontFamily: FONT, textAlign: "right" },

  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionButtonWrap: { width: "47%", position: "relative" as const },
  actionButton: { width: "100%", alignItems: "center", paddingVertical: 14, borderWidth: 2 },
  actionButtonDisabled: { opacity: 0.3 },
  actionInner: { alignItems: "center", gap: 8 },
  actionLabel: { fontSize: 12, fontFamily: FONT, textTransform: "lowercase" },

  errorText: { fontSize: 9, fontFamily: FONT, marginTop: 8 },

  battleHeader: { gap: 12 },
  battleTitle: { fontSize: 18, fontFamily: FONT_BOLD, letterSpacing: 1 },
  battleBody: { fontSize: 12, fontFamily: FONT, lineHeight: 24 },
  battleMuted: { fontSize: 11, fontFamily: FONT, lineHeight: 22 },
  battleBtnText: { fontSize: 12, fontFamily: FONT, letterSpacing: 2, textTransform: "lowercase" },
  battleGridLabel: { fontSize: 13, fontFamily: FONT, letterSpacing: 2, textTransform: "lowercase" },
  elementList: { gap: 12 },
  elementCard: { paddingVertical: 12, borderBottomWidth: 2, gap: 8 },
  elementHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  elementEmoji: { fontSize: 20 },
  elementNameBig: { fontSize: 14, fontFamily: FONT_BOLD },
  elementAdvantages: { flexDirection: "row", gap: 24, paddingLeft: 30 },
  elementAdvCol: { alignItems: "center", gap: 4 },
  elementAdvLabel: { fontSize: 9, fontFamily: FONT, textTransform: "lowercase" },
  elementAdvEmoji: { fontSize: 16 },
  elementAdvValue: { fontSize: 11, fontFamily: FONT },

  collectionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  collectionItem: { width: "46%", alignItems: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2 },
  collectionName: { fontSize: 12, fontFamily: FONT },
  collectionMeta: { fontSize: 10, fontFamily: FONT, textTransform: "lowercase" },
  collectionMotif: { fontSize: 10, fontFamily: FONT, textAlign: "center", lineHeight: 18 },

  profileTitle: { fontSize: 18, fontFamily: FONT_BOLD, letterSpacing: 1 },
  profileSectionLabel: { fontSize: 14, fontFamily: FONT, letterSpacing: 2, textTransform: "lowercase" },
  profileBody: { fontSize: 13, fontFamily: FONT, lineHeight: 24 },
  profileInfo: { gap: 8 },
  profileRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6, borderBottomWidth: 2 },
  profileLabel: { fontSize: 14, fontFamily: FONT, textTransform: "lowercase" },
  profileValue: { fontSize: 14, fontFamily: FONT },
  profileSwitch: {
    width: 52,
    height: 28,
    borderWidth: 2,
    borderRadius: 999,
    padding: 2,
  },
  profileSwitchTrack: {
    flex: 1,
    borderRadius: 999,
    justifyContent: "center",
  },
  profileSwitchPressed: { transform: [{ scale: 0.98 }] },
  profileSwitchThumb: {
    width: 20,
    height: 20,
    borderRadius: 999,
  },
  langRow: { flexDirection: "row", gap: 24 },
  langOption: { fontSize: 12, fontFamily: FONT, paddingVertical: 6 },
  profileOption: { fontSize: 14, fontFamily: FONT, paddingVertical: 6 },
  profileOptionPressed: { textDecorationLine: "underline" as const },

  tabDock: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", borderTopWidth: 2 },
  tabButton: { flex: 1, alignItems: "center", paddingVertical: 20 },
  tabLabel: { fontSize: 14, fontFamily: FONT, letterSpacing: 2, textTransform: "lowercase" },
});
