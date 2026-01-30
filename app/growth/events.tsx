import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, Modal, TextInput, Alert, FlatList } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import { getGuideContent } from '../../data/event-guides';
import { Attendee, INITIAL_ATTENDEES } from '../../data/mock-attendees';
import { useFirestoreAttendees } from '../../hooks/useFirestoreAttendees';
import { useFirestoreEventSchedules } from '../../hooks/useFirestoreEventSchedules';
import heroesData from '../../data/heroes.json';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

const HERO_NAMES = heroesData.map(h => h.name);

type EventCategory = '전체' | '개인' | '연맹' | '초보자';

interface WikiEvent {
    id: string;
    title: string;
    category: EventCategory;
    wikiUrl: string;
    imageUrl?: string;
    day: string; // Event Day (e.g., 월, 화, 수...)
    time: string; // Event Time (e.g., 11:00)
    description: string;
    strategy?: string; // Alliance Strategy content
}

const INITIAL_WIKI_EVENTS: WikiEvent[] = [
    // Personal Events (개인)
    { id: 'p1', title: '설국 사진첩', category: '개인', day: '월', time: '10:00', description: '추억을 모아 보상을 받으세요.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ec%84%a4%ec%9b%90-%eb%8c%80%eb%aa%a8%ed%97%98/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/10/IMG_1010.png' },
    { id: 'p2', title: '야수 처치', category: '개인', day: '화', time: '12:00', description: '강력한 야수를 소탕하고 평화를 찾으세요.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ec%95%bc%ec%88%98-%ec%b2%98%ec%b9%98/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/08/%E6%B8%85%E7%90%86%E9%87%8E%E5%85%BD.png' },
    { id: 'p3', title: '설원 대모험', category: '개인', day: '수', time: '14:00', description: '주사위를 굴려 보물을 찾으세요.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ec%84%a4%ec%9b%90-%eb%8c%80%eb%aa%a8%ed%97%98/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/03/item_icon_620119.png' },
    { id: 'p4', title: '은조개 이벤트', category: '개인', day: '목', time: '16:00', description: '바다의 보물 은조개를 모으세요.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ec%9d%80%ec%a1%b0%ea%b0%9c-%ec%9d%b4%eb%b2%a4%ed%8a%b8/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/07/item_icon_620166.png' },
    { id: 'p5', title: '빙원으로 복귀', category: '개인', day: '금', time: '18:00', description: '떠났던 영주들을 위한 특별 보상.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%eb%b9%99%ec%9b%90%ec%9c%bc%eb%a1%9c-%eb%b3%b5%ea%b7%80/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/10/16103410/20250516-182834.png' },
    { id: 'p6', title: '낚시 선수권 대회', category: '개인', day: '토', time: '20:00', description: '최고의 낚시꾼에게 주어지는 영예.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%eb%82%9a%ec%8b%9c-%ec%84%a0%ec%88%98%ea%b6%8c-%eb%8c%80%ed%9a%8c/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/21123327/jump_icon_40179.png' },
    { id: 'p7', title: '제설 특공대', category: '개인', day: '월', time: '09:00', description: '도시의 눈을 치워 시민들을 안전하게.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ec%a0%9c%ec%84%a4-%ed%8a%b9%ea%b3%b5%eb%8c%80/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/07/snowbusters-event-150x150.png' },
    { id: 'p8', title: '새벽의 희망', category: '개인', day: '화', time: '11:00', description: '새로운 시대를 여는 희망의 빛.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ec%83%88%eb%b2%bd%ec%9d%98-%ed%9d%ac%eb%a7%9d/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/22083815/%E9%BB%8E%E6%98%8E%E7%9A%84%E6%84%BF%E6%99%AF.png' },
    { id: 'p9', title: '설원 거래소', category: '개인', day: '수', time: '13:00', description: '다양한 아이템을 교환하세요.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ec%84%a4%ec%9b%90-%ea%b1%b0%eb%9e%98%ec%86%8c/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/21152458/jump_icon_40160.png' },
    { id: 'p10', title: '개혁의 악장', category: '개인', day: '목', time: '15:00', description: '기술 개혁을 향한 리듬.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ea%b0%9c%ed%98%81%ec%9d%98-%ec%95%85%ec%9e%a5/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/11/15105033/%E5%8F%98%E9%9D%A9%E7%9A%84%E4%B9%90%E7%AB%A0-150x150.png' },
    { id: 'p11', title: '불의 수정 활성화', category: '개인', day: '금', time: '17:00', description: '고대 에너지 불의 수정을 깨우세요.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%eb%b6%88%ec%9d%98-%ec%88%98%ec%a0%95-%ed%99%9c%ec%84%b1%ed%99%94/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/11/15105148/%E7%81%AB%E6%99%B6%E6%BF%80%E6%B4%BB%E8%AE%A1%E5%88%92.png' },
    { id: 'p12', title: '미야의 점집', category: '개인', day: '토', time: '19:00', description: '행운의 점괘를 확인해 보세요.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%eb%af%b8%ec%95%bc%ec%9d%98-%ec%a0%90%ec%a7%91/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/10/16082554/%E7%B1%B3%E5%A8%85%E7%9A%84%E8%AE%B8%E6%84%BF%E5%B0%8F%E5%B1%8B.png' },
    { id: 'p13', title: '빛을 쫓는 여행', category: '개인', day: '일', time: '21:00', description: '미지의 세계로 떠나는 눈부신 여정.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/24065/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/06/item_icon_700021.png' },
    { id: 'p14', title: '비보 사냥꾼', category: '개인', day: '월', time: '11:00', description: '희귀한 보물을 찾아 떠나는 모험.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%eb%b9%84%eb%b3%b4-%ec%82%ac%eb%83%a5%ea%be%bc/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/07/15094132/%E7%A7%98%E5%AE%9D%E7%8C%8E%E4%BA%BA.png' },
    { id: 'p15', title: '전군 참전', category: '개인', day: '화', time: '13:00', description: '모든 부대를 집결시켜 대공세를 전개하세요.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ec%a0%84%ea%b5%b0-%ec%b0%b8%ec%a0%84/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/22082953/%E5%85%A8%E5%86%9B%E5%8F%82%E6%88%98.png' },

    // Alliance Events (연맹)
    { id: 'a1', title: '서리 영역 병기 리그', category: '연맹', day: '일', time: '22:00', description: '연맹 간의 치열한 병기 리그전.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ec%84%9c%a6%ec%98%81%ec%97%ad-%eb%b3%91%ea%b8%b0-%eb%a6%ac%ea%b7%b8/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/10/8930473caddf3a2e-150x150.png' },
    { id: 'a2', title: '왕국 합병', category: '연맹', day: '토', time: '09:00', description: '왕국들이 하나로 합쳐지는 거대 이벤트.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ec%99%95%ea%b5%ad-%ed%95%a9%eb%b3%91/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/29152903/State-Merge.png' },
    { id: 'a3', title: '프로스트 드래곤 엠페러', category: '연맹', day: '금', time: '20:00', description: '프로스트 드래곤을 정복하고 제왕이 되세요.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ed%94%84%eb%a1%9c%ec%8a%a4%ed%8a%b8-%eb%93%9c%eb%9e%98%ea%b3%a4-%ec%97%a0%ed%8e%98%eb%9f%ac/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/26232252/Frostdragon-Tyrant-icon1-150x150.png' },
    { id: 'a4', title: '서버전 – 최강 왕국', category: '연맹', day: '일', time: '12:00', description: '다른 서버와 경쟁하여 최강의 왕국을 가리세요.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ec%84%b4%ec%9c%bc%ec%a0%84-%ec%b5%9c%ea%b0%95-%ec%99%95%ea%b5%ad/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/21145433/jump_icon_40117.png' },
    { id: 'a5', title: '연맹 총동원', category: '연맹', day: '월', time: '00:00', description: '연맹원 모두가 힘을 합쳐 미션을 완료하세요.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ec%97%b0%eb%a7%b9-%ec%b4%9d%eb%8f%99%ec%9b%90/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/22084100/%E8%81%94%E7%9B%9F%E6%80%BB%E5%8A%A8%E5%91%98.png' },
    { id: 'a8', title: '곰 사냥 작전', category: '연맹', day: '수', time: '21:00', description: '연맹원들과 함께 거대 곰을 사냥하세요.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ea%b3%b0-%ec%82%ac%eb%83%a5-%ec%9e%a1%ec%a0%84/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/21150133/jump_icon_40088.png' },
    { id: 'a9', title: '미치광이 조이', category: '연맹', day: '목', time: '20:00', description: '연맹 영지를 침공하는 조이를 막아내세요.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%eb%af%b8%ec%b9%98%ea%b4%91%ec%9d%b4-%ec%a1%b0%ec%9d%b4/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/05/21144421/jump_icon_40086.png' },

    // Rookie Events (초보자)
    { id: 'r1', title: '새벽의 여정', category: '초보자', day: '매일', time: '상설', description: '초보 영주님들을 위한 성장 가이드 여정.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ec%83%88%eb%b2%bd%ec%97%ac%ec%a0%95/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/09/%E7%A0%B4%E6%99%93%E7%9A%84%E5%BE%81%E7%A8%8B.png' },
    { id: 'r2', title: '설원의 별', category: '초보자', day: '매일', time: '상설', description: '빛나는 설원의 별이 되어보세요.', wikiUrl: 'https://www.whiteoutsurvival.wiki/ko/events/%ec%84%a4%ec%9b%90%ec%9d%98-%eb%b3%84/', imageUrl: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/06/%D9%86%D8%AC%D9%85%D8%A9-%D8%A7%D9%84%D8%AD%D9%82%D9%84-%D8%A7%D9%84%D8%AB%D9%84%D8%AC%D9%8A.png' },
];

// Mini Hero Picker Component
const HeroPicker = ({ value, onSelect, label }: { value: string, onSelect: (v: string) => void, label: string }) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [search, setSearch] = useState(value);

    React.useEffect(() => {
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
                    onSelect(v); // Allow free text input
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
    const [selectedCategory, setSelectedCategory] = useState<EventCategory>('전체');
    const [events, setEvents] = useState<WikiEvent[]>(INITIAL_WIKI_EVENTS.map(e => ({ ...e, day: '', time: '' })));
    const { auth } = useAuth();
    const router = useRouter();

    // Firebase Event Schedules
    const { schedules, loading: schedulesLoading, saveSchedules } = useFirestoreEventSchedules();



    // Merge Firebase schedules with initial events
    React.useEffect(() => {
        if (!schedulesLoading && schedules.length > 0) {
            const mergedEvents = INITIAL_WIKI_EVENTS.map(event => {
                const savedSchedule = schedules.find(s => s.eventId === event.id);
                if (savedSchedule) {
                    return {
                        ...event,
                        day: savedSchedule.day,
                        time: savedSchedule.time,
                        strategy: savedSchedule.strategy || event.strategy
                    };
                }
                return { ...event, day: '', time: '' };
            });
            setEvents(mergedEvents);
        }
    }, [schedules, schedulesLoading]);

    // Scheduling Modal
    const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
    const [editingEvent, setEditingEvent] = useState<WikiEvent | null>(null);
    const [editDays, setEditDays] = useState<string[]>([]);
    const [editHour, setEditHour] = useState('11');
    const [editMinute, setEditMinute] = useState('00');
    const [isPermanent, setIsPermanent] = useState(false);
    const [hourDropdownVisible, setHourDropdownVisible] = useState(false);
    const [minuteDropdownVisible, setMinuteDropdownVisible] = useState(false);

    // Day-specific time settings
    const [selectedDayToEdit, setSelectedDayToEdit] = useState<string | null>(null);
    const [daySpecificTimes, setDaySpecificTimes] = useState<{ [key: string]: string }>({});

    const updateTimeForSelectedDay = (h: string, m: string) => {
        setEditHour(h);
        setEditMinute(m);
        if (selectedDayToEdit) {
            setDaySpecificTimes(prev => {
                const newTimes = { ...prev };
                const newTime = `${h}:${m}`;
                newTimes[selectedDayToEdit] = newTime;

                // Smart Batch: Also update other days that are currently at default 22:00
                // This helps user set time for multiple days at once easily
                editDays.forEach(day => {
                    const currentTime = prev[day] || '22:00';
                    if (currentTime === '22:00' && day !== selectedDayToEdit) {
                        newTimes[day] = newTime;
                    }
                });
                return newTimes;
            });
        }
    };

    // Guide Popup Modal
    const [guideModalVisible, setGuideModalVisible] = useState(false);
    const [selectedEventForGuide, setSelectedEventForGuide] = useState<WikiEvent | null>(null);

    const [isEditingStrategy, setIsEditingStrategy] = useState(false);
    const [strategyContent, setStrategyContent] = useState('');
    const isAdmin = auth.isLoggedIn && (auth.adminName?.includes('관리자') || auth.adminName?.toLowerCase().includes('admin')); // Check role based on name


    const saveStrategy = async (targetEvent: WikiEvent) => {
        if (targetEvent) {
            // Update local state first
            const updatedEvents = events.map(e =>
                e.id === targetEvent.id ? { ...e, strategy: strategyContent } : e
            );
            setEvents(updatedEvents);
            setSelectedEventForGuide({ ...targetEvent, strategy: strategyContent }); // Update modal state too

            // Save to Firestore
            try {
                const updatedSchedules = schedules.filter(s => s.eventId !== targetEvent.id);
                updatedSchedules.push({
                    eventId: targetEvent.id,
                    day: targetEvent.day,
                    time: targetEvent.time,
                    strategy: strategyContent
                });

                await saveSchedules(updatedSchedules);

                setIsEditingStrategy(false);
                Alert.alert('완료', '연맹 작전이 저장되었습니다.');
            } catch (error: any) {
                Alert.alert('오류', '저장 실패: ' + error.message);
            }
        }
    };

    // Attendee Management Modal
    const [attendeeModalVisible, setAttendeeModalVisible] = useState(false);
    const [managedEvent, setManagedEvent] = useState<WikiEvent | null>(null);
    const { attendees: firestoreAttendees, loading: firestoreLoading, saveAttendeesToFirestore } = useFirestoreAttendees(managedEvent?.id);

    const [bulkAttendees, setBulkAttendees] = useState<Partial<Attendee>[]>([]);

    React.useEffect(() => {
        if (firestoreAttendees && firestoreAttendees.length > 0) {
            setBulkAttendees(JSON.parse(JSON.stringify(firestoreAttendees)));
        } else if (managedEvent) {
            // If no data in firestore (and we are managing an event), init with empty row.
            // But careful not to overwrite if user is typing (this effect runs on update).
            // Actually, this effect runs when firestoreAttendees changes.
            // We should only overwrite if we just opened the modal (handled by initial state?)
            // Better strategy: sync one way on load, then local state takes over until save.
            // But realtime sync means we should reflect changes from others.
            // For simplicity in this "edit mode": we load once.
            // If we want realtime collaboration, it's tricker with local state edits.
            // let's trust the hook updates for now.
            setBulkAttendees(firestoreAttendees.length > 0 ? JSON.parse(JSON.stringify(firestoreAttendees)) : [{ id: Date.now().toString(), name: '', hero1: '', hero2: '', hero3: '' }]);
        }
    }, [firestoreAttendees, managedEvent]);

    const filteredEvents = selectedCategory === '전체'
        ? events
        : events.filter(e => e.category === selectedCategory);

    const openScheduleModal = (event: WikiEvent) => {
        setEditingEvent(event);

        let initialDays: string[] = [];
        let initialTimes: { [key: string]: string } = {};

        // Parse complex schedule format: "월(10:00), 수(14:00)"
        if (event.day.includes('(') && event.day.includes(')')) {
            const parts = event.day.split(',').map(s => s.trim());
            parts.forEach(p => {
                const match = p.match(/([^(]+)\(([^)]+)\)/);
                if (match) {
                    const d = match[1].trim();
                    const t = match[2].trim();
                    initialDays.push(d);
                    initialTimes[d] = t;
                }
            });
            setIsPermanent(false);
        } else {
            // Standard format
            if (event.day === '매일' || event.day === '상설') {
                initialDays = [event.day];
            } else {
                initialDays = (event.day || '').split(',').map(d => d.trim()).filter(Boolean);
            }

            // Init times for standard format
            if (event.time === '상설') {
                setIsPermanent(true);
            } else {
                setIsPermanent(false);
                const t = event.time || '22:00';
                initialDays.forEach(d => {
                    initialTimes[d] = t;
                });
            }
        }

        setEditDays(initialDays);
        setDaySpecificTimes(initialTimes);

        // Select first day by default for editing
        if (initialDays.length > 0) {
            const firstDay = initialDays[0];
            setSelectedDayToEdit(firstDay);
            const t = initialTimes[firstDay] || '22:00';
            const [h, m] = t.split(':');
            setEditHour(h || '22');
            setEditMinute(m || '00');
        } else {
            setSelectedDayToEdit(null);
            setEditHour('22');
            setEditMinute('00');
        }

        setScheduleModalVisible(true);
    };

    const toggleDay = (day: string) => {
        if (day === '매일' || day === '상설') {
            setEditDays([day]);
            setSelectedDayToEdit(day);
            setDaySpecificTimes({ [day]: '22:00' });
            setEditHour('22');
            setEditMinute('00');
            return;
        }

        let newDays = editDays.filter(d => d !== '매일' && d !== '상설');
        let newTimes = { ...daySpecificTimes };

        if (newDays.includes(day)) {
            newDays = newDays.filter(d => d !== day);
            delete newTimes[day];
            if (selectedDayToEdit === day) {
                if (newDays.length > 0) {
                    setSelectedDayToEdit(newDays[0]);
                    const [h, m] = (newTimes[newDays[0]] || '22:00').split(':');
                    setEditHour(h);
                    setEditMinute(m);
                } else {
                    setSelectedDayToEdit(null);
                }
            }
        } else {
            newDays = [...newDays, day];
            newTimes[day] = '22:00'; // Always default to 22:00 for new day
            setSelectedDayToEdit(day);
            setEditHour('22');
            setEditMinute('00');
        }
        setEditDays(newDays.length > 0 ? newDays : []);
        setDaySpecificTimes(newTimes);
    };

    const openGuideModal = (event: WikiEvent) => {
        setSelectedEventForGuide(event);
        setStrategyContent(event.strategy || '');
        setIsEditingStrategy(false);
        setGuideModalVisible(true);
    };

    const openAttendeeModal = (event: WikiEvent) => {
        setManagedEvent(event);
        // Data loading handled by useEffect and hook
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

        // 데이터 포맷팅: 시간이 모두 같으면 "월, 수" / "10:00" 형식, 다르면 "월(10:00), 수(12:00)" 방식
        let finalDay = '';
        let finalTime = '';

        if (isPermanent) {
            finalDay = editDays.join(',');
            finalTime = '상설';
        } else {
            // Check if all times are same
            const distinctTimes = new Set(Object.values(daySpecificTimes));
            if (distinctTimes.size <= 1) {
                finalDay = editDays.join(', ');
                finalTime = daySpecificTimes[editDays[0]] || `${editHour}:${editMinute}`;
            } else {
                // Different times -> Combine into day string
                const parts: string[] = [];
                // Sort days based on standard week order if needed, currently insertion order
                editDays.forEach(d => {
                    const t = daySpecificTimes[d] || '22:00';
                    parts.push(`${d}(${t})`);
                });
                finalDay = parts.join(', ');
                finalTime = ''; // Hide time display as it is embedded in day
            }
        }

        // Update local state
        setEvents(events.map(e => e.id === editingEvent.id ? { ...e, day: finalDay, time: finalTime } : e));

        // Save to Firebase
        try {
            const updatedSchedules = schedules.filter(s => s.eventId !== editingEvent.id);
            updatedSchedules.push({
                eventId: editingEvent.id,
                day: finalDay,
                time: finalTime,
                strategy: editingEvent.strategy // Preserve existing strategy
            });
            setScheduleModalVisible(false); // Close immediately for better UX
            await saveSchedules(updatedSchedules);
            // Alert removed as per user request for smoother flows
        } catch (error: any) {
            Alert.alert('오류', '일정 저장 중 문제가 발생했습니다: ' + error.message);
        }
    };

    const guideContent = selectedEventForGuide ? getGuideContent(selectedEventForGuide.id) : null;

    return (
        <View className="flex-1 bg-brand-dark">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="pt-16 pb-6 px-6 bg-brand-header border-b border-slate-900">
                <View className="flex-row items-center justify-between mb-6">
                    <Text className="text-white text-3xl font-black tracking-tighter">이벤트 스케줄</Text>
                    {/* Admin toggle removed */}
                    <TouchableOpacity
                        onPress={() => router.replace('/')}
                        className="flex-row items-center bg-white/5 px-4 py-2 rounded-xl border border-white/10"
                    >
                        <Ionicons name="home-outline" size={18} color="#FFD700" className="mr-2" />
                        <Text className="text-white font-black text-xs">뒤로가기</Text>
                    </TouchableOpacity>
                </View>

                {/* Category Filter */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
                    {(['전체', '개인', '연맹', '초보자'] as EventCategory[]).map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            onPress={() => setSelectedCategory(cat)}
                            className={`px-8 py-2.5 rounded-full mr-3 border ${selectedCategory === cat ? 'bg-brand-accent border-brand-accent' : 'bg-slate-800/60 border-slate-700'}`}
                        >
                            <Text className={`font-black text-xs ${selectedCategory === cat ? 'text-brand-dark' : 'text-slate-300'}`}>
                                {cat}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Event List */}
            <ScrollView className="flex-1 p-6">
                {filteredEvents.map((event) => (
                    <View
                        key={event.id}
                        className="mb-4 bg-slate-900/60 rounded-3xl border border-slate-800 p-5"
                    >
                        <View>
                            {/* Top: Thumbnail & Info */}
                            <View className="flex-row items-center mb-4">
                                <View className="w-14 h-14 rounded-xl overflow-hidden bg-slate-800 mr-4 border border-slate-700">
                                    {event.imageUrl ? (
                                        <ImageBackground source={{ uri: event.imageUrl }} className="w-full h-full" resizeMode="cover" />
                                    ) : (
                                        <View className="w-full h-full items-center justify-center">
                                            <Text className="text-xl">📅</Text>
                                        </View>
                                    )}
                                </View>
                                <View className="flex-1">
                                    <Text className="text-white text-lg font-black tracking-tighter" numberOfLines={1}>{event.title}</Text>
                                    <View className="mt-1 flex-row flex-wrap items-center">
                                        {(event.day || event.time) && (
                                            <>
                                                {event.day ? (
                                                    <View className="px-1.5 py-0.5 bg-brand-accent/20 rounded-md border border-brand-accent/30 mr-2 mb-1">
                                                        <Text className="text-brand-accent text-[9px] font-black">{event.day}</Text>
                                                    </View>
                                                ) : null}
                                                <Text className="text-slate-400 text-[10px] font-black mb-1">{event.time}</Text>
                                            </>
                                        )}
                                    </View>
                                </View>
                            </View>

                            {/* Bottom: Action Buttons */}
                            <View className="flex-row items-center space-x-2 pt-4 border-t border-slate-800/50">
                                <TouchableOpacity
                                    onPress={() => openGuideModal(event)}
                                    className="flex-1 h-10 bg-brand-accent/10 rounded-xl border border-brand-accent/20 justify-center items-center"
                                >
                                    <Text className="text-brand-accent text-xs font-black" numberOfLines={1}>📘 가이드</Text>
                                </TouchableOpacity>

                                {event.category === '연맹' && (
                                    <TouchableOpacity
                                        onPress={() => openAttendeeModal(event)}
                                        className="flex-1 h-10 bg-blue-500/10 rounded-xl border border-blue-500/20 justify-center items-center"
                                    >
                                        <Text className="text-blue-400 text-xs font-black" numberOfLines={1}>{auth.isLoggedIn ? '참석 관리' : '👥 참석'}</Text>
                                    </TouchableOpacity>
                                )}

                                {auth.isLoggedIn && (
                                    <TouchableOpacity
                                        onPress={() => openScheduleModal(event)}
                                        className="flex-1 h-10 bg-slate-800 rounded-xl border border-slate-700 justify-center items-center"
                                    >
                                        <Text className="text-slate-400 text-xs font-black" numberOfLines={1}>⚙️ 수정</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    </View>
                ))}
                <View className="h-20" />
            </ScrollView>

            {/* Guide Detail Popup Modal */}
            <Modal visible={guideModalVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/90 justify-center items-center p-6">
                    <TouchableOpacity
                        activeOpacity={1}
                        onPress={() => setGuideModalVisible(false)}
                        className="absolute inset-0"
                    />
                    <View className="bg-slate-900 w-full max-h-[85%] rounded-[40px] border border-slate-800 overflow-hidden shadow-2xl">
                        {selectedEventForGuide?.imageUrl ? (
                            <ImageBackground
                                source={{ uri: selectedEventForGuide.imageUrl }}
                                className="h-44 w-full"
                            >
                                <BlurView intensity={20} className="absolute inset-0 bg-black/40" />
                                <View className="absolute bottom-6 px-8">
                                    <Text className="text-brand-accent text-[10px] font-black uppercase mb-1 tracking-widest">{selectedEventForGuide?.category} 이벤트 가이드</Text>
                                    <Text className="text-white text-3xl font-black tracking-tighter">{selectedEventForGuide?.title}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setGuideModalVisible(false)}
                                    className="absolute top-8 right-6 w-10 h-10 rounded-full bg-black/40 items-center justify-center border border-white/20"
                                >
                                    <Text className="text-white font-bold text-lg">✕</Text>
                                </TouchableOpacity>
                            </ImageBackground>
                        ) : (
                            <View className="h-44 w-full bg-slate-900">
                                <View className="absolute bottom-6 px-8">
                                    <Text className="text-brand-accent text-[10px] font-black uppercase mb-1 tracking-widest">{selectedEventForGuide?.category} 이벤트 가이드</Text>
                                    <Text className="text-white text-3xl font-black tracking-tighter">{selectedEventForGuide?.title}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => setGuideModalVisible(false)}
                                    className="absolute top-8 right-6 w-10 h-10 rounded-full bg-black/40 items-center justify-center border border-white/20"
                                >
                                    <Text className="text-white font-bold text-lg">✕</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <ScrollView className="p-8">
                            <View className="flex-row items-center mb-4">
                                <View className="w-1.5 h-6 bg-brand-accent rounded-full mr-3" />
                                <Text className="text-brand-accent text-sm font-black uppercase tracking-widest">이벤트 개요</Text>
                            </View>
                            <View className="bg-slate-800/40 p-6 rounded-[24px] mb-8 border border-slate-700/30">
                                <Text className="text-slate-300 text-base font-bold leading-7">{guideContent?.overview}</Text>
                            </View>

                            {/* Alliance Strategy Section (Merged) */}
                            {selectedEventForGuide?.category === '연맹' && (
                                <View className="mb-8 p-1">
                                    <View className="flex-row items-center mb-4 justify-between">
                                        <View className="flex-row items-center">
                                            <View className="w-1.5 h-6 bg-purple-500 rounded-full mr-3" />
                                            <Text className="text-purple-400 text-sm font-black uppercase tracking-widest">연맹 작전 지시</Text>
                                        </View>
                                        {isAdmin && !isEditingStrategy && (
                                            <TouchableOpacity onPress={() => setIsEditingStrategy(true)} className="bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                                                <Text className="text-slate-400 text-[10px] font-bold">수정</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <View className={`rounded-[24px] border ${isAdmin && isEditingStrategy ? 'border-purple-500/50 bg-slate-900' : 'border-purple-500/20 bg-purple-500/5'} overflow-hidden`}>
                                        {isAdmin && isEditingStrategy ? (
                                            <View className="p-4">
                                                <TextInput
                                                    multiline
                                                    value={strategyContent}
                                                    onChangeText={setStrategyContent}
                                                    className="text-slate-200 text-base leading-7 min-h-[100px] mb-4"
                                                    placeholder="연맹원들에게 전달할 작전을 입력하세요..."
                                                    placeholderTextColor="#64748b"
                                                    style={{ textAlignVertical: 'top' }}
                                                />
                                                <View className="flex-row justify-end space-x-2">
                                                    <TouchableOpacity onPress={() => { setIsEditingStrategy(false); setStrategyContent(selectedEventForGuide.strategy || ''); }} className="bg-slate-800 px-4 py-2 rounded-xl">
                                                        <Text className="text-slate-400 font-bold text-xs">취소</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => saveStrategy(selectedEventForGuide)} className="bg-purple-500 px-4 py-2 rounded-xl shadow-lg shadow-purple-500/20">
                                                        <Text className="text-white font-bold text-xs">저장</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ) : (
                                            <View className="p-6">
                                                <Text className="text-slate-200 text-base font-bold leading-7">
                                                    {selectedEventForGuide?.strategy || '🥶 현재 등록된 작전 지시가 없습니다.'}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )}



                            <View className="flex-row items-center mb-4">
                                <View className="w-1.5 h-6 bg-brand-accent rounded-full mr-3" />
                                <Text className="text-brand-accent text-sm font-black uppercase tracking-widest">실전 진행 방식</Text>
                            </View>
                            {guideContent?.howToPlay.map((item, idx) => (
                                <View key={idx} className="bg-slate-800/40 p-5 rounded-[20px] mb-3 border border-slate-700/50 flex-row items-start">
                                    <Text className="text-brand-accent font-black mr-3 mt-0.5">{idx + 1}.</Text>
                                    <Text className="text-slate-200 text-base font-bold leading-7 flex-1">{item.text}</Text>
                                </View>
                            ))}

                            <View className="flex-row items-center mt-8 mb-4">
                                <View className="w-1.5 h-6 bg-brand-accent rounded-full mr-3" />
                                <Text className="text-brand-accent text-sm font-black uppercase tracking-widest">영주 공략 팁 (Pro-Tips)</Text>
                            </View>
                            <View className="bg-slate-900/40 p-6 rounded-[24px] border border-brand-accent/10">
                                {guideContent?.tips.map((tip, idx) => (
                                    <View key={idx} className="flex-row items-start mb-3">
                                        <Text className="text-brand-accent mr-3 mt-1">❄️</Text>
                                        <Text className="text-slate-400 text-base font-bold leading-7 flex-1">{tip}</Text>
                                    </View>
                                ))}
                            </View>
                            <View className="h-10" />
                        </ScrollView>

                        <TouchableOpacity
                            onPress={() => setGuideModalVisible(false)}
                            className="bg-brand-accent m-8 py-5 rounded-2xl items-center shadow-lg shadow-brand-accent/20"
                        >
                            <Text className="text-brand-dark font-black text-lg">가이드를 확인했습니다</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal >

            {/* Schedule Edit Modal */}
            < Modal visible={scheduleModalVisible} transparent animationType="slide" >
                <View className="flex-1 bg-black/80 justify-end">
                    <View className="bg-slate-900 p-8 rounded-t-[40px] border-t border-slate-800">
                        <View className="flex-row justify-between items-start mb-6">
                            <View>
                                <Text className="text-white text-2xl font-black mb-2">{editingEvent?.title}</Text>
                                <Text className="text-slate-400 text-sm font-bold">이벤트 진행 요일과 시간을 설정하세요.</Text>
                            </View>
                            <TouchableOpacity onPress={() => setScheduleModalVisible(false)} className="bg-slate-800 p-2 rounded-full border border-slate-700">
                                <Text className="text-slate-400 font-bold">✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View className="space-y-6 mb-10">
                            <View>
                                <Text className="text-brand-accent text-xs font-black mb-3 ml-1 uppercase">진행 요일 (다중 선택 가능)</Text>
                                <View className="flex-row flex-wrap">
                                    {['월', '화', '수', '목', '금', '토', '일', '매일', '상설'].map((d) => (
                                        <TouchableOpacity
                                            key={d}
                                            onPress={() => toggleDay(d)}
                                            className={`w-10 h-10 rounded-xl items-center justify-center mr-2 mb-2 border ${editDays.includes(d) ? 'bg-brand-accent border-brand-accent' : 'bg-slate-800/60 border-slate-700'}`}
                                        >
                                            <Text className={`font-black text-xs ${editDays.includes(d) ? 'text-brand-dark' : 'text-slate-300'}`}>{d}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            <View>
                                <View className="flex-row justify-between items-center mb-3 ml-1">
                                    <Text className="text-brand-accent text-xs font-black uppercase">진행 시간 ({selectedDayToEdit || '선택 안됨'})</Text>
                                    <TouchableOpacity
                                        onPress={() => setIsPermanent(!isPermanent)}
                                        className={`px-3 py-1 rounded-full border ${isPermanent ? 'bg-brand-accent border-brand-accent' : 'border-slate-700'}`}
                                    >
                                        <Text className={`text-[10px] font-black ${isPermanent ? 'text-brand-dark' : 'text-slate-500'}`}>상설 고정</Text>
                                    </TouchableOpacity>
                                </View>

                                {!isPermanent && (
                                    <>
                                        {/* Day Selector Tabs */}
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                                            {editDays.map(d => (
                                                <TouchableOpacity
                                                    key={d}
                                                    onPress={() => {
                                                        setSelectedDayToEdit(d);
                                                        const t = daySpecificTimes[d] || '11:00';
                                                        const [h, m] = t.split(':');
                                                        setEditHour(h);
                                                        setEditMinute(m);
                                                    }}
                                                    className={`mr-2 px-3 py-1.5 rounded-lg border ${selectedDayToEdit === d ? 'bg-slate-700 border-slate-600' : 'bg-transparent border-slate-800'}`}
                                                >
                                                    <Text className={`text-xs font-bold ${selectedDayToEdit === d ? 'text-white' : 'text-slate-500'}`}>
                                                        {d} <Text className="text-brand-accent">{daySpecificTimes[d]}</Text>
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>

                                        {selectedDayToEdit && (
                                            <View className="flex-row items-center space-x-4">
                                                <View className="flex-1 relative">
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            setHourDropdownVisible(!hourDropdownVisible);
                                                            setMinuteDropdownVisible(false);
                                                        }}
                                                        className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-row justify-between items-center"
                                                    >
                                                        <Text className="text-white font-black">{editHour}시</Text>
                                                        <Text className="text-slate-500 text-xs">{hourDropdownVisible ? '▲' : '▼'}</Text>
                                                    </TouchableOpacity>

                                                    {hourDropdownVisible && (
                                                        <View className="absolute bottom-16 left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl h-48 overflow-hidden z-50 shadow-2xl">
                                                            <FlatList
                                                                data={Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))}
                                                                keyExtractor={(item) => item}
                                                                initialScrollIndex={parseInt(editHour) || 0}
                                                                getItemLayout={(data, index) => (
                                                                    { length: 50, offset: 50 * index, index }
                                                                )}
                                                                renderItem={({ item: h }) => (
                                                                    <TouchableOpacity
                                                                        onPress={() => {
                                                                            updateTimeForSelectedDay(h, editMinute);
                                                                            setHourDropdownVisible(false);
                                                                        }}
                                                                        className={`h-[50px] justify-center px-4 border-b border-slate-800/50 ${editHour === h ? 'bg-brand-accent/10' : ''}`}
                                                                    >
                                                                        <Text className={`font-bold ${editHour === h ? 'text-brand-accent' : 'text-slate-300'}`}>{h}시</Text>
                                                                    </TouchableOpacity>
                                                                )}
                                                            />
                                                        </View>
                                                    )}
                                                </View>

                                                <Text className="text-white font-black">:</Text>

                                                <View className="flex-1 relative">
                                                    <TouchableOpacity
                                                        onPress={() => {
                                                            setMinuteDropdownVisible(!minuteDropdownVisible);
                                                            setHourDropdownVisible(false);
                                                        }}
                                                        className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-row justify-between items-center"
                                                    >
                                                        <Text className="text-white font-black">{editMinute}분</Text>
                                                        <Text className="text-slate-500 text-xs">{minuteDropdownVisible ? '▲' : '▼'}</Text>
                                                    </TouchableOpacity>

                                                    {minuteDropdownVisible && (
                                                        <View className="absolute bottom-16 left-0 right-0 bg-slate-900 border border-slate-700 rounded-xl max-h-48 overflow-hidden z-50 shadow-2xl">
                                                            <ScrollView nestedScrollEnabled>
                                                                {['00', '10', '20', '30', '40', '50'].map((m) => (
                                                                    <TouchableOpacity
                                                                        key={m}
                                                                        onPress={() => {
                                                                            updateTimeForSelectedDay(editHour, m);
                                                                            setMinuteDropdownVisible(false);
                                                                        }}
                                                                        className={`p-4 border-b border-slate-800/50 ${editMinute === m ? 'bg-brand-accent/10' : ''}`}
                                                                    >
                                                                        <Text className={`font-bold ${editMinute === m ? 'text-brand-accent' : 'text-slate-300'}`}>{m}분</Text>
                                                                    </TouchableOpacity>
                                                                ))}
                                                            </ScrollView>
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        )}
                                    </>
                                )}
                            </View>
                        </View>

                        <View className="flex-row space-x-3">
                            <TouchableOpacity onPress={() => setScheduleModalVisible(false)} className="flex-1 bg-slate-800 py-5 rounded-2xl">
                                <Text className="text-slate-400 text-center font-black">취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={saveSchedule} className="flex-1 bg-brand-accent py-5 rounded-2xl">
                                <Text className="text-brand-dark text-center font-black">일정 저장</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal >

            {/* Attendee Management Bulk Modal */}
            < Modal visible={attendeeModalVisible} transparent animationType="slide" >
                <View className="flex-1 bg-black/80 justify-end">
                    <View className="bg-slate-900 h-[80%] rounded-t-[40px] border-t border-slate-800 overflow-hidden">
                        <View className="p-8 border-b border-slate-800 flex-row justify-between items-center">
                            <View>
                                <Text className="text-white text-2xl font-black mb-1">{managedEvent?.title}</Text>
                                <Text className="text-slate-400 text-xs font-bold uppercase tracking-widest">참석자 및 영웅 조합 등록</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setAttendeeModalVisible(false)}
                                className="w-10 h-10 rounded-full bg-slate-800 items-center justify-center border border-slate-700"
                            >
                                <Text className="text-white font-bold">✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView className="flex-1 p-6" showsVerticalScrollIndicator={false}>
                            {auth.isLoggedIn ? (
                                // Admin Mode: Edit Form
                                <>
                                    {bulkAttendees.map((attendee, index) => (
                                        <View key={attendee.id} className="mb-6 bg-slate-800/40 p-5 rounded-[32px] border border-slate-700/50" style={{ zIndex: bulkAttendees.length - index }}>
                                            <View className="flex-row items-center justify-between mb-4">
                                                <View className="flex-row items-center">
                                                    <View className="w-8 h-8 rounded-full bg-brand-accent items-center justify-center mr-3">
                                                        <Text className="text-brand-dark font-black text-xs">{index + 1}</Text>
                                                    </View>
                                                    <Text className="text-slate-200 font-black text-sm">영주 정보 입력</Text>
                                                </View>
                                                {bulkAttendees.length > 1 && (
                                                    <TouchableOpacity
                                                        onPress={() => deleteAttendee(attendee.id!)}
                                                        className="bg-red-500/10 px-3 py-1.5 rounded-xl border border-red-500/20"
                                                    >
                                                        <Text className="text-red-400 text-[10px] font-black">삭제</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>

                                            <TextInput
                                                placeholder="영주 이름 (필수)"
                                                placeholderTextColor="#475569"
                                                value={attendee.name}
                                                onChangeText={(v) => updateAttendeeField(attendee.id!, 'name', v)}
                                                className="bg-slate-900/60 p-4 rounded-2xl text-white font-bold mb-4 border border-slate-700/50"
                                            />

                                            <View className="flex-row space-x-2">
                                                <HeroPicker
                                                    label="HERO 1"
                                                    value={attendee.hero1 || ''}
                                                    onSelect={(v) => updateAttendeeField(attendee.id!, 'hero1', v)}
                                                />
                                                <HeroPicker
                                                    label="HERO 2"
                                                    value={attendee.hero2 || ''}
                                                    onSelect={(v) => updateAttendeeField(attendee.id!, 'hero2', v)}
                                                />
                                                <HeroPicker
                                                    label="HERO 3"
                                                    value={attendee.hero3 || ''}
                                                    onSelect={(v) => updateAttendeeField(attendee.id!, 'hero3', v)}
                                                />
                                            </View>
                                        </View>
                                    ))}

                                    <TouchableOpacity
                                        onPress={addAttendeeRow}
                                        className="bg-slate-800 border-2 border-dashed border-slate-700 py-6 rounded-[32px] items-center mb-10"
                                    >
                                        <Text className="text-slate-400 font-black text-lg">+ 추가 참석자 등록</Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                // User Mode: Read-only List
                                <View className="pb-10">
                                    {(!firestoreAttendees || firestoreAttendees.length === 0) ? (
                                        <View className="items-center justify-center py-20">
                                            <Text className="text-slate-600 text-sm font-bold">등록된 참석자가 없습니다.</Text>
                                        </View>
                                    ) : (
                                        firestoreAttendees.map((attendee, index) => (
                                            <View key={index} className="mb-3 bg-slate-800/40 p-5 rounded-3xl border border-slate-700/50 flex-row items-center">
                                                <View className="w-10 h-10 rounded-full bg-brand-accent/10 items-center justify-center mr-4 border border-brand-accent/20">
                                                    <Text className="text-brand-accent font-black text-sm">{index + 1}</Text>
                                                </View>
                                                <View>
                                                    <Text className="text-white font-black text-lg mb-1">{attendee.name}</Text>
                                                    <Text className="text-slate-400 text-xs font-bold">
                                                        {[attendee.hero1, attendee.hero2, attendee.hero3].filter(Boolean).join('  •  ')}
                                                    </Text>
                                                </View>
                                            </View>
                                        ))
                                    )}
                                </View>
                            )}
                        </ScrollView>

                        <View className="p-8 bg-slate-900 border-t border-slate-800 flex-row space-x-3">
                            <TouchableOpacity
                                onPress={() => setAttendeeModalVisible(false)}
                                className={`flex-1 bg-slate-800 py-5 rounded-2xl ${!auth.isLoggedIn ? 'mx-8' : ''}`}
                            >
                                <Text className="text-slate-400 text-center font-black">{auth.isLoggedIn ? '취소' : '닫기'}</Text>
                            </TouchableOpacity>
                            {auth.isLoggedIn && (
                                <TouchableOpacity
                                    onPress={saveAttendees}
                                    className="flex-1 bg-brand-accent py-5 rounded-2xl shadow-lg shadow-brand-accent/20"
                                >
                                    <Text className="text-brand-dark text-center font-black">명단 저장하기</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </View>
            </Modal >

        </View >
    );
}
