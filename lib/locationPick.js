// Hands a location picked on the map picker back to the venue profile.
// The picker stores it and goes back; the venue profile takes it on focus.
let pending = null;

export function setPickedLocation(location) {
  pending = location; // { latLong: "41.7,44.8", address: "..." }
}

export function takePickedLocation() {
  const location = pending;
  pending = null;
  return location;
}
