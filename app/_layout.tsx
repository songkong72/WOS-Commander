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

// Theme Context
type Theme = 'dark' | 'light';
const ThemeContext = createContext<{
    theme: Theme;
    toggleTheme: () => void;
} | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used within a ThemeProvider');
    return context;
}

export default function Layout() {
    const [auth, setAuth] = useState<AdminStatus>({ isLoggedIn: false, adminName: null });
    const [theme, setTheme] = useState<Theme>('dark');

    const login = (name: string) => setAuth({ isLoggedIn: true, adminName: name });
    const logout = () => setAuth({ isLoggedIn: false, adminName: null });
    const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

    const isDark = theme === 'dark';

    return (
        <AuthContext.Provider value={{ auth, login, logout }}>
            <ThemeContext.Provider value={{ theme, toggleTheme }}>
                {Platform.OS === 'web' && (
                    <Head>
                        <meta name="mobile-web-app-capable" content="yes" />
                        <meta name="apple-mobile-web-app-status-bar-style" content={isDark ? "black-translucent" : "default"} />
                        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
                        <link rel="manifest" href="/manifest.json" />
                    </Head>
                )}

                <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#f8fafc' }]}>
                    {/* Global Background Image */}
                    <ImageBackground
                        source={require('../assets/images/bg-main.png')}
                        style={styles.background}
                        imageStyle={[styles.backgroundImage, { opacity: isDark ? 1 : 0.8 }]}
                    >
                        <View style={[styles.overlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.7)' }]}>
                            <Slot />
                        </View>
                    </ImageBackground>
                </View>
            </ThemeContext.Provider>
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
        width: '100%',
        height: '100%',
    },
    backgroundImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
    }
});
