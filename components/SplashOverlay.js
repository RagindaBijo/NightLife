import { Image } from "expo-image";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

// Keep the native splash up until this overlay (same black + logo) has taken over
SplashScreen.preventAutoHideAsync().catch(() => {});

const LOGO = require("../assets/images/logo-glow.png");
const GLOW = require("../assets/images/auth-glow.png"); // soft white radial glow, tinted below
const SHOW_MS = 1200; // how long the logo stays before fading out
const FADE_MS = 300;

/**
 * Opening screen: the big logo with a pulsing neon glow for about 1.2 s, then
 * fades into the app (which loads underneath in the meantime). Always dark,
 * matching the native splash so the hand-over is invisible.
 */
export default function SplashOverlay() {
  const [visible, setVisible] = useState(true);
  const [intro] = useState(() => new Animated.Value(0)); // logo grows in
  const [pulse] = useState(() => new Animated.Value(0)); // glow breathes
  const [opacity] = useState(() => new Animated.Value(1)); // whole overlay

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
    Animated.timing(intro, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    breathe.start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: FADE_MS, useNativeDriver: true }).start(() => {
        breathe.stop();
        setVisible(false);
      });
    }, SHOW_MS);
    return () => {
      clearTimeout(timer);
      breathe.stop();
    };
  }, [intro, pulse, opacity]);

  if (!visible) return null;

  const logoScale = intro.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.screen, { opacity }]} pointerEvents="none">
      <View style={styles.center}>
        <Animated.View style={[styles.glowWrap, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}>
          <Image source={GLOW} tintColor="#E21CFF" style={styles.glowPink} />
          <Image source={GLOW} tintColor="#FF6A1A" style={styles.glowOrange} />
        </Animated.View>
        <Animated.View style={{ transform: [{ scale: logoScale }] }}>
          <Image source={LOGO} style={styles.logo} contentFit="contain" />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: "#000000",
    zIndex: 1000,
    elevation: 1000,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  glowWrap: {
    position: "absolute",
    width: 460,
    height: 460,
    alignItems: "center",
    justifyContent: "center",
  },
  // Magenta around the whole logo, orange towards the flames at the top
  glowPink: {
    position: "absolute",
    width: 460,
    height: 460,
    top: 0,
    left: 0,
  },
  glowOrange: {
    position: "absolute",
    width: 300,
    height: 300,
    top: 40,
    left: 80,
  },
  logo: {
    width: 240,
    height: 240,
  },
});
