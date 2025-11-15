import AsyncStorage from "@react-native-async-storage/async-storage";

export const API_BASE_URL = "https://api.medi.lk/api";

// Token refresh lock to prevent concurrent refresh attempts
let refreshPromise: Promise<string | null> | null = null;
let isRefreshing = false;

/**
 * Refreshes the access token using the stored refresh token
 * Uses a lock mechanism to prevent concurrent refresh attempts
 * @returns The new access token or null if refresh fails
 */
export const refreshAccessToken = async (): Promise<string | null> => {
  // If a refresh is already in progress, wait for it to complete
  if (isRefreshing && refreshPromise) {
    console.log("Token refresh already in progress, waiting...");
    return refreshPromise;
  }

  // Start a new refresh
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await AsyncStorage.getItem("refreshToken");

      if (!refreshToken) {
        console.warn("No refresh token found");
        return null;
      }

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          refreshToken: refreshToken,
        }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        // Store the new access token
        await AsyncStorage.setItem("authToken", data.token);

        // Store the new refresh token if provided
        if (data.refreshToken) {
          await AsyncStorage.setItem("refreshToken", data.refreshToken);
        }

        console.log("Token refreshed successfully");
        return data.token;
      } else {
        console.error("Token refresh failed:", data);

        // If refresh fails, clear tokens
        await AsyncStorage.removeItem("authToken");
        await AsyncStorage.removeItem("refreshToken");

        return null;
      }
    } catch (error) {
      console.error("Error refreshing token:", error);

      // Clear tokens on error
      await AsyncStorage.removeItem("authToken");
      await AsyncStorage.removeItem("refreshToken");

      return null;
    } finally {
      // Reset the lock
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Gets the current access token, refreshing it if needed
 * @returns The access token or null if unavailable
 */
export const getAccessToken = async (): Promise<string | null> => {
  const token = await AsyncStorage.getItem("authToken");
  return token;
};

/**
 * Checks if user is authenticated (has both access and refresh tokens)
 * @returns true if both tokens exist, false otherwise
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const accessToken = await AsyncStorage.getItem("authToken");
  const refreshToken = await AsyncStorage.getItem("refreshToken");
  return !!(accessToken && refreshToken);
};

/**
 * Makes an authenticated API request with automatic token refresh on 401 errors
 * @param url - The API endpoint URL
 * @param options - Fetch options (method, headers, body, etc.)
 * @param retryAttempt - Internal parameter to track retry attempts
 * @returns The fetch response
 */
export const authenticatedFetch = async (
  url: string,
  options: RequestInit = {},
  retryAttempt: number = 0
): Promise<Response> => {
  const MAX_RETRIES = 1;

  // Get the current access token
  let token = await getAccessToken();

  // Add authorization header if token exists
  const headers = {
    ...options.headers,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Make the request
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // If we get a 401 (Unauthorized), try to refresh the token and retry
  if (response.status === 401 && retryAttempt < MAX_RETRIES) {
    console.log("Token expired, attempting refresh...");

    const newToken = await refreshAccessToken();

    if (newToken) {
      // Retry the request with the new token
      const retryHeaders = {
        ...options.headers,
        Authorization: `Bearer ${newToken}`,
      };

      return fetch(url, {
        ...options,
        headers: retryHeaders,
      });
    } else {
      // Refresh failed, return the original response
      return response;
    }
  }

  return response;
};

/**
 * Logs out the user by calling the logout API endpoint and clearing all stored tokens
 */
export const logout = async (): Promise<void> => {
  try {
    const refreshToken = await AsyncStorage.getItem("refreshToken");
    
    // Call the logout API endpoint if we have a refresh token
    if (refreshToken) {
      try {
        await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify({
            refreshToken: refreshToken,
          }),
        });
      } catch (apiError) {
        // Continue with token clearing even if API call fails
        console.error("Error calling logout API:", apiError);
      }
    }
    
    // Clear tokens regardless of API call success/failure
    await AsyncStorage.removeItem("authToken");
    await AsyncStorage.removeItem("refreshToken");
  } catch (error) {
    console.error("Error during logout:", error);
    // Still try to clear tokens even if there's an error
    try {
      await AsyncStorage.removeItem("authToken");
      await AsyncStorage.removeItem("refreshToken");
    } catch (clearError) {
      console.error("Error clearing tokens:", clearError);
    }
  }
};
