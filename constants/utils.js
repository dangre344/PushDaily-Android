export const daysArr = (t) => [
  t("Mon"),
  t("Tue"),
  t("Wed"),
  t("Thu"),
  t("Fri"),
  t("Sat"),
  t("Sun"),
];

export const getDay = (day) => {
  if (day === 0) return "Mon";
  else if (day === 1) return "Tue";
  else if (day === 2) return "Wed";
  else if (day === 3) return "Thu";
  else if (day === 4) return "Fri";
  else if (day === 5) return "Sat";
  else if (day === 6) return "Sun";

  return "";
};
