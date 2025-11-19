// import {
//     GoogleSignin,
//     GoogleSigninButton,
//     isSuccessResponse,
//     statusCodes,
// } from '@react-native-google-signin/google-signin';
import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { registerDeviceAndGetFCMToken, saveFCMTokenToAPI } from '@/utils/permissions';



// Using expo-router for navigation; no typed stack here
// GoogleSignin.configure({
//     "webClientId": '367419583503-2ot110t4mfr19aiftiqkp5phojup2nls.apps.googleusercontent.com'
// });

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#7C3AED',
    },
    contentContainer: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingTop: 60,
        paddingBottom: 32,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
    },
    backButtonText: {
        color: '#fff',
        fontSize: 40,
        fontWeight: '300',
    },
    header: {
        marginBottom: 60,
        alignItems: 'center',
    },
    headerText: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        textAlign: 'center',
        lineHeight: 40,
    },
    formContainer: {
        flex: 1,
        justifyContent: 'space-between',
    },
    inputContainer: {
        marginBottom: 24,
    },
    inputGroup: {
        marginBottom: 20,
    },
    input: {
        borderWidth: 0,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 25,
        paddingHorizontal: 24,
        paddingVertical: 16,
        fontSize: 30,
        color: '#fff',
        backgroundColor: 'transparent',
        textAlign: 'center',           // centers typed text & placeholder horizontally
        textAlignVertical: 'center',   // centers vertically (Android only)
    },
    utPlaceholder: {
        color: 'rgba(255, 255, 255, 0.5)',
    },
    bottomContainer: {
        marginTop: 'auto',
    },
    continueButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 25,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 20,
    },
    continueButtonText: {
        color: '#8B5CF6',
        fontWeight: 'bold',
        fontSize: 18,
    },
    continueButtonActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
    },
    continueButtonTextActive: {
        color: '#8B5CF6',
    },
    phoneSignInText: {
        color: '#D4FF00',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
    },
    forgotPasswordButton: {
        alignItems: 'center',
        marginTop: 16,
    },
    forgotPasswordText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontWeight: '600',
        fontSize: 14,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    dividerText: {
        marginHorizontal: 12,
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 14,
    },
    signUpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 16,
    },
    signUpText: {
        color: 'rgba(255, 255, 255, 0.8)',
        fontSize: 14,
    },
    signUpLink: {
        color: '#D4FF00',
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 4,
    },
})

