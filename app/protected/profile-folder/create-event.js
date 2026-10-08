import { Picker } from '@react-native-picker/picker';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Alert, Keyboard, Modal, StyleSheet, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { API_URL, api, getSession } from '../../../lib/api';
import { translate, useI18n } from '../../../lib/i18n';
import { makeStyles, useTheme } from '../../../lib/theme-context';

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
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const monthLabel = (month) => t('months.long')[months.indexOf(month)] ?? month;
  const styles = useStyles();
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
      title: isEditing ? t('createEvent.editTitle') : t('createEvent.createTitle'),
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerButtonText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.headerButtonText}>{isEditing ? t('createEvent.update') : t('createEvent.create')}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, form, isEditing, styles, t]);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) return;
      try {
        const data = await api(`/api/events/${eventId}`);
        const { selectedDay, selectedMonth, eventHour, eventPeriod } = parseEventDateTime(data.time || '');
        setForm({
          title: data.title || '',
          about: data.about || '',
          selectedDay,
          selectedMonth,
          eventHour,
          eventPeriod,
          photo_uri: data.photo_id || null,
          photo_id: data.photo_id ? data.photo_id.replace(`${API_URL}/images/`, '') : null,
        });
      } catch (error) {
        console.error('Fetch event error:', error.message);
        // translate(), not t: re-running this effect on a language switch would reset the form
        Alert.alert(
          translate('common.error'),
          error.status === 0
            ? translate('createEvent.fetchNetworkError')
            : translate('createEvent.fetchError')
        );
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
      const formData = new FormData();
      formData.append('file', new File(form.photo_uri));
      const { key } = await api(`/api/upload-image?type=event${isEditing ? `&eventId=${eventId}` : ''}`, {
        method: 'POST',
        body: formData,
      });
      return key;
    } catch (error) {
      console.error('Image upload error:', error.message);
      throw error;
    }
  };

  const handleSave = async () => {
    if (!form.title || !form.about || !form.selectedDay || !form.selectedMonth || !form.photo_uri) {
      Alert.alert(t('common.error'), t('createEvent.missingFields'));
      return;
    }

    setLoading(true);
    try {
      const session = await getSession();
      if (!session) {
        Alert.alert(t('common.error'), t('api.loginAgain'));
        setLoading(false);
        return;
      }

      const formattedDate = formatEventDate(form.selectedDay, form.selectedMonth);
      const time = `${formattedDate}: ${form.eventHour}${form.eventPeriod}`;
      const photo_id = await uploadImage();

      const requestBody = {
        venue_id: session.userId,
        title: form.title,
        time,
        about: form.about,
        photo_id,
      };

      await api(isEditing ? `/api/events/${eventId}` : '/api/events', {
        method: isEditing ? 'PUT' : 'POST',
        body: requestBody,
      });

      Alert.alert(t('createEvent.success'), isEditing ? t('createEvent.updated') : t('createEvent.created'));
      router.back();
    } catch (error) {
      console.error(`${isEditing ? 'Update' : 'Create'} event failed:`, error.message);
      Alert.alert(
        t('common.error'),
        error.status === 0
          ? (isEditing ? t('createEvent.updateNetworkError') : t('createEvent.createNetworkError'))
          : error.message || (isEditing ? t('createEvent.updateFailed') : t('createEvent.createFailed'))
      );
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
        <Text style={styles.header}>{t('createEvent.eventTitle')}</Text>
        <TextInput
          style={styles.input}
          value={form.title}
          onChangeText={(text) => setForm({ ...form, title: text })}
          placeholder={t('createEvent.titlePlaceholder')}
          placeholderTextColor={COLORS.placeholder}
        />
        <Text style={styles.header}>{t('createEvent.about')}</Text>
        <TextInput
          style={[styles.input, styles.aboutInput]}
          value={form.about}
          onChangeText={(text) => setForm({ ...form, about: text })}
          placeholder={t('createEvent.aboutPlaceholder')}
          placeholderTextColor={COLORS.placeholder}
          multiline
        />
        <Text style={styles.header}>{t('createEvent.dateAndTime')}</Text>
        <View style={styles.timeContainer}>
          <TouchableOpacity onPress={() => setShowDateModal(true)}>
            <Text style={styles.pressableText}>
              {formattedDate ? `${form.selectedDay}-${monthLabel(form.selectedMonth)}` : t('createEvent.selectDate')}
            </Text>
          </TouchableOpacity>
          <Text style={styles.separatorText}>: </Text>
          <TouchableOpacity onPress={() => setShowTimeModal(true)}>
            <Text style={styles.pressableText}>{form.eventHour}{form.eventPeriod}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.header}>{form.photo_uri ? t('createEvent.imageSelected') : t('createEvent.image')}</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
          <Text style={styles.uploadButtonText}>{t('createEvent.uploadImage')}</Text>
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
        {loading && <Text style={styles.header}>{isEditing ? t('createEvent.updating') : t('createEvent.creating')}</Text>}

        <Modal visible={showDateModal} transparent animationType="fade">
          <TouchableWithoutFeedback onPress={() => setShowDateModal(false)}>
            <View style={styles.modalContainer}>
              <TouchableWithoutFeedback>
                <View style={styles.modalContent}>
                  <Text style={styles.modalTitle}>{t('createEvent.selectDateTitle')}</Text>
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
                        <Picker.Item key={m} label={monthLabel(m)} value={m} />
                      ))}
                    </Picker>
                  </View>
                  <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={() => setShowDateModal(false)}
                  >
                    <Text style={styles.confirmButtonText}>{t('common.confirm')}</Text>
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
                  <Text style={styles.modalTitle}>{t('createEvent.selectTimeTitle')}</Text>
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
                    <Text style={styles.confirmButtonText}>{t('common.confirm')}</Text>
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

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 20,
  },
  header: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    alignSelf: 'flex-start',
    marginBottom: 10,
    marginTop: 20,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    padding: 10,
    color: COLORS.text,
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
    color: COLORS.accent,
    fontWeight: 'bold',
  },
  separatorText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginHorizontal: 5,
  },
  uploadButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 15,
  },
  uploadButtonText: {
    color: COLORS.text,
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
    color: COLORS.text,
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
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 10,
    width: '80%',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 10,
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  picker: {
    color: COLORS.text,
    backgroundColor: COLORS.border,
    width: '45%',
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: 8,
  },
  confirmButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  headerButtonText: {
    color: COLORS.text,
    fontSize: 16,
    paddingHorizontal: 10,
  },
}));