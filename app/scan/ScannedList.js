import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { colors } from "../../constants/colors";
import { VERDICT_META } from "../../constants/foodScan";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

const timeOf = (ts) =>
  new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

const HelpButton = ({ onPress }) => (
  <TouchableOpacity style={styles.help} activeOpacity={0.85} onPress={onPress}>
    <Ionicons name="help-circle" size={ms(17)} color={colors.primary} />
    <Text style={styles.helpText}>How scanning works</Text>
    <Ionicons name="chevron-forward" size={ms(14)} color={colors.primary} />
  </TouchableOpacity>
);

/** History of everything scanned, grouped by day. */
export default function ScannedList({ sections, onHelp }) {
  if (!sections.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyEmoji}>🧾</Text>
        <Text style={styles.emptyTitle}>Nothing scanned yet</Text>
        <Text style={styles.emptyText}>
          Products you scan will appear here, grouped by day.
        </Text>

        <View style={styles.emptyHelp}>
          <HelpButton onPress={onHelp} />
        </View>
      </View>
    );
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={<HelpButton onPress={onHelp} />}
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.sectionCount}>
            {section.data.length} item{section.data.length !== 1 ? "s" : ""}
          </Text>
        </View>
      )}
      renderItem={({ item }) => {
        const meta = VERDICT_META[item.verdict] || VERDICT_META.sometimes;
        return (
          <View style={[styles.card, { borderLeftColor: meta.color }]}>
            {item.image ? (
              <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" />
            ) : (
              <View style={[styles.thumb, styles.thumbFallback]}>
                <Text style={styles.thumbEmoji}>{meta.emoji}</Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>

              <View style={styles.metaRow}>
                <Text style={[styles.verdict, { color: meta.color }]}>
                  {meta.emoji} {meta.title}
                </Text>
                {item.ate ? (
                  <View style={styles.atePill}>
                    <Ionicons name="restaurant" size={ms(9)} color="#0F766E" />
                    <Text style={styles.ateText}>Ate</Text>
                  </View>
                ) : null}
              </View>

              <Text style={styles.nutri} numberOfLines={1}>
                {[
                  item.per100g?.sugars_g != null &&
                    `Sugar ${item.per100g.sugars_g}g`,
                  item.per100g?.salt_g != null && `Salt ${item.per100g.salt_g}g`,
                  item.per100g?.fat_g != null && `Fat ${item.per100g.fat_g}g`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No nutrition data"}
              </Text>

              {item.allergens?.length ? (
                <Text style={styles.allergens} numberOfLines={1}>
                  ⚠️ {item.allergens.join(", ")}
                </Text>
              ) : null}
            </View>

            <Text style={styles.time}>{timeOf(item.at)}</Text>
          </View>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: ms(16), paddingBottom: ms(30) },

  help: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(8),
    backgroundColor: colors.primary + "12",
    borderRadius: ms(14),
    paddingVertical: ms(11),
    paddingHorizontal: ms(13),
    borderWidth: 1,
    borderColor: colors.primary + "30",
  },
  helpText: {
    flex: 1,
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12),
    color: colors.primary,
  },
  emptyHelp: { alignSelf: "stretch", marginTop: ms(22) },

  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: ms(14),
    marginBottom: ms(8),
  },
  sectionTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(13),
    color: colors.text,
  },
  sectionCount: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(10.5),
    color: colors.textLight,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(11),
    backgroundColor: "#FFFFFF",
    borderRadius: ms(14),
    padding: ms(11),
    marginBottom: ms(9),
    borderWidth: 1,
    borderColor: "#EEF0F4",
    borderLeftWidth: ms(4),
  },
  thumb: { width: ms(42), height: ms(42), borderRadius: ms(10) },
  thumbFallback: {
    backgroundColor: "#F4F6F9",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbEmoji: { fontSize: ms(18) },

  name: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(12.5),
    color: colors.text,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(7),
    marginTop: ms(2),
  },
  verdict: { fontFamily: "OpenSans_800ExtraBold", fontSize: ms(11) },
  atePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: ms(3),
    backgroundColor: "#CCFBF1",
    borderRadius: 999,
    paddingHorizontal: ms(6),
    paddingVertical: ms(2),
  },
  ateText: {
    fontFamily: "OpenSans_700Bold",
    fontSize: ms(8.5),
    color: "#0F766E",
  },
  nutri: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(10),
    color: colors.textLight,
    marginTop: ms(3),
  },
  allergens: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(9.5),
    color: "#92400E",
    marginTop: ms(2),
  },
  time: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(9.5),
    color: colors.textLight,
  },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: ms(30) },
  emptyEmoji: { fontSize: ms(42), marginBottom: ms(10) },
  emptyTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(15),
    color: colors.text,
  },
  emptyText: {
    fontFamily: "OpenSans_500Medium",
    fontSize: ms(11.5),
    color: colors.textLight,
    textAlign: "center",
    lineHeight: ms(17),
    marginTop: ms(5),
  },
});
