import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
    ActivityIndicator,
    useWindowDimensions,
    Easing
} from 'react-native';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '../services/i18n';
import { BlurView } from 'expo-blur';
import { useAuth, useTheme, useLanguage } from './context';
import { MASTER_CREDENTIALS, SUPER_ADMINS, AdminStatus } from '../data/admin-config';
import { useFirestoreEventSchedules } from '../hooks/useFirestoreEventSchedules';
import { useFirestoreAdmins } from '../hooks/useFirestoreAdmins';
import { useAdminAuth } from './hooks/useAdminAuth';
// @ts-ignore
import { useFirestoreNotice } from '../hooks/useFirestoreNotice';
import { useFirestoreThemeConfig } from '../hooks/useFirestoreThemeConfig';
import { INITIAL_WIKI_EVENTS, WikiEvent } from '../data/wiki-events';
import { ADDITIONAL_EVENTS } from '../data/new-events';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hashPassword } from '../utils/crypto';
import { LinearGradient } from 'expo-linear-gradient';
import {
    pad as padUtil,
    formatRemainingTime as formatRemainingTimeUtil,
    toLocal as toLocalUtil,
    toUTC as toUTCUtil,
    processConversion as processConversionUtil,
    splitSchedulePart as splitSchedulePartUtil,
    getKoreanDayOfWeek as getKoreanDayOfWeekUtil,
    translateDay as translateDayUtil,
    translateLabel as translateLabelUtil,
} from './utils/eventHelpers';
import { dfs as dfsUtil } from './utils/dynamicFontSize';
import {
    DATE_RANGE_IDS,
    getEventSchedule as getEventScheduleUtil,
    getEventEndDate as getEventEndDateUtil,
    checkWeeklyExpired as checkWeeklyExpiredUtil,
    isEventExpired as isEventExpiredUtil,
    getRemainingSeconds as getRemainingSecondsUtil,
    getNextResetSeconds as getNextResetSecondsUtil,
    checkItemActive as checkItemActiveUtil,
    isVisibleInList as isVisibleInListUtil,
    calculateBearHuntDay as calculateBearHuntDayUtil,
    isEventActive as isEventActiveUtil,
    getBundleId as getBundleIdUtil,
    getSortTime as getSortTimeUtil
} from './utils/eventStatus';
import { doc, setDoc, getDoc, collection, getDocs, query, writeBatch, updateDoc, onSnapshot, orderBy, where, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import AdminManagement from '../components/AdminManagement';
import TimelineView from '../components/TimelineView';
import { GateScreen } from './screens/GateScreen';
import { ManualModal } from '../components/modals/ManualModal';
import { LoginModal } from '../components/modals/LoginModal';
import { AdminMenuModal } from '../components/modals/AdminMenuModal';
import { NoticeDetailModal } from '../components/modals/NoticeDetailModal';
import { NoticeEditModal } from '../components/modals/NoticeEditModal';
import { InstallModal } from '../components/modals/InstallModal';
import { UserPassChangeModal } from '../components/modals/UserPassChangeModal';
import { NoticePopup } from '../components/dashboard/NoticePopup';
import { DashboardHeader } from '../components/dashboard/DashboardHeader';
import { NoticeBanner } from '../components/dashboard/NoticeBanner';
import { DashboardFeatureCards } from '../components/dashboard/DashboardFeatureCards';



export default function Home() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { auth, login, logout, serverId, allianceId, setAllianceInfo, dashboardScrollY, setDashboardScrollY, mainScrollRef, isGateOpen, setIsGateOpen, showCustomAlert } = useAuth();
    const { theme, setTheme, toggleTheme, toggleTemporaryTheme, fontSizeScale, changeFontSize } = useTheme();
    const { language, changeLanguage } = useLanguage();
    const isDark = theme === 'dark';
    const [isLoading, setIsLoading] = useState(false);
    const sectionPositions = useRef<{ [key: string]: number }>({});
    const [activeEventTab, setActiveEventTab] = useState<'active' | 'upcoming' | 'expired'>('active');
    const [containerY, setContainerY] = useState(0);
    const [isExpiredExpanded, setIsExpiredExpanded] = useState(false);
    const { width: windowWidth } = useWindowDimensions();
    const isMobile = windowWidth < 600;

    const scrollToSection = (section: 'active' | 'upcoming' | 'expired') => {
        if (section === 'expired') setIsExpiredExpanded(true);
        const sectionY = sectionPositions.current[section] || 0;
        const targetY = containerY + sectionY;
        setActiveEventTab(section); // 탭 강조 상태 유지
        mainScrollRef.current?.scrollTo({ y: targetY - 250, animated: true });
    };
    const adminAuth = useAdminAuth({
        auth,
        login,
        logout,
        serverId,
        allianceId,
        setAllianceInfo,
        setIsGateOpen,
        showCustomAlert,
        t
    });

    const {
        loginInput, setLoginInput,
        passwordInput, setPasswordInput,
        loginError, setLoginError,
        gateLoginError, setGateLoginError,
        isLoginLoading, setIsLoginLoading,
        inputServer, setInputServer,
        inputAlliance, setInputAlliance,
        inputUserId, setInputUserId,
        inputPassword, setInputPassword,
        isRegisterMode, setIsRegisterMode,
        recentServers, recentAlliances, recentUserIds,
        gateUserIdRef, gatePasswordRef, loginPasswordRef,
        allRequests, setAllRequests,
        selectedReqIds, setSelectedReqIds,
        superAdminTab, setSuperAdminTab,
        isSuperAdminLoading, setIsSuperAdminLoading,
        superAdminsList, setSuperAdminsList,
        loadingSuperAdmins, setLoadingSuperAdmins,
        newAdminName, setNewAdminName,
        newAdminPassword, setNewAdminPassword,
        handleEnterAlliance,
        handleLogin,
        handleLogout,
        handleSettingsPress,
        handleResetSettings,
        saveToHistory,
        fetchRequests,
        fetchSuperAdmins,
        handleApproveRequest,
        handleRejectRequest,
        handleBulkApprove,
        handleBulkReject,
        handleResetPasswordAdmin,
        handleDeleteAlliance,
        handleDeleteSuperAdmin,
        handleAddSuperAdmin,
        toggleSelectRequest
    } = adminAuth;

    const noticeData = useFirestoreNotice(serverId, allianceId);
    const { notice, saveNotice } = noticeData;
    const { themeConfig: globalThemeConfig, saveDefaultMode: saveGlobalTheme } = useFirestoreThemeConfig(null, null);
    const { schedules, loading, clearAllSchedules } = useFirestoreEventSchedules(serverId, allianceId);

    const [adminMenuVisible, setAdminMenuVisible] = useState(false);
    const [loginModalVisible, setLoginModalVisible] = useState(false);

    // -- Trigger Admin Menu via Query Params (For Navigation/Settings Button) --
    useEffect(() => {
        if (params.showAdminMenu === 'true') {
            if (auth.isLoggedIn) {
                setAdminMenuVisible(true);
            } else {
                setLoginModalVisible(true);
            }
            // Clear the param
            router.setParams({ showAdminMenu: undefined });
        }
    }, [params.showAdminMenu, auth.isLoggedIn]);

    // -- Handle viewMode from parameters (Back navigation restoration) --
    useEffect(() => {
        if (params.viewMode === 'list' || params.viewMode === 'timeline') {
            setViewMode(params.viewMode);
            // Clear the param so it doesn't stay in the URL
            router.setParams({ viewMode: undefined });
        }
    }, [params.viewMode]);

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

    const [isSuperAdminDashboardVisible, setIsSuperAdminDashboardVisible] = useState(false);
    const [adminDashboardVisible, setAdminDashboardVisible] = useState(false);


    const [adminMenuHover, setAdminMenuHover] = useState<string | null>(null);
    const [isUserPassChangeOpen, setIsUserPassChangeOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showModalPw, setShowModalPw] = useState(false);
    const [showPass1, setShowPass1] = useState(false);
    const [showPass2, setShowPass2] = useState(false);
    const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');

    // -- Font Size Persistence --
    useEffect(() => {
        AsyncStorage.getItem('settings_fontSize').then(val => {
            if (val && ['small', 'medium', 'large'].includes(val)) {
                setFontSize(val as any);
                // Trigger global change on load
                const scale = val === 'small' ? 0.95 : val === 'large' ? 1.25 : 1.1;
                changeFontSize(scale);
            }
        });
    }, []);

    useEffect(() => {
        AsyncStorage.setItem('settings_fontSize', fontSize);
        // Sync with global context
        const scale = fontSize === 'small' ? 0.95 : fontSize === 'large' ? 1.25 : 1.1;
        changeFontSize(scale);
    }, [fontSize]);

    // -- Dynamic Font Size Helper --
    const dfs = (baseClass: string) => dfsUtil(baseClass, fontSize);


    const [noticeDetailVisible, setNoticeDetailVisible] = useState(false);
    const [noticePopupVisible, setNoticePopupVisible] = useState(false);
    const [noticePopupDontShow, setNoticePopupDontShow] = useState(false);
    const [timezone, setTimezone] = useState<'LOCAL' | 'UTC'>('LOCAL');
    const [viewMode, setViewMode] = useState<'list' | 'timeline'>('timeline');
    const [isManualVisible, setIsManualVisible] = useState(false);

    // -- Global Back Button & History Handling for Modals (Web Fix) --
    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const handlePopState = () => {
            setIsManualVisible(false);
            setAdminMenuVisible(false);
            setNoticeDetailVisible(false);
            setAdminDashboardVisible(false);
            setIsSuperAdminDashboardVisible(false);
            setIsUserPassChangeOpen(false);
            setNoticePopupVisible(false);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isManualVisible, adminMenuVisible, noticeDetailVisible, adminDashboardVisible,
        isSuperAdminDashboardVisible, isUserPassChangeOpen, noticePopupVisible]);

    const openModalWithHistory = (setter: (v: boolean) => void) => {
        setter(true);
        if (Platform.OS === 'web') {
            window.history.pushState({ modal: true }, '');
        }
    };





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

                // Show the popup - ONLY for logged in users
                if (auth.isLoggedIn) {
                    setTimeout(() => setNoticePopupVisible(true), 500);
                }
            } catch (e) {
                console.error('Notice popup check error:', e);
            }
        };

        checkNoticePopup();
    }, [notice, serverId, allianceId, auth.isLoggedIn]);

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
        };
    };


    // Dynamic Admins Support
    const { dynamicAdmins, addAdmin, removeAdmin } = useFirestoreAdmins(serverId, allianceId);
    const [newAdminRole, setNewAdminRole] = useState<'admin' | 'alliance_admin'>('admin');
    const [showAdminList, setShowAdminList] = useState(false);
    const isSuperAdmin = auth.isLoggedIn && (
        auth.role === 'master' ||
        auth.role === 'super_admin'
    );

    const [hoveredHeaderBtn, setHoveredHeaderBtn] = useState<string | null>(null);


    const handleMigrateToAlliance = async () => {
        if (!serverId || !allianceId) {
            showCustomAlert(t('common.error'), t('admin.selectServerAlliance'), 'error');
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

            showCustomAlert(t('common.success'), t('admin.migrationSuccess'), 'success');
        } catch (error: any) {
            console.error('Migration error:', error);
            showCustomAlert(t('common.error'), t('admin.migrationError') + ': ' + error.message, 'error');
        }
    };

    // -- Super Admin Dashboard Logic --
    useEffect(() => {
        if (isSuperAdmin && isSuperAdminDashboardVisible) {
            const unsubscribe = fetchRequests();
            return () => unsubscribe();
        }
    }, [isSuperAdmin, isSuperAdminDashboardVisible]);

    useEffect(() => {
        if (showAdminList) {
            fetchSuperAdmins();
        }
    }, [showAdminList]);





    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const getEventSchedule = (event: any) => getEventScheduleUtil(event, schedules);
    const getEventEndDate = (event: any) => getEventEndDateUtil(event, schedules, now);
    const checkWeeklyExpired = (str: string) => checkWeeklyExpiredUtil(str, now);
    const isEventExpired = (event: any) => isEventExpiredUtil(event, schedules, now);
    const getRemainingSeconds = (str: string) => getRemainingSecondsUtil(str, now);
    const getNextResetSeconds = () => getNextResetSecondsUtil(now);
    const checkItemActive = (str: string) => checkItemActiveUtil(str, now);
    const isVisibleInList = (event: any) => isVisibleInListUtil(event, schedules, now);

    const calculateBearHuntDay = useCallback((event: any, targetTime?: string): string =>
        calculateBearHuntDayUtil(event, schedules, now, targetTime), [now, schedules]);

    const isEventActive = (event: any) => isEventActiveUtil(
        event,
        schedules,
        now,
        toLocal,
        checkItemActive,
        (e, s, n) => calculateBearHuntDayUtil(e, s, n)
    );

    const pad = (n: number) => padUtil(n);
    const formatRemainingTime = (seconds: number) => formatRemainingTimeUtil(seconds);
    const getKoreanDayOfWeek = (date: Date) => getKoreanDayOfWeekUtil(date, t);
    const translateDay = (day: string) => translateDayUtil(day, t);
    const translateLabel = (label: string) => translateLabelUtil(label, t);
    const getBundleId = (ev: any) => getBundleIdUtil(ev);
    const getSortTime = (ev: any) => getSortTimeUtil(ev, now);

    // --- Timezone Conversion Helpers ---
    const toLocal = (kstStr: string) => toLocalUtil(kstStr, (str, diff) => processConversion(str, diff));
    const toUTC = (kstStr: string) => toUTCUtil(kstStr, (str, diff) => processConversion(str, diff));

    const convertTime = (kstStr: string) => {
        if (!kstStr) return kstStr;
        return timezone === 'LOCAL' ? toLocal(kstStr) : toUTC(kstStr);
    };

    const processConversion = (str: string, diffMinutes: number) => processConversionUtil(str, diffMinutes, t, now);
    // ------------------------------------

    const splitSchedulePart = (str: string) => splitSchedulePartUtil(str, t, now);



    const [noticeModalVisible, setNoticeModalVisible] = useState(false);
    const [editNoticeContent, setEditNoticeContent] = useState('');
    const [editNoticeVisible, setEditNoticeVisible] = useState(true);
    const [superAdminDashboardVisible, setSuperAdminDashboardVisible] = useState(false);
    const [installModalVisible, setInstallModalVisible] = useState(false);

    // Section collapse states
    const [isActiveExpanded, setIsActiveExpanded] = useState(true);
    const [isUpcomingExpanded, setIsUpcomingExpanded] = useState(true);



    // Enable LayoutAnimation for Android
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }


    // Load active tab state
    useEffect(() => {
        AsyncStorage.getItem('activeEventTab').then(saved => {
            if (saved && (saved === 'active' || saved === 'upcoming' || saved === 'expired')) {
                setActiveEventTab(saved as 'active' | 'upcoming' | 'expired');
            }
        });
    }, []);






    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);




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
        showCustomAlert(t('admin.saveNoticeSuccessTitle'), t('admin.saveNoticeSuccessDesc'), 'success');
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
            return {
                ...s,
                day: cleanDay,
                time: cleanTime,
                title: eventInfo ? eventInfo.title : '알 수 없는 이벤트',
                imageUrl: eventInfo?.imageUrl,
                category: eventInfo?.category
            };
        }).filter(e => {
            if (e.title === '알 수 없는 이벤트') return false;
            if (!(!!e.day || !!e.time)) return false;

            return isVisibleInList(e); // Use the new visibility logic
        });

        // 2. Split Bear Hunt into separate cards for Team 1 and Team 2
        const processedList: any[] = [];
        rawList.forEach(e => {
            if (e.eventId === 'a_bear' || e.eventId === 'alliance_bear') {
                // 곰사냥 2일 단위 로테이션으로 실제 요일 계산
                const parts = (e.time || '').split(/\s*\/\s*/);
                if (parts.length > 0) {
                    parts.forEach((part, idx) => {
                        const trimmed = part.trim();
                        if (!trimmed) return;

                        const colonIdx = trimmed.indexOf(':');
                        const isSingleTeam = parts.length === 1;
                        const rawLabel = colonIdx > -1 ? trimmed.substring(0, colonIdx).trim() : (isSingleTeam ? '' : `${idx + 1}군`);
                        // Simplify Team Label (e.g., 곰 1 팀 -> 1군)
                        const cleanLabel = rawLabel ? (rawLabel.replace(/곰|팀|군/g, '').trim() + '군') : '';
                        const teamTime = colonIdx > -1 ? trimmed.substring(colonIdx + 1).trim() : trimmed;

                        // Extract day from teamTime (e.g., "월(12:30)" -> "월")
                        const dayMatch = teamTime.match(/^([일월화수목금토])/);
                        const registeredTeamDay = dayMatch ? dayMatch[1] : (e.day || '월');

                        // 곰사냥 로테이션을 반영한 실제 요일 계산 (각 팀별 등록 요일과 팀별 시간을 기준)
                        const actualTeamDay = calculateBearHuntDay({ ...e, day: registeredTeamDay }, teamTime);

                        let simplifiedTime = teamTime.split(/[,|]/).map(t => {
                            return t.replace(/출격|귀환|시작|종료/g, '').trim();
                        }).join(', ');

                        // 만약 시간이 "월 01:30" 처럼 요일을 포함하고 있다면, 실제 요일로 교체
                        if (dayMatch && dayMatch[0] !== actualTeamDay) {
                            simplifiedTime = simplifiedTime.replace(dayMatch[0], actualTeamDay);
                        }

                        processedList.push({
                            ...e,
                            eventId: `${e.eventId}_team${idx + 1} `,
                            originalEventId: e.eventId,
                            title: t('events.alliance_bear_title'),
                            day: actualTeamDay, // 각 팀별 실제 요일
                            time: simplifiedTime,
                            isBearSplit: true,
                            teamLabel: cleanLabel,
                            teamIcon: '🐻'
                        });
                    });
                } else {
                    const actualDay = calculateBearHuntDay(e);
                    const dayMatch = (e.time || '').match(/^([일월화수목금토])/);
                    let updatedTime = e.time || '';
                    if (dayMatch && dayMatch[0] !== actualDay) {
                        updatedTime = updatedTime.replace(dayMatch[0], actualDay);
                    }
                    processedList.push({ ...e, day: actualDay, time: updatedTime });
                }
            } else if (e.eventId === 'a_foundry' || e.eventId === 'alliance_foundry') {
                // Split Foundry into separate cards for Team 1 and Team 2
                const parts = (e.time || '').split(/\s*\/\s*/);
                if (parts.length > 0) {
                    parts.forEach((part, idx) => {
                        const trimmed = part.trim();
                        if (!trimmed) return;

                        const colonIdx = trimmed.indexOf(':');
                        const isSingleTeam = parts.length === 1;
                        const rawLabel = colonIdx > -1 ? trimmed.substring(0, colonIdx).trim() : (isSingleTeam ? '' : `${idx + 1}군`);
                        const cleanLabel = rawLabel ? (rawLabel.replace(/팀|군/g, '').trim() + '군') : '';
                        const teamTime = colonIdx > -1 ? trimmed.substring(colonIdx + 1).trim() : trimmed;

                        const simplifiedTime = teamTime.split(/[,|]/).map(t => {
                            return t.replace(/출격|귀환|시작|종료/g, '').trim();
                        }).join(', ');

                        processedList.push({
                            ...e,
                            eventId: `${e.eventId}_team${idx + 1}`,
                            originalEventId: e.eventId,
                            title: t('events.alliance_foundry_title'),
                            time: simplifiedTime,
                            isFoundrySplit: true,
                            teamLabel: cleanLabel,
                            teamIcon: '🏭'
                        });
                    });
                } else {
                    processedList.push(e);
                }
            } else if (e.eventId === 'a_fortress' || e.eventId === 'alliance_fortress') {
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

                // Add Fortress Event if data exists
                if (fortressParts.length > 0) {
                    processedList.push({
                        ...e,
                        eventId: `${e.eventId}_fortress`,
                        originalEventId: e.eventId,
                        title: t('events.fortress_battle_title'),
                        day: t('events.fortress'),
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
                        title: t('events.citadel_battle_title'),
                        day: t('events.citadel'),
                        time: citadelParts.join(', '),
                        isFortressSplit: true
                    });
                }

                // If neither exists (empty time), push original as fallback (optional, but good for safety)
                if (fortressParts.length === 0 && citadelParts.length === 0) {
                    processedList.push(e);
                }
            } else if (e.eventId === 'alliance_canyon') {
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
                            eventId: `${e.eventId}_team${idx + 1}`,
                            originalEventId: e.eventId,
                            title: t('events.canyon_title'),
                            time: simplifiedTime,
                            isCanyonSplit: true,
                            teamLabel: cleanLabel,
                            teamIcon: '⛰️'
                        });
                    });
                } else {
                    processedList.push(e);
                }
            } else if (e.eventId === 'a_foundry' || e.eventId === 'alliance_foundry') {
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
                            eventId: `${e.eventId}_team${idx + 1}`,
                            originalEventId: e.eventId,
                            title: cleanLabel ? `${t('events.foundry_title')}(${cleanLabel})` : t('events.foundry_title'),
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



        // Pre-calculate group-level data: minTime, hasActive, allExpired, count
        const groupData: { [key: string]: { minTime: number, hasActive: boolean, allExpired: boolean, count: number } } = {};
        processedList.forEach(e => {
            const groupId = getBundleId(e);
            const sTime = getSortTime(e);
            const active = isEventActive(e);
            const expired = isEventExpired(e);

            if (!groupData[groupId]) {
                groupData[groupId] = { minTime: sTime, hasActive: active, allExpired: expired, count: 1 };
            } else {
                if (sTime < groupData[groupId].minTime) groupData[groupId].minTime = sTime;
                if (active) groupData[groupId].hasActive = true;
                groupData[groupId].allExpired = groupData[groupId].allExpired && expired;
                groupData[groupId].count += 1;
            }
        });

        return processedList.sort((a, b) => {
            const groupIdA = getBundleId(a);
            const groupIdB = getBundleId(b);
            const gDataA = groupData[groupIdA];
            const gDataB = groupData[groupIdB];

            // Priority 1: Group Active Status (If any member is active, move whole group up)
            if (gDataA.hasActive && !gDataB.hasActive) return -1;
            if (!gDataA.hasActive && gDataB.hasActive) return 1;

            // Priority 2: Group Expired Status (Only move to bottom if ALL members are expired)
            if (!gDataA.allExpired && gDataB.allExpired) return -1;
            if (gDataA.allExpired && !gDataB.allExpired) return 1;

            // Priority 3: Bundle Priority (Keep bundles together at the top of each section to ensure side-by-side layout)
            const isBundleA = gDataA.count > 1;
            const isBundleB = gDataB.count > 1;
            if (isBundleA && !isBundleB) return -1;
            if (!isBundleA && isBundleB) return 1;

            // Priority 4: Group Sort Time (Keep groups together by earliest member's time)
            if (gDataA.minTime !== gDataB.minTime) return gDataA.minTime - gDataB.minTime;

            // Priority 5: Strict Group ID grouping (for groups with same time)
            if (groupIdA !== groupIdB) return groupIdA.localeCompare(groupIdB);

            // Priority 6: Internal Order
            // Team Order (1군 < 2군)
            const teamA = a.teamLabel ? (parseInt(a.teamLabel) || (a.teamLabel.includes('1') ? 1 : 2)) : 0;
            const teamB = b.teamLabel ? (parseInt(b.teamLabel) || (b.teamLabel.includes('1') ? 1 : 2)) : 0;
            if (teamA !== teamB) return teamA - teamB;

            // Fortress/Citadel Priority (Fortress < Citadel)
            const aIsFortress = a.title.includes('요새') || a.title.toLowerCase().includes('fortress');
            const aIsCitadel = a.title.includes('성채') || a.title.toLowerCase().includes('citadel');
            const bIsFortress = b.title.includes('요새') || b.title.toLowerCase().includes('fortress');
            const bIsCitadel = b.title.includes('성채') || b.title.toLowerCase().includes('citadel');
            if (aIsFortress && bIsCitadel) return -1;
            if (aIsCitadel && bIsFortress) return 1;

            // Priority 7: Title Alphabetical
            return (a.title || '').localeCompare(b.title || '');
        });
    }, [schedules, now, calculateBearHuntDay, t]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const handler = (e: any) => { e.preventDefault(); setDeferredPrompt(e); };
            window.addEventListener('beforeinstallprompt', handler);
            return () => window.removeEventListener('beforeinstallprompt', handler);
        }
    }, []);

    // Badge API Support (PWA) - Show ongoing events count on app icon
    useEffect(() => {
        if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
            try {
                const ongoingCount = displayEvents.filter(e => isEventActive(e)).length;
                if (ongoingCount > 0) {
                    (navigator as any).setAppBadge(ongoingCount).catch(() => { });
                } else {
                    (navigator as any).clearAppBadge().catch(() => { });
                }
            } catch (err) {
                console.error('Badge API Error:', err);
            }
        }
    }, [displayEvents]);

    const handleInstallClick = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((res: any) => res.outcome === 'accepted' && setDeferredPrompt(null));
        } else {
            setInstallModalVisible(true);
        }
    };




    const renderWithHighlightedDays = (str: string, isUpcomingSoon: boolean) => {
        const parts = str.split(/([일월화수목금토]|\((?:일|월|화|수|목|금|토)\))/g);
        return parts.map((part, i) => {
            const isDay = /([일월화수목금토]|\((?:일|월|화|수|목|금|토)\))/.test(part);
            if (isDay) {
                const hasParens = part.includes('(');
                const dayChar = part.replace(/[\(\)]/g, '');
                const translatedDay = translateDay(dayChar);
                return (
                    <Text key={i} style={{
                        fontWeight: '900',
                        color: isUpcomingSoon ? (isDark ? '#4ade80' : '#16a34a') : (isDark ? '#60a5fa' : '#2563eb')
                    }}>
                        {hasParens ? `(${translatedDay})` : translatedDay}
                    </Text>
                );
            }
            return <Text key={i} style={{ color: isDark ? '#f8fafc' : '#1e293b' }}>{part}</Text>;
        });
    };

    const formatEventTimeCompact = (timeStr: string, isUpcomingSoon: boolean) => {
        if (!timeStr) return null;

        // 1. Date Range Case: "2026.02.13 09:00 ~ 2026.02.15 09:00"
        // Supports flexible separators and markers like '월' directly after date.
        const rangeMatch = timeStr.match(/(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(\d{2}:\d{2})?\s*~\s*(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(\d{2}:\d{2})?/);
        if (rangeMatch) {
            const currentYear = now.getFullYear();
            const y1 = rangeMatch[1] || currentYear.toString();
            const m1 = rangeMatch[2];
            const d1 = rangeMatch[3];
            const t1 = rangeMatch[4];
            const y2 = rangeMatch[5] || currentYear.toString();
            const m2 = rangeMatch[6];
            const d2 = rangeMatch[7];
            const t2 = rangeMatch[8];
            const start = new Date(parseInt(y1), parseInt(m1) - 1, parseInt(d1));
            const end = new Date(parseInt(y2), parseInt(m2) - 1, parseInt(d2));
            const startDay = getKoreanDayOfWeek(start);
            const endDay = getKoreanDayOfWeek(end);
            const startPart = `${m1}/${d1} (${startDay}) ${t1 || '00:00'}`;
            const endPart = `${m2}/${d2} (${endDay}) ${t2 || '23:59'}`;

            // Clean 1군/2군 if present in date range matching (though rare)
            const cleanStart = startPart.replace(/1군/g, t('events.team1')).replace(/2군/g, t('events.team2'));
            const cleanEnd = endPart.replace(/1군/g, t('events.team1')).replace(/2군/g, t('events.team2'));

            return (
                <Text
                    adjustsFontSizeToFit
                    numberOfLines={2}
                    minimumFontScale={0.7}
                    style={{ color: isDark ? '#f8fafc' : '#1e293b', fontSize: 18 * fontSizeScale, fontWeight: '800', letterSpacing: -0.5 }}
                >
                    {renderWithHighlightedDays(cleanStart, isUpcomingSoon)}{"\u00A0"}~ {renderWithHighlightedDays(cleanEnd, isUpcomingSoon)}
                </Text>
            );
        }

        // 2. Grouped Day Case: "요새7 금(23:00), 요새10 금(23:00)" or "요새전: 요새7 금 23:00"
        // Also handles "월(22:00)" without space
        const dayTimeMatches = Array.from(timeStr.matchAll(/(?:^|[,，/]+)\s*(.*?)\s*([일월화수목금토])[\s\(]*(\d{2}:\d{2})[\s\)]*/g));
        if (dayTimeMatches.length > 0) {
            // 월요일~일요일이 한 주 (월요일 00:00 리셋)
            const dayMapObj: { [key: string]: number } = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
            const currentDay = (now.getDay() + 6) % 7; // 월(0), 화(1), 수(2), 목(3), 금(4), 토(5), 일(6)
            const currentTotalMinToday = now.getHours() * 60 + now.getMinutes();

            const groups: { [key: string]: { label: string, time: string, days: string[], isExpired: boolean } } = {};
            dayTimeMatches.forEach(m => {
                const rawLabel = (m[1] || "").trim();
                const day = m[2];
                const time = m[3];
                const [h, min] = time.split(':').map(Number);
                const dayIdx = dayMapObj[day];

                // Filter out expired individual slots (30 min duration)
                const startTotal = dayMapObj[day] * 1440 + h * 60 + min;
                const endTotal = startTotal + 30; // 30 mins duration
                let isItemExpired = false;

                // Calculate expiration considering week wrap-around (Monday start)
                const currentDayIndex = (now.getDay() + 6) % 7; // Mon=0, Tue=1 ... Sun=6
                const targetDayIndex = dayMapObj[day];

                if (currentDayIndex > targetDayIndex) {
                    isItemExpired = true;
                } else if (currentDayIndex === targetDayIndex) {
                    const currentMinutes = now.getHours() * 60 + now.getMinutes();
                    const targetMinutes = h * 60 + min;
                    if (currentMinutes >= targetMinutes + 30) isItemExpired = true;
                }

                // Refine label
                let label = rawLabel.replace(/.*(요새전|성채전)[:\s：]*/g, '').replace(/^[:，,：\-\s\(\[\{\/]+/, '').replace(/[:，,：\-\s\)\]\}\/]+$/, '').trim();

                const isDayOnly = label && /^[일월화수목금토\s,·\/\(\)\[\]\:\：]+$/.test(label);
                if (isDayOnly) label = '';

                const key = `${label}|${time}|${day}|${isItemExpired}`; // Include expired status in key to separate if needed? No, better group by label+time.
                // Actually, if we group by label+time, we might mix expired and non-expired if they have same label/time but different days?
                // Wait, days are aggregated: "요새7 금,토 23:30". If Friday expired but Saturday not?
                // The UI shows "금,토 23:30". Strikethrough effectively strikes the whole line.
                // User request: "맨위 금 23:30 요새7은 진행중이 아닌 지난거라 취소선 넣어줘."
                // This implies individual lines per day/time/label tuple if they differ?
                // Current styling aggregates days: `part.days.join('·')`.
                // If "금" is expired and "토" is not, how to render "금·토 23:30"?
                // We should arguably separate them if their expired status differs.

                const groupKey = `${label}|${time}|${isItemExpired}`; // Group by expired status too
                if (!groups[groupKey]) groups[groupKey] = { label, time, days: [], isExpired: isItemExpired };
                if (!groups[groupKey].days.includes(day)) groups[groupKey].days.push(day);
            });

            // Sort: Expired items last
            // Sort: Not Expired first, then by Day Index, then by Time
            const dayMap: { [key: string]: number } = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6, '매일': -1, '상시': -2 };
            const resultParts = Object.values(groups).sort((a, b) => {
                if (a.isExpired !== b.isExpired) return a.isExpired ? 1 : -1;
                const aDayIdx = dayMap[a.days[0]] ?? 9;
                const bDayIdx = dayMap[b.days[0]] ?? 9;
                if (aDayIdx !== bDayIdx) return aDayIdx - bDayIdx;
                return a.time.localeCompare(b.time);
            });

            if (resultParts.length === 0) return null;

            // Filter out expired items if there are any non-expired (upcoming) items.
            // This ensures the dashboard always prioritizes the "Next" schedule as requested by the user.
            const upcomingParts = resultParts.filter(p => !p.isExpired);
            const finalParts = upcomingParts.length > 0 ? upcomingParts : resultParts;
            const isAllExpired = upcomingParts.length === 0;

            return (
                <View className="flex-col gap-1.5 mt-2">
                    {finalParts.map((part, i) => (
                        <View key={i} className={`flex-row items-center mb-1 ${(part.isExpired && !isAllExpired) ? 'opacity-40' : ''}`}>
                            <Ionicons
                                name="time-outline"
                                size={14}
                                color={isDark ? '#cbd5e1' : '#475569'}
                                style={{ marginRight: 6 }}
                            />
                            <Text style={{
                                color: isDark ? '#f8fafc' : '#1e293b',
                                fontSize: 18 * fontSizeScale,
                                fontWeight: '800',
                                textDecorationLine: 'none',
                                letterSpacing: -0.5
                            }}>
                                {renderWithHighlightedDays(part.days.join('·'), isUpcomingSoon)} {part.time}
                            </Text>

                            {part.label ? (
                                <View className={`ml-2 px-2 py-0.5 rounded-lg ${isDark ? 'bg-slate-800/80 border border-slate-700' : 'bg-slate-200/80 border border-slate-300'}`}>
                                    <Text style={{
                                        fontSize: 13 * fontSizeScale,
                                        fontWeight: '800',
                                        color: isDark ? '#cbd5e1' : '#475569',
                                        textDecorationLine: 'none'
                                    }}>
                                        {translateLabel(part.label).replace(/\s+/g, ' ')}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    ))}
                </View>);
        }

        // 3. Single Date Match: "2026.02.13 09:00"
        const singleDateMatch = timeStr.match(/(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(?:오후|오전)?\s*(\d{1,2}):(\d{2})/);
        if (singleDateMatch) {
            const currentYear = now.getFullYear();
            const y = singleDateMatch[1] || currentYear.toString();
            const m = singleDateMatch[2];
            const d = singleDateMatch[3];
            const t = singleDateMatch[4];
            const min = singleDateMatch[5];
            const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            const day = getKoreanDayOfWeek(dateObj);
            const formatted = `${m}/${d}(${day}) ${pad(parseInt(t))}:${pad(parseInt(min))}`;
            return (
                <Text style={{ color: isDark ? '#f8fafc' : '#1e293b', fontSize: 18 * fontSizeScale, fontWeight: '800', letterSpacing: -0.5 }}>
                    {renderWithHighlightedDays(formatted, isUpcomingSoon)}
                </Text>
            );
        }

        // 4. Simple String (Mixed or unformatted) -> Try to parse "Day(Time)" first to unify UI
        // e.g. "월(11:00)" or "월 11:00"
        const singleDayTimeMatch = timeStr.match(/^([일월화수목금토])[\s\(]*(\d{2}:\d{2})[\s\)]*$/);
        if (singleDayTimeMatch) {
            const day = singleDayTimeMatch[1];
            const time = singleDayTimeMatch[2];

            return (
                <View className="flex-row items-center mt-1">
                    <Ionicons
                        name="calendar-outline"
                        size={14}
                        color={isDark ? '#38bdf8' : '#2563eb'}
                        style={{ marginRight: 4 }}
                    />
                    <Text style={{
                        color: isDark ? '#38bdf8' : '#2563eb',
                        fontSize: 17 * fontSizeScale,
                        fontWeight: '900'
                    }}>
                        {renderWithHighlightedDays(day, isUpcomingSoon)}
                    </Text>

                    <Text style={{ color: isDark ? '#475569' : '#94a3b8', marginHorizontal: 8, fontSize: 16 }}>·</Text>

                    <Ionicons
                        name="time-outline"
                        size={14}
                        color={isDark ? '#cbd5e1' : '#475569'}
                        style={{ marginRight: 4 }}
                    />
                    <Text style={{
                        color: isDark ? '#cbd5e1' : '#475569',
                        fontSize: 17 * fontSizeScale,
                        fontWeight: '900'
                    }}>
                        {time}
                    </Text>
                </View>
            );
        }

        return (
            <Text
                adjustsFontSizeToFit
                numberOfLines={2}
                minimumFontScale={0.7}
                style={{ color: isDark ? '#f8fafc' : '#1e293b', fontSize: 18 * fontSizeScale, fontWeight: '800', letterSpacing: -0.5 }}
            >
                {renderWithHighlightedDays(timeStr, isUpcomingSoon)}
            </Text>
        );
    };

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

        const getSoonRemainingSeconds = (str: string) => {
            if (!str) return null;
            // 월요일~일요일이 한 주 (월요일 00:00 리셋)
            const dayMapObj: { [key: string]: number } = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
            const currentDay = (now.getDay() + 6) % 7; // 월(0), 화(1), 수(2), 목(3), 금(4), 토(5), 일(6)
            const currentTotalSec = currentDay * 86400 + now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
            const totalWeekSec = 7 * 86400;

            const dateRangeMatch = str.match(/(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d\s~\.\/-]*\s*(\d{2}):(\d{2})/);
            if (dateRangeMatch) {
                const [_, y, m, d, h, min] = dateRangeMatch;
                const currentYear = now.getFullYear();
                const start = new Date(parseInt(y || currentYear.toString()), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min));
                if (!isNaN(start.getTime())) {
                    const diff = (start.getTime() - now.getTime()) / 1000;
                    if (diff > 0 && diff <= 1800) return Math.floor(diff);
                }
            }

            const explicitMatches = Array.from(str.matchAll(/([일월화수목금토]|[매일])\s*\(?(\d{1,2}):(\d{2})\)?/g));
            if (explicitMatches.length > 0) {
                let minDiff: number | null = null;
                explicitMatches.forEach(m => {
                    const dayStr = m[1];
                    const h = parseInt(m[2]);
                    const min = parseInt(m[3]);
                    const scheduledDays = (dayStr === '매일') ? ['일', '월', '화', '수', '목', '금', '토'] : [dayStr];
                    scheduledDays.forEach(d => {
                        const dayOffset = dayMapObj[d];
                        if (dayOffset === undefined) return;
                        let startTotalSec = dayOffset * 86400 + h * 3600 + min * 60;
                        let diff = startTotalSec - currentTotalSec;
                        if (diff < 0) diff += totalWeekSec;
                        if (diff > 0 && diff <= 1800) {
                            if (minDiff === null || diff < minDiff) minDiff = diff;
                        }
                    });
                });
                return minDiff;
            }
            return null;
        };

        const windowWidth = Dimensions.get('window').width;

        return (
            <Pressable
                key={key}
                onPress={() => {
                    if (!auth.isLoggedIn) {
                        showCustomAlert(t('auth.memberOnly'), t('auth.memberOnlyDesc'), 'error');
                        return;
                    }
                    router.push({ pathname: '/growth/events', params: { focusId: event.originalEventId || event.eventId, viewMode: viewMode } });
                }}
                style={({ pressed, hovered }: any) => [
                    {
                        width: '100%',
                        transform: [{ scale: pressed && auth.isLoggedIn ? 0.98 : (hovered && auth.isLoggedIn ? 1.02 : 1) }],
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        // @ts-ignore - Web property
                        cursor: 'pointer',
                        zIndex: hovered && auth.isLoggedIn ? 10 : 1
                    }
                ]}
            >
                {({ hovered }: any) => {
                    const isLocked = !auth.isLoggedIn;
                    const currentSchedule = getEventSchedule(event);

                    // split된 이벤트는 현재 시간 기준 가장 가까운 다음 일정을 displayDay로 사용
                    let displayDay = (event.isBearSplit && event.day) ? event.day : (currentSchedule?.day || event.day);
                    let displayTime = (event.isBearSplit || event.isFoundrySplit || event.isFortressSplit || event.isCanyonSplit) ? event.time : (currentSchedule?.time || event.time);

                    // 다중 일정이 포함된 경우 다음 실행 요일 자동 계산
                    if (event.isBearSplit || event.isFoundrySplit || event.isCanyonSplit) {
                        const dayMap: { [key: string]: number } = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
                        const currentDay = (now.getDay() + 6) % 7;
                        const currentMins = now.getHours() * 60 + now.getMinutes();
                        const matches = Array.from(displayTime.matchAll(/([일월화수목금토매일상시])\s*\(?(\d{1,2}:\d{2})\)?/g));

                        if (matches.length > 0) {
                            const nextSlot = matches.find(m => {
                                const dRaw = m[1];
                                const [h, min] = m[2].split(':').map(Number);
                                if (dRaw === '매일' || dRaw === '상시') return true;
                                const dIdx = dayMap[dRaw];
                                if (dIdx > currentDay) return true;
                                if (dIdx === currentDay) return currentMins < (h * 60 + min + 30);
                                return false;
                            });
                            if (nextSlot) {
                                displayDay = nextSlot[1];
                                // If the time string contains multiple slots, let's only use the upcoming ones
                                // to ensure the dashboard doesn't show finished slots.
                                const upcomingMatches = matches.filter(m => {
                                    const dRaw = m[1];
                                    const [h, min] = m[2].split(':').map(Number);
                                    if (dRaw === '매일' || dRaw === '상시') return true;
                                    const dIdx = dayMap[dRaw];
                                    if (dIdx > currentDay) return true;
                                    if (dIdx === currentDay) return currentMins < (h * 60 + min + 30);
                                    return false;
                                });
                                if (upcomingMatches.length > 0) {
                                    displayTime = upcomingMatches.map(m => m[0]).join(', ');
                                }
                            }
                        }
                    }


                    const getFormattedDateRange = () => {
                        const dayMapObj: { [key: string]: number } = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
                        const currentDay = (now.getDay() + 6) % 7;

                        // Extract day and time
                        let targetDayStr = displayDay;
                        let targetTimeStr = displayTime;

                        // Fallback to weekly logic
                        let dIdx = dayMapObj[targetDayStr];
                        if (dIdx !== undefined) {
                            const [h, m] = (targetTimeStr.match(/(\d{1,2}):(\d{2})/) || []).slice(1).map(Number);
                            if (!isNaN(h)) {
                                // Calculate target date
                                let diffDays = dIdx - currentDay;

                                const targetDate = new Date(now);
                                targetDate.setDate(now.getDate() + diffDays);
                                targetDate.setHours(h, m, 0, 0);

                                const endDate = new Date(targetDate);
                                endDate.setMinutes(endDate.getMinutes() + 30); // Default 30 min duration

                                // Helper to format KST string
                                const kstFormat = (d: Date) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                                const kstStr = `${kstFormat(targetDate)} ~ ${kstFormat(endDate)}`;

                                return convertTime(kstStr).replace(/20(\d{2})[\.\/-]/g, '$1.');
                            }
                        }

                        // Use common conversion helper for date strings
                        let finalStr = convertTime(`${displayDay} ${displayTime}`);
                        return finalStr.replace(/20(\d{2})[\.\/-]/g, '$1.');
                    };

                    const formattedDateRange = getFormattedDateRange();


                    const remSoonSeconds = !isActive && !isExpired ? (getSoonRemainingSeconds(displayDay) ?? getSoonRemainingSeconds(displayTime)) : null;
                    const isUpcomingSoon = remSoonSeconds !== null;

                    return isActive ? (
                        <View className={`w-full rounded-[24px] overflow-hidden shadow-toss transition-all`} style={{
                            backgroundColor: '#191F28', // Always dark/premium background for active card
                            elevation: 5,
                            opacity: isLocked ? 0.7 : 1,
                        }}>
                            {/* Lock Overlay for non-logged-in users */}
                            {isLocked && (
                                <View className="absolute top-3 right-3 z-20 flex-row items-center bg-black/60 px-2.5 py-1 rounded-full">
                                    <Ionicons name="lock-closed" size={10} color="#94a3b8" style={{ marginRight: 4 }} />
                                    <Text style={{ fontSize: 9 * fontSizeScale, color: '#94a3b8', fontWeight: '700' }}>{t('common.member_only_title')}</Text>
                                </View>
                            )}
                            <ImageBackground
                                source={require('../assets/images/selection_gate_bg.png')}
                                style={{ width: '100%' }}
                                imageStyle={{ opacity: 0.6 }} // Higher opacity for background image
                            >
                                {/* Dark Overlay for Contrast */}
                                <View className="absolute inset-0 bg-black/50" />

                                <View className={`p-5`}>
                                    <View className="flex-col mb-1">
                                        <View className="w-full mb-4">
                                            <View className="flex-row items-center mb-2">
                                                <View className={`px-2 py-1 rounded-[6px] bg-blue-500`}>
                                                    <Text className={`text-[11px] font-bold uppercase tracking-wider text-white`}>
                                                        Ongoing
                                                    </Text>
                                                </View>
                                                <View className="ml-2 w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                            </View>

                                            <Text
                                                className={`font-black tracking-tight text-white`}
                                                style={{ fontSize: 22 * fontSizeScale, lineHeight: 26 * fontSizeScale }}
                                                numberOfLines={2}
                                            >
                                                {(() => {
                                                    const eventId = event.eventId || '';
                                                    const originalId = event.originalEventId || '';

                                                    if (eventId.includes('citadel')) return t('events.citadel_battle_title');
                                                    if (eventId.includes('fortress')) return t('events.fortress_battle_title');

                                                    const cleanId = (originalId || eventId).replace(/_fortress|_citadel|_team\d+/g, '');
                                                    const baseTitle = t(`events.${cleanId}_title`, { defaultValue: event.title });

                                                    if ((event.isBearSplit || event.isFoundrySplit || event.isCanyonSplit) && event.teamLabel) {
                                                        const translatedTeam = event.teamLabel.replace('1군', t('events.team1')).replace('2군', t('events.team2'));
                                                        return `${baseTitle} (${translatedTeam})`;
                                                    }
                                                    return baseTitle;
                                                })()}
                                            </Text>
                                        </View>

                                        <View className="w-full items-end mb-2">
                                            {(() => {
                                                let remSeconds = getRemainingSeconds(toLocal(displayDay)) || getRemainingSeconds(toLocal(displayTime));
                                                if (remSeconds === null) {
                                                    const endDate = getEventEndDate({ ...event, day: toLocal(displayDay), time: toLocal(displayTime) });
                                                    if (endDate && now < endDate) {
                                                        remSeconds = Math.floor((endDate.getTime() - now.getTime()) / 1000);
                                                    }
                                                }

                                                if (remSeconds !== null) {
                                                    const d = Math.floor(remSeconds / (24 * 3600));
                                                    const h = Math.floor((remSeconds % (24 * 3600)) / 3600);
                                                    const m = Math.floor((remSeconds % 3600) / 60);
                                                    const s = remSeconds % 60;
                                                    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

                                                    return (
                                                        <View className={`w-full items-center justify-center px-4 py-3 rounded-xl border ${isDark ? 'bg-sky-500/10 border-sky-500/50' : 'bg-blue-50 border-blue-200'}`}>
                                                            <View className="flex-row items-baseline justify-center">
                                                                {d > 0 && (
                                                                    <Text className={`font-black mr-2 ${isDark ? 'text-[#38bdf8]' : 'text-[#2563eb]'}`} style={{ fontSize: 24 * fontSizeScale }}>
                                                                        {d}{i18n.language === 'ko' ? '일' : 'd'}
                                                                    </Text>
                                                                )}
                                                                <Text
                                                                    className={`font-black tracking-widest tabular-nums ${isDark ? 'text-[#38bdf8]' : 'text-[#2563eb]'}`}
                                                                    style={{ fontSize: 28 * fontSizeScale, fontFamily: 'Orbitron' }}
                                                                >
                                                                    {timeStr}
                                                                </Text>
                                                            </View>
                                                            <Text className={`text-[11px] font-bold uppercase tracking-[0.3em] mt-1 opacity-80 ${isDark ? 'text-sky-200' : 'text-blue-400'}`}>REMAINING</Text>
                                                        </View>
                                                    );
                                                }
                                                return (
                                                    <View className={`w-full items-center justify-center px-4 py-2 rounded-xl bg-blue-500/20`}>
                                                        <Text className={`text-sm font-bold uppercase tracking-widest text-blue-400`}>Active</Text>
                                                    </View>
                                                );
                                            })()}
                                        </View>
                                    </View>

                                    {/* Date Range Display - Bottom Full Width */}
                                    <View className="flex-row flex-wrap items-center pt-2">
                                        <View className="flex-row items-center mr-2 py-0.5">
                                            <Ionicons name="calendar-outline" size={16} color="#CBD5E1" style={{ marginRight: 6 }} />
                                            {(() => {
                                                const parts = formattedDateRange.split(' ~ ');
                                                if (parts.length === 2 && parts[0].includes(' ') && parts[1].includes(' ')) {
                                                    const [date1, time1] = parts[0].split(' ');
                                                    return (
                                                        <View className="flex-row items-center">
                                                            <Text className="font-bold text-white" style={{ fontSize: 18 * fontSizeScale }}>{date1}</Text>
                                                            <Text className="text-slate-200" style={{ fontSize: 16 * fontSizeScale }}> {time1}</Text>
                                                        </View>
                                                    );
                                                }
                                                return <Text className="font-medium text-slate-300" style={{ fontSize: 18 * fontSizeScale }}>{formattedDateRange}</Text>;
                                            })()}
                                        </View>

                                        {(() => {
                                            const parts = formattedDateRange.split(' ~ ');
                                            if (parts.length === 2 && parts[1].includes(' ')) {
                                                const [date2, time2] = parts[1].split(' ');
                                                return (
                                                    <View className="flex-row items-center py-0.5">
                                                        <Text className="text-white mx-1" style={{ fontSize: 18 * fontSizeScale }}>~</Text>
                                                        <Text className="font-bold text-white" style={{ fontSize: 18 * fontSizeScale }}>{date2}</Text>
                                                        <Text className="text-slate-200" style={{ fontSize: 16 * fontSizeScale }}> {time2}</Text>
                                                    </View>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </View>
                                </View>
                            </ImageBackground>
                        </View>
                    ) : (
                        <View
                            className={`rounded-[24px] mb-3 overflow-hidden ${isDark ? 'bg-[#1e293b]/60 border border-slate-700/50' : 'bg-white border border-slate-200'}`}
                            style={{
                                elevation: 0,
                                opacity: isLocked ? 0.7 : 1,
                            }}
                        >
                            {/* Lock Overlay for non-logged-in users */}
                            {isLocked && (
                                <View className="absolute top-3 right-3 z-20 flex-row items-center bg-black/40 px-2.5 py-1 rounded-full">
                                    <Ionicons name="lock-closed" size={10} color="#94a3b8" style={{ marginRight: 4 }} />
                                    <Text style={{ fontSize: 9 * fontSizeScale, color: '#94a3b8', fontWeight: '700' }}>{t('common.member_only_title')}</Text>
                                </View>
                            )}
                            <View className={`${windowWidth < 380 ? 'px-3' : 'px-4'} py-4 flex-row items-center`}>
                                {/* Icon */}
                                <View className={`${windowWidth < 380 ? 'w-11 h-11 mr-2.5' : 'w-14 h-14 mr-4'} rounded-2xl items-center justify-center ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`}>
                                    {eventImageUrl ? (
                                        <Image
                                            source={typeof eventImageUrl === 'string' ? { uri: eventImageUrl } : eventImageUrl}
                                            className={`${windowWidth < 380 ? 'w-7 h-7' : 'w-8 h-8'}`}
                                            resizeMode="contain"
                                        />
                                    ) : (
                                        <Ionicons name={getEventIcon(event.originalEventId || event.eventId)} size={windowWidth < 380 ? 20 : 24} color={isDark ? '#94a3b8' : '#64748b'} />
                                    )}
                                </View>

                                {/* Content */}
                                <View className="flex-1 pr-1">
                                    {isUpcomingSoon && !isExpired && (
                                        <View className={`inline-flex flex-row items-center self-start px-1.5 py-0.5 rounded-md mb-1 ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                                            <Ionicons name="time" size={10} color={isDark ? '#fbbf24' : '#d97706'} style={{ marginRight: 2 }} />
                                            <Text className={`text-[10px] font-black ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>SOON</Text>
                                        </View>
                                    )}
                                    <View className="flex-row items-center mb-1">
                                        <Text
                                            className={`flex-1 font-bold tracking-tighter ${isDark ? 'text-slate-100' : 'text-slate-900'}`}
                                            numberOfLines={windowWidth < 430 ? 2 : 1}
                                            adjustsFontSizeToFit={true}
                                            minimumFontScale={0.5}
                                            style={{ fontFamily: 'Pretendard-Bold', fontSize: (windowWidth < 380 ? 14 : (windowWidth < 400 ? 16 : 18)) * fontSizeScale }}
                                        >
                                            {(() => {
                                                const eventId = event.eventId || '';
                                                const originalId = event.originalEventId || '';

                                                if (eventId.includes('citadel')) return t('events.citadel_battle_title');
                                                if (eventId.includes('fortress')) return t('events.fortress_battle_title');

                                                const cleanId = (originalId || eventId).replace(/_fortress|_citadel|_team\d+/g, '');
                                                const baseTitle = t(`events.${cleanId}_title`, { defaultValue: event.title });

                                                if ((event.isBearSplit || event.isFoundrySplit || event.isCanyonSplit) && event.teamLabel) {
                                                    const translatedTeam = event.teamLabel.replace('1군', t('events.team1')).replace('2군', t('events.team2'));
                                                    return `${baseTitle} (${translatedTeam})`;
                                                }
                                                return baseTitle;
                                            })()}
                                        </Text>
                                    </View>

                                    {/* Time Display */}
                                    <View>
                                        {(!displayDay && !displayTime) ? (
                                            <Text className="text-slate-400 text-sm">{t('dashboard.unassigned')}</Text>
                                        ) : (
                                            (() => {
                                                let rawStr = displayTime || displayDay || '-';
                                                // Combine Day and Time if separate and valid
                                                if (displayDay && displayTime && !/[일월화수목금토]/.test(displayTime)) {
                                                    if (!event.isFortressSplit) rawStr = `${displayDay} ${displayTime}`;
                                                }
                                                let finalStr = convertTime(rawStr);

                                                // Clean up string
                                                finalStr = finalStr.replace(/20(\d{2})[\.\/-]/g, '$1.'); // Shorten year
                                                finalStr = finalStr.replace(/성채전\s*:\s*/g, ''); // Remove prefix
                                                finalStr = finalStr.replace(/,\s*/g, '\n'); // Split by comma

                                                const lines = finalStr.split('\n');

                                                return (
                                                    <View>
                                                        {lines.map((line, idx) => {
                                                            // Format: "Mon 22:00" -> "Mon(22:00)"
                                                            let formattedLine = line.replace(/([월화수목금토일])\s+(\d{2}:\d{2})/, '$1($2)');

                                                            // Check for Fortress/Citadel keywords to style separately
                                                            const parts = formattedLine.split(' ');

                                                            return (
                                                                <Text
                                                                    key={idx}
                                                                    className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}
                                                                    numberOfLines={windowWidth < 430 ? 2 : 1}
                                                                    adjustsFontSizeToFit={true}
                                                                    minimumFontScale={0.7}
                                                                    style={{ fontFamily: 'Pretendard-Medium', fontSize: 16 * fontSizeScale, lineHeight: 22 * fontSizeScale }}
                                                                >
                                                                    {parts.map((part, pIdx) => {
                                                                        // Identify keywords (FortressN, CitadelN)
                                                                        const isKeyword = /^(요새|성채)\d+/.test(part);
                                                                        // Identify Time pattern Day(HH:MM)
                                                                        const isTimePattern = /[월화수목금토일]\(\d{2}:\d{2}\)/.test(part);

                                                                        const styleClass = isKeyword
                                                                            ? (isDark ? 'text-sky-300 font-bold' : 'text-blue-600 font-bold')
                                                                            : (isTimePattern ? (isDark ? 'text-slate-300' : 'text-slate-600') : '');

                                                                        return (
                                                                            <Text key={pIdx} className={styleClass}>
                                                                                {isKeyword ? translateLabel(part) : (isTimePattern ? part.replace(/[월화수목금토일]/g, m => translateDay(m)) : translateDay(part))}{pIdx < parts.length - 1 ? ' ' : ''}
                                                                            </Text>
                                                                        );
                                                                    })}
                                                                </Text>
                                                            );
                                                        })}
                                                    </View>
                                                );
                                            })()
                                        )}
                                    </View>
                                </View>

                                {/* Right Side Status/Action - Enhanced Affordance */}
                                <View className="flex-row items-center pl-2">
                                    {isUpcomingSoon && remSoonSeconds !== null && (
                                        <View className="mr-3 items-end" style={{ width: 65 }}>
                                            <Text className="text-[10px] font-black text-amber-500 uppercase tracking-tighter" style={{ marginBottom: -2 }}>Starts In</Text>
                                            <Text className="text-lg font-black text-amber-500 tabular-nums" style={{ fontFamily: 'Orbitron' }}>
                                                {formatRemainingTime(remSoonSeconds)}
                                            </Text>
                                        </View>
                                    )}
                                    {isExpired ? (
                                        <View className={`px-3 py-1.5 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                            <Text className={`text-xs font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ended</Text>
                                        </View>
                                    ) : (
                                        <View className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                            <Ionicons name="chevron-forward" size={18} color={isDark ? '#cbd5e1' : '#64748b'} />
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    );
                }}
            </Pressable >
        );
    };


    if (isLoading || isGateOpen || !serverId || !allianceId) {
        return (
            <GateScreen
                isLoading={isLoading}
                isGateOpen={isGateOpen}
                serverId={serverId}
                allianceId={allianceId}
                setIsGateOpen={setIsGateOpen}
                adminAuth={adminAuth}
                fontSizeScale={fontSizeScale}
                isMobile={isMobile}
                changeLanguage={changeLanguage}
                language={language}
            />
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

                    // Sync tabs with scroll position
                    const activePos = sectionPositions.current.active ? sectionPositions.current.active + containerY : 0;
                    const upcomingPos = sectionPositions.current.upcoming ? sectionPositions.current.upcoming + containerY : 0;
                    const expiredPos = sectionPositions.current.expired ? sectionPositions.current.expired + containerY : 0;

                    // Reduced buffer to 350 to ensure 'Expired' tab only turns on when 
                    // the expired section is closer to the top (showing last upcoming item).
                    const buffer = 350;

                    if (expiredPos > 0 && y >= expiredPos - buffer) {
                        if (activeEventTab !== 'expired') setActiveEventTab('expired');
                    } else if (upcomingPos > 0 && y >= upcomingPos - buffer) {
                        if (activeEventTab !== 'upcoming') setActiveEventTab('upcoming');
                    } else if (activePos > 0 && y >= activePos - buffer) {
                        if (activeEventTab !== 'active') setActiveEventTab('active');
                    } else {
                        // If way up top
                        if (y < (activePos || 500) - 100) {
                            if (activeEventTab !== 'active') setActiveEventTab('active');
                        }
                    }
                }}
            >
                {/* Section 1: Intro & Features */}
                <View className="w-full items-center">
                    <View className="w-full max-w-6xl px-4 md:px-8">
                        <DashboardHeader
                            isDark={isDark}
                            now={now}
                            auth={auth}
                            serverId={serverId}
                            allianceId={allianceId}
                            toggleTheme={toggleTheme}
                            handleInstallClick={handleInstallClick}
                            handleSettingsPress={handleSettingsPress}
                            setAdminMenuVisible={setAdminMenuVisible}
                            setLoginModalVisible={setLoginModalVisible}
                            setIsManualVisible={setIsManualVisible}
                            openModalWithHistory={openModalWithHistory}
                            setInputServer={setInputServer}
                            setInputAlliance={setInputAlliance}
                            setIsGateOpen={setIsGateOpen}
                            getNextResetSeconds={getNextResetSeconds}
                            formatRemainingTime={formatRemainingTime}
                        />
                    </View>

                    <NoticeBanner
                        notice={notice}
                        auth={auth}
                        isDark={isDark}
                        setNoticeDetailVisible={setNoticeDetailVisible}
                        showCustomAlert={showCustomAlert}
                        handleOpenNotice={handleOpenNotice}
                    />

                    <DashboardFeatureCards
                        isDark={isDark}
                        auth={auth}
                        router={router}
                        showCustomAlert={showCustomAlert}
                    />
                </View>

                {/* Section 2: Sticky Header (Weekly Program + Tabs) */}
                <View className={`w-full items-center z-50 py-3 ${isDark ? 'bg-[#060b14]/95' : 'bg-slate-50/95'}`} style={{ borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }}>
                    <View className="w-full max-w-6xl">
                        {/* Weekly Program Title & Timezone */}
                        <View className={`flex-row items-center justify-between ${windowWidth < 410 ? 'px-2' : 'px-3'} md:px-6 py-3 md:py-5 border ${isDark ? 'bg-slate-900 shadow-2xl shadow-black border-slate-800' : 'bg-white border-slate-200 shadow-xl'}`}>
                            <View className="flex-row items-center flex-1 mr-2">
                                <View className={`w-1 h-6 md:w-1.5 md:h-10 rounded-full ${windowWidth < 410 ? 'mr-1.5' : 'mr-5'} bg-[#38bdf8]`} />
                                <View>
                                    {windowWidth > 400 && (
                                        <Text className={`text-[11px] font-black tracking-[0.25em] uppercase mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Weekly Program</Text>
                                    )}
                                    <Text className={`font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: (windowWidth < 410 ? 21 : 24) * fontSizeScale }}>
                                        {t('dashboard.weekly_event_title')}
                                    </Text>
                                </View>
                            </View>

                            <View className="flex-row items-center gap-1 md:gap-2">
                                {/* Timezone Group */}
                                <View className={`flex-row p-0.5 md:p-1 rounded-[14px] md:rounded-2xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200 shadow-inner'}`}>
                                    <Pressable
                                        onPress={() => setTimezone('LOCAL')}
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                paddingHorizontal: windowWidth < 410 ? 12 : (isMobile ? 12 : 24),
                                                height: windowWidth < 410 ? 28 : (isMobile ? 32 : 40),
                                                borderRadius: windowWidth < 410 ? 8 : 12,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: timezone === 'LOCAL'
                                                    ? '#3b82f6'
                                                    : (hovered ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : 'transparent'),
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                cursor: 'pointer'
                                            }
                                        ]}
                                    >
                                        <Text className={`text-[11px] md:text-[14px] font-black ${timezone === 'LOCAL' ? 'text-white' : 'text-[#3b82f6]'}`}>Local</Text>
                                    </Pressable>
                                    <Pressable
                                        onPress={() => setTimezone('UTC')}
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                paddingHorizontal: windowWidth < 410 ? 12 : (isMobile ? 12 : 24),
                                                height: windowWidth < 410 ? 28 : (isMobile ? 32 : 40),
                                                borderRadius: windowWidth < 410 ? 8 : 12,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: timezone === 'UTC'
                                                    ? '#3b82f6'
                                                    : (hovered ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : 'transparent'),
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                cursor: 'pointer'
                                            }
                                        ]}
                                    >
                                        <Text className={`text-[11px] md:text-[14px] font-black ${timezone === 'UTC' ? 'text-white' : 'text-[#3b82f6]'}`}>UTC</Text>
                                    </Pressable>
                                </View>

                                {/* View Mode Group */}
                                <View className={`flex-row p-0.5 md:p-1 rounded-[14px] md:rounded-2xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                                    <Pressable
                                        onPress={() => setViewMode('timeline')}
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 4,
                                                paddingHorizontal: windowWidth < 410 ? 8 : (isMobile ? 10 : 16),
                                                height: windowWidth < 410 ? 28 : (isMobile ? 32 : 40),
                                                borderRadius: windowWidth < 410 ? 8 : 12,
                                                justifyContent: 'center',
                                                backgroundColor: viewMode === 'timeline' ? '#f97316' : 'transparent',
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                                transition: 'all 0.2s',
                                            }
                                        ]}
                                    >
                                        <Ionicons name="analytics" size={windowWidth < 410 ? 14 : 16} color={viewMode === 'timeline' ? 'white' : '#f97316'} />
                                        {windowWidth >= 410 && <Text style={{ fontSize: 11 * fontSizeScale, color: viewMode === 'timeline' ? 'white' : '#f97316', fontWeight: '800' }}>{t('events.timeline_view')}</Text>}
                                    </Pressable>
                                    <Pressable
                                        onPress={() => setViewMode('list')}
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                gap: 4,
                                                paddingHorizontal: windowWidth < 410 ? 8 : (isMobile ? 10 : 16),
                                                height: windowWidth < 410 ? 28 : (isMobile ? 32 : 40),
                                                borderRadius: windowWidth < 410 ? 8 : 12,
                                                justifyContent: 'center',
                                                backgroundColor: viewMode === 'list' ? '#f97316' : 'transparent',
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                                transition: 'all 0.2s',
                                            }
                                        ]}
                                    >
                                        <Ionicons name="list" size={windowWidth < 410 ? 14 : 16} color={viewMode === 'list' ? 'white' : '#f97316'} />
                                        {windowWidth >= 410 && <Text style={{ fontSize: 11 * fontSizeScale, color: viewMode === 'list' ? 'white' : '#f97316', fontWeight: '800' }}>{t('events.list_view')}</Text>}
                                    </Pressable>
                                </View>
                            </View>
                        </View>

                        {/* Navigation Tabs - Connected Folder Style */}
                        {viewMode === 'list' && (
                            <View className={`flex-row w-full ${isDark ? 'border-b border-slate-800' : 'border-b border-slate-200'}`}>
                                {[
                                    { id: 'active', label: t('events.filter.active'), icon: 'flash', color: '#10b981', count: displayEvents.filter(e => isEventActive(e)).length },
                                    { id: 'upcoming', label: t('events.filter.upcoming'), icon: 'calendar', color: '#38bdf8', count: displayEvents.filter(e => !isEventActive(e) && !isEventExpired(e)).length },
                                    { id: 'expired', label: t('events.filter.expired'), icon: 'checkmark-done', color: isDark ? '#475569' : '#94a3b8', count: displayEvents.filter(e => isEventExpired(e)).length }
                                ].map((tab) => {
                                    const isActive = activeEventTab === tab.id;
                                    return (
                                        <Pressable
                                            key={tab.id}
                                            onPress={() => scrollToSection(tab.id as any)}
                                            style={({ pressed, hovered }: any) => [
                                                {
                                                    flex: 1,
                                                    paddingVertical: windowWidth < 380 ? 10 : 14,
                                                    paddingHorizontal: windowWidth < 380 ? 4 : 12,
                                                    borderTopLeftRadius: windowWidth < 380 ? 12 : 16,
                                                    borderTopRightRadius: windowWidth < 380 ? 12 : 16,
                                                    flexDirection: 'row',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: isActive
                                                        ? (tab.id === 'active' ? (isDark ? 'rgba(16, 185, 129, 0.2)' : '#10b981') :
                                                            tab.id === 'upcoming' ? (isDark ? 'rgba(56, 189, 248, 0.2)' : '#38bdf8') :
                                                                (isDark ? 'rgba(71, 85, 105, 0.2)' : '#94a3b8'))
                                                        : (hovered ? (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)') : 'transparent'),
                                                    borderTopWidth: 1,
                                                    borderLeftWidth: 1,
                                                    borderRightWidth: 1,
                                                    borderColor: isActive
                                                        ? (isDark ? tab.color : 'rgba(0,0,0,0.1)')
                                                        : (hovered ? (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)') : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')),
                                                    borderBottomWidth: isActive ? 4 : 0,
                                                    borderBottomColor: tab.color,
                                                    marginBottom: -1, // Adjust to sit on the border
                                                    transform: [{ translateY: pressed ? 2 : 0 }],
                                                    transition: 'all 0.2s',
                                                    // @ts-ignore - Web property
                                                    cursor: 'pointer'
                                                }
                                            ]}
                                        >
                                            {({ hovered }: any) => (
                                                <>
                                                    <Ionicons
                                                        name={tab.icon as any}
                                                        size={windowWidth < 380 ? 14 : 16}
                                                        color={isActive
                                                            ? (isDark ? tab.color : '#fff')
                                                            : (hovered ? (isDark ? '#94a3b8' : '#64748b') : (isDark ? '#475569' : '#94a3b8'))
                                                        }
                                                        style={{ marginRight: windowWidth < 380 ? 4 : 6 }}
                                                    />
                                                    <Text className={`font-black tracking-tighter ${windowWidth < 380 ? 'text-[13px]' : 'text-sm'} ${isActive
                                                        ? (isDark ? 'text-white' : 'text-white')
                                                        : (hovered ? (isDark ? 'text-slate-300' : 'text-slate-700') : (isDark ? 'text-slate-600' : 'text-slate-400'))}`}>
                                                        {tab.label} <Text className={`font-black ${isActive ? 'text-white' : 'opacity-80'}`} style={{ fontSize: (windowWidth < 380 ? 14 : 18) * fontSizeScale }}>{tab.count}</Text>
                                                    </Text>
                                                </>
                                            )}
                                        </Pressable>
                                    );
                                })}
                            </View>
                        )}
                    </View>
                </View>

                {/* Section 3: Event List */}
                <View
                    onLayout={(e) => setContainerY(e.nativeEvent.layout.y)}
                    className="w-full items-center pb-24"
                >
                    <View className={viewMode === 'timeline' ? 'w-full' : 'w-full px-4'}>
                        <View className={viewMode === 'timeline' ? 'w-full' : 'w-full flex-col gap-3'}>
                            {loading ? (
                                <View className={`p-16 rounded-[32px] border border-dashed items-center justify-center ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                    <Text className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('dashboard.loading_schedule')}</Text>
                                </View>
                            ) : displayEvents.length > 0 ? (
                                <View className="flex-col gap-4">
                                    {/* Event Tabs - Folder Style */}
                                    {(() => {
                                        const activeEvents = displayEvents.filter(e => isEventActive(e));
                                        const upcomingEvents = displayEvents.filter(e => !isEventActive(e) && !isEventExpired(e));
                                        const expiredEvents = displayEvents.filter(e => isEventExpired(e));

                                        const getTabColor = (type: string, isActive: boolean) => {
                                            if (type === 'active') return isActive ? (isDark ? 'bg-blue-600 border-blue-400' : 'bg-blue-500 border-blue-400') : (isDark ? 'bg-slate-800/40 border-slate-600/50' : 'bg-slate-200/50 border-slate-300');
                                            if (type === 'upcoming') return isActive ? (isDark ? 'bg-emerald-600 border-emerald-400' : 'bg-emerald-500 border-emerald-400') : (isDark ? 'bg-slate-800/40 border-slate-600/50' : 'bg-slate-200/50 border-slate-300');
                                            if (type === 'expired') return isActive ? (isDark ? 'bg-slate-600 border-slate-400' : 'bg-slate-500 border-slate-400') : (isDark ? 'bg-slate-800/40 border-slate-600/50' : 'bg-slate-200/50 border-slate-300');
                                            return 'bg-transparent';
                                        };

                                        const activeTabColor =
                                            activeEventTab === 'active' ? (isDark ? '#3b82f6' : '#2563eb') :
                                                activeEventTab === 'upcoming' ? (isDark ? '#10b981' : '#059669') :
                                                    (isDark ? '#64748b' : '#475569');

                                        return (
                                            <View className="w-full">
                                                {viewMode === 'list' ? (
                                                    <React.Fragment key="list-view-content">
                                                        {/* Live Section */}
                                                        <View
                                                            onLayout={(e) => sectionPositions.current.active = e.nativeEvent.layout.y}
                                                            className="mb-12"
                                                        >
                                                            <View className="flex-row items-center justify-between mb-4 px-1">
                                                                <TouchableOpacity
                                                                    className="flex-row items-center"
                                                                    onPress={() => setIsActiveExpanded(!isActiveExpanded)}
                                                                >
                                                                    <View className="w-1.5 h-6 bg-emerald-500 rounded-full mr-3" />
                                                                    <Text className={`font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 20 * fontSizeScale }}>{t('dashboard.event_active')}</Text>
                                                                    <Ionicons name={isActiveExpanded ? "chevron-up" : "chevron-down"} size={20} color={isDark ? '#475569' : '#94a3b8'} style={{ marginLeft: 6 }} />
                                                                </TouchableOpacity>
                                                            </View>
                                                            {isActiveExpanded && (
                                                                activeEvents.length > 0 ? (
                                                                    <View className="flex-col gap-y-2 px-1">
                                                                        {activeEvents.map((event, idx) => renderEventCard(event, `active-${idx}`))}
                                                                    </View>
                                                                ) : (
                                                                    <View className={`py-12 items-center justify-center rounded-[32px] border border-dashed ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                                                        <Ionicons name="flash-off-outline" size={32} color={isDark ? '#475569' : '#94a3b8'} style={{ marginBottom: 12 }} />
                                                                        <Text className={`font-bold text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('dashboard.event_active_empty')}</Text>
                                                                    </View>
                                                                )
                                                            )}
                                                        </View>

                                                        {/* Upcoming Section */}
                                                        <View
                                                            onLayout={(e) => sectionPositions.current.upcoming = e.nativeEvent.layout.y}
                                                            className="mb-12"
                                                        >
                                                            <View className="flex-row items-center justify-between mb-4 px-1">
                                                                <TouchableOpacity
                                                                    className="flex-row items-center"
                                                                    onPress={() => setIsUpcomingExpanded(!isUpcomingExpanded)}
                                                                >
                                                                    <View className="w-1.5 h-6 bg-sky-500 rounded-full mr-3" />
                                                                    <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dashboard.event_upcoming')}</Text>
                                                                    <Ionicons name={isUpcomingExpanded ? "chevron-up" : "chevron-down"} size={20} color={isDark ? '#475569' : '#94a3b8'} style={{ marginLeft: 6 }} />
                                                                </TouchableOpacity>
                                                            </View>
                                                            {isUpcomingExpanded && (
                                                                upcomingEvents.length > 0 ? (
                                                                    <View className="flex-col gap-y-2 px-1">
                                                                        {upcomingEvents.map((event, idx) => renderEventCard(event, `upcoming-${idx}`))}
                                                                    </View>
                                                                ) : (
                                                                    <View className={`py-12 items-center justify-center rounded-[32px] border border-dashed ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                                                        <Ionicons name="calendar-outline" size={32} color={isDark ? '#475569' : '#94a3b8'} style={{ marginBottom: 12 }} />
                                                                        <Text className={`font-bold text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('dashboard.event_upcoming_empty')}</Text>
                                                                    </View>
                                                                )
                                                            )}
                                                        </View>

                                                        {/* Expired Section */}
                                                        <View
                                                            onLayout={(e) => sectionPositions.current.expired = e.nativeEvent.layout.y}
                                                            className="mb-12"
                                                        >
                                                            <View className="flex-row items-center justify-between mb-6 px-1">
                                                                <TouchableOpacity
                                                                    className="flex-row items-center"
                                                                    onPress={() => setIsExpiredExpanded(!isExpiredExpanded)}
                                                                >
                                                                    <View className="w-1.5 h-6 bg-slate-500 rounded-full mr-3" />
                                                                    <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dashboard.event_expired')}</Text>
                                                                    <Ionicons name={isExpiredExpanded ? "chevron-up" : "chevron-down"} size={20} color={isDark ? '#475569' : '#94a3b8'} style={{ marginLeft: 6 }} />
                                                                </TouchableOpacity>
                                                            </View>
                                                            {isExpiredExpanded ? (
                                                                expiredEvents.length > 0 ? (
                                                                    <View className="flex-col gap-y-2 opacity-60 px-1">
                                                                        {expiredEvents.map((event, idx) => renderEventCard(event, `expired-${idx}`))}
                                                                    </View>
                                                                ) : (
                                                                    <View className={`py-12 items-center justify-center rounded-[32px] border border-dashed ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                                                        <Ionicons name="checkmark-done-outline" size={32} color={isDark ? '#475569' : '#94a3b8'} style={{ marginBottom: 12 }} />
                                                                        <Text className={`font-bold text-sm ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('dashboard.event_expired_empty')}</Text>
                                                                    </View>
                                                                )
                                                            ) : null}
                                                        </View>
                                                    </React.Fragment>
                                                ) : (
                                                    <View key="timeline-view-content" className={`w-full ${isDark ? 'bg-[#0a1120]' : 'bg-white'} ${viewMode === 'timeline' ? '' : 'rounded-[40px] border overflow-hidden p-6 shadow-2xl shadow-black'}`}>
                                                        <TimelineView
                                                            events={displayEvents}
                                                            timezone={timezone}
                                                            isDark={isDark}
                                                            onEventPress={(ev) => {
                                                                if (!auth.isLoggedIn) {
                                                                    showCustomAlert(t('common.member_only_title'), t('common.member_only_alert'), 'error');
                                                                    return;
                                                                }
                                                                router.push({ pathname: '/growth/events', params: { focusId: ev.originalEventId || ev.eventId, viewMode: viewMode } });
                                                            }}
                                                            checkIsOngoing={isEventActive}
                                                        />
                                                    </View>
                                                )}
                                            </View>
                                        );
                                    })()}
                                </View>
                            ) : (
                                <View className={`p-12 rounded-[32px] border border-dashed items-center justify-center ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                    <View className={`w-16 h-16 rounded-3xl items-center justify-center mb-4 ${isDark ? 'bg-sky-500/10' : 'bg-sky-50'}`}>
                                        <Ionicons name="calendar-outline" size={32} color={isDark ? '#475569' : '#94a3b8'} />
                                    </View>
                                    <Text className={`font-bold text-base mb-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('dashboard.schedule_empty')}</Text>
                                    <Text className={`text-xs mb-5 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('dashboard.schedule_empty_desc')}</Text>
                                    <TouchableOpacity
                                        onPress={() => {
                                            if (!auth.isLoggedIn) {
                                                showCustomAlert(t('auth.loginRequired'), t('common.member_only_alert'), 'error');
                                                return;
                                            }
                                            router.push('/growth/events' as any);
                                        }}
                                        className={`px-6 py-3 rounded-2xl flex-row items-center ${isDark ? 'bg-sky-500/15 border border-sky-500/30' : 'bg-sky-50 border border-sky-200'}`}
                                    >
                                        <Ionicons name="add-circle-outline" size={16} color={isDark ? '#38bdf8' : '#2563eb'} style={{ marginRight: 6 }} />
                                        <Text className={`font-bold text-sm ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{t('dashboard.register_schedule')}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>

                </View>

                {/* Modern Refined Footer */}
                <View className="mt-12 mb-20 items-center">
                    {/* Thin Subtle Divider */}
                    <View className={`w-full h-[1px] mb-8 self-stretch ${isDark ? 'bg-slate-800/40' : 'bg-slate-200/60'}`} />

                    <View className="items-center px-12">
                        <Text className={`text-[10px] font-black tracking-[0.2em] uppercase text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                            © 2026 WOS Studio  —  Designed by SSJ
                        </Text>

                        {/* Optional: Subtle Underline/Accent */}
                        <View className={`mt-4 w-6 h-0.5 rounded-full ${isDark ? 'bg-sky-500/20' : 'bg-sky-500/10'}`} />
                    </View>
                </View>
            </ScrollView>

            {/* Modals */}
            <LoginModal
                isVisible={loginModalVisible}
                onClose={() => setLoginModalVisible(false)}
                isDark={isDark}
                loginInput={loginInput}
                setLoginInput={setLoginInput}
                passwordInput={passwordInput}
                setPasswordInput={setPasswordInput}
                loginError={loginError}
                setLoginError={setLoginError}
                showModalPw={showModalPw}
                setShowModalPw={setShowModalPw}
                loginPasswordRef={loginPasswordRef}
                handleLogin={handleLogin}
                dynamicAdmins={dynamicAdmins}
            />

            <AdminMenuModal
                isVisible={adminMenuVisible}
                onClose={() => setAdminMenuVisible(false)}
                isDark={isDark}
                auth={auth}
                isSuperAdmin={isSuperAdmin}
                setAdminDashboardVisible={setAdminDashboardVisible}
                setIsUserPassChangeOpen={setIsUserPassChangeOpen}
                setIsSuperAdminDashboardVisible={setIsSuperAdminDashboardVisible}
                setSuperAdminTab={setSuperAdminTab}
                handleLogout={handleLogout}
                setAdminMenuVisible={setAdminMenuVisible}
                showAdminList={showAdminList}
                setShowAdminList={setShowAdminList}
                loadingSuperAdmins={loadingSuperAdmins}
                superAdminsList={superAdminsList}
                handleDeleteSuperAdmin={handleDeleteSuperAdmin}
                newAdminName={newAdminName}
                setNewAdminName={setNewAdminName}
                newAdminPassword={newAdminPassword}
                setNewAdminPassword={setNewAdminPassword}
                handleAddSuperAdmin={handleAddSuperAdmin}
            />

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

                    <ScrollView
                        className="flex-1"
                        contentContainerStyle={{ paddingBottom: 40 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Header */}
                        <View className="mb-8 px-6 pt-8 flex-row items-center justify-between">
                            <View className="flex-1">
                                <Text className={`text-[10px] font-black tracking-[0.3em] uppercase mb-1 ${isDark ? 'text-sky-400' : 'text-sky-600'}`} style={{ fontSize: 10 * fontSizeScale }}>{t('admin.super_admin_manage')}</Text>
                                <Text className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 30 * fontSizeScale }}>
                                    {superAdminTab === 'settings' ? t('admin.screen_management') : t('admin.super_dashboard_title')}
                                </Text>
                                <View className="w-10 h-1 bg-sky-500 rounded-full mt-3" />
                            </View>
                            <TouchableOpacity
                                onPress={() => setIsSuperAdminDashboardVisible(false)}
                                className={`p-3 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                            >
                                <Ionicons name="close" size={24} color={isDark ? '#94a3b8' : '#64748b'} />
                            </TouchableOpacity>
                        </View>

                        {/* Stats / Interactive Tabs - Only show for Alliance Management */}
                        {superAdminTab !== 'settings' && (
                            <View className="flex-row gap-2 mb-8 px-5">
                                {[
                                    { id: 'pending', label: t('admin.pending_count'), count: allRequests.filter(r => r.status === 'pending').length, icon: 'time-outline', color: 'sky' },
                                    { id: 'alliances', label: t('admin.approved_count'), count: allRequests.filter(r => r.status === 'approved').length, icon: 'business-outline', color: 'emerald' },
                                ].map((tab) => (
                                    <TouchableOpacity
                                        key={tab.id}
                                        onPress={() => setSuperAdminTab(tab.id as any)}
                                        activeOpacity={0.7}
                                        className={`flex-1 p-3 rounded-[24px] border transition-all ${superAdminTab === tab.id ?
                                            `border-${tab.color}-500 bg-${tab.color}-500/10 shadow-lg shadow-${tab.color}-500/20` :
                                            (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')}`}
                                    >
                                        <View className="flex-row items-center justify-between mb-1">
                                            <View className={`w-8 h-8 rounded-xl items-center justify-center ${superAdminTab === tab.id ? `bg-${tab.color}-500` : (isDark ? 'bg-slate-800' : 'bg-slate-50')}`}>
                                                <Ionicons name={tab.icon as any} size={16} color={superAdminTab === tab.id ? 'white' : (isDark ? '#64748b' : '#94a3b8')} />
                                            </View>
                                            {tab.count !== undefined && (
                                                <Text className={`text-xl font-black ${superAdminTab === tab.id ? (isDark ? `text-${tab.color}-400` : `text-${tab.color}-500`) : (isDark ? 'text-slate-700' : 'text-slate-400')}`} style={{ fontSize: 20 * fontSizeScale }}>
                                                    {tab.count}
                                                </Text>
                                            )}
                                        </View>
                                        <Text className={`text-[10px] font-black uppercase tracking-tight ${superAdminTab === tab.id ? `text-${tab.color}-500` : (isDark ? 'text-slate-500' : 'text-slate-500')}`} numberOfLines={1} style={{ fontSize: 10 * fontSizeScale }}>
                                            {tab.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        <View className="flex-row items-center justify-between mb-6 px-6">
                            <View>
                                <View className="flex-row items-center gap-2 mb-0.5">
                                    <View className="w-1 h-5 bg-sky-500 rounded-full" />
                                    <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 24 * fontSizeScale }}>
                                        {superAdminTab === 'pending' ? t('admin.pending_queue') :
                                            superAdminTab === 'alliances' ? t('admin.registered_alliances') :
                                                t('admin.appSettings')}
                                    </Text>
                                </View>
                                <Text className={`text-xs font-bold pl-3 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} style={{ fontSize: 12 * fontSizeScale }}>
                                    {superAdminTab === 'pending' ? t('admin.pending_desc') :
                                        superAdminTab === 'alliances' ? t('admin.registered_desc') :
                                            t('admin.settings_desc')}
                                </Text>
                            </View>

                            {superAdminTab === 'pending' && allRequests.filter(r => r.status === 'pending').length > 0 && (
                                <TouchableOpacity
                                    onPress={() => {
                                        const pendingReqs = allRequests.filter(r => r.status === 'pending');
                                        if (selectedReqIds.size === pendingReqs.length) {
                                            setSelectedReqIds(new Set());
                                        } else {
                                            setSelectedReqIds(new Set(pendingReqs.map(r => r.id)));
                                        }
                                    }}
                                    activeOpacity={0.7}
                                    className={`flex-row items-center px-5 py-4 rounded-2xl border transition-all ${selectedReqIds.size > 0 ? 'border-sky-500 bg-sky-500/10' : (isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white shadow-sm')}`}
                                >
                                    <Ionicons
                                        name={selectedReqIds.size === allRequests.filter(r => r.status === 'pending').length ? "checkbox" : "square-outline"}
                                        size={24}
                                        color={selectedReqIds.size > 0 ? "#38bdf8" : (isDark ? "#475569" : "#94a3b8")}
                                    />
                                    <Text className={`ml-2 font-black text-sm ${selectedReqIds.size > 0 ? (isDark ? 'text-white' : 'text-slate-900') : 'text-slate-500'}`} style={{ fontSize: 14 * fontSizeScale }}>
                                        {t('admin.select_all')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Batch Controls */}
                        {superAdminTab === 'pending' && selectedReqIds.size > 0 && (
                            <View className={`flex-row gap-3 mb-8 mx-6 p-4 rounded-[28px] border shadow-xl transition-all ${isDark ? 'bg-slate-900/95 border-sky-500/20' : 'bg-white border-sky-100 shadow-sky-200/40'}`}>
                                <View className="flex-1 flex-row items-center bg-sky-500/10 px-4 py-2 rounded-xl">
                                    <Ionicons name="checkbox" size={18} color="#38bdf8" />
                                    <Text className={`ml-2 font-black text-base ${isDark ? 'text-sky-400' : 'text-sky-600'}`} style={{ fontSize: 16 * fontSizeScale }}>
                                        {selectedReqIds.size}{t('common.count')} <Text className="text-xs font-bold opacity-60" style={{ fontSize: 12 * fontSizeScale }}>{t('common.selected')}</Text>
                                    </Text>
                                </View>
                                <View className="flex-row gap-2">
                                    <TouchableOpacity
                                        onPress={handleBulkReject}
                                        activeOpacity={0.7}
                                        className={`px-4 py-3 rounded-xl border ${isDark ? 'border-red-500/30 bg-red-500/10' : 'border-red-100 bg-red-50'}`}
                                    >
                                        <Text className="text-xs font-bold text-red-500" style={{ fontSize: 12 * fontSizeScale }}>{t('admin.reject_selected')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleBulkApprove}
                                        activeOpacity={0.7}
                                        className="px-6 py-3 bg-sky-500 rounded-xl shadow-lg shadow-sky-500/20 flex-row items-center"
                                    >
                                        <Ionicons name="checkmark-circle" size={16} color="white" style={{ marginRight: 6 }} />
                                        <Text className="font-black text-white text-sm" style={{ fontSize: 14 * fontSizeScale }}>{t('admin.approve_selected')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <View className="px-6">
                            {isSuperAdminLoading ? (
                                <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 40 }} />
                            ) : (
                                <View>
                                    {superAdminTab === 'settings' ? (
                                        <View className="pb-10">
                                            <View className={`p-5 rounded-[32px] border mb-6 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                                                <View className="flex-row items-center mb-6">
                                                    <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-4 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                                                        <Ionicons name="color-palette" size={20} color={isDark ? "#818cf8" : "#4f46e5"} />
                                                    </View>
                                                    <View>
                                                        <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 18 * fontSizeScale }}>{t('admin.themeSettings')}</Text>
                                                        <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest`}>Visual System</Text>
                                                    </View>
                                                </View>
                                                <View className="flex-row gap-3">
                                                    <TouchableOpacity
                                                        onPress={() => { saveGlobalTheme('dark'); setTheme('dark'); }}
                                                        className={`flex-1 py-4 rounded-2xl border-2 items-center justify-center ${globalThemeConfig?.defaultMode === 'dark' ? 'bg-indigo-600 border-indigo-400' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200')}`}
                                                    >
                                                        <Ionicons name="moon" size={18} color={globalThemeConfig?.defaultMode === 'dark' ? 'white' : (isDark ? '#64748b' : '#94a3b8')} />
                                                        <Text className={`font-black text-xs mt-2 ${globalThemeConfig?.defaultMode === 'dark' ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>DARK</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => { saveGlobalTheme('light'); setTheme('light'); }}
                                                        className={`flex-1 py-4 rounded-2xl border-2 items-center justify-center ${globalThemeConfig?.defaultMode === 'light' ? 'bg-indigo-600 border-indigo-400' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200')}`}
                                                    >
                                                        <Ionicons name="sunny" size={18} color={globalThemeConfig?.defaultMode === 'light' ? 'white' : (isDark ? '#64748b' : '#94a3b8')} />
                                                        <Text className={`font-black text-xs mt-2 ${globalThemeConfig?.defaultMode === 'light' ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>LIGHT</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            <View className={`p-5 rounded-[32px] border ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                                                <View className="flex-row items-center mb-6">
                                                    <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-4 ${isDark ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
                                                        <Ionicons name="text" size={20} color={isDark ? "#60a5fa" : "#2563eb"} />
                                                    </View>
                                                    <View>
                                                        <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 18 * fontSizeScale }}>{t('admin.fontSettings')}</Text>
                                                        <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'} uppercase tracking-widest`}>Accessibility</Text>
                                                    </View>
                                                </View>
                                                <View className="flex-row gap-2">
                                                    {(['small', 'medium', 'large'] as const).map((size) => (
                                                        <TouchableOpacity
                                                            key={size}
                                                            onPress={() => setFontSize(size)}
                                                            className={`flex-1 py-3 rounded-xl border-2 items-center justify-center ${fontSize === size ? 'bg-blue-600 border-blue-400' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200')}`}
                                                        >
                                                            <Text className={`font-black text-[10px] ${fontSize === size ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>{size.toUpperCase()}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            </View>
                                        </View>
                                    ) : (
                                        <View>
                                            {allRequests.filter(r => superAdminTab === 'pending' ? r.status === 'pending' : r.status === 'approved').length === 0 ? (
                                                <View className="items-center justify-center py-20">
                                                    <Ionicons name="documents-outline" size={64} color={isDark ? '#334155' : '#cbd5e1'} />
                                                    <Text className={`mt-4 font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                        {superAdminTab === 'pending' ? t('admin.no_pending') : t('admin.no_registered')}
                                                    </Text>
                                                </View>
                                            ) : (
                                                allRequests.filter(r => (superAdminTab === 'pending' ? r.status === 'pending' : r.status === 'approved')).map((req) => (
                                                    <View key={req.id} className={`p-4 rounded-[24px] border mb-3 shadow-md ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                                        <View className="flex-row">
                                                            {superAdminTab === 'pending' && (
                                                                <TouchableOpacity
                                                                    onPress={() => toggleSelectRequest(req.id)}
                                                                    className="mr-4 justify-center"
                                                                >
                                                                    <View className={`w-10 h-10 rounded-2xl items-center justify-center border-2 ${selectedReqIds.has(req.id) ? 'bg-sky-500 border-sky-500' : (isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200')}`}>
                                                                        {selectedReqIds.has(req.id) && <Ionicons name="checkmark" size={24} color="white" />}
                                                                    </View>
                                                                </TouchableOpacity>
                                                            )}
                                                            <View style={{ flex: 1 }}>
                                                                <View className="flex-row justify-between items-start mb-4">
                                                                    <View style={{ flex: 1, marginRight: 8 }}>
                                                                        <View className="flex-row flex-wrap items-center">
                                                                            <Text className="text-[10px] font-black px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 mr-2 mb-1">{req.serverId}</Text>
                                                                            <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'} mb-1`}>{req.allianceId}</Text>
                                                                        </View>
                                                                        {!!req.allianceName && <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{req.allianceName}</Text>}
                                                                    </View>

                                                                    {superAdminTab === 'pending' ? (
                                                                        <View className="flex-row gap-2 shrink-0">
                                                                            <TouchableOpacity
                                                                                onPress={() => handleRejectRequest(req)}
                                                                                activeOpacity={0.7}
                                                                                className={`px-3 py-2 rounded-xl border flex-row items-center ${isDark ? 'border-red-500/30 bg-red-500/10' : 'border-red-100 bg-red-50'}`}
                                                                            >
                                                                                <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
                                                                                <Text className="text-xs font-bold text-red-500 ml-1">{t('admin.reject_short')}</Text>
                                                                            </TouchableOpacity>
                                                                            <TouchableOpacity
                                                                                onPress={() => handleApproveRequest(req)}
                                                                                activeOpacity={0.7}
                                                                                className="px-4 py-2 bg-sky-500 rounded-xl shadow-sm flex-row items-center"
                                                                            >
                                                                                <Ionicons name="checkmark-circle" size={16} color="white" />
                                                                                <Text className="text-xs font-black text-white ml-1">{t('admin.approve_short')}</Text>
                                                                            </TouchableOpacity>
                                                                        </View>
                                                                    ) : (
                                                                        <View className="flex-row gap-2 shrink-0">
                                                                            <TouchableOpacity
                                                                                onPress={() => handleResetPasswordAdmin(req)}
                                                                                activeOpacity={0.7}
                                                                                className={`px-2 py-1.5 rounded-xl border flex-row items-center ${isDark ? 'border-amber-500/30 bg-amber-500/10' : 'border-amber-100 bg-amber-50'}`}
                                                                            >
                                                                                <Ionicons name="key-outline" size={12} color="#f59e0b" />
                                                                                <Text className="text-[10px] font-bold text-amber-500 ml-1">{t('admin.reset_pw_short')}</Text>
                                                                            </TouchableOpacity>
                                                                            <TouchableOpacity
                                                                                onPress={() => handleDeleteAlliance(req)}
                                                                                activeOpacity={0.7}
                                                                                className={`px-2 py-1.5 rounded-xl border flex-row items-center ${isDark ? 'border-red-500/30 bg-red-500/10' : 'border-red-100 bg-red-50'}`}
                                                                            >
                                                                                <Ionicons name="trash-outline" size={12} color="#ef4444" />
                                                                                <Text className="text-[10px] font-bold text-red-500 ml-1">{t('admin.delete_short')}</Text>
                                                                            </TouchableOpacity>
                                                                        </View>
                                                                    )}
                                                                </View>

                                                                <View className={`flex-row justify-between items-center p-3 rounded-2xl ${isDark ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
                                                                    <View style={{ flex: 1, marginRight: 10 }}>
                                                                        <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`} numberOfLines={1}>Admin ID: <Text className={`text-xs ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{req.adminId}</Text></Text>
                                                                        <Text className={`text-[10px] font-bold mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} numberOfLines={1}>Contact: <Text className={`text-xs ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{req.contact || '-'}</Text></Text>
                                                                    </View>
                                                                    <View className="items-end">
                                                                        <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{new Date(req.requestedAt).toLocaleDateString()}</Text>
                                                                    </View>
                                                                </View>
                                                            </View>
                                                        </View>
                                                    </View>
                                                ))
                                            )}
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    </ScrollView>

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

            {/* Modals extracted to components */}
            <NoticePopup
                isVisible={noticePopupVisible}
                onClose={dismissNoticePopup}
                isDark={isDark}
                isMobile={isMobile}
                notice={notice}
                noticePopupDontShow={noticePopupDontShow}
                setNoticePopupDontShow={setNoticePopupDontShow}
                fontSize={fontSize}
            />

            <UserPassChangeModal
                isVisible={isUserPassChangeOpen}
                onClose={() => setIsUserPassChangeOpen(false)}
                isDark={isDark}
                auth={auth}
                showCustomAlert={showCustomAlert}
                setAdminMenuVisible={setAdminMenuVisible}
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                isChangingPassword={isChangingPassword}
                setIsChangingPassword={setIsChangingPassword}
            />

            <NoticeDetailModal
                isVisible={noticeDetailVisible}
                onClose={() => setNoticeDetailVisible(false)}
                isDark={isDark}
                notice={notice}
            />

            <NoticeEditModal
                isVisible={noticeModalVisible}
                onClose={() => setNoticeModalVisible(false)}
                isDark={isDark}
                editNoticeContent={editNoticeContent}
                setEditNoticeContent={setEditNoticeContent}
                editNoticeVisible={editNoticeVisible}
                setEditNoticeVisible={setEditNoticeVisible}
                handleSaveNotice={handleSaveNotice}
            />

            <InstallModal
                isVisible={installModalVisible}
                onClose={() => setInstallModalVisible(false)}
                isDark={isDark}
            />

            <ManualModal
                isVisible={isManualVisible}
                onClose={() => setIsManualVisible(false)}
                isDark={isDark}
                isMobile={isMobile}
            />
        </View>
    );
}
