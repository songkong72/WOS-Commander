import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, Modal, TextInput, Alert, FlatList, ActivityIndicator, useWindowDimensions, Linking, Platform, Pressable } from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useAuth } from '../_layout';
import { getGuideContent } from '../../data/event-guides';
import { Attendee } from '../../data/mock-attendees';
import { useFirestoreAttendees } from '../../hooks/useFirestoreAttendees';
import { useFirestoreEventSchedules } from '../../hooks/useFirestoreEventSchedules';
import heroesData from '../../data/heroes.json';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { WikiEvent, INITIAL_WIKI_EVENTS, EventCategory } from '../../data/wiki-events';
import { ADDITIONAL_EVENTS } from '../../data/new-events';

const HERO_NAMES = heroesData.map(h => h.name);
const FORTRESS_OPTIONS = Array.from({ length: 12 }, (_, i) => `요새 ${i + 1}`);
const CITADEL_OPTIONS = Array.from({ length: 4 }, (_, i) => `성채 ${i + 1}`);

// Mini Hero Picker Component
const HeroPicker = ({ value, onSelect, label }: { value: string, onSelect: (v: string) => void, label: string }) => {
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
        <View className="flex-1 relative">
            <Text className="text-slate-500 text-[9px] font-black mb-1.5 ml-1 uppercase">{label}</Text>
            <TextInput
                placeholder={label === 'HERO 1' ? '영웅 1' : label === 'HERO 2' ? '영웅 2' : '영웅 3'}
                placeholderTextColor="#475569"
                value={search}
                onChangeText={(v) => {
                    setSearch(v);
                    onSelect(v);
                    setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                className="bg-slate-900/40 p-3 rounded-xl text-white text-xs font-bold border border-slate-800"
            />
            {showDropdown && filteredHeroes.length > 0 && (
                <View className="absolute top-16 left-0 right-0 bg-slate-800 border border-slate-700 rounded-xl max-h-40 z-50 shadow-2xl overflow-hidden">
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
                        {filteredHeroes.map((name) => (
                            <TouchableOpacity
                                key={name}
                                onPress={() => {
                                    onSelect(name);
                                    setSearch(name);
                                    setShowDropdown(false);
                                }}
                                className="p-3 border-b border-slate-700/50"
                            >
                                <Text className="text-white text-xs font-bold">{name}</Text>
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
    const router = useRouter();
    const params = useLocalSearchParams();

    // Refs for scrolling
    const scrollViewRef = useRef<ScrollView>(null);
    const itemLayouts = useRef<{ [key: string]: number }>({});
    const [highlightId, setHighlightId] = useState<string | null>(null);
    const [fortressList, setFortressList] = useState<{ id: string, name: string, day?: string, h: string, m: string }[]>([]);
    const [citadelList, setCitadelList] = useState<{ id: string, name: string, day?: string, h: string, m: string }[]>([]);

    // Firebase Event Schedules
    const { schedules, loading: schedulesLoading, updateSchedule } = useFirestoreEventSchedules();

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
    const [editingEvent, setEditingEvent] = useState<WikiEvent | null>(null);

    // Tab & Data States
    const [activeTab, setActiveTab] = useState<1 | 2>(1);
    const [slots1, setSlots1] = useState<{ day: string, time: string, id: string }[]>([]);
    const [slots2, setSlots2] = useState<{ day: string, time: string, id: string }[]>([]);

    const [editHour, setEditHour] = useState('11');
    const [editMinute, setEditMinute] = useState('00');

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

    const pad = (n: number) => n.toString().padStart(2, '0');

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

    const isAdmin = auth.isLoggedIn && (auth.adminName?.includes('관리자') || auth.adminName?.toLowerCase().includes('admin'));

    useEffect(() => {
        if (firestoreAttendees && firestoreAttendees.length > 0) {
            setBulkAttendees(JSON.parse(JSON.stringify(firestoreAttendees)));
        } else {
            setBulkAttendees([]);
        }
    }, [firestoreAttendees, managedEvent]);

    const filteredEvents = useMemo(() => {
        let base = selectedCategory === '전체' ? [...events] : events.filter(e => e.category === selectedCategory);

        if (selectedCategory === '전체') {
            const catOrder: { [key: string]: number } = { '연맹': 0, '개인': 1, '초보자': 2 };
            base.sort((a, b) => {
                const orderA = catOrder[a.category] !== undefined ? catOrder[a.category] : 99;
                const orderB = catOrder[b.category] !== undefined ? catOrder[b.category] : 99;
                return orderA - orderB;
            });
        }
        return base;
    }, [events, selectedCategory]);

    const openWikiLink = (url: string) => {
        if (url) {
            if (Platform.OS === 'web') {
                setCurrentWikiUrl(url);
                setBrowserVisible(true);
            } else {
                Linking.openURL(url).catch(err => Alert.alert('오류', '링크를 열 수 없습니다: ' + err.message));
            }
        } else {
            Alert.alert('알림', '위키 링크가 존재하지 않습니다.');
        }
    };

    const checkIsOngoing = (event: WikiEvent) => {
        try {
            const now = new Date();
            const combined = (event.day || '') + ' ' + (event.time || '');

            // 1. Date Range Logic (e.g., "2026.02.01 (일) 11:00 ~ 2026.02.18 (수) 11:00")
            const dateRangeMatch = combined.match(/(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})\s*~\s*(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})/);
            if (dateRangeMatch) {
                // Formatting helper for robustness
                const sStr = `${dateRangeMatch[1].replace(/\./g, '-')}T${dateRangeMatch[2]}:00`;
                const eStr = `${dateRangeMatch[3].replace(/\./g, '-')}T${dateRangeMatch[4]}:00`;
                const start = new Date(sStr);
                const end = new Date(eStr);

                if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
                return now >= start && now <= end;
            }

            // 2. Weekly Range Logic (e.g., "토 10:00 ~ 일 22:00")
            const weeklyMatch = combined.match(/([일월화수목금토])\s*(\d{2}):(\d{2})\s*~\s*([일월화수목금토])\s*(\d{2}):(\d{2})/);
            if (weeklyMatch) {
                const dayMap: { [key: string]: number } = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };

                const currentDay = now.getDay();
                const currentH = now.getHours();
                const currentM = now.getMinutes();
                const currentTotal = currentDay * 1440 + currentH * 60 + currentM;

                const startDay = dayMap[weeklyMatch[1]];
                const startH = parseInt(weeklyMatch[2], 10);
                const startM = parseInt(weeklyMatch[3], 10);
                const startTotal = startDay * 1440 + startH * 60 + startM;

                const endDay = dayMap[weeklyMatch[4]];
                const endH = parseInt(weeklyMatch[5], 10);
                const endM = parseInt(weeklyMatch[6], 10);
                const endTotal = endDay * 1440 + endH * 60 + endM;

                if (startTotal <= endTotal) {
                    return currentTotal >= startTotal && currentTotal <= endTotal;
                } else {
                    return currentTotal >= startTotal || currentTotal <= endTotal;
                }
            }
            return false;
        } catch (err) {
            return false;
        }
    };

    const addTimeSlot = () => {
        const isT1 = activeTab === 1;
        const setSlots = isT1 ? setSlots1 : setSlots2;
        const currentSlots = isT1 ? slots1 : slots2;

        if (selectedDayForSlot === '상시') {
            setSlots([{ day: '상시', time: '', id: Math.random().toString() }]);
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
                Alert.alert('완료', '연맹 작전이 저장되었습니다.');
            } catch (error: any) {
                Alert.alert('오류', '저장 실패: ' + error.message);
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

        if (event.id === 'a_champ') {
            const raw = event.day || '';
            const match = raw.match(/([일월화수목금토])\s*(\d{2}):(\d{2})\s*~\s*([일월화수목금토])\s*(\d{2}):(\d{2})/);
            if (match) {
                setChampStart({ d: match[1], h: match[2], m: match[3] });
                setChampEnd({ d: match[4], h: match[5], m: match[6] });
            } else {
                setChampStart({ d: '월', h: '22', m: '00' });
                setChampEnd({ d: '월', h: '23', m: '00' });
            }
        }

        if (event.id === 'a_mobilization' || event.id === 'a_castle' || event.id === 'a_svs' || event.id === 'a_operation' || event.id === 'alliance_frost_league' || event.id === 'a_weapon') {
            const rawDay = event.day || '';
            const [s, e] = rawDay.includes('~') ? rawDay.split('~').map(x => x.trim()) : ['', ''];
            setMStart(s || `${new Date().getFullYear()}.01.01 12:00`);
            setMEnd(e || `${new Date().getFullYear()}.01.01 12:00`);
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

        if (event.category === '연맹' && event.id !== 'a_center' && event.id !== 'a_champ' && event.id !== 'a_mercenary' && event.id !== 'alliance_frost_league' && event.id !== 'a_weapon') {
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

        setSelectedDayForSlot('월');
        setEditHour('22');
        setEditMinute('00');
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
            Alert.alert('알림', '최소 한 명 이상의 이름을 입력해주세요.');
            return;
        }

        const summary = validAttendees.map(a =>
            `- ${a.name}: ${[a.hero1, a.hero2, a.hero3].filter(Boolean).join(', ') || '지정 안 함'}`
        ).join('\n');

        setAttendeeModalVisible(false);
        Alert.alert(
            '참석 명단 저장 완료',
            `${managedEvent?.title} 이벤트를 위해 총 ${validAttendees.length}명의 영주가 등록되었습니다.\n\n${summary}`
        );

        if (managedEvent) {
            saveAttendeesToFirestore(validAttendees.length > 0 ? validAttendees : [], managedEvent.title)
                .then(() => Alert.alert('성공', '명단이 서버에 저장되었습니다.'))
                .catch((e) => Alert.alert('오류', '저장 중 문제가 발생했습니다: ' + e.message));
        }
    };

    const saveSchedule = async () => {
        if (!editingEvent) return;

        if (editingEvent.id === 'a_mobilization' || editingEvent.id === 'a_castle' || editingEvent.id === 'a_svs' || editingEvent.id === 'a_operation' || editingEvent.id === 'alliance_frost_league' || editingEvent.id === 'a_weapon') {
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
                Alert.alert('완료', `${editingEvent.title} 일정이 저장되었습니다.`);
            } catch (error: any) {
                Alert.alert('오류', '저장 실패: ' + error.message);
            }
            return;
        }

        if (editingEvent.id === 'a_champ') {
            const finalDay = `${champStart.d} ${champStart.h}:${champStart.m} ~ ${champEnd.d} ${champEnd.h}:${champEnd.m}`;
            const finalTime = '';

            setEvents(events.map(e => e.id === editingEvent.id ? { ...e, day: finalDay, time: finalTime } : e));

            try {
                await updateSchedule({
                    eventId: editingEvent.id,
                    day: finalDay,
                    time: finalTime,
                    strategy: editingEvent.strategy || ''
                });
                setScheduleModalVisible(false);
                Alert.alert('완료', '연맹 챔피언십 일정이 저장되었습니다.');
            } catch (error: any) {
                Alert.alert('오류', '저장 실패: ' + error.message);
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
                setScheduleModalVisible(false);
                Alert.alert('완료', '요새전/성채전 일정이 저장되었습니다.');
            } catch (error: any) {
                Alert.alert('오류', '저장 실패: ' + error.message);
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

        if (editingEvent?.category === '연맹' && editingEvent?.id !== 'a_center' && editingEvent?.id !== 'a_mercenary' && editingEvent?.id !== 'alliance_frost_league' && editingEvent.id !== 'a_weapon') {
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

            Alert.alert('저장 완료', '이벤트 일정이 성공적으로 등록되었습니다.');

        } catch (error: any) {
            Alert.alert('저장 실패', '서버 통신 중 오류가 발생했습니다.\n' + error.message);
        }
    };

    const handleDeleteSchedule = async () => {
        if (!editingEvent) return;

        if (Platform.OS === 'web') {
            // Web-specific confirmation
            if (window.confirm('일정 초기화\n\n이 이벤트의 요일/시간 설정을 정말로 삭제하시겠습니까?')) {
                try {
                    setEvents(events.map(e => e.id === editingEvent.id ? { ...e, day: '', time: '' } : e));

                    await updateSchedule({
                        eventId: editingEvent.id,
                        day: '',
                        time: '',
                        strategy: editingEvent.strategy || ''
                    });

                    setScheduleModalVisible(false);
                    alert('일정이 초기화되었습니다.');
                } catch (error: any) {
                    alert('초기화 실패: ' + error.message);
                }
            }
            return;
        }

        // Native Alert
        Alert.alert('일정 초기화', '이 이벤트의 요일/시간 설정을 정말로 삭제하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            {
                text: '삭제(초기화)',
                style: 'destructive',
                onPress: async () => {
                    try {
                        setEvents(events.map(e => e.id === editingEvent.id ? { ...e, day: '', time: '' } : e));

                        await updateSchedule({
                            eventId: editingEvent.id,
                            day: '',
                            time: '',
                            strategy: editingEvent.strategy || ''
                        });

                        setScheduleModalVisible(false);
                        Alert.alert('완료', '일정이 초기화되었습니다.');
                    } catch (error: any) {
                        Alert.alert('오류', '초기화 실패: ' + error.message);
                    }
                }
            }
        ]);
    };

    const guideContent = selectedEventForGuide ? getGuideContent(selectedEventForGuide.id) : null;

    if (schedulesLoading) {
        return (
            <View className="flex-1 bg-brand-dark justify-center items-center">
                <Stack.Screen options={{ headerShown: false }} />
                <ActivityIndicator size="large" color="#38bdf8" />
                <Text className="text-white mt-4 font-bold">데이터 동기화 중...</Text>
            </View>
        );
    }

    return (
        <ImageBackground
            source={require('../../assets/images/bg-main.png')}
            style={{ flex: 1, backgroundColor: '#020617' }}
            imageStyle={{
                resizeMode: 'cover',
                width: '100%',
                height: '100%',
                ...Platform.select({
                    web: {
                        objectFit: 'cover',
                        objectPosition: 'center',
                    } as any
                })
            }}
        >
            <View className="flex-1 bg-black/70 flex-row">
                <Stack.Screen options={{ headerShown: false }} />

                {/* Layout: Sidebar for Desktop */}
                {isDesktop && (
                    <View className="w-64 bg-slate-900 border-r border-slate-800 flex-col pt-16 px-4">
                        <Text className="text-white text-xl font-black mb-8 px-2">이벤트 필터</Text>
                        <View className="space-y-2">
                            {(['전체', '연맹', '개인', '초보자'] as EventCategory[]).map((cat) => (
                                <TouchableOpacity
                                    key={cat}
                                    onPress={() => setSelectedCategory(cat)}
                                    className={`flex-row items-center p-4 rounded-xl transition-all ${selectedCategory === cat ? 'bg-brand-accent shadow-lg shadow-brand-accent/20' : 'hover:bg-slate-800'}`}
                                >
                                    <View className={`w-2 h-2 rounded-full mr-3 ${selectedCategory === cat ? 'bg-brand-dark' : 'bg-slate-600'}`} />
                                    <Text className={`font-bold text-sm ${selectedCategory === cat ? 'text-brand-dark' : 'text-slate-400'}`}>
                                        {cat} 이벤트
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Layout: Main Content */}
                <View className="flex-1 flex-col">
                    {/* Header */}
                    <View className="pt-16 pb-6 px-6 bg-brand-header border-b border-slate-900">
                        <View className="flex-row items-center justify-between mb-4">
                            <Text className="text-white text-3xl font-black tracking-tighter">이벤트 스케줄</Text>
                            <TouchableOpacity
                                onPress={() => router.replace('/')}
                                className="flex-row items-center bg-white/5 px-4 py-2 rounded-xl border border-white/10"
                            >
                                <Ionicons name="home-outline" size={18} color="#FFD700" className="mr-2" />
                                <Text className="text-white font-black text-xs">뒤로가기</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Mobile Category Filter (Hidden on Desktop) */}
                        {!isDesktop && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mt-2">
                                {(['전체', '연맹', '개인', '초보자'] as EventCategory[]).map((cat) => (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => setSelectedCategory(cat)}
                                        className={`px-6 py-2.5 rounded-full mr-2 border ${selectedCategory === cat ? 'bg-brand-accent border-brand-accent' : 'bg-slate-800/60 border-slate-700'}`}
                                    >
                                        <Text className={`font-black text-[15px] ${selectedCategory === cat ? 'text-brand-dark' : 'text-slate-400'}`}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>

                    {/* Event Grid */}
                    <ScrollView ref={scrollViewRef} className="flex-1 p-6">
                        <View className="flex-row flex-wrap -mx-2">
                            {filteredEvents.map((event) => {
                                const isOngoing = checkIsOngoing(event);
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
                                        <View className={`h-full bg-[#1e293b]/95 rounded-[28px] border-2 overflow-hidden transition-all duration-300 ${highlightId === event.id ? 'border-[#38bdf8] shadow-2xl shadow-blue-500/30 scale-[1.02]' : 'border-slate-700/60 shadow-lg'}`}>
                                            {/* Card Image Area */}
                                            <View className="h-56 bg-slate-800 relative">
                                                {event.imageUrl ? (
                                                    <ImageBackground source={typeof event.imageUrl === 'string' ? { uri: event.imageUrl } : event.imageUrl} className="w-full h-full" resizeMode="contain">
                                                        <View className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-transparent" />
                                                        <View className="absolute top-3 left-3 px-2 py-1 bg-black/60 rounded-lg backdrop-blur-sm">
                                                            <Text className="text-white text-[10px] font-bold">{event.category}</Text>
                                                        </View>
                                                    </ImageBackground>
                                                ) : (
                                                    <View className="w-full h-full items-center justify-center">
                                                        <Text className="text-3xl">📅</Text>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Card Content Area */}
                                            <View className="p-4 flex-1 justify-between">
                                                <View>
                                                    <View className="flex-row items-center justify-between mb-2">
                                                        <Text className="text-white text-xl font-black leading-tight flex-1 mr-2" numberOfLines={1}>{event.title}</Text>
                                                        {isOngoing && (
                                                            <View className="bg-red-500 px-2.5 py-1.5 rounded-lg shadow-lg shadow-red-500/30 animate-pulse">
                                                                <Text className="text-white text-[12px] font-black">진행중</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                    <View className="flex-row flex-wrap gap-1 mb-3">
                                                        {event.id !== 'a_fortress' && (
                                                            (!event.day && !event.time) ? (
                                                                <View className="px-4 py-2 bg-brand-accent/20 rounded-xl border border-brand-accent/30 shadow-sm">
                                                                    <Text className="text-brand-accent text-base font-black">일정 미정</Text>
                                                                </View>
                                                            ) : (
                                                                event.day && !event.time && event.day !== '상설' && event.day !== '상시' ? (
                                                                    <View className="flex-row flex-wrap gap-2">
                                                                        {event.day.split('/').map((d, dIdx) => (
                                                                            <View key={dIdx} className="bg-black/60 px-5 py-2.5 rounded-2xl border border-slate-500 shadow-inner">
                                                                                <Text className="text-[#38bdf8] font-black text-lg">{d}</Text>
                                                                            </View>
                                                                        ))}
                                                                    </View>
                                                                ) : null
                                                            )
                                                        )}
                                                        {event.time && (
                                                            <View className="w-full mt-1 border-t border-slate-800/30 pt-1">
                                                                {event.time.split(' / ').map((part, idx) => {
                                                                    const trimmed = part.trim();
                                                                    if (!trimmed) return null;
                                                                    const colonIdx = trimmed.indexOf(':');
                                                                    const isTimeColon = colonIdx > 0 && /\d/.test(trimmed[colonIdx - 1]) && /\d/.test(trimmed[colonIdx + 1]);
                                                                    const label = (colonIdx > -1 && !isTimeColon) ? trimmed.substring(0, colonIdx).trim() : '';
                                                                    const content = label ? trimmed.substring(colonIdx + 1).trim() : trimmed;
                                                                    if (content === "." || !content) return null;

                                                                    return (
                                                                        <View key={idx} className="mb-2 last:mb-0">
                                                                            {label && <Text className="text-slate-500 text-[11px] font-black uppercase mb-1 ml-1">{label}</Text>}
                                                                            <View className="flex-row flex-wrap gap-2.5">
                                                                                {content.split(/[,|]/).map((item, iIdx) => {
                                                                                    const formatted = item.trim().replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                                                                    return (
                                                                                        <View key={iIdx} className="bg-black/50 px-5 py-2.5 rounded-2xl border border-slate-500 shadow-2xl">
                                                                                            <Text className="text-[#38bdf8] font-black text-lg">{formatted}</Text>
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
                                                </View>

                                                {/* Action Buttons */}
                                                <View className="flex-row mt-3 h-12">
                                                    <TouchableOpacity
                                                        onPress={() => openGuideModal(event)}
                                                        className="flex-1 mx-1 rounded-2xl border border-slate-700 bg-slate-800 items-center justify-center flex-row h-12 shadow-sm"
                                                    >
                                                        <Text className="text-[#38bdf8] text-[14px] font-black">
                                                            {event.category === '연맹' ? '⚔️ 전략' : '📘 가이드'}
                                                        </Text>
                                                    </TouchableOpacity>

                                                    {event.category === '연맹' && (
                                                        auth.isLoggedIn ? (
                                                            <>
                                                                <TouchableOpacity
                                                                    onPress={() => openAttendeeModal(event)}
                                                                    className="flex-1 mx-1 rounded-2xl border border-slate-700 bg-slate-800 items-center justify-center flex-row h-12 shadow-sm"
                                                                >
                                                                    <Ionicons name="people" size={16} color="#38bdf8" className="mr-2" />
                                                                    <Text className="text-[#38bdf8] text-[14px] font-black" numberOfLines={1}>참석자</Text>
                                                                </TouchableOpacity>
                                                                <TouchableOpacity
                                                                    onPress={() => openScheduleModal(event)}
                                                                    className="flex-1 mx-1 rounded-2xl border border-slate-700 bg-slate-800 items-center justify-center flex-row h-12 shadow-sm"
                                                                >
                                                                    <Ionicons name="time-outline" size={16} color="#38bdf8" className="mr-2" />
                                                                    <Text className="text-[#38bdf8] text-[14px] font-black">시간</Text>
                                                                </TouchableOpacity>
                                                            </>
                                                        ) : (
                                                            <TouchableOpacity
                                                                onPress={() => openAttendeeModal(event)}
                                                                className="flex-1 mx-1 rounded-2xl border border-blue-500/30 bg-blue-500/10 items-center justify-center flex-row h-12 shadow-sm"
                                                            >
                                                                <Ionicons name="people" size={16} color="#60a5fa" className="mr-2" />
                                                                <Text className="text-blue-400 text-[14px] font-black">참석</Text>
                                                            </TouchableOpacity>
                                                        )
                                                    )}

                                                    {event.category !== '연맹' && auth.isLoggedIn && (
                                                        <TouchableOpacity
                                                            onPress={() => openScheduleModal(event)}
                                                            className="w-12 mx-1 rounded-2xl border border-slate-700 bg-slate-800 items-center justify-center h-12 shadow-sm"
                                                        >
                                                            <Ionicons name="settings-sharp" size={18} color="#38bdf8" />
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
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
                                            <Text className="text-white text-2xl font-black">{selectedEventForGuide?.title}</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity onPress={() => setGuideModalVisible(false)} className="absolute top-4 right-4 bg-black/40 p-2 rounded-full border border-white/10">
                                        <Ionicons name="close" size={20} color="white" />
                                    </TouchableOpacity>
                                </ImageBackground>
                            ) : (
                                <View className="h-24 bg-slate-800 w-full justify-center px-6">
                                    <Text className="text-white text-2xl font-black">{selectedEventForGuide?.title}</Text>
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
                                            <Text className="text-white font-bold text-sm">실전 진행 방식 (Wiki)</Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => openWikiLink(selectedEventForGuide?.wikiUrl || '')}
                                            className="bg-[#38bdf8]/10 px-3 py-1.5 rounded-lg border border-[#38bdf8]/20"
                                        >
                                            <Text className="text-[#38bdf8] text-xs font-bold">🌐 위키 이동</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <Text className="text-slate-400 text-xs leading-5">
                                        {selectedEventForGuide?.wikiUrl || '위키 링크가 없습니다.'}
                                    </Text>
                                </View>

                                {/* Alliance Strategy Section */}
                                {selectedEventForGuide?.category === '연맹' && (
                                    <View className="mb-6">
                                        <View className="flex-row items-center justify-between mb-3">
                                            <Text className="text-purple-400 font-black text-sm uppercase tracking-widest">🛡️ 연맹 작전 지시</Text>
                                            {isAdmin && !isEditingStrategy && (
                                                <TouchableOpacity onPress={() => setIsEditingStrategy(true)} className="bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                                                    <Text className="text-slate-400 text-[10px] font-bold">수정</Text>
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
                                                            <Text className="text-slate-300 font-bold text-xs">취소</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => saveStrategy(selectedEventForGuide!)} className="bg-purple-600 px-4 py-2 rounded-xl">
                                                            <Text className="text-white font-bold text-xs">저장</Text>
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
                                        <Text className="text-slate-500 text-xs font-black uppercase mb-3">이벤트 개요</Text>
                                        <Text className="text-slate-300 text-sm leading-6 mb-6">{guideContent.overview}</Text>

                                        {/* How to Play */}
                                        {guideContent.howToPlay && guideContent.howToPlay.length > 0 && (
                                            <View className="mb-6">
                                                <Text className="text-slate-500 text-xs font-black uppercase mb-3">상세 진행 가이드</Text>
                                                <View className="space-y-3">
                                                    {guideContent.howToPlay.map((step: { text: string; images?: string[] }, idx: number) => (
                                                        <View key={idx} className="flex-row">
                                                            <View className="w-5 h-5 rounded-full bg-slate-800 items-center justify-center mr-3 mt-0.5 border border-slate-700">
                                                                <Text className="text-slate-500 text-[10px] font-bold">{idx + 1}</Text>
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
                                                    <Text className="text-yellow-500 text-xs font-black uppercase">이벤트 공략 꿀팁</Text>
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
                                <Text className="text-slate-400 font-bold text-sm">닫기</Text>
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
                            className="bg-slate-900 p-5 rounded-t-[40px] border-t border-slate-800 max-h-[85%]"
                        >
                            <View className="flex-row justify-between items-start mb-4">
                                <View>
                                    <Text className="text-white text-2xl font-black mb-1">{editingEvent?.title}</Text>
                                    <Text className="text-slate-400 text-sm">
                                        {(editingEvent?.id === 'alliance_frost_league' || editingEvent?.id === 'a_weapon') ? '이벤트 진행 기간을 설정하세요.' : '이벤트 진행 요일과 시간을 설정하세요.'}
                                    </Text>
                                </View>
                                <TouchableOpacity onPress={() => setScheduleModalVisible(false)} className="bg-slate-800 p-2 rounded-full border border-slate-700">
                                    <Ionicons name="close" size={20} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView
                                className="mb-0"
                                style={{ overflow: 'visible', zIndex: 10 }}
                                contentContainerStyle={
                                    editingEvent?.id === 'a_champ' || editingEvent?.id === 'a_center'
                                        ? { paddingBottom: 20 }
                                        : (editingEvent?.id === 'a_fortress')
                                            ? { paddingBottom: 200 }
                                            : (editingEvent?.id === 'a_mobilization' || editingEvent?.id === 'a_castle' || editingEvent?.id === 'a_svs' || editingEvent?.id === 'a_operation')
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
                                                            <Text className="text-white text-lg font-black tracking-widest uppercase">요새전 ⚔️</Text>
                                                            <TouchableOpacity
                                                                onPress={() => setFortressList([...fortressList, {
                                                                    id: Date.now().toString(),
                                                                    name: '요새 1',
                                                                    day: '토',
                                                                    h: '22', m: '00'
                                                                }])}
                                                                className="bg-brand-accent px-4 py-2 rounded-xl shadow-lg shadow-brand-accent/30"
                                                            >
                                                                <Text className="text-brand-dark font-black text-xs">+ 요새 추가</Text>
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
                                                                                <Text className="text-brand-accent text-xs font-black">{f.name}</Text>
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
                                                                                                <Text className={`text-xs font-black ${f.name === opt ? 'text-brand-accent' : 'text-white'}`}>{opt}</Text>
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
                                                                                <Text className="text-white text-xs font-bold">{f.day || '토'}</Text>
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
                                                                                                <Text className={`text-xs font-black ${f.day === d ? 'text-brand-accent' : 'text-white'}`}>{d}</Text>
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
                                                                                <Text className="text-white text-xs font-bold">{f.h}시</Text>
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
                                                                                                <Text className={`text-xs font-black text-center ${f.h === h ? 'text-brand-accent' : 'text-white'}`}>{h}시</Text>
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
                                                                                <Text className="text-white text-xs font-bold">{f.m}분</Text>
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
                                                                                                <Text className={`text-xs font-black text-center ${f.m === m ? 'text-brand-accent' : 'text-white'}`}>{m}분</Text>
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
                                                            <Text className="text-white text-lg font-black tracking-widest uppercase">성채전 🏰</Text>
                                                            <TouchableOpacity
                                                                onPress={() => setCitadelList([...citadelList, {
                                                                    id: Date.now().toString(),
                                                                    name: '성채 1',
                                                                    day: '일',
                                                                    h: '22', m: '10'
                                                                }])}
                                                                className="bg-blue-600 px-4 py-2 rounded-xl shadow-lg shadow-blue-600/30"
                                                            >
                                                                <Text className="text-white font-black text-xs">+ 성채 추가</Text>
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
                                                                                <Text className="text-blue-400 text-xs font-black">{c.name}</Text>
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
                                                                                                <Text className={`text-xs font-black ${c.name === opt ? 'text-blue-400' : 'text-white'}`}>{opt}</Text>
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
                                                                                <Text className="text-white text-xs font-bold">{c.day || '일'}</Text>
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
                                                                                                <Text className={`text-xs font-black ${c.day === d ? 'text-blue-400' : 'text-white'}`}>{d}</Text>
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
                                                                                <Text className="text-white text-xs font-bold">{c.h}시</Text>
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
                                                                                                <Text className={`text-xs font-black text-center ${c.h === h ? 'text-blue-400' : 'text-white'}`}>{h}시</Text>
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
                                                                                <Text className="text-white text-xs font-bold">{c.m}분</Text>
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
                                                                                                <Text className={`text-xs font-black text-center ${c.m === m ? 'text-blue-400' : 'text-white'}`}>{m}분</Text>
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
                                ) : (editingEvent?.id === 'a_mobilization' || editingEvent?.id === 'a_castle' || editingEvent?.id === 'a_svs' || editingEvent?.id === 'a_operation' || editingEvent?.id === 'alliance_frost_league' || editingEvent?.id === 'a_weapon') ? (
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
                                                let dateParts = { y: '2024', m: '01', d: '01', h: '12', min: '00' };
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
                                                                className="bg-slate-800 px-3 py-3 rounded-xl border border-slate-700 flex-row items-center justify-between min-w-[60px]"
                                                            >
                                                                <Text className="text-white font-bold text-xs mr-1">{currentVal}{field === 'y' ? '년' : field === 'm' ? '월' : field === 'd' ? '일' : field === 'h' ? '시' : '분'}</Text>
                                                                <Ionicons name={isOpen ? "caret-up" : "caret-down"} size={10} color="#64748b" />
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
                                                                                <Text className={`text-center font-bold ${currentVal === opt ? 'text-brand-accent' : 'text-slate-400'}`}>{opt}</Text>
                                                                            </TouchableOpacity>
                                                                        )}
                                                                    />
                                                                </View>
                                                            )}
                                                        </View>
                                                    );
                                                };

                                                return (
                                                    <View className="mb-6" style={{ zIndex: activeDateDropdown?.type === type ? 5000 : 1 }}>
                                                        <Text className="text-brand-accent text-xs font-black mb-2 uppercase">{label}</Text>
                                                        <View className="flex-row flex-wrap items-center">
                                                            <Dropdown field="y" options={years} currentVal={dateParts.y} />
                                                            <Dropdown field="m" options={months} currentVal={dateParts.m} />
                                                            <Dropdown field="d" options={days} currentVal={dateParts.d} />
                                                            <View className="mx-2"><Text className="text-slate-600 font-black">/</Text></View>
                                                            <Dropdown field="h" options={hours} currentVal={dateParts.h} />
                                                            {!!editingEvent && editingEvent.id !== 'a_castle' && editingEvent.id !== 'a_svs' && editingEvent.id !== 'a_operation' && (
                                                                <React.Fragment>
                                                                    <View className="mx-1"><Text className="text-slate-600 font-black">:</Text></View>
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
                                        {/* Tabs (Alliance Only) - Exclude Championship, Center, and Mercenary Honor, Frost League */}
                                        {editingEvent?.category === '연맹' && editingEvent?.id !== 'a_center' && editingEvent?.id !== 'a_champ' && editingEvent?.id !== 'a_mercenary' && editingEvent?.id !== 'alliance_frost_league' && editingEvent?.id !== 'a_weapon' && (
                                            <View className="flex-row mb-6 bg-slate-800 p-1 rounded-xl">
                                                <TouchableOpacity
                                                    onPress={() => setActiveTab(1)}
                                                    className={`flex-1 py-2 items-center rounded-lg ${activeTab === 1 ? 'bg-slate-700' : ''}`}
                                                >
                                                    <Text className={`font-bold ${activeTab === 1 ? 'text-white font-black' : 'text-slate-500'}`}>1군 설정</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => setActiveTab(2)}
                                                    className={`flex-1 py-2 items-center rounded-lg ${activeTab === 2 ? 'bg-slate-700' : ''}`}
                                                >
                                                    <Text className={`font-bold ${activeTab === 2 ? 'text-white font-black' : 'text-slate-500'}`}>2군 설정</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}

                                        {/* Championship Specific UI */}
                                        {editingEvent?.id === 'a_champ' && (
                                            <View className="mb-6">
                                                <Text className="text-brand-accent text-xs font-black mb-3 ml-1 uppercase">진행 기간 설정</Text>
                                                <View className="bg-slate-800 p-4 rounded-2xl border border-slate-700">
                                                    {/* Start */}
                                                    <View className="flex-row items-center mb-4">
                                                        <Text className="text-white font-bold w-12">시작</Text>
                                                        <View className="flex-row gap-2 flex-1">
                                                            {/* Day */}
                                                            <View className="flex-1 bg-slate-900 rounded-xl border border-slate-600 overflow-hidden">
                                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                                    {['월', '화', '수', '목', '금', '토', '일'].map(d => (
                                                                        <TouchableOpacity key={d} onPress={() => setChampStart({ ...champStart, d })} className={`p-3 ${champStart.d === d ? 'bg-brand-accent' : ''}`}>
                                                                            <Text className={`font-bold ${champStart.d === d ? 'text-brand-dark' : 'text-slate-400'}`}>{d}</Text>
                                                                        </TouchableOpacity>
                                                                    ))}
                                                                </ScrollView>
                                                            </View>
                                                            {/* Time */}
                                                            <View className="flex-row items-center gap-1 bg-slate-900 rounded-xl border border-slate-600 px-3 py-2">
                                                                <TextInput
                                                                    className="text-white font-bold w-6 text-center"
                                                                    value={champStart.h}
                                                                    onChangeText={t => setChampStart({ ...champStart, h: t })}
                                                                    keyboardType="number-pad"
                                                                    maxLength={2}
                                                                />
                                                                <Text className="text-slate-500">:</Text>
                                                                <TextInput
                                                                    className="text-white font-bold w-6 text-center"
                                                                    value={champStart.m}
                                                                    onChangeText={t => setChampStart({ ...champStart, m: t })}
                                                                    keyboardType="number-pad"
                                                                    maxLength={2}
                                                                />
                                                            </View>
                                                        </View>
                                                    </View>

                                                    {/* End */}
                                                    <View className="flex-row items-center">
                                                        <Text className="text-white font-bold w-12">종료</Text>
                                                        <View className="flex-row gap-2 flex-1">
                                                            {/* Day */}
                                                            <View className="flex-1 bg-slate-900 rounded-xl border border-slate-600 overflow-hidden">
                                                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                                    {['월', '화', '수', '목', '금', '토', '일'].map(d => (
                                                                        <TouchableOpacity key={d} onPress={() => setChampEnd({ ...champEnd, d })} className={`p-3 ${champEnd.d === d ? 'bg-brand-accent' : ''}`}>
                                                                            <Text className={`font-bold ${champEnd.d === d ? 'text-brand-dark' : 'text-slate-400'}`}>{d}</Text>
                                                                        </TouchableOpacity>
                                                                    ))}
                                                                </ScrollView>
                                                            </View>
                                                            {/* Time */}
                                                            <View className="flex-row items-center gap-1 bg-slate-900 rounded-xl border border-slate-600 px-3 py-2">
                                                                <TextInput
                                                                    className="text-white font-bold w-6 text-center"
                                                                    value={champEnd.h}
                                                                    onChangeText={t => setChampEnd({ ...champEnd, h: t })}
                                                                    keyboardType="number-pad"
                                                                    maxLength={2}
                                                                />
                                                                <Text className="text-slate-500">:</Text>
                                                                <TextInput
                                                                    className="text-white font-bold w-6 text-center"
                                                                    value={champEnd.m}
                                                                    onChangeText={t => setChampEnd({ ...champEnd, m: t })}
                                                                    keyboardType="number-pad"
                                                                    maxLength={2}
                                                                />
                                                            </View>
                                                        </View>
                                                    </View>
                                                </View>

                                                <View className="mt-4 bg-brand-accent/5 p-4 rounded-2xl border border-brand-accent/20 items-center">
                                                    <Text className="text-slate-500 text-[10px] font-black uppercase mb-1">선택된 진행 일정</Text>
                                                    <Text className="text-white text-lg font-black">
                                                        {champStart.d} {champStart.h}:{champStart.m} <Text className="text-brand-accent mx-2">~</Text> {champEnd.d} {champEnd.h}:{champEnd.m}
                                                    </Text>
                                                </View>
                                            </View>
                                        )}

                                        {editingEvent?.id !== 'a_champ' && editingEvent?.id !== 'alliance_frost_league' && editingEvent?.id !== 'a_weapon' && (
                                            <>
                                                <View className="mb-4">
                                                    <Text className="text-brand-accent text-xs font-black mb-2 ml-1 uppercase">
                                                        {(editingEvent?.category === '연맹' && editingEvent?.id !== 'a_mercenary') ? `진행 요일 (${activeTab}군)` : '진행 요일'}
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
                                                                    <Text className={`font-black text-xs ${isSelected ? 'text-brand-dark' : 'text-slate-300'}`}>{d}</Text>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                </View>

                                                {editingEvent?.id !== 'a_center' && (
                                                    <View className="mb-4 mt-2">
                                                        <View className="flex-row items-center mb-4 gap-3">
                                                            <Text className="text-brand-accent text-[10px] font-black uppercase opacity-60">진행 시간</Text>
                                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
                                                                {(activeTab === 1 ? slots1 : slots2).map(slot => (
                                                                    <TouchableOpacity
                                                                        key={slot.id}
                                                                        onPress={() => {
                                                                            const [h, m] = slot.time.split(':');
                                                                            setEditHour(h || '22');
                                                                            setEditMinute(m || '00');
                                                                            setSelectedDayForSlot(slot.day);
                                                                        }}
                                                                        className="mr-3 bg-brand-accent/10 border border-brand-accent/20 px-3 py-1.5 rounded-xl flex-row items-center"
                                                                    >
                                                                        <Text className="text-white text-xs font-black mr-2">
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
                                                                <View className="flex-row items-center space-x-4">
                                                                    {/* Hour Picker */}
                                                                    <View className="flex-1 relative">
                                                                        <TouchableOpacity
                                                                            onPress={() => setHourDropdownVisible(!hourDropdownVisible)}
                                                                            className="bg-slate-800 p-3.5 rounded-xl border border-slate-700 flex-row justify-between items-center"
                                                                        >
                                                                            <Text className="text-white font-black">{editHour}시</Text>
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
                                                                                            <Text className={`font-bold ${editHour === h ? 'text-brand-accent' : 'text-slate-300'}`}>{h}시</Text>
                                                                                        </TouchableOpacity>
                                                                                    )}
                                                                                />
                                                                            </View>
                                                                        )}
                                                                    </View>
                                                                    <View className="w-4 items-center"><Text className="text-slate-500 font-bold">:</Text></View>
                                                                    {/* Minute Picker */}
                                                                    <View className="flex-1 relative">
                                                                        <TouchableOpacity
                                                                            onPress={() => setMinuteDropdownVisible(!minuteDropdownVisible)}
                                                                            className="bg-slate-800 p-3.5 rounded-xl border border-slate-700 flex-row justify-between items-center"
                                                                        >
                                                                            <Text className="text-white font-black">{editMinute}분</Text>
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
                                                                                            <Text className={`font-bold ${editMinute === m ? 'text-brand-accent' : 'text-slate-300'}`}>{m}분</Text>
                                                                                        </TouchableOpacity>
                                                                                    )}
                                                                                />
                                                                            </View>
                                                                        )}
                                                                    </View>
                                                                </View>

                                                                <TouchableOpacity
                                                                    onPress={addTimeSlot}
                                                                    className="bg-blue-500/20 py-3 rounded-xl border border-blue-500/40 items-center flex-row justify-center"
                                                                >
                                                                    <Ionicons name="add-circle-outline" size={20} color="#38bdf8" style={{ marginRight: 8 }} />
                                                                    <Text className="text-[#38bdf8] font-black">이 시간 추가 등록</Text>
                                                                </TouchableOpacity>
                                                            </View>
                                                        )}
                                                        {selectedDayForSlot === '상시' && (
                                                            <TouchableOpacity
                                                                onPress={addTimeSlot}
                                                                className="bg-brand-accent/20 py-4 rounded-xl border border-brand-accent/40 items-center"
                                                            >
                                                                <Text className="text-brand-accent font-black">상시 진행으로 등록</Text>
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                )}
                                            </>
                                        )}
                                    </>
                                )}
                                <View className="flex-row gap-3 pt-6 border-t border-slate-800/80 mt-6">
                                    <TouchableOpacity
                                        onPress={handleDeleteSchedule}
                                        className="flex-1 bg-slate-800 py-3.5 rounded-2xl items-center border border-red-500/20 active:bg-slate-700"
                                    >
                                        <Text className="text-red-400 font-bold text-lg">초기화</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={saveSchedule}
                                        className="flex-[2] bg-brand-accent py-3.5 rounded-2xl items-center shadow-lg shadow-brand-accent/20 active:bg-brand-accent/90"
                                    >
                                        <Text className="text-brand-dark font-black text-lg">설정 저장하기</Text>
                                    </TouchableOpacity>
                                </View>
                            </ScrollView>
                        </Pressable>
                    </Pressable>
                </Modal>

                {/* Attendee Modal */}
                <Modal visible={attendeeModalVisible} transparent animationType="slide" >
                    <View className="flex-1 bg-black/90 pt-16">
                        <View className="flex-1 bg-slate-900 rounded-t-[40px] overflow-hidden border-t border-slate-700">
                            <View className="h-16 bg-slate-800 flex-row items-center justify-between px-6 border-b border-slate-700">
                                <Text className="text-white text-xl font-black">{managedEvent?.title} 명단 관리</Text>
                                <TouchableOpacity onPress={() => setAttendeeModalVisible(false)} className="bg-slate-900 p-2 rounded-full border border-slate-700">
                                    <Ionicons name="close" size={20} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>

                            <ScrollView className="p-4">
                                {bulkAttendees.length === 0 ? (
                                    <View className="items-center justify-center py-10 opacity-50">
                                        <Ionicons name="documents-outline" size={48} color="#94a3b8" />
                                        <Text className="text-slate-400 mt-4 font-bold">등록된 참석 명단이 없습니다.</Text>
                                        <Text className="text-slate-600 text-xs mt-1">관리자가 명단을 추가하면 여기에 표시됩니다.</Text>
                                    </View>
                                ) : (
                                    bulkAttendees.map((attendee, index) => (
                                        <View
                                            key={attendee.id || index}
                                            className="mb-4 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50 relative"
                                            style={{ zIndex: bulkAttendees.length - index }}
                                        >
                                            <View className="flex-row items-center mb-3">
                                                <View className="w-8 h-8 rounded-full bg-slate-700 items-center justify-center mr-3">
                                                    <Text className="text-white font-black">{index + 1}</Text>
                                                </View>
                                                <TextInput
                                                    value={attendee.name}
                                                    onChangeText={(v) => updateAttendeeField(attendee.id!, 'name', v)}
                                                    placeholder="영주 이름 입력"
                                                    placeholderTextColor="#64748b"
                                                    editable={isAdmin}
                                                    className={`flex-1 bg-slate-900 p-3 rounded-xl text-white font-bold border border-slate-700 ${!isAdmin ? 'opacity-70' : ''}`}
                                                />
                                                {!!isAdmin && (
                                                    <TouchableOpacity onPress={() => deleteAttendee(attendee.id!)} className="ml-2 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
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
                                    <TouchableOpacity onPress={addAttendeeRow} className="bg-slate-800 p-4 rounded-2xl border border-slate-700 border-dashed items-center mb-10 mt-4">
                                        <Text className="text-slate-400 font-bold">+ 영주 추가하기</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>

                            <View className="p-6 bg-slate-900 border-t border-slate-800">
                                {isAdmin ? (
                                    <TouchableOpacity onPress={saveAttendees} className="bg-blue-600 w-full py-4 rounded-2xl items-center shadow-lg shadow-blue-600/20">
                                        <Text className="text-white font-black text-lg">명단 저장 ({bulkAttendees.filter(a => a.name?.trim()).length}명)</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View className="w-full py-4 items-center">
                                        <Text className="text-slate-500 text-xs">관리자만 명단을 수정할 수 있습니다.</Text>
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
                                <Text className="text-white font-bold mr-2">🌐 WIKI</Text>
                                <Text className="text-slate-400 text-xs truncate flex-1" numberOfLines={1}>{currentWikiUrl}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setBrowserVisible(false)}
                                className="bg-slate-700 px-4 py-2 rounded-lg hover:bg-slate-600"
                            >
                                <Text className="text-white font-bold text-sm">닫기 ✖️</Text>
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
            </View>
        </ImageBackground>
    );
}
