import React from 'react';
import { View, Text, TouchableOpacity, Pressable, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TimelineView from '../TimelineView';
import { EventSectionHeader } from './EventSectionHeader';

interface EventSectionListProps {
    isDark: boolean;
    windowWidth: number;
    fontSizeScale: number;
    t: (key: string, options?: any) => string;
    timezone: 'LOCAL' | 'UTC';
    setTimezone: (tz: 'LOCAL' | 'UTC') => void;
    viewMode: 'list' | 'timeline';
    setViewMode: (mode: 'list' | 'timeline') => void;
    isMobile: boolean;
    loading: boolean;
    displayEvents: any[];
    isEventActive: (event: any) => boolean;
    isEventExpired: (event: any) => boolean;
    isActiveExpanded: boolean;
    setIsActiveExpanded: (v: boolean) => void;
    isUpcomingExpanded: boolean;
    setIsUpcomingExpanded: (v: boolean) => void;
    isExpiredExpanded: boolean;
    setIsExpiredExpanded: (v: boolean) => void;
    activeEventTab: 'active' | 'upcoming' | 'expired';
    scrollToSection: (section: 'active' | 'upcoming' | 'expired') => void;
    renderEventCard: (event: any, key: string) => React.ReactNode;
    sectionPositions: React.MutableRefObject<{ [key: string]: number }>;
    setContainerY: (y: number) => void;
    auth: any;
    router: any;
    showCustomAlert: (title: string, message: string, type: 'success' | 'error' | 'warning') => void;
}

export const EventSectionList: React.FC<EventSectionListProps> = ({
    isDark,
    windowWidth,
    fontSizeScale,
    t,
    timezone,
    setTimezone,
    viewMode,
    setViewMode,
    isMobile,
    loading,
    displayEvents,
    isEventActive,
    isEventExpired,
    isActiveExpanded,
    setIsActiveExpanded,
    isUpcomingExpanded,
    setIsUpcomingExpanded,
    isExpiredExpanded,
    setIsExpiredExpanded,
    activeEventTab,
    scrollToSection,
    renderEventCard,
    sectionPositions,
    setContainerY,
    auth,
    router,
    showCustomAlert
}) => {
    return (
        <>

            {/* Section 3: Event List */}
            <View
                onLayout={(e) => setContainerY(e.nativeEvent.layout.y)}
                className="w-full items-center pb-24"
            >
                <View className={viewMode === 'timeline' ? 'w-full' : 'w-full px-4'}>
                    <View className={viewMode === 'timeline' ? 'w-full' : 'w-full flex-col gap-3'}>
                        {loading ? (
                            <View className={`p-16 rounded-[32px] border border-dashed items-center justify-center ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                <Text className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('dashboard.loading_schedule')}</Text>
                            </View>
                        ) : displayEvents.length > 0 ? (
                            <View className="flex-col gap-4">
                                {(() => {
                                    const activeEvents = displayEvents.filter(e => isEventActive(e));
                                    const upcomingEvents = displayEvents.filter(e => !isEventActive(e) && !isEventExpired(e));
                                    const expiredEvents = displayEvents.filter(e => isEventExpired(e));

                                    return viewMode === 'list' ? (
                                        <View className="w-full">
                                            {/* Live Section */}
                                            <View
                                                onLayout={(e) => sectionPositions.current.active = e.nativeEvent.layout.y}
                                                className="mb-12"
                                            >
                                                <View className="flex-row items-center justify-between mb-4 px-1">
                                                    <TouchableOpacity
                                                        className="flex-row items-center"
                                                        onPress={() => setIsActiveExpanded(!isActiveExpanded)}
                                                    >
                                                        <View className="w-1.5 h-6 bg-emerald-500 rounded-full mr-3" />
                                                        <Text className={`font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 20 * fontSizeScale }}>{t('dashboard.event_active')}</Text>
                                                        <Ionicons name={isActiveExpanded ? "chevron-up" : "chevron-down"} size={20} color={isDark ? '#94a3b8' : '#94a3b8'} style={{ marginLeft: 6 }} />
                                                    </TouchableOpacity>
                                                </View>
                                                {isActiveExpanded && (
                                                    activeEvents.length > 0 ? (
                                                        <View className="flex-col gap-y-2 px-1">
                                                            {activeEvents.map((event, idx) => renderEventCard(event, `active-${idx}`))}
                                                        </View>
                                                    ) : (
                                                        <View className={`py-12 items-center justify-center rounded-[32px] border border-dashed ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                                            <Ionicons name="flash-off-outline" size={32} color={isDark ? '#475569' : '#94a3b8'} style={{ marginBottom: 12 }} />
                                                            <Text className={`font-bold text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('dashboard.event_active_empty')}</Text>
                                                        </View>
                                                    )
                                                )}
                                            </View>

                                            {/* Upcoming Section */}
                                            <View
                                                onLayout={(e) => sectionPositions.current.upcoming = e.nativeEvent.layout.y}
                                                className="mb-12"
                                            >
                                                <View className="flex-row items-center justify-between mb-4 px-1">
                                                    <TouchableOpacity
                                                        className="flex-row items-center"
                                                        onPress={() => setIsUpcomingExpanded(!isUpcomingExpanded)}
                                                    >
                                                        <View className="w-1.5 h-6 bg-sky-500 rounded-full mr-3" />
                                                        <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dashboard.event_upcoming')}</Text>
                                                        <Ionicons name={isUpcomingExpanded ? "chevron-up" : "chevron-down"} size={20} color={isDark ? '#94a3b8' : '#94a3b8'} style={{ marginLeft: 6 }} />
                                                    </TouchableOpacity>
                                                </View>
                                                {isUpcomingExpanded && (
                                                    upcomingEvents.length > 0 ? (
                                                        <View className="flex-col gap-y-2 px-1">
                                                            {upcomingEvents.map((event, idx) => renderEventCard(event, `upcoming-${idx}`))}
                                                        </View>
                                                    ) : (
                                                        <View className={`py-12 items-center justify-center rounded-[32px] border border-dashed ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                                            <Ionicons name="calendar-outline" size={32} color={isDark ? '#475569' : '#94a3b8'} style={{ marginBottom: 12 }} />
                                                            <Text className={`font-bold text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('dashboard.event_upcoming_empty')}</Text>
                                                        </View>
                                                    )
                                                )}
                                            </View>

                                            {/* Expired Section */}
                                            <View
                                                onLayout={(e) => sectionPositions.current.expired = e.nativeEvent.layout.y}
                                                className="mb-12"
                                            >
                                                <View className="flex-row items-center justify-between mb-6 px-1">
                                                    <TouchableOpacity
                                                        className="flex-row items-center"
                                                        onPress={() => setIsExpiredExpanded(!isExpiredExpanded)}
                                                    >
                                                        <View className="w-1.5 h-6 bg-slate-500 rounded-full mr-3" />
                                                        <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dashboard.event_expired')}</Text>
                                                        <Ionicons name={isExpiredExpanded ? "chevron-up" : "chevron-down"} size={20} color={isDark ? '#94a3b8' : '#94a3b8'} style={{ marginLeft: 6 }} />
                                                    </TouchableOpacity>
                                                </View>
                                                {isExpiredExpanded ? (
                                                    expiredEvents.length > 0 ? (
                                                        <View className="flex-col gap-y-2 px-1">
                                                            {expiredEvents.map((event, idx) => renderEventCard(event, `expired-${idx}`))}
                                                        </View>
                                                    ) : (
                                                        <View className={`py-12 items-center justify-center rounded-[32px] border border-dashed ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                                            <Ionicons name="checkmark-done-outline" size={32} color={isDark ? '#475569' : '#94a3b8'} style={{ marginBottom: 12 }} />
                                                            <Text className={`font-bold text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('dashboard.event_expired_empty')}</Text>
                                                        </View>
                                                    )
                                                ) : null}
                                            </View>
                                        </View>
                                    ) : (
                                        <View key="timeline-view-content" className={`w-full ${isDark ? 'bg-[#0a1120]' : 'bg-white'} ${viewMode === 'timeline' ? '' : 'rounded-[40px] border overflow-hidden p-6 shadow-2xl shadow-black'}`}>
                                            <TimelineView
                                                events={displayEvents}
                                                timezone={timezone}
                                                isDark={isDark}
                                                onEventPress={(ev) => {
                                                    if (!auth.isLoggedIn) {
                                                        showCustomAlert(t('common.member_only_title'), t('common.member_only_alert'), 'error');
                                                        return;
                                                    }
                                                    router.push({ pathname: '/growth/events', params: { focusId: ev.originalEventId || ev.eventId, viewMode: viewMode } });
                                                }}
                                                checkIsOngoing={isEventActive}
                                            />
                                        </View>
                                    );
                                })()}
                            </View>
                        ) : (
                            <View className={`p-12 rounded-[32px] border border-dashed items-center justify-center ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                <View className={`w-16 h-16 rounded-3xl items-center justify-center mb-4 ${isDark ? 'bg-sky-500/10' : 'bg-sky-50'}`}>
                                    <Ionicons name="calendar-outline" size={32} color={isDark ? '#475569' : '#94a3b8'} />
                                </View>
                                <Text className={`font-bold text-base mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dashboard.schedule_empty')}</Text>
                                <Text className={`text-xs mb-5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('dashboard.schedule_empty_desc')}</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        if (!auth.isLoggedIn) {
                                            showCustomAlert(t('auth.loginRequired'), t('common.member_only_alert'), 'error');
                                            return;
                                        }
                                        router.push('/growth/events' as any);
                                    }}
                                    className={`px-6 py-3 rounded-2xl flex-row items-center ${isDark ? 'bg-sky-500/15 border border-sky-500/30' : 'bg-sky-50 border border-sky-200'}`}
                                >
                                    <Ionicons name="add-circle-outline" size={16} color={isDark ? '#38bdf8' : '#2563eb'} style={{ marginRight: 6 }} />
                                    <Text className={`font-bold text-sm ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{t('dashboard.register_schedule')}</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </>
    );
};
