import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { API_BASE_URL, authenticatedFetch, logout } from "../../utils/auth";
import CirclesModal from "./CirclesModal";

const { height: windowHeight } = Dimensions.get("window");
const DRAWER_HEIGHT = Math.round(windowHeight * 0.5);

interface LocationPoint {
  id?: number;
  latitude: number;
  longitude: number;
  name?: string;
  metadata?: { radius?: number };
}

interface CircleData {
  id: number;
  name?: string;
  Locations?: LocationPoint[];
  metadata?: { radius?: number };
  creatorId?: string;
  creator?: {
    id: string;
    name?: string;
  };
}

interface UserLocation {
  latitude: number;
  longitude: number;
}

// Helper function to validate coordinates
const isValidCoordinate = (lat: number, lon: number): boolean => {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    isFinite(lat) &&
    isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
};

// Test mode configuration
const TEST_MODE = false; // Set to true to enable test mode (for testing other features)

const MapScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadingCircles, setLoadingCircles] = useState(false);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [circles, setCircles] = useState<CircleData[]>([]);
  const [hasArrived, setHasArrived] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const reachedLocationsRef = useRef<Set<string>>(new Set());
  const alertedLocationsRef = useRef<Set<string>>(new Set()); // Track locations we've already shown alerts for
  const markingLocationsRef = useRef<Set<string>>(new Set()); // Track locations currently being marked (to prevent concurrent calls)
  const [testMode, setTestMode] = useState(TEST_MODE);
  const mapRef = useRef<MapView | null>(null);

  const drawerAnim = useRef(new Animated.Value(DRAWER_HEIGHT)).current;
  const [isOpen, setIsOpen] = useState(false);

  // Circles modal state
  const [isCirclesModalOpen, setIsCirclesModalOpen] = useState(false);

  // Safe area insets
  const insets = useSafeAreaInsets();

  // -----------------------------
  // Load current user ID
  // -----------------------------
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const response = await authenticatedFetch(`${API_BASE_URL}/profile`, {
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
          },
        });

        if (response.ok) {
          const data = await response.json();
          const userData = data.data || data;
          if (userData?.id) {
            setCurrentUserId(userData.id);
          }
        }
      } catch (error) {
        console.error("Error loading current user:", error);
      }
    };
    loadCurrentUser();
  }, []);

  // -----------------------------
  // Load location and circles
  // -----------------------------
  useEffect(() => {
    const loadData = async () => {
      try {
        // Always use real location
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
          });
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          if (isValidCoordinate(lat, lon)) {
            setLocation({
              latitude: lat,
              longitude: lon,
            });
          }
        } else {
          Alert.alert("Permission Denied", "Location permission is required.");
        }
      } catch (e) {
        console.warn("Location error:", e);
      }

      await loadCircles();
      setLoading(false);
    };
    loadData();
  }, []);

  const loadCircles = async () => {
    try {
      setLoadingCircles(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/circles`, {
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
      });

      if (res.status === 401) {
        // Token refresh failed or no valid token
        console.warn("Authentication failed, redirecting to login");
        router.replace("/screens/LogInScreen");
        return;
      }

      const data = await res.json();
      if (Array.isArray(data)) setCircles(data);
      else if (data?.data) setCircles(data.data);
    } catch (e) {
      console.warn("Circle API error:", e);
    } finally {
      setLoadingCircles(false);
    }
  };

  // -----------------------------
  // Distance calculation
  // -----------------------------
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371000;
    const toRad = (x: number) => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // -----------------------------
  // Mark location as reached
  // -----------------------------
  const markLocationReached = async (
    circleId: number,
    locationId: number | string,
    latitude: number,
    longitude: number
  ) => {
    const locationKey = `${circleId}-${locationId}`;

    // Skip if already reached or currently being marked
    if (
      reachedLocationsRef.current.has(locationKey) ||
      markingLocationsRef.current.has(locationKey)
    ) {
      return;
    }

    // Mark as "in progress" immediately to prevent concurrent calls
    markingLocationsRef.current.add(locationKey);

    try {
      const response = await authenticatedFetch(
        `${API_BASE_URL}/circles/${circleId}/mark-location-reached`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            locationId: locationId.toString(),
            latitude: latitude,
            longitude: longitude,
          }),
        }
      );

      if (response.status === 401) {
        // Remove from marking set on error so it can be retried
        markingLocationsRef.current.delete(locationKey);
        router.replace("/screens/LogInScreen");
        return;
      }

      if (response.ok) {
        // Mark as reached to prevent duplicate calls
        reachedLocationsRef.current.add(locationKey);
        console.log(`Location ${locationId} marked as reached for circle ${circleId}`);
      } else {
        const data = await response.json();
        console.error("Failed to mark location as reached:", data);
        // Remove from marking set on error so it can be retried
        markingLocationsRef.current.delete(locationKey);
      }
    } catch (error) {
      console.error("Error marking location as reached:", error);
      // Remove from marking set on error so it can be retried
      markingLocationsRef.current.delete(locationKey);
    } finally {
      // Always remove from marking set when done (success or failure)
      markingLocationsRef.current.delete(locationKey);
    }
  };

  // -----------------------------
  // Watch location
  // -----------------------------
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const checkLocationAndCircle = (userLat: number, userLon: number) => {
      // Check circles safely
      let insideCircle = false;
      let shouldShowAlert = false;
      let alertCircleName = "";

      circles.forEach((c) => {
        // Get first available location for each circle
        const firstLocation = (c.Locations ?? []).find((loc) =>
          isValidCoordinate(loc.latitude, loc.longitude)
        );

        if (firstLocation) {
          const d = getDistance(userLat, userLon, firstLocation.latitude, firstLocation.longitude);
          const radius = firstLocation.metadata?.radius ?? c.metadata?.radius ?? 100;

          if (d <= radius) {
            insideCircle = true;

            // Mark location as reached for all users (creator/admin/member)
            if (firstLocation.id) {
              const locationKey = `${c.id}-${firstLocation.id}`;

              // Check if we've already reached this location
              const alreadyReached = reachedLocationsRef.current.has(locationKey);
              // Check if we've already shown an alert for this location
              const alreadyAlerted = alertedLocationsRef.current.has(locationKey);

              // Mark location as reached (function will skip if already reached)
              markLocationReached(c.id, firstLocation.id, userLat, userLon);

              // Show alert only if we haven't shown it for this location yet
              // Check both the reached locations ref and the alerted locations ref
              if (!alreadyReached && !alreadyAlerted && !hasArrived) {
                shouldShowAlert = true;
                alertCircleName = firstLocation.name ?? c.name ?? "Unknown Circle";
                // Mark this location as alerted immediately to prevent duplicate alerts
                alertedLocationsRef.current.add(locationKey);
              }
            }
          }
        }
      });

      // Show alert only once per location entry
      if (shouldShowAlert) {
        Alert.alert("Arrived", `You have entered a circle radius: ${alertCircleName}`);
        setHasArrived(true);
      } else if (!insideCircle) {
        // Reset hasArrived when leaving all circles
        // Note: We don't clear alertedLocationsRef so alerts won't show again for the same location
        setHasArrived(false);
      }
    };

    const startWatch = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      subscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, distanceInterval: 1 },
        (pos) => {
          if (!pos?.coords) return;
          const userLat = pos.coords.latitude;
          const userLon = pos.coords.longitude;

          // Only update location if coordinates are valid
          if (isValidCoordinate(userLat, userLon)) {
            setLocation({ latitude: userLat, longitude: userLon });
            checkLocationAndCircle(userLat, userLon);
          } else {
            console.warn("Invalid coordinates received:", userLat, userLon);
            return;
          }
        }
      );
    };
    startWatch();

    return () => {
      subscription?.remove();
    };
  }, [circles, hasArrived, currentUserId, location]);

  // -----------------------------
  // Drawer toggle
  // -----------------------------
  const toggleDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: isOpen ? DRAWER_HEIGHT : 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setIsOpen(!isOpen));
  };

  // -----------------------------
  // Circles modal toggle
  // -----------------------------
  const toggleCirclesModal = () => {
    setIsCirclesModalOpen(!isCirclesModalOpen);
  };

  const handleCloseCirclesModal = () => {
    setIsCirclesModalOpen(false);
  };

  // -----------------------------
  // Logout
  // -----------------------------
  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/screens/LogInScreen");
        },
      },
    ]);
  };

  // -----------------------------
  // Loading screen
  // -----------------------------
  if (loading || !location || !isValidCoordinate(location.latitude, location.longitude)) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text>Loading Map...</Text>
      </View>
    );
  }

  // -----------------------------
  // Map
  // -----------------------------
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.005, // More zoomed in (was 0.05)
          longitudeDelta: 0.005, // More zoomed in (was 0.05)
        }}
        showsUserLocation={false}
        followsUserLocation={false}
        onMapReady={() => {
          // Ensure map is ready before animating
          if (mapRef.current && location) {
            mapRef.current.animateToRegion(
              {
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
              },
              0
            );
          }
        }}
      >
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          title="You are here"
          pinColor="black"
          tracksViewChanges={false}
        />

        {circles.map((c) => {
          // Get first available location for each circle
          const firstLocation = (c.Locations ?? []).find((loc) =>
            isValidCoordinate(loc.latitude, loc.longitude)
          );

          if (!firstLocation) return null;

          const key = `${c.id}-${firstLocation.id ?? 0}`;
          const radius = firstLocation.metadata?.radius ?? c.metadata?.radius ?? 100;

          return (
            <React.Fragment key={key}>
              <Marker
                coordinate={{
                  latitude: firstLocation.latitude,
                  longitude: firstLocation.longitude,
                }}
                title={firstLocation.name ?? c.name}
                pinColor="blue"
              />
              <Circle
                center={{
                  latitude: firstLocation.latitude,
                  longitude: firstLocation.longitude,
                }}
                radius={radius}
                strokeWidth={2}
                strokeColor="rgba(0,112,255,0.8)"
                fillColor="rgba(0,112,255,0.2)"
              />
            </React.Fragment>
          );
        })}
      </MapView>

      {/* <Animated.View style={[styles.drawer, { transform: [{ translateY: drawerAnim }] }]}>
        <View style={styles.drawerHandleContainer}>
          <View style={styles.handle} />
        </View>
        <View style={styles.drawerContent}>
          <Text style={styles.drawerTitle}>Circles</Text>
          {loadingCircles ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#2563eb" />
              <Text style={styles.drawerSub}>Loading circles...</Text>
            </View>
          ) : (
            <Text style={styles.drawerSub}>You have {circles.length} circle(s)</Text>
          )}

          <TouchableOpacity
            style={styles.drawerButton}
            onPress={() => router.push("/screens/CircleScreen")}
          >
            <Text style={styles.drawerButtonText}>Open Circle Screen</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeButton} onPress={toggleDrawer}>
            <Text style={styles.closeButtonText}>{isOpen ? "Close" : "Open"}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View> */}

      <TouchableOpacity
        style={[styles.menuButton, { top: insets.top + 8, left: 16 }]}
        onPress={toggleCirclesModal}
      >
        <Text style={styles.menuButtonText}>☰</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.profileButton, { top: insets.top + 8, right: 16 }]}
        onPress={handleLogout}
      >
        <Text style={styles.profileButtonText}>👤</Text>
      </TouchableOpacity>

      {/* Test Mode Indicator */}
      {testMode && (
        <View style={[styles.testModeIndicator, { top: insets.top + 8, left: 80 }]}>
          <Text style={styles.testModeText}>🧪 TEST MODE</Text>
        </View>
      )}

      <CirclesModal
        isOpen={isCirclesModalOpen}
        onClose={handleCloseCirclesModal}
        onRefresh={loadCircles}
        circles={circles}
        loadingCircles={loadingCircles}
      />
    </View>
  );
};

export default MapScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  map: { flex: 1 },

  drawer: {
    position: "absolute",
    left: 0,
    right: 0,
    height: DRAWER_HEIGHT,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    elevation: 10,
  },
  drawerHandleContainer: { alignItems: "center", paddingTop: 8 },
  handle: { width: 60, height: 6, borderRadius: 3, backgroundColor: "#e5e7eb" },
  drawerContent: { padding: 16 },
  drawerTitle: { fontSize: 18, fontWeight: "700" },
  drawerSub: { marginTop: 4, color: "#6b7280" },
  loadingContainer: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  drawerButton: {
    marginTop: 16,
    backgroundColor: "#2563eb",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  drawerButtonText: { color: "#fff", fontWeight: "700" },
  closeButton: { marginTop: 12, alignItems: "center" },
  closeButtonText: { color: "#2563eb", fontWeight: "700" },

  menuButton: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1,
  },
  menuButtonText: { fontSize: 20 },
  profileButton: {
    position: "absolute",
    backgroundColor: "#fff",
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1,
  },
  profileButtonText: { fontSize: 20 },
  testModeIndicator: {
    position: "absolute",
    backgroundColor: "#fbbf24",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 1,
  },
  testModeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#78350f",
  },
});
