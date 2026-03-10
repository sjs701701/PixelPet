import { useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { ElementType } from "@pixel-pet-arena/shared";
import { useTheme } from "../theme/ThemeContext";
import fire001Stage1Meta from "../assets/pets/fire/fire-001/stage-1/meta.json";

const SPRITES: Record<ElementType, string[]> = {
  fire: ["0001110000", "0012221000", "0123332100", "1233333210", "1234343210", "1233333210", "0123232100", "0012121000", "0001110000", "0000100000"],
  water: ["0001110000", "0012221000", "0123332100", "1233333210", "1234433210", "1233333210", "0123332100", "0012221000", "0001110000", "0000100000"],
  grass: ["0001110000", "0012321000", "0123432100", "1233333210", "1234433210", "1233333210", "0123232100", "0012121000", "0001110000", "0000100000"],
  electric: ["0001110000", "0012221000", "0123332100", "1234343210", "0233332100", "0123432100", "0012321000", "0001210000", "0000100000", "0000100000"],
  digital: ["0001110000", "0012221000", "0123032100", "1234343210", "1233033210", "1234343210", "0123232100", "0012121000", "0001110000", "0000100000"],
};

function makePalettes(pixelFire: string, pixelWater: string, pixelGrass: string, pixelElectric: string, pixelDigital: string): Record<ElementType, string[]> {
  return {
    fire: ["transparent", "#fff4d6", pixelFire, "#ef7d35", "#e35d3d"],
    water: ["transparent", "#f2ffff", pixelWater, "#78d7e3", "#2d5bd1"],
    grass: ["transparent", "#f3ffd6", pixelGrass, "#7ecf9a", "#409b44"],
    electric: ["transparent", "#fff8d0", pixelElectric, "#f2c94c", "#d68f18"],
    digital: ["transparent", "#f5eeff", pixelDigital, "#7d7cf2", "#5f4ed1"],
  };
}

const REGISTERED_SPRITES = {
  "fire-1": {
    source: require("../assets/pets/fire/fire-001/stage-1/idle.png"),
    frameWidth: fire001Stage1Meta.frameWidth,
    frameHeight: fire001Stage1Meta.frameHeight,
    frames: fire001Stage1Meta.idleFrames,
    fps: fire001Stage1Meta.fps.idle,
  },
} as const;

type PetSpriteProps = {
  element: ElementType;
  name: string;
  templateId?: string;
  size?: number;
};

export function PetSprite({ element, name, templateId, size = 12 }: PetSpriteProps) {
  const { c } = useTheme();
  const spriteConfig = templateId
    ? REGISTERED_SPRITES[templateId as keyof typeof REGISTERED_SPRITES]
    : undefined;
  const [frameIndex, setFrameIndex] = useState(0);
  const rows = SPRITES[element];
  const palette = makePalettes(c.pixelFire, c.pixelWater, c.pixelGrass, c.pixelElectric, c.pixelDigital)[element];

  useEffect(() => {
    if (!spriteConfig) return;
    const intervalMs = Math.max(80, Math.round(1000 / spriteConfig.fps));
    const timer = setInterval(() => {
      setFrameIndex((value) => (value + 1) % spriteConfig.frames);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [spriteConfig]);

  const scaledSize = useMemo(() => {
    if (!spriteConfig) return null;
    const scale = size / 40;
    return {
      frameWidth: Math.round(spriteConfig.frameWidth * scale),
      frameHeight: Math.round(spriteConfig.frameHeight * scale),
      sheetWidth: Math.round(spriteConfig.frameWidth * spriteConfig.frames * scale),
      offsetX: -Math.round(spriteConfig.frameWidth * frameIndex * scale),
    };
  }, [frameIndex, size, spriteConfig]);

  return (
    <View style={styles.wrapper}>
      {spriteConfig && scaledSize ? (
        <View
          style={[
            styles.spriteViewport,
            {
              width: scaledSize.frameWidth,
              height: scaledSize.frameHeight,
            },
          ]}
        >
          <Image
            source={spriteConfig.source}
            style={{
              width: scaledSize.sheetWidth,
              height: scaledSize.frameHeight,
              transform: [{ translateX: scaledSize.offsetX }],
            }}
            resizeMode="stretch"
          />
        </View>
      ) : (
        rows.map((row, rowIndex) => (
          <View key={`${element}-${rowIndex}`} style={styles.row}>
            {row.split("").map((cell, cellIndex) => (
              <View
                key={`${element}-${rowIndex}-${cellIndex}`}
                style={{
                  width: size,
                  height: size,
                  backgroundColor: palette[Number(cell)],
                }}
              />
            ))}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
  },
  spriteViewport: {
    overflow: "hidden",
    alignSelf: "center",
  },
});
