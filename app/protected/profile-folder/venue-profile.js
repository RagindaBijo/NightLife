import { FontAwesome } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator"; // ← NEW
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import {
  Link,
  useLocalSearchParams,
  useNavigation,
  useRouter,
} from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

const Tab = createMaterialTopTabNavigator();
const { width: SCREEN_WIDTH } = Dimensions.get("window");

const dayOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hours = Array.from({ length: 12 }, (_, i) =>
  (i + 1).toString().padStart(2, "0"),
);
const IMAGE_DOMAIN = "https://night-life-api.elevator-rand.workers.dev/images";

function groupDays(selected) {
  const sorted = [...new Set(selected)].sort(
    (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b),
  );
  if (sorted.length === 0) return "";
  const ranges = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (dayOrder.indexOf(sorted[i]) === dayOrder.indexOf(prev) + 1) {
      prev = sorted[i];
    } else {
      ranges.push(start === prev ? start : `${start}-${prev}`);
      start = sorted[i];
      prev = sorted[i];
    }
  }
  ranges.push(start === prev ? start : `${start}-${prev}`);
  return ranges.join(", ");
}

function parseOpenHours(timeStr) {
  const defaultValues = {
    selectedDays: dayOrder,
    startHour: "10",
    startPeriod: "AM",
    endHour: "10",
    endPeriod: "PM",
  };
  if (!timeStr) return defaultValues;

  const [daysStr, timePart] = timeStr.split(": ");
  let selectedDays = [];
  if (daysStr) {
    const rangeStrs = daysStr.split(",").map((s) => s.trim());
    for (const rangeStr of rangeStrs) {
      if (rangeStr.includes("-")) {
        const [startD, endD] = rangeStr.split("-").map((s) => s.trim());
        const startIdx = dayOrder.indexOf(startD);
        const endIdx = dayOrder.indexOf(endD);
        if (startIdx !== -1 && endIdx !== -1 && startIdx <= endIdx) {
          for (let i = startIdx; i <= endIdx; i++) {
            selectedDays.push(dayOrder[i]);
          }
        }
      } else {
        const day = rangeStr.trim();
        if (dayOrder.includes(day)) {
          selectedDays.push(day);
        }
      }
    }
  }
  if (selectedDays.length === 0) selectedDays = defaultValues.selectedDays;

  const timeParts = timePart ? timePart.split("-") : ["10AM", "10PM"];
  const startTimeStr = timeParts[0] || "10AM";
  const endTimeStr = timeParts[1] || "10PM";
  const startPeriod = startTimeStr.slice(-2);
  const startHour = startTimeStr.slice(0, -2).padStart(2, "0");
  const endPeriod = endTimeStr.slice(-2);
  const endHour = endTimeStr.slice(0, -2).padStart(2, "0");
  return { selectedDays, startHour, startPeriod, endHour, endPeriod };
}

const truncateAddress = (address) => {
  if (!address || address.trim() === "") return "No address provided";
  const maxLength = 45;
  if (address.length <= maxLength) return address;

  let cutIndex = address.lastIndexOf(" ", maxLength);
  if (cutIndex === -1 || cutIndex < maxLength / 2) {
    cutIndex = maxLength;
  }

  return address.slice(0, cutIndex).trim() + "...";
};

