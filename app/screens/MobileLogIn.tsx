import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { registerDeviceAndGetFCMToken, saveFCMTokenToAPI } from '@/utils/permissions';

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#7C3AED' },
    contentContainer: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 32 },
    backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 40 },
    backButtonText: { color: '#fff', fontSize: 40, fontWeight: '300' },
    header: { marginBottom: 60, alignItems: 'center' },
    headerText: { fontSize: 32, fontWeight: 'bold', color: '#fff', textAlign: 'center', lineHeight: 40 },
    formContainer: { flex: 1, justifyContent: 'space-between' },
    inputContainer: { marginBottom: 24 },
    inputGroup: { marginBottom: 20 },
    input: {
        borderWidth: 0,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 25,
        paddingHorizontal: 24,
        paddingVertical: 16,
        fontSize: 30,
        color: '#fff',
        backgroundColor: 'transparent',
        textAlign: 'center',
        textAlignVertical: 'center',
    },
    bottomContainer: { marginTop: 'auto' },
    continueButton: { backgroundColor: 'rgba(255, 255, 255, 0.3)', borderRadius: 25, paddingVertical: 16, alignItems: 'center', marginBottom: 20 },
    continueButtonText: { color: '#8B5CF6', fontWeight: 'bold', fontSize: 18 },
    continueButtonActive: { backgroundColor: 'rgba(255, 255, 255, 0.9)' },
    continueButtonTextActive: { color: '#8B5CF6' },
    emailSignInText: {
        color: '#D4FF00',
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
    },
});

const MobileLogInScreen = () => {
    const router = useRouter();
    const [mobileNumber, setMobileNumber] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!mobileNumber) return alert('Please enter your mobile number');
        setLoading(true);

        try {
            const response = await fetch('https://api.medi.lk/api/auth/mobile-login', {
                method: 'POST',
                headers: { 'accept': 'application/json', 'Content-Type': 'application/json' },
                body: JSON.stringify({ mobile: mobileNumber }),
            });
            const data = await response.json();

            if (response.ok && data.success) {
                await AsyncStorage.setItem('authToken', data.token);
                await AsyncStorage.setItem('refreshToken', data.refreshToken);

                try {
                    const fcmToken = await registerDeviceAndGetFCMToken();
                    if (fcmToken) await saveFCMTokenToAPI(fcmToken);
                } catch (err) {
                    console.log('FCM error:', err);
                }

                alert('Login successful!');
                router.replace('/screens/MapScreen');
            } else {
                alert('Login failed. Check your number.');
            }
        } catch (err) {
            console.log('Login error:', err);
            alert('An error occurred. Try again.');
        } finally {
            setLoading(false);
        }
    };

    const isFormValid = mobileNumber.length > 0;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} keyboardShouldPersistTaps="handled">
            {/* Back Button */}
            <TouchableOpacity style={styles.backButton}>
                <Text style={styles.backButtonText}>‹</Text>
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerText}>Welcome back!{'\n'}Enter your mobile number</Text>
            </View>

            {/* Form */}
            <View style={styles.formContainer}>
                <View style={styles.inputContainer}>
                    <View style={styles.inputGroup}>
                        <TextInput
                            style={styles.input}
                            placeholder="Mobile Number"
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            value={mobileNumber}
                            onChangeText={setMobileNumber}
                            keyboardType="phone-pad"
                        />
                    </View>
                </View>

                {/* Bottom Section */}
                <View style={styles.bottomContainer}>
                    <TouchableOpacity
                        style={[styles.continueButton, isFormValid && styles.continueButtonActive]}
                        onPress={handleLogin}
                        disabled={!isFormValid || loading}
                    >
                        {loading ? (
                            <ActivityIndicator color={isFormValid ? '#8B5CF6' : '#fff'} />
                        ) : (
                            <Text style={[styles.continueButtonText, isFormValid && styles.continueButtonTextActive]}>
                                Continue
                            </Text>
                        )}
                    </TouchableOpacity>



                    {/* Phone Sign In */}
                    <TouchableOpacity onPress={() => router.push('/screens/LogInScreen')}>
                        <Text style={styles.emailSignInText}>Sign in with Email</Text>
                    </TouchableOpacity>

                </View>
            </View>
        </ScrollView>
    );
};

export default MobileLogInScreen;
