import { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

type PixelCardProps = PropsWithChildren<{
  title: string;
  accent?: string;
}>;

export function PixelCard({ title, accent = colors.gold, children }: PixelCardProps) {
  return (
    <View style={[styles.card, { borderColor: accent }]}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderWidth: 3,
    padding: 16,
    gap: 10,
    shadowColor: "#0b1424",
    shadowOpacity: 0.35,
    shadowRadius: 0,
    shadowOffset: { width: 6, height: 6 },
  },
  title: {
    color: colors.cream,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
