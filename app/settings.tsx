import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, useLanguage, useAuth } from './context';
import { LinearGradient } from 'expo-linear-gradient';

export default function Settings() {
    const router = useRouter(); // Use correct router hook
    const { t } = useTranslation();
    const { theme, toggleTheme, fontSizeScale, changeFontSize } = useTheme();
    const { language, changeLanguage } = useLanguage();
    const { auth, logout } = useAuth();
    const isDark = theme === 'dark';

    return (
        <View className={`flex-1 ${isDark ? 'bg-[#0a0e1a]' : 'bg-slate-50'}`}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header with Gradient - Compact */}
            <LinearGradient
                colors={isDark ? ['#1e293b', '#0f172a'] : ['#ffffff', '#f8fafc']}
                className="px-6 pt-4 pb-2"
                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }}
            >
                <View className="flex-row items-center">
                    <TouchableOpacity
                        onPress={() => {
                            if (router.canGoBack()) {
                                router.back();
                            } else {
                                router.replace('/');
                            }
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        className={`mr-3 w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800/60' : 'bg-white border border-slate-100 shadow-sm'}`}
                    >
                        <Ionicons name="arrow-back" size={20} color={isDark ? 'white' : '#0f172a'} />
                    </TouchableOpacity>
                    <Text className={`font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 16 * fontSizeScale }}>
                        {t('navigation.settings')}
                    </Text>
                </View>
            </LinearGradient>

            <ScrollView
                className="flex-1 px-6 pt-6"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 160 }}
            >
                {/* Language Settings */}
                <View className="mb-8">
                    <Text className={`font-black mb-4 uppercase tracking-[2px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`} style={{ fontSize: 10 * fontSizeScale }}>
                        {t('settings.language')}
                    </Text>

                    <View className="gap-3">
                        <TouchableOpacity
                            onPress={() => changeLanguage('ko')}
                            className={`rounded-[20px] p-4 flex-row items-center justify-between ${language === 'ko' ? (isDark ? 'bg-blue-500/15 border border-blue-500/40' : 'bg-blue-50 border border-blue-200') : (isDark ? 'bg-slate-900/60 border border-slate-800/60' : 'bg-white border border-slate-200')}`}
                        >
                            <View className="flex-row items-center">
                                <View className={`w-10 h-10 rounded-xl items-center justify-center mr-4 ${language === 'ko' ? (isDark ? 'bg-blue-500/20' : 'bg-blue-100') : (isDark ? 'bg-slate-800/60' : 'bg-slate-100')}`}>
                                    <Ionicons name="language" size={20} color={language === 'ko' ? '#3b82f6' : (isDark ? '#94a3b8' : '#64748b')} />
                                </View>
                                <View>
                                    <Text className={`font-black ${language === 'ko' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-400' : 'text-slate-500')}`} style={{ fontSize: 16 * fontSizeScale }}>한국어</Text>
                                    <Text className={`font-bold uppercase tracking-widest ${language === 'ko' ? 'text-blue-500/60' : 'text-slate-500/40'}`} style={{ fontSize: 9 * fontSizeScale }}>Korean</Text>
                                </View>
                            </View>
                            <Ionicons name={language === 'ko' ? "checkmark-circle" : "ellipse-outline"} size={22} color={language === 'ko' ? "#3b82f6" : (isDark ? "#334155" : "#cbd5e1")} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => changeLanguage('en')}
                            className={`rounded-[20px] p-4 flex-row items-center justify-between ${language === 'en' ? (isDark ? 'bg-blue-500/15 border border-blue-500/40' : 'bg-blue-50 border border-blue-200') : (isDark ? 'bg-slate-900/60 border border-slate-800/60' : 'bg-white border border-slate-200')}`}
                        >
                            <View className="flex-row items-center">
                                <View className={`w-10 h-10 rounded-xl items-center justify-center mr-4 ${language === 'en' ? (isDark ? 'bg-blue-500/20' : 'bg-blue-100') : (isDark ? 'bg-slate-800/60' : 'bg-slate-100')}`}>
                                    <Ionicons name="globe-outline" size={20} color={language === 'en' ? '#3b82f6' : (isDark ? '#94a3b8' : '#64748b')} />
                                </View>
                                <View>
                                    <Text className={`font-black ${language === 'en' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-400' : 'text-slate-500')}`} style={{ fontSize: 16 * fontSizeScale }}>English</Text>
                                    <Text className={`font-bold uppercase tracking-widest ${language === 'en' ? 'text-blue-500/60' : 'text-slate-500/40'}`} style={{ fontSize: 9 * fontSizeScale }}>International</Text>
                                </View>
                            </View>
                            <Ionicons name={language === 'en' ? "checkmark-circle" : "ellipse-outline"} size={22} color={language === 'en' ? "#3b82f6" : (isDark ? "#334155" : "#cbd5e1")} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Theme Settings */}
                <View className="mb-8">
                    <Text className={`font-black mb-4 uppercase tracking-[2px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`} style={{ fontSize: 10 * fontSizeScale }}>
                        {t('settings.theme')}
                    </Text>

                    <View
                        className={`rounded-[20px] p-4 flex-row items-center justify-between ${isDark ? 'bg-slate-900/60 border border-slate-800/60' : 'bg-white border border-slate-200'}`}
                    >
                        <View className="flex-row items-center flex-1">
                            <View className={`w-10 h-10 rounded-xl items-center justify-center mr-4 ${isDark ? 'bg-indigo-500/15' : 'bg-amber-50'}`}>
                                <Ionicons name={isDark ? "moon" : "sunny"} size={20} color={isDark ? "#818cf8" : "#f59e0b"} />
                            </View>
                            <View className="flex-1">
                                <Text className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 16 * fontSizeScale }}>
                                    {isDark ? 'Dark Mode' : 'Light Mode'}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                            trackColor={{ false: '#cbd5e1', true: '#818cf8' }}
                            thumbColor={'white'}
                            style={{ transform: [{ scale: 0.9 }] }}
                        />
                    </View>
                </View>

                {/* Font Size Settings */}
                <View className="mb-8">
                    <Text className={`font-black mb-4 uppercase tracking-[2px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`} style={{ fontSize: 10 * fontSizeScale }}>
                        {t('settings.fontSize', '글자 크기')}
                    </Text>

                    <View className="flex-row gap-2">
                        {(['small', 'medium', 'large'] as const).map((size) => {
                            const scale = size === 'small' ? 0.95 : size === 'large' ? 1.25 : 1.1;
                            const isActive = Math.abs(fontSizeScale - scale) < 0.01; // fuzzy check

                            return (
                                <TouchableOpacity
                                    key={size}
                                    onPress={() => changeFontSize(scale)}
                                    className={`flex-1 py-4 rounded-2xl border items-center justify-center transition-all ${isActive ?
                                        (isDark ? 'bg-indigo-600 border-indigo-500 shadow-md shadow-indigo-500/20' : 'bg-indigo-500 border-indigo-500 shadow-md shadow-indigo-500/20') :
                                        (isDark ? 'bg-slate-900/60 border-slate-800/60' : 'bg-white border-slate-200')
                                        }`}
                                >
                                    <View className="items-center">
                                        <Ionicons name="text" size={size === 'small' ? 16 : size === 'medium' ? 20 : 24} color={isActive ? "white" : (isDark ? "#94a3b8" : "#64748b")} style={{ marginBottom: 4 }} />
                                        <Text className={`font-black ${isActive ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-600')}`} style={{ fontSize: 12 * fontSizeScale }}>
                                            {size === 'small' ? t('admin.fontSmall', '작게') : size === 'medium' ? t('admin.fontMedium', '보통') : t('admin.fontLarge', '크게')}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Administration */}
                {auth.isLoggedIn && (
                    <View className="mb-10">
                        <Text className={`font-black mb-4 uppercase tracking-[2px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`} style={{ fontSize: 10 * fontSizeScale }}>
                            {t('settings.administration')}
                        </Text>

                        <View className="gap-3">
                            <TouchableOpacity
                                onPress={() => router.push('/?showAdminMenu=true')}
                                className={`rounded-[20px] p-4 flex-row items-center justify-between ${isDark ? 'bg-slate-900/60 border border-slate-800/60' : 'bg-white border border-slate-200'}`}
                            >
                                <View className="flex-row items-center flex-1">
                                    <View className={`w-10 h-10 rounded-xl items-center justify-center mr-4 ${isDark ? 'bg-sky-500/15' : 'bg-sky-50'}`}>
                                        <Ionicons name="shield-checkmark" size={20} color={isDark ? "#38bdf8" : "#0284c7"} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 16 * fontSizeScale }}>
                                            {t('settings.openAdminMenu')}
                                        </Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={isDark ? "#64748b" : "#94a3b8"} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => { logout(); router.replace('/'); }}
                                className={`rounded-[20px] p-4 flex-row items-center ${isDark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-100'}`}
                            >
                                <View className={`w-10 h-10 rounded-xl items-center justify-center mr-4 ${isDark ? 'bg-red-500/15' : 'bg-red-100'}`}>
                                    <Ionicons name="log-out" size={20} color="#ef4444" />
                                </View>
                                <Text className="font-bold text-red-500" style={{ fontSize: 16 * fontSizeScale }}>
                                    {t('settings.logout')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
