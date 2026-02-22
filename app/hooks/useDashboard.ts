import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Platform, UIManager, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import {
    getEventSchedule as getEventScheduleUtil,
    getEventEndDate as getEventEndDateUtil,
    checkWeeklyExpired as checkWeeklyExpiredUtil,
    isEventExpired,
    getRemainingSeconds as getRemainingSecondsUtil,
    getNextResetSeconds as getNextResetSecondsUtil,
    checkItemActive,
    isVisibleInList,
    calculateBearHuntDay as calculateBearHuntDayUtil,
    isEventActive,
    getBundleId as getBundleIdUtil,
    getSortTime,
    getCanonicalEventId
} from '../utils/eventStatus';
import {
    pad as padUtil,
    formatRemainingTime as formatRemainingTimeUtil,
    toLocal as toLocalUtil,
    toUTC as toUTCUtil,
    processConversion as processConversionUtil,
    splitSchedulePart as splitSchedulePartUtil,
    getKoreanDayOfWeek as getKoreanDayOfWeekUtil,
    translateDay as translateDayUtil,
    translateLabel as translateLabelUtil
} from '../utils/eventHelpers';
import { INITIAL_WIKI_EVENTS } from '../../data/wiki-events';
import { ADDITIONAL_EVENTS } from '../../data/new-events';

interface UseDashboardProps {
    serverId: string | null;
    allianceId: string | null;
    auth: any;
    schedules: any[];
    notice: any;
    saveNotice: (content: string, visible: boolean) => Promise<void>;
    showCustomAlert: (title: string, message: string, type?: 'success' | 'error' | 'warning' | 'confirm') => void;
    t: (key: string, options?: any) => string;
    changeFontSize: (scale: number) => void;
    mainScrollRef: React.RefObject<any>;
    dashboardScrollY: number;
    setDashboardScrollY: (y: number) => void;
    setIsGateOpen: (open: boolean) => void;
}

