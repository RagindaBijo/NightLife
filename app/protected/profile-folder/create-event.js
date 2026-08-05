import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Keyboard, Modal, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';

const days = Array.from({ length: 31 }, (_, i) => (i + 1).toString().padStart(2, '0'));
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const hours = Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(1, '0'));

function parseEventDateTime(timeStr) {
  const defaultValues = {
    selectedDay: '01',
    selectedMonth: 'January',
    eventHour: '8',
    eventPeriod: 'PM',
  };
  if (!timeStr) return defaultValues;

  const [datePart, timePart] = timeStr.split(': ');
  let selectedDay = '01';
  let selectedMonth = 'January';
  if (datePart) {
    const [day, month] = datePart.split('-').map(s => s.trim());
    selectedDay = days.includes(day) ? day : '01';
    selectedMonth = months.includes(month) ? month : 'January';
  }

  const eventHour = timePart ? timePart.slice(0, -2) : '8';
  const eventPeriod = timePart ? timePart.slice(-2) : 'PM';
  return { selectedDay, selectedMonth, eventHour, eventPeriod };
}

function formatEventDate(day, month) {
  return `${day}-${month}`;
}

export default function CreateEvent() {
  const navigation = useNavigation();
  const router = useRouter();
  const { eventId } = useLocalSearchParams();
  const isEditing = !!eventId;

  const [form, setForm] = useState({
    title: '',
    about: '',
    selectedDay: '01',
    selectedMonth: 'January',
    eventHour: '8',
    eventPeriod: 'PM',
    photo_uri: null,
    photo_id: null,
  });
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? 'Edit Event' : 'Create Event',
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerButtonText}>Cancel</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.headerButtonText}>{isEditing ? 'Update' : 'Create'}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, form, isEditing]);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) return;
      try {
        const token = await AsyncStorage.getItem('token');
        if (!token) {
          Alert.alert('Error', 'No token found. Please log in again.');
          return;
        }

        const apiUrl = 'https://night-life-api.elevator-rand.workers.dev';
        const response = await fetch(`${apiUrl}/api/events/${eventId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          const { selectedDay, selectedMonth, eventHour, eventPeriod } = parseEventDateTime(data.time || '');
          setForm({
            title: data.title || '',
            about: data.about || '',
            selectedDay,
            selectedMonth,
            eventHour,
            eventPeriod,
            photo_uri: data.photo_id || null,
            photo_id: data.photo_id ? data.photo_id.replace(`${apiUrl}/images/`, '') : null,
          });
        } else {
          Alert.alert('Error', 'Failed to fetch event data.');
        }
      } catch (error) {
        console.error('Fetch event error:', error);
        Alert.alert('Error', 'Failed to fetch event due to a network or server issue.');
      }
    };

    fetchEvent();
  }, [eventId]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 1,
    });

    if (!result.canceled) {
      setForm({ ...form, photo_uri: result.assets[0].uri, photo_id: null });
    }
  };

  const removeImage = () => {
    setForm({ ...form, photo_uri: null, photo_id: null });
  };

  const uploadImage = async () => {
    if (!form.photo_uri || form.photo_id) return form.photo_id;
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('No token found');
      }
      const apiUrl = 'https://night-life-api.elevator-rand.workers.dev';
      const formData = new FormData();
      const uriParts = form.photo_uri.split('.');
      const extension = uriParts[uriParts.length - 1];
      formData.append('file', {
        uri: form.photo_uri,
        name: `event-image.${extension}`,
        type: `image/${extension === 'jpg' || extension === 'jpeg' ? 'jpeg' : 'png'}`,
      });
      const response = await fetch(`${apiUrl}/api/upload-image?type=event${isEditing ? `&eventId=${eventId}` : ''}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload image');
      }
      const { key } = await response.json();
      return key;
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.about || !form.selectedDay || !form.selectedMonth || !form.photo_uri) {
      Alert.alert('Error', 'Please fill in title, about, select a valid date, and upload an image.');
      return;
    }

    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const userId = await AsyncStorage.getItem('userId');
      if (!token || !userId) {
        Alert.alert('Error', 'No token or user ID found. Please log in again.');
        setLoading(false);
        return;
      }

      const apiUrl = 'https://night-life-api.elevator-rand.workers.dev';
      const formattedDate = formatEventDate(form.selectedDay, form.selectedMonth);
      const time = `${formattedDate}: ${form.eventHour}${form.eventPeriod}`;
      const photo_id = await uploadImage();

      const requestBody = {
        venue_id: userId,
        title: form.title,
        time,
        about: form.about,
        photo_id,
      };

      const response = await fetch(
        isEditing ? `${apiUrl}/api/events/${eventId}` : `${apiUrl}/api/events`,
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (response.ok) {
        Alert.alert('Success', isEditing ? 'Event updated successfully!' : 'Event created successfully!');
        router.back();
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.error || `Failed to ${isEditing ? 'update' : 'create'} event.`);
      }
    } catch (error) {
      console.error(`${isEditing ? 'Update' : 'Create'} event failed:`, error);
      Alert.alert('Error', `Failed to ${isEditing ? 'update' : 'create'} event due to a network or server issue.`);
    }
    setLoading(false);
  };

  const handleOutsidePress = () => {
    Keyboard.dismiss();
    setShowDateModal(false);
    setShowTimeModal(false);
  };

  const formattedDate = formatEventDate(form.selectedDay, form.selectedMonth);

  return (
    <TouchableWithoutFeedback onPress={handleOutsidePress}>
      <View style={styles.container}>
        <Text style={styles.header}>Event Title</Text>
        <TextInput
          style={styles.input}
          value={form.title}
          onChangeText={(text) => setForm({ ...form, title: text })}
          placeholder="Enter event title"
          placeholderTextColor="#888888"
        />
        <Text style={styles.header}>About</Text>
        <TextInput
          style={[styles.input, styles.aboutInput]}
          value={form.about}
          onChangeText={(text) => setForm({ ...form, about: text })}
          placeholder="Enter event description"
          placeholderTextColor="#888888"
          multiline
        />
        <Text style={styles.header}>Event Date and Time</Text>
        <View style={styles.timeContainer}>
          <TouchableOpacity onPress={() => setShowDateModal(true)}>
            <Text style={styles.pressableText}>{formattedDate || 'Select Date'}</Text>
          </TouchableOpacity>
          <Text style={styles.separatorText}>: </Text>
          <TouchableOpacity onPress={() => setShowTimeModal(true)}>
            <Text style={styles.pressableText}>{form.eventHour}{form.eventPeriod}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.header}>Image {form.photo_uri ? '(1 selected)' : ''}</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
          <Text style={styles.uploadButtonText}>Upload Image</Text>
        </TouchableOpacity>
        {form.photo_uri && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: form.photo_uri }}
              style={styles.selectedImage}
              contentFit="cover"
            />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={removeImage}
            >
              <Text style={styles.removeButtonText}>X</Text>
            </TouchableOpacity>
          </View>
        )}
        {loading && <Text style={styles.header}>{isEditing ? 'Updating event...' : 'Creating event...'}</Text>}

        <Modal visible={showDateModal} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={() => setShowDateModal(false)}>
            <View style={styles.modalContainer}>
              <TouchableWithoutFeedback>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Select Event Date</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={form.selectedDay}
                      onValueChange={(itemValue) => setForm({ ...form, selectedDay: itemValue })}
                      style={styles.picker}
                    >
                      {days.map((d) => (
                        <Picker.Item key={d} label={d} value={d} />
                      ))}
                    </Picker>
                    <Picker
                      selectedValue={form.selectedMonth}
                      onValueChange={(itemValue) => setForm({ ...form, selectedMonth: itemValue })}
                      style={styles.picker}
                    >
                      {months.map((m) => (
                        <Picker.Item key={m} label={m} value={m} />
                      ))}
                    </Picker>
                  </View>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={() => setShowDateModal(false)}
                  >
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>

        <Modal visible={showTimeModal} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={() => setShowTimeModal(false)}>
            <View style={styles.modalContainer}>
              <TouchableWithoutFeedback>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>Select Event Time</Text>
                  <View style={styles.pickerContainer}>
                    <Picker
                      selectedValue={form.eventHour}
                      onValueChange={(itemValue) => setForm({ ...form, eventHour: itemValue })}
                      style={styles.picker}
                    >
                      {hours.map((h) => (
                        <Picker.Item key={h} label={h} value={h} />
                      ))}
                    </Picker>
                    <Picker
                      selectedValue={form.eventPeriod}
                      onValueChange={(itemValue) => setForm({ ...form, eventPeriod: itemValue })}
                      style={styles.picker}
                    >
                      <Picker.Item label="AM" value="AM" />
                      <Picker.Item label="PM" value="PM" />
                    </Picker>
                  </View>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={() => setShowTimeModal(false)}
                  >
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 20,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    alignSelf: 'flex-start',
    marginBottom: 10,
    marginTop: 20,
  },
  input: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 10,
    color: '#FFFFFF',
    width: '100%',
    marginBottom: 15,
    fontSize: 16,
  },
  aboutInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  pressableText: {
    fontSize: 16,
    color: '#3897f0',
    fontWeight: 'bold',
  },
  separatorText: {
    fontSize: 16,
    color: '#E0E0E0',
    marginHorizontal: 5,
  },
  uploadButton: {
    backgroundColor: '#1C2526',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 15,
  },
  uploadButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 15,
  },
  selectedImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#1E1E1E',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  picker: {
    color: '#FFFFFF',
    backgroundColor: '#333333',
    width: '45%',
    borderWidth: 1,
    borderColor: '#3897f0',
    borderRadius: 8,
  },
  confirmButton: {
    backgroundColor: '#1C2526',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    paddingHorizontal: 10,
  },
});