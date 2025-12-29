// IconWithText.js
import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors } from "../../constants/colors";

export default function IconWithText({
  icon,
  label,
  size = 40,
  color,
  onPress,
  orientation = "vertical",
  textStyle,
  containerStyle,
  iconContainerStyle,
  badge,
}) {
  const content = (
    <View
      style={[
        styles.root,
        orientation === "horizontal" ? styles.row : styles.col,
        containerStyle,
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { width: size, height: size },
          iconContainerStyle,
        ]}
      >
        {/* If the icon prop is a React element (vector icon), clone and pass size/color */}
        {React.isValidElement(icon) ? (
          React.cloneElement(icon, {
            size,
            color,
            style: [{ width: size, height: size }, icon.props.style],
          })
        ) : icon ? (
          // assume it's an image source
          <Image
            source={icon}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[
              styles.placeholder,
              { width: size, height: size, borderRadius: size / 2 },
            ]}
          />
        )}

        {badge ? (
          <View style={[styles.badge, badge.style]}>
            <Text numberOfLines={1} style={styles.badgeText}>
              {badge.text}
            </Text>
          </View>
        ) : null}
      </View>

      {label ? (
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.label,
            orientation === "horizontal" && styles.labelH,
            textStyle,
          ]}
        >
          {label}
        </Text>
      ) : null}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  root: {
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
  },
  col: {
    flexDirection: "column",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  placeholder: {
    backgroundColor: "#e0e0e0",
  },
  label: {
    marginTop: 6,
    fontSize: 12,
    color: "#222",
    maxWidth: 100,
    textAlign: "center",
    fontFamily: "OpenSans_600SemiBold",
  },
  labelH: {
    marginLeft: 5,
    marginTop: 0,
    textAlign: "left",
  },
  badge: {
    position: "absolute",
    right: -6,
    top: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#ff3b30",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: colors.textLight,
    fontSize: 10,
    fontFamily: "OpenSans_400Bold",
  },
});