export const useDashboard = ({
    serverId,
    allianceId,
    auth,
    schedules,
    notice,
    saveNotice,
    showCustomAlert,
    t,
    changeFontSize,
    mainScrollRef,
    dashboardScrollY,
    setDashboardScrollY,
    setIsGateOpen
}: UseDashboardProps) => {
    const router = useRouter();
    const { width: windowWidth } = useWindowDimensions();
    const isMobile = windowWidth < 600;

    // --- State ---
    const [now, setNow] = useState(new Date());
    const [activeEventTab, setActiveEventTab] = useState<'active' | 'upcoming' | 'expired'>('active');
    const [containerY, setContainerY] = useState(0);
    const [isActiveExpanded, setIsActiveExpanded] = useState(true);
    const [isUpcomingExpanded, setIsUpcomingExpanded] = useState(true);
    const [isExpiredExpanded, setIsExpiredExpanded] = useState(false);
    const [timezone, setTimezone] = useState<'LOCAL' | 'UTC'>('LOCAL');
    const [viewMode, setViewMode] = useState<'list' | 'timeline'>('timeline');
    const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>('medium');

    // UI Visibility States
    const [adminMenuVisible, setAdminMenuVisible] = useState(false);
    const [loginModalVisible, setLoginModalVisible] = useState(false);
    const [isSuperAdminDashboardVisible, setIsSuperAdminDashboardVisible] = useState(false);
    const [adminDashboardVisible, setAdminDashboardVisible] = useState(false);
    const [isUserPassChangeOpen, setIsUserPassChangeOpen] = useState(false);
    const [noticeDetailVisible, setNoticeDetailVisible] = useState(false);
    const [noticePopupVisible, setNoticePopupVisible] = useState(false);
    const [noticeModalVisible, setNoticeModalVisible] = useState(false);
    const [installModalVisible, setInstallModalVisible] = useState(false);
    const [isManualVisible, setIsManualVisible] = useState(false);
    const [qrInviteVisible, setQRInviteVisible] = useState(false);

    // Form / Data States
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showModalPw, setShowModalPw] = useState(false);
    const [editNoticeContent, setEditNoticeContent] = useState('');
    const [editNoticeVisible, setEditNoticeVisible] = useState(true);
    const [noticePopupDontShow, setNoticePopupDontShow] = useState(false);

    // --- Refs ---
    const sectionPositions = useRef<{ [key: string]: number }>({});

    // --- Effects ---

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Load active tab state
    useEffect(() => {
        AsyncStorage.getItem('activeEventTab').then(saved => {
            if (saved && (saved === 'active' || saved === 'upcoming' || saved === 'expired')) {
                setActiveEventTab(saved as any);
            }
        });
    }, []);

    // Font Size Persistence
    useEffect(() => {
        AsyncStorage.getItem('settings_fontSize').then(val => {
            if (val && ['small', 'medium', 'large'].includes(val)) {
                setFontSize(val as any);
            }
        });
    }, []);

    useEffect(() => {
        AsyncStorage.setItem('settings_fontSize', fontSize);
        const scale = fontSize === 'small' ? 0.95 : fontSize === 'large' ? 1.25 : 1.1;
        changeFontSize(scale);
    }, [fontSize]);

    // Handle viewMode restoration
    useEffect(() => {
        AsyncStorage.getItem('settings_viewMode').then(val => {
            if (val && (val === 'list' || val === 'timeline')) {
                setViewMode(val as any);
            }
        });
    }, []);

    useEffect(() => {
        AsyncStorage.setItem('settings_viewMode', viewMode);
    }, [viewMode]);

    // Scroll Restoration
    useEffect(() => {
        if (serverId && allianceId && dashboardScrollY > 0) {
            const timer = setTimeout(() => {
                mainScrollRef.current?.scrollTo({ y: dashboardScrollY, animated: false });
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [serverId, allianceId]);

    // Notice Popup Check
    useEffect(() => {
        const checkNoticePopup = async () => {
            if (auth.isLoggedIn) return;
            if (!notice || !notice.visible || !notice.content) return;

            try {
                const noticeHash = btoa(unescape(encodeURIComponent(notice.content))).substring(0, 20);
                const storageKey = `notice_dismissed_${serverId}_${allianceId}`;
                const dismissedData = await AsyncStorage.getItem(storageKey);

                if (dismissedData) {
                    const parsed = JSON.parse(dismissedData);
                    if (parsed.hash === noticeHash && parsed.permanent) return;
                    if (parsed.hash === noticeHash && parsed.today) {
                        const dismissedDate = new Date(parsed.date);
                        if (dismissedDate.toDateString() === new Date().toDateString()) return;
                    }
                }

                if (auth.isLoggedIn) { // Only show for logged in users? (Re-checking logic from index.tsx)
                    setTimeout(() => setNoticePopupVisible(true), 500);
                }
            } catch (e) { }
        };
        checkNoticePopup();
    }, [notice, serverId, allianceId, auth.isLoggedIn]);

    // --- Helpers ---

    const getEventSchedule = useCallback((event: any) => getEventScheduleUtil(event, schedules), [schedules]);
    const getEventEndDate = useCallback((event: any) => getEventEndDateUtil(event, schedules, now), [schedules, now]);
    const isEventExpiredStatus = useCallback((event: any) => isEventExpired(event, schedules, now), [schedules, now]);
    const getRemainingSeconds = useCallback((str: string, eventId?: string) => getRemainingSecondsUtil(str, now, eventId, schedules), [now, schedules]);
    const getNextResetSeconds = useCallback(() => getNextResetSecondsUtil(now), [now]);
    const checkItemActiveStatus = useCallback((str: string, targetNow: Date, eventId?: string) => checkItemActive(str, targetNow, eventId), []);
    const isVisibleInListStatus = useCallback((event: any) => isVisibleInList(event, schedules, now), [schedules, now]);

    const calculateBearHuntDay = useCallback((event: any, targetTime?: string): string =>
        calculateBearHuntDayUtil(event, schedules, now, targetTime), [schedules, now]);

    const isEventActiveStatus = useCallback((event: any) => isEventActive(
        event, schedules, now,
        (str) => toLocalUtil(str, (s, d) => processConversionUtil(s, d, t, now)),
        (s, n, id) => checkItemActive(s, n, id),
        (e, s, n) => calculateBearHuntDayUtil(e, s, n)
    ), [schedules, now]);

    const formatRemainingTime = useCallback((seconds: number) => formatRemainingTimeUtil(seconds), []);
    const toLocal = useCallback((kstStr: string) => toLocalUtil(kstStr, (str, diff) => processConversionUtil(str, diff, t, now)), [now]);
    const toUTC = useCallback((kstStr: string) => toUTCUtil(kstStr, (str, diff) => processConversionUtil(str, diff, t, now)), [now]);

    // --- Actions ---

    const scrollToSection = useCallback((section: 'active' | 'upcoming' | 'expired') => {
        if (section === 'expired') setIsExpiredExpanded(true);
        const sectionY = sectionPositions.current[section];
        if (sectionY !== undefined && mainScrollRef.current) {
            const offset = 150;
            mainScrollRef.current.scrollTo({
                y: sectionY + containerY - offset,
                animated: true
            });
            setActiveEventTab(section);
        }
    }, [containerY, mainScrollRef]);

    const dismissNoticePopup = async (permanent: boolean = false, today: boolean = false) => {
        setNoticePopupVisible(false);
        setNoticePopupDontShow(false);
        if ((permanent || today) && notice?.content) {
            try {
                const noticeHash = btoa(unescape(encodeURIComponent(notice.content))).substring(0, 20);
                const storageKey = `notice_dismissed_${serverId}_${allianceId}`;
                await AsyncStorage.setItem(storageKey, JSON.stringify({
                    hash: noticeHash, permanent, today, date: new Date().toISOString()
                }));
            } catch (e) { }
        }
    };

    const handleOpenNotice = () => {
        if (notice) {
            setEditNoticeContent(notice.content);
            setEditNoticeVisible(notice.visible);
        }
        setNoticeModalVisible(true);
    };

    const handleSaveNoticeAction = async () => {
        await saveNotice(editNoticeContent, editNoticeVisible);
        setNoticeModalVisible(false);
        showCustomAlert(t('admin.saveNoticeSuccessTitle'), t('admin.saveNoticeSuccessDesc'), 'success');
    };

    const openModalWithHistory = (setter: (v: boolean) => void) => {
        setter(true);
        if (Platform.OS === 'web') {
            window.history.pushState({ modal: true }, '');
        }
    };

    // --- Memoized Data ---

    const displayEvents = useMemo(() => {
        if (!schedules) return [];
        const allBaseEvents = [...INITIAL_WIKI_EVENTS, ...ADDITIONAL_EVENTS];

        const rawList = schedules.map(s => {
            let searchId = getCanonicalEventId(s.eventId);

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
            return isVisibleInListStatus(e);
        });

        const processedList: any[] = [];
        rawList.forEach(e => {
            const isBear = (e.eventId === 'a_bear' || e.eventId === 'alliance_bear' || e.eventId.includes('bear'));
            if (isBear) {
                const parts = (e.time || '').split(/\s*\/\s*/);
                if (parts.length > 0) {
                    parts.forEach((part, idx) => {
                        const trimmed = part.trim();
                        if (!trimmed) return;
                        const colonIdx = trimmed.indexOf(':');
                        const timeMatch = trimmed.match(/\d{1,2}:\d{2}/);
                        const timeIdx = timeMatch ? timeMatch.index : -1;
                        const isLabelColon = colonIdx > -1 && (timeIdx === -1 || colonIdx < timeIdx);

                        const isSingleTeam = parts.length === 1;
                        const rawLabel = isLabelColon ? trimmed.substring(0, colonIdx).trim() : (isSingleTeam ? '' : `${idx + 1}군`);
                        const cleanLabel = rawLabel ? (rawLabel.replace(/곰|팀|군/g, '').trim() + '군') : '';
                        const teamTime = isLabelColon ? trimmed.substring(colonIdx + 1).trim() : trimmed;
                        const dayMatch = teamTime.match(/^([일월화수목금토](?:요일)?)/);
                        const registeredTeamDay = dayMatch ? dayMatch[1] : (e.day || '월');
                        const actualTeamDay = calculateBearHuntDay({ ...e, day: registeredTeamDay }, teamTime);
                        let simplifiedTime = teamTime.split(/[,|]/).map(t => t.replace(/출격|귀환|시작|종료/g, '').trim()).join(', ');
                        if (dayMatch && dayMatch[0] !== actualTeamDay) {
                            simplifiedTime = simplifiedTime.replace(dayMatch[0], actualTeamDay);
                        }
                        processedList.push({
                            ...e,
                            eventId: `${e.eventId}_team${idx + 1}`,
                            originalEventId: e.eventId,
                            title: t('events.alliance_bear_title'),
                            day: (simplifiedTime && simplifiedTime !== '.') ? actualTeamDay : '',
                            time: (simplifiedTime && simplifiedTime !== '.') ? simplifiedTime : '',
                            isBearSplit: true,
                            teamLabel: cleanLabel,
                            teamIcon: '🐻',
                            _teamIdx: idx,
                            // Map team-specific fields
                            isRecurring: idx === 0 ? e.isRecurring : e.isRecurring2,
                            startDate: idx === 0 ? e.startDate : e.startDate2,
                            recurrenceValue: idx === 0 ? e.recurrenceValue : e.recurrenceValue2,
                            recurrenceUnit: idx === 0 ? e.recurrenceUnit : e.recurrenceUnit2,
                        });
                    });
                    if (processedList.filter(pe => pe.originalEventId === e.eventId).length === 0) {
                        processedList.push(e);
                    }
                } else {
                    const actualDay = calculateBearHuntDay(e);
                    const dayMatch = (e.time || '').match(/^([일월화수목금토])/);
                    let updatedTime = e.time || '';
                    if (dayMatch && dayMatch[0] !== actualDay) updatedTime = updatedTime.replace(dayMatch[0], actualDay);
                    processedList.push({ ...e, day: actualDay, time: updatedTime });
                }
            } else if (e.eventId === 'a_foundry' || e.eventId === 'alliance_foundry') {
                const rawTime = e.time || '';
                const parts = rawTime ? rawTime.split(/\s*\/\s*/) : ['', ''];
                if (parts.length > 0) {
                    const numTeams = Math.max(parts.length, 2);
                    for (let idx = 0; idx < numTeams; idx++) {
                        const part = (parts[idx] || '').trim();
                        const colonIdx = part.indexOf(':');
                        const timeMatch = part.match(/\d{1,2}:\d{2}/);
                        const timeIdx = timeMatch ? timeMatch.index : -1;
                        const isLabelColon = colonIdx > -1 && (timeIdx === -1 || colonIdx < timeIdx);

                        const rawLabel = isLabelColon ? part.substring(0, colonIdx).trim() : `${idx + 1}군`;
                        const cleanLabel = rawLabel ? (rawLabel.replace(/팀|군/g, '').trim() + '군') : '';
                        const teamTime = isLabelColon ? part.substring(colonIdx + 1).trim() : part;
                        const simplifiedTime = teamTime.split(/[,|]/).map(t => t.replace(/출격|귀환|시작|종료/g, '').trim()).join(', ');
                        processedList.push({
                            ...e,
                            id: `${e.id}_team${idx + 1}`,
                            originalEventId: e.id,
                            title: t('events.foundry_title'),
                            day: (simplifiedTime && simplifiedTime !== '.') ? e.day : '',
                            time: (simplifiedTime && simplifiedTime !== '.') ? simplifiedTime : '',
                            isFoundrySplit: true,
                            teamLabel: cleanLabel,
                            teamIcon: '🏭',
                            _teamIdx: idx,
                            // Map team-specific fields
                            isRecurring: idx === 0 ? e.isRecurring : e.isRecurring2,
                            startDate: idx === 0 ? e.startDate : e.startDate2,
                            recurrenceValue: idx === 0 ? e.recurrenceValue : e.recurrenceValue2,
                            recurrenceUnit: idx === 0 ? e.recurrenceUnit : e.recurrenceUnit2,
                        });
                    }
                } else {
                    processedList.push(e);
                }
            } else if (e.eventId === 'a_fortress' || e.eventId === 'alliance_fortress') {
                const rawTime = (e.time || '').replace(/\s*\/\s*/g, ', ');
                const parts = rawTime.split(',').map(p => p.trim().replace(/.*(요새전|성채전|Fortress|Citadel)[:\s：]*/, '').trim()).filter(p => p);
                const fortressParts: string[] = [];
                const citadelParts: string[] = [];
                parts.forEach(part => {
                    if (part.includes('성채') || part.toLowerCase().includes('citadel')) citadelParts.push(part);
                    else fortressParts.push(part);
                });
                if (fortressParts.length > 0) {
                    processedList.push({
                        ...e, eventId: `${e.eventId}_fortress`, originalEventId: e.eventId, title: t('events.fortress_battle_title'),
                        day: t('events.fortress'), time: fortressParts.join(', '), isFortressSplit: true
                    });
                }
                if (citadelParts.length > 0) {
                    const citadelInfo = allBaseEvents.find(be => be.id === 'a_citadel');
                    processedList.push({
                        ...e,
                        eventId: `${e.eventId}_citadel`,
                        originalEventId: e.eventId,
                        title: t('events.citadel_battle_title'),
                        imageUrl: citadelInfo?.imageUrl || e.imageUrl,
                        day: t('events.citadel'),
                        time: citadelParts.join(', '),
                        isFortressSplit: true
                    });
                }
                if (fortressParts.length === 0 && citadelParts.length === 0) processedList.push(e);
            } else if (e.eventId === 'alliance_canyon') {
                const rawTime = e.time || '';
                const parts = rawTime ? rawTime.split(/\s*\/\s*/) : ['', ''];
                if (parts.length > 0) {
                    const numTeams = Math.max(parts.length, 2);
                    for (let idx = 0; idx < numTeams; idx++) {
                        const part = (parts[idx] || '').trim();
                        const colonIdx = part.indexOf(':');
                        const timeMatch = part.match(/\d{1,2}:\d{2}/);
                        const timeIdx = timeMatch ? timeMatch.index : -1;
                        const isLabelColon = colonIdx > -1 && (timeIdx === -1 || colonIdx < timeIdx);

                        const rawLabel = isLabelColon ? part.substring(0, colonIdx).trim() : `${idx + 1}군`;
                        const cleanLabel = rawLabel ? (rawLabel.replace(/협곡|전투|팀|군/g, '').trim() + '군') : '';
                        const teamTime = isLabelColon ? part.substring(colonIdx + 1).trim() : part;
                        const simplifiedTime = teamTime.split(/[,|]/).map(t => t.replace(/출격|귀환|시작|종료/g, '').trim()).join(', ');
                        processedList.push({
                            ...e, id: `${e.id}_team${idx + 1}`, originalEventId: e.id, title: t('events.canyon_title'),
                            day: (simplifiedTime && simplifiedTime !== '.') ? e.day : '',
                            time: (simplifiedTime && simplifiedTime !== '.') ? simplifiedTime : '', isCanyonSplit: true, teamLabel: cleanLabel, teamIcon: '⛰️',
                            _teamIdx: idx,
                            // Map team-specific fields
                            isRecurring: idx === 0 ? e.isRecurring : e.isRecurring2,
                            startDate: idx === 0 ? e.startDate : e.startDate2,
                            recurrenceValue: idx === 0 ? e.recurrenceValue : e.recurrenceValue2,
                            recurrenceUnit: idx === 0 ? e.recurrenceUnit : e.recurrenceUnit2,
                        });
                    }
                } else {
                    processedList.push(e);
                }
            } else {
                processedList.push(e);
            }
        });
        return processedList;
    }, [schedules, now, t]);

    return {
        now,
        activeEventTab, setActiveEventTab,
        containerY, setContainerY,
        isActiveExpanded, setIsActiveExpanded,
        isUpcomingExpanded, setIsUpcomingExpanded,
        isExpiredExpanded, setIsExpiredExpanded,
        timezone, setTimezone,
        viewMode, setViewMode,
        fontSize, setFontSize,
        adminMenuVisible, setAdminMenuVisible,
        loginModalVisible, setLoginModalVisible,
        isSuperAdminDashboardVisible, setIsSuperAdminDashboardVisible,
        adminDashboardVisible, setAdminDashboardVisible,
        isUserPassChangeOpen, setIsUserPassChangeOpen,
        noticeDetailVisible, setNoticeDetailVisible,
        noticePopupVisible, setNoticePopupVisible,
        noticeModalVisible, setNoticeModalVisible,
        installModalVisible, setInstallModalVisible,
        isManualVisible, setIsManualVisible,
        qrInviteVisible, setQRInviteVisible,
        newPassword, setNewPassword,
        confirmPassword, setConfirmPassword,
        isChangingPassword, setIsChangingPassword,
        showModalPw, setShowModalPw,
        editNoticeContent, setEditNoticeContent,
        editNoticeVisible, setEditNoticeVisible,
        noticePopupDontShow, setNoticePopupDontShow,
        sectionPositions,
        displayEvents,
        scrollToSection,
        dismissNoticePopup,
        handleOpenNotice,
        handleSaveNoticeAction,
        openModalWithHistory,

        // Export Helpers
        getEventSchedule,
        getEventEndDate,
        isEventExpired: isEventExpiredStatus,
        getRemainingSeconds,
        getNextResetSeconds,
        isEventActive: isEventActiveStatus,
        formatRemainingTime,
        toLocal,
        toUTC,
        isMobile,
        windowWidth
    };
};
