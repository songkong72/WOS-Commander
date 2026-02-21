import React, { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator, useWindowDimensions, Linking, Platform, Pressable, Animated, Dimensions, Switch } from 'react-native';
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
// BlurView moved to modal components
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// Custom Korean Calendar Locale Constants
// Note: Dates and days are localized using t() keys in the render logic

// Web-specific scrollbar styles are now handled globally in global.css
import { WikiEvent, INITIAL_WIKI_EVENTS, EventCategory } from '../../data/wiki-events';
import { ADDITIONAL_EVENTS } from '../../data/new-events';
import { SUPER_ADMINS } from '../../data/admin-config';
import * as Notifications from 'expo-notifications';
import TimelineView from '../../components/TimelineView';
import { pad, formatDisplayDate, getKoreanDayOfWeek as getKoreanDayOfWeekUtil } from '../utils/eventHelpers';
import { SINGLE_SLOT_IDS, DATE_RANGE_IDS } from '../utils/eventStatus';
import { useScheduleEditor } from '../hooks/useScheduleEditor';
import ShimmerIcon from '../../components/common/ShimmerIcon';
import GrowthEventCard from '../../components/events/GrowthEventCard';
import EventGuideModal from '../../components/modals/EventGuideModal';
import AttendanceModal from '../../components/modals/AttendanceModal';
import ScheduleModal from '../../components/modals/ScheduleModal';
import DatePickerModal from '../../components/modals/DatePickerModal';
import { CustomAlert, WarningModal } from '../../components/modals/AlertModals';
// EventPickers, RenderDateSelector, WheelPicker moved to modal components

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

// Helper functions and sub-components have been extracted to separate files.




