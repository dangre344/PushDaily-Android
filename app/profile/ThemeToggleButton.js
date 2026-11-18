import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, isDark } from "../../constants/colors";
import { tapHaptic } from "../../constants/haptics";
import { trackEvent } from "../../constants/mixpanel";
import { setThemeMode } from "../../constants/themeMode";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

/**
 * Sun in Bright mode, moon in Night mode. Tapping asks to restart, then
 * switches (styles are built at start-up, so the app reloads to apply).
 */
export default function ThemeToggleButton() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const next = isDark ? "light" : "dark";

  const confirm = async () => {
    setBusy(true);
    trackEvent("Theme Changed", { to: next });
    await setThemeMode(next); // reloads on success
    setBusy(false);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => {
          tapHaptic();
          setOpen(true);
        }}
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.8 }]}
        accessibilityRole="button"
        accessibilityLabel={isDark ? "Night mode on. Switch to bright mode" : "Bright mode on. Switch to night mode"}
        hitSlop={8}
      >
        <Ionicons
          name={isDark ? "moon" : "sunny"}
          size={ms(20)}
          color={isDark ? "#A99BFF" : "#F59E0B"}
        />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => !busy && setOpen(false)}>
          <Pressable style={styles.dialog} onPress={() => {}}>
            <View style={[styles.dialogIcon, { backgroundColor: isDark ? "#FEF3C7" : "#2B2F4A" }]}>
              <Ionicons
                name={isDark ? "sunny" : "moon"}
                size={ms(26)}
                color={isDark ? "#F59E0B" : "#C4B8FF"}
              />
            </View>
            <Text style={styles.title}>
              {isDark ? "Switch to Bright mode?" : "Switch to Night mode?"}
            </Text>
            <Text style={styles.body}>The app will restart to apply the new look.</Text>
            <View style={styles.actions}>
              <Pressable
                style={[styles.action, styles.cancel]}
                onPress={() => setOpen(false)}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.action, styles.continue, busy && { opacity: 0.7 }]}
                onPress={confirm}
                disabled={busy}
                accessibilityRole="button"
              >
                <Text style={styles.continueText}>{busy ? "Restarting…" : "Continue"}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialog: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 22,
    alignItems: "center",
  },
  dialogIcon: {
    width: ms(56),
    height: ms(56),
    borderRadius: ms(28),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: { fontFamily: "OpenSans_700Bold", fontSize: ms(17), color: colors.text, textAlign: "center" },
  body: {
    fontFamily: "OpenSans_400Regular",
    fontSize: ms(13.5),
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 6,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 20, alignSelf: "stretch" },
  action: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
  cancel: { backgroundColor: colors.screen, borderWidth: 1, borderColor: colors.hairline },
  cancelText: { fontFamily: "OpenSans_600SemiBold", fontSize: ms(14), color: colors.text },
  continue: { backgroundColor: colors.primary },
  continueText: { fontFamily: "OpenSans_700Bold", fontSize: ms(14), color: "#FFFFFF" },
});
