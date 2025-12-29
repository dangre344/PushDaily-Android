import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "../../constants/colors";
import TitleText from "./TitleText";

export default function InputText({
  form,
  fieldName,
  titleTextLabel,
  titleStyle,
  isOptional = false,
  inputStyle,
  error,
  secureTextEntry = false,
  ...props
}) {
  // console.log("fieldName--->", fieldName);
  // console.log("errors-InputText-->", form?.formState?.errors[fieldName]);

  const [isSecure, setIsSecure] = useState(secureTextEntry);

  const toggleSecureText = () => {
    setIsSecure(!isSecure);
  };
  return (
    <View>
      <Controller
        control={form.control}
        name={fieldName}
        render={({ field: { onChange, onBlur, value } }) => (
          <View>
            {titleTextLabel ? (
              <TitleText
                text={titleTextLabel}
                style={titleStyle}
                isOptional={isOptional}
              />
            ) : null}

            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.inputTextStyle, inputStyle]}
                onBlur={onBlur}
                onChangeText={onChange}
                autoCapitalize={props.autoCapitalize ?? "sentences"}
                value={value}
                secureTextEntry={isSecure}
                {...props}
              />

              {secureTextEntry && (
                <Pressable
                  onPress={toggleSecureText}
                  style={styles.iconContainer}
                >
                  <Ionicons
                    name={isSecure ? "eye-off" : "eye"}
                    size={24}
                    color="gray"
                  />
                </Pressable>
              )}
            </View>

            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : (
              form?.formState?.errors[fieldName]?.message && (
                <Text style={styles.errorText}>
                  {form?.formState?.errors[fieldName]?.message}
                </Text>
              )
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  inputTextStyle: {
    borderColor: colors.grey,
    borderWidth: 1,
    fontSize: 15,
    fontFamily: "OpenSans_400Regular",
    paddingHorizontal: 15,
    marginTop: 5,
    color: colors.textLight,
    borderRadius: 10,
    paddingVertical: 10,
    flex: 1,
  },

  iconContainer: {
    paddingHorizontal: 10,
  },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    alignContent: "center",
  },

  errorText: {
    fontSize: 12,
    fontFamily: "OpenSans_400Regular",
    color: colors.errorRed,
    marginTop: 2,
  },
});
