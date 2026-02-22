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
    // 폰트 크기 비율과 기기 폭을 계산하여 텍스트 표시 여부를 동적으로 결정 (화면 공간 부족 방지)
    const showViewModeLabel = (windowWidth / fontSizeScale) >= 340;

    return (
        <View className={`w-full items-center z-50 py-3 ${isDark ? 'bg-[#060b14]/95' : 'bg-slate-50/95'}`} style={{ borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }}>
            <View className="w-full max-w-6xl">
                {/* Weekly Program Title & Timezone */}
                <View className={`items-center justify-between ${windowWidth < 380 ? 'flex-col gap-3 px-3' : 'flex-row px-4 md:px-6'} py-4 md:py-5 border ${isDark ? 'bg-slate-900 shadow-2xl shadow-black border-slate-800' : 'bg-white border-slate-200 shadow-xl'}`}>
                    <View className={`flex-row items-center ${windowWidth < 380 ? 'w-full justify-start' : 'mr-4'}`}>
                        <View className={`w-1 h-5 md:w-1.5 md:h-8 rounded-full ${windowWidth < 410 ? 'mr-2' : 'mr-4'} bg-[#38bdf8]`} />
                        <View className="flex-shrink">
                            <Text
                                numberOfLines={1}
                                className={`font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}
                                style={{
                                    fontSize: (
                                        windowWidth < 410 ? 18 :
                                            windowWidth < 768 ? 24 :
                                                windowWidth < 1024 ? 28 : 32
                                    ) * fontSizeScale
                                }}
                            >
                                {t('dashboard.weekly_event_title')}
                            </Text>
                        </View>
                    </View>

                    <View className={`flex-row items-center gap-2 ${windowWidth < 380 ? 'w-full justify-between' : ''}`}>
                        {/* Timezone Group */}
                        <View className={`flex-row p-0.5 rounded-xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                            {['LOCAL', 'UTC'].map((tz) => (
                                <Pressable
                                    key={tz}
                                    onPress={() => setTimezone(tz as any)}
                                    style={({ pressed }: any) => [
                                        {
                                            paddingHorizontal: (windowWidth < 410 ? 8 : 12) * fontSizeScale,
                                            height: 28 * fontSizeScale,
                                            borderRadius: 8 * fontSizeScale,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: timezone === tz ? '#3b82f6' : 'transparent',
                                            opacity: pressed ? 0.8 : 1
                                        }
                                    ]}
                                >
                                    <Text
                                        className={`font-black tracking-widest ${timezone === tz ? 'text-white' : 'text-[#3b82f6]'}`}
                                        style={{ fontSize: (windowWidth < 410 ? 10 : 11) * fontSizeScale }}
                                    >
                                        {tz}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>

                        {/* View Mode Group */}
                        <View className={`flex-row p-0.5 rounded-xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                            {[
                                { id: 'timeline', icon: 'calendar-outline', label: t('events.timeline_view') },
                                { id: 'list', icon: 'list-outline', label: t('events.list_view') }
                            ].map((mode) => (
                                <Pressable
                                    key={mode.id}
                                    onPress={() => setViewMode(mode.id as any)}
                                    style={({ pressed }: any) => [
                                        {
                                            flexDirection: 'row',
                                            paddingHorizontal: (windowWidth < 380 ? 8 : 12) * Math.min(fontSizeScale, 1.1),
                                            height: 28 * fontSizeScale,
                                            borderRadius: 8 * fontSizeScale,
                                            backgroundColor: viewMode === mode.id ? (isDark ? '#334155' : 'white') : 'transparent',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            opacity: pressed ? 0.8 : 1
                                        }
                                    ]}
                                >
                                    <Ionicons
                                        name={mode.icon as any}
                                        size={(windowWidth < 380 ? 12 : 14) * fontSizeScale}
                                        color={viewMode === mode.id ? '#fbbf24' : (isDark ? '#64748b' : '#94a3b8')}
                                    />
                                    {showViewModeLabel && (
                                        <Text
                                            className={`ml-1.5 font-black ${viewMode === mode.id ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}
                                            style={{ fontSize: (windowWidth < 380 ? 10 : 12) * fontSizeScale }}
                                        >
                                            {mode.label}
                                        </Text>
                                    )}
                                </Pressable>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Refined Tabs Section */}
                {viewMode === 'list' && (
                    <View className="w-full px-3 md:px-5 mt-4">
                        <View className={`flex-row items-center p-1 rounded-2xl ${isDark ? 'bg-slate-900/60 border border-slate-800' : 'bg-slate-100 border border-slate-200'}`}>
                            {[
                                { id: 'active', label: t('dashboard.tab_active'), count: displayEvents.filter(e => isEventActive(e)).length, color: '#10b981', icon: 'flash' },
                                { id: 'upcoming', label: t('dashboard.tab_upcoming'), count: displayEvents.filter(e => !isEventActive(e) && !isEventExpired(e)).length, color: '#3b82f6', icon: 'calendar' },
                                { id: 'expired', label: t('dashboard.tab_expired'), count: displayEvents.filter(e => isEventExpired(e)).length, color: '#64748b', icon: 'checkmark-circle' },
                            ].map((tab) => {
                                const isActive = activeEventTab === tab.id;
                                return (
                                    <Pressable
                                        key={tab.id}
                                        onPress={() => scrollToSection(tab.id as any)}
                                        style={({ pressed }: any) => [
                                            {
                                                flex: 1,
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                height: 44,
                                                borderRadius: 12,
                                                backgroundColor: isActive ? (isDark ? `${tab.color}30` : 'white') : 'transparent',
                                                borderWidth: isActive ? 1 : 0,
                                                borderColor: isActive ? tab.color : 'transparent',
                                                ...(isActive && Platform.OS === 'web' ? { boxShadow: '0 4px 12px rgba(0,0,0,0.1)' } : {}),
                                                transform: [{ scale: pressed ? 0.98 : 1 }]
                                            }
                                        ]}
                                    >
                                        <Ionicons
                                            name={tab.icon as any}
                                            size={16}
                                            color={isActive ? tab.color : (isDark ? '#475569' : '#94a3b8')}
                                            style={{ marginRight: 6 }}
                                        />
                                        <Text
                                            className={`font-black tracking-tight ${windowWidth < 410 ? 'text-[12px]' : 'text-[14px]'} ${isActive
                                                ? (isDark ? 'text-white' : 'text-slate-900')
                                                : (isDark ? 'text-slate-500' : 'text-slate-400')}`}
                                        >
                                            {tab.label}
                                        </Text>
                                        <View
                                            className={`ml-2 px-2 py-0.5 rounded-full ${isActive ? '' : (isDark ? 'bg-slate-800/50' : 'bg-slate-200/50')}`}
                                            style={isActive ? { backgroundColor: tab.color } : {}}
                                        >
                                            <Text
                                                className={`font-black text-white`}
                                                style={{ fontSize: 11 * fontSizeScale, color: isActive ? 'white' : (isDark ? '#64748b' : '#94a3b8') }}
                                            >
                                                {tab.count}
                                            </Text>
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
};
