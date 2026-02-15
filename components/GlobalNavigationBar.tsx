import React from 'react';
import { View, Text, TouchableOpacity, Platform, useWindowDimensions, Pressable } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useAuth, useTheme } from '../app/context';
import { useTranslation } from 'react-i18next';

interface NavItemProps {
    id: string;
    labelKey: string;
    icon: any;
    activeIcon: any;
    path: string;
}

const NAV_ITEMS: NavItemProps[] = [
    { id: 'home', labelKey: 'navigation.dashboard', icon: 'home-outline', activeIcon: 'home', path: '/' },
    { id: 'events', labelKey: 'navigation.events', icon: 'calendar-outline', activeIcon: 'calendar', path: '/growth/events' },
    { id: 'strategy', labelKey: 'navigation.wiki', icon: 'map-outline', activeIcon: 'map', path: '/strategy-sheet' },
    { id: 'heroes', labelKey: 'navigation.heroes', icon: 'people-outline', activeIcon: 'people', path: '/hero-management' },
    { id: 'settings', labelKey: 'navigation.settings', icon: 'settings-outline', activeIcon: 'settings', path: '/settings' },
];

export default function GlobalNavigationBar() {
    const { width } = useWindowDimensions();
    const isWide = width >= 1024;
    const router = useRouter();
    const pathname = usePathname();
    const { theme } = useTheme();
    const { auth, serverId, allianceId, mainScrollRef } = useAuth();
    const { t } = useTranslation();
    const isDark = theme === 'dark';

    const handleNavPress = (item: NavItemProps) => {
        // Only allow Home or Settings for non-logged-in users
        if (!auth.isLoggedIn && item.id !== 'home' && item.id !== 'settings') {
            // Check if showCustomAlert exists in context or use windows alert for simple feedback
            // Since this component is outside main context's local state, we'll suggest login via router or alert
            if (Platform.OS === 'web') {
                alert(t('common.member_only_alert'));
            }
            return;
        }

        if (item.path === '/' && pathname === '/') {
            // If already on Home, scroll to top
            mainScrollRef?.current?.scrollTo({ y: 0, animated: true });
        } else {
            router.push(item.path as any);
        }
    };

    if (isWide) {
        // PC Sidebar - Expanded with Header and Labels (Sample Layout)
        return (
            <View
                className={`absolute left-0 top-0 bottom-0 w-64 z-[9999] border-r ${isDark ? 'bg-[#0b1221] border-slate-800' : 'bg-white border-slate-200'}`}
            >
                {/* Header Area */}
                <View className="p-8 pb-10">
                    <View className="flex-row items-center gap-4">
                        <View className={`w-12 h-12 rounded-2xl items-center justify-center ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-50'}`}>
                            <Ionicons name="flash" size={28} color="#10b981" />
                        </View>
                        <View className="flex-1">
                            <Text className={`text-xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{auth.adminName || t('dashboard.title')}</Text>
                            <Text className={`text-[10px] font-bold tracking-tight ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                {serverId && allianceId ? `#${serverId} - ${allianceId}` : t('common.welcome')}
                            </Text>
                        </View>
                    </View>
                    <View className={`mt-8 h-[1px] w-full ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`} />
                </View>

                {/* Navigation Items */}
                <View className="px-4 flex-1">
                    {NAV_ITEMS.map((item) => {
                        const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
                        return (
                            <Pressable
                                key={item.id}
                                onPress={() => handleNavPress(item)}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingHorizontal: 24,
                                        paddingVertical: 16,
                                        borderRadius: 16,
                                        marginBottom: 8,
                                        backgroundColor: isActive
                                            ? (isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)')
                                            : (hovered ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent'),
                                        borderWidth: 1,
                                        borderColor: isActive
                                            ? (isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.2)')
                                            : (hovered ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)') : 'transparent'),
                                        transform: [{ scale: pressed ? 0.98 : 1 }],
                                        transition: 'all 0.2s',
                                    }
                                ]}
                            >
                                {({ hovered }: any) => (
                                    <>
                                        <Ionicons
                                            name={isActive ? item.activeIcon : item.icon}
                                            size={24}
                                            color={isActive ? "#10b981" : (hovered ? (isDark ? '#94a3b8' : '#64748b') : (isDark ? '#475569' : '#94a3b8'))}
                                            style={{ marginRight: 16 }}
                                        />
                                        <Text
                                            className={`text-base font-black tracking-tight ${isActive ? (isDark ? 'text-white' : 'text-slate-900') : (hovered ? (isDark ? 'text-slate-300' : 'text-slate-700') : (isDark ? 'text-slate-500' : 'text-slate-400'))}`}
                                        >
                                            {t(item.labelKey)}
                                        </Text>
                                        {isActive && (
                                            <View className="absolute left-0 w-1 h-6 bg-emerald-500 rounded-r-full" />
                                        )}
                                    </>
                                )}
                            </Pressable>
                        );
                    })}
                </View>

                {/* Footer Section */}
                <View className={`mx-4 mb-8 p-6 rounded-3xl border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                    <Text className={`text-[10px] font-black tracking-widest uppercase mb-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('dashboard.footer_copyright_simple')}</Text>
                    <Text className={`text-[9px] font-bold ${isDark ? 'text-slate-700' : 'text-slate-400'}`}>{t('dashboard.footer_rights')}</Text>
                </View>
            </View>
        );
    }

    // Mobile Bottom Menu
    return (
        <View className="absolute bottom-0 left-0 right-0 z-[9999]">
            <View
                className={`flex-row items-center px-2 py-2 border-t shadow-2xl overflow-hidden ${isDark ? 'bg-slate-950/90 border-slate-900' : 'bg-white/95 border-slate-100'}`}
                style={{
                    width: '100%',
                    borderTopLeftRadius: 0,
                    borderTopRightRadius: 0,
                    shadowColor: isDark ? '#000' : '#64748b',
                    shadowOffset: { width: 0, height: -10 },
                    shadowOpacity: 0.1,
                    shadowRadius: 20,
                }}
            >
                {Platform.OS !== 'android' && (
                    <BlurView intensity={30} className="absolute inset-0" />
                )}

                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));

                    return (
                        <Pressable
                            key={item.id}
                            onPress={() => handleNavPress(item)}
                            style={({ pressed, hovered }: any) => [
                                {
                                    flex: 1,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    padding: 4,
                                    transform: [{ scale: pressed ? 0.92 : (hovered ? 1.05 : 1) }],
                                    transition: 'all 0.2s',
                                }
                            ]}
                        >
                            {({ hovered }: any) => (
                                <View className="items-center">
                                    {/* Top indicator bar */}
                                    {isActive && (
                                        <View
                                            className={`absolute -top-2.5 w-8 h-1 rounded-full ${isDark ? 'bg-sky-400' : 'bg-blue-500'}`}
                                            style={{
                                                shadowColor: isDark ? '#38bdf8' : '#3b82f6',
                                                shadowOffset: { width: 0, height: 2 },
                                                shadowOpacity: 0.6,
                                                shadowRadius: 4,
                                            }}
                                        />
                                    )}
                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center transition-all ${isActive ? (isDark ? 'bg-sky-500/20' : 'bg-blue-100/80') : (hovered ? (isDark ? 'bg-slate-800/50' : 'bg-slate-100/50') : '')}`}>
                                        <Ionicons
                                            name={isActive ? item.activeIcon : item.icon}
                                            size={24}
                                            color={isActive ? (isDark ? '#38bdf8' : '#2563eb') : (hovered ? (isDark ? '#94a3b8' : '#64748b') : (isDark ? '#64748b' : '#94a3b8'))}
                                        />
                                    </View>
                                    <Text
                                        className={`mt-0.5 text-[9px] font-black tracking-tighter ${isActive ? (isDark ? 'text-sky-400' : 'text-blue-600') : (hovered ? (isDark ? 'text-slate-300' : 'text-slate-700') : (isDark ? 'text-slate-600' : 'text-slate-400'))}`}
                                    >
                                        {t(item.labelKey)}
                                    </Text>
                                    {/* Bottom indicator dot */}
                                    <View className={`w-1 h-1 rounded-full mt-0.5 ${isActive ? (isDark ? 'bg-sky-400' : 'bg-blue-500') : 'bg-transparent'}`} />
                                </View>
                            )}
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}
