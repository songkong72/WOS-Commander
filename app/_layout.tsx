import React, { createContext, useContext, useState } from 'react';
import { Slot } from 'expo-router';
import { NativeWindStyleSheet } from "nativewind";
import { AdminStatus } from '../data/admin-config';

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

import { View, Text, Platform } from 'react-native';
import Head from 'expo-router/head';

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
                    <link rel="manifest" href="/manifest.json" />
                </Head>
            )}
            <View style={{ flex: 1 }}>
                <Slot />
            </View>
        </AuthContext.Provider>
    );
}
