import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useI18n } from "../lib/i18n";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

/**
 * Full-screen, swipeable photo viewer.
 */
export default function ImageGallery({ images, visible, initialIndex = 0, onClose }) {
  const insets = useSafeAreaInsets();
  const { t } = useI18n();
  const [index, setIndex] = useState(initialIndex);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => setIndex(initialIndex)}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <FlatList
          data={images}
          keyExtractor={(item, i) => `${i}-${item}`}
          horizontal
          pagingEnabled
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * i, index: i })}
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))
          }
          renderItem={({ item }) => (
            <View style={styles.page}>
              <Image source={{ uri: item }} style={styles.image} contentFit="contain" transition={200} />
            </View>
          )}
        />

        <View style={[styles.topBar, { top: insets.top + 8 }]}>
          {images.length > 1 ? (
            <Text style={styles.counter}>
              {index + 1} / {images.length}
            </Text>
          ) : (
            <View />
          )}
          <Pressable
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel={t("gallery.close")}
          >
            <MaterialIcons name="close" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        {images.length > 1 && (
          <View style={[styles.dots, { bottom: insets.bottom + 24 }]}>
            {images.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  page: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: "center",
  },
  image: {
    width: "100%",
    height: "80%",
  },
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  counter: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
  dots: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.35)",
  },
  dotActive: {
    backgroundColor: "#FFFFFF",
  },
});
