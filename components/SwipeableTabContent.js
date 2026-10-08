import { useEffect, useRef, useState } from "react";
import { Animated, PanResponder, useWindowDimensions } from "react-native";

const SWIPE_DISTANCE = 0.2; // part of the screen width that switches the tab
const SWIPE_VELOCITY = 0.4; // or a quick flick
const SLIDE = 0.35; // how far content slides while switching (part of the width)

/**
 * Wraps tab content so it can be swiped left / right to change tabs.
 * The content follows the finger, then the new tab slides in from that side.
 * Tapping a tab elsewhere (changing `index`) uses the same slide.
 * Only clearly horizontal swipes are taken, so vertical scrolling still works.
 */
export default function SwipeableTabContent({ index, count, onChange, style, children }) {
  const { width } = useWindowDimensions();
  const [translateX] = useState(() => new Animated.Value(0));
  const [opacity] = useState(() => new Animated.Value(1));
  const previousIndex = useRef(index);

  // The gesture handlers are created once, so they read the latest props from here
  const latest = useRef({ index, count, onChange, width });
  useEffect(() => {
    latest.current = { index, count, onChange, width };
  });

  // New tab slides in from the side it was swiped (or tapped) towards
  useEffect(() => {
    if (index === previousIndex.current) return;
    const direction = index > previousIndex.current ? 1 : -1;
    previousIndex.current = index;
    translateX.setValue(direction * width * SLIDE);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateX, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [index, width, translateX, opacity]);

  // `latest` is only read inside the gesture callbacks (never while rendering),
  // which the lint rule can't tell apart from a read during render
  // eslint-disable-next-line react-hooks/refs
  const [panResponder] = useState(() => {
    const springBack = () =>
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 6 }).start();

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        const { index: current, count: total } = latest.current;
        const atEdge = (g.dx > 0 && current === 0) || (g.dx < 0 && current === total - 1);
        // Resist at the first / last tab so it's clear there's nothing more
        translateX.setValue(g.dx * (atEdge ? 0.2 : 0.6));
      },
      onPanResponderRelease: (_, g) => {
        const { index: current, count: total, onChange: change, width: screenWidth } = latest.current;
        const far = Math.abs(g.dx) > screenWidth * SWIPE_DISTANCE;
        const fast = Math.abs(g.vx) > SWIPE_VELOCITY;
        let next = current;
        if ((far || fast) && g.dx < 0 && current < total - 1) next = current + 1;
        if ((far || fast) && g.dx > 0 && current > 0) next = current - 1;

        if (next === current) {
          springBack();
          return;
        }
        // Slide the old tab out, then switch (the effect above slides the new one in)
        Animated.parallel([
          Animated.timing(translateX, {
            toValue: (next > current ? -1 : 1) * screenWidth * SLIDE,
            duration: 120,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        ]).start(() => change(next));
      },
      onPanResponderTerminate: springBack,
    });
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[style, { opacity, transform: [{ translateX }] }]}
    >
      {children}
    </Animated.View>
  );
}
