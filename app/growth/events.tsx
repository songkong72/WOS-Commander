import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, Image, Modal, TextInput, Alert, FlatList, ActivityIndicator, useWindowDimensions, Linking, Platform, Pressable, Animated, Dimensions, Switch } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth, useTheme } from '../context';
import { useTranslation } from 'react-i18next';
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
// Note: Dates and days are localized using t() keys in the render logic

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
    'alliance_champion',
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

const DATE_RANGE_IDS = [
    'a_castle', 'server_castle', 'a_operation', 'alliance_operation',
    'a_trade', 'alliance_trade', 'alliance_champion', 'a_weapon',
    'alliance_frost_league', 'server_svs_prep', 'server_svs_battle',
    'server_immigrate', 'server_merge', 'a_mobilization', 'alliance_mobilization'
];

import TimelineView from '../../components/TimelineView';

// Set notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

const HERO_NAMES = heroesData.map(h => h.name);
// Note: Options are localized in the render function using t()
const FORTRESS_IDS = Array.from({ length: 12 }, (_, i) => `fortress_${i + 1}`);
const CITADEL_IDS = Array.from({ length: 4 }, (_, i) => `citadel_${i + 1}`);

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

const toLocal = (kstStr: string) => {
    const userOffset = -new Date().getTimezoneOffset();
    const kstOffset = 540; // UTC+9
    return processConversion(kstStr, userOffset - kstOffset);
};

const toUTC = (kstStr: string) => {
    return processConversion(kstStr, -540);
};

const processConversion = (str: string, diffMinutes: number) => {
    if (!str || diffMinutes === 0) return str;

    // 1. 기간형 (2024.01.01 10:00)
    let processed = str.replace(/(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{1,2}:\d{2})/g, (match, y, m, d, timePart) => {
        const [h, min] = timePart.split(':');
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min));
        if (isNaN(date.getTime())) return match;
        const converted = new Date(date.getTime() + diffMinutes * 60000);
        return `${converted.getFullYear()}.${pad(converted.getMonth() + 1)}.${pad(converted.getDate())} ${pad(converted.getHours())}:${pad(converted.getMinutes())}`;
    });

    // 2. 주간 요일형 (화(22:00), 매일(10:00))
    processed = processed.replace(/([일월화수목금토]|[매일])\s*\(?(\d{1,2}):(\d{2})\)?/g, (match, day, h, m) => {
        const hour = parseInt(h);
        const min = parseInt(m);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        let dayIdx = days.indexOf(day);

        if (dayIdx === -1) { // '매일'
            let totalMin = hour * 60 + min + diffMinutes;
            while (totalMin < 0) totalMin += 1440;
            totalMin %= 1440;
            const newH = Math.floor(totalMin / 60);
            const newM = totalMin % 60;
            return `${day}(${pad(newH)}:${pad(newM)})`;
        }

        let totalMin = dayIdx * 1440 + hour * 60 + min + diffMinutes;
        while (totalMin < 0) totalMin += 10080;
        totalMin %= 10080;

        const newDayIdx = Math.floor(totalMin / 1440);
        const remain = totalMin % 1440;
        const newH = Math.floor(remain / 60);
        const newM = remain % 60;
        return `${days[newDayIdx]}(${pad(newH)}:${pad(newM)})`;
    });

    return processed;
};


const formatDisplayDate = (str: string, t: any, mode: 'LOCAL' | 'UTC' = 'LOCAL') => {
    if (!str) return '';
    const converted = mode === 'LOCAL' ? toLocal(str) : toUTC(str);

    // YYYY.MM.DD HH:mm 형식이면 리포맷팅, 아니면 그대로 반환 (단일 날짜만 매칭되도록 앵커링)
    const match = converted.match(/^(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{1,2}:\d{2})$/);
    if (match) {
        const [_, y, m, d, timePart] = match;
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const dayStr = t(`events.days.${days[date.getDay()]}`);
        return `${pad(parseInt(m))}/${pad(parseInt(d))}(${dayStr}) ${timePart}`;
    }
    return converted;
};

const formatTime12h = (timeStr: string, t: any) => {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr || '0');
    const m = parseInt(mStr || '0');
    const isPM = h >= 12;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = isPM ? t('common.pm') : t('common.am');
    return `${ampm} ${h12}:${m.toString().padStart(2, '0')}`;
};

interface EventCardProps {
    event: WikiEvent;
    isDark: boolean;
    timezone: 'LOCAL' | 'UTC';
    auth: any;
    isAdmin: boolean;
    isOngoing: boolean;
    isExpired: boolean;
    selectedTeamTab: number;
    checkItemOngoing: (str: string) => boolean;
    openScheduleModal: (event: WikiEvent) => void;
    openGuideModal: (event: WikiEvent) => void;
    openAttendeeModal: (event: WikiEvent, groupIndex?: number) => void;
    openWikiLink: (url: string) => void;
    onSetSelectedTeamTab: (idx: number) => void;
    onLayout: (y: number) => void;
}

const WheelPicker = ({ options, value, onChange, isDark, width, showHighlight = true, syncKey }: any) => {
    const itemHeight = 44;
    const flatListRef = useRef<FlatList>(null);
    const [localActiveValue, setLocalActiveValue] = useState(value);
    const lastSyncedKey = useRef(syncKey);
    const isFirstRun = useRef(true);
    const isLayoutReady = useRef(false);



    const getLabel = (opt: any) => (typeof opt === 'object' ? opt.label : opt);
    const getValue = (opt: any) => (typeof opt === 'object' ? opt.value : opt);

    // Simplified to 3 blocks for better stability and predictable math
    const infiniteOptions = useMemo(() => [...options, ...options, ...options], [options]);
    const centerOffset = options.length; // Start at the second block

    const scrollToIndex = (index: number, animated = true) => {
        if (!flatListRef.current) return;
        flatListRef.current.scrollToOffset({
            offset: index * itemHeight,
            animated
        });
    };

    // Robust Sync Logic
    useEffect(() => {
        const valStr = String(value || '').trim();
        const localStr = String(localActiveValue || '').trim();

        const forceSync = syncKey !== undefined && syncKey !== lastSyncedKey.current;
        const valueChanged = valStr !== localStr;
        const shouldSync = isFirstRun.current || forceSync || valueChanged;

        if (shouldSync) {
            isFirstRun.current = false;
            lastSyncedKey.current = syncKey;
            setLocalActiveValue(value);

            const realIndex = options.findIndex((o: any) => String(getValue(o)).trim() === valStr);
            if (realIndex !== -1) {
                const performScroll = () => {
                    if (flatListRef.current) {
                        scrollToIndex(realIndex + centerOffset, false);
                    }
                };

                const timers = [
                    setTimeout(performScroll, 50),
                    setTimeout(performScroll, 150),
                    setTimeout(performScroll, 300),
                ];
                return () => timers.forEach(clearTimeout);
            }
        }
    }, [value, syncKey, options]);

    const handleScroll = (e: any) => {
        const offset = e.nativeEvent.contentOffset.y;
        const index = Math.round(offset / itemHeight);
        if (index >= 0 && index < infiniteOptions.length) {
            const currentItem = infiniteOptions[index];
            const currentVal = getValue(currentItem);
            if (currentVal !== localActiveValue) {
                setLocalActiveValue(currentVal);
            }
        }
    };

    const handleScrollEnd = (e: any) => {
        const offset = e.nativeEvent.contentOffset.y;
        const index = Math.round(offset / itemHeight);

        if (index < 0 || index >= infiniteOptions.length) return;

        const selectedItem = infiniteOptions[index];
        const selectedVal = getValue(selectedItem);
        const realIndex = index % options.length;

        if (selectedVal !== value) {
            onChange(selectedVal);
        }

        // Always snap back to the middle block
        const targetIndex = realIndex + centerOffset;
        if (index !== targetIndex) {
            setTimeout(() => scrollToIndex(targetIndex, false), 10);
        }
    };

    return (
        <View style={{ width, height: itemHeight * 3, overflow: 'hidden' }} className="relative">
            <LinearGradient
                colors={isDark ? ['#0f172a', '#0f172a90', 'transparent'] : ['#f8fafc', '#f8fafc90', 'transparent']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: itemHeight * 0.6, zIndex: 20 }}
                pointerEvents="none"
            />
            <LinearGradient
                colors={isDark ? ['transparent', '#0f172a90', '#0f172a'] : ['transparent', '#f8fafc90', '#f8fafc']}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: itemHeight * 0.6, zIndex: 20 }}
                pointerEvents="none"
            />
            {showHighlight && (
                <View pointerEvents="none" style={{ position: 'absolute', top: itemHeight, left: 4, right: 4, height: itemHeight, backgroundColor: isDark ? '#38bdf815' : '#38bdf805', borderRadius: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: isDark ? '#38bdf830' : '#38bdf820', zIndex: 10 }} />
            )}

            <FlatList
                ref={flatListRef}
                data={infiniteOptions}
                keyExtractor={(_, idx) => idx.toString()}
                showsVerticalScrollIndicator={false}
                snapToInterval={itemHeight}
                snapToAlignment="center"
                decelerationRate="fast"
                disableIntervalMomentum={true}
                contentContainerStyle={{ paddingVertical: itemHeight }}
                onScroll={handleScroll}
                scrollEventThrottle={16}
                onMomentumScrollEnd={handleScrollEnd}
                onScrollEndDrag={handleScrollEnd}
                onLayout={() => {
                    isLayoutReady.current = true;
                    const valStr = String(value || '').trim();
                    const realIndex = options.findIndex((o: any) => String(getValue(o)).trim() === valStr);
                    if (realIndex !== -1) {
                        setTimeout(() => scrollToIndex(realIndex + centerOffset, false), 50);
                    }
                }}
                renderItem={({ item, index }) => {

                    const isSelected = localActiveValue === getValue(item);
                    return (
                        <TouchableOpacity
                            onPress={() => {
                                if (value !== getValue(item)) {
                                    onChange(getValue(item));
                                }
                                scrollToIndex(index, true);
                            }}
                            style={{ height: itemHeight, alignItems: 'center', justifyContent: 'center' }}
                            activeOpacity={0.7}
                        >
                            <Text
                                className={`font-black ${isSelected ? (isDark ? 'text-sky-400 text-xl' : 'text-sky-600 text-xl') : (isDark ? 'text-white text-base' : 'text-slate-500 text-base')}`}
                                style={{
                                    opacity: isSelected ? 1 : 0.7,
                                    textShadowColor: isDark ? 'rgba(0,0,0,0.3)' : 'transparent',
                                    textShadowOffset: { width: 0, height: 1 },
                                    textShadowRadius: 2
                                }}
                            >
                                {getLabel(item)}
                            </Text>
                        </TouchableOpacity>
                    );
                }}
            />
        </View>
    );
};


