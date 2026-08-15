import { StyleSheet, Text, View } from "react-native";

import { colors } from "../../constants/colors";
import { scaling } from "../../constants/useScaling";

const ms = (n) => scaling().moderateScale(n);

// Irregular widths so the mock reads as a real barcode at a glance.
const BARS = [2, 4, 2, 6, 3, 2, 5, 2, 3, 6, 2, 4, 3, 2, 5];

const ROWS = [
  ["Energy", "480 kcal"],
  ["Sugar", "31 g"],
  ["Fat", "22 g"],
  ["Salt", "0.6 g"],
];

/** Simplified barcode drawing — used as a "point at this" reference. */
export const BarcodeMock = ({ height = 46 }) => (
  <View style={[styles.barcode, { height: ms(height) }]}>
    {BARS.map((w, i) => (
      <View key={i} style={[styles.bar, { width: ms(w) }]} />
    ))}
  </View>
);

/**
 * Simplified nutrition table. Drawn rather than photographed so it stays
 * crisp at any size and carries no licensing baggage.
 */
export const NutritionTableMock = ({ compact = false }) => (
  <View style={[styles.table, compact && styles.tableCompact]}>
    <View style={styles.tableTop}>
      <Text style={styles.tableTitle}>Nutrition per 100g</Text>
    </View>
    {ROWS.map(([label, value], i) => (
      <View
        key={label}
        style={[styles.row, i === ROWS.length - 1 && styles.rowLast]}
      >
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  barcode: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: ms(2),
  },
  bar: { height: "100%", backgroundColor: colors.text, borderRadius: 1 },

  table: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: ms(8),
    borderWidth: 1,
    borderColor: "#D7DDE5",
    overflow: "hidden",
  },
  tableCompact: { maxWidth: ms(190), alignSelf: "center" },
  tableTop: {
    backgroundColor: "#EEF1F5",
    paddingVertical: ms(4),
    paddingHorizontal: ms(7),
  },
  tableTitle: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(7.5),
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: ms(3),
    paddingHorizontal: ms(7),
    borderBottomWidth: 1,
    borderBottomColor: "#EEF1F5",
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: {
    fontFamily: "OpenSans_600SemiBold",
    fontSize: ms(7.5),
    color: colors.textLight,
  },
  rowValue: {
    fontFamily: "OpenSans_800ExtraBold",
    fontSize: ms(7.5),
    color: colors.text,
  },
});