const LogInScreen = () => {

    
    const router = useRouter();
    const [email, setEmail] = useState('')
    const [userName, setUserName] = useState('')
    const [loading, setLoading] = useState(false)
    // userInfo can be either an object (user data) or null when not signed in
    const [userInfo, setUserInfo] = useState<Record<string, any> | null>(null);

    const handleLogin = async () => {
        if (email && userName) {
            setLoading(true);
            console.log('Logging in with:', { email, userName });

            try {
                const response = await fetch('https://api.medi.lk/api/auth/dev-login', {
                    method: 'POST',
                    headers: {
                        'accept': 'application/json',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: userName,
                        email: email,
                    }),
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    console.log('✅ Login success:', data);
                    console.log('Token:', data.token);
                    console.log('Refresh Token:', data.refreshToken);

                    // 👉 Example: save token in local storage (React)
                    await AsyncStorage.setItem('authToken', data.token);
                    await AsyncStorage.setItem('refreshToken', data.refreshToken);

                    // Register device for FCM and save token to API
                    try {
                        const fcmToken = await registerDeviceAndGetFCMToken();
                        if (fcmToken) {
                            await saveFCMTokenToAPI(fcmToken);
                        }
                    } catch (error) {
                        console.error('Error registering FCM token after login:', error);
                        // Don't block login if FCM token registration fails
                    }

                    // 👉 Navigate or update state
                    alert('Login successful!');
                    // After login, open the Map screen using expo-router
                    router.replace('/screens/MapScreen');
                } else {
                    console.error('❌ Login failed:', data);
                    alert('Login failed. Please check your details.');
                    setLoading(false);
                }
            } catch (error) {
                console.error('⚠️ Error during login:', error);
                alert('An error occurred during login. Try again.');
                setLoading(false);
            }
        } else {
            alert('Please enter both email and username.');
        }
    };

    // const handleGoogleSignIn = async () => {
    //     try {
    //         setLoading(true);

    //         await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    //         const userInfo = await GoogleSignin.signIn();
    //         console.log("Google User Info:", userInfo);

    //         // Correct ID token path
    //         const idToken = userInfo.idToken;
    //         console.log("Google ID Token:", idToken);

    //         if (!idToken) {
    //             alert("Failed to get Google ID Token. Check your Google config.");
    //             setLoading(false);
    //             return;
    //         }

    //         // API request
    //         const response = await fetch("https://api.medi.lk/api/auth/google", {
    //             method: "POST",
    //             headers: {
    //                 "accept": "application/json",
    //                 "Content-Type": "application/json",
    //             },
    //             body: JSON.stringify({ idToken }),
    //         });

    //         const data = await response.json();
    //         console.log("API Response:", data);

    //         if (response.ok) {
    //             await AsyncStorage.setItem("authToken", data.token);
    //             await AsyncStorage.setItem("refreshToken", data.refreshToken);

    //             try {
    //                 const fcmToken = await registerDeviceAndGetFCMToken();
    //                 if (fcmToken) await saveFCMTokenToAPI(fcmToken);
    //             } catch (err) {
    //                 console.log("FCM error:", err);
    //             }

    //             alert("Google Login Successful!");
    //             router.replace("/screens/MapScreen");
    //         } else {
    //             alert("Google Login Failed: " + (data.message || "Invalid token"));
    //         }

    //     } catch (error) {
    //         console.log("Full Google Sign-In Error:", error);
    //         alert("Google Login Error: " + error.message);
    //     } finally {
    //         setLoading(false);
    //     }
    // };

    // (Optional) Google Sign-In handlers removed to reduce commented-out code

    const isFormValid = email.length > 0 && userName.length > 0;

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
        >
            {/* Back Button */}
            <TouchableOpacity style={styles.backButton}>
                <Text style={styles.backButtonText}>‹</Text>
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerText}>Welcome back!{'\n'}Enter your email</Text>
            </View>

            {/* Form Container */}
            <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                    {/* Email Input */}
                    <View style={styles.inputGroup}>
                        <TextInput
                            style={styles.input}
                            placeholder='Email'
                            placeholderTextColor='rgba(255, 255, 255, 0.5)'
                            value={email}
                            onChangeText={setEmail}
                            keyboardType='email-address'
                            autoCapitalize='none'
                        />
                    </View>

                    {/* Username Input */}
                    <View style={styles.inputGroup}>
                        <TextInput
                            style={styles.input}
                            placeholder='User Name'
                            placeholderTextColor='rgba(255, 255, 255, 0.5)'
                            value={userName}
                            onChangeText={setUserName}
                            autoCapitalize='none'
                        />
                    </View>
                </View>

                {/* Bottom Section */}
                <View style={styles.bottomContainer}>
                    {/* Continue Button */}
                    <TouchableOpacity
                        style={[
                            styles.continueButton,
                            isFormValid && styles.continueButtonActive
                        ]}
                        onPress={handleLogin}
                        disabled={loading || !isFormValid}
                    >
                        {loading ? (
                            <ActivityIndicator color={isFormValid ? "#8B5CF6" : "#fff"} />
                        ) : (
                            <Text style={[
                                styles.continueButtonText,
                                isFormValid && styles.continueButtonTextActive
                            ]}>
                                Continue
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* 
                        <GoogleSigninButton
                            style={{ width: '100%', height: 48, marginBottom: 16 }}
                            size={GoogleSigninButton.Size.Wide}
                            color={GoogleSigninButton.Color.Dark}
                            onPress={handleGoogleSignIn}
                        /> 
                        */}

                    {/* Phone Sign In */}
                    <TouchableOpacity onPress={() => router.push('/screens/MobileLogIn')}>
                        <Text style={styles.phoneSignInText}>Sign in with phone number</Text>
                    </TouchableOpacity>

                    {/* Forgot Password */}
                    {/* <TouchableOpacity style={styles.forgotPasswordButton}>
                            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                        </TouchableOpacity> */}

                    {/* Divider */}
                    {/* <View style={styles.dividerContainer}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>OR</Text>
                            <View style={styles.dividerLine} />
                        </View> */}

                    {/* Sign Up Link
                        <View style={styles.signUpContainer}>
                            <Text style={styles.signUpText}>Don't have an account?</Text>
                            <TouchableOpacity>
                                <Text style={styles.signUpLink}>Sign Up</Text>
                            </TouchableOpacity>
                        </View> */}
                </View>
            </View>
        </ScrollView>
    )
}

export default LogInScreen;