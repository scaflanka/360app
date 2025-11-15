import { Platform, PermissionsAndroid, Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import Constants from 'expo-constants';
import { authenticatedFetch } from './auth';

const API_BASE_URL = "https://api.medi.lk/api";

/**
 * Gets device information for FCM token registration
 * @returns Object containing deviceId, deviceType, and deviceDetails
 */
const getDeviceInfo = () => {
  const deviceId = Constants.deviceId || Constants.installationId || 'unknown';
  const deviceType = Platform.OS;
  const deviceDetails = {
    os: Platform.OS,
    version: Platform.Version,
    brand: 'Android',
    model: Constants.deviceName || 'Unknown',
    appVersion: Constants.expoConfig?.version || '1.0.0',
  };

  return { deviceId, deviceType, deviceDetails };
};

/**
 * Registers device for remote messages and gets FCM token
 * @returns Promise<string | null> - FCM token or null if failed
 */
export const registerDeviceAndGetFCMToken = async (): Promise<string | null> => {
  try {
    // Get FCM token (Android doesn't need registerDeviceForRemoteMessages)
    const token = await messaging().getToken();
    
    if (token) {
      console.log('FCM token obtained:', token);
      return token;
    } else {
      console.warn('FCM token is null');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Saves FCM token to the API endpoint
 * @param token - FCM token string
 * @returns Promise<boolean> - true if saved successfully, false otherwise
 */
export const saveFCMTokenToAPI = async (token: string): Promise<boolean> => {
  try {
    const { deviceId, deviceType, deviceDetails } = getDeviceInfo();

    const response = await authenticatedFetch(`${API_BASE_URL}/profile/firebase-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        token,
        deviceId,
        deviceType,
        deviceDetails,
      }),
    });

    if (response.ok) {
      console.log('FCM token saved successfully to API');
      return true;
    } else {
      const errorData = await response.json().catch(() => ({}));
      console.error('Failed to save FCM token:', response.status, errorData);
      return false;
    }
  } catch (error) {
    console.error('Error saving FCM token to API:', error);
    return false;
  }
};

/**
 * Requests notification permissions for the app and registers for FCM
 * @returns Promise<boolean> - true if permission is granted, false otherwise
 */
export const requestNotificationPermissions = async (): Promise<boolean> => {
  try {
    // Android 13+ (API level 33+) requires POST_NOTIFICATIONS permission
    if (Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
      );
      
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('Notification permission granted');
        
        // Get FCM token after permission is granted
        const token = await registerDeviceAndGetFCMToken();
        
        if (token) {
          // Save token to API (only if user is authenticated)
          const isAuth = await import('./auth').then((m) => m.isAuthenticated());
          if (isAuth) {
            await saveFCMTokenToAPI(token);
          } else {
            console.log('User not authenticated, skipping FCM token save to API');
          }
        }
        
        return true;
      } else {
        console.log('Notification permission denied');
        return false;
      }
    } else {
      // Android versions below 13 don't require explicit permission
      console.log('Android version < 13, notification permission not required');
      
      // Get FCM token (no permission needed)
      const token = await registerDeviceAndGetFCMToken();
      
      if (token) {
        // Save token to API (only if user is authenticated)
        const isAuth = await import('./auth').then((m) => m.isAuthenticated());
        if (isAuth) {
          await saveFCMTokenToAPI(token);
        } else {
          console.log('User not authenticated, skipping FCM token save to API');
        }
      }
      
      return true;
    }
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
};

