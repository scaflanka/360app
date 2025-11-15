import React from 'react';
import LogInScreen from './screens/LogInScreen';

// Render the login screen directly on the index route to avoid navigating
// before the root layout mounts (avoids expo-router 'navigate before mounting' error).
export default function Index() {
  return <LogInScreen />;
}
