import { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/ThemeContext";

type PixelCardProps = PropsWithChildren<{
  title: string;
  accent?: string;
}>;

export function PixelCard({ title, children }: PixelCardProps) {
  const { c } = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: c.divider }]}>
      <Text style={[styles.title, { color: c.grayDark }]}>{title}</Text>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopWidth: 1,
    paddingTop: 20,
    gap: 14,
  },
  title: {
    fontSize: 10,
    fontFamily: "PressStart2P_400Regular",
    letterSpacing: 1,
    textTransform: "lowercase",
  },
  content: {
    gap: 14,
  },
});