const EventCard = memo(({
    event, isDark, timezone, auth, isAdmin, isOngoing, isExpired, selectedTeamTab,
    checkItemOngoing, openScheduleModal, openGuideModal, openAttendeeModal, openWikiLink,
    onSetSelectedTeamTab, onLayout
}: EventCardProps) => {
    const { t } = useTranslation();
    const { fontSizeScale } = useTheme();
    const [guideHover, setGuideHover] = useState(false);
    const [attendHover, setAttendHover] = useState(false);
    const [wikiHover, setWikiHover] = useState(false);

    const isUpcoming = !isOngoing && !isExpired;
    const textColor = isUpcoming ? (isDark ? 'text-slate-400' : 'text-slate-500') : (isDark ? 'text-white' : 'text-slate-900');

    const renderStartEndPeriod = (str: string, textClass: string, isUtc = false) => {
        const formatted = formatDisplayDate(str, t, isUtc ? 'UTC' : 'LOCAL');

        const renderStyledDate = (dateStr: string) => {
            // Match pattern like "02/16(월) 09:00"
            const match = dateStr.match(/^(\d{2}\/\d{2})\((.*?)\)\s+(.*)$/);
            if (match) {
                const [_, datePart, dayPart, timePart] = match;
                return (
                    <View className="flex-row items-center">
                        <Text className={`${textClass} font-bold`} style={{ fontSize: 16 * fontSizeScale }}>{datePart}</Text>
                        <Text className={`mx-0.5 font-black ${isDark ? 'text-sky-400' : 'text-sky-600'}`} style={{ fontSize: 14 * fontSizeScale }}>({dayPart})</Text>
                        <Text className={`${textClass} font-bold ml-1`} style={{ fontSize: 16 * fontSizeScale }}>{timePart}</Text>
                    </View>
                );
            }
            return <Text className={`${textClass} font-medium`} style={{ fontSize: 16 * fontSizeScale }}>{dateStr}</Text>;
        };

        if (!str.includes('~')) return (
            <View className="flex-row items-center">
                <View className="mr-3">
                    <ShimmerIcon isDark={isDark} colors={{ bg: isDark ? '#1e3a5f' : '#dbeafe', shadow: isDark ? '#38bdf8' : '#0284c7', shimmer: isDark ? '#38bdf8' : '#60a5fa' }}>
                        <Ionicons name="calendar-clear" size={18} color={isDark ? '#38bdf8' : '#0284c7'} />
                    </ShimmerIcon>
                </View>
                {renderStyledDate(formatted)}
            </View>
        );

        const parts = str.split('~').map(s => s.trim());
        const startFormatted = formatDisplayDate(parts[0], t, isUtc ? 'UTC' : 'LOCAL');
        const endFormatted = formatDisplayDate(parts[1], t, isUtc ? 'UTC' : 'LOCAL');

        return (
            <View className="gap-3">
                <View className="flex-row items-center">
                    <View className={`px-2.5 py-1.5 rounded-xl border mr-3 items-center justify-center shadow-sm ${isDark ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-emerald-50 border-emerald-100'}`} style={{ shadowColor: '#10b981', shadowOpacity: isDark ? 0.3 : 0.1, shadowRadius: 4, elevation: 2 }}>
                        <Text className={`font-black ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`} style={{ fontSize: 10 * fontSizeScale }}>{t('common.start')}</Text>
                    </View>
                    {renderStyledDate(startFormatted)}
                </View>
                <View className="flex-row items-center">
                    <View className={`px-2.5 py-1.5 rounded-xl border mr-3 items-center justify-center shadow-sm ${isDark ? 'bg-rose-500/20 border-rose-500/40' : 'bg-rose-50 border-rose-100'}`} style={{ shadowColor: '#f43f5e', shadowOpacity: isDark ? 0.3 : 0.1, shadowRadius: 4, elevation: 2 }}>
                        <Text className={`font-black ${isDark ? 'text-rose-300' : 'text-rose-600'}`} style={{ fontSize: 10 * fontSizeScale }}>{t('common.end')}</Text>
                    </View>
                    {renderStyledDate(endFormatted)}
                </View>
            </View>
        );
    };

    const { width: windowWidth } = useWindowDimensions();
    const isTwoColumn = windowWidth >= 480;

    return (
        <View
            style={{ width: isTwoColumn ? '50%' : '100%', padding: 8, opacity: 1 }}
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
                className={`rounded-[24px] mb-4 overflow-hidden transition-all ${isOngoing ? (isDark ? 'bg-[#191F28] border border-blue-500/30' : 'bg-white shadow-lg shadow-blue-500/10 border border-blue-100') : (isUpcoming ? (isDark ? 'bg-[#191F28] border border-[#333D4B]' : 'bg-white border border-[#E5E8EB] shadow-sm') : (isDark ? 'bg-[#191F28]/60 border border-[#333D4B]' : 'bg-[#F9FAFB] border border-[#E5E8EB]'))}`}
            >
                {/* Strikethrough overlay removed per request */}
                <View className={`px-3 py-2 flex-col border-b ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                    <View className="flex-row items-center mb-2">
                        {event.imageUrl ? (
                            <View className={`w-10 h-10 rounded-[14px] border overflow-hidden mr-3 ${isDark ? 'border-[#333D4B] bg-[#191F28]' : 'border-[#E5E8EB] bg-[#F2F4F6]'}`}>
                                <Image source={typeof event.imageUrl === 'string' ? { uri: event.imageUrl } : event.imageUrl} className="w-full h-full" resizeMode="cover" />
                            </View>
                        ) : (
                            <View className={`w-10 h-10 rounded-[14px] items-center justify-center border mr-3 ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-[#F2F4F6] border-[#E5E8EB]'}`}>
                                <Ionicons name="calendar-outline" size={20} color={isDark ? '#B0B8C1' : '#8B95A1'} />
                            </View>
                        )}
                        <Text className={`font-bold flex-1 ${textColor}`} numberOfLines={1} style={{ letterSpacing: -0.5, fontSize: 20 * fontSizeScale }}>{t(`events.${event.id}_title`, { defaultValue: event.title })}</Text>
                        {event.wikiUrl && (
                            <Pressable
                                onPress={() => openWikiLink(event.wikiUrl || '')}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        transform: [{ scale: pressed ? 0.9 : (hovered ? 1.15 : 1) }],
                                        backgroundColor: hovered ? (isDark ? '#3b82f6' : '#2563eb') : (isDark ? '#1e293b' : '#f1f5f9'),
                                        shadowColor: '#3b82f6',
                                        shadowOffset: { width: 0, height: hovered ? 4 : 0 },
                                        shadowOpacity: hovered ? 0.5 : 0,
                                        shadowRadius: 8,
                                        elevation: hovered ? 5 : 0,
                                        cursor: 'pointer'
                                    }
                                ]}
                                className="w-8 h-8 rounded-xl items-center justify-center ml-2 border border-blue-500/20"
                            >
                                {({ hovered }: any) => (
                                    <Ionicons name="document-text" size={16} color={hovered ? '#fff' : (isDark ? '#60a5fa' : '#3b82f6')} />
                                )}
                            </Pressable>
                        )}
                    </View>
                    {/* Event Description (Added for cleaner design) */}
                    {!!event.description && (
                        <Text className={`mb-3 leading-6 ${isDark ? 'text-[#B0B8C1]' : 'text-[#4E5968]'} ${isOngoing ? (isDark ? 'text-white' : 'text-[#333D4B]') : ''}`} numberOfLines={isOngoing ? undefined : 1} style={{ fontSize: 15 * fontSizeScale }}>
                            {t(`events.${event.id}_description`, { defaultValue: event.description })}
                        </Text>
                    )}
                    <View className="flex-row items-center flex-wrap gap-2">
                        <View className={`flex-row items-center px-2 py-1 rounded-[6px] ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}>
                            <Ionicons name={event.category === '연맹' ? 'flag' : event.category === '개인' ? 'person' : event.category === '서버' ? 'earth' : event.category === '초보자' ? 'star' : 'apps'} size={12} color={isDark ? '#B0B8C1' : '#6B7684'} />
                            <Text className={`font-bold ml-1 ${isDark ? 'text-[#B0B8C1]' : 'text-[#6B7684]'}`} style={{ fontSize: 11 * fontSizeScale }}>
                                {event.category === '연맹' ? t('events.category.alliance')
                                    : event.category === '개인' ? t('events.category.individual')
                                        : event.category === '서버' ? t('events.category.server')
                                            : event.category === '초보자' ? t('events.category.beginner')
                                                : t('events.category.etc')}
                            </Text>
                        </View>
                        {isOngoing ? (
                            <View className="bg-[#E8F3FF] px-2 py-1 rounded-[6px] flex-row items-center dark:bg-[#1C2539]">
                                <Text className="text-[#3182F6] font-bold dark:text-[#4F93F7]" style={{ fontSize: 11 * fontSizeScale }}>{t('events.status.ongoing')}</Text>
                            </View>
                        ) : isExpired ? (
                            <View className={`px-2 py-1 rounded-[6px] flex-row items-center ${isDark ? 'bg-[#2C3544]' : 'bg-[#EFF1F3]'}`}>
                                <Text className={`font-bold ${isDark ? 'text-[#8B95A1]' : 'text-[#8B95A1]'}`} style={{ fontSize: 11 * fontSizeScale }}>{t('events.status.ended')}</Text>
                            </View>
                        ) : (
                            <View className={`px-2 py-1 rounded-[6px] flex-row items-center ${isDark ? 'bg-[#FFF8DD]/10' : 'bg-[#FFF8DD]'}`}>
                                <Text className={`font-bold ${isDark ? 'text-[#F2B308]' : 'text-[#9B6F03]'}`} style={{ fontSize: 11 * fontSizeScale }}>{t('events.status.upcoming')}</Text>
                            </View>
                        )}
                        {isAdmin && (
                            <ShimmerScheduleButton onPress={() => openScheduleModal(event)} isDark={isDark} />
                        )}
                    </View>
                </View>
                <View className="px-4 pt-3 pb-4 flex-1 justify-between">
                    <View className="mb-4">
                        {(!event.day && (!event.time || !event.time.trim())) ? (
                            <View className={`w-full py-6 border border-dashed rounded-2xl items-center justify-center ${isDark ? 'border-slate-800 bg-slate-900/40' : 'bg-slate-50 border-slate-100'}`}>
                                <Text className={`font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`} style={{ fontSize: 14 * fontSizeScale }}>{t('events.schedule_empty')}</Text>
                            </View>
                        ) : (
                            event.day && (!event.time || !event.time.trim() || DATE_RANGE_IDS.includes(event.id)) && event.day !== '상설' && event.day !== '상시' ? (
                                <View className={`w-full rounded-2xl border overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <View className={`${isDark ? 'bg-black/20' : 'bg-white'}`}>
                                        {event.day.split('/').map((d, dIdx) => {
                                            const cleanD = d.trim();
                                            const formattedDay = cleanD.replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                            return (
                                                <View key={dIdx} className={`px-4 py-3 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'} last:border-0`}>
                                                    {renderStartEndPeriod(formattedDay, `${isDark ? 'text-slate-100' : 'text-slate-800'}`, timezone === 'UTC')}
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            ) : null
                        )}
                        {event.time && (() => {
                            const isBearOrFoundry = event.id === 'a_bear' || event.id === 'alliance_bear' || event.id === 'a_foundry' || event.id === 'alliance_foundry' || event.id === 'alliance_canyon';
                            const parts = event.time.split(' / ').filter((p: string) => p.trim());
                            const hasMultipleParts = parts.length > 1;
                            const selectedTab = selectedTeamTab || 0;
                            if (isBearOrFoundry && hasMultipleParts) {
                                const getTabLabel = (part: string, idx: number) => {
                                    const trimmed = part.trim();
                                    const cleaned = trimmed.replace(/.*(요새전|성채전)[:\s：]*/, '').trim();
                                    const formatted = cleaned.replace(/(요새|성채)(\d+)/g, '$1 $2').trim();

                                    const colonIdx = formatted.indexOf(':');
                                    if (colonIdx > -1) {
                                        const isTimeColon = colonIdx > 0 && /\d/.test(formatted[colonIdx - 1]) && /\d/.test(formatted[colonIdx + 1]);
                                        if (!isTimeColon) {
                                            const label = formatted.substring(0, colonIdx).trim();
                                            // Handle translation of common labels
                                            const isBear = event.id.includes('bear');
                                            if (/^(1군|Team\s*1|곰\s*1|Bear\s*1)$/i.test(label)) {
                                                return isBear ? t('events.bear1') : t('events.team1');
                                            }
                                            if (/^(2군|Team\s*2|곰\s*2|Bear\s*2)$/i.test(label)) {
                                                return isBear ? t('events.bear2') : t('events.team2');
                                            }
                                            return label;
                                        }
                                    }

                                    const nameMatch = formatted.match(/^(.*?)\s+([일월화수목금토]|[매일])/);
                                    if (nameMatch) {
                                        const label = nameMatch[1].trim();
                                        const isBear = event.id.includes('bear');
                                        if (/^(1군|Team\s*1|곰\s*1|Bear\s*1)$/i.test(label)) {
                                            return isBear ? t('events.bear1') : t('events.team1');
                                        }
                                        if (/^(2군|Team\s*2|곰\s*2|Bear\s*2)$/i.test(label)) {
                                            return isBear ? t('events.bear2') : t('events.team2');
                                        }
                                        return label;
                                    }

                                    const isBear = event.id.includes('bear');
                                    return isBear ? t(`events.bear${idx + 1}`) : `${t('events.team_unit')}${idx + 1}`;
                                };
                                const selectedContent = ((part: string | undefined) => {
                                    if (!part) return "";
                                    const trimmed = part.trim();
                                    const cleaned = trimmed.replace(/.*(요새전|성채전)[:\s：]*/, '').trim();
                                    const formatted = cleaned.replace(/(요새|성채)(\d+)/g, '$1 $2').trim();

                                    const colonIdx = formatted.indexOf(':');
                                    if (colonIdx > -1) {
                                        const isTimeColon = colonIdx > 0 && /\d/.test(formatted[colonIdx - 1]) && /\d/.test(formatted[colonIdx + 1]);
                                        if (!isTimeColon) return formatted.substring(colonIdx + 1).trim();
                                    }
                                    return formatted;
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
                                        <View className={`rounded-[16px] overflow-hidden ${isDark ? 'bg-black/20' : 'bg-[#F9FAFB]'}`}>
                                            <View className="flex-col">
                                                {selectedContent ? selectedContent.split(/[,|]/).map((item: string, iIdx: number) => {
                                                    const trimmedItem = item.trim();
                                                    const formatted = trimmedItem.replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                                    const isSlotOngoing = checkItemOngoing(trimmedItem);
                                                    return (
                                                        <View key={iIdx} className={`px-4 py-3 border-b flex-row items-center justify-between ${isDark ? 'border-[#333D4B]/50' : 'border-[#E5E8EB]'} last:border-0 ${isSlotOngoing ? (isDark ? 'bg-[#1C2539]' : 'bg-[#E8F3FF]') : ''}`}>
                                                            <View className="flex-row items-center flex-1">
                                                                {(() => {
                                                                    const displayStr = formatDisplayDate(formatted, t, timezone);
                                                                    const dtMatch = displayStr.match(/^(.*?)([일월화수목금토매일상시])\s*\(?(\d{1,2}:\d{2})\)?/);

                                                                    if (dtMatch) {
                                                                        const [_, prefix, dRaw, tPart] = dtMatch;
                                                                        const dStr = dRaw === '매일' ? t('events.days.daily')
                                                                            : dRaw === '상시' ? t('events.days.always')
                                                                                : (() => {
                                                                                    const krDays = ['일', '월', '화', '수', '목', '금', '토'];
                                                                                    const enKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                                                                                    const idx = krDays.indexOf(dRaw);
                                                                                    return idx !== -1 ? t(`events.days.${enKeys[idx]}`) : dRaw;
                                                                                })();

                                                                        return (
                                                                            <View className="flex-row items-center">
                                                                                {!!prefix && prefix.trim() && (
                                                                                    <Text className={`${isDark ? 'text-slate-100' : 'text-slate-900'} font-bold text-base mr-2`}>
                                                                                        {prefix.trim()
                                                                                            .replace(/요새\s*(\d+)/, `${t('events.fortress')} $1`)
                                                                                            .replace(/성채\s*(\d+)/, `${t('events.citadel')} $1`)
                                                                                            .replace(/곰\s*(\d+)/, `${t('events.bear1').replace(/1|1군|Team\s*1/i, '')} $1`)
                                                                                        }
                                                                                    </Text>
                                                                                )}
                                                                                <Text className={`${isDark ? 'text-[#3182F6]' : 'text-[#3182F6]'} font-bold text-[15px]`}>{dStr}</Text>
                                                                                <Text className={`mx-2 ${isDark ? 'text-[#6B7684]' : 'text-[#8B95A1]'}`}>·</Text>
                                                                                <Text className={`${isDark ? 'text-[#F2F4F6]' : 'text-[#333D4B]'} font-bold text-[15px]`}>{tPart}</Text>
                                                                            </View>
                                                                        );
                                                                    }

                                                                    // Default Fallback
                                                                    return (
                                                                        <View className="flex-row items-center">
                                                                            <Text className={`${isDark ? 'text-[#F2F4F6]' : 'text-[#333D4B]'} font-bold text-[15px]`}>{displayStr}</Text>
                                                                        </View>
                                                                    );
                                                                })()}
                                                            </View>
                                                            {isSlotOngoing && (
                                                                <View className="bg-[#00ff88] px-2 py-0.5 rounded-full flex-row items-center ml-2 border border-[#00cc6a] shadow-[0_0_10px_rgba(0,255,136,0.5)]" style={{ shadowColor: '#00ff88', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 3 }}>
                                                                    <Ionicons name="flash" size={8} color="#0f172a" style={{ marginRight: 2 }} />
                                                                    <Text className="text-[#333D4B] text-[10px] font-bold ml-0.5">{t('events.status.ongoing')}</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                    );
                                                }) : (
                                                    <View className="px-4 py-8 items-center justify-center">
                                                        <Text className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('events.schedule_empty')}</Text>
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

                                        // Localize raw label if it matches common terms
                                        const displayLabel = rawLabel
                                            .replaceAll('1군', t('events.team1'))
                                            .replaceAll('2군', t('events.team2'))
                                            .replaceAll('요새전', t('events.fortress_battle'))
                                            .replaceAll('성채전', t('events.citadel_battle'))
                                            .replace(/요새\s*(\d+)/, `${t('events.fortress')} $1`)
                                            .replace(/성채\s*(\d+)/, `${t('events.citadel')} $1`);

                                        const content = rawLabel ? trimmed.substring(colonIdx + 1).trim() : trimmed;
                                        if (content === "." || !content) return null;
                                        return (
                                            <View key={idx} className={`rounded-[16px] overflow-hidden ${isDark ? 'bg-black/20' : 'bg-[#F9FAFB]'}`}>
                                                {!!rawLabel && (
                                                    <View className={`px-4 py-2 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                                                        <Text className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>{displayLabel}</Text>
                                                    </View>
                                                )}
                                                <View className="flex-col">
                                                    {content.split(/[,|]/).map((item: string, iIdx: number) => {
                                                        const trimmedItem = item.trim();
                                                        const formatted = trimmedItem.replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                                        const displayStr = formatDisplayDate(formatted, t, timezone);

                                                        // Skip detailed time display for ongoing events to achieve cleaner design emphasizing title/message
                                                        if (isOngoing) return null;

                                                        const dtMatch = displayStr.match(/^(.*?)([일월화수목금토매일상시])\s*\(?(\d{1,2}:\d{2})\)?/);

                                                        if (dtMatch) {
                                                            const [_, prefix, dRaw, tPart] = dtMatch;
                                                            const dStr = dRaw === '매일' ? t('events.days.daily')
                                                                : dRaw === '상시' ? t('events.days.always')
                                                                    : (() => {
                                                                        const krDays = ['일', '월', '화', '수', '목', '금', '토'];
                                                                        const enKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                                                                        const idx = krDays.indexOf(dRaw);
                                                                        return idx !== -1 ? t(`events.days.${enKeys[idx]}`) : dRaw;
                                                                    })();

                                                            return (
                                                                <View key={iIdx} className={`px-4 py-3 border-b flex-row items-center justify-between ${isDark ? 'border-[#333D4B]/50' : 'border-[#E5E8EB]'} last:border-0`}>
                                                                    <View className="flex-row items-center flex-1">
                                                                        {!!prefix && prefix.trim() && (
                                                                            <Text className={`${isDark ? 'text-slate-100' : 'text-slate-900'} font-bold text-base mr-2`}>
                                                                                {prefix.trim()
                                                                                    .replace(/요새\s*(\d+)/, `${t('events.fortress')} $1`)
                                                                                    .replace(/성채\s*(\d+)/, `${t('events.citadel')} $1`)
                                                                                    .replace(/곰\s*(\d+)/, `${t('events.bear1').replace(/1|1군|Team\s*1/i, '')} $1`)
                                                                                }
                                                                            </Text>
                                                                        )}
                                                                        <Text className={`${isDark ? 'text-[#3182F6]' : 'text-[#3182F6]'} font-bold text-[15px]`}>{dStr}</Text>
                                                                        <Text className={`mx-2 ${isDark ? 'text-[#6B7684]' : 'text-[#8B95A1]'}`}>·</Text>
                                                                        <Text className={`${isDark ? 'text-[#F2F4F6]' : 'text-[#333D4B]'} font-bold text-[15px]`}>{tPart}</Text>
                                                                    </View>
                                                                </View>
                                                            );
                                                        }

                                                        // Default Fallback
                                                        return (
                                                            <View key={iIdx} className={`px-4 py-3 border-b flex-row items-center justify-between ${isDark ? 'border-[#333D4B]/50' : 'border-[#E5E8EB]'} last:border-0`}>
                                                                <View className="flex-row items-center flex-1">
                                                                    <Text className={`${isDark ? 'text-[#F2F4F6]' : 'text-[#333D4B]'} font-bold text-[15px]`}>{displayStr}</Text>
                                                                </View>
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
                    <View className="flex-row gap-2 mt-4">
                        <Pressable
                            onPress={() => openGuideModal(event)}
                            onHoverIn={() => setGuideHover(true)}
                            onHoverOut={() => setGuideHover(false)}
                            className={`flex-1 h-[52px] rounded-[16px] flex-row items-center justify-center transition-all ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'} ${guideHover ? 'opacity-80' : 'opacity-100'}`}
                            style={({ pressed }: any) => [
                                {
                                    transform: [{ scale: pressed ? 0.96 : 1 }],
                                }
                            ]}
                        >
                            <Text className={`font-semibold text-[16px] ${isDark ? 'text-[#E5E8EB]' : 'text-[#4E5968]'}`}>{t('events.guide')}</Text>
                        </Pressable>
                        {(event.category === '연맹' || event.category === '서버') && (
                            <Pressable
                                onPress={() => openAttendeeModal(event, selectedTeamTab || 0)}
                                onHoverIn={() => setAttendHover(true)}
                                onHoverOut={() => setAttendHover(false)}
                                className={`flex-1 h-[52px] rounded-[16px] flex-row items-center justify-center transition-all ${isDark ? 'bg-[#3182F6]/20' : 'bg-[#E8F3FF]'} ${attendHover ? 'opacity-80' : 'opacity-100'}`}
                                style={({ pressed }: any) => [
                                    {
                                        transform: [{ scale: pressed ? 0.96 : 1 }],
                                    }
                                ]}
                            >
                                <Text className={`font-semibold text-[16px] ${isDark ? 'text-[#4F93F7]' : 'text-[#3182F6]'}`}>{t('events.attend')}</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </Pressable >
        </View >
    );
});

// Shimmer Schedule Button Component (for admin schedule button)
const ShimmerScheduleButton = memo(({ onPress, isDark }: { onPress: () => void, isDark: boolean }) => {
    const { t } = useTranslation();
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
                    <Text className="text-white text-[10px] font-bold">{t('events.set_time')}</Text>
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
const HeroPicker = memo(({ value, onSelect, num }: { value: string, onSelect: (v: string) => void, num: number }) => {
    const { t } = useTranslation();
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
            <Text className={`text-[9px] font-bold mb-1.5 ml-1 uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('events.hero_placeholder', { num })}</Text>
            <TextInput
                placeholder={t('events.no_hero')}
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
                    className={`absolute ${direction === 'up' ? 'bottom-16' : 'top-14'} left-0 right-0 rounded-2xl border max-h-64 shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
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
    const { t } = useTranslation();
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
                placeholder={t('events.member_placeholder')}
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
    const { t } = useTranslation();
    const parts = value ? value.split(' ') : [];
    const datePart = parts[0] || ''; // YYYY.MM.DD
    const timePart = parts[1] || '';
    const [h, m] = timePart ? timePart.split(':') : ['00', '00'];

    return (
        <View className="mb-6" style={{ zIndex: activeDateDropdown?.type === type ? 10000 : 1, elevation: activeDateDropdown?.type === type ? 50 : 0, overflow: 'visible' }}>
            <View className="flex-row items-center mb-3 ml-1">
                <Ionicons name={type === 'start' ? 'play-circle' : 'stop-circle'} size={14} color={type === 'start' ? '#10b981' : '#ef4444'} style={{ marginRight: 6 }} />
                <Text className={`text-[11px] font-black uppercase tracking-widest ${type === 'start' ? 'text-emerald-400' : 'text-rose-400'}`}>{label}</Text>
            </View>
            <View className="flex-row" style={{ overflow: 'visible', zIndex: activeDateDropdown?.type === type ? 10001 : 1 }}>
                {/* Date Selection */}
                <View style={{ flex: 2.2, marginRight: 8 }}>
                    <TouchableOpacity
                        onPress={() => setShowDatePicker(type)}
                        className={`${isDark ? 'bg-slate-900/60 border-slate-700/50' : 'bg-white border-slate-200'} p-3.5 rounded-2xl border flex-row justify-between items-center shadow-inner`}
                    >
                        <View className="flex-row items-center flex-1">
                            <Ionicons name="calendar" size={16} color="#38bdf8" style={{ marginRight: 10 }} />
                            <Text className={`font-semibold text-[15px] ${isDark ? 'text-white' : 'text-slate-800'} flex-1`} numberOfLines={1}>
                                {datePart ? datePart.replace(/\./g, '-') : t('common.select_date')}
                            </Text>
                        </View>
                        <Ionicons name="chevron-down" size={14} color="#475569" />
                    </TouchableOpacity>
                </View>

                {/* Hour Selection */}
                <View style={{ flex: 0.9, marginRight: 8, zIndex: (activeDateDropdown?.type === type && activeDateDropdown?.field === 'h') ? 20000 : 1, overflow: 'visible' }}>
                    <TouchableOpacity
                        onPress={() => setActiveDateDropdown(activeDateDropdown?.type === type && activeDateDropdown?.field === 'h' ? null : { type, field: 'h' })}
                        className={`${isDark ? 'bg-slate-900/60 border-slate-700/50' : 'bg-white border-slate-200'} p-3.5 rounded-2xl border flex-row justify-between items-center shadow-inner`}
                    >
                        <View className="flex-row items-center">
                            <Ionicons name="time" size={16} color="#38bdf8" style={{ marginRight: 6 }} />
                            <Text className={`font-semibold text-[15px] ${isDark ? 'text-white' : 'text-slate-800'}`}>{h}{t('common.hour')}</Text>
                        </View>
                        <Ionicons name={activeDateDropdown?.type === type && activeDateDropdown?.field === 'h' ? "chevron-up" : "chevron-down"} size={14} color="#475569" />
                    </TouchableOpacity>
                    {activeDateDropdown?.type === type && activeDateDropdown.field === 'h' && (
                        <View className={`absolute ${type === 'end' ? 'bottom-[65px]' : 'top-[65px]'} left-0 right-0 rounded-2xl border overflow-hidden shadow-2xl z-[50000] elevation-25 ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`} style={{ height: 208 }}>
                            <FlatList
                                data={Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))}
                                renderItem={({ item: hour }) => (
                                    <TouchableOpacity
                                        onPress={() => { onChange(`${datePart} ${hour}:${m}`); setActiveDateDropdown(null); }}
                                        className={`h-11 items-center justify-center border-b ${h === hour ? (isDark ? 'bg-sky-500/25 border-sky-500/20' : 'bg-sky-50 border-sky-100') : (isDark ? 'border-slate-700/30' : 'border-slate-100')}`}
                                    >
                                        <Text className={`font-bold text-sm ${h === hour ? 'text-sky-400' : (isDark ? 'text-slate-300' : 'text-slate-600')}`}>{hour}{t('common.hour')}</Text>
                                    </TouchableOpacity>
                                )}
                                keyExtractor={item => item}
                                showsVerticalScrollIndicator={true}
                                initialScrollIndex={Math.max(0, parseInt(h) - 2)}
                                getItemLayout={(_, index) => ({ length: 44, offset: 44 * index, index })}
                            />
                        </View>
                    )}
                </View>

                {/* Minute Selection */}
                <View style={{ flex: 0.9, zIndex: (activeDateDropdown?.type === type && activeDateDropdown?.field === 'min') ? 20000 : 1, overflow: 'visible' }}>
                    <TouchableOpacity
                        onPress={() => setActiveDateDropdown(activeDateDropdown?.type === type && activeDateDropdown?.field === 'min' ? null : { type, field: 'min' })}
                        className={`${isDark ? 'bg-slate-900/60 border-slate-700/50' : 'bg-white border-slate-200'} p-3.5 rounded-2xl border flex-row justify-between items-center shadow-inner`}
                    >
                        <View className="flex-row items-center">
                            <Ionicons name="time" size={16} color="#38bdf8" style={{ marginRight: 6 }} />
                            <Text className={`font-semibold text-[15px] ${isDark ? 'text-white' : 'text-slate-800'}`}>{m}{t('common.minute')}</Text>
                        </View>
                        <Ionicons name={activeDateDropdown?.type === type && activeDateDropdown?.field === 'min' ? "chevron-up" : "chevron-down"} size={14} color="#475569" />
                    </TouchableOpacity>
                    {activeDateDropdown?.type === type && activeDateDropdown.field === 'min' && (
                        <View className={`absolute ${type === 'end' ? 'bottom-[65px]' : 'top-[65px]'} left-0 right-0 rounded-2xl border overflow-hidden shadow-2xl z-[50000] elevation-25 ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`} style={{ height: 208 }}>
                            <FlatList
                                data={['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55']}
                                renderItem={({ item: min }) => (
                                    <TouchableOpacity
                                        onPress={() => { onChange(`${datePart} ${h}:${min}`); setActiveDateDropdown(null); }}
                                        className={`h-11 items-center justify-center border-b ${m === min ? (isDark ? 'bg-sky-500/25 border-sky-500/20' : 'bg-sky-50 border-sky-100') : (isDark ? 'border-slate-700/30' : 'border-slate-100')}`}
                                    >
                                        <Text className={`font-bold text-sm ${m === min ? 'text-sky-400' : (isDark ? 'text-slate-300' : 'text-slate-600')}`}>{min}{t('common.minute')}</Text>
                                    </TouchableOpacity>
                                )}
                                keyExtractor={item => item}
                                showsVerticalScrollIndicator={true}
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
    const [timezone, setTimezone] = useState<'LOCAL' | 'UTC'>('LOCAL');
    const [events, setEvents] = useState<WikiEvent[]>([...INITIAL_WIKI_EVENTS, ...ADDITIONAL_EVENTS].map(e => ({ ...e, day: '', time: '' })));
    const { auth, serverId, allianceId } = useAuth();
    const { t } = useTranslation();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';

    const [penaltyTarget, setPenaltyTarget] = useState<{ id: string, name: string } | null>(null);
    const [overlayContent, setOverlayContent] = useState<React.ReactNode | null>(null);

    const { dynamicAdmins } = useFirestoreAdmins(serverId, allianceId);
    const { schedules, loading: schedulesLoading, updateSchedule } = useFirestoreEventSchedules(serverId, allianceId);
    const { members } = useFirestoreMembers(serverId, allianceId);
    const { eventsWithAttendees } = useFirestoreEventsWithAttendees(serverId, allianceId);

    const router = useRouter();
    const params = useLocalSearchParams();

    // serverId/allianceId already provided by useAuth

    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Refs for scrolling
    const scrollViewRef = useRef<ScrollView>(null);
    const categoryScrollViewRef = useRef<ScrollView>(null);
    const itemLayouts = useRef<{ [key: string]: number }>({});
    const categoryItemLayouts = useRef<{ [key: string]: { x: number, width: number } }>({});
    const [highlightId, setHighlightId] = useState<string | null>(null);

    // Auto-centering for mobile category filter
    useEffect(() => {
        if (!isDesktop && categoryScrollViewRef.current && categoryItemLayouts.current[selectedCategory]) {
            const { x, width: itemWidth } = categoryItemLayouts.current[selectedCategory];
            const screenWidth = width;
            // Calculate center offset: item position + half width - screen center
            const scrollX = x + (itemWidth / 2) - (screenWidth / 2);
            categoryScrollViewRef.current.scrollTo({ x: Math.max(0, scrollX), animated: true });
        }
    }, [selectedCategory, isDesktop, width]);
    const hourScrollRef = useRef<ScrollView>(null);
    const minuteScrollRef = useRef<ScrollView>(null);
    const [fortressList, setFortressList] = useState<{ id: string, name: string, day?: string, h: string, m: string }[]>([]);
    const [citadelList, setCitadelList] = useState<{ id: string, name: string, day?: string, h: string, m: string }[]>([]);
    // Track selected team tab for bear/foundry events (eventId -> tab index)
    const [selectedTeamTabs, setSelectedTeamTabs] = useState<{ [eventId: string]: number }>({});
    const [activeNamePickerId, setActiveNamePickerId] = useState<string | null>(null);
    const [selectedFortressName, setSelectedFortressName] = useState<string>('');

    // Firebase Event Schedules removed from here (moved up)

    const [isSaving, setIsSaving] = useState(false);
    const [viewMode, setViewMode] = useState<'card' | 'timeline'>('card');

    // Merge Firebase schedules with initial events
    useEffect(() => {
        if (!schedulesLoading) {
            const mergedEvents = [...INITIAL_WIKI_EVENTS, ...ADDITIONAL_EVENTS].map(event => {
                const eid = (event.id || '').trim();
                const savedSchedule = schedules.find(s => {
                    const sid = (s.eventId || '').trim();
                    if (sid === eid) return true;
                    // Mappings for legacy or alternate IDs
                    const idMap: { [key: string]: string } = {
                        'a_weapon': 'alliance_frost_league',
                        'alliance_frost_league': 'a_weapon',
                        'a_operation': 'alliance_operation',
                        'alliance_operation': 'a_operation',
                        'a_joe': 'alliance_joe',
                        'alliance_joe': 'a_joe',
                        'a_champ': 'alliance_champion',
                        'alliance_champion': 'a_champ',
                        'a_citadel': 'alliance_citadel',
                        'alliance_citadel': 'a_citadel',
                        'a_fortress': 'alliance_fortress',
                        'alliance_fortress': 'a_fortress',
                        'a_bear': 'alliance_bear',
                        'alliance_bear': 'a_bear'
                    };
                    return idMap[eid] === sid;
                });

                if (savedSchedule) {
                    return {
                        ...event,
                        day: (savedSchedule.day === '.' ? '' : (savedSchedule.day || '')),
                        time: (savedSchedule.time === '.' ? '' : (savedSchedule.time || '')),
                        strategy: savedSchedule.strategy || '',
                        updatedAt: savedSchedule.updatedAt, // For Bear Hunt bi-weekly rotation
                        startDate: savedSchedule.startDate, // For one-time weekly events
                        isRecurring: savedSchedule.isRecurring,
                        recurrenceValue: savedSchedule.recurrenceValue,
                        recurrenceUnit: savedSchedule.recurrenceUnit,
                        isRecurring2: (savedSchedule as any).isRecurring2,
                        recurrenceValue2: (savedSchedule as any).recurrenceValue2,
                        recurrenceUnit2: (savedSchedule as any).recurrenceUnit2,
                        startDate2: (savedSchedule as any).startDate2
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
                // 1. Just-in-time notification (On event start)
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: t('events.notification.start_title', { title: t(`events.${event.id}_title`, { defaultValue: event.title }) }),
                        body: t('events.notification.start_body', { title: t(`events.${event.id}_title`, { defaultValue: event.title }) }),
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

                // 2. 10-minute warning notification
                let warnH = h;
                let warnM = m - 10;
                let warnWeekday = weekday;

                if (warnM < 0) {
                    warnM += 60;
                    warnH -= 1;
                    if (warnH < 0) {
                        warnH = 23;
                        // Rolling back weekday (1: Sunday, 7: Saturday)
                        warnWeekday = (warnWeekday - 2 + 7) % 7 + 1;
                    }
                }

                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: t('events.notification.warning_title', { title: t(`events.${event.id}_title`, { defaultValue: event.title }) }),
                        body: t('events.notification.warning_body', { title: t(`events.${event.id}_title`, { defaultValue: event.title }) }),
                        sound: true,
                        data: { eventId: event.id, isWarning: true },
                    },
                    trigger: {
                        weekday: warnWeekday,
                        hour: warnH,
                        minute: warnM,
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
    const [pickerSyncKey, setPickerSyncKey] = useState(0);


    // Recurrence & Date States (Separated for Team 1 and Team 2)
    const [isRecurring1, setIsRecurring1] = useState(false);
    const [recValue1, setRecValue1] = useState('1');
    const [recUnit1, setRecUnit1] = useState<'day' | 'week'>('week');
    const [enableSD1, setEnableSD1] = useState(false);
    const [eventSD1, setEventSD1] = useState('');

    const [isRecurring2, setIsRecurring2] = useState(false);
    const [recValue2, setRecValue2] = useState('1');
    const [recUnit2, setRecUnit2] = useState<'day' | 'week'>('week');
    const [enableSD2, setEnableSD2] = useState(false);
    const [eventSD2, setEventSD2] = useState('');

    const [isPermanent, setIsPermanent] = useState(false);
    const [hourDropdownVisible, setHourDropdownVisible] = useState(false);
    const [minuteDropdownVisible, setMinuteDropdownVisible] = useState(false);
    const [activeFortressDropdown, setActiveFortressDropdown] = useState<{
        id: string,
        type: 'fortress' | 'citadel' | 'h' | 'm' | 'd'
    } | null>(null);

    // Legacy/Common states for UI binding compatibility
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrenceValue, setRecurrenceValue] = useState('1');
    const [recurrenceUnit, setRecurrenceUnit] = useState<'day' | 'week'>('week');
    const [enableStartDate, setEnableStartDate] = useState(false);
    const [eventStartDate, setEventStartDate] = useState('');





    // Mobilization States
    const [mStart, setMStart] = useState('');
    const [mEnd, setMEnd] = useState('');
    const [activeDateDropdown, setActiveDateDropdown] = useState<{ type: 'start' | 'end', field: 'y' | 'm' | 'd' | 'h' | 'min' } | null>(null);
    const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | 'startDate' | null>(null);
    const [viewDate, setViewDate] = useState(new Date());

    // Sync viewDate with selectedValue when modal opens
    useEffect(() => {
        if (showDatePicker) {
            let selectedValue = '';
            if (showDatePicker === 'startDate') {
                // For startDate, convert YYYY-MM-DD to YYYY.MM.DD format
                selectedValue = eventStartDate ? eventStartDate.replace(/-/g, '.') : '';
            } else {
                selectedValue = showDatePicker === 'start' ? mStart : mEnd;
            }
            const parts = (selectedValue.split(' ')[0] || selectedValue).split('.');
            const selY = parseInt(parts[0]);
            const selM = parseInt(parts[1]);
            if (!isNaN(selY) && !isNaN(selM)) {
                setViewDate(new Date(selY, selM - 1, 1));
            }
        }
    }, [showDatePicker, mStart, mEnd, eventStartDate]);

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
    const [managedGroupIndex, setManagedGroupIndex] = useState<number>(0);

    // Grouped event IDs for identification
    const getGroupedId = (event: WikiEvent | null, index: number) => {
        if (!event) return undefined;
        // Check if event has multiple teams/slots in its time string
        const hasMultipleTeams = event.time && (event.time.includes('/') || event.time.includes('1군') || event.time.includes('2군'));
        const isKnownMultiTeam = event.id.includes('bear') || event.id.includes('foundry') || event.id.includes('canyon');

        if (!hasMultipleTeams && !isKnownMultiTeam) return event.id;
        return `${event.id}_team${index}`;
    };

    const { attendees: firestoreAttendees, loading: firestoreLoading, saveAttendeesToFirestore } = useFirestoreAttendees(getGroupedId(managedEvent, managedGroupIndex), serverId, allianceId);
    const [bulkAttendees, setBulkAttendees] = useState<Partial<Attendee>[]>([]);

    // Scheduling Logic
    const [selectedDayForSlot, setSelectedDayForSlot] = useState<string>('월');

    // Memoized options moved to top level to comply with Rules of Hooks
    const dayOptionsForPicker = useMemo(() => ['일', '월', '화', '수', '목', '금', '토'].map(d => ({
        label: t(`events.days.${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][['일', '월', '화', '수', '목', '금', '토'].indexOf(d)]}`),
        value: d
    })), [t]);

    const hourOptionsForPicker = useMemo(() => Array.from({ length: 24 }, (_, i) => pad(i)), []);
    const minuteOptionsForPicker = useMemo(() => ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'], []);


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

    // Event Time Formatting Helpers
    const getKoreanDayOfWeek = (date: Date) => {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        return t(`events.days.${days[date.getDay()]}`);
    };

    const checkItemOngoing = useCallback((str: string) => {
        if (!str) return false;
        // 월요일~일요일이 한 주 (월요일 00:00 리셋)
        const dayMapObj: { [key: string]: number } = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
        const currentDay = (now.getDay() + 6) % 7; // 월(0), 화(1), 수(2), 목(3), 금(4), 토(5), 일(6)
        const currentTotal = currentDay * 1440 + now.getHours() * 60 + now.getMinutes();
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
            // Event Expiration & Recurrence Logic (Comprehensive)
            // 1. Team 1 Recurrence
            if (event.isRecurring && event.updatedAt) {
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const refDate = new Date(event.updatedAt);
                const startOfRef = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();
                const daysDiff = Math.floor((startOfToday - startOfRef) / (24 * 60 * 60 * 1000));

                if (event.recurrenceUnit === 'day') {
                    const interval = parseInt(event.recurrenceValue || '1');
                    if (daysDiff % interval !== 0) return false;
                } else if (event.recurrenceUnit === 'week') {
                    const interval = parseInt(event.recurrenceValue || '1');
                    const weeksDiff = Math.floor(daysDiff / 7);
                    if (weeksDiff % interval !== 0) return false;
                }
            }
            // 2. Team 2 Recurrence (if applicable)
            if ((event as any).isRecurring2 && event.updatedAt) {
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const refDate = new Date(event.updatedAt);
                const startOfRef = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();
                const daysDiff = Math.floor((startOfToday - startOfRef) / (24 * 60 * 60 * 1000));

                if ((event as any).recurrenceUnit2 === 'day') {
                    const interval = parseInt((event as any).recurrenceValue2 || '1');
                    if (daysDiff % interval !== 0) return false;
                } else if ((event as any).recurrenceUnit2 === 'week') {
                    const interval = parseInt((event as any).recurrenceValue2 || '1');
                    const weeksDiff = Math.floor(daysDiff / 7);
                    if (weeksDiff % interval !== 0) return false;
                }
            }

            return checkItemOngoing(event.day || '') || checkItemOngoing(event.time || '');
        } catch (err) {
            return false;
        }
    }, [checkItemOngoing, now]);


    const checkIsExpired = useCallback((event: WikiEvent) => {
        try {
            // If it's a recurring event but not the correct cycle day, it's not "Expired" in the sense of being over, 
            // but we check expiration for the specific slots if today IS the cycle day.
            if (event.isRecurring && event.updatedAt) {
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const refDate = new Date(event.updatedAt);
                const startOfRef = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();
                const daysDiff = Math.floor((startOfToday - startOfRef) / (24 * 60 * 60 * 1000));

                if (event.recurrenceUnit === 'day') {
                    const interval = parseInt(event.recurrenceValue || '1');
                    if (daysDiff % interval !== 0) return false; // Not even an event day
                } else if (event.recurrenceUnit === 'week') {
                    const interval = parseInt(event.recurrenceValue || '1');
                    const weeksDiff = Math.floor(daysDiff / 7);
                    if (weeksDiff % interval !== 0) return false; // Not even an event week
                }
            }
            // Check for Team 2 recurrence (if applicable)
            if ((event as any).isRecurring2 && event.updatedAt) {
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                const refDate = new Date(event.updatedAt);
                const startOfRef = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();
                const daysDiff = Math.floor((startOfToday - startOfRef) / (24 * 60 * 60 * 1000));

                if ((event as any).recurrenceUnit2 === 'day') {
                    const interval = parseInt((event as any).recurrenceValue2 || '1');
                    if (daysDiff % interval !== 0) return false;
                } else if ((event as any).recurrenceUnit2 === 'week') {
                    const interval = parseInt((event as any).recurrenceValue2 || '1');
                    const weeksDiff = Math.floor(daysDiff / 7);
                    if (weeksDiff % interval !== 0) return false;
                }
            }

            // 1. startDate가 있으면 날짜 기준 판단 (우선순위 높음)
            const startDate = (event as any).startDate;
            if (startDate) {
                const timeStr = event.time || '00:00';
                const dateTimeStr = `${startDate}T${timeStr}:00`;
                const eventDateTime = new Date(dateTimeStr);
                if (!isNaN(eventDateTime.getTime())) {
                    // 이벤트 시작 후 1시간이 지나면 만료
                    const expireTime = new Date(eventDateTime.getTime() + 3600000);
                    return now > expireTime;
                }
            }
            // 1. startDate2가 있으면 날짜 기준 판단 (우선순위 높음)
            const startDate2 = (event as any).startDate2;
            if (startDate2) {
                const timeStr = event.time || '00:00'; // Assuming time is common or handled differently for team2
                const dateTimeStr = `${startDate2}T${timeStr}:00`;
                const eventDateTime = new Date(dateTimeStr);
                if (!isNaN(eventDateTime.getTime())) {
                    // 이벤트 시작 후 1시간이 지나면 만료
                    const expireTime = new Date(eventDateTime.getTime() + 3600000);
                    return now > expireTime;
                }
            }

            // 2. 기존 날짜 범위 체크
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

        // All events remain visible for management as requested by user

        base.sort((a, b) => {
            if (a.id === b.id) return 0;
            const ongoingA = isOngoingMap[a.id] ? 1 : 0;
            const ongoingB = isOngoingMap[b.id] ? 1 : 0;
            if (ongoingA !== ongoingB) return ongoingB - ongoingA;

            // Prioritize Alliance Championship
            if (a.id === 'alliance_champion') return -1;
            if (b.id === 'alliance_champion') return 1;

            if (selectedCategory === '전체') {
                const catOrder: { [key: string]: number } = { '서버': 0, '연맹': 1, '개인': 2, '초보자': 3 };
                const orderA = catOrder[a.category] ?? 99;
                const orderB = catOrder[b.category] ?? 99;
                if (orderA !== orderB) return orderA - orderB;
            }

            return 0;
        });

        return base;
    }, [events, selectedCategory, isExpiredMap, isOngoingMap, now]);

    // Timeline-specific sorted events (matching dashboard sort logic exactly)
    const timelineEvents = useMemo(() => {
        // 1. Process events (split teams for Bear Hunt, Canyon, Foundry, Fortress/Citadel)
        const processedList: any[] = [];
        filteredEvents.forEach(e => {
            if (e.id === 'a_bear' || e.id === 'alliance_bear') {
                // Split Bear Hunt into separate cards for Team 1 and Team 2
                const parts = (e.time || '').split(/\s*\/\s*/);
                if (parts.length > 0) {
                    parts.forEach((part, idx) => {
                        const trimmed = part.trim();
                        if (!trimmed) return;

                        const colonIdx = trimmed.indexOf(':');
                        const isSingleTeam = parts.length === 1;
                        const rawLabel = colonIdx > -1 ? trimmed.substring(0, colonIdx).trim() : (isSingleTeam ? '' : `${idx + 1}군`);
                        const cleanLabel = rawLabel ? (rawLabel.replace(/곰|팀|군/g, '').trim() + '군') : '';
                        const teamTime = colonIdx > -1 ? trimmed.substring(colonIdx + 1).trim() : trimmed;

                        const simplifiedTime = teamTime.split(/[,|]/).map(t => {
                            return t.replace(/출격|귀환|시작|종료/g, '').trim();
                        }).join(', ');

                        processedList.push({
                            ...e,
                            id: `${e.id}_team${idx + 1}`,
                            originalEventId: e.id,
                            title: t('events.alliance_bear_title'),
                            time: simplifiedTime,
                            isBearSplit: true,
                            teamLabel: cleanLabel,
                            teamIcon: '🐻',
                            // Ensure the recurrence fields reflect the specific team
                            isRecurring: idx === 0 ? e.isRecurring : e.isRecurring2,
                            recurrenceValue: idx === 0 ? e.recurrenceValue : e.recurrenceValue2,
                            recurrenceUnit: idx === 0 ? e.recurrenceUnit : e.recurrenceUnit2,
                            startDate: idx === 0 ? e.startDate : e.startDate2
                        });
                    });
                } else {
                    processedList.push(e);
                }
            } else if (e.id === 'a_fortress' || e.id === 'alliance_fortress') {
                // Split Fortress Battle into separate 'Fortress' and 'Citadel' events
                const rawTime = (e.time || '').replace(/\s*\/\s*/g, ', ');
                const parts = rawTime.split(',').map(p => {
                    let cleaned = p.trim().replace(/.*(요새전|성채전|Fortress|Citadel)[:\s：]*/, '');
                    return cleaned.trim();
                }).filter(p => p);

                const fortressParts: string[] = [];
                const citadelParts: string[] = [];

                parts.forEach(part => {
                    if (part.includes('성채') || part.toLowerCase().includes('citadel')) {
                        citadelParts.push(part);
                    } else {
                        fortressParts.push(part);
                    }
                });

                if (fortressParts.length > 0) {
                    processedList.push({
                        ...e,
                        id: `${e.id}_fortress`,
                        originalEventId: e.id,
                        title: t('events.fortress_battle_title'),
                        day: t('events.fortress'),
                        time: fortressParts.join(', '),
                        isFortressSplit: true
                    });
                }

                if (citadelParts.length > 0) {
                    processedList.push({
                        ...e,
                        id: `${e.id}_citadel`,
                        originalEventId: e.id,
                        title: t('events.citadel_battle_title'),
                        day: t('events.citadel'),
                        time: citadelParts.join(', '),
                        isFortressSplit: true
                    });
                }

                if (fortressParts.length === 0 && citadelParts.length === 0) {
                    processedList.push(e);
                }
            } else if (e.id === 'alliance_canyon') {
                // Split Canyon Battle into Team 1 and Team 2
                const parts = (e.time || '').split(/\s*\/\s*/);
                if (parts.length > 0) {
                    parts.forEach((part, idx) => {
                        const trimmed = part.trim();
                        if (!trimmed) return;

                        const colonIdx = trimmed.indexOf(':');
                        const isSingleTeam = parts.length === 1;
                        const rawLabel = colonIdx > -1 ? trimmed.substring(0, colonIdx).trim() : (isSingleTeam ? '' : `${idx + 1}군`);
                        const cleanLabel = rawLabel ? (rawLabel.replace(/협곡|전투|팀|군/g, '').trim() + '군') : '';
                        const teamTime = colonIdx > -1 ? trimmed.substring(colonIdx + 1).trim() : trimmed;

                        const simplifiedTime = teamTime.split(/[,|]/).map(t => {
                            return t.replace(/출격|귀환|시작|종료/g, '').trim();
                        }).join(', ');

                        processedList.push({
                            ...e,
                            id: `${e.id}_team${idx + 1}`,
                            originalEventId: e.id,
                            title: t('events.alliance_canyon_title'),
                            time: simplifiedTime,
                            isCanyonSplit: true,
                            teamLabel: cleanLabel,
                            teamIcon: '⛰️',
                            // Ensure the recurrence fields reflect the specific team
                            isRecurring: idx === 0 ? e.isRecurring : e.isRecurring2,
                            recurrenceValue: idx === 0 ? e.recurrenceValue : e.recurrenceValue2,
                            recurrenceUnit: idx === 0 ? e.recurrenceUnit : e.recurrenceUnit2,
                            startDate: idx === 0 ? e.startDate : e.startDate2
                        });
                    });
                } else {
                    processedList.push(e);
                }
            } else if (e.id === 'a_foundry' || e.id === 'alliance_foundry') {
                // Split Weapon Factory into Team 1 and Team 2
                const parts = (e.time || '').split(/\s*\/\s*/);
                if (parts.length > 0) {
                    parts.forEach((part, idx) => {
                        const trimmed = part.trim();
                        if (!trimmed) return;

                        const colonIdx = trimmed.indexOf(':');
                        const isSingleTeam = parts.length === 1;
                        const rawLabel = colonIdx > -1 ? trimmed.substring(0, colonIdx).trim() : (isSingleTeam ? '' : `${idx + 1}군`);
                        const cleanLabel = rawLabel ? (rawLabel.replace(/무기|공장|팀|군/g, '').trim() + '군') : '';
                        const teamTime = colonIdx > -1 ? trimmed.substring(colonIdx + 1).trim() : trimmed;

                        const simplifiedTime = teamTime.split(/[,|]/).map(t => {
                            return t.replace(/출격|귀환|시작|종료/g, '').trim();
                        }).join(', ');

                        processedList.push({
                            ...e,
                            id: `${e.id}_team${idx + 1}`,
                            originalEventId: e.id,
                            title: t('events.alliance_foundry_title'),
                            time: simplifiedTime,
                            isFoundrySplit: true,
                            teamLabel: cleanLabel,
                            teamIcon: '🏭',
                            // Ensure the recurrence fields reflect the specific team
                            isRecurring: idx === 0 ? e.isRecurring : e.isRecurring2,
                            recurrenceValue: idx === 0 ? e.recurrenceValue : e.recurrenceValue2,
                            recurrenceUnit: idx === 0 ? e.recurrenceUnit : e.recurrenceUnit2,
                            startDate: idx === 0 ? e.startDate : e.startDate2
                        });
                    });
                } else {
                    processedList.push(e);
                }
            } else {
                processedList.push(e);
            }
        });

        // 2. Helper functions
        const getBundleId = (ev: any) => {
            const gid = ev.originalEventId || ev.id;
            if (gid === 'a_fortress' || gid === 'a_citadel' || gid === 'alliance_fortress' || gid === 'alliance_citadel') return 'fortress_bundle';
            return gid;
        };

        const getSortTime = (ev: any) => {
            const dStr = ev.day || '';
            const tStr = ev.time || '';
            const dayMap: { [key: string]: number } = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };

            const rangeMatch = (dStr + tStr).match(/(\d{4})[\.-](\d{2})[\.-](\d{2})/);
            if (rangeMatch) return new Date(rangeMatch[1] + '-' + rangeMatch[2] + '-' + rangeMatch[3]).getTime();

            const firstDay = (dStr + tStr).match(/[월화수목금토일]/)?.[0];
            const timeMatch = (dStr + tStr).match(/(\d{2}:\d{2})/)?.[1] || '00:00';
            if (firstDay) {
                const [h, m] = timeMatch.split(':').map(Number);
                return dayMap[firstDay] * 86400000 + h * 3600000 + m * 60000;
            }
            return 9999999999999;
        };

        // 3. Pre-calculate group-level data
        const groupData: { [key: string]: { minTime: number, hasActive: boolean, allExpired: boolean, count: number } } = {};
        processedList.forEach(e => {
            const groupId = getBundleId(e);
            const sTime = getSortTime(e);
            // 분할된 이벤트의 경우 originalEventId로 체크
            const checkId = e.originalEventId || e.id;
            const active = isOngoingMap[checkId] || false;
            const expired = isExpiredMap[checkId] || false;

            if (!groupData[groupId]) {
                groupData[groupId] = { minTime: sTime, hasActive: active, allExpired: expired, count: 1 };
            } else {
                if (sTime < groupData[groupId].minTime) groupData[groupId].minTime = sTime;
                if (active) groupData[groupId].hasActive = true;
                groupData[groupId].allExpired = groupData[groupId].allExpired && expired;
                groupData[groupId].count += 1;
            }
        });

        // 4. Sort with full dashboard logic
        return processedList.sort((a, b) => {
            const groupIdA = getBundleId(a);
            const groupIdB = getBundleId(b);
            const gDataA = groupData[groupIdA];
            const gDataB = groupData[groupIdB];

            // Priority 1: Group Active Status
            if (gDataA.hasActive && !gDataB.hasActive) return -1;
            if (!gDataA.hasActive && gDataB.hasActive) return 1;

            // Priority 2: Group Expired Status
            if (!gDataA.allExpired && gDataB.allExpired) return -1;
            if (gDataA.allExpired && !gDataB.allExpired) return 1;

            // Priority 3: Bundle Priority
            const isBundleA = gDataA.count > 1;
            const isBundleB = gDataB.count > 1;
            if (isBundleA && !isBundleB) return -1;
            if (!isBundleA && isBundleB) return 1;

            // Priority 4: Group Sort Time
            if (gDataA.minTime !== gDataB.minTime) return gDataA.minTime - gDataB.minTime;

            // Priority 5: Strict Group ID grouping
            if (groupIdA !== groupIdB) return groupIdA.localeCompare(groupIdB);

            // Priority 6: Internal Order - Team Order
            const teamA = a.teamLabel ? (parseInt(a.teamLabel) || (a.teamLabel.includes('1') ? 1 : 2)) : 0;
            const teamB = b.teamLabel ? (parseInt(b.teamLabel) || (b.teamLabel.includes('1') ? 1 : 2)) : 0;
            if (teamA !== teamB) return teamA - teamB;

            // Priority 7: Fortress/Citadel Priority
            const aIsFortress = a.title.includes('요새') || a.title.toLowerCase().includes('fortress');
            const aIsCitadel = a.title.includes('성채') || a.title.toLowerCase().includes('citadel');
            const bIsFortress = b.title.includes('요새') || b.title.toLowerCase().includes('fortress');
            const bIsCitadel = b.title.includes('성채') || b.title.toLowerCase().includes('citadel');
            if (aIsFortress && bIsCitadel) return -1;
            if (aIsCitadel && bIsFortress) return 1;

            // Priority 8: Title Alphabetical
            return (a.title || '').localeCompare(b.title || '');
        });
    }, [filteredEvents, isOngoingMap, isExpiredMap, t]);

    const handleSetSelectedTeamTab = useCallback((eventId: string, idx: number) => {
        setSelectedTeamTabs(prev => ({ ...prev, [eventId]: idx }));
    }, []);

    const openWikiLink = useCallback((url: string) => {
        if (url) {
            if (Platform.OS === 'web') {
                setCurrentWikiUrl(url);
                setBrowserVisible(true);
            } else {
                Linking.openURL(url).catch(err => showCustomAlert(t('common.error'), t('events.link_error', { error: err.message }), 'error'));
            }
        } else {
            showCustomAlert(t('common.info'), t('events.no_wiki_link'), 'warning');
        }
    }, [showCustomAlert, t]);

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
            showCustomAlert(t('common.duplicate_alert'), t('events.duplicate_schedule_entry'), 'warning');
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
        if (editingSlotId === id) {
            setEditingSlotId(null);
        }
    };

    const addFortressSlot = () => {
        if (!selectedFortressName) {
            showCustomAlert(t('common.info'), (editingEvent?.id === 'a_fortress') ? t('events.select_fortress') : t('events.select_citadel'), 'warning');
            return;
        }

        const isFortress = editingEvent?.id === 'a_fortress';
        const list = isFortress ? fortressList : citadelList;
        const setList = isFortress ? setFortressList : setCitadelList;

        if (editingSlotId) {
            const newList = list.map(item => item.id === editingSlotId ? { ...item, name: selectedFortressName, day: selectedDayForSlot, h: editHour, m: editMinute } : item);
            setList(newList);
            setEditingSlotId(null);
            setSelectedFortressName('');
            return;
        }

        // Check duplicate
        const isDuplicate = list.some(item => item.name === selectedFortressName && item.day === selectedDayForSlot && item.h === editHour && item.m === editMinute);
        if (isDuplicate) {
            showCustomAlert(t('common.duplicate_alert'), t('events.duplicate_setting'), 'warning');
            return;
        }

        const newItem = {
            id: Date.now().toString(),
            name: selectedFortressName,
            day: selectedDayForSlot,
            h: editHour,
            m: editMinute
        };

        setList([...list, newItem]);
        // Don't reset name to allow multiple adds for same fortress easily
    };

    const removeFortressSlot = (id: string) => {
        const isFortress = editingEvent?.id === 'a_fortress';
        const list = isFortress ? fortressList : citadelList;
        const setList = isFortress ? setFortressList : setCitadelList;
        setList(list.filter(item => item.id !== id));
        if (editingSlotId === id) {
            setEditingSlotId(null);
            setSelectedFortressName('');
        }
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
                showCustomAlert(t('common.completed'), t('events.strategy_saved'), 'success');
            } catch (error: any) {
                showCustomAlert(t('common.error'), t('events.save_error', { error: error.message }), 'error');
            }
        }
    }, [events, strategyContent, updateSchedule, showCustomAlert, t]);

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

        // Save current UI state to team-specific backing store before switching
        if (activeTab === 1) {
            setIsRecurring1(isRecurring);
            setRecValue1(recurrenceValue);
            setRecUnit1(recurrenceUnit);
            setEnableSD1(enableStartDate);
            setEventSD1(eventStartDate);
        } else {
            setIsRecurring2(isRecurring);
            setRecValue2(recurrenceValue);
            setRecUnit2(recurrenceUnit);
            setEnableSD2(enableStartDate);
            setEventSD2(eventStartDate);
        }

        // Change the active tab
        setActiveTab(targetTab);

        // Load the target team's states into common UI variables
        if (targetTab === 1) {
            setIsRecurring(isRecurring1);
            setRecurrenceValue(recValue1);
            setRecurrenceUnit(recUnit1);
            setEnableStartDate(enableSD1);
            setEventStartDate(eventSD1);
        } else {
            setIsRecurring(isRecurring2);
            setRecurrenceValue(recValue2);
            setRecurrenceUnit(recUnit2);
            setEnableStartDate(enableSD2);
            setEventStartDate(eventSD2);
        }
    };



    const openScheduleModal = useCallback((event: WikiEvent) => {
        setEditingEvent(event);
        const currentTabIdx = selectedTeamTabs[event.id] || 0;
        setActiveTab(currentTabIdx === 0 ? 1 : 2);
        setActiveNamePickerId(null); // Clear any open name pickers
        setActiveFortressDropdown(null); // Clear any open time pickers
        setSelectedFortressName('');



        if (event.category === '개인' || DATE_RANGE_IDS.includes(event.id)) {
            const rawDay = event.day || '';
            const [s, e] = rawDay.includes('~') ? rawDay.split('~').map(x => x.trim()) : ['', ''];

            const now = new Date();
            const defaultStr = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} 09:00`;

            setMStart(s || defaultStr);
            setMEnd(e || defaultStr);

            // For date range events, use the common recurrence states
            setIsRecurring(!!event.isRecurring);
            setRecurrenceValue(event.recurrenceValue || '1');
            setRecurrenceUnit(event.recurrenceUnit || 'week');
            setEnableStartDate(!!event.startDate);
            setEventStartDate(event.startDate || '');
        }

        // Initialize recurrence states for Fortress/Citadel
        if (event.id === 'a_fortress' || event.id === 'a_citadel') {
            setIsRecurring(!!event.isRecurring);
            setRecurrenceValue(event.recurrenceValue || '1');
            setRecurrenceUnit(event.recurrenceUnit || 'week');
            setEnableStartDate(!!event.startDate);
            setEventStartDate(event.startDate || '');
        }


        if (event.id === 'a_fortress' || event.id === 'a_citadel') {
            let fParsed: any[] = [];
            let cParsed: any[] = [];

            // 공통 파싱 로직 (기존 데이터 유지 호환성)
            if (event.time) {
                // 1. 접두어 제거 및 기본 정리
                let cleanTime = event.time;
                if (cleanTime.includes('요새전:')) {
                    cleanTime = cleanTime.replace('요새전:', '').trim();
                    // 성채전이 뒤에 붙어있을 수 있으므로 분리 (구형 데이터 호환)
                    if (cleanTime.includes('/ 성채전:')) {
                        const parts = cleanTime.split('/ 성채전:');
                        const fPart = parts[0].trim();
                        const cPart = parts[1] ? parts[1].trim() : '';

                        // Fortress Parse
                        const fItems = fPart.split(',');
                        fItems.forEach((item, idx) => {
                            const match = item.trim().match(/(.+?)\s+([월화수목금토일\s]+)\s*\(?(\d{2}):(\d{2})\)?/);
                            if (match) {
                                fParsed.push({ id: `f_${idx}`, name: match[1].trim(), day: match[2].trim(), h: match[3], m: match[4] });
                            } else {
                                // 형식이 안맞으면 이름과 시간만 추출 시도 (요일 기본값 토)
                                const simpleMatch = item.trim().match(/(.+?)\s*\(?(\d{2}):(\d{2})\)?/);
                                if (simpleMatch) {
                                    fParsed.push({ id: `f_${idx}_s`, name: simpleMatch[1].trim(), day: '토', h: simpleMatch[2], m: simpleMatch[3] });
                                }
                            }
                        });

                        // Citadel Parse
                        const cItems = cPart.split(',');
                        cItems.forEach((item, idx) => {
                            const match = item.trim().match(/(.+?)\s+([월화수목금토일\s]+)\s*\(?(\d{2}):(\d{2})\)?/);
                            if (match) {
                                cParsed.push({ id: `c_${idx}`, name: match[1].trim(), day: match[2].trim(), h: match[3], m: match[4] });
                            } else {
                                const simpleMatch = item.trim().match(/(.+?)\s*\(?(\d{2}):(\d{2})\)?/);
                                if (simpleMatch) {
                                    cParsed.push({ id: `c_${idx}_s`, name: simpleMatch[1].trim(), day: '일', h: simpleMatch[2], m: simpleMatch[3] });
                                }
                            }
                        });
                    } else {
                        // 요새전만 있는 경우 (또는 신규 포맷)
                        // 만약 "요새7 금 23:30, 요새10..." 처럼 쉼표로 연결된 경우문
                        const items = cleanTime.split(',');
                        items.forEach((item, idx) => {
                            const match = item.trim().match(/(.+?)\s+([월화수목금토일\s]+)\s*\(?(\d{2}):(\d{2})\)?/);
                            if (match) {
                                fParsed.push({ id: `f_${idx}`, name: match[1].trim(), day: match[2].trim(), h: match[3], m: match[4] });
                            }
                        });
                    }
                } else if (cleanTime.includes('성채전:')) {
                    // 성채전만 있는 경우
                    cleanTime = cleanTime.replace('성채전:', '').trim();
                    const items = cleanTime.split(',');
                    items.forEach((item, idx) => {
                        const match = item.trim().match(/(.+?)\s+([월화수목금토일\s]+)\s*\(?(\d{2}):(\d{2})\)?/);
                        if (match) {
                            cParsed.push({ id: `c_${idx}`, name: match[1].trim(), day: match[2].trim(), h: match[3], m: match[4] });
                        }
                    });
                } else {
                    // 구형 포맷 또는 기타 (단순 텍스트) 처리
                    // "요새7(23:30) / 성채(11:00)" 등
                    const parts = cleanTime.split(/[\/|]/);
                    parts.forEach((p, idx) => {
                        const trimP = p.trim();
                        // 요새/성채 구분 모호할 수 있음 -> 이름에 포함된 단어로 추측하거나,
                        // 그냥 Fortress에 넣고 사용자가 수정하게 유도
                        const match = trimP.match(/(.+?)\s*[\(]?\s*([월화수목금토일]*)?\s*(\d{2}):(\d{2})[\)]?/);
                        if (match) {
                            const name = match[1].trim();
                            const day = match[2] || (name.includes('성채') ? '일' : '토');
                            const h = match[3];
                            const m = match[4];

                            if (name.includes('성채')) {
                                cParsed.push({ id: `c_old_${idx}`, name, day, h, m });
                            } else {
                                fParsed.push({ id: `f_old_${idx}`, name, day, h, m });
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
                if (p.startsWith('1군:') || p.startsWith('Team1:')) s1 = parseScheduleStr(p.replace(/^(1군:|Team1:)\s*/, ''));
                if (p.startsWith('2군:') || p.startsWith('Team2:')) s2 = parseScheduleStr(p.replace(/^(2군:|Team2:)\s*/, ''));
            });
            if (s1.length === 0 && s2.length === 0) s1 = parseScheduleStr(event.time || '');
        } else {
            s1 = parseScheduleStr(event.time || '');
        }

        setSlots1(s1);
        setSlots2(s2);
        setInitialSlots1(s1.map(s => ({ day: s.day, time: s.time })));
        setInitialSlots2(s2.map(s => ({ day: s.day, time: s.time })));

        // Initialize Common/Team 1 UI states
        setIsRecurring(!!event.isRecurring);
        setRecurrenceValue(event.recurrenceValue || '1');
        setRecurrenceUnit(event.recurrenceUnit || 'week');
        setEnableStartDate(!!(event as any).startDate);
        setEventStartDate((event as any).startDate || '');

        // Initialize Team 1 backing stores
        setIsRecurring1(!!event.isRecurring);
        setRecValue1(event.recurrenceValue || '1');
        setRecUnit1(event.recurrenceUnit || 'week');
        setEnableSD1(!!(event as any).startDate);
        setEventSD1((event as any).startDate || '');

        // Initialize Team 2 backing stores
        setIsRecurring2(!!((event as any).isRecurring2));
        setRecValue2(((event as any).recurrenceValue2) || '1');
        setRecUnit2(((event as any).recurrenceUnit2) || 'week');
        setEnableSD2(!!((event as any).startDate2));
        setEventSD2((event as any).startDate2 || '');

        // If starting on Team 2 tab, load those into UI states instead
        if (currentTabIdx === 1) {
            setIsRecurring(!!((event as any).isRecurring2));
            setRecurrenceValue(((event as any).recurrenceValue2) || '1');
            setRecurrenceUnit(((event as any).recurrenceUnit2) || 'week');
            setEnableStartDate(!!((event as any).startDate2));
            setEventStartDate((event as any).startDate2 || '');
        }



        setScheduleModalVisible(true);
    }, [parseScheduleStr, selectedTeamTabs]);

    const toggleDay = useCallback((day: string) => {
        setSelectedDayForSlot(day);
    }, []);

    const openGuideModal = useCallback((event: WikiEvent) => {
        setSelectedEventForGuide(event);
        setStrategyContent(event.strategy || '');
        setIsEditingStrategy(false);
        setGuideModalVisible(true);
    }, []);

    const openAttendeeModal = useCallback((event: WikiEvent, groupIndex?: number) => {
        setManagedEvent(event);
        setManagedGroupIndex(groupIndex || 0);
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
            t('events.penalty_reason_title'),
            t('events.penalty_reason_desc', { name }) + `\n(${t('events.penalty_warning')})`,
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('events.penalty_reset'),
                    onPress: () => updateAttendeeField(id, 'penalty', '')
                },
                {
                    text: t('events.penalty_notice'),
                    onPress: () => updateAttendeeField(id, 'penalty', 'NOTICE')
                },
                {
                    text: t('events.penalty_no_show'),
                    style: 'destructive',
                    onPress: () => updateAttendeeField(id, 'penalty', 'NO_SHOW')
                }
            ]
        );
    }, [updateAttendeeField, t]);

    const deleteAttendee = useCallback((id: string) => {
        setBulkAttendees(prev => prev.filter(a => a.id !== id));
    }, []);

    const saveAttendees = useCallback(() => {
        const validAttendees = bulkAttendees.filter(a => a.name?.trim());
        if (validAttendees.length === 0) {
            showCustomAlert(t('common.info'), t('events.save_attendees_empty'), 'warning');
            return;
        }

        const summary = validAttendees.map(a =>
            `- ${a.name}: ${[a.hero1, a.hero2, a.hero3].filter(Boolean).join(', ') || t('events.no_hero')}`
        ).join('\n');

        const isBearOrFoundry = managedEvent?.id === 'a_bear' || managedEvent?.id === 'alliance_bear' || managedEvent?.id === 'a_foundry' || managedEvent?.id === 'alliance_foundry' || managedEvent?.id === 'alliance_canyon';
        const isBear = managedEvent?.id.includes('bear');
        const teamLabel = isBear ? t(`events.bear${managedGroupIndex + 1}`) : `${t('events.team_unit')}${managedGroupIndex + 1}`;
        const displayTitle = isBearOrFoundry ? `${managedEvent?.title} (${teamLabel})` : managedEvent?.title;

        setAttendeeModalVisible(false);
        setIsSaving(true);
        showCustomAlert(
            t('events.save_attendees_title'),
            t('events.save_attendees_success_desc', { title: displayTitle, count: validAttendees.length }) + `\n\n${summary}`,
            'success'
        );

        if (managedEvent) {
            saveAttendeesToFirestore(validAttendees.length > 0 ? validAttendees : [], managedEvent.title)
                .then(() => showCustomAlert(t('common.success'), t('events.save_success'), 'success'))
                .catch((e) => showCustomAlert(t('common.error'), t('events.save_error', { error: e.message }), 'error'))
                .finally(() => setIsSaving(false));
        } else {
            setIsSaving(false);
        }
    }, [bulkAttendees, managedEvent, showCustomAlert, saveAttendeesToFirestore, t]);

    const saveSchedule = async () => {
        if (!editingEvent) return;

        setIsSaving(true); // Lock updates

        if (editingEvent.category === '개인' || DATE_RANGE_IDS.includes(editingEvent.id)) {
            const finalDay = `${mStart} ~ ${mEnd}`;
            const finalTime = ''; // No time used for mobilization

            // Optimistic update handled by hook

            try {
                // Consolidate to a single ID for weapon league data
                const targetId = (editingEvent.id === 'alliance_frost_league' || editingEvent.id === 'a_weapon') ? 'a_weapon' : editingEvent.id;

                console.log(`[Save] DateRange: ${targetId}, day: ${finalDay}, time: ${finalTime}`);
                setEvents(prev => prev.map(e => (e.id === editingEvent.id || (editingEvent.id === 'alliance_frost_league' && e.id === 'a_weapon') || (editingEvent.id === 'a_weapon' && e.id === 'alliance_frost_league')) ? {
                    ...e,
                    day: finalDay,
                    time: finalTime,
                    startDate: enableStartDate ? eventStartDate : e.startDate, // Preserve existing startDate
                    isRecurring,
                    recurrenceValue,
                    recurrenceUnit,
                    updatedAt: Date.now()
                } : e));

                await updateSchedule({
                    eventId: targetId,
                    day: finalDay,
                    time: finalTime,
                    strategy: editingEvent.strategy || '',
                    startDate: enableStartDate ? eventStartDate : undefined,
                    isRecurring,
                    recurrenceValue,
                    recurrenceUnit
                });
                setScheduleModalVisible(false);
                showCustomAlert(t('common.completed'), t('events.schedule_saved', { title: editingEvent.title }), 'success');
            } catch (error: any) {
                showCustomAlert(t('common.error'), t('events.save_error', { error: error.message }), 'error');
            } finally {
                setTimeout(() => { setIsSaving(false); }, 100);
            }
            return;
        }


        if (editingEvent.id === 'a_fortress' || editingEvent.id === 'a_citadel') {
            let timeStr = '';
            let finalDay = '';

            if (editingEvent.id === 'a_fortress') {
                const fStr = fortressList.length > 0 ? `${t('events.fortress_battle')}: ${fortressList.map(f => `${f.name.replace(/\s+/g, '')} ${f.day || '토'} ${f.h}:${f.m}`).join(', ')}` : '';
                timeStr = fStr;
                finalDay = fortressList.length > 0 ? t('events.fortress_battle') : '';
            } else {
                const cStr = citadelList.length > 0 ? `${t('events.citadel_battle')}: ${citadelList.map(c => `${c.name.replace(/\s+/g, '')} ${c.day || '일'} ${c.h}:${c.m}`).join(', ')}` : '';
                timeStr = cStr;
                finalDay = citadelList.length > 0 ? t('events.citadel_battle') : '';
            }

            // Optimistic update handled by hook

            try {
                console.log(`[Save] Fortress/Citadel: ${editingEvent.id}, day: ${finalDay}, time: ${timeStr}, startDate: ${enableStartDate ? eventStartDate : 'none'}`);
                setEvents(prev => prev.map(e => e.id === editingEvent.id ? {
                    ...e,
                    day: finalDay,
                    time: timeStr,
                    startDate: enableStartDate ? eventStartDate : undefined,
                    isRecurring,
                    recurrenceValue,
                    recurrenceUnit,
                    updatedAt: Date.now()
                } : e));

                await updateSchedule({
                    eventId: editingEvent.id,
                    day: finalDay,
                    time: timeStr,
                    strategy: editingEvent.strategy || '',
                    startDate: enableStartDate ? eventStartDate : undefined,
                    isRecurring,
                    recurrenceValue,
                    recurrenceUnit
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

                showCustomAlert(t('common.completed'), t('events.schedule_saved', { title: editingEvent.title }), 'success', () => {
                    setScheduleModalVisible(false);
                });
            } catch (error: any) {
                showCustomAlert(t('common.error'), t('events.save_error', { error: error.message }), 'error');
            } finally {
                setTimeout(() => { setIsSaving(false); }, 100);
            }
            return;
        }

        let finalDay = '';
        // let finalTime = ''; // This was commented out, but the user's diff re-introduces it.

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

        // New buildStr function for the finalTime string, considering both teams
        const buildFinalTimeStr = (s1: { day: string, time: string }[], s2: { day: string, time: string }[]) => {
            const hasS1 = s1.length > 0;
            const hasS2 = s2.length > 0;

            const makePart = (prefix: string, list: { day: string, time: string }[]) => {
                if (list.length === 0) return '';
                return prefix + ': ' + list.map(s => `${s.day}${s.time ? `(${s.time})` : ''}`).join(', ');
            };

            if (hasS1 && hasS2) return `${makePart('1군', s1)} / ${makePart('2군', s2)}`;
            if (hasS1) return makePart('1군', s1);
            if (hasS2) return makePart('2군', s2);
            return '.';
        };

        const finalTime = buildFinalTimeStr(slots1, slots2);

        // FORCE ALERT TO DEBUG
        // Alert.alert('Debug Saving', `Event: ${editingEvent?.id}\nSlots2: ${slots2.length}\nFinal: ${finalTime}`);

        // Optimistic update handled by hook


        // Final sync of current tab's states to independent variables based on activeTab
        let finalIsR1 = isRecurring1, finalVal1 = recValue1, finalUnit1 = recUnit1, finalEnSD1 = enableSD1, finalSD1 = eventSD1;
        let finalIsR2 = isRecurring2, finalVal2 = recValue2, finalUnit2 = recUnit2, finalEnSD2 = enableSD2, finalSD2 = eventSD2;

        if (activeTab === 1) {
            finalIsR1 = isRecurring;
            finalVal1 = recurrenceValue;
            finalUnit1 = recurrenceUnit;
            finalEnSD1 = enableStartDate;
            finalSD1 = eventStartDate;
        } else {
            finalIsR2 = isRecurring;
            finalVal2 = recurrenceValue;
            finalUnit2 = recurrenceUnit;
            finalEnSD2 = enableStartDate;
            finalSD2 = eventStartDate;
        }

        try {
            console.log(`[Save] ${editingEvent.id}, T1: ${finalVal1}, T2: ${finalVal2}`);
            setEvents(prev => prev.map(e => e.id === editingEvent.id ? {
                ...e,
                day: finalDay || '',
                time: finalTime || '',
                startDate: finalEnSD1 ? finalSD1 : undefined,
                isRecurring: finalIsR1,
                recurrenceValue: finalVal1,
                recurrenceUnit: finalUnit1,
                startDate2: finalEnSD2 ? finalSD2 : undefined,
                isRecurring2: finalIsR2,
                recurrenceValue2: finalVal2,
                recurrenceUnit2: finalUnit2,
                updatedAt: Date.now()
            } : e));

            await updateSchedule({
                eventId: editingEvent.id,
                day: finalDay || '',
                time: finalTime || '',
                strategy: editingEvent.strategy || '',
                isRecurring: finalIsR1,
                recurrenceValue: finalVal1,
                recurrenceUnit: finalUnit1,
                startDate: finalEnSD1 ? finalSD1 : undefined,
                isRecurring2: finalIsR2,
                recurrenceValue2: finalVal2,
                recurrenceUnit2: finalUnit2,
                startDate2: finalEnSD2 ? finalSD2 : undefined,
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

            showCustomAlert(t('common.completed'), t('events.schedule_saved', { title: editingEvent.title }), 'success', () => {
                setScheduleModalVisible(false);
            });

        } catch (error: any) {
            showCustomAlert(t('common.error'), t('events.save_error', { error: error.message }), 'error');
        } finally {
            setTimeout(() => { setIsSaving(false); }, 100);
        }
    };

    const handleDeleteSchedule = async () => {
        if (!editingEvent) return;

        setIsSaving(true);
        showCustomAlert(
            t('events.schedule_reset_title'),
            t('events.schedule_reset_confirm'),
            'confirm',
            async () => {
                setIsSaving(true);
                try {
                    // Optimistic update handled by hook

                    await updateSchedule({
                        eventId: editingEvent.id,
                        day: '',
                        time: '',
                        strategy: editingEvent.strategy || '',
                        startDate: undefined,
                        isRecurring: false,
                        recurrenceValue: '1',
                        recurrenceUnit: 'week',
                        startDate2: undefined,
                        isRecurring2: false,
                        recurrenceValue2: '1',
                        recurrenceUnit2: 'week',
                    });

                    if (Platform.OS !== 'web') {
                        await Notifications.cancelAllScheduledNotificationsAsync();
                    }
                    showCustomAlert(t('common.completed'), t('events.schedule_reset_success'), 'success', () => {
                        setScheduleModalVisible(false);
                    });
                } catch (error: any) {
                    showCustomAlert(t('common.error'), t('events.save_error', { error: error.message }), 'error');
                } finally {
                    setTimeout(() => { setIsSaving(false); }, 500);
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
                <Text className={`mt-4 font-semibold ${isDark ? 'text-white' : 'text-slate-600'}`}>{t('common.syncing')}</Text>
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
                        <Text className={`text-[13px] font-bold uppercase tracking-widest mb-6 px-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('events.category.title', { defaultValue: '이벤트 분류' })}</Text>
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
                                                {cat === '전체' ? t('common.all')
                                                    : cat === '연맹' ? t('events.category.alliance')
                                                        : cat === '개인' ? t('events.category.individual')
                                                            : cat === '서버' ? t('events.category.server')
                                                                : cat === '초보자' ? t('events.category.beginner')
                                                                    : cat}
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
                    {/* Header - Compact */}
                    <View className={`pt-4 pb-1 px-5 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <View className={`flex-row items-center flex-wrap mb-2`}>
                            <View className={`flex-row items-center ${isDesktop ? 'flex-1' : 'w-full'} mr-3 mb-2`}>
                                <TouchableOpacity
                                    onPress={() => router.replace({ pathname: '/', params: { viewMode: params.viewMode } })}
                                    className={`mr-3 w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}
                                >
                                    <Ionicons name="arrow-back" size={20} color={isDark ? "#B0B8C1" : "#4E5968"} />
                                </TouchableOpacity>
                                <View className="flex-1">
                                    <Text className={`text-[24px] font-bold tracking-tight ${isDark ? 'text-[#F2F4F6]' : 'text-[#191F28]'}`}>{t('events.title')}</Text>
                                    <Text className={`text-[15px] mt-1 font-medium ${isDark ? 'text-[#8B95A1]' : 'text-[#8B95A1]'}`}>{t('events.subtitle')}</Text>
                                </View>
                            </View>

                            <View className={`flex-row items-center ${isDesktop ? 'ml-3' : 'w-full justify-between mb-2'}`}>
                                {/* Timezone Toggle */}
                                <View className={`flex-row p-1 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-100 border-slate-300'}`}>
                                    <Pressable
                                        onPress={() => setTimezone('LOCAL')}
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                paddingHorizontal: 16,
                                                paddingVertical: 8,
                                                borderRadius: 12,
                                                backgroundColor: timezone === 'LOCAL'
                                                    ? (isDark ? '#2563eb' : '#3b82f6')
                                                    : (hovered ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : 'transparent'),
                                                borderColor: timezone === 'LOCAL' ? 'transparent' : (hovered ? (isDark ? '#60a5fa' : '#3b82f6') : 'transparent'),
                                                borderWidth: 1,
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                cursor: 'pointer'
                                            }
                                        ]}
                                    >
                                        <Text className={`text-[11px] font-black ${timezone === 'LOCAL' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{t('events.timezone_local')}</Text>
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
                                        <Text className={`text-[11px] font-black ${timezone === 'UTC' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{t('events.timezone_utc')}</Text>
                                    </Pressable>
                                </View>

                                {/* View Switcher: Card vs Timeline */}
                                <View className={`flex-row ml-4 p-1 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-slate-100 border-slate-300'}`}>
                                    <Pressable
                                        onPress={() => setViewMode('card')}
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                paddingHorizontal: 12,
                                                paddingVertical: 8,
                                                borderRadius: 12,
                                                backgroundColor: viewMode === 'card' ? '#f97316' : 'transparent',
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                cursor: 'pointer'
                                            }
                                        ]}
                                    >
                                        <Ionicons name="apps" size={14} color={viewMode === 'card' ? 'white' : (isDark ? '#475569' : '#94a3b8')} />
                                    </Pressable>
                                    <Pressable
                                        onPress={() => setViewMode('timeline')}
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                paddingHorizontal: 12,
                                                paddingVertical: 8,
                                                borderRadius: 12,
                                                backgroundColor: viewMode === 'timeline' ? '#f97316' : 'transparent',
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                cursor: 'pointer'
                                            }
                                        ]}
                                    >
                                        <Ionicons name="list" size={14} color={viewMode === 'timeline' ? 'white' : (isDark ? '#475569' : '#94a3b8')} />
                                    </Pressable>
                                </View>
                            </View>
                        </View>

                        {/* Mobile Category Filter (Hidden on Desktop) */}
                        {!isDesktop && (
                            <View>
                                <ScrollView
                                    ref={categoryScrollViewRef}
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    decelerationRate="fast"
                                    bounces={true}
                                    contentContainerStyle={{
                                        paddingHorizontal: 20,
                                        paddingBottom: 4
                                    }}
                                    className="flex-row"
                                >
                                    {(['전체', '서버', '연맹', '개인', '초보자'] as EventCategory[]).map((cat) => (
                                        <Pressable
                                            key={cat}
                                            onPress={() => setSelectedCategory(cat)}
                                            onLayout={(e) => {
                                                const { x, width } = e.nativeEvent.layout;
                                                categoryItemLayouts.current[cat] = { x, width };
                                            }}
                                            className="px-4 py-3 mr-1 relative flex-row items-center"
                                        >
                                            {({ hovered }: any) => (
                                                <>
                                                    <Ionicons
                                                        name={cat === '연맹' ? 'flag-outline' : cat === '개인' ? 'person-outline' : cat === '서버' ? 'earth-outline' : cat === '초보자' ? 'star-outline' : 'apps-outline'}
                                                        size={15}
                                                        color={selectedCategory === cat ? (isDark ? '#818cf8' : '#6366f1') : (hovered ? (isDark ? '#818cf8' : '#6366f1') : (isDark ? '#475569' : '#94a3b8'))}
                                                        className="mr-2"
                                                    />
                                                    <Text className={`text-[15px] font-bold transition-all ${selectedCategory === cat ? (isDark ? 'text-indigo-400' : 'text-[#191F28]') : (hovered ? (isDark ? 'text-slate-200' : 'text-slate-700') : (isDark ? 'text-[#8B95A1]' : 'text-[#8B95A1]'))}`}>
                                                        {cat === '전체' ? t('common.all')
                                                            : cat === '연맹' ? t('events.category.alliance')
                                                                : cat === '개인' ? t('events.category.individual')
                                                                    : cat === '서버' ? t('events.category.server')
                                                                        : cat === '초보자' ? t('events.category.beginner')
                                                                            : cat}
                                                    </Text>\
                                                    {(selectedCategory === cat || hovered) && (
                                                        <View
                                                            className="absolute bottom-0 left-4 right-4 h-[2.5px] rounded-t-full transition-all"
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

                    {/* Event Grid / Timeline View Content */}
                    {viewMode === 'timeline' ? (
                        <TimelineView
                            events={timelineEvents}
                            isDark={isDark}
                            timezone={timezone}
                            onEventPress={(ev) => {
                                const target = ev._original || ev;
                                // Resolve base event for split events to ensure correct ID is used for saving
                                const baseEventId = target.originalEventId || (target.id ? target.id.replace(/_(?:team\d+|t?\d+(?:_\d+)?|fortress|citadel)/g, '') : target.id);
                                const baseEvent = events.find(e => e.id === baseEventId) || target;

                                if (isAdmin) {
                                    if (ev._teamIdx !== undefined) {
                                        handleSetSelectedTeamTab(baseEvent.id, ev._teamIdx);
                                    }
                                    openScheduleModal(baseEvent);
                                } else {
                                    if (ev._teamIdx !== undefined) {
                                        handleSetSelectedTeamTab(baseEvent.id, ev._teamIdx);
                                    }
                                    openGuideModal(baseEvent);
                                }
                            }}
                            checkIsOngoing={checkIsOngoing}
                        />
                    ) : (
                        <ScrollView ref={scrollViewRef} className="flex-1 p-3.5">
                            <View className="flex-row flex-wrap -mx-2">
                                {filteredEvents.length === 0 ? (
                                    <View className="w-full py-24 items-center justify-center">
                                        <View className={`w-24 h-24 rounded-full items-center justify-center mb-6 shadow-inner ${isDark ? 'bg-slate-800/40 border border-slate-700/50' : 'bg-slate-50 border border-slate-100'}`}>
                                            <Ionicons name="calendar-outline" size={48} color={isDark ? "#475569" : "#94a3b8"} />
                                        </View>
                                        <Text className={`text-xl font-black mb-2 tracking-tight ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('events.no_ongoing_events')}</Text>
                                        <Text className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('events.select_another_category')}</Text>
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
                    )}
                </View >

                {/* Guide Detail Popup Modal */}
                < Modal visible={guideModalVisible} transparent animationType="fade" >
                    <View className="flex-1 bg-black/90 justify-center items-center p-6">
                        <TouchableOpacity
                            activeOpacity={1}
                            onPress={() => setGuideModalVisible(false)}
                            className="absolute inset-0"
                        />
                        <View className={`w-full max-w-2xl max-h-[85%] rounded-[24px] border overflow-hidden shadow-2xl ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-transparent'}`}>
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
                                <View className={`h-24 w-full justify-center px-6 ${isDark ? 'bg-[#191F28]' : 'bg-white border-b border-[#E5E8EB]'}`}>
                                    <Text className={`text-[22px] font-bold ${isDark ? 'text-[#F2F4F6]' : 'text-[#191F28]'}`}>{selectedEventForGuide?.title}</Text>
                                    <TouchableOpacity onPress={() => setGuideModalVisible(false)} className="absolute top-4 right-4">
                                        <Ionicons name="close" size={24} color="white" />
                                    </TouchableOpacity>
                                </View>
                            )}

                            <ScrollView className="p-6" contentContainerStyle={{ paddingBottom: 80 }}>
                                {/* Wiki Link Section */}
                                <View className="mb-6 bg-slate-800/50 p-4 rounded-2xl border border-slate-700">
                                    <View className="flex-row items-center justify-between mb-2">
                                        <View className="flex-row items-center">
                                            <View className="w-1 h-4 bg-brand-accent rounded-full mr-2" />
                                            <Text className="text-white font-semibold text-sm">{t('events.modal.wiki_title')}</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => openWikiLink(selectedEventForGuide?.wikiUrl || '')}
                                            className="bg-[#38bdf8]/10 px-3 py-1.5 rounded-lg border border-[#38bdf8]/20"
                                        >
                                            <Text className="text-[#38bdf8] text-xs font-semibold">{t('events.modal.wiki_btn')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <Text className="text-slate-400 text-xs leading-5">
                                        {selectedEventForGuide?.wikiUrl || t('events.modal.wiki_empty')}
                                    </Text>
                                </View>

                                {/* Alliance Strategy Section */}
                                {(selectedEventForGuide?.category === '연맹' || selectedEventForGuide?.category === '서버') && (
                                    <View className="mb-6">
                                        <View className="flex-row items-center justify-between mb-3">
                                            <Text className="text-purple-400 font-bold text-sm uppercase tracking-widest">{t('events.modal.strategy_title')}</Text>
                                            {isAdmin && !isEditingStrategy && (
                                                <TouchableOpacity onPress={() => setIsEditingStrategy(true)} className="bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                                                    <Text className="text-slate-400 text-[10px] font-semibold">{t('common.edit')}</Text>
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
                                                        placeholder={t('events.modal.strategy_placeholder')}
                                                        placeholderTextColor="#64748b"
                                                        style={{ textAlignVertical: 'top' }}
                                                    />
                                                    <View className="flex-row justify-end space-x-2">
                                                        <TouchableOpacity onPress={() => { setIsEditingStrategy(false); setStrategyContent(selectedEventForGuide?.strategy || ''); }} className="bg-slate-700 px-4 py-2 rounded-xl">
                                                            <Text className="text-slate-300 font-semibold text-xs">{t('common.cancel')}</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => saveStrategy(selectedEventForGuide!)} className="bg-purple-600 px-4 py-2 rounded-xl">
                                                            <Text className="text-white font-semibold text-xs">{t('common.save')}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            ) : (
                                                <View className="p-5">
                                                    <Text className="text-slate-200 text-sm font-medium leading-6">
                                                        {selectedEventForGuide?.strategy || t('events.modal.strategy_empty')}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                )}

                                {/* Overview Section */}
                                {guideContent && (
                                    <View className="mb-6">
                                        <Text className="text-slate-500 text-xs font-bold uppercase mb-3">{t('events.modal.guide_overview')}</Text>
                                        <Text className="text-slate-300 text-sm leading-6 mb-6">{guideContent.overview}</Text>

                                        {/* How to Play */}
                                        {guideContent.howToPlay && guideContent.howToPlay.length > 0 && (
                                            <View className="mb-6">
                                                <Text className="text-slate-500 text-xs font-bold uppercase mb-3">{t('events.modal.guide_detail')}</Text>
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
                                                    <Text className="text-yellow-500 text-xs font-bold uppercase">{t('events.modal.guide_tips')}</Text>
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

                            <View className={`p-4 border-t ${isDark ? 'border-[#333D4B]' : 'border-[#E5E8EB]'}`}>
                                <TouchableOpacity
                                    onPress={() => setGuideModalVisible(false)}
                                    className={`w-full h-[52px] rounded-[16px] items-center justify-center ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}
                                >
                                    <Text className={`font-semibold text-[16px] ${isDark ? 'text-[#B0B8C1]' : 'text-[#4E5968]'}`}>{t('common.close')}</Text>
                                </TouchableOpacity>
                            </View>
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
                            className={`p-0 rounded-t-[24px] border-t overflow-hidden ${isDark ? 'bg-[#191F28] border-[#333D4B] shadow-2xl' : 'bg-white border-transparent shadow-2xl'}`}
                            style={{ height: (DATE_RANGE_IDS.includes(editingEvent?.id || '') || editingEvent?.category === '개인') ? 'auto' : '85%', maxHeight: '90%' }}
                        >
                            <View className="px-6 pt-5 pb-1 flex-row justify-between items-start" style={{ zIndex: (!!activeDateDropdown || hourDropdownVisible || minuteDropdownVisible || !!activeFortressDropdown || !!activeNamePickerId) ? 1 : 100 }}>
                                <View className="flex-1 mr-4">
                                    <>
                                        <View className="flex-row items-center mb-1">
                                            <View className="w-1.5 h-6 bg-sky-500 rounded-full mr-3" />
                                            <Text className={`text-2xl font-black ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>
                                                {t(`events.${editingEvent?.id?.replace(/_(?:team\d+|t?\d+(?:_\d+)?)$/, '')}_title`, { defaultValue: editingEvent?.title })}
                                            </Text>
                                        </View>
                                        <Text className={`text-[13px] font-medium leading-5 ml-4.5 ${isDark ? 'text-[#8B95A1]' : 'text-[#8B95A1]'}`}>
                                            {(editingEvent?.category === '개인' || editingEvent?.id === 'alliance_frost_league' || editingEvent?.id === 'a_weapon' || editingEvent?.id === 'alliance_champion' || editingEvent?.id === 'a_champ' || editingEvent?.id === 'a_operation' || editingEvent?.id === 'alliance_operation') ? t('events.modal.set_date_range_desc') : t('events.modal.set_day_time_desc')}
                                        </Text>

                                    </>
                                </View>
                                <TouchableOpacity onPress={() => setScheduleModalVisible(false)} className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}>
                                    <Ionicons name="close" size={24} color={isDark ? "#B0B8C1" : "#4E5968"} />
                                </TouchableOpacity>\
                            </View>

                            <View className="px-4 flex-1" style={{ overflow: 'visible', zIndex: (activeDateDropdown || activeFortressDropdown || activeNamePickerId || hourDropdownVisible || minuteDropdownVisible) ? 200 : 1 }}>
                                {editingEvent?.id === 'a_fortress' || editingEvent?.id === 'a_citadel' ? (
                                    <View className="flex-1 mt-4">
                                        <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false} className="flex-1">
                                            <View className="mb-2">
                                                <View className="flex-row items-center mb-2">
                                                    <Text className="text-brand-accent text-[10px] font-bold uppercase opacity-60">{t('events.modal.registered_schedule')}</Text>
                                                </View>
                                                <View className="flex-row flex-wrap gap-2">
                                                    {(editingEvent?.id === 'a_fortress' ? fortressList : citadelList).map(slot => (
                                                        <TouchableOpacity key={slot.id} onPress={() => {
                                                            if (editingSlotId === slot.id) {
                                                                setEditingSlotId(null);
                                                                setSelectedFortressName('');
                                                            } else {
                                                                setEditingSlotId(slot.id);
                                                                setSelectedFortressName(slot.name);
                                                                setSelectedDayForSlot(slot.day || '토');
                                                                setEditHour(slot.h);
                                                                setEditMinute(slot.m);
                                                                setPickerSyncKey(prev => prev + 1); // Force picker sync
                                                            }
                                                        }} className={`border px-2 py-1.5 rounded-xl flex-row items-center justify-between w-[155px] ${editingSlotId === slot.id ? 'bg-brand-accent/30 border-brand-accent' : 'bg-brand-accent/10 border-brand-accent/20'}`}>
                                                            <Text className="text-white text-[10px] font-bold flex-1 mr-1" numberOfLines={1} ellipsizeMode="tail">
                                                                {slot.name.replace(/요새\s*(\d+)/, `${t('events.fortress')} $1`).replace(/성채\s*(\d+)/, `${t('events.citadel')} $1`)} {t(`events.days.${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][['일', '월', '화', '수', '목', '금', '토'].indexOf(slot.day || '토')]}`)}({slot.h}:{slot.m})
                                                            </Text>
                                                            <TouchableOpacity hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} onPress={() => removeFortressSlot(slot.id)}><Ionicons name="close-circle" size={16} color="#ef4444" /></TouchableOpacity>
                                                        </TouchableOpacity>
                                                    ))}
                                                    {(editingEvent?.id === 'a_fortress' ? fortressList : citadelList).length === 0 && (
                                                        <View
                                                            className={`flex-1 h-10 mx-1 flex-row items-center justify-center border rounded-xl ${isDark ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-500/50 bg-amber-50'}`}
                                                            style={{ borderStyle: 'dashed', borderWidth: 1 }}
                                                        >
                                                            <Ionicons name="alert-circle-outline" size={14} color={isDark ? "#fbbf24" : "#d97706"} style={{ marginRight: 6 }} />
                                                            <Text className={`text-[11px] font-bold ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{t('events.modal.no_schedule')}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>

                                            {/* Start Date Toggle - Compact */}
                                            <View className={`mb-4 p-3 rounded-xl border ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                                <View className="flex-row items-center justify-between">
                                                    <View className="flex-row items-center flex-1">
                                                        <Ionicons name="calendar-number-outline" size={16} color="#0ea5e9" style={{ marginRight: 8 }} />
                                                        <Text className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('events.specify_date')}</Text>
                                                    </View>
                                                    <Switch
                                                        value={enableStartDate}
                                                        onValueChange={setEnableStartDate}
                                                        trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: '#0ea5e9' }}
                                                        thumbColor={'white'}
                                                        style={{ transform: [{ scale: 0.8 }] }}
                                                    />
                                                </View>
                                                {enableStartDate && (
                                                    <TouchableOpacity
                                                        onPress={() => setShowDatePicker('startDate')}
                                                        className={`mt-3 p-2.5 rounded-lg border ${isDark ? 'bg-slate-900/40 border-slate-600' : 'bg-white border-slate-300'}`}
                                                    >
                                                        <View className="flex-row items-center justify-between">
                                                            <Text className={`font-mono text-base ${eventStartDate ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                                                                {eventStartDate || 'YYYY-MM-DD'}
                                                            </Text>
                                                            <Ionicons name="calendar" size={18} color="#0ea5e9" />
                                                        </View>
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            {/* Recurrence Option - Compact */}
                                            <View className={`mb-4 p-3 rounded-xl border ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                                <View className="flex-row items-center justify-between">
                                                    <View className="flex-row items-center flex-1">
                                                        <Ionicons name="repeat-outline" size={16} color="#8b5cf6" style={{ marginRight: 8 }} />
                                                        <Text className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('events.recurrence')}</Text>
                                                    </View>
                                                    <Switch
                                                        value={isRecurring}
                                                        onValueChange={setIsRecurring}
                                                        trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: '#8b5cf6' }}
                                                        thumbColor={'white'}
                                                        style={{ transform: [{ scale: 0.8 }] }}
                                                    />
                                                </View>
                                                {isRecurring && (
                                                    <View className="mt-3 flex-row items-center gap-2">
                                                        <TextInput
                                                            value={recurrenceValue}
                                                            onChangeText={setRecurrenceValue}
                                                            keyboardType="numeric"
                                                            placeholder="1"
                                                            placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                                                            className={`w-16 p-2 rounded-lg border text-center font-bold ${isDark ? 'bg-slate-900/60 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                                                        />
                                                        <View className={`flex-row p-1 rounded-xl items-center flex-1 ${isDark ? 'bg-slate-900/40' : 'bg-slate-200/30'}`}>
                                                            <TouchableOpacity
                                                                onPress={() => setRecurrenceUnit('day')}
                                                                className={`flex-1 py-2 items-center rounded-lg ${recurrenceUnit === 'day' ? 'bg-indigo-600 shadow-sm' : ''}`}
                                                            >
                                                                <Text className={`text-xs font-bold ${recurrenceUnit === 'day' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-500')}`}>
                                                                    {t('events.recurrence_days')}
                                                                </Text>
                                                            </TouchableOpacity>
                                                            <TouchableOpacity
                                                                onPress={() => setRecurrenceUnit('week')}
                                                                className={`flex-1 py-2 items-center rounded-lg ${recurrenceUnit === 'week' ? 'bg-indigo-600 shadow-sm' : ''}`}
                                                            >
                                                                <Text className={`text-xs font-bold ${recurrenceUnit === 'week' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-500')}`}>
                                                                    {t('events.recurrence_weeks')}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Compact Form */}
                                            <View className={`rounded-xl p-4 border ${isDark ? 'bg-slate-800/40 border-slate-700/30' : 'bg-slate-50 border-slate-200'}`}>
                                                <Text className={`text-sm font-bold mb-4 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                                    {t('events.modal.new_schedule')}
                                                </Text>

                                                {/* Fortress/Citadel Dropdown */}
                                                <View className="mb-3">
                                                    <Text className={`text-xs font-bold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                                        {editingEvent?.id === 'a_fortress' ? t('events.fortress') : t('events.citadel')}
                                                    </Text>
                                                    <TouchableOpacity
                                                        onPress={() => setActiveNamePickerId(activeNamePickerId === 'fortress_picker' ? null : 'fortress_picker')}
                                                        className={`p-3 rounded-lg border flex-row items-center justify-between ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300'}`}
                                                    >
                                                        <Text className={`text-base font-semibold ${selectedFortressName ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                                                            {selectedFortressName ? selectedFortressName.replace(/요새\s*(\d+)/, `${t('events.fortress')} $1`).replace(/성채\s*(\d+)/, `${t('events.citadel')} $1`) : `${editingEvent?.id === 'a_fortress' ? t('events.select_fortress') : t('events.select_citadel')}`}
                                                        </Text>
                                                        <Ionicons name="chevron-down" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                                                    </TouchableOpacity>
                                                </View>

                                                {/* Triple Wheel Picker (Pro) */}
                                                <View className="mb-6">
                                                    <View className="flex-row items-center justify-between mb-2 px-1">
                                                        <Text className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('events.day_of_week')}</Text>
                                                        <Text className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('events.modal.set_time')}</Text>
                                                    </View>
                                                    <View className={`rounded-2xl border p-2 flex-row items-center justify-around ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200'}`} style={{ height: 160 }}>
                                                        {/* Global Highlight Bar */}
                                                        <View pointerEvents="none" style={{ position: 'absolute', top: '50%', left: 8, right: 8, height: 44, marginTop: -22, backgroundColor: isDark ? '#38bdf815' : '#38bdf805', borderRadius: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: isDark ? '#38bdf830' : '#38bdf815', zIndex: 10 }} />

                                                        <WheelPicker
                                                            options={['일', '월', '화', '수', '목', '금', '토'].map(d => ({
                                                                label: t(`events.days.${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][['일', '월', '화', '수', '목', '금', '토'].indexOf(d)]}`),
                                                                value: d
                                                            }))}
                                                            value={selectedDayForSlot}
                                                            onChange={setSelectedDayForSlot}
                                                            isDark={isDark}
                                                            width={80}
                                                            showHighlight={false}
                                                            syncKey={pickerSyncKey}
                                                        />
                                                        <View className="w-[1px] h-12 bg-slate-700/20" />
                                                        <WheelPicker
                                                            options={Array.from({ length: 24 }, (_, i) => pad(i))}
                                                            value={editHour}
                                                            onChange={setEditHour}
                                                            isDark={isDark}
                                                            width={70}
                                                            showHighlight={false}
                                                            syncKey={pickerSyncKey}
                                                        />
                                                        <Text className={`text-lg font-black ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>:</Text>
                                                        <WheelPicker
                                                            options={Array.from({ length: 60 }, (_, i) => pad(i))}
                                                            value={editMinute}
                                                            onChange={setEditMinute}
                                                            isDark={isDark}
                                                            width={70}
                                                            showHighlight={false}
                                                            syncKey={pickerSyncKey}
                                                        />
                                                    </View>
                                                </View>

                                                {/* Add Button */}
                                                <TouchableOpacity
                                                    onPress={() => addFortressSlot()}
                                                    className={`w-full h-[52px] rounded-[16px] items-center flex-row justify-center ${editingSlotId ? 'bg-emerald-600' : 'bg-[#3182F6]'}`}
                                                >
                                                    <Ionicons name={editingSlotId ? "checkmark-circle" : "add-circle-outline"} size={20} color="white" style={{ marginRight: 8 }} />
                                                    <Text className="text-white font-bold text-[16px]">
                                                        {editingSlotId ? t('events.modal.update_schedule') : t('events.add_schedule_entry')}
                                                    </Text>
                                                </TouchableOpacity>
                                            </View>
                                        </ScrollView>
                                    </View>
                                ) : DATE_RANGE_IDS.includes(editingEvent?.id || '') || editingEvent?.category === '개인' ? (
                                    <View className="flex-1" style={{ overflow: 'visible', zIndex: activeDateDropdown ? 10000 : 1 }}>
                                        <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 150 }}>
                                            {(() => {
                                                return (
                                                    <View className={`mt-6 p-4 rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700/30' : 'bg-slate-100 border-slate-200'}`} style={{ zIndex: 50 }}>
                                                        <View className="flex-row items-center mb-4">
                                                            <Ionicons name="calendar-number-outline" size={16} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginRight: 6 }} />
                                                            <Text className="text-brand-accent text-xs font-bold uppercase">{t('events.set_schedule')}</Text>
                                                        </View>
                                                        <RenderDateSelector
                                                            label={t('events.start_datetime')}
                                                            value={mStart}
                                                            onChange={setMStart}
                                                            type="start"
                                                            activeDateDropdown={activeDateDropdown}
                                                            setActiveDateDropdown={setActiveDateDropdown}
                                                            isDark={isDark}
                                                            setShowDatePicker={setShowDatePicker}
                                                        />
                                                        <RenderDateSelector
                                                            label={t('events.end_datetime')}
                                                            value={mEnd}
                                                            onChange={setMEnd}
                                                            type="end"
                                                            activeDateDropdown={activeDateDropdown}
                                                            setActiveDateDropdown={setActiveDateDropdown}
                                                            isDark={isDark}
                                                            setShowDatePicker={setShowDatePicker}
                                                        />
                                                        {/* Duration Summary */}
                                                        {mStart && mEnd && (() => {
                                                            const parseDate = (v: string) => {
                                                                const [dp, tp] = v.split(' ');
                                                                const [y, mo, d] = dp.split('.');
                                                                const [hh, mm] = (tp || '00:00').split(':');
                                                                return new Date(+y, +mo - 1, +d, +hh, +mm);
                                                            };
                                                            const s = parseDate(mStart);
                                                            const e = parseDate(mEnd);
                                                            const diffMs = e.getTime() - s.getTime();
                                                            if (diffMs <= 0) return (
                                                                <View className={`mt-2 p-3 rounded-xl border border-dashed ${isDark ? 'border-rose-500/30 bg-rose-500/5' : 'border-rose-300 bg-rose-50'} flex-row items-center justify-center`}>
                                                                    <Ionicons name="alert-circle-outline" size={14} color="#ef4444" style={{ marginRight: 6 }} />
                                                                    <Text className="text-rose-400 text-xs font-bold">{t('events.error_end_before_start')}</Text>
                                                                </View>
                                                            );
                                                            const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                                            const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                                            const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                                                            let durationText = '';
                                                            if (days > 0) durationText += `${days}${t('events.day_unit')} `;
                                                            if (hours > 0) durationText += `${hours}${t('events.hour_unit')} `;
                                                            if (mins > 0 && days === 0) durationText += `${mins}${t('events.min_unit')}`;

                                                            return (
                                                                <View className={`mt-2 p-3 rounded-xl ${isDark ? 'bg-sky-500/10 border border-sky-500/20' : 'bg-sky-50 border border-sky-100'} flex-row items-center justify-center`}>
                                                                    <Text className={`text-xs font-bold ${isDark ? 'text-sky-300' : 'text-sky-600'}`}>{t('events.total_duration', { duration: durationText.trim() })}</Text>
                                                                </View>
                                                            );
                                                        })()}
                                                    </View>
                                                );
                                            })()}
                                        </ScrollView>
                                    </View>
                                ) : (
                                    <View className="flex-1" style={{ overflow: 'visible', zIndex: (hourDropdownVisible || minuteDropdownVisible) ? 200 : 1 }}>
                                        {/* Tabs Section */}
                                        {(() => {
                                            const singleSlotIDs = ['a_center', 'alliance_center', 'a_mercenary', 'alliance_mercenary', 'a_immigrate', 'alliance_immigrate', 'a_merge', 'alliance_merge', 'a_svs', 'alliance_svs', 'a_dragon', 'alliance_dragon', 'a_joe', 'alliance_joe', 'alliance_champion'];
                                            if (editingEvent?.category === '연맹' && !singleSlotIDs.includes(editingEvent.id)) {
                                                return (
                                                    <View className={`flex-row mb-2 p-1 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                        <TouchableOpacity
                                                            onPress={() => setActiveTab(1)}
                                                            className={`flex-1 py-3 items-center justify-center rounded-[12px] transition-all ${activeTab === 1 ? (isDark ? 'bg-[#333D4B]' : 'bg-white shadow-sm border border-[#E5E8EB]') : ''}`}
                                                        >
                                                            <Text className={`font-bold text-[14px] ${activeTab === 1 ? (isDark ? 'text-white' : 'text-[#333D4B]') : (isDark ? 'text-[#6B7684]' : 'text-[#8B95A1]')}`}>{t('events.slot1')}</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            onPress={() => setActiveTab(2)}
                                                            className={`flex-1 py-3 items-center justify-center rounded-[12px] transition-all ${activeTab === 2 ? (isDark ? 'bg-[#333D4B]' : 'bg-white shadow-sm border border-[#E5E8EB]') : ''}`}
                                                        >
                                                            <Text className={`font-bold text-[14px] ${activeTab === 2 ? (isDark ? 'text-white' : 'text-[#333D4B]') : (isDark ? 'text-[#6B7684]' : 'text-[#8B95A1]')}`}>{t('events.slot2')}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                );
                                            }
                                            return null;
                                        })()}

                                        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 150 }} showsVerticalScrollIndicator={false} className="flex-1">
                                            <View className="flex-1 justify-between pb-4">
                                                {/* Input Form - Conditional by Tab */}
                                                {editingEvent?.id !== 'a_center' && (
                                                    <View className={`flex-1 rounded-2xl p-3 border ${isDark ? 'bg-slate-800/40 border-slate-700/30' : 'bg-slate-100 border-slate-200'} justify-between`}>


                                                        {/* Team Overall Settings (Date & Recurrence) - NOW AT VERY TOP */}
                                                        {(() => {
                                                            const isT1 = activeTab === 1;
                                                            const curIsR = isRecurring;
                                                            const setCurIsR = setIsRecurring;
                                                            const curRecV = recurrenceValue;
                                                            const setCurRecV = setRecurrenceValue;
                                                            const curRecU = recurrenceUnit;
                                                            const setCurRecU = setRecurrenceUnit;
                                                            const curEnableSD = enableStartDate;
                                                            const setCurEnableSD = setEnableStartDate;
                                                            const curSD = eventStartDate;

                                                            return (
                                                                <>
                                                                    <View className={`mb-4 p-3 rounded-xl border ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                                                        <View className="flex-row items-center justify-between">
                                                                            <View className="flex-row items-center flex-1">
                                                                                <Ionicons name="calendar-number-outline" size={16} color="#0ea5e9" style={{ marginRight: 8 }} />
                                                                                <Text className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('events.specify_date')}</Text>
                                                                            </View>
                                                                            <Switch
                                                                                value={curEnableSD}
                                                                                onValueChange={setCurEnableSD}
                                                                                trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: '#0ea5e9' }}
                                                                                thumbColor={'white'}
                                                                                style={{ transform: [{ scale: 0.8 }] }}
                                                                            />
                                                                        </View>
                                                                        {curEnableSD && (
                                                                            <TouchableOpacity
                                                                                onPress={() => setShowDatePicker('startDate')}
                                                                                className={`mt-3 p-2.5 rounded-lg border ${isDark ? 'bg-slate-900/40 border-slate-600' : 'bg-white border-slate-300'}`}
                                                                            >
                                                                                <View className="flex-row items-center justify-between">
                                                                                    <Text className={`font-mono text-base ${curSD ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                                                                                        {curSD || 'YYYY-MM-DD'}
                                                                                    </Text>
                                                                                    <Ionicons name="calendar" size={18} color="#0ea5e9" />
                                                                                </View>
                                                                            </TouchableOpacity>
                                                                        )}
                                                                    </View>

                                                                    <View className={`mb-4 p-3 rounded-xl border ${isDark ? 'bg-slate-800/30 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                                                        <View className="flex-row items-center justify-between">
                                                                            <View className="flex-row items-center flex-1">
                                                                                <Ionicons name="repeat-outline" size={16} color="#8b5cf6" style={{ marginRight: 8 }} />
                                                                                <Text className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('events.recurrence')}</Text>
                                                                                {curIsR && (
                                                                                    <Text className={`text-[10px] ml-2 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                                                        ({t('events.recurrence_guide', {
                                                                                            value: curRecV,
                                                                                            unit: curRecU === 'day' ? t('events.day_unit') : t('events.week_unit')
                                                                                        })})
                                                                                    </Text>
                                                                                )}
                                                                            </View>
                                                                            <Switch
                                                                                value={curIsR}
                                                                                onValueChange={setCurIsR}
                                                                                trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: '#8b5cf6' }}
                                                                                thumbColor={'white'}
                                                                                style={{ transform: [{ scale: 0.8 }] }}
                                                                            />
                                                                        </View>
                                                                        {curIsR && (
                                                                            <View className="mt-3">
                                                                                <View className="flex-row items-center gap-2">
                                                                                    <TextInput
                                                                                        value={curRecV}
                                                                                        onChangeText={setCurRecV}
                                                                                        keyboardType="numeric"
                                                                                        placeholder="1"
                                                                                        placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                                                                                        className={`w-16 p-2 rounded-lg border text-center font-bold ${isDark ? 'bg-slate-900/60 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                                                                                    />
                                                                                    <View className={`flex-row p-1 rounded-xl items-center flex-1 ${isDark ? 'bg-slate-900/40' : 'bg-slate-200/30'}`}>
                                                                                        <TouchableOpacity
                                                                                            onPress={() => setCurRecU('day')}
                                                                                            className={`flex-1 py-2 items-center rounded-lg ${curRecU === 'day' ? 'bg-indigo-600 shadow-sm' : ''}`}
                                                                                        >
                                                                                            <Text className={`text-[10px] sm:text-xs font-bold ${curRecU === 'day' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-500')}`}>
                                                                                                {t('events.recurrence_days')}
                                                                                            </Text>
                                                                                        </TouchableOpacity>
                                                                                        <TouchableOpacity
                                                                                            onPress={() => setCurRecU('week')}
                                                                                            className={`flex-1 py-2 items-center rounded-lg ${curRecU === 'week' ? 'bg-indigo-600 shadow-sm' : ''}`}
                                                                                        >
                                                                                            <Text className={`text-[10px] sm:text-xs font-bold ${curRecU === 'week' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-500')}`}>
                                                                                                {t('events.recurrence_weeks')}
                                                                                            </Text>
                                                                                        </TouchableOpacity>
                                                                                    </View>
                                                                                </View>
                                                                            </View>
                                                                        )}
                                                                    </View>
                                                                </>
                                                            );
                                                        })()}

                                                        {/* Registered Slots Section */}
                                                        <View className="flex-row items-center justify-between mb-2 px-1">
                                                            <Text className={`text-[10px] uppercase font-bold tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                                {t('events.modal.registered_schedule')}
                                                            </Text>
                                                        </View>

                                                        <ScrollView
                                                            horizontal
                                                            showsHorizontalScrollIndicator={false}
                                                            className="flex-none mb-4"
                                                            contentContainerStyle={{ paddingVertical: 4 }}
                                                        >
                                                            {(activeTab === 1 ? slots1 : slots2).map((slot, index) => (
                                                                <TouchableOpacity
                                                                    key={slot.id || index}
                                                                    onPress={() => {
                                                                        if (editingSlotId === slot.id) {
                                                                            setEditingSlotId(null);
                                                                        } else {
                                                                            setEditingSlotId(slot.id);
                                                                            setSelectedDayForSlot(slot.day);
                                                                            if (slot.time && slot.time.includes(':')) {
                                                                                const [h, m] = slot.time.split(':');
                                                                                setEditHour(h);
                                                                                setEditMinute(m);
                                                                            }
                                                                            setPickerSyncKey(prev => prev + 1);
                                                                        }
                                                                    }}
                                                                    className={`flex-row items-center mr-2 px-3 py-1.5 rounded-full border ${editingSlotId === slot.id ? (isDark ? 'bg-[#3182F6]/20 border-[#3182F6]' : 'bg-[#E8F3FF] border-[#3182F6]') : (isDark ? 'bg-[#333D4B] border-transparent' : 'bg-[#F2F4F6] border-transparent')}`}
                                                                >
                                                                    <Text className={`text-[13px] font-bold mr-1.5 ${editingSlotId === slot.id ? (isDark ? 'text-[#4F93F7]' : 'text-[#3182F6]') : (isDark ? 'text-[#B0B8C1]' : 'text-[#4E5968]')}`}>
                                                                        {t(`events.days.${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'daily', 'always'][['일', '월', '화', '수', '목', '금', '토', '매일', '상시'].indexOf(slot.day)]}`)}{slot.time ? `(${slot.time})` : ''}
                                                                    </Text>
                                                                    <TouchableOpacity
                                                                        onPress={() => removeTimeSlot(slot.id)}
                                                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                                                    >
                                                                        <Ionicons name="close-circle" size={16} color="#ef4444" />
                                                                    </TouchableOpacity>
                                                                </TouchableOpacity>
                                                            ))}
                                                            {(activeTab === 1 ? slots1 : slots2).length === 0 && (
                                                                <View
                                                                    className={`flex-1 h-12 flex-row items-center justify-center border rounded-[16px] ${isDark ? 'border-[#333D4B] bg-[#191F28]' : 'border-[#E5E8EB] bg-[#F9FAFB]'}`}
                                                                    style={{ borderStyle: 'dashed', borderWidth: 1 }}
                                                                >
                                                                    <Ionicons name="alert-circle-outline" size={16} color={isDark ? "#8B95A1" : "#8B95A1"} style={{ marginRight: 6 }} />
                                                                    <Text className={`text-[13px] font-medium ${isDark ? 'text-[#8B95A1]' : 'text-[#8B95A1]'}`}>{t('events.modal.no_schedule')}</Text>
                                                                </View>
                                                            )}
                                                        </ScrollView>


                                                        {selectedDayForSlot !== '상시' ? (
                                                            <>
                                                                {/* Triple Wheel Picker (Pro) for General Events */}
                                                                <View className="mb-6">
                                                                    <View className="flex-row items-center justify-between mb-2 px-1">
                                                                        <Text className={`text-[13px] font-bold ${isDark ? 'text-[#B0B8C1]' : 'text-[#4E5968]'}`}>{t('events.day_of_week')}</Text>
                                                                        <Text className={`text-[13px] font-bold ${isDark ? 'text-[#B0B8C1]' : 'text-[#4E5968]'}`}>{t('events.modal.set_time')}</Text>
                                                                    </View>
                                                                    <View className={`rounded-[20px] border p-2 flex-row items-center justify-around ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-[#E5E8EB]'}`} style={{ height: 160 }}>
                                                                        {/* Global Highlight Bar - Precisely Centered */}
                                                                        <View pointerEvents="none" style={{ position: 'absolute', top: '50%', left: 8, right: 8, height: 44, marginTop: -22, backgroundColor: isDark ? '#38bdf812' : '#38bdf805', borderRadius: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: isDark ? '#38bdf825' : '#38bdf812', zIndex: 10 }} />

                                                                        <View style={{ height: 132, justifyContent: 'center' }}>
                                                                            <WheelPicker
                                                                                options={dayOptionsForPicker}
                                                                                value={selectedDayForSlot}
                                                                                onChange={setSelectedDayForSlot}
                                                                                isDark={isDark}
                                                                                width={80}
                                                                                showHighlight={false}
                                                                                syncKey={pickerSyncKey}
                                                                            />
                                                                        </View>

                                                                        <View className="w-[1px] h-10 bg-slate-700/20" />

                                                                        <View className="flex-row items-center">
                                                                            <View style={{ height: 132, justifyContent: 'center' }}>
                                                                                <WheelPicker
                                                                                    options={hourOptionsForPicker}
                                                                                    value={editHour}
                                                                                    onChange={setEditHour}
                                                                                    isDark={isDark}
                                                                                    width={70}
                                                                                    showHighlight={false}
                                                                                    syncKey={pickerSyncKey}
                                                                                />
                                                                            </View>
                                                                            <Text className={`text-lg font-black ${isDark ? 'text-slate-600' : 'text-slate-300'}`} style={{ marginHorizontal: -2, paddingBottom: 4 }}>:</Text>
                                                                            <View style={{ height: 132, justifyContent: 'center' }}>
                                                                                <WheelPicker
                                                                                    options={minuteOptionsForPicker}
                                                                                    value={editMinute}
                                                                                    onChange={setEditMinute}
                                                                                    isDark={isDark}
                                                                                    width={70}
                                                                                    showHighlight={false}
                                                                                    syncKey={pickerSyncKey}
                                                                                />
                                                                            </View>

                                                                        </View>

                                                                    </View>

                                                                </View>

                                                                {/* Bear Hunt: Only allow one time slot (but allow editing) */}
                                                                {editingEvent?.id?.includes('bear') ? (
                                                                    editingSlotId ? (
                                                                        <View className="flex-row gap-2 mt-2">
                                                                            <TouchableOpacity onPress={() => addTimeSlot()} className="flex-1 bg-emerald-500/20 border-emerald-500/40 py-4 rounded-xl border items-center flex-row justify-center">
                                                                                <Ionicons name="checkmark-circle" size={20} color="#10b981" style={{ marginRight: 8 }} />
                                                                                <Text className="text-emerald-400 font-bold text-base">{t('events.edit_completed')}</Text>
                                                                            </TouchableOpacity>
                                                                            <TouchableOpacity
                                                                                onPress={() => { setEditingSlotId(null); setEditHour('22'); setEditMinute('00'); }}
                                                                                className="bg-slate-800 px-4 py-4 rounded-xl border border-slate-700 justify-center"
                                                                            >
                                                                                <Text className="text-slate-400 font-semibold text-sm">{t('common.cancel')}</Text>
                                                                            </TouchableOpacity>
                                                                        </View>
                                                                    ) : (
                                                                        <View className="mt-3 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                                                                            <Text className="text-blue-400 text-sm text-center">
                                                                                {t('events.modal.bear_hunt_single_time', { defaultValue: '곰 사냥은 한 개의 시간만 등록할 수 있습니다.' })}
                                                                            </Text>
                                                                        </View>
                                                                    )
                                                                ) : (
                                                                    <View className="flex-row gap-2 mt-2">
                                                                        <TouchableOpacity onPress={() => addTimeSlot()} className={`flex-1 ${editingSlotId ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-emerald-500 border-emerald-400'} py-4 rounded-xl border items-center flex-row justify-center`}>
                                                                            <Ionicons name={editingSlotId ? "checkmark-circle" : "add-circle-outline"} size={20} color={editingSlotId ? "#10b981" : "white"} style={{ marginRight: 8 }} />
                                                                            <Text className={`${editingSlotId ? 'text-emerald-400' : 'text-white'} font-bold text-base`}>{editingSlotId ? t('events.edit_completed') : t('events.modal.add_time_slot')}</Text>
                                                                        </TouchableOpacity>
                                                                        {!!editingSlotId && (
                                                                            <TouchableOpacity
                                                                                onPress={() => { setEditingSlotId(null); setEditHour('22'); setEditMinute('00'); }}
                                                                                className="bg-slate-800 px-4 py-4 rounded-xl border border-slate-700 justify-center"
                                                                            >
                                                                                <Text className="text-slate-400 font-semibold text-sm">{t('common.cancel')}</Text>
                                                                            </TouchableOpacity>
                                                                        )}
                                                                    </View>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <View className="flex-1 justify-center">
                                                                <View className="flex-row items-center mb-2">
                                                                    <Ionicons name="calendar-outline" size={14} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginRight: 6 }} />
                                                                    <Text className="text-brand-accent text-xs font-bold uppercase">{t('events.day_of_week')}</Text>
                                                                </View>
                                                                <View className="flex-row flex-wrap justify-between gap-1">
                                                                    {['월', '화', '수', '목', '금', '토', '일', '상시'].map((d) => {
                                                                        const isSelected = selectedDayForSlot === d;
                                                                        const dayLabel = d === '월' ? t('events.days.mon') : d === '화' ? t('events.days.tue') : d === '수' ? t('events.days.wed') : d === '목' ? t('events.days.thu') : d === '금' ? t('events.days.fri') : d === '토' ? t('events.days.sat') : d === '일' ? t('events.days.sun') : t('events.days.always');
                                                                        return (
                                                                            <TouchableOpacity key={d} onPress={() => toggleDay(d)} className={`w-[11%] h-9 rounded-lg items-center justify-center border ${isSelected ? 'bg-brand-accent border-brand-accent' : 'bg-slate-800/60 border-slate-700'}`}><Text className={`font-bold text-[10px] ${isSelected ? 'text-brand-dark' : 'text-slate-300'}`}>{dayLabel}</Text></TouchableOpacity>
                                                                        );
                                                                    })}
                                                                </View>
                                                                <View className="flex-1 justify-center items-center">
                                                                    <TouchableOpacity onPress={addTimeSlot} className="bg-brand-accent/20 py-4 px-8 rounded-xl border border-brand-accent/40 items-center"><Text className="text-brand-accent font-bold text-lg">{t('events.days.always')} {t('common.add')}</Text></TouchableOpacity>
                                                                </View>
                                                            </View>
                                                        )}
                                                    </View>
                                                )}
                                            </View>

                                        </ScrollView>
                                    </View>
                                )}
                            </View>

                            <View className={`px-4 pt-4 pb-6 border-t ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-[#E5E8EB]'}`} style={{ zIndex: 100 }}>
                                <View className="flex-row gap-3">
                                    <TouchableOpacity onPress={handleDeleteSchedule} className={`flex-1 h-[52px] rounded-[16px] items-center justify-center ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}>
                                        <Text className={`font-bold text-[16px] ${isDark ? 'text-[#B0B8C1]' : 'text-[#4E5968]'}`}>{t('common.reset')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={saveSchedule} className="flex-[2] bg-[#3182F6] h-[52px] rounded-[16px] items-center justify-center">
                                        <Text className="text-white font-bold text-[16px]">{t('common.save')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Global Overlay Picker */}
                            {(activeNamePickerId || activeFortressDropdown) && (() => {
                                const isFortress = editingEvent?.id === 'a_fortress';
                                const list = isFortress ? fortressList : citadelList;
                                const setList = isFortress ? setFortressList : setCitadelList;

                                let options: string[] = [];
                                let title = '';
                                let selectedValue = '';
                                let onSelect: (v: string) => void = () => { };

                                if (activeNamePickerId === 'fortress_picker') {
                                    // Simplified UI: Fortress/Citadel picker
                                    title = isFortress ? t('events.select_fortress') : t('events.select_citadel');
                                    options = isFortress ? FORTRESS_IDS.map(id => `${t('events.fortress')} ${id.split('_')[1]}`) : CITADEL_IDS.map(id => `${t('events.citadel')} ${id.split('_')[1]}`);
                                    selectedValue = selectedFortressName;
                                    onSelect = (v) => {
                                        setSelectedFortressName(v);
                                        setActiveNamePickerId(null);
                                    };
                                } else if (activeNamePickerId) {
                                    // Legacy: Inline name picker for registered slots
                                    title = isFortress ? t('events.select_fortress') : t('events.select_citadel');
                                    options = isFortress ? FORTRESS_IDS.map(id => `${t('events.fortress')} ${id.split('_')[1]}`) : CITADEL_IDS.map(id => `${t('events.citadel')} ${id.split('_')[1]}`);
                                    selectedValue = list.find(l => l.id === activeNamePickerId)?.name || '';
                                    onSelect = (v) => {
                                        const newList = [...list];
                                        const idx = newList.findIndex(l => l.id === activeNamePickerId);
                                        if (idx > -1) { newList[idx].name = v; setList(newList); }
                                        setActiveNamePickerId(null);
                                    };
                                } else if ((activeFortressDropdown as any) === 'day_picker') {
                                    // Simplified UI: Day picker
                                    title = t('events.day_of_week');
                                    const krDays = ['월', '화', '수', '목', '금', '토', '일'];
                                    const enKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                                    options = krDays.map((d, i) => t(`events.days.${enKeys[i]}`));
                                    const idx = krDays.indexOf(selectedDayForSlot);
                                    selectedValue = idx >= 0 ? t(`events.days.${enKeys[idx]}`) : '';
                                    onSelect = (v) => {
                                        const selectedIdx = options.indexOf(v);
                                        if (selectedIdx >= 0) {
                                            setSelectedDayForSlot(krDays[selectedIdx]);
                                        }
                                        setActiveFortressDropdown(null);
                                    };
                                } else if ((activeFortressDropdown as any) === 'time_picker') {
                                    // Simplified UI: Time picker (30-minute intervals)
                                    title = t('events.modal.set_time');
                                    options = [];
                                    for (let h = 0; h < 24; h++) {
                                        for (let m of ['00', '30']) {
                                            options.push(`${h.toString().padStart(2, '0')}:${m}`);
                                        }
                                    }
                                    selectedValue = `${editHour}:${editMinute}`;
                                    onSelect = (v) => {
                                        const [h, m] = v.split(':');
                                        setEditHour(h);
                                        setEditMinute(m);
                                        setActiveFortressDropdown(null);
                                    };
                                } else if (activeFortressDropdown) {
                                    // Legacy: Inline time picker for registered slots
                                    const { id, type } = activeFortressDropdown;
                                    const item = list.find(l => l.id === id);
                                    if (type === 'h') {
                                        title = t('events.modal.select_hour');
                                        options = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
                                        selectedValue = item?.h || '00';
                                        onSelect = (v) => {
                                            const newList = [...list];
                                            const idx = newList.findIndex(l => l.id === id);
                                            if (idx > -1) { newList[idx].h = v; setList(newList); }
                                            setActiveFortressDropdown(null);
                                        };
                                    } else {
                                        title = t('events.modal.select_minute');
                                        options = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];
                                        selectedValue = item?.m || '00';
                                        onSelect = (v) => {
                                            const newList = [...list];
                                            const idx = newList.findIndex(l => l.id === id);
                                            if (idx > -1) { newList[idx].m = v; setList(newList); }
                                            setActiveFortressDropdown(null);
                                        };
                                    }
                                }

                                return (
                                    <Pressable className="absolute inset-0 bg-black/60 z-[1000] justify-center items-center" onPress={() => { setActiveNamePickerId(null); setActiveFortressDropdown(null); }}>
                                        <Pressable className={`w-64 rounded-2xl overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-white'}`} style={{ maxHeight: '60%' }} onPress={e => e.stopPropagation()}>
                                            <View className={`px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                                                <Text className={`text-center font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</Text>
                                            </View>
                                            <ScrollView style={{ maxHeight: 400 }}>
                                                {options.map((item) => (
                                                    <TouchableOpacity
                                                        key={item}
                                                        onPress={() => onSelect(item)}
                                                        className={`px-4 py-3 border-b items-center justify-center ${isDark ? 'border-slate-700 hover:bg-slate-700' : 'border-slate-100 hover:bg-slate-50'} ${selectedValue === item ? (isDark ? 'bg-sky-500/20' : 'bg-sky-50') : ''}`}
                                                    >
                                                        <Text className={`font-semibold ${selectedValue === item ? 'text-sky-500' : (isDark ? 'text-slate-300' : 'text-slate-700')}`}>{item}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </ScrollView>
                                        </Pressable>
                                    </Pressable>
                                );
                            })()}

                        </Pressable>
                    </Pressable>
                </Modal>

                {/* Attendee Management Modal */}
                <Modal visible={attendeeModalVisible} transparent animationType="slide">
                    <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setAttendeeModalVisible(false)}>
                        <Pressable className="flex-1 justify-end" onPress={() => { }}>
                            <View className={`flex-1 rounded-t-[24px] border-t overflow-hidden ${isDark ? 'bg-[#191F28] border-[#333D4B] shadow-2xl' : 'bg-white border-transparent shadow-2xl'}`}>
                                <View className={`h-16 flex-row items-center justify-between px-6 border-b ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-[#E5E8EB]'}`}>
                                    <View className="flex-row items-center flex-1 mr-2">
                                        <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>
                                            {managedEvent?.title}
                                        </Text>
                                    </View>
                                    <View className="flex-row items-center">
                                        {isAdmin && (
                                            <TouchableOpacity
                                                onPress={addAttendeeRow}
                                                className={`mr-3 px-3 py-2 rounded-full border flex-row items-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}
                                            >
                                                <Ionicons name="add" size={14} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginRight: 4 }} />
                                                <Text className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                    {t('events.modal.add_lord')}
                                                </Text>
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity onPress={() => setAttendeeModalVisible(false)} className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}>
                                            <Ionicons name="close" size={24} color={isDark ? "#B0B8C1" : "#4E5968"} />
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
                                                className={`mb-4 p-4 rounded-[20px] border relative ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-[#E5E8EB]'}`}
                                            >
                                                <View className="flex-row items-center mb-3" style={{ zIndex: 50, elevation: 50 }}>
                                                    <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}>
                                                        <Text className={`font-bold ${isDark ? 'text-[#B0B8C1]' : 'text-[#4E5968]'}`}>{index + 1}</Text>
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
                                                                {attendee.penalty === 'NO_SHOW' ? t('events.modal.penalty_no_show') : t('events.modal.penalty_notice')}
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
                                                    <HeroPicker num={1} value={attendee.hero1 || ''} onSelect={(v) => updateAttendeeField(attendee.id!, 'hero1', v)} />
                                                    <HeroPicker num={2} value={attendee.hero2 || ''} onSelect={(v) => updateAttendeeField(attendee.id!, 'hero2', v)} />
                                                    <HeroPicker num={3} value={attendee.hero3 || ''} onSelect={(v) => updateAttendeeField(attendee.id!, 'hero3', v)} />
                                                </View>
                                            </View>
                                        )
                                    }}
                                    ListEmptyComponent={
                                        <View className="items-center justify-center py-10 opacity-50">
                                            <Ionicons name="documents-outline" size={48} color="#94a3b8" />
                                            <Text className="text-slate-400 mt-4 font-semibold">{t('events.modal.no_attendees_registered')}</Text>
                                            <Text className="text-slate-600 text-xs mt-1">{t('events.modal.admin_add_attendees_message')}</Text>
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
                                        <TouchableOpacity
                                            onPress={saveAttendees}
                                            disabled={isSaving}
                                            className={`mt-4 w-full h-14 rounded-2xl flex-row items-center justify-center shadow-lg ${isSaving ? (isDark ? 'bg-slate-800' : 'bg-slate-200') : 'bg-blue-600'}`}
                                        >
                                            {isSaving ? (
                                                <ActivityIndicator color={isDark ? "#94a3b8" : "#64748b"} />
                                            ) : (
                                                <>
                                                    <Ionicons name="save-outline" size={20} color="white" style={{ marginRight: 8 }} />
                                                    <Text className="text-white text-base font-bold">
                                                        {(() => {
                                                            const isBearOrFoundry = managedEvent?.id.includes('bear') || managedEvent?.id.includes('foundry') || managedEvent?.id.includes('canyon');
                                                            const isBear = managedEvent?.id.includes('bear');
                                                            const teamLabel = isBear ? t(`events.bear${managedGroupIndex + 1}`) : `${t('events.team_unit')}${managedGroupIndex + 1}`;
                                                            const label = isBearOrFoundry ? `[${teamLabel}] ` : '';
                                                            const count = bulkAttendees.filter(a => a.name?.trim()).length;
                                                            return `${label}${t('events.modal.save_attendees')} (${count}${t('events.person_unit')})`;
                                                        })()}
                                                    </Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    ) : (
                                        <View className="w-full py-4 items-center">
                                            <Text className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('events.modal.admin_only_edit_attendees')}</Text>
                                        </View>
                                    )}
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
                                                {t('events.modal.select_absence_reason')}
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
                                                <Text className="text-yellow-500 font-bold">{t('events.modal.penalty_notice')}</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => {
                                                    updateAttendeeField(penaltyTarget.id, 'penalty', 'NO_SHOW');
                                                    setPenaltyTarget(null);
                                                }}
                                                className="w-full py-4 bg-red-500/10 border border-red-500/50 rounded-2xl items-center flex-row justify-center"
                                            >
                                                <Ionicons name="skull" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                                                <Text className="text-red-500 font-bold">{t('events.modal.penalty_no_show')}</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => {
                                                    updateAttendeeField(penaltyTarget.id, 'penalty', '');
                                                    setPenaltyTarget(null);
                                                }}
                                                className={`w-full py-4 border rounded-2xl items-center flex-row justify-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                                            >
                                                <Ionicons name="refresh" size={18} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginRight: 8 }} />
                                                <Text className={`font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('events.modal.reset_status')}</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => setPenaltyTarget(null)}
                                                className="w-full py-3 items-center mt-2"
                                            >
                                                <Text className={isDark ? 'text-slate-500' : 'text-slate-400'}>{t('common.cancel')}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </Pressable>
                    </Pressable>
                </Modal>
                {/* Wiki Browser Modal (Web Only) */}
                <Modal visible={browserVisible && Platform.OS === 'web'
                } animationType="slide" transparent={false} >
                    <View className="flex-1 bg-white">
                        <View className="h-16 bg-slate-900 flex-row items-center justify-between px-4 border-b border-slate-700">
                            <View className="flex-row items-center flex-1 mr-4">
                                <Text className="text-white font-semibold mr-2">🌐 {t('events.wiki')}</Text>
                                <Text className="text-slate-400 text-xs truncate flex-1" numberOfLines={1}>{currentWikiUrl}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setBrowserVisible(false)}
                                className="bg-slate-700 px-4 py-2 rounded-lg hover:bg-slate-600"
                            >
                                <Text className="text-white font-semibold text-sm">{t('common.close')} ✖️</Text>
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
                                        className={`flex-1 h-[52px] items-center justify-center rounded-[16px] border ${isDark ? 'bg-[#333D4B] border-transparent' : 'bg-[#F2F4F6] border-transparent'}`}
                                    >
                                        <Text className={`text-center font-bold text-[16px] ${isDark ? 'text-[#B0B8C1]' : 'text-[#4E5968]'}`}>{t('common.cancel')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setCustomAlert({ ...customAlert, visible: false });
                                            if (customAlert.onConfirm) customAlert.onConfirm();
                                        }}
                                        className="flex-1 h-[52px] items-center justify-center bg-[#E0264D] rounded-[16px]"
                                    >
                                        <Text className="text-white text-center font-bold text-[16px]">{t('common.delete')}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => {
                                        setCustomAlert({ ...customAlert, visible: false });
                                        if (customAlert.onConfirm) customAlert.onConfirm();
                                    }}
                                    className={`w-full h-[52px] rounded-[16px] items-center justify-center ${customAlert.type === 'success' ? 'bg-[#10B981]' : customAlert.type === 'error' ? 'bg-[#E0264D]' : 'bg-[#F2B308]'}`}
                                >
                                    <Text className="text-white text-center font-bold text-[16px]">{t('common.ok')}</Text>
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
                            // Determine selected value based on picker type
                            let selectedValue = '';
                            if (showDatePicker === 'startDate') {
                                // For startDate, convert YYYY-MM-DD to YYYY.MM.DD format for display
                                selectedValue = eventStartDate ? eventStartDate.replace(/-/g, '.') + ' 00:00' : '';
                            } else {
                                selectedValue = showDatePicker === 'start' ? mStart : mEnd;
                            }
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

                            const monthNames = [
                                t('common.month_1'), t('common.month_2'), t('common.month_3'), t('common.month_4'),
                                t('common.month_5'), t('common.month_6'), t('common.month_7'), t('common.month_8'),
                                t('common.month_9'), t('common.month_10'), t('common.month_11'), t('common.month_12')
                            ];

                            const dayNames = [
                                t('events.days.sun'), t('events.days.mon'), t('events.days.tue'), t('events.days.wed'),
                                t('events.days.thu'), t('events.days.fri'), t('events.days.sat')
                            ];

                            return (
                                <View className={`w-full max-w-sm rounded-[24px] overflow-hidden border shadow-2xl ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-transparent'}`}>
                                    {/* Calendar Header */}
                                    <View className={`flex-row items-center justify-between p-6 border-b ${isDark ? 'border-[#333D4B]' : 'border-[#E5E8EB]'}`}>
                                        <Text className={`text-[20px] font-bold ${isDark ? 'text-[#F2F4F6]' : 'text-[#191F28]'}`}>{year}{t('common.year')} {monthNames[month]}</Text>
                                        <View className="flex-row gap-2">
                                            <TouchableOpacity onPress={() => changeMonth(-1)} className={`w-9 h-9 items-center justify-center rounded-[10px] ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}><Ionicons name="chevron-back" size={20} color={isDark ? "#B0B8C1" : "#4E5968"} /></TouchableOpacity>
                                            <TouchableOpacity onPress={() => changeMonth(1)} className={`w-9 h-9 items-center justify-center rounded-[10px] ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}><Ionicons name="chevron-forward" size={20} color={isDark ? "#B0B8C1" : "#4E5968"} /></TouchableOpacity>
                                        </View>
                                    </View>\

                                    {/* Days Header */}
                                    <View className="flex-row px-4 pt-4">
                                        {dayNames.map((d, i) => (
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

                                                        if (showDatePicker === 'startDate') {
                                                            // For startDate, save in YYYY-MM-DD format
                                                            const isoDateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                                            setEventStartDate(isoDateStr);
                                                        } else if (showDatePicker === 'start') {
                                                            setMStart(`${dateStr} ${timePart}`);
                                                        } else {
                                                            setMEnd(`${dateStr} ${timePart}`);
                                                        }
                                                        setShowDatePicker(null);
                                                    }}
                                                    className="w-[14.28%] aspect-square items-center justify-center p-1"
                                                >
                                                    {day && (
                                                        <View className={`w-full h-full rounded-[14px] items-center justify-center ${isSelected ? 'bg-[#3182F6]' : isToday ? (isDark ? 'bg-[#3182F6]/20 border border-[#3182F6]/50' : 'bg-[#E8F3FF] border border-[#3182F6]/30') : ''}`}>
                                                            <Text className={`text-[14px] font-bold ${isSelected ? 'text-white' : isToday ? (isDark ? 'text-[#4F93F7]' : 'text-[#3182F6]') : isDark ? (idx % 7 === 0 ? 'text-[#FF5F5F]' : idx % 7 === 6 ? 'text-[#4F93F7]' : 'text-[#B0B8C1]') : (idx % 7 === 0 ? 'text-[#F04452]' : idx % 7 === 6 ? 'text-[#3182F6]' : 'text-[#333D4B]')}`}>
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
                                        className={`py-4 items-center border-t active:opacity-70 ${isDark ? 'border-[#333D4B]' : 'border-[#E5E8EB]'}`}
                                    >
                                        <Text className={`font-bold text-[16px] ${isDark ? 'text-[#B0B8C1]' : 'text-[#4E5968]'}`}>{t('common.close')}</Text>
                                    </TouchableOpacity>\
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
                        <View className={`w-full max-w-sm p-6 rounded-[24px] border shadow-2xl items-center ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-transparent'}`}>
                            <View className={`w-16 h-16 rounded-full items-center justify-center mb-4 ${isDark ? 'bg-[#333D4B]' : 'bg-[#FFF8DD]'}`}>
                                <Ionicons name="warning" size={32} color={isDark ? "#FFD43B" : "#F2B308"} />
                            </View>
                            <Text className={`text-[20px] font-bold mb-2 text-center ${isDark ? 'text-[#F2F4F6]' : 'text-[#191F28]'}`}>{t('common.unsaved_changes')}</Text>
                            <Text className={`text-center mb-6 text-[15px] leading-6 font-medium ${isDark ? 'text-[#8B95A1]' : 'text-[#6B7684]'}`}>
                                {t('common.unsaved_changes_message')}
                            </Text>

                            <View className="flex-row gap-3 w-full">
                                <TouchableOpacity
                                    onPress={() => {
                                        setWarningModalVisible(false);
                                        setPendingTab(null);
                                    }}
                                    className={`flex-1 h-[52px] items-center justify-center rounded-[16px] border ${isDark ? 'bg-[#333D4B] border-transparent' : 'bg-[#F2F4F6] border-transparent'}`}
                                >
                                    <Text className={`text-center font-bold text-[16px] ${isDark ? 'text-[#B0B8C1]' : 'text-[#4E5968]'}`}>{t('common.cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        setWarningModalVisible(false);
                                        if (pendingTab) setActiveTab(pendingTab);
                                        setPendingTab(null);
                                    }}
                                    className="flex-1 h-[52px] items-center justify-center bg-[#F2B308] rounded-[16px]"
                                >
                                    <Text className="text-white text-center font-bold text-[16px]">{t('common.navigate_without_save')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>\
                    </View>
                </Modal>
            </View >
        </View >
    );
}
