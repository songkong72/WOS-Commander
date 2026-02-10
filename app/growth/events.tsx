import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, Image, Modal, TextInput, Alert, FlatList, ActivityIndicator, useWindowDimensions, Linking, Platform, Pressable, Animated, Dimensions } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth, useTheme } from '../context';
import { getGuideContent } from '../../data/event-guides';
import { Attendee } from '../../data/mock-attendees';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFirestoreAttendees } from '../../hooks/useFirestoreAttendees';
import { useFirestoreEventSchedules } from '../../hooks/useFirestoreEventSchedules';
import { useFirestoreMembers } from '../../hooks/useFirestoreMembers';
import { useFirestoreAdmins } from '../../hooks/useFirestoreAdmins';
import { useFirestoreEventsWithAttendees } from '../../hooks/useFirestoreEventsWithAttendees';
import heroesData from '../../data/heroes.json';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Custom Korean Calendar Locale Constants
const KR_MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const KR_DAYS = ['일', '월', '화', '수', '목', '금', '토'];

// Web-specific scrollbar styles
// Web-specific scrollbar styles
if (Platform.OS === 'web') {
    const style = document.createElement('style');
    style.textContent = `
        ::-webkit-scrollbar {
            width: 10px;
            background: transparent;
        }
        ::-webkit-scrollbar-track {
            background: transparent;
        }
        ::-webkit-scrollbar-thumb {
            background-color: #94a3b8;
            border-radius: 5px;
            border: 2px solid transparent;
            background-clip: content-box;
        }
        ::-webkit-scrollbar-thumb:hover {
            background-color: #cbd5e1;
        }
    `;
    document.head.appendChild(style);
}
import { WikiEvent, INITIAL_WIKI_EVENTS, EventCategory } from '../../data/wiki-events';
import { ADDITIONAL_EVENTS } from '../../data/new-events';
import { SUPER_ADMINS } from '../../data/admin-config';
import * as Notifications from 'expo-notifications';

const SINGLE_SLOT_IDS = [
    'a_center', 'alliance_center', 'p29_center',
    'a_champ', 'alliance_champion',
    'a_mercenary', 'alliance_mercenary',
    'a_immigrate', 'alliance_immigrate', 'server_immigrate',
    'a_trade', 'alliance_trade',
    'a_mobilization', 'alliance_mobilization',
    'a_merge', 'alliance_merge', 'server_merge',
    'a_svs', 'alliance_svs', 'server_svs_prep', 'server_svs_battle',
    'a_dragon', 'alliance_dragon', 'server_dragon',
    'a_joe', 'alliance_joe',
    'alliance_frost_league', 'a_weapon'
];

// Set notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const HERO_NAMES = heroesData.map(h => h.name);
const FORTRESS_OPTIONS = Array.from({ length: 12 }, (_, i) => `요새 ${i + 1}`);
const CITADEL_OPTIONS = Array.from({ length: 4 }, (_, i) => `성채 ${i + 1}`);

// Shimmer Icon Component with animated light sweep effect
const ShimmerIcon = memo(({ children, colors, isDark }: { children: React.ReactNode, colors: { bg: string, shadow: string, shimmer: string }, isDark: boolean }) => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = () => {
            shimmerAnim.setValue(0);
            Animated.timing(shimmerAnim, {
                toValue: 1,
                duration: 2000,
                useNativeDriver: false,
            }).start(() => animate());
        };
        animate();
    }, [shimmerAnim]);

    const translateX = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-40, 40],
    });

    return (
        <View className="relative overflow-hidden w-10 h-10 rounded-xl mr-3"
            style={{ shadowColor: colors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.4, shadowRadius: 6, elevation: 5 }}
        >
            <LinearGradient
                colors={isDark ? [colors.bg, colors.bg] : ['#ffffff', colors.bg]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="absolute inset-0 w-full h-full items-center justify-center"
            >
                {children}
            </LinearGradient>
            <Animated.View
                style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    width: 20,
                    transform: [{ translateX }],
                }}
            >
                <LinearGradient
                    colors={['transparent', colors.shimmer, 'transparent']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={{ flex: 1, opacity: 0.6 }}
                />
            </Animated.View>
        </View>
    );
});

const pad = (n: number | undefined | null) => (n ?? 0).toString().padStart(2, '0');

const getUTCString = (str: string) => {
    if (!str) return null;
    const match = str.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{1,2}:\d{2})/);
    if (!match) return null;
    const [_, y, m, d, timePart] = match;
    const [h, min] = timePart.split(':');
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min));
    if (isNaN(date.getTime())) return null;

    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = days[date.getUTCDay()];
    const year2 = date.getUTCFullYear().toString().slice(-2);
    return `${year2}년 ${pad(date.getUTCMonth() + 1)}월 ${pad(date.getUTCDate())}일(${dayName}) ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
};

const getUTCTimeString = (kstStr: string, includePrefix = true) => {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const fullMatch = kstStr.match(/([일월화수목금토])\s*\(?(\d{1,2}):(\d{2})\)?/);

    if (!fullMatch) return kstStr;

    const [_, dayName, timeStr] = fullMatch;
    const dayIdx = days.indexOf(dayName);
    const [h, m] = timeStr.split(':').map(Number);

    const matchIndex = fullMatch.index || 0;
    const prefix = matchIndex > 0 ? kstStr.substring(0, matchIndex).trim() + ' ' : '';

    let utcH = h - 9;
    let utcDayIdx = dayIdx;
    if (utcH < 0) {
        utcH += 24;
        utcDayIdx = (dayIdx - 1 + 7) % 7;
    }

    const formatted = `${days[utcDayIdx]}(${pad(utcH)}:${pad(m)})`;
    const finalStr = `${prefix}${formatted}`;
    return includePrefix ? `UTC: ${finalStr}` : finalStr;
};

const formatDisplayDate = (str: string, mode: 'KST' | 'UTC' = 'KST') => {
    if (!str) return '';
    const match = str.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{1,2}:\d{2})/);

    if (mode === 'UTC' && match) {
        const utc = getUTCString(str);
        return utc || str;
    }

    if (!match) {
        const weeklyMatch = str.match(/^(.*?)?\s*([일월화수목금토]|[매일])\s*\(?(\d{1,2}:\d{2})\)?/);
        if (weeklyMatch) {
            if (mode === 'UTC') {
                const utcWeekly = getUTCTimeString(str, false);
                return utcWeekly || str;
            }
            const prefix = weeklyMatch[1] ? weeklyMatch[1].trim() + ' ' : '';
            return `${prefix}${weeklyMatch[2]}(${weeklyMatch[3]})`;
        }
        return str;
    }
    const [_, y, m, d, timePart] = match;
    const [h, min] = timePart.split(':');
    const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = days[date.getDay()];
    const year2 = y.slice(-2);
    return `${year2}년 ${pad(parseInt(m))}월 ${pad(parseInt(d))}일(${dayName}) ${pad(parseInt(h))}:${pad(parseInt(min))}`;
};

const formatTime12h = (timeStr: string) => {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr || '0');
    const m = parseInt(mStr || '0');
    const isPM = h >= 12;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = isPM ? '오후' : '오전';
    return `${ampm} ${h12}:${m.toString().padStart(2, '0')}`;
};

interface EventCardProps {
    event: WikiEvent;
    isDark: boolean;
    timezone: 'KST' | 'UTC';
    auth: any;
    isAdmin: boolean;
    isOngoing: boolean;
    isExpired: boolean;
    selectedTeamTab: number;
    checkItemOngoing: (str: string) => boolean;
    openScheduleModal: (event: WikiEvent) => void;
    openGuideModal: (event: WikiEvent) => void;
    openAttendeeModal: (event: WikiEvent) => void;
    openWikiLink: (url: string) => void;
    onSetSelectedTeamTab: (idx: number) => void;
    onLayout: (y: number) => void;
}

const EventCard = memo(({
    event, isDark, timezone, auth, isAdmin, isOngoing, isExpired, selectedTeamTab,
    checkItemOngoing, openScheduleModal, openGuideModal, openAttendeeModal, openWikiLink,
    onSetSelectedTeamTab, onLayout
}: EventCardProps) => {
    const isUpcoming = !isOngoing && !isExpired;
    const textColor = isExpired ? (isDark ? 'text-slate-600' : 'text-slate-400') : (isUpcoming ? (isDark ? 'text-slate-400' : 'text-slate-500') : (isDark ? 'text-white' : 'text-slate-900'));

    const renderStartEndPeriod = (str: string, textClass: string, isUtc = false) => {
        if (!str.includes('~')) return (
            <View className="flex-row items-center">
                <ShimmerIcon isDark={isDark} colors={{ bg: isDark ? '#1e3a5f' : '#dbeafe', shadow: isDark ? '#38bdf8' : '#0284c7', shimmer: isDark ? '#38bdf8' : '#60a5fa' }}>
                    <Ionicons name="calendar" size={20} color={isDark ? '#38bdf8' : '#0284c7'} />
                </ShimmerIcon>
                <Text className={`${textClass} text-base font-medium`}>{isUtc ? str : formatDisplayDate(str)}</Text>
            </View>
        );
        const parts = str.split('~').map(s => s.trim());
        return (
            <View className="gap-3">
                <View className="flex-row items-center">
                    <View className={`px-2.5 py-1 rounded-lg border mr-3 items-center justify-center ${isDark ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-200'}`}>
                        <Text className={`text-[11px] font-bold ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>시작</Text>
                    </View>
                    <Text className={`${textClass} text-base font-medium`}>{isUtc ? parts[0] : formatDisplayDate(parts[0])}</Text>
                </View>
                <View className="flex-row items-center">
                    <View className={`px-2.5 py-1 rounded-lg border mr-3 items-center justify-center ${isDark ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-200'}`}>
                        <Text className={`text-[11px] font-bold ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>종료</Text>
                    </View>
                    <Text className={`${textClass} text-base font-medium`}>{isUtc ? parts[1] : formatDisplayDate(parts[1])}</Text>
                </View>
            </View>
        );
    };

    return (
        <View
            className={`w-full sm:w-1/2 p-2`}
            onLayout={(e) => onLayout(e.nativeEvent.layout.y)}
        >
            <Pressable
                style={({ hovered }: any) => [
                    {
                        height: '100%',
                        transform: [{ scale: hovered ? 1.02 : 1 }],
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        zIndex: hovered ? 10 : 1,
                        shadowColor: '#3b82f6',
                        shadowOffset: { width: 0, height: hovered ? 12 : 4 },
                        shadowOpacity: hovered ? 0.3 : 0,
                        shadowRadius: hovered ? 16 : 4,
                        elevation: hovered ? 10 : 0
                    }
                ]}
                className={`rounded-3xl border shadow-lg transition-all ${isOngoing ? (isDark ? 'bg-slate-900 border-blue-500/40 shadow-blue-500/10' : 'bg-white border-blue-200 shadow-blue-200/30') : (isUpcoming ? (isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-slate-200/40') : (isDark ? 'bg-slate-900/60 border-slate-800/40' : 'bg-slate-50/80 border-slate-100'))}`}
            >
                <View className={`px-4 py-3 flex-col border-b ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                    <View className="flex-row items-center mb-2">
                        {event.imageUrl ? (
                            <View className={`w-10 h-10 rounded-xl border overflow-hidden mr-3 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-slate-50'}`}>
                                <Image source={typeof event.imageUrl === 'string' ? { uri: event.imageUrl } : event.imageUrl} className="w-full h-full" resizeMode="cover" />
                            </View>
                        ) : (
                            <View className={`w-10 h-10 rounded-xl items-center justify-center border mr-3 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                <Ionicons name="calendar-outline" size={18} color={isDark ? '#475569' : '#94a3b8'} />
                            </View>
                        )}
                        <Text className={`text-lg font-black flex-1 ${textColor} ${isExpired ? 'line-through' : ''}`} numberOfLines={1}>{event.title}</Text>
                    </View>
                    <View className="flex-row items-center flex-wrap gap-1.5">
                        <View className={`flex-row items-center px-2 py-0.5 rounded-md border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <Ionicons name={event.category === '연맹' ? 'flag-outline' : event.category === '개인' ? 'person-outline' : event.category === '서버' ? 'earth-outline' : event.category === '초보자' ? 'star-outline' : 'apps-outline'} size={10} color={isDark ? '#94a3b8' : '#64748b'} />
                            <Text className={`text-[9px] font-bold ml-1 uppercase ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{event.category}</Text>
                        </View>
                        {isOngoing ? (
                            <View className="bg-[#00ff88] px-2.5 py-1 rounded-full flex-row items-center border border-[#00cc6a] shadow-[0_0_15px_rgba(0,255,136,0.6)]" style={{ shadowColor: '#00ff88', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8, elevation: 5 }}>
                                <Ionicons name="flash" size={10} color="#0f172a" style={{ marginRight: 2 }} />
                                <Text className="text-slate-900 text-[10px] font-black ml-0.5" style={{ textShadowColor: 'rgba(255, 255, 255, 0.5)', textShadowRadius: 2 }}>진행중</Text>
                            </View>
                        ) : isExpired ? (
                            <View className="bg-slate-500 px-2 py-0.5 rounded-md flex-row items-center">
                                <Ionicons name="checkmark-circle" size={9} color="white" />
                                <Text className="text-white text-[8px] font-black ml-0.5">종료</Text>
                            </View>
                        ) : (
                            <View className="bg-emerald-600 px-2 py-0.5 rounded-md flex-row items-center">
                                <Ionicons name="time" size={9} color="white" />
                                <Text className="text-white text-[8px] font-black ml-0.5">예정</Text>
                            </View>
                        )}
                        {isAdmin && (
                            <ShimmerScheduleButton onPress={() => openScheduleModal(event)} isDark={isDark} />
                        )}
                    </View>
                </View>
                <View className="p-4 flex-1 justify-between">
                    <View className="mb-4">
                        {(!event.day && !event.time) ? (
                            <View className={`w-full py-6 border border-dashed rounded-2xl items-center justify-center ${isDark ? 'border-slate-800 bg-slate-900/40' : 'bg-slate-50 border-slate-100'}`}>
                                <Text className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>등록된 일정이 없습니다</Text>
                            </View>
                        ) : (
                            event.day && !event.time && event.day !== '상설' && event.day !== '상시' ? (
                                <View className={`w-full rounded-2xl border overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <View className={`${isDark ? 'bg-black/20' : 'bg-white'}`}>
                                        {event.day.split('/').map((d, dIdx) => {
                                            const cleanD = d.trim();
                                            const formattedDay = cleanD.replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                            let utcText = '';
                                            if (cleanD.includes('~')) {
                                                const parts = cleanD.split('~').map(x => x.trim());
                                                const sDateUtc = getUTCString(parts[0]);
                                                const eDateUtc = getUTCString(parts[1]);
                                                if (sDateUtc && eDateUtc) utcText = `${sDateUtc}~${eDateUtc}`;
                                                else {
                                                    const sWeeklyUtc = getUTCTimeString(parts[0], false);
                                                    const eWeeklyUtc = getUTCTimeString(parts[1], false);
                                                    if (sWeeklyUtc && eWeeklyUtc) utcText = `${sWeeklyUtc}~${eWeeklyUtc}`;
                                                }
                                            } else {
                                                const dateUtc = getUTCString(cleanD);
                                                if (dateUtc) utcText = dateUtc;
                                                else {
                                                    const weeklyUtc = getUTCTimeString(cleanD);
                                                    if (weeklyUtc) utcText = weeklyUtc;
                                                }
                                            }
                                            return (
                                                <View key={dIdx} className={`px-4 py-3 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'} last:border-0`}>
                                                    {timezone === 'KST' ? renderStartEndPeriod(formattedDay, `${isExpired ? (isDark ? 'text-slate-600' : 'text-slate-400') : (isDark ? 'text-slate-100' : 'text-slate-800')} ${isExpired ? 'line-through' : ''}`) : (!!utcText ? renderStartEndPeriod(utcText, `${isExpired ? (isDark ? 'text-slate-600' : 'text-slate-400') : (isDark ? 'text-slate-100' : 'text-slate-800')} ${isExpired ? 'line-through' : ''}`, true) : null)}
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            ) : null
                        )}
                        {event.time && (() => {
                            const isBearOrFoundry = event.id === 'a_bear' || event.id === 'alliance_bear' || event.id === 'a_foundry' || event.id === 'alliance_foundry';
                            const parts = event.time.split(' / ').filter((p: string) => p.trim());
                            const hasMultipleParts = parts.length > 1;
                            const selectedTab = selectedTeamTab || 0;
                            if (isBearOrFoundry && hasMultipleParts) {
                                const getTabLabel = (part: string, idx: number) => {
                                    const trimmed = part.trim();
                                    const colonIdx = trimmed.indexOf(':');
                                    const isTimeColon = colonIdx > 0 && /\d/.test(trimmed[colonIdx - 1]) && /\d/.test(trimmed[colonIdx + 1]);
                                    if (colonIdx > -1 && !isTimeColon) return trimmed.substring(0, colonIdx).trim();
                                    return `${idx + 1}군`;
                                };
                                const selectedContent = ((part: string | undefined) => {
                                    if (!part) return "";
                                    const trimmed = part.trim();
                                    const colonIdx = trimmed.indexOf(':');
                                    const isTimeColon = colonIdx > 0 && /\d/.test(trimmed[colonIdx - 1]) && /\d/.test(trimmed[colonIdx + 1]);
                                    if (colonIdx > -1 && !isTimeColon) return trimmed.substring(colonIdx + 1).trim();
                                    return trimmed;
                                })(parts[selectedTab]);
                                return (
                                    <View className="w-full gap-3">
                                        <View className="flex-row gap-2">
                                            {parts.map((p: string, idx: number) => (
                                                <Pressable
                                                    key={idx}
                                                    onPress={() => onSetSelectedTeamTab(idx)}
                                                    className={`flex-1 py-2.5 rounded-xl items-center justify-center transition-all ${idx === selectedTab ? 'bg-blue-600' : (isDark ? 'bg-slate-800/60' : 'bg-slate-100')}`}
                                                    style={({ pressed, hovered }: any) => [
                                                        {
                                                            transform: [{ scale: pressed ? 0.98 : (hovered ? 1.02 : 1) }],
                                                            cursor: 'pointer'
                                                        }
                                                    ]}
                                                >
                                                    <Text className={`text-xs font-bold ${idx === selectedTab ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-600')}`}>{getTabLabel(p, idx)}</Text>
                                                </Pressable>
                                            ))}
                                        </View>
                                        <View className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-black/20 border-slate-800/60' : 'bg-slate-50 border-slate-100 shadow-sm'}`}>
                                            <View className="flex-col">
                                                {selectedContent ? selectedContent.split(/[,|]/).map((item: string, iIdx: number) => {
                                                    const trimmedItem = item.trim();
                                                    const formatted = trimmedItem.replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                                    const isSlotOngoing = checkItemOngoing(trimmedItem);
                                                    return (
                                                        <View key={iIdx} className={`px-4 py-3 border-b flex-row items-center justify-between ${isDark ? 'border-slate-800/40' : 'border-slate-100'} last:border-0 ${isSlotOngoing ? (isDark ? 'bg-blue-600/20' : 'bg-blue-50') : ''}`}>
                                                            <View className="flex-row items-center flex-1">
                                                                {(() => {
                                                                    const displayStr = formatDisplayDate(formatted, timezone);
                                                                    // Check for Day(Time) format
                                                                    const dtMatch = displayStr.match(/([일월화수목금토매일])\s*\(?(\d{1,2}:\d{2})\)?/);

                                                                    if (dtMatch) {
                                                                        const [_, d, t] = dtMatch;
                                                                        return (
                                                                            <View className="flex-row items-center">
                                                                                <Ionicons name="calendar-outline" size={14} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginRight: 4 }} />
                                                                                <Text className={`${isDark ? 'text-slate-100' : 'text-slate-800'} font-bold text-base ${isExpired ? 'line-through opacity-40' : ''}`}>{d}</Text>
                                                                                <Text className={`mx-2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>·</Text>
                                                                                <Ionicons name="time-outline" size={14} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginRight: 4 }} />
                                                                                <Text className={`${isDark ? 'text-blue-400' : 'text-blue-600'} font-bold text-base ${isExpired ? 'line-through opacity-40' : ''}`}>{t}</Text>
                                                                            </View>
                                                                        );
                                                                    }

                                                                    // Default Fallback
                                                                    return <Text className={`${isDark ? 'text-slate-100' : 'text-slate-800'} font-bold text-base ${isExpired ? 'line-through opacity-40' : ''}`}>{displayStr}</Text>;
                                                                })()}
                                                            </View>
                                                            {isSlotOngoing && (
                                                                <View className="bg-[#00ff88] px-2 py-0.5 rounded-full flex-row items-center ml-2 border border-[#00cc6a] shadow-[0_0_10px_rgba(0,255,136,0.5)]" style={{ shadowColor: '#00ff88', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 3 }}>
                                                                    <Ionicons name="flash" size={8} color="#0f172a" style={{ marginRight: 2 }} />
                                                                    <Text className="text-slate-900 text-[9px] font-black ml-0.5">진행중</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                    );
                                                }) : (
                                                    <View className="px-4 py-8 items-center justify-center">
                                                        <Text className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>등록된 일정이 없습니다</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                );
                            }
                            return (
                                <View className="w-full gap-3">
                                    {parts.map((part: string, idx: number) => {
                                        const trimmed = part.trim();
                                        if (!trimmed) return null;
                                        const colonIdx = trimmed.indexOf(':');
                                        const isTimeColon = colonIdx > 0 && /\d/.test(trimmed[colonIdx - 1]) && /\d/.test(trimmed[colonIdx + 1]);
                                        const rawLabel = (colonIdx > -1 && !isTimeColon) ? trimmed.substring(0, colonIdx).trim() : '';
                                        const content = rawLabel ? trimmed.substring(colonIdx + 1).trim() : trimmed;
                                        if (content === "." || !content) return null;
                                        return (
                                            <View key={idx} className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-black/20 border-slate-800/60' : 'bg-slate-50 border-slate-100 shadow-sm'}`}>
                                                {!!rawLabel && (
                                                    <View className={`px-4 py-2 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                                                        <Text className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>{rawLabel}</Text>
                                                    </View>
                                                )}
                                                <View className="flex-col">
                                                    {content.split(/[,|]/).map((item: string, iIdx: number) => {
                                                        const trimmedItem = item.trim();
                                                        const formatted = trimmedItem.replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                                        const isSlotOngoing = checkItemOngoing(trimmedItem);
                                                        return (
                                                            <View key={iIdx} className={`px-4 py-3 border-b flex-row items-center justify-between ${isDark ? 'border-slate-800/40' : 'border-slate-100'} last:border-0 ${isSlotOngoing ? (isDark ? 'bg-blue-600/20' : 'bg-blue-50') : ''}`}>
                                                                <View className="flex-row items-center flex-1">
                                                                    {(() => {
                                                                        const displayStr = formatDisplayDate(formatted, timezone);
                                                                        // Check for Day(Time) format
                                                                        const dtMatch = displayStr.match(/([일월화수목금토매일])\s*\(?(\d{1,2}:\d{2})\)?/);

                                                                        if (dtMatch) {
                                                                            const [_, d, t] = dtMatch;
                                                                            return (
                                                                                <View className="flex-row items-center">
                                                                                    <Ionicons name="calendar-outline" size={14} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginRight: 4 }} />
                                                                                    <Text className={`${isDark ? 'text-slate-100' : 'text-slate-800'} font-bold text-base ${isExpired ? 'line-through opacity-40' : ''}`}>{d}</Text>
                                                                                    <Text className={`mx-2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>·</Text>
                                                                                    <Ionicons name="time-outline" size={14} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginRight: 4 }} />
                                                                                    <Text className={`${isDark ? 'text-blue-400' : 'text-blue-600'} font-bold text-base ${isExpired ? 'line-through opacity-40' : ''}`}>{t}</Text>
                                                                                </View>
                                                                            );
                                                                        }

                                                                        // Default Fallback
                                                                        return <Text className={`${isDark ? 'text-slate-100' : 'text-slate-800'} font-bold text-base ${isExpired ? 'line-through opacity-40' : ''}`}>{displayStr}</Text>;
                                                                    })()}
                                                                </View>
                                                                {isSlotOngoing && (
                                                                    <View className="bg-[#00ff88] px-2 py-0.5 rounded-full flex-row items-center ml-2 border border-[#00cc6a] shadow-[0_0_10px_rgba(0,255,136,0.5)]" style={{ shadowColor: '#00ff88', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 3 }}>
                                                                        <Ionicons name="flash" size={8} color="#0f172a" style={{ marginRight: 2 }} />
                                                                        <Text className="text-slate-900 text-[9px] font-black ml-0.5">진행중</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            );
                        })()}
                    </View>
                    <View className="flex-row gap-3 mt-6">
                        <Pressable
                            onPress={() => openGuideModal(event)}
                            className={`flex-1 py-3.5 rounded-2xl flex-row items-center justify-center border transition-all ${isDark ? 'bg-slate-800/40 border-slate-700/50 hover:bg-blue-500 hover:border-blue-400' : 'bg-white border-slate-200 shadow-sm hover:bg-blue-600 hover:border-blue-700'}`}
                            style={({ pressed, hovered }: any) => [
                                {
                                    transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                    // @ts-ignore
                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    shadowColor: hovered ? (isDark ? '#38bdf8' : '#2563eb') : '#000',
                                    shadowOffset: { width: 0, height: hovered ? 8 : 2 },
                                    shadowOpacity: hovered ? 0.4 : 0.1,
                                    shadowRadius: hovered ? 16 : 4,
                                    elevation: hovered ? 8 : 2,
                                    cursor: 'pointer',
                                }
                            ]}
                        >
                            {({ hovered }: any) => (
                                <>
                                    <Ionicons name="book-outline" size={16} color={hovered ? '#fff' : (isDark ? '#e2e8f0' : '#475569')} style={{ marginRight: 6 }} />
                                    <Text className={`font-black text-sm transition-all ${hovered ? 'text-white' : (isDark ? 'text-slate-200' : 'text-slate-700')}`}>{event.category === '연맹' ? '공략' : 'Guide'}</Text>
                                </>
                            )}
                        </Pressable>
                        {(event.category === '연맹' || event.category === '서버') && (
                            <Pressable
                                onPress={() => openAttendeeModal(event)}
                                className={`flex-1 py-3.5 rounded-2xl flex-row items-center justify-center border transition-all ${isDark ? 'bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500 hover:border-emerald-400' : 'bg-emerald-50 border-emerald-100 shadow-sm hover:bg-emerald-600 hover:border-emerald-700'}`}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                        // @ts-ignore
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        shadowColor: '#10b981',
                                        shadowOffset: { width: 0, height: hovered ? 8 : 2 },
                                        shadowOpacity: hovered ? 0.4 : 0.1,
                                        shadowRadius: hovered ? 16 : 4,
                                        elevation: hovered ? 8 : 2,
                                        cursor: 'pointer',
                                    }
                                ]}
                            >
                                {({ hovered }: any) => (
                                    <>
                                        <Ionicons name="people-outline" size={16} color={hovered ? '#fff' : (isDark ? '#34d399' : '#059669')} style={{ marginRight: 6 }} />
                                        <Text className={`font-black text-sm transition-all ${hovered ? 'text-white' : (isDark ? 'text-emerald-400' : 'text-emerald-700')}`}>참석</Text>
                                    </>
                                )}
                            </Pressable>
                        )}
                        {event.wikiUrl && (
                            <Pressable
                                onPress={() => openWikiLink(event.wikiUrl || '')}
                                className={`w-12 h-12 rounded-2xl items-center justify-center border transition-all ${isDark ? 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-700 hover:border-slate-600' : 'bg-white border-slate-200 shadow-sm hover:bg-slate-100 hover:border-slate-300'}`}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.15 : 1) }],
                                        // @ts-ignore
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        shadowColor: '#000',
                                        shadowOffset: { width: 0, height: hovered ? 6 : 2 },
                                        shadowOpacity: hovered ? 0.3 : 0.1,
                                        shadowRadius: hovered ? 12 : 4,
                                        elevation: hovered ? 6 : 2,
                                        cursor: 'pointer',
                                    }
                                ]}
                            >
                                {({ hovered }: any) => (
                                    <View style={{ opacity: hovered ? 1 : 0.7 }}>
                                        <Image source={{ uri: 'https://cdn-icons-png.flaticon.com/512/3670/3670357.png' }} className={`w-5 h-5 ${hovered ? '' : 'grayscale'}`} />
                                    </View>
                                )}
                            </Pressable>
                        )}
                    </View>
                </View>
            </Pressable>
        </View>
    );
});

// Shimmer Schedule Button Component (for admin schedule button)
const ShimmerScheduleButton = memo(({ onPress, isDark }: { onPress: () => void, isDark: boolean }) => {
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animate = () => {
            shimmerAnim.setValue(0);
            Animated.timing(shimmerAnim, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: false,
            }).start(() => animate());
        };
        animate();
    }, [shimmerAnim]);

    const shimmerTranslate = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-60, 60],
    });

    const pulseOpacity = shimmerAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.9, 1, 0.9],
    });

    return (
        <Pressable onPress={onPress} className="ml-auto"
            style={({ pressed, hovered }: any) => [
                {
                    transform: [{ scale: pressed ? 0.95 : (hovered ? 1.08 : 1) }],
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    shadowColor: hovered ? (isDark ? '#818cf8' : '#6366f1') : 'transparent',
                    shadowOffset: { width: 0, height: hovered ? 4 : 0 },
                    shadowOpacity: hovered ? 0.6 : 0,
                    shadowRadius: hovered ? 12 : 0,
                    elevation: hovered ? 6 : 0,
                }
            ]}
        >
            <Animated.View
                style={{ opacity: pulseOpacity }}
                className="relative overflow-hidden px-3 py-1.5 rounded-xl flex-row items-center justify-center shadow-sm"
            >
                <LinearGradient
                    colors={isDark ? ['#7c3aed', '#4f46e5'] : ['#a78bfa', '#818cf8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="absolute inset-0 w-full h-full"
                    style={{ borderRadius: 12 }}
                />
                <View className="flex-row items-center justify-center relative z-10">
                    <Ionicons name="calendar" size={12} color="white" style={{ marginRight: 4 }} />
                    <Text className="text-white text-[10px] font-bold">시간 설정</Text>
                </View>
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        width: 20,
                        transform: [{ translateX: shimmerTranslate }],
                        zIndex: 20
                    }}
                >
                    <LinearGradient
                        colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={{ flex: 1 }}
                    />
                </Animated.View>
            </Animated.View>
        </Pressable>
    );
});

