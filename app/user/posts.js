import { SafeAreaView } from "react-native-safe-area-context";
import PostList from "../protected/profile-folder/post-list";
import { useTheme } from "../../lib/theme-context";

// The same post viewer as the Profile tab's, opened from another user's profile
// (a root-level route, so "back" returns to that profile). Outside the tabs
// nothing keeps it clear of the notch / status bar, so this does.
export default function UserPosts() {
  const { colors: COLORS } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={["top"]}>
      <PostList />
    </SafeAreaView>
  );
}
