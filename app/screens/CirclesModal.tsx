import { router } from "expo-router";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL, authenticatedFetch } from "../../utils/auth";

const { height: windowHeight } = Dimensions.get("window");

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

interface InvitationData {
  id: string;
  userId?: string;
  circleId: string;
  circle_id?: string;
  role?: string;
  status?: string;
  circleName?: string;
  circle?: {
    id: string;
    name?: string;
  };
  Circle?: {
    id: string;
    name?: string;
    creator?: {
      id: string;
      name?: string;
      email?: string;
      avatar?: string | null;
    };
  };
  inviterName?: string;
  inviter?: {
    id: string;
    name?: string;
  };
  Inviter?: {
    id: string;
    name?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  metadata?: Record<string, any>;
}

interface CircleDetails {
  id: string;
  name: string;
  creatorId: string;
  metadata?: Record<string, any>;
  creator: User;
  Users?: Array<{
    id: string;
    name: string;
    email: string;
    avatar?: string;
    Membership?: {
      role: string;
      status: string;
    };
  }>;
  users?: User[]; // Keep for backward compatibility
  createdAt: string;
  updatedAt: string;
}

interface CirclesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  circles: CircleData[];
  loadingCircles: boolean;
}

const CirclesModal: React.FC<CirclesModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
  circles,
  loadingCircles,
}) => {
  // Full screen modal animation
  const modalAnim = useRef(new Animated.Value(windowHeight)).current;
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Create circle modal
  const createModalAnim = useRef(new Animated.Value(windowHeight)).current;
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [circleName, setCircleName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{
      place_id: string;
      description: string;
      name?: string;
      geometry?: { location: { lat: number; lng: number } };
    }>
  >([]);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    name: string;
  } | null>(null);
  const [creatingCircle, setCreatingCircle] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"myCircles" | "invitations">("myCircles");

  // Invitations state
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);

  // Current user ID
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Circle details modal
  const circleDetailsAnim = useRef(new Animated.Value(windowHeight)).current;
  const [isCircleDetailsOpen, setIsCircleDetailsOpen] = useState(false);
  const [selectedCircle, setSelectedCircle] = useState<CircleDetails | null>(null);
  const [loadingCircleDetails, setLoadingCircleDetails] = useState(false);

  // Invite user modal
  const inviteModalAnim = useRef(new Animated.Value(windowHeight)).current;
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [invitingUser, setInvitingUser] = useState(false);
  const [refreshingCircles, setRefreshingCircles] = useState(false);
  const [refreshingInvitations, setRefreshingInvitations] = useState(false);
  const [refreshingCircleDetails, setRefreshingCircleDetails] = useState(false);

  // Sync modal state with prop
  React.useEffect(() => {
    if (isOpen && !isModalOpen) {
      // Open modal
      setIsModalOpen(true);
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (!isOpen && isModalOpen) {
      // Close modal
      Animated.timing(modalAnim, {
        toValue: windowHeight,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIsModalOpen(false);
        onRefresh();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isModalOpen]);

  // Load current user ID when modal opens
  React.useEffect(() => {
    const loadCurrentUser = async () => {
      if (isModalOpen && !currentUserId) {
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
      }
    };
    loadCurrentUser();
  }, [isModalOpen, currentUserId]);

  // Load invitations when invitations tab is active
  React.useEffect(() => {
    if (isModalOpen && activeTab === "invitations") {
      loadInvitations();
    }
  }, [isModalOpen, activeTab]);

  // Load circle details when details modal opens
  React.useEffect(() => {
    if (isCircleDetailsOpen) {
      // Don't reload if we already have the circle data
      // The load will happen in openCircleDetails
    }
  }, [isCircleDetailsOpen]);

  // -----------------------------
  // Load invitations
  // -----------------------------
  const loadInvitations = async () => {
    try {
      setLoadingInvitations(true);
      const response = await authenticatedFetch(`${API_BASE_URL}/profile/pending-requests`, {
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
      });

      if (response.status === 401) {
        Alert.alert("Authentication Error", "Your session has expired. Please log in again.");
        router.replace("/screens/LogInScreen");
        return;
      }

      const data = await response.json();
      if (response.ok) {
        // Handle different response formats
        let invitationsData: InvitationData[] = [];
        if (Array.isArray(data)) {
          invitationsData = data;
        } else if (data?.data && Array.isArray(data.data)) {
          invitationsData = data.data;
        } else if (data?.invitations && Array.isArray(data.invitations)) {
          invitationsData = data.invitations;
        } else {
          invitationsData = [];
        }
        setInvitations(invitationsData);
      } else {
        console.error("Failed to load invitations:", data);
        setInvitations([]);
      }
    } catch (error) {
      console.error("Error loading invitations:", error);
      setInvitations([]);
    } finally {
      setLoadingInvitations(false);
    }
  };

  // -----------------------------
  // Accept invitation
  // -----------------------------
  const handleAcceptInvitation = (circleId: number | string, circleName?: string) => {
    Alert.alert(
      "Accept Invitation",
      `Are you sure you want to accept the invitation to join "${circleName || "this circle"}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          style: "default",
          onPress: async () => {
            try {
              const response = await authenticatedFetch(
                `${API_BASE_URL}/circles/${circleId}/accept-invite`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    accept: "application/json",
                  },
                }
              );

              if (response.status === 401) {
                Alert.alert(
                  "Authentication Error",
                  "Your session has expired. Please log in again."
                );
                router.replace("/screens/LogInScreen");
                return;
              }

              const data = await response.json();
              if (response.ok) {
                Alert.alert("Success", "Invitation accepted successfully!");
                // Reload invitations and circles
                await loadInvitations();
                await onRefresh();
              } else {
                Alert.alert(
                  "Error",
                  data.message || "Failed to accept invitation. Please try again."
                );
              }
            } catch (error) {
              console.error("Error accepting invitation:", error);
              Alert.alert("Error", "Something went wrong. Please try again.");
            }
          },
        },
      ]
    );
  };

  // -----------------------------
  // Load circle details
  // -----------------------------
  const loadCircleDetails = async (circleId: string | number) => {
    try {
      setLoadingCircleDetails(true);
      const response = await authenticatedFetch(`${API_BASE_URL}/circles/${circleId}`, {
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
      });

      if (response.status === 401) {
        Alert.alert("Authentication Error", "Your session has expired. Please log in again.");
        router.replace("/screens/LogInScreen");
        return;
      }

      const responseData = await response.json();
      if (response.ok) {
        // Extract the actual circle data from the nested response structure
        const circleData = responseData.data || responseData;
        setSelectedCircle(circleData);
      } else {
        Alert.alert("Error", "Failed to load circle details. Please try again.");
      }
    } catch (error) {
      console.error("Error loading circle details:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoadingCircleDetails(false);
      setRefreshingCircleDetails(false);
    }
  };

  // -----------------------------
  // Open circle details
  // -----------------------------
  const openCircleDetails = (circleId: number) => {
    // Find circle from the list or load it
    const circle = circles.find((c) => c.id === circleId);
    if (circle) {
      setSelectedCircle(null); // Reset first
      setIsCircleDetailsOpen(true);
      Animated.timing(circleDetailsAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
      // Load details
      loadCircleDetails(circleId);
    }
  };

  // -----------------------------
  // Close circle details
  // -----------------------------
  const closeCircleDetails = () => {
    Animated.timing(circleDetailsAnim, {
      toValue: windowHeight,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsCircleDetailsOpen(false);
      setSelectedCircle(null);
      setInviteEmail("");
      setInviteRole("member");
    });
  };

  // -----------------------------
  // Toggle invite user modal
  // -----------------------------
  const toggleInviteModal = () => {
    Animated.timing(inviteModalAnim, {
      toValue: isInviteModalOpen ? windowHeight : 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsInviteModalOpen(!isInviteModalOpen);
      if (isInviteModalOpen) {
        setInviteEmail("");
        setInviteRole("member");
      }
    });
  };

  // -----------------------------
  // Invite user to circle
  // -----------------------------
  const handleInviteUser = async (circleId: string, email: string, role: "member" | "admin") => {
    try {
      setInvitingUser(true);
      const response = await authenticatedFetch(`${API_BASE_URL}/circles/${circleId}/invite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          email: email,
          role: role,
        }),
      });

      if (response.status === 401) {
        Alert.alert("Authentication Error", "Your session has expired. Please log in again.");
        router.replace("/screens/LogInScreen");
        return;
      }

      const data = await response.json();
      if (response.ok) {
        Alert.alert("Success", `Invitation sent to ${email}!`);
        // Close invite modal
        Animated.timing(inviteModalAnim, {
          toValue: windowHeight,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setIsInviteModalOpen(false);
          setInviteEmail("");
          setInviteRole("member");
        });
        // Refresh circle details to get updated user list
        await loadCircleDetails(circleId);
      } else {
        Alert.alert("Error", data.message || "Failed to send invitation. Please try again.");
      }
    } catch (error) {
      console.error("Error inviting user:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setInvitingUser(false);
    }
  };

  // -----------------------------
  // Refresh handlers
  // -----------------------------
  const onRefreshCircles = async () => {
    setRefreshingCircles(true);
    await onRefresh();
    setRefreshingCircles(false);
  };

  const onRefreshInvitations = async () => {
    setRefreshingInvitations(true);
    await loadInvitations();
    setRefreshingInvitations(false);
  };

  const onRefreshCircleDetails = async () => {
    if (selectedCircle) {
      setRefreshingCircleDetails(true);
      await loadCircleDetails(selectedCircle.id);
    }
  };

  // -----------------------------
  // Reject invitation
  // -----------------------------
  const handleRejectInvitation = (circleId: number | string, circleName?: string) => {
    Alert.alert(
      "Reject Invitation",
      `Are you sure you want to reject the invitation to join "${circleName || "this circle"}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            try {
              const response = await authenticatedFetch(
                `${API_BASE_URL}/circles/${circleId}/reject-invite`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    accept: "application/json",
                  },
                }
              );

              if (response.status === 401) {
                Alert.alert(
                  "Authentication Error",
                  "Your session has expired. Please log in again."
                );
                router.replace("/screens/LogInScreen");
                return;
              }

              const data = await response.json();
              if (response.ok) {
                Alert.alert("Success", "Invitation rejected.");
                // Reload invitations
                await loadInvitations();
              } else {
                Alert.alert(
                  "Error",
                  data.message || "Failed to reject invitation. Please try again."
                );
              }
            } catch (error) {
              console.error("Error rejecting invitation:", error);
              Alert.alert("Error", "Something went wrong. Please try again.");
            }
          },
        },
      ]
    );
  };

  // -----------------------------
  // Create circle modal toggle
  // -----------------------------
  const toggleCreateModal = () => {
    Animated.timing(createModalAnim, {
      toValue: isCreateModalOpen ? windowHeight : 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setIsCreateModalOpen(!isCreateModalOpen);
      if (isCreateModalOpen) {
        // Reset form when closing
        setCircleName("");
        setLocationName("");
        setSearchQuery("");
        setSelectedLocation(null);
        setSearchResults([]);
      }
    });
  };

  // -----------------------------
  // Search location from Google Maps (Autocomplete)
  // -----------------------------
  const searchLocationAutocomplete = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearchingLocation(true);
      const apiKey = "AIzaSyBoqhQWOBssPSZpeWLuVEiaqF0Qzu2oQqk"; // From app.json
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
          query
        )}&key=${apiKey}`
      );

      const data = await response.json();

      if (data.predictions && Array.isArray(data.predictions)) {
        setSearchResults(data.predictions);
      } else {
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error searching location:", error);
      setSearchResults([]);
    } finally {
      setSearchingLocation(false);
    }
  };

  // -----------------------------
  // Handle location search input change
  // -----------------------------
  const handleLocationSearchChange = (text: string) => {
    setSearchQuery(text);
    setSelectedLocation(null);
    if (text.trim()) {
      searchLocationAutocomplete(text);
    } else {
      setSearchResults([]);
    }
  };

  // -----------------------------
  // Select location from dropdown
  // -----------------------------
  const selectLocation = async (placeId: string, description: string) => {
    try {
      setSearchingLocation(true);
      const apiKey = "AIzaSyBoqhQWOBssPSZpeWLuVEiaqF0Qzu2oQqk";
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,geometry&key=${apiKey}`
      );

      const data = await response.json();

      if (data.result && data.result.geometry) {
        const location = data.result.geometry.location;
        setSelectedLocation({
          latitude: location.lat,
          longitude: location.lng,
          name: data.result.name || description,
        });
        setLocationName(data.result.name || description);
        setSearchQuery(data.result.name || description);
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Error getting location details:", error);
      Alert.alert("Error", "Failed to get location details. Please try again.");
    } finally {
      setSearchingLocation(false);
    }
  };

  // -----------------------------
  // Create circle
  // -----------------------------
  const handleCreateCircle = async () => {
    if (!circleName.trim() || !locationName.trim() || !selectedLocation) {
      Alert.alert("Error", "Please enter circle name and select a location");
      return;
    }

    try {
      setCreatingCircle(true);
      const response = await authenticatedFetch(`${API_BASE_URL}/circles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          name: circleName,
          location: {
            name: locationName,
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
          },
        }),
      });

      if (response.status === 401) {
        Alert.alert("Authentication Error", "Your session has expired. Please log in again.");
        router.replace("/screens/LogInScreen");
        return;
      }

      const data = await response.json();
      if (response.ok) {
        Alert.alert("Success", "Circle created successfully!");
        // Reset form
        setCircleName("");
        setLocationName("");
        setSearchQuery("");
        setSelectedLocation(null);
        setSearchResults([]);
        // Close create modal
        Animated.timing(createModalAnim, {
          toValue: windowHeight,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setIsCreateModalOpen(false));
        // Reload circles
        await onRefresh();
      } else {
        Alert.alert("Error", "Failed to create circle. Please try again.");
      }
    } catch (error) {
      console.error("Error creating circle:", error);
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setCreatingCircle(false);
    }
  };

  if (!isModalOpen) {
    return null;
  }

  return (
    <>
      {/* Full screen modal */}
      <Animated.View style={[styles.fullScreenModal, { transform: [{ translateY: modalAnim }] }]}>
        <SafeAreaView style={styles.modalSafeArea} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Circles</Text>
            <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
              <Text style={styles.modalCloseButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "myCircles" && styles.activeTab]}
              onPress={() => setActiveTab("myCircles")}
            >
              <Text style={[styles.tabText, activeTab === "myCircles" && styles.activeTabText]}>
                My Circles
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "invitations" && styles.activeTab]}
              onPress={() => setActiveTab("invitations")}
            >
              <Text style={[styles.tabText, activeTab === "invitations" && styles.activeTabText]}>
                Invitations
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {activeTab === "myCircles" ? (
              <>
                {loadingCircles ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.drawerSub}>Loading circles...</Text>
                  </View>
                ) : circles.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No circles yet</Text>
                    <Text style={styles.emptySubText}>Tap the + button to create one</Text>
                  </View>
                ) : (
                  <FlatList
                    data={circles}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => {
                      // Check if current user is the creator
                      const isCreator =
                        currentUserId &&
                        (item.creatorId === currentUserId || item.creator?.id === currentUserId);
                      return (
                        <TouchableOpacity
                          style={[styles.circleItem, !isCreator && styles.circleItemDisabled]}
                          onPress={() => {
                            if (isCreator) {
                              openCircleDetails(item.id);
                            }
                          }}
                          disabled={!isCreator}
                        >
                          <Text style={styles.circleName}>{item.name || "Unnamed Circle"}</Text>
                          <Text style={styles.circleLocations}>
                            {item.Locations?.length || 0} location(s)
                          </Text>
                          {!isCreator && (
                            <Text style={styles.circleDisabledText}>
                              Only creator can view details
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    }}
                    contentContainerStyle={styles.circlesList}
                    refreshControl={
                      <RefreshControl refreshing={refreshingCircles} onRefresh={onRefreshCircles} />
                    }
                  />
                )}
              </>
            ) : (
              <>
                {loadingInvitations ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#2563eb" />
                    <Text style={styles.drawerSub}>Loading invitations...</Text>
                  </View>
                ) : invitations.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No pending invitations</Text>
                    <Text style={styles.emptySubText}>You don't have any circle invitations</Text>
                  </View>
                ) : (
                  <FlatList
                    data={invitations}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => {
                      // API structure: Circle.name for circle name, Circle.creator.name for inviter
                      const circleName =
                        item.Circle?.name ||
                        item.circleName ||
                        item.circle?.name ||
                        "Unnamed Circle";
                      const inviterName =
                        item.Circle?.creator?.name ||
                        item.inviterName ||
                        item.inviter?.name ||
                        item.Inviter?.name;
                      const circleId = item.circleId || item.circle_id || item.Circle?.id || "";
                      return (
                        <View style={styles.invitationItem}>
                          <View style={styles.invitationContent}>
                            <Text style={styles.invitationCircleName}>{circleName}</Text>
                            {inviterName && (
                              <Text style={styles.invitationInviter}>
                                Invited by: {inviterName}
                              </Text>
                            )}
                          </View>
                          <View style={styles.invitationActions}>
                            <TouchableOpacity
                              style={[styles.invitationButton, styles.acceptButton]}
                              onPress={() => handleAcceptInvitation(circleId, circleName)}
                            >
                              <Text style={styles.acceptButtonText}>Accept</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.invitationButton, styles.rejectButton]}
                              onPress={() => handleRejectInvitation(circleId, circleName)}
                            >
                              <Text style={styles.rejectButtonText}>Reject</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }}
                    contentContainerStyle={styles.circlesList}
                    refreshControl={
                      <RefreshControl
                        refreshing={refreshingInvitations}
                        onRefresh={onRefreshInvitations}
                      />
                    }
                  />
                )}
              </>
            )}
          </View>
        </SafeAreaView>

        {/* Floating Action Button - Only show on My Circles tab */}
        {activeTab === "myCircles" && (
          <TouchableOpacity style={styles.fab} onPress={toggleCreateModal}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Create Circle Modal */}
      <Animated.View
        style={[
          styles.fullScreenModal,
          styles.createModal,
          { transform: [{ translateY: createModalAnim }] },
        ]}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create Circle</Text>
            <TouchableOpacity style={styles.modalCloseButton} onPress={toggleCreateModal}>
              <Text style={styles.modalCloseButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.label}>Circle Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter circle name"
              value={circleName}
              onChangeText={setCircleName}
            />

            <Text style={styles.label}>Location</Text>
            <View style={styles.locationSearchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search location on Google Maps"
                value={searchQuery}
                onChangeText={handleLocationSearchChange}
                onFocus={() => {
                  if (searchQuery.trim()) {
                    searchLocationAutocomplete(searchQuery);
                  }
                }}
              />
              {searchingLocation && (
                <ActivityIndicator size="small" color="#2563eb" style={styles.searchLoader} />
              )}
            </View>

            {/* Dropdown results */}
            {searchResults.length > 0 && !selectedLocation && (
              <View style={styles.dropdownContainer}>
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.place_id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => selectLocation(item.place_id, item.description)}
                    >
                      <Text style={styles.dropdownItemText}>{item.description}</Text>
                    </TouchableOpacity>
                  )}
                  nestedScrollEnabled
                />
              </View>
            )}

            {selectedLocation && (
              <View style={styles.selectedLocation}>
                <Text style={styles.selectedLocationText}>Selected: {locationName}</Text>
                <Text style={styles.selectedLocationCoords}>
                  {selectedLocation.latitude.toFixed(4)}, {selectedLocation.longitude.toFixed(4)}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.createButton, creatingCircle && styles.createButtonDisabled]}
              onPress={handleCreateCircle}
              disabled={creatingCircle}
            >
              {creatingCircle ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Create Circle</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>

      {/* Circle Details Modal */}
      <Animated.View
        style={[
          styles.fullScreenModal,
          styles.createModal,
          { transform: [{ translateY: circleDetailsAnim }] },
        ]}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{selectedCircle?.name || "Circle"}</Text>
            <TouchableOpacity style={styles.modalCloseButton} onPress={closeCircleDetails}>
              <Text style={styles.modalCloseButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.modalContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshingCircleDetails}
                onRefresh={onRefreshCircleDetails}
              />
            }
          >
            {loadingCircleDetails && !selectedCircle ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#2563eb" />
                <Text style={styles.drawerSub}>Loading circle details...</Text>
              </View>
            ) : selectedCircle ? (
              (() => {
                // Try multiple ways to access the Users array
                const users =
                  selectedCircle.Users ??
                  selectedCircle["Users"] ??
                  selectedCircle.users ??
                  selectedCircle["users"] ??
                  [];
                return (
                  <>
                    <View style={styles.circleDetailSection}>
                      <Text style={styles.sectionTitle}>Users ({users.length})</Text>
                      {users.length === 0 ? (
                        <Text style={styles.emptyText}>No users yet</Text>
                      ) : (
                        <View style={styles.usersList}>
                          {users.map((user) => (
                            <View key={user.id} style={styles.userItem}>
                              <View style={styles.userInfo}>
                                <Text style={styles.userName}>{user.name}</Text>
                                <Text style={styles.userEmail}>{user.email}</Text>
                              </View>
                              {selectedCircle.creatorId === user.id && (
                                <View style={styles.creatorBadge}>
                                  <Text style={styles.creatorBadgeText}>Creator</Text>
                                </View>
                              )}
                            </View>
                          ))}
                        </View>
                      )}
                    </View>
                  </>
                );
              })()
            ) : null}
          </ScrollView>
        </SafeAreaView>

        {/* Floating Action Button for Invite User */}
        {selectedCircle && (
          <TouchableOpacity style={styles.inviteFab} onPress={toggleInviteModal}>
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Invite User Modal */}
      <Animated.View
        style={[
          styles.fullScreenModal,
          styles.createModal,
          { transform: [{ translateY: inviteModalAnim }], zIndex: 1003 },
        ]}
      >
        <SafeAreaView style={styles.modalSafeArea} edges={["top", "bottom"]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Invite User</Text>
            <TouchableOpacity style={styles.modalCloseButton} onPress={toggleInviteModal}>
              <Text style={styles.modalCloseButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalContent}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter user email"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <Text style={styles.label}>Role</Text>
            <View style={styles.roleContainer}>
              <TouchableOpacity
                style={[styles.roleButton, inviteRole === "member" && styles.roleButtonActive]}
                onPress={() => setInviteRole("member")}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    inviteRole === "member" && styles.roleButtonTextActive,
                  ]}
                >
                  Member
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleButton, inviteRole === "admin" && styles.roleButtonActive]}
                onPress={() => setInviteRole("admin")}
              >
                <Text
                  style={[
                    styles.roleButtonText,
                    inviteRole === "admin" && styles.roleButtonTextActive,
                  ]}
                >
                  Admin
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.createButton, invitingUser && styles.createButtonDisabled]}
              onPress={() => {
                if (!inviteEmail.trim()) {
                  Alert.alert("Error", "Please enter an email address");
                  return;
                }
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(inviteEmail)) {
                  Alert.alert("Error", "Please enter a valid email address");
                  return;
                }
                if (selectedCircle) {
                  handleInviteUser(selectedCircle.id, inviteEmail.trim(), inviteRole);
                }
              }}
              disabled={invitingUser}
            >
              {invitingUser ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Send Invitation</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Animated.View>
    </>
  );
};

