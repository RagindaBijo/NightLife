import { StyleSheet, Text, View } from 'react-native';

export default function Following() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Following Page</Text>
      {/* Add your following list or content here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 20,
    color: '#FFFFFF',
  },
});