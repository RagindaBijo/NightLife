import { FontAwesome } from "@expo/vector-icons";
import { TouchableOpacity } from "react-native";
import { useI18n } from "../lib/i18n";
import { useTheme } from "../lib/theme-context";
import { interests } from "../lib/toggles";

/**
 * Check that marks / unmarks interest in an event. State is shared across screens.
 */
export default function InterestCheck({ eventId, style, size = 32, activeColor, inactiveColor }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const isInterested = interests.useValue(eventId);

  return (
    <TouchableOpacity
      onPress={() => interests.toggle(eventId)}
      style={style}
      accessibilityRole="button"
      accessibilityLabel={isInterested ? t("event.removeInterest") : t("event.markInterested")}
    >
      <FontAwesome
        name="check-square"
        size={size}
        color={isInterested ? activeColor ?? colors.accent : inactiveColor ?? colors.placeholder}
      />
    </TouchableOpacity>
  );
}
