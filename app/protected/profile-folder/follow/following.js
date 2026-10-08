import { StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../../../../lib/i18n';
import { makeStyles } from '../../../../lib/theme-context';

export default function Following() {
  const styles = useStyles();
  const { t } = useI18n();
  return (
    <View style={styles.container}>
      <Text style={styles.text}>{t('follow.followingPage')}</Text>
      {/* Add your following list or content here */}
    </View>
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 20,
    color: COLORS.text,
  },
}));