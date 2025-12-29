import { Controller } from "react-hook-form";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors } from "@/constants/colors";
import React from "react";

export const OptionCardController = ({
  control,
  name,
  rules = {},
  options = [],
  defaultValue = "",
}) => {
  return (
    <Controller
      control={control}
      name={name}
      rules={rules}
      defaultValue={defaultValue}
      render={({ field: { value, onChange } }) => (
        <View style={styles.optionsContainer}>
          {options.map((option) => {
            const isSelected = value === option.title;
            return (
              <TouchableOpacity
                key={option.title}
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => onChange(option.title)}
                activeOpacity={0.7}
              >
                <View style={styles.cardContent}>
                  <Text style={styles.emoji}>{option.emoji}</Text>
                  <View style={styles.textContainer}>
                    <Text
                      style={[
                        styles.title,
                        isSelected && styles.cardSelectedText,
                      ]}
                    >
                      {option.title}
                    </Text>

                    {option.time && (
                      <Text
                        style={[
                          styles.time,
                          isSelected && styles.cardSelectedText,
                        ]}
                      >
                        {option.time}
                      </Text>
                    )}
                    {option.description && (
                      <Text
                        style={[
                          styles.description,
                          isSelected && styles.cardSelectedText,
                        ]}
                      >
                        {option.description}
                      </Text>
                    )}
                  </View>
                </View>
                {isSelected && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    />
  );
};

// Example styles (you can adjust to your existing styles)
const styles = StyleSheet.create({
  optionsContainer: {
    flexWrap: "wrap",
    gap: 20,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.grey,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "10",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  emoji: {
    fontSize: 24,
    marginRight: 8,
  },
  textContainer: {
    flexShrink: 1,
  },
  title: {
    fontSize: 16,
    color: "#333",
    fontFamily: "OpenSans_600SemiBold",
  },
  cardSelectedText: {
    color: colors.primary,

    fontFamily: "OpenSans_600SemiBold",
  },
  description: {
    fontSize: 12,
    color: "#666",
    fontFamily: "OpenSans_600SemiBold",
  },

  time: {
    fontSize: 14,
    color: colors.green,
    fontFamily: "OpenSans_700Bold",
  },
  checkmark: {
    fontSize: 16,
    color: colors.primary,
    fontFamily: "OpenSans_600SemiBold",
  },
});

// const styles = StyleSheet.create({
//   card: {
//     backgroundColor: colors.background,
//     borderWidth: 2,
//     borderColor: colors.border,
//     borderRadius: 12,
//     padding: 16,
//     marginBottom: 12,
//   },
//   cardSelected: {
//     borderColor: colors.primary,
//     backgroundColor: colors.primary + "10",
//   },
//   cardContent: {
//     flexDirection: "row",
//     alignItems: "center",
//   },
//   emoji: {
//     fontSize: 32,
//     marginRight: 16,
//   },
//   textContainer: {
//     flex: 1,
//   },
//   title: {
//     fontSize: 16,
//     fontFamily: "OpenSans_600SemiBold",
//     color: colors.text,
//   },
//   titleSelected: {
//     color: colors.primary,
//   },
//   description: {
//     fontSize: 13,
//     fontFamily: "OpenSans_400Regular",
//     color: colors.textLight,
//     marginTop: 4,
//   },
//   descriptionSelected: {
//     color: colors.text,
//   },
//   checkmark: {
//     position: "absolute",
//     top: 12,
//     right: 12,
//     backgroundColor: colors.primary,
//     width: 24,
//     height: 24,
//     borderRadius: 12,
//     alignItems: "center",
//     justifyContent: "center",
//     fontSize: 14,
//     color: colors.white,
//     fontFamily: "OpenSans_700Bold",
//   },
// });
