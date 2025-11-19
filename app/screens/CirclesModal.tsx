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

// --- Interfaces (Kept same as before) ---
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

interface CirclesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  circles: CircleData[];
  loadingCircles: boolean;
  onSelectCircle?: (circleId: number) => void; // Callback when a circle is ticked
}

const CirclesModal: React.FC<CirclesModalProps> = ({
  isOpen,
  onClose,
  onRefresh,
  circles,
  loadingCircles,
  onSelectCircle,
}) => {
  // Animation: Start from negative height (Top) to 0
  const modalAnim = useRef(new Animated.Value(-windowHeight)).current;
  const [isModalOpen, setIsModalOpen] = useState(false);

  // View State: 'list' or 'invitations'
  const [currentView, setCurrentView] = useState<"list" | "invitations">("list");

  // Selection & Input State
  const [selectedCircleId, setSelectedCircleId] = useState<number | null>(null);
  const [newCircleName, setNewCircleName] = useState("");
  const [creatingCircle, setCreatingCircle] = useState(false);

  // Invitations State
  const [invitations, setInvitations] = useState<InvitationData[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);
  const [refreshingInvitations, setRefreshingInvitations] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Sync modal state with prop
  React.useEffect(() => {
    if (isOpen && !isModalOpen) {
      // Open modal (Slide Down)
      setIsModalOpen(true);
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start();
    } else if (!isOpen && isModalOpen) {
      // Close modal (Slide Up)
      Animated.timing(modalAnim, {
        toValue: -windowHeight,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setIsModalOpen(false);
        onRefresh();
      });
    }
  }, [isOpen, isModalOpen]);

  // Load current user ID when modal opens
  React.useEffect(() => {
    const loadCurrentUser = async () => {
      if (isModalOpen && !currentUserId) {
        try {
          const response = await authenticatedFetch(`${API_BASE_URL}/profile`, {
            headers: { "Content-Type": "application/json", accept: "application/json" },
          });
          if (response.ok) {
            const data = await response.json();
            const userData = data.data || data;
            if (userData?.id) setCurrentUserId(userData.id);
          }
        } catch (error) {
          console.error("Error loading current user:", error);
        }
      }
    };
    loadCurrentUser();
  }, [isModalOpen, currentUserId]);

  // Handle View Switching
  const toggleView = () => {
    if (currentView === "list") {
      setCurrentView("invitations");
      loadInvitations();
    } else {
      setCurrentView("list");
    }
  };

  // --- Circle Selection Logic ---
  const handleCircleSelect = (id: number) => {
    if (selectedCircleId === id) {
      setSelectedCircleId(null); // Deselect
    } else {
      setSelectedCircleId(id); // Select
      if (onSelectCircle) onSelectCircle(id);
    }
  };

  // --- Create Circle (Simplified: Only Name) ---
  const handleCreateCircle = async () => {
    if (!newCircleName.trim()) {
      Alert.alert("Required", "Please enter a name for the circle.");
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
          name: newCircleName,
          // Sending dummy location data since the backend likely expects the object structure
          // but the user wanted ONLY name input in the UI.
          location: {
            name: "Default Location",
            latitude: 0,
            longitude: 0,
          },
        }),
      });

      if (response.status === 401) {
        Alert.alert("Session Expired", "Please log in again.");
        router.replace("/screens/LogInScreen");
        return;
      }

      if (response.ok) {
        Alert.alert("Success", "Circle created successfully!");
        setNewCircleName(""); // Clear input
        await onRefresh(); // Reload list
      } else {
        const data = await response.json();
        Alert.alert("Error", data.message || "Failed to create circle.");
      }
    } catch (error) {
      console.error("Error creating circle:", error);
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setCreatingCircle(false);
    }
  };

  // --- Invitation Logic (Existing) ---
  const loadInvitations = async () => {
    try {
      setLoadingInvitations(true);
      const response = await authenticatedFetch(`${API_BASE_URL}/profile/pending-requests`, {
        headers: { "Content-Type": "application/json", accept: "application/json" },
      });

      const data = await response.json();
      if (response.ok) {
        let invitationsData: InvitationData[] = [];
        if (Array.isArray(data)) invitationsData = data;
        else if (data?.data && Array.isArray(data.data)) invitationsData = data.data;
        else if (data?.invitations) invitationsData = data.invitations;
        setInvitations(invitationsData);
      }
    } catch (error) {
      console.error("Error loading invitations:", error);
    } finally {
      setLoadingInvitations(false);
      setRefreshingInvitations(false);
    }
  };

  const handleAcceptInvitation = async (circleId: string) => {
    try {
      const response = await authenticatedFetch(
        `${API_BASE_URL}/circles/${circleId}/accept-invite`,
        { method: "POST", headers: { accept: "application/json" } }
      );
      if (response.ok) {
        Alert.alert("Success", "Joined circle!");
        loadInvitations();
        onRefresh();
      } else {
        Alert.alert("Error", "Failed to accept.");
      }
    } catch (e) {
      Alert.alert("Error", "Connection failed.");
    }
  };

  const handleRejectInvitation = async (circleId: string) => {
    try {
      const response = await authenticatedFetch(
        `${API_BASE_URL}/circles/${circleId}/reject-invite`,
        { method: "POST", headers: { accept: "application/json" } }
      );
      if (response.ok) loadInvitations();
    } catch (e) {
      console.error(e);
    }
  };

  if (!isModalOpen) return null;

  return (
    <>
      {/* Overlay Background */}
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPress={onClose} 
      />

      {/* Top Sheet Modal */}
      <Animated.View style={[styles.topSheetModal, { transform: [{ translateY: modalAnim }] }]}>
        <SafeAreaView style={styles.modalSafeArea} edges={["top"]}>
          
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {currentView === "list" ? "Select Circle" : "Invitations"}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>Close ✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.contentContainer}>
            {currentView === "list" ? (
              <>
                {/* --- CIRCLE LIST SECTION --- */}
                <View style={styles.listSection}>
                  {loadingCircles ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <FlatList
                      data={circles}
                      keyExtractor={(item) => item.id.toString()}
                      style={{ maxHeight: windowHeight * 0.4 }}
                      renderItem={({ item }) => {
                        const isSelected = selectedCircleId === item.id;
                        return (
                          <TouchableOpacity
                            style={[
                              styles.circleRow,
                              isSelected && styles.circleRowSelected
                            ]}
                            onPress={() => handleCircleSelect(item.id)}
                          >
                            {/* Tick Box on Front */}
                            <View style={[styles.tickBox, isSelected && styles.tickBoxActive]}>
                              {isSelected && <Text style={styles.tickText}>✓</Text>}
                            </View>
                            
                            <Text style={[styles.circleNameText, isSelected && styles.circleNameTextActive]}>
                              {item.name || "Unnamed Circle"}
                            </Text>
                          </TouchableOpacity>
                        );
                      }}
                      ListEmptyComponent={
                        <Text style={styles.emptyText}>No circles found. Create one below.</Text>
                      }
                    />
                  )}
                </View>

                {/* --- CREATE INPUT SECTION --- */}
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>Create New Circle</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Type circle name..."
                    placeholderTextColor="#9ca3af"
                    value={newCircleName}
                    onChangeText={setNewCircleName}
                  />
                </View>

                {/* --- ACTION BUTTONS --- */}
                <View style={styles.actionButtonsContainer}>
                  <TouchableOpacity
                    style={[styles.primaryButton, creatingCircle && styles.buttonDisabled]}
                    onPress={handleCreateCircle}
                    disabled={creatingCircle}
                  >
                    {creatingCircle ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Create Circle</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.secondaryButton}
                    onPress={toggleView}
                  >
                    <Text style={styles.secondaryButtonText}>
                       Join Invitations ({invitations.length > 0 ? invitations.length : "0"})
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              // --- INVITATIONS VIEW ---
              <View style={{ flex: 1 }}>
                {loadingInvitations ? (
                  <ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 20 }} />
                ) : (
                  <FlatList
                    data={invitations}
                    keyExtractor={(item) => item.id.toString()}
                    refreshControl={
                      <RefreshControl
                        refreshing={refreshingInvitations}
                        onRefresh={() => {
                          setRefreshingInvitations(true);
                          loadInvitations();
                        }}
                      />
                    }
                    ListEmptyComponent={
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No pending invitations.</Text>
                      </View>
                    }
                    renderItem={({ item }) => {
                      const cName = item.Circle?.name || item.circleName || "Unknown Circle";
                      const inviter = item.Circle?.creator?.name || item.inviterName || "Someone";
                      const cId = item.circleId || item.circle_id || item.Circle?.id || "";

                      return (
                        <View style={styles.inviteCard}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.inviteTitle}>{cName}</Text>
                            <Text style={styles.inviteSub}>Invited by {inviter}</Text>
                          </View>
                          <View style={styles.inviteActions}>
                            <TouchableOpacity
                              style={styles.acceptBtn}
                              onPress={() => handleAcceptInvitation(cId)}
                            >
                              <Text style={styles.btnTextWhite}>✓</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={styles.rejectBtn}
                              onPress={() => handleRejectInvitation(cId)}
                            >
                              <Text style={styles.btnTextWhite}>✕</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    }}
                  />
                )}
                <TouchableOpacity style={styles.backButton} onPress={toggleView}>
                  <Text style={styles.backButtonText}>Back to Circles</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Animated.View>
    </>
  );
};

