// import {
//   GoogleSignin,
//   GoogleSigninButton,
//   isSuccessResponse,
//   statusCodes,
// } from '@react-native-google-signin/google-signin';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';



// Using expo-router for navigation; no typed stack here
// GoogleSignin.configure({
//   "webClientId": '367419583503-3lgmgp9ph4pm32n5jjnnqfesi2ku8f87.apps.googleusercontent.com'


// });



const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    contentContainer: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 32,
    },
    header: {
        marginBottom: 32,
        alignItems: 'center',
    },
    headerText: {
        fontSize: 36,
        fontWeight: 'bold',
        color: '#2563eb',
    },
    formContainer: {
        width: '100%',
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: '#1f2937',
    },
    loginButton: {
        backgroundColor: '#2563eb',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginBottom: 16,
        marginTop: 8,
    },
    loginButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    forgotPasswordButton: {
        alignItems: 'center',
        marginBottom: 24,
        marginTop: 8,
    },
    forgotPasswordText: {
        color: '#2563eb',
        fontWeight: '600',
        fontSize: 14,
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#d1d5db',
    },
    dividerText: {
        marginHorizontal: 12,
        color: '#6b7280',
        fontSize: 14,
    },
    googleButton: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        paddingVertical: 12,
        alignItems: 'center',
        marginBottom: 24,
    },
    googleButtonText: {
        color: '#1f2937',
        fontWeight: '600',
        fontSize: 14,
    },
    signUpContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    signUpText: {
        color: '#6b7280',
        fontSize: 14,
    },
    signUpLink: {
        color: '#2563eb',
        fontWeight: 'bold',
        fontSize: 14,
        marginLeft: 4,
    },
})

const LogInScreen = () => {
    const router = useRouter();
    const [email, setEmail] = useState('')
    const [userName, setUserName] = useState('')
    // userInfo can be either an object (user data) or null when not signed in
    // const [userInfo, setUserInfo] = useState<Record<string, any> | null>(null);

    const handleLogin = async () => {
        if (email && userName) {
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

                    // 👉 Navigate or update state
                    alert('Login successful!');
                    // After login, open the Map screen using expo-router
                    router.replace('/screens/MapScreen');
                } else {
                    console.error('❌ Login failed:', data);
                    alert('Login failed. Please check your details.');
                }
            } catch (error) {
                console.error('⚠️ Error during login:', error);
                alert('An error occurred during login. Try again.');
            }
        } else {
            alert('Please enter both email and username.');
        }
    };


    // (Optional) Google Sign-In handlers removed to reduce commented-out code


    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerText}>Location</Text>
                <Text style={styles.headerText}>Tracker</Text>
            </View>

            {/* Form Container */}
            <View style={styles.formContainer}>
                {/* Email Input */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                        style={styles.input}
                        placeholder='Enter your email'
                        placeholderTextColor='#999'
                        value={email}
                        onChangeText={setEmail}
                        keyboardType='email-address'
                        autoCapitalize='none'
                    />
                </View>

                {/* Password Input */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>User Name</Text>
                    <TextInput
                        style={styles.input}
                        placeholder='Enter your user name'
                        placeholderTextColor='#999'
                        value={userName}
                        onChangeText={setUserName}
                        autoCapitalize='none'

                    />
                </View>

                {/* Login Button */}
                <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                    <Text style={styles.loginButtonText}>Login</Text>
                </TouchableOpacity>

                {/* 
        <GoogleSigninButton
          style={{ width: '100%', height: 48, marginBottom: 16 }}
          size={GoogleSigninButton.Size.Wide}
          color={GoogleSigninButton.Color.Dark}
          onPress={handleGoogleSignIn}
        /> */}




                {/* Forgot Password */}
                <TouchableOpacity style={styles.forgotPasswordButton}>
                    <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerContainer}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                </View>



                {/* Sign Up Link */}
                <View style={styles.signUpContainer}>
                    <Text style={styles.signUpText}>Dont have an account?</Text>
                    <TouchableOpacity>
                        <Text style={styles.signUpLink}>Sign Up</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView>
    )
}

export default LogInScreen;
