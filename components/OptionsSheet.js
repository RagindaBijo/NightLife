import { MaterialIcons } from "@expo/vector-icons";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useI18n } from "../lib/i18n";
import { makeStyles, useTheme } from "../lib/theme-context";

/**
 * Bottom sheet with a list of actions, e.g. "Delete post".
 * options: [{ label, icon, destructive, onPress }]
 */
export default function OptionsSheet({ visible, title, options, onClose }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          {!!title && <Text style={styles.title}>{title}</Text>}
          {options.map((option) => (
            <Pressable
              key={option.label}
              onPress={() => {
                onClose();
                option.onPress();
              }}
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
              accessibilityRole="button"
            >
              <MaterialIcons
                name={option.icon}
                size={22}
                color={option.destructive ? COLORS.danger : COLORS.text}
              />
              <Text style={[styles.optionText, option.destructive && styles.destructive]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.cancel, pressed && styles.optionPressed]}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>{t("common.cancel")}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((COLORS) => ({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
  },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 8,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginTop: 10,
    marginBottom: 8,
  },
  title: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 6,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  optionPressed: {
    backgroundColor: COLORS.surfacePressed,
  },
  optionText: {
    color: COLORS.text,
    fontSize: 16,
  },
  destructive: {
    color: COLORS.danger,
    fontWeight: "600",
  },
  cancel: {
    marginTop: 6,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
  },
  cancelText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
  },
}));