export default function VenueProfile() {
  const navigation = useNavigation();
  const router = useRouter();
  const { selectedLatLong, selectedAddress } = useLocalSearchParams();
  const [venue, setVenue] = useState({
    id: "1",
    title: "Venue Profile",
    address: "123 Main St, City",
    lat_long: "0,0",
    openHours: "Mon-Sun: 10AM-10PM",
    image: "https://picsum.photos/800/600?random=1",
    status: "Status Content for Venue Profile",
    about: "About Content for Venue Profile",
    event_ids: null,
    photo_ids: null,
    public_status: 0,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDays, setSelectedDays] = useState([]);
  const [startHour, setStartHour] = useState("10");
  const [startPeriod, setStartPeriod] = useState("AM");
  const [endHour, setEndHour] = useState("10");
  const [endPeriod, setEndPeriod] = useState("PM");
  const [showDaysModal, setShowDaysModal] = useState(false);
  const [showStartTimeModal, setShowStartTimeModal] = useState(false);
  const [showEndTimeModal, setShowEndTimeModal] = useState(false);
  const [isSwitchOn, setIsSwitchOn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showFullAddressModal, setShowFullAddressModal] = useState(false);

  const [images, setImages] = useState([]);
  const [newImages, setNewImages] = useState([]);

  const apiUrl = "https://night-life-api.elevator-rand.workers.dev";

  const fetchVenue = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userId = await AsyncStorage.getItem("userId");
      if (!token || !userId) {
        console.error("No token or userId found");
        return;
      }

      const response = await fetch(`${apiUrl}/api/venue/${userId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const firstPhoto = data.photo_ids
          ? `${IMAGE_DOMAIN}/${data.photo_ids
              .split(",")
              .filter((id) => id.trim())[0]
              ?.trim()}`
          : "https://picsum.photos/800/600?random=1";
        setVenue({
          id: data.id.toString(),
          title: data.title || "Venue Profile",
          address: data.address || "Add Address",
          lat_long: data.lat_long || "0,0",
          openHours: data.open_hours || "Mon-Sun: 10AM-10PM",
          image: firstPhoto,
          status: data.status || "Status Content for Venue Profile",
          about: data.about || "About Content for Venue Profile",
          event_ids: data.event_ids,
          photo_ids: data.photo_ids,
          public_status: data.public_status || 0,
        });
        setIsSwitchOn(!!data.public_status);
      } else {
        console.error("Failed to fetch venue profile");
      }
    } catch (error) {
      console.error("Error fetching venue profile:", error);
    }
  };

  const geocodeAddress = async (address) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`,
      );
      const data = await response.json();
      if (data && data.length > 0) {
        const { lat, lon } = data[0];
        return `${lat},${lon}`;
      }
      return null;
    } catch (error) {
      console.error("Geocoding error:", error);
      return null;
    }
  };

  const handleAddressChange = async (address) => {
    setVenue((prev) => ({ ...prev, address }));
    if (address.trim()) {
      const coords = await geocodeAddress(address.trim());
      if (coords) {
        setVenue((prev) => ({ ...prev, lat_long: coords }));
      } else {
        Alert.alert(
          "Geocoding Failed",
          'Could not fetch coordinates. Try "Locate On Map".',
        );
      }
    }
  };

  const updateVenueInDatabase = async (updates) => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userId = await AsyncStorage.getItem("userId");
      if (!token || !userId) {
        Alert.alert("Error", "No token or userId found");
        return false;
      }

      const response = await fetch(`${apiUrl}/api/venue/${userId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        setVenue((prev) => ({ ...prev, ...updates }));
        return true;
      } else {
        console.error("Update venue failed:", await response.text());
        Alert.alert("Error", "Failed to update venue details.");
        return false;
      }
    } catch (error) {
      console.error("Update venue error:", error);
      Alert.alert("Error", "Network or server issue.");
      return false;
    }
  };

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  useEffect(() => {
    fetchVenue();
  }, []);

  useEffect(() => {
    if (selectedLatLong && selectedAddress) {
      const decodedAddress = decodeURIComponent(selectedAddress);
      const isValidLatLong = /^-?\d+\.\d+,-?\d+\.\d+$/.test(selectedLatLong);
      if (isValidLatLong) {
        setVenue((prev) => ({
          ...prev,
          lat_long: selectedLatLong,
          address: decodedAddress,
        }));
        updateVenueInDatabase({
          lat_long: selectedLatLong,
          address: decodedAddress,
        });
      } else {
        Alert.alert("Error", "Invalid coordinates. Try again.");
      }
    }
  }, [selectedLatLong, selectedAddress]);

  useEffect(() => {
    const parsed = parseOpenHours(venue.openHours);
    setSelectedDays(parsed.selectedDays);
    setStartHour(parsed.startHour);
    setStartPeriod(parsed.startPeriod);
    setEndHour(parsed.endHour);
    setEndPeriod(parsed.endPeriod);
  }, [venue.openHours]);

  const toggleDay = (day) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
  };

  const updateOpenHours = () => {
    const grouped = groupDays(selectedDays);
    if (!grouped) return;
    const newOpenHours = `${grouped}: ${startHour}${startPeriod}-${endHour}${endPeriod}`;
    setVenue({ ...venue, openHours: newOpenHours });
  };

  const handleEditToggle = async () => {
    if (isEditing) {
      const groupedDays = groupDays(selectedDays);
      const newOpenHours = groupedDays
        ? `${groupedDays}: ${startHour}${startPeriod}-${endHour}${endPeriod}`
        : venue.openHours;
      const updates = {
        title: venue.title.trim(),
        address: venue.address.trim(),
        lat_long: venue.lat_long,
        open_hours: newOpenHours.trim(),
      };
      const success = await updateVenueInDatabase(updates);
      if (success) {
        setVenue((prev) => ({
          ...prev,
          title: updates.title,
          address: updates.address,
          lat_long: updates.lat_long,
          openHours: updates.open_hours,
        }));
      }
    }
    setIsEditing(!isEditing);
  };

  const validateFields = () => {
    const defaultValues = {
      title: "Venue Profile",
      address: "123 Main St, City",
      lat_long: "0,0",
      openHours: "Mon-Sun: 10AM-10PM",
      status: "Status Content for Venue Profile",
      about: "About Content for Venue Profile",
    };

    const errors = [];

    if (
      !venue.title ||
      venue.title.trim() === "" ||
      venue.title === defaultValues.title
    )
      errors.push("Name");
    if (
      !venue.address ||
      venue.address.trim() === "" ||
      venue.address === defaultValues.address
    )
      errors.push("Address");
    if (!venue.lat_long || !/^-?\d+\.\d+,-?\d+\.\d+$/.test(venue.lat_long))
      errors.push("Coordinates");
    if (
      !venue.openHours ||
      venue.openHours.trim() === "" ||
      venue.openHours === defaultValues.openHours
    )
      errors.push("Open Hours");
    if (
      !venue.status ||
      venue.status.trim() === "" ||
      venue.status === defaultValues.status
    )
      errors.push("Status");
    if (
      !venue.about ||
      venue.about.trim() === "" ||
      venue.about === defaultValues.about
    )
      errors.push("About");

    return { isValid: errors.length === 0, errors };
  };

  const handleSwitchToggle = async () => {
    if (!isSwitchOn) {
      const { isValid, errors } = validateFields();
      if (!isValid) {
        Alert.alert(
          "Incomplete Profile",
          `Please fill: ${errors.join(", ")}.`,
          [{ text: "OK" }],
        );
        return;
      }
    }

    const newStatus = !isSwitchOn ? 1 : 0;
    const success = await updateVenueInDatabase({ public_status: newStatus });
    if (success) setIsSwitchOn(newStatus);
  };

  const handleLocateOnMap = () => {
    router.push({
      pathname: "/protected/profile-folder/maps",
      params: { selectLocation: "true", currentLatLong: venue.lat_long },
    });
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchVenue().finally(() => setRefreshing(false));
  }, []);

  function EditSaveIcon() {
    return (
      <>
        <Switch
          style={styles.switchContainer}
          trackColor={{ false: "#8E8E93", true: "#00FF00" }}
          thumbColor={isSwitchOn ? "#FFFFFF" : "#FFFFFF"}
          onValueChange={handleSwitchToggle}
          value={isSwitchOn}
        />
        <TouchableOpacity
          onPress={handleEditToggle}
          style={styles.iconContainer}
        >
          <FontAwesome
            name={isEditing ? "save" : "pencil"}
            size={24}
            color={isEditing ? "#FFD700" : "#FFFFFF"}
          />
        </TouchableOpacity>
      </>
    );
  }

  // ================== FIXED IMAGE UPLOAD WITH CROPPING ==================
  const handleNewImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Need media library access.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const { uri, width: origW, height: origH } = result.assets[0];
      const targetW = SCREEN_WIDTH;
      const targetH = 200;

      const cropY = Math.max(0, (origH - targetH) / 2);
      const cropW = Math.min(origW, targetW);
      const cropX = (origW - cropW) / 2;

      const manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            crop: {
              originX: cropX,
              originY: cropY,
              width: cropW,
              height: targetH,
            },
          },
          { resize: { width: targetW } },
        ],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
      );

      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "No token found.");
        return;
      }

      const formData = new FormData();
      const ext = manipResult.uri.split(".").pop().toLowerCase() || "jpg";
      formData.append("file", {
        uri: manipResult.uri,
        name: `venue-${Date.now()}.${ext}`,
        type: `image/${ext}`,
      });

      const response = await fetch(`${apiUrl}/api/upload-image?type=venue`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (response.ok) {
        const { keys } = await response.json();
        const newImageUris = keys.map((key) => ({
          id: key,
          uri: `${IMAGE_DOMAIN}/${key}`,
        }));

        // ← NOW USING PARENT STATE
        setNewImages((prev) => [...prev, ...newImageUris]);
        setImages((prev) => [...prev, ...newImageUris]);

        const newPhotoIdsStr = keys.join(",");
        const updatedPhotoIds = venue.photo_ids
          ? `${venue.photo_ids},${newPhotoIdsStr}`
          : newPhotoIdsStr;
        await updateVenueInDatabase({ photo_ids: updatedPhotoIds });

        Alert.alert("Success", "Image uploaded!");
      } else {
        const err = await response.json();
        Alert.alert("Upload Failed", err.error || "Try again.");
      }
    } catch (error) {
      console.error("Image upload error:", error);
      Alert.alert("Error", "Failed to process image.");
    }
  };
  // ========================================================================

  const StatusScreen = ({ initialStatus }) => {
    const [isEditingStatus, setIsEditingStatus] = useState(false);
    const [statusText, setStatusText] = useState(initialStatus);

    const handleEditStatus = () => setIsEditingStatus(true);

    const handleSaveStatus = async () => {
      setIsEditingStatus(false);
      const success = await updateVenueInDatabase({
        status: statusText.trim(),
      });
      if (success) setVenue((prev) => ({ ...prev, status: statusText.trim() }));
    };

    return (
      <View
        style={[styles.tabContent, { flex: 1, backgroundColor: "#121212" }]}
      >
        {!isEditingStatus && (
          <TouchableOpacity
            style={styles.editButton}
            onPress={handleEditStatus}
          >
            <Text style={styles.editButtonText}>Edit Status</Text>
          </TouchableOpacity>
        )}
        <View style={styles.tabTextContainer}>
          {isEditingStatus ? (
            <>
              <ScrollView style={styles.inputScroll}>
                <TextInput
                  style={styles.statusInput}
                  value={statusText}
                  onChangeText={setStatusText}
                  multiline
                />
              </ScrollView>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveStatus}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.tabContentText}>{statusText}</Text>
          )}
        </View>
      </View>
    );
  };

  const EventsScreen = ({ initialEventIds, refreshTrigger }) => {
    const [events, setEvents] = useState([]);

    const fetchEvents = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const userId = await AsyncStorage.getItem("userId");
        if (!token || !userId) return;

        if (!initialEventIds) {
          setEvents([]);
          return;
        }

        const ids = [
          ...new Set(
            initialEventIds
              .split(",")
              .map((id) => id.trim())
              .filter((id) => id),
          ),
        ];
        if (ids.length === 0) {
          setEvents([]);
          return;
        }

        const promises = ids.map(async (id) => {
          const res = await fetch(`${apiUrl}/api/events/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          return res.ok ? await res.json() : null;
        });

        const results = await Promise.all(promises);
        setEvents(
          results
            .filter((e) => e !== null)
            .map((e, i) => ({
              id: e.id.toString(),
              title: e.title || `Event ${i + 1}`,
              venueName: venue.title || "Unknown",
              time: e.time || "No time",
              image:
                e.photo_id || `https://picsum.photos/200/200?random=${i + 1}`,
            })),
        );
      } catch (err) {
        console.error(err);
        setEvents([]);
      }
    };

    useEffect(() => {
      fetchEvents();
    }, [initialEventIds, venue.title, refreshTrigger]);

    const handleDeletePress = (eventId, e) => {
      e.stopPropagation();
      Alert.alert("Delete?", "Remove this event?", [
        { text: "No" },
        {
          text: "Yes",
          style: "destructive",
          onPress: () => handleConfirmDelete(eventId),
        },
      ]);
    };

    const handleConfirmDelete = async (eventId) => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(`${apiUrl}/api/events/${eventId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          setEvents((prev) => prev.filter((e) => e.id !== eventId));
          setVenue((prev) => ({
            ...prev,
            event_ids: [
              ...new Set(
                prev.event_ids
                  ? prev.event_ids
                      .split(",")
                      .filter((id) => id.trim() !== eventId)
                  : [],
              ),
            ].join(","),
          }));
          Alert.alert("Success", "Event deleted.");
        }
      } catch (err) {
        Alert.alert("Error", "Failed to delete.");
      }
    };

    return (
      <View
        style={[styles.eventContainer, { flex: 1, backgroundColor: "#121212" }]}
      >
        <Link href="/protected/profile-folder/create-event" asChild>
          <TouchableOpacity style={styles.newEventButton}>
            <Text style={styles.newEventButtonText}>New Event</Text>
          </TouchableOpacity>
        </Link>
        {events.length === 0 ? (
          <Text style={styles.noEventsText}>No Events</Text>
        ) : (
          <ScrollView style={styles.eventListContainer}>
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/protected/profile-folder/create-event?eventId=${event.id}`}
                asChild
              >
                <TouchableOpacity style={styles.eventPost}>
                  <Image
                    source={{ uri: event.image }}
                    style={styles.eventImage}
                    contentFit="cover"
                  />
                  <View style={styles.eventTextContainer}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.eventBody}>{event.venueName}</Text>
                    <Text style={styles.eventTime}>{event.time}</Text>
                  </View>
                  <View style={styles.eventIconsContainer}>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={(e) => handleDeletePress(event.id, e)}
                    >
                      <FontAwesome name="trash" size={28} color="#FF0000" />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              </Link>
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  const AboutScreen = ({ initialAbout }) => {
    const [isEditingAbout, setIsEditingAbout] = useState(false);
    const [aboutText, setAboutText] = useState(initialAbout);

    const handleEditAbout = () => setIsEditingAbout(true);
    const handleSaveAbout = async () => {
      setIsEditingAbout(false);
      const success = await updateVenueInDatabase({ about: aboutText.trim() });
      if (success) setVenue((prev) => ({ ...prev, about: aboutText.trim() }));
    };

    return (
      <View
        style={[styles.tabContent, { flex: 1, backgroundColor: "#121212" }]}
      >
        {!isEditingAbout && (
          <TouchableOpacity style={styles.editButton} onPress={handleEditAbout}>
            <Text style={styles.editButtonText}>Edit About</Text>
          </TouchableOpacity>
        )}
        <View style={styles.tabTextContainer}>
          {isEditingAbout ? (
            <>
              <ScrollView style={styles.inputScroll}>
                <TextInput
                  style={styles.statusInput}
                  value={aboutText}
                  onChangeText={setAboutText}
                  multiline
                />
              </ScrollView>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveAbout}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.tabContentText}>{aboutText}</Text>
          )}
        </View>
      </View>
    );
  };

  const ImagesScreen = ({ initialPhotoIds, refreshTrigger }) => {
    const [images, setImages] = useState([]);
    const [newImages, setNewImages] = useState([]);

    const fetchImages = async () => {
      if (!initialPhotoIds) {
        setImages([]);
        return;
      }
      const ids = [
        ...new Set(
          initialPhotoIds
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id),
        ),
      ];
      setImages(ids.map((id) => ({ id, uri: `${IMAGE_DOMAIN}/${id}` })));
    };

    useEffect(() => {
      fetchImages();
    }, [initialPhotoIds, refreshTrigger]);

    const handleSelectImage = () => {
      Alert.alert("Select Image", "This feature is not implemented yet.");
    };

    const renderImage = ({ item }) => (
      <Image
        source={{ uri: item.uri }}
        style={styles.gridImage}
        contentFit="cover"
      />
    );

    const renderHeader = () => (
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.newEventButton}
          onPress={handleNewImage}
        >
          <Text style={styles.newEventButtonText}>New Image</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.newEventButton}
          onPress={handleSelectImage}
        >
          <Text style={styles.newEventButtonText}>Select Image</Text>
        </TouchableOpacity>
      </View>
    );

    const renderEmpty = () => (
      <Text style={styles.noEventsText}>No Images</Text>
    );

    return (
      <View
        style={[styles.eventContainer, { flex: 1, backgroundColor: "#121212" }]}
      >
        <FlatList
          data={images}
          renderItem={renderImage}
          keyExtractor={(item) => item.id}
          numColumns={3}
          contentContainerStyle={styles.imageGrid}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={renderEmpty}
        />
      </View>
    );
  };

  const groupedDays = groupDays(selectedDays);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <LinearGradient
        colors={["#BB86FC", "#6200EE", "#8B008B", "#1E1E1E"]}
        style={styles.gradient}
      >
        <View style={styles.container}>
          <View style={styles.post}>
            <Image
              source={{ uri: venue.image }}
              style={styles.postImage}
              contentFit="cover"
            />
            <EditSaveIcon />
            <View style={styles.textContainer}>
              {isEditing ? (
                <View style={styles.editContainer}>
                  <View style={styles.inputContainer}>
                    <FontAwesome
                      name="building"
                      size={24}
                      color="#26A69A"
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={styles.titleInput}
                      value={venue.title}
                      onChangeText={(text) =>
                        setVenue({ ...venue, title: text })
                      }
                      placeholder="Venue Name"
                      placeholderTextColor="#8E8E93"
                    />
                  </View>
                  <TouchableOpacity
                    onPress={handleLocateOnMap}
                    style={styles.locateButton}
                  >
                    <FontAwesome
                      name="map"
                      size={20}
                      color="#26A69A"
                      style={styles.locateIcon}
                    />
                    <Text style={styles.locateButtonText}>Locate On Map</Text>
                  </TouchableOpacity>
                  <View style={styles.hoursContainer}>
                    <TouchableOpacity onPress={() => setShowDaysModal(true)}>
                      <Text style={styles.pressableText}>
                        {groupedDays || "Select Days"}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.separatorText}>: </Text>
                    <TouchableOpacity
                      onPress={() => setShowStartTimeModal(true)}
                    >
                      <Text style={styles.pressableText}>
                        {startHour}
                        {startPeriod}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.separatorText}> - </Text>
                    <TouchableOpacity onPress={() => setShowEndTimeModal(true)}>
                      <Text style={styles.pressableText}>
                        {endHour}
                        {endPeriod}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <>
                  <Text style={styles.postTitle}>{venue.title}</Text>
                  <TouchableOpacity
                    onPress={() => setShowFullAddressModal(true)}
                  >
                    <Text style={styles.postBody} numberOfLines={1}>
                      {truncateAddress(venue.address)}
                    </Text>
                  </TouchableOpacity>
                  <Text style={styles.postBody}>{venue.openHours}</Text>
                </>
              )}
            </View>
          </View>

          <Tab.Navigator
            screenOptions={{
              tabBarStyle: { backgroundColor: "#121212" },
              tabBarLabelStyle: { fontWeight: "bold", color: "#FFFFFF" },
              tabBarActiveTintColor: "#BB86FC",
              tabBarInactiveTintColor: "#8E8E93",
              tabBarIndicatorStyle: { backgroundColor: "#BB86FC" },
            }}
          >
            <Tab.Screen name="Status">
              {() => <StatusScreen initialStatus={venue.status} />}
            </Tab.Screen>
            <Tab.Screen name="Events">
              {() => (
                <EventsScreen
                  initialEventIds={venue.event_ids}
                  refreshTrigger={refreshing}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="About">
              {() => <AboutScreen initialAbout={venue.about} />}
            </Tab.Screen>
            <Tab.Screen name="Images">
              {() => (
                <ImagesScreen
                  initialPhotoIds={venue.photo_ids}
                  refreshTrigger={refreshing}
                />
              )}
            </Tab.Screen>
          </Tab.Navigator>
        </View>
      </LinearGradient>
    </TouchableWithoutFeedback>
  );
}