export default CirclesModal;

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    zIndex: 900,
  },
  // Top Sheet Style (Slides from Top)
  topSheetModal: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    maxHeight: windowHeight * 0.85, // Don't cover full screen, leave bottom visible
    backgroundColor: "#fff",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    zIndex: 1000,
    paddingBottom: 20,
  },
  modalSafeArea: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    color: "#6b7280",
    fontWeight: "600",
  },
  contentContainer: {
    padding: 20,
  },

  // --- List Styles ---
  listSection: {
    marginBottom: 20,
  },
  circleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  circleRowSelected: {
    borderColor: "#2563eb",
    backgroundColor: "#eff6ff",
  },
  tickBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "#fff",
  },
  tickBoxActive: {
    borderColor: "#2563eb",
    backgroundColor: "#2563eb",
  },
  tickText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  circleNameText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#374151",
  },
  circleNameTextActive: {
    color: "#1e3a8a",
    fontWeight: "700",
  },
  emptyText: {
    textAlign: "center",
    color: "#9ca3af",
    fontStyle: "italic",
    marginTop: 10,
  },

  // --- Input Styles ---
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4b5563",
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#f3f4f6",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: "#1f2937",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  // --- Button Styles ---
  actionButtonsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#2563eb",
  },
  secondaryButtonText: {
    color: "#2563eb",
    fontWeight: "600",
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // --- Invitation Styles ---
  inviteCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    elevation: 1,
  },
  inviteTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  inviteSub: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  inviteActions: {
    flexDirection: "row",
    gap: 8,
  },
  acceptBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#10b981",
    alignItems: "center",
    justifyContent: "center",
  },
  rejectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  btnTextWhite: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  backButton: {
    marginTop: 10,
    padding: 15,
    alignItems: "center",
  },
  backButtonText: {
    color: "#6b7280",
    fontWeight: "600",
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
  },
});