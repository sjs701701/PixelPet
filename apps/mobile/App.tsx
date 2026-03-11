import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ElementType, PET_TEMPLATES, getElementAdvantageTier } from "@pixel-pet-arena/shared";
import { PetSprite } from "./components/PetSprite";
import { PixelCard } from "./components/PixelCard";
import { PixelIcon } from "./components/PixelIcon";
import { getCopy, getElementLabel } from "./lib/i18n";
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
const COOLDOWN_MS = 10000;

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
    queuePending,
    queueResult,
    apiSummary,
    handleLogin,
    handleLogout,
    handleGetFirstPet,
    handleCare,
    handleQueue,
    resetQueue,
  } = useAppShellState();
  const t = getCopy(language);

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
            petTemplateId={homeShowcaseTemplate?.id}
            petTemplateName={homeShowcaseTemplate?.name}
            petNickname={pet?.nickname}
            petTemplateElement={homeShowcaseTemplate?.element}
            petLevel={pet?.level}
            petExp={pet?.experience}
            careState={pet?.careState}
            firstPetPending={firstPetPending}
            firstPetErrorMessage={firstPetErrorMessage}
            carePending={carePending}
            onGetFirstPet={handleGetFirstPet}
            onCare={handleCare}
          />
        ) : null}
        {tab === "battle" ? (
          <BattleTab
            petTemplateName={petTemplate?.name}
            petTemplateElement={petTemplate?.element}
            petTemplateId={petTemplate?.id}
            queuePending={queuePending}
            queueResult={queueResult}
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
            sessionState={profileSessionState}
            saveState={profileSaveState}
          />
        ) : null}
        <View style={styles.bottomSpacer} />
      </ScrollView>
      <View style={[styles.tabDock, { backgroundColor: c.bg, borderTopColor: c.divider }]}>
        {tabs.map((item) => {
          const active = item.key === tab;
          return (
            <Pressable key={item.key} onPress={() => setTab(item.key)} style={styles.tabButton}>
              <Text style={[styles.tabLabel, { color: active ? c.text : c.grayDark }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
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
      <Pressable
        style={[styles.enterButton, { borderColor: c.divider }, loading && styles.actionButtonDisabled]}
        disabled={loading}
        onPress={onLogin}
      >
        <Text style={[styles.enterButtonText, { color: c.text }]}>
          {loading ? t.auth.connecting : t.auth.enter}
        </Text>
      </Pressable>
      {hasError ? (
        <Text style={[styles.errorText, { color: c.accent }]}>{errorMessage}</Text>
      ) : null}
    </View>
  );
}

/* ───── Home ───── */

function HomeTab({
  petTemplateId,
  petTemplateName,
  petNickname,
  petTemplateElement,
  petLevel,
  petExp,
  careState,
  firstPetPending,
  firstPetErrorMessage,
  carePending,
  onGetFirstPet,
  onCare,
}: {
  petTemplateId?: string;
  petTemplateName?: string;
  petNickname?: string;
  petTemplateElement?: ElementType;
  petLevel?: number;
  petExp?: number;
  careState?: { hunger: number; mood: number; hygiene: number; energy: number; bond: number };
  firstPetPending: boolean;
  firstPetErrorMessage?: string;
  carePending: boolean;
  onGetFirstPet: (nickname?: string) => Promise<unknown>;
  onCare: (action: "feed" | "clean" | "play" | "rest") => void;
}) {
  const { c } = useTheme();
  const { language } = useSessionStore();
  const t = getCopy(language);
  const hasPet = Boolean(petTemplateName && petTemplateElement && careState);
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameInputKey, setNicknameInputKey] = useState(0);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const displayName = petNickname ?? petTemplateName;

  const startCooldown = useCallback((key: string) => {
    const id = Date.now();
    setCooldowns((prev) => ({ ...prev, [key]: id }));
    setTimeout(() => {
      setCooldowns((prev) => (prev[key] === id ? { ...prev, [key]: 0 } : prev));
    }, COOLDOWN_MS);
  }, []);

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

  const careActions: { key: "feed" | "clean" | "play" | "rest"; icon: string; label: string }[] = [
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
            <Text style={[styles.metaLabel, { color: c.gray }]}>
              {language === "ko" ? "종족" : "species"}
            </Text>
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
            <DotExpBar value={petExp ?? 0} />
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
          <Pressable style={[styles.enterButton, { borderColor: c.divider }]} onPress={handleOpenNickname}>
            <Text style={[styles.enterButtonText, { color: c.text }]}>
              {language === "ko" ? "첫 펫 받기" : "get first pet"}
            </Text>
          </Pressable>
          <Modal
            visible={nicknameOpen}
            transparent
            animationType="fade"
            onRequestClose={handleCancelNickname}
          >
            <View style={styles.modalOverlay}>
              <View style={[styles.modalBox, { backgroundColor: c.bg, borderColor: c.divider }]}>
                <Text style={[styles.modalTitle, { color: c.text }]}>
                  {language === "ko" ? "별명 만들기" : "create nickname"}
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
                <Text style={[styles.bodyMuted, { color: c.gray }]}>{t.home.nicknameStep}</Text>
                <View style={styles.nicknameActions}>
                  <Pressable
                    style={[styles.modalButton, { borderColor: c.divider }, firstPetPending && styles.actionButtonDisabled]}
                    disabled={firstPetPending}
                    onPress={handleCancelNickname}
                  >
                    <Text style={[styles.modalButtonText, { color: c.gray }]}>
                      {language === "ko" ? "취소" : "cancel"}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalButton, { borderColor: c.divider }, firstPetPending && styles.actionButtonDisabled]}
                    disabled={firstPetPending}
                    onPress={handleConfirmFirstPet}
                  >
                    <Text style={[styles.modalButtonText, { color: c.text }]}>
                      {firstPetPending
                        ? (language === "ko" ? "생성 중..." : "rolling...")
                        : (language === "ko" ? "확인" : "confirm")}
                    </Text>
                  </Pressable>
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
          const anyCooldown = Object.values(cooldowns).some(Boolean);
          const onCooldown = Boolean(cooldowns[key]);
          const disabled = !hasPet || anyCooldown;
          return (
            <View key={key} style={styles.actionButtonWrap}>
              <Pressable
                style={[styles.actionButton, { borderColor: c.divider }, disabled && styles.actionButtonDisabled]}
                disabled={disabled}
                onPress={() => { onCare(key); startCooldown(key); }}
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
              <CooldownOverlay key={cooldowns[key] || 0} active={onCooldown} duration={COOLDOWN_MS} />
            </View>
          );
        })}
      </View>
    </>
  );
}

