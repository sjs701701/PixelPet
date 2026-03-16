import { memo, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ElementType } from "@pixel-pet-arena/shared";
import { useTheme } from "../theme/ThemeContext";

type PetThumbnailProps = {
  element: ElementType;
  templateId: string;
  name: string;
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getInitialLabel(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }

  const compact = trimmed.replace(/\s+/g, "");
  const first = compact[0] ?? "?";
  const second = compact[1] ?? "";
  const isAscii = /^[\x00-\x7F]+$/.test(compact);

  return isAscii ? `${first}${second}`.toUpperCase() : first;
}

export const PetThumbnail = memo(function PetThumbnail({
  element,
  templateId,
  name,
}: PetThumbnailProps) {
  const { c } = useTheme();
  const hash = useMemo(() => hashString(`${templateId}:${element}`), [element, templateId]);
  const initialLabel = useMemo(() => getInitialLabel(name), [name]);

  const palette = useMemo(() => {
    switch (element) {
      case "fire":
        return { accent: c.pixelFire, soft: "#fff1e8" };
      case "water":
        return { accent: c.pixelWater, soft: "#eef8ff" };
      case "grass":
        return { accent: c.pixelGrass, soft: "#eefbe9" };
      case "electric":
        return { accent: c.pixelElectric, soft: "#fff8e3" };
      case "digital":
      default:
        return { accent: c.pixelDigital, soft: "#f3ecff" };
    }
  }, [c.pixelDigital, c.pixelElectric, c.pixelFire, c.pixelGrass, c.pixelWater, element]);

  const shapeOffset = useMemo(() => ({
    top: 8 + (hash % 12),
    left: 10 + ((hash >> 3) % 16),
    right: 8 + ((hash >> 5) % 14),
    bottom: 10 + ((hash >> 7) % 12),
    rotate: `${((hash >> 2) % 35) - 17}deg`,
  }), [hash]);

  return (
    <View style={[styles.shell, { borderColor: c.divider, backgroundColor: c.barTrack }]}>
      <View style={[styles.core, { backgroundColor: palette.soft, borderColor: palette.accent }]}>
        <View
          style={[
            styles.sparkPrimary,
            {
              backgroundColor: palette.accent,
              top: shapeOffset.top,
              left: shapeOffset.left,
              transform: [{ rotate: shapeOffset.rotate }],
            },
          ]}
        />
        <View
          style={[
            styles.sparkSecondary,
            {
              borderColor: palette.accent,
              right: shapeOffset.right,
              bottom: shapeOffset.bottom,
              transform: [{ rotate: `${Number.parseInt(shapeOffset.rotate, 10) * -1}deg` }],
            },
          ]}
        />
        <Text style={[styles.initial, { color: c.text }]}>{initialLabel}</Text>
      </View>
    </View>
  );
});

PetThumbnail.displayName = "PetThumbnail";

const styles = StyleSheet.create({
  shell: {
    width: 84,
    height: 84,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  core: {
    width: 64,
    height: 64,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  sparkPrimary: {
    position: "absolute",
    width: 22,
    height: 22,
    opacity: 0.85,
  },
  sparkSecondary: {
    position: "absolute",
    width: 16,
    height: 16,
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  initial: {
    fontSize: 18,
    fontFamily: "Mona12-Bold",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
});
