import { FontAwesome } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useI18n } from '../../../lib/i18n';
import { makeStyles, useTheme } from '../../../lib/theme-context';

// Mock data for the conversation (in a real app, fetch from API)
const mockUsers = {
  1: { userName: 'User1', userImage: 'https://picsum.photos/50/50?random=1' },
  2: { userName: 'User2', userImage: 'https://picsum.photos/50/50?random=2' },
  3: { userName: 'User3', userImage: 'https://picsum.photos/50/50?random=3' },
  4: { userName: 'User4', userImage: 'https://picsum.photos/50/50?random=4' },
  5: { userName: 'User5', userImage: 'https://picsum.photos/50/50?random=5' },
  6: { userName: 'User6', userImage: 'https://picsum.photos/50/50?random=6' },
  7: { userName: 'User7', userImage: 'https://picsum.photos/50/50?random=7' },
  8: { userName: 'User8', userImage: 'https://picsum.photos/50/50?random=8' },
};

const mockMessages = {
  1: [
    { id: 1, text: 'Hey, how’s it going?', sender: 'other', timestamp: '16 Sep, 9:00 AM' },
    { id: 2, text: 'Pretty good, you?', sender: 'self', timestamp: '16 Sep, 9:05 AM' },
    { id: 3, text: 'Just chilling, loved your post!', sender: 'other', timestamp: '16 Sep, 9:10 AM' },
    { id: 4, text: 'Thanks! Which one?', sender: 'self', timestamp: '16 Sep, 9:12 AM' },
    { id: 5, text: 'The sunset one, so vibrant!', sender: 'other', timestamp: '16 Sep, 9:15 AM' },
    { id: 6, text: 'Glad you liked it!', sender: 'self', timestamp: '16 Sep, 9:20 AM' },
    { id: 7, text: 'Got any more pics like that?', sender: 'other', timestamp: '16 Sep, 9:25 AM' },
    { id: 8, text: 'Yeah, I’ll post some soon!', sender: 'self', timestamp: '16 Sep, 9:30 AM' },
    { id: 9, text: 'Can’t wait to see them!', sender: 'other', timestamp: '16 Sep, 9:35 AM' },
    { id: 10, text: 'Haha, thanks for the hype!', sender: 'self', timestamp: '16 Sep, 9:40 AM' },
    { id: 11, text: 'Any plans for the weekend?', sender: 'other', timestamp: '17 Sep, 10:00 AM' },
    { id: 12, text: 'Maybe a hike, you?', sender: 'self', timestamp: '17 Sep, 10:05 AM' },
    { id: 13, text: 'Nice! I’m thinking beach day.', sender: 'other', timestamp: '17 Sep, 10:10 AM' },
    { id: 14, text: 'That sounds awesome!', sender: 'self', timestamp: '17 Sep, 10:15 AM' },
    { id: 15, text: 'Wanna join?', sender: 'other', timestamp: '17 Sep, 10:20 AM' },
    { id: 16, text: 'Tempting! Let me check my schedule.', sender: 'self', timestamp: '17 Sep, 10:25 AM' },
    { id: 17, text: 'Cool, let me know!', sender: 'other', timestamp: '17 Sep, 10:30 AM' },
    { id: 18, text: 'Will do!', sender: 'self', timestamp: '17 Sep, 10:32 AM' },
    { id: 19, text: 'Btw, that sunset pic was 🔥', sender: 'other', timestamp: '17 Sep, 10:35 AM' },
    { id: 20, text: 'Haha, appreciate it!', sender: 'self', timestamp: '17 Sep, 10:40 AM' },
  ],
  2: [
    { id: 1, text: 'Are you going to the event?', sender: 'other', timestamp: '16 Sep, 3:15 PM' },
    { id: 2, text: 'Yeah, thinking about it!', sender: 'self', timestamp: '16 Sep, 3:20 PM' },
  ],
  3: [
    { id: 1, text: 'Check out this venue!', sender: 'other', timestamp: '15 Sep, 9:00 AM' },
    { id: 2, text: 'Looks cool, where is it?', sender: 'self', timestamp: '15 Sep, 9:05 AM' },
  ],
  4: [
    { id: 1, text: 'Great photo!', sender: 'other', timestamp: '14 Sep, 6:45 PM' },
    { id: 2, text: 'Thanks, glad you like it!', sender: 'self', timestamp: '14 Sep, 6:50 PM' },
  ],
  5: [
    { id: 1, text: 'Let’s meet up soon.', sender: 'other', timestamp: '13 Sep, 11:20 AM' },
    { id: 2, text: 'Definitely, when are you free?', sender: 'self', timestamp: '13 Sep, 11:25 AM' },
  ],
  6: [
    { id: 1, text: 'Amazing sunset pic!', sender: 'other', timestamp: '12 Sep, 7:10 PM' },
    { id: 2, text: 'Appreciate it!', sender: 'self', timestamp: '12 Sep, 7:15 PM' },
  ],
  7: [
    { id: 1, text: 'How’s it going?', sender: 'other', timestamp: '11 Sep, 2:30 PM' },
    { id: 2, text: 'Pretty good, you?', sender: 'self', timestamp: '11 Sep, 2:35 PM' },
  ],
  8: [
    { id: 1, text: 'Loved the city vibes.', sender: 'other', timestamp: '10 Sep, 8:00 AM' },
    { id: 2, text: 'Thanks! City life is the best.', sender: 'self', timestamp: '10 Sep, 8:05 AM' },
  ],
};

