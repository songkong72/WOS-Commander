import React, { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot } from 'expo-router';
import { NativeWindStyleSheet } from "nativewind";
import { AdminStatus } from '../data/admin-config';
import { View, Platform, ImageBackground, StyleSheet, Image, useWindowDimensions, ScrollView } from 'react-native';
import Head from 'expo-router/head';
import { AuthContext, ThemeContext, LanguageContext, Language } from './context';
import "../global.css";
import GlobalNavigationBar from '../components/GlobalNavigationBar';
import '../services/i18n';
import i18next from '../services/i18n';
import { db } from '../firebaseConfig';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';

NativeWindStyleSheet.setOutput({
    default: "native",
});

// Detect system language
const detectSystemLanguage = (): Language => {
    if (Platform.OS === 'web') {
        // @ts-ignore - navigator is available in web
        const browserLang = navigator.language || navigator.userLanguage || '';
        // Check if language starts with 'ko' (ko, ko-KR, ko-kr, etc.)
        return browserLang.toLowerCase().startsWith('ko') ? 'ko' : 'en';
    }
    // For mobile, default to English (can be enhanced with expo-localization)
    return 'en';
};

export default function Layout() {
    const [auth, setAuth] = useState<AdminStatus>({ isLoggedIn: false, adminName: null, role: null });
    const [theme, setTheme] = useState<'dark' | 'light'>('dark');
    const [serverId, setServerId] = useState<string | null>(null);
    const [allianceId, setAllianceId] = useState<string | null>(null);
    const [dashboardScrollY, setDashboardScrollY] = useState(0);
    const [language, setLanguage] = useState<Language>(detectSystemLanguage());
    const [fontSizeScale, setFontSizeScale] = useState(1.1);
    const [isLayoutReady, setIsLayoutReady] = useState(false);
    const [isGateOpen, setIsGateOpen] = useState(true);
    const mainScrollRef = useRef<ScrollView>(null);
    const isDark = theme === 'dark'; // Moved up for context

    useEffect(() => {
        const restoreSession = async () => {
            try {
                const savedAdminId = await AsyncStorage.getItem('lastAdminId');
                const savedRole = await AsyncStorage.getItem('lastAdminRole');
                const savedTheme = await AsyncStorage.getItem('theme');
                const savedLanguage = await AsyncStorage.getItem('language');
                const savedServer = await AsyncStorage.getItem('serverId');
                const savedAlliance = await AsyncStorage.getItem('allianceId');
                const savedFontSize = await AsyncStorage.getItem('fontSizeScale');

                if (savedAdminId) {
                    setAuth({ isLoggedIn: true, adminName: savedAdminId, role: savedRole as any });
                }

                // Prioritize saved theme
                if (savedTheme) {
                    setTheme(savedTheme as 'dark' | 'light');
                }

                if (savedLanguage) {
                    setLanguage(savedLanguage as Language);
                    i18next.changeLanguage(savedLanguage);
                } else {
                    const systemLang = detectSystemLanguage();
                    setLanguage(systemLang);
                    i18next.changeLanguage(systemLang);
                }
                if (savedServer) setServerId(savedServer);
                if (savedAlliance) setAllianceId(savedAlliance);
                if (savedServer && savedAlliance) setIsGateOpen(false);
                if (savedFontSize) setFontSizeScale(parseFloat(savedFontSize));

            } catch (e) {
                console.error('Session restoration failed:', e);
            } finally {
                setIsLayoutReady(true);
            }
        };
        restoreSession();
    }, []);

    // Reactive Theme Listener
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const setupThemeListener = async () => {
            const savedTheme = await AsyncStorage.getItem('theme');
            // If user has manually set a theme, don't override it with global default
            if (savedTheme) return;

            let configRef = doc(db, 'config', 'themeConfig');
            if (serverId && allianceId) {
                configRef = doc(db, "servers", serverId, "alliances", allianceId, "settings", "themeConfig");
            }

            unsubscribe = onSnapshot(configRef, (docSnap) => {
                if (docSnap.exists()) {
                    const defaultMode = docSnap.data().defaultMode;
                    if (defaultMode && (defaultMode === 'dark' || defaultMode === 'light')) {
                        setTheme(defaultMode);
                    }
                }
            }, (err) => {
                console.error('Theme listener error:', err);
            });
        };

        setupThemeListener();
        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, [serverId, allianceId]);

    const login = (name: string, role?: AdminStatus['role']) => {
        setAuth({ isLoggedIn: true, adminName: name, role: role || null });
        AsyncStorage.setItem('lastAdminId', name);
        if (role) AsyncStorage.setItem('lastAdminRole', role);
    };

    const logout = () => {
        setAuth({ isLoggedIn: false, adminName: null, role: null });
        AsyncStorage.removeItem('lastAdminId');
        AsyncStorage.removeItem('lastAdminRole');
    };

    const setAllianceInfo = (s: string | null, a: string | null) => {
        setServerId(s);
        setAllianceId(a);
        if (s) AsyncStorage.setItem('serverId', s); else AsyncStorage.removeItem('serverId');
        if (a) AsyncStorage.setItem('allianceId', a); else AsyncStorage.removeItem('allianceId');
    };

    const handleSetTheme = (newTheme: 'dark' | 'light') => {
        setTheme(newTheme);
        AsyncStorage.setItem('theme', newTheme);
    };

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        handleSetTheme(newTheme);
    };

    const changeLanguage = (lang: Language) => {
        setLanguage(lang);
        i18next.changeLanguage(lang);
        AsyncStorage.setItem('language', lang);
    };

    const changeFontSize = (scale: number) => {
        setFontSizeScale(scale);
        AsyncStorage.setItem('fontSizeScale', scale.toString());
    };

    const { width } = useWindowDimensions();
    const isPC = width >= 1024;

    if (!isLayoutReady) return null;

    return (
        <AuthContext.Provider value={{ auth, login, logout, serverId, allianceId, setAllianceInfo, dashboardScrollY, setDashboardScrollY, mainScrollRef, isGateOpen, setIsGateOpen }}>
            <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, toggleTheme, fontSizeScale, changeFontSize }}>
                <LanguageContext.Provider value={{ language, changeLanguage }}>
                    {Platform.OS === 'web' && (
                        <Head>
                            <meta name="mobile-web-app-capable" content="yes" />
                            <meta name="apple-mobile-web-app-status-bar-style" content={isDark ? "black-translucent" : "default"} />
                            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
                            <link rel="manifest" href="/manifest.json" />
                            <style>{`
                                html, body, #root, [data-expo-router-root] {
                                    width: 100% !important;
                                    height: 100% !important;
                                    margin: 0 !important;
                                    padding: 0 !important;
                                    overflow-x: hidden;
                                    background-color: ${isDark ? '#020617' : '#fafaf9'};
                                }
                                /* Hide native password reveal button in Edge/Internet Explorer */
                                input::-ms-reveal,
                                input::-ms-clear {
                                    display: none !important;
                                }
                            `}</style>
                        </Head>
                    )}

                    <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#fafaf9', paddingLeft: isPC ? 256 : 0 }]}>
                        <View style={{ flex: 1 }}>
                            <Slot />
                        </View>
                        {!isGateOpen && <GlobalNavigationBar />}
                    </View>
                </LanguageContext.Provider>
            </ThemeContext.Provider>
        </AuthContext.Provider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#020617',
        width: '100%',
        height: '100%',
        alignItems: 'stretch',
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
