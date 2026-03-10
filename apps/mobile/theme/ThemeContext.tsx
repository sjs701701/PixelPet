import { createContext, useContext } from "react";
import { ThemeColors, ThemeMode, getTheme } from "./colors";

type ThemeContextValue = {
  mode: ThemeMode;
  c: ThemeColors;
  toggle: () => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
  mode: "dark",
  c: getTheme("dark"),
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}
