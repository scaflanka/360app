import * as Location from "expo-location";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
  Animated,
  PanResponder,
  ScrollView,
  Platform,
  Image,
  Linking,
  Modal, // <-- Import Modal for the new Map Style selector
  FlatList // <-- Import FlatList for horizontal view
} from "react-native";
import MapView, { Circle, Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";
import { API_BASE_URL, authenticatedFetch, logout } from "../../utils/auth";
import CirclesModal from "./CirclesModal";

// --- Design Constants ---
const COLORS = {
  primary: "#4F359B", // Deep Purple
  white: "#FFFFFF",
  black: "#1A1A1A",
  gray: "#6B7280",
  lightGray: "#F3F4F6",
  border: "#E5E7EB",
  accent: "#8B5CF6",
  sosRed: "#EF4444"
};

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get("window");
const TOP_HEADER_HEIGHT = 60;
const TAB_BAR_HEIGHT = 85;
const HANDLE_HEIGHT = 30;

const MAX_HEIGHT = SCREEN_HEIGHT - TOP_HEADER_HEIGHT;
const MIN_HEIGHT = TAB_BAR_HEIGHT + HANDLE_HEIGHT;

// --- Interfaces ---
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
  creator?: { id: string; name?: string; };
}

interface UserLocation {
  latitude: number;
  longitude: number;
  heading?: number;
}

type MapType = 'standard' | 'satellite' | 'hybrid' | 'terrain';

const isValidCoordinate = (lat: number, lon: number) => {
  return typeof lat === "number" && typeof lon === "number" && !isNaN(lat) && !isNaN(lon);
};

