export type ThemeMode = "dark" | "light";

export type ThemeColors = {
  bg: string;
  text: string;
  gray: string;
  grayDark: string;
  accent: string;
  divider: string;
  barTrack: string;
  barFill: string;
  transparent: string;
  pixelFire: string;
  pixelWater: string;
  pixelGrass: string;
  pixelElectric: string;
  pixelDigital: string;
};

const dark: ThemeColors = {
  bg: "#0A0A0A",
  text: "#FFFFFF",
  gray: "#9A9A9A",
  grayDark: "#707070",
  accent: "#FF3C3C",
  divider: "#2A2A2A",
  barTrack: "#222222",
  barFill: "#FFFFFF",
  transparent: "transparent",
  pixelFire: "#ff6b35",
  pixelWater: "#4d9be6",
  pixelGrass: "#72cf54",
  pixelElectric: "#ffd23f",
  pixelDigital: "#a15cff",
};

const light: ThemeColors = {
  bg: "#F5F5F0",
  text: "#0A0A0A",
  gray: "#777777",
  grayDark: "#999999",
  accent: "#FF3C3C",
  divider: "#E0E0DA",
  barTrack: "#E0E0DA",
  barFill: "#0A0A0A",
  transparent: "transparent",
  pixelFire: "#ff6b35",
  pixelWater: "#4d9be6",
  pixelGrass: "#72cf54",
  pixelElectric: "#ffd23f",
  pixelDigital: "#a15cff",
};

export function getTheme(mode: ThemeMode): ThemeColors {
  return mode === "light" ? light : dark;
}

// backward compat default
export const colors = dark;
