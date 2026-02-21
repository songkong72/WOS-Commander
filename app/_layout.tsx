import React, { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot } from 'expo-router';
import { NativeWindStyleSheet } from "nativewind";
import { AdminStatus } from '../data/admin-config';
import { View, Platform, ImageBackground, StyleSheet, Image, useWindowDimensions, ScrollView, Modal, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();

    // Custom Alert State
    const [customAlert, setCustomAlert] = useState<{
        visible: boolean,
        title: string,
        message: string,
        type: 'success' | 'error' | 'warning' | 'confirm',
        onConfirm?: () => void
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'error'
    });

    const showCustomAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'confirm' = 'error', onConfirm?: () => void) => {
        setCustomAlert({ visible: true, title, message, type, onConfirm });
    };
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
            // We always listen to global theme, but decide whether to apply it based on timestamps
            let configRef = doc(db, 'config', 'themeConfig');
            if (serverId && allianceId) {
                configRef = doc(db, "servers", serverId, "alliances", allianceId, "settings", "themeConfig");
            }

            unsubscribe = onSnapshot(configRef, async (docSnap) => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const defaultMode = data.defaultMode;
                    const dbUpdatedAt = data.updatedAt || 0;

                    if (defaultMode && (defaultMode === 'dark' || defaultMode === 'light')) {
                        const localUpdateTs = await AsyncStorage.getItem('themeUpdateTimestamp');
                        const localTs = localUpdateTs ? parseInt(localUpdateTs) : 0;

                        // If DB update is newer than local manual change, or no local preference exists
                        if (dbUpdatedAt > localTs) {
                            setTheme(defaultMode);
                            // Do NOT set 'theme' in AsyncStorage here, as we want to know it was a global sync
                            // But we update the sync timestamp
                            await AsyncStorage.setItem('themeUpdateTimestamp', dbUpdatedAt.toString());
                        }
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
        // Mark user's manual change as "Now" so it won't be overridden by older global settings
        AsyncStorage.setItem('themeUpdateTimestamp', Date.now().toString());
    };

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        handleSetTheme(newTheme);
    };

    const setTemporaryTheme = (newTheme: 'dark' | 'light') => {
        setTheme(newTheme);
    };

    const toggleTemporaryTheme = () => {
        setTemporaryTheme(theme === 'dark' ? 'light' : 'dark');
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
        <AuthContext.Provider value={{
            auth, login, logout, serverId, allianceId, setAllianceInfo,
            dashboardScrollY, setDashboardScrollY, mainScrollRef, isGateOpen, setIsGateOpen,
            showCustomAlert
        }}>
            <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, toggleTheme, setTemporaryTheme, toggleTemporaryTheme, fontSizeScale, changeFontSize }}>
                <LanguageContext.Provider value={{ language, changeLanguage }}>
                    {Platform.OS === 'web' && (
                        <Head>
                            <meta name="mobile-web-app-capable" content="yes" />
                            <meta name="apple-mobile-web-app-status-bar-style" content={isDark ? "black-translucent" : "default"} />
                            <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
                            <link rel="manifest" href="/manifest.json" />
                            <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
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
                            {Platform.OS === 'web' && (
                                <script>{`
                                    if ('serviceWorker' in navigator) {
                                        window.addEventListener('load', function() {
                                            navigator.serviceWorker.register('/sw.js').then(function(registration) {
                                                console.log('ServiceWorker registration successful');
                                            }, function(err) {
                                                console.log('ServiceWorker registration failed: ', err);
                                            });
                                        });
                                    }
                                `}</script>
                            )}
                        </Head>
                    )}

                    <View style={[styles.container, { backgroundColor: isDark ? '#020617' : '#fafaf9', paddingLeft: isPC ? 256 : 0 }]}>
                        <View style={{ flex: 1 }}>
                            <Slot />
                        </View>
                        {!isGateOpen && <GlobalNavigationBar />}
                    </View>
                    {/* Custom Alert Modal (Global) */}
                    <Modal visible={customAlert.visible} transparent animationType="fade" onRequestClose={() => setCustomAlert({ ...customAlert, visible: false })}>
                        <View className="flex-1 bg-black/60 items-center justify-center p-6">
                            <BlurView intensity={20} className="absolute inset-0" />
                            <View className={`w-full max-w-sm rounded-[40px] border p-8 shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                <View className="items-center mb-6">
                                    <View className={`w-16 h-16 rounded-3xl items-center justify-center mb-4 ${customAlert.type === 'success' ? 'bg-emerald-500/20' :
                                        customAlert.type === 'error' ? 'bg-red-500/20' :
                                            customAlert.type === 'warning' ? 'bg-amber-500/20' : 'bg-sky-500/20'
                                        }`}>
                                        <Ionicons
                                            name={
                                                customAlert.type === 'success' ? 'checkmark-circle' :
                                                    customAlert.type === 'error' ? 'alert-circle' :
                                                        customAlert.type === 'warning' ? 'warning' : 'help-circle'
                                            }
                                            size={32}
                                            color={
                                                customAlert.type === 'success' ? '#10b981' :
                                                    customAlert.type === 'error' ? '#ef4444' :
                                                        customAlert.type === 'warning' ? '#f59e0b' : '#0ea5e9'
                                            }
                                        />
                                    </View>
                                    <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{customAlert.title}</Text>
                                    <Text className={`mt-4 text-center text-lg font-medium leading-7 ${isDark ? 'text-slate-100' : 'text-slate-600'}`}>{customAlert.message}</Text>
                                </View>

                                {customAlert.type === 'confirm' ? (
                                    <View className="flex-row gap-3">
                                        <TouchableOpacity
                                            onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                                            className={`flex-1 py-4 rounded-3xl border ${isDark ? 'border-slate-800' : 'border-slate-100'}`}
                                        >
                                            <Text className={`text-center font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('common.cancel')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => {
                                                setCustomAlert({ ...customAlert, visible: false });
                                                if (customAlert.onConfirm) customAlert.onConfirm();
                                            }}
                                            className="flex-[2] bg-sky-500 py-4 rounded-3xl shadow-lg"
                                        >
                                            <Text className="text-center font-bold text-white">{t('common.confirm')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                                        className="bg-sky-500 py-4 rounded-3xl shadow-lg"
                                    >
                                        <Text className="text-center font-bold text-white">{t('common.confirm')}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </Modal>

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
