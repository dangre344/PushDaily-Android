import { Mixpanel } from "mixpanel-react-native";

const MIXPANEL_TOKEN = "3342707f6d2ec658953866e71502b736";

const trackAutomaticEvents = false;
const useNative = false; // Important for Expo JavaScript Mode

export const mixpanel = new Mixpanel(
  MIXPANEL_TOKEN,
  trackAutomaticEvents,
  useNative,
);

let isMixpanelReady = false;

export const initMixpanel = async () => {
  if (isMixpanelReady) return;

  try {
    await mixpanel.init();
    isMixpanelReady = true;
  } catch (error) {
    console.log("Mixpanel init error:", error);
  }
};

export const trackEvent = async (eventName, properties = {}) => {
  try {
    if (!isMixpanelReady) {
      await initMixpanel();
    }

    mixpanel.track(eventName, {
      ...properties,

      app_source: "PushDaily",
      tracked_at: new Date().toISOString(),
    });
  } catch (error) {
    console.log(`Mixpanel track error: ${eventName}`, error);
  }
};

export const identifyUser = async (userId, properties = {}) => {
  try {
    if (!isMixpanelReady) {
      await initMixpanel();
    }

    mixpanel.identify(String(userId));
    mixpanel.getPeople().set(properties);
  } catch (error) {
    console.log("Mixpanel identify error:", error);
  }
};

export const resetMixpanel = async () => {
  try {
    if (!isMixpanelReady) {
      await initMixpanel();
    }

    mixpanel.reset();
  } catch (error) {
    console.log("Mixpanel reset error:", error);
  }
};
