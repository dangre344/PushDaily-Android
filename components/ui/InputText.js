import { Ionicons } from "@expo/vector-icons";
import { AnimatePresence, MotiView } from "moti";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors } from "../../constants/colors";
import { scaling } from "../../constants/useScaling";
import TitleText from "./TitleText";

const ms = (n) => scaling().moderateScale(n);

/**
 * Text field bound to react-hook-form. Same props as before; adds visible
 * states — focused (orange ring), filled (check), error (red + message).
 *
 * Caller-supplied onFocus/onBlur are still called; they're composed with the
 * field's own handlers rather than overriding them.
 */
export default function InputText({
  form,
  fieldName,
  titleTextLabel,
  titleStyle,
  isOptional = false,
  inputStyle,
  error,
  rootContainer,
  secureTextEntry = false,
  icon,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
  ...props
}) {
  const [isSecure, setIsSecure] = useState(secureTextEntry);
  const [focused, setFocused] = useState(false);

  return (
    <View style={rootContainer}>
      <Controller
        control={form.control}
        name={fieldName}
        render={({ field: { onChange, onBlur, value } }) => {
          const message = error || form?.formState?.errors?.[fieldName]?.message;
          const filled = typeof value === "string" ? value.trim().length > 0 : value != null && value !== "";

          return (
            <View>
              {titleTextLabel ? (
                <TitleText
                  text={titleTextLabel}
                  style={[styles.label, focused && styles.labelFocused, titleStyle]}
                  isOptional={isOptional}
                />
              ) : null}

              <MotiView
                animate={{
                  borderColor: message ? colors.error : focused ? colors.primary : "#E7EAEF",
                  backgroundColor: focused ? "#FFFAF7" : "#FFFFFF",
                }}
                transition={{ type: "timing", duration: 160 }}
                style={styles.box}
              >
                <Ionicons
                  name={icon || "person-outline"}
                  size={ms(18)}
                  color={focused ? colors.primary : "#9AA3AD"}
                />
                <TextInput
                  style={[styles.input, inputStyle]}
                  placeholderTextColor="#9AA3AD"
                  onChangeText={onChange}
                  value={value}
                  secureTextEntry={isSecure}
                  autoCapitalize={props.autoCapitalize ?? "sentences"}
                  {...props}
                  onFocus={(e) => {
                    setFocused(true);
                    onFocusProp?.(e);
                  }}
                  onBlur={(e) => {
                    setFocused(false);
                    onBlur();
                    onBlurProp?.(e);
                  }}
                />

                {secureTextEntry ? (
                  <Pressable onPress={() => setIsSecure((s) => !s)} hitSlop={8}>
                    <Ionicons name={isSecure ? "eye-off" : "eye"} size={ms(20)} color="#9AA3AD" />
                  </Pressable>
                ) : (
                  <AnimatePresence>
                    {filled && !message ? (
                      <MotiView
                        from={{ opacity: 0, scale: 0.4 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.4 }}
                        transition={{ type: "spring", damping: 14 }}
                      >
                        <Ionicons name="checkmark-circle" size={ms(19)} color={colors.success} />
                      </MotiView>
                    ) : null}
                  </AnimatePresence>
                )}
              </MotiView>

              <AnimatePresence>
                {message ? (
                  <MotiView
                    from={{ opacity: 0, translateY: -4 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    exit={{ opacity: 0 }}
                    style={styles.errorRow}
                  >
                    <Ionicons name="alert-circle" size={ms(13)} color={colors.error} />
                    <Text style={styles.errorText}>{message}</Text>
                  </MotiView>
                ) : null}
              </AnimatePresence>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: ms(13),
    fontFamily: "OpenSans_700Bold",
    color: colors.text,
    marginBottom: 6,
  },
  labelFocused: { color: colors.primary },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: ms(54),
  },
  input: {
    flex: 1,
    fontSize: ms(15),
    fontFamily: "OpenSans_600SemiBold",
    color: colors.text,
    paddingVertical: 12,
  },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6 },
  errorText: { fontSize: ms(12), fontFamily: "OpenSans_600SemiBold", color: colors.error },
});
