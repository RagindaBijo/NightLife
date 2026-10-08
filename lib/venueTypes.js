// Venue styles (keys must match VENUE_TYPES in the worker).
// Icons are MaterialCommunityIcons names. Labels live in the locale files (venueTypes.<key>).
import { translate } from "./i18n";

export const VENUE_TYPES = [
  { key: "nightclub", icon: "party-popper" },
  { key: "disco", icon: "speaker" },
  { key: "techno", icon: "sine-wave" },
  { key: "hip_hop", icon: "microphone-variant" },
  { key: "jazz", icon: "saxophone" },
  { key: "rock", icon: "guitar-electric" },
  { key: "live_music", icon: "music-note" },
  { key: "karaoke", icon: "microphone" },
  { key: "bar", icon: "glass-mug-variant" },
  { key: "pub", icon: "beer" },
  { key: "lounge", icon: "sofa" },
  { key: "cocktail_bar", icon: "glass-cocktail" },
  { key: "wine_bar", icon: "glass-wine" },
  { key: "rooftop", icon: "office-building" },
  { key: "beach_bar", icon: "beach" },
  { key: "restaurant_bar", icon: "silverware-fork-knife" },
];

const BY_KEY = Object.fromEntries(VENUE_TYPES.map((type) => [type.key, type]));

export const venueTypeLabel = (key) => (BY_KEY[key] ? translate(`venueTypes.${key}`) : key);
export const venueTypeIcon = (key) => BY_KEY[key]?.icon ?? "map-marker";
