import React from 'react';
import { View, Text, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface EventSectionHeaderProps {
    isDark: boolean;
    windowWidth: number;
    fontSizeScale: number;
    t: (key: string, options?: any) => string;
    timezone: 'LOCAL' | 'UTC';
    setTimezone: (tz: 'LOCAL' | 'UTC') => void;
    viewMode: 'list' | 'timeline';
    setViewMode: (mode: 'list' | 'timeline') => void;
    isMobile: boolean;
    displayEvents: any[];
    isEventActive: (event: any) => boolean;
    isEventExpired: (event: any) => boolean;
    activeEventTab: 'active' | 'upcoming' | 'expired';
    scrollToSection: (section: 'active' | 'upcoming' | 'expired') => void;
}

export const EventSectionHeader: React.FC<EventSectionHeaderProps> = ({
    isDark,
    windowWidth,
    fontSizeScale,
    t,
    timezone,
    setTimezone,
    viewMode,
    setViewMode,
    isMobile,
    displayEvents,
    isEventActive,
    isEventExpired,
    activeEventTab,
    scrollToSection,
}) => {
    return (
        <View className={`w-full items-center z-50 py-3 ${isDark ? 'bg-[#060b14]/95' : 'bg-slate-50/95'}`} style={{ borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }}>
            <View className="w-full max-w-6xl">
                {/* Weekly Program Title & Timezone */}
                <View className={`flex-row items-center justify-between ${windowWidth < 410 ? 'px-2' : 'px-3'} md:px-6 py-3 md:py-5 border ${isDark ? 'bg-slate-900 shadow-2xl shadow-black border-slate-800' : 'bg-white border-slate-200 shadow-xl'}`}>
                    <View className="flex-row items-center flex-1 mr-2">
                        <View className={`w-1 h-6 md:w-1.5 md:h-10 rounded-full ${windowWidth < 410 ? 'mr-1.5' : 'mr-5'} bg-[#38bdf8]`} />
                        <View>
                            {windowWidth > 400 && (
                                <Text className={`text-[11px] font-black tracking-[0.25em] uppercase mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Weekly Program</Text>
                            )}
                            <Text className={`font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: (windowWidth < 410 ? 21 : 24) * fontSizeScale }}>
                                {t('dashboard.weekly_event_title')}
                            </Text>
                        </View>
                    </View>

                    <View className="flex-row items-center gap-1 md:gap-2">
                        {/* Timezone Group */}
                        <View className={`flex-row p-0.5 md:p-1 rounded-[14px] md:rounded-2xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200 shadow-inner'}`}>
                            <Pressable
                                onPress={() => setTimezone('LOCAL')}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        paddingHorizontal: windowWidth < 410 ? 12 : (isMobile ? 12 : 24),
                                        height: windowWidth < 410 ? 28 : (isMobile ? 32 : 40),
                                        borderRadius: windowWidth < 410 ? 8 : 12,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: timezone === 'LOCAL'
                                            ? '#3b82f6'
                                            : (hovered ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : 'transparent'),
                                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        cursor: 'pointer'
                                    }
                                ]}
                            >
                                <Text className={`text-[11px] md:text-[14px] font-black ${timezone === 'LOCAL' ? 'text-white' : 'text-[#3b82f6]'}`}>Local</Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setTimezone('UTC')}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        paddingHorizontal: windowWidth < 410 ? 12 : (isMobile ? 12 : 24),
                                        height: windowWidth < 410 ? 28 : (isMobile ? 32 : 40),
                                        borderRadius: windowWidth < 410 ? 8 : 12,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: timezone === 'UTC'
                                            ? '#3b82f6'
                                            : (hovered ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : 'transparent'),
                                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        cursor: 'pointer'
                                    }
                                ]}
                            >
                                <Text className={`text-[11px] md:text-[14px] font-black ${timezone === 'UTC' ? 'text-white' : 'text-[#3b82f6]'}`}>UTC</Text>
                            </Pressable>
                        </View>

                        {/* View Mode Group */}
                        <View className={`flex-row p-0.5 md:p-1 rounded-[14px] md:rounded-2xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                            <Pressable
                                onPress={() => setViewMode('timeline')}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingHorizontal: windowWidth < 410 ? 10 : 16,
                                        height: windowWidth < 410 ? 28 : (isMobile ? 32 : 40),
                                        borderRadius: windowWidth < 410 ? 8 : 12,
                                        backgroundColor: viewMode === 'timeline'
                                            ? (isDark ? '#334155' : 'white')
                                            : 'transparent',
                                        ...(Platform.OS === 'web'
                                            ? (viewMode === 'timeline' ? { boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 4px rgba(0,0,0,0.05)' } : {})
                                            : (viewMode === 'timeline' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 } : {})
                                        ) as any,
                                        transform: [{ scale: pressed ? 0.95 : 1 }],
                                        transition: 'all 0.2s',
                                        cursor: 'pointer'
                                    }
                                ]}
                            >
                                <Ionicons name="calendar-outline" size={isMobile ? 14 : 16} color={viewMode === 'timeline' ? '#38bdf8' : (isDark ? '#475569' : '#94a3b8')} />
                                {windowWidth > 450 && (
                                    <Text className={`ml-2 font-black ${viewMode === 'timeline' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`} style={{ fontSize: 13 * fontSizeScale }}>
                                        {t('events.timeline_view')}
                                    </Text>
                                )}
                            </Pressable>
                            <Pressable
                                onPress={() => setViewMode('list')}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        paddingHorizontal: windowWidth < 410 ? 10 : 16,
                                        height: windowWidth < 410 ? 28 : (isMobile ? 32 : 40),
                                        borderRadius: windowWidth < 410 ? 8 : 12,
                                        backgroundColor: viewMode === 'list'
                                            ? (isDark ? '#334155' : 'white')
                                            : 'transparent',
                                        ...(Platform.OS === 'web'
                                            ? (viewMode === 'list' ? { boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 4px rgba(0,0,0,0.05)' } : {})
                                            : (viewMode === 'list' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 } : {})
                                        ) as any,
                                        transform: [{ scale: pressed ? 0.95 : 1 }],
                                        transition: 'all 0.2s',
                                        cursor: 'pointer'
                                    }
                                ]}
                            >
                                <Ionicons name="list-outline" size={isMobile ? 14 : 16} color={viewMode === 'list' ? '#38bdf8' : (isDark ? '#475569' : '#94a3b8')} />
                                {windowWidth > 450 && (
                                    <Text className={`ml-2 font-black ${viewMode === 'list' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`} style={{ fontSize: 13 * fontSizeScale }}>
                                        {t('events.list_view')}
                                    </Text>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </View>

                {/* Quick Section Tabs - Scroll to behavior */}
                {viewMode === 'list' && (
                    <View className="flex-row items-center gap-2 md:gap-3 px-3 md:px-5 mt-4">
                        {[
                            { id: 'active', label: t('dashboard.tab_active'), count: displayEvents.filter(e => isEventActive(e)).length, color: '#10b981', icon: 'flash' },
                            { id: 'upcoming', label: t('dashboard.tab_upcoming'), count: displayEvents.filter(e => !isEventActive(e) && !isEventExpired(e)).length, color: '#38bdf8', icon: 'calendar' },
                            { id: 'expired', label: t('dashboard.tab_expired'), count: displayEvents.filter(e => isEventExpired(e)).length, color: '#64748b', icon: 'checkmark-circle' },
                        ].map((tab) => {
                            const isActive = activeEventTab === tab.id;
                            return (
                                <Pressable
                                    key={tab.id}
                                    onPress={() => scrollToSection(tab.id as any)}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            flex: 1,
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            paddingVertical: windowWidth < 380 ? 10 : 12,
                                            backgroundColor: isActive ? tab.color : (isDark ? 'rgba(30, 41, 59, 0.3)' : 'rgba(241, 245, 249, 0.8)'),
                                            borderRadius: 16,
                                            borderWidth: 1,
                                            borderColor: isActive ? 'transparent' : (isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0'),
                                            opacity: pressed ? 0.8 : 1,
                                            transform: [{ translateY: pressed ? 2 : 0 }],
                                            transition: 'all 0.2s',
                                            // @ts-ignore - Web property
                                            cursor: 'pointer'
                                        }
                                    ]}
                                >
                                    {({ hovered }: any) => (
                                        <>
                                            <Ionicons
                                                name={tab.icon as any}
                                                size={windowWidth < 380 ? 14 : 16}
                                                color={isActive
                                                    ? (isDark ? tab.color : '#fff')
                                                    : (hovered ? (isDark ? '#94a3b8' : '#64748b') : (isDark ? '#475569' : '#94a3b8'))
                                                }
                                                style={{ marginRight: windowWidth < 380 ? 4 : 6 }}
                                            />
                                            <Text className={`font-black tracking-tighter ${windowWidth < 380 ? 'text-[13px]' : 'text-sm'} ${isActive
                                                ? (isDark ? 'text-white' : 'text-white')
                                                : (hovered ? (isDark ? 'text-slate-300' : 'text-slate-700') : (isDark ? 'text-slate-600' : 'text-slate-400'))}`}>
                                                {tab.label} <Text className={`font-black ${isActive ? 'text-white' : 'opacity-80'}`} style={{ fontSize: (windowWidth < 380 ? 14 : 18) * fontSizeScale }}>{tab.count}</Text>
                                            </Text>
                                        </>
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>
                )}
            </View>
        </View>
    );
};
