import { Dimensions, PixelRatio, useWindowDimensions } from "react-native";

// Set your base design dimensions (adjust based on your design mockup)
const BASE_WIDTH = 375; // Reference design width
const BASE_HEIGHT = 812; // Reference design height;

const scalingFn = (SCREEN_WIDTH, SCREEN_HEIGHT) => {
  /**
   * Scales a size based on the screen width.
   * @param {number} size - The size to scale.
   * @returns {number} - The scaled size.
   */
  const scaleWidth = (size) => {
    return PixelRatio.roundToNearestPixel((SCREEN_WIDTH / BASE_WIDTH) * size);
  };

  /**
   * Scales a size based on the screen height.
   * @param {number} size - The size to scale.
   * @returns {number} - The scaled size.
   */
  const scaleHeight = (size) => {
    return PixelRatio.roundToNearestPixel((SCREEN_HEIGHT / BASE_HEIGHT) * size);
  };

  /**
   * Moderately scales a size with an adjustable factor.
   * @param {number} size - The size to scale.
   * @param {number} factor - The adjustment factor (default is 0.5).
   * @returns {number} - The moderately scaled size.
   */
  const moderateScale = (size, factor = 0.5) => {
    const scaledSize = scaleWidth(size); // Use width as a baseline for moderation
    return PixelRatio.roundToNearestPixel(size + (scaledSize - size) * factor);
  };

  return { scaleWidth, scaleHeight, moderateScale };
};
/**
 * Custom hook for responsive scaling.
 * Dynamically calculates scaling values based on current dimensions.
 */
export const useScaling = () => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = useWindowDimensions();
  return scalingFn(SCREEN_WIDTH, SCREEN_HEIGHT);
};
export const scaling = () => {
  const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } =
    Dimensions.get("window");
  return scalingFn(SCREEN_WIDTH, SCREEN_HEIGHT);
};