/* ───── DotExpBar ───── */

const EXP_DOTS = 10;
const EXP_PER_LEVEL = 100;

function DotExpBar({ value }: { value: number }) {
  const { c } = useTheme();
  const pct = (value % EXP_PER_LEVEL) / EXP_PER_LEVEL;
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
  const isLow = clamped < STAT_THRESHOLD;
  const fillColor = isLow ? c.accent : c.barFill;
  const labelColor = isLow ? c.accent : c.gray;

  return (
    <View style={styles.statRow}>
      <Text style={[styles.statLabel, { color: labelColor }]}>{label}</Text>
      <View style={[styles.statTrack, { backgroundColor: c.barTrack }]}>
        <View style={[styles.statFill, { width: `${clamped}%`, backgroundColor: fillColor }]} />
      </View>
      <Text style={[styles.statValue, { color: isLow ? c.accent : c.text }]}>{clamped}</Text>
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
  userId: string; name: string; element: ElementType; level: number;
  hp: number; maxHp: number; attack: number; defense: number; speed: number;
};
type BattleState = {
  battleId: string;
  turn: number;
  fighters: [BattleFighterInfo, BattleFighterInfo];
  logs: any[];
  result?: { winnerUserId: string; loserUserId: string };
};

function BattleTab({
  petTemplateName,
  petTemplateElement,
  petTemplateId,
  queuePending,
  queueResult,
  onQueue,
  onResetQueue,
  token,
  userId,
}: {
  petTemplateName?: string;
  petTemplateElement?: ElementType;
  petTemplateId?: string;
  queuePending: boolean;
  queueResult?: { matched: boolean; battleId?: string };
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
  const enteredBattleRef = useRef<string | null>(null);

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
    } finally {
      setActionPending(false);
    }
  }

  function handleBackToLobby() {
    enteredBattleRef.current = null;
    setBattleState(null);
    onResetQueue();
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
            <Pressable style={[styles.enterButton, { borderColor: c.divider }]} onPress={handleBackToLobby}>
              <Text style={[styles.battleBtnText, { color: c.text }]}>{t.battle.backToLobby}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={bStyles.actionArea}>
            <Pressable
              style={[bStyles.actionBtn, { borderColor: c.divider }]}
              disabled={actionPending}
              onPress={() => handleAction("attack")}
            >
              <Text style={[bStyles.actionBtnText, { color: c.text }]}>{t.battle.attack}</Text>
            </Pressable>
            <Pressable
              style={[bStyles.actionBtn, { borderColor: c.divider }]}
              disabled={actionPending}
              onPress={() => handleAction("skill")}
            >
              <Text style={[bStyles.actionBtnText, { color: c.text }]}>{t.battle.skill}</Text>
            </Pressable>
            <Pressable
              style={[bStyles.actionBtn, { borderColor: c.divider }]}
              disabled={actionPending}
              onPress={() => handleAction("guard")}
            >
              <Text style={[bStyles.actionBtnText, { color: c.text }]}>{t.battle.guard}</Text>
            </Pressable>
          </View>
        )}

        {/* Battle log */}
        {battleState.logs.length > 0 ? (
          <View style={bStyles.logArea}>
            <Text style={[bStyles.logTitle, { color: c.gray }]}>{t.battle.battleLog}</Text>
            {battleState.logs.map((log: any, i: number) => {
              const isPlayer = log.actorUserId === myId;
              const actorName = isPlayer ? player.name : opponent.name;
              return (
                <Text key={i} style={[bStyles.logEntry, { color: isPlayer ? c.text : c.gray }]}>
                  {actorName}: {log.action === "guard" ? t.battle.guarded : t.battle.dmg(log.damage)}
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
        <Text style={[styles.battleMuted, { color: c.gray }]}>{t.battle.rule}</Text>
        <Pressable
          style={[styles.enterButton, { borderColor: c.divider }, !petTemplateName && styles.actionButtonDisabled]}
          disabled={!petTemplateName}
          onPress={onQueue}
        >
          <Text style={[styles.battleBtnText, { color: c.text }]}>
            {queuePending ? t.battle.matching : t.battle.enterQueue}
          </Text>
        </Pressable>
        {queueResult && !queueResult.matched ? (
          <Text style={[styles.battleBody, { color: c.text }]}>
            {t.battle.waiting}
          </Text>
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
  apiSummary,
  userName,
  provider,
  premiumStatus,
  sessionState,
  saveState,
}: {
  onLanguageChange: (language: AppLanguage) => void;
  onLogout: () => void;
  apiSummary: string;
  userName?: string;
  provider?: string;
  premiumStatus?: string;
  sessionState: ProfileSessionState;
  saveState: ProfileSaveState;
}) {
  const { c, mode, toggle } = useTheme();
  const { language } = useSessionStore();
  const t = getCopy(language);
  const premiumModeLabel = language === "ko" ? "프리미엄 모드" : "PREMIUM MODE";
  const premiumModeValue = premiumStatus === "premium" ? "DEV ON" : "DEV OFF";
  const premiumTitle = language === "ko" ? "프리미엄 프로토타입" : "Premium Prototype";
  const premiumBody1 = language === "ko"
    ? "이 빌드에는 실제 프리미엄 판매나 결제 연결이 없습니다."
    : "This build does not sell premium access or connect to app-store billing.";
  const premiumBody2 = language === "ko"
    ? "내부 테스트에서는 서버의 개발용 토글로만 프리미엄 상태를 잠시 켤 수 있습니다."
    : "Internal testing can only unlock premium through the server-side dev toggle.";
  const premiumBody3 = language === "ko"
    ? "영수증 검증과 실제 구매 흐름은 나중에 따로 붙일 예정입니다."
    : "Receipt verification and real purchase flow are postponed until later.";
  return (
    <>
      <Text style={[styles.profileTitle, { color: c.text }]}>{t.profile.title}</Text>
      <View style={styles.profileInfo}>
        <ProfileRow label={t.profile.name} value={userName ?? t.profile.defaultName} />
        <ProfileRow label={t.profile.login} value={(provider ?? "demo").toUpperCase()} />
        <ProfileRow label={premiumModeLabel} value={premiumModeValue} />
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
          <Text style={[styles.profileOption, { color: c.text }]}>{t.profile.logout}</Text>
        </Pressable>
      </View>

      <View style={[styles.divider, { backgroundColor: c.divider }]} />
      <Text style={[styles.profileSectionLabel, { color: c.grayDark }]}>
        {language === "ko" ? "테마" : "theme"}
      </Text>
      <View style={styles.langRow}>
        <Pressable onPress={toggle}>
          <Text style={[styles.profileOption, { color: c.text }]}>
            {mode === "dark"
              ? (language === "ko" ? "라이트 모드로 전환" : "switch to light")
              : (language === "ko" ? "다크 모드로 전환" : "switch to dark")}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.divider, { backgroundColor: c.divider }]} />
      <Text style={[styles.profileSectionLabel, { color: c.grayDark }]}>{t.profile.settingsTitle}</Text>
      <Text style={[styles.profileBody, { color: c.gray }]}>{t.profile.settingsBody}</Text>
      <View style={styles.langRow}>
        <Pressable onPress={() => onLanguageChange("ko")}>
          <Text style={[styles.profileOption, { color: language === "ko" ? c.text : c.grayDark }]}>
            {t.profile.korean}
          </Text>
        </Pressable>
        <Pressable onPress={() => onLanguageChange("en")}>
          <Text style={[styles.profileOption, { color: language === "en" ? c.text : c.grayDark }]}>
            {t.profile.english}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.divider, { backgroundColor: c.divider }]} />
      <Text style={[styles.profileSectionLabel, { color: c.grayDark }]}>{premiumTitle}</Text>
      <Text style={[styles.profileBody, { color: c.gray }]}>{premiumBody1}</Text>
      <Text style={[styles.profileBody, { color: c.gray }]}>{premiumBody2}</Text>
      <Text style={[styles.profileBody, { color: c.gray }]}>{premiumBody3}</Text>
    </>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={[styles.profileRow, { borderBottomColor: c.divider }]}>
      <Text style={[styles.profileLabel, { color: c.gray }]}>{label}</Text>
      <Text style={[styles.profileValue, { color: c.text }]}>{value}</Text>
    </View>
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
  metaValue: { fontSize: 14, fontFamily: FONT },
  metaValueBold: { fontSize: 14, fontFamily: FONT_BOLD },
  metaValueItalic: { fontSize: 12, fontFamily: FONT, fontStyle: "italic", textTransform: "lowercase" },

  dotExpRow: { flexDirection: "row", gap: 2, marginTop: 2 },
  dotExpCell: { width: 5, height: 5 },

  emptySection: { gap: 12 },
  emptyHeadline: { fontSize: 16, fontFamily: FONT_BOLD },
  emptyBody: { fontSize: 10, fontFamily: FONT, lineHeight: 22 },

  modalOverlay: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.7)", padding: 24 },
  modalBox: { width: "100%", borderWidth: 2, padding: 24, gap: 16 },
  modalTitle: { fontSize: 13, fontFamily: FONT_BOLD, letterSpacing: 1, textAlign: "center" },
  nicknameInput: { borderBottomWidth: 2, fontSize: 12, fontFamily: FONT, paddingVertical: 8 },
  nicknameActions: { flexDirection: "row", gap: 16, justifyContent: "center" },
  modalButton: { flex: 1, borderWidth: 2, paddingVertical: 14, alignItems: "center" },
  modalButtonText: { fontSize: 11, fontFamily: FONT, letterSpacing: 1 },
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
  profileRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 2 },
  profileLabel: { fontSize: 14, fontFamily: FONT, textTransform: "lowercase" },
  profileValue: { fontSize: 14, fontFamily: FONT },
  langRow: { flexDirection: "row", gap: 24 },
  langOption: { fontSize: 12, fontFamily: FONT, paddingVertical: 6 },
  profileOption: { fontSize: 14, fontFamily: FONT, paddingVertical: 6 },

  tabDock: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", borderTopWidth: 2 },
  tabButton: { flex: 1, alignItems: "center", paddingVertical: 20 },
  tabLabel: { fontSize: 14, fontFamily: FONT, letterSpacing: 2, textTransform: "lowercase" },
});
