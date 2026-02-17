import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme, useLanguage, useAuth } from './context';
import { LinearGradient } from 'expo-linear-gradient';

export default function Settings() {
    const router = useRouter();
    const { t } = useTranslation();
    const { theme, toggleTheme } = useTheme();
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
                        onPress={() => router.back()}
                        className={`mr-2 w-7 h-7 rounded-full items-center justify-center ${isDark ? 'bg-slate-800/60' : 'bg-white border border-slate-100 shadow-sm'}`}
                    >
                        <Ionicons name="arrow-back" size={14} color={isDark ? 'white' : '#0f172a'} />
                    </TouchableOpacity>
                    <Text className={`text-base font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        {t('navigation.settings')}
                    </Text>
                </View>
            </LinearGradient>

            <ScrollView className="flex-1 px-6 pt-6 pb-10" showsVerticalScrollIndicator={false}>
                {/* Language Settings */}
                <View className="mb-6">
                    <Text className={`text-xs font-black mb-5 uppercase tracking-[2px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('settings.language')}
                    </Text>

                    <View className="gap-3">
                        <TouchableOpacity
                            onPress={() => changeLanguage('ko')}
                            className={`rounded-[24px] p-5 flex-row items-center justify-between ${language === 'ko' ? (isDark ? 'bg-blue-500/15 border-2 border-blue-500/40' : 'bg-blue-50 border-2 border-blue-200') : (isDark ? 'bg-slate-900/60 border border-slate-800/60' : 'bg-white border border-slate-200')}`}
                            style={{ shadowColor: language === 'ko' ? '#3b82f6' : '#000', shadowOffset: { width: 0, height: language === 'ko' ? 6 : 2 }, shadowOpacity: language === 'ko' ? 0.2 : 0.05, shadowRadius: 15 }}
                        >
                            <View className="flex-row items-center">
                                <View className={`w-14 h-14 rounded-2xl items-center justify-center mr-5 ${language === 'ko' ? (isDark ? 'bg-blue-500/20' : 'bg-blue-100') : (isDark ? 'bg-slate-800/60' : 'bg-slate-100')}`}>
                                    <View className="absolute inset-0 items-center justify-center opacity-10">
                                        <Text className="text-[40px] font-black">KR</Text>
                                    </View>
                                    <Ionicons name="language" size={28} color={language === 'ko' ? '#3b82f6' : (isDark ? '#475569' : '#94a3b8')} />
                                </View>
                                <View>
                                    <Text className={`text-lg font-black ${language === 'ko' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>한국어</Text>
                                    <Text className={`text-[10px] font-bold uppercase tracking-widest ${language === 'ko' ? 'text-blue-500/60' : 'text-slate-500/40'}`}>Korean</Text>
                                </View>
                            </View>
                            {language === 'ko' && (
                                <View className="bg-blue-500 p-1 rounded-full border-4 border-white/10">
                                    <Ionicons name="checkmark" size={16} color="white" />
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => changeLanguage('en')}
                            className={`rounded-[24px] p-5 flex-row items-center justify-between ${language === 'en' ? (isDark ? 'bg-blue-500/15 border-2 border-blue-500/40' : 'bg-blue-50 border-2 border-blue-200') : (isDark ? 'bg-slate-900/60 border border-slate-800/60' : 'bg-white border border-slate-200')}`}
                            style={{ shadowColor: language === 'en' ? '#3b82f6' : '#000', shadowOffset: { width: 0, height: language === 'en' ? 6 : 2 }, shadowOpacity: language === 'en' ? 0.2 : 0.05, shadowRadius: 15 }}
                        >
                            <View className="flex-row items-center">
                                <View className={`w-14 h-14 rounded-2xl items-center justify-center mr-5 ${language === 'en' ? (isDark ? 'bg-blue-500/20' : 'bg-blue-100') : (isDark ? 'bg-slate-800/60' : 'bg-slate-100')}`}>
                                    <View className="absolute inset-0 items-center justify-center opacity-10">
                                        <Text className="text-[40px] font-black">US</Text>
                                    </View>
                                    <Ionicons name="globe-outline" size={28} color={language === 'en' ? '#3b82f6' : (isDark ? '#475569' : '#94a3b8')} />
                                </View>
                                <View>
                                    <Text className={`text-lg font-black ${language === 'en' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>English</Text>
                                    <Text className={`text-[10px] font-bold uppercase tracking-widest ${language === 'en' ? 'text-blue-500/60' : 'text-slate-500/40'}`}>International</Text>
                                </View>
                            </View>
                            {language === 'en' && (
                                <View className="bg-blue-500 p-1 rounded-full border-4 border-white/10">
                                    <Ionicons name="checkmark" size={16} color="white" />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Theme Settings */}
                <View className="mb-6">
                    <Text className={`text-xs font-black mb-5 uppercase tracking-[2px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        {t('settings.theme')}
                    </Text>

                    <View
                        className={`rounded-[20px] p-6 flex-row items-center justify-between ${isDark ? 'bg-slate-900/60 border border-slate-800/60' : 'bg-white border border-slate-200'}`}
                        style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 12 }}
                    >
                        <View className="flex-row items-center flex-1">
                            <View className={`w-14 h-14 rounded-[18px] items-center justify-center mr-4 ${isDark ? 'bg-indigo-500/15' : 'bg-amber-50'}`}>
                                <Ionicons name={isDark ? "moon" : "sunny"} size={26} color={isDark ? "#818cf8" : "#f59e0b"} />
                            </View>
                            <View className="flex-1">
                                <Text className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {isDark ? 'Dark Mode' : 'Light Mode'}
                                </Text>
                                <Text className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                                </Text>
                            </View>
                        </View>
                        <Switch
                            value={isDark}
                            onValueChange={toggleTheme}
                            trackColor={{ false: '#cbd5e1', true: '#818cf8' }}
                            thumbColor={'white'}
                            style={{ transform: [{ scale: 1.1 }] }}
                        />
                    </View>
                </View>

                {/* Administration */}
                {auth.isLoggedIn && (
                    <View className="mb-8">
                        <Text className={`text-xs font-black mb-5 uppercase tracking-[2px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {t('settings.administration')}
                        </Text>

                        <View className="gap-4">
                            <TouchableOpacity
                                onPress={() => router.push('/?showAdminMenu=true')}
                                className={`rounded-[20px] p-6 flex-row items-center justify-between active:scale-[0.98] transition-transform ${isDark ? 'bg-slate-900/60 border border-slate-800/60' : 'bg-white border border-slate-200'}`}
                                style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 12 }}
                            >
                                <View className="flex-row items-center flex-1">
                                    <View className={`w-14 h-14 rounded-[18px] items-center justify-center mr-4 ${isDark ? 'bg-sky-500/15' : 'bg-sky-50'}`}>
                                        <Ionicons name="shield-checkmark" size={26} color={isDark ? "#38bdf8" : "#0284c7"} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`text-lg font-bold mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                            {t('settings.openAdminMenu')}
                                        </Text>
                                        <Text className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                            {t('settings.openAdminMenuDesc')}
                                        </Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={22} color={isDark ? "#64748b" : "#94a3b8"} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => { logout(); router.replace('/'); }}
                                className={`rounded-[20px] p-6 flex-row items-center active:scale-[0.98] transition-transform ${isDark ? 'bg-red-500/10 border border-red-500/30' : 'bg-red-50 border border-red-200'}`}
                                style={{ shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12 }}
                            >
                                <View className={`w-14 h-14 rounded-[18px] items-center justify-center mr-4 ${isDark ? 'bg-red-500/15' : 'bg-red-100'}`}>
                                    <Ionicons name="log-out" size={26} color="#ef4444" />
                                </View>
                                <Text className="text-lg font-bold text-red-500">
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
