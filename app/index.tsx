import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Alert, Platform, ScrollView, Switch, ImageBackground, Image, Pressable } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useAuth } from './_layout';
import { ADMIN_USERS, SUPER_ADMINS } from '../data/admin-config';
import { useFirestoreEventSchedules } from '../hooks/useFirestoreEventSchedules';
import { useFirestoreAdmins } from '../hooks/useFirestoreAdmins';
// @ts-ignore
import { useFirestoreNotice } from '../hooks/useFirestoreNotice';
import { INITIAL_WIKI_EVENTS } from '../data/wiki-events';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Home() {
    const router = useRouter();
    const { auth, login, logout } = useAuth();
    // Optional chaining in case hook is missing/error during dev
    const noticeData = useFirestoreNotice ? useFirestoreNotice() : { notice: null, saveNotice: async () => { } };
    const { notice, saveNotice } = noticeData;
    const { schedules, loading, clearAllSchedules } = useFirestoreEventSchedules();

    // -- States --
    const [loginModalVisible, setLoginModalVisible] = useState(false);
    const [loginInput, setLoginInput] = useState('');

    // Notice
    const [noticeDetailVisible, setNoticeDetailVisible] = useState(false);
    const [isLoginHovered, setIsLoginHovered] = useState(false);
    const [isInstallHovered, setIsInstallHovered] = useState(false);

    // Dynamic Admins
    const { dynamicAdmins, addAdmin, removeAdmin } = useFirestoreAdmins();
    const [newAdminName, setNewAdminName] = useState('');
    const [showAdminList, setShowAdminList] = useState(false);

    // Derived
    const isSuperAdmin = auth.isLoggedIn && auth.adminName && SUPER_ADMINS.includes(auth.adminName);

    // Load saved admin ID
    useEffect(() => {
        AsyncStorage.getItem('lastAdminId').then((savedId) => {
            if (savedId) setLoginInput(savedId);
        });
    }, []);

    // Current Time for Active Status
    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const isEventActive = (event: any) => {
        if (event.eventId === 'a_fortress' && event.time) {
            const dayMap = ['일', '월', '화', '수', '목', '금', '토'];
            const currentDayStr = dayMap[now.getDay()];
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            const regex = /([월화수목금토일])?\s*(\d{2}):(\d{2})/g;
            let match;
            while ((match = regex.exec(event.time)) !== null) {
                const [_, dayStr, hStr, mStr] = match;

                // If day specified, must match today
                if (dayStr && dayStr !== currentDayStr) continue;

                const startMinutes = parseInt(hStr) * 60 + parseInt(mStr);
                const endMinutes = startMinutes + 30; // 30 min duration

                if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
                    return true;
                }
            }
            return false;
        }

        // Special handling for Mobilization
        if ((event.eventId === 'a_mobilization' || event.eventId === 'a_castle' || event.eventId === 'a_svs' || event.eventId === 'a_operation') && event.day) {
            const parts = event.day.split('~');
            if (parts.length === 2) {
                // Formatting helper: YYYY.MM.DD HH:mm -> YYYY/MM/DD HH:mm (Cross-platform safe)
                const format = (s: string) => s.trim().replace(/\./g, '/');
                const start = new Date(format(parts[0]));
                const end = new Date(format(parts[1]));

                // If invalid date, ignore
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    return now >= start && now <= end;
                }
            }
        }

        if (!event.day) return false;

        // 1. Day Check
        const days = event.day.split(',').map((d: string) => d.trim());

        // If Permanent, always active (Ignore time)
        if (days.includes('상시') || days.includes('상설')) return true;

        if (!event.time) return false;

        const dayMap = ['일', '월', '화', '수', '목', '금', '토'];
        const currentDayStr = dayMap[now.getDay()];

        const isToday = days.includes('매일') || days.includes(currentDayStr);
        if (!isToday) return false;

        // 2. Time Check (Range: Start ~ Start + 30m)
        const timeMatches = event.time.match(/(\d{1,2}):(\d{2})/g);
        if (!timeMatches) return false;

        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        return timeMatches.some((t: string) => {
            const [h, m] = t.split(':').map(Number);
            const startMinutes = h * 60 + m;
            const endMinutes = startMinutes + 30;
            // Handle day crossing? Assuming events are within same day for now as per user request
            return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
        });
    };
    const [noticeModalVisible, setNoticeModalVisible] = useState(false);
    const [editNoticeContent, setEditNoticeContent] = useState('');
    const [editNoticeVisible, setEditNoticeVisible] = useState(true);

    const [adminMenuVisible, setAdminMenuVisible] = useState(false);
    const [installModalVisible, setInstallModalVisible] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    // -- Handlers --

    const handleLogin = async () => {
        const input = loginInput.trim();
        const isStatic = ADMIN_USERS.includes(input);
        const isDynamic = dynamicAdmins.some(a => a.name === input);

        if (isStatic || isDynamic) {
            await AsyncStorage.setItem('lastAdminId', input);
            await login(input);
            setLoginModalVisible(false);
            // setLoginInput(''); // Keep the ID for convenience
            Alert.alert('환영합니다', '관리자 권한으로 로그인되었습니다.');
        } else {
            Alert.alert('오류', '등록되지 않은 관리자입니다.');
        }
    };

    const handleSettingsPress = () => {
        if (auth.isLoggedIn) {
            setAdminMenuVisible(true);
        } else {
            setLoginModalVisible(true);
        }
    };

    const handleOpenNotice = () => {
        if (notice) {
            setEditNoticeContent(notice.content);
            setEditNoticeVisible(notice.visible);
        }
        setNoticeModalVisible(true);
    };

    const handleSaveNotice = async () => {
        await saveNotice(editNoticeContent, editNoticeVisible);
        setNoticeModalVisible(false);
        Alert.alert('저장 완료', '공지사항이 업데이트되었습니다.');
    };

    // Event Sorting Logic
    const displayEvents = useMemo(() => {
        if (!schedules) return [];
        return schedules.map(s => {
            const eventInfo = INITIAL_WIKI_EVENTS.find(e => e.id === s.eventId);
            return {
                ...s,
                title: eventInfo ? eventInfo.title : '알 수 없는 이벤트',
            };
        })
            .filter(e => e.title !== '알 수 없는 이벤트')
            .sort((a, b) => {
                // 1. Priority: Has Schedule vs No Schedule
                const hasA = !!a.day && a.day !== '일정 미정';
                const hasB = !!b.day && b.day !== '일정 미정';
                if (hasA && !hasB) return -1;
                if (!hasA && hasB) return 1;

                // 2. Day Order
                const dayOrder = ['월', '화', '수', '목', '금', '토', '일', '매일', '상시', '상설'];
                const getDayRank = (dayStr: string) => {
                    if (!dayStr) return 999;
                    const idx = dayOrder.findIndex(key => dayStr.startsWith(key));
                    return idx === -1 ? 999 : idx;
                };

                const rankA = getDayRank(a.day);
                const rankB = getDayRank(b.day);
                if (rankA !== rankB) return rankA - rankB;

                // 3. Time Order (Optional)
                return (a.time || '').localeCompare(b.time || '');
            });
    }, [schedules]);

    // PWA Install
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const handler = (e: any) => {
                e.preventDefault();
                setDeferredPrompt(e);
            };
            window.addEventListener('beforeinstallprompt', handler);
            return () => window.removeEventListener('beforeinstallprompt', handler);
        }
    }, []);

    const handleInstallClick = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult: any) => {
                if (choiceResult.outcome === 'accepted') {
                    setDeferredPrompt(null);
                }
            });
        } else {
            setInstallModalVisible(true);
        }
    };

    return (
        <ImageBackground source={require('../assets/images/bg-main.png')} className="flex-1 bg-[#020617]" resizeMode="cover">
            <View className="flex-1 bg-black/60">
                <Stack.Screen options={{ headerShown: false }} />

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>

                    {/* Header Section */}
                    <View className="pt-20 pb-10 px-8 flex-row flex-wrap justify-between items-start">
                        <View>
                            {/* Title Styled like the user uploaded image */}
                            <Text className="text-[#38bdf8] font-black text-sm tracking-[0.5em] mb-2 uppercase">Whiteout Survival</Text>
                            <Text className="text-white text-6xl font-black tracking-tighter shadow-xl shadow-blue-500/20">WOS 커맨더</Text>
                            <View className="w-16 h-1.5 bg-[#38bdf8] rounded-full mt-4" />
                            <Text className="text-slate-400 font-bold text-sm mt-4 leading-6">최적의 영웅 조합과 전략으로{"\n"}빙하기의 생존을 지휘하세요</Text>
                        </View>

                        <View className="flex-row flex-wrap gap-3 mt-2 justify-end">
                            <Pressable
                                onPress={handleInstallClick}
                                onHoverIn={() => setIsInstallHovered(true)}
                                onHoverOut={() => setIsInstallHovered(false)}
                                className="p-3 bg-slate-800/80 rounded-full border border-slate-700 active:bg-slate-700 backdrop-blur-md relative"
                            >
                                <Ionicons name="download-outline" size={28} color="#38bdf8" />
                                {isInstallHovered && (
                                    <View className="absolute -bottom-10 right-0 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-600 shadow-xl z-50 items-center">
                                        <Text numberOfLines={1} className="text-white text-xs font-bold whitespace-nowrap">앱 설치</Text>
                                        <View className="absolute -top-1 right-3 w-2 h-2 bg-slate-800 border-l border-t border-slate-600 rotate-45" />
                                    </View>
                                )}
                            </Pressable>
                            <Pressable
                                onPress={handleSettingsPress}
                                onHoverIn={() => setIsLoginHovered(true)}
                                onHoverOut={() => setIsLoginHovered(false)}
                                className="p-3 bg-slate-800/80 rounded-full border border-slate-700 active:bg-slate-700 backdrop-blur-md relative"
                            >
                                <Ionicons name="person-circle-outline" size={28} color={auth.isLoggedIn ? "#38bdf8" : "white"} />
                                {isLoginHovered && (
                                    <View className="absolute -bottom-10 right-0 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-600 shadow-xl z-50 items-center">
                                        <Text numberOfLines={1} className="text-white text-xs font-bold whitespace-nowrap">
                                            {auth.isLoggedIn ? "로그아웃" : "로그인"}
                                        </Text>
                                        <View className="absolute -top-1 right-3 w-2 h-2 bg-slate-800 border-l border-t border-slate-600 rotate-45" />
                                    </View>
                                )}
                            </Pressable>
                        </View>
                    </View>

                    {/* Main Content */}
                    <View className="px-6 w-full max-w-6xl mx-auto">

                        {/* Notice Section (Truncated for space) */}
                        {notice && (notice.visible || auth.isLoggedIn) && (notice.content || auth.isLoggedIn) && (
                            <TouchableOpacity onPress={() => setNoticeDetailVisible(true)} activeOpacity={0.8}>
                                <View className={`mb-10 p-6 rounded-[32px] border flex-row items-center ${notice.visible ? 'bg-amber-900/20 border-amber-500/30' : 'bg-slate-800/40 border-slate-700 border-dashed'}`}>
                                    <View className="mr-5">
                                        <View className="w-14 h-14 bg-amber-500/10 rounded-full items-center justify-center">
                                            <Ionicons name={notice.visible ? "megaphone" : "eye-off"} size={28} color={notice.visible ? "#fbbf24" : "#94a3b8"} />
                                        </View>
                                    </View>
                                    <View className="flex-1 mr-2">
                                        <View className="flex-row items-center justify-between mb-2">
                                            <Text className="text-amber-500 font-black text-xs tracking-widest uppercase">NOTICE</Text>
                                            {!notice.visible && auth.isLoggedIn && (
                                                <Text className="text-slate-500 text-[10px] font-bold bg-slate-800 px-2 py-0.5 rounded">* 비공개</Text>
                                            )}
                                        </View>
                                        <Text className={`text-xl font-bold leading-8 ${notice.visible ? 'text-amber-100' : 'text-slate-400'}`} numberOfLines={1} ellipsizeMode="tail">
                                            {notice.content || '(공지 내용 없음)'}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={24} color="#fbbf24" style={{ opacity: 0.5 }} />

                                    {auth.isLoggedIn && (
                                        <TouchableOpacity
                                            onPress={(e) => { e.stopPropagation(); handleOpenNotice(); }}
                                            className="absolute top-6 right-6 p-2 bg-slate-800 rounded-full border border-slate-700 z-10"
                                        >
                                            <Ionicons name="pencil" size={16} color="#38bdf8" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* Feature Cards Stack */}
                        <View className="flex-col gap-6 mb-12">
                            {/* Hero Management */}
                            <TouchableOpacity onPress={() => router.push('/hero-management')} className="flex-1 bg-[#0f172a] p-8 rounded-[32px] border border-slate-800 shadow-xl active:scale-95 transition-transform">
                                <View className="flex-row items-center">
                                    <View className="w-16 h-16 bg-[#38bdf8]/10 rounded-2xl items-center justify-center border border-[#38bdf8]/20 mr-6">
                                        <Ionicons name="shield-outline" size={32} color="#38bdf8" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white text-3xl font-black mb-1">영웅 관리</Text>
                                        <Text className="text-slate-400 text-lg font-bold">스탯 및 스킬</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            {/* Event Schedule */}
                            <TouchableOpacity onPress={() => router.push('/growth/events')} className="flex-1 bg-[#0f172a] p-8 rounded-[32px] border border-slate-800 shadow-xl active:scale-95 transition-transform">
                                <View className="flex-row items-center">
                                    <View className="w-16 h-16 bg-blue-500/10 rounded-2xl items-center justify-center border border-blue-400/20 mr-6">
                                        <Ionicons name="calendar-outline" size={32} color="#60a5fa" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white text-3xl font-black mb-1">이벤트 스케줄</Text>
                                        <Text className="text-slate-400 text-lg font-bold">연맹전략 및 주간 일정</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            {/* Strategy Sheet */}
                            <TouchableOpacity onPress={() => router.push('/strategy-sheet')} className="flex-1 bg-[#0f172a] p-8 rounded-[32px] border border-slate-800 shadow-xl active:scale-95 transition-transform">
                                <View className="flex-row items-center">
                                    <View className="w-16 h-16 bg-emerald-500/10 rounded-2xl items-center justify-center border border-emerald-400/20 mr-6">
                                        <Ionicons name="map-outline" size={32} color="#10b981" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white text-3xl font-black mb-1">전략 문서</Text>
                                        <Text className="text-slate-400 text-lg font-bold">배치도 및 공지사항</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Weekly Events List */}
                        <View className="w-full mb-12">
                            <View className="bg-[#0f172a]/60 rounded-[40px] border border-slate-800/80 shadow-2xl overflow-hidden">
                                <View className="flex-row items-center justify-between p-8 border-b border-slate-800/50">
                                    <View className="flex-row items-center">
                                        <View className="w-2 h-10 bg-[#38bdf8] rounded-full mr-5" />
                                        <Text className="text-white text-3xl font-black">금주의 이벤트</Text>
                                    </View>

                                </View>

                                <View className="p-4">
                                    {loading ? (
                                        <Text className="text-slate-500 p-12 text-center text-lg font-bold">일정을 불러오는 중...</Text>
                                    ) : displayEvents.length > 0 ? (
                                        <View className="flex-col gap-3">
                                            {displayEvents.map((event, idx) => {
                                                const isActive = isEventActive(event);
                                                return (
                                                    <TouchableOpacity key={idx} className="w-full" onPress={() => router.push({ pathname: '/growth/events', params: { focusId: event.eventId } })}>
                                                        <View className={`p-6 rounded-[24px] border flex-row items-center transition-colors ${isActive ? 'bg-red-500/10 border-red-500/30' : 'border-slate-800/80 bg-slate-900/40 active:bg-slate-800'}`}>
                                                            <View className={`w-3 h-3 rounded-full mr-5 shadow-[0_0_10px_rgba(59,130,246,0.5)] ${isActive ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`} />
                                                            <View className="flex-1">
                                                                <Text className="text-white text-xl font-black mb-2">{event.title}</Text>
                                                                <View className="flex-row gap-2">
                                                                    {event.eventId !== 'a_fortress' && (
                                                                        (!event.day && !event.time) ? (
                                                                            <View className="bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                                                                                <Text className="text-[#38bdf8] font-bold">일정 미정</Text>
                                                                            </View>
                                                                        ) : (
                                                                            event.day && !event.time && event.day !== '상설' && event.day !== '상시' ? (
                                                                                <View className="bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                                                                                    <Text className="text-[#38bdf8] font-bold">{event.day}</Text>
                                                                                </View>
                                                                            ) : null
                                                                        )
                                                                    )}
                                                                    {event.time && (
                                                                        <View className="flex-col gap-1.5 mt-1">
                                                                            {event.time.split(' / ').map((part: string, pIdx: number) => {
                                                                                const trimmed = part.trim();
                                                                                if (!trimmed) return null;
                                                                                const colonIdx = trimmed.indexOf(':');
                                                                                // Check if it's a label colon (not between digits)
                                                                                const isTimeColon = colonIdx > 0 && /\d/.test(trimmed[colonIdx - 1]) && /\d/.test(trimmed[colonIdx + 1]);
                                                                                const label = (colonIdx > -1 && !isTimeColon) ? trimmed.substring(0, colonIdx).trim() : '';
                                                                                const content = label ? trimmed.substring(colonIdx + 1).trim() : trimmed;

                                                                                return (
                                                                                    <View key={pIdx} className="mb-2 last:mb-0">
                                                                                        {label && <Text className="text-slate-500 text-[9px] font-black uppercase mb-0.5">{label}</Text>}
                                                                                        <View className="flex-row flex-wrap gap-1.5">
                                                                                            {content.split(/[,|]/).map((item, iIdx) => (
                                                                                                <View key={iIdx} className="bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 flex-row items-center self-start">
                                                                                                    <Text className="text-[#38bdf8] font-black text-xs">
                                                                                                        {item.trim()}
                                                                                                    </Text>
                                                                                                </View>
                                                                                            ))}
                                                                                        </View>
                                                                                    </View>
                                                                                );
                                                                            })}
                                                                        </View>
                                                                    )}
                                                                </View>
                                                            </View>
                                                            {isActive && (
                                                                <View className="mr-3 bg-red-500 px-2 py-1 rounded">
                                                                    <Text className="text-white text-[10px] font-bold">진행중</Text>
                                                                </View>
                                                            )}
                                                            <Ionicons name="chevron-forward" size={24} color={isActive ? "#ef4444" : "#475569"} />
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </View>
                                    ) : (
                                        <View className="p-16 items-center">
                                            <Text className="text-slate-500 text-xl font-bold">등록된 일정이 없습니다.</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* PWA Install Button */}
                        {deferredPrompt && (
                            <TouchableOpacity onPress={handleInstallClick} className="bg-[#38bdf8] p-6 rounded-[24px] mb-12 items-center shadow-lg shadow-blue-500/20 active:scale-95 transition-transform">
                                <Text className="text-[#0f172a] text-xl font-black">앱으로 설치하기</Text>
                            </TouchableOpacity>
                        )}

                    </View>
                    <View className="h-24" />
                </ScrollView>

                {/* --- MODALS --- */}

                {/* Login Modal */}
                <Modal visible={loginModalVisible} transparent animationType="fade">
                    <View className="flex-1 bg-black/80 items-center justify-center p-6">
                        <BlurView intensity={40} className="absolute inset-0" />
                        <View className="bg-slate-900 w-full max-w-sm p-8 rounded-[40px] border border-slate-800 shadow-2xl">
                            <Text className="text-white text-2xl font-black mb-2">관리자 인증</Text>
                            <Text className="text-slate-400 text-xs font-bold mb-8">등록된 관리자 영주 이름을 입력하세요.</Text>
                            <TextInput
                                placeholder="영주 이름"
                                placeholderTextColor="#475569"
                                value={loginInput}
                                onChangeText={setLoginInput}
                                returnKeyType="done"
                                autoCapitalize="none"
                                onSubmitEditing={handleLogin}
                                className="bg-slate-950 p-5 rounded-2xl text-white font-bold mb-8 border border-slate-800 focus:border-[#38bdf8] text-lg"
                            />
                            <View className="flex-row gap-3">
                                <TouchableOpacity onPress={() => setLoginModalVisible(false)} className="flex-1 bg-slate-800 py-4 rounded-2xl">
                                    <Text className="text-slate-400 text-center font-black text-lg">취소</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleLogin} className="flex-1 bg-[#38bdf8] py-4 rounded-2xl">
                                    <Text className="text-[#0f172a] text-center font-black text-lg">로그인</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Admin Menu Modal */}
                <Modal visible={adminMenuVisible} transparent animationType="fade" onRequestClose={() => setAdminMenuVisible(false)}>
                    <View className="flex-1 bg-black/80 items-center justify-center p-6">
                        <BlurView intensity={40} className="absolute inset-0" />
                        <View className="bg-slate-900 w-full max-w-sm p-6 rounded-[32px] border border-slate-700 shadow-2xl">
                            <Text className="text-white text-2xl font-black mb-8 text-center">관리자 메뉴</Text>
                            <TouchableOpacity onPress={async () => { await logout(); setAdminMenuVisible(false); Alert.alert('로그아웃 완료'); }} className="bg-slate-800 p-5 rounded-2xl mb-4 flex-row items-center justify-center border border-slate-700 active:bg-slate-700">
                                <Ionicons name="log-out-outline" size={24} color="#ef4444" style={{ marginRight: 12 }} />
                                <Text className="text-white font-black text-xl">로그아웃</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setAdminMenuVisible(false)} className="bg-slate-800/50 py-4 rounded-2xl border border-slate-700/50 mt-2">
                                <Text className="text-slate-400 text-center font-bold text-lg">닫기</Text>
                            </TouchableOpacity>

                            {/* Super Admin Area */}
                            {isSuperAdmin && (
                                <View className="mt-6 pt-6 border-t border-slate-800">
                                    <Text className="text-[#38bdf8] font-bold mb-4 text-center">슈퍼 관리자 메뉴</Text>

                                    {!showAdminList ? (
                                        <TouchableOpacity onPress={() => setShowAdminList(true)} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex-row justify-center items-center">
                                            <Ionicons name="people-outline" size={20} color="#38bdf8" style={{ marginRight: 8 }} />
                                            <Text className="text-white font-bold">관리자 등록/삭제</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View className="bg-slate-950 p-4 rounded-xl border border-slate-800 mb-4">
                                            <View className="flex-row gap-2 mb-4">
                                                <TextInput
                                                    className="flex-1 bg-slate-900 text-white p-3 rounded-lg border border-slate-700 text-sm"
                                                    placeholder="새 관리자 이름"
                                                    placeholderTextColor="#64748b"
                                                    value={newAdminName}
                                                    onChangeText={setNewAdminName}
                                                />
                                                <TouchableOpacity
                                                    onPress={async () => {
                                                        if (await addAdmin(newAdminName, auth.adminName || 'Unknown')) {
                                                            setNewAdminName('');
                                                            Alert.alert('성공', '관리자가 추가되었습니다.');
                                                        }
                                                    }}
                                                    className="bg-blue-600 px-4 justify-center rounded-lg"
                                                >
                                                    <Ionicons name="add" size={20} color="white" />
                                                </TouchableOpacity>
                                            </View>

                                            <Text className="text-slate-500 text-xs mb-2 pl-1">등록된 관리자 목록</Text>
                                            <View className="max-h-40">
                                                <ScrollView nestedScrollEnabled>
                                                    {dynamicAdmins.map(admin => (
                                                        <View key={admin.name} className="flex-row justify-between items-center py-2 border-b border-slate-800/50">
                                                            <Text className="text-slate-300 font-bold ml-1">{admin.name}</Text>
                                                            <TouchableOpacity onPress={() => {
                                                                Alert.alert('삭제 확인', `${admin.name} 관리자를 삭제하시겠습니까?`, [
                                                                    { text: '취소', style: 'cancel' },
                                                                    { text: '삭제', style: 'destructive', onPress: () => removeAdmin(admin.name) }
                                                                ]);
                                                            }}>
                                                                <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    ))}
                                                    {dynamicAdmins.length === 0 && <Text className="text-slate-600 text-center py-4">추가된 관리자가 없습니다.</Text>}
                                                </ScrollView>
                                            </View>

                                            <TouchableOpacity onPress={() => setShowAdminList(false)} className="mt-4 py-2 bg-slate-900 rounded-lg">
                                                <Text className="text-slate-500 text-center text-xs">접기</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        onPress={() => {
                                            Alert.alert(
                                                '경고',
                                                '정말로 모든 스케줄 데이터를 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
                                                [
                                                    { text: '취소', style: 'cancel' },
                                                    {
                                                        text: '삭제 및 초기화',
                                                        style: 'destructive',
                                                        onPress: async () => {
                                                            try {
                                                                await clearAllSchedules();
                                                                Alert.alert('완료', '모든 스케줄 데이터가 깨끗하게 초기화되었습니다.');
                                                                setAdminMenuVisible(false);
                                                            } catch (e: any) {
                                                                Alert.alert('오류', '초기화 실패: ' + e.message);
                                                            }
                                                        }
                                                    }
                                                ]
                                            );
                                        }}
                                        className="bg-red-500/10 p-4 rounded-xl border border-red-500/50 mt-4 flex-row justify-center items-center"
                                    >
                                        <Ionicons name="trash-bin-outline" size={20} color="#ef4444" style={{ marginRight: 8 }} />
                                        <Text className="text-red-400 font-bold">스케줄 전체 초기화</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                </Modal>

                {/* Notice Edit Modal */}
                <Modal visible={noticeModalVisible} transparent animationType="fade" onRequestClose={() => setNoticeModalVisible(false)}>
                    <View className="flex-1 bg-black/80 items-center justify-center p-6">
                        <BlurView intensity={30} className="absolute inset-0" />
                        <View className="bg-slate-900 w-full max-w-md p-6 rounded-[32px] border border-slate-700 shadow-2xl">
                            <Text className="text-white text-xl font-black mb-6">공지사항 설정</Text>
                            <View className="bg-slate-800/50 p-4 rounded-2xl mb-6 border border-slate-700/50">
                                <TextInput
                                    multiline
                                    placeholder="공지 내용을 입력하세요"
                                    placeholderTextColor="#64748b"
                                    value={editNoticeContent}
                                    onChangeText={setEditNoticeContent}
                                    className="text-white text-lg leading-7 h-40 text-top font-medium"
                                    style={{ textAlignVertical: 'top' }}
                                />
                            </View>
                            <View className="flex-row items-center justify-between mb-8 px-2 bg-slate-800/30 p-4 rounded-2xl border border-slate-700/30">
                                <View>
                                    <Text className="text-white font-bold text-lg">공지 노출</Text>
                                    <Text className="text-slate-500 text-xs mt-1">메인 화면에 표시합니다</Text>
                                </View>
                                <Switch value={editNoticeVisible} onValueChange={setEditNoticeVisible} trackColor={{ false: '#334155', true: '#38bdf8' }} thumbColor="white" />
                            </View>
                            <View className="flex-row gap-3">
                                <TouchableOpacity onPress={() => setNoticeModalVisible(false)} className="flex-1 bg-slate-800 py-4 rounded-2xl">
                                    <Text className="text-slate-400 text-center font-bold text-lg">취소</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleSaveNotice} className="flex-1 bg-[#38bdf8] py-4 rounded-2xl">
                                    <Text className="text-[#0f172a] text-center font-black text-lg">저장</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Notice Detail Modal (Requested Feature) */}
                <Modal visible={noticeDetailVisible} transparent animationType="fade" onRequestClose={() => setNoticeDetailVisible(false)}>
                    <View className="flex-1 bg-black/85 items-center justify-center p-6">
                        <BlurView intensity={40} className="absolute inset-0" />
                        <View className="bg-slate-900 w-full max-w-lg p-0 rounded-[32px] border border-slate-700 shadow-2xl overflow-hidden max-h-[80%] flex-col">
                            <View className="bg-slate-800/80 p-6 border-b border-slate-700/50 flex-row items-center justify-between backdrop-blur-md">
                                <View className="flex-row items-center">
                                    <View className="w-12 h-12 bg-amber-500/10 rounded-full items-center justify-center mr-4 border border-amber-500/20">
                                        <Ionicons name="megaphone" size={24} color="#fbbf24" />
                                    </View>
                                    <Text className="text-white text-2xl font-black">공지사항</Text>
                                </View>
                                <TouchableOpacity onPress={() => setNoticeDetailVisible(false)} className="p-3 bg-slate-800 rounded-full border border-slate-700 active:bg-slate-700">
                                    <Ionicons name="close" size={24} color="white" />
                                </TouchableOpacity>
                            </View>
                            <ScrollView className="p-8">
                                <Text className="text-amber-100/90 text-xl leading-9 font-medium tracking-wide">
                                    {notice?.content}
                                </Text>
                                <View className="h-20" />
                            </ScrollView>
                            <View className="p-6 border-t border-slate-800 bg-slate-900/90 backdrop-blur-md">
                                <TouchableOpacity onPress={() => setNoticeDetailVisible(false)} className="bg-[#38bdf8] py-5 rounded-2xl active:opacity-90 shadow-lg shadow-blue-500/20">
                                    <Text className="text-[#0f172a] text-center font-black text-xl tracking-wider">확인했습니다</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Install Guide Modal */}
                <Modal visible={installModalVisible} transparent animationType="fade" onRequestClose={() => setInstallModalVisible(false)}>
                    <View className="flex-1 bg-black/90 items-center justify-center p-6">
                        <View className="bg-slate-900 w-full max-w-sm p-8 rounded-[32px] border border-slate-700">
                            <View className="items-center mb-6">
                                <Ionicons name="download-outline" size={48} color="#38bdf8" />
                            </View>
                            <Text className="text-white text-2xl font-black text-center mb-4">앱 설치 방법</Text>
                            <Text className="text-slate-400 text-center mb-8 text-lg leading-7 font-medium">브라우저 메뉴에서{"\n"}<Text className="text-white font-bold">'홈 화면에 추가'</Text> 또는 <Text className="text-white font-bold">'앱 설치'</Text>를{"\n"}선택하세요.</Text>
                            <TouchableOpacity onPress={() => setInstallModalVisible(false)} className="bg-[#38bdf8] py-4 rounded-2xl">
                                <Text className="text-[#0f172a] text-center font-black text-lg">확인</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>

            </View >
        </ImageBackground >
    );
}
