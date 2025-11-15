import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import MapView, { LatLng, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { API_BASE_URL, authenticatedFetch } from "../../utils/auth";

const CircleScreen: React.FC = () => {
  const router = useRouter();
  const [circleName, setCircleName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [metadata, setMetadata] = useState("{}"); // JSON string
  const [location, setLocation] = useState<LatLng | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreateCircle = async () => {
    if (!circleName || !locationName || !location) {
      Alert.alert("Error", "Please enter all fields and pick a location on the map.");
      return;
    }

    let parsedMetadata = {};
    try {
      parsedMetadata = JSON.parse(metadata);
    } catch (err) {
      Alert.alert("Error", "Metadata must be valid JSON.");
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem("authToken");
      if (!token) {
        Alert.alert("Error", "No auth token found. Please log in again.");
        router.replace("/screens/LogInScreen");
        return;
      }

      const response = await authenticatedFetch(`${API_BASE_URL}/circles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          name: circleName,
          metadata: parsedMetadata,
          location: {
            name: locationName,
            latitude: location.latitude,
            longitude: location.longitude,
            metadata: {},
          },
        }),
      });

      if (response.status === 401) {
        // Token refresh failed or no valid token
        Alert.alert("Authentication Error", "Your session has expired. Please log in again.");
        router.replace("/screens/LogInScreen");
        return;
      }

      const data = await response.json();
      if (response.ok) {
        console.log("Circle created:", data);
        Alert.alert("Success", `Circle created! ID: ${data.data.id}`);
        setCircleName("");
        setLocationName("");
        setLocation(null);
      } else {
        console.error(data);
        Alert.alert("Error", "Failed to create circle.");
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Something went wrong while creating the circle.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Circle Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter circle name"
        value={circleName}
        onChangeText={setCircleName}
      />

      <Text style={styles.label}>Location Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter location name"
        value={locationName}
        onChangeText={setLocationName}
      />

      <Text style={styles.label}>Metadata (JSON)</Text>
      <TextInput
        style={styles.input}
        placeholder='e.g. {"key":"value"}'
        value={metadata}
        onChangeText={setMetadata}
      />

      <Text style={styles.label}>Pick Location on Map</Text>
      <MapView
        style={styles.map}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: 6.9271,
          longitude: 79.8612,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        onPress={(e) => setLocation(e.nativeEvent.coordinate)}
      >
        {location && <Marker coordinate={location} title="Selected Location" />}
      </MapView>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 20 }} />
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleCreateCircle}>
          <Text style={styles.buttonText}>Create Circle</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
  },
  label: {
    fontWeight: "bold",
    marginTop: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    marginTop: 5,
  },
  map: {
    width: "100%",
    height: 300,
    marginTop: 10,
  },
  button: {
    backgroundColor: "#2563eb",
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
  },
});

export default CircleScreen;
