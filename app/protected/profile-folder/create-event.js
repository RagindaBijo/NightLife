import { Picker } from '@react-native-picker/picker';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Keyboard, Modal, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { API_URL, api, getSession } from '../../../lib/api';
import { formatClock } from '../../../lib/format';
import { translate, useI18n } from '../../../lib/i18n';
import { makeStyles, useTheme } from '../../../lib/theme-context';

const LEGACY_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MINUTES = [0, 15, 30, 45];

const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();

/** Default for a new event: tomorrow at 22:00. */
function defaultStart() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(22, 0, 0, 0);
  return date;
}

/**
 * Start time of an existing event as a Date. Reads the real start time, or the
 * old text format ("05-March: 8PM", no year → its next occurrence).
 */
function startOf(event) {
  if (event.starts_at) {
    const date = new Date(event.starts_at);
    if (!isNaN(date.getTime())) return date;
  }
  const match = /^(\d{1,2})-([A-Za-z]+):\s*(\d{1,2})\s*(AM|PM)$/i.exec(event.time || '');
  if (!match) return defaultStart();
  const month = LEGACY_MONTHS.findIndex((name) => name.startsWith(match[2].slice(0, 3).toLowerCase()));
  const hour = (Number(match[3]) % 12) + (match[4].toUpperCase() === 'PM' ? 12 : 0);
  const date = new Date(new Date().getFullYear(), Math.max(month, 0), Number(match[1]), hour, 0, 0, 0);
  if (date < new Date()) date.setFullYear(date.getFullYear() + 1);
  return date;
}

/** Date → the picker values ({ year, month, day, hour, minute }). */
const toParts = (date) => ({
  year: date.getFullYear(),
  month: date.getMonth(),
  day: date.getDate(),
  hour: date.getHours(),
  minute: MINUTES.includes(date.getMinutes()) ? date.getMinutes() : 0,
});

const fromParts = ({ year, month, day, hour, minute }) =>
  new Date(year, month, Math.min(day, daysInMonth(year, month)), hour, minute, 0, 0);

