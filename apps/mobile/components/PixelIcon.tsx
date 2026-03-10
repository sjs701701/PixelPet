import { Image, ImageSourcePropType, StyleSheet } from "react-native";

const ICON_IMAGES: Record<string, ImageSourcePropType> = {
  feed: require("../assets/icons/feed.png"),
  clean: require("../assets/icons/clean.png"),
  play: require("../assets/icons/play.png"),
  rest: require("../assets/icons/rest.png"),
};

type PixelIconProps = {
  name: string;
  color: string;
  size?: number;
};

export function PixelIcon({ name, color, size = 24 }: PixelIconProps) {
  const source = ICON_IMAGES[name];
  if (!source) return null;

  return (
    <Image
      source={source}
      style={[styles.icon, { width: size, height: size, tintColor: color }]}
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  icon: {},
});
