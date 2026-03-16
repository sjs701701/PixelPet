import { memo, useEffect, useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import {
  ElementType,
  PetEvolutionStage,
  getEvolutionStage,
  getTemplateById,
} from "@pixel-pet-arena/shared";
import { useTheme } from "../theme/ThemeContext";
import fire001Stage1Meta from "../assets/pets/fire/fire-001/stage-1/meta.json";

const STARTER_SPRITES: Record<ElementType, string[]> = {
  fire: ["0001110000", "0012221000", "0122222100", "1223332210", "1233433210", "0123332100", "0012321000", "0001210000", "0000100000", "0000000000"],
  water: ["0001110000", "0012221000", "0122232100", "1233333210", "1234433210", "0123332100", "0012321000", "0001210000", "0000100000", "0000000000"],
  grass: ["0001110000", "0012321000", "0123332100", "1234343210", "1233333210", "0123232100", "0012121000", "0001110000", "0000100000", "0000000000"],
  electric: ["0001110000", "0012221000", "0123332100", "1234343210", "0233332100", "0123432100", "0012321000", "0001210000", "0000100000", "0000000000"],
  digital: ["0001110000", "0012221000", "0123032100", "1234343210", "1233033210", "0123232100", "0012121000", "0001110000", "0000100000", "0000000000"],
};

const BASE_SPRITES: Record<ElementType, string[]> = {
  fire: ["0001110000", "0012221000", "0123332100", "1233333210", "1234343210", "1233333210", "0123232100", "0012121000", "0001110000", "0000100000"],
  water: ["0001110000", "0012221000", "0123332100", "1233333210", "1234433210", "1233333210", "0123332100", "0012221000", "0001110000", "0000100000"],
  grass: ["0001110000", "0012321000", "0123432100", "1233333210", "1234433210", "1233333210", "0123232100", "0012121000", "0001110000", "0000100000"],
  electric: ["0001110000", "0012221000", "0123332100", "1234343210", "0233332100", "0123432100", "0012321000", "0001210000", "0000100000", "0000100000"],
  digital: ["0001110000", "0012221000", "0123032100", "1234343210", "1233033210", "1234343210", "0123232100", "0012121000", "0001110000", "0000100000"],
};

const REGISTERED_SPRITES = {
  "fire-1:stage1": {
    source: require("../assets/pets/fire/fire-001/stage-1/idle.png"),
    frameWidth: fire001Stage1Meta.frameWidth,
    frameHeight: fire001Stage1Meta.frameHeight,
    frames: fire001Stage1Meta.idleFrames,
    fps: fire001Stage1Meta.fps.idle,
  },
} as const;

function makePalettes(
  pixelFire: string,
  pixelWater: string,
  pixelGrass: string,
  pixelElectric: string,
  pixelDigital: string,
): Record<ElementType, string[]> {
  return {
    fire: ["transparent", "#fff4d6", pixelFire, "#ef7d35", "#e35d3d"],
    water: ["transparent", "#f2ffff", pixelWater, "#78d7e3", "#2d5bd1"],
    grass: ["transparent", "#f3ffd6", pixelGrass, "#7ecf9a", "#409b44"],
    electric: ["transparent", "#fff8d0", pixelElectric, "#f2c94c", "#d68f18"],
    digital: ["transparent", "#f5eeff", pixelDigital, "#7d7cf2", "#5f4ed1"],
  };
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function cloneRows(rows: string[]) {
  return rows.map((row) => row.split("").map((cell) => Number(cell)));
}

function setCell(grid: number[][], row: number, col: number, value: number) {
  if (!grid[row] || typeof grid[row][col] !== "number") {
    return;
  }
  grid[row][col] = Math.max(grid[row][col], value);
}

function gridToRows(grid: number[][]) {
  return grid.map((row) => row.join(""));
}

function applyVariant(
  baseRows: string[],
  templateId: string,
  stage: PetEvolutionStage,
) {
  const grid = cloneRows(baseRows);
  const hash = hashString(`${templateId}:${stage}`);

  if (stage >= 1) {
    setCell(grid, 3, 2 + (hash % 2), 4);
    setCell(grid, 3, 6 + ((hash >> 1) % 2), 4);
    setCell(grid, 6, 4 + ((hash >> 2) % 2), 4);
  }

  if (stage >= 2) {
    if ((hash & 1) === 0) {
      setCell(grid, 1, 3, 2);
      setCell(grid, 1, 6, 2);
    } else {
      setCell(grid, 2, 1, 2);
      setCell(grid, 2, 8, 2);
    }

    setCell(grid, 5, 1 + ((hash >> 3) % 2), 3);
    setCell(grid, 5, 7 + ((hash >> 4) % 2), 3);
  }

  if (stage >= 3) {
    setCell(grid, 0, 4, 2);
    setCell(grid, 0, 5, 2);
    setCell(grid, 8, 3 + ((hash >> 5) % 3), 2);
    setCell(grid, 4, 0, 3);
    setCell(grid, 4, 9, 3);
  }

  return gridToRows(grid);
}

function getFallbackRows(
  element: ElementType,
  templateId?: string,
  stage: PetEvolutionStage = 1,
) {
  if (stage === 0 || !templateId) {
    return STARTER_SPRITES[element];
  }

  return applyVariant(BASE_SPRITES[element], templateId, stage);
}

type PetSpriteProps = {
  element: ElementType;
  name: string;
  templateId?: string;
  level?: number;
  stage?: PetEvolutionStage;
  size?: number;
};

export const PetSprite = memo(function PetSprite({
  element,
  name,
  templateId,
  level,
  stage,
  size = 12,
}: PetSpriteProps) {
  const { c } = useTheme();
  const resolvedStage = stage ?? getEvolutionStage(level ?? 1);
  const registeredKey = templateId
    ? `${templateId}:stage${resolvedStage}` as keyof typeof REGISTERED_SPRITES
    : undefined;
  const spriteConfig = registeredKey ? REGISTERED_SPRITES[registeredKey] : undefined;
  const [frameIndex, setFrameIndex] = useState(0);
  const palette = makePalettes(
    c.pixelFire,
    c.pixelWater,
    c.pixelGrass,
    c.pixelElectric,
    c.pixelDigital,
  )[element];
  const rows = useMemo(() => {
    if (!templateId) {
      return getFallbackRows(element, undefined, resolvedStage);
    }

    const template = getTemplateById(templateId);
    if (!template) {
      return getFallbackRows(element, templateId, resolvedStage);
    }

    return getFallbackRows(template.element, template.id, resolvedStage);
  }, [element, resolvedStage, templateId]);

  useEffect(() => {
    if (!spriteConfig) return;
    setFrameIndex(0);
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
    <View style={styles.wrapper} accessible accessibilityLabel={`${name} sprite`}>
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
          <View key={`${element}-${resolvedStage}-${rowIndex}`} style={styles.row}>
            {row.split("").map((cell, cellIndex) => (
              <View
                key={`${element}-${resolvedStage}-${rowIndex}-${cellIndex}`}
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
});

PetSprite.displayName = "PetSprite";

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