// =======================================================
// MAP SCREEN COMPONENT
// =======================================================
const MapScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadingCircles, setLoadingCircles] = useState(false);
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [circles, setCircles] = useState<CircleData[]>([]);
  const [selectedCircle, setSelectedCircle] = useState<CircleData | null>(null);
  const [activeTab, setActiveTab] = useState("Location");
  
  const [mapLayerStyle, setMapLayerStyle] = useState<MapType>('standard'); 
  const [isMapStyleModalOpen, setIsMapStyleModalOpen] = useState(false);

  const mapRef = useRef<MapView | null>(null);
  const [isCirclesModalOpen, setIsCirclesModalOpen] = useState(false);
  const insets = useSafeAreaInsets();

  // --- Animation State (Pan Responder, SnapTo) ---
  const sheetHeight = useRef(new Animated.Value(MIN_HEIGHT)).current;
  const [isExpanded, setIsExpanded] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 10,
      onPanResponderMove: (_, gestureState) => {
        let newHeight = isExpanded
          ? MAX_HEIGHT - gestureState.dy
          : MIN_HEIGHT - gestureState.dy;

        if (newHeight < MIN_HEIGHT) newHeight = MIN_HEIGHT;
        if (newHeight > MAX_HEIGHT) newHeight = MAX_HEIGHT;

        sheetHeight.setValue(newHeight);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -50) {
          snapTo(MAX_HEIGHT);
          setIsExpanded(true);
        } else if (gestureState.dy > 50) {
          snapTo(MIN_HEIGHT);
          setIsExpanded(false);
        } else {
          const isMovingUp = gestureState.dy < 0;
          if (isMovingUp) {
             snapTo(MAX_HEIGHT); 
             setIsExpanded(true);
          } else {
             snapTo(MIN_HEIGHT);
             setIsExpanded(false);
          }
        }
      },
    })
  ).current;

  const snapTo = (targetHeight: number) => {
    Animated.spring(sheetHeight, {
      toValue: targetHeight,
      useNativeDriver: false,
      bounciness: 4,
      speed: 12
    }).start();
  };

  // --- Data Loading (loadData, loadCircles) ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
          setLocation({ 
            latitude: pos.coords.latitude, 
            longitude: pos.coords.longitude,
            heading: pos.coords.heading || 0
          });
        }
        await loadCircles();
      } catch (e) { console.warn(e); }
      setLoading(false);
    };
    loadData();
  }, []);

  const loadCircles = async () => {
    try {
      setLoadingCircles(true);
      const res = await authenticatedFetch(`${API_BASE_URL}/circles`, { headers: { "Content-Type": "application/json" } });
      if (res.status === 401) return router.replace("/screens/LogInScreen");
      const data = await res.json();
      const list = Array.isArray(data) ? data : data.data || [];
      setCircles(list);
      if (list.length > 0 && !selectedCircle) {
        handleSelectCircle(list[0].id, list);
      }
    } catch (e) { console.warn(e); }
    finally { setLoadingCircles(false); }
  };

  // -----------------------------
  // Handlers
  // -----------------------------
  
  const handleSelectCircle = (circleId: number, circleList = circles) => {
    const found = circleList.find(c => c.id === circleId);
    if (found) {
      setSelectedCircle(found);
      setIsCirclesModalOpen(false);
      
      if (found.Locations && found.Locations.length > 0 && mapRef.current) {
         const coords = found.Locations
           .filter(l => isValidCoordinate(l.latitude, l.longitude))
           .map(l => ({ latitude: l.latitude, longitude: l.longitude }));
         
         if (location) coords.push({ latitude: location.latitude, longitude: location.longitude });

         if (coords.length > 0) {
            setTimeout(() => {
                mapRef.current?.fitToCoordinates(coords, {
                    edgePadding: { top: 100, right: 50, bottom: MIN_HEIGHT + 100, left: 50 },
                    animated: true,
                });
            }, 500);
         }
      }
    }
  };

  const toggleCirclesModal = () => setIsCirclesModalOpen(!isCirclesModalOpen);
  
  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: "destructive", onPress: async () => { await logout(); router.replace("/screens/LogInScreen"); } },
    ]);
  };
  
  const handleOpenMapLayersModal = () => {
      setIsMapStyleModalOpen(true);
  };

  const handleChangeMapStyle = (type: MapType) => {
      setMapLayerStyle(type);
      setIsMapStyleModalOpen(false);
  };

  const handleOpenChat = async () => {
      const url = Platform.OS === 'ios' ? 'sms:' : 'sms:';
      
      const supported = await Linking.canOpenURL(url);

      if (supported) {
          await Linking.openURL(url);
      } else {
          Alert.alert("Chat Unavailable", "Your device does not support opening a direct messaging link.");
      }
  };

  if (loading || !location) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // =======================================================
  // Map Style Selector Modal Component (Horizontal Scroll)
  // =======================================================
  const MapStyleModal: React.FC = () => {
    const mapStyles: { key: MapType; label: string; icon: string; previewColor: string }[] = [
      // Using 'standard' and 'hybrid' as substitutes for 'Auto' and 'Street' since MapView uses these types
      // The labels are updated for better UX/visual match
      { key: 'standard', label: 'Auto', icon: 'map', previewColor: '#84CC16' }, 
      { key: 'hybrid', label: 'Street', icon: 'map-outline', previewColor: '#60A5FA' },
      { key: 'satellite', label: 'Satellite', icon: 'image', previewColor: '#FBBF24' },
      { key: 'terrain', label: 'Terrain', icon: 'earth', previewColor: '#34D399' }
    ];

    const renderMapOption = ({ item }: { item: typeof mapStyles[0] }) => {
      const isSelected = mapLayerStyle === item.key;
      return (
        <TouchableOpacity
          key={item.key}
          style={styles.mapPreviewCard}
          onPress={() => handleChangeMapStyle(item.key)}
        >
          {/* Map Preview Area */}
          <View
            style={[
              styles.mapPreviewInner,
              { backgroundColor: item.previewColor },
              isSelected && styles.mapPreviewInnerSelected,
            ]}
          >
            <Ionicons name={item.icon as any} size={40} color={COLORS.white} />
          </View>
          
          {/* Label (underneath preview) */}
          <View style={styles.mapPreviewLabelContainer}>
            <Text
              style={[
                styles.mapPreviewLabel,
                isSelected && { color: COLORS.primary, fontWeight: '700' },
              ]}
              numberOfLines={1}
            >
              {item.label}
            </Text>
            {/* The checkmark is implied by the border, but we can keep the icon for clarity or remove it */}
          </View>
        </TouchableOpacity>
      );
    };

    return (
      <Modal
        visible={isMapStyleModalOpen}
        transparent={true}
        animationType="fade" // Fade matches the overall style better than slide for this kind of pop-up
        onRequestClose={() => setIsMapStyleModalOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsMapStyleModalOpen(false)}
        >
          {/* The Actual Content Box */}
          <View style={[styles.mapStyleModalContent, { paddingBottom: Platform.OS === 'ios' ? insets.bottom + 10 : 20 }]}>

            {/* Top Close Button and Activate SOS Row */}
            <View style={styles.modalHeaderRow}>
                <TouchableOpacity onPress={() => setIsMapStyleModalOpen(false)} style={styles.modalCloseIcon}>
                    <Ionicons name="close" size={24} color={COLORS.black} />
                </TouchableOpacity>
                <Text style={styles.activateSosText}>Activate SOS →</Text>
            </View>

            <Text style={styles.modalTitle}>Map type</Text>
            
            {/* Horizontal Map Options List */}
            <FlatList
              data={mapStyles}
              renderItem={renderMapOption}
              keyExtractor={(item) => item.key}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalOptionsContainer}
              // Snap to cards like in the screenshot
              snapToInterval={SCREEN_WIDTH * 0.35 + 15} 
              decelerationRate="fast"
            />
            
            {/* Active Style Indicator (White Slider at the bottom of the modal, not tied to FlatList scroll for simplicity) */}
             <View style={styles.activeStyleIndicatorBar}>
                <View style={styles.activeStyleIndicator} />
             </View>
             
          </View>
        </TouchableOpacity>
      </Modal>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* --- MAP LAYER --- */}
      <MapView
        ref={mapRef}
        style={[styles.map, { paddingBottom: MIN_HEIGHT }]}
        provider={PROVIDER_GOOGLE}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }}
        mapType={mapLayerStyle} 
        showsUserLocation={false}
        showsCompass={false}
        showsMyLocationButton={false}
      >
        {/* Markers remain the same */}
        <Marker coordinate={location}>
          <View style={styles.userMarkerContainer}>
            <View style={styles.userMarkerOuter}>
              <View style={styles.userMarkerInner}>
                <Image 
                  source={{ uri: "https://i.pravatar.cc/100?img=12" }} 
                  style={styles.avatarImage} 
                />
              </View>
            </View>
            <View style={styles.markerArrow} />
          </View>
        </Marker>

        {selectedCircle?.Locations?.map((loc, index) => {
           if (!isValidCoordinate(loc.latitude, loc.longitude)) return null;
           return (
             <Marker 
                key={`loc-${index}`}
                coordinate={{ latitude: loc.latitude, longitude: loc.longitude }}
                title={loc.name || "Member"}
             >
                <View style={styles.memberMarkerContainer}>
                    <View style={[styles.memberMarkerBubble, { backgroundColor: COLORS.accent }]}>
                         <Text style={styles.memberMarkerText}>
                            {(loc.name || "M").charAt(0).toUpperCase()}
                         </Text>
                    </View>
                    <View style={[styles.markerArrow, { borderTopColor: COLORS.accent }]} />
                </View>
             </Marker>
           );
        })}
      </MapView>

      {/* --- TOP HEADER --- */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.roundButton}>
          <Ionicons name="settings-sharp" size={24} color={COLORS.black} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.circleSelector} onPress={toggleCirclesModal} activeOpacity={0.9}>
          <View style={styles.selectorTextContainer}>
             <Text style={styles.selectorLabel}>Current Circle</Text>
             <Text style={styles.circleName} numberOfLines={1}>
               {selectedCircle ? selectedCircle.name : "Select Circle"}
             </Text>
          </View>
          <Ionicons name="chevron-down" size={20} color={COLORS.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.roundButton} onPress={handleOpenChat}> 
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={COLORS.black} />
        </TouchableOpacity>
      </View>

      {/* --- FLOATING MAP BUTTONS --- */}
      <View style={styles.floatingControlsContainer}>
        
        <TouchableOpacity style={styles.pillButton}>
            <View style={styles.iconCirclePurple}>
                <Ionicons name="checkmark" size={16} color={COLORS.white} />
            </View>
            <Text style={styles.pillButtonText}>Check in</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.pillButton}>
            <View style={styles.iconCircleRed}>
                <MaterialCommunityIcons name="lifebuoy" size={18} color={COLORS.white} />
            </View>
            <Text style={styles.pillButtonText}>SOS</Text>
        </TouchableOpacity>

        {/* Layers Button - Now opens the Modal */}
        <TouchableOpacity style={styles.roundButtonSmall} onPress={handleOpenMapLayersModal}>
            <Ionicons name="layers" size={22} color={COLORS.primary} />
        </TouchableOpacity>

      </View>

      {/* --- UNIFIED BOTTOM SHEET (Content and Nav) --- */}
      <Animated.View
        style={[
          styles.unifiedSheet,
          { height: sheetHeight, paddingBottom: insets.bottom }
        ]}
      >
        <View {...panResponder.panHandlers} style={styles.dragHandleContainer}>
          <View style={styles.dragHandle} />
        </View>

        <View style={{ flex: 1, width: '100%' }}>
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={isExpanded}
          >
            {/* Sheet Content remains the same */}
            <View style={styles.sectionTitleContainer}>
              <Text style={styles.sectionTitle}>People in {selectedCircle?.name || "Circle"}</Text>
            </View>

            <TouchableOpacity style={styles.listItem}>
              <View style={[styles.listIconCircle, {borderStyle: 'dashed', borderColor: COLORS.primary}]}>
                <Ionicons name="add" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.listItemText}>Add a new member</Text>
            </TouchableOpacity>

            {selectedCircle?.Locations && selectedCircle.Locations.length > 0 ? (
                selectedCircle.Locations.map((loc, idx) => (
                    <TouchableOpacity key={idx} style={styles.listItem}>
                        <View style={[styles.listIconCircle, { backgroundColor: COLORS.accent }]}>
                            <Text style={{ color: 'white', fontWeight: 'bold' }}>
                                {(loc.name || "U").charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <View>
                            <Text style={styles.listItemText}>{loc.name || "Unknown Member"}</Text>
                            <Text style={styles.listItemSubText}>
                                {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))
            ) : (
                <View style={styles.emptyStateItem}>
                    <Text style={styles.listItemSubText}>No other members in this circle yet.</Text>
                </View>
            )}
            
            <View style={styles.divider} />
            
            <View style={styles.sectionTitleContainer}>
                <Text style={styles.sectionTitle}>Items</Text>
            </View>
             <TouchableOpacity style={styles.listItem}>
                <View style={[styles.listIconCircle, { backgroundColor: '#F3E8FF' }]}>
                    <MaterialCommunityIcons name="tag-outline" size={20} color={COLORS.primary} />
                </View>
                <View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={styles.listItemText}>Add an item</Text>
                        <View style={styles.newBadge}><Text style={styles.newBadgeText}>NEW</Text></View>
                    </View>
                    <Text style={styles.listItemSubText}>Keys, wallet, backpack...</Text>
                </View>
            </TouchableOpacity>
            <View style={{ height: 20 }} />
          </ScrollView>
        </View>

        {/* Navigation Bar remains the same */}
        <View style={styles.navBar}>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab("Location")}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="map-marker-radius" size={28} color={activeTab === "Location" ? COLORS.primary : COLORS.gray} />
            </View>
            <Text style={[styles.navText, activeTab === "Location" && styles.activeNavText]}>Location</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab("Driving")}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="steering" size={28} color={activeTab === "Driving" ? COLORS.primary : COLORS.gray} />
            </View>
            <Text style={[styles.navText, activeTab === "Driving" && styles.activeNavText]}>Driving</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab("Safety")}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="shield-check-outline" size={28} color={activeTab === "Safety" ? COLORS.primary : COLORS.gray} />
            </View>
            <Text style={[styles.navText, activeTab === "Safety" && styles.activeNavText]}>Safety</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* --- EXPLICIT MODALS --- */}
      <CirclesModal
        isOpen={isCirclesModalOpen}
        onClose={() => setIsCirclesModalOpen(false)}
        onRefresh={loadCircles}
        circles={circles}
        loadingCircles={loadingCircles}
        onSelectCircle={handleSelectCircle}
      />

      {/* NEW: Horizontal Map Style Selector Modal */}
      <MapStyleModal />
    </View>
  );
};

