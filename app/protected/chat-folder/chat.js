import { Image } from 'expo-image';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const mockChats = [
  { id: 1, userName: 'User1', userImage: 'https://picsum.photos/50/50?random=1', latestMessage: 'Hey, loved your post!', timestamp: '17 Sep' },
  { id: 2, userName: 'User2', userImage: 'https://picsum.photos/50/50?random=2', latestMessage: 'Are you going to the event?', timestamp: '16 Sep' },
  { id: 3, userName: 'User3', userImage: 'https://picsum.photos/50/50?random=3', latestMessage: 'Check out this venue!', timestamp: '15 Sep' },
  { id: 4, userName: 'User4', userImage: 'https://picsum.photos/50/50?random=4', latestMessage: 'Great photo!', timestamp: '14 Sep' },
  { id: 5, userName: 'User5', userImage: 'https://picsum.photos/50/50?random=5', latestMessage: 'Let’s meet up soon.', timestamp: '13 Sep' },
  { id: 6, userName: 'User6', userImage: 'https://picsum.photos/50/50?random=6', latestMessage: 'Amazing sunset pic!', timestamp: '12 Sep' },
  { id: 7, userName: 'User7', userImage: 'https://picsum.photos/50/50?random=7', latestMessage: 'How’s it going?', timestamp: '11 Sep' },
  { id: 8, userName: 'User8', userImage: 'https://picsum.photos/50/50?random=8', latestMessage: 'Loved the city vibes.', timestamp: '10 Sep' },
];

export default function Chat() {
  const router = useRouter();
  const navigation = useNavigation();

  useEffect(() => {
    // Hide the default navigation header to avoid duplication
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Messages</Text>
      </View>
      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 20 }}>
        {mockChats.map(chat => (
          <TouchableOpacity
            key={chat.id}
            style={styles.chatItem}
            onPress={() => router.push(`/protected/chat-folder/${chat.id}`)}
          >
            <Image source={{ uri: chat.userImage }} style={styles.userImage} contentFit="cover" />
            <View style={styles.chatInfo}>
              <Text style={styles.userName}>{chat.userName}</Text>
              <Text style={styles.latestMessage} numberOfLines={1}>{chat.latestMessage}</Text>
            </View>
            <Text style={styles.timestamp}>{chat.timestamp}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  userImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  userName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Helvetica Neue',
  },
  latestMessage: {
    color: '#B0B0B0',
    fontSize: 12,
    fontWeight: '400',
    fontFamily: 'Helvetica Neue',
    marginTop: 2,
  },
  timestamp: {
    color: '#B0B0B0',
    fontSize: 11,
    fontWeight: '400',
    fontFamily: 'Helvetica Neue',
  },
});