export default function ChatDetail() {
  const { colors: COLORS } = useTheme();
  const { t } = useI18n();
  const styles = useStyles();
  const { chatId } = useLocalSearchParams();
  const router = useRouter();
  const user = mockUsers[chatId] || { userName: 'Unknown', userImage: 'https://picsum.photos/50/50?random=0' };
  const messages = mockMessages[chatId] || [];
  const scrollViewRef = useRef(null);

  // Auto-scroll to bottom on mount
  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: false });
    }
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.customHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <FontAwesome name="arrow-left" size={20} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerUserInfo}>
          <Image source={{ uri: user.userImage }} style={styles.userImage} contentFit="cover" />
          <Text style={styles.userName}>{user.userName}</Text>
        </View>
      </View>
      <ScrollView
        style={styles.messageContainer}
        contentContainerStyle={{ flexGrow: 1, paddingTop: 10, paddingBottom: 10 }}
        ref={scrollViewRef}
        showsVerticalScrollIndicator={true}
      >
        {messages.map(message => (
          <View
            key={message.id}
            style={[
              styles.messageBubble,
              message.sender === 'self' ? styles.selfMessage : styles.otherMessage,
            ]}
          >
            <Text style={styles.messageText}>{message.text}</Text>
            <Text style={styles.messageTimestamp}>{message.timestamp}</Text>
          </View>
        ))}
      </ScrollView>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 47 : 10}
        automaticallyAdjustKeyboardInsets={true}
      >
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            placeholder={t('chat.messagePlaceholder')}
            placeholderTextColor={COLORS.textSecondary}
          />
          <TouchableOpacity style={styles.sendButton}>
            <FontAwesome name="paper-plane" size={20} color={COLORS.accentStrong} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const useStyles = makeStyles((COLORS) => ({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfacePressed,
  },
  backButton: {
    paddingRight: 12,
  },
  headerUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  userImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  userName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Helvetica Neue',
    marginLeft: 10,
  },
  messageContainer: {
    flex: 1,
    paddingHorizontal: 12,
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 10,
    marginVertical: 5,
    borderRadius: 12,
  },
  selfMessage: {
    alignSelf: 'flex-end',
    backgroundColor: COLORS.accentStrong,
  },
  otherMessage: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surfacePressed,
  },
  messageText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '400',
    fontFamily: 'Helvetica Neue',
  },
  messageTimestamp: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '400',
    fontFamily: 'Helvetica Neue',
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: COLORS.backgroundElevated,
    borderTopWidth: 1,
    borderTopColor: COLORS.surfacePressed,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.surfacePressed,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '400',
    fontFamily: 'Helvetica Neue',
    paddingVertical: 15,
    paddingHorizontal: 12,
    borderRadius: 15,
    marginRight: 5,
  },
  sendButton: {
    padding: 8,
  },
}));