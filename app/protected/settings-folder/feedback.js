import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

export default function Feedback() {
  const router = useRouter();
  const [feedbackText, setFeedbackText] = useState('');

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) {
      Alert.alert('Error', 'Please enter some feedback.');
      return;
    }

    try {
      // TODO: Replace with actual API endpoint to send feedback
      const apiUrl = 'https://your-api.example.com/feedback'; // Placeholder
      const token = ''; // TODO: Get token from AsyncStorage if needed

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ feedback: feedbackText }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Feedback sent successfully!');
        setFeedbackText('');
        router.back();
      } else {
        Alert.alert('Error', 'Failed to send feedback.');
      }
    } catch (error) {
      console.error('Send feedback failed:', error);
      Alert.alert('Error', 'Failed to send feedback due to a network issue.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Provide Feedback</Text>
      <TextInput
        style={styles.input}
        multiline
        numberOfLines={10}
        placeholder="Enter your feedback here..."
        placeholderTextColor="#888888"
        value={feedbackText}
        onChangeText={setFeedbackText}
      />
      <TouchableOpacity style={styles.sendButton} onPress={handleSendFeedback}>
        <Text style={styles.sendButtonText}>Send</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 15,
    color: '#FFFFFF',
    fontSize: 16,
    height: 200,
    textAlignVertical: 'top',
  },
  sendButton: {
    backgroundColor: '#1E1E1E',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});