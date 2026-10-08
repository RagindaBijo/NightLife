import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { favorites } from "../lib/toggles";

/**
 * Star that favorites / unfavorites a venue. State is shared across screens.
 */
export default function FavoriteStar({ venueId, style, inactiveColor = "#FFFFFF" }) {
  const isFavorite = favorites.useValue(venueId);

  return (
    <TouchableOpacity onPress={() => favorites.toggle(venueId)} style={style}>
      <Text style={[styles.star, { color: isFavorite ? "#FBBF24" : inactiveColor }]}>
        ★
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  star: {
    fontSize: 32,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
});