export default MapScreen;

// =======================================================
// STYLES
// =======================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  map: { flex: 1 },

  // --- Map Style Modal Styles (Updated to match screenshot) ---
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  mapStyleModalContent: {
    width: '100%',
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalCloseIcon: {
    padding: 5,
  },
  activateSosText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    padding: 5,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.black,
    marginBottom: 20,
  },
  
  // NEW STYLES FOR HORIZONTAL LAYOUT
  horizontalOptionsContainer: {
    paddingVertical: 10,
    paddingHorizontal: 5,
  },
  mapPreviewCard: {
    width: SCREEN_WIDTH * 0.35, 
    marginRight: 15,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    // Removed outer shadow for cleaner look, relying on the primary border
  },
  mapPreviewInner: {
    height: SCREEN_WIDTH * 0.35 * 0.8, // Aspect ratio approximation
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8, // Inner preview needs slightly smaller radius
    overflow: 'hidden',
    borderWidth: 2, // Default border for non-selected
    borderColor: COLORS.lightGray,
  },
  mapPreviewInnerSelected: {
    borderColor: COLORS.primary, // Primary color border on select
    borderWidth: 3,
  },
  mapPreviewLabelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  mapPreviewLabel: {
    fontSize: 14,
    color: COLORS.black,
    fontWeight: '500',
    textAlign: 'center',
  },
  activeStyleIndicatorBar: {
    height: 10,
    width: '100%',
    backgroundColor: COLORS.lightGray,
    borderRadius: 5,
    marginTop: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeStyleIndicator: {
    height: 6,
    width: '30%', // Placeholder width, actual implementation would animate this position
    backgroundColor: COLORS.white,
    borderRadius: 3,
    position: 'absolute',
    left: '5%', // Just to visually represent the slider
  },
  
  // Header
  headerContainer: { 
    position: "absolute", top: 0, left: 0, right: 0, 
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", 
    paddingHorizontal: 16, paddingBottom: 10, zIndex: 10 
  },
  roundButton: { 
    width: 44, height: 44, borderRadius: 22, 
    backgroundColor: COLORS.white, justifyContent: "center", alignItems: "center", 
    elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3 
  },
  circleSelector: { 
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", 
    backgroundColor: COLORS.white, marginHorizontal: 12, 
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24, 
    elevation: 4, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 3 
  },
  selectorTextContainer: { flex: 1, justifyContent: 'center' },
  selectorLabel: { fontSize: 10, color: COLORS.gray, textTransform: 'uppercase', fontWeight: '700' },
  circleName: { fontSize: 16, fontWeight: "700", color: COLORS.primary },

  // --- Floating Controls (Check In, SOS, Layers) ---
  floatingControlsContainer: {
    position: 'absolute',
    bottom: MIN_HEIGHT + 15,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 15,
  },
  pillButton: {
    backgroundColor: COLORS.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 30,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    marginRight: 8,
  },
  pillButtonText: {
    marginLeft: 8,
    fontWeight: '600',
    color: COLORS.primary,
    fontSize: 14,
  },
  iconCirclePurple: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleRed: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundButtonSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },

  // Markers
  userMarkerContainer: { alignItems: 'center' },
  userMarkerOuter: { 
    width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.primary, 
    justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: COLORS.white, 
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 
  },
  userMarkerInner: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: COLORS.lightGray },
  avatarImage: { width: '100%', height: '100%' },
  markerArrow: { 
    width: 0, height: 0, backgroundColor: "transparent", borderStyle: "solid", 
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8, 
    borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: COLORS.primary, marginTop: -1 
  },
  
  memberMarkerContainer: { alignItems: 'center' },
  memberMarkerBubble: {
      width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center',
      borderWidth: 2, borderColor: COLORS.white, elevation: 4
  },
  memberMarkerText: { color: 'white', fontWeight: 'bold', fontSize: 14 },

  // Bottom Sheet
  unifiedSheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    elevation: 20, shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.15, shadowRadius: 8,
    zIndex: 20, overflow: 'hidden'
  },
  dragHandleContainer: { width: '100%', height: HANDLE_HEIGHT, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.white },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB' },
  
  sheetContent: { paddingHorizontal: 20, paddingTop: 5 },
  sectionTitleContainer: { paddingVertical: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: COLORS.black },
  divider: { height: 1, backgroundColor: COLORS.lightGray, marginVertical: 10 },
  
  listItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  emptyStateItem: { paddingVertical: 12 },
  listIconCircle: { 
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.lightGray, 
    alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1, borderColor: '#E5E7EB' 
  },
  listItemText: { fontSize: 16, fontWeight: '600', color: COLORS.black },
  listItemSubText: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  
  newBadge: { backgroundColor: '#FEF08A', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
  newBadgeText: { fontSize: 10, fontWeight: '800', color: '#854D0E' },

  // Nav Bar
  navBar: {
    height: TAB_BAR_HEIGHT, flexDirection: "row", width: '100%',
    justifyContent: "space-around", alignItems: "flex-start", paddingTop: 12,
    borderTopWidth: 1, borderTopColor: '#F3F4F6', backgroundColor: COLORS.white
  },
  navItem: { alignItems: "center", justifyContent: "flex-start", flex: 1 },
  iconContainer: { marginBottom: 4 },
  navText: { fontSize: 11, color: COLORS.gray, fontWeight: "600" },
  activeNavText: { color: COLORS.primary, fontWeight: "700" },
});