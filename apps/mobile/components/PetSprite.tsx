import { Text, View, StyleSheet } from "react-native";
import { ElementType } from "@pixel-pet-arena/shared";
import { colors } from "../theme/colors";

const elementEmoji: Record<ElementType, string> = {
  fire: "🔥",
  water: "💧",
  grass: "🌿",
  electric: "⚡",
  digital: "💾",
};

export function PetSprite({ element, name }: { element: ElementType; name: string }) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.emoji}>{elementEmoji[element]}</Text>
      <Text style={styles.caption}>{name}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: 120,
    height: 120,
    borderWidth: 4,
    borderColor: colors.cream,
    backgroundColor: "#2d6999",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  emoji: {
    fontSize: 44,
  },
  caption: {
    color: colors.cream,
    fontWeight: "700",
  },
});
