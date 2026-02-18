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

    // Mobile Bottom Menu - Premium Bottom Strip Style
    return (
        <View
            className={`z-[9999] ${isDark ? 'bg-slate-900/90' : 'bg-white/90'}`}
            style={{
                borderTopWidth: 1,
                borderTopColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)',
                paddingBottom: Platform.OS === 'ios' ? 24 : 8,
                paddingTop: 8,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: -10 },
                shadowOpacity: isDark ? 0.3 : 0.05,
                shadowRadius: 20,
                elevation: 20,
            }}
        >
            {Platform.OS !== 'android' && (
                <BlurView intensity={isDark ? 40 : 60} tint={isDark ? 'dark' : 'light'} className="absolute inset-0" />
            )}

            <View className="flex-row items-center justify-around px-4">
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
                                    paddingVertical: 8,
                                    borderRadius: 16,
                                    marginHorizontal: 4,
                                    backgroundColor: pressed ? (isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(37, 99, 235, 0.05)') : 'transparent',
                                    transform: [{ scale: pressed ? 0.92 : (hovered ? 1.05 : 1) }],
                                    // @ts-ignore
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                }
                            ]}
                        >
                            <View className="items-center justify-center">
                                <View
                                    className={`items-center justify-center mb-1 rounded-xl w-10 h-10 ${isActive ? (isDark ? 'bg-sky-500/10' : 'bg-blue-500/10') : ''}`}
                                    style={isActive ? {
                                        shadowColor: isDark ? '#38bdf8' : '#2563eb',
                                        shadowOffset: { width: 0, height: 0 },
                                        shadowOpacity: 0.2,
                                        shadowRadius: 10,
                                    } : {}}
                                >
                                    <Ionicons
                                        name={isActive ? item.activeIcon : item.icon}
                                        size={24}
                                        color={isActive ? (isDark ? '#38bdf8' : '#2563eb') : (isDark ? 'rgba(148, 163, 184, 0.5)' : 'rgba(100, 116, 139, 0.5)')}
                                    />
                                </View>

                                {isActive && (
                                    <Text
                                        className={`text-[10px] font-black tracking-tighter ${isDark ? 'text-sky-400' : 'text-blue-600'}`}
                                        numberOfLines={1}
                                        style={{
                                            textTransform: 'uppercase',
                                            letterSpacing: 0.5,
                                            marginTop: 2
                                        }}
                                    >
                                        {t(item.labelKey)}
                                    </Text>
                                )}

                                {isActive && (
                                    <View
                                        className={`absolute -top-1 w-1 h-1 rounded-full ${isDark ? 'bg-sky-400' : 'bg-blue-500'}`}
                                        style={{
                                            shadowColor: isDark ? '#38bdf8' : '#2563eb',
                                            shadowOffset: { width: 0, height: 0 },
                                            shadowOpacity: 0.8,
                                            shadowRadius: 4,
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
