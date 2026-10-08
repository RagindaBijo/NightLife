import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { translate } from "./i18n";

export const API_URL = "https://night-life-api.elevator-rand.workers.dev";

// Session values are kept in SecureStore (encrypted), not AsyncStorage
const SESSION_KEYS = { token: "token", userId: "userId", userType: "userType" };

let sessionCache; // undefined = not loaded yet, null = logged out
let signingOut = false;

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status; // 0 = network error (offline, timeout…)
    this.code = code; // stable error id from the server, e.g. "username_taken"
  }
}

/**
 * Returns { token, userId, userType } (strings) or null when logged out.
 */
export async function getSession() {
  if (sessionCache !== undefined) return sessionCache;

  let token = await SecureStore.getItemAsync(SESSION_KEYS.token);
  let userId = await SecureStore.getItemAsync(SESSION_KEYS.userId);
  let userType = await SecureStore.getItemAsync(SESSION_KEYS.userType);

  // One-time move of a session saved by older app versions in AsyncStorage
  if (!token) {
    const legacy = await AsyncStorage.multiGet(["token", "userId", "userType"]);
    const [legacyToken, legacyUserId, legacyUserType] = legacy.map(([, value]) => value);
    if (legacyToken) {
      await saveSession({
        token: legacyToken,
        userId: legacyUserId,
        userType: legacyUserType,
      });
      await AsyncStorage.multiRemove(["token", "userId", "userType"]);
      return sessionCache;
    }
  }

  sessionCache = token ? { token, userId, userType } : null;
  return sessionCache;
}

export async function saveSession({ token, userId, userType }) {
  const session = {
    token: String(token),
    userId: String(userId),
    userType: String(userType),
  };
  await SecureStore.setItemAsync(SESSION_KEYS.token, session.token);
  await SecureStore.setItemAsync(SESSION_KEYS.userId, session.userId);
  await SecureStore.setItemAsync(SESSION_KEYS.userType, session.userType);
  sessionCache = session;
  signingOut = false;
}

// Things that hold per-account data (favorites, interests, unread counts)
// register here and are cleared on every sign-out, so nothing carries over
// to the next account on the same phone.
const sessionEndListeners = new Set();
export function onSessionEnd(listener) {
  sessionEndListeners.add(listener);
  return () => sessionEndListeners.delete(listener);
}

export async function clearSession() {
  sessionEndListeners.forEach((listener) => listener());
  await SecureStore.deleteItemAsync(SESSION_KEYS.token);
  await SecureStore.deleteItemAsync(SESSION_KEYS.userId);
  await SecureStore.deleteItemAsync(SESSION_KEYS.userType);
  sessionCache = null;
}

/**
 * Clears the session and sends the user to the login screen.
 */
export async function signOut() {
  if (signingOut) return;
  signingOut = true;
  await clearSession();
  router.replace("/login");
}

/**
 * Calls the Night-Life API and returns the parsed JSON response.
 *
 * - Adds the auth token (unless `auth: false`).
 * - Sends plain objects as JSON and FormData as multipart.
 * - On 401 the session is cleared and the user is sent to login.
 * - Throws ApiError with the server's error message on failure
 *   (status 0 for network errors – these never log the user out).
 */
export async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};

  if (auth) {
    const session = await getSession();
    if (!session) {
      await signOut();
      throw new ApiError(401, translate("api.loginAgain"));
    }
    headers.Authorization = `Bearer ${session.token}`;
  }

  let payload = body;
  if (body !== undefined && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, translate("api.network"));
  }

  const data = await response.json().catch(() => null);

  if (response.status === 401 && auth) {
    await signOut();
    throw new ApiError(401, translate("api.sessionExpired"));
  }

  if (response.status === 429) {
    throw new ApiError(429, translate("api.rateLimited"), "rate_limited");
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error || translate("api.requestFailed", { status: response.status }),
      data?.code,
    );
  }

  return data;
}
