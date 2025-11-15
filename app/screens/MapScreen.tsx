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
import { authenticatedFetch } from "../../utils/auth";

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

const MapScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [circles, setCircles] = useState<CircleData[]>([]);
  const [hasArrived, setHasArrived] = useState(false);

  const drawerAnim = useRef(new Animated.Value(DRAWER_HEIGHT)).current;
  const [isOpen, setIsOpen] = useState(false);

  // -----------------------------
  // Load location and circles
  // -----------------------------
  useEffect(() => {
    const loadData = async () => {
      try {
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
      const res = await authenticatedFetch("https://api.medi.lk/api/circles", {
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
  // Watch location
  // -----------------------------
  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;

    const checkLocationAndCircle = (userLat: number, userLon: number) => {
      // Check circles safely
      let insideCircle = false;

      circles.forEach((c) => {
        (c.Locations ?? []).forEach((loc) => {
          // Only check distance if both user and circle coordinates are valid
          if (isValidCoordinate(loc.latitude, loc.longitude)) {
            const d = getDistance(userLat, userLon, loc.latitude, loc.longitude);
            const radius = loc.metadata?.radius ?? c.metadata?.radius ?? 100;
            if (d <= radius) insideCircle = true;
          }
        });
      });

      if (insideCircle && !hasArrived) {
        Alert.alert("Arrived", "You have entered a circle radius!");
        setHasArrived(true);
      } else if (!insideCircle) {
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
  }, [circles, hasArrived]);

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
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        region={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
      >
        <Marker coordinate={location} title="You are here" pinColor="black" />

        {circles.map((c) =>
          (c.Locations ?? [])
            .filter((loc) => isValidCoordinate(loc.latitude, loc.longitude))
            .map((loc, idx) => {
              const key = `${c.id}-${loc.id ?? idx}`;
              const radius = loc.metadata?.radius ?? c.metadata?.radius ?? 100;

              return (
                <React.Fragment key={key}>
                  <Marker
                    coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                    title={loc.name ?? c.name}
                    pinColor="blue"
                  />
                  <Circle
                    center={{ latitude: loc.latitude, longitude: loc.longitude }}
                    radius={radius}
                    strokeWidth={2}
                    strokeColor="rgba(0,112,255,0.8)"
                    fillColor="rgba(0,112,255,0.2)"
                  />
                </React.Fragment>
              );
            })
        )}
      </MapView>

      <Animated.View style={[styles.drawer, { transform: [{ translateY: drawerAnim }] }]}>
        <View style={styles.drawerHandleContainer}>
          <View style={styles.handle} />
        </View>
        <View style={styles.drawerContent}>
          <Text style={styles.drawerTitle}>Circles</Text>
          <Text style={styles.drawerSub}>You have {circles.length} circle(s)</Text>

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
      </Animated.View>

      <TouchableOpacity style={styles.fab} onPress={toggleDrawer}>
        <Text style={styles.fabText}>☰</Text>
      </TouchableOpacity>
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

  fab: {
    position: "absolute",
    right: 16,
    bottom: DRAWER_HEIGHT + 16,
    backgroundColor: "#fff",
    borderRadius: 24,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    elevation: 6,
  },
  fabText: { fontSize: 20 },
});
