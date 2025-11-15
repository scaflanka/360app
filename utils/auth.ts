import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = "https://api.medi.lk/api";

/**
 * Refreshes the access token using the stored refresh token
 * @returns The new access token or null if refresh fails
 */
export const refreshAccessToken = async (): Promise<string | null> => {
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
  }
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
