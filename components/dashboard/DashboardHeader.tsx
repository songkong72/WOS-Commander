import React, { useState } from 'react';
import { View, Text, Pressable, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface DashboardHeaderProps {
    isDark: boolean;
    now: Date;
    auth: any;
    serverId: string | null;
    allianceId: string | null;
    toggleTheme: () => void;
    handleInstallClick: () => void;
    handleSettingsPress: (setAdminMenuVisible: any, setLoginModalVisible: any) => void;
    setAdminMenuVisible: (v: boolean) => void;
    setLoginModalVisible: (v: boolean) => void;
    setIsManualVisible: (v: boolean) => void;
    openModalWithHistory: (setter: any) => void;
    setInputServer: (v: string) => void;
    setInputAlliance: (v: string) => void;
    setIsGateOpen: (v: boolean) => void;
    getNextResetSeconds: () => number;
    formatRemainingTime: (s: number) => string;
    pendingCount?: number;
}

export const DashboardHeader = ({
    isDark,
    now,
    auth,
    serverId,
    allianceId,
    toggleTheme,
    handleInstallClick,
    handleSettingsPress,
    setAdminMenuVisible,
    setLoginModalVisible,
    setIsManualVisible,
    openModalWithHistory,
    setInputServer,
    setInputAlliance,
    setIsGateOpen,
    getNextResetSeconds,
    formatRemainingTime,
    pendingCount = 0
}: DashboardHeaderProps) => {
    const { t } = useTranslation();
    const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

    return (
        <View className="pt-4 pb-2">
            <View className="flex-row justify-between items-center mb-6">
                <View className="flex-1 mr-3">
                    <View className="flex-row items-center mb-1 gap-3">
                        <View className="flex-row items-center opacity-70">
                            <Ionicons name="time-outline" size={9} color={isDark ? "#38bdf8" : "#2563eb"} style={{ marginRight: 3 }} />
                            <Text className={`font-mono text-[9px] font-black tracking-tight ${isDark ? 'text-sky-400' : 'text-blue-600'}`}>
                                {now.getHours()}:{String(now.getMinutes()).padStart(2, '0')}:{String(now.getSeconds()).padStart(2, '0')}
                            </Text>
                        </View>
                    </View>
                    {/* Reset Timer Progress Bar */}
                    <View className="mt-1.5 flex-row items-center gap-2">
                        <View className={`h-1 flex-1 max-w-[120px] rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                            <View
                                className={`h-full ${isDark ? 'bg-sky-500' : 'bg-blue-500'}`}
                                style={{ width: `${((86400 - getNextResetSeconds()) / 86400) * 100}%` }}
                            />
                        </View>
                        <View className="flex-row items-center">
                            <Ionicons name="refresh" size={9} color={isDark ? "#38bdf8" : "#2563eb"} style={{ marginRight: 2 }} />
                            <Text className={`font-mono text-[9px] font-black ${isDark ? 'text-sky-400' : 'text-blue-600'}`}>
                                {formatRemainingTime(getNextResetSeconds())}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Header Buttons (Top Right) */}
                <View className="flex-row gap-2.5 md:gap-3">
                    {/* Theme Toggle */}
                    <View className="relative items-center z-50">
                        <Pressable
                            onPress={toggleTheme}
                            // @ts-ignore
                            onMouseEnter={() => setHoveredBtn('theme')}
                            // @ts-ignore
                            onMouseLeave={() => setHoveredBtn(null)}
                            className={`p-2.5 rounded-full border ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}
                            style={({ pressed, hovered }: any) => [
                                {
                                    transform: [{ scale: pressed ? 0.92 : (hovered || hoveredBtn === 'theme' ? 1.15 : 1) }],
                                    transition: 'all 0.2s cubic-bezier(0.1, 0, 0.2, 1)'
                                }
                            ]}
                        >
                            <Ionicons name={isDark ? "sunny" : "moon"} size={18} color="#f59e0b" />
                        </Pressable>
                        {Platform.OS === 'web' && hoveredBtn === 'theme' && (
                            <View className={`absolute top-full mt-2 w-max px-2.5 py-1.5 rounded-lg shadow-xl z-[999] ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`} style={{ width: 70, left: '50%', transform: [{ translateX: -35 }] }}>
                                <Text className={`text-[10px] font-bold text-center whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('header.theme', { defaultValue: '테마전환' })}</Text>
                            </View>
                        )}
                    </View>

                    {/* Guide */}
                    <View className="relative items-center z-50">
                        <Pressable
                            onPress={() => openModalWithHistory(setIsManualVisible)}
                            // @ts-ignore
                            onMouseEnter={() => setHoveredBtn('guide')}
                            // @ts-ignore
                            onMouseLeave={() => setHoveredBtn(null)}
                            className={`p-2.5 rounded-full border ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}
                            style={({ pressed, hovered }: any) => [
                                {
                                    transform: [{ scale: pressed ? 0.92 : (hovered || hoveredBtn === 'guide' ? 1.15 : 1) }],
                                    transition: 'all 0.2s cubic-bezier(0.1, 0, 0.2, 1)'
                                }
                            ]}
                        >
                            <Ionicons name="book-outline" size={18} color="#f59e0b" />
                        </Pressable>
                        {Platform.OS === 'web' && hoveredBtn === 'guide' && (
                            <View className={`absolute top-full mt-2 w-max px-2.5 py-1.5 rounded-lg shadow-xl z-[999] ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`} style={{ width: 70, left: '50%', transform: [{ translateX: -35 }] }}>
                                <Text className={`text-[10px] font-bold text-center whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('header.guide', { defaultValue: '사용가이드' })}</Text>
                            </View>
                        )}
                    </View>

                    {/* Install */}
                    <View className="relative items-center z-50">
                        <Pressable
                            onPress={handleInstallClick}
                            // @ts-ignore
                            onMouseEnter={() => setHoveredBtn('install')}
                            // @ts-ignore
                            onMouseLeave={() => setHoveredBtn(null)}
                            className={`p-2.5 rounded-full border ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}
                            style={({ pressed, hovered }: any) => [
                                {
                                    transform: [{ scale: pressed ? 0.92 : (hovered || hoveredBtn === 'install' ? 1.15 : 1) }],
                                    transition: 'all 0.2s cubic-bezier(0.1, 0, 0.2, 1)'
                                }
                            ]}
                        >
                            <Ionicons name="download" size={18} color={isDark ? "#38bdf8" : "#0284c7"} />
                        </Pressable>
                        {Platform.OS === 'web' && hoveredBtn === 'install' && (
                            <View className={`absolute top-full mt-2 w-max px-2.5 py-1.5 rounded-lg shadow-xl z-[999] ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`} style={{ width: 70, left: '50%', transform: [{ translateX: -35 }] }}>
                                <Text className={`text-[10px] font-bold text-center whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('header.install', { defaultValue: '앱 설치' })}</Text>
                            </View>
                        )}
                    </View>

                    {/* Profile/Auth */}
                    <View className="relative items-center z-50">
                        <Pressable
                            onPress={() => handleSettingsPress(setAdminMenuVisible, setLoginModalVisible)}
                            // @ts-ignore
                            onMouseEnter={() => setHoveredBtn('profile')}
                            // @ts-ignore
                            onMouseLeave={() => setHoveredBtn(null)}
                            className={`p-2 rounded-full border-2 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}
                            style={({ pressed, hovered }: any) => [
                                {
                                    transform: [{ scale: pressed ? 0.92 : (hovered || hoveredBtn === 'profile' ? 1.1 : 1) }],
                                    transition: 'all 0.2s cubic-bezier(0.1, 0, 0.2, 1)',
                                    borderColor: auth.isLoggedIn ? ((auth.role === 'super_admin' || auth.role === 'master') ? '#fb7185' : auth.role === 'alliance_admin' ? '#818cf8' : '#22d3ee') : 'transparent'
                                }
                            ]}
                        >
                            <Ionicons name="person-circle" size={20} color={auth.isLoggedIn ? ((auth.role === 'super_admin' || auth.role === 'master') ? '#fb7185' : auth.role === 'alliance_admin' ? '#818cf8' : '#22d3ee') : (isDark ? '#fff' : '#94a3b8')} />
                            {auth.isLoggedIn && (auth.role === 'master' || auth.role === 'super_admin') && pendingCount > 0 && (
                                <View className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-slate-900 items-center justify-center">
                                    <View className="w-1.5 h-1.5 bg-white rounded-full" />
                                </View>
                            )}
                        </Pressable>
                        {Platform.OS === 'web' && hoveredBtn === 'profile' && (
                            <View className={`absolute top-full mt-2 w-max px-2.5 py-1.5 rounded-lg shadow-xl z-[999] ${isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'}`} style={{ width: 70, left: '50%', transform: [{ translateX: -35 }] }}>
                                <Text className={`text-[10px] font-bold text-center whitespace-nowrap ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('header.profile', { defaultValue: '계정/설정' })}</Text>
                            </View>
                        )}
                    </View>
                </View>
            </View>

            <View className="mb-4 flex-row items-center">
                <View className={`w-16 h-16 rounded-2xl items-center justify-center mr-4 ${isDark ? 'bg-white/10' : 'bg-slate-100 shadow-sm'}`}>
                    <Image
                        source={require('../../assets/icon.png')}
                        style={{ width: 52, height: 52 }}
                        resizeMode="contain"
                    />
                </View>
                <View className="flex-1">
                    <Text className={`font-bold text-[8px] md:text-xs tracking-[0.4em] mb-1 uppercase ${isDark ? 'text-sky-400' : 'text-slate-500'}`}>{t('dashboard.whiteoutSurvival')}</Text>
                    <Text className={`text-2xl md:text-4xl font-black tracking-tighter leading-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>{t('dashboard.title')}</Text>
                    <View className="mt-2.5 flex-row items-center">
                        <View className="h-0.5 w-8 bg-brand-accent rounded-full mr-2.5" />
                        <Text className={`text-[11px] font-bold leading-relaxed tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('dashboard.subtitle')}</Text>
                    </View>
                </View>
            </View>

            {!!serverId && !!allianceId && (
                <View className="flex-row flex-wrap items-center gap-4 mt-3 mb-6">
                    <Pressable
                        onPress={() => {
                            setInputServer(serverId);
                            setInputAlliance(allianceId);
                            setIsGateOpen(true);
                        }}
                        className={`flex-row items-center px-4 py-3 rounded-2xl border-2 transition-all ${isDark ? 'bg-sky-500/10 border-sky-400/50' : 'bg-sky-50 border-sky-200 shadow-sm'}`}
                    >
                        <View className={`mr-2.5 w-7 h-7 rounded-full items-center justify-center ${isDark ? 'bg-sky-500/20' : 'bg-sky-100'}`}>
                            <Ionicons name="location" size={14} color={isDark ? "#38bdf8" : "#0284c7"} />
                        </View>
                        <Text className={`font-black text-xs tracking-tight ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>
                            {serverId?.toString().startsWith('#') ? serverId : '#' + serverId} · {allianceId}
                        </Text>
                        <Ionicons name="chevron-forward" size={12} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginLeft: 8 }} />
                    </Pressable>
                </View>
            )}
        </View>
    );
};
