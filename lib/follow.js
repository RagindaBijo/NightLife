import { Alert } from "react-native";
import { api, getSession } from "./api";
import { translate } from "./i18n";

/**
 * Following works like this:
 * - Following a person sends a request; they accept or decline it.
 * - Someone who follows you can be followed back straight away.
 * - Venues are followed straight away.
 * - Two people who follow each other can start a chat at any time (18+), so
 *   every follow back (and accepting someone you already follow) asks first.
 */

/** Translation key for a follow button: Following / Requested / Follow back / Follow. */
export function followLabelKey(person) {
  if (person.follow_status === "following") return "userProfile.following";
  if (person.follow_status === "requested") return "follow.requested";
  if (person.follows_you) return "follow.followBack";
  return "userProfile.follow";
}

const isPersonal = (userType) => String(userType ?? 1) === "1";

/** Explains what following each other means for chats. Resolves true to go ahead. */
function confirmMutual(kind) {
  return new Promise((resolve) =>
    Alert.alert(
      translate(`follow.${kind}Title`),
      translate("follow.mutualText"),
      [
        { text: translate("common.cancel"), style: "cancel", onPress: () => resolve(false) },
        { text: translate(`follow.${kind}Confirm`), onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

/** Both are personal accounts (chats are only between people). */
async function bothPersonal(otherUserType) {
  if (!isPersonal(otherUserType)) return false;
  const session = await getSession();
  return isPersonal(session?.userType);
}

/**
 * The follow button: follow (or send a request), unfollow, or take a request back.
 * A follow back asks first. Returns the server's answer
 * ({ status, following, followers_count }), or null when the person cancelled.
 */
export async function pressFollow(person) {
  const active = person.follow_status === "following" || person.follow_status === "requested";
  if (!active && person.follows_you && (await bothPersonal(person.user_type))) {
    if (!(await confirmMutual("followBack"))) return null;
  }
  return api(`/api/users/${person.id}/follow`, { method: active ? "DELETE" : "PUT" });
}

/**
 * Accept or decline someone's request to follow you. Accepting someone you
 * already follow makes it mutual, so that asks first. Returns the server's
 * answer, or null when the person cancelled.
 */
export async function answerFollowRequest(requester, { accept, iFollowThem }) {
  if (accept && iFollowThem && (await bothPersonal(requester.user_type))) {
    if (!(await confirmMutual("accept"))) return null;
  }
  return api(`/api/follow-requests/${requester.id}`, { method: "PUT", body: { accept } });
}
