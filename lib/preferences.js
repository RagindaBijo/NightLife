// What people can pick as their taste (shown on Discover cards).
// Keys must match MUSIC_GENRES / PLACE_TYPES in the worker (api/src/shared.js).
// Labels: music.<key> and venueTypes.<key> in the locale files.
import { translate } from "./i18n";
import { venueTypeIcon } from "./venueTypes";

export const MIN_PREFERENCES = 3;
export const MAX_PREFERENCES = 10;

// MaterialCommunityIcons names
export const MUSIC_GENRES = [
  { key: "techno", icon: "sine-wave" },
  { key: "house", icon: "home-sound-in" },
  { key: "deep_house", icon: "waveform" },
  { key: "electronic", icon: "lightning-bolt" },
  { key: "drum_and_bass", icon: "speaker" },
  { key: "trance", icon: "infinity" },
  { key: "hip_hop", icon: "microphone-variant" },
  { key: "rnb", icon: "heart-pulse" },
  { key: "pop", icon: "star-four-points" },
  { key: "rock", icon: "guitar-electric" },
  { key: "indie", icon: "guitar-acoustic" },
  { key: "metal", icon: "skull" },
  { key: "jazz", icon: "saxophone" },
  { key: "reggaeton", icon: "palm-tree" },
  { key: "latin", icon: "music-clef-treble" },
  { key: "disco_funk", icon: "album" },
  { key: "georgian", icon: "music-circle" },
];

// Kinds of places (a subset of the venue styles, without the music ones)
export const PLACE_TYPES = [
  "nightclub", "disco", "live_music", "karaoke", "bar", "pub", "lounge",
  "cocktail_bar", "wine_bar", "rooftop", "beach_bar", "restaurant_bar",
].map((key) => ({ key, icon: venueTypeIcon(key) }));

const MUSIC_ICONS = Object.fromEntries(MUSIC_GENRES.map((g) => [g.key, g.icon]));

export const musicLabel = (key) => translate(`music.${key}`);
export const musicIcon = (key) => MUSIC_ICONS[key] ?? "music-note";
export const placeLabel = (key) => translate(`venueTypes.${key}`);
export const placeIcon = (key) => venueTypeIcon(key);
