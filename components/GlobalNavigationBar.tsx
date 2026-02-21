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
    const { theme, fontSizeScale } = useTheme();
    const { auth, serverId, allianceId, mainScrollRef, showCustomAlert } = useAuth();
    const { t } = useTranslation();
    const isDark = theme === 'dark';

    const handleNavPress = (item: NavItemProps) => {
        // Only allow Home, Heroes, or Settings for non-logged-in users
        if (!auth.isLoggedIn && item.id !== 'home' && item.id !== 'settings' && item.id !== 'heroes') {
            showCustomAlert(t('common.member_only_title'), t('common.member_only_alert'), 'error');
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
                            <Text className={`font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 20 * fontSizeScale }}>{auth.adminName || t('dashboard.title')}</Text>
                            <Text className={`font-bold tracking-tight ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} style={{ fontSize: 10 * fontSizeScale }}>
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
                                            className={`font-black tracking-tight ${isActive ? (isDark ? 'text-white' : 'text-slate-900') : (hovered ? (isDark ? 'text-slate-300' : 'text-slate-700') : (isDark ? 'text-slate-500' : 'text-slate-400'))}`}
                                            style={{ fontSize: 16 * fontSizeScale }}
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
                    <Text className={`font-black tracking-widest uppercase mb-1 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} style={{ fontSize: 10 * fontSizeScale }}>{t('dashboard.footer_copyright_simple')}</Text>
                    <Text className={`font-bold ${isDark ? 'text-slate-700' : 'text-slate-400'}`} style={{ fontSize: 9 * fontSizeScale }}>{t('dashboard.footer_rights')}</Text>
                </View>
            </View>
        );
    }

    // Mobile Bottom Menu - Improved Visibility & Interaction
    return (
        <View
            className={`z-[9999] ${isDark ? 'bg-slate-900' : 'bg-white'}`}
            style={{
                borderTopWidth: 1,
                borderTopColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)',
                paddingBottom: Platform.OS === 'ios' ? 34 : 16,
                paddingTop: 12,
                height: Platform.OS === 'ios' ? 100 : 80,
                // @ts-ignore - Web CSS boxShadow
                boxShadow: isDark ? '0 -4px 20px rgba(0, 0, 0, 0.3)' : '0 -4px 12px rgba(148, 163, 184, 0.08)',
                elevation: 20,
            }}
        >
            {Platform.OS !== 'android' && (
                <BlurView intensity={isDark ? 30 : 50} tint={isDark ? 'dark' : 'light'} className="absolute inset-0" />
            )}

            <View className="flex-row items-center justify-around px-2">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));

                    return (
                        <Pressable
                            key={item.id}
                            onPress={() => handleNavPress(item)}
                            style={({ pressed }: any) => [
                                {
                                    flex: 1,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    height: 50,
                                    transform: [{ scale: pressed ? 0.92 : 1 }],
                                    // @ts-ignore
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                }
                            ]}
                        >
                            <View className="items-center justify-center w-full">
                                <View className="items-center justify-center h-7 mb-0.5">
                                    <Ionicons
                                        name={isActive ? item.activeIcon : item.icon}
                                        size={24}
                                        color={isActive ? '#10b981' : (isDark ? '#94a3b8' : '#94a3b8')}
                                        style={isActive ? {
                                            // @ts-ignore - Web CSS textShadow
                                            textShadow: '0 0 8px rgba(16, 185, 129, 0.5)',
                                        } : {
                                            opacity: 0.8
                                        }}
                                    />
                                </View>

                                <Text
                                    className={`font-bold tracking-tight mt-0.5 ${isActive ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}
                                    numberOfLines={1}
                                    style={{
                                        fontSize: 12 * fontSizeScale, // User requested ~12px
                                        lineHeight: 14 * fontSizeScale
                                    }}
                                >
                                    {t(item.labelKey)}
                                </Text>

                                {isActive && (
                                    <View
                                        className={`absolute -top-2 w-1 h-1 rounded-full ${isDark ? 'bg-emerald-400' : 'bg-emerald-500'}`}
                                        style={{
                                            // @ts-ignore - Web CSS boxShadow
                                            boxShadow: '0 0 4px rgba(16, 185, 129, 1)',
                                        }}
                                    />
                                )}
                            </View>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}