export default function CreateEvent() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const use24h = t('format.timeStyle') === '24h';
  const styles = useStyles();
  const navigation = useNavigation();
  const router = useRouter();
  const { eventId } = useLocalSearchParams();
  const isEditing = !!eventId;

  const [form, setForm] = useState(() => ({
    title: '',
    about: '',
    ...toParts(defaultStart()),
    photo_uri: null,
    photo_id: null,
  }));
  // When editing, the start time is only sent if it was changed
  const [originalStart, setOriginalStart] = useState(null);
  const [showDateModal, setShowDateModal] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const saveRef = useRef(null); // the header's Save button always runs the latest handleSave

  const start = fromParts(form);
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear + 1];
  const dayCount = daysInMonth(form.year, form.month);
  const setPart = (part) => (value) => setForm((prev) => ({ ...prev, [part]: Number(value) }));

  useLayoutEffect(() => {
    navigation.setOptions({
      title: isEditing ? t('createEvent.editTitle') : t('createEvent.createTitle'),
      headerLeft: () => (
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.headerButtonText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={() => saveRef.current?.()}>
          <Text style={styles.headerButtonText}>{isEditing ? t('createEvent.update') : t('createEvent.create')}</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, router, isEditing, styles, t]);

  useEffect(() => {
    const fetchEvent = async () => {
      if (!eventId) return;
      try {
        const data = await api(`/api/events/${eventId}`);
        const startDate = startOf(data);
        setOriginalStart(data.starts_at ? startDate.toISOString() : null);
        setForm({
          title: data.title || '',
          about: data.about || '',
          ...toParts(startDate),
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
      mediaTypes: ['images'],
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
    if (!form.title || !form.about || !form.photo_uri) {
      Alert.alert(t('common.error'), t('createEvent.missingFields'));
      return;
    }
    const startsAt = fromParts(form).toISOString();
    const startChanged = startsAt !== originalStart;
    if (startChanged && new Date(startsAt) < new Date()) {
      Alert.alert(t('common.error'), t('createEvent.inPast'));
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

      const photo_id = await uploadImage();

      const requestBody = {
        venue_id: session.userId,
        title: form.title,
        about: form.about,
        photo_id,
        // Unchanged start time isn't re-sent (an event that already started can still be edited)
        ...(startChanged ? { starts_at: startsAt } : {}),
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
        error.code === 'starts_at_past'
          ? t('createEvent.inPast')
          : error.status === 0
            ? (isEditing ? t('createEvent.updateNetworkError') : t('createEvent.createNetworkError'))
            : error.message || (isEditing ? t('createEvent.updateFailed') : t('createEvent.createFailed'))
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    saveRef.current = handleSave;
  });

  const handleOutsidePress = () => {
    Keyboard.dismiss();
    setShowDateModal(false);
    setShowTimeModal(false);
  };

  // 12-hour pickers (English): hour 1–12 + AM/PM; 24-hour: 0–23
  const hour12 = form.hour % 12 || 12;
  const period = form.hour < 12 ? 'AM' : 'PM';
  const setHour12 = (value, nextPeriod = period) =>
    setForm((prev) => ({ ...prev, hour: (Number(value) % 12) + (nextPeriod === 'PM' ? 12 : 0) }));

  return (
    <TouchableWithoutFeedback onPress={handleOutsidePress}>
      <View style={styles.container}>
        <Text style={styles.header}>{t('createEvent.eventTitle')}</Text>
        <TextInput
          style={styles.input}
          value={form.title}
          onChangeText={(text) => setForm({ ...form, title: text })}
          placeholder={t('createEvent.titlePlaceholder')}
          maxLength={100}
          placeholderTextColor={COLORS.placeholder}
        />
        <Text style={styles.header}>{t('createEvent.about')}</Text>
        <TextInput
          style={[styles.input, styles.aboutInput]}
          value={form.about}
          onChangeText={(text) => setForm({ ...form, about: text })}
          placeholder={t('createEvent.aboutPlaceholder')}
          maxLength={2000}
          placeholderTextColor={COLORS.placeholder}
          multiline
        />
        <Text style={styles.header}>{t('createEvent.dateAndTime')}</Text>
        <View style={styles.timeContainer}>
          <TouchableOpacity onPress={() => setShowDateModal(true)}>
            <Text style={styles.pressableText}>
              {`${form.day} ${t('months.long')[form.month]} ${form.year}`}
            </Text>
          </TouchableOpacity>
          <Text style={styles.separatorText}> · </Text>
          <TouchableOpacity onPress={() => setShowTimeModal(true)}>
            <Text style={styles.pressableText}>{formatClock(start)}</Text>
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
                      selectedValue={Math.min(form.day, dayCount)}
                      onValueChange={setPart('day')}
                      style={[styles.picker, styles.pickerThird]}
                    >
                      {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
                        <Picker.Item key={d} label={String(d)} value={d} />
                      ))}
                    </Picker>
                    <Picker
                      selectedValue={form.month}
                      onValueChange={setPart('month')}
                      style={[styles.picker, styles.pickerThird]}
                    >
                      {t('months.long').map((label, index) => (
                        <Picker.Item key={label} label={label} value={index} />
                      ))}
                    </Picker>
                    <Picker
                      selectedValue={form.year}
                      onValueChange={setPart('year')}
                      style={[styles.picker, styles.pickerThird]}
                    >
                      {years.map((y) => (
                        <Picker.Item key={y} label={String(y)} value={y} />
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
                    {use24h ? (
                      <Picker
                        selectedValue={form.hour}
                        onValueChange={setPart('hour')}
                        style={[styles.picker, styles.pickerThird]}
                      >
                        {Array.from({ length: 24 }, (_, h) => h).map((h) => (
                          <Picker.Item key={h} label={String(h).padStart(2, '0')} value={h} />
                        ))}
                      </Picker>
                    ) : (
                      <Picker
                        selectedValue={hour12}
                        onValueChange={(value) => setHour12(value)}
                        style={[styles.picker, styles.pickerThird]}
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                          <Picker.Item key={h} label={String(h)} value={h} />
                        ))}
                      </Picker>
                    )}
                    <Picker
                      selectedValue={form.minute}
                      onValueChange={setPart('minute')}
                      style={[styles.picker, styles.pickerThird]}
                    >
                      {MINUTES.map((m) => (
                        <Picker.Item key={m} label={String(m).padStart(2, '0')} value={m} />
                      ))}
                    </Picker>
                    {!use24h && (
                      <Picker
                        selectedValue={period}
                        onValueChange={(value) => setHour12(hour12, value)}
                        style={[styles.picker, styles.pickerThird]}
                      >
                        <Picker.Item label="AM" value="AM" />
                        <Picker.Item label="PM" value="PM" />
                      </Picker>
                    )}
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
  pickerThird: {
    width: '32%',
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