export default CirclesModal;

const styles = StyleSheet.create({
  // Full screen modal styles
  fullScreenModal: {
    position: "absolute",
    left: 0,
    right: 0,
    height: windowHeight,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    elevation: 10,
    zIndex: 1000,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  modalTitle: { fontSize: 18, fontWeight: "700" },
  modalContent: { padding: 16, flex: 1 },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  modalCloseButtonText: { color: "#374151", fontWeight: "700", fontSize: 18 },
  drawerSub: { marginTop: 4, color: "#6b7280" },
  loadingContainer: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  // Circles list styles
  circlesList: {
    paddingVertical: 8,
  },
  circleItem: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  circleItemDisabled: {
    opacity: 0.6,
    backgroundColor: "#f3f4f6",
  },
  circleDisabledText: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
    fontStyle: "italic",
  },
  circleName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  circleLocations: {
    fontSize: 14,
    color: "#6b7280",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: "#6b7280",
  },

  // Tabs
  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    borderBottomColor: "#2563eb",
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  activeTabText: {
    color: "#2563eb",
  },

  // Floating Action Button
  fab: {
    position: "absolute",
    right: 16,
    bottom: 32,
    backgroundColor: "#2563eb",
    borderRadius: 28,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    zIndex: 1001,
  },
  fabText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 28,
  },

  // Create circle form styles
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#1f2937",
    backgroundColor: "#fff",
  },
  locationSearchContainer: {
    position: "relative",
  },
  searchInput: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 40,
    fontSize: 16,
    color: "#1f2937",
    backgroundColor: "#fff",
  },
  searchLoader: {
    position: "absolute",
    right: 12,
    top: 12,
  },
  dropdownContainer: {
    marginTop: 4,
    maxHeight: 200,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 10,
  },
  dropdownItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  dropdownItemText: {
    fontSize: 14,
    color: "#1f2937",
  },
  selectedLocation: {
    backgroundColor: "#eff6ff",
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  selectedLocationText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e40af",
    marginBottom: 4,
  },
  selectedLocationCoords: {
    fontSize: 12,
    color: "#3b82f6",
  },
  createButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  createButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createModal: {
    zIndex: 1002, // Above circles modal
  },

  // Invitations
  invitationItem: {
    backgroundColor: "#f9fafb",
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  invitationContent: {
    marginBottom: 12,
  },
  invitationCircleName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  invitationInviter: {
    fontSize: 14,
    color: "#6b7280",
  },
  invitationActions: {
    flexDirection: "row",
    gap: 8,
  },
  invitationButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  acceptButton: {
    backgroundColor: "#10b981",
  },
  acceptButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  rejectButton: {
    backgroundColor: "#ef4444",
  },
  rejectButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },

  // Circle details styles
  circleDetailSection: {
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 12,
  },
  usersList: {
    gap: 8,
  },
  userItem: {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 2,
  },
  userEmail: {
    fontSize: 12,
    color: "#6b7280",
  },
  creatorBadge: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  creatorBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  locationsList: {
    gap: 8,
  },
  locationItem: {
    backgroundColor: "#f9fafb",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  locationName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 4,
  },
  locationCoords: {
    fontSize: 12,
    color: "#6b7280",
  },
  inviteFab: {
    position: "absolute",
    right: 16,
    bottom: 32,
    backgroundColor: "#2563eb",
    borderRadius: 28,
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    zIndex: 1001,
  },

  // Role selection styles
  roleContainer: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  roleButtonActive: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  roleButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6b7280",
  },
  roleButtonTextActive: {
    color: "#2563eb",
  },
});
