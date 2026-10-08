import { createContext, useContext } from "react";

// Account type of the logged-in user: "1" = user, "2" = venue.
// Provided once by app/protected/_layout.js after the session is loaded.
export const UserTypeContext = createContext(null);

export const useUserType = () => useContext(UserTypeContext);
