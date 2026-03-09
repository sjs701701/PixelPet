import { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

type PixelCardProps = PropsWithChildren<{
  title: string;
  accent?: string;
}>;

export function PixelCard({ title, accent = colors.orange, children }: PixelCardProps) {
  return (
    <View style={styles.shell}>
      <View style={styles.bezel}>
        <View style={[styles.header, { backgroundColor: accent }]}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.headerDots}>
            <View style={styles.headerDot} />
            <View style={styles.headerDot} />
          </View>
        </View>
        <View style={styles.screen}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: colors.bezelShadow,
    paddingRight: 6,
    paddingBottom: 6,
  },
  bezel: {
    borderWidth: 4,
    borderColor: colors.line,
    backgroundColor: colors.bezel,
    padding: 10,
  },
  header: {
    minHeight: 30,
    borderWidth: 3,
    borderColor: colors.line,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  headerDots: {
    flexDirection: "row",
    gap: 4,
  },
  headerDot: {
    width: 10,
    height: 10,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.bezelLight,
  },
  screen: {
    marginTop: 8,
    borderWidth: 4,
    borderColor: colors.line,
    backgroundColor: colors.screen,
    padding: 14,
    gap: 12,
  },
});
