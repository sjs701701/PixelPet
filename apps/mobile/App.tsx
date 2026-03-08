import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ELEMENT_LABELS, getElementAdvantageTier, PET_TEMPLATES } from "@pixel-pet-arena/shared";
import { PixelCard } from "./components/PixelCard";
import { PetSprite } from "./components/PetSprite";
import { performCare, queueBattle, rollInitialPet, signIn } from "./lib/api";
import { useSessionStore } from "./lib/store";
import { colors } from "./theme/colors";

const queryClient = new QueryClient();

const premiumFeatures = [
  "Dot skins, battle backgrounds, profile frames",
  "Replay archive",
  "Auto care assist",
];

function HomeScreen() {
  const { user, token, pet, setSession, setPet } = useSessionStore();

  const signInMutation = useMutation({
    mutationFn: async () => {
      const session = await signIn("Pixel Trainer", "google");
      setSession(session.user, session.accessToken);
      const firstPet = await rollInitialPet(session.accessToken);
      setPet(firstPet);
      return firstPet;
    },
  });

  const careMutation = useMutation({
    mutationFn: async (action: "feed" | "clean" | "play" | "rest") => {
      if (!token || !pet) {
        throw new Error("No active pet");
      }
      const nextPet = await performCare(token, pet.id, action);
      setPet(nextPet);
      return nextPet;
    },
  });

  const queueMutation = useMutation({
    mutationFn: async () => {
      if (!token || !pet) {
        throw new Error("No active pet");
      }
      return queueBattle(token, pet.id);
    },
  });

  const petTemplate = useMemo(
    () => PET_TEMPLATES.find((template) => template.id === pet?.templateId),
    [pet],
  );

  return (
    <LinearGradient colors={[colors.sky, colors.navy, colors.ink]} style={styles.page}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>PIXEL PET ARENA</Text>
          <Text style={styles.headline}>Random Pixel Tamagotchi Battle</Text>
          <Text style={styles.subhead}>
            5 elements, 60 pets, live PvP, fair free and premium rules
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => signInMutation.mutate()}>
            <Text style={styles.primaryButtonText}>
              {signInMutation.isPending
                ? "Loading..."
                : user
                  ? "Refresh Session"
                  : "Login + Get First Pet"}
            </Text>
          </Pressable>
          {signInMutation.isError ? (
            <Text style={styles.warningText}>Login failed. Check if the server is running.</Text>
          ) : null}
        </View>

        <PixelCard title="My Pet" accent={colors.coral}>
          {pet && petTemplate ? (
            <View style={styles.petPanel}>
              <PetSprite element={petTemplate.element} name={petTemplate.name} />
              <View style={styles.petMeta}>
                <Text style={styles.petName}>{petTemplate.name}</Text>
                <Text style={styles.petInfo}>
                  Element {ELEMENT_LABELS[petTemplate.element]} | Level {pet.level}
                </Text>
                <Text style={styles.petInfo}>Motif {petTemplate.motif}</Text>
                <Text style={styles.petInfo}>Rarity {petTemplate.rarity}</Text>
                <Text style={styles.petInfo}>
                  Hunger {pet.careState.hunger} / Mood {pet.careState.mood}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.bodyText}>Tap the login button to receive 1 random pet.</Text>
          )}
          <View style={styles.row}>
            {[
              ["feed", "Feed"],
              ["clean", "Clean"],
              ["play", "Play"],
              ["rest", "Rest"],
            ].map(([key, label]) => (
              <Pressable
                key={key}
                style={[styles.smallButton, !pet && styles.disabledButton]}
                disabled={!pet}
                onPress={() => careMutation.mutate(key as "feed" | "clean" | "play" | "rest")}
              >
                <Text style={styles.smallButtonText}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </PixelCard>

        <PixelCard title="Battle Arena" accent={colors.mint}>
          <Text style={styles.bodyText}>
            Actions are Attack, Guard, and Skill. Result uses level, items, element matchups,
            and luck.
          </Text>
          <Pressable
            style={[styles.primaryButton, !pet && styles.disabledButton]}
            disabled={!pet}
            onPress={() => queueMutation.mutate()}
          >
            <Text style={styles.primaryButtonText}>
              {queueMutation.isPending ? "Queueing..." : "Enter Live Match Queue"}
            </Text>
          </Pressable>
          {queueMutation.data ? (
            <Text style={styles.bodyText}>
              {queueMutation.data.matched
                ? `Match ready: ${queueMutation.data.battleId}`
                : "Waiting for another player."}
            </Text>
          ) : null}
        </PixelCard>

        <PixelCard title="Element Chart" accent={colors.gold}>
          {(["fire", "water", "grass", "electric", "digital"] as const).map((element) => {
            const strong = (["fire", "water", "grass", "electric", "digital"] as const).find(
              (target) => getElementAdvantageTier(element, target) === "strong",
            );
            const weak = (["fire", "water", "grass", "electric", "digital"] as const).find(
              (target) => getElementAdvantageTier(element, target) === "weak",
            );

            return (
              <Text key={element} style={styles.bodyText}>
                {ELEMENT_LABELS[element]} strong vs {strong ? ELEMENT_LABELS[strong] : "-"} / weak
                edge vs {weak ? ELEMENT_LABELS[weak] : "-"}
              </Text>
            );
          })}
        </PixelCard>

        <PixelCard title="Premium Features" accent={colors.violet}>
          {premiumFeatures.map((feature) => (
            <Text key={feature} style={styles.bodyText}>
              - {feature}
            </Text>
          ))}
          <Text style={styles.footnote}>No battle power, growth speed, or drop-rate advantage.</Text>
        </PixelCard>
      </ScrollView>
    </LinearGradient>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HomeScreen />
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 18,
  },
  hero: {
    paddingTop: 50,
    gap: 10,
  },
  kicker: {
    color: colors.cream,
    fontWeight: "900",
    letterSpacing: 2,
  },
  headline: {
    color: colors.cream,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
  },
  subhead: {
    color: "#d8f0ff",
    fontSize: 16,
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: colors.coral,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 3,
    borderColor: colors.cream,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  primaryButtonText: {
    color: colors.ink,
    fontWeight: "900",
  },
  bodyText: {
    color: colors.cream,
    fontSize: 15,
    lineHeight: 21,
  },
  warningText: {
    color: "#ffd0c2",
    fontSize: 14,
    lineHeight: 20,
  },
  petPanel: {
    flexDirection: "row",
    gap: 14,
  },
  petMeta: {
    flex: 1,
    gap: 6,
  },
  petName: {
    color: colors.cream,
    fontSize: 22,
    fontWeight: "900",
  },
  petInfo: {
    color: "#d7ebff",
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  smallButton: {
    backgroundColor: colors.mint,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 2,
    borderColor: colors.cream,
  },
  smallButtonText: {
    color: colors.ink,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.45,
  },
  footnote: {
    color: colors.gold,
    fontSize: 13,
    marginTop: 6,
  },
});
