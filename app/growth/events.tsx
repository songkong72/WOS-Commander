import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, Image, Modal, TextInput, Alert, FlatList, ActivityIndicator, useWindowDimensions, Linking, Platform, Pressable, Animated } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth, useTheme } from '../_layout';
import { getGuideContent } from '../../data/event-guides';
import { Attendee } from '../../data/mock-attendees';
import { useFirestoreAttendees } from '../../hooks/useFirestoreAttendees';
import { useFirestoreEventSchedules } from '../../hooks/useFirestoreEventSchedules';
import { useFirestoreMembers } from '../../hooks/useFirestoreMembers';
import { useFirestoreAdmins } from '../../hooks/useFirestoreAdmins';
import heroesData from '../../data/heroes.json';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WikiEvent, INITIAL_WIKI_EVENTS, EventCategory } from '../../data/wiki-events';
import { ADDITIONAL_EVENTS } from '../../data/new-events';
import { SUPER_ADMINS } from '../../data/admin-config';
import * as Notifications from 'expo-notifications';

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

// Mini Hero Picker Component
const HeroPicker = ({ value, onSelect, label }: { value: string, onSelect: (v: string) => void, label: string }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [showDropdown, setShowDropdown] = useState(false);
    const [search, setSearch] = useState(value);

    useEffect(() => {
        if (value !== search) {
            setSearch(value);
        }
    }, [value]);

    const filteredHeroes = HERO_NAMES.filter(name =>
        name.toLowerCase().includes(search.toLowerCase())
    );

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
                    style={{ zIndex: 9999, elevation: 9999 }}
                    className={`absolute top-16 left-0 right-0 border rounded-xl max-h-40 shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
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
};

// Member Picker for Attendance
const MemberPicker = ({ value, onSelect, members, isAdmin }: { value: string, onSelect: (v: string) => void, members: any[], isAdmin: boolean }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [showDropdown, setShowDropdown] = useState(false);
    const [search, setSearch] = useState(value);

    useEffect(() => {
        if (value !== search) {
            setSearch(value);
        }
    }, [value]);

    const filteredMembers = members.filter(m =>
        m.nickname.toLowerCase().includes(search.toLowerCase()) ||
        m.id.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <View className="flex-1 relative" style={{ zIndex: showDropdown ? 60 : 1 }}>
            <TextInput
                placeholder="영주 이름 선택/입력"
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                value={search}
                onChangeText={(v) => {
                    setSearch(v);
                    onSelect(v);
                    setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                editable={isAdmin}
                className={`p-3 rounded-xl font-semibold border ${isDark ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-slate-800 border-slate-200 shadow-sm'} ${!isAdmin ? 'opacity-70' : ''}`}
            />
            {showDropdown && isAdmin && filteredMembers.length > 0 && (
                <View
                    style={{ zIndex: 9999, elevation: 9999 }}
                    className={`absolute top-14 left-0 right-0 border rounded-xl max-h-60 shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {filteredMembers.map((m) => (
                            <TouchableOpacity
                                key={m.id}
                                onPress={() => {
                                    onSelect(m.nickname);
                                    setSearch(m.nickname);
                                    setShowDropdown(false);
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
            )}
        </View>
    );
};

export default function EventTracker() {
    const { width } = useWindowDimensions();
    const isDesktop = width > 768; // Simple breakdown for Desktop layout

    const [selectedCategory, setSelectedCategory] = useState<EventCategory>('전체');
    const [events, setEvents] = useState<WikiEvent[]>([...INITIAL_WIKI_EVENTS, ...ADDITIONAL_EVENTS].map(e => ({ ...e, day: '', time: '' })));
    const { auth } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';
    const { dynamicAdmins } = useFirestoreAdmins();
    const router = useRouter();
    const params = useLocalSearchParams();

    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // Refs for scrolling
    const scrollViewRef = useRef<ScrollView>(null);
    const itemLayouts = useRef<{ [key: string]: number }>({});
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const [fortressList, setFortressList] = useState<{ id: string, name: string, day?: string, h: string, m: string }[]>([]);
    const [citadelList, setCitadelList] = useState<{ id: string, name: string, day?: string, h: string, m: string }[]>([]);

    // Firebase Event Schedules
    const { schedules, loading: schedulesLoading, updateSchedule } = useFirestoreEventSchedules();
    const { members } = useFirestoreMembers();

    // Merge Firebase schedules with initial events
    useEffect(() => {
        if (!schedulesLoading) {
            const mergedEvents = [...INITIAL_WIKI_EVENTS, ...ADDITIONAL_EVENTS].map(event => {
                // Handle duplicate ID fallback (a_weapon and alliance_frost_league are the same)
                const savedSchedule = schedules.find(s =>
                    s.eventId === event.id ||
                    (event.id === 'a_weapon' && s.eventId === 'alliance_frost_league') ||
                    (event.id === 'alliance_frost_league' && s.eventId === 'a_weapon')
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
    const [slots1, setSlots1] = useState<{ day: string, time: string, id: string }[]>([]);
    const [slots2, setSlots2] = useState<{ day: string, time: string, id: string }[]>([]);

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

    // Championship States
    const [champStart, setChampStart] = useState({ d: '월', h: '22', m: '00' });
    const [champEnd, setChampEnd] = useState({ d: '월', h: '23', m: '00' });

    const flickerAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

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

        Animated.loop(
            Animated.parallel([
                createFlicker(),
                createScale()
            ])
        ).start();
    }, []);

    const pad = (n: number) => n.toString().padStart(2, '0');

    const formatDisplayDate = (str: string) => {
        if (!str) return '';
        const match = str.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{2}):(\d{2})/);
        if (!match) {
            // Check for weekly format like "월 10:00"
            const weeklyMatch = str.match(/([일월화수목금토])\s*\(?(\d{2}:\d{2})\)?/);
            if (weeklyMatch) return `${weeklyMatch[1]}(${weeklyMatch[2]})`;
            return str;
        }
        const [_, y, m, d, h, min] = match;
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const dayName = days[date.getDay()];
        return `${parseInt(m)}월 ${parseInt(d)}일(${dayName}) ${h}:${min}`;
    };

    const getUTCString = (str: string) => {
        if (!str) return null;
        const match = str.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{2}):(\d{2})/);
        if (!match) return null;
        const [_, y, m, d, h, min] = match;
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min));
        if (isNaN(date.getTime())) return null;
        return `${pad(date.getUTCMonth() + 1)}/${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
    };

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
    const { attendees: firestoreAttendees, loading: firestoreLoading, saveAttendeesToFirestore } = useFirestoreAttendees(managedEvent?.id);
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

    const checkItemOngoing = (str: string) => {
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
                    const endTotal = startTotal + 30;

                    if (currentTotal >= startTotal && currentTotal <= endTotal) return true;
                    if (endTotal >= totalWeekMinutes && currentTotal <= (endTotal % totalWeekMinutes)) return true;
                    return false;
                });
            });
        }
        return false;
    };

    const checkIsOngoing = (event: WikiEvent) => {
        try {
            return checkItemOngoing(event.day || '') || checkItemOngoing(event.time || '');
        } catch (err) {
            return false;
        }
    };

    const checkIsExpired = (event: WikiEvent) => {
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
    };

    const isVisibleInList = (event: WikiEvent) => {
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
    };

    const filteredEvents = useMemo(() => {
        let base = selectedCategory === '전체' ? [...events] : events.filter(e => e.category === selectedCategory);

        base = base.filter(e => isVisibleInList(e));

        base.sort((a, b) => {
            const activeA = checkIsOngoing(a);
            const activeB = checkIsOngoing(b);

            // 1. 진행중인 이벤트 우선
            if (activeA && !activeB) return -1;
            if (!activeA && activeB) return 1;

            // 2. '전체' 탭인 경우 카테고리 순서
            if (selectedCategory === '전체') {
                const catOrder: { [key: string]: number } = { '서버': 0, '연맹': 1, '개인': 2, '초보자': 3 };
                const orderA = catOrder[a.category] !== undefined ? catOrder[a.category] : 99;
                const orderB = catOrder[b.category] !== undefined ? catOrder[b.category] : 99;
                if (orderA !== orderB) return orderA - orderB;
            }

            return 0;
        });

        return base;
    }, [events, selectedCategory, now]);

    const openWikiLink = (url: string) => {
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
    };

    const getUTCTimeString = (kstStr: string, includePrefix = true) => {
        const match = kstStr.match(/([일월화수목금토]|[매일])\s*\(?(\d{1,2}:\d{2})\)?/);
        if (!match || !match[2]) return '';

        const dayStr = match[1];
        const timeStr = match[2];
        const [h, m] = timeStr.split(':').map(Number);

        const days = ['일', '월', '화', '수', '목', '금', '토'];
        let dayIdx = days.indexOf(dayStr);

        if (dayIdx === -1) { // '매일' or unknown
            let utcShift = h - 9;
            if (utcShift < 0) utcShift += 24;
            return `UTC: ${dayStr}(${utcShift.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')})`;
        }

        let utcH = h - 9;
        let utcDayIdx = dayIdx;
        if (utcH < 0) {
            utcH += 24;
            utcDayIdx = (dayIdx - 1 + 7) % 7;
        }

        const formattedTime = `${days[utcDayIdx]}(${utcH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')})`;
        return includePrefix ? `UTC: ${formattedTime}` : formattedTime;
    };

    const addTimeSlot = () => {
        const isT1 = activeTab === 1;
        const setSlots = isT1 ? setSlots1 : setSlots2;
        const currentSlots = isT1 ? slots1 : slots2;

        if (selectedDayForSlot === '상시') {
            setSlots([{ day: '상시', time: '', id: Math.random().toString() }]);
            return;
        }

        if (editingSlotId) {
            setSlots(currentSlots.map(s => s.id === editingSlotId ? { ...s, day: selectedDayForSlot, time: `${editHour}:${editMinute}` } : s));
            setEditingSlotId(null);
            return;
        }

        const newSlot = {
            day: selectedDayForSlot,
            time: `${editHour}:${editMinute}`,
            id: Math.random().toString()
        };

        // If '상시' was there, clear it
        const filtered = currentSlots.filter(s => s.day !== '상시');
        setSlots([...filtered, newSlot]);
    };

    const removeTimeSlot = (id: string) => {
        const isT1 = activeTab === 1;
        const setSlots = isT1 ? setSlots1 : setSlots2;
        setSlots(prev => prev.filter(s => s.id !== id));
    };

    const saveStrategy = async (targetEvent: WikiEvent) => {
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
    };

    const parseScheduleStr = (str: string) => {
        if (!str || str === '.') return [];
        // Handle "1군: 월(22:00) / 2군: 수(11:00)" or just "월(22:00), 수(11:00)"
        const slots: { day: string, time: string, id: string }[] = [];
        const parts = str.split(/[,|]/);
        parts.forEach(p => {
            const trimP = p.trim();
            if (!trimP) return;
            const match = trimP.match(/([일월화수목금토]|[매일]|[상시])\s*(?:\(([^)]+)\))?/);
            if (match) {
                slots.push({
                    day: match[1],
                    time: match[2] || '',
                    id: Math.random().toString()
                });
            }
        });
        return slots;
    };

    const openScheduleModal = (event: WikiEvent) => {
        setEditingEvent(event);
        setActiveTab(1);


        const dateRangeIDs = ['a_castle', 'server_castle', 'a_operation', 'alliance_operation', 'a_trade', 'alliance_trade', 'a_champ', 'alliance_champion', 'a_weapon', 'alliance_frost_league', 'server_svs_prep', 'server_svs_battle', 'server_immigrate', 'server_merge'];
        if (event.category === '개인' || dateRangeIDs.includes(event.id)) {
            const rawDay = event.day || '';
            const [s, e] = rawDay.includes('~') ? rawDay.split('~').map(x => x.trim()) : ['', ''];

            const now = new Date();
            const defaultStr = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())} 09:00`;

            setMStart(s || defaultStr);
            setMEnd(e || defaultStr);
        }

        if (event.id === 'a_fortress') {
            // Fortress logic remains largely similar as it has its own complex list state
            const fParsed: any[] = [];
            const cParsed: any[] = [];
            if (event.time) {
                if (event.time.includes('요새전:') || event.time.includes('성채전:')) {
                    const sections = event.time.split(' / ');
                    sections.forEach((s, idx) => {
                        if (s.startsWith('요새전:')) {
                            const items = s.replace('요새전:', '').trim().split(', ');
                            items.forEach((item, iidx) => {
                                const matchWithDay = item.match(/(.+)\s+([월화수목금토일])\s+(\d{2}):(\d{2})/);
                                if (matchWithDay) {
                                    fParsed.push({ id: `f_${idx}_${iidx}`, name: matchWithDay[1].trim(), day: matchWithDay[2], h: matchWithDay[3], m: matchWithDay[4] });
                                } else {
                                    const match = item.match(/(.+)\s+(\d{2}):(\d{2})/);
                                    if (match) fParsed.push({ id: `f_${idx}_${iidx}`, name: match[1].trim(), day: '토', h: match[2], m: match[3] });
                                }
                            });
                        } else if (s.startsWith('성채전:')) {
                            const items = s.replace('성채전:', '').trim().split(', ');
                            items.forEach((item, iidx) => {
                                const matchWithDay = item.match(/(.+)\s+([월화수목금토일])\s+(\d{2}):(\d{2})/);
                                if (matchWithDay) {
                                    cParsed.push({ id: `c_${idx}_${iidx}`, name: matchWithDay[1].trim(), day: matchWithDay[2], h: matchWithDay[3], m: matchWithDay[4] });
                                } else {
                                    const match = item.match(/(.+)\s+(\d{2}):(\d{2})/);
                                    if (match) cParsed.push({ id: `c_${idx}_${iidx}`, name: match[1].trim(), day: '일', h: match[2], m: match[3] });
                                }
                            });
                        }
                    });
                } else {
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
            if (fParsed.length === 0 && cParsed.length === 0) {
                // If no data exists, keep lists empty as requested by user
                fParsed.length = 0;
                cParsed.length = 0;
            }
            setFortressList(fParsed);
            setCitadelList(cParsed);
        }

        // Parse Standard Schedule
        let s1: any[] = [];
        let s2: any[] = [];
        const singleSlotIDs = [
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

        if ((event.category === '연맹' || event.category === '서버') && !singleSlotIDs.includes(event.id)) {
            const parts = (event.time || '').split(' / ');
            parts.forEach(p => {
                if (p.startsWith('1군:')) s1 = parseScheduleStr(p.replace('1군:', ''));
                if (p.startsWith('2군:')) s2 = parseScheduleStr(p.replace('2군:', ''));
            });
            // If empty parts but data in Day/Time fields, try fallback
            if (s1.length === 0 && s2.length === 0) s1 = parseScheduleStr(event.time || '');
        } else {
            s1 = parseScheduleStr(event.time || '');
        }

        setSlots1(s1);
        setSlots2(s2);

        const now = new Date();
        setSelectedDayForSlot('월');
        setEditHour(now.getHours().toString().padStart(2, '0'));
        setEditMinute(now.getMinutes().toString().padStart(2, '0'));
        setEditingSlotId(null);
        setScheduleModalVisible(true);
    };

    const toggleDay = (day: string) => {
        setSelectedDayForSlot(day);
    };

    const openGuideModal = (event: WikiEvent) => {
        setSelectedEventForGuide(event);
        setStrategyContent(event.strategy || '');
        setIsEditingStrategy(false);
        setGuideModalVisible(true);
    };

    const openAttendeeModal = (event: WikiEvent) => {
        setManagedEvent(event);
        setAttendeeModalVisible(true);
    };

    const addAttendeeRow = () => {
        setBulkAttendees([...bulkAttendees, { id: Date.now().toString(), name: '', hero1: '', hero2: '', hero3: '' }]);
    };

    const updateAttendeeField = (id: string, field: keyof Attendee, value: string) => {
        setBulkAttendees(bulkAttendees.map(a => a.id === id ? { ...a, [field]: value } : a));
    };

    const deleteAttendee = (id: string) => {
        setBulkAttendees(bulkAttendees.filter(a => a.id !== id));
    };

    const saveAttendees = () => {
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
    };

    const saveSchedule = async () => {
        if (!editingEvent) return;

        const dateRangeIDs = ['a_castle', 'server_castle', 'a_operation', 'alliance_operation', 'a_trade', 'alliance_trade', 'a_champ', 'alliance_champion', 'a_weapon', 'alliance_frost_league', 'server_svs_prep', 'server_svs_battle', 'server_immigrate', 'server_merge'];
        if (editingEvent.category === '개인' || dateRangeIDs.includes(editingEvent.id)) {
            const finalDay = `${mStart} ~ ${mEnd}`;
            const finalTime = ''; // No time used for mobilization

            setEvents(events.map(e => (e.id === editingEvent.id || (editingEvent.id === 'alliance_frost_league' && e.id === 'a_weapon') || (editingEvent.id === 'a_weapon' && e.id === 'alliance_frost_league')) ? { ...e, day: finalDay, time: finalTime } : e));

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
            }
            return;
        }


        if (editingEvent.id === 'a_fortress') {
            const fStr = fortressList.length > 0 ? `요새전: ${fortressList.map(f => `${f.name.replace(/\s+/g, '')} ${f.day || '토'}(${f.h}:${f.m})`).join(' | ')}` : '';
            const cStr = citadelList.length > 0 ? `성채전: ${citadelList.map(c => `${c.name.replace(/\s+/g, '')} ${c.day || '일'}(${c.h}:${c.m})`).join(' | ')}` : '';

            const timeStr = [fStr, cStr].filter(Boolean).join(' / ');
            const dayParts = [];
            if (fortressList.length > 0) dayParts.push('요새전');
            if (citadelList.length > 0) dayParts.push('성채전');
            const finalDay = dayParts.length > 0 ? dayParts.join('/') : '요새전';

            setEvents(events.map(e => e.id === editingEvent.id ? { ...e, day: finalDay, time: timeStr } : e));

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
                    for (const f of fortressList) {
                        await scheduleNotification(editingEvent, f.day || '토', `${f.h}:${f.m}`);
                    }
                    for (const c of citadelList) {
                        await scheduleNotification(editingEvent, c.day || '일', `${c.h}:${c.m}`);
                    }
                }

                setScheduleModalVisible(false);
                showCustomAlert('완료', '요새전/성채전 일정이 저장되었습니다.', 'success');
            } catch (error: any) {
                showCustomAlert('오류', '저장 실패: ' + error.message, 'error');
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

        const singleSlotIDs = [
            'a_center', 'alliance_center', 'p29_center',
            'a_champ', 'alliance_champion',
            'a_mercenary', 'alliance_mercenary',
            'a_immigrate', 'alliance_immigrate', 'server_immigrate',
            'a_trade', 'alliance_trade',
            'a_mobilization', 'alliance_mobilization',
            'a_merge', 'alliance_merge', 'server_merge',
            'a_svs', 'alliance_svs', 'server_svs_prep', 'server_svs_battle',
            'a_dragon', 'alliance_dragon', 'server_dragon',
            'a_joe', 'alliance_joe'
        ];

        if ((editingEvent?.category === '연맹' || editingEvent?.category === '서버') && !singleSlotIDs.includes(editingEvent.id)) {
            const str1 = buildStr(slots1);
            const str2 = buildStr(slots2);

            const parts = [];
            if (str1) parts.push(`1군: ${str1}`);
            if (str2) parts.push(`2군: ${str2}`);
            finalTime = parts.join(' / ');

            const allDays = Array.from(new Set([...getAllDays(slots1), ...getAllDays(slots2)]));
            const dayOrder = ['월', '화', '수', '목', '금', '토', '일', '매일', '상시'];
            finalDay = allDays.sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b)).join(', ');
        } else {
            // General Event
            finalTime = buildStr(slots1);
            finalDay = getAllDays(slots1).join(', ');
        }

        setEvents(events.map(e => e.id === editingEvent.id ? { ...e, day: finalDay, time: finalTime } : e));

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

            showCustomAlert('저장 완료', '이벤트 일정이 성공적으로 등록되었습니다.', 'success');

        } catch (error: any) {
            showCustomAlert('저장 실패', '서버 통신 중 오류가 발생했습니다.\n' + error.message, 'error');
        }
    };

    const handleDeleteSchedule = async () => {
        if (!editingEvent) return;

        showCustomAlert(
            '일정 초기화',
            '이 이벤트의 요일/시간 설정을 정말로 삭제하시겠습니까?',
            'confirm',
            async () => {
                try {
                    setEvents(events.map(e => e.id === editingEvent.id ? { ...e, day: '', time: '' } : e));

                    await updateSchedule({
                        eventId: editingEvent.id,
                        day: '',
                        time: '',
                        strategy: editingEvent.strategy || ''
                    });

                    setScheduleModalVisible(false);
                    // Cancel notifications for this event
                    if (Platform.OS !== 'web') {
                        await Notifications.cancelAllScheduledNotificationsAsync();
                    }
                    showCustomAlert('완료', '일정이 초기화되었습니다.', 'success');
                } catch (error: any) {
                    showCustomAlert('오류', '초기화 실패: ' + error.message, 'error');
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
                                <TouchableOpacity
                                    key={cat}
                                    onPress={() => setSelectedCategory(cat)}
                                    className={`flex-row items-center px-4 py-3 rounded-xl transition-all ${selectedCategory === cat ? (isDark ? 'bg-indigo-500/10' : 'bg-indigo-50') : ''}`}
                                >
                                    <Ionicons
                                        name={cat === '연맹' ? 'flag-outline' : cat === '개인' ? 'person-outline' : cat === '서버' ? 'earth-outline' : cat === '초보자' ? 'star-outline' : 'apps-outline'}
                                        size={18}
                                        color={selectedCategory === cat ? '#6366f1' : (isDark ? '#475569' : '#94a3b8')}
                                    />
                                    <Text className={`ml-3 font-bold text-sm ${selectedCategory === cat ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                                        {cat}
                                    </Text>
                                    {selectedCategory === cat && (
                                        <View className="ml-auto w-1 h-4 bg-indigo-500 rounded-full" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Layout: Main Content */}
                <View className="flex-1 flex-col">
                    {/* Header */}
                    <View className={`pt-12 pb-2 px-6 border-b ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>이벤트 스케줄</Text>
                            <TouchableOpacity
                                onPress={() => router.replace('/')}
                                className={`p-2 rounded-full ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'}`}
                            >
                                <Ionicons name="close" size={24} color={isDark ? "white" : "#1e293b"} />
                            </TouchableOpacity>
                        </View>

                        {/* Mobile Category Filter (Hidden on Desktop) */}
                        {!isDesktop && (
                            <View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                                    {(['전체', '서버', '연맹', '개인', '초보자'] as EventCategory[]).map((cat) => (
                                        <TouchableOpacity
                                            key={cat}
                                            onPress={() => setSelectedCategory(cat)}
                                            className="px-4 py-3 mr-2 relative flex-row items-center"
                                        >
                                            <Ionicons
                                                name={cat === '연맹' ? 'flag-outline' : cat === '개인' ? 'person-outline' : cat === '서버' ? 'earth-outline' : cat === '초보자' ? 'star-outline' : 'apps-outline'}
                                                size={16}
                                                color={selectedCategory === cat ? (isDark ? '#818cf8' : '#6366f1') : (isDark ? '#475569' : '#94a3b8')}
                                                className="mr-2"
                                            />
                                            <Text className={`text-sm font-bold ${selectedCategory === cat ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{cat}</Text>
                                            {selectedCategory === cat && (
                                                <View className="absolute bottom-0 left-4 right-4 h-0.5 bg-indigo-500" />
                                            )}
                                        </TouchableOpacity>
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
                                filteredEvents.map((event) => {
                                    const isOngoing = checkIsOngoing(event);
                                    const isExpired = checkIsExpired(event);
                                    const isUpcoming = !isOngoing && !isExpired;

                                    const textColor = isExpired ? (isDark ? 'text-slate-600' : 'text-slate-400') : (isUpcoming ? (isDark ? 'text-slate-400' : 'text-slate-500') : (isDark ? 'text-white' : 'text-slate-900'));

                                    return (
                                        <View
                                            key={event.id}
                                            className={`w-full md:w-1/2 lg:w-1/3 xl:w-1/4 p-2`} // Responsive Grid
                                            onLayout={(e) => {
                                                if (itemLayouts.current) {
                                                    itemLayouts.current[event.id] = e.nativeEvent.layout.y;
                                                }
                                            }}
                                        >
                                            {/* Event Card Container - Enhanced depth */}
                                            <View
                                                className={`h-full rounded-[40px] border shadow-2xl transition-all ${isOngoing ? (isDark ? 'bg-slate-900 border-blue-500/30' : 'bg-white border-blue-100 shadow-blue-200/20') : (isUpcoming ? (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-slate-200/40') : (isDark ? 'bg-slate-900/60 border-slate-800/40' : 'bg-slate-50/80 border-slate-100'))}`}
                                            >
                                                {/* Card Header - Enhanced spacing & category icons */}
                                                <View className={`px-6 py-5 flex-row items-center justify-between border-b ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                                                    <View className="flex-row items-center flex-1 mr-2">
                                                        {event.imageUrl ? (
                                                            <View className={`w-12 h-12 rounded-2xl border overflow-hidden mr-4 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-100 bg-slate-50'}`}>
                                                                <Image
                                                                    source={typeof event.imageUrl === 'string' ? { uri: event.imageUrl } : event.imageUrl}
                                                                    className="w-full h-full"
                                                                    resizeMode="cover"
                                                                />
                                                            </View>
                                                        ) : (
                                                            <View className={`w-12 h-12 rounded-2xl items-center justify-center border mr-4 ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                                                <Ionicons name="calendar-outline" size={20} color={isDark ? '#475569' : '#94a3b8'} />
                                                            </View>
                                                        )}

                                                        <View className="flex-1">
                                                            <View className="flex-row items-center mb-1.5 flex-wrap gap-2">
                                                                <View className={`flex-row items-center px-2 py-0.5 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                                                    <Ionicons
                                                                        name={event.category === '연맹' ? 'flag-outline' : event.category === '개인' ? 'person-outline' : event.category === '서버' ? 'earth-outline' : event.category === '초보자' ? 'star-outline' : 'apps-outline'}
                                                                        size={10}
                                                                        color={isDark ? '#94a3b8' : '#64748b'}
                                                                        className="mr-1.5"
                                                                    />
                                                                    <Text className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{event.category}</Text>
                                                                </View>
                                                                {isOngoing ? (
                                                                    <View className="bg-blue-600 px-3 py-1 rounded-lg flex-row items-center">
                                                                        <Ionicons name="flash" size={10} color="white" style={{ marginRight: 4 }} />
                                                                        <Text className="text-white text-[9px] font-black uppercase">진행 중</Text>
                                                                    </View>
                                                                ) : isExpired ? (
                                                                    <View className="bg-slate-500 px-3 py-1 rounded-lg flex-row items-center">
                                                                        <Ionicons name="checkmark-circle" size={10} color="white" style={{ marginRight: 4 }} />
                                                                        <Text className="text-white text-[9px] font-black uppercase">종료</Text>
                                                                    </View>
                                                                ) : (
                                                                    <View className="bg-emerald-600 px-3 py-1 rounded-lg flex-row items-center">
                                                                        <Ionicons name="time" size={10} color="white" style={{ marginRight: 4 }} />
                                                                        <Text className="text-white text-[9px] font-black uppercase">예정</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <Text className={`text-xl font-extrabold tracking-tight ${textColor} ${isExpired ? 'line-through' : ''}`} numberOfLines={1}>{event.title}</Text>
                                                        </View>
                                                    </View>

                                                    {/* Admin Tools */}
                                                    {auth.isLoggedIn && (
                                                        <TouchableOpacity
                                                            onPress={() => openScheduleModal(event)}
                                                            className={`w-9 h-9 rounded-xl items-center justify-center border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                                                        >
                                                            <Ionicons name="settings-outline" size={18} color="#6366f1" />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>

                                                <View className="p-8 flex-1 justify-between">
                                                    <View className="mb-8">
                                                        {event.id !== 'a_fortress' && (
                                                            (!event.day && !event.time) ? (
                                                                <View className={`w-full py-6 border border-dashed rounded-2xl items-center justify-center ${isDark ? 'border-slate-800 bg-slate-900/40' : 'bg-slate-50 border-slate-100'}`}>
                                                                    <Text className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>등록된 일정이 없습니다</Text>
                                                                </View>
                                                            ) : (
                                                                event.day && !event.time && event.day !== '상설' && event.day !== '상시' ? (
                                                                    <View className={`w-full rounded-2xl border overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                                                        {/* Schedule Table Header */}
                                                                        <View className={`flex-row px-4 py-2 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                                                            <Text className={`flex-[1.5] text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>로컬 시간 (KST)</Text>
                                                                            <Text className={`flex-1 text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Universal (UTC)</Text>
                                                                        </View>
                                                                        <View className={`${isDark ? 'bg-black/20' : 'bg-white'}`}>
                                                                            {event.day.split('/').map((d, dIdx) => {
                                                                                const cleanD = d.trim();
                                                                                const formattedDay = cleanD.replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                                                                let utcText = '';
                                                                                if (cleanD.includes('~')) {
                                                                                    const parts = cleanD.split('~').map(x => x.trim());
                                                                                    const sDateUtc = getUTCString(parts[0]);
                                                                                    const eDateUtc = getUTCString(parts[1]);
                                                                                    if (sDateUtc && eDateUtc) utcText = `${sDateUtc} ~ ${eDateUtc}`;
                                                                                    else {
                                                                                        const sWeeklyUtc = getUTCTimeString(parts[0], false);
                                                                                        const eWeeklyUtc = getUTCTimeString(parts[1], false);
                                                                                        if (sWeeklyUtc && eWeeklyUtc) utcText = `${sWeeklyUtc} ~ ${eWeeklyUtc}`;
                                                                                    }
                                                                                } else {
                                                                                    const dateUtc = getUTCString(cleanD);
                                                                                    if (dateUtc) utcText = dateUtc;
                                                                                    else {
                                                                                        const weeklyUtc = getUTCTimeString(cleanD);
                                                                                        if (weeklyUtc) utcText = weeklyUtc;
                                                                                    }
                                                                                }

                                                                                const renderResponsivePeriod = (str: string, textClass: string, isUtc = false) => {
                                                                                    if (!str.includes('~')) return <Text className={textClass}>{isUtc ? str : formatDisplayDate(str)}</Text>;
                                                                                    const parts = str.split('~').map(s => s.trim());
                                                                                    return (
                                                                                        <View className="flex-row items-center">
                                                                                            <Text className={`${textClass} font-black`}>{isUtc ? parts[0] : formatDisplayDate(parts[0])}</Text>
                                                                                            <Text className={`${textClass} mx-2 opacity-30 font-normal`}>~</Text>
                                                                                            <Text className={`${textClass} font-black`}>{isUtc ? parts[1] : formatDisplayDate(parts[1])}</Text>
                                                                                        </View>
                                                                                    );
                                                                                };

                                                                                return (
                                                                                    <View key={dIdx} className={`flex-row items-center px-4 py-4 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'} last:border-0`}>
                                                                                        <View className="flex-[1.5]">
                                                                                            {renderResponsivePeriod(formattedDay, `${isExpired ? (isDark ? 'text-slate-600' : 'text-slate-400') : (isDark ? 'text-slate-100' : 'text-slate-800')} text-[13px] ${isExpired ? 'line-through' : ''}`)}
                                                                                        </View>
                                                                                        <View className="flex-1 opacity-70">
                                                                                            {!!utcText && renderResponsivePeriod(utcText, "text-slate-500 text-[11px] font-medium", true)}
                                                                                        </View>
                                                                                    </View>
                                                                                );
                                                                            })}
                                                                        </View>
                                                                    </View>
                                                                ) : null
                                                            )
                                                        )}

                                                        {event.time && (
                                                            <View className="w-full gap-4">
                                                                {event.time.split(' / ').map((part, idx) => {
                                                                    const trimmed = part.trim();
                                                                    if (!trimmed) return null;
                                                                    const colonIdx = trimmed.indexOf(':');
                                                                    const isTimeColon = colonIdx > 0 && /\d/.test(trimmed[colonIdx - 1]) && /\d/.test(trimmed[colonIdx + 1]);
                                                                    const rawLabel = (colonIdx > -1 && !isTimeColon) ? trimmed.substring(0, colonIdx).trim() : '';
                                                                    let label = rawLabel;
                                                                    if (event.id === 'a_bear' || event.id === 'alliance_bear') {
                                                                        label = label.replace('1군', 'Group 1').replace('2군', 'Group 2');
                                                                    }
                                                                    const content = rawLabel ? trimmed.substring(colonIdx + 1).trim() : trimmed;
                                                                    if (content === "." || !content) return null;

                                                                    return (
                                                                        <View key={idx} className={`rounded-3xl border overflow-hidden ${isDark ? 'bg-black/20 border-slate-800/60' : 'bg-slate-50 border-slate-100 shadow-sm'}`}>
                                                                            {!!label && (
                                                                                <View className={`px-5 py-3 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                                                                                    <Text className={`text-[11px] font-black uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>{label}</Text>
                                                                                </View>
                                                                            )}
                                                                            {/* Table Header */}
                                                                            <View className={`flex-row px-5 py-2 border-b border-slate-800/10`}>
                                                                                <Text className={`flex-[1.5] text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Local KST</Text>
                                                                                <Text className={`flex-1 text-[10px] font-black uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Universal UTC</Text>
                                                                            </View>
                                                                            <View className="flex-col">
                                                                                {content.split(/[,|]/).map((item, iIdx) => {
                                                                                    const formatted = item.trim().replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                                                                    const utcStr = getUTCTimeString(item.trim(), false);
                                                                                    return (
                                                                                        <View key={iIdx} className={`flex-row items-center px-4 py-4 border-b ${isDark ? 'border-slate-800/40' : 'border-slate-100'} last:border-0`}>
                                                                                            <View className="flex-[1.5]">
                                                                                                <Text className={`${isDark ? 'text-slate-100' : 'text-slate-800'} font-black text-[13px] ${isExpired ? 'line-through opacity-40' : ''}`}>{formatDisplayDate(formatted)}</Text>
                                                                                            </View>
                                                                                            <View className="flex-1 opacity-70">
                                                                                                <Text className="text-slate-500 text-[11px] font-medium">{utcStr || '-'}</Text>
                                                                                            </View>
                                                                                        </View>
                                                                                    );
                                                                                })}
                                                                            </View>
                                                                        </View>
                                                                    );
                                                                })}
                                                            </View>
                                                        )}
                                                    </View>

                                                    {/* Modern Rounded Action Buttons - Enhanced depth */}
                                                    <View className="flex-row gap-3 h-[48px]">
                                                        <TouchableOpacity
                                                            onPress={() => openGuideModal(event)}
                                                            className={`flex-[1.5] bg-indigo-600 rounded-2xl items-center justify-center flex-row active:bg-indigo-700 shadow-lg ${isDark ? 'shadow-indigo-900/20' : 'shadow-indigo-200'}`}
                                                        >
                                                            <Text className="text-white text-sm font-bold mr-2">
                                                                {(event.category === '연맹' || event.category === '서버') ? '전략 문서' : '공략 보기'}
                                                            </Text>
                                                            <Ionicons name="arrow-forward-outline" size={16} color="white" />
                                                        </TouchableOpacity>

                                                        {(event.category === '연맹' || event.category === '서버') && (
                                                            <TouchableOpacity
                                                                onPress={() => openAttendeeModal(event)}
                                                                className={`flex-1 rounded-2xl items-center justify-center flex-row border shadow-sm ${isDark ? 'bg-slate-800 border-slate-700 active:bg-slate-700 shadow-black/20' : 'bg-white border-slate-200 active:bg-slate-50 shadow-slate-100'}`}
                                                            >
                                                                <Ionicons name="people-outline" size={18} color={isDark ? "white" : "#475569"} className="mr-2" />
                                                                <Text className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>참석 관리</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    );
                                })
                            )}
                        </View>
                        <View className="h-20" />
                    </ScrollView>
                </View>

                {/* Guide Detail Popup Modal */}
                <Modal visible={guideModalVisible} transparent animationType="fade" >
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
                                    <BlurView intensity={20} className="absolute inset-0 bg-black/50" />
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
                        }}
                    >
                        <Pressable
                            onPress={() => {
                                setHourDropdownVisible(false);
                                setMinuteDropdownVisible(false);
                                setActiveDateDropdown(null);
                                setActiveFortressDropdown(null);
                            }}
                            className={`p-0 rounded-t-[40px] border-t max-h-[90%] overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800 shadow-2xl' : 'bg-white border-slate-100 shadow-2xl'}`}
                        >
                            <View className="px-6 pt-8 pb-4 flex-row justify-between items-start">
                                <View className="flex-1 mr-4">
                                    <View className="flex-row items-center mb-1">
                                        <View className="w-1.5 h-6 bg-sky-500 rounded-full mr-3" />
                                        <Text className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                            {editingEvent?.title}
                                        </Text>
                                    </View>
                                    <Text className={`text-[13px] font-medium leading-5 ml-4.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {(editingEvent?.category === '개인' || editingEvent?.id === 'alliance_frost_league' || editingEvent?.id === 'a_weapon' || editingEvent?.id === 'a_champ') ? '이벤트 진행 기간을 설정하세요.' : '이벤트 진행 요일과 시간을 설정하세요.'}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setScheduleModalVisible(false)} className={`p-2.5 rounded-full border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100 shadow-sm'}`}>
                                    <Ionicons name="close" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                className="px-6"
                                style={{ overflow: 'visible', zIndex: 10 }}
                                contentContainerStyle={
                                    editingEvent?.id === 'a_champ' || editingEvent?.id === 'a_center'
                                        ? { paddingBottom: 20 }
                                        : (editingEvent?.id === 'a_fortress')
                                            ? { paddingBottom: 200 }
                                            : (editingEvent?.category === '개인' || editingEvent?.id === 'a_mobilization' || editingEvent?.id === 'a_castle' || editingEvent?.id === 'a_svs' || editingEvent?.id === 'a_operation' || editingEvent?.id === 'a_champ')
                                                ? { paddingBottom: 300 }
                                                : (editingEvent?.id === 'alliance_frost_league' || editingEvent?.id === 'a_weapon')
                                                    ? { paddingBottom: 20 }
                                                    : { paddingBottom: 20 }
                                }
                                scrollEnabled={editingEvent?.id !== 'a_champ' && editingEvent?.id !== 'a_center'}
                            >
                                {editingEvent?.id === 'a_fortress' ? (
                                    <View className="mb-6">
                                        {(() => {
                                            const isFortressActive = fortressList.some(f => f.id === activeFortressDropdown?.id);
                                            const isCitadelActive = citadelList.some(c => c.id === activeFortressDropdown?.id);
                                            return (
                                                <>
                                                    {/* 요새전 섹션 */}
                                                    <View
                                                        style={{ zIndex: isFortressActive ? 20 : 1 }}
                                                        className="mb-6"
                                                    >
                                                        <View className="flex-row justify-between items-center mb-4 bg-brand-accent/5 p-4 rounded-2xl border border-brand-accent/20">
                                                            <Text className="text-white text-lg font-bold tracking-widest uppercase">요새전 ⚔️</Text>
                                                            <TouchableOpacity
                                                                onPress={() => setFortressList([...fortressList, {
                                                                    id: Date.now().toString(),
                                                                    name: '요새 1',
                                                                    h: new Date().getHours().toString().padStart(2, '0'),
                                                                    m: '00'
                                                                }])}
                                                                className="bg-brand-accent px-4 py-2 rounded-xl shadow-lg shadow-brand-accent/30"
                                                            >
                                                                <Text className="text-brand-dark font-bold text-xs">+ 요새 추가</Text>
                                                            </TouchableOpacity>
                                                        </View>

                                                        {fortressList.map((f, fIdx) => {
                                                            const isActive = activeFortressDropdown?.id === f.id;
                                                            return (
                                                                <View
                                                                    key={f.id}
                                                                    style={{ zIndex: isActive ? 50 : 1 }}
                                                                    className="bg-slate-800/40 p-4 rounded-3xl mb-3 border border-slate-700/50 shadow-sm relative"
                                                                >
                                                                    <View className="flex-row gap-1 items-center">
                                                                        {/* 요새 선택 */}
                                                                        <View className="w-24 relative">
                                                                            <TouchableOpacity
                                                                                onPress={() => setActiveFortressDropdown(activeFortressDropdown?.id === f.id && activeFortressDropdown?.type === 'fortress' ? null : { id: f.id, type: 'fortress' })}
                                                                                className="bg-slate-900/80 p-2 rounded-xl border border-slate-600 flex-row justify-between items-center"
                                                                            >
                                                                                <View className="flex-row items-center">
                                                                                    <Ionicons name="map-outline" size={12} color="#38bdf8" className="mr-1.5" />
                                                                                    <Text className="text-brand-accent text-xs font-bold">{f.name}</Text>
                                                                                </View>
                                                                                <Ionicons name={activeFortressDropdown?.id === f.id && activeFortressDropdown?.type === 'fortress' ? "caret-up" : "caret-down"} size={12} color="#38bdf8" />
                                                                            </TouchableOpacity>
                                                                            {activeFortressDropdown?.id === f.id && activeFortressDropdown?.type === 'fortress' && (
                                                                                <View
                                                                                    style={{ zIndex: 100, elevation: 10, backgroundColor: '#0f172a' }}
                                                                                    className="absolute bottom-12 left-0 right-0 border-2 border-slate-600 rounded-xl max-h-48 overflow-hidden shadow-2xl"
                                                                                >
                                                                                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                                                                        {FORTRESS_OPTIONS.map((opt) => (
                                                                                            <TouchableOpacity
                                                                                                key={opt}
                                                                                                onPress={() => {
                                                                                                    const newList = [...fortressList];
                                                                                                    newList[fIdx].name = opt;
                                                                                                    setFortressList(newList);
                                                                                                    setActiveFortressDropdown(null);
                                                                                                }}
                                                                                                className={`p-3 border-b border-slate-800 ${f.name === opt ? 'bg-brand-accent/30' : 'active:bg-slate-800'}`}
                                                                                            >
                                                                                                <Text className={`text-xs font-bold ${f.name === opt ? 'text-brand-accent' : 'text-white'}`}>{opt}</Text>
                                                                                            </TouchableOpacity>
                                                                                        ))}
                                                                                    </ScrollView>
                                                                                </View>
                                                                            )}
                                                                        </View>

                                                                        {/* 요일 선택 */}
                                                                        <View className="w-14 relative">
                                                                            <TouchableOpacity
                                                                                onPress={() => setActiveFortressDropdown(activeFortressDropdown?.id === f.id && activeFortressDropdown?.type === 'd' ? null : { id: f.id, type: 'd' })}
                                                                                className="bg-slate-900 p-2 rounded-xl border border-slate-600 flex-row justify-between items-center"
                                                                            >
                                                                                <Text className="text-white text-xs font-semibold">{f.day || '토'}</Text>
                                                                            </TouchableOpacity>
                                                                            {activeFortressDropdown?.id === f.id && activeFortressDropdown?.type === 'd' && (
                                                                                <View
                                                                                    style={{ zIndex: 100, elevation: 10, backgroundColor: '#0f172a' }}
                                                                                    className="absolute bottom-12 left-0 right-0 border-2 border-slate-600 rounded-xl max-h-48 overflow-hidden shadow-2xl"
                                                                                >
                                                                                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                                                                        {['월', '화', '수', '목', '금', '토', '일'].map((d) => (
                                                                                            <TouchableOpacity
                                                                                                key={d}
                                                                                                onPress={() => {
                                                                                                    const newList = [...fortressList];
                                                                                                    newList[fIdx].day = d;
                                                                                                    setFortressList(newList);
                                                                                                    setActiveFortressDropdown(null);
                                                                                                }}
                                                                                                className={`p-3 border-b border-slate-800 ${f.day === d ? 'bg-brand-accent/30' : 'active:bg-slate-800'}`}
                                                                                            >
                                                                                                <Text className={`text-xs font-bold ${f.day === d ? 'text-brand-accent' : 'text-white'}`}>{d}</Text>
                                                                                            </TouchableOpacity>
                                                                                        ))}
                                                                                    </ScrollView>
                                                                                </View>
                                                                            )}
                                                                        </View>

                                                                        {/* 시 선택 */}
                                                                        <View className="w-20 relative">
                                                                            <TouchableOpacity
                                                                                onPress={() => setActiveFortressDropdown(activeFortressDropdown?.id === f.id && activeFortressDropdown?.type === 'h' ? null : { id: f.id, type: 'h' })}
                                                                                className="bg-slate-900 p-2 rounded-xl border border-slate-600 flex-row justify-between items-center"
                                                                            >
                                                                                <View className="flex-row items-center">
                                                                                    <Ionicons name="time-outline" size={12} color="#64748b" className="mr-1" />
                                                                                    <Text className="text-white text-xs font-semibold">{f.h}시</Text>
                                                                                </View>
                                                                            </TouchableOpacity>
                                                                            {activeFortressDropdown?.id === f.id && activeFortressDropdown?.type === 'h' && (
                                                                                <View
                                                                                    style={{ zIndex: 100, elevation: 10, backgroundColor: '#0f172a' }}
                                                                                    className="absolute bottom-12 left-0 right-0 border-2 border-slate-600 rounded-xl max-h-48 overflow-hidden shadow-2xl"
                                                                                >
                                                                                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                                                                        {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map((h) => (
                                                                                            <TouchableOpacity
                                                                                                key={h}
                                                                                                onPress={() => {
                                                                                                    const newList = [...fortressList];
                                                                                                    newList[fIdx].h = h;
                                                                                                    setFortressList(newList);
                                                                                                    setActiveFortressDropdown(null);
                                                                                                }}
                                                                                                className={`py-3 px-2 border-b border-slate-800 ${f.h === h ? 'bg-brand-accent/30' : 'active:bg-slate-800'}`}
                                                                                            >
                                                                                                <Text className={`text-xs font-bold text-center ${f.h === h ? 'text-brand-accent' : 'text-white'}`}>{h}시</Text>
                                                                                            </TouchableOpacity>
                                                                                        ))}
                                                                                    </ScrollView>
                                                                                </View>
                                                                            )}
                                                                        </View>

                                                                        {/* 분 선택 */}
                                                                        <View className="w-20 relative">
                                                                            <TouchableOpacity
                                                                                onPress={() => setActiveFortressDropdown(activeFortressDropdown?.id === f.id && activeFortressDropdown?.type === 'm' ? null : { id: f.id, type: 'm' })}
                                                                                className="bg-slate-900 p-2 rounded-xl border border-slate-600 flex-row justify-between items-center"
                                                                            >
                                                                                <Text className="text-white text-xs font-semibold">{f.m}분</Text>
                                                                            </TouchableOpacity>
                                                                            {activeFortressDropdown?.id === f.id && activeFortressDropdown?.type === 'm' && (
                                                                                <View
                                                                                    style={{ zIndex: 100, elevation: 10, backgroundColor: '#0f172a' }}
                                                                                    className="absolute bottom-12 left-0 right-0 border-2 border-slate-600 rounded-xl max-h-48 overflow-hidden shadow-2xl"
                                                                                >
                                                                                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                                                                        {['00', '10', '20', '30', '40', '50'].map((m) => (
                                                                                            <TouchableOpacity
                                                                                                key={m}
                                                                                                onPress={() => {
                                                                                                    const newList = [...fortressList];
                                                                                                    newList[fIdx].m = m;
                                                                                                    setFortressList(newList);
                                                                                                    setActiveFortressDropdown(null);
                                                                                                }}
                                                                                                className={`py-3 px-2 border-b border-slate-800 ${f.m === m ? 'bg-brand-accent/30' : 'active:bg-slate-800'}`}
                                                                                            >
                                                                                                <Text className={`text-xs font-bold text-center ${f.m === m ? 'text-brand-accent' : 'text-white'}`}>{m}분</Text>
                                                                                            </TouchableOpacity>
                                                                                        ))}
                                                                                    </ScrollView>
                                                                                </View>
                                                                            )}
                                                                        </View>

                                                                        <TouchableOpacity onPress={() => setFortressList(fortressList.filter(item => item.id !== f.id))} className="bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                                                                            <Ionicons name="trash" size={16} color="#ef4444" />
                                                                        </TouchableOpacity>
                                                                    </View>
                                                                </View>
                                                            );
                                                        })}
                                                    </View>

                                                    {/* 성채전 섹션 */}
                                                    <View style={{ zIndex: isCitadelActive ? 20 : 1 }}>
                                                        <View className="flex-row justify-between items-center mb-4 bg-blue-500/5 p-4 rounded-2xl border border-blue-500/20">
                                                            <Text className="text-white text-lg font-bold tracking-widest uppercase">성채전 🏰</Text>
                                                            <TouchableOpacity
                                                                onPress={() => setCitadelList([...citadelList, {
                                                                    id: Date.now().toString(),
                                                                    name: '성채 1',
                                                                    h: new Date().getHours().toString().padStart(2, '0'),
                                                                    m: '00'
                                                                }])}
                                                                className="bg-blue-600 px-4 py-2 rounded-xl shadow-lg shadow-blue-600/30"
                                                            >
                                                                <Text className="text-white font-bold text-xs">+ 성채 추가</Text>
                                                            </TouchableOpacity>
                                                        </View>

                                                        {citadelList.map((c, cIdx) => {
                                                            const isActive = activeFortressDropdown?.id === c.id;
                                                            return (
                                                                <View
                                                                    key={c.id}
                                                                    style={{ zIndex: isActive ? 50 : 1 }}
                                                                    className="bg-slate-800/40 p-4 rounded-3xl mb-3 border border-slate-700/50 shadow-sm relative"
                                                                >
                                                                    <View className="flex-row gap-1 items-center">
                                                                        {/* 성채 선택 */}
                                                                        <View className="w-24 relative">
                                                                            <TouchableOpacity
                                                                                onPress={() => setActiveFortressDropdown(activeFortressDropdown?.id === c.id && activeFortressDropdown?.type === 'citadel' ? null : { id: c.id, type: 'citadel' })}
                                                                                className="bg-slate-900/80 p-2 rounded-xl border border-slate-600 flex-row justify-between items-center"
                                                                            >
                                                                                <View className="flex-row items-center">
                                                                                    <Ionicons name="business-outline" size={12} color="#60a5fa" className="mr-1.5" />
                                                                                    <Text className="text-blue-400 text-xs font-bold">{c.name}</Text>
                                                                                </View>
                                                                                <Ionicons name={activeFortressDropdown?.id === c.id && activeFortressDropdown?.type === 'citadel' ? "caret-up" : "caret-down"} size={12} color="#60a5fa" />
                                                                            </TouchableOpacity>
                                                                            {activeFortressDropdown?.id === c.id && activeFortressDropdown?.type === 'citadel' && (
                                                                                <View
                                                                                    style={{ zIndex: 100, elevation: 10, backgroundColor: '#0f172a' }}
                                                                                    className="absolute bottom-12 left-0 right-0 border-2 border-slate-600 rounded-xl max-h-48 overflow-hidden shadow-2xl"
                                                                                >
                                                                                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                                                                        {CITADEL_OPTIONS.map((opt) => (
                                                                                            <TouchableOpacity
                                                                                                key={opt}
                                                                                                onPress={() => {
                                                                                                    const newList = [...citadelList];
                                                                                                    newList[cIdx].name = opt;
                                                                                                    setCitadelList(newList);
                                                                                                    setActiveFortressDropdown(null);
                                                                                                }}
                                                                                                className={`p-3 border-b border-slate-800 ${c.name === opt ? 'bg-blue-500/30' : 'active:bg-slate-800'}`}
                                                                                            >
                                                                                                <Text className={`text-xs font-bold ${c.name === opt ? 'text-blue-400' : 'text-white'}`}>{opt}</Text>
                                                                                            </TouchableOpacity>
                                                                                        ))}
                                                                                    </ScrollView>
                                                                                </View>
                                                                            )}
                                                                        </View>

                                                                        {/* 요일 선택 */}
                                                                        <View className="w-14 relative">
                                                                            <TouchableOpacity
                                                                                onPress={() => setActiveFortressDropdown(activeFortressDropdown?.id === c.id && activeFortressDropdown?.type === 'd' ? null : { id: c.id, type: 'd' })}
                                                                                className="bg-slate-900 p-2 rounded-xl border border-slate-600 flex-row justify-between items-center"
                                                                            >
                                                                                <Text className="text-white text-xs font-semibold">{c.day || '일'}</Text>
                                                                            </TouchableOpacity>
                                                                            {activeFortressDropdown?.id === c.id && activeFortressDropdown?.type === 'd' && (
                                                                                <View
                                                                                    style={{ zIndex: 100, elevation: 10, backgroundColor: '#0f172a' }}
                                                                                    className="absolute bottom-12 left-0 right-0 border-2 border-slate-600 rounded-xl max-h-48 overflow-hidden shadow-2xl"
                                                                                >
                                                                                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                                                                        {['월', '화', '수', '목', '금', '토', '일'].map((d) => (
                                                                                            <TouchableOpacity
                                                                                                key={d}
                                                                                                onPress={() => {
                                                                                                    const newList = [...citadelList];
                                                                                                    newList[cIdx].day = d;
                                                                                                    setCitadelList(newList);
                                                                                                    setActiveFortressDropdown(null);
                                                                                                }}
                                                                                                className={`p-3 border-b border-slate-800 ${c.day === d ? 'bg-blue-500/30' : 'active:bg-slate-800'}`}
                                                                                            >
                                                                                                <Text className={`text-xs font-bold ${c.day === d ? 'text-blue-400' : 'text-white'}`}>{d}</Text>
                                                                                            </TouchableOpacity>
                                                                                        ))}
                                                                                    </ScrollView>
                                                                                </View>
                                                                            )}
                                                                        </View>

                                                                        {/* 시 선택 */}
                                                                        <View className="w-20 relative">
                                                                            <TouchableOpacity
                                                                                onPress={() => setActiveFortressDropdown(activeFortressDropdown?.id === c.id && activeFortressDropdown?.type === 'h' ? null : { id: c.id, type: 'h' })}
                                                                                className="bg-slate-900 p-2 rounded-xl border border-slate-600 flex-row justify-between items-center"
                                                                            >
                                                                                <Text className="text-white text-xs font-semibold">{c.h}시</Text>
                                                                            </TouchableOpacity>
                                                                            {activeFortressDropdown?.id === c.id && activeFortressDropdown?.type === 'h' && (
                                                                                <View
                                                                                    style={{ zIndex: 100, elevation: 10, backgroundColor: '#0f172a' }}
                                                                                    className="absolute bottom-12 left-0 right-0 border-2 border-slate-600 rounded-xl max-h-48 overflow-hidden shadow-2xl"
                                                                                >
                                                                                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                                                                        {Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0')).map((h) => (
                                                                                            <TouchableOpacity
                                                                                                key={h}
                                                                                                onPress={() => {
                                                                                                    const newList = [...citadelList];
                                                                                                    newList[cIdx].h = h;
                                                                                                    setCitadelList(newList);
                                                                                                    setActiveFortressDropdown(null);
                                                                                                }}
                                                                                                className={`py-3 px-2 border-b border-slate-800 ${c.h === h ? 'bg-blue-500/30' : 'active:bg-slate-800'}`}
                                                                                            >
                                                                                                <Text className={`text-xs font-bold text-center ${c.h === h ? 'text-blue-400' : 'text-white'}`}>{h}시</Text>
                                                                                            </TouchableOpacity>
                                                                                        ))}
                                                                                    </ScrollView>
                                                                                </View>
                                                                            )}
                                                                        </View>

                                                                        {/* 분 선택 */}
                                                                        <View className="w-20 relative">
                                                                            <TouchableOpacity
                                                                                onPress={() => setActiveFortressDropdown(activeFortressDropdown?.id === c.id && activeFortressDropdown?.type === 'm' ? null : { id: c.id, type: 'm' })}
                                                                                className="bg-slate-900 p-2 rounded-xl border border-slate-600 flex-row justify-between items-center"
                                                                            >
                                                                                <Text className="text-white text-xs font-semibold">{c.m}분</Text>
                                                                            </TouchableOpacity>
                                                                            {activeFortressDropdown?.id === c.id && activeFortressDropdown?.type === 'm' && (
                                                                                <View
                                                                                    style={{ zIndex: 100, elevation: 10, backgroundColor: '#0f172a' }}
                                                                                    className="absolute bottom-12 left-0 right-0 border-2 border-slate-600 rounded-xl max-h-48 overflow-hidden shadow-2xl"
                                                                                >
                                                                                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                                                                                        {['00', '10', '20', '30', '40', '50'].map((m) => (
                                                                                            <TouchableOpacity
                                                                                                key={m}
                                                                                                onPress={() => {
                                                                                                    const newList = [...citadelList];
                                                                                                    newList[cIdx].m = m;
                                                                                                    setCitadelList(newList);
                                                                                                    setActiveFortressDropdown(null);
                                                                                                }}
                                                                                                className={`py-3 px-2 border-b border-slate-800 ${c.m === m ? 'bg-blue-500/30' : 'active:bg-slate-800'}`}
                                                                                            >
                                                                                                <Text className={`text-xs font-bold text-center ${c.m === m ? 'text-blue-400' : 'text-white'}`}>{m}분</Text>
                                                                                            </TouchableOpacity>
                                                                                        ))}
                                                                                    </ScrollView>
                                                                                </View>
                                                                            )}
                                                                        </View>

                                                                        <TouchableOpacity onPress={() => setCitadelList(citadelList.filter(item => item.id !== c.id))} className="bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                                                                            <Ionicons name="trash" size={16} color="#ef4444" />
                                                                        </TouchableOpacity>
                                                                    </View>
                                                                </View>
                                                            );
                                                        })}
                                                    </View>
                                                </>
                                            );
                                        })()}
                                    </View>
                                ) : (() => {
                                    const dateRangeIDs = ['a_castle', 'server_castle', 'a_operation', 'alliance_operation', 'a_trade', 'alliance_trade', 'a_champ', 'alliance_champion', 'a_weapon', 'alliance_frost_league', 'server_svs_prep', 'server_svs_battle', 'server_immigrate', 'server_merge'];
                                    return (editingEvent?.category === '개인' || dateRangeIDs.includes(editingEvent?.id || ''));
                                })() ? (
                                    <View className="mb-6" style={{ zIndex: 100 }}>
                                        {/* Helper to update date time parts */}
                                        {(() => {
                                            const RenderDateSelector = ({
                                                label,
                                                value,
                                                onChange,
                                                type
                                            }: {
                                                label: string,
                                                value: string,
                                                onChange: (val: string) => void,
                                                type: 'start' | 'end'
                                            }) => {
                                                // Parse value YYYY.MM.DD HH:mm
                                                // If invalid, fallback to now
                                                const now = new Date();
                                                let dateParts = {
                                                    y: now.getFullYear().toString(),
                                                    m: pad(now.getMonth() + 1),
                                                    d: pad(now.getDate()),
                                                    h: '09',
                                                    min: '00'
                                                };
                                                const match = value.match(/(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})/);
                                                if (match) {
                                                    dateParts = { y: match[1], m: match[2], d: match[3], h: match[4], min: match[5] };
                                                }

                                                const updatePart = (field: keyof typeof dateParts, val: string) => {
                                                    const newParts = { ...dateParts, [field]: val };
                                                    onChange(`${newParts.y}.${newParts.m}.${newParts.d} ${newParts.h}:${newParts.min}`);
                                                    setActiveDateDropdown(null);
                                                };

                                                const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() + i - 1).toString());
                                                const months = Array.from({ length: 12 }, (_, i) => pad(i + 1));
                                                const days = Array.from({ length: 31 }, (_, i) => pad(i + 1));
                                                const hours = Array.from({ length: 24 }, (_, i) => pad(i));
                                                const minutes = ['00', '10', '20', '30', '40', '50'];

                                                const Dropdown = ({ field, options, currentVal }: { field: 'y' | 'm' | 'd' | 'h' | 'min', options: string[], currentVal: string }) => {
                                                    const isOpen = activeDateDropdown?.type === type && activeDateDropdown?.field === field;
                                                    const ITEM_HEIGHT = 40;

                                                    return (
                                                        <View className="relative mr-1">
                                                            <TouchableOpacity
                                                                onPress={() => setActiveDateDropdown(isOpen ? null : { type, field })}
                                                                className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'} px-3 py-3 rounded-xl border flex-row items-center justify-between min-w-[65px]`}
                                                            >
                                                                <Text className={`${isDark ? 'text-white' : 'text-slate-700'} font-bold text-xs mr-2`}>
                                                                    {currentVal}{field === 'y' ? '년' : field === 'm' ? '월' : field === 'd' ? '일' : field === 'h' ? '시' : '분'}
                                                                </Text>
                                                                <Ionicons name={isOpen ? "caret-up" : "caret-down"} size={10} color={isDark ? "#94a3b8" : "#64748b"} />
                                                            </TouchableOpacity>
                                                            {isOpen && (
                                                                <View
                                                                    className={`absolute left-0 min-w-[80px] bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl bottom-12`}
                                                                    style={{ height: 280, zIndex: 1000, elevation: 10 }}
                                                                >
                                                                    <FlatList
                                                                        data={options}
                                                                        keyExtractor={(item) => item}
                                                                        getItemLayout={(data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                                                                        renderItem={({ item: opt }) => (
                                                                            <TouchableOpacity
                                                                                style={{ height: ITEM_HEIGHT, justifyContent: 'center' }}
                                                                                onPress={() => updatePart(field, opt)}
                                                                                className={`px-2 rounded-lg ${currentVal === opt ? 'bg-brand-accent/20' : ''}`}
                                                                            >
                                                                                <Text className={`text-center font-semibold ${currentVal === opt ? 'text-brand-accent' : 'text-slate-400'}`}>{opt}</Text>
                                                                            </TouchableOpacity>
                                                                        )}
                                                                    />
                                                                </View>
                                                            )}
                                                        </View>
                                                    );
                                                };

                                                return (
                                                    <View className="mb-8" style={{ zIndex: activeDateDropdown?.type === type ? 5000 : 1 }}>
                                                        <View className="flex-row items-center mb-3">
                                                            <Ionicons name={label.includes('날짜') || label.includes('일시') ? "calendar" : "time"} size={14} color={isDark ? "#38bdf8" : "#2563eb"} style={{ marginRight: 6 }} />
                                                            <Text className={`${isDark ? 'text-sky-400' : 'text-blue-600'} text-xs font-black uppercase tracking-tight`}>{label}</Text>
                                                        </View>
                                                        <View className="flex-row flex-wrap items-center">
                                                            <Dropdown field="y" options={years} currentVal={dateParts.y} />
                                                            <Dropdown field="m" options={months} currentVal={dateParts.m} />
                                                            <Dropdown field="d" options={days} currentVal={dateParts.d} />
                                                            <View className="mx-2"><Text className="text-slate-600 font-bold">/</Text></View>
                                                            <Dropdown field="h" options={hours} currentVal={dateParts.h} />
                                                            {!!editingEvent && (
                                                                <React.Fragment>
                                                                    <View className="mx-1"><Text className="text-slate-600 font-bold">:</Text></View>
                                                                    <Dropdown field="min" options={minutes} currentVal={dateParts.min} />
                                                                </React.Fragment>
                                                            )}
                                                        </View>
                                                    </View>
                                                );
                                            };

                                            return (
                                                <>
                                                    <RenderDateSelector label="시작 일시" value={mStart} onChange={setMStart} type="start" />
                                                    <RenderDateSelector label="종료 일시" value={mEnd} onChange={setMEnd} type="end" />
                                                </>
                                            );
                                        })()}
                                    </View>
                                ) : (
                                    <>
                                        {/* Tabs (Alliance Only) - Exclude Single Slot Events */}
                                        {(() => {
                                            const singleSlotIDs = [
                                                'a_center', 'alliance_center',
                                                'a_mercenary', 'alliance_mercenary',
                                                'a_immigrate', 'alliance_immigrate',
                                                'a_mobilization', 'alliance_mobilization',
                                                'a_merge', 'alliance_merge',
                                                'a_svs', 'alliance_svs',
                                                'a_dragon', 'alliance_dragon',
                                                'a_joe', 'alliance_joe'
                                            ];
                                            if (editingEvent?.category === '연맹' && !singleSlotIDs.includes(editingEvent.id)) {
                                                return (
                                                    <View className={`flex-row mb-6 p-1 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                        <TouchableOpacity
                                                            onPress={() => setActiveTab(1)}
                                                            className={`flex-1 py-2 items-center rounded-lg ${activeTab === 1 ? (isDark ? 'bg-slate-700 shadow-sm' : 'bg-white shadow-sm') : ''}`}
                                                        >
                                                            <Text className={`font-semibold ${activeTab === 1 ? (isDark ? 'text-white' : 'text-sky-600') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                                                                {(editingEvent?.id === 'a_bear' || editingEvent?.id === 'alliance_bear') ? '곰1 설정' : '1군 설정'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            onPress={() => setActiveTab(2)}
                                                            className={`flex-1 py-2 items-center rounded-lg ${activeTab === 2 ? (isDark ? 'bg-slate-700 shadow-sm' : 'bg-white shadow-sm') : ''}`}
                                                        >
                                                            <Text className={`font-semibold ${activeTab === 2 ? (isDark ? 'text-white' : 'text-sky-600') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                                                                {(editingEvent?.id === 'a_bear' || editingEvent?.id === 'alliance_bear') ? '곰2 설정' : '2군 설정'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                );
                                            }
                                            return null;
                                        })()}

                                        {editingEvent?.id !== 'a_champ' && editingEvent?.id !== 'alliance_frost_league' && editingEvent?.id !== 'a_weapon' && (
                                            <>
                                                <View className="mb-4">
                                                    <Text className="text-brand-accent text-xs font-bold mb-2 ml-1 uppercase">
                                                        {(() => {
                                                            const singleSlotIDs = [
                                                                'a_center', 'alliance_center',
                                                                'a_mercenary', 'alliance_mercenary',
                                                                'a_immigrate', 'alliance_immigrate',
                                                                'a_mobilization', 'alliance_mobilization',
                                                                'a_merge', 'alliance_merge',
                                                                'a_svs', 'alliance_svs',
                                                                'a_dragon', 'alliance_dragon',
                                                                'a_joe', 'alliance_joe'
                                                            ];
                                                            if (editingEvent?.category === '연맹' && !singleSlotIDs.includes(editingEvent.id)) {
                                                                const groupLabel = (editingEvent.id === 'a_bear' || editingEvent.id === 'alliance_bear') ? `곰${activeTab}` : `${activeTab}군`;
                                                                return `진행 요일 (${groupLabel})`;
                                                            }
                                                            return '진행 요일';
                                                        })()}
                                                    </Text>
                                                    <View className="flex-row flex-wrap gap-2">
                                                        {['월', '화', '수', '목', '금', '토', '일', '매일', '상시'].map((d) => {
                                                            const isSelected = selectedDayForSlot === d;
                                                            return (
                                                                <TouchableOpacity
                                                                    key={d}
                                                                    onPress={() => toggleDay(d)}
                                                                    className={`w-10 h-10 rounded-xl items-center justify-center border ${isSelected ? 'bg-brand-accent border-brand-accent' : 'bg-slate-800/60 border-slate-700'}`}
                                                                >
                                                                    <Text className={`font-bold text-xs ${isSelected ? 'text-brand-dark' : 'text-slate-300'}`}>{d}</Text>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                </View>

                                                {editingEvent?.id !== 'a_center' && (
                                                    <View className="mb-4 mt-2">
                                                        <View className="flex-row items-center mb-4 gap-3">
                                                            <Text className="text-brand-accent text-[10px] font-bold uppercase opacity-60">진행 시간</Text>
                                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
                                                                {(activeTab === 1 ? slots1 : slots2).map(slot => (
                                                                    <TouchableOpacity
                                                                        key={slot.id}
                                                                        onPress={() => {
                                                                            const [h, m] = slot.time.split(':');
                                                                            setEditHour(h || '22');
                                                                            setEditMinute(m || '00');
                                                                            setSelectedDayForSlot(slot.day);
                                                                            if (editingSlotId === slot.id) {
                                                                                setEditingSlotId(null);
                                                                                setEditHour('22');
                                                                                setEditMinute('00');
                                                                            } else {
                                                                                setEditingSlotId(slot.id);
                                                                            }
                                                                        }}
                                                                        className={`mr-3 border px-3 py-1.5 rounded-xl flex-row items-center ${editingSlotId === slot.id ? 'bg-brand-accent/30 border-brand-accent' : 'bg-brand-accent/10 border-brand-accent/20'}`}
                                                                    >
                                                                        <Text className="text-white text-xs font-bold mr-2">
                                                                            {slot.day}{slot.time ? `(${slot.time})` : ''}
                                                                        </Text>
                                                                        <TouchableOpacity onPress={() => removeTimeSlot(slot.id)}>
                                                                            <Ionicons name="close-circle" size={16} color="#ef4444" />
                                                                        </TouchableOpacity>
                                                                    </TouchableOpacity>
                                                                ))}
                                                            </ScrollView>
                                                        </View>

                                                        {editingEvent?.id !== 'a_center' && selectedDayForSlot !== '상시' && (
                                                            <View className="space-y-4">
                                                                <View className="flex-row items-center gap-3">
                                                                    {/* Hour Picker */}
                                                                    <View className="flex-1 relative">
                                                                        <TouchableOpacity
                                                                            onPress={() => setHourDropdownVisible(!hourDropdownVisible)}
                                                                            className="bg-slate-800 p-3.5 rounded-xl border border-slate-700 flex-row justify-between items-center"
                                                                        >
                                                                            <View className="flex-row items-center">
                                                                                <Ionicons name="time-outline" size={16} color="#38bdf8" className="mr-2" />
                                                                                <Text className="text-white font-bold">{editHour}시</Text>
                                                                            </View>
                                                                            <Ionicons name={hourDropdownVisible ? "caret-up" : "caret-down"} size={12} color="#64748b" />
                                                                        </TouchableOpacity>

                                                                        {hourDropdownVisible && (
                                                                            <View
                                                                                style={{ zIndex: 1000, elevation: 10, backgroundColor: '#0f172a' }}
                                                                                className="absolute bottom-16 left-0 right-0 border-2 border-slate-700 rounded-xl h-48 overflow-hidden shadow-2xl"
                                                                            >
                                                                                <FlatList
                                                                                    data={Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))}
                                                                                    keyExtractor={(item) => item}
                                                                                    initialScrollIndex={parseInt(editHour) || 0}
                                                                                    getItemLayout={(data, index) => ({ length: 50, offset: 50 * index, index })}
                                                                                    renderItem={({ item: h }) => (
                                                                                        <TouchableOpacity
                                                                                            onPress={() => { setEditHour(h); setHourDropdownVisible(false); }}
                                                                                            className={`h-[50px] justify-center px-4 border-b border-slate-800/50 ${editHour === h ? 'bg-brand-accent/10' : ''}`}
                                                                                        >
                                                                                            <Text className={`font-semibold ${editHour === h ? 'text-brand-accent' : 'text-slate-300'}`}>{h}시</Text>
                                                                                        </TouchableOpacity>
                                                                                    )}
                                                                                />
                                                                            </View>
                                                                        )}
                                                                    </View>
                                                                    <View className="w-4 items-center"><Text className="text-slate-500 font-semibold">:</Text></View>
                                                                    {/* Minute Picker */}
                                                                    <View className="flex-1 relative">
                                                                        <TouchableOpacity
                                                                            onPress={() => setMinuteDropdownVisible(!minuteDropdownVisible)}
                                                                            className="bg-slate-800 p-3.5 rounded-xl border border-slate-700 flex-row justify-between items-center"
                                                                        >
                                                                            <View className="flex-row items-center">
                                                                                <Ionicons name="timer-outline" size={16} color="#38bdf8" className="mr-2" />
                                                                                <Text className="text-white font-bold">{editMinute}분</Text>
                                                                            </View>
                                                                            <Ionicons name={minuteDropdownVisible ? "caret-up" : "caret-down"} size={12} color="#64748b" />
                                                                        </TouchableOpacity>

                                                                        {minuteDropdownVisible && (
                                                                            <View
                                                                                style={{ zIndex: 1000, elevation: 10, backgroundColor: '#0f172a' }}
                                                                                className="absolute bottom-16 left-0 right-0 border-2 border-slate-700 rounded-xl max-h-48 overflow-hidden shadow-2xl"
                                                                            >
                                                                                <FlatList
                                                                                    data={['00', '10', '20', '30', '40', '50']}
                                                                                    keyExtractor={(item) => item}
                                                                                    renderItem={({ item: m }) => (
                                                                                        <TouchableOpacity
                                                                                            onPress={() => { setEditMinute(m); setMinuteDropdownVisible(false); }}
                                                                                            className={`h-[50px] justify-center px-4 border-b border-slate-800/50 ${editMinute === m ? 'bg-brand-accent/10' : ''}`}
                                                                                        >
                                                                                            <Text className={`font-semibold ${editMinute === m ? 'text-brand-accent' : 'text-slate-300'}`}>{m}분</Text>
                                                                                        </TouchableOpacity>
                                                                                    )}
                                                                                />
                                                                            </View>
                                                                        )}
                                                                    </View>
                                                                </View>

                                                                <View className="flex-row gap-2">
                                                                    <TouchableOpacity
                                                                        onPress={addTimeSlot}
                                                                        className={`flex-1 ${editingSlotId ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-blue-500/20 border-blue-500/40'} py-3 rounded-xl border items-center flex-row justify-center`}
                                                                    >
                                                                        <Ionicons name={editingSlotId ? "checkmark-circle" : "add-circle-outline"} size={20} color={editingSlotId ? "#10b981" : "#38bdf8"} style={{ marginRight: 8 }} />
                                                                        <Text className={`${editingSlotId ? 'text-emerald-400' : 'text-[#38bdf8]'} font-bold`}>
                                                                            {editingSlotId ? '수정 완료' : '이 시간 추가 등록'}
                                                                        </Text>
                                                                    </TouchableOpacity>
                                                                    {!!editingSlotId && (
                                                                        <TouchableOpacity
                                                                            onPress={() => {
                                                                                setEditingSlotId(null);
                                                                                setEditHour('22');
                                                                                setEditMinute('00');
                                                                            }}
                                                                            className="bg-slate-800 px-4 py-3 rounded-xl border border-slate-700 justify-center"
                                                                        >
                                                                            <Text className="text-slate-400 font-semibold text-sm">취소</Text>
                                                                        </TouchableOpacity>
                                                                    )}
                                                                </View>
                                                            </View>
                                                        )}
                                                        {selectedDayForSlot === '상시' && (
                                                            <TouchableOpacity
                                                                onPress={addTimeSlot}
                                                                className="bg-brand-accent/20 py-4 rounded-xl border border-brand-accent/40 items-center"
                                                            >
                                                                <Text className="text-brand-accent font-bold">상시 진행으로 등록</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                            </ScrollView>

                            {/* Fixed Action Footer with background */}
                            <View className={`px-6 pt-8 pb-10 border-t ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                <View className="flex-row gap-4">
                                    <TouchableOpacity
                                        onPress={handleDeleteSchedule}
                                        className={`flex-1 ${isDark ? 'bg-slate-800/50' : 'bg-white border border-slate-200'} py-4.5 rounded-[22px] items-center active:scale-[0.98] transition-all`}
                                    >
                                        <Text className={`${isDark ? 'text-slate-500' : 'text-slate-400'} font-bold text-lg`}>초기화</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={saveSchedule}
                                        className="flex-[2.5] bg-sky-500 py-4.5 rounded-[22px] items-center shadow-2xl shadow-sky-500/40 active:scale-[0.98] transition-all"
                                    >
                                        <Text className="text-white font-black text-lg">설정 저장하기</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>

                {/* Attendee Modal */}
                <Modal visible={attendeeModalVisible} transparent animationType="slide" >
                    <View className="flex-1 bg-black/90 pt-16">
                        <View className={`flex-1 rounded-t-[40px] overflow-hidden border-t ${isDark ? 'bg-slate-900 border-slate-700 shadow-2xl' : 'bg-white border-slate-100 shadow-2xl'}`}>
                            <View className={`h-16 flex-row items-center justify-between px-6 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{managedEvent?.title} 명단 관리</Text>
                                <TouchableOpacity onPress={() => setAttendeeModalVisible(false)} className={`p-2 rounded-full border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                                    <Ionicons name="close" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView className="p-4">
                                {bulkAttendees.length === 0 ? (
                                    <View className="items-center justify-center py-10 opacity-50">
                                        <Ionicons name="documents-outline" size={48} color="#94a3b8" />
                                        <Text className="text-slate-400 mt-4 font-semibold">등록된 참석 명단이 없습니다.</Text>
                                        <Text className="text-slate-600 text-xs mt-1">관리자가 명단을 추가하면 여기에 표시됩니다.</Text>
                                    </View>
                                ) : (
                                    bulkAttendees.map((attendee, index) => (
                                        <View
                                            key={attendee.id || index}
                                            className={`mb-4 p-4 rounded-2xl border relative ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}
                                            style={{ zIndex: bulkAttendees.length - index }}
                                        >
                                            <View className="flex-row items-center mb-3" style={{ zIndex: 50 }}>
                                                <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`}>
                                                    <Text className={`font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>{index + 1}</Text>
                                                </View>
                                                <MemberPicker
                                                    value={attendee.name}
                                                    onSelect={(v) => updateAttendeeField(attendee.id!, 'name', v)}
                                                    members={members}
                                                    isAdmin={!!isAdmin}
                                                />
                                                {!!isAdmin && (
                                                    <TouchableOpacity onPress={() => deleteAttendee(attendee.id!)} className={`ml-2 p-3 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-100'}`}>
                                                        <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            <View className="flex-row space-x-2 pointer-events-auto">
                                                <HeroPicker label="HERO 1" value={attendee.hero1 || ''} onSelect={(v) => updateAttendeeField(attendee.id!, 'hero1', v)} />
                                                <HeroPicker label="HERO 2" value={attendee.hero2 || ''} onSelect={(v) => updateAttendeeField(attendee.id!, 'hero2', v)} />
                                                <HeroPicker label="HERO 3" value={attendee.hero3 || ''} onSelect={(v) => updateAttendeeField(attendee.id!, 'hero3', v)} />
                                            </View>
                                        </View>
                                    ))
                                )}

                                {isAdmin && (
                                    <TouchableOpacity onPress={addAttendeeRow} className={`p-4 rounded-2xl border border-dashed items-center mb-10 mt-4 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                        <Text className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>+ 영주 추가하기</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>

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
                        <BlurView intensity={20} className="absolute inset-0" />
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
                                    onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                                    className={`py-4 w-full rounded-2xl ${customAlert.type === 'success' ? 'bg-emerald-600' : customAlert.type === 'error' ? 'bg-red-600' : 'bg-amber-600'}`}
                                >
                                    <Text className="text-white text-center font-bold text-lg">확인</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </Modal>
            </View>

        </View >
    );
}
