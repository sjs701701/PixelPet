import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ElementType, PET_TEMPLATES, getElementAdvantageTier } from "@pixel-pet-arena/shared";
import { PetSprite } from "./components/PetSprite";
import { PixelCard } from "./components/PixelCard";
import { getCopy, getElementLabel } from "./lib/i18n";
import { performCare, queueBattle, rollInitialPet, signIn } from "./lib/api";
import { AppLanguage, useSessionStore } from "./lib/store";
import { colors } from "./theme/colors";

const queryClient = new QueryClient();
const LANGUAGE_KEY = "pixelpet.language";

type StartupPhase = "splash" | "login" | "app";
type TabKey = "home" | "battle" | "collection" | "profile";

const elementAccent: Record<ElementType, string> = {
  fire: colors.pixelFire,
  water: colors.pixelWater,
  grass: colors.pixelGrass,
  electric: colors.pixelElectric,
  digital: colors.pixelDigital,
};

function AppShell() {
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
  const collectionPreview = useMemo(() => PET_TEMPLATES.slice(0, 8), []);

  const tabs = [
    { key: "home" as const, label: t.tabs.home },
    { key: "battle" as const, label: t.tabs.battle },
    { key: "collection" as const, label: t.tabs.collection },
    { key: "profile" as const, label: t.tabs.profile },
  ];

  if (startupPhase === "splash") return <SplashScreen language={language} />;
  if (startupPhase === "login") {
    return (
      <LoginScreen
        language={language}
        loading={loginMutation.isPending}
        hasError={loginMutation.isError}
        onLogin={() => loginMutation.mutate()}
      />
    );
  }

  return (
    <View style={styles.page}>
      <StatusBar style="light" />
      <View style={styles.wallpaper} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {tab === "home" ? (
          <HomeTab
            language={language}
            petTemplateId={petTemplate?.id}
            petTemplateName={petTemplate?.name}
            petNickname={petNickname}
            petTemplateElement={petTemplate?.element}
            petLevel={pet?.level}
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
            language={language}
            petTemplateName={petTemplate?.name}
            petTemplateElement={petTemplate?.element}
            queuePending={queueMutation.isPending}
            queueResult={queueMutation.data}
            onQueue={() => queueMutation.mutate()}
          />
        ) : null}
        {tab === "collection" ? (
          <CollectionTab
            language={language}
            currentTemplateId={pet?.templateId}
            collectionPreview={collectionPreview}
          />
        ) : null}
        {tab === "profile" ? (
          <ProfileTab
            language={language}
            onLanguageChange={setLanguage}
            userName={user?.displayName}
            provider={user?.loginProvider}
            premiumStatus={user?.premiumStatus}
          />
        ) : null}
        <View style={styles.bottomSpacer} />
      </ScrollView>
      <View style={styles.tabDock}>
        {tabs.map((item) => {
          const active = item.key === tab;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              style={[styles.tabButton, active && styles.tabButtonActive]}
            >
              <Text style={styles.tabButtonText}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SplashScreen({ language }: { language: AppLanguage }) {
  const t = getCopy(language);
  return (
    <View style={styles.splashPage}>
      <StatusBar style="light" />
      <View style={styles.monitorShell}>
        <View style={styles.monitorFrame}>
          <View style={styles.monitorScreen}>
            <Text style={styles.bootKicker}>{t.hero.kicker}</Text>
            <Text style={styles.bootTitle}>PIXEL PET</Text>
            <Text style={styles.bootTitle}>ARENA</Text>
            <Text style={styles.bootHint}>{language === "ko" ? "시스템 부팅 중..." : "System booting..."}</Text>
          </View>
          <View style={styles.monitorPower}><View style={styles.powerDot} /></View>
        </View>
      </View>
    </View>
  );
}

function LoginScreen({
  language,
  loading,
  hasError,
  onLogin,
}: {
  language: AppLanguage;
  loading: boolean;
  hasError: boolean;
  onLogin: () => void;
}) {
  return (
    <View style={styles.splashPage}>
      <StatusBar style="light" />
      <View style={styles.monitorShell}>
        <View style={styles.monitorFrame}>
          <View style={styles.monitorScreen}>
            <Text style={styles.bootKicker}>PIXEL PET ARENA</Text>
            <Text style={styles.loginHeadline}>{language === "ko" ? "트레이너 로그인" : "Trainer Login"}</Text>
            <Text style={styles.loginCopy}>
              {language === "ko"
                ? "게임 데이터를 연결한 뒤 홈 화면으로 이동합니다."
                : "Link your trainer data and move into the home screen."}
            </Text>
            <Pressable style={styles.arcadeButtonLarge} onPress={onLogin}>
              <Text style={styles.arcadeButtonLargeText}>
                {loading ? (language === "ko" ? "로그인 중..." : "LOGGING IN...") : "ENTER"}
              </Text>
            </Pressable>
            {hasError ? (
              <Text style={styles.errorText}>
                {language === "ko"
                  ? "로그인에 실패했습니다. 서버 연결을 확인하세요."
                  : "Login failed. Check the server connection."}
              </Text>
            ) : null}
          </View>
          <View style={styles.monitorPower}><View style={styles.powerDot} /></View>
        </View>
      </View>
    </View>
  );
}

function HomeTab({
  language,
  petTemplateId,
  petTemplateName,
  petNickname,
  petTemplateElement,
  petLevel,
  careState,
  firstPetPending,
  firstPetError,
  carePending,
  onGetFirstPet,
  onCare,
}: {
  language: AppLanguage;
  petTemplateId?: string;
  petTemplateName?: string;
  petNickname?: string;
  petTemplateElement?: ElementType;
  petLevel?: number;
  careState?: { hunger: number; mood: number; hygiene: number; energy: number; bond: number };
  firstPetPending: boolean;
  firstPetError: boolean;
  carePending: boolean;
  onGetFirstPet: (nickname?: string) => void;
  onCare: (action: "feed" | "clean" | "play" | "rest") => void;
}) {
  const t = getCopy(language);
  const hasPet = Boolean(petTemplateName && petTemplateElement);
  const [nicknameOpen, setNicknameOpen] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [nicknameInputKey, setNicknameInputKey] = useState(0);
  const displayName = petNickname ?? petTemplateName;

  function handleOpenNickname() { setNicknameInputKey((v) => v + 1); setNicknameOpen(true); }
  function handleCancelNickname() { setNicknameOpen(false); setNicknameDraft(""); setNicknameInputKey((v) => v + 1); }
  function handleConfirmFirstPet() { onGetFirstPet(nicknameDraft); setNicknameOpen(false); setNicknameDraft(""); setNicknameInputKey((v) => v + 1); }

  return (
    <>
      <View style={styles.monitorShell}>
        <View style={styles.monitorFrame}>
          <View style={styles.monitorScreenLarge}>
            {hasPet && petTemplateElement && petTemplateName ? (
              <View style={styles.petStage}>
                <View style={styles.petStageHeader}>
                  <Text style={styles.stageLabel}>{getElementLabel(language, petTemplateElement)}</Text>
                  <Text style={styles.stageLabel}>LV {petLevel ?? 0}</Text>
                </View>
                <View style={styles.petStageInner}>
                  <PetSprite
                    element={petTemplateElement}
                    name={displayName ?? petTemplateName}
                    templateId={petTemplateId}
                    size={18}
                  />
                </View>
                <Text style={styles.stageName}>{displayName ?? petTemplateName}</Text>
              </View>
            ) : (
              <View style={styles.petStage}>
                <View style={styles.emptyScreen}>
                  <Text style={styles.emptyHeadline}>{language === "ko" ? "첫 펫을 받으세요" : "Get your first pet"}</Text>
                  <Text style={styles.emptyBody}>
                    {language === "ko"
                      ? "랜덤 스타터 펫을 받고 홈 화면을 활성화하세요."
                      : "Roll a random starter pet and activate your home base."}
                  </Text>
                </View>
                {!nicknameOpen ? (
                  <Pressable style={styles.arcadeButtonLarge} onPress={handleOpenNickname}>
                    <Text style={styles.arcadeButtonLargeText}>{language === "ko" ? "첫 펫 받기" : "GET FIRST PET"}</Text>
                  </Pressable>
                ) : (
                  <View style={styles.nicknameWindow}>
                    <View style={styles.windowTitleBar}><Text style={styles.windowTitle}>{language === "ko" ? "별명 만들기" : "Create Nickname"}</Text></View>
                    <TextInput
                      key={nicknameInputKey}
                      onChangeText={setNicknameDraft}
                      placeholder={language === "ko" ? "예: 장군" : "e.g. General"}
                      placeholderTextColor={colors.bezelShadow}
                      style={styles.nicknameInput}
                      maxLength={12}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <View style={styles.nicknameActionRow}>
                      <Pressable style={styles.arcadeButtonSmall} onPress={handleCancelNickname}><Text style={styles.arcadeButtonSmallText}>{language === "ko" ? "취소" : "CANCEL"}</Text></Pressable>
                      <Pressable style={styles.arcadeButtonSmall} onPress={handleConfirmFirstPet}><Text style={styles.arcadeButtonSmallText}>{firstPetPending ? (language === "ko" ? "생성 중..." : "ROLLING...") : (language === "ko" ? "확인" : "CONFIRM")}</Text></Pressable>
                    </View>
                    {firstPetError ? <Text style={styles.errorText}>{language === "ko" ? "첫 펫 생성에 실패했습니다. 다시 시도하세요." : "First pet roll failed. Try again."}</Text> : null}
                  </View>
                )}
              </View>
            )}
          </View>
          <View style={styles.monitorPower}><View style={styles.powerDot} /></View>
        </View>
      </View>
      <PixelCard title={language === "ko" ? "펫 데이터" : "Pet Data"} accent={colors.gold}>
        <View style={styles.infoBoard}>
          <InfoTile label={language === "ko" ? "속성" : "ELEMENT"} value={petTemplateElement ? getElementLabel(language, petTemplateElement) : "--"} />
          <InfoTile label={language === "ko" ? "이름" : "NAME"} value={petTemplateName ?? "--"} />
          <InfoTile label={language === "ko" ? "별명" : "NICK"} value={displayName ?? "--"} />
          <InfoTile label={language === "ko" ? "레벨" : "LEVEL"} value={String(petLevel ?? 0)} />
        </View>
      </PixelCard>
      <PixelCard title={t.home.careTitle} accent={colors.orange}>
        <View style={styles.meterList}>
          <SegmentMeter label={t.home.hunger} value={careState?.hunger ?? 0} accent={colors.gold} />
          <SegmentMeter label={t.home.mood} value={careState?.mood ?? 0} accent={colors.orange} />
          <SegmentMeter label={t.home.hygiene} value={careState?.hygiene ?? 0} accent={colors.sky} />
          <SegmentMeter label={t.home.energy} value={careState?.energy ?? 0} accent={colors.violet} />
          <SegmentMeter label={t.home.bond} value={careState?.bond ?? 0} accent={colors.red} />
        </View>
        <View style={styles.arcadeButtonGrid}>
          {[
            ["feed", t.home.feed],
            ["clean", t.home.clean],
            ["play", t.home.play],
            ["rest", t.home.rest],
          ].map(([key, label]) => (
            <Pressable
              key={key}
              style={[styles.arcadeButtonMedium, !hasPet && styles.dimmedButton, carePending && styles.dimmedButton]}
              disabled={!hasPet}
              onPress={() => onCare(key as "feed" | "clean" | "play" | "rest")}
            >
              <Text style={styles.arcadeButtonMediumText}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </PixelCard>
    </>
  );
}

function BattleTab({
  language,
  petTemplateName,
  petTemplateElement,
  queuePending,
  queueResult,
  onQueue,
}: {
  language: AppLanguage;
  petTemplateName?: string;
  petTemplateElement?: ElementType;
  queuePending: boolean;
  queueResult?: { matched: boolean; battleId?: string };
  onQueue: () => void;
}) {
  const t = getCopy(language);
  const elements: ElementType[] = ["fire", "water", "grass", "electric", "digital"];
  const fighterLabel = petTemplateName && petTemplateElement
    ? `${petTemplateName} / ${getElementLabel(language, petTemplateElement)}`
    : t.battle.none;

  return (
    <>
      <PixelCard title={t.battle.title} accent={colors.orange}>
        <View style={styles.battleHero}>
          <Text style={styles.infoHeadline}>{t.battle.currentFighter(fighterLabel)}</Text>
          <Text style={styles.infoBody}>{t.battle.rule}</Text>
          <Pressable style={[styles.arcadeButtonLarge, !petTemplateName && styles.dimmedButton]} disabled={!petTemplateName} onPress={onQueue}>
            <Text style={styles.arcadeButtonLargeText}>{queuePending ? t.battle.matching : t.battle.enterQueue}</Text>
          </Pressable>
          {queueResult ? <Text style={styles.successText}>{queueResult.matched ? t.battle.matched(queueResult.battleId) : t.battle.waiting}</Text> : null}
        </View>
      </PixelCard>
      <PixelCard title={t.battle.elementGrid} accent={colors.gold}>
        <View style={styles.matchupList}>
          {elements.map((element) => {
            const strong = elements.find((target) => getElementAdvantageTier(element, target) === "strong");
            const weak = elements.find((target) => getElementAdvantageTier(element, target) === "weak");
            return (
              <View key={element} style={styles.matchupItem}>
                <View style={[styles.matchupBadge, { backgroundColor: elementAccent[element] }]}>
                  <Text style={styles.matchupBadgeText}>{getElementLabel(language, element)}</Text>
                </View>
                <Text style={styles.matchupCopy}>{t.battle.strong} {strong ? getElementLabel(language, strong) : "-"} / {t.battle.edge} {weak ? getElementLabel(language, weak) : "-"}</Text>
              </View>
            );
          })}
        </View>
      </PixelCard>
    </>
  );
}

function CollectionTab({
  language,
  currentTemplateId,
  collectionPreview,
}: {
  language: AppLanguage;
  currentTemplateId?: string;
  collectionPreview: typeof PET_TEMPLATES;
}) {
  const t = getCopy(language);
  return (
    <PixelCard title={t.collection.title} accent={colors.orange}>
      <Text style={styles.infoBody}>{t.collection.body}</Text>
      <View style={styles.collectionGrid}>
        {collectionPreview.map((template) => {
          const active = template.id === currentTemplateId;
          return (
            <View key={template.id} style={[styles.collectionItem, active && styles.collectionItemActive]}>
              <View style={styles.collectionHeader}>
                <Text style={styles.collectionName}>{template.name}</Text>
                <Text style={styles.collectionRarity}>{t.common.rarity[template.rarity]}</Text>
              </View>
              <PetSprite
                element={template.element}
                name={getElementLabel(language, template.element)}
                templateId={template.id}
                size={7}
              />
              <Text style={styles.collectionMotif}>{template.motif}</Text>
            </View>
          );
        })}
      </View>
    </PixelCard>
  );
}

function ProfileTab({
  language,
  onLanguageChange,
  userName,
  provider,
  premiumStatus,
}: {
  language: AppLanguage;
  onLanguageChange: (language: AppLanguage) => void;
  userName?: string;
  provider?: string;
  premiumStatus?: string;
}) {
  const t = getCopy(language);
  return (
    <>
      <PixelCard title={t.profile.title} accent={colors.gold}>
        <View style={styles.infoBoard}>
          <InfoTile label={t.profile.name} value={userName ?? t.profile.defaultName} />
          <InfoTile label={t.profile.login} value={(provider ?? "google").toUpperCase()} />
          <InfoTile label={t.profile.pass} value={(premiumStatus ?? "free").toUpperCase()} />
        </View>
      </PixelCard>
      <PixelCard title={t.profile.settingsTitle} accent={colors.orange}>
        <Text style={styles.infoBody}>{t.profile.settingsBody}</Text>
        <View style={styles.languageToggleRow}>
          <Pressable style={[styles.arcadeButtonMedium, language === "ko" && styles.arcadeButtonMediumActive]} onPress={() => onLanguageChange("ko")}><Text style={styles.arcadeButtonMediumText}>{t.profile.korean}</Text></Pressable>
          <Pressable style={[styles.arcadeButtonMedium, language === "en" && styles.arcadeButtonMediumActive]} onPress={() => onLanguageChange("en")}><Text style={styles.arcadeButtonMediumText}>{t.profile.english}</Text></Pressable>
        </View>
      </PixelCard>
      <PixelCard title={t.profile.premiumTitle} accent={colors.red}>
        <Text style={styles.infoBody}>{t.profile.premium1}</Text>
        <Text style={styles.infoBody}>{t.profile.premium2}</Text>
        <Text style={styles.infoBody}>{t.profile.premium3}</Text>
      </PixelCard>
    </>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoTile}>
      <Text style={styles.infoTileLabel}>{label}</Text>
      <Text style={styles.infoTileValue}>{value}</Text>
    </View>
  );
}

function SegmentMeter({ label, value, accent }: { label: string; value: number; accent: string }) {
  const activeCount = Math.max(0, Math.min(10, Math.round(value / 10)));
  return (
    <View style={styles.segmentRow}>
      <Text style={styles.segmentLabel}>{label}</Text>
      <View style={styles.segmentTrack}>
        {Array.from({ length: 10 }).map((_, index) => (
          <View key={`${label}-${index}`} style={[styles.segmentCell, index < activeCount ? { backgroundColor: accent } : styles.segmentCellOff]} />
        ))}
      </View>
      <Text style={styles.segmentValue}>{value}</Text>
    </View>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  wallpaper: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg },
  content: { paddingHorizontal: 16, paddingTop: 18, gap: 18 },
  splashPage: { flex: 1, backgroundColor: colors.bgDeep, justifyContent: "center", alignItems: "center", padding: 24 },
  monitorShell: { backgroundColor: colors.bezelShadow, paddingRight: 8, paddingBottom: 8 },
  monitorFrame: { width: "100%", borderWidth: 4, borderColor: colors.line, backgroundColor: colors.bezel, padding: 12 },
  monitorScreen: { borderWidth: 4, borderColor: colors.line, backgroundColor: colors.screen, minHeight: 260, justifyContent: "center", alignItems: "center", padding: 20, gap: 8 },
  monitorScreenLarge: { borderWidth: 4, borderColor: colors.line, backgroundColor: colors.screen, padding: 14, gap: 12 },
  monitorPower: { alignSelf: "flex-end", marginTop: 10, width: 28, height: 28, borderWidth: 3, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center" },
  powerDot: { width: 10, height: 10, borderWidth: 2, borderColor: colors.line, backgroundColor: colors.gold },
  bootKicker: { color: colors.ink, fontSize: 13, fontWeight: "900", letterSpacing: 2 },
  bootTitle: { color: colors.ink, fontSize: 34, lineHeight: 36, fontWeight: "900" },
  bootHint: { marginTop: 8, color: colors.panel, fontSize: 13, fontWeight: "700" },
  loginHeadline: { color: colors.ink, fontSize: 28, lineHeight: 30, fontWeight: "900" },
  loginCopy: { color: colors.panel, fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 280 },
  petStage: { gap: 12, alignItems: "center" },
  petStageHeader: { width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  stageLabel: { color: colors.ink, fontSize: 12, fontWeight: "900", backgroundColor: colors.bezelLight, borderWidth: 3, borderColor: colors.line, paddingHorizontal: 8, paddingVertical: 4 },
  petStageInner: { width: "100%", minHeight: 280, borderWidth: 4, borderColor: colors.line, backgroundColor: colors.screen2, justifyContent: "center", alignItems: "center", paddingVertical: 18 },
  stageName: { color: colors.ink, fontSize: 20, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  emptyScreen: { width: "100%", borderWidth: 4, borderColor: colors.line, backgroundColor: colors.screen2, padding: 16, gap: 8 },
  emptyHeadline: { color: colors.ink, fontSize: 24, lineHeight: 28, fontWeight: "900" },
  emptyBody: { color: colors.panel, fontSize: 14, lineHeight: 20, fontWeight: "700" },
  nicknameWindow: { width: "100%", borderWidth: 4, borderColor: colors.line, backgroundColor: colors.bezel, padding: 8, gap: 10 },
  windowTitleBar: { minHeight: 28, borderWidth: 3, borderColor: colors.line, backgroundColor: colors.orange, justifyContent: "center", paddingHorizontal: 10 },
  windowTitle: { color: colors.ink, fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  nicknameInput: { borderWidth: 4, borderColor: colors.line, backgroundColor: colors.screen2, color: colors.ink, fontSize: 16, fontWeight: "800", paddingHorizontal: 12, paddingVertical: 10 },
  nicknameActionRow: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  infoBoard: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  infoTile: { minWidth: 96, flex: 1, borderWidth: 4, borderColor: colors.line, backgroundColor: colors.screen2, padding: 10, gap: 4 },
  infoTileLabel: { color: colors.panel, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  infoTileValue: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  meterList: { gap: 10 },
  segmentRow: { gap: 6 },
  segmentLabel: { color: colors.ink, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  segmentTrack: { flexDirection: "row", gap: 4, borderWidth: 4, borderColor: colors.line, backgroundColor: colors.panel, padding: 4 },
  segmentCell: { flex: 1, height: 14, borderWidth: 2, borderColor: colors.line },
  segmentCellOff: { backgroundColor: colors.bg },
  segmentValue: { color: colors.ink, fontSize: 11, fontWeight: "900", alignSelf: "flex-end" },
  arcadeButtonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  arcadeButtonLarge: { minHeight: 52, borderWidth: 4, borderColor: colors.line, backgroundColor: colors.orange, paddingHorizontal: 18, justifyContent: "center", alignItems: "center", shadowColor: colors.orangeDeep, shadowOpacity: 1, shadowOffset: { width: 4, height: 4 }, shadowRadius: 0 },
  arcadeButtonLargeText: { color: colors.ink, fontSize: 16, fontWeight: "900", letterSpacing: 1 },
  arcadeButtonMedium: { minWidth: 140, flex: 1, minHeight: 48, borderWidth: 4, borderColor: colors.line, backgroundColor: colors.orange, justifyContent: "center", alignItems: "center", paddingHorizontal: 12, shadowColor: colors.orangeDeep, shadowOpacity: 1, shadowOffset: { width: 4, height: 4 }, shadowRadius: 0 },
  arcadeButtonMediumActive: { backgroundColor: colors.gold },
  arcadeButtonMediumText: { color: colors.ink, fontSize: 13, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  arcadeButtonSmall: { flex: 1, minHeight: 42, borderWidth: 4, borderColor: colors.line, backgroundColor: colors.orange, justifyContent: "center", alignItems: "center", paddingHorizontal: 10 },
  arcadeButtonSmallText: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  dimmedButton: { opacity: 0.45 },
  infoHeadline: { color: colors.ink, fontSize: 18, lineHeight: 22, fontWeight: "900" },
  infoBody: { color: colors.ink, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  errorText: { color: colors.red, fontSize: 12, fontWeight: "900" },
  successText: { color: colors.red, fontSize: 12, fontWeight: "900" },
  battleHero: { gap: 12 },
  matchupList: { gap: 10 },
  matchupItem: { borderWidth: 4, borderColor: colors.line, backgroundColor: colors.screen2, padding: 10, gap: 8 },
  matchupBadge: { alignSelf: "flex-start", borderWidth: 3, borderColor: colors.line, paddingHorizontal: 8, paddingVertical: 4 },
  matchupBadgeText: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  matchupCopy: { color: colors.ink, fontSize: 12, fontWeight: "800" },
  collectionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  collectionItem: { width: "47%", borderWidth: 4, borderColor: colors.line, backgroundColor: colors.screen2, padding: 10, gap: 8 },
  collectionItemActive: { backgroundColor: "#dff0b2" },
  collectionHeader: { gap: 2 },
  collectionName: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  collectionRarity: { color: colors.orangeDeep, fontSize: 10, fontWeight: "900" },
  collectionMotif: { color: colors.panel, fontSize: 11, lineHeight: 15, fontWeight: "700" },
  languageToggleRow: { flexDirection: "row", gap: 10 },
  tabDock: { position: "absolute", left: 12, right: 12, bottom: 12, flexDirection: "row", gap: 8 },
  tabButton: { flex: 1, minHeight: 52, borderWidth: 4, borderColor: colors.line, backgroundColor: colors.orange, justifyContent: "center", alignItems: "center", shadowColor: colors.orangeDeep, shadowOpacity: 1, shadowOffset: { width: 4, height: 4 }, shadowRadius: 0 },
  tabButtonActive: { backgroundColor: colors.gold },
  tabButtonText: { color: colors.ink, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  bottomSpacer: { height: 98 },
});
