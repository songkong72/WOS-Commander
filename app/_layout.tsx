import React, { createContext, useContext, useState } from 'react';
import { Slot } from 'expo-router';
import { NativeWindStyleSheet } from "nativewind";
import { AdminStatus } from '../data/admin-config';
import { View, Text, Platform, ImageBackground, StyleSheet } from 'react-native';
import Head from 'expo-router/head';

NativeWindStyleSheet.setOutput({
    default: "native",
});

import "../global.css";

// Auth Context
const AuthContext = createContext<{
    auth: AdminStatus;
    login: (name: string) => void;
    logout: () => void;
} | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}

export default function Layout() {
    const [auth, setAuth] = useState<AdminStatus>({ isLoggedIn: false, adminName: null });

    const login = (name: string) => setAuth({ isLoggedIn: true, adminName: name });
    const logout = () => setAuth({ isLoggedIn: false, adminName: null });

    return (
        <AuthContext.Provider value={{ auth, login, logout }}>
            {Platform.OS === 'web' && (
                <Head>
                    <meta name="mobile-web-app-capable" content="yes" />
                    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
                    <link rel="manifest" href="/manifest.json" />
                </Head>
            )}

            <View style={styles.container}>
                {/* Global Background Image */}
                <ImageBackground
                    source={require('../assets/images/bg-main.png')}
                    style={styles.background}
                    imageStyle={styles.backgroundImage}
                >
                    <View style={styles.overlay}>
                        <Slot />
                    </View>
                </ImageBackground>
            </View>
        </AuthContext.Provider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
    },
    background: {
        flex: 1,
        width: Platform.OS === 'web' ? '100vw' : '100%',
        height: '100%',
    },
    backgroundImage: {
        resizeMode: 'cover',
        ...Platform.select({
            web: {
                objectFit: 'cover',
                width: '100vw',
                height: '100vh',
                position: 'fixed'
            } as any
        })
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    }
});
