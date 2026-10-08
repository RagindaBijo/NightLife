import { MaterialIcons } from "@expo/vector-icons";
import { forwardRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useI18n } from "../../lib/i18n";
import { AUTH_COLORS as C } from "./authColors";

const STATUS_ICONS = {
  ok: { name: "check-circle", color: C.success },
  error: { name: "error", color: C.danger },
};

/**
 * Text field for the auth screens.
 * status: "ok" | "error" | "checking" | undefined – shown on the right
 * message: small text under the field (red when status is "error")
 */
const AuthInput = forwardRef(function AuthInput(
  { icon, secure = false, status, message, style, ...inputProps },
  ref,
) {
  const { t } = useI18n();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  return (
    <View style={style}>
      <View
        style={[
          styles.box,
          focused && styles.boxFocused,
          status === "error" && styles.boxError,
        ]}
      >
        <MaterialIcons
          name={icon}
          size={20}
          color={focused ? C.accent : C.textSecondary}
          style={styles.icon}
        />
        <TextInput
          ref={ref}
          style={styles.input}
          placeholderTextColor={C.placeholder}
          selectionColor={C.accent}
          secureTextEntry={secure && hidden}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...inputProps}
        />
        {status === "checking" && <ActivityIndicator size="small" color={C.accent} />}
        {STATUS_ICONS[status] && (
          <MaterialIcons
            name={STATUS_ICONS[status].name}
            size={20}
            color={STATUS_ICONS[status].color}
          />
        )}
        {secure && (
          <Pressable
            onPress={() => setHidden((value) => !value)}
            hitSlop={10}
            style={styles.eye}
            accessibilityRole="button"
            accessibilityLabel={hidden ? t("auth.showPassword") : t("auth.hidePassword")}
          >
            <MaterialIcons
              name={hidden ? "visibility-off" : "visibility"}
              size={20}
              color={C.textSecondary}
            />
          </Pressable>
        )}
      </View>
      {!!message && (
        <Text style={[styles.message, status === "error" && styles.messageError]}>{message}</Text>
      )}
    </View>
  );
});

export default AuthInput;

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 54,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: C.inputBackground,
  },
  boxFocused: {
    borderColor: C.inputBorderFocused,
  },
  boxError: {
    borderColor: C.danger,
  },
  icon: {
    marginRight: 2,
  },
  input: {
    flex: 1,
    height: "100%",
    color: C.text,
    fontSize: 16,
  },
  eye: {
    marginLeft: 4,
  },
  message: {
    color: C.textSecondary,
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },
  messageError: {
    color: C.danger,
  },
});
