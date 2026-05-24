import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
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

const BADGE_STORAGE_KEY = "userBadge";

export const saveUserBadge = async (badge) => {
  Logger.log("Saving user badge:", badge);
  try {
    await AsyncStorage.setItem(BADGE_STORAGE_KEY, JSON.stringify(badge));
  } catch (error) {
    Logger.log("Error saving badge:", error);
  }
};

export const checkScheduledNotifications = async () => {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();

    console.log("Scheduled notifications:", JSON.stringify(scheduled, null, 2));

    scheduled.forEach((item, index) => {
      console.log(`Notification ${index + 1}`);
      console.log("ID:", item.identifier);
      console.log("Title:", item.content?.title);
      console.log("Body:", item.content?.body);
      console.log("Trigger:", item.trigger);
    });

    return scheduled;
  } catch (error) {
    console.log("Error checking scheduled notifications:", error);
    return [];
  }
};

export const getStoredUserBadge = async () => {
  try {
    const badgeString = await AsyncStorage.getItem(BADGE_STORAGE_KEY);

    if (!badgeString) return null;

    return JSON.parse(badgeString);
  } catch (error) {
    console.log("Error getting badge:", error);
    return null;
  }
};

export const removeStoredUserBadge = async () => {
  try {
    await AsyncStorage.removeItem(BADGE_STORAGE_KEY);
  } catch (error) {
    console.log("Error removing badge:", error);
  }
};

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
