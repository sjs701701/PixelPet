import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { useFonts, PressStart2P_400Regular } from "@expo-google-fonts/press-start-2p";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ElementType, PET_TEMPLATES, getElementAdvantageTier } from "@pixel-pet-arena/shared";
import { PetSprite } from "./components/PetSprite";
import { PixelCard } from "./components/PixelCard";
import { PixelIcon } from "./components/PixelIcon";
import { getCopy, getElementLabel } from "./lib/i18n";
import { performCare, queueBattle, rollInitialPet, signIn } from "./lib/api";
import { AppLanguage, useSessionStore } from "./lib/store";
import { ThemeContext, useTheme } from "./theme/ThemeContext";
import { ThemeColors, ThemeMode, getTheme } from "./theme/colors";

const queryClient = new QueryClient();
const LANGUAGE_KEY = "pixelpet.language";
const THEME_KEY = "pixelpet.theme";
const STAT_THRESHOLD = 30;
const FONT = "PressStart2P_400Regular";
const COOLDOWN_MS = 10000;

type StartupPhase = "splash" | "login" | "app";
type TabKey = "home" | "battle" | "collection" | "profile";

function AppShell() {
  const { c, mode } = useTheme();
  const [tab, setTab] = useState<TabKey>("home");
  const [startupPhase, setStartupPhase] = useState<StartupPhase>("splash");
  const { user, token, pet, petNickname, language, setSession, setPet, setPetNickname, setLanguage } =
    useSessionStore();
  const t = getCopy(language);

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
    const timer = setTimeout(() => setStartupPhase(user ? "app" : "login"), 1400);
    return () => clearTimeout(timer);
  }, [user]);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const session = await signIn("Pixel Trainer", "google");
      setSession(session.user, session.accessToken);
      return session;
    },
    onSuccess: () => {
      setStartupPhase("app");
      setTab("home");
    },
  });

  const firstPetMutation = useMutation({
    mutationFn: async (nickname?: string) => {
      if (!token) throw new Error("No session");
      const firstPet = await rollInitialPet(token);
      setPet(firstPet);
      setPetNickname(nickname?.trim() ? nickname.trim() : undefined);
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
      return queueBattle(token, pet.id);
    },
  });

  const petTemplate = useMemo(
    () => PET_TEMPLATES.find((template) => template.id === pet?.templateId),
    [pet],
  );
  const homeShowcaseTemplate = useMemo(
    () => PET_TEMPLATES.find((template) => template.id === "fire-1") ?? petTemplate,
    [petTemplate],
  );
  const collectionPreview = useMemo(() => PET_TEMPLATES.slice(0, 8), []);

  const tabs: { key: TabKey; label: string }[] = [
    { key: "home", label: t.tabs.home },
    { key: "battle", label: t.tabs.battle },
    { key: "collection", label: t.tabs.collection },
    { key: "profile", label: t.tabs.profile },
  ];

  if (startupPhase === "splash") return <SplashScreen />;
  if (startupPhase === "login") {
    return (
      <LoginScreen
        loading={loginMutation.isPending}
        hasError={loginMutation.isError}
        onLogin={() => loginMutation.mutate()}
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
            petNickname={petNickname}
            petTemplateElement={homeShowcaseTemplate?.element}
            petLevel={pet?.level}
            petExp={pet?.experience}
            careState={pet?.careState}
            firstPetPending={firstPetMutation.isPending}
            firstPetError={firstPetMutation.isError}
            carePending={careMutation.isPending}
            onGetFirstPet={(nickname) => firstPetMutation.mutate(nickname)}
            onCare={(action) => careMutation.mutate(action)}
          />
        ) : null}
        {tab === "battle" ? (
          <BattleTab
            petTemplateName={petTemplate?.name}
            petTemplateElement={petTemplate?.element}
            queuePending={queueMutation.isPending}
            queueResult={queueMutation.data}
            onQueue={() => queueMutation.mutate()}
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
            userName={user?.displayName}
            provider={user?.loginProvider}
            premiumStatus={user?.premiumStatus}
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

/* ───── Login ───── */

function LoginScreen({
  loading,
  hasError,
  onLogin,
}: {
  loading: boolean;
  hasError: boolean;
  onLogin: () => void;
}) {
  const { c, mode } = useTheme();
  const { language } = useSessionStore();
  return (
    <View style={[styles.splashPage, { backgroundColor: c.bg }]}>
      <StatusBar style={mode === "dark" ? "light" : "dark"} />
      <Text style={[styles.splashKicker, { color: c.gray }]}>pixel pet arena</Text>
      <Text style={[styles.loginHeadline, { color: c.text }]}>
        {language === "ko" ? "트레이너 로그인" : "trainer login"}
      </Text>
      <Text style={[styles.loginCopy, { color: c.gray }]}>
        {language === "ko"
          ? "게임 데이터를 연결한 뒤\n홈 화면으로 이동합니다."
          : "link your trainer data\nand enter the home screen."}
      </Text>
      <Pressable style={[styles.enterButton, { borderColor: c.divider }]} onPress={onLogin}>
        <Text style={[styles.enterButtonText, { color: c.text }]}>
          {loading ? (language === "ko" ? "접속 중..." : "connecting...") : "enter"}
        </Text>
      </Pressable>
      {hasError ? (
        <Text style={[styles.errorText, { color: c.accent }]}>
          {language === "ko"
            ? "로그인 실패. 서버를 확인하세요."
            : "login failed. check server."}
        </Text>
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
  firstPetError,
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
  firstPetError: boolean;
  carePending: boolean;
  onGetFirstPet: (nickname?: string) => void;
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
  function handleCancelNickname() { setNicknameOpen(false); setNicknameDraft(""); setNicknameInputKey((v) => v + 1); }
  function handleConfirmFirstPet() { onGetFirstPet(nicknameDraft); setNicknameOpen(false); setNicknameDraft(""); setNicknameInputKey((v) => v + 1); }

  const careActions: { key: "feed" | "clean" | "play" | "rest"; icon: string; label: string }[] = [
    { key: "feed", icon: "feed", label: t.home.feed },
    { key: "clean", icon: "clean", label: t.home.clean },
    { key: "play", icon: "play", label: t.home.play },
    { key: "rest", icon: "rest", label: t.home.rest },
  ];

  return (
    <>
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
            <Text style={[styles.metaValue, { color: c.text, marginTop: 14 }]}>Lv. {petLevel ?? 0}</Text>
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
          {!nicknameOpen ? (
            <Pressable style={[styles.enterButton, { borderColor: c.divider }]} onPress={handleOpenNickname}>
              <Text style={[styles.enterButtonText, { color: c.text }]}>
                {language === "ko" ? "첫 펫 받기" : "get first pet"}
              </Text>
            </Pressable>
          ) : (
            <View style={styles.nicknameBlock}>
              <Text style={[styles.metaLabel, { color: c.gray }]}>
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
              />
              <View style={styles.nicknameActions}>
                <Pressable onPress={handleCancelNickname}>
                  <Text style={[styles.actionTextGray, { color: c.gray }]}>
                    {language === "ko" ? "취소" : "cancel"}
                  </Text>
                </Pressable>
                <Pressable onPress={handleConfirmFirstPet}>
                  <Text style={[styles.actionTextWhite, { color: c.text }]}>
                    {firstPetPending
                      ? (language === "ko" ? "생성 중..." : "rolling...")
                      : (language === "ko" ? "확인" : "confirm")}
                  </Text>
                </Pressable>
              </View>
              {firstPetError ? (
                <Text style={[styles.errorText, { color: c.accent }]}>
                  {language === "ko" ? "첫 펫 생성 실패." : "first pet roll failed."}
                </Text>
              ) : null}
            </View>
          )}
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
    fontSize: 12,
    fontFamily: FONT,
  },
});

/* ───── Battle ───── */

function BattleTab({
  petTemplateName,
  petTemplateElement,
  queuePending,
  queueResult,
  onQueue,
}: {
  petTemplateName?: string;
  petTemplateElement?: ElementType;
  queuePending: boolean;
  queueResult?: { matched: boolean; battleId?: string };
  onQueue: () => void;
}) {
  const { c } = useTheme();
  const { language } = useSessionStore();
  const t = getCopy(language);
  const elements: ElementType[] = ["fire", "water", "grass", "electric", "digital"];
  const fighterLabel = petTemplateName && petTemplateElement
    ? `${petTemplateName} / ${getElementLabel(language, petTemplateElement)}`
    : t.battle.none;

  const elementEmoji: Record<ElementType, string> = {
    fire: "🔥", water: "💧", grass: "🌿", electric: "⚡", digital: "💠",
  };

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
        {queueResult ? (
          <Text style={[styles.battleBody, { color: c.text }]}>
            {queueResult.matched ? t.battle.matched(queueResult.battleId) : t.battle.waiting}
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
                <Text style={styles.elementEmoji}>{elementEmoji[element]}</Text>
                <Text style={[styles.elementNameBig, { color: c.text }]}>{getElementLabel(language, element)}</Text>
              </View>
              <View style={styles.elementAdvantages}>
                <View style={styles.elementAdvCol}>
                  <Text style={[styles.elementAdvLabel, { color: c.gray }]}>{t.battle.strong}</Text>
                  <Text style={styles.elementAdvEmoji}>{strong ? elementEmoji[strong] : "-"}</Text>
                  <Text style={[styles.elementAdvValue, { color: c.text }]}>{strong ? getElementLabel(language, strong) : "-"}</Text>
                </View>
                <View style={styles.elementAdvCol}>
                  <Text style={[styles.elementAdvLabel, { color: c.gray }]}>{t.battle.edge}</Text>
                  <Text style={styles.elementAdvEmoji}>{weak ? elementEmoji[weak] : "-"}</Text>
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
  userName,
  provider,
  premiumStatus,
}: {
  onLanguageChange: (language: AppLanguage) => void;
  userName?: string;
  provider?: string;
  premiumStatus?: string;
}) {
  const { c, mode, toggle } = useTheme();
  const { language } = useSessionStore();
  const t = getCopy(language);
  return (
    <>
      <Text style={[styles.profileTitle, { color: c.text }]}>{t.profile.title}</Text>
      <View style={styles.profileInfo}>
        <ProfileRow label={t.profile.name} value={userName ?? t.profile.defaultName} />
        <ProfileRow label={t.profile.login} value={(provider ?? "google").toUpperCase()} />
        <ProfileRow label={t.profile.pass} value={(premiumStatus ?? "free").toUpperCase()} />
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
      <Text style={[styles.profileSectionLabel, { color: c.grayDark }]}>{t.profile.premiumTitle}</Text>
      <Text style={[styles.profileBody, { color: c.gray }]}>{t.profile.premium1}</Text>
      <Text style={[styles.profileBody, { color: c.gray }]}>{t.profile.premium2}</Text>
      <Text style={[styles.profileBody, { color: c.gray }]}>{t.profile.premium3}</Text>
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
  const [fontsLoaded] = useFonts({ PressStart2P_400Regular });
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
  splashPage: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 4 },
  bottomSpacer: { height: 96 },

  splashKicker: { fontSize: 10, fontFamily: FONT, letterSpacing: 2, marginBottom: 12 },
  splashTitle: { fontSize: 24, fontFamily: FONT, letterSpacing: 4 },

  loginHeadline: { fontSize: 18, fontFamily: FONT, marginTop: 16 },
  loginCopy: { fontSize: 10, fontFamily: FONT, lineHeight: 22, textAlign: "center", maxWidth: 300, marginTop: 8 },
  enterButton: { marginTop: 20, borderWidth: 2, paddingHorizontal: 32, paddingVertical: 14 },
  enterButtonText: { fontSize: 10, fontFamily: FONT, letterSpacing: 2, textTransform: "lowercase" },

  divider: { height: 2 },
  sectionTitle: { fontSize: 14, fontFamily: FONT, letterSpacing: 1 },
  sectionLabel: { fontSize: 10, fontFamily: FONT, letterSpacing: 2, textTransform: "lowercase" },
  bodyText: { fontSize: 10, fontFamily: FONT, lineHeight: 22 },
  bodyMuted: { fontSize: 9, fontFamily: FONT, lineHeight: 20 },

  petInfoRow: { flexDirection: "row", minHeight: 240 },
  petImageArea: { width: "70%", justifyContent: "center", alignItems: "center", paddingVertical: 40 },
  petImageBorder: { position: "absolute", bottom: 0, left: 0, right: 0, height: 2 },
  petMetaArea: { width: "30%", paddingLeft: 16, justifyContent: "center", gap: 6 },
  metaLabel: { fontSize: 11, fontFamily: FONT, textTransform: "lowercase", marginTop: 10 },
  metaValue: { fontSize: 12, fontFamily: FONT },
  metaValueBold: { fontSize: 13, fontFamily: FONT, fontWeight: "700" },
  metaValueItalic: { fontSize: 11, fontFamily: FONT, fontStyle: "italic", textTransform: "lowercase" },

  dotExpRow: { flexDirection: "row", gap: 2, marginTop: 2 },
  dotExpCell: { width: 5, height: 5 },

  emptySection: { gap: 12 },
  emptyHeadline: { fontSize: 16, fontFamily: FONT },
  emptyBody: { fontSize: 10, fontFamily: FONT, lineHeight: 22 },

  nicknameBlock: { gap: 10, marginTop: 8 },
  nicknameInput: { borderBottomWidth: 2, fontSize: 12, fontFamily: FONT, paddingVertical: 8 },
  nicknameActions: { flexDirection: "row", gap: 24 },
  actionTextGray: { fontSize: 10, fontFamily: FONT, textTransform: "lowercase" },
  actionTextWhite: { fontSize: 10, fontFamily: FONT, textTransform: "lowercase" },

  statusSection: { gap: 18 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  statLabel: { width: 80, fontSize: 11, fontFamily: FONT, textTransform: "lowercase" },
  statTrack: { flex: 1, height: 4 },
  statFill: { height: 4 },
  statValue: { width: 36, fontSize: 11, fontFamily: FONT, textAlign: "right" },

  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionButtonWrap: { width: "47%", position: "relative" as const },
  actionButton: { width: "100%", alignItems: "center", paddingVertical: 14, borderWidth: 2 },
  actionButtonDisabled: { opacity: 0.3 },
  actionInner: { alignItems: "center", gap: 8 },
  actionLabel: { fontSize: 9, fontFamily: FONT, textTransform: "lowercase" },

  errorText: { fontSize: 9, fontFamily: FONT, marginTop: 8 },

  battleHeader: { gap: 12 },
  battleTitle: { fontSize: 18, fontFamily: FONT, letterSpacing: 1 },
  battleBody: { fontSize: 12, fontFamily: FONT, lineHeight: 24 },
  battleMuted: { fontSize: 11, fontFamily: FONT, lineHeight: 22 },
  battleBtnText: { fontSize: 12, fontFamily: FONT, letterSpacing: 2, textTransform: "lowercase" },
  battleGridLabel: { fontSize: 13, fontFamily: FONT, letterSpacing: 2, textTransform: "lowercase" },
  elementList: { gap: 12 },
  elementCard: { paddingVertical: 12, borderBottomWidth: 2, gap: 8 },
  elementHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  elementEmoji: { fontSize: 20 },
  elementNameBig: { fontSize: 14, fontFamily: FONT },
  elementAdvantages: { flexDirection: "row", gap: 24, paddingLeft: 30 },
  elementAdvCol: { alignItems: "center", gap: 4 },
  elementAdvLabel: { fontSize: 9, fontFamily: FONT, textTransform: "lowercase" },
  elementAdvEmoji: { fontSize: 16 },
  elementAdvValue: { fontSize: 11, fontFamily: FONT },

  collectionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  collectionItem: { width: "46%", alignItems: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2 },
  collectionName: { fontSize: 10, fontFamily: FONT },
  collectionMeta: { fontSize: 8, fontFamily: FONT, textTransform: "lowercase" },
  collectionMotif: { fontSize: 8, fontFamily: FONT, textAlign: "center", lineHeight: 16 },

  profileTitle: { fontSize: 16, fontFamily: FONT, letterSpacing: 1 },
  profileSectionLabel: { fontSize: 12, fontFamily: FONT, letterSpacing: 2, textTransform: "lowercase" },
  profileBody: { fontSize: 11, fontFamily: FONT, lineHeight: 22 },
  profileInfo: { gap: 8 },
  profileRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 2 },
  profileLabel: { fontSize: 12, fontFamily: FONT, textTransform: "lowercase" },
  profileValue: { fontSize: 12, fontFamily: FONT },
  langRow: { flexDirection: "row", gap: 24 },
  langOption: { fontSize: 10, fontFamily: FONT, paddingVertical: 6 },
  profileOption: { fontSize: 12, fontFamily: FONT, paddingVertical: 6 },

  tabDock: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", borderTopWidth: 2 },
  tabButton: { flex: 1, alignItems: "center", paddingVertical: 20 },
  tabLabel: { fontSize: 13, fontFamily: FONT, letterSpacing: 2, textTransform: "lowercase" },
});
