import { FontAwesome } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, Modal, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function Settings() {
  const navigation = useNavigation();
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      headerShown: false, // Hide the default navigation header
    });
  }, [navigation]);

  const handleButtonPress = (buttonName) => {
    console.log(`${buttonName} button pressed`);
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('token');
              await AsyncStorage.removeItem('userId');
              await AsyncStorage.removeItem('userType');
              router.replace('/login');
            } catch (error) {
              console.error('Sign out failed:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Delete Account",
      'Are you sure you want to delete your account? This action is irreversible.',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('token');
              const userId = await AsyncStorage.getItem('userId');
              if (!token || !userId) {
                Alert.alert('Error', 'Not logged in. Please log in again.');
                router.replace('/login');
                return;
              }

              const apiUrl = 'https://night-life-api.elevator-rand.workers.dev';
              const response = await fetch(`${apiUrl}/api/user/${userId}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (response.ok) {
                await AsyncStorage.removeItem('token');
                await AsyncStorage.removeItem('userId');
                await AsyncStorage.removeItem('userType');
                router.replace('/login');
                Alert.alert('Success', 'Your account has been deleted.');
              } else {
                const errorData = await response.json();
                Alert.alert('Error', errorData.error || 'Failed to delete account.');
              }
            } catch (error) {
              console.error('Delete account failed:', error);
              Alert.alert('Error', 'Failed to delete account due to a network or server issue.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleQuestionsPress = () => {
    setModalVisible(true);
  };

  const handleContact = async (type) => {
    setModalVisible(false);
    try {
      let url;
      if (type === 'call') {
        url = 'tel:+1234567890';
      } else if (type === 'email') {
        url = 'mailto:support@example.com';
      } else if (type === 'text') {
        url = 'sms:+1234567890';
      }
      await Linking.openURL(url);
    } catch (error) {
      console.error(`Failed to open ${type}:`, error);
      Alert.alert('Error', `Failed to open ${type}. Please check your device settings.`);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>
      <ScrollView
        style={styles.content}
        contentContainerStyle={{ padding: 20, paddingBottom: 20 }}
      >
        {/* Account Section */}
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => handleButtonPress('Notifications')}
        >
          <Text style={styles.buttonText}>Notifications</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => handleButtonPress('Security')}
        >
          <Text style={styles.buttonText}>Security</Text>
        </TouchableOpacity>

        {/* Support Section */}
        <Text style={styles.sectionTitle}>Support</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/protected/settings-folder/feedback')}
        >
          <Text style={styles.buttonText}>Feedback</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={handleQuestionsPress}
        >
          <Text style={styles.buttonText}>Questions?</Text>
        </TouchableOpacity>

        {/* Legal Section */}
        <Text style={styles.sectionTitle}>Legal</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/protected/settings-folder/privacy-policy')}
        >
          <Text style={styles.buttonText}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.button}
          onPress={() => router.push('/protected/settings-folder/terms-conditions')}
        >
          <Text style={styles.buttonText}>Terms & Conditions of Use</Text>
        </TouchableOpacity>

        {/* Delete Account Section */}
        <Text style={styles.sectionTitle}>Delete Account</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={handleSignOut}
        >
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.deleteButton]}
          onPress={handleDeleteAccount}
        >
          <Text style={[styles.buttonText, styles.deleteButtonText]}>Delete Account</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Questions Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => handleContact('call')}
            >
              <FontAwesome name="phone" size={24} color="#FFFFFF" style={styles.icon} />
              <Text style={styles.modalButtonText}>Call</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => handleContact('email')}
            >
              <FontAwesome name="envelope" size={24} color="#FFFFFF" style={styles.icon} />
              <Text style={styles.modalButtonText}>Email</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => handleContact('text')}
            >
              <FontAwesome name="comment" size={24} color="#FFFFFF" style={styles.icon} />
              <Text style={styles.modalButtonText}>Text</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    backgroundColor: '#121212',
 
    borderBottomColor: '#333333',
    paddingVertical: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: 'Helvetica Neue',
  },
  content: {
    flex: 1,
    backgroundColor: '#121212',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 10,
  },
  button: {
    backgroundColor: '#1E1E1E',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  deleteButton: {
    backgroundColor: '#3C1A1A',
  },
  deleteButtonText: {
    color: '#FF4D4D',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  modalContent: {
    backgroundColor: '#070707ff',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
  },
  modalButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#011a6bff',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    width: '100%',
  },
  modalButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
    marginLeft: 10,
  },
  icon: {
    marginRight: 10,
  },
  closeButton: {
    marginTop: 10,
    padding: 10,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
});