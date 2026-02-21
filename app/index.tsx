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
import { EventCard } from '../components/events/EventCard';
import { SuperAdminModal } from '../components/modals/SuperAdminModal';
import { EventSectionList } from '../components/dashboard/EventSectionList';


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

    const scrollToSection = useCallback((section: 'active' | 'upcoming' | 'expired') => {
        if (section === 'expired') setIsExpiredExpanded(true);
        const sectionY = sectionPositions.current[section];
        if (sectionY !== undefined && mainScrollRef.current) {
            const offset = 150; // Offset for sticky header
            mainScrollRef.current.scrollTo({
                y: sectionY + containerY - offset,
                animated: true
            });
            setActiveEventTab(section);
        }
    }, [containerY]);
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






    const renderEventCard = (event: any, key: string) => (
        <EventCard
            key={key}
            event={event}
            isDark={isDark}
            isMobile={isMobile}
            fontSizeScale={fontSizeScale}
            windowWidth={windowWidth}
            now={now}
            timezone={timezone}
            viewMode={viewMode}
            t={t}
            auth={auth}
            isEventActive={isEventActive}
            isEventExpired={isEventExpired}
            getRemainingSeconds={getRemainingSeconds}
            getEventEndDate={getEventEndDate}
            toLocal={toLocal}
            toUTC={toUTC}
            pad={pad}
            translateDay={translateDay}
            translateLabel={translateLabel}
            getEventSchedule={getEventSchedule}
            formatRemainingTime={formatRemainingTime}
            onPress={(ev) => {
                if (!auth.isLoggedIn) {
                    showCustomAlert(t('auth.memberOnly'), t('auth.memberOnlyDesc'), 'error');
                    return;
                }
                router.push({ pathname: '/growth/events', params: { focusId: ev.originalEventId || ev.eventId, viewMode: viewMode } });
            }}
        />
    );


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

                <EventSectionList
                    isDark={isDark}
                    windowWidth={windowWidth}
                    fontSizeScale={fontSizeScale}
                    t={t}
                    timezone={timezone}
                    setTimezone={setTimezone}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    isMobile={isMobile}
                    loading={loading}
                    displayEvents={displayEvents}
                    isEventActive={isEventActive}
                    isEventExpired={isEventExpired}
                    isActiveExpanded={isActiveExpanded}
                    setIsActiveExpanded={setIsActiveExpanded}
                    isUpcomingExpanded={isUpcomingExpanded}
                    setIsUpcomingExpanded={setIsUpcomingExpanded}
                    isExpiredExpanded={isExpiredExpanded}
                    setIsExpiredExpanded={setIsExpiredExpanded}
                    activeEventTab={activeEventTab}
                    scrollToSection={scrollToSection}
                    renderEventCard={renderEventCard}
                    sectionPositions={sectionPositions}
                    setContainerY={setContainerY}
                    auth={auth}
                    router={router}
                    showCustomAlert={showCustomAlert}
                />

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

            <SuperAdminModal
                isVisible={isSuperAdminDashboardVisible}
                onClose={() => setIsSuperAdminDashboardVisible(false)}
                isDark={isDark}
                superAdminTab={superAdminTab}
                setSuperAdminTab={setSuperAdminTab}
                allRequests={allRequests}
                selectedReqIds={selectedReqIds}
                setSelectedReqIds={setSelectedReqIds}
                handleBulkApprove={handleBulkApprove}
                handleBulkReject={handleBulkReject}
                handleApproveRequest={handleApproveRequest}
                handleRejectRequest={handleRejectRequest}
                handleResetPasswordAdmin={handleResetPasswordAdmin}
                handleDeleteAlliance={handleDeleteAlliance}
                isSuperAdminLoading={isSuperAdminLoading}
                t={t}
                fontSizeScale={fontSizeScale}
                globalThemeConfig={globalThemeConfig}
                saveGlobalTheme={saveGlobalTheme}
                setTheme={setTheme}
                setFontSize={setFontSize}
                fontSize={fontSize}
                toggleSelectRequest={toggleSelectRequest}
            />

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
