import { Controller } from "react-hook-form";

import RulerCard from "./RulerCard";

/**
 * Age on the same ruler as height and weight, so all three body inputs feel
 * like one control. Writes the `age` field exactly as the old slider did (a
 * whole number of years).
 */
export default function AgeField({ control, name = "age", label, min = 13, max = 80, units = "years", index = 0 }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange } }) => {
        const n = Number(value);
        const v = Number.isFinite(n) && n > 0 ? Math.min(Math.max(Math.round(n), min), max) : 25;
        return (
          <RulerCard
            index={index}
            title={label}
            icon="calendar-outline"
            min={min}
            max={max}
            value={v}
            display={`${v}`}
            secondary={units}
            typeSuffix={units}
            onChange={onChange}
            onSettle={onChange}
          />
        );
      }}
    />
  );
}
