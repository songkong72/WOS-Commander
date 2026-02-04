import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Alert, Platform, ScrollView, Switch, ImageBackground, Image, Pressable, Animated } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useAuth, useTheme } from './_layout';
import { MASTER_CREDENTIALS, SUPER_ADMINS } from '../data/admin-config';
import { useFirestoreEventSchedules } from '../hooks/useFirestoreEventSchedules';
import { useFirestoreAdmins } from '../hooks/useFirestoreAdmins';
// @ts-ignore
import { useFirestoreNotice } from '../hooks/useFirestoreNotice';
import { INITIAL_WIKI_EVENTS, WikiEvent } from '../data/wiki-events';
import { ADDITIONAL_EVENTS } from '../data/new-events';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hashPassword } from '../utils/crypto';

export default function Home() {
    const router = useRouter();
    const { auth, login, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const isDark = theme === 'dark';
    const noticeData = useFirestoreNotice ? useFirestoreNotice() : { notice: null, saveNotice: async () => { } };
    const { notice, saveNotice } = noticeData;
    const { schedules, loading, clearAllSchedules } = useFirestoreEventSchedules();

    // -- States --
    const [loginModalVisible, setLoginModalVisible] = useState(false);
    const [loginInput, setLoginInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [loginError, setLoginError] = useState('');
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
    const [newAdminPassword, setNewAdminPassword] = useState('');
    const [newAdminRole, setNewAdminRole] = useState<'admin' | 'super_admin'>('admin');
    const [showAdminList, setShowAdminList] = useState(false);
    const isSuperAdmin = auth.isLoggedIn && auth.adminName && (
        SUPER_ADMINS.includes(auth.adminName) ||
        dynamicAdmins.find(a => a.name === auth.adminName)?.role === 'super_admin'
    );

    const [hoveredHeaderBtn, setHoveredHeaderBtn] = useState<string | null>(null);

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

    // -- 일정 단위가 활성 상태인지 체크하는 헬퍼 함수 --
    const checkItemActive = (str: string) => {
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

    const isEventActive = (event: any) => {
        try {
            const id = event.id || event.eventId;
            const schedule = schedules.find(s => s.eventId === id);
            const dayStr = schedule?.day || event.day || '';
            const timeStr = schedule?.time || event.time || '';

            return checkItemActive(dayStr) || checkItemActive(timeStr);
        } catch (e) { return false; }
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
            const formatted = `${dayStr}(${utcShift.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')})`;
            return includePrefix ? `UTC: ${formatted}` : formatted;
        }

        let utcH = h - 9;
        let utcDayIdx = dayIdx;
        if (utcH < 0) {
            utcH += 24;
            utcDayIdx = (dayIdx - 1 + 7) % 7;
        }

        const formatted = `${days[utcDayIdx]}(${utcH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')})`;
        return includePrefix ? `UTC: ${formatted}` : formatted;
    };

    const getUTCString = (str: string) => {
        if (!str) return null;
        const match = str.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{2}):(\d{2})/);
        if (!match) return null;
        const [_, y, m, d, h, min] = match;
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min));
        if (isNaN(date.getTime())) return null;
        const pad = (n: number) => n.toString().padStart(2, '0');
        return `${date.getUTCFullYear()}.${pad(date.getUTCMonth() + 1)}.${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`;
    };

    const [noticeModalVisible, setNoticeModalVisible] = useState(false);
    const [editNoticeContent, setEditNoticeContent] = useState('');
    const [editNoticeVisible, setEditNoticeVisible] = useState(true);
    const [adminMenuVisible, setAdminMenuVisible] = useState(false);
    const [installModalVisible, setInstallModalVisible] = useState(false);
    const flickerAnim = useRef(new Animated.Value(1)).current;
    const scaleAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const createPulse = () => {
            return Animated.sequence([
                Animated.timing(flickerAnim, { toValue: 0.5, duration: 1000, useNativeDriver: true }),
                Animated.timing(flickerAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ]);
        };

        const createScale = () => {
            return Animated.sequence([
                Animated.timing(scaleAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
                Animated.timing(scaleAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ]);
        };

        Animated.loop(
            Animated.parallel([
                createPulse(),
                createScale()
            ])
        ).start();
    }, []);

    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    const handleLogin = async () => {
        const input = (loginInput || '').trim();
        const pw = (passwordInput || '').trim();
        setLoginError('');

        console.log('Login attempt:', { id: input, pw_len: pw.length });

        if (!input || !pw) {
            console.log('Login failed: Empty input');
            return;
        }

        // 해시 생성 (소문자로 통일)
        const currentHash = (await hashPassword(pw)).toLowerCase().trim();
        const normalizedInput = input.normalize('NFC').toLowerCase().trim();

        // 마스터 비밀번호 후보들 (wos1234, Wos1234 등)
        const MASTER_HASH_VARIANTS = [
            'ed9f02f10e07faa4b8c450098c23ad7d2e96a2396523897c0beec0ecdf327', // wos1234
            '4da72ed92a6a6773ef5b7b89b787968c12a7999d9f8d0b43a9dcb54875d12e63', // Wos1234
            '94c348f56641680d226f31623190df627e85741f0a2e269f88c96ae229dd5bcd'  // legacy
        ];

        // 1. 마스터 계정 체크 (관리자, master)
        const isMasterId = ['관리자', 'master'].some(id =>
            id.normalize('NFC').toLowerCase().trim() === normalizedInput
        );

        // 비밀번호 체크 (해시값 목록 대조 또는 평문 대소문자 무시 체크)
        const isMasterPw = MASTER_HASH_VARIANTS.includes(currentHash) ||
            pw.toLowerCase() === 'wos1234';

        console.log('Master check result:', { isMasterId, isMasterPw, currentHash });

        if (isMasterId && isMasterPw) {
            const finalId = normalizedInput.includes('관리자') ? '관리자' : 'master';
            await performLogin(finalId);
            return;
        }

        // 2. 일반 운영진 계정 체크
        console.log('Checking dynamic admins:', dynamicAdmins.length);
        const dynamic = dynamicAdmins.find(a => {
            const aNameNormal = a.name.normalize('NFC').toLowerCase().trim();
            const aPw = (a.password || '').toLowerCase().trim();
            const isIdMatch = aNameNormal === normalizedInput;
            const isPwMatch = aPw === currentHash || aPw.toLowerCase() === pw.toLowerCase() || !aPw;
            return isIdMatch && isPwMatch;
        });

        if (dynamic) {
            console.log('Dynamic admin matched:', dynamic.name);
            await performLogin(dynamic.name);
        } else {
            console.log('Auth failed: No match found');
            setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.');
        }
    };

    const performLogin = async (id: string) => {
        try {
            const { signInAnonymously } = require('firebase/auth');
            const { auth: firebaseAuth } = require('../firebaseConfig');
            signInAnonymously(firebaseAuth).catch(() => { });
        } catch (e) { }

        await AsyncStorage.setItem('lastAdminId', id);
        await login(id);
        setLoginModalVisible(false);
        setPasswordInput('');
        showCustomAlert('인증 성공', '관리자 권한을 획득하였습니다.', 'success');
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
        showCustomAlert('저장 완료', '공지사항이 성공적으로 업데이트되었습니다.', 'success');
    };

    const displayEvents = useMemo(() => {
        if (!schedules) return [];
        const allBaseEvents = [...INITIAL_WIKI_EVENTS, ...ADDITIONAL_EVENTS];

        // 1. First, map schedules to base event info and filter out invalid/unnecessary items
        const rawList = schedules.map(s => {
            const searchId = s.eventId === 'alliance_frost_league' ? 'a_weapon' : s.eventId;
            const eventInfo = allBaseEvents.find(e => e.id === searchId);
            const cleanDay = (s.day === '.' || s.day?.trim() === '.') ? '' : (s.day || '');
            const cleanTime = (s.time === '.' || s.time?.trim() === '.') ? '' : (s.time || '');
            return { ...s, day: cleanDay, time: cleanTime, title: eventInfo ? eventInfo.title : '알 수 없는 이벤트' };
        }).filter(e => {
            if (e.title === '알 수 없는 이벤트') return false;
            if (!(!!e.day || !!e.time)) return false;
            if (!isEventExpired(e)) return true;
            const todayStr = now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0');
            return (e.day || '').includes(todayStr) || (e.time || '').includes(todayStr);
        });

        // 2. Split Bear Hunt into separate cards for Team 1 and Team 2
        const processedList: any[] = [];
        rawList.forEach(e => {
            if (e.eventId === 'a_bear' || e.eventId === 'alliance_bear') {
                const parts = (e.time || '').split(' / ');
                if (parts.length > 0) {
                    parts.forEach((part, idx) => {
                        const trimmed = part.trim();
                        if (!trimmed) return;

                        const colonIdx = trimmed.indexOf(':');
                        const rawLabel = colonIdx > -1 ? trimmed.substring(0, colonIdx).trim() : `곰${idx + 1}`;
                        // Simplify Team Label
                        const cleanLabel = rawLabel.includes('곰') ? rawLabel : `곰 ${rawLabel.replace(/팀|군/g, '').trim()}팀`;
                        const teamTime = colonIdx > -1 ? trimmed.substring(colonIdx + 1).trim() : trimmed;

                        // Simplify individual times (Remove Departure/Return etc)
                        const simplifiedTime = teamTime.split(/[,|]/).map(t => {
                            return t.replace(/출격|귀환|시작|종료/g, '').trim();
                        }).join(', ');

                        processedList.push({
                            ...e,
                            eventId: `${e.eventId}_team${idx + 1}`,
                            title: `곰 사냥 작전 (${cleanLabel})`,
                            time: simplifiedTime,
                            isBearSplit: true,
                            teamLabel: cleanLabel,
                            teamIcon: `🐻${idx + 1}`
                        });
                    });
                } else {
                    processedList.push(e);
                }
            } else {
                processedList.push(e);
            }
        });

        // 3. Sort the final processed list
        return processedList.sort((a, b) => {
            const activeA = isEventActive(a);
            const activeB = isEventActive(b);
            const expiredA = isEventExpired(a);
            const expiredB = isEventExpired(b);

            if (activeA && !activeB) return -1;
            if (!activeA && activeB) return 1;
            if (!expiredA && expiredB) return -1;
            if (expiredA && !expiredB) return 1;

            const dayOrder = ['월', '화', '수', '목', '금', '토', '일', '매일', '상시', '상설'];
            const getDayRank = (d: string) => {
                const idx = dayOrder.findIndex(key => (d || '').startsWith(key));
                return idx === -1 ? 999 : idx;
            };
            const rankA = getDayRank(a.day);
            const rankB = getDayRank(b.day);
            if (rankA !== rankB) return rankA - rankB;

            // Fix Bear Hunt team order (Team 1 -> Team 2)
            if (a.isBearSplit && b.isBearSplit && a.eventId.substring(0, 6) === b.eventId.substring(0, 6)) {
                return a.eventId.localeCompare(b.eventId);
            }

            return (a.time || '').localeCompare(b.time || '');
        });
    }, [schedules, now]);

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
        <View style={{ flex: 1 }}>
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
                <View className="w-full items-center">
                    <View className="w-full max-w-6xl px-4 md:px-8 pb-24">
                        <View className="pt-12 pb-6 flex-row justify-between items-start">
                            <View className="flex-1 mr-4">
                                <Text className={`font-bold text-[9px] md:text-xs tracking-[0.4em] mb-1.5 uppercase ${isDark ? 'text-[#38bdf8]' : 'text-blue-600'}`}>Whiteout Survival</Text>
                                <Text className={`text-3xl md:text-5xl font-bold tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>WOS 커맨더</Text>
                                <View className={`w-10 md:w-14 h-1 rounded-full mt-2.5 ${isDark ? 'bg-[#38bdf8]' : 'bg-blue-600'}`} />
                                <Text className={`font-semibold text-[11px] md:text-xs mt-3.5 leading-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>최적의 영웅 조합과 전략으로{"\n"}빙하기의 생존을 지휘하세요</Text>
                            </View>
                            <View className="flex-row gap-2 mt-1">
                                <View className="relative">
                                    <Pressable
                                        onPress={toggleTheme}
                                        onHoverIn={() => setHoveredHeaderBtn('theme')}
                                        onHoverOut={() => setHoveredHeaderBtn(null)}
                                        className={`p-2.5 rounded-full border active:scale-95 transition-transform ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200 shadow-sm'}`}
                                    >
                                        <Ionicons name={isDark ? "sunny" : "moon"} size={22} color={isDark ? "#fbbf24" : "#333333"} />
                                    </Pressable>
                                    {hoveredHeaderBtn === 'theme' && (
                                        <View className="absolute top-12 right-0 z-[100] items-end animate-in fade-in slide-in-from-top-1 duration-200" style={{ pointerEvents: 'none' }}>
                                            <View className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-black' : 'bg-white border-slate-200 shadow-slate-200'} border px-4 py-2.5 rounded-xl shadow-2xl`} style={{ alignSelf: 'flex-end' }}>
                                                <Text numberOfLines={1} className={`${isDark ? 'text-slate-200' : 'text-slate-700'} text-[11px] font-bold whitespace-nowrap`}>
                                                    테마 전환 (다크/라이트)
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>

                                <View className="relative">
                                    <Pressable
                                        onPress={handleInstallClick}
                                        onHoverIn={() => setHoveredHeaderBtn('install')}
                                        onHoverOut={() => setHoveredHeaderBtn(null)}
                                        className={`p-2.5 rounded-full border active:scale-95 transition-transform ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200 shadow-sm'}`}
                                    >
                                        <Ionicons name="download" size={22} color={isDark ? "#38bdf8" : "#0284c7"} />
                                    </Pressable>
                                    {hoveredHeaderBtn === 'install' && (
                                        <View className="absolute top-12 right-0 z-[100] items-end animate-in fade-in slide-in-from-top-1 duration-200" style={{ pointerEvents: 'none' }}>
                                            <View className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-black' : 'bg-white border-slate-200 shadow-slate-200'} border px-4 py-2.5 rounded-xl shadow-2xl`} style={{ alignSelf: 'flex-end' }}>
                                                <Text numberOfLines={1} className={`${isDark ? 'text-slate-200' : 'text-slate-700'} text-[11px] font-bold whitespace-nowrap`}>
                                                    홈 화면에 설치 방법
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>

                                <View className="relative">
                                    <Pressable
                                        onPress={handleSettingsPress}
                                        onHoverIn={() => setHoveredHeaderBtn('admin')}
                                        onHoverOut={() => setHoveredHeaderBtn(null)}
                                        className={`p-2.5 rounded-full border active:scale-95 transition-transform ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200 shadow-sm'}`}
                                    >
                                        <Ionicons name="person-circle" size={22} color={auth.isLoggedIn ? (isDark ? "#38bdf8" : "#0284c7") : (isDark ? "white" : "#333333")} />
                                    </Pressable>
                                    {hoveredHeaderBtn === 'admin' && (
                                        <View className="absolute top-12 right-0 z-[100] items-end animate-in fade-in slide-in-from-top-1 duration-200" style={{ pointerEvents: 'none' }}>
                                            <View className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-black' : 'bg-white border-slate-200 shadow-slate-200'} border px-4 py-2.5 rounded-xl shadow-2xl`} style={{ alignSelf: 'flex-end' }}>
                                                <Text numberOfLines={1} className={`${isDark ? 'text-slate-200' : 'text-slate-700'} text-[11px] font-bold whitespace-nowrap`}>
                                                    {auth.isLoggedIn ? '관리자 메뉴 열기' : '관리자 로그인'}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* Notice Section */}
                        {!!notice && (!!notice.visible || !!auth.isLoggedIn) && (
                            <TouchableOpacity onPress={() => setNoticeDetailVisible(true)} className="mb-6 w-full active:scale-[0.99] transition-transform">
                                <View className={`p-4 rounded-2xl border-2 flex-row items-center shadow-lg ${notice.visible ? (isDark ? 'bg-amber-900/20 border-amber-500/30' : 'bg-amber-50 border-amber-200') : (isDark ? 'bg-slate-800/40 border-slate-700 border-dashed' : 'bg-slate-50 border-slate-200 border-dashed')}`}>
                                    <View className="mr-4">
                                        <View className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-amber-500/10' : 'bg-amber-100'}`}>
                                            <Ionicons name={notice.visible ? "notifications" : "notifications-off"} size={20} color={notice.visible ? "#f59e0b" : "#94a3b8"} />
                                        </View>
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`font-bold text-[10px] tracking-widest uppercase mb-0.5 ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>알림</Text>
                                        <Text className={`text-base font-semibold ${isDark ? 'text-amber-100' : 'text-slate-800'}`} numberOfLines={1}>{notice.content || '(공지 내용 없음)'}</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={20} color={isDark ? "#f59e0b" : "#d97706"} style={{ opacity: 0.5 }} />
                                    {!!auth.isLoggedIn && (
                                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleOpenNotice(); }} className={`ml-3 p-1.5 rounded-full border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}><Ionicons name="pencil" size={14} color="#38bdf8" /></TouchableOpacity>
                                    )}
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* Feature Cards Grid */}
                        <View className="flex-col md:flex-row gap-3 md:gap-4 mb-8">
                            <TouchableOpacity onPress={() => router.push('/hero-management')} className={`flex-1 p-4 md:p-5 rounded-2xl border shadow-2xl active:scale-[0.98] transition-all ${isDark ? 'bg-[#0f172a] border-slate-800 shadow-blue-900/20' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                                <View className="flex-row items-center">
                                    <View className={`w-10 h-10 rounded-xl items-center justify-center border mr-3 md:mr-4 ${isDark ? 'bg-[#38bdf8]/10 border-[#38bdf8]/20' : 'bg-blue-50 border-blue-100'}`}>
                                        <Ionicons name="people" size={22} color={isDark ? "#38bdf8" : "#2563eb"} />
                                    </View>
                                    <View>
                                        <Text className={`text-xl md:text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>영웅 정보</Text>
                                        <Text className={`font-semibold text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>스탯 및 스킬</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => router.push('/growth/events')} className={`flex-1 p-4 md:p-5 rounded-2xl border shadow-2xl active:scale-[0.98] transition-all ${isDark ? 'bg-[#0f172a] border-slate-800 shadow-blue-900/20' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                                <View className="flex-row items-center">
                                    <View className={`w-10 h-10 rounded-xl items-center justify-center border mr-3 md:mr-4 ${isDark ? 'bg-blue-500/10 border-blue-400/20' : 'bg-sky-50 border-sky-100'}`}>
                                        <Ionicons name="calendar" size={22} color={isDark ? "#60a5fa" : "#0284c7"} />
                                    </View>
                                    <View>
                                        <Text className={`text-xl md:text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>이벤트</Text>
                                        <Text className={`font-semibold text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>연맹전략 및 일정</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => router.push('/strategy-sheet')} className={`flex-1 p-4 md:p-5 rounded-2xl border shadow-2xl active:scale-[0.98] transition-all ${isDark ? 'bg-[#0f172a] border-slate-800 shadow-emerald-900/20' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                                <View className="flex-row items-center">
                                    <View className={`w-10 h-10 rounded-xl items-center justify-center border mr-3 md:mr-4 ${isDark ? 'bg-emerald-500/10 border-emerald-400/20' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <Ionicons name="map" size={22} color={isDark ? "#10b981" : "#059669"} />
                                    </View>
                                    <View>
                                        <Text className={`text-xl md:text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>전략 문서</Text>
                                        <Text className={`font-semibold text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>배치도 및 공지</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Weekly Events List - Minimalist App Style */}
                        <View className="mb-14">
                            <View className={`flex-row items-center justify-between mb-8 px-5 py-4 rounded-3xl ${isDark ? 'bg-slate-900/40' : 'bg-slate-100/60'}`}>
                                <View className="flex-row items-center">
                                    <View className={`w-1.5 h-6 rounded-full mr-4 ${isDark ? 'bg-[#38bdf8]' : 'bg-blue-600'}`} />
                                    <Text className={`text-2xl md:text-3xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>금주의 이벤트</Text>
                                </View>
                                <View className={`px-3 py-1 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-white shadow-sm'}`}>
                                    <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>WEEKLY</Text>
                                </View>
                            </View>

                            <View className="flex-col gap-3">
                                {loading ? (
                                    <View className={`p-16 rounded-[32px] border border-dashed items-center justify-center ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                        <Text className={`font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>일정을 불러오는 중...</Text>
                                    </View>
                                ) : displayEvents.length > 0 ? (
                                    <View className="flex-col gap-4">
                                        {displayEvents.map((event, idx) => {
                                            const isActive = isEventActive(event);
                                            const isExpired = isEventExpired(event);
                                            const isUpcoming = !isActive && !isExpired;

                                            const getEventIcon = (id: string) => {
                                                if (id.includes('bear')) return 'paw-outline';
                                                if (id.includes('frost') || id.includes('weapon')) return 'shield-half-outline';
                                                if (id.includes('castle') || id.includes('fortress')) return 'business-outline';
                                                if (id.includes('championship')) return 'trophy-outline';
                                                return 'calendar-clear-outline';
                                            };

                                            const pointColor = '#0ea5e9'; // Point Blue
                                            const titleColor = isExpired ? (isDark ? 'text-slate-600' : 'text-slate-400') : (isDark ? 'text-white' : 'text-slate-900');
                                            const scheduleColor = isExpired ? (isDark ? 'text-slate-700' : 'text-slate-300') : (isUpcoming ? (isDark ? 'text-slate-400' : 'text-slate-600') : (isDark ? 'text-slate-200' : 'text-slate-700'));
                                            const infoColor = isDark ? 'text-slate-500' : 'text-slate-500';

                                            return (
                                                <TouchableOpacity
                                                    key={idx}
                                                    onPress={() => router.push({ pathname: '/growth/events', params: { focusId: event.eventId } })}
                                                    className="active:scale-[0.98] transition-all"
                                                >
                                                    <View className={`p-8 md:p-10 rounded-[40px] border shadow-2xl ${isActive ? (isDark ? 'bg-slate-900 border-[#0ea5e9]/50 shadow-[#0ea5e9]/10' : 'bg-white border-[#0ea5e9]/20 shadow-blue-100/20') : (isDark ? 'bg-slate-900 border-slate-800 shadow-black/20' : 'bg-white border-slate-200 shadow-slate-200/40')}`}>
                                                        <View className="flex-row items-center justify-between mb-8">
                                                            <View className="flex-row items-center flex-1 mr-3">
                                                                <View className={`w-14 h-14 rounded-[22px] items-center justify-center mr-5 ${isDark ? 'bg-slate-800/80' : 'bg-white shadow-sm border border-slate-100/80'}`}>
                                                                    <Ionicons name={getEventIcon(event.eventId)} size={28} color={isActive ? pointColor : (isExpired ? '#64748b' : '#94a3b8')} />
                                                                </View>
                                                                <View className="flex-1">
                                                                    <Text className={`text-2xl md:text-3xl font-black tracking-tight mb-2 ${titleColor} ${isExpired ? 'line-through opacity-40' : ''}`}>{event.title}</Text>
                                                                    <View className="flex-row items-center">
                                                                        <Ionicons
                                                                            name={isActive ? "checkmark-circle" : (isUpcoming ? "time" : "checkmark-circle-outline")}
                                                                            size={13}
                                                                            color={isActive ? "#10b981" : (isUpcoming ? pointColor : "#94a3b8")}
                                                                            style={{ marginRight: 6 }}
                                                                        />
                                                                        <Text className={`text-[11px] font-black uppercase tracking-[0.12em] ${infoColor}`}>
                                                                            {isActive ? '진행 중' : (isUpcoming ? '예정' : '종료')}
                                                                        </Text>
                                                                    </View>
                                                                </View>
                                                            </View>
                                                            {isActive ? (
                                                                <Animated.View
                                                                    className={`flex-row items-center px-6 py-3 rounded-2xl bg-[#FFD700] shadow-2xl`}
                                                                    style={{
                                                                        opacity: flickerAnim,
                                                                        transform: [{ scale: scaleAnim }],
                                                                        shadowColor: '#FFD700',
                                                                        shadowOffset: { width: 0, height: 4 },
                                                                        shadowOpacity: 0.8,
                                                                        shadowRadius: 15,
                                                                        elevation: 12
                                                                    }}
                                                                >
                                                                    <Text className={`text-black text-[13px] font-black tracking-widest mr-2`}>지금 진행</Text>
                                                                    <Ionicons name="chevron-forward-circle" size={18} color="black" />
                                                                </Animated.View>
                                                            ) : isExpired ? (
                                                                <View className={`px-4 py-2 rounded-full border ${isDark ? 'bg-black/40 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                                                                    <Text className={`text-slate-500 text-[11px] font-black tracking-tighter`}>종료</Text>
                                                                </View>
                                                            ) : (
                                                                <View className={`px-4 py-2 rounded-full border ${isDark ? 'bg-black/20 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                                                    <Text className={`text-slate-400 text-[11px] font-black tracking-tighter`}>예정</Text>
                                                                </View>
                                                            )}
                                                        </View>

                                                        <View className="flex-col gap-3">
                                                            {!!event.day && !event.time && event.day !== '요새전/성채전' && (
                                                                <View className={`p-6 rounded-3xl border ${isDark ? 'bg-black/30 border-slate-800/60' : 'bg-slate-50/80 border-slate-100'}`}>
                                                                    {(() => {
                                                                        const formattedDay = event.day.replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                                                        let utcText = '';
                                                                        const isRange = event.day.includes('~');
                                                                        if (isRange) {
                                                                            const parts = event.day.split('~').map((x: string) => x.trim());
                                                                            const sDateUtc = getUTCString(parts[0]);
                                                                            const eDateUtc = getUTCString(parts[1]);
                                                                            if (sDateUtc && eDateUtc) utcText = `${sDateUtc} ~ ${eDateUtc}`;
                                                                            else {
                                                                                const sWeeklyUtc = getUTCTimeString(parts[0], false);
                                                                                const eWeeklyUtc = getUTCTimeString(parts[1], false);
                                                                                if (sWeeklyUtc && eWeeklyUtc) utcText = `${sWeeklyUtc} ~ ${eWeeklyUtc}`;
                                                                            }
                                                                        } else {
                                                                            const dateUtc = getUTCString(event.day);
                                                                            if (dateUtc) utcText = dateUtc;
                                                                            else {
                                                                                const weeklyUtc = getUTCTimeString(event.day);
                                                                                if (weeklyUtc) utcText = weeklyUtc;
                                                                            }
                                                                        }
                                                                        const renderLine = (str: string, textClass: string, isUtc = false) => {
                                                                            if (!str.includes('~')) return <View className="flex-row items-center">{isUtc && <Text className="mr-2 text-xs">🌐</Text>}<Text className={textClass}>{str}</Text></View>;
                                                                            const [s, e] = str.split('~').map(x => x.trim());
                                                                            return (
                                                                                <View className="flex-row flex-wrap items-center">
                                                                                    {isUtc && <Text className="mr-2 text-xs">🌐</Text>}
                                                                                    <Text className={textClass}>{s}</Text>
                                                                                    <Text className={`${textClass} mx-3 opacity-30 font-normal`}>~</Text>
                                                                                    <Text className={textClass}>{e}</Text>
                                                                                </View>
                                                                            );
                                                                        };
                                                                        const dayColor = isExpired ? (isDark ? "text-slate-600" : "text-slate-400") : (isDark ? "text-slate-200" : "text-slate-700");
                                                                        const utcColor = isDark ? "text-slate-500" : "text-slate-500";
                                                                        return (
                                                                            <>
                                                                                {renderLine(formattedDay, `${dayColor} font-bold text-base ${isExpired ? 'line-through opacity-40' : ''}`)}
                                                                                {!!utcText && (
                                                                                    <View className="mt-3 pt-3 border-t border-slate-800/10">
                                                                                        {renderLine(utcText, `${utcColor} text-xs font-bold`, true)}
                                                                                    </View>
                                                                                )}
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </View>
                                                            )}
                                                            {!!event.time && (
                                                                <View className="gap-3">
                                                                    {event.isBearSplit ? (
                                                                        <View className={`rounded-2xl border overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                                                            {/* Table Header */}
                                                                            <View className={`flex-row px-4 py-2 border-b ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                                                                <Text className={`flex-1 text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>요일</Text>
                                                                                <Text className={`flex-[1.5] text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>로컬 시간</Text>
                                                                                <Text className={`flex-[1.5] text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>UTC 시간</Text>
                                                                            </View>
                                                                            {/* Table Body */}
                                                                            <View className={`${isDark ? 'bg-black/20' : 'bg-white'}`}>
                                                                                {event.time.split(/[,|]/).map((item: string, iIdx: number) => {
                                                                                    const trimmed = item.trim();
                                                                                    if (!trimmed) return null;
                                                                                    const isLive = checkItemActive(trimmed);

                                                                                    // Extract Day and Time more robustly
                                                                                    const dayMatch = trimmed.match(/[일월화수목금토]/);
                                                                                    const day = dayMatch ? dayMatch[0] : '-';
                                                                                    const localTime = trimmed.replace(/[일월화수목금토]\s*/, '').trim();
                                                                                    const utcStr = getUTCTimeString(trimmed);

                                                                                    return (
                                                                                        <View key={iIdx} className={`flex-row items-center px-5 py-5 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-200/50'} last:border-0`}>
                                                                                            <Text className={`flex-1 font-black text-base ${isLive ? 'text-amber-500' : (isDark ? 'text-slate-200' : 'text-slate-900')} ${isExpired ? 'line-through opacity-40' : ''}`}>{day}</Text>
                                                                                            <Text className={`flex-[1.5] font-bold text-base ${isLive ? 'text-amber-500' : (isDark ? 'text-slate-400' : 'text-slate-700')} ${isExpired ? 'line-through opacity-40' : ''}`}>{localTime}</Text>
                                                                                            <View className="flex-[1.5] flex-row items-center">
                                                                                                <Text className="text-xs mr-2 opacity-30">🌐</Text>
                                                                                                <Text className={`text-[13px] font-bold ${isLive ? 'text-amber-500/80' : (isDark ? 'text-slate-500' : 'text-slate-500')}`}>{utcStr || '-'}</Text>
                                                                                            </View>
                                                                                        </View>
                                                                                    );
                                                                                })}
                                                                            </View>
                                                                        </View>
                                                                    ) : (
                                                                        event.time.split(' / ').map((part: string, pIdx: number) => {
                                                                            const trimmed = part.trim();
                                                                            if (!trimmed) return null;
                                                                            const colonIdx = trimmed.indexOf(':');
                                                                            const isTimeColon = colonIdx > 0 && /\d/.test(trimmed[colonIdx - 1]) && /\d/.test(trimmed[colonIdx + 1]);
                                                                            const rawLabel = (colonIdx > -1 && !isTimeColon) ? trimmed.substring(0, colonIdx).trim() : '';
                                                                            let label = rawLabel;
                                                                            if (event.eventId === 'a_bear' || event.eventId === 'alliance_bear') {
                                                                                label = label.replace('1군', '곰1').replace('2군', '곰2');
                                                                            }
                                                                            const content = rawLabel ? trimmed.substring(colonIdx + 1).trim() : trimmed;
                                                                            return (
                                                                                <View key={pIdx} className={`p-6 rounded-3xl border ${isDark ? 'bg-black/30 border-slate-800/60' : 'bg-slate-50/80 border-slate-100'}`}>
                                                                                    {!!label && (
                                                                                        <View className="flex-row items-center mb-4">
                                                                                            <View className={`px-2.5 py-1 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                                                                                <Text className={`text-[11px] font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{label}</Text>
                                                                                            </View>
                                                                                            {content.split(/[,|]/).some(item => checkItemActive(item.trim())) && (
                                                                                                <Animated.View
                                                                                                    className={`ml-3 flex-row items-center px-2 py-0.5 rounded-full bg-[#FFD700]`}
                                                                                                    style={{ opacity: flickerAnim, transform: [{ scale: scaleAnim }] }}
                                                                                                >
                                                                                                    <Text className={`text-black text-[9px] font-black uppercase tracking-tighter`}>진행중</Text>
                                                                                                </Animated.View>
                                                                                            )}
                                                                                        </View>
                                                                                    )}
                                                                                    <View className="flex-row flex-wrap gap-4">
                                                                                        {content.split(/[,|]/).map((item, iIdx) => {
                                                                                            const isLive = checkItemActive(item.trim());
                                                                                            const formatted = item.trim().replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                                                                            const utcStr = getUTCTimeString(item.trim());
                                                                                            return (
                                                                                                <View key={iIdx} className="flex-1 min-w-[150px]">
                                                                                                    <Text className={`${isLive ? 'text-amber-500' : (isExpired ? (isDark ? 'text-slate-600' : 'text-slate-400') : (isDark ? 'text-slate-200' : 'text-slate-700'))} font-semibold text-base ${isExpired ? 'line-through opacity-40' : ''}`}>{formatted}</Text>
                                                                                                    {!!utcStr && (
                                                                                                        <View className="flex-row items-center mt-1.5">
                                                                                                            <Text className="text-xs mr-2 opacity-30">🌐</Text>
                                                                                                            <Text className={`${isLive ? 'text-amber-500/80' : (isDark ? 'text-slate-500' : 'text-slate-400')} text-xs font-medium`}>{utcStr}</Text>
                                                                                                        </View>
                                                                                                    )}
                                                                                                </View>
                                                                                            );
                                                                                        })}
                                                                                    </View>
                                                                                </View>
                                                                            );
                                                                        })
                                                                    )}
                                                                </View>
                                                            )}
                                                        </View>
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                ) : (
                                    <View className={`p-16 rounded-[32px] border border-dashed items-center justify-center ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                        <Text className={`font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>등록된 일정이 없습니다.</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Modals */}
            <Modal visible={loginModalVisible} transparent animationType="fade" onRequestClose={() => setLoginModalVisible(false)}>
                <View className="flex-1 bg-black/85 items-center justify-center p-6">
                    <BlurView intensity={60} className="absolute inset-0" />
                    <View className={`w-full max-w-sm p-10 rounded-[48px] border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <View className="items-center mb-8">
                            <View className={`w-16 h-16 rounded-3xl items-center justify-center mb-4 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                                <Ionicons name="shield-checkmark" size={32} color="#38bdf8" />
                            </View>
                            <Text className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>관리자 인증</Text>
                            <Text className={`mt-2 text-sm font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>보안 구역: 운영진만 접근 가능합니다</Text>
                        </View>

                        <View className="space-y-6 mb-12">
                            <View className="relative">
                                <View className="absolute left-6 top-6 z-10">
                                    <Ionicons name="person" size={20} color={isDark ? "#38bdf8" : "#2563eb"} />
                                </View>
                                <TextInput
                                    placeholder="영주 이름"
                                    placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                                    value={loginInput}
                                    onChangeText={(t) => { setLoginInput(t); setLoginError(''); }}
                                    autoCapitalize="none"
                                    className={`p-6 pl-16 rounded-3xl font-black border-2 text-lg ${isDark ? 'bg-slate-950 text-white border-slate-800 focus:border-blue-500/50' : 'bg-slate-50 text-slate-800 border-slate-100 focus:border-blue-500'}`}
                                />
                            </View>

                            <View className="relative mt-2">
                                <View className="absolute left-6 top-6 z-10">
                                    <Ionicons name="lock-closed" size={20} color={isDark ? "#38bdf8" : "#2563eb"} />
                                </View>
                                <TextInput
                                    placeholder="비밀번호"
                                    placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                                    value={passwordInput}
                                    onChangeText={(t) => { setPasswordInput(t); setLoginError(''); }}
                                    secureTextEntry={true}
                                    autoCapitalize="none"
                                    onSubmitEditing={handleLogin}
                                    className={`p-6 pl-16 rounded-3xl font-black border-2 text-lg ${isDark ? 'bg-slate-950 text-white border-slate-800 focus:border-blue-500/50' : 'bg-slate-50 text-slate-800 border-slate-100 focus:border-blue-500'}`}
                                />
                            </View>

                            {!!loginError && (
                                <View className="flex-row items-center mt-3 px-2 animate-in fade-in slide-in-from-top-1">
                                    <Ionicons name="alert-circle" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                                    <Text className="text-red-500 font-black text-sm">{loginError}</Text>
                                </View>
                            )}
                        </View>

                        <View className="flex-row gap-4">
                            <TouchableOpacity
                                onPress={() => { setLoginModalVisible(false); setLoginError(''); setPasswordInput(''); }}
                                className={`flex-1 py-5 rounded-[28px] border items-center justify-center active:scale-95 transition-all ${isDark ? 'bg-slate-800/20 border-slate-800' : 'bg-slate-100 border-slate-200'}`}
                            >
                                <Text className={`text-center font-bold text-lg ${isDark ? 'text-slate-600' : 'text-slate-500'}`}>취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleLogin}
                                className="flex-[2] bg-[#0091ff] py-5 rounded-[28px] shadow-2xl shadow-blue-500/60 items-center justify-center hover:bg-[#1a9dff] active:scale-95 transition-all"
                            >
                                <Text className="text-white text-center font-black text-xl tracking-tight">로그인</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={adminMenuVisible} transparent animationType="fade" onRequestClose={() => setAdminMenuVisible(false)}>
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <View className={`w-full max-w-sm p-6 rounded-[32px] border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <Text className={`text-2xl font-bold mb-8 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>관리자 메뉴</Text>
                        <TouchableOpacity onPress={async () => { await logout(); setAdminMenuVisible(false); }} className={`p-5 rounded-2xl mb-4 flex-row items-center justify-center border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}><Ionicons name="log-out-outline" size={24} color="#ef4444" style={{ marginRight: 8 }} /><Text className={`font-bold text-xl ${isDark ? 'text-white' : 'text-slate-800'}`}>로그아웃</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => { setAdminMenuVisible(false); router.push('/admin'); }} className={`p-5 rounded-2xl mb-4 flex-row items-center justify-center border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}><Ionicons name="people-outline" size={24} color="#38bdf8" style={{ marginRight: 8 }} /><Text className={`font-bold text-xl ${isDark ? 'text-white' : 'text-slate-800'}`}>연맹원 관리</Text></TouchableOpacity>
                        {!!isSuperAdmin && (
                            <View className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                <Text className={`font-semibold mb-3 text-center text-xs ${isDark ? 'text-[#38bdf8]' : 'text-blue-600'}`}>슈퍼 관리자 메뉴</Text>
                                <TouchableOpacity onPress={() => setShowAdminList(!showAdminList)} className={`p-4 rounded-xl border mb-3 flex-row justify-center items-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}><Ionicons name="people-outline" size={18} color="#38bdf8" style={{ marginRight: 8 }} /><Text className={`font-semibold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>운영진 관리</Text></TouchableOpacity>
                                {!!showAdminList && (
                                    <View className={`p-3 rounded-xl mb-3 border ${isDark ? 'bg-black/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                        <View className="mb-3 space-y-2">
                                            <TextInput className={`w-full p-3 rounded-xl border text-xs font-semibold ${isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200'}`} placeholder="운영진 이름" placeholderTextColor={isDark ? "#475569" : "#94a3b8"} value={newAdminName} onChangeText={setNewAdminName} />
                                            <TextInput className={`w-full p-3 rounded-xl border text-xs font-semibold ${isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200'}`} placeholder="비밀번호 설정" placeholderTextColor={isDark ? "#475569" : "#94a3b8"} value={newAdminPassword} onChangeText={setNewAdminPassword} secureTextEntry={true} />
                                            <View className="flex-row gap-2 pt-1">
                                                <TouchableOpacity onPress={() => setNewAdminRole(newAdminRole === 'admin' ? 'super_admin' : 'admin')} className={`flex-[2.5] py-3 px-4 justify-center items-center rounded-xl border ${newAdminRole === 'super_admin' ? (isDark ? 'bg-amber-600/20 border-amber-500' : 'bg-amber-50 border-amber-200') : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200')}`}><View className="flex-row items-center"><Ionicons name={newAdminRole === 'super_admin' ? 'shield-checkmark' : 'person'} size={14} color={newAdminRole === 'super_admin' ? '#fbbf24' : '#94a3b8'} style={{ marginRight: 6 }} /><Text className={`${newAdminRole === 'super_admin' ? 'text-amber-500' : 'text-slate-400'} text-xs font-bold`}>{newAdminRole === 'super_admin' ? '슈퍼 관리자' : '일반 운영진'}</Text></View></TouchableOpacity>
                                                <TouchableOpacity onPress={async () => { const hashed = newAdminPassword ? await hashPassword(newAdminPassword) : ''; if (await addAdmin(newAdminName, auth.adminName || '', newAdminRole, hashed)) { setNewAdminName(''); setNewAdminPassword(''); showCustomAlert('성공', '운영진이 추가되었습니다.', 'success'); } }} className="flex-1 bg-blue-600 py-3 justify-center items-center rounded-xl shadow-lg shadow-blue-500/30"><Ionicons name="add" size={20} color="white" /></TouchableOpacity>
                                            </View>
                                        </View>
                                        <View className="max-h-48"><ScrollView nestedScrollEnabled>{dynamicAdmins.map(a => (<View key={a.name} className={`flex-row justify-between items-center py-2 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}><View className="flex-row items-center"><Text className={`text-xs mr-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{a.name}</Text><View className={`px-1.5 py-0.5 rounded ${a.role === 'super_admin' ? (isDark ? 'bg-amber-500/20' : 'bg-amber-100') : (isDark ? 'bg-slate-700/50' : 'bg-slate-100')}`}><Text className={`${a.role === 'super_admin' ? 'text-amber-500' : (isDark ? 'text-slate-500' : 'text-slate-400')} text-[8px] font-bold`}>{a.role === 'super_admin' ? 'SUPER' : 'ADMIN'}</Text></View></View><TouchableOpacity onPress={() => removeAdmin(a.name)}><Ionicons name="trash-outline" size={14} color="#ef4444" /></TouchableOpacity></View>))}</ScrollView></View>
                                    </View>
                                )}
                                <TouchableOpacity onPress={() => { showCustomAlert('전체 데이터 초기화', '🚨 모든 이벤트 일정이 영구적으로 삭제됩니다.\n정말 진행하시겠습니까?', 'confirm', async () => { await clearAllSchedules(); showCustomAlert('초기화 완료', '모든 일정이 성공적으로 삭제되었습니다.', 'success'); }); }} className={`p-4 rounded-xl border flex-row justify-center items-center ${isDark ? 'bg-red-500/10 border-red-500/40' : 'bg-red-50 border-red-100'}`}><Ionicons name="trash-bin-outline" size={18} color="#ef4444" style={{ marginRight: 8 }} /><Text className="text-red-400 font-semibold text-sm">전체 일정 초기화</Text></TouchableOpacity>
                            </View>
                        )}
                        <TouchableOpacity onPress={() => setAdminMenuVisible(false)} className={`py-4 rounded-2xl border mt-4 ${isDark ? 'bg-slate-800/50 border-slate-700/50' : 'bg-slate-100 border-slate-200'}`}><Text className={`text-center font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>닫기</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={customAlert.visible} transparent animationType="fade" onRequestClose={() => setCustomAlert({ ...customAlert, visible: false })}>
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <BlurView intensity={40} className="absolute inset-0" />
                    <View className={`w-full max-w-sm p-10 rounded-[48px] border shadow-2xl items-center ${isDark ? 'bg-slate-900 border-slate-800/60' : 'bg-white border-slate-100'}`}>
                        {/* Icon Section */}
                        <View className={`w-24 h-24 rounded-full items-center justify-center mb-8 ${customAlert.type === 'success' ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : (customAlert.type === 'error' || customAlert.type === 'confirm') ? (isDark ? 'bg-red-500/10' : 'bg-red-50') : (isDark ? 'bg-amber-500/10' : 'bg-amber-50')}`}>
                            <View className={`w-16 h-16 rounded-full items-center justify-center ${customAlert.type === 'success' ? 'bg-emerald-500' : (customAlert.type === 'error' || customAlert.type === 'confirm') ? 'bg-red-500' : 'bg-amber-500'}`}>
                                <Ionicons
                                    name={customAlert.type === 'success' ? 'checkmark' : (customAlert.type === 'error' || customAlert.type === 'confirm') ? 'close' : 'warning'}
                                    size={36}
                                    color={isDark ? "black" : "white"}
                                />
                            </View>
                        </View>

                        <Text className={`text-3xl font-black mb-4 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>{customAlert.title}</Text>
                        <Text className={`text-center mb-10 text-lg leading-7 font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{customAlert.message}</Text>

                        {customAlert.type === 'confirm' ? (
                            <View className="flex-row gap-3 w-full">
                                <TouchableOpacity onPress={() => setCustomAlert({ ...customAlert, visible: false })} className={`flex-1 py-5 rounded-3xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                                    <Text className={`text-center font-bold text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>취소</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { setCustomAlert({ ...customAlert, visible: false }); if (customAlert.onConfirm) customAlert.onConfirm(); }} className="flex-[2] py-5 bg-red-600 rounded-3xl shadow-lg shadow-red-500/30">
                                    <Text className="text-white text-center font-black text-lg">삭제하기</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                                className={`py-5 w-full rounded-3xl shadow-xl active:scale-[0.98] transition-all ${customAlert.type === 'success' ? 'bg-emerald-500 shadow-emerald-500/20' : customAlert.type === 'error' ? 'bg-red-600 shadow-red-500/20' : 'bg-amber-500 shadow-amber-500/20'}`}
                            >
                                <Text className="text-white text-center font-black text-xl">확인</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

            <Modal visible={noticeDetailVisible} transparent animationType="fade" onRequestClose={() => setNoticeDetailVisible(false)}>
                <View className="flex-1 bg-black/85 items-center justify-center p-6">
                    <View className={`w-full max-w-lg p-0 rounded-[32px] border shadow-2xl overflow-hidden max-h-[80%] flex-col ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <View className={`p-6 border-b flex-row items-center justify-between ${isDark ? 'bg-slate-800/80 border-slate-700/50' : 'bg-slate-50 border-slate-100'}`}><Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>공지사항</Text><TouchableOpacity onPress={() => setNoticeDetailVisible(false)} className={`p-2 rounded-full border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}><Ionicons name="close" size={24} color={isDark ? "white" : "#1e293b"} /></TouchableOpacity></View>
                        <ScrollView className="p-8"><Text className={`text-xl leading-9 font-medium tracking-wide ${isDark ? 'text-amber-100/90' : 'text-slate-700'}`}>{notice?.content || ''}</Text></ScrollView>
                    </View>
                </View>
            </Modal>

            <Modal visible={installModalVisible} transparent animationType="fade" onRequestClose={() => setInstallModalVisible(false)}>
                <View className="flex-1 bg-black/90 items-center justify-center p-6">
                    <View className={`w-full max-w-sm p-8 rounded-[32px] border items-center ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100 shadow-2xl'}`}><Ionicons name="download-outline" size={48} color="#38bdf8" style={{ marginBottom: 24 }} /><Text className={`text-2xl font-bold mb-4 ${isDark ? 'text-white' : 'text-slate-900'}`}>앱 설치 방법</Text><Text className={`text-center mb-8 text-lg leading-7 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>브라우저 메뉴에서{"\n"}<Text className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>'홈 화면에 추가'</Text>를 선택하세요.</Text><TouchableOpacity onPress={() => setInstallModalVisible(false)} className="bg-[#38bdf8] py-4 w-full rounded-2xl"><Text className="text-[#0f172a] text-center font-bold">확인</Text></TouchableOpacity></View>
                </View>
            </Modal>

            <Modal visible={noticeModalVisible} transparent animationType="fade" onRequestClose={() => setNoticeModalVisible(false)}>
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <View className={`w-full max-w-md p-6 rounded-[32px] border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <Text className={`text-xl font-bold mb-6 ${isDark ? 'text-white' : 'text-slate-900'}`}>공지사항 설정</Text>
                        <TextInput multiline value={editNoticeContent} onChangeText={setEditNoticeContent} className={`p-4 rounded-2xl text-lg h-40 mb-6 border ${isDark ? 'bg-slate-800 text-white border-slate-700' : 'bg-slate-50 text-slate-800 border-slate-200'}`} />
                        <View className={`flex-row items-center justify-between mb-8 p-4 rounded-2xl border ${isDark ? 'bg-slate-800/30 border-slate-700/30' : 'bg-slate-50 border-slate-200'}`}><Text className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>공지 노출</Text><Switch value={editNoticeVisible} onValueChange={setEditNoticeVisible} trackColor={{ false: '#cbd5e1', true: '#38bdf8' }} /></View>
                        <View className="flex-row gap-3"><TouchableOpacity onPress={() => setNoticeModalVisible(false)} className={`flex-1 py-4 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-100'}`}><Text className={isDark ? "text-slate-400 text-center" : "text-slate-500 text-center"}>취소</Text></TouchableOpacity><TouchableOpacity onPress={handleSaveNotice} className="flex-1 bg-[#38bdf8] py-4 rounded-2xl"><Text className="text-[#0f172a] text-center font-bold">저장</Text></TouchableOpacity></View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
