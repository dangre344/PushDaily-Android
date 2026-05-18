import { Logger } from "./Logger";

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

export const getCurrentDateTime = () => {
  const now = new Date().toISOString();
  Logger.log("getCurrentDateTime------>", now);

  return now;
};

export const getShortBodyPartName = (bodyPart) => {
  if (bodyPart === "Upper Body") return "Upper";
  else if (bodyPart === "Lower Body") return "Lower";
  else if (bodyPart === "Core") return "Core";
  else if (bodyPart === "Full Body") return "Full";
  else if (bodyPart === "Shoulder") return "Shld";
  else if (bodyPart === "Chest") return "Chest";
  else if (bodyPart === "Arms") return "Arms";
  else if (bodyPart === "Legs") return "Legs";
  else if (bodyPart === "Abs") return "Abs";
  else if (bodyPart === "Back") return "Back";
  else return bodyPart;
};

export const createUniqueId = () => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
};
