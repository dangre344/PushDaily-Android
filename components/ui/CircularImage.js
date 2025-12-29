import { Image, StyleSheet, View } from "react-native";

export default function CircularImage({ source, size = 80 }) {
  const imageSource = typeof source === "string" ? { uri: source } : source; // asset image

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Image
        style={{ width: size, height: size, borderRadius: size / 2 }}
        source={imageSource}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#ddd", // fallback background
  },
});
