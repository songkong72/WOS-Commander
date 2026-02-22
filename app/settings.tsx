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
                style={{
                    ...Platform.select({
                        web: { boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)' },
                        default: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }
                    })
                }}
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
                <View className={`mb-10 p-6 rounded-[32px] border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
                    <View className="flex-row items-center mb-6">
                        <View className={`w-8 h-8 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
                            <Ionicons name="language" size={18} color="#3b82f6" />
                        </View>
                        <Text className={`font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-900'}`} style={{ fontSize: 12 * fontSizeScale }}>
                            {t('settings.language')}
                        </Text>
                    </View>

                    <View className="gap-3">
                        {[
                            { id: 'ko', label: '한국어', sub: 'KOREAN', icon: '🇰🇷' },
                            { id: 'en', label: 'English', sub: 'INTERNATIONAL', icon: '🌐' }
                        ].map((lang) => (
                            <TouchableOpacity
                                key={lang.id}
                                onPress={() => changeLanguage(lang.id as any)}
                                className={`rounded-[24px] p-5 flex-row items-center justify-between border-2 transition-all ${language === lang.id ?
                                    (isDark ? 'bg-blue-500/10 border-blue-500/50 shadow-lg shadow-blue-500/10' : 'bg-blue-50 border-blue-500/20 shadow-sm') :
                                    (isDark ? 'bg-slate-950/40 border-slate-800/50' : 'bg-slate-50 border-slate-100')}`}
                            >
                                <View className="flex-row items-center">
                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${language === lang.id ? (isDark ? 'bg-blue-500/20' : 'bg-blue-100') : (isDark ? 'bg-slate-900' : 'bg-white shadow-sm')}`}>
                                        <Text className="text-xl">{lang.icon}</Text>
                                    </View>
                                    <View>
                                        <Text className={`font-black ${language === lang.id ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-400' : 'text-slate-500')}`} style={{ fontSize: 16 * fontSizeScale }}>{lang.label}</Text>
                                        <Text className={`font-bold tracking-[0.2em] ${language === lang.id ? 'text-blue-500' : (isDark ? 'text-slate-600' : 'text-slate-400')}`} style={{ fontSize: 9 * fontSizeScale }}>{lang.sub}</Text>
                                    </View>
                                </View>
                                <View className={`w-6 h-6 rounded-full items-center justify-center border-2 ${language === lang.id ? 'bg-blue-500 border-blue-400' : (isDark ? 'border-slate-800' : 'border-slate-200')}`}>
                                    {language === lang.id && <Ionicons name="checkmark" size={14} color="white" />}
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Theme & Experience Settings */}
                <View className={`mb-10 p-6 rounded-[32px] border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
                    <View className="flex-row items-center mb-6">
                        <View className={`w-8 h-8 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-indigo-500/20' : 'bg-amber-50'}`}>
                            <Ionicons name="sparkles" size={18} color={isDark ? "#818cf8" : "#f59e0b"} />
                        </View>
                        <Text className={`font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-900'}`} style={{ fontSize: 12 * fontSizeScale }}>
                            {t('settings.theme')}
                        </Text>
                    </View>

                    {/* Theme Toggle Button */}
                    <TouchableOpacity
                        onPress={toggleTheme}
                        activeOpacity={0.8}
                        className={`rounded-[24px] p-5 flex-row items-center justify-between border-2 ${isDark ? 'bg-slate-950/40 border-indigo-500/30' : 'bg-amber-50/50 border-amber-200'}`}
                    >
                        <View className="flex-row items-center">
                            <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${isDark ? 'bg-indigo-500/20' : 'bg-amber-100'}`}>
                                <Ionicons name={isDark ? "moon" : "sunny"} size={22} color={isDark ? "#818cf8" : "#f59e0b"} />
                            </View>
                            <View>
                                <Text className={`font-black ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 16 * fontSizeScale }}>
                                    {isDark ? t('admin.darkMode') : t('admin.lightMode')}
                                </Text>
                                <Text className={`font-bold tracking-widest ${isDark ? 'text-indigo-400' : 'text-amber-600'}`} style={{ fontSize: 9 * fontSizeScale }}>
                                    {isDark ? 'NIGHT OPS' : 'DAYLIGHT OPS'}
                                </Text>
                            </View>
                        </View>
                        <View className={`w-14 h-8 rounded-full border-2 p-1 ${isDark ? 'bg-slate-900 border-indigo-500/50' : 'bg-white border-amber-500/30'}`}>
                            <View className={`w-5 h-5 rounded-full ${isDark ? 'bg-indigo-500 self-end' : 'bg-amber-500 self-start'} shadow-sm`} />
                        </View>
                    </TouchableOpacity>

                    {/* Font Size Preview Selector */}
                    <View className="mt-8">
                        <Text className={`font-black mb-4 ml-1 uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`} style={{ fontSize: 10 * fontSizeScale }}>
                            {t('settings.fontSize', '글자 크기')}
                        </Text>
                        <View className="flex-row gap-2 bg-slate-950/20 p-1.5 rounded-[22px]">
                            {(['small', 'medium', 'large'] as const).map((size) => {
                                const scale = size === 'small' ? 0.95 : size === 'large' ? 1.25 : 1.1;
                                const isActive = Math.abs(fontSizeScale - scale) < 0.01;

                                return (
                                    <TouchableOpacity
                                        key={size}
                                        onPress={() => changeFontSize(scale)}
                                        className={`flex-1 py-4 rounded-[18px] items-center justify-center transition-all ${isActive ?
                                            (isDark ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20' : 'bg-white shadow-sm') :
                                            'bg-transparent'
                                            }`}
                                    >
                                        <Text className={`font-black ${isActive ? (isDark ? 'text-white' : 'text-indigo-600') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}
                                            style={{ fontSize: (size === 'small' ? 10 : size === 'medium' ? 14 : 18) }}>
                                            Aa
                                        </Text>
                                        <Text className={`font-bold mt-1 ${isActive ? (isDark ? 'text-indigo-200' : 'text-indigo-900') : (isDark ? 'text-slate-600' : 'text-slate-500')}`} style={{ fontSize: 9 }}>
                                            {size === 'small' ? t('admin.fontSmall', '작게') : size === 'medium' ? t('admin.fontMedium', '보통') : size === 'large' ? t('admin.fontLarge', '크게') : ''}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                </View>

                {/* Account & Administration */}
                {auth.isLoggedIn && (
                    <View className={`mb-10 p-6 rounded-[32px] border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200'} shadow-sm`}>
                        <View className="flex-row items-center mb-6">
                            <View className={`w-8 h-8 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-rose-500/20' : 'bg-rose-50'}`}>
                                <Ionicons name="key" size={18} color="#f43f5e" />
                            </View>
                            <Text className={`font-black uppercase tracking-widest ${isDark ? 'text-slate-300' : 'text-slate-900'}`} style={{ fontSize: 12 * fontSizeScale }}>
                                {t('settings.administration')}
                            </Text>
                        </View>

                        <View className="gap-3">
                            <TouchableOpacity
                                onPress={() => router.push('/?showAdminMenu=true')}
                                className={`rounded-[24px] p-5 flex-row items-center justify-between border-2 ${isDark ? 'bg-slate-950/40 border-slate-800/50' : 'bg-slate-50 border-slate-100'}`}
                            >
                                <View className="flex-row items-center">
                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${isDark ? 'bg-sky-500/20' : 'bg-sky-50'}`}>
                                        <Ionicons name="shield-checkmark" size={22} color={isDark ? "#38bdf8" : "#0284c7"} />
                                    </View>
                                    <View>
                                        <Text className={`font-black ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 16 * fontSizeScale }}>
                                            {t('settings.openAdminMenu')}
                                        </Text>
                                        <Text className={`font-bold tracking-widest ${isDark ? 'text-sky-500' : 'text-sky-600'}`} style={{ fontSize: 9 * fontSizeScale }}>COMMANDER OPS</Text>
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={isDark ? "#475569" : "#94a3b8"} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => { logout(); router.replace('/'); }}
                                className={`rounded-[24px] p-5 flex-row items-center border-2 border-transparent ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}
                            >
                                <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${isDark ? 'bg-rose-500/20' : 'bg-rose-100'}`}>
                                    <Ionicons name="log-out" size={22} color="#f43f5e" />
                                </View>
                                <View>
                                    <Text className="font-black text-rose-500" style={{ fontSize: 16 * fontSizeScale }}>
                                        {t('settings.logout')}
                                    </Text>
                                    <Text className="font-bold tracking-widest text-rose-500/60" style={{ fontSize: 9 * fontSizeScale }}>EXIT SYSTEM</Text>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}
