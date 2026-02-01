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
import { INITIAL_WIKI_EVENTS, WikiEvent } from '../data/wiki-events';
import { ADDITIONAL_EVENTS } from '../data/new-events';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Home() {
    const router = useRouter();
    const { auth, login, logout } = useAuth();
    const noticeData = useFirestoreNotice ? useFirestoreNotice() : { notice: null, saveNotice: async () => { } };
    const { notice, saveNotice } = noticeData;
    const { schedules, loading, clearAllSchedules } = useFirestoreEventSchedules();

    // -- States --
    const [loginModalVisible, setLoginModalVisible] = useState(false);
    const [loginInput, setLoginInput] = useState('');
    const [noticeDetailVisible, setNoticeDetailVisible] = useState(false);

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

    // Dynamic Admins Support
    const { dynamicAdmins, addAdmin, removeAdmin } = useFirestoreAdmins();
    const [newAdminName, setNewAdminName] = useState('');
    const [showAdminList, setShowAdminList] = useState(false);
    const isSuperAdmin = auth.isLoggedIn && auth.adminName && SUPER_ADMINS.includes(auth.adminName);

    useEffect(() => {
        AsyncStorage.getItem('lastAdminId').then((savedId) => {
            if (savedId) setLoginInput(savedId);
        });
    }, []);

    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const isEventExpired = (event: any) => {
        try {
            const id = event.id || event.eventId;
            const schedule = schedules.find(s => s.eventId === id);
            const dayStr = schedule?.day || event.day || '';
            const timeStr = schedule?.time || event.time || '';
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

    const isEventActive = (event: any) => {
        try {
            const id = event.id || event.eventId;
            const schedule = schedules.find(s => s.eventId === id);
            const dayStr = schedule?.day || event.day || '';
            const timeStr = schedule?.time || event.time || '';
            const combined = dayStr + ' ' + timeStr;

            const dateRangeMatch = combined.match(/(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})\s*~\s*(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})/);
            if (dateRangeMatch) {
                const sStr = `${dateRangeMatch[1].replace(/\./g, '-')}T${dateRangeMatch[2]}:00`;
                const eStr = `${dateRangeMatch[3].replace(/\./g, '-')}T${dateRangeMatch[4]}:00`;
                const start = new Date(sStr);
                const end = new Date(eStr);
                if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                    return now >= start && now <= end;
                }
            }

            const weeklyMatch = combined.match(/([일월화수목금토])\s*(\d{2}):(\d{2})\s*~\s*([일월화수목금토])\s*(\d{2}):(\d{2})/);
            if (weeklyMatch) {
                const dayMap: { [key: string]: number } = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
                const currentTotal = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes();
                const startTotal = dayMap[weeklyMatch[1]] * 1440 + parseInt(weeklyMatch[2]) * 60 + parseInt(weeklyMatch[3]);
                const endTotal = dayMap[weeklyMatch[4]] * 1440 + parseInt(weeklyMatch[5]) * 60 + parseInt(weeklyMatch[6]);
                if (startTotal <= endTotal) return currentTotal >= startTotal && currentTotal <= endTotal;
                return currentTotal >= startTotal || currentTotal <= endTotal;
            }

            const days = dayStr.split(/[,|]/).map(d => d.trim());
            if (days.includes('상시') || days.includes('상설')) return true;

            const dayMap = ['일', '월', '화', '수', '목', '금', '토'];
            if (days.includes('매일') || days.includes(dayMap[now.getDay()])) {
                const timeMatches = timeStr.match(/(\d{1,2}):(\d{2})/g);
                if (timeMatches) {
                    const currentMinutes = now.getHours() * 60 + now.getMinutes();
                    return timeMatches.some(t => {
                        const [h, m] = t.split(':').map(Number);
                        const startTime = h * 60 + m;
                        return currentMinutes >= startTime && currentMinutes <= startTime + 30;
                    });
                }
            }
            return false;
        } catch (e) { return false; }
    };

    const [noticeModalVisible, setNoticeModalVisible] = useState(false);
    const [editNoticeContent, setEditNoticeContent] = useState('');
    const [editNoticeVisible, setEditNoticeVisible] = useState(true);
    const [adminMenuVisible, setAdminMenuVisible] = useState(false);
    const [installModalVisible, setInstallModalVisible] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    const handleLogin = async () => {
        const input = loginInput.trim();
        if (ADMIN_USERS.includes(input) || dynamicAdmins.some(a => a.name === input)) {
            await AsyncStorage.setItem('lastAdminId', input);
            await login(input);
            setLoginModalVisible(false);
            showCustomAlert('인증 성공', '관리자 권한으로 로그인되었습니다.', 'success');
        } else {
            showCustomAlert(
                '인증 실패',
                '등록되지 않은 이름입니다.\n관리자 권한은 연맹 운영진에게만 부여됩니다.\n운영진에게 등록을 요청해주세요.',
                'error'
            );
        }
    };

    const handleSettingsPress = () => auth.isLoggedIn ? setAdminMenuVisible(true) : setLoginModalVisible(true);

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
        showCustomAlert('저장 완료', '공지사항이 업데이트되었습니다.', 'success');
    };

    const displayEvents = useMemo(() => {
        if (!schedules) return [];
        const allBaseEvents = [...INITIAL_WIKI_EVENTS, ...ADDITIONAL_EVENTS];
        return schedules.map(s => {
            const searchId = s.eventId === 'alliance_frost_league' ? 'a_weapon' : s.eventId;
            const eventInfo = allBaseEvents.find(e => e.id === searchId);
            const cleanDay = (s.day === '.' || s.day?.trim() === '.') ? '' : (s.day || '');
            const cleanTime = (s.time === '.' || s.time?.trim() === '.') ? '' : (s.time || '');
            return { ...s, day: cleanDay, time: cleanTime, title: eventInfo ? eventInfo.title : '알 수 없는 이벤트' };
        }).filter(e => e.title !== '알 수 없는 이벤트' && !isEventExpired(e))
            .sort((a, b) => {
                const hasA = !!a.day && a.day !== '일정 미정';
                const hasB = !!b.day && b.day !== '일정 미정';
                if (hasA && !hasB) return -1;
                if (!hasA && hasB) return 1;
                const dayOrder = ['월', '화', '수', '목', '금', '토', '일', '매일', '상시', '상설'];
                const getDayRank = (d: string) => {
                    const idx = dayOrder.findIndex(key => (d || '').startsWith(key));
                    return idx === -1 ? 999 : idx;
                };
                const rankA = getDayRank(a.day);
                const rankB = getDayRank(b.day);
                return rankA !== rankB ? rankA - rankB : (a.time || '').localeCompare(b.time || '');
            });
    }, [schedules]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
            window.addEventListener('beforeinstallprompt', handler);
            return () => window.removeEventListener('beforeinstallprompt', handler);
        }
    }, []);

    const handleInstallClick = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((res: any) => res.outcome === 'accepted' && setDeferredPrompt(null));
        } else {
            setInstallModalVisible(true);
        }
    };

    return (
        <ImageBackground
            source={require('../assets/images/bg-main.png')}
            style={{ flex: 1, backgroundColor: '#020617' }}
            imageStyle={{ resizeMode: 'cover' }}
        >
            <View className="flex-1 bg-black/60">
                <Stack.Screen options={{ headerShown: false }} />

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    <View className="w-full max-w-6xl mx-auto px-4 md:px-8 pb-20">
                        {/* Header Section */}
                        <View className="pt-20 pb-10 flex-row justify-between items-start">
                            <View>
                                <Text className="text-[#38bdf8] font-black text-[10px] md:text-sm tracking-[0.5em] mb-2 uppercase">Whiteout Survival</Text>
                                <Text className="text-white text-4xl md:text-6xl font-black tracking-tighter shadow-xl shadow-blue-500/20">WOS 커맨더</Text>
                                <View className="w-12 md:w-16 h-1 md:h-1.5 bg-[#38bdf8] rounded-full mt-3 md:mt-4" />
                                <Text className="text-slate-400 font-bold text-xs md:text-sm mt-4 leading-6">최적의 영웅 조합과 전략으로{"\n"}빙하기의 생존을 지휘하세요</Text>
                            </View>
                            <View className="flex-row gap-3 mt-2">
                                <Pressable onPress={handleInstallClick} className="p-3 bg-slate-800/80 rounded-full border border-slate-700 active:bg-slate-700">
                                    <Ionicons name="download-outline" size={28} color="#38bdf8" />
                                </Pressable>
                                <Pressable onPress={handleSettingsPress} className="p-3 bg-slate-800/80 rounded-full border border-slate-700 active:bg-slate-700">
                                    <Ionicons name="person-circle-outline" size={28} color={auth.isLoggedIn ? "#38bdf8" : "white"} />
                                </Pressable>
                            </View>
                        </View>

                        {/* Notice Section */}
                        {!!notice && (!!notice.visible || !!auth.isLoggedIn) && (
                            <TouchableOpacity onPress={() => setNoticeDetailVisible(true)} className="mb-10 w-full">
                                <View className={`p-6 rounded-[32px] border flex-row items-center ${notice.visible ? 'bg-amber-900/20 border-amber-500/30' : 'bg-slate-800/40 border-slate-700 border-dashed'}`}>
                                    <View className="mr-5">
                                        <View className="w-14 h-14 bg-amber-500/10 rounded-full items-center justify-center">
                                            <Ionicons name={notice.visible ? "megaphone" : "eye-off"} size={28} color={notice.visible ? "#fbbf24" : "#94a3b8"} />
                                        </View>
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-amber-500 font-black text-xs tracking-widest uppercase mb-1">NOTICE</Text>
                                        <Text className="text-xl font-bold text-amber-100" numberOfLines={1}>{notice.content || '(공지 내용 없음)'}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={24} color="#fbbf24" style={{ opacity: 0.5 }} />
                                    {!!auth.isLoggedIn && (
                                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleOpenNotice(); }} className="ml-3 p-2 bg-slate-800 rounded-full border border-slate-700">
                                            <Ionicons name="pencil" size={16} color="#38bdf8" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* Feature Cards Grid */}
                        <View className="flex-col md:flex-row gap-4 md:gap-6 mb-12">
                            <TouchableOpacity onPress={() => router.push('/hero-management')} className="flex-1 bg-[#0f172a] p-6 md:p-8 rounded-[32px] border border-slate-800 shadow-xl active:scale-95 transition-transform">
                                <View className="flex-row items-center">
                                    <View className="w-12 h-12 bg-[#38bdf8]/10 rounded-2xl items-center justify-center border border-[#38bdf8]/20 mr-4 md:mr-6"><Ionicons name="shield-outline" size={28} color="#38bdf8" /></View>
                                    <View><Text className="text-white text-2xl md:text-3xl font-black">영웅 정보</Text><Text className="text-slate-400 font-bold">스탯 및 스킬</Text></View>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push('/growth/events')} className="flex-1 bg-[#0f172a] p-6 md:p-8 rounded-[32px] border border-slate-800 shadow-xl active:scale-95 transition-transform">
                                <View className="flex-row items-center">
                                    <View className="w-12 h-12 bg-blue-500/10 rounded-2xl items-center justify-center border border-blue-400/20 mr-4 md:mr-6"><Ionicons name="calendar-outline" size={28} color="#60a5fa" /></View>
                                    <View><Text className="text-white text-2xl md:text-3xl font-black">이벤트</Text><Text className="text-slate-400 font-bold">연맹전략 및 일정</Text></View>
                                </View>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push('/strategy-sheet')} className="flex-1 bg-[#0f172a] p-6 md:p-8 rounded-[32px] border border-slate-800 shadow-xl active:scale-95 transition-transform">
                                <View className="flex-row items-center">
                                    <View className="w-12 h-12 bg-emerald-500/10 rounded-2xl items-center justify-center border border-emerald-400/20 mr-4 md:mr-6"><Ionicons name="map-outline" size={28} color="#10b981" /></View>
                                    <View><Text className="text-white text-2xl md:text-3xl font-black">전략 문서</Text><Text className="text-slate-400 font-bold">배치도 및 공지</Text></View>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Weekly Events List */}
                        <View className="bg-[#0f172a]/60 rounded-[40px] border border-slate-800/80 shadow-2xl overflow-hidden">
                            <View className="p-6 border-b border-slate-800/50 flex-row items-center">
                                <View className="w-2 h-10 bg-[#38bdf8] rounded-full mr-5" />
                                <Text className="text-white text-3xl font-black">금주의 이벤트</Text>
                            </View>
                            <View className="p-6">
                                {loading ? (
                                    <Text className="text-slate-500 p-12 text-center font-bold">일정을 불러오는 중...</Text>
                                ) : displayEvents.length > 0 ? (
                                    <View className="gap-4">
                                        {displayEvents.map((event, idx) => {
                                            const isActive = isEventActive(event);
                                            return (
                                                <TouchableOpacity key={idx} onPress={() => router.push({ pathname: '/growth/events', params: { focusId: event.eventId } })}>
                                                    <View className={`p-5 md:p-6 rounded-[32px] border-2 flex-row items-center ${isActive ? 'bg-red-500/25 border-red-500/50' : 'border-slate-600/60 bg-[#1e293b]'}`}>
                                                        <View className={`w-4 h-4 rounded-full mr-4 ${isActive ? 'bg-red-500 animate-pulse' : 'bg-blue-500'}`} />
                                                        <View className="flex-1">
                                                            <Text className="text-white text-xl font-black mb-1">{event.title}</Text>
                                                            <View className="flex-row flex-wrap gap-2">
                                                                {!!event.day && !event.time && event.day !== '요새전/성채전' && (
                                                                    <View className="bg-black/60 px-4 py-2 rounded-xl border border-slate-500">
                                                                        <Text className="text-[#38bdf8] font-bold">{event.day}</Text>
                                                                    </View>
                                                                )}
                                                                {!event.day && !event.time && (
                                                                    <View className="bg-black/60 px-4 py-2 rounded-xl border border-slate-500">
                                                                        <Text className="text-[#38bdf8] font-bold">일정 미정</Text>
                                                                    </View>
                                                                )}
                                                                {!!event.time && (
                                                                    <View className="flex-1 mt-1">
                                                                        {event.time.split(' / ').map((part: string, pIdx: number) => {
                                                                            const trimmed = part.trim();
                                                                            if (!trimmed) return null;
                                                                            const colonIdx = trimmed.indexOf(':');
                                                                            const isTimeColon = colonIdx > 0 && /\d/.test(trimmed[colonIdx - 1]) && /\d/.test(trimmed[colonIdx + 1]);
                                                                            const label = (colonIdx > -1 && !isTimeColon) ? trimmed.substring(0, colonIdx).trim() : '';
                                                                            const content = label ? trimmed.substring(colonIdx + 1).trim() : trimmed;
                                                                            return (
                                                                                <View key={pIdx} className="mb-3 last:mb-0">
                                                                                    {!!label && (
                                                                                        <Text className="text-slate-400 text-[10px] font-black uppercase mb-1 ml-1">{label}</Text>
                                                                                    )}
                                                                                    <View className="flex-row flex-wrap gap-2">
                                                                                        {content.split(/[,|]/).map((item, iIdx) => {
                                                                                            const formatted = item.trim().replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                                                                            return (
                                                                                                <View key={iIdx} className="bg-black/50 px-3 py-1.5 rounded-xl border border-slate-600/50">
                                                                                                    <Text className="text-[#38bdf8] font-bold text-sm">{formatted}</Text>
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
                                                        {!!isActive && <View className="bg-red-500 px-2 py-1 rounded-lg ml-2"><Text className="text-white text-xs font-black">진행중</Text></View>}
                                                        <Ionicons name="chevron-forward" size={24} color="#475569" className="ml-2" />
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <Text className="text-slate-500 p-12 text-center font-bold">등록된 일정이 없습니다.</Text>
                                )}
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </View>

            {/* Modals outside scrollview */}
            <Modal visible={loginModalVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <BlurView intensity={40} className="absolute inset-0" />
                    <View className="bg-slate-900 w-full max-w-sm p-8 rounded-[40px] border border-slate-800 shadow-2xl">
                        <Text className="text-white text-2xl font-black mb-8">관리자 인증</Text>
                        <TextInput
                            placeholder="영주 이름" placeholderTextColor="#475569"
                            value={loginInput} onChangeText={setLoginInput}
                            autoCapitalize="none" onSubmitEditing={handleLogin}
                            className="bg-slate-950 p-5 rounded-2xl text-white font-bold mb-8 border border-slate-800 text-lg"
                        />
                        <View className="flex-row gap-3">
                            <TouchableOpacity onPress={() => setLoginModalVisible(false)} className="flex-1 bg-slate-800 py-4 rounded-2xl"><Text className="text-slate-400 text-center font-black">취소</Text></TouchableOpacity>
                            <TouchableOpacity onPress={handleLogin} className="flex-1 bg-[#38bdf8] py-4 rounded-2xl"><Text className="text-[#0f172a] text-center font-black">로그인</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={adminMenuVisible} transparent animationType="fade" onRequestClose={() => setAdminMenuVisible(false)}>
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <View className="bg-slate-900 w-full max-w-sm p-6 rounded-[32px] border border-slate-700 shadow-2xl">
                        <Text className="text-white text-2xl font-black mb-8 text-center">관리자 메뉴</Text>
                        <TouchableOpacity onPress={async () => { await logout(); setAdminMenuVisible(false); }} className="bg-slate-800 p-5 rounded-2xl mb-4 flex-row items-center justify-center border border-slate-700"><Ionicons name="log-out-outline" size={24} color="#ef4444" style={{ marginRight: 8 }} /><Text className="text-white font-black text-xl">로그아웃</Text></TouchableOpacity>

                        {!!isSuperAdmin && (
                            <View className="mt-4 pt-4 border-t border-slate-800">
                                <Text className="text-[#38bdf8] font-bold mb-3 text-center text-xs">슈퍼 관리자 메뉴</Text>
                                <TouchableOpacity onPress={() => setShowAdminList(!showAdminList)} className="bg-slate-800 p-4 rounded-xl border border-slate-700 mb-3 flex-row justify-center items-center">
                                    <Ionicons name="people-outline" size={18} color="#38bdf8" style={{ marginRight: 8 }} />
                                    <Text className="text-white font-bold text-sm">운영진 관리</Text>
                                </TouchableOpacity>

                                {!!showAdminList && (
                                    <View className="bg-black/40 p-3 rounded-xl mb-3 border border-slate-800">
                                        <View className="flex-row gap-2 mb-3">
                                            <TextInput className="flex-1 bg-slate-900 text-white p-2 rounded-lg border border-slate-700 text-xs" placeholder="이름" value={newAdminName} onChangeText={setNewAdminName} />
                                            <TouchableOpacity onPress={async () => { if (await addAdmin(newAdminName, auth.adminName || '')) { setNewAdminName(''); showCustomAlert('성공', '운영진이 추가되었습니다.', 'success'); } }} className="bg-blue-600 px-3 justify-center rounded-lg"><Ionicons name="add" size={18} color="white" /></TouchableOpacity>
                                        </View>
                                        {dynamicAdmins.map(a => (
                                            <View key={a.name} className="flex-row justify-between py-2 border-b border-white/5"><Text className="text-slate-300 text-xs">{a.name}</Text><TouchableOpacity onPress={() => removeAdmin(a.name)}><Ionicons name="trash-outline" size={14} color="#ef4444" /></TouchableOpacity></View>
                                        ))}
                                    </View>
                                )}

                                <TouchableOpacity
                                    onPress={() => {
                                        showCustomAlert(
                                            '전체 데이터 초기화',
                                            '🚨 모든 이벤트 일정이 영구적으로 삭제됩니다.\n정말 진행하시겠습니까?',
                                            'confirm',
                                            async () => {
                                                await clearAllSchedules();
                                                showCustomAlert('초기화 완료', '모든 일정이 성공적으로 삭제되었습니다.', 'success');
                                            }
                                        );
                                    }}
                                    className="bg-red-500/10 p-4 rounded-xl border border-red-500/40 flex-row justify-center items-center"
                                >
                                    <Ionicons name="trash-bin-outline" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                                    <Text className="text-red-400 font-bold text-sm">전체 일정 초기화</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <TouchableOpacity onPress={() => setAdminMenuVisible(false)} className="bg-slate-800/50 py-4 rounded-2xl border border-slate-700/50 mt-4"><Text className="text-slate-400 text-center font-bold">닫기</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Custom Alert Modal */}
            <Modal visible={customAlert.visible} transparent animationType="fade" onRequestClose={() => setCustomAlert({ ...customAlert, visible: false })}>
                <View className="flex-1 bg-black/60 items-center justify-center p-6">
                    <BlurView intensity={20} className="absolute inset-0" />
                    <View className="bg-slate-900 w-full max-w-sm p-8 rounded-[40px] border border-slate-800 shadow-2xl items-center">
                        <View className={`w-20 h-20 rounded-full items-center justify-center mb-6 ${customAlert.type === 'success' ? 'bg-emerald-500/10' : (customAlert.type === 'error' || customAlert.type === 'confirm') ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                            <Ionicons
                                name={customAlert.type === 'success' ? 'checkmark-circle' : (customAlert.type === 'error' || customAlert.type === 'confirm') ? 'alert-circle' : 'warning'}
                                size={48}
                                color={customAlert.type === 'success' ? '#10b981' : (customAlert.type === 'error' || customAlert.type === 'confirm') ? '#ef4444' : '#fbbf24'}
                            />
                        </View>
                        <Text className="text-white text-2xl font-black mb-4 text-center">{customAlert.title}</Text>
                        <Text className="text-slate-400 text-center mb-8 text-lg leading-7 font-medium">
                            {customAlert.message}
                        </Text>

                        {customAlert.type === 'confirm' ? (
                            <View className="flex-row gap-3 w-full">
                                <TouchableOpacity
                                    onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                                    className="flex-1 py-4 bg-slate-800 rounded-2xl border border-slate-700"
                                >
                                    <Text className="text-slate-400 text-center font-black text-lg">취소</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        setCustomAlert({ ...customAlert, visible: false });
                                        if (customAlert.onConfirm) customAlert.onConfirm();
                                    }}
                                    className="flex-1 py-4 bg-red-600 rounded-2xl"
                                >
                                    <Text className="text-white text-center font-black text-lg">삭제</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                                className={`py-4 w-full rounded-2xl ${customAlert.type === 'success' ? 'bg-emerald-600' : customAlert.type === 'error' ? 'bg-red-600' : 'bg-amber-600'}`}
                            >
                                <Text className="text-white text-center font-black text-lg">확인</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

            <Modal visible={noticeDetailVisible} transparent animationType="fade" onRequestClose={() => setNoticeDetailVisible(false)}>
                <View className="flex-1 bg-black/85 items-center justify-center p-6">
                    <View className="bg-slate-900 w-full max-w-lg p-0 rounded-[32px] border border-slate-700 shadow-2xl overflow-hidden max-h-[80%] flex-col">
                        <View className="bg-slate-800/80 p-6 border-b border-slate-700/50 flex-row items-center justify-between">
                            <Text className="text-white text-2xl font-black">공지사항</Text>
                            <TouchableOpacity onPress={() => setNoticeDetailVisible(false)} className="p-2 bg-slate-800 rounded-full border border-slate-700"><Ionicons name="close" size={24} color="white" /></TouchableOpacity>
                        </View>
                        <ScrollView className="p-8"><Text className="text-amber-100/90 text-xl leading-9 font-medium tracking-wide">{notice?.content || ''}</Text></ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal visible={installModalVisible} transparent animationType="fade" onRequestClose={() => setInstallModalVisible(false)}>
                <View className="flex-1 bg-black/90 items-center justify-center p-6">
                    <View className="bg-slate-900 w-full max-w-sm p-8 rounded-[32px] border border-slate-700 items-center">
                        <Ionicons name="download-outline" size={48} color="#38bdf8" style={{ marginBottom: 24 }} />
                        <Text className="text-white text-2xl font-black mb-4">앱 설치 방법</Text>
                        <Text className="text-slate-400 text-center mb-8 text-lg leading-7">브라우저 메뉴에서{"\n"}<Text className="text-white font-bold">'홈 화면에 추가'</Text>를 선택하세요.</Text>
                        <TouchableOpacity onPress={() => setInstallModalVisible(false)} className="bg-[#38bdf8] py-4 w-full rounded-2xl"><Text className="text-[#0f172a] text-center font-black">확인</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Notice Edit Modal */}
            <Modal visible={noticeModalVisible} transparent animationType="fade" onRequestClose={() => setNoticeModalVisible(false)}>
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <View className="bg-slate-900 w-full max-w-md p-6 rounded-[32px] border border-slate-700 shadow-2xl">
                        <Text className="text-white text-xl font-black mb-6">공지사항 설정</Text>
                        <TextInput
                            multiline value={editNoticeContent} onChangeText={setEditNoticeContent}
                            className="bg-slate-800 p-4 rounded-2xl text-white text-lg h-40 mb-6 border border-slate-700"
                        />
                        <View className="flex-row items-center justify-between mb-8 bg-slate-800/30 p-4 rounded-2xl border border-slate-700/30">
                            <Text className="text-white font-bold">공지 노출</Text>
                            <Switch value={editNoticeVisible} onValueChange={setEditNoticeVisible} trackColor={{ false: '#334155', true: '#38bdf8' }} />
                        </View>
                        <View className="flex-row gap-3">
                            <TouchableOpacity onPress={() => setNoticeModalVisible(false)} className="flex-1 bg-slate-800 py-4 rounded-2xl"><Text className="text-slate-400 text-center">취소</Text></TouchableOpacity>
                            <TouchableOpacity onPress={handleSaveNotice} className="flex-1 bg-[#38bdf8] py-4 rounded-2xl"><Text className="text-[#0f172a] text-center font-black">저장</Text></TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ImageBackground>
    );
}