const IMAGE_WIDTH = (SCREEN_WIDTH - 30) / 3;
const IMAGE_HEIGHT = (IMAGE_WIDTH * 4) / 3;

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  post: {
    height: 200,
    width: "100%",
    borderWidth: 1,
    borderColor: "#333333",
    position: "relative",
  },
  postImage: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  textContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    zIndex: 2,
    justifyContent: "flex-end",
  },
  editContainer: {
    alignItems: "flex-start",
    width: "100%",
  },
  postTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  postBody: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginTop: 5,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 2,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333333",
    marginBottom: 5,
    width: "100%",
  },
  inputIcon: {
    marginLeft: 10,
    marginRight: 5,
  },
  titleInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    padding: 5,
  },
  bodyInput: {
    flex: 1,
    fontSize: 15,
    color: "#E0E0E0",
    padding: 5,
  },
  locateButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    marginLeft: 10,
  },
  locateIcon: {
    marginRight: 5,
  },
  locateButtonText: {
    fontSize: 15,
    color: "#BB86FC",
    fontWeight: "bold",
  },
  iconContainer: {
    position: "absolute",
    left: 10,
    top: 10,
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(30, 30, 30, 0.7)",
    borderWidth: 2,
    borderColor: "#BB86FC",
    borderRadius: 8,
    zIndex: 3,
  },
  switchContainer: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 60,
    height: 34,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }],
    zIndex: 3,
  },
  tabContent: {
    padding: 20,
    alignItems: "center",
  },
  tabTextContainer: {
    backgroundColor: "#252525",
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#BB86FC",
    width: "95%",
    padding: 15,
    marginTop: 15,
    alignSelf: "center",
  },
  tabContentText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E0E0E0",
    textAlign: "left",
  },
  statusInput: {
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333333",
    padding: 10,
    width: "100%",
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: "left",
    minHeight: 200,
  },
  inputScroll: {
    maxHeight: 200,
    width: "100%",
  },
  editButton: {
    backgroundColor: "#BB86FC",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 0,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  saveButton: {
    backgroundColor: "#FF69B4",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 10,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  eventContainer: {
    flex: 1,
    paddingHorizontal: 10,
    paddingTop: 5,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 15,
    marginBottom: 13,
    gap: 10,
  },
  newEventButton: {
    backgroundColor: "#BB86FC",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  newEventButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  eventListContainer: {
    paddingHorizontal: 5,
    paddingBottom: 20,
  },
  eventPost: {
    flexDirection: "row",
    height: 100,
    width: "100%",
    marginBottom: 10,
    backgroundColor: "#1E1E1E",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#333333",
    padding: 10,
  },
  eventImage: {
    width: 80,
    height: "100%",
    borderRadius: 8,
  },
  eventTextContainer: {
    flex: 1,
    paddingLeft: 10,
    justifyContent: "center",
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  eventBody: {
    fontSize: 12,
    color: "#E0E0E0",
    marginTop: 5,
  },
  eventTime: {
    fontSize: 12,
    color: "#E0E0E0",
    marginTop: 5,
  },
  eventIconsContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingRight: 10,
  },
  iconButton: {
    paddingHorizontal: 6,
  },
  noEventsText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 20,
  },
  imageGrid: {
    paddingHorizontal: 5,
    paddingBottom: 20,
  },
  gridImage: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: 8,
    marginBottom: 10,
    marginHorizontal: 2.5,
  },
  hoursContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginLeft: 10,
    flexWrap: "wrap",
  },
  pressableText: {
    fontSize: 15,
    color: "#BB86FC",
    fontWeight: "bold",
  },
  separatorText: {
    fontSize: 15,
    color: "#E0E0E0",
    marginHorizontal: 5,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#1E1E1E",
    padding: 20,
    borderRadius: 10,
    width: "80%",
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 10,
  },
  modalAddressText: {
    fontSize: 16,
    color: "#E0E0E0",
    textAlign: "center",
    marginBottom: 20,
  },
  dayOption: {
    padding: 10,
    width: "100%",
    alignItems: "center",
  },
  dayOptionText: {
    color: "#FFFFFF",
    fontSize: 16,
  },
  pickerContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    width: "100%",
  },
  picker: {
    color: "#FFFFFF",
    backgroundColor: "#333333",
    width: "45%",
    borderWidth: 1,
    borderColor: "#26A69A",
    borderRadius: 8,
  },
  confirmButton: {
    backgroundColor: "#BB86FC",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
    marginTop: 10,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
});
