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
    getBundleId as getBundleIdUtil,
    getSortTime as getSortTimeUtil
} from './utils/eventStatus';
import { useDashboard } from './hooks/useDashboard';
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
import { EventCard } from '../components/events/EventCard';
import { SuperAdminModal } from '../components/modals/SuperAdminModal';
import { EventSectionList } from '../components/dashboard/EventSectionList';
import { DashboardCards } from '../components/dashboard/DashboardCards';
import { EventSectionHeader } from '../components/dashboard/EventSectionHeader';
import { QRInviteModal } from '../components/modals/QRInviteModal';


export default function Home() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { auth, login, logout, serverId, allianceId, setAllianceInfo, dashboardScrollY, setDashboardScrollY, mainScrollRef, isGateOpen, setIsGateOpen, showCustomAlert } = useAuth();
    const { theme, setTheme, toggleTheme, toggleTemporaryTheme, fontSizeScale, changeFontSize } = useTheme();
    const { language, changeLanguage } = useLanguage();
    const isDark = theme === 'dark';
    const [isLoading, setIsLoading] = useState(false);

    // -- Firestore Data Hooks --
    const noticeData = useFirestoreNotice(serverId, allianceId);
    const { notice, saveNotice } = noticeData;
    const { themeConfig: globalThemeConfig, saveDefaultMode: saveGlobalTheme } = useFirestoreThemeConfig(null, null);
    const { schedules, loading, clearAllSchedules } = useFirestoreEventSchedules(serverId, allianceId);
    const { dynamicAdmins, addAdmin, removeAdmin } = useFirestoreAdmins(serverId, allianceId);

    const dashboard = useDashboard({
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
    });

    const {
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
        handleSaveNoticeAction: handleSaveNotice,
        openModalWithHistory,
        getEventSchedule,
        getEventEndDate,
        isEventExpired,
        getRemainingSeconds,
        getNextResetSeconds,
        isEventActive,
        formatRemainingTime,
        toLocal,
        toUTC,
        isMobile,
        windowWidth
    } = dashboard;

    // -- Admin Authentication Hook --
    const adminAuth = useAdminAuth({
        auth,
        login,
        logout,
        serverId,
        allianceId,
        setAllianceInfo,
        setIsGateOpen,
        showCustomAlert,
        t,
        onLoginSuccess: () => setLoginModalVisible(false)
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
        pendingCount, setPendingCount,
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
        toggleSelectRequest,
        notificationSettings,
        saveWebhookUrl
    } = adminAuth;

    const pad = (n: number) => padUtil(n);
    const getKoreanDayOfWeek = (date: Date) => getKoreanDayOfWeekUtil(date, t);
    const translateDay = (day: string) => translateDayUtil(day, t);
    const translateLabel = (label: string) => translateLabelUtil(label, t);
    const getBundleId = (ev: any) => getBundleIdUtil(ev);
    const getSortTime = (ev: any) => getSortTimeUtil(ev, now);

    const isSuperAdmin = auth.isLoggedIn && (
        auth.role === 'master' ||
        auth.role === 'super_admin'
    );

    const [newAdminRole, setNewAdminRole] = useState<'admin' | 'alliance_admin'>('admin');
    const [showAdminList, setShowAdminList] = useState(false);
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
        if (isSuperAdmin) {
            const unsubscribe = fetchRequests();
            return () => unsubscribe();
        }
    }, [isSuperAdmin]);

    useEffect(() => {
        if (showAdminList) {
            fetchSuperAdmins();
        }
    }, [showAdminList]);

    // --- Timezone Conversion Helpers ---
    const convertTime = (kstStr: string) => {
        if (!kstStr) return kstStr;
        return timezone === 'LOCAL' ? toLocal(kstStr) : toUTC(kstStr);
    };

    const processConversion = (str: string, diffMinutes: number) => processConversionUtil(str, diffMinutes, t, now);
    const splitSchedulePart = (str: string) => splitSchedulePartUtil(str, t, now);

    // Enable LayoutAnimation for Android
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

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
                const teamMatch = ev.eventId?.match(/_team(\d+)/);
                const teamIdx = teamMatch ? parseInt(teamMatch[1]) - 1 : undefined;
                router.push({
                    pathname: '/growth/events',
                    params: {
                        focusId: ev.eventId, // Use full split ID for precise scrolling
                        viewMode: viewMode,
                        teamIdx: teamIdx !== undefined ? String(teamIdx) : undefined
                    }
                });
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
                style={{ position: 'absolute', width: '100%', height: '100%', opacity: isDark ? 0.45 : 0.12 }}
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
                <DashboardCards
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
                    setQRInviteVisible={setQRInviteVisible}
                    openModalWithHistory={openModalWithHistory}
                    setInputServer={setInputServer}
                    setInputAlliance={setInputAlliance}
                    setIsGateOpen={setIsGateOpen}
                    getNextResetSeconds={getNextResetSeconds}
                    formatRemainingTime={formatRemainingTime}
                    notice={notice}
                    setNoticeDetailVisible={setNoticeDetailVisible}
                    showCustomAlert={showCustomAlert}
                    handleOpenNotice={handleOpenNotice}
                    router={router}
                    pendingCount={pendingCount}
                />

                <EventSectionHeader
                    isDark={isDark}
                    windowWidth={windowWidth}
                    fontSizeScale={fontSizeScale}
                    t={t}
                    timezone={timezone}
                    setTimezone={setTimezone}
                    viewMode={viewMode}
                    setViewMode={setViewMode}
                    isMobile={isMobile}
                    displayEvents={displayEvents}
                    isEventActive={isEventActive}
                    isEventExpired={isEventExpired}
                    activeEventTab={activeEventTab}
                    scrollToSection={scrollToSection}
                />

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
                <View className="mt-12 mb-10 items-center">
                    {/* Thin Subtle Divider */}
                    <View className={`w-[85%] h-[1px] mb-5 ${isDark ? 'bg-slate-800/50' : 'bg-slate-200/80'}`} />

                    <View className="items-center px-8">
                        <Text className={`text-[9px] font-black tracking-[0.2em] uppercase text-center ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                            © 2026 WOS Studio  —  Designed by SSJ
                        </Text>
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
                pendingCount={pendingCount}
            />

            <QRInviteModal
                isVisible={qrInviteVisible}
                onClose={() => setQRInviteVisible(false)}
                isDark={isDark}
                isMobile={isMobile}
                serverId={serverId}
                allianceId={allianceId}
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
                notificationSettings={notificationSettings}
                saveWebhookUrl={saveWebhookUrl}
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
