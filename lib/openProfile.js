/**
 * Opens the right page for a person or venue:
 * your own profile tab, a venue's page, or another user's profile.
 */
export function openProfile(router, { userId, userType, isMine = false }) {
  if (isMine) {
    router.navigate("/protected/profile-folder/profile");
  } else if (String(userType) === "2") {
    router.push(`/protected/home/venueId/${userId}`);
  } else {
    router.push(`/user/${userId}`);
  }
}