export default function EventTracker() {
    const { width } = useWindowDimensions();
    const isDesktop = width > 768; // Simple breakdown for Desktop layout

    const [selectedCategory, setSelectedCategory] = useState<EventCategory>('전체');
    const [viewMode, setViewMode] = useState<'card' | 'timeline'>('card');
    const [timezone, setTimezone] = useState<'LOCAL' | 'UTC'>('LOCAL');
    const [events, setEvents] = useState<WikiEvent[]>([...INITIAL_WIKI_EVENTS, ...ADDITIONAL_EVENTS].map(e => ({ ...e, day: '', time: '' })));
    const { auth, serverId, allianceId } = useAuth();
    const { t } = useTranslation();
    const { theme, toggleTheme, fontSizeScale } = useTheme();
    const isDark = theme === 'dark';



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
    const catFadeAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        catFadeAnim.setValue(0);
        Animated.timing(catFadeAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: false
        }).start();
    }, [selectedCategory, viewMode]);

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
    // Track selected team tab for bear/foundry events (eventId -> tab index)


    // Firebase Event Schedules removed from here (moved up)

    // Firebase Event Schedules removed from here (moved up)

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
            const teamIdx = params.teamIdx ? parseInt(Array.isArray(params.teamIdx) ? params.teamIdx[0] : params.teamIdx) : undefined;

            setHighlightId(focusId);
            setSelectedCategory('전체');

            if (teamIdx !== undefined) {
                handleSetSelectedTeamTab(focusId, teamIdx);
            }

            setTimeout(() => {
                const yPos = itemLayouts.current[focusId];
                if (yPos !== undefined && scrollViewRef.current) {
                    scrollViewRef.current.scrollTo({ y: yPos - 20, animated: true });
                }
            }, 600);

            setTimeout(() => setHighlightId(null), 2500);
        }
    }, [params.focusId, params.teamIdx, schedulesLoading, events.length]);

    // Permission request for notifications

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
        onConfirm?: () => void,
        confirmLabel?: string
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'error'
    });

    const showCustomAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'confirm' = 'error', onConfirm?: () => void, confirmLabel?: string) => {
        setCustomAlert({ visible: true, title, message, type, onConfirm, confirmLabel });
    };

    // Warning Modal State
    const [warningModalVisible, setWarningModalVisible] = useState(false);
    const [pendingTab, setPendingTab] = useState<1 | 2 | null>(null);

    const {
        scheduleModalVisible,
        setScheduleModalVisible,
        editingEvent,
        setEditingEvent,
        isSaving: isScheduleSaving,
        selectedTeamTabs,
        setSelectedTeamTabs,

        activeTab,
        setActiveTab,
        slots1,
        setSlots1,
        slots2,
        setSlots2,
        isRecurring,
        setIsRecurring,
        recurrenceValue,
        setRecurrenceValue,
        recurrenceUnit,
        setRecurrenceUnit,
        enableStartDate,
        setEnableStartDate,
        eventStartDate,
        setEventStartDate,
        fortressList,
        setFortressList,
        citadelList,
        setCitadelList,
        activeNamePickerId,
        setActiveNamePickerId,
        activeFortressDropdown,
        setActiveFortressDropdown,
        selectedFortressName,
        setSelectedFortressName,
        editingSlotId,
        setEditingSlotId,
        selectedDayForSlot,
        setSelectedDayForSlot,
        editHour,
        setEditHour,
        editMinute,
        setEditMinute,
        pickerSyncKey,
        setPickerSyncKey,
        activeDateDropdown,
        setActiveDateDropdown,
        mStart,
        setMStart,
        mEnd,
        setMEnd,
        showDatePicker,
        setShowDatePicker,
        openScheduleModal,
        handleCloseScheduleModal,
        handleDeleteSchedule,
        saveSchedule,
        addTimeSlot,
        removeTimeSlot,
        addFortressSlot,
        removeFortressSlot,
        handleTabSwitch,
        parseScheduleStr
    } = useScheduleEditor({
        serverId,
        allianceId,
        schedules,
        updateSchedule,
        t,
        showCustomAlert,
        scheduleNotification,
        timezone,
        now
    });



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
                Animated.timing(flickerAnim, { toValue: 0.3, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(flickerAnim, { toValue: 1, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(flickerAnim, { toValue: 0.4, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(flickerAnim, { toValue: 1, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(flickerAnim, { toValue: 0.2, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(flickerAnim, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(flickerAnim, { toValue: 0.7, duration: 50, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(flickerAnim, { toValue: 1, duration: 2000, useNativeDriver: Platform.OS !== 'web' }), // Long pause
            ]);
        };

        const createScale = () => {
            return Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.2, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 100, useNativeDriver: Platform.OS !== 'web' }),
                Animated.delay(2300),
            ]);
        };

        const createPulse = () => {
            return Animated.parallel([
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.05, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
                    Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
                ]),
                Animated.sequence([
                    Animated.timing(glowAnim, { toValue: 0.8, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
                    Animated.timing(glowAnim, { toValue: 0.4, duration: 800, useNativeDriver: Platform.OS !== 'web' }),
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
    const [isSaving, setIsSaving] = useState(false);


    // Scheduling Logic (moved to useScheduleEditor)


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
    const getKoreanDayOfWeek = (date: Date) => getKoreanDayOfWeekUtil(date, t);

    const checkItemOngoing = useCallback((str: string, eventId?: string) => {
        if (!str) return false;
        // 월요일~일요일이 한 주 (월요일 00:00 리셋)
        const dayMapObj: { [key: string]: number } = {
            '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6,
            'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6
        };
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
        const explicitMatches = Array.from(str.matchAll(/([일월화수목금토]|[매일]|sun|mon|tue|wed|thu|fri|sat|daily)\s*\(?(\d{1,2}):(\d{2})\)?/gi));
        if (explicitMatches.length > 0) {
            return explicitMatches.some(m => {
                const dayStr = m[1];
                const h = parseInt(m[2]);
                const min = parseInt(m[3]);

                const scheduledDays = (dayStr === '매일') ? ['일', '월', '화', '수', '목', '금', '토'] : [dayStr];

                return scheduledDays.some(d => {
                    const dayOffset = dayMapObj[d.toLowerCase()];
                    if (dayOffset === undefined) return false;
                    const startTotal = dayOffset * 1440 + h * 60 + min;

                    // 협곡 전투, 무기공장, 요새전, 성채전 등 주요 전투 이벤트는 60분, 나머지는 30분 진행
                    const normalizedEventStr = `${str} ${eventId || ''} ${t(`events.${(eventId || '').replace(/_(?:team\d+|t?\d+(?:_\d+)?)/g, '')}_title`, { defaultValue: '' })}`.toLowerCase();
                    const isLongEvent =
                        normalizedEventStr.includes('협곡') || normalizedEventStr.includes('무기') || normalizedEventStr.includes('공장') ||
                        normalizedEventStr.includes('요새') || normalizedEventStr.includes('성채') || normalizedEventStr.includes('전투') ||
                        normalizedEventStr.includes('canyon') || normalizedEventStr.includes('foundry') ||
                        normalizedEventStr.includes('fortress') || normalizedEventStr.includes('citadel') ||
                        normalizedEventStr.includes('battle');

                    const isBear = normalizedEventStr.includes('곰') || normalizedEventStr.includes('bear');
                    const duration = (isLongEvent && !isBear) ? 60 : 30;
                    const endTotal = startTotal + duration;

                    if (currentTotal >= startTotal && currentTotal <= endTotal) return true;
                    if (endTotal >= totalWeekMinutes && currentTotal <= (endTotal % totalWeekMinutes)) return true;
                    return false;
                });
            });
        }
        return false;
    }, [now]);

    const checkItemSoon = useCallback((str: string) => {
        if (!str || str.includes('상시') || str.includes('상설')) return null;
        const dayMapObj: { [key: string]: number } = {
            '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6,
            'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6
        };
        const currentDay = (now.getDay() + 6) % 7;
        const currentTotalSec = currentDay * 86400 + now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const totalWeekSec = 7 * 86400;

        // 1. Date Range Support (e.g. 2026.02.22 10:00 ~ ...)
        const rangeMatch = str.match(/(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})\s*~/);
        if (rangeMatch) {
            try {
                const startStr = `${rangeMatch[1].replace(/\./g, '-')}T${rangeMatch[2]}:00`;
                const startDate = new Date(startStr);
                if (!isNaN(startDate.getTime())) {
                    const diff = (startDate.getTime() - now.getTime()) / 1000;
                    if (diff > 0 && diff <= 1800) return Math.floor(diff);
                }
            } catch (e) { }
        }

        // 2. Weekly Range Support (e.g. 월 10:00 ~ 수 10:00)
        const weeklyMatch = str.match(/([일월화수목금토]|sun|mon|tue|wed|thu|fri|sat)\s*(\d{2}):(\d{2})\s*~\s*([일월화수목금토]|sun|mon|tue|wed|thu|fri|sat)\s*(\d{2}):(\d{2})/i);
        if (weeklyMatch) {
            const dayOffset = dayMapObj[weeklyMatch[1].toLowerCase()];
            if (dayOffset !== undefined) {
                const h = parseInt(weeklyMatch[2]);
                const min = parseInt(weeklyMatch[3]);
                const startTotalSec = dayOffset * 86400 + h * 3600 + min * 60;
                let diff = startTotalSec - currentTotalSec;
                if (diff < 0) diff += totalWeekSec;
                if (diff > 0 && diff <= 1800) return Math.floor(diff);
            }
        }

        const explicitMatches = Array.from(str.matchAll(/([일월화수목금토]|[매일]|sun|mon|tue|wed|thu|fri|sat|daily)\s*\(?(\d{1,2}):(\d{2})\)?/gi));
        if (explicitMatches.length > 0) {
            let minDiff: number | null = null;
            explicitMatches.forEach(m => {
                const dayStr = m[1];
                const h = parseInt(m[2]);
                const min = parseInt(m[3]);
                const scheduledDays = (dayStr === '매일' || dayStr === 'daily') ? ['일', '월', '화', '수', '목', '금', '토'] : [dayStr];
                scheduledDays.forEach(d => {
                    const dayOffset = dayMapObj[d.toLowerCase()];
                    if (dayOffset === undefined) return;
                    let startTotalSec = dayOffset * 86400 + h * 3600 + min * 60;
                    let diff = startTotalSec - currentTotalSec;
                    if (diff < 0) diff += totalWeekSec;

                    if (diff > 0 && diff <= 1800) { // 30 minutes before
                        if (minDiff === null || diff < minDiff) minDiff = diff;
                    }
                });
            });
            return minDiff;
        }
        return null;
    }, [now]);

    const checkIsSoon = useCallback((event: WikiEvent) => {
        try {
            const combined = `${event.day || ''} ${event.time || ''}`.trim();
            return checkItemSoon(combined);
        } catch (e) { return null; }
    }, [checkItemSoon]);

    const checkIsOngoing = useCallback((event: WikiEvent) => {
        try {
            const eventId = event.originalEventId || event.id;
            const combined = `${event.day || ''} ${event.time || ''}`.trim();
            const hasExplicitDay = /[일월화수목금토]|[매일]|sun|mon|tue|wed|thu|fri|sat|daily/i.test(combined);

            // 1. Recurrence Logic (Only if no explicit day schedule or bi-weekly check is needed)
            // For weekly events with specific days (like Bear Hunt), we skip the strict updatedAt check
            // unless it's a multi-week interval (e.g., every 2 weeks).
            if (event.isRecurring && event.updatedAt) {
                const interval = parseInt(event.recurrenceValue || '1');
                const isMultiWeek = event.recurrenceUnit === 'week' && interval > 1;

                if (!hasExplicitDay || isMultiWeek) {
                    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
                    const refDate = new Date(event.updatedAt);
                    const startOfRef = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate()).getTime();
                    const daysDiff = Math.floor((startOfToday - startOfRef) / (24 * 60 * 60 * 1000));

                    if (event.recurrenceUnit === 'day') {
                        if (daysDiff % interval !== 0) return false;
                    } else if (event.recurrenceUnit === 'week') {
                        const weeksDiff = Math.floor(daysDiff / 7);
                        if (weeksDiff % interval !== 0) return false;
                    }
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

            return checkItemOngoing(combined, eventId);
        } catch (err) {
            return false;
        }
    }, [now, checkItemOngoing]);


    const checkIsExpired = useCallback((event: WikiEvent) => {
        try {
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

            // 3. 주간 요일 기반 체크 (날짜가 없는 경우 현재 주 기준 판단)
            const dayMapObj: { [key: string]: number } = {
                '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6,
                'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6
            };
            const currentDay = (now.getDay() + 6) % 7;
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            const explicitMatches = Array.from(combined.matchAll(/([일월화수목금토]|[매일]|sun|mon|tue|wed|thu|fri|sat|daily)\s*\(?(\d{1,2}):(\d{2})\)?/gi));
            if (explicitMatches.length > 0) {
                // 특정 요일이 지났는지 확인
                return explicitMatches.every(m => {
                    const dStr = m[1];
                    const h = parseInt(m[2]);
                    const min = parseInt(m[3]);
                    const scheduledDays = (dStr === '매일') ? ['일', '월', '화', '수', '목', '금', '토'] : [dStr];

                    return scheduledDays.every(d => {
                        const dayIdx = dayMapObj[d.toLowerCase()];
                        if (dayIdx === undefined) return true;
                        if (currentDay > dayIdx) return true;
                        if (currentDay === dayIdx) return currentMinutes >= (h * 60 + min + 60); // 1시간 진행 가정
                        return false;
                    });
                });
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

    const filteredEvents = useMemo(() => {
        return selectedCategory === '전체' ? [...events] : events.filter(e => e.category === selectedCategory);
    }, [events, selectedCategory]);

    // 1. First Pass: Only split events (Bear Hunt, Canyon, etc.) without any sorting
    const rawSplitEvents = useMemo(() => {
        const processedList: any[] = [];
        filteredEvents.forEach(e => {
            if (e.id === 'a_bear' || e.id === 'alliance_bear') {
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
                        const simplifiedTime = teamTime.split(/[,|]/).map(t => t.replace(/출격|귀환|시작|종료/g, '').trim()).join(', ');

                        processedList.push({
                            ...e,
                            id: `${e.id}_team${idx + 1}`,
                            originalEventId: e.id,
                            title: t('events.alliance_bear_title'),
                            time: simplifiedTime,
                            isBearSplit: true,
                            teamLabel: cleanLabel,
                            teamIcon: '🐻',
                            isRecurring: idx === 0 ? e.isRecurring : e.isRecurring2,
                            recurrenceValue: idx === 0 ? e.recurrenceValue : e.recurrenceValue2,
                            recurrenceUnit: idx === 0 ? e.recurrenceUnit : e.recurrenceUnit2,
                            startDate: idx === 0 ? e.startDate : e.startDate2
                        });
                    });
                } else { processedList.push(e); }
            } else if (e.id === 'a_fortress' || e.id === 'alliance_fortress') {
                const rawTime = (e.time || '').replace(/\s*\/\s*/g, ', ');
                const parts = rawTime.split(',').map(p => p.trim().replace(/.*(요새전|성채전|Fortress|Citadel)[:\s：]*/, '')).filter(p => p);
                const fortressParts: string[] = [];
                const citadelParts: string[] = [];
                parts.forEach(part => {
                    if (part.includes('성채') || part.toLowerCase().includes('citadel')) citadelParts.push(part);
                    else fortressParts.push(part);
                });
                if (fortressParts.length > 0) {
                    processedList.push({ ...e, id: `${e.id}_fortress`, originalEventId: e.id, title: t('events.fortress_battle_title'), day: t('events.fortress'), time: fortressParts.join(', '), isFortressSplit: true });
                }
                if (citadelParts.length > 0) {
                    processedList.push({ ...e, id: `${e.id}_citadel`, originalEventId: e.id, title: t('events.citadel_battle_title'), day: t('events.citadel'), time: citadelParts.join(', '), isFortressSplit: true });
                }
                if (fortressParts.length === 0 && citadelParts.length === 0) processedList.push(e);
            } else if (e.id === 'alliance_canyon') {
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
                        const simplifiedTime = teamTime.split(/[,|]/).map(t => t.replace(/출격|귀환|시작|종료/g, '').trim()).join(', ');

                        processedList.push({
                            ...e,
                            id: `${e.id}_team${idx + 1}`,
                            originalEventId: e.id,
                            title: t('events.alliance_canyon_title'),
                            time: simplifiedTime,
                            isCanyonSplit: true,
                            teamLabel: cleanLabel,
                            teamIcon: '⛰️',
                            isRecurring: idx === 0 ? e.isRecurring : e.isRecurring2,
                            recurrenceValue: idx === 0 ? e.recurrenceValue : e.recurrenceValue2,
                            recurrenceUnit: idx === 0 ? e.recurrenceUnit : e.recurrenceUnit2,
                            startDate: idx === 0 ? e.startDate : e.startDate2
                        });
                    });
                } else { processedList.push(e); }
            } else if (e.id === 'a_foundry' || e.id === 'alliance_foundry') {
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
                        const simplifiedTime = teamTime.split(/[,|]/).map(t => t.replace(/출격|귀환|시작|종료/g, '').trim()).join(', ');

                        processedList.push({
                            ...e,
                            id: `${e.id}_team${idx + 1}`,
                            originalEventId: e.id,
                            title: t('events.alliance_foundry_title'),
                            time: simplifiedTime,
                            isFoundrySplit: true,
                            teamLabel: cleanLabel,
                            teamIcon: '🔥',
                            isRecurring: idx === 0 ? e.isRecurring : e.isRecurring2,
                            recurrenceValue: idx === 0 ? e.recurrenceValue : e.recurrenceValue2,
                            recurrenceUnit: idx === 0 ? e.recurrenceUnit : e.recurrenceUnit2,
                            startDate: idx === 0 ? e.startDate : e.startDate2
                        });
                    });
                } else { processedList.push(e); }
            } else {
                processedList.push(e);
            }
        });
        return processedList;
    }, [filteredEvents, t]);

    // 2. Status Maps: Based on split events
    const isExpiredMap = useMemo(() => {
        const map: { [key: string]: boolean } = {};
        rawSplitEvents.forEach(e => { map[e.id] = checkIsExpired(e); });
        return map;
    }, [rawSplitEvents, checkIsExpired]);

    const isOngoingMap = useMemo(() => {
        const map: { [key: string]: boolean } = {};
        rawSplitEvents.forEach(e => { map[e.id] = checkIsOngoing(e); });
        return map;
    }, [rawSplitEvents, checkIsOngoing]);

    const remSoonSecondsMap = useMemo(() => {
        const map: { [key: string]: number | null } = {};
        rawSplitEvents.forEach(e => { map[e.id] = checkIsSoon(e); });
        return map;
    }, [rawSplitEvents, checkIsSoon]);

    // 3. Final Sorted Pass: Handle grouping and status priority
    const timelineEvents = useMemo(() => {
        const list = [...rawSplitEvents];

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

        const groupData: { [key: string]: { minTime: number, hasActive: boolean, allExpired: boolean, count: number } } = {};

        list.forEach(e => {
            const groupId = getBundleId(e);
            const sTime = getSortTime(e);
            const active = isOngoingMap[e.id] || false;
            const expired = isExpiredMap[e.id] || false;

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
        return list.sort((a, b) => {
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
    }, [rawSplitEvents, isOngoingMap, isExpiredMap, now, t]);

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

    // Scheduling Handlers removed (moved to useScheduleEditor)

    const saveStrategy = useCallback(async (event: WikiEvent) => {
        setIsSaving(true);
        try {
            await updateSchedule({
                eventId: event.id,
                strategy: strategyContent,
                day: event.day || '.',
                time: event.time || '.'
            });
            setIsEditingStrategy(false);
            showCustomAlert(t('common.success'), t('events.strategy_saved'), 'success');
        } catch (error: any) {
            showCustomAlert(t('common.error'), t('events.save_error', { error: error.message }), 'error');
        } finally {
            setIsSaving(false);
        }
    }, [strategyContent, updateSchedule, t, showCustomAlert]);




    const openGuideModal = useCallback((event: WikiEvent, initialTabIdx?: number) => {
        setSelectedEventForGuide(event);
        setStrategyContent(event.strategy || '');
        if (initialTabIdx !== undefined) {
            handleSetSelectedTeamTab(event.id, initialTabIdx);
        }
        setIsEditingStrategy(false);
        setGuideModalVisible(true);
    }, [handleSetSelectedTeamTab]);

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
                                            <Text className={`ml-3 font-bold text-base ${selectedCategory === cat ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : (hovered ? (isDark ? 'text-slate-200' : 'text-slate-800') : (isDark ? 'text-slate-400' : 'text-slate-500'))}`}>
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
                                                        ...Platform.select({
                                                            web: { boxShadow: `0 0 10px ${selectedCategory === cat ? 'rgba(99, 102, 241, 0.8)' : 'rgba(244, 63, 94, 0.8)'}` },
                                                            default: {
                                                                shadowColor: selectedCategory === cat ? '#6366f1' : '#f43f5e',
                                                                shadowOffset: { width: 0, height: 0 },
                                                                shadowOpacity: 0.8,
                                                                shadowRadius: 5
                                                            }
                                                        })
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
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                                borderRadius: 12,
                                                backgroundColor: viewMode === 'card' ? (isDark ? '#334155' : 'white') : 'transparent',
                                                ...(Platform.OS === 'web'
                                                    ? (viewMode === 'card' ? { boxShadow: isDark ? '0 2px 8px rgba(0,0,0,0.4)' : '0 2px 4px rgba(0,0,0,0.05)' } : {})
                                                    : (viewMode === 'card' ? { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 } : {})
                                                ) as any,
                                                transform: [{ scale: pressed ? 0.95 : 1 }],
                                                transition: 'all 0.2s',
                                                cursor: 'pointer'
                                            }
                                        ]}
                                    >
                                        <Ionicons name="list" size={16} color={viewMode === 'card' ? (isDark ? '#38bdf8' : '#3b82f6') : (isDark ? '#64748b' : '#94a3b8')} />
                                        <Text className={`ml-2 font-bold ${viewMode === 'card' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`} style={{ fontSize: 13 * fontSizeScale }}>
                                            {t('events.list_view')}
                                        </Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => setViewMode('timeline')}
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                paddingHorizontal: 12,
                                                paddingVertical: 6,
                                                borderRadius: 12,
                                                backgroundColor: viewMode === 'timeline' ? (isDark ? '#334155' : 'white') : 'transparent',
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
                                        <Ionicons name="calendar-outline" size={16} color={viewMode === 'timeline' ? (isDark ? '#38bdf8' : '#3b82f6') : (isDark ? '#64748b' : '#94a3b8')} />
                                        <Text className={`ml-2 font-bold ${viewMode === 'timeline' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`} style={{ fontSize: 13 * fontSizeScale }}>
                                            {t('events.timeline_view')}
                                        </Text>
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
                                            className="px-4 py-3 mr-1 relative flex-row items-center outline-none cursor-pointer"
                                        >
                                            {({ hovered }: any) => (
                                                <>
                                                    <Ionicons
                                                        name={cat === '연맹' ? 'flag-outline' : cat === '개인' ? 'person-outline' : cat === '서버' ? 'earth-outline' : cat === '초보자' ? 'star-outline' : 'apps-outline'}
                                                        size={18}
                                                        color={selectedCategory === cat ? (isDark ? '#818cf8' : '#6366f1') : (hovered ? (isDark ? '#818cf8' : '#6366f1') : (isDark ? '#475569' : '#64748b'))}
                                                        className="mr-2"
                                                    />
                                                    <Text className={`text-[17px] font-bold transition-all ${selectedCategory === cat ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : (hovered ? (isDark ? 'text-slate-200' : 'text-slate-700') : (isDark ? 'text-slate-400' : 'text-slate-500'))}`}>
                                                        {cat === '전체' ? t('common.all')
                                                            : cat === '연맹' ? t('events.category.alliance')
                                                                : cat === '개인' ? t('events.category.individual')
                                                                    : cat === '서버' ? t('events.category.server')
                                                                        : cat === '초보자' ? t('events.category.beginner')
                                                                            : cat}
                                                    </Text>
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
                    <Animated.View style={{ flex: 1, opacity: catFadeAnim, transform: [{ translateY: catFadeAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
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
                                        openScheduleModal(baseEvent, ev._teamIdx);
                                    } else {
                                        if (ev._teamIdx !== undefined) {
                                            handleSetSelectedTeamTab(baseEvent.id, ev._teamIdx);
                                        }
                                        openGuideModal(baseEvent, ev._teamIdx);
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
                                            <GrowthEventCard
                                                key={event.id}
                                                event={event}
                                                isDark={isDark}
                                                timezone={timezone}
                                                now={now}
                                                auth={auth}
                                                isAdmin={isAdmin}
                                                isOngoing={isOngoingMap[event.id]}
                                                isExpired={isExpiredMap[event.id]}
                                                remSoonSeconds={remSoonSecondsMap[event.id]}
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
                    </Animated.View>
                </View>

                <EventGuideModal
                    visible={guideModalVisible}
                    event={selectedEventForGuide}
                    isDark={isDark}
                    isAdmin={isAdmin}
                    isEditingStrategy={isEditingStrategy}
                    strategyContent={strategyContent}
                    onClose={() => setGuideModalVisible(false)}
                    onOpenWikiLink={openWikiLink}
                    onStartEditStrategy={() => setIsEditingStrategy(true)}
                    onCancelEditStrategy={() => {
                        setIsEditingStrategy(false);
                        setStrategyContent(selectedEventForGuide?.strategy || '');
                    }}
                    onSaveStrategy={() => saveStrategy(selectedEventForGuide!)}
                    onStrategyContentChange={setStrategyContent}
                />

                {/* Schedule Edit Modal */}
                <ScheduleModal
                    visible={scheduleModalVisible}
                    isDark={isDark}
                    editingEvent={editingEvent}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    slots1={(editingEvent?.id === 'a_fortress' ? fortressList : (editingEvent?.id === 'a_citadel' ? citadelList : slots1))}
                    slots2={slots2}
                    isRecurring={isRecurring}
                    setIsRecurring={setIsRecurring}
                    recurrenceValue={recurrenceValue}
                    setRecurrenceValue={setRecurrenceValue}
                    recurrenceUnit={recurrenceUnit}
                    setRecurrenceUnit={setRecurrenceUnit}
                    enableStartDate={enableStartDate}
                    setEnableStartDate={setEnableStartDate}
                    eventStartDate={eventStartDate}
                    mStart={mStart}
                    setMStart={setMStart}
                    mEnd={mEnd}
                    setMEnd={setMEnd}
                    selectedDayForSlot={selectedDayForSlot}
                    setSelectedDayForSlot={setSelectedDayForSlot}
                    editHour={editHour}
                    setEditHour={setEditHour}
                    editMinute={editMinute}
                    setEditMinute={setEditMinute}
                    editingSlotId={editingSlotId}
                    setEditingSlotId={setEditingSlotId}
                    pickerSyncKey={pickerSyncKey}
                    selectedFortressName={selectedFortressName}
                    setSelectedFortressName={setSelectedFortressName}
                    activeNamePickerId={activeNamePickerId}
                    setActiveNamePickerId={setActiveNamePickerId}
                    activeFortressDropdown={activeFortressDropdown}
                    setActiveFortressDropdown={setActiveFortressDropdown}
                    activeDateDropdown={activeDateDropdown}
                    setActiveDateDropdown={setActiveDateDropdown}
                    onClose={handleCloseScheduleModal}
                    onSave={() => saveSchedule(setEvents)}
                    onDelete={handleDeleteSchedule}
                    onAddTimeSlot={addTimeSlot}
                    onRemoveTimeSlot={(id) => (editingEvent?.id === 'a_fortress' || editingEvent?.id === 'a_citadel') ? removeFortressSlot(id) : removeTimeSlot(id)}
                    onToggleDay={setSelectedDayForSlot}
                    onAddFortressSlot={addFortressSlot}
                    setShowDatePicker={setShowDatePicker}

                    setPickerSyncKey={setPickerSyncKey}
                    timezone={timezone}
                />


                {/* Attendee Management Modal */}
                <AttendanceModal
                    visible={attendeeModalVisible}
                    event={managedEvent}
                    groupIndex={managedGroupIndex}
                    attendees={bulkAttendees}
                    isSaving={isSaving}
                    isDark={isDark}
                    isAdmin={!!isAdmin}
                    members={members}
                    onClose={() => setAttendeeModalVisible(false)}
                    onAddRow={addAttendeeRow}
                    onDeleteRow={deleteAttendee}
                    onUpdateField={updateAttendeeField}
                    onSave={saveAttendees}
                />

                {/* Wiki Browser Modal (Web Only) */}
                <Modal visible={browserVisible && Platform.OS === 'web'} animationType="slide" transparent={false}>
                    <View className="flex-1 bg-white">
                        <View className="h-16 bg-slate-900 flex-row items-center justify-between px-4 border-b border-slate-700">
                            <View className="flex-row items-center flex-1 mr-4">
                                <Text className="text-white font-semibold mr-2">��� {t('events.wiki')}</Text>
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
                <CustomAlert
                    visible={customAlert.visible}
                    title={customAlert.title}
                    message={customAlert.message}
                    type={customAlert.type}
                    isDark={isDark}
                    onConfirm={customAlert.onConfirm}
                    onClose={() => setCustomAlert({ ...customAlert, visible: false })}
                    confirmLabel={customAlert.confirmLabel}
                />

                {/* Date Picker Modal */}
                <DatePickerModal
                    visible={!!showDatePicker}
                    type={showDatePicker}
                    currentValue={
                        showDatePicker === 'startDate'
                            ? (eventStartDate || '')
                            : (showDatePicker === 'start' ? mStart : mEnd)
                    }
                    viewDate={viewDate}
                    isDark={isDark}
                    onClose={() => setShowDatePicker(null)}
                    onViewDateChange={setViewDate}
                    onSelect={(dateStr) => {
                        if (showDatePicker === 'startDate') {
                            setEventStartDate(dateStr);
                        } else if (showDatePicker === 'start') {
                            const timePart = mStart.split(' ')[1] || '00:00';
                            setMStart(`${dateStr} ${timePart}`);
                        } else {
                            const timePart = mEnd.split(' ')[1] || '00:00';
                            setMEnd(`${dateStr} ${timePart}`);
                        }
                        setShowDatePicker(null);
                    }}
                />

                {/* Warning Modal for Unsaved Changes */}
                <WarningModal
                    visible={warningModalVisible}
                    isDark={isDark}
                    onCancel={() => {
                        setWarningModalVisible(false);
                        setPendingTab(null);
                    }}
                    onConfirm={() => {
                        setWarningModalVisible(false);
                        if (pendingTab) setActiveTab(pendingTab);
                        setPendingTab(null);
                    }}
                />
            </View>
        </View>
    );
}
