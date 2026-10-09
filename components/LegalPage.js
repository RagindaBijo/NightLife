import { MaterialIcons } from "@expo/vector-icons";
import { ScrollView, Text, View } from "react-native";
import { useI18n } from "../lib/i18n";
import { makeStyles, useTheme } from "../lib/theme-context";

/**
 * Readable layout for legal texts.
 * sections: [{ title, paragraphs?: string[], bullets?: string[] }]
 */
export default function LegalPage({ icon, title, intro, updated, sections }) {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <MaterialIcons name={icon} size={28} color={COLORS.accent} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.updatedChip}>
          <MaterialIcons name="update" size={14} color={COLORS.textSecondary} />
          <Text style={styles.updatedText}>{t("legal.lastUpdated", { date: updated })}</Text>
        </View>
        {!!intro && <Text style={styles.intro}>{intro}</Text>}
      </View>

      {sections.map((section, index) => (
        <View key={section.title} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionNumber}>{index + 1}</Text>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
          {section.paragraphs?.map((paragraph) => (
            <Text key={paragraph} style={styles.paragraph}>
              {paragraph}
            </Text>
          ))}
          {section.bullets?.map((bullet) => (
            <View key={bullet} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{bullet}</Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  hero: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 10,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  updatedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  updatedText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: "600",
  },
  intro: {
    color: COLORS.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sectionNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: "hidden",
    backgroundColor: COLORS.accentSoft,
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
    lineHeight: 26,
  },
  sectionTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  paragraph: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  bulletRow: {
    flexDirection: "row",
    gap: 10,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.accent,
    marginTop: 8,
  },
  bulletText: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
}));
