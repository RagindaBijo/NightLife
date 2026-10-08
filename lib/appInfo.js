import Constants from "expo-constants";

// Facts about the app shown in Settings and the legal pages.
// Change them here and every screen picks them up.
export const APP_INFO = {
  name: "NightLife",
  version: Constants.expoConfig?.version ?? "1.0.0",
  // TODO: replace with the real support address before publishing
  supportEmail: "support@example.com",
  minimumAge: 18,
  governingLaw: "Georgia",
  legalUpdated: "2026-10-07", // YYYY-MM-DD, shown in the UI language
};
