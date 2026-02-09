import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Image,
    Platform,
    Modal,
    Pressable,
    TextInput,
    Switch,
    Dimensions,
    Alert,
    Animated,
    LayoutAnimation,
    UIManager,
    ImageBackground,
    ActivityIndicator
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useAuth, useTheme } from './context';
import { MASTER_CREDENTIALS, SUPER_ADMINS, AdminStatus } from '../data/admin-config';
import { useFirestoreEventSchedules } from '../hooks/useFirestoreEventSchedules';
import { useFirestoreAdmins } from '../hooks/useFirestoreAdmins';
// @ts-ignore
import { useFirestoreNotice } from '../hooks/useFirestoreNotice';
import { INITIAL_WIKI_EVENTS, WikiEvent } from '../data/wiki-events';
import { ADDITIONAL_EVENTS } from '../data/new-events';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hashPassword } from '../utils/crypto';
import { LinearGradient } from 'expo-linear-gradient';
import { doc, setDoc, getDoc, collection, getDocs, query, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import AdminManagement from '../components/AdminManagement';

export default function Home() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const { auth, login, logout, serverId, allianceId, setAllianceInfo, dashboardScrollY, setDashboardScrollY } = useAuth();
    const { theme, toggleTheme, fontSizeScale, changeFontSize } = useTheme();
    const isDark = theme === 'dark';
    const [isGateOpen, setIsGateOpen] = useState(!serverId || !allianceId);
    const [isLoading, setIsLoading] = useState(false);
    const [inputServer, setInputServer] = useState('');
    const [inputAlliance, setInputAlliance] = useState('');
    const [inputUserId, setInputUserId] = useState('');
    const [inputPassword, setInputPassword] = useState('');
    const [isRegisterMode, setIsRegisterMode] = useState(false);

    const noticeData = useFirestoreNotice(serverId, allianceId);
    const { notice, saveNotice } = noticeData;
    const { schedules, loading, clearAllSchedules } = useFirestoreEventSchedules(serverId, allianceId);
    const [adminMenuVisible, setAdminMenuVisible] = useState(params.showAdminMenu === 'true');
    const mainScrollRef = useRef<ScrollView>(null);

    // -- Trigger Admin Menu via Query Params (For Back Button) --
    useEffect(() => {
        if (params.showAdminMenu === 'true' && !adminMenuVisible) {
            setAdminMenuVisible(true);
        }
        if (params.showAdminMenu === 'true') {
            router.setParams({ showAdminMenu: undefined });
        }
    }, [params.showAdminMenu]);

    // -- Scroll Restoration --
    useEffect(() => {
        if (serverId && allianceId && !isLoading && dashboardScrollY > 0) {
            // Small timeout to ensure layout is ready
            const timer = setTimeout(() => {
                mainScrollRef.current?.scrollTo({ y: dashboardScrollY, animated: false });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [serverId, allianceId, isLoading]);

    // -- Modals --
    const [loginModalVisible, setLoginModalVisible] = useState(false);
    const [loginInput, setLoginInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isSuperAdminDashboardVisible, setIsSuperAdminDashboardVisible] = useState(false);
    const [superAdminTab, setSuperAdminTab] = useState<'pending' | 'alliances'>('pending');
    const [allRequests, setAllRequests] = useState<any[]>([]);
    const [isSuperAdminLoading, setIsSuperAdminLoading] = useState(true);
    const [adminDashboardVisible, setAdminDashboardVisible] = useState(false);

    const [recentServers, setRecentServers] = useState<string[]>([]);
    const [recentAlliances, setRecentAlliances] = useState<string[]>([]);
    const [recentUserIds, setRecentUserIds] = useState<string[]>([]);
    const [activeInput, setActiveInput] = useState<'server' | 'alliance' | 'userid' | null>(null);

    const saveToHistory = async (key: string, value: string) => {
        if (!value || value.trim() === '') return;
        const storageKey = `recent_${key}`;
        try {
            const existing = await AsyncStorage.getItem(storageKey);
            let list: string[] = existing ? JSON.parse(existing) : [];
            list = [value, ...list.filter(item => item !== value)].slice(0, 5);
            await AsyncStorage.setItem(storageKey, JSON.stringify(list));
            if (key === 'server') setRecentServers(list);
            if (key === 'alliance') setRecentAlliances(list);
            if (key === 'userid') setRecentUserIds(list);
        } catch (e) {
            console.error('Save history error:', e);
        }
    };
    const [noticeDetailVisible, setNoticeDetailVisible] = useState(false);
    const [noticePopupVisible, setNoticePopupVisible] = useState(false);
    const [noticePopupDontShow, setNoticePopupDontShow] = useState(false);
    const [timezone, setTimezone] = useState<'KST' | 'UTC'>('KST');

    // Check if notice popup should be shown on load
    useEffect(() => {
        const checkNoticePopup = async () => {
            // Don't show popup for logged-in admins (they can see via banner)
            if (auth.isLoggedIn) return;
            if (!notice || !notice.visible || !notice.content) return;

            try {
                // Generate a simple hash of notice content to detect changes
                const noticeHash = btoa(unescape(encodeURIComponent(notice.content))).substring(0, 20);
                const storageKey = `notice_dismissed_${serverId}_${allianceId}`;
                const dismissedData = await AsyncStorage.getItem(storageKey);

                if (dismissedData) {
                    const parsed = JSON.parse(dismissedData);
                    // Check if permanently dismissed for this notice
                    if (parsed.hash === noticeHash && parsed.permanent) {
                        return; // Don't show
                    }
                    // Check if dismissed today
                    if (parsed.hash === noticeHash && parsed.today) {
                        const dismissedDate = new Date(parsed.date);
                        const today = new Date();
                        if (dismissedDate.toDateString() === today.toDateString()) {
                            return; // Don't show today
                        }
                    }
                }

                // Show the popup
                setTimeout(() => setNoticePopupVisible(true), 500);
            } catch (e) {
                console.error('Notice popup check error:', e);
            }
        };

        checkNoticePopup();
    }, [notice, serverId, allianceId]);

    const dismissNoticePopup = async (permanent: boolean = false, today: boolean = false) => {
        setNoticePopupVisible(false);
        setNoticePopupDontShow(false);

        if ((permanent || today) && notice?.content) {
            try {
                const noticeHash = btoa(unescape(encodeURIComponent(notice.content))).substring(0, 20);
                const storageKey = `notice_dismissed_${serverId}_${allianceId}`;
                await AsyncStorage.setItem(storageKey, JSON.stringify({
                    hash: noticeHash,
                    permanent,
                    today,
                    date: new Date().toISOString()
                }));
            } catch (e) {
                console.error('Notice dismiss error:', e);
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

    // Dynamic Admins Support
    const { dynamicAdmins, addAdmin, removeAdmin } = useFirestoreAdmins(serverId, allianceId);
    const [newAdminName, setNewAdminName] = useState('');
    const [newAdminPassword, setNewAdminPassword] = useState('');
    const [newAdminRole, setNewAdminRole] = useState<'admin' | 'alliance_admin'>('admin');
    const [showAdminList, setShowAdminList] = useState(false);
    const isSuperAdmin = auth.isLoggedIn && (
        auth.role === 'master' ||
        auth.role === 'super_admin'
    );

    const [hoveredHeaderBtn, setHoveredHeaderBtn] = useState<string | null>(null);
    const [adminMenuHover, setAdminMenuHover] = useState<string | null>(null);


    const handleMigrateToAlliance = async () => {
        if (!serverId || !allianceId) {
            showCustomAlert('오류', '서버와 연맹을 먼저 선택해야 합니다.', 'error');
            return;
        }

        try {
            // 1. Notice Migration
            const oldNoticeRef = doc(db, 'config', 'notice');
            const oldNoticeSnap = await getDoc(oldNoticeRef);
            if (oldNoticeSnap.exists()) {
                const newNoticeRef = doc(db, "servers", serverId, "alliances", allianceId, "settings", "notice");
                await setDoc(newNoticeRef, { ...oldNoticeSnap.data(), serverId, allianceId }, { merge: true });
            }

            // 2. Event Schedules Migration
            const oldScheduleRef = doc(db, "settings", "eventSchedules");
            const oldScheduleSnap = await getDoc(oldScheduleRef);
            if (oldScheduleSnap.exists()) {
                const newScheduleRef = doc(db, "servers", serverId, "alliances", allianceId, "settings", "eventSchedules");
                await setDoc(newScheduleRef, { ...oldScheduleSnap.data(), serverId, allianceId }, { merge: true });
            }

            // 3. Strategy Sheet Migration
            const oldSheetRef = doc(db, 'settings', 'strategySheet');
            const oldSheetSnap = await getDoc(oldSheetRef);
            if (oldSheetSnap.exists()) {
                const newSheetRef = doc(db, "servers", serverId, "alliances", allianceId, "settings", "strategySheet");
                await setDoc(newSheetRef, { ...oldSheetSnap.data(), serverId, allianceId }, { merge: true });
            }

            // 4. Members Migration (Collection)
            const oldMembersRef = collection(db, 'members');
            const oldMembersSnap = await getDocs(query(oldMembersRef));
            const memberBatch = writeBatch(db);
            oldMembersSnap.forEach(d => {
                const newRef = doc(db, "servers", serverId, "alliances", allianceId, "members", d.id);
                memberBatch.set(newRef, { ...d.data(), serverId, allianceId }, { merge: true });
            });
            await memberBatch.commit();

            // 5. Admins Migration (From 'admins' and 'sys_admins')
            const adminBatch = writeBatch(db);

            // From 'admins'
            const oldAdminsSnap = await getDocs(query(collection(db, 'admins')));
            const nowTime = Date.now();
            oldAdminsSnap.forEach(d => {
                const data = d.data();
                const adminName = data.name || d.id;
                const newRef = doc(db, "servers", serverId, "alliances", allianceId, "admins", adminName);
                adminBatch.set(newRef, {
                    ...data,
                    name: adminName,
                    addedAt: data.addedAt || nowTime,
                    serverId,
                    allianceId
                }, { merge: true });
            });

            // From 'sys_admins'
            const oldSysAdminsSnap = await getDocs(query(collection(db, 'sys_admins')));
            oldSysAdminsSnap.forEach(d => {
                const data = d.data();
                const adminName = data.name || d.id;
                const newRef = doc(db, "servers", serverId, "alliances", allianceId, "admins", adminName);
                adminBatch.set(newRef, {
                    ...data,
                    name: adminName,
                    addedAt: data.addedAt || nowTime,
                    serverId,
                    allianceId
                }, { merge: true });
            });

            await adminBatch.commit();

            showCustomAlert('성공', '운영진 정보를 포함한 모든 데이터를 현재 연맹으로 가져왔습니다.', 'success');
        } catch (error: any) {
            console.error('Migration error:', error);
            showCustomAlert('오류', '데이터 가져오기 중 오류 발생: ' + error.message, 'error');
        }
    };

    // -- Super Admin Dashboard Logic --
    useEffect(() => {
        if (isSuperAdmin && isSuperAdminDashboardVisible) {
            const { onSnapshot, collection, query, orderBy } = require('firebase/firestore');
            const q = query(
                collection(db, 'alliance_requests'),
                orderBy('requestedAt', 'desc')
            );
            const unsubscribe = onSnapshot(q, (snapshot: any) => {
                const reqs = snapshot.docs.map((doc: any) => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setAllRequests(reqs);
                setIsSuperAdminLoading(false);
            });
            return () => unsubscribe();
        }
    }, [isSuperAdmin, isSuperAdminDashboardVisible]);

    const handleApproveRequest = async (req: any) => {
        showCustomAlert(
            '연맹 승인',
            `[${req.serverId}] ${req.allianceName} 연맹을 승인하시겠습니까?`,
            'confirm',
            async () => {
                try {
                    const { doc, getDoc, setDoc, updateDoc } = require('firebase/firestore');
                    const userRef = doc(db, 'users', req.adminId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        showCustomAlert('오류', '이미 존재하는 관리자 ID입니다.', 'error');
                        return;
                    }
                    await setDoc(userRef, {
                        uid: `admin_${req.serverId.replace('#', '')}_${req.allianceId}`,
                        username: req.adminId,
                        password: req.adminPassword,
                        nickname: `${req.allianceId} 관리자`,
                        role: 'alliance_admin',
                        status: 'active',
                        serverId: req.serverId,
                        allianceId: req.allianceId,
                        contact: req.contact,
                        createdAt: Date.now()
                    });
                    const reqRef = doc(db, 'alliance_requests', req.id);
                    await updateDoc(reqRef, { status: 'approved' });
                    showCustomAlert('성공', '연맹 승인 및 관리자 계정 생성이 완료되었습니다.', 'success');
                } catch (error: any) {
                    showCustomAlert('오류', error.message, 'error');
                }
            }
        );
    };

    const handleRejectRequest = async (req: any) => {
        showCustomAlert(
            '연맹 거절',
            `[${req.serverId}] ${req.allianceName} 연맹 가입 신청을 거절하시겠습니까?`,
            'confirm',
            async () => {
                try {
                    const { doc, updateDoc } = require('firebase/firestore');
                    const reqRef = doc(db, 'alliance_requests', req.id);
                    await updateDoc(reqRef, { status: 'rejected' });
                    showCustomAlert('완료', '신청이 거절되었습니다.', 'success');
                } catch (error: any) {
                    showCustomAlert('오류', error.message, 'error');
                }
            }
        );
    };

    useEffect(() => {
        const loadHistory = async () => {
            try {
                const savedAdminId = await AsyncStorage.getItem('lastAdminId');
                const rServers = await AsyncStorage.getItem('recent_server');
                const rAlliances = await AsyncStorage.getItem('recent_alliance');
                const rUsers = await AsyncStorage.getItem('recent_userid');

                if (rServers) setRecentServers(JSON.parse(rServers));
                if (rAlliances) setRecentAlliances(JSON.parse(rAlliances));
                if (rUsers) setRecentUserIds(JSON.parse(rUsers));
                if (savedAdminId) setLoginInput(savedAdminId);
            } catch (e) {
                console.error('Failed to load history:', e);
            }
        };
        loadHistory();
    }, []);

    const handleResetSettings = async () => {
        showCustomAlert('데이터 초기화', '저장된 모든 접속 정보(서버, 연맹, ID)를 초기화하시겠습니까?', 'confirm', async () => {
            try {
                await AsyncStorage.multiRemove(['lastAdminId', 'lastAdminRole']);
                setInputServer('');
                setInputAlliance('');
                setInputUserId('');
                setInputPassword('');
                setAllianceInfo(null, null);
                setIsGateOpen(true);
                showCustomAlert('초기화 완료', '모든 접속 정보가 삭제되었습니다.', 'success');
            } catch (e) {
                console.error('Reset error:', e);
            }
        });
    };

    const handleEnterAlliance = async () => {
        const forceServer = inputServer.trim() ? (inputServer.trim().startsWith('#') ? inputServer.trim() : `#${inputServer.trim()}`) : '';
        const forceAlliance = inputAlliance.trim();
        const inputId = inputUserId.trim();
        const inputPw = inputPassword.trim();

        if (isRegisterMode) {
            if (!forceServer || !forceAlliance) {
                showCustomAlert('입력 오류', '신청할 서버 번호와 연맹 이름을 모두 입력해주세요.', 'error');
                return;
            }
            if (!inputId || !inputPw) {
                showCustomAlert('입력 오류', '관리자 아이디와 비밀번호를 입력해주세요.', 'error');
                return;
            }

            try {
                const hashed = await hashPassword(inputPw);
                // Instead of direct creation, we create a request for Super Admin approval
                await setDoc(doc(collection(db, "alliance_requests")), {
                    serverId: forceServer,
                    allianceId: forceAlliance,
                    allianceName: forceAlliance,
                    adminId: inputId,
                    adminPassword: hashed,
                    status: 'pending',
                    requestedAt: Date.now()
                });

                showCustomAlert('신청 완료', '시스템관리자의 승인 후 접속이 가능합니다.', 'success');
                setIsRegisterMode(false); // Switch back to login mode
            } catch (error: any) {
                showCustomAlert('오류', '신청 중 문제가 발생했습니다: ' + error.message, 'error');
            }
        } else {
            // Normal Entry / Auth
            if (inputId && inputPw) {
                try {
                    const hashed = await hashPassword(inputPw);
                    const lowerId = inputId.toLowerCase();

                    // 1. Master Admin Check (Bypass Server/Alliance check)
                    const master = MASTER_CREDENTIALS.find(m => m.id.toLowerCase() === lowerId);
                    if (master) {
                        if (master.pw === hashed || master.pw === inputPw) {
                            await login(inputId, 'master');

                            // Master bypass: If no server/alliance provided, set defaults to close the gate
                            const finalServer = forceServer || serverId || '#000';
                            const finalAlliance = forceAlliance || allianceId || 'MASTER_SYSTEM';

                            setAllianceInfo(finalServer, finalAlliance);

                            await saveToHistory('server', finalServer);
                            await saveToHistory('alliance', finalAlliance);
                            await saveToHistory('userid', inputId);

                            setIsGateOpen(false);
                            return;
                        } else {
                            showCustomAlert('인증 오류', '전체 관리자 비밀번호가 일치하지 않습니다.', 'error');
                            return;
                        }
                    }

                    // For non-master users, Server/Alliance are required
                    if (!forceServer || !forceAlliance) {
                        showCustomAlert('입력 오류', '서버 번호와 연맹 이름을 모두 입력해주세요.', 'error');
                        return;
                    }

                    // 2. Alliance Admin / Operation Admin Check
                    const adminRef = doc(db, "servers", forceServer, "alliances", forceAlliance, "admins", inputId);
                    const adminSnap = await getDoc(adminRef);
                    if (adminSnap.exists()) {
                        const data = adminSnap.data();
                        if (data.password === hashed || data.password === inputPw) {
                            setAllianceInfo(forceServer, forceAlliance);

                            await saveToHistory('server', forceServer);
                            await saveToHistory('alliance', forceAlliance);
                            await saveToHistory('userid', inputId);

                            await login(inputId, data.role || 'admin');
                            setIsGateOpen(false);
                            return;
                        }
                    }

                    // 3. General Member Check
                    const memberRef = doc(db, "servers", forceServer, "alliances", forceAlliance, "members", inputId);
                    const memberSnap = await getDoc(memberRef);
                    if (memberSnap.exists()) {
                        const data = memberSnap.data();
                        if (data.password?.toString() === inputPw || data.password?.toString() === hashed) {
                            setAllianceInfo(forceServer, forceAlliance);

                            await saveToHistory('server', forceServer);
                            await saveToHistory('alliance', forceAlliance);
                            await saveToHistory('userid', inputId);

                            await login(inputId, 'user');
                            setIsGateOpen(false);
                            return;
                        }
                    }

                    showCustomAlert('인증 실패', '아이디 또는 비밀번호가 올바르지 않거나 해당 연맹의 멤버가 아닙니다.', 'error');
                } catch (e) {
                    console.error('Auth error:', e);
                    showCustomAlert('오류', '인증 처리 중 문제가 발생했습니다.', 'error');
                }
            } else {
                // No ID/PW provided - requires server/alliance for anonymous entry
                if (!forceServer || !forceAlliance) {
                    showCustomAlert('입력 오류', '볼 수 있는 연맹 정보를 입력하거나 로그인해주세요.', 'error');
                    return;
                }
                setAllianceInfo(forceServer, forceAlliance);

                await saveToHistory('server', forceServer);
                await saveToHistory('alliance', forceAlliance);

                setIsGateOpen(false);
            }
        }
    };

    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const getEventEndDate = (event: any) => {
        try {
            const id = event.id || event.eventId;
            const schedule = schedules.find(s => s.eventId === id);
            const dayStr = schedule?.day || event.day || '';
            const timeStr = schedule?.time || event.time || '';
            const combined = `${dayStr} ${timeStr} `;

            // 1. Date Range Match
            const rangeMatch = combined.match(/(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})\s*~\s*(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})/);
            if (rangeMatch) {
                const eStr = `${rangeMatch[3].replace(/\./g, '-')}T${rangeMatch[4]}:00`;
                const end = new Date(eStr);
                return isNaN(end.getTime()) ? null : end;
            }

            // 2. Single Date Match
            const singleMatch = combined.match(/(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})/);
            if (singleMatch) {
                const eStr = `${singleMatch[1].replace(/\./g, '-')}T${singleMatch[2]}:00`;
                const end = new Date(eStr);
                return isNaN(end.getTime()) ? null : end;
            }
        } catch (e) { }
        return null;
    };

    const isEventExpired = (event: any) => {
        const end = getEventEndDate(event);
        return !!end && now > end;
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

    const isVisibleInList = (event: any) => {
        const end = getEventEndDate(event);
        if (!end) return true; // For weekly/everlasting events, keep them visible.

        const twoDaysInMs = 2 * 24 * 60 * 60 * 1000;
        const threshold = new Date(end.getTime() + twoDaysInMs);
        return now <= threshold;
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

    const pad = (n: number) => n.toString().padStart(2, '0');

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
            const formatted = `${dayStr} (${utcShift.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')})`;
            return includePrefix ? `UTC: ${formatted} ` : formatted;
        }

        let utcH = h - 9;
        let utcDayIdx = dayIdx;
        if (utcH < 0) {
            utcH += 24;
            utcDayIdx = (dayIdx - 1 + 7) % 7;
        }

        const formatted = `${days[utcDayIdx]} (${pad(utcH)}:${pad(m)})`;
        return includePrefix ? `UTC: ${formatted} ` : formatted;
    };

    const getUTCString = (str: string) => {
        if (!str) return null;
        const match = str.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{2}):(\d{2})/);
        if (!match) return null;
        const [_, y, m, d, h, min] = match;
        // String represents KST (UTC+9)
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min));
        if (isNaN(date.getTime())) return null;

        const utcDate = new Date(date.getTime() - (9 * 60 * 60 * 1000));
        return `${pad(utcDate.getMonth() + 1)}/${pad(utcDate.getDate())} ${pad(utcDate.getHours())}:${pad(utcDate.getMinutes())}`;
    };

    const splitSchedulePart = (str: string) => {
        if (!str) return { date: '', time: '' };

        // 1. Handle full date range type (2024.01.01 10:00)
        const fullDateMatch = str.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{2}):(\d{2})/);
        if (fullDateMatch) {
            const [_, y, m, d, h, min] = fullDateMatch;
            const days = ['일', '월', '화', '수', '목', '금', '토'];
            const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            const dateStr = `${m}월 ${d}일 (${days[dateObj.getDay()]})`;
            return { date: dateStr, time: `${h}:${min}` };
        }

        // 2. Handle date only (2024.01.01)
        const justDateMatch = str.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})/);
        if (justDateMatch) {
            const [_, y, m, d] = justDateMatch;
            const days = ['일', '월', '화', '수', '목', '금', '토'];
            const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            const dateStr = `${m}월 ${d}일 (${days[dateObj.getDay()]})`;
            return { date: dateStr, time: '' };
        }

        // 3. Handle UTC format MM/DD HH:mm
        const utcMatch = str.match(/(\d{2})\/(\d{2})\s+(\d{2}:\d{2})/);
        if (utcMatch) {
            return { date: `${utcMatch[1]}/${utcMatch[2]}`, time: utcMatch[3] };
        }

        // 4. Handle UTC format MM/DD
        const utcDateMatch = str.match(/(\d{2})\/(\d{2})/);
        if (utcDateMatch && str.trim().length <= 5) {
            return { date: `${utcDateMatch[1]}/${utcDateMatch[2]}`, time: '' };
        }

        // 5. Handle weekly type (월(10:00) or similar)
        const weeklyMatch = str.match(/([일월화수목금토매일]+)\(?(\d{2}:\d{2})\)?/);
        if (weeklyMatch) {
            return { date: weeklyMatch[1].replace(/[()]/g, ''), time: weeklyMatch[2] };
        }

        return { date: str, time: '' };
    };

    const [noticeModalVisible, setNoticeModalVisible] = useState(false);
    const [editNoticeContent, setEditNoticeContent] = useState('');
    const [editNoticeVisible, setEditNoticeVisible] = useState(true);
    const [superAdminDashboardVisible, setSuperAdminDashboardVisible] = useState(false);
    const [installModalVisible, setInstallModalVisible] = useState(false);

    // Enable LayoutAnimation for Android
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    const [activeEventTab, setActiveEventTab] = useState<'active' | 'upcoming' | 'expired'>('active');

    // Load active tab state
    useEffect(() => {
        AsyncStorage.getItem('activeEventTab').then(saved => {
            if (saved && (saved === 'active' || saved === 'upcoming' || saved === 'expired')) {
                setActiveEventTab(saved as 'active' | 'upcoming' | 'expired');
            }
        });
    }, []);

    const switchEventTab = (tab: 'active' | 'upcoming' | 'expired') => {
        LayoutAnimation.configureNext({
            duration: 200,
            create: { type: 'easeInEaseOut', property: 'opacity' },
            update: { type: 'easeInEaseOut' },
            delete: { type: 'easeInEaseOut', property: 'opacity' }
        });
        setActiveEventTab(tab);
        AsyncStorage.setItem('activeEventTab', tab);
    };

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

        if (!input || !pw) return;

        const hashed = await hashPassword(pw);
        const lowerId = input.toLowerCase();

        // 1. Master Admin Check
        const master = MASTER_CREDENTIALS.find(m => m.id.toLowerCase() === lowerId);
        if (master && (master.pw === hashed || master.pw === pw)) {
            await performLogin(input, 'master');
            return;
        }

        // 2. Dynamic Admin Check
        const dynamic = dynamicAdmins.find(a => {
            const aNameLower = a.name.toLowerCase();
            const aPw = (a.password || '').toLowerCase();
            return aNameLower === lowerId && (aPw === hashed || aPw === pw.toLowerCase());
        });

        if (dynamic) {
            await performLogin(dynamic.name, dynamic.role || 'admin');
        } else {
            setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.');
        }
    };

    const performLogin = async (id: string, role: AdminStatus['role'] = 'admin') => {
        try {
            const { signInAnonymously } = require('firebase/auth');
            const { auth: firebaseAuth } = require('../firebaseConfig');
            signInAnonymously(firebaseAuth).catch(() => { });
        } catch (e) { }

        await AsyncStorage.setItem('lastAdminId', id);
        await login(id, role);
        setLoginModalVisible(false);
        setPasswordInput('');
        showCustomAlert('인증 성공', `${id}님, 환영합니다! (${role === 'master' ? '시스템관리자' : role === 'alliance_admin' ? '연맹관리자' : role === 'admin' ? '운영관리자' : '일반영주'})`, 'success');
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
            let searchId = s.eventId;
            if (s.eventId === 'alliance_frost_league' || s.eventId === 'a_weapon') searchId = 'a_weapon';
            if (s.eventId === 'alliance_operation' || s.eventId === 'a_operation') searchId = 'alliance_operation';
            if (s.eventId === 'alliance_trade' || s.eventId === 'a_trade') searchId = 'alliance_trade';
            if (s.eventId === 'alliance_champion' || s.eventId === 'a_champ') searchId = 'alliance_champion';
            if (s.eventId === 'alliance_bear' || s.eventId === 'a_bear') searchId = 'alliance_bear';
            if (s.eventId === 'alliance_joe' || s.eventId === 'a_joe') searchId = 'alliance_joe';
            if (s.eventId === 'alliance_center' || s.eventId === 'a_center') searchId = 'alliance_center';
            const eventInfo = allBaseEvents.find(e => e.id === searchId);
            const cleanDay = (s.day === '.' || s.day?.trim() === '.') ? '' : (s.day || '');
            const cleanTime = (s.time === '.' || s.time?.trim() === '.') ? '' : (s.time || '');
            return { ...s, day: cleanDay, time: cleanTime, title: eventInfo ? eventInfo.title : '알 수 없는 이벤트' };
        }).filter(e => {
            if (e.title === '알 수 없는 이벤트') return false;
            if (!(!!e.day || !!e.time)) return false;

            return isVisibleInList(e); // Use the new visibility logic
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
                        const isSingleTeam = parts.length === 1;
                        const rawLabel = colonIdx > -1 ? trimmed.substring(0, colonIdx).trim() : (isSingleTeam ? '' : `곰${idx + 1} `);
                        // Simplify Team Label
                        const cleanLabel = rawLabel ? (rawLabel.includes('곰') ? rawLabel : `곰 ${rawLabel.replace(/팀|군/g, '').trim()} 팀`) : '';
                        const teamTime = colonIdx > -1 ? trimmed.substring(colonIdx + 1).trim() : trimmed;

                        // Simplify individual times (Remove Departure/Return etc)
                        const simplifiedTime = teamTime.split(/[,|]/).map(t => {
                            return t.replace(/출격|귀환|시작|종료/g, '').trim();
                        }).join(', ');

                        processedList.push({
                            ...e,
                            eventId: `${e.eventId}_team${idx + 1} `,
                            originalEventId: e.eventId,
                            title: cleanLabel ? `곰 사냥 작전(${cleanLabel})` : '곰 사냥 작전',
                            time: simplifiedTime,
                            isBearSplit: true,
                            teamLabel: cleanLabel,
                            teamIcon: '🐻'
                        });
                    });
                } else {
                    processedList.push(e);
                }
            } else if (e.eventId === 'a_fortress' || e.eventId === 'alliance_fortress') {
                // Split Fortress Battle into separate 'Fortress' and 'Citadel' events
                const rawTime = (e.time || '').replace(/\//g, ',');
                const parts = rawTime.split(',').map(p => p.trim()).filter(p => p);

                const fortressParts: string[] = [];
                const citadelParts: string[] = [];

                parts.forEach(part => {
                    if (part.includes('성채')) {
                        citadelParts.push(part);
                    } else {
                        fortressParts.push(part);
                    }
                });

                // Add Fortress Event if data exists
                if (fortressParts.length > 0) {
                    processedList.push({
                        ...e,
                        eventId: `${e.eventId}_fortress`,
                        originalEventId: e.eventId,
                        title: '요새 쟁탈전',
                        time: fortressParts.join(', '),
                        isFortressSplit: true
                    });
                }

                // Add Citadel Event if data exists
                if (citadelParts.length > 0) {
                    processedList.push({
                        ...e,
                        eventId: `${e.eventId}_citadel`,
                        originalEventId: e.eventId,
                        title: '성채 쟁탈전',
                        time: citadelParts.join(', '),
                        isFortressSplit: true
                    });
                }

                // If neither exists (empty time), push original as fallback (optional, but good for safety)
                if (fortressParts.length === 0 && citadelParts.length === 0) {
                    processedList.push(e);
                }
            } else if (e.eventId === 'a_foundry' || e.eventId === 'alliance_foundry') {
                // Split Weapon Factory into Team 1 and Team 2
                const parts = (e.time || '').split(' / ');
                if (parts.length > 0) {
                    parts.forEach((part, idx) => {
                        const trimmed = part.trim();
                        if (!trimmed) return;

                        const colonIdx = trimmed.indexOf(':');
                        const isSingleTeam = parts.length === 1;
                        const rawLabel = colonIdx > -1 ? trimmed.substring(0, colonIdx).trim() : (isSingleTeam ? '' : `${idx + 1}군`);
                        const cleanLabel = rawLabel || '';
                        const teamTime = colonIdx > -1 ? trimmed.substring(colonIdx + 1).trim() : trimmed;

                        const simplifiedTime = teamTime.split(/[,|]/).map(t => {
                            return t.replace(/출격|귀환|시작|종료/g, '').trim();
                        }).join(', ');

                        processedList.push({
                            ...e,
                            eventId: `${e.eventId}_team${idx + 1}`,
                            originalEventId: e.eventId,
                            title: cleanLabel ? `무기공장 쟁탈전(${cleanLabel})` : '무기공장 쟁탈전',
                            time: simplifiedTime,
                            isFoundrySplit: true,
                            teamLabel: cleanLabel,
                            teamIcon: '🏭'
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

            // Fix Foundry team order (Team 1 -> Team 2)
            if (a.isFoundrySplit && b.isFoundrySplit && a.eventId.substring(0, 10) === b.eventId.substring(0, 10)) {
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

    // Blink Animation for Upcoming Soon
    const blinkAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(blinkAnim, {
                    toValue: 1,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(blinkAnim, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, []);

    const renderEventCard = (event: any, key: string) => {
        const isActive = isEventActive(event);
        const isExpired = isEventExpired(event);
        const isUpcoming = !isActive && !isExpired;

        // Get event info with image
        const allBaseEvents = [...INITIAL_WIKI_EVENTS, ...ADDITIONAL_EVENTS];
        const eventInfo = allBaseEvents.find(e => e.id === (event.originalEventId || event.eventId));
        const eventImageUrl = eventInfo?.imageUrl;

        const getEventIcon = (id: string) => {
            if (id.includes('bear')) return 'paw-outline';
            if (id.includes('frost') || id.includes('weapon')) return 'shield-half-outline';
            if (id.includes('castle') || id.includes('fortress')) return 'business-outline';
            if (id.includes('championship')) return 'trophy-outline';
            return 'calendar-clear-outline';
        };

        const titleColor = isExpired ? (isDark ? 'text-slate-600' : 'text-slate-400') : (isDark ? 'text-white' : 'text-slate-900');

        const checkIsSoon = (str: string) => {
            if (!str) return false;
            const dayMapObj: { [key: string]: number } = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
            const currentTotal = now.getDay() * 1440 + now.getHours() * 60 + now.getMinutes();
            const totalWeekMinutes = 7 * 1440;

            // 1. 기간형이나 범위형은 시작 시간만 체크
            // (기간형) 2024.01.01 10:00 ~ ...
            const dateRangeMatch = str.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{2}):(\d{2})/);
            if (dateRangeMatch) {
                const [_, y, m, d, h, min] = dateRangeMatch;
                const start = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min));
                if (!isNaN(start.getTime())) {
                    const diff = (start.getTime() - now.getTime()) / 60000;
                    return diff > 0 && diff <= 30;
                }
            }

            // 2. 점형 일시 체크 (예: 화 23:50, 매일 10:00)
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

                        let startTotal = dayOffset * 1440 + h * 60 + min;
                        let diff = startTotal - currentTotal;

                        // 날짜 변경선 처리 (토요일 -> 일요일)
                        if (diff < 0) diff += totalWeekMinutes;

                        // 현재 시각 기준 0 ~ 30분 사이 (이번 주 도래할 시간)
                        return diff > 0 && diff <= 30;
                    });
                });
            }
            return false;
        };

        return (
            <TouchableOpacity
                key={key}
                onPress={() => router.push({ pathname: '/growth/events', params: { focusId: event.originalEventId || event.eventId } })}
                className="active:scale-[0.98] transition-all w-full sm:w-1/2 p-2"

            >
                <View className={`p-3 rounded-2xl border ${isActive
                    ? (isDark ? 'bg-slate-900/95 border-blue-500/50 shadow-2xl shadow-blue-500/20' : 'bg-white border-blue-200 shadow-xl shadow-blue-500/10')
                    : isUpcoming
                        ? (isDark ? 'bg-slate-900/95 border-emerald-500/40 shadow-2xl shadow-emerald-500/10' : 'bg-white border-emerald-200 shadow-xl shadow-emerald-500/5')
                        : (isDark ? 'bg-slate-900/95 border-slate-700 shadow-2xl shadow-black/40' : 'bg-white border-slate-200 shadow-xl shadow-slate-900/5')
                    }`}>
                    <View className="flex-row items-center justify-between mb-2">
                        <View className="flex-row items-center flex-1 mr-2">
                            <View className={`w-9 h-9 rounded-lg items-center justify-center mr-2 overflow-hidden ${isDark ? 'bg-slate-800/80' : 'bg-slate-50 border border-slate-100'}`}>
                                {eventImageUrl ? (
                                    <Image
                                        source={typeof eventImageUrl === 'string' ? { uri: eventImageUrl } : eventImageUrl}
                                        className="w-full h-full"
                                        resizeMode="cover"
                                    />
                                ) : (
                                    <Ionicons name={getEventIcon(event.originalEventId || event.eventId)} size={18} color={isActive ? "#3b82f6" : (isExpired ? '#64748b' : '#94a3b8')} />
                                )}
                            </View>
                            <View className="flex-1">
                                <Text className={`text-base font-bold tracking-tight ${!isExpired ? (isDark ? 'text-[#38bdf8]' : 'text-blue-600') : titleColor}`} numberOfLines={1} style={{ fontSize: 16 * fontSizeScale }}>{event.title}</Text>
                            </View>
                        </View>
                        {isActive && (
                            <Animated.View
                                className={`flex-row items-center px-3 py-1.5 rounded-xl bg-blue-600`}
                                style={{
                                    opacity: flickerAnim,
                                    transform: [{ scale: scaleAnim }],
                                    shadowColor: '#3b82f6',
                                    shadowOffset: { width: 0, height: 2 },
                                    shadowOpacity: 0.6,
                                    shadowRadius: 8,
                                    elevation: 8
                                }}
                            >
                                <Text className={`text-white text-[11px] font-black tracking-wider mr-1`}>진행중</Text>
                                <Ionicons name="chevron-forward-circle" size={14} color="white" />
                            </Animated.View>
                        )}
                    </View>

                    <View className="flex-col gap-3">
                        {(!event.time && (event.eventId === 'a_fortress' || event.eventId === 'a_citadel')) && (
                            <View className={`rounded-xl border border-dashed p-4 items-center justify-center ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                <Text className={`font-bold text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>등록된 일정이 없습니다.</Text>
                            </View>
                        )}
                        {!!event.day && !event.isBearSplit && !event.isFoundrySplit && !event.time && (
                            <View className={`rounded-xl border overflow-hidden ${isUpcoming ? (isDark ? 'bg-black/40 border-emerald-500/20' : 'bg-emerald-50/30 border-emerald-100') : (isDark ? 'bg-black/40 border-slate-700/50' : 'bg-slate-50 border-slate-200 shadow-sm')}`}>
                                <View className="p-3 gap-2">
                                    {(() => {
                                        const formattedDay = (event.day || '').replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                        let kstText = formattedDay;
                                        let utcText = '';

                                        if (kstText.includes('~')) {
                                            const parts = kstText.split('~').map(x => x.trim());
                                            const sDateUtc = getUTCString(parts[0]);
                                            const eDateUtc = getUTCString(parts[1]);
                                            if (sDateUtc && eDateUtc) utcText = `${sDateUtc} ~ ${eDateUtc} `;
                                            else {
                                                const sWeeklyUtc = getUTCTimeString(parts[0], false);
                                                const eWeeklyUtc = getUTCTimeString(parts[1], false);
                                                if (sWeeklyUtc && eWeeklyUtc) utcText = `${sWeeklyUtc} ~ ${eWeeklyUtc} `;
                                            }
                                        } else {
                                            const dateUtc = getUTCString(event.day);
                                            if (dateUtc) utcText = dateUtc;
                                            else {
                                                const weeklyUtc = getUTCTimeString(event.day);
                                                if (weeklyUtc) utcText = weeklyUtc;
                                            }
                                        }

                                        const displayText = timezone === 'KST' ? kstText : (utcText || kstText);

                                        const renderPart = (str: string) => {
                                            const isRange = str.includes('~');
                                            const parts = isRange ? str.split('~').map(x => x.trim()) : [str];

                                            return parts.map((p, pIdx) => {
                                                const split = splitSchedulePart(p);
                                                const isFirstPart = pIdx === 0;
                                                const label = isRange ? (isFirstPart ? '시작' : '종료') : '';
                                                return (
                                                    <View key={pIdx} className="py-1.5">
                                                        <View className="flex-row items-center">
                                                            {isRange && (
                                                                <Text className={`text-[10px] font-black w-7 ${isFirstPart ? (isDark ? 'text-emerald-400' : 'text-emerald-600') : (isDark ? 'text-orange-400' : 'text-orange-600')}`}>{label}</Text>
                                                            )}
                                                            <Ionicons name="calendar-outline" size={14} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginRight: 4 }} />
                                                            <Text className={`font-black text-lg ${isExpired ? 'line-through opacity-70 text-slate-400' : (isDark ? 'text-slate-100' : 'text-slate-900')}`} style={{ fontSize: 18 * fontSizeScale }}>{split.date}</Text>
                                                        </View>
                                                        {!!split.time && (
                                                            <View className={`flex-row items-center mt-0.5 ${isRange ? 'ml-7' : ''}`}>
                                                                <Ionicons name="time-outline" size={14} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginRight: 4 }} />
                                                                <Text className={`font-black text-lg ${isExpired ? 'line-through opacity-70 text-slate-500' : (isDark ? 'text-blue-400' : 'text-blue-600')}`} style={{ fontSize: 18 * fontSizeScale }}>{split.time}</Text>
                                                            </View>
                                                        )}
                                                    </View>
                                                );
                                            });
                                        };

                                        return renderPart(displayText);
                                    })()}
                                </View>
                            </View>
                        )}
                        {!!event.time && (
                            <View className="gap-3">
                                {(event.isBearSplit || event.isFoundrySplit) ? (
                                    <View className={`rounded-2xl border overflow-hidden ${isUpcoming ? (isDark ? 'bg-black/40 border-emerald-500/20' : 'bg-emerald-50/30 border-emerald-100') : (isDark ? 'bg-black/40 border-slate-700/50' : 'bg-slate-50 border-slate-200 shadow-sm')}`}>
                                        <View className={`${isDark ? 'bg-black/20' : 'bg-white'}`}>
                                            {event.time.split(/[,|]/).map((item: string, iIdx: number) => {
                                                const trimmed = item.trim();
                                                if (!trimmed) return null;

                                                // Updated regex to handle 'Day(Time)' format correctly (e.g., 화(22:00))
                                                let displayDay = '-';
                                                let cleanDisplayTime = '';

                                                // Check for Day(Time) pattern first
                                                const dtMatch = trimmed.match(/([일월화수목금토매일])\s*\(?(\d{1,2}:\d{2})\)?/);

                                                if (dtMatch) {
                                                    displayDay = dtMatch[1];
                                                    cleanDisplayTime = dtMatch[2];
                                                } else {
                                                    // Fallback to original logic
                                                    const dayMatch = trimmed.match(/[일월화수목금토매일]+/);
                                                    displayDay = dayMatch ? dayMatch[0] : '-';

                                                    const rawTime = trimmed.replace(displayDay, '').trim();
                                                    const colonIdx = rawTime.indexOf(':');
                                                    const activeTime = (colonIdx > 0) ? rawTime.substring(colonIdx - 2, colonIdx + 3).trim() : rawTime;

                                                    // If 'cleanDisplayTime' was derived from removing day and parens
                                                    cleanDisplayTime = activeTime.replace(/[()]/g, '');
                                                }

                                                const isLive = checkItemActive(`${displayDay} ${cleanDisplayTime}`);
                                                const isSoon = checkIsSoon(item.trim());

                                                const ItemWrapper = isSoon ? Animated.View : TouchableOpacity;
                                                const itemStyle = isSoon ? {
                                                    opacity: 1,
                                                    borderWidth: 1,
                                                    borderColor: isDark ? 'rgba(56, 189, 248, 0.5)' : 'rgba(14, 165, 233, 0.5)',
                                                    backgroundColor: blinkAnim.interpolate({
                                                        inputRange: [0.3, 1],
                                                        outputRange: ['transparent', isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(14, 165, 233, 0.1)']
                                                    })
                                                } : {};

                                                return (
                                                    <ItemWrapper
                                                        key={iIdx}
                                                        activeOpacity={0.7}
                                                        disabled={!isSoon}
                                                        style={isSoon ? itemStyle : undefined}
                                                        className={`flex-row items-center px-4 py-2 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'} last:border-0 ${isSoon ? 'rounded-xl mx-2 my-1 border-0' : 'active:bg-slate-500/10'}`}
                                                    >
                                                        <View className="flex-row items-center flex-1">
                                                            <Ionicons name="calendar-outline" size={14} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginRight: 4 }} />
                                                            <Text className={`font-black text-lg ${isLive ? 'text-blue-500' : (isExpired ? (isDark ? 'text-slate-400' : 'text-slate-500') : (isSoon ? (isDark ? 'text-sky-400' : 'text-sky-600') : (isDark ? 'text-slate-100' : 'text-slate-900')))} ${isExpired ? 'line-through opacity-70' : ''}`} style={{ fontSize: 18 * fontSizeScale }}>{displayDay}</Text>
                                                            <Text className={`mx-2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>·</Text>
                                                            <Ionicons name="time-outline" size={14} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginRight: 4 }} />
                                                            <Text className={`font-black text-lg ${isLive ? 'text-blue-500' : (isExpired ? (isDark ? 'text-slate-500' : 'text-slate-600') : (isSoon ? (isDark ? 'text-sky-400' : 'text-sky-600') : (isDark ? 'text-blue-400' : 'text-blue-600')))} ${isExpired ? 'line-through opacity-70' : ''}`} style={{ fontSize: 18 * fontSizeScale }}>{cleanDisplayTime}</Text>
                                                            {isSoon && (
                                                                <Text className={`ml-2 text-[10px] font-black uppercase tracking-tighter ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>곧 시작</Text>
                                                            )}
                                                        </View>
                                                        {isLive && (
                                                            <View className="w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                                                        )}
                                                    </ItemWrapper>
                                                );
                                            })}
                                        </View>
                                    </View>
                                ) : (
                                    <>
                                        {event.time.split(' / ').map((part: string, pIdx: number) => {
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

                                            // Handling Fortress/Citadel in single card
                                            // The event is already split in displayEvents into '요새 쟁탈전' or '성채 쟁탈전'
                                            // and contains only relevant parts in event.time
                                            if (event.eventId.includes('_fortress') || event.eventId.includes('_citadel') || event.eventId === 'a_fortress' || event.eventId === 'alliance_fortress') {
                                                const rawTime = (event.time || '');
                                                // Split by comma
                                                const parts = rawTime.split(',').map((p: string) => p.trim()).filter((p: string) => p);

                                                return (
                                                    <View key={pIdx} className={`rounded-[32px] border overflow-hidden ${isUpcoming ? (isDark ? 'bg-black/40 border-emerald-500/20' : 'bg-emerald-50/30 border-emerald-100') : (isDark ? 'bg-black/40 border-slate-700/50' : 'bg-slate-50 border-slate-200 shadow-sm')}`}>
                                                        <View className="flex-col">
                                                            {parts.map((part: string, iIdx: number) => {
                                                                // Remove prefixes if any remain
                                                                let cleanPart = part.replace(/^(요새전|성채전)[:\s]*/, '').trim();

                                                                let name = '';
                                                                let dateStr = '';
                                                                let timeStr = '';

                                                                const match = cleanPart.match(/^(.*?)\s+([^\s]+)\s+(\d{1,2}:\d{2})$/);
                                                                if (match) {
                                                                    name = match[1].trim();
                                                                    dateStr = match[2].trim();
                                                                    timeStr = match[3].trim();
                                                                } else {
                                                                    const sp = cleanPart.split(' ');
                                                                    if (sp.length >= 3) {
                                                                        timeStr = sp.pop() || '';
                                                                        dateStr = sp.pop() || '';
                                                                        name = sp.join(' ');
                                                                    } else {
                                                                        name = cleanPart;
                                                                    }
                                                                }

                                                                const isLive = checkItemActive(`${dateStr} ${timeStr}`);

                                                                return (
                                                                    <TouchableOpacity key={iIdx} activeOpacity={0.7} className={`flex-row items-center px-4 py-6 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'} last:border-0 active:bg-slate-500/10`}>
                                                                        <View className="flex-row items-center flex-1 flex-nowrap overflow-hidden">
                                                                            <View className="flex-row items-center shrink-0 mr-2">
                                                                                <Ionicons name="business-outline" size={14} color={name.includes('성채') ? (isDark ? "#e879f9" : "#c026d3") : (isDark ? "#fbbf24" : "#4f46e5")} style={{ marginRight: 2 }} />
                                                                                <Text className={`font-black text-sm ${name.includes('성채') ? (isDark ? 'text-fuchsia-400' : 'text-fuchsia-600') : (isDark ? 'text-amber-400' : 'text-indigo-600')}`}>{name}</Text>
                                                                            </View>
                                                                            <View className="flex-row items-center shrink-0 mr-2">
                                                                                <Ionicons name="calendar-outline" size={14} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginRight: 2 }} />
                                                                                <Text className={`font-black text-lg ${isLive ? 'text-blue-500' : (isExpired ? (isDark ? 'text-slate-400' : 'text-slate-500') : (isDark ? 'text-slate-100' : 'text-slate-800'))} ${isExpired ? 'line-through opacity-70' : ''}`} style={{ fontSize: 18 * fontSizeScale }}>{dateStr}</Text>
                                                                            </View>
                                                                            <View className="flex-row items-center shrink-0">
                                                                                <Ionicons name="time-outline" size={14} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginRight: 2 }} />
                                                                                <Text className={`font-black text-lg ${isLive ? 'text-blue-500' : (isExpired ? (isDark ? 'text-slate-500' : 'text-slate-600') : (isDark ? 'text-blue-400' : 'text-blue-600'))} ${isExpired ? 'line-through opacity-70' : ''}`} style={{ fontSize: 18 * fontSizeScale }}>{timeStr}</Text>
                                                                            </View>
                                                                        </View>
                                                                        {isLive && (
                                                                            <View className="w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                                                                        )}
                                                                    </TouchableOpacity>
                                                                );
                                                            })}
                                                        </View>
                                                    </View>
                                                );
                                            }
                                            return (
                                                <View key={pIdx} className={`rounded-[32px] border overflow-hidden ${isUpcoming ? (isDark ? 'bg-black/40 border-emerald-500/20' : 'bg-emerald-50/30 border-emerald-100') : (isDark ? 'bg-black/40 border-slate-700/50' : 'bg-slate-50 border-slate-200 shadow-sm')}`}>
                                                    {!!label && (
                                                        <View className={`px-8 py-4 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-200 border-slate-300'}`}>
                                                            <Text className={`text-[11px] font-black uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-700'}`}>{label}</Text>
                                                        </View>
                                                    )}
                                                    <View className="flex-col">
                                                        {content.split(/[,|]/).map((item, iIdx) => {
                                                            const isLive = checkItemActive(item.trim());
                                                            const utcStr = getUTCTimeString(item.trim(), false);
                                                            const displayFull = timezone === 'KST' ? item.trim() : utcStr;
                                                            const split = splitSchedulePart(displayFull);
                                                            const isSoon = isUpcoming && checkIsSoon(item.trim());

                                                            const ItemWrapper = isSoon ? Animated.View : TouchableOpacity;
                                                            const itemStyle = isSoon ? {
                                                                opacity: 1,
                                                                borderWidth: 1,
                                                                borderColor: isDark ? 'rgba(56, 189, 248, 0.5)' : 'rgba(14, 165, 233, 0.5)', // Fixed subtle border
                                                                backgroundColor: blinkAnim.interpolate({
                                                                    inputRange: [0.3, 1],
                                                                    outputRange: ['transparent', isDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(14, 165, 233, 0.1)']
                                                                })
                                                            } : {};

                                                            return (
                                                                <TouchableOpacity
                                                                    key={iIdx}
                                                                    activeOpacity={0.7}
                                                                    disabled={!isSoon}
                                                                >
                                                                    <ItemWrapper
                                                                        style={isSoon ? itemStyle : undefined}
                                                                        className={`flex-row items-center px-8 py-6 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'} last:border-0 active:bg-slate-500/10 ${isSoon ? 'rounded-xl mx-2 my-1 border-0' : ''}`}
                                                                    >
                                                                        <View className="flex-row items-center flex-1 flex-nowrap overflow-hidden">
                                                                            {event.isFortressSplit && !!event.teamLabel && (
                                                                                <View className="flex-row items-center shrink-0 mr-3">
                                                                                    <Ionicons name="business-outline" size={14} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginRight: 4 }} />
                                                                                    <Text className={`font-black text-lg ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>{event.teamLabel}</Text>
                                                                                </View>
                                                                            )}
                                                                            <View className="flex-row items-center shrink-0 mr-2">
                                                                                <Ionicons name="calendar-outline" size={14} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginRight: 2 }} />
                                                                                <Text className={`font-black text-lg ${isLive ? 'text-blue-500' : (isExpired ? (isDark ? 'text-slate-400' : 'text-slate-500') : (isSoon ? (isDark ? 'text-sky-400' : 'text-sky-600') : (isDark ? 'text-slate-100' : 'text-slate-800')))} ${isExpired ? 'line-through opacity-70' : ''}`} style={{ fontSize: 18 * fontSizeScale }}>{split.date}</Text>
                                                                            </View>
                                                                            {!!split.time && (
                                                                                <>
                                                                                    <Text className={`mx-2 ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>·</Text>
                                                                                    <View className="flex-row items-center shrink-0">
                                                                                        <Ionicons name="time-outline" size={14} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginRight: 2 }} />
                                                                                        <Text className={`font-black text-lg ${isLive ? 'text-blue-500' : (isExpired ? (isDark ? 'text-slate-500' : 'text-slate-600') : (isSoon ? (isDark ? 'text-sky-400' : 'text-sky-600') : (isDark ? 'text-blue-400' : 'text-blue-600')))} ${isExpired ? 'line-through opacity-70' : ''}`} style={{ fontSize: 18 * fontSizeScale }}>{split.time}</Text>
                                                                                        {isSoon && (
                                                                                            <Text className={`ml-2 text-[10px] font-black uppercase tracking-tighter ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>곧 시작</Text>
                                                                                        )}
                                                                                    </View>
                                                                                </>
                                                                            )}
                                                                        </View>
                                                                        {isLive && (
                                                                            <View className="w-2 h-2 rounded-full bg-blue-500 shadow-lg shadow-blue-500/50" />
                                                                        )}
                                                                    </ItemWrapper>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                </View>
                                            );
                                        })}
                                    </>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    const renderHistorySuggestions = (type: 'server' | 'alliance' | 'userid') => {
        if (activeInput !== type) return null;
        const list = type === 'server' ? recentServers : type === 'alliance' ? recentAlliances : recentUserIds;
        if (list.length === 0) return null;

        return (
            <View className={`absolute top-full left-0 right-0 mt-2 z-[100] rounded-2xl border overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                {list.map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        onPress={() => {
                            if (type === 'server') setInputServer(item);
                            if (type === 'alliance') setInputAlliance(item);
                            if (type === 'userid') setInputUserId(item);
                            setActiveInput(null);
                        }}
                        className={`p-4 flex-row items-center border-b ${isDark ? 'bg-slate-800 border-slate-700 active:bg-slate-700' : 'bg-white border-slate-100 active:bg-slate-50'} last:border-0`}
                    >
                        <Ionicons name="time-outline" size={16} color={isDark ? "#475569" : "#94a3b8"} style={{ marginRight: 10 }} />
                        <Text className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{item}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    if (isLoading) {
        return (
            <View className="flex-1 bg-[#020617] items-center justify-center">
                <ImageBackground
                    source={require('../assets/images/selection_gate_bg.png')}
                    style={{ position: 'absolute', width: '100%', height: '100%' }}
                    resizeMode="cover"
                />
                <View className="absolute inset-0 bg-slate-950/60" />
                <Animated.View style={{ opacity: flickerAnim, transform: [{ scale: scaleAnim }] }} className="items-center">
                    <View className="w-24 h-24 rounded-[40px] bg-sky-500/20 items-center justify-center mb-8 border border-sky-400/30">
                        <Ionicons name="snow" size={54} color="#38bdf8" />
                    </View>
                    <Text className="text-white font-black text-2xl tracking-[0.3em]">INITIALIZING</Text>
                    <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 24 }} />
                </Animated.View>
            </View>
        );
    }

    if (isGateOpen || !serverId || !allianceId) {
        return (
            <View className="flex-1 w-full h-screen bg-[#0f172a]">
                <ImageBackground
                    source={require('../assets/images/selection_gate_bg.png')}
                    style={{ position: 'absolute', width: '100%', height: '100%' }}
                    resizeMode="cover"
                />
                <View className="flex-1 w-full h-full justify-center items-center p-4">
                    <BlurView intensity={20} className="absolute inset-0" />

                    <View className="w-full max-w-md p-6 rounded-[40px] border border-white/10 bg-slate-900/60 shadow-2xl overflow-hidden">
                        <BlurView intensity={80} className="absolute inset-0" />

                        <View className="items-center mb-4 relative">
                            {/* Help Button */}
                            <Pressable
                                onPress={() => {
                                    if (Platform.OS === 'web') {
                                        window.open('/login-guide.html', '_blank');
                                    }
                                }}
                                className="absolute top-0 right-0 p-2 rounded-full bg-slate-800/60 border border-slate-700 active:scale-95"
                            >
                                <Ionicons name="help-circle-outline" size={20} color="#a78bfa" />
                            </Pressable>

                            <View className={`w-12 h-12 rounded-2xl ${isRegisterMode ? 'bg-amber-500/20 shadow-amber-500/20' : 'bg-sky-500/20 shadow-sky-500/20'} items-center justify-center mb-3 border ${isRegisterMode ? 'border-amber-400/30' : 'border-sky-400/30'} shadow-lg`}>
                                <Ionicons name="snow" size={28} color={isRegisterMode ? "#fbbf24" : "#38bdf8"} />
                            </View>
                            <Text className="text-2xl font-black text-white text-center tracking-tighter">WOS COMMANDER</Text>
                            <Text className={`${isRegisterMode ? 'text-amber-400/80' : 'text-sky-400/80'} font-bold mt-0.5 tracking-[0.2em] uppercase text-[9px]`}>Arctic Strategic Intelligence</Text>
                        </View>

                        {/* Top Navigation Tabs */}
                        <View className="flex-row bg-slate-950/40 p-1 rounded-2xl mb-5 border border-white/5">
                            <TouchableOpacity
                                onPress={() => setIsRegisterMode(false)}
                                className={`flex-1 py-2.5 rounded-xl items-center justify-center transition-all ${!isRegisterMode ? 'bg-sky-500/20 border border-sky-500/30' : 'opacity-40'}`}
                                // @ts-ignore - Web-specific property
                                tabIndex={-1}
                            >
                                <Text className={`font-black text-xs ${!isRegisterMode ? 'text-sky-400' : 'text-white'}`}>대시보드 입장</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setIsRegisterMode(true)}
                                className={`flex-1 py-2.5 rounded-xl items-center justify-center transition-all ${isRegisterMode ? 'bg-amber-500/20 border border-amber-500/30' : 'opacity-40'}`}
                                // @ts-ignore - Web-specific property
                                tabIndex={-1}
                            >
                                <Text className={`font-black text-sm ${isRegisterMode ? 'text-amber-400' : 'text-white'}`}>연맹 관리자 신청</Text>
                            </TouchableOpacity>
                        </View>

                        <View className="space-y-2.5">
                            {/* Row 1: Server and Alliance */}
                            <View className="flex-row gap-2.5" style={{ zIndex: (activeInput === 'server' || activeInput === 'alliance') ? 100 : 50 }}>
                                {/* Server Number */}
                                <View className="flex-1" style={{ zIndex: activeInput === 'server' ? 100 : 50 }}>
                                    <Text className="text-white/60 text-[10px] font-black ml-4 mb-1.5 uppercase tracking-widest">서버 번호</Text>
                                    <View className="relative">
                                        <View className="absolute left-2 top-0 bottom-0 z-10 w-12 items-center justify-center">
                                            <Ionicons name="server-outline" size={20} color={isRegisterMode ? "#fbbf24" : "#38bdf8"} />
                                        </View>
                                        <TextInput
                                            placeholder="#000"
                                            placeholderTextColor="#475569"
                                            value={inputServer}
                                            onChangeText={setInputServer}
                                            onFocus={() => setActiveInput('server')}
                                            onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                            className={`bg-slate-950/50 p-2.5 pl-14 rounded-2xl text-white font-black text-lg border-2 focus:border-opacity-100 ${isRegisterMode ? 'border-slate-800' : 'border-slate-800'} ${isRegisterMode ? 'focus:border-amber-500/50' : 'focus:border-sky-500/50'}`}
                                            keyboardType="number-pad"
                                            // @ts-ignore - Web-specific property
                                            tabIndex={1}
                                        />
                                        {renderHistorySuggestions('server')}
                                    </View>
                                </View>

                                {/* Alliance Name */}
                                <View className="flex-1" style={{ zIndex: activeInput === 'alliance' ? 100 : 40 }}>
                                    <Text className="text-white/60 text-[10px] font-black ml-4 mb-1.5 uppercase tracking-widest">연맹 이름</Text>
                                    <View className="relative">
                                        <View className="absolute left-2 top-0 bottom-0 z-10 w-12 items-center justify-center">
                                            <Ionicons name="shield-outline" size={20} color={isRegisterMode ? "#fbbf24" : "#38bdf8"} />
                                        </View>
                                        <TextInput
                                            placeholder="연맹 이름"
                                            placeholderTextColor="#475569"
                                            value={inputAlliance}
                                            onChangeText={setInputAlliance}
                                            onFocus={() => setActiveInput('alliance')}
                                            onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                            className={`bg-slate-950/50 p-2.5 pl-14 rounded-2xl text-white font-black text-lg border-2 focus:border-opacity-100 ${isRegisterMode ? 'border-slate-800' : 'border-slate-800'} ${isRegisterMode ? 'focus:border-amber-500/50' : 'focus:border-sky-500/50'}`}
                                            autoCapitalize="characters"
                                            // @ts-ignore - Web-specific property
                                            tabIndex={2}
                                        />
                                        {renderHistorySuggestions('alliance')}
                                    </View>
                                </View>
                            </View>

                            {/* Row 2: Lord Name and Password */}
                            <View className="flex-row gap-2.5" style={{ zIndex: activeInput === 'userid' ? 100 : 30 }}>
                                {/* Lord Name */}
                                <View className="flex-1" style={{ zIndex: activeInput === 'userid' ? 100 : 30 }}>
                                    <Text className="text-white/60 text-[10px] font-black ml-4 mb-1.5 uppercase tracking-widest">영주 이름</Text>
                                    <View className="relative">
                                        <View className="absolute left-2 top-0 bottom-0 z-10 w-12 items-center justify-center">
                                            <Ionicons name="person-outline" size={20} color={isRegisterMode ? "#fbbf24" : "#38bdf8"} />
                                        </View>
                                        <TextInput
                                            placeholder="ID/닉네임"
                                            placeholderTextColor="#475569"
                                            value={inputUserId}
                                            onChangeText={setInputUserId}
                                            onFocus={() => setActiveInput('userid')}
                                            onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                            className={`bg-slate-950/50 p-2.5 pl-14 rounded-2xl text-white font-black text-lg border-2 focus:border-opacity-100 ${isRegisterMode ? 'border-slate-800' : 'border-slate-800'} ${isRegisterMode ? 'focus:border-amber-500/50' : 'focus:border-sky-500/50'}`}
                                            // @ts-ignore - Web-specific property
                                            tabIndex={3}
                                        />
                                        {renderHistorySuggestions('userid')}
                                    </View>
                                </View>

                                {/* Password */}
                                <View className="flex-1" style={{ zIndex: 20 }}>
                                    <View className="flex-row justify-between items-center ml-4 mb-1.5 ">
                                        <Text className="text-white/60 text-[10px] font-black uppercase tracking-widest text-left ">비밀번호</Text>
                                        {isRegisterMode && (
                                            <Text className="text-amber-500/80 text-[8px] font-bold text-right ">* 필수</Text>
                                        )}
                                    </View>
                                    <View className="relative">
                                        <View className="absolute left-2 top-0 bottom-0 z-10 w-12 items-center justify-center">
                                            <Ionicons name="lock-closed-outline" size={20} color={isRegisterMode ? "#fbbf24" : "#38bdf8"} />
                                        </View>
                                        <TextInput
                                            placeholder="••••••"
                                            placeholderTextColor="#475569"
                                            value={inputPassword}
                                            onChangeText={setInputPassword}
                                            secureTextEntry={true}
                                            className={`bg-slate-950/50 p-2.5 pl-14 rounded-2xl text-white font-black text-lg border-2 focus:border-opacity-100 ${isRegisterMode ? 'border-slate-800' : 'border-slate-800'} ${isRegisterMode ? 'focus:border-amber-500/50' : 'focus:border-sky-500/50'}`}
                                            // @ts-ignore - Web-specific property
                                            tabIndex={4}
                                        />
                                    </View>
                                </View>
                            </View>
                            <View className="flex-row items-center mt-4">
                                <Pressable
                                    onPress={handleEnterAlliance}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            flex: 1,
                                            paddingVertical: 10,
                                            borderRadius: 16,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            overflow: 'hidden',
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.02 : 1) }],
                                            // @ts-ignore - Web-specific CSS property
                                            boxShadow: isRegisterMode
                                                ? '0 10px 30px rgba(245, 158, 11, 0.3)'
                                                : '0 10px 30px rgba(56, 189, 248, 0.3)',
                                            transition: 'all 0.3s ease',
                                        }
                                    ]}
                                >
                                    <LinearGradient
                                        colors={isRegisterMode ? ['#f59e0b', '#d97706'] : ['#38bdf8', '#0ea5e9']}
                                        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    />
                                    <Text className="text-white font-black text-lg tracking-tight relative z-10">
                                        {isRegisterMode ? '관리자 계정 생성 및 신청' : '입장하기'}
                                    </Text>
                                </Pressable>

                                <TouchableOpacity
                                    onPress={handleResetSettings}
                                    className="ml-3 w-[60px] h-[60px] bg-slate-950/40 rounded-2xl border border-white/5 items-center justify-center active:scale-95 transition-all"
                                >
                                    <Ionicons name="refresh-outline" size={24} color={isRegisterMode ? "#fbbf24" : "#38bdf8"} />
                                </TouchableOpacity>
                            </View>


                            {!!serverId && !!allianceId && (
                                <Pressable
                                    onPress={() => setIsGateOpen(false)}
                                    style={({ pressed, hovered }) => [
                                        {
                                            marginTop: 24,
                                            alignSelf: 'center',
                                            paddingVertical: 12,
                                            paddingHorizontal: 28,
                                            borderRadius: 9999,
                                            backgroundColor: hovered ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255,255,255,0.05)',
                                            borderWidth: 1,
                                            borderColor: hovered ? '#38bdf8' : 'rgba(255,255,255,0.1)',
                                            transform: [{ scale: pressed ? 0.95 : hovered ? 1.05 : 1 }],
                                            // @ts-ignore - Web-specific CSS property
                                            boxShadow: hovered
                                                ? '0 0 5px #38bdf8, 0 0 10px #38bdf8, 0 0 20px #38bdf8, 0 0 40px #0ea5e9, 0 0 80px #0ea5e9'
                                                : 'none',
                                            // @ts-ignore - Web-specific CSS property
                                            textShadow: hovered ? '0 0 10px #38bdf8, 0 0 20px #38bdf8' : 'none',
                                            transition: 'all 0.3s ease',
                                        }
                                    ]}
                                >
                                    {({ hovered }) => (
                                        <Text
                                            className={`font-bold text-[12px] tracking-tight ${hovered ? 'text-white' : 'text-slate-400'}`}
                                            style={hovered ? {
                                                // @ts-ignore - Web-specific CSS property
                                                textShadow: '0 0 5px #38bdf8, 0 0 10px #38bdf8, 0 0 20px #38bdf8'
                                            } : undefined}
                                        >
                                            ← 기존 대시보드로 돌아가기
                                        </Text>
                                    )}
                                </Pressable>
                            )}
                        </View>
                    </View>

                </View>

                {/* Custom Alert Modal (Shared with Gate ) */}
                <Modal visible={customAlert.visible} transparent animationType="fade" onRequestClose={() => setCustomAlert({ ...customAlert, visible: false })}>
                    <View className="flex-1 bg-black/80 items-center justify-center p-6">
                        <BlurView intensity={40} className="absolute inset-0" />
                        <View className={`w-full max-w-sm p-10 rounded-[48px] border shadow-2xl items-center ${isDark ? 'bg-slate-900 border-slate-800/60' : 'bg-white border-slate-100'}`}>
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
                            <TouchableOpacity onPress={() => setCustomAlert({ ...customAlert, visible: false })} className={`w-full py-5 rounded-3xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <Text className={`text-center font-bold text-lg ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>확인</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Modal>
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#f8fafc' }} className="w-full h-screen">
            <Stack.Screen options={{ headerShown: false }} />

            <ImageBackground
                source={require('../assets/images/bg-main.png')}
                style={{ position: 'absolute', width: '100%', height: '100%', opacity: isDark ? 0.3 : 0.05 }}
                resizeMode="cover"
            />

            <ScrollView
                ref={mainScrollRef}
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1 }}
                stickyHeaderIndices={[1]}
                scrollEventThrottle={16}
                onScroll={(e) => {
                    const y = e.nativeEvent.contentOffset.y;
                    if (y > 0) setDashboardScrollY(y);
                }}
            >
                {/* Section 1: Intro & Features */}
                <View className="w-full items-center">
                    <View className="w-full max-w-6xl px-4 md:px-8">
                        <View className="pt-12 pb-6 flex-row justify-between items-start">
                            <View className="flex-1 mr-4">
                                <Text className={`font-bold text-[9px] md:text-xs tracking-[0.4em] mb-1.5 uppercase ${isDark ? 'text-[#38bdf8]' : 'text-blue-600'}`}>Whiteout Survival</Text>
                                <Text className={`text-3xl md:text-5xl font-bold tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>WOS 커맨더</Text>
                                <View className={`w-10 md:w-14 h-1 rounded-full mt-2.5 ${isDark ? 'bg-[#38bdf8]' : 'bg-blue-600'}`} />
                                <Text className={`font-semibold text-[11px] md:text-xs mt-3.5 leading-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>최적의 영웅 조합과 전략으로{"\n"}빙하기의 생존을 지휘하세요</Text>

                                {!!serverId && !!allianceId && (
                                    <View className="flex-row items-center gap-4 mt-6 self-start">
                                        <TouchableOpacity
                                            onPress={() => {
                                                setInputServer(serverId);
                                                setInputAlliance(allianceId);
                                                setIsGateOpen(true);
                                            }}
                                            className={`flex-row items-center px-5 py-3 rounded-2xl border-2 active:scale-95 transition-all shadow-lg ${isDark ? 'bg-gradient-to-r from-sky-500/20 to-blue-500/20 border-sky-400/50 shadow-sky-500/20' : 'bg-gradient-to-r from-sky-50 to-blue-50 border-sky-200 shadow-sky-100'}`}
                                            style={isDark ? { shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 } : {}}
                                        >
                                            <View className={`mr-3 w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-sky-500/30' : 'bg-sky-100'}`}>
                                                <Ionicons name="location" size={16} color={isDark ? "#38bdf8" : "#0284c7"} />
                                            </View>
                                            <Text className={`font-black text-sm tracking-tight ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>
                                                #{serverId} · {allianceId}
                                            </Text>
                                            <View className={`ml-3 w-6 h-6 rounded-full items-center justify-center ${isDark ? 'bg-sky-500/20' : 'bg-sky-100'}`}>
                                                <Ionicons name="chevron-forward" size={14} color={isDark ? "#38bdf8" : "#0284c7"} />
                                            </View>
                                        </TouchableOpacity>

                                        {/* Font Size Controls - Moved Here */}
                                        <View className={`flex-row p-1.5 rounded-2xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                                            <TouchableOpacity
                                                onPress={() => changeFontSize(Math.max(0.8, fontSizeScale - 0.1))}
                                                className={`w-10 h-10 rounded-xl items-center justify-center mr-1 ${isDark ? 'bg-slate-700 active:bg-slate-600' : 'bg-slate-50 border border-slate-100 active:bg-slate-100'}`}
                                            >
                                                <Ionicons name="text" size={14} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginBottom: -2 }} />
                                                <Ionicons name="remove" size={10} color={isDark ? "white" : "black"} style={{ position: 'absolute', top: 6, right: 6 }} />
                                            </TouchableOpacity>
                                            <View className="h-full w-[1px] bg-slate-500/20 mx-1" />
                                            <TouchableOpacity
                                                onPress={() => changeFontSize(Math.min(1.5, fontSizeScale + 0.1))}
                                                className={`w-10 h-10 rounded-xl items-center justify-center ml-1 ${isDark ? 'bg-slate-700 active:bg-slate-600' : 'bg-slate-50 border border-slate-100 active:bg-slate-100'}`}
                                            >
                                                <Ionicons name="text" size={18} color={isDark ? "white" : "#0f172a"} style={{ marginBottom: -2 }} />
                                                <Ionicons name="add" size={10} color={isDark ? "#38bdf8" : "#0284c7"} style={{ position: 'absolute', top: 4, right: 4 }} />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
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
                                        onPress={() => {
                                            if (Platform.OS === 'web') {
                                                window.open('/manual.html', '_blank');
                                            }
                                        }}
                                        onHoverIn={() => setHoveredHeaderBtn('help')}
                                        onHoverOut={() => setHoveredHeaderBtn(null)}
                                        className={`p-2.5 rounded-full border active:scale-95 transition-transform ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200 shadow-sm'}`}
                                    >
                                        <Ionicons name="help-circle-outline" size={22} color={isDark ? "#a78bfa" : "#7c3aed"} />
                                    </Pressable>
                                    {hoveredHeaderBtn === 'help' && (
                                        <View className="absolute top-12 right-0 z-[100] items-end animate-in fade-in slide-in-from-top-1 duration-200" style={{ pointerEvents: 'none' }}>
                                            <View className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-black' : 'bg-white border-slate-200 shadow-slate-200'} border px-4 py-2.5 rounded-xl shadow-2xl`} style={{ alignSelf: 'flex-end' }}>
                                                <Text numberOfLines={1} className={`${isDark ? 'text-slate-200' : 'text-slate-700'} text-[10px] font-black whitespace-nowrap`}>
                                                    📖 사용자 매뉴얼
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
                                                <Text numberOfLines={1} className={`${isDark ? 'text-slate-200' : 'text-slate-700'} text-[10px] font-black whitespace-nowrap`}>
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
                                        className={`p-2.5 rounded-full border-2 active:scale-95 transition-transform ${auth.isLoggedIn
                                            ? (auth.role === 'super_admin' || auth.role === 'master')
                                                ? (isDark ? 'bg-rose-500/40 border-rose-400' : 'bg-rose-100 border-rose-400')
                                                : auth.role === 'alliance_admin'
                                                    ? (isDark ? 'bg-indigo-500/40 border-indigo-400' : 'bg-indigo-100 border-indigo-400')
                                                    : auth.role === 'admin'
                                                        ? (isDark ? 'bg-cyan-500/40 border-cyan-400' : 'bg-cyan-100 border-cyan-400')
                                                        : (isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200 shadow-sm')
                                            : (isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200 shadow-sm')
                                            }`}
                                    >
                                        <Ionicons
                                            name="person-circle"
                                            size={22}
                                            color={
                                                auth.isLoggedIn
                                                    ? (auth.role === 'super_admin' || auth.role === 'master')
                                                        ? "#fb7185" // Rose-400 - 전체서버관리자/마스터
                                                        : auth.role === 'alliance_admin'
                                                            ? "#818cf8" // Indigo-400 - 연맹관리자
                                                            : auth.role === 'admin'
                                                                ? "#22d3ee" // Cyan-400 - 운영관리자
                                                                : (isDark ? "#94a3b8" : "#64748b") // Slate - 일반영주
                                                    : (isDark ? "white" : "#333333") // 비로그인
                                            }
                                        />
                                    </Pressable>
                                    {hoveredHeaderBtn === 'admin' && (
                                        <View className="absolute top-12 right-0 z-[100] items-end animate-in fade-in slide-in-from-top-1 duration-200" style={{ pointerEvents: 'none' }}>
                                            <View className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-black' : 'bg-white border-slate-200 shadow-slate-200'} border px-4 py-2.5 rounded-xl shadow-2xl`} style={{ alignSelf: 'flex-end' }}>
                                                <Text numberOfLines={1} className={`${isDark ? 'text-slate-200' : 'text-slate-700'} text-[10px] font-black whitespace-nowrap`}>
                                                    {auth.isLoggedIn
                                                        ? (auth.role === 'super_admin' || auth.role === 'master')
                                                            ? '🔴 전체서버관리자'
                                                            : auth.role === 'alliance_admin'
                                                                ? '🔵 연맹관리자'
                                                                : auth.role === 'admin'
                                                                    ? '🟢 운영관리자'
                                                                    : '⚪ 일반영주'
                                                        : '관리자 로그인'}
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
                                <View className={`p-5 rounded-3xl border-2 flex-row items-center ${notice.visible ? (isDark ? 'bg-amber-900/30 border-amber-400/40' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-300') : (isDark ? 'bg-slate-800/60 border-slate-700 border-dashed' : 'bg-slate-50 border-slate-200 border-dashed')}`}
                                    style={notice.visible && isDark ? { shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 12 } : {}}
                                >
                                    <View className="mr-4">
                                        <View className={`w-12 h-12 rounded-2xl items-center justify-center ${notice.visible ? (isDark ? 'bg-gradient-to-br from-amber-500/30 to-orange-500/30' : 'bg-gradient-to-br from-amber-100 to-orange-100') : (isDark ? 'bg-slate-700' : 'bg-slate-100')}`}>
                                            <Ionicons name={notice.visible ? "notifications" : "notifications-off"} size={24} color={notice.visible ? "#f59e0b" : "#94a3b8"} />
                                        </View>
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`font-black text-[10px] tracking-widest uppercase mb-1 ${notice.visible ? (isDark ? 'text-amber-400' : 'text-amber-600') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>알림</Text>
                                        <Text className={`text-base font-bold ${notice.visible ? (isDark ? 'text-amber-100' : 'text-slate-800') : (isDark ? 'text-slate-400' : 'text-slate-500')}`} numberOfLines={1}>{notice.content || '(공지 내용 없음)'}</Text>
                                    </View>
                                    <View className={`w-8 h-8 rounded-full items-center justify-center ${isDark ? 'bg-amber-500/10' : 'bg-amber-100'}`}>
                                        <Ionicons name="chevron-forward" size={18} color={notice.visible ? (isDark ? "#f59e0b" : "#d97706") : "#94a3b8"} />
                                    </View>
                                    {!!auth.isLoggedIn && (
                                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleOpenNotice(); }} className={`ml-3 p-2 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}><Ionicons name="pencil" size={16} color="#38bdf8" /></TouchableOpacity>
                                    )}
                                </View>
                            </TouchableOpacity>
                        )}

                        {/* Feature Cards Grid */}
                        <View className="flex-row flex-wrap gap-3 mb-8">
                            <TouchableOpacity onPress={() => router.push('/growth/events')} className={`p-5 rounded-3xl border-2 shadow-xl active:scale-[0.98] transition-all ${isDark ? 'bg-slate-900/80 border-slate-700 shadow-blue-900/30' : 'bg-white border-slate-200 shadow-slate-200/50'}`} style={{ flex: 1, minWidth: 160 }}>
                                <View className="flex-row items-center">
                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-3 ${isDark ? 'bg-gradient-to-br from-blue-500/30 to-indigo-500/30' : 'bg-gradient-to-br from-sky-50 to-blue-100'}`}
                                        style={isDark ? { shadowColor: '#60a5fa', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 } : {}}
                                    >
                                        <Ionicons name="calendar" size={24} color={isDark ? "#60a5fa" : "#0284c7"} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>이벤트</Text>
                                        <Text className={`font-semibold text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`} numberOfLines={1}>연맹전략 및 일정</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => router.push('/strategy-sheet')} className={`p-5 rounded-3xl border-2 shadow-xl active:scale-[0.98] transition-all ${isDark ? 'bg-slate-900/80 border-slate-700 shadow-emerald-900/30' : 'bg-white border-slate-200 shadow-slate-200/50'}`} style={{ flex: 1, minWidth: 160 }}>
                                <View className="flex-row items-center">
                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-3 ${isDark ? 'bg-gradient-to-br from-emerald-500/30 to-green-500/30' : 'bg-gradient-to-br from-emerald-50 to-green-100'}`}
                                        style={isDark ? { shadowColor: '#10b981', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 } : {}}
                                    >
                                        <Ionicons name="map" size={24} color={isDark ? "#10b981" : "#059669"} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>전략 문서</Text>
                                        <Text className={`font-semibold text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`} numberOfLines={1}>배치도 및 공지</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity onPress={() => router.push('/hero-management')} className={`p-5 rounded-3xl border-2 shadow-xl active:scale-[0.98] transition-all ${isDark ? 'bg-slate-900/80 border-slate-700 shadow-blue-900/30' : 'bg-white border-slate-200 shadow-slate-200/50'}`} style={{ flex: 1, minWidth: 160 }}>
                                <View className="flex-row items-center">
                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-3 ${isDark ? 'bg-gradient-to-br from-cyan-500/30 to-blue-500/30' : 'bg-gradient-to-br from-cyan-50 to-blue-100'}`}
                                        style={isDark ? { shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 } : {}}
                                    >
                                        <Ionicons name="people" size={24} color={isDark ? "#38bdf8" : "#2563eb"} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`} numberOfLines={1}>영웅 정보</Text>
                                        <Text className={`font-semibold text-[11px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`} numberOfLines={1}>스탯 및 스킬</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Section 2: Sticky Weekly Header */}
                <View className={`w-full items-center z-50 py-3 ${isDark ? 'bg-[#060b14]' : 'bg-slate-50'}`}>
                    <View className="w-full max-w-6xl px-4 md:px-8">
                        <View className={`flex-row flex-wrap items-center justify-between gap-y-4 px-6 py-5 rounded-[32px] border ${isDark ? 'bg-slate-900/90 border-slate-800' : 'bg-white border-slate-200 shadow-lg'}`}>
                            <View className="flex-row items-center">
                                <View className={`w-1.5 h-6 rounded-full mr-4 ${isDark ? 'bg-[#38bdf8]' : 'bg-blue-600'}`} />
                                <View>
                                    <Text className={`text-[10px] font-black tracking-[0.2em] uppercase mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Weekly Program</Text>
                                    <Text className={`text-2xl md:text-3xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>금주의 이벤트</Text>
                                </View>
                            </View>
                            <View className={`flex-row p-1.5 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200 shadow-sm'}`}>
                                <TouchableOpacity
                                    onPress={() => setTimezone('KST')}
                                    className={`px-4 py-2 rounded-xl ${timezone === 'KST' ? (isDark ? 'bg-blue-600' : 'bg-blue-600') : ''}`}
                                >
                                    <Text className={`text-[11px] font-black ${timezone === 'KST' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>KST</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => setTimezone('UTC')}
                                    className={`px-4 py-2 rounded-xl ${timezone === 'UTC' ? (isDark ? 'bg-blue-600' : 'bg-blue-600') : ''}`}
                                >
                                    <Text className={`text-[11px] font-black ${timezone === 'UTC' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>UTC</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Section 3: Event List */}
                <View className="w-full items-center pb-24">
                    <View className="w-full max-w-6xl px-4 md:px-8">
                        <View className="flex-col gap-3">
                            {loading ? (
                                <View className={`p-16 rounded-[32px] border border-dashed items-center justify-center ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                    <Text className={`font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>일정을 불러오는 중...</Text>
                                </View>
                            ) : displayEvents.length > 0 ? (
                                <View className="flex-col gap-4">
                                    {/* Event Tabs - Folder Style */}
                                    {(() => {
                                        const activeEvents = displayEvents.filter(e => isEventActive(e));
                                        const upcomingEvents = displayEvents.filter(e => !isEventActive(e) && !isEventExpired(e));
                                        const expiredEvents = displayEvents.filter(e => isEventExpired(e));

                                        const getTabColor = (type: string, isActive: boolean) => {
                                            if (type === 'active') return isActive ? (isDark ? 'bg-blue-600' : 'bg-blue-500') : (isDark ? 'bg-slate-800' : 'bg-slate-200');
                                            if (type === 'upcoming') return isActive ? (isDark ? 'bg-emerald-600' : 'bg-emerald-500') : (isDark ? 'bg-slate-800' : 'bg-slate-200');
                                            if (type === 'expired') return isActive ? (isDark ? 'bg-slate-600' : 'bg-slate-500') : (isDark ? 'bg-slate-800' : 'bg-slate-200');
                                            return 'bg-transparent';
                                        };

                                        const activeTabColor =
                                            activeEventTab === 'active' ? (isDark ? '#3b82f6' : '#2563eb') :
                                                activeEventTab === 'upcoming' ? (isDark ? '#10b981' : '#059669') :
                                                    (isDark ? '#64748b' : '#475569');

                                        return (
                                            <>
                                                {/* Tab Navigation */}
                                                <View className="flex-row items-end px-0 gap-1.5 ml-1">
                                                    <TouchableOpacity
                                                        activeOpacity={0.9}
                                                        onPress={() => switchEventTab('active')}
                                                        className={`flex-1 rounded-t-3xl items-center justify-center transition-all ${getTabColor('active', activeEventTab === 'active')} ${activeEventTab === 'active' ? 'py-5 -mb-[6px] z-10 shadow-xl' : 'py-3 mb-0 opacity-60'}`}
                                                    >
                                                        <View className="flex-row items-center">
                                                            <Ionicons name="flash" size={activeEventTab === 'active' ? 18 : 16} color={activeEventTab === 'active' ? '#fff' : (isDark ? '#94a3b8' : '#64748b')} style={{ marginRight: 6 }} />
                                                            <Text className={`font-black ${activeEventTab === 'active' ? 'text-base text-white' : (isDark ? 'text-sm text-slate-400' : 'text-sm text-slate-500')}`}>
                                                                진행 {activeEvents.length}
                                                            </Text>
                                                        </View>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        activeOpacity={0.9}
                                                        onPress={() => switchEventTab('upcoming')}
                                                        className={`flex-1 rounded-t-3xl items-center justify-center transition-all ${getTabColor('upcoming', activeEventTab === 'upcoming')} ${activeEventTab === 'upcoming' ? 'py-5 -mb-[6px] z-10 shadow-xl' : 'py-3 mb-0 opacity-60'}`}
                                                    >
                                                        <View className="flex-row items-center">
                                                            <Ionicons name="time" size={activeEventTab === 'upcoming' ? 18 : 16} color={activeEventTab === 'upcoming' ? '#fff' : (isDark ? '#94a3b8' : '#64748b')} style={{ marginRight: 6 }} />
                                                            <Text className={`font-black ${activeEventTab === 'upcoming' ? 'text-base text-white' : (isDark ? 'text-sm text-slate-400' : 'text-sm text-slate-500')}`}>
                                                                예정 {upcomingEvents.length}
                                                            </Text>
                                                        </View>
                                                    </TouchableOpacity>

                                                    <TouchableOpacity
                                                        activeOpacity={0.9}
                                                        onPress={() => switchEventTab('expired')}
                                                        className={`flex-1 rounded-t-3xl items-center justify-center transition-all ${getTabColor('expired', activeEventTab === 'expired')} ${activeEventTab === 'expired' ? 'py-5 -mb-[6px] z-10 shadow-xl' : 'py-3 mb-0 opacity-60'}`}
                                                    >
                                                        <View className="flex-row items-center">
                                                            <Ionicons name="checkmark-circle" size={activeEventTab === 'expired' ? 18 : 16} color={activeEventTab === 'expired' ? '#fff' : (isDark ? '#94a3b8' : '#64748b')} style={{ marginRight: 6 }} />
                                                            <Text className={`font-black ${activeEventTab === 'expired' ? 'text-base text-white' : (isDark ? 'text-sm text-slate-400' : 'text-sm text-slate-500')}`}>
                                                                종료 {expiredEvents.length}
                                                            </Text>
                                                        </View>
                                                    </TouchableOpacity>
                                                </View>

                                                {/* Connected Content Container */}
                                                <View className={`w-full p-4 rounded-b-[40px] rounded-tr-[40px] min-h-[200px] border-t-[6px] ${isDark ? 'bg-slate-900/60' : 'bg-slate-50'}`}
                                                    style={{
                                                        borderTopColor: activeTabColor,
                                                        shadowColor: activeTabColor,
                                                        shadowOffset: { width: 0, height: 4 },
                                                        shadowOpacity: isDark ? 0.4 : 0.2,
                                                        shadowRadius: 20,
                                                        elevation: 10
                                                    }}
                                                >
                                                    {activeEventTab === 'active' && (
                                                        activeEvents.length > 0 ? (
                                                            <View className="flex-row flex-wrap -mx-2">
                                                                {activeEvents.map((event, idx) => renderEventCard(event, `active-${idx}`))}
                                                            </View>
                                                        ) : (
                                                            <View className="py-12 items-center justify-center">
                                                                <Ionicons name="flash-off-outline" size={32} color={isDark ? '#475569' : '#94a3b8'} style={{ marginBottom: 12 }} />
                                                                <Text className={`font-bold text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>진행 중인 이벤트가 없습니다</Text>
                                                            </View>
                                                        )
                                                    )}

                                                    {activeEventTab === 'upcoming' && (
                                                        upcomingEvents.length > 0 ? (
                                                            <View className="flex-row flex-wrap -mx-2">
                                                                {upcomingEvents.map((event, idx) => renderEventCard(event, `upcoming-${idx}`))}
                                                            </View>
                                                        ) : (
                                                            <View className="py-12 items-center justify-center">
                                                                <Ionicons name="calendar-outline" size={32} color={isDark ? '#475569' : '#94a3b8'} style={{ marginBottom: 12 }} />
                                                                <Text className={`font-bold text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>예정된 이벤트가 없습니다</Text>
                                                            </View>
                                                        )
                                                    )}

                                                    {activeEventTab === 'expired' && (
                                                        expiredEvents.length > 0 ? (
                                                            <View className="flex-row flex-wrap -mx-2">
                                                                {expiredEvents.map((event, idx) => renderEventCard(event, `expired-${idx}`))}
                                                            </View>
                                                        ) : (
                                                            <View className="py-12 items-center justify-center">
                                                                <Ionicons name="checkmark-done-outline" size={32} color={isDark ? '#475569' : '#94a3b8'} style={{ marginBottom: 12 }} />
                                                                <Text className={`font-bold text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>종료된 이벤트가 없습니다</Text>
                                                            </View>
                                                        )
                                                    )}
                                                </View>
                                            </>
                                        );
                                    })()}
                                </View>
                            ) : (
                                <View className={`p-16 rounded-[32px] border border-dashed items-center justify-center ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                    <Text className={`font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>등록된 일정이 없습니다.</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Modern Refined Footer */}
                    <View className={`mt-24 mb-16 items-center`}>
                        {/* Thin Subtle Divider */}
                        <View className={`w-full h-[1px] mb-12 self-stretch ${isDark ? 'bg-slate-800/40' : 'bg-slate-200/60'}`} />

                        <View className="items-center px-12">
                            <Text className={`text-[10px] font-black tracking-[0.2em] uppercase text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                                © 2026 WOS Studio  —  Designed by SSJ
                            </Text>

                            {/* Optional: Subtle Underline/Accent */}
                            <View className={`mt-4 w-6 h-0.5 rounded-full ${isDark ? 'bg-sky-500/20' : 'bg-sky-500/10'}`} />
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

            <Modal visible={adminMenuVisible} transparent animationType="slide" onRequestClose={() => setAdminMenuVisible(false)}>
                <View className="flex-1 bg-black/70 items-center justify-center p-6">
                    <View className={`w-full max-w-sm p-8 rounded-[40px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <View className="flex-row items-center justify-center mb-8 pt-2">
                            <Ionicons name="shield-checkmark" size={28} color={isDark ? "#38bdf8" : "#2563eb"} style={{ marginRight: 10 }} />
                            <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {isSuperAdmin ? '시스템 관리' : '연맹 관리'}
                            </Text>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} className="flex-none">
                            <TouchableOpacity
                                onPress={async () => {
                                    await logout();
                                    setAdminMenuVisible(false);
                                    setAllianceInfo(null, null);
                                    setIsGateOpen(true);
                                }}
                                // @ts-ignore
                                onMouseEnter={() => setAdminMenuHover('logout')}
                                onMouseLeave={() => setAdminMenuHover(null)}
                                className={`p-6 rounded-[24px] mb-4 flex-row items-center justify-center border transition-all duration-300 ${adminMenuHover === 'logout' ? 'bg-red-500/10 border-red-500/40' : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm')}`}
                            >
                                <Ionicons name="log-out-outline" size={22} color={adminMenuHover === 'logout' ? '#ef4444' : '#ef4444'} style={{ marginRight: 10 }} />
                                <Text className={`font-black text-xl ${adminMenuHover === 'logout' ? (isDark ? 'text-red-400' : 'text-red-500') : (isDark ? 'text-white' : 'text-slate-800')}`}>로그아웃</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setAdminDashboardVisible(true)}
                                // @ts-ignore
                                onMouseEnter={() => setAdminMenuHover('members')}
                                onMouseLeave={() => setAdminMenuHover(null)}
                                className={`p-6 rounded-[24px] mb-4 flex-row items-center justify-center border transition-all duration-300 ${adminMenuHover === 'members' ? 'bg-sky-500/10 border-sky-500/40' : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm')}`}
                            >
                                <Ionicons name="people-outline" size={22} color={adminMenuHover === 'members' ? '#0ea5e9' : '#38bdf8'} style={{ marginRight: 10 }} />
                                <Text className={`font-black text-xl ${adminMenuHover === 'members' ? (isDark ? 'text-sky-400' : 'text-sky-600') : (isDark ? 'text-white' : 'text-slate-800')}`}>연맹원 관리</Text>
                            </TouchableOpacity>

                            {!!isSuperAdmin && (
                                <View className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <Text className={`font-bold mb-4 text-center text-[10px] uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>System Administration</Text>

                                    <TouchableOpacity
                                        onPress={() => setShowAdminList(!showAdminList)}
                                        // @ts-ignore
                                        onMouseEnter={() => setAdminMenuHover('staff')}
                                        onMouseLeave={() => setAdminMenuHover(null)}
                                        className={`p-5 rounded-[20px] border mb-3 flex-row justify-center items-center transition-all duration-300 ${adminMenuHover === 'staff' ? 'bg-indigo-600/10 border-indigo-500/40' : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm')}`}
                                    >
                                        <Ionicons name="people-outline" size={18} color={adminMenuHover === 'staff' ? '#818cf8' : '#818cf8'} style={{ marginRight: 8 }} />
                                        <Text className={`font-bold text-sm ${adminMenuHover === 'staff' ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : (isDark ? 'text-white' : 'text-slate-800')}`}>운영진 관리</Text>
                                    </TouchableOpacity>

                                    {!!showAdminList && (
                                        <View className={`p-4 rounded-[20px] mb-3 border ${isDark ? 'bg-black/20 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                            <View className="mb-3 space-y-2">
                                                <TextInput className={`w-full p-3 rounded-xl border text-xs font-semibold ${isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200'}`} placeholder="운영진 이름" placeholderTextColor={isDark ? "#475569" : "#94a3b8"} value={newAdminName} onChangeText={setNewAdminName} />
                                                <TextInput className={`w-full p-3 rounded-xl border text-xs font-semibold ${isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200'}`} placeholder="비밀번호 설정" placeholderTextColor={isDark ? "#475569" : "#94a3b8"} value={newAdminPassword} onChangeText={setNewAdminPassword} secureTextEntry={true} />
                                                <View className="flex-row gap-2 pt-1">
                                                    <TouchableOpacity
                                                        onPress={() => setNewAdminRole(newAdminRole === 'admin' ? 'alliance_admin' : 'admin')}
                                                        className={`flex-[2.5] py-3 px-4 justify-center items-center rounded-xl border ${newAdminRole === 'alliance_admin' ? (isDark ? 'bg-sky-600/20 border-sky-500' : 'bg-sky-50 border-sky-200') : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200')}`}
                                                    >
                                                        <Text className={`${newAdminRole === 'alliance_admin' ? 'text-sky-500' : 'text-slate-400'} text-xs font-black`}>
                                                            {newAdminRole === 'alliance_admin' ? '연맹 관리자' : '운영 관리자'}
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={async () => { const hashed = newAdminPassword ? await hashPassword(newAdminPassword) : ''; if (await addAdmin(newAdminName, auth.adminName || '', newAdminRole, hashed)) { setNewAdminName(''); setNewAdminPassword(''); showCustomAlert('성공', '운영진이 추가되었습니다.', 'success'); } }} className="flex-1 bg-blue-600 py-3 justify-center items-center rounded-xl shadow-lg shadow-blue-500/30"><Ionicons name="add" size={20} color="white" /></TouchableOpacity>
                                                </View>
                                            </View>
                                            <View className="max-h-40 rounded-xl overflow-hidden">
                                                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true} style={{ flexGrow: 0 }}>
                                                    {dynamicAdmins.map(a => (
                                                        <View key={a.name} className={`flex-row justify-between items-center py-2.5 px-3 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                                                            <Text className={`text-xs font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{a.name}</Text>
                                                            <TouchableOpacity onPress={() => removeAdmin(a.name)} hitSlop={10}><Ionicons name="trash-outline" size={14} color="#ef4444" /></TouchableOpacity>
                                                        </View>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        onPress={() => { setIsSuperAdminDashboardVisible(true); }}
                                        // @ts-ignore
                                        onMouseEnter={() => setAdminMenuHover('super')}
                                        onMouseLeave={() => setAdminMenuHover(null)}
                                        className={`p-5 rounded-[20px] border mb-3 flex-row justify-center items-center transition-all duration-300 ${adminMenuHover === 'super' ? 'bg-slate-800/50 border-slate-700' : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm')}`}
                                    >
                                        <Ionicons name="shield-checkmark-outline" size={18} color={adminMenuHover === 'super' ? '#38bdf8' : '#38bdf8'} style={{ marginRight: 8 }} />
                                        <Text className={`font-bold text-sm ${adminMenuHover === 'super' ? (isDark ? 'text-sky-400' : 'text-sky-600') : (isDark ? 'text-white' : 'text-slate-800')}`}>시스템 관리</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>

                        <TouchableOpacity
                            onPress={() => setAdminMenuVisible(false)}
                            // @ts-ignore
                            onMouseEnter={() => setAdminMenuHover('close')}
                            onMouseLeave={() => setAdminMenuHover(null)}
                            className={`py-5 mt-6 rounded-[24px] items-center border transition-all duration-300 ${adminMenuHover === 'close' ? 'border-slate-400/50' : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200')}`}
                        >
                            <Text className={`font-black text-sm tracking-widest uppercase ${adminMenuHover === 'close' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>닫기</Text>
                        </TouchableOpacity>
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
                                    <Text className="text-white text-center font-black text-lg">확인</Text>
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
            {/* --- Super Admin Dashboard Modal --- */}
            <Modal
                visible={isSuperAdminDashboardVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setIsSuperAdminDashboardVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#f8fafc' }}>
                    {/* Global Fixed Background Layer */}
                    <View style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: -1,
                    }}>
                        <Image
                            source={require('../assets/images/bg-main.png')}
                            style={{ width: '100%', height: '100%', opacity: isDark ? 0.3 : 0.1 }}
                            resizeMode="cover"
                        />
                    </View>

                    <ScrollView className="flex-1 px-4" contentContainerStyle={{ paddingTop: 80, paddingBottom: 40 }}>
                        {/* Header */}
                        <View className="mb-10 px-4">
                            <Text className={`text-[10px] font-black tracking-[0.3em] uppercase mb-1 ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>System Administration</Text>
                            <Text className={`text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>시스템관리자 대시보드</Text>
                            <View className="w-12 h-1 bg-sky-500 rounded-full mt-4" />
                        </View>

                        {/* Stats */}
                        <View className="flex-row gap-4 mb-8">
                            <View className={`flex-1 p-6 rounded-[32px] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                <Text className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>승인 대기</Text>
                                <Text className={`text-4xl font-black ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>
                                    {allRequests.filter(r => r.status === 'pending').length}
                                </Text>
                            </View>
                            <View className={`flex-1 p-6 rounded-[32px] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                <Text className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>활성 연맹 수</Text>
                                <Text className={`text-4xl font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                                    {allRequests.filter(r => r.status === 'approved').length}
                                </Text>
                            </View>
                        </View>

                        {/* Tabs */}
                        <View className={`flex-row p-1.5 rounded-2xl mb-8 ${isDark ? 'bg-slate-900' : 'bg-slate-200/50'}`}>
                            <TouchableOpacity
                                onPress={() => setSuperAdminTab('pending')}
                                className={`flex-1 py-4 rounded-xl items-center ${superAdminTab === 'pending' ? (isDark ? 'bg-slate-800' : 'bg-white shadow-sm') : ''}`}
                            >
                                <Text className={`font-black text-xs ${superAdminTab === 'pending' ? (isDark ? 'text-white' : 'text-slate-900') : 'text-slate-500'}`}>승인 대기열</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setSuperAdminTab('alliances')}
                                className={`flex-1 py-4 rounded-xl items-center ${superAdminTab === 'alliances' ? (isDark ? 'bg-slate-800' : 'bg-white shadow-sm') : ''}`}
                            >
                                <Text className={`font-black text-xs ${superAdminTab === 'alliances' ? (isDark ? 'text-white' : 'text-slate-900') : 'text-slate-500'}`}>등록된 연맹</Text>
                            </TouchableOpacity>
                        </View>

                        {isSuperAdminLoading ? (
                            <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 40 }} />
                        ) : (
                            <View>
                                {allRequests.filter(r => superAdminTab === 'pending' ? r.status === 'pending' : r.status === 'approved').length === 0 ? (
                                    <View className="items-center justify-center py-20">
                                        <Ionicons name="documents-outline" size={64} color={isDark ? '#334155' : '#cbd5e1'} />
                                        <Text className={`mt-4 font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>데이터가 없습니다.</Text>
                                    </View>
                                ) : (
                                    allRequests.filter(r => superAdminTab === 'pending' ? r.status === 'pending' : r.status === 'approved').map((req) => (
                                        <View key={req.id} className={`p-6 rounded-[32px] border mb-4 shadow-xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                            <View className="flex-row justify-between mb-4">
                                                <View>
                                                    <View className="flex-row items-center mb-1">
                                                        <Text className="text-xs font-black px-2 py-0.5 rounded bg-sky-500/10 text-sky-500 mr-2">{req.serverId}</Text>
                                                        <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{req.allianceId}</Text>
                                                    </View>
                                                    <Text className={`text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{req.allianceName}</Text>
                                                </View>
                                                <View className="items-end">
                                                    <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(req.requestedAt).toLocaleDateString()}</Text>
                                                </View>
                                            </View>
                                            <View className={`p-4 rounded-2xl mb-6 ${isDark ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
                                                <Text className={`text-xs font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Admin ID: <Text className={isDark ? 'text-slate-200' : 'text-slate-800'}>{req.adminId}</Text></Text>
                                                <Text className={`text-xs font-bold mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Contact: <Text className={isDark ? 'text-slate-200' : 'text-slate-800'}>{req.contact || '-'}</Text></Text>
                                            </View>
                                            {req.status === 'pending' && (
                                                <View className="flex-row gap-3">
                                                    <TouchableOpacity onPress={() => handleRejectRequest(req)} className="flex-1 py-4 rounded-2xl border border-red-500/30 bg-red-500/5"><Text className="text-center font-bold text-red-500">거절</Text></TouchableOpacity>
                                                    <TouchableOpacity onPress={() => handleApproveRequest(req)} className="flex-[2] bg-sky-500 py-4 rounded-2xl"><Text className="text-center font-black text-white">승인 및 계정 생성</Text></TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    ))
                                )}
                            </View>
                        )}
                    </ScrollView>

                    {/* Floating Close Button */}
                    <TouchableOpacity
                        onPress={() => setIsSuperAdminDashboardVisible(false)}
                        className="absolute top-6 right-6 w-14 h-14 rounded-full bg-sky-500 items-center justify-center shadow-2xl border-2 border-white/20"
                        style={{ zIndex: 100 }}
                    >
                        <Ionicons name="close" size={32} color="white" />
                    </TouchableOpacity>
                </View>
            </Modal>

            <Modal visible={adminDashboardVisible} animationType="slide" onRequestClose={() => setAdminDashboardVisible(false)}>
                <AdminManagement
                    serverId={serverId}
                    allianceId={allianceId}
                    onBack={() => {
                        setAdminDashboardVisible(false);
                        setAdminMenuVisible(false);
                    }}
                />
            </Modal>

            {/* Notice Popup Modal */}
            <Modal visible={noticePopupVisible} transparent animationType="fade" onRequestClose={() => dismissNoticePopup()}>
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <BlurView intensity={40} className="absolute inset-0" />
                    <View className={`w-full max-w-md rounded-[32px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800/60' : 'bg-white border-slate-100'}`}>
                        {/* Header */}
                        <View className={`px-8 py-6 border-b ${isDark ? 'bg-gradient-to-r from-amber-900/30 to-orange-900/30 border-amber-500/20' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'}`}>
                            <View className="flex-row items-center">
                                <View className={`w-14 h-14 rounded-2xl items-center justify-center mr-4 ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                                    <Ionicons name="notifications" size={28} color="#f59e0b" />
                                </View>
                                <View className="flex-1">
                                    <Text className={`text-[10px] font-black tracking-widest uppercase ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>ANNOUNCEMENT</Text>
                                    <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>공지사항</Text>
                                </View>
                            </View>
                        </View>

                        {/* Content */}
                        <View className="px-8 py-6">
                            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                                <Text className={`text-base leading-7 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {notice?.content || '공지 내용이 없습니다.'}
                                </Text>
                            </ScrollView>
                        </View>

                        {/* Options */}
                        <View className={`px-8 py-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                            <TouchableOpacity
                                onPress={() => setNoticePopupDontShow(!noticePopupDontShow)}
                                className="flex-row items-center mb-4"
                            >
                                <View className={`w-6 h-6 rounded-lg border-2 mr-3 items-center justify-center ${noticePopupDontShow ? 'bg-amber-500 border-amber-500' : (isDark ? 'border-slate-600' : 'border-slate-300')}`}>
                                    {noticePopupDontShow && <Ionicons name="checkmark" size={16} color="white" />}
                                </View>
                                <Text className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>이 공지 다시 보지 않기</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Buttons */}
                        <View className="flex-row gap-3 px-8 pb-8">
                            <TouchableOpacity
                                onPress={() => dismissNoticePopup(false, true)}
                                className={`flex-1 py-4 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                            >
                                <Text className={`text-center font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>오늘 하루 안 보기</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => dismissNoticePopup(noticePopupDontShow, false)}
                                className={`flex-[1.5] py-4 rounded-2xl ${isDark ? 'bg-amber-500' : 'bg-amber-500'}`}
                            >
                                <Text className="text-center font-black text-white">확인</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View >
    );

}