// Mini Hero Picker Component
const HeroPicker = memo(({ value, onSelect, label }: { value: string, onSelect: (v: string) => void, label: string }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [showDropdown, setShowDropdown] = useState(false);
    const [search, setSearch] = useState(value);

    const filteredHeroes = useMemo(() => HERO_NAMES.filter(name =>
        name.toLowerCase().includes(search.toLowerCase())
    ), [search]);

    useEffect(() => {
        if (value !== search) {
            setSearch(value);
        }
    }, [value]);

    return (
        <View className="flex-1 relative" style={{ zIndex: showDropdown ? 60 : 1 }}>
            <Text className={`text-[9px] font-bold mb-1.5 ml-1 uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{label}</Text>
            <TextInput
                placeholder={label === 'HERO 1' ? '영웅 1' : label === 'HERO 2' ? '영웅 2' : '영웅 3'}
                placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                value={search}
                onChangeText={(v) => {
                    setSearch(v);
                    onSelect(v);
                    setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                className={`p-3 rounded-xl text-xs font-semibold border ${isDark ? 'bg-slate-900/40 text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200 shadow-sm'}`}
            />
            {showDropdown && filteredHeroes.length > 0 && (
                <View
                    style={{ zIndex: 9999, elevation: 9999, minHeight: 160 }}
                    className={`absolute top-16 left-0 right-0 border rounded-xl max-h-80 shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true} className="flex-1">
                        {filteredHeroes.map((name) => (
                            <TouchableOpacity
                                key={name}
                                onPress={() => {
                                    onSelect(name);
                                    setSearch(name);
                                    setShowDropdown(false);
                                }}
                                className={`p-3 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-100'}`}
                            >
                                <Text className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
});

const OptionPicker = memo(({ value, options, onSelect, label, isDark, direction = 'down', isOpen, onToggle }: { value: string, options: string[], onSelect: (v: string) => void, label: string, isDark: boolean, direction?: 'up' | 'down', isOpen?: boolean, onToggle?: (v: boolean) => void }) => {
    const [internalShow, setInternalShow] = useState(false);
    const show = isOpen !== undefined ? isOpen : internalShow;
    const setShow = (v: boolean) => {
        if (onToggle) onToggle(v);
        setInternalShow(v);
    };

    return (
        <View className="relative w-44" style={{ zIndex: show ? 100 : 1 }}>
            <TouchableOpacity
                onPress={() => setShow(!show)}
                className={`p-3 rounded-xl border flex-row justify-between items-center ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}
            >
                <Text className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>{value || label}</Text>
                <Ionicons name={show ? "chevron-up-outline" : "chevron-down-outline"} size={14} color="#64748b" />
            </TouchableOpacity>
            {show && (
                <View
                    style={{ zIndex: 9999, elevation: 9999, minHeight: 160 }}
                    className={`absolute ${direction === 'up' ? 'bottom-16' : 'top-14'} left-0 right-0 border rounded-[20px] max-h-64 shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true} className="flex-1">
                        {options.map(opt => (
                            <TouchableOpacity
                                key={opt}
                                onPress={() => { onSelect(opt); setShow(false); }}
                                className={`p-3 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-100'} ${value === opt ? (isDark ? 'bg-sky-500/20' : 'bg-sky-50') : ''}`}
                            >
                                <Text className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

        </View>
    );
});

// Member Picker for Attendance
const MemberPicker = memo(({ value, onSelect, members, isAdmin, setOverlayContent }: { value: string, onSelect: (v: string) => void, members: any[], isAdmin: boolean, setOverlayContent: (node: React.ReactNode | null) => void }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [search, setSearch] = useState(value);
    const containerRef = useRef<View>(null);
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (value !== search) {
            setSearch(value);
        }
    }, [value]);

    const filteredMembers = useMemo(() => members.filter(m =>
        m.nickname.toLowerCase().includes(search.toLowerCase()) ||
        m.id.toLowerCase().includes(search.toLowerCase())
    ), [members, search]);

    const updateOverlay = useCallback(() => {
        if (!isAdmin || !isFocused || filteredMembers.length === 0) {
            setOverlayContent(null);
            return;
        }

        containerRef.current?.measure((x, y, width, height, pageX, pageY) => {
            const dropdownHeight = Math.min(filteredMembers.length * 48, 300); // Max height approx 6 items
            const screenHeight = Dimensions.get('window').height;
            const spaceBelow = screenHeight - (pageY + height);
            const showUp = spaceBelow < dropdownHeight && pageY > dropdownHeight;

            // Adjust position based on showUp
            const topPos = showUp ? (pageY - dropdownHeight - 4) : (pageY + height + 4);

            setOverlayContent(
                <View
                    style={{
                        position: 'absolute',
                        top: topPos,
                        left: pageX,
                        width: width,
                        height: dropdownHeight,
                        zIndex: 99999,
                        elevation: 100,
                    }}
                    className={`border rounded-xl shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true} className="flex-1">
                        {filteredMembers.map((m) => (
                            <TouchableOpacity
                                key={m.id}
                                onPress={() => {
                                    onSelect(m.nickname);
                                    setSearch(m.nickname);
                                    setOverlayContent(null);
                                    setIsFocused(false);
                                }}
                                className={`p-3 border-b flex-row justify-between items-center ${isDark ? 'border-slate-700/50' : 'border-slate-100'}`}
                            >
                                <View>
                                    <Text className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{m.nickname}</Text>
                                    <Text className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>ID: {m.id}</Text>
                                </View>
                                <Ionicons name="add-circle-outline" size={16} color="#38bdf8" />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            );
        });
    }, [isAdmin, isFocused, filteredMembers, isDark, onSelect, setOverlayContent]);

    useEffect(() => {
        updateOverlay();
    }, [updateOverlay]);

    return (
        <View ref={containerRef} className="flex-1 relative" style={{ zIndex: 1 }}>
            <TextInput
                placeholder="영주 이름 선택/입력"
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                value={search}
                onChangeText={(v) => {
                    setSearch(v);
                    onSelect(v);
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                    // Delay to allow item press
                    setTimeout(() => {
                        setIsFocused(false);
                        setOverlayContent(null);
                    }, 200);
                }}
                editable={isAdmin}
                className={`p-3 rounded-xl font-semibold border ${isDark ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-slate-800 border-slate-200 shadow-sm'} ${!isAdmin ? 'opacity-70' : ''}`}
            />
        </View>
    );
});
const RenderDateSelector = memo(({ label, value, onChange, type, activeDateDropdown, setActiveDateDropdown, isDark, setShowDatePicker }: {
    label: string,
    value: string,
    onChange: (v: string) => void,
    type: 'start' | 'end',
    activeDateDropdown: { type: 'start' | 'end', field: 'y' | 'm' | 'd' | 'h' | 'min' } | null,
    setActiveDateDropdown: (v: any) => void,
    isDark: boolean,
    setShowDatePicker: (v: 'start' | 'end' | null) => void
}) => {
    const parts = value ? value.split(' ') : [];
    const datePart = parts[0] || ''; // YYYY.MM.DD
    const timePart = parts[1] || '';
    const [h, m] = timePart ? timePart.split(':') : ['00', '00'];

    return (
        <View className="mb-4" style={{ zIndex: activeDateDropdown?.type === type ? 10000 : 1, elevation: activeDateDropdown?.type === type ? 50 : 0, overflow: 'visible' }}>
            <Text className="text-brand-accent text-xs font-bold mb-2 ml-1 uppercase">{label}</Text>
            <View className="flex-row" style={{ overflow: 'visible', zIndex: activeDateDropdown?.type === type ? 10001 : 1 }}>
                <View style={{ flex: 1.7, marginRight: 15 }}>
                    <TouchableOpacity
                        onPress={() => setShowDatePicker(type)}
                        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} p-2.5 rounded-2xl border flex-row justify-between items-center`}
                    >
                        <View className="flex-row items-center flex-1">
                            <Ionicons name="calendar-outline" size={14} color="#38bdf8" style={{ marginRight: 6 }} />
                            <Text className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-800'} flex-1`} numberOfLines={1} adjustsFontSizeToFit>
                                {datePart ? (formatDisplayDate(value).split(') ')[0] + ')').replace(/^20/, '').replace(/년\s*/, '.').replace(/월\s*/, '.').replace(/일/, '') : '날짜 선택'}
                            </Text>
                        </View>
                        <Ionicons name="chevron-down" size={12} color="#64748b" />
                    </TouchableOpacity>
                </View>



                <View style={{ flex: 0.9, marginRight: 8, zIndex: (activeDateDropdown?.type === type && activeDateDropdown?.field === 'h') ? 20000 : 1, overflow: 'visible' }}>
                    <TouchableOpacity
                        onPress={() => setActiveDateDropdown(activeDateDropdown?.type === type && activeDateDropdown?.field === 'h' ? null : { type, field: 'h' })}
                        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} p-2.5 rounded-2xl border flex-row justify-between items-center`}
                    >
                        <View className="flex-row items-center">
                            <Ionicons name="time-outline" size={14} color="#38bdf8" style={{ marginRight: 6 }} />
                            <Text className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-800'}`}>{h}시</Text>
                        </View>
                        <Ionicons name={activeDateDropdown?.type === type && activeDateDropdown?.field === 'h' ? "chevron-up" : "chevron-down"} size={12} color="#64748b" />
                    </TouchableOpacity>
                    {activeDateDropdown?.type === type && activeDateDropdown.field === 'h' && (
                        <View className={`absolute ${type === 'end' ? 'bottom-[60px]' : 'top-[60px]'} left-0 right-0 bg-slate-800 rounded-2xl border border-slate-700 h-40 overflow-hidden shadow-2xl z-[50000] elevation-25`}>
                            <FlatList
                                data={Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))}
                                renderItem={({ item: hour }) => (
                                    <TouchableOpacity
                                        onPress={() => { onChange(`${datePart} ${hour}:${m}`); setActiveDateDropdown(null); }}
                                        className={`h-10 items-center justify-center border-b border-white/5 ${h === hour ? 'bg-sky-500/20' : ''}`}
                                    >
                                        <Text className={`font-bold text-sm ${h === hour ? 'text-sky-400' : 'text-slate-400'}`}>{hour}시</Text>
                                    </TouchableOpacity>
                                )}
                                keyExtractor={item => item}
                            />
                        </View>
                    )}
                </View>

                <View style={{ flex: 0.9, zIndex: (activeDateDropdown?.type === type && activeDateDropdown?.field === 'min') ? 20000 : 1, overflow: 'visible' }}>
                    <TouchableOpacity
                        onPress={() => setActiveDateDropdown(activeDateDropdown?.type === type && activeDateDropdown?.field === 'min' ? null : { type, field: 'min' })}
                        className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} p-2.5 rounded-2xl border flex-row justify-between items-center`}
                    >
                        <View className="flex-row items-center">
                            <Ionicons name="time-outline" size={14} color="#38bdf8" style={{ marginRight: 6 }} />
                            <Text className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-800'}`}>{m}분</Text>
                        </View>
                        <Ionicons name={activeDateDropdown?.type === type && activeDateDropdown?.field === 'min' ? "chevron-up" : "chevron-down"} size={12} color="#64748b" />
                    </TouchableOpacity>
                    {activeDateDropdown?.type === type && activeDateDropdown.field === 'min' && (
                        <View className={`absolute ${type === 'end' ? 'bottom-[60px]' : 'top-[60px]'} left-0 right-0 bg-slate-800 rounded-2xl border border-slate-700 h-40 overflow-hidden shadow-2xl z-[50000] elevation-25`}>
                            <FlatList
                                data={['00', '15', '30', '45']}
                                renderItem={({ item: min }) => (
                                    <TouchableOpacity
                                        onPress={() => { onChange(`${datePart} ${h}:${min}`); setActiveDateDropdown(null); }}
                                        className={`h-10 items-center justify-center border-b border-white/5 ${m === min ? 'bg-sky-500/20' : ''}`}
                                    >
                                        <Text className={`font-bold text-sm ${m === min ? 'text-sky-400' : 'text-slate-400'}`}>{min}분</Text>
                                    </TouchableOpacity>
                                )}
                                keyExtractor={item => item}
                            />
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
});

export default function EventTracker() {
    const { width } = useWindowDimensions();
    const isDesktop = width > 768; // Simple breakdown for Desktop layout

    const [selectedCategory, setSelectedCategory] = useState<EventCategory>('전체');
    const [timezone, setTimezone] = useState<'KST' | 'UTC'>('KST');
    const [events, setEvents] = useState<WikiEvent[]>([...INITIAL_WIKI_EVENTS, ...ADDITIONAL_EVENTS].map(e => ({ ...e, day: '', time: '' })));
    const { auth } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';
    const [serverId, setServerId] = useState<string | null>(undefined as any);
    const [allianceId, setAllianceId] = useState<string | null>(undefined as any);

    const [penaltyTarget, setPenaltyTarget] = useState<{ id: string, name: string } | null>(null);
    const [overlayContent, setOverlayContent] = useState<React.ReactNode | null>(null);

    const { dynamicAdmins } = useFirestoreAdmins(serverId, allianceId);
    const { schedules, loading: schedulesLoading, updateSchedule } = useFirestoreEventSchedules(serverId, allianceId);
    const { members } = useFirestoreMembers(serverId, allianceId);
    const { eventsWithAttendees } = useFirestoreEventsWithAttendees(serverId, allianceId);

    const router = useRouter();
    const params = useLocalSearchParams();

    useEffect(() => {
        const loadIds = async () => {
            const s = await AsyncStorage.getItem('serverId');
            const a = await AsyncStorage.getItem('allianceId');
            setServerId(s);
            setAllianceId(a);
        };
        loadIds();
    }, []);

    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Refs for scrolling
    const scrollViewRef = useRef<ScrollView>(null);
    const itemLayouts = useRef<{ [key: string]: number }>({});
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const hourScrollRef = useRef<ScrollView>(null);
    const minuteScrollRef = useRef<ScrollView>(null);
    const [fortressList, setFortressList] = useState<{ id: string, name: string, day?: string, h: string, m: string }[]>([]);
    const [citadelList, setCitadelList] = useState<{ id: string, name: string, day?: string, h: string, m: string }[]>([]);
    // Track selected team tab for bear/foundry events (eventId -> tab index)
    const [selectedTeamTabs, setSelectedTeamTabs] = useState<{ [eventId: string]: number }>({});
    const [activeNamePickerId, setActiveNamePickerId] = useState<string | null>(null);

    // Firebase Event Schedules removed from here (moved up)

    const isSaving = useRef(false);

    // Merge Firebase schedules with initial events
    useEffect(() => {
        if (!schedulesLoading && !isSaving.current) {
            const mergedEvents = [...INITIAL_WIKI_EVENTS, ...ADDITIONAL_EVENTS].map(event => {
                // Handle duplicate ID fallback (a_weapon and alliance_frost_league are the same)
                const savedSchedule = schedules.find(s =>
                    s.eventId === event.id ||
                    (event.id === 'a_weapon' && s.eventId === 'alliance_frost_league') ||
                    (event.id === 'alliance_frost_league' && s.eventId === 'a_weapon') ||
                    (event.id === 'a_operation' && s.eventId === 'alliance_operation') ||
                    (event.id === 'alliance_operation' && s.eventId === 'a_operation')
                );
                if (savedSchedule) {
                    // Sanitize stray dots from DB
                    const cleanDay = (savedSchedule.day === '.' || savedSchedule.day?.trim() === '.') ? '' : (savedSchedule.day || '');
                    const cleanTime = (savedSchedule.time === '.' || savedSchedule.time?.trim() === '.') ? '' : (savedSchedule.time || '');

                    return {
                        ...event,
                        day: cleanDay,
                        time: cleanTime,
                        strategy: savedSchedule.strategy || ''
                    };
                }
                return { ...event, day: '', time: '' };
            });
            setEvents(mergedEvents);
        }
    }, [schedules, schedulesLoading]);

    // Handle focus from Home (Deep Link)
    useEffect(() => {
        if (params.focusId && !schedulesLoading && events.length > 0) {
            const focusId = Array.isArray(params.focusId) ? params.focusId[0] : params.focusId;
            setHighlightId(focusId);
            setSelectedCategory('전체');

            setTimeout(() => {
                const yPos = itemLayouts.current[focusId];
                if (yPos !== undefined && scrollViewRef.current) {
                    scrollViewRef.current.scrollTo({ y: yPos - 20, animated: true });
                }
            }, 600);

            setTimeout(() => setHighlightId(null), 2500);
        }
    }, [params.focusId, schedulesLoading, events.length]);

    // Modal States
    const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
    const [hoveredClockId, setHoveredClockId] = useState<string | null>(null);
    const [hoveredScheduleId, setHoveredScheduleId] = useState<string | null>(null);
    const [editingEvent, setEditingEvent] = useState<WikiEvent | null>(null);

    // Permission request for notifications
    useEffect(() => {
        const requestPermissions = async () => {
            const { status } = await Notifications.getPermissionsAsync();
            if (status !== 'granted') {
                await Notifications.requestPermissionsAsync();
            }
        };
        requestPermissions();
    }, []);

    const scheduleNotification = async (event: WikiEvent, day: string, time: string) => {
        if (Platform.OS === 'web') return;
        if (!day || !time || time === '상시' || time === '상설') return;

        const dayMap: { [key: string]: number } = { '일': 1, '월': 2, '화': 3, '수': 4, '목': 5, '금': 6, '토': 7 };
        const [h, m] = time.split(':').map(Number);

        // Schedule for each day
        for (const d of day.split(',').map(s => s.trim())) {
            const weekday = dayMap[d];
            if (weekday) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: `🏰 이벤트 시작 알림: ${event.title}`,
                        body: `잠시 후 ${event.title} 이벤트가 시작됩니다! 본부를 수호하세요.`,
                        sound: true,
                        data: { eventId: event.id },
                    },
                    trigger: {
                        weekday,
                        hour: h,
                        minute: m,
                        repeats: true,
                    },
                });
            }
        }
    };

    // Custom Alert State
    const [customAlert, setCustomAlert] = useState<{
        visible: boolean,
        title: string,
        message: string,
        type: 'success' | 'error' | 'warning' | 'confirm',
        onConfirm?: () => void
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'error'
    });

    const showCustomAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'confirm' = 'error', onConfirm?: () => void) => {
        setCustomAlert({ visible: true, title, message, type, onConfirm });
    };

    // Tab & Data States
    const [activeTab, setActiveTab] = useState<1 | 2>(1);
    const [activeFortressTab, setActiveFortressTab] = useState<'fortress' | 'citadel'>('fortress');
    const [slots1, setSlots1] = useState<{ day: string, time: string, id: string, isNew?: boolean }[]>([]);
    const [slots2, setSlots2] = useState<{ day: string, time: string, id: string, isNew?: boolean }[]>([]);
    const [initialSlots1, setInitialSlots1] = useState<{ day: string, time: string }[]>([]);

    const [initialSlots2, setInitialSlots2] = useState<{ day: string, time: string }[]>([]);

    // Warning Modal State
    const [warningModalVisible, setWarningModalVisible] = useState(false);
    const [pendingTab, setPendingTab] = useState<1 | 2 | null>(null);



    const [editHour, setEditHour] = useState(new Date().getHours().toString().padStart(2, '0'));
    const [editMinute, setEditMinute] = useState('00');
    const [editingSlotId, setEditingSlotId] = useState<string | null>(null);

    const [isPermanent, setIsPermanent] = useState(false);
    const [hourDropdownVisible, setHourDropdownVisible] = useState(false);
    const [minuteDropdownVisible, setMinuteDropdownVisible] = useState(false);
    const [activeFortressDropdown, setActiveFortressDropdown] = useState<{
        id: string,
        type: 'fortress' | 'citadel' | 'h' | 'm' | 'd'
    } | null>(null);

    // Mobilization States
    const [mStart, setMStart] = useState('');
    const [mEnd, setMEnd] = useState('');
    const [activeDateDropdown, setActiveDateDropdown] = useState<{ type: 'start' | 'end', field: 'y' | 'm' | 'd' | 'h' | 'min' } | null>(null);
    const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);
    const [viewDate, setViewDate] = useState(new Date());

    // Sync viewDate with selectedValue when modal opens
    useEffect(() => {
        if (showDatePicker) {
            const selectedValue = showDatePicker === 'start' ? mStart : mEnd;
            const parts = (selectedValue.split(' ')[0] || '').split('.');
            const selY = parseInt(parts[0]);
            const selM = parseInt(parts[1]);
            if (!isNaN(selY) && !isNaN(selM)) {
                setViewDate(new Date(selY, selM - 1, 1));
            }
        }
    }, [showDatePicker, mStart, mEnd]);

    // Championship States
    const [champStart, setChampStart] = useState({ d: '월', h: '22', m: '00' });
    const [champEnd, setChampEnd] = useState({ d: '월', h: '23', m: '00' });

    const flickerAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0.4)).current;
    const newSlotPulse = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const createFlicker = () => {
            return Animated.sequence([
                Animated.timing(flickerAnim, { toValue: 0.3, duration: 50, useNativeDriver: true }),
                Animated.timing(flickerAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
                Animated.timing(flickerAnim, { toValue: 0.4, duration: 100, useNativeDriver: true }),
                Animated.timing(flickerAnim, { toValue: 1, duration: 50, useNativeDriver: true }),
                Animated.timing(flickerAnim, { toValue: 0.2, duration: 50, useNativeDriver: true }),
                Animated.timing(flickerAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
                Animated.timing(flickerAnim, { toValue: 0.7, duration: 50, useNativeDriver: true }),
                Animated.timing(flickerAnim, { toValue: 1, duration: 2000, useNativeDriver: true }), // Long pause
            ]);
        };

        const createScale = () => {
            return Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.2, duration: 100, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
                Animated.delay(2300),
            ]);
        };

        const createPulse = () => {
            return Animated.parallel([
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
                ]),
                Animated.sequence([
                    Animated.timing(glowAnim, { toValue: 0.8, duration: 800, useNativeDriver: true }),
                    Animated.timing(glowAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
                ])
            ]);
        };

        const createNewSlotPulse = () => {
            return Animated.sequence([
                Animated.timing(newSlotPulse, { toValue: 1, duration: 800, useNativeDriver: false }), // Native driver false for color interpolation
                Animated.timing(newSlotPulse, { toValue: 0, duration: 800, useNativeDriver: false }),
            ]);
        };

        const loop = Animated.loop(
            Animated.parallel([
                createFlicker(),
                createScale(),
                createPulse(),
                createNewSlotPulse()
            ])
        );
        loop.start();

        return () => loop.stop();
    }, []);

    // Guide Modal
    const [guideModalVisible, setGuideModalVisible] = useState(false);
    const [selectedEventForGuide, setSelectedEventForGuide] = useState<WikiEvent | null>(null);
    const [isEditingStrategy, setIsEditingStrategy] = useState(false);
    const [strategyContent, setStrategyContent] = useState('');

    // Wiki Browser Modal (Web Only)
    const [browserVisible, setBrowserVisible] = useState(false);
    const [currentWikiUrl, setCurrentWikiUrl] = useState('');

    // Attendee Modal
    const [attendeeModalVisible, setAttendeeModalVisible] = useState(false);
    const [managedEvent, setManagedEvent] = useState<WikiEvent | null>(null);
    const { attendees: firestoreAttendees, loading: firestoreLoading, saveAttendeesToFirestore } = useFirestoreAttendees(managedEvent?.id, serverId, allianceId);
    const [bulkAttendees, setBulkAttendees] = useState<Partial<Attendee>[]>([]);

    // Scheduling Logic
    const [selectedDayForSlot, setSelectedDayForSlot] = useState<string>('월');

    const isAdmin = auth.isLoggedIn && (
        SUPER_ADMINS.includes(auth.adminName || '') ||
        dynamicAdmins.some(a => a.name === auth.adminName)
    );

    useEffect(() => {
        if (firestoreAttendees && firestoreAttendees.length > 0) {
            setBulkAttendees(JSON.parse(JSON.stringify(firestoreAttendees)));
        } else {
            setBulkAttendees([]);
        }
    }, [firestoreAttendees, managedEvent]);

    const checkItemOngoing = useCallback((str: string) => {
        if (!str) return false;
        const dayMapObj: { [key: string]: number } = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
        const currentTotal = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes();
        const totalWeekMinutes = 7 * 1440;

        if (str.includes('상시') || str.includes('상설')) return true;

        // 1. 기간형 체크 (예: 2024.01.01 10:00 ~ 2024.01.03 10:00)
        const dateRangeMatch = str.match(/(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})\s*~\s*(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})/);
        if (dateRangeMatch) {
            const sStr = `${dateRangeMatch[1].replace(/\./g, '-')}T${dateRangeMatch[2]}:00`;
            const eStr = `${dateRangeMatch[3].replace(/\./g, '-')}T${dateRangeMatch[4]}:00`;
            const start = new Date(sStr);
            const end = new Date(eStr);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                return now >= start && now <= end;
            }
        }

        // 2. 주간 요일 범위 체크 (예: 월 10:00 ~ 수 10:00)
        const weeklyMatch = str.match(/([일월화수목금토])\s*(\d{2}):(\d{2})\s*~\s*([일월화수목금토])\s*(\d{2}):(\d{2})/);
        if (weeklyMatch) {
            const startTotal = dayMapObj[weeklyMatch[1]] * 1440 + parseInt(weeklyMatch[2]) * 60 + parseInt(weeklyMatch[3]);
            const endTotal = dayMapObj[weeklyMatch[4]] * 1440 + parseInt(weeklyMatch[5]) * 60 + parseInt(weeklyMatch[6]);
            if (startTotal <= endTotal) return currentTotal >= startTotal && currentTotal <= endTotal;
            return currentTotal >= startTotal || currentTotal <= endTotal;
        }

        // 3. 점형 일시 체크 (예: 화 23:50, 매일 10:00)
        const explicitMatches = Array.from(str.matchAll(/([일월화수목금토]|[매일])\s*\(?(\d{1,2}):(\d{2})\)?/g));
        if (explicitMatches.length > 0) {
            return explicitMatches.some(m => {
                const dayStr = m[1];
                const h = parseInt(m[2]);
                const min = parseInt(m[3]);

                const scheduledDays = (dayStr === '매일') ? ['일', '월', '화', '수', '목', '금', '토'] : [dayStr];

                return scheduledDays.some(d => {
                    const dayOffset = dayMapObj[d];
                    if (dayOffset === undefined) return false;
                    const startTotal = dayOffset * 1440 + h * 60 + min;
                    const endTotal = startTotal + 30; // Restored to 30 minutes as requested

                    if (currentTotal >= startTotal && currentTotal <= endTotal) return true;
                    if (endTotal >= totalWeekMinutes && currentTotal <= (endTotal % totalWeekMinutes)) return true;
                    return false;
                });
            });
        }
        return false;
    }, [now]);

    const checkIsOngoing = useCallback((event: WikiEvent) => {
        try {
            return checkItemOngoing(event.day || '') || checkItemOngoing(event.time || '');
        } catch (err) {
            return false;
        }
    }, [checkItemOngoing]);

    const checkIsExpired = useCallback((event: WikiEvent) => {
        try {
            const dayStr = event.day || '';
            const timeStr = event.time || '';
            const combined = dayStr + ' ' + timeStr;
            const dateRangeMatch = combined.match(/(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})\s*~\s*(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})/);
            if (dateRangeMatch) {
                const eStr = `${dateRangeMatch[3].replace(/\./g, '-')}T${dateRangeMatch[4]}:00`;
                const end = new Date(eStr);
                return !isNaN(end.getTime()) && now > end;
            }
            return false;
        } catch (e) { return false; }
    }, [now]);

    const isVisibleInList = useCallback((event: WikiEvent) => {
        const isExp = checkIsExpired(event);
        if (!isExp) return true;

        const dayStr = event.day || '';
        const timeStr = event.time || '';
        const combined = dayStr + ' ' + timeStr;
        const dateRangeMatch = combined.match(/(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})\s*~\s*(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})/);

        if (dateRangeMatch) {
            const eStr = `${dateRangeMatch[3].replace(/\./g, '-')}T${dateRangeMatch[4]}:00`;
            const end = new Date(eStr);
            if (!isNaN(end.getTime())) {
                const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
                const threshold = new Date(end.getTime() + twoDaysInMs);
                return now <= threshold;
            }
        }
        return true;
    }, [checkIsExpired, now]);

    const isExpiredMap = useMemo(() => {
        const map: { [key: string]: boolean } = {};
        events.forEach(e => {
            map[e.id] = checkIsExpired(e);
        });
        return map;
    }, [events, checkIsExpired]);

    const isOngoingMap = useMemo(() => {
        const map: { [key: string]: boolean } = {};
        events.forEach(e => {
            map[e.id] = checkIsOngoing(e);
        });
        return map;
    }, [events, checkIsOngoing]);

    const filteredEvents = useMemo(() => {
        let base = selectedCategory === '전체' ? [...events] : events.filter(e => e.category === selectedCategory);

        base = base.filter(e => {
            const isExp = isExpiredMap[e.id];
            if (!isExp) return true;

            const dayStr = e.day || '';
            const timeStr = e.time || '';
            const combined = dayStr + ' ' + timeStr;
            const dateRangeMatch = combined.match(/(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})\s*~\s*(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})/);

            if (dateRangeMatch) {
                const eStr = `${dateRangeMatch[3].replace(/\./g, '-')}T${dateRangeMatch[4]}:00`;
                const end = new Date(eStr);
                if (!isNaN(end.getTime())) {
                    const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
                    const threshold = new Date(end.getTime() + twoDaysInMs);
                    return now <= threshold;
                }
            }
            return true;
        });

        base.sort((a, b) => {
            const activeA = isOngoingMap[a.id];
            const activeB = isOngoingMap[b.id];

            if (activeA && !activeB) return -1;
            if (!activeA && activeB) return 1;

            if (selectedCategory === '전체') {
                const catOrder: { [key: string]: number } = { '서버': 0, '연맹': 1, '개인': 2, '초보자': 3 };
                const orderA = catOrder[a.category] !== undefined ? catOrder[a.category] : 99;
                const orderB = catOrder[b.category] !== undefined ? catOrder[b.category] : 99;
                if (orderA !== orderB) return orderA - orderB;
            }

            return 0;
        });

        return base;
    }, [events, selectedCategory, isExpiredMap, isOngoingMap, now]);

    const handleSetSelectedTeamTab = useCallback((eventId: string, idx: number) => {
        setSelectedTeamTabs(prev => ({ ...prev, [eventId]: idx }));
    }, []);

    const openWikiLink = useCallback((url: string) => {
        if (url) {
            if (Platform.OS === 'web') {
                setCurrentWikiUrl(url);
                setBrowserVisible(true);
            } else {
                Linking.openURL(url).catch(err => showCustomAlert('오류', '링크를 열 수 없습니다: ' + err.message, 'error'));
            }
        } else {
            showCustomAlert('알림', '위키 링크가 존재하지 않습니다.', 'warning');
        }
    }, [showCustomAlert]);

    const addTimeSlot = () => {
        const isT1 = activeTab === 1;
        const setSlots = isT1 ? setSlots1 : setSlots2;
        const currentSlots = isT1 ? slots1 : slots2;

        if (selectedDayForSlot === '상시') {
            const newS = [{ day: '상시', time: '', id: Math.random().toString() }];
            setSlots(newS);
            return;
        }

        if (editingSlotId) {
            const newS = currentSlots.map(s => s.id === editingSlotId ? { ...s, day: selectedDayForSlot, time: `${editHour}:${editMinute}` } : s);
            setSlots(newS);
            setEditingSlotId(null);
            return;
        }

        // Check for duplicate
        const isDuplicate = currentSlots.some(s => s.day === selectedDayForSlot && s.time === `${editHour}:${editMinute}`);
        if (isDuplicate) {
            showCustomAlert('중복 알림', '이미 동일한 요일과 시간이 등록되어 있습니다.', 'warning');
            return;
        }

        const newSlot = {
            day: selectedDayForSlot,
            time: `${editHour}:${editMinute}`,
            id: Math.random().toString(),
            isNew: true
        };

        // If '상시' was there, clear it
        const filtered = currentSlots.filter(s => s.day !== '상시');
        const finalS = [...filtered, newSlot];
        setSlots(finalS);
    };

    const removeTimeSlot = (id: string) => {
        const isT1 = activeTab === 1;
        const setSlots = isT1 ? setSlots1 : setSlots2;
        const currentSlots = isT1 ? slots1 : slots2;

        const newS = currentSlots.filter(s => s.id !== id);
        setSlots(newS);
    };

    const saveStrategy = useCallback(async (targetEvent: WikiEvent) => {
        if (targetEvent) {
            const updatedEvents = events.map(e =>
                e.id === targetEvent.id ? { ...e, strategy: strategyContent } : e
            );
            setEvents(updatedEvents);
            setSelectedEventForGuide({ ...targetEvent, strategy: strategyContent });

            try {
                await updateSchedule({
                    eventId: targetEvent.id,
                    day: targetEvent.day,
                    time: targetEvent.time,
                    strategy: strategyContent
                });
                setIsEditingStrategy(false);
                showCustomAlert('완료', '연맹 작전이 저장되었습니다.', 'success');
            } catch (error: any) {
                showCustomAlert('오류', '저장 실패: ' + error.message, 'error');
            }
        }
    }, [events, strategyContent, updateSchedule, showCustomAlert]);

    const parseScheduleStr = (str: string) => {
        if (!str || str === '.') return [];
        // Handle "1군: 월(22:00) / 2군: 수(11:00)" or just "월(22:00), 수(11:00)"
        const slots: { day: string, time: string, id: string, isNew?: boolean }[] = [];
        const parts = str.split(/[,|]/);
        parts.forEach(p => {
            const trimP = p.trim();
            if (!trimP) return;
            const match = trimP.match(/([일월화수목금토]|[매일]|[상시])\s*(?:\(([^)]+)\))?/);
            if (match) {
                slots.push({
                    day: match[1],
                    time: match[2] || '',
                    id: Math.random().toString(),
                    isNew: false
                });
            }
        });
        return slots;
    };

    const handleTabSwitch = (targetTab: 1 | 2) => {
        if (activeTab === targetTab) return;

        const currentSlots = activeTab === 1 ? slots1 : slots2;
        const initialSlots = activeTab === 1 ? initialSlots1 : initialSlots2;

        const currentSimple = currentSlots.map(s => ({ day: s.day, time: s.time }));
        const isDirty = JSON.stringify(currentSimple) !== JSON.stringify(initialSlots);

        if (isDirty) {
            setPendingTab(targetTab);
            setWarningModalVisible(true);
        } else {
            setActiveTab(targetTab);
        }
    };

    const openScheduleModal = useCallback((event: WikiEvent) => {
        setEditingEvent(event);
        const currentTabIdx = selectedTeamTabs[event.id] || 0;
        setActiveTab(currentTabIdx === 0 ? 1 : 2);
        setActiveNamePickerId(null); // Clear any open name pickers
        setActiveFortressDropdown(null); // Clear any open time pickers


        const dateRangeIDs = ['a_castle', 'server_castle', 'a_operation', 'alliance_operation', 'a_trade', 'alliance_trade', 'a_champ', 'alliance_champion', 'a_weapon', 'alliance_frost_league', 'server_svs_prep', 'server_svs_battle', 'server_immigrate', 'server_merge'];
        if (event.category === '개인' || dateRangeIDs.includes(event.id)) {
            const rawDay = event.day || '';
            const [s, e] = rawDay.includes('~') ? rawDay.split('~').map(x => x.trim()) : ['', ''];

            const now = new Date();
            const defaultStr = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} 09:00`;

            setMStart(s || defaultStr);
            setMEnd(e || defaultStr);
        }

        if (event.id === 'a_fortress' || event.id === 'a_citadel') {
            const fParsed: any[] = [];
            const cParsed: any[] = [];

            // 공통 파싱 로직 (기존 데이터 유지 호환성)
            if (event.time) {
                if (event.time.includes('요새전:') || event.time.includes('성채전:')) {
                    const sections = event.time.split(' / ');
                    sections.forEach((s, idx) => {
                        if (s.startsWith('요새전:')) {
                            const items = s.replace('요새전:', '').trim().split(', ');
                            items.forEach((item, iidx) => {
                                const matchWithDay = item.match(/(.+?)\s+([월화수목금토일])\s*\(?(\d{2}):(\d{2})\)?/);
                                if (matchWithDay) {
                                    fParsed.push({ id: `f_${idx}_${iidx}`, name: matchWithDay[1].trim(), day: matchWithDay[2], h: matchWithDay[3], m: matchWithDay[4] });
                                } else {
                                    const match = item.match(/(.+?)\s*\(?(\d{2}):(\d{2})\)?/);
                                    if (match) fParsed.push({ id: `f_${idx}_${iidx}`, name: match[1].trim(), day: '토', h: match[2], m: match[3] });
                                }
                            });
                        } else if (s.startsWith('성채전:')) {
                            const items = s.replace('성채전:', '').trim().split(', ');
                            items.forEach((item, iidx) => {
                                const matchWithDay = item.match(/(.+?)\s+([월화수목금토일])\s*\(?(\d{2}):(\d{2})\)?/);
                                if (matchWithDay) {
                                    cParsed.push({ id: `c_${idx}_${iidx}`, name: matchWithDay[1].trim(), day: matchWithDay[2], h: matchWithDay[3], m: matchWithDay[4] });
                                } else {
                                    const match = item.match(/(.+?)\s*\(?(\d{2}):(\d{2})\)?/);
                                    if (match) cParsed.push({ id: `c_${idx}_${iidx}`, name: match[1].trim(), day: '일', h: match[2], m: match[3] });
                                }
                            });
                        }
                    });
                } else {
                    // 구형 포맷 처리
                    const parts = event.time.split(' / ');
                    parts.forEach((p, idx) => {
                        const nestedMatch = p.match(/(.+)\((.+)\)/);
                        if (nestedMatch) {
                            const fName = nestedMatch[1].trim();
                            const cContent = nestedMatch[2].trim();
                            const cParts = cContent.split(',');
                            cParts.forEach((cp, cidx) => {
                                const cMatch = cp.trim().match(/(.+)\s+(\d{2}):(\d{2})/);
                                if (cMatch) {
                                    cParsed.push({ id: `c_${idx}_${cidx}`, name: cMatch[1].trim(), day: '일', h: cMatch[2], m: cMatch[3] });
                                }
                            });
                            fParsed.push({ id: `f_${idx}`, name: fName, day: '토', h: '22', m: '00' });
                        } else {
                            const simpleMatch = p.match(/(.+)\s+(\d{2}):(\d{2})/);
                            if (simpleMatch) {
                                const name = simpleMatch[1].trim();
                                if (name.includes('요새')) {
                                    fParsed.push({ id: `f_${idx}`, name, day: '토', h: simpleMatch[2], m: simpleMatch[3] });
                                } else {
                                    cParsed.push({ id: `c_${idx}`, name, day: '일', h: simpleMatch[2], m: simpleMatch[3] });
                                }
                            }
                        }
                    });
                }
            }

            if (event.id === 'a_fortress') {
                setFortressList(fParsed);
                setCitadelList([]); // Fortress 모달에서는 Citadel 비움
            } else {
                setCitadelList(cParsed);
                setFortressList([]); // Citadel 모달에서는 Fortress 비움
            }
        }

        // Parse Standard Schedule
        let s1: any[] = [];
        let s2: any[] = [];
        if ((event.category === '연맹' || event.category === '서버') && !SINGLE_SLOT_IDS.includes(event.id)) {
            const parts = (event.time || '').split(' / ');
            parts.forEach(p => {
                if (p.startsWith('1군:')) s1 = parseScheduleStr(p.replace('1군:', ''));
                if (p.startsWith('2군:')) s2 = parseScheduleStr(p.replace('2군:', ''));
            });
            if (s1.length === 0 && s2.length === 0) s1 = parseScheduleStr(event.time || '');
        } else {
            s1 = parseScheduleStr(event.time || '');
        }

        setSlots1(s1);
        setSlots2(s2);
        setInitialSlots1(s1.map(s => ({ day: s.day, time: s.time })));
        setInitialSlots2(s2.map(s => ({ day: s.day, time: s.time })));

        const nowTime = new Date();
        setSelectedDayForSlot('월');
        setEditHour(nowTime.getHours().toString().padStart(2, '0'));
        setEditMinute('00');
        setEditingSlotId(null);
        setScheduleModalVisible(true);
    }, [parseScheduleStr]);

    const toggleDay = useCallback((day: string) => {
        setSelectedDayForSlot(day);
    }, []);

    const openGuideModal = useCallback((event: WikiEvent) => {
        setSelectedEventForGuide(event);
        setStrategyContent(event.strategy || '');
        setIsEditingStrategy(false);
        setGuideModalVisible(true);
    }, []);

    const openAttendeeModal = useCallback((event: WikiEvent) => {
        setManagedEvent(event);
        setAttendeeModalVisible(true);
    }, []);

    const addAttendeeRow = useCallback(() => {
        setBulkAttendees(prev => [...prev, { id: Date.now().toString(), name: '', hero1: '', hero2: '', hero3: '' }]);
    }, []);

    const updateAttendeeField = useCallback((id: string, field: keyof Attendee, value: string) => {
        setBulkAttendees(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    }, []);

    const applyPenalty = useCallback((id: string, name: string) => {
        if (Platform.OS === 'web') {
            setPenaltyTarget({ id, name });
            return;
        }

        Alert.alert(
            '불참 사유 선택',
            `${name} 영주의 불참 사유를 선택해주세요.\n(무단 불참 시 페널티가 부여됩니다)`,
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '상태 초기화',
                    onPress: () => updateAttendeeField(id, 'penalty', '')
                },
                {
                    text: '사전 통보',
                    onPress: () => updateAttendeeField(id, 'penalty', 'NOTICE')
                },
                {
                    text: '무단 불참 (페널티)',
                    style: 'destructive',
                    onPress: () => updateAttendeeField(id, 'penalty', 'NO_SHOW')
                }
            ]
        );
    }, [updateAttendeeField]);

    const deleteAttendee = useCallback((id: string) => {
        setBulkAttendees(prev => prev.filter(a => a.id !== id));
    }, []);

    const saveAttendees = useCallback(() => {
        const validAttendees = bulkAttendees.filter(a => a.name?.trim());
        if (validAttendees.length === 0) {
            showCustomAlert('알림', '최소 한 명 이상의 이름을 입력해주세요.', 'warning');
            return;
        }

        const summary = validAttendees.map(a =>
            `- ${a.name}: ${[a.hero1, a.hero2, a.hero3].filter(Boolean).join(', ') || '지정 안 함'}`
        ).join('\n');

        setAttendeeModalVisible(false);
        showCustomAlert(
            '참석 명단 저장 완료',
            `${managedEvent?.title} 이벤트를 위해 총 ${validAttendees.length}명의 영주가 등록되었습니다.\n\n${summary}`,
            'success'
        );

        if (managedEvent) {
            saveAttendeesToFirestore(validAttendees.length > 0 ? validAttendees : [], managedEvent.title)
                .then(() => showCustomAlert('성공', '명단이 서버에 저장되었습니다.', 'success'))
                .catch((e) => showCustomAlert('오류', '저장 중 문제가 발생했습니다: ' + e.message, 'error'));
        }
    }, [bulkAttendees, managedEvent, showCustomAlert, saveAttendeesToFirestore]);

    const saveSchedule = async () => {
        if (!editingEvent) return;

        isSaving.current = true; // Lock updates

        const dateRangeIDs = ['a_castle', 'server_castle', 'a_operation', 'alliance_operation', 'a_trade', 'alliance_trade', 'a_champ', 'alliance_champion', 'a_weapon', 'alliance_frost_league', 'server_svs_prep', 'server_svs_battle', 'server_immigrate', 'server_merge'];
        if (editingEvent.category === '개인' || dateRangeIDs.includes(editingEvent.id)) {
            const finalDay = `${mStart} ~ ${mEnd}`;
            const finalTime = ''; // No time used for mobilization

            setEvents(prev => prev.map(e => (e.id === editingEvent.id || (editingEvent.id === 'alliance_frost_league' && e.id === 'a_weapon') || (editingEvent.id === 'a_weapon' && e.id === 'alliance_frost_league')) ? { ...e, day: finalDay, time: finalTime } : e));

            try {
                // Consolidate to a single ID for weapon league data
                const targetId = (editingEvent.id === 'alliance_frost_league' || editingEvent.id === 'a_weapon') ? 'a_weapon' : editingEvent.id;

                await updateSchedule({
                    eventId: targetId,
                    day: finalDay,
                    time: finalTime,
                    strategy: editingEvent.strategy || ''
                });
                setScheduleModalVisible(false);
                showCustomAlert('완료', `${editingEvent.title} 일정이 저장되었습니다.`, 'success');
            } catch (error: any) {
                showCustomAlert('오류', '저장 실패: ' + error.message, 'error');
            } finally {
                setTimeout(() => { isSaving.current = false; }, 2000);
            }
            return;
        }


        if (editingEvent.id === 'a_fortress' || editingEvent.id === 'a_citadel') {
            let timeStr = '';
            let finalDay = '';

            if (editingEvent.id === 'a_fortress') {
                const fStr = fortressList.length > 0 ? `요새전: ${fortressList.map(f => `${f.name.replace(/\s+/g, '')} ${f.day || '토'} ${f.h}:${f.m}`).join(', ')}` : '';
                timeStr = fStr;
                finalDay = fortressList.length > 0 ? '요새전' : '';
            } else {
                const cStr = citadelList.length > 0 ? `성채전: ${citadelList.map(c => `${c.name.replace(/\s+/g, '')} ${c.day || '일'} ${c.h}:${c.m}`).join(', ')}` : '';
                timeStr = cStr;
                finalDay = citadelList.length > 0 ? '성채전' : '';
            }

            setEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...e, day: finalDay, time: timeStr } : e));

            try {
                await updateSchedule({
                    eventId: editingEvent.id,
                    day: finalDay,
                    time: timeStr,
                    strategy: editingEvent.strategy || ''
                });

                // Cancel old notifications and schedule new ones
                if (Platform.OS !== 'web') {
                    await Notifications.cancelAllScheduledNotificationsAsync();
                    if (editingEvent.id === 'a_fortress') {
                        for (const f of fortressList) {
                            await scheduleNotification(editingEvent, f.day || '토', `${f.h}:${f.m}`);
                        }
                    } else {
                        for (const c of citadelList) {
                            await scheduleNotification(editingEvent, c.day || '일', `${c.h}:${c.m}`);
                        }
                    }
                }

                showCustomAlert('완료', `${editingEvent.title} 일정이 저장되었습니다.`, 'success', () => {
                    setScheduleModalVisible(false);
                });
            } catch (error: any) {
                showCustomAlert('오류', '저장 실패: ' + error.message, 'error');
            } finally {
                setTimeout(() => { isSaving.current = false; }, 2000);
            }
            return;
        }

        let finalDay = '';
        let finalTime = '';

        const buildStr = (slots: { day: string, time: string }[]) => {
            if (slots.length === 0) return '';
            if (slots.some(s => s.day === '상시')) return '상시';
            return slots.map(s => `${s.day}(${s.time})`).join(', ');
        };

        const getAllDays = (slots: { day: string }[]) => {
            const raw = slots.map(s => s.day);
            return Array.from(new Set(raw));
        };

        const isMultiSlot = (slots2.length > 0) ||
            ((editingEvent?.category === '연맹' || editingEvent?.category === '서버') && !SINGLE_SLOT_IDS.includes(editingEvent?.id || ''));

        // DEBUGGING: Check what is being saved
        // Alert.alert('Debug', `ID: ${editingEvent?.id}, S2 Len: ${slots2.length}, IsMulti: ${isMultiSlot}`);

        if (isMultiSlot) {
            const str1 = buildStr(slots1);
            const str2 = buildStr(slots2);

            const parts = [];
            if (str1) parts.push(`1군: ${str1}`);
            if (str2) parts.push(`2군: ${str2}`);
            finalTime = parts.join(' / ');

            // DEBUG
            // Alert.alert('Saving Multi', finalTime);

            const allDays = Array.from(new Set([...getAllDays(slots1), ...getAllDays(slots2)]));
            const dayOrder = ['월', '화', '수', '목', '금', '토', '일', '매일', '상시'];
            finalDay = allDays.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)).join(', ');
        } else {
            // General Event
            finalTime = buildStr(slots1);
            finalDay = getAllDays(slots1).join(', ');
        }

        // FORCE ALERT TO DEBUG
        // Alert.alert('Debug Saving', `Event: ${editingEvent?.id}\nSlots2: ${slots2.length}\nFinal: ${finalTime}`);

        // Update local state immediately to prevent flicker
        setEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...e, day: finalDay, time: finalTime } : e));



        try {
            await updateSchedule({
                eventId: editingEvent.id,
                day: finalDay || '',
                time: finalTime || '',
                strategy: editingEvent.strategy || ''
            });

            // Schedule Notifications for Weekly Events (Day + Time)
            if (Platform.OS !== 'web' && (finalDay && finalTime && !finalDay.includes('.'))) {
                await Notifications.cancelAllScheduledNotificationsAsync();
                const allSlots = [...slots1, ...slots2];
                for (const slot of allSlots) {
                    if (slot.day && slot.time && slot.day !== '상시') {
                        await scheduleNotification(editingEvent, slot.day, slot.time);
                    }
                }
            }

            showCustomAlert('저장 완료', '이벤트 일정이 성공적으로 등록되었습니다.', 'success', () => {
                setScheduleModalVisible(false);
            });

        } catch (error: any) {
            showCustomAlert('저장 실패', '서버 통신 중 오류가 발생했습니다.\n' + error.message, 'error');
        } finally {
            setTimeout(() => { isSaving.current = false; }, 2000);
        }
    };

    const handleDeleteSchedule = async () => {
        if (!editingEvent) return;

        showCustomAlert(
            '일정 초기화',
            '이 이벤트의 요일/시간 설정을 정말로 삭제하시겠습니까?',
            'confirm',
            async () => {
                isSaving.current = true;
                try {
                    setEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...e, day: '', time: '' } : e));

                    await updateSchedule({
                        eventId: editingEvent.id,
                        day: '',
                        time: '',
                        strategy: editingEvent.strategy || ''
                    });

                    if (Platform.OS !== 'web') {
                        await Notifications.cancelAllScheduledNotificationsAsync();
                    }
                    showCustomAlert('완료', '일정이 초기화되었습니다.', 'success', () => {
                        setScheduleModalVisible(false);
                    });
                } catch (error: any) {
                    showCustomAlert('오류', '초기화 실패: ' + error.message, 'error');
                } finally {
                    setTimeout(() => { isSaving.current = false; }, 2000);
                }
            }
        );
    };

    const guideContent = selectedEventForGuide ? getGuideContent(selectedEventForGuide.id) : null;

    if (schedulesLoading) {
        return (
            <View className={`flex-1 justify-center items-center ${isDark ? 'bg-[#020617]' : 'bg-slate-50'}`}>
                <Stack.Screen options={{ headerShown: false }} />
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text className={`mt-4 font-semibold ${isDark ? 'text-white' : 'text-slate-600'}`}>데이터 동기화 중...</Text>
            </View>
        );
    }

    return (
        <View className={`flex-1 ${isDark ? 'bg-slate-950' : 'bg-slate-50'}`}>
            <Stack.Screen options={{ headerShown: false }} />

            <View className="flex-1 flex-row w-full h-full">
                {/* Layout: Sidebar for Desktop */}
                {isDesktop && (
                    <View className={`w-60 border-r pt-16 px-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <Text className={`text-[11px] font-bold uppercase tracking-widest mb-6 px-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Category</Text>
                        <View className="space-y-1">
                            {(['전체', '서버', '연맹', '개인', '초보자'] as EventCategory[]).map((cat) => (
                                <Pressable
                                    key={cat}
                                    onPress={() => setSelectedCategory(cat)}
                                    className={`flex-row items-center px-4 py-3 rounded-xl transition-all ${selectedCategory === cat ? (isDark ? 'bg-indigo-500/10' : 'bg-indigo-50') : ''}`}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            backgroundColor: selectedCategory === cat
                                                ? (isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(238, 242, 255, 1)')
                                                : (hovered ? (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)') : 'transparent'),
                                            transform: [{ scale: pressed ? 0.98 : (hovered ? 1.05 : 1) }],
                                            borderLeftWidth: (selectedCategory === cat || hovered) ? 4 : 0,
                                            borderLeftColor: selectedCategory === cat ? '#6366f1' : '#94a3b8',
                                            // @ts-ignore
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer',
                                        }
                                    ]}
                                >
                                    {({ hovered }: any) => (
                                        <>
                                            <Ionicons
                                                name={cat === '연맹' ? 'flag-outline' : cat === '개인' ? 'person-outline' : cat === '서버' ? 'earth-outline' : cat === '초보자' ? 'star-outline' : 'apps-outline'}
                                                size={18}
                                                color={selectedCategory === cat ? '#6366f1' : (hovered ? (isDark ? '#818cf8' : '#6366f1') : (isDark ? '#475569' : '#94a3b8'))}
                                            />
                                            <Text className={`ml-3 font-bold text-sm ${selectedCategory === cat ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : (hovered ? (isDark ? 'text-slate-200' : 'text-slate-800') : (isDark ? 'text-slate-400' : 'text-slate-500'))}`}>
                                                {cat}
                                            </Text>
                                            {(selectedCategory === cat || hovered) && (
                                                <View
                                                    className={`ml-auto w-1 h-4 rounded-full transition-all`}
                                                    style={{
                                                        backgroundColor: selectedCategory === cat ? '#6366f1' : '#f43f5e',
                                                        opacity: selectedCategory === cat ? 1 : 0.8,
                                                        shadowColor: selectedCategory === cat ? '#6366f1' : '#f43f5e',
                                                        shadowOffset: { width: 0, height: 0 },
                                                        shadowOpacity: 0.8,
                                                        shadowRadius: 5
                                                    }}
                                                />
                                            )}
                                        </>
                                    )}
                                </Pressable>
                            ))}
                        </View>
                    </View>
                )}

                {/* Layout: Main Content */}
                <View className="flex-1 flex-col">
                    {/* Header */}
                    <View className={`pt-12 pb-2 px-6 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <View className="flex-row items-center mb-4">
                            <TouchableOpacity
                                onPress={() => router.replace('/')}
                                className={`mr-4 w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                            >
                                <Ionicons name="arrow-back-outline" size={20} color={isDark ? "white" : "#1e293b"} />
                            </TouchableOpacity>
                            <View>
                                <Text className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>이벤트 스케줄</Text>
                                <Text className={`text-xs font-medium mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>서버 및 연맹 이벤트를 한눈에 확인하세요</Text>
                            </View>

                            {/* Timezone Toggle */}
                            <View className={`flex-row p-1 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-100 border-slate-300'}`}>
                                <Pressable
                                    onPress={() => setTimezone('KST')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 12,
                                            backgroundColor: timezone === 'KST'
                                                ? (isDark ? '#2563eb' : '#3b82f6')
                                                : (hovered ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : 'transparent'),
                                            borderColor: timezone === 'KST' ? 'transparent' : (hovered ? (isDark ? '#60a5fa' : '#3b82f6') : 'transparent'),
                                            borderWidth: 1,
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                >
                                    <Text className={`text-[11px] font-black ${timezone === 'KST' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>KST</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => setTimezone('UTC')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 12,
                                            backgroundColor: timezone === 'UTC'
                                                ? (isDark ? '#2563eb' : '#3b82f6')
                                                : (hovered ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : 'transparent'),
                                            borderColor: timezone === 'UTC' ? 'transparent' : (hovered ? (isDark ? '#60a5fa' : '#3b82f6') : 'transparent'),
                                            borderWidth: 1,
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                >
                                    <Text className={`text-[11px] font-black ${timezone === 'UTC' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>UTC</Text>
                                </Pressable>
                            </View>
                        </View>

                        {/* Mobile Category Filter (Hidden on Desktop) */}
                        {!isDesktop && (
                            <View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                                    {(['전체', '서버', '연맹', '개인', '초보자'] as EventCategory[]).map((cat) => (
                                        <Pressable
                                            key={cat}
                                            onPress={() => setSelectedCategory(cat)}
                                            className="px-4 py-3 mr-2 relative flex-row items-center"
                                        >
                                            {({ hovered }: any) => (
                                                <>
                                                    <Ionicons
                                                        name={cat === '연맹' ? 'flag-outline' : cat === '개인' ? 'person-outline' : cat === '서버' ? 'earth-outline' : cat === '초보자' ? 'star-outline' : 'apps-outline'}
                                                        size={16}
                                                        color={selectedCategory === cat ? (isDark ? '#818cf8' : '#6366f1') : (hovered ? (isDark ? '#818cf8' : '#6366f1') : (isDark ? '#475569' : '#94a3b8'))}
                                                        className="mr-2"
                                                    />
                                                    <Text className={`text-sm font-bold transition-all ${selectedCategory === cat ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : (hovered ? (isDark ? 'text-slate-200' : 'text-slate-700') : (isDark ? 'text-slate-500' : 'text-slate-400'))}`}>{cat}</Text>
                                                    {(selectedCategory === cat || hovered) && (
                                                        <View
                                                            className="absolute bottom-0 left-4 right-4 h-0.5 rounded-t-full transition-all"
                                                            style={{
                                                                backgroundColor: selectedCategory === cat ? '#6366f1' : '#f43f5e',
                                                                opacity: selectedCategory === cat ? 1 : 0.8,
                                                                shadowColor: selectedCategory === cat ? '#6366f1' : '#f43f5e',
                                                                shadowOffset: { width: 0, height: -2 },
                                                                shadowOpacity: 0.6,
                                                                shadowRadius: 4
                                                            }}
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    {/* Event Grid */}
                    <ScrollView ref={scrollViewRef} className="flex-1 p-3.5">
                        <View className="flex-row flex-wrap -mx-2">
                            {filteredEvents.length === 0 ? (
                                <View className="w-full py-24 items-center justify-center">
                                    <View className={`w-24 h-24 rounded-full items-center justify-center mb-6 shadow-inner ${isDark ? 'bg-slate-800/40 border border-slate-700/50' : 'bg-slate-50 border border-slate-100'}`}>
                                        <Ionicons name="calendar-outline" size={48} color={isDark ? "#475569" : "#94a3b8"} />
                                    </View>
                                    <Text className={`text-xl font-black mb-2 tracking-tight ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>진행 중인 이벤트가 없습니다</Text>
                                    <Text className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>다른 카테고리 필터를 선택해 주세요</Text>
                                </View>
                            ) : (
                                filteredEvents.map((event) => (
                                    <EventCard
                                        key={event.id}
                                        event={event}
                                        isDark={isDark}
                                        timezone={timezone}
                                        auth={auth}
                                        isAdmin={isAdmin}
                                        isOngoing={isOngoingMap[event.id]}
                                        isExpired={isExpiredMap[event.id]}
                                        selectedTeamTab={selectedTeamTabs[event.id] || 0}
                                        checkItemOngoing={checkItemOngoing}
                                        openScheduleModal={openScheduleModal}
                                        openGuideModal={openGuideModal}
                                        openAttendeeModal={openAttendeeModal}
                                        openWikiLink={openWikiLink}
                                        onSetSelectedTeamTab={(idx) => handleSetSelectedTeamTab(event.id, idx)}
                                        onLayout={(y) => { itemLayouts.current[event.id] = y; }}
                                    />
                                ))
                            )}
                        </View>
                        <View className="h-20" />
                    </ScrollView>
                </View >

                {/* Guide Detail Popup Modal */}
                < Modal visible={guideModalVisible} transparent animationType="fade" >
                    <View className="flex-1 bg-black/90 justify-center items-center p-6">
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => setGuideModalVisible(false)}
                            className="absolute inset-0"
                        />
                        <View className="bg-slate-900 w-full max-w-2xl max-h-[85%] rounded-[32px] border border-slate-700 overflow-hidden shadow-2xl">
                            {/* Modal Header Image */}
                            {selectedEventForGuide?.imageUrl ? (
                                <ImageBackground source={{ uri: selectedEventForGuide.imageUrl }} className="h-32 w-full">
                                    {Platform.OS === 'web' ? (
                                        <View className="absolute inset-0 bg-black/70" />
                                    ) : (
                                        <BlurView intensity={20} className="absolute inset-0 bg-black/50" />
                                    )}
                                    <View className="absolute bottom-4 left-6 flex-row items-center">
                                        <View className="w-12 h-12 rounded-xl border border-white/20 overflow-hidden mr-4">
                                            <ImageBackground source={{ uri: selectedEventForGuide.imageUrl }} className="w-full h-full" />
                                        </View>
                                        <View>
                                            <Text className="text-white text-2xl font-bold">{selectedEventForGuide?.title}</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity onPress={() => setGuideModalVisible(false)} className="absolute top-4 right-4 bg-black/40 p-2 rounded-full border border-white/10">
                                        <Ionicons name="close" size={20} color="white" />
                                    </TouchableOpacity>
                                </ImageBackground>
                            ) : (
                                <View className="h-24 bg-slate-800 w-full justify-center px-6">
                                    <Text className="text-white text-2xl font-bold">{selectedEventForGuide?.title}</Text>
                                    <TouchableOpacity onPress={() => setGuideModalVisible(false)} className="absolute top-4 right-4">
                                        <Ionicons name="close" size={24} color="white" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            <ScrollView className="p-6">
                                {/* Wiki Link Section */}
                                <View className="mb-6 bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                                    <View className="flex-row items-center justify-between mb-2">
                                        <View className="flex-row items-center">
                                            <View className="w-1 h-4 bg-brand-accent rounded-full mr-2" />
                                            <Text className="text-white font-semibold text-sm">실전 진행 방식 (Wiki)</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => openWikiLink(selectedEventForGuide?.wikiUrl || '')}
                                            className="bg-[#38bdf8]/10 px-3 py-1.5 rounded-lg border border-[#38bdf8]/20"
                                        >
                                            <Text className="text-[#38bdf8] text-xs font-semibold">🌐 위키 이동</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <Text className="text-slate-400 text-xs leading-5">
                                        {selectedEventForGuide?.wikiUrl || '위키 링크가 없습니다.'}
                                    </Text>
                                </View>

                                {/* Alliance Strategy Section */}
                                {(selectedEventForGuide?.category === '연맹' || selectedEventForGuide?.category === '서버') && (
                                    <View className="mb-6">
                                        <View className="flex-row items-center justify-between mb-3">
                                            <Text className="text-purple-400 font-bold text-sm uppercase tracking-widest">🛡️ 연맹 작전 지시</Text>
                                            {isAdmin && !isEditingStrategy && (
                                                <TouchableOpacity onPress={() => setIsEditingStrategy(true)} className="bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                                                    <Text className="text-slate-400 text-[10px] font-semibold">수정</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        <View className={`rounded-2xl border ${isAdmin && isEditingStrategy ? 'border-purple-500/50 bg-slate-800' : 'border-purple-500/20 bg-purple-500/5'} overflow-hidden`}>
                                            {isAdmin && isEditingStrategy ? (
                                                <View className="p-4">
                                                    <TextInput
                                                        multiline
                                                        value={strategyContent}
                                                        onChangeText={setStrategyContent}
                                                        className="text-slate-200 text-sm leading-6 min-h-[100px] mb-4"
                                                        placeholder="연맹원들에게 전달할 작전을 입력하세요..."
                                                        placeholderTextColor="#64748b"
                                                        style={{ textAlignVertical: 'top' }}
                                                    />
                                                    <View className="flex-row justify-end space-x-2">
                                                        <TouchableOpacity onPress={() => { setIsEditingStrategy(false); setStrategyContent(selectedEventForGuide?.strategy || ''); }} className="bg-slate-700 px-4 py-2 rounded-xl">
                                                            <Text className="text-slate-300 font-semibold text-xs">취소</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => saveStrategy(selectedEventForGuide!)} className="bg-purple-600 px-4 py-2 rounded-xl">
                                                            <Text className="text-white font-semibold text-xs">저장</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ) : (
                                                <View className="p-5">
                                                    <Text className="text-slate-200 text-sm font-medium leading-6">
                                                        {selectedEventForGuide?.strategy || '🥶 현재 등록된 작전 지시가 없습니다.'}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}

                                {/* Overview Section */}
                                {guideContent && (
                                    <View className="mb-6">
                                        <Text className="text-slate-500 text-xs font-bold uppercase mb-3">이벤트 개요</Text>
                                        <Text className="text-slate-300 text-sm leading-6 mb-6">{guideContent.overview}</Text>

                                        {/* How to Play */}
                                        {guideContent.howToPlay && guideContent.howToPlay.length > 0 && (
                                            <View className="mb-6">
                                                <Text className="text-slate-500 text-xs font-bold uppercase mb-3">상세 진행 가이드</Text>
                                                <View className="space-y-3">
                                                    {guideContent.howToPlay.map((step: { text: string; images?: string[] }, idx: number) => (
                                                        <View key={idx} className="flex-row">
                                                            <View className="w-5 h-5 rounded-full bg-slate-800 items-center justify-center mr-3 mt-0.5 border border-slate-700">
                                                                <Text className="text-slate-500 text-[10px] font-semibold">{idx + 1}</Text>
                                                            </View>
                                                            <Text className="text-slate-300 text-sm leading-6 flex-1">{step.text}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        )}

                                        {/* Tips */}
                                        {guideContent.tips && guideContent.tips.length > 0 && (
                                            <View className="mb-6 bg-yellow-500/5 p-5 rounded-2xl border border-yellow-500/10">
                                                <View className="flex-row items-center mb-4">
                                                    <Ionicons name="bulb" size={16} color="#eab308" className="mr-2" />
                                                    <Text className="text-yellow-500 text-xs font-bold uppercase">이벤트 공략 꿀팁</Text>
                                                </View>
                                                <View className="space-y-2">
                                                    {guideContent.tips.map((tip: string, idx: number) => (
                                                        <View key={idx} className="flex-row">
                                                            <Text className="text-yellow-500/50 mr-2">•</Text>
                                                            <Text className="text-slate-300 text-sm leading-6 flex-1">{tip}</Text>
                                                        </View>
                                                    ))}
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                )}

                                <View className="h-10" />
                            </ScrollView>

                            <TouchableOpacity
                                onPress={() => setGuideModalVisible(false)}
                                className="bg-slate-800 py-4 items-center border-t border-slate-700"
                            >
                                <Text className="text-slate-400 font-semibold text-sm">닫기</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

                {/* Schedule Edit Modal */}

                <Modal visible={scheduleModalVisible} transparent animationType="slide" >
                    <Pressable
                        className="flex-1 bg-black/80 justify-end"
                        onPress={() => {
                            setHourDropdownVisible(false);
                            setMinuteDropdownVisible(false);
                            setActiveDateDropdown(null);
                            setActiveFortressDropdown(null);
                            setActiveNamePickerId(null);
                        }}
                    >
                        <Pressable
                            onPress={() => {
                                // Close all potential dropdowns when clicking anywhere in the modal content
                                setHourDropdownVisible(false);
                                setMinuteDropdownVisible(false);
                                setActiveDateDropdown(null);
                                setActiveFortressDropdown(null);
                                setActiveNamePickerId(null);
                            }}
                            className={`p-0 rounded-t-[40px] border-t ${isDark ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-slate-100 shadow-2xl'}`}
                            style={{ height: editingEvent?.id === 'a_fortress' ? '70%' : 'auto', maxHeight: '90%' }}
                        >
                            <View className="px-6 pt-5 pb-1 flex-row justify-between items-start" style={{ zIndex: (!!activeDateDropdown || hourDropdownVisible || minuteDropdownVisible || !!activeFortressDropdown || !!activeNamePickerId) ? 1 : 100 }}>
                                <View className="flex-1 mr-4">
                                    <>
                                        <View className="flex-row items-center mb-1">
                                            <View className="w-1.5 h-6 bg-sky-500 rounded-full mr-3" />
                                            <Text className={`text-2xl font-black ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>
                                                {editingEvent?.title}
                                            </Text>
                                        </View>
                                        <Text className={`text-[13px] font-medium leading-5 ml-4.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {(editingEvent?.category === '개인' || editingEvent?.id === 'alliance_frost_league' || editingEvent?.id === 'a_weapon' || editingEvent?.id === 'a_champ' || editingEvent?.id === 'a_operation' || editingEvent?.id === 'alliance_operation') ? '이벤트 진행 기간을 설정하세요.' : '이벤트 진행 요일과 시간을 설정하세요.'}
                                        </Text>
                                    </>
                                </View>
                                <TouchableOpacity onPress={() => setScheduleModalVisible(false)} className={`p-2.5 rounded-full border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100 shadow-sm'}`}>
                                    <Ionicons name="close" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                                </TouchableOpacity>
                            </View>

                            <View className="px-6 flex-1" style={{ overflow: 'visible', zIndex: (activeDateDropdown || activeFortressDropdown || activeNamePickerId || hourDropdownVisible || minuteDropdownVisible) ? 200 : 1 }}>
                                {editingEvent?.id === 'a_fortress' || editingEvent?.id === 'a_citadel' ? (
                                    <View className="flex-1" style={{ overflow: 'visible', zIndex: activeFortressDropdown ? 200 : 1 }}>
                                        <View className="flex-row justify-end items-center mt-6 mb-2 px-4" style={{ zIndex: 10 }}>
                                            <TouchableOpacity onPress={() => editingEvent?.id === 'a_fortress'
                                                ? setFortressList([...fortressList, { id: Date.now().toString(), name: `요새 ${fortressList.length + 1}`, h: new Date().getHours().toString().padStart(2, '0'), m: '00', day: '토' }])
                                                : setCitadelList([...citadelList, { id: Date.now().toString(), name: `성채 ${citadelList.length + 1}`, h: new Date().getHours().toString().padStart(2, '0'), m: '00', day: '일' }])
                                            } className="bg-brand-accent px-5 py-3 rounded-2xl shadow-xl shadow-brand-accent/30 active:scale-95 flex-row items-center border border-white/20"><Ionicons name="add" size={20} color="#0f172a" style={{ marginRight: 4 }} /><Text className="text-brand-dark font-black text-sm">추가</Text></TouchableOpacity>
                                        </View>
                                        <ScrollView
                                            className="flex-1"
                                            contentContainerStyle={{ paddingBottom: 80, paddingTop: 10 }}
                                            style={{ overflow: 'visible' }}
                                        >
                                            {(editingEvent?.id === 'a_fortress' ? fortressList : citadelList).length === 0 ? (
                                                <View className="items-center justify-center py-6 bg-slate-800/20 rounded-[32px] border border-slate-700/30 border-dashed mx-2">
                                                    <View className="w-16 h-16 rounded-full bg-slate-800 items-center justify-center mb-4"><Ionicons name={editingEvent?.id === 'a_fortress' ? "shield-outline" : "business-outline"} size={32} color="#475569" /></View>
                                                    <Text className="text-slate-400 font-bold">등록된 일정이 없습니다.</Text>
                                                    <Text className="text-slate-600 text-xs mt-1">상단의 추가 버튼을 눌러주세요.</Text>
                                                </View>
                                            ) : (editingEvent?.id === 'a_fortress' ? fortressList : citadelList).map((item, idx) => {
                                                const isNamePickerOpen = activeNamePickerId === item.id;
                                                const isTimePickerOpen = activeFortressDropdown?.id === item.id;
                                                const listLength = (editingEvent?.id === 'a_fortress' ? fortressList : citadelList).length;
                                                const cardZIndex = (isNamePickerOpen || isTimePickerOpen) ? 10000 : (listLength - idx);

                                                return (
                                                    <View key={item.id} style={{ zIndex: cardZIndex }} className={`bg-slate-800/40 p-5 rounded-[32px] mb-2 border ${isTimePickerOpen ? 'border-sky-500/50 bg-slate-800/60' : 'border-slate-700/30'}`}>
                                                        <View className="flex-row justify-between items-center mb-4" style={{ zIndex: isNamePickerOpen ? 20 : 1 }}>
                                                            <View className="flex-row items-center">
                                                                <View className="w-8 h-8 rounded-full bg-sky-500/20 items-center justify-center mr-3"><Text className="text-sky-400 font-black text-xs">{idx + 1}</Text></View>
                                                                <OptionPicker
                                                                    value={item.name}
                                                                    options={editingEvent?.id === 'a_fortress' ? FORTRESS_OPTIONS : CITADEL_OPTIONS}
                                                                    onSelect={(v) => {
                                                                        if (editingEvent?.id === 'a_fortress') {
                                                                            const newList = [...fortressList]; newList[idx].name = v; setFortressList(newList);
                                                                        } else {
                                                                            const newList = [...citadelList]; newList[idx].name = v; setCitadelList(newList);
                                                                        }
                                                                    }}
                                                                    label={editingEvent?.id === 'a_fortress' ? "요새 선택" : "성채 선택"}
                                                                    isDark={isDark}
                                                                    direction={idx > 0 ? 'up' : 'down'}
                                                                    isOpen={isNamePickerOpen}
                                                                    onToggle={(v) => {
                                                                        if (v) { setActiveNamePickerId(item.id); setActiveFortressDropdown(null); }
                                                                        else { setActiveNamePickerId(null); }
                                                                    }}
                                                                />
                                                            </View>
                                                            <TouchableOpacity onPress={() => {
                                                                if (editingEvent?.id === 'a_fortress') {
                                                                    setFortressList(fortressList.filter(i => i.id !== item.id));
                                                                } else {
                                                                    setCitadelList(citadelList.filter(i => i.id !== item.id));
                                                                }
                                                            }} className="w-10 h-10 rounded-full bg-red-500/10 items-center justify-center border border-red-500/20"><Ionicons name="trash-outline" size={18} color="#ef4444" /></TouchableOpacity>
                                                        </View>
                                                        <View className="flex-row gap-2">
                                                            {['월', '화', '수', '목', '금', '토', '일'].map(d => (
                                                                <TouchableOpacity key={d} onPress={() => {
                                                                    if (editingEvent?.id === 'a_fortress') {
                                                                        const newList = [...fortressList]; newList[idx].day = d; setFortressList(newList);
                                                                    } else {
                                                                        const newList = [...citadelList]; newList[idx].day = d; setCitadelList(newList);
                                                                    }
                                                                }} className={`flex-1 h-12 rounded-2xl items-center justify-center border ${item.day === d ? 'bg-sky-500 border-sky-400' : 'bg-slate-900/60 border-slate-700/50'}`}><Text className={`font-black text-xs ${item.day === d ? 'text-slate-950' : 'text-slate-500'}`}>{d}</Text></TouchableOpacity>
                                                            ))}
                                                        </View>
                                                        <View className="flex-row mt-3">
                                                            <View style={{ flex: 1, marginRight: 8 }}>
                                                                <TouchableOpacity
                                                                    onPress={() => setActiveFortressDropdown(activeFortressDropdown?.id === item.id && activeFortressDropdown?.type === 'h' ? null : { id: item.id, type: 'h' })}
                                                                    className="flex-row items-center bg-slate-900/60 p-2.5 rounded-2xl border border-slate-700/50 shadow-inner justify-between"
                                                                >
                                                                    <View className="flex-row items-center"><Ionicons name="time" size={14} color="#38bdf8" style={{ marginRight: 6 }} /><Text className="text-white font-black text-xs">{item.h}시</Text></View>
                                                                    <Ionicons name={activeFortressDropdown?.id === item.id && activeFortressDropdown?.type === 'h' ? "chevron-up" : "chevron-down"} size={12} color="#64748b" />
                                                                </TouchableOpacity>
                                                                {activeFortressDropdown?.id === item.id && activeFortressDropdown.type === 'h' && (
                                                                    <View className="absolute top-[60px] left-0 right-0 bg-slate-900/80 rounded-2xl border border-slate-700/50 h-48 overflow-hidden shadow-2xl z-[50000] elevation-25">
                                                                        <FlatList
                                                                            data={Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))}
                                                                            renderItem={({ item: h }) => (
                                                                                <TouchableOpacity
                                                                                    onPress={() => {
                                                                                        if (editingEvent?.id === 'a_fortress') {
                                                                                            const newList = [...fortressList]; newList[idx].h = h; setFortressList(newList);
                                                                                        } else {
                                                                                            const newList = [...citadelList]; newList[idx].h = h; setCitadelList(newList);
                                                                                        }
                                                                                        setActiveFortressDropdown(null);
                                                                                    }}
                                                                                    className={`h-12 items-center justify-center border-b border-white/5 ${item.h === h ? 'bg-sky-500/20' : ''}`}
                                                                                >
                                                                                    <Text className={`font-bold text-lg ${item.h === h ? 'text-sky-400' : 'text-slate-400'}`}>{h}시</Text>
                                                                                </TouchableOpacity>
                                                                            )}
                                                                            keyExtractor={h => h}
                                                                        />
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <View style={{ flex: 1, zIndex: (activeFortressDropdown?.id === item.id && activeFortressDropdown?.type === 'm') ? 10001 : 1, overflow: 'visible' }}>
                                                                <TouchableOpacity
                                                                    onPress={() => setActiveFortressDropdown(activeFortressDropdown?.id === item.id && activeFortressDropdown?.type === 'm' ? null : { id: item.id, type: 'm' })}
                                                                    className="flex-row items-center bg-slate-900/60 p-2.5 rounded-2xl border border-slate-700/50 shadow-inner justify-between"
                                                                >
                                                                    <View className="flex-row items-center"><Ionicons name="time" size={14} color="#38bdf8" style={{ marginRight: 6 }} /><Text className="text-white font-black text-xs">{item.m}분</Text></View>
                                                                    <Ionicons name={activeFortressDropdown?.id === item.id && activeFortressDropdown?.type === 'm' ? "chevron-up" : "chevron-down"} size={12} color="#64748b" />
                                                                </TouchableOpacity>
                                                                {activeFortressDropdown?.id === item.id && activeFortressDropdown.type === 'm' && (
                                                                    <View className="absolute top-[60px] left-0 right-0 bg-slate-900/80 rounded-2xl border border-slate-700/50 h-48 overflow-hidden shadow-2xl z-[50000] elevation-25">
                                                                        <FlatList
                                                                            data={['00', '15', '30', '45']}
                                                                            renderItem={({ item: m }) => (
                                                                                <TouchableOpacity
                                                                                    onPress={() => {
                                                                                        if (editingEvent?.id === 'a_fortress') {
                                                                                            const newList = [...fortressList]; newList[idx].m = m; setFortressList(newList);
                                                                                        } else {
                                                                                            const newList = [...citadelList]; newList[idx].m = m; setCitadelList(newList);
                                                                                        }
                                                                                        setActiveFortressDropdown(null);
                                                                                    }}
                                                                                    className={`h-12 items-center justify-center border-b border-white/5 ${item.m === m ? 'bg-sky-500/20' : ''}`}
                                                                                >
                                                                                    <Text className={`font-bold text-lg ${item.m === m ? 'text-sky-400' : 'text-slate-400'}`}>{m}분</Text>
                                                                                </TouchableOpacity>
                                                                            )}
                                                                            keyExtractor={m => m}
                                                                        />
                                                                    </View>
                                                                )}
                                                            </View>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </ScrollView>
                                    </View>
                                ) : (() => {
                                    const dateRangeIDs = ['a_castle', 'server_castle', 'a_operation', 'alliance_operation', 'a_trade', 'alliance_trade', 'a_champ', 'alliance_champion', 'a_weapon', 'alliance_frost_league', 'server_svs_prep', 'server_svs_battle', 'server_immigrate', 'server_merge'];
                                    return (editingEvent?.category === '개인' || dateRangeIDs.includes(editingEvent?.id || ''));
                                })() ? (
                                    <View className="flex-1" style={{ overflow: 'visible', zIndex: activeDateDropdown ? 10000 : 1 }}>
                                        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }} style={{ overflow: 'visible' }}>
                                            {(() => {
                                                return (
                                                    <View className={`mt-6 p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/30' : 'bg-slate-100 border-slate-200'}`} style={{ zIndex: 50 }}>
                                                        <View className="flex-row items-center mb-4">
                                                            <Ionicons name="calendar-number-outline" size={16} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginRight: 6 }} />
                                                            <Text className="text-brand-accent text-xs font-bold uppercase">일정 설정</Text>
                                                        </View>
                                                        <RenderDateSelector
                                                            label="시작 일시"
                                                            value={mStart}
                                                            onChange={setMStart}
                                                            type="start"
                                                            activeDateDropdown={activeDateDropdown}
                                                            setActiveDateDropdown={setActiveDateDropdown}
                                                            isDark={isDark}
                                                            setShowDatePicker={setShowDatePicker}
                                                        />
                                                        <RenderDateSelector
                                                            label="종료 일시"
                                                            value={mEnd}
                                                            onChange={setMEnd}
                                                            type="end"
                                                            activeDateDropdown={activeDateDropdown}
                                                            setActiveDateDropdown={setActiveDateDropdown}
                                                            isDark={isDark}
                                                            setShowDatePicker={setShowDatePicker}
                                                        />
                                                    </View>
                                                );
                                            })()}
                                        </ScrollView>
                                    </View>
                                ) : (
                                    <View className="flex-1" style={{ overflow: 'visible', zIndex: (hourDropdownVisible || minuteDropdownVisible) ? 200 : 1 }}>
                                        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }} style={{ overflow: 'visible' }}>
                                            {(() => {
                                                const singleSlotIDs = ['a_center', 'alliance_center', 'a_mercenary', 'alliance_mercenary', 'a_immigrate', 'alliance_immigrate', 'a_mobilization', 'alliance_mobilization', 'a_merge', 'alliance_merge', 'a_svs', 'alliance_svs', 'a_dragon', 'alliance_dragon', 'a_joe', 'alliance_joe'];
                                                if (editingEvent?.category === '연맹' && !singleSlotIDs.includes(editingEvent.id)) {
                                                    return (
                                                        <View className={`flex-row mb-6 mt-6 p-1 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                            <TouchableOpacity onPress={() => handleTabSwitch(1)} className={`flex-1 py-2 items-center rounded-lg ${activeTab === 1 ? (isDark ? 'bg-slate-700 shadow-sm' : 'bg-white shadow-sm') : ''}`}><Text className={`font-semibold ${activeTab === 1 ? (isDark ? 'text-white' : 'text-sky-600') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{(editingEvent?.id === 'a_bear' || editingEvent?.id === 'alliance_bear') ? '곰1 설정' : '1군 설정'}</Text></TouchableOpacity>
                                                            <TouchableOpacity onPress={() => handleTabSwitch(2)} className={`flex-1 py-2 items-center rounded-lg ${activeTab === 2 ? (isDark ? 'bg-slate-700 shadow-sm' : 'bg-white shadow-sm') : ''}`}><Text className={`font-semibold ${activeTab === 2 ? (isDark ? 'text-white' : 'text-sky-600') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{(editingEvent?.id === 'a_bear' || editingEvent?.id === 'alliance_bear') ? '곰2 설정' : '2군 설정'}</Text></TouchableOpacity>
                                                        </View>
                                                    );
                                                }
                                                return null;
                                            })()}
                                            {editingEvent?.id !== 'a_champ' && editingEvent?.id !== 'alliance_frost_league' && editingEvent?.id !== 'a_weapon' && (
                                                <View className={`flex-1 ${!(editingEvent?.category === '연맹' && !['a_center', 'alliance_center', 'a_mercenary', 'alliance_mercenary', 'a_immigrate', 'alliance_immigrate', 'a_mobilization', 'alliance_mobilization', 'a_merge', 'alliance_merge', 'a_svs', 'alliance_svs', 'a_dragon', 'alliance_dragon', 'a_joe', 'alliance_joe'].includes(editingEvent?.id || '')) ? 'mt-6' : ''}`}>
                                                    {editingEvent?.id !== 'a_center' && (
                                                        <View className="mb-2">
                                                            <Text className="text-brand-accent text-[10px] font-bold uppercase opacity-60 mb-2">진행 시간</Text>
                                                            <View className="flex-row flex-wrap gap-2">
                                                                {(activeTab === 1 ? slots1 : slots2).map(slot => {
                                                                    if (slot.isNew) {
                                                                        const backgroundColor = newSlotPulse.interpolate({
                                                                            inputRange: [0, 1],
                                                                            outputRange: ['rgba(251, 191, 36, 0.1)', 'rgba(251, 191, 36, 0.4)'] // Amber 400/500
                                                                        });
                                                                        const borderColor = newSlotPulse.interpolate({
                                                                            inputRange: [0, 1],
                                                                            outputRange: ['rgba(251, 191, 36, 0.3)', 'rgba(251, 191, 36, 0.8)']
                                                                        });

                                                                        return (
                                                                            <TouchableOpacity key={slot.id} onPress={() => { const [h, m] = slot.time.split(':'); setEditHour(h || '22'); setEditMinute(m || '00'); setSelectedDayForSlot(slot.day); if (editingSlotId === slot.id) { setEditingSlotId(null); setEditHour('22'); setEditMinute('00'); } else { setEditingSlotId(slot.id); } }}>
                                                                                <Animated.View style={{ backgroundColor, borderColor, borderWidth: 1 }} className={`px-3 py-1.5 rounded-xl flex-row items-center border`}>
                                                                                    <Text className={`text-amber-400 text-xs font-bold mr-2`}>{slot.day}{slot.time ? `(${formatTime12h(slot.time)})` : ''}</Text>
                                                                                    <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => removeTimeSlot(slot.id)}><Ionicons name="close-circle" size={16} color="#fbbf24" /></TouchableOpacity>
                                                                                </Animated.View>
                                                                            </TouchableOpacity>
                                                                        );
                                                                    }
                                                                    return (
                                                                        <TouchableOpacity key={slot.id} onPress={() => { const [h, m] = slot.time.split(':'); setEditHour(h || '22'); setEditMinute(m || '00'); setSelectedDayForSlot(slot.day); if (editingSlotId === slot.id) { setEditingSlotId(null); setEditHour('22'); setEditMinute('00'); } else { setEditingSlotId(slot.id); } }} className={`border px-3 py-1.5 rounded-xl flex-row items-center ${editingSlotId === slot.id ? 'bg-brand-accent/30 border-brand-accent' : 'bg-brand-accent/10 border-brand-accent/20'}`}><Text className="text-white text-xs font-bold mr-2">{slot.day}{slot.time ? `(${formatTime12h(slot.time)})` : ''}</Text><TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => removeTimeSlot(slot.id)}><Ionicons name="close-circle" size={16} color="#ef4444" /></TouchableOpacity></TouchableOpacity>
                                                                    );
                                                                })}
                                                                {(activeTab === 1 ? slots1 : slots2).length === 0 && (
                                                                    <View className={`w-full h-[32px] flex-row items-center justify-center border border-dashed rounded-xl ${isDark ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-500/50 bg-amber-50'}`}>
                                                                        <Ionicons name="alert-circle-outline" size={14} color={isDark ? "#fbbf24" : "#d97706"} style={{ marginRight: 6 }} />
                                                                        <Text className={`text-[11px] font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>등록된 일정이 없습니다.</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                        </View>
                                                    )}

                                                    <View className={`p-4 rounded-2xl mb-4 border ${isDark ? 'bg-slate-800/40 border-slate-700/30' : 'bg-slate-100 border-slate-200'}`}>
                                                        <View className="flex-row items-center mb-3">
                                                            <Ionicons name="calendar-outline" size={16} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginRight: 6 }} />
                                                            <Text className="text-brand-accent text-xs font-bold uppercase">진행 요일 선택</Text>
                                                        </View>
                                                        <View className="flex-row flex-wrap gap-2">
                                                            {['월', '화', '수', '목', '금', '토', '일', '상시'].map((d) => {
                                                                const isSelected = selectedDayForSlot === d;
                                                                return (
                                                                    <TouchableOpacity key={d} onPress={() => toggleDay(d)} className={`w-10 h-10 rounded-xl items-center justify-center border ${isSelected ? 'bg-brand-accent border-brand-accent' : 'bg-slate-800/60 border-slate-700'}`}><Text className={`font-bold text-xs ${isSelected ? 'text-brand-dark' : 'text-slate-300'}`}>{d}</Text></TouchableOpacity>
                                                                );
                                                            })}
                                                        </View>
                                                    </View>

                                                    {editingEvent?.id !== 'a_center' && (
                                                        <View className="mb-4 mt-2">
                                                            {selectedDayForSlot !== '상시' && (
                                                                <>
                                                                    <View className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/30' : 'bg-slate-100 border-slate-200'}`}>
                                                                        <View className="flex-row items-center mb-3">
                                                                            <Ionicons name="alarm-outline" size={16} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginRight: 6 }} />
                                                                            <Text className="text-brand-accent text-xs font-bold uppercase">시간 설정</Text>
                                                                        </View>
                                                                        <View className="space-y-4">
                                                                            {/* Hours Section */}
                                                                            <View>
                                                                                <View className="flex-row items-center justify-between mb-2">
                                                                                    <Text className={`text-[11px] font-black ${isDark ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest`}>시간 (HOUR)</Text>
                                                                                    <View className={`flex-row p-0.5 rounded-xl ${isDark ? 'bg-slate-900/80' : 'bg-slate-200/50'}`}>
                                                                                        <TouchableOpacity
                                                                                            onPress={() => {
                                                                                                const h = parseInt(editHour);
                                                                                                if (h >= 12) setEditHour((h - 12).toString().padStart(2, '0'));
                                                                                            }}
                                                                                            className={`px-3 py-1 rounded-lg ${parseInt(editHour) < 12 ? 'bg-sky-500 shadow-sm' : ''}`}
                                                                                        >
                                                                                            <Text className={`font-bold text-[10px] ${parseInt(editHour) < 12 ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>오전</Text>
                                                                                        </TouchableOpacity>
                                                                                        <TouchableOpacity
                                                                                            onPress={() => {
                                                                                                const h = parseInt(editHour);
                                                                                                if (h < 12) setEditHour((h + 12).toString().padStart(2, '0'));
                                                                                            }}
                                                                                            className={`px-3 py-1 rounded-lg ${parseInt(editHour) >= 12 ? 'bg-sky-500 shadow-sm' : ''}`}
                                                                                        >
                                                                                            <Text className={`font-bold text-[10px] ${parseInt(editHour) >= 12 ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>오후</Text>
                                                                                        </TouchableOpacity>
                                                                                    </View>
                                                                                </View>

                                                                                <View className="flex-row flex-wrap justify-center gap-1.5 px-0.5">
                                                                                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h12 => {
                                                                                        const curH = parseInt(editHour);
                                                                                        const isPM = curH >= 12;
                                                                                        const displayH = curH % 12 === 0 ? 12 : curH % 12;
                                                                                        const isSelected = displayH === h12;

                                                                                        return (
                                                                                            <TouchableOpacity
                                                                                                key={h12}
                                                                                                onPress={() => {
                                                                                                    let newH = h12;
                                                                                                    if (isPM) newH = h12 === 12 ? 12 : h12 + 12;
                                                                                                    else newH = h12 === 12 ? 0 : h12;
                                                                                                    setEditHour(newH.toString().padStart(2, '0'));
                                                                                                }}
                                                                                                className={`w-[52px] h-[52px] rounded-2xl items-center justify-center border-2 ${isSelected ? 'bg-sky-500 border-sky-400 shadow-sm' : (isDark ? 'bg-slate-900/40 border-slate-700/50' : 'bg-white border-slate-100 shadow-sm')}`}
                                                                                            >
                                                                                                <Text className={`text-sm font-black ${isSelected ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-600')}`}>{h12.toString().padStart(2, '0')}</Text>
                                                                                            </TouchableOpacity>
                                                                                        )
                                                                                    })}
                                                                                </View>
                                                                            </View>

                                                                            {/* Minutes Section */}
                                                                            <View className="pt-1">
                                                                                <Text className={`text-[11px] font-black mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest`}>분 (MINUTE)</Text>
                                                                                <View className="flex-row justify-between gap-1 px-0.5">
                                                                                    {['00', '10', '20', '30', '40', '50'].map(m => {
                                                                                        const isSelected = editMinute === m;
                                                                                        return (
                                                                                            <TouchableOpacity
                                                                                                key={m}
                                                                                                onPress={() => setEditMinute(m)}
                                                                                                className={`flex-1 py-3 rounded-2xl items-center justify-center border-2 ${isSelected ? 'bg-sky-500 border-sky-400 shadow-sm' : (isDark ? 'bg-slate-900/40 border-slate-700/50' : 'bg-white border-slate-100 shadow-sm')}`}
                                                                                            >
                                                                                                <Text className={`text-[10px] font-black ${isSelected ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-600')}`}>{m}분</Text>
                                                                                            </TouchableOpacity>
                                                                                        )
                                                                                    })}
                                                                                </View>
                                                                            </View>
                                                                        </View>
                                                                    </View>
                                                                    <View className="flex-row gap-2 mt-2">
                                                                        <TouchableOpacity onPress={() => addTimeSlot()} className={`flex-1 ${editingSlotId ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-blue-500/20 border-blue-500/40'} py-4 rounded-xl border items-center flex-row justify-center`}>
                                                                            <Ionicons name={editingSlotId ? "checkmark-circle" : "add-circle-outline"} size={20} color={editingSlotId ? "#10b981" : "#38bdf8"} style={{ marginRight: 8 }} />
                                                                            <Text className={`${editingSlotId ? 'text-emerald-400' : 'text-[#38bdf8]'} font-bold text-base`}>{editingSlotId ? '수정 완료' : '이 시간 추가 등록'}</Text>
                                                                        </TouchableOpacity>
                                                                        {!!editingSlotId && (
                                                                            <TouchableOpacity
                                                                                onPress={() => { setEditingSlotId(null); setEditHour('22'); setEditMinute('00'); }}
                                                                                className="bg-slate-800 px-4 py-4 rounded-xl border border-slate-700 justify-center"
                                                                            >
                                                                                <Text className="text-slate-400 font-semibold text-sm">취소</Text>
                                                                            </TouchableOpacity>
                                                                        )}
                                                                    </View>
                                                                </>
                                                            )}
                                                            {selectedDayForSlot === '상시' && (
                                                                <TouchableOpacity onPress={addTimeSlot} className="bg-brand-accent/20 py-4 rounded-xl border border-brand-accent/40 items-center"><Text className="text-brand-accent font-bold">상시 진행으로 등록</Text></TouchableOpacity>
                                                            )}
                                                        </View>
                                                    )}
                                                </View>
                                            )}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>

                            {/* Fixed Action Footer with background */}
                            <View className={`px-6 pt-4 pb-6 border-t ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`} style={{ zIndex: 100 }}>
                                <View className="flex-row gap-4">
                                    <TouchableOpacity
                                        onPress={handleDeleteSchedule}
                                        className={`flex-1 ${isDark ? 'bg-slate-800/30' : 'bg-slate-100'} py-3.5 rounded-2xl border ${isDark ? 'border-slate-700' : 'border-slate-200'} items-center active:scale-[0.98] transition-all`}
                                    >
                                        <Text className={`${isDark ? 'text-slate-600' : 'text-slate-400'} font-bold text-sm`}>설정 초기화</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={saveSchedule}
                                        className="flex-[2] bg-sky-500 py-3.5 rounded-2xl items-center shadow-xl shadow-sky-500/40 active:scale-[0.98] transition-all"
                                    >
                                        <Text className="text-white font-black text-base">저장하기</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>
                {/* Attendee Modal */}
                <Modal visible={attendeeModalVisible} transparent animationType="slide" >
                    <View className="flex-1 bg-black/90 pt-16">
                        <View className={`flex-1 rounded-t-[40px] border-t ${isDark ? 'bg-slate-900 border-slate-700 shadow-2xl' : 'bg-white border-slate-100 shadow-2xl'}`}>
                            <View className={`h-16 flex-row items-center justify-between px-6 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{managedEvent?.title} 명단 관리</Text>
                                <View className="flex-row items-center">
                                    {isAdmin && (
                                        <TouchableOpacity
                                            onPress={addAttendeeRow}
                                            className={`mr-3 px-3 py-2 rounded-full border flex-row items-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}
                                        >
                                            <Ionicons name="add" size={14} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginRight: 4 }} />
                                            <Text className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                영주 추가
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity onPress={() => setAttendeeModalVisible(false)} className={`p-2 rounded-full border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                                        <Ionicons name="close" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <FlatList
                                data={bulkAttendees}
                                keyExtractor={(item, index) => item.id || index.toString()}
                                renderItem={({ item: attendee, index }) => {
                                    return (
                                        <View
                                            style={{ zIndex: bulkAttendees.length - index, elevation: bulkAttendees.length - index }}
                                            className={`mb-4 p-4 rounded-2xl border relative ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}
                                        >
                                            <View className="flex-row items-center mb-3" style={{ zIndex: 50, elevation: 50 }}>
                                                <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                                                    <Text className={`font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>{index + 1}</Text>
                                                </View>
                                                <View className="flex-1">
                                                    <MemberPicker
                                                        value={attendee.name}
                                                        onSelect={(v) => updateAttendeeField(attendee.id!, 'name', v)}
                                                        members={members}
                                                        isAdmin={!!isAdmin}
                                                        setOverlayContent={setOverlayContent}
                                                    />
                                                    {attendee.penalty && (
                                                        <Text className="text-[10px] text-red-500 mt-1 font-bold ml-1">
                                                            {attendee.penalty === 'NO_SHOW' ? '⛔ 무단 불참 (페널티)' : '⚠️ 사전 통보'}
                                                        </Text>
                                                    )}
                                                </View>
                                                {!!isAdmin && (
                                                    <View className="flex-row items-center ml-2">
                                                        <TouchableOpacity
                                                            onPress={() => applyPenalty(attendee.id!, attendee.name)}
                                                            className={`p-3 rounded-xl border mr-2 ${attendee.penalty === 'NO_SHOW' ? 'bg-red-500/20 border-red-500' : (attendee.penalty === 'NOTICE' ? 'bg-yellow-500/20 border-yellow-500' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'))}`}
                                                        >
                                                            <Ionicons
                                                                name={attendee.penalty ? "skull" : "skull-outline"}
                                                                size={16}
                                                                color={attendee.penalty === 'NO_SHOW' ? '#ef4444' : (attendee.penalty === 'NOTICE' ? '#eab308' : (isDark ? '#94a3b8' : '#64748b'))}
                                                            />
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => deleteAttendee(attendee.id!)} className={`p-3 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-100'}`}>
                                                            <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>

                                            <View className="flex-row space-x-2 pointer-events-auto" style={{ zIndex: 1 }}>
                                                <HeroPicker label="HERO 1" value={attendee.hero1 || ''} onSelect={(v) => updateAttendeeField(attendee.id!, 'hero1', v)} />
                                                <HeroPicker label="HERO 2" value={attendee.hero2 || ''} onSelect={(v) => updateAttendeeField(attendee.id!, 'hero2', v)} />
                                                <HeroPicker label="HERO 3" value={attendee.hero3 || ''} onSelect={(v) => updateAttendeeField(attendee.id!, 'hero3', v)} />
                                            </View>
                                        </View>
                                    )
                                }}
                                ListEmptyComponent={
                                    <View className="items-center justify-center py-10 opacity-50">
                                        <Ionicons name="documents-outline" size={48} color="#94a3b8" />
                                        <Text className="text-slate-400 mt-4 font-semibold">등록된 참석 명단이 없습니다.</Text>
                                        <Text className="text-slate-600 text-xs mt-1">관리자가 명단을 추가하면 여기에 표시됩니다.</Text>
                                    </View>
                                }
                                ListFooterComponent={null}
                                contentContainerStyle={{ padding: 16, paddingBottom: 150 }}
                                style={{ flex: 1 }}
                                showsVerticalScrollIndicator={true}
                                persistentScrollbar={true}
                                indicatorStyle={isDark ? 'white' : 'black'}
                                removeClippedSubviews={false}
                                keyboardShouldPersistTaps="handled"
                                initialNumToRender={50}
                                maxToRenderPerBatch={50}
                                windowSize={21}
                            />

                            <View className={`p-6 border-t ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                {isAdmin ? (
                                    <TouchableOpacity onPress={saveAttendees} className="bg-blue-600 w-full py-4 rounded-2xl items-center shadow-lg shadow-blue-600/20">
                                        <Text className="text-white font-bold text-lg">명단 저장 ({bulkAttendees.filter(a => a.name?.trim()).length}명)</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View className="w-full py-4 items-center">
                                        <Text className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>관리자만 명단을 수정할 수 있습니다.</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                    {overlayContent}
                    {penaltyTarget && (
                        <View className="absolute inset-0 z-50 items-center justify-center bg-black/60">
                            <View className={`w-80 p-6 rounded-[32px] border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`} style={{ elevation: 100 }}>
                                <View className="items-center mb-6">
                                    <View className={`w-12 h-12 rounded-full items-center justify-center mb-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                        <Ionicons name="skull" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
                                    </View>
                                    <Text className={`text-lg font-bold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                        {penaltyTarget.name}
                                    </Text>
                                    <Text className={`text-sm mt-1 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        불참 사유를 선택해주세요
                                    </Text>
                                </View>

                                <View className="space-y-3 w-full">
                                    <TouchableOpacity
                                        onPress={() => {
                                            updateAttendeeField(penaltyTarget.id, 'penalty', 'NOTICE');
                                            setPenaltyTarget(null);
                                        }}
                                        className="w-full py-4 bg-yellow-500/10 border border-yellow-500/50 rounded-2xl items-center flex-row justify-center"
                                    >
                                        <Ionicons name="warning" size={18} color="#eab308" style={{ marginRight: 8 }} />
                                        <Text className="text-yellow-500 font-bold">⚠️ 사전 통보 (참작)</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => {
                                            updateAttendeeField(penaltyTarget.id, 'penalty', 'NO_SHOW');
                                            setPenaltyTarget(null);
                                        }}
                                        className="w-full py-4 bg-red-500/10 border border-red-500/50 rounded-2xl items-center flex-row justify-center"
                                    >
                                        <Ionicons name="skull" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                                        <Text className="text-red-500 font-bold">⛔ 무단 불참 (페널티)</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => {
                                            updateAttendeeField(penaltyTarget.id, 'penalty', '');
                                            setPenaltyTarget(null);
                                        }}
                                        className={`w-full py-4 border rounded-2xl items-center flex-row justify-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                                    >
                                        <Ionicons name="refresh" size={18} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginRight: 8 }} />
                                        <Text className={`font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>상태 초기화</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => setPenaltyTarget(null)}
                                        className="w-full py-3 items-center mt-2"
                                    >
                                        <Text className={isDark ? 'text-slate-500' : 'text-slate-400'}>취소</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
                </Modal>

                {/* Wiki Browser Modal (Web Only) */}
                <Modal visible={browserVisible && Platform.OS === 'web'
                } animationType="slide" transparent={false} >
                    <View className="flex-1 bg-white">
                        <View className="h-16 bg-slate-900 flex-row items-center justify-between px-4 border-b border-slate-700">
                            <View className="flex-row items-center flex-1 mr-4">
                                <Text className="text-white font-semibold mr-2">🌐 WIKI</Text>
                                <Text className="text-slate-400 text-xs truncate flex-1" numberOfLines={1}>{currentWikiUrl}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setBrowserVisible(false)}
                                className="bg-slate-700 px-4 py-2 rounded-lg hover:bg-slate-600"
                            >
                                <Text className="text-white font-semibold text-sm">닫기 ✖️</Text>
                            </TouchableOpacity>
                        </View>
                        <View className="flex-1 bg-slate-100">
                            {Platform.OS === 'web' && (
                                React.createElement('iframe', {
                                    src: currentWikiUrl,
                                    style: { width: '100%', height: '100%', border: 'none' },
                                    title: "Wiki Content"
                                })
                            )}
                        </View>
                    </View>
                </Modal>
                {/* Custom Alert Modal */}
                <Modal visible={customAlert.visible} transparent animationType="fade" onRequestClose={() => setCustomAlert({ ...customAlert, visible: false })}>
                    <View className="flex-1 bg-black/60 items-center justify-center p-6">
                        {Platform.OS === 'web' ? (
                            <View className="absolute inset-0 bg-black/40" />
                        ) : (
                            <BlurView intensity={20} className="absolute inset-0" />
                        )}
                        <View className={`w-full max-w-sm p-8 rounded-[40px] border shadow-2xl items-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                            <View className={`w-20 h-20 rounded-full items-center justify-center mb-6 ${customAlert.type === 'success' ? 'bg-emerald-500/10' : (customAlert.type === 'error' || customAlert.type === 'confirm') ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                                <Ionicons
                                    name={customAlert.type === 'success' ? 'checkmark-circle' : (customAlert.type === 'error' || customAlert.type === 'confirm') ? 'alert-circle' : 'warning'}
                                    size={48}
                                    color={customAlert.type === 'success' ? '#10b981' : (customAlert.type === 'error' || customAlert.type === 'confirm') ? '#ef4444' : '#fbbf24'}
                                />
                            </View>
                            <Text className={`text-2xl font-bold mb-4 text-center ${isDark ? 'text-white' : 'text-slate-800'}`}>{customAlert.title}</Text>
                            <Text className={`text-center mb-8 text-lg leading-7 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {customAlert.message}
                            </Text>

                            {customAlert.type === 'confirm' ? (
                                <View className="flex-row gap-3 w-full">
                                    <TouchableOpacity
                                        onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                                        className={`flex-1 py-4 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                                    >
                                        <Text className={`text-center font-bold text-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>취소</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setCustomAlert({ ...customAlert, visible: false });
                                            if (customAlert.onConfirm) customAlert.onConfirm();
                                        }}
                                        className="flex-1 py-4 bg-red-600 rounded-2xl"
                                    >
                                        <Text className="text-white text-center font-bold text-lg">삭제</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => {
                                        setCustomAlert({ ...customAlert, visible: false });
                                        if (customAlert.onConfirm) customAlert.onConfirm();
                                    }}
                                    className={`py-4 w-full rounded-2xl ${customAlert.type === 'success' ? 'bg-emerald-600' : customAlert.type === 'error' ? 'bg-red-600' : 'bg-amber-600'}`}
                                >
                                    <Text className="text-white text-center font-bold text-lg">확인</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </Modal>

                {/* Date Picker Modal */}
                <Modal visible={!!showDatePicker} transparent animationType="fade">
                    <View className="flex-1 bg-black/60 items-center justify-center p-6">
                        <TouchableOpacity activeOpacity={1} onPress={() => setShowDatePicker(null)} className="absolute inset-0" />
                        {(() => {
                            const selectedValue = showDatePicker === 'start' ? mStart : mEnd;
                            const [selY, selM, selD] = (selectedValue.split(' ')[0] || '').split('.').map(v => parseInt(v));

                            const year = viewDate.getFullYear();
                            const month = viewDate.getMonth();
                            const firstDay = new Date(year, month, 1).getDay();
                            const daysInMonth = new Date(year, month + 1, 0).getDate();

                            const days = [];
                            for (let i = 0; i < firstDay; i++) days.push(null);
                            for (let i = 1; i <= daysInMonth; i++) days.push(i);

                            const changeMonth = (offset: number) => {
                                setViewDate(new Date(year, month + offset, 1));
                            };

                            return (
                                <View className={`w-full max-w-sm rounded-[32px] overflow-hidden border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                                    {/* Calendar Header */}
                                    <View className="flex-row items-center justify-between p-6 border-b border-slate-800/10">
                                        <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{year}년 {KR_MONTHS[month]}</Text>
                                        <View className="flex-row gap-2">
                                            <TouchableOpacity onPress={() => changeMonth(-1)} className={`p-2 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}><Ionicons name="chevron-back" size={20} color="#38bdf8" /></TouchableOpacity>
                                            <TouchableOpacity onPress={() => changeMonth(1)} className={`p-2 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}><Ionicons name="chevron-forward" size={20} color="#38bdf8" /></TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Days Header */}
                                    <View className="flex-row px-4 pt-4">
                                        {KR_DAYS.map((d, i) => (
                                            <View key={d} className="flex-1 items-center"><Text className={`text-[11px] font-black ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'} uppercase tracking-tighter`}>{d}</Text></View>
                                        ))}
                                    </View>

                                    {/* Calendar Grid */}
                                    <View className="flex-row flex-wrap px-4 py-4">
                                        {days.map((day, idx) => {
                                            const isSelected = day === selD && (month + 1) === selM && year === selY;
                                            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

                                            return (
                                                <TouchableOpacity
                                                    key={idx}
                                                    onPress={() => {
                                                        if (!day) return;
                                                        const dateStr = `${year}.${(month + 1).toString().padStart(2, '0')}.${day.toString().padStart(2, '0')}`;
                                                        const timePart = selectedValue.split(' ')[1] || '00:00';
                                                        if (showDatePicker === 'start') setMStart(`${dateStr} ${timePart}`);
                                                        else setMEnd(`${dateStr} ${timePart}`);
                                                        setShowDatePicker(null);
                                                    }}
                                                    className="w-[14.28%] aspect-square items-center justify-center p-1"
                                                >
                                                    {day && (
                                                        <View className={`w-full h-full rounded-xl items-center justify-center ${isSelected ? 'bg-sky-500' : isToday ? 'bg-sky-500/10 border border-sky-500/30' : ''}`}>
                                                            <Text className={`text-sm font-bold ${isSelected ? 'text-white' : isToday ? 'text-sky-400' : isDark ? (idx % 7 === 0 ? 'text-red-400' : idx % 7 === 6 ? 'text-blue-400' : 'text-slate-400') : (idx % 7 === 0 ? 'text-red-500' : idx % 7 === 6 ? 'text-blue-500' : 'text-slate-700')}`}>
                                                                {day}
                                                            </Text>
                                                        </View>
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    <TouchableOpacity
                                        onPress={() => setShowDatePicker(null)}
                                        className={`py-5 items-center border-t ${isDark ? 'border-slate-800' : 'border-slate-100'} active:bg-sky-500/5`}
                                    >
                                        <Text className="text-slate-500 font-bold">닫기</Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })()}
                    </View>
                </Modal>


                {/* Warning Modal for Unsaved Changes */}
                <Modal visible={warningModalVisible} transparent animationType="fade" onRequestClose={() => setWarningModalVisible(false)}>
                    <View className="flex-1 bg-black/60 items-center justify-center p-6">
                        {Platform.OS === 'web' ? (
                            <View className="absolute inset-0 bg-black/40" />
                        ) : (
                            <BlurView intensity={20} className="absolute inset-0" />
                        )}
                        <View className={`w-full max-w-sm p-6 rounded-[32px] border shadow-2xl items-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                            <View className="w-16 h-16 rounded-full items-center justify-center mb-4 bg-amber-500/10">
                                <Ionicons name="warning" size={32} color="#fbbf24" />
                            </View>
                            <Text className={`text-xl font-bold mb-3 text-center ${isDark ? 'text-white' : 'text-slate-800'}`}>저장되지 않은 변경사항</Text>
                            <Text className={`text-center mb-6 text-sm leading-6 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                현재 탭에 저장되지 않은 변경사항이 있습니다.{'\n'}저장하지 않고 이동하시겠습니까?
                            </Text>

                            <View className="flex-row gap-3 w-full">
                                <TouchableOpacity
                                    onPress={() => {
                                        setWarningModalVisible(false);
                                        setPendingTab(null);
                                    }}
                                    className={`flex-1 py-3 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                                >
                                    <Text className={`text-center font-bold text-base ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>취소</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        setWarningModalVisible(false);
                                        if (pendingTab) setActiveTab(pendingTab);
                                        setPendingTab(null);
                                    }}
                                    className="flex-1 py-3 bg-amber-500 rounded-xl"
                                >
                                    <Text className="text-white text-center font-bold text-base">이동</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View >
        </View >
    );
}
