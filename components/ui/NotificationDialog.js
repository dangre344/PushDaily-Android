import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors } from "../../constants/colors";

export default function NotificationDialog({
  visible,
  type = "info",
  title,
  message,
  primaryText,
  secondaryText,
  onPrimaryPress,
  onSecondaryPress,
  onClose,
}) {
  const iconConfig = {
    success: {
      icon: "checkmark-circle",
      bg: "#DCFCE7",
      color: "#16A34A",
    },
    warning: {
      icon: "notifications-outline",
      bg: colors.primary + "14",
      color: colors.primary,
    },
    denied: {
      icon: "alert-circle",
      bg: "#FEE2E2",
      color: "#DC2626",
    },
    info: {
      icon: "information-circle",
      bg: "#E0F2FE",
      color: "#0284C7",
    },
  };

  const current = iconConfig[type] || iconConfig.info;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />

        <View style={styles.card}>
          <View style={[styles.iconWrap, { backgroundColor: current.bg }]}>
            <Ionicons name={current.icon} size={38} color={current.color} />
          </View>

          <Text style={styles.title}>{title}</Text>

          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            {secondaryText ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.button, styles.secondaryButton]}
                onPress={onSecondaryPress}
              >
                <Text style={styles.secondaryText}>{secondaryText}</Text>
              </TouchableOpacity>
            ) : null}

            {primaryText ? (
              <TouchableOpacity
                activeOpacity={0.85}
                style={[styles.button, styles.primaryButton]}
                onPress={onPrimaryPress}
              >
                <Text style={styles.primaryText}>{primaryText}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 22,
  },

  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 20,
    shadowOffset: {
      width: 0,
      height: 10,
    },
    elevation: 10,
  },

  iconWrap: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  title: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: 20,
    color: colors.text,
    textAlign: "center",
  },

  message: {
    fontFamily: "OpenSans_400Regular",
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8,
    paddingHorizontal: 4,
  },

  actions: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
    marginTop: 24,
  },

  button: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  primaryButton: {
    backgroundColor: colors.primary,
  },

  secondaryButton: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  primaryText: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: 14,
    color: "#FFFFFF",
  },

  secondaryText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: 14,
    color: colors.text,
  },
});
