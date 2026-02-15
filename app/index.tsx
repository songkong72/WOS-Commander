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
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import { useAuth, useTheme, useLanguage } from './context';
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
import { doc, setDoc, getDoc, collection, getDocs, query, writeBatch, updateDoc, onSnapshot, orderBy, where, deleteDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import AdminManagement from '../components/AdminManagement';
import TimelineView from '../components/TimelineView';

export default function Home() {
    const router = useRouter();
    const { t } = useTranslation();
    const params = useLocalSearchParams();
    const { auth, login, logout, serverId, allianceId, setAllianceInfo, dashboardScrollY, setDashboardScrollY, mainScrollRef, isGateOpen, setIsGateOpen } = useAuth();
    const { theme, toggleTheme, fontSizeScale, changeFontSize } = useTheme();
    const { language, changeLanguage } = useLanguage();
    const isDark = theme === 'dark';
    const [isLoading, setIsLoading] = useState(false);
    const sectionPositions = useRef<{ [key: string]: number }>({});
    const [activeEventTab, setActiveEventTab] = useState<'active' | 'upcoming' | 'expired'>('active');
    const [containerY, setContainerY] = useState(0);
    const [isExpiredExpanded, setIsExpiredExpanded] = useState(false);

    const scrollToSection = (section: 'active' | 'upcoming' | 'expired') => {
        if (section === 'expired') setIsExpiredExpanded(true);
        const sectionY = sectionPositions.current[section] || 0;
        const targetY = containerY + sectionY;
        setActiveEventTab(section); // 탭 강조 상태 유지
        mainScrollRef.current?.scrollTo({ y: targetY - 250, animated: true });
    };
    const [inputServer, setInputServer] = useState('');
    const [inputAlliance, setInputAlliance] = useState('');
    const [inputUserId, setInputUserId] = useState('');
    const [inputPassword, setInputPassword] = useState('');
    const [isRegisterMode, setIsRegisterMode] = useState(false);

    const gateUserIdRef = useRef<TextInput>(null);
    const gatePasswordRef = useRef<TextInput>(null);
    const loginPasswordRef = useRef<TextInput>(null);

    const noticeData = useFirestoreNotice(serverId, allianceId);
    const { notice, saveNotice } = noticeData;
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
    const [loginInput, setLoginInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isSuperAdminDashboardVisible, setIsSuperAdminDashboardVisible] = useState(false);
    const [superAdminTab, setSuperAdminTab] = useState<'pending' | 'alliances'>('pending');
    const [allRequests, setAllRequests] = useState<any[]>([]);
    const [isSuperAdminLoading, setIsSuperAdminLoading] = useState(true);
    const [adminDashboardVisible, setAdminDashboardVisible] = useState(false);
    const [selectedReqIds, setSelectedReqIds] = useState<Set<string>>(new Set());

    const [recentServers, setRecentServers] = useState<string[]>([]);
    const [recentAlliances, setRecentAlliances] = useState<string[]>([]);
    const [recentUserIds, setRecentUserIds] = useState<string[]>([]);
    const [activeInput, setActiveInput] = useState<'server' | 'alliance' | 'userid' | 'password' | null>(null);
    const [adminMenuHover, setAdminMenuHover] = useState<string | null>(null);
    const [isUserPassChangeOpen, setIsUserPassChangeOpen] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isChangingPassword, setIsChangingPassword] = useState(false);
    const [showGatePw, setShowGatePw] = useState(false);
    const [showModalPw, setShowModalPw] = useState(false);
    const [showPass1, setShowPass1] = useState(false);
    const [showPass2, setShowPass2] = useState(false);

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
    const [timezone, setTimezone] = useState<'LOCAL' | 'UTC'>('LOCAL');
    const [viewMode, setViewMode] = useState<'list' | 'timeline'>('timeline');
    const [isManualVisible, setIsManualVisible] = useState(false);
    const [isGateManualVisible, setIsGateManualVisible] = useState(false);

    // -- Global Back Button & History Handling for Modals (Web Fix) --
    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const handlePopState = () => {
            setIsManualVisible(false);
            setIsGateManualVisible(false);
            setAdminMenuVisible(false);
            setNoticeDetailVisible(false);
            setAdminDashboardVisible(false);
            setIsSuperAdminDashboardVisible(false);
            setIsUserPassChangeOpen(false);
            setNoticePopupVisible(false);
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [isManualVisible, isGateManualVisible, adminMenuVisible, noticeDetailVisible, adminDashboardVisible,
        isSuperAdminDashboardVisible, isUserPassChangeOpen, noticePopupVisible]);

    const openModalWithHistory = (setter: (v: boolean) => void) => {
        setter(true);
        if (Platform.OS === 'web') {
            window.history.pushState({ modal: true }, '');
        }
    };

    const renderGateManualContent = () => (
        <ScrollView className="flex-1 px-10 pt-10" showsVerticalScrollIndicator={false}>
            <View className="gap-12 pb-4">
                {/* 1. Gate 화면 개요 */}
                <View>
                    <View className="flex-row items-center mb-6">
                        <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-sky-500/20' : 'bg-sky-50'}`}>
                            <Text className="text-lg">🚪</Text>
                        </View>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.gateTitle')}</Text>
                    </View>
                    <Text className={`text-base mb-4 leading-7 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('manual.gateDesc')}</Text>
                    <View className="flex-row rounded-2xl overflow-hidden border border-sky-500/30 mb-4">
                        <View className="flex-1 p-3 bg-sky-500/20 items-center"><Text className="text-[10px] font-black text-sky-400">{t('manual.enterDashboard')}</Text></View>
                        <View className="flex-1 p-3 bg-slate-800/50 items-center"><Text className="text-[10px] font-black text-slate-500">{t('manual.applyAdmin')}</Text></View>
                    </View>
                    <View className="gap-2">
                        <Text className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>• {t('manual.enterDashboard')}: {t('manual.enterDashboardDesc')}</Text>
                        <Text className={`text-sm ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>• {t('manual.applyAdmin')}: {t('manual.applyAdminDesc')}</Text>
                    </View>
                </View>

                {/* 2. 대시보드 입장 (로그인) */}
                <View>
                    <View className="flex-row items-center mb-6">
                        <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-50'}`}>
                            <Text className="text-lg">🔓</Text>
                        </View>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.loginTitle')}</Text>
                    </View>
                    <View className="gap-4">
                        <View className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <Text className={`text-base font-black mb-4 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>📝 {t('manual.inputGuide')}</Text>
                            <View className="gap-4">
                                <View>
                                    <Text className={`text-sm font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('manual.serverNum')}</Text>
                                    <Text className="text-sm text-slate-500">{t('manual.serverNumDesc')}</Text>
                                </View>
                                <View>
                                    <Text className={`text-sm font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('manual.allianceAbbr')}</Text>
                                    <Text className="text-sm text-slate-500">{t('manual.allianceAbbrDesc')}</Text>
                                </View>
                                <View>
                                    <Text className={`text-sm font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('manual.lordName')}</Text>
                                    <Text className="text-sm text-slate-500">{t('manual.lordNameDesc')}</Text>
                                </View>
                                <View>
                                    <Text className={`text-sm font-bold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('auth.password')}</Text>
                                    <Text className="text-sm text-slate-500">{t('manual.passwordDesc')}</Text>
                                </View>
                            </View>
                        </View>
                        <View className={`p-5 rounded-2xl ${isDark ? 'bg-sky-500/10' : 'bg-sky-50'}`}>
                            <Text className={`text-sm leading-6 ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>💡 {t('manual.autoComplete')}</Text>
                        </View>
                    </View>
                </View>

                {/* 3. 역할(권한) 체계 */}
                <View>
                    <View className="flex-row items-center mb-6">
                        <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-rose-500/20' : 'bg-rose-50'}`}>
                            <Text className="text-lg">👥</Text>
                        </View>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.roleSystem')}</Text>
                    </View>
                    <View className="gap-4">
                        {[
                            { label: `🔴 ${t('manual.sysMaster')}`, color: '#fb7185', desc: t('manual.sysMasterDesc') },
                            { label: `🔵 ${t('admin.allianceAdmin')}`, color: '#818cf8', desc: t('manual.allianceAdminDesc') },
                            { label: `🟢 ${t('admin.opAdmin')}`, color: '#22d3ee', desc: t('manual.opAdminDesc') },
                            { label: `⚪ ${t('manual.generalLord')}`, color: '#94a3b8', desc: t('manual.generalLordDesc') }
                        ].map((role) => (
                            <View key={role.label} className={`p-5 rounded-3xl border ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                <Text style={{ color: role.color }} className="font-black text-lg mb-1">{role.label}</Text>
                                <Text className={`text-base leading-6 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{role.desc}</Text>
                            </View>
                        ))}
                    </View>
                    <View className={`mt-4 p-5 rounded-2xl ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}>
                        <Text className={`text-sm leading-6 ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>⚠️ {t('manual.roleWarning')}</Text>
                    </View>
                </View>

                {/* 4. 연맹 관리자 신청 */}
                <View>
                    <View className="flex-row items-center mb-6">
                        <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                            <Text className="text-lg">📋</Text>
                        </View>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.adminApplyTitle')}</Text>
                    </View>
                    <View className="gap-4">
                        <View className="flex-row items-center justify-between px-4">
                            {(t('manual.adminApplySteps', { returnObjects: true }) as string[]).map((step, idx) => (
                                <View key={step} className="items-center">
                                    <View className={`w-8 h-8 rounded-full items-center justify-center mb-1 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
                                        <Text className="text-[10px] font-black text-indigo-400">{idx + 1}</Text>
                                    </View>
                                    <Text className="text-[9px] font-black text-slate-500">{step}</Text>
                                </View>
                            ))}
                        </View>
                        <View className={`p-5 rounded-2xl ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                            <Text className={`text-sm leading-6 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>⏳ {t('manual.adminApplyWait')}</Text>
                        </View>
                    </View>
                </View>

                {/* 5. 방문자 접속 및 기타 */}
                <View>
                    <View className="flex-row items-center mb-6">
                        <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-slate-500/20' : 'bg-slate-50'}`}>
                            <Text className="text-lg">🛠️</Text>
                        </View>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.toolsAndEtc')}</Text>
                    </View>
                    <View className="gap-4">
                        <View className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <Text className={`text-base leading-7 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                • <Text className={`font-black ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{t('manual.anonymousLogin')}:</Text> {t('manual.anonymousLoginDesc')}{"\n"}
                                • <Text className={`font-black ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{t('manual.themeFont')}:</Text> {t('manual.themeFontDesc')}{"\n"}
                                • <Text className={`font-black ${isDark ? 'text-rose-400' : 'text-rose-600'}`}>{t('manual.penalty')}:</Text> {t('manual.penaltyDesc')}{"\n"}
                                • <Text className={`font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{t('manual.pwaInstall')}:</Text> {t('manual.pwaInstallDesc')}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* FAQ */}
                <View>
                    <View className="flex-row items-center mb-6">
                        <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
                            <Text className="text-lg">❓</Text>
                        </View>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.faq')}</Text>
                    </View>
                    <View className="gap-6">
                        <View>
                            <Text className={`text-base font-black mb-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Q. {t('manual.qPw')}</Text>
                            <Text className={`text-sm leading-6 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>A. {t('manual.aPw')}</Text>
                        </View>
                        <View>
                            <Text className={`text-base font-black mb-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>Q. {t('manual.qUnreg')}</Text>
                            <Text className={`text-sm leading-6 ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>A. {t('manual.aUnreg')}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </ScrollView>
    );

    const renderMainManualContent = () => (
        <ScrollView className="flex-1 px-10 pt-10" showsVerticalScrollIndicator={false}>
            <View className="gap-12 pb-4">
                {/* 1. 권한 관리 시스템 */}
                <View>
                    <View className="flex-row items-center mb-6">
                        <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-rose-500/20' : 'bg-rose-50'}`}>
                            <Text className="text-lg">🔐</Text>
                        </View>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.roleMgmtSystem')}</Text>
                    </View>
                    <View className="gap-4">
                        {[
                            { label: `🔴 ${t('admin.superAdmin')}`, color: '#fb7185', desc: t('manual.roleMasterDesc') },
                            { label: `🔵 ${t('admin.allianceAdmin')}`, color: '#818cf8', desc: t('manual.roleAllianceAdminDesc') },
                            { label: `🟢 ${t('admin.opAdmin')}`, color: '#22d3ee', desc: t('manual.roleOpAdminDesc') },
                            { label: `⚪ ${t('manual.generalLord')}`, color: '#94a3b8', desc: t('manual.roleGeneralDesc') }
                        ].map((role) => (
                            <View key={role.label} className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                <Text style={{ color: role.color }} className="font-black text-lg mb-1">{role.label}</Text>
                                <Text className={`text-base leading-7 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{role.desc}</Text>
                            </View>
                        ))}
                    </View>
                    <View className={`mt-4 p-5 rounded-2xl ${isDark ? 'bg-sky-500/10' : 'bg-sky-50'}`}>
                        <Text className={`text-sm leading-6 ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>💡 {t('manual.roleTip')}</Text>
                    </View>
                </View>

                {/* 2. 헤더 버튼 가이드 */}
                <View>
                    <View className="flex-row items-center mb-6">
                        <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
                            <Text className="text-lg">🔘</Text>
                        </View>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.headerBtnGuide')}</Text>
                    </View>
                    <View className="gap-4">
                        <View className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <Text className={`text-lg font-black mb-2 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>☀️ {t('manual.themeSwitch')}</Text>
                            <Text className={`text-base leading-7 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('manual.themeSwitchDesc')}</Text>
                        </View>
                        <View className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <Text className={`text-lg font-black mb-2 ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>📥 {t('manual.installBtn')}</Text>
                            <Text className={`text-base leading-7 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('manual.installBtnDesc')}</Text>
                        </View>
                        <View className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <Text className={`text-lg font-black mb-2 ${isDark ? 'text-sky-400' : 'text-sky-700'}`}>👤 {t('manual.profileAdmin')}</Text>
                            <Text className={`text-base leading-7 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('manual.profileAdminDesc')}</Text>
                        </View>
                    </View>
                </View>

                {/* 3. 공지 및 일정 관리 */}
                <View>
                    <View className="flex-row items-center mb-6">
                        <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
                            <Text className="text-lg">🔔</Text>
                        </View>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.noticeSchedule')}</Text>
                    </View>
                    <View className="gap-4">
                        <View className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <Text className={`text-xl font-black mb-2 ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>{t('dashboard.notice')}</Text>
                            <Text className={`text-base leading-7 mb-3 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('manual.noticeDesc')}</Text>
                        </View>
                        <View className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <Text className={`text-xl font-black mb-2 ${isDark ? 'text-cyan-400' : 'text-cyan-700'}`}>{t('dashboard.weeklyEvents')}</Text>
                            <Text className={`text-base leading-7 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('manual.weeklyEventsDesc')}</Text>
                        </View>
                    </View>
                </View>

                {/* 4. 주요 메뉴 안내 */}
                <View>
                    <View className="flex-row items-center mb-6">
                        <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-50'}`}>
                            <Text className="text-lg">📋</Text>
                        </View>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.mainMenuGuide')}</Text>
                    </View>
                    <View className="gap-6">
                        <View>
                            <Text className={`text-lg font-black mb-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>👥 {t('manual.heroInfo')}</Text>
                            <Text className={`text-base leading-7 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('manual.heroInfoDesc')}</Text>
                        </View>
                        <View>
                            <Text className={`text-lg font-black mb-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>📅 {t('manual.eventOps')}</Text>
                            <Text className={`text-base leading-7 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('manual.eventOpsDesc')}</Text>
                        </View>
                        <View>
                            <Text className={`text-lg font-black mb-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>🗺️ {t('manual.strategyDocs')}</Text>
                            <Text className={`text-base leading-7 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('manual.strategyDocsDesc')}</Text>
                        </View>
                    </View>
                </View>

                {/* 5. 관리자 교육 */}
                <View>
                    <View className="flex-row items-center mb-6">
                        <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                            <Text className="text-lg">⚙️</Text>
                        </View>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.adminGuide')}</Text>
                    </View>
                    <View className="gap-4">
                        <View className={`p-5 rounded-3xl border ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <Text className={`text-base leading-8 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                                • <Text className={`font-black ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{t('admin.memberManagement')}:</Text> {t('manual.memberMgmtDesc')}{"\n"}
                                • <Text className={`font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>{t('admin.strategyManagement')}:</Text> {t('manual.strategySetDesc')}{"\n"}
                                • <Text className={`font-black ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{t('admin.eventManagement')}:</Text> {t('manual.scheduleSetDesc')}
                            </Text>
                        </View>
                        <View className={`p-5 rounded-2xl ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}>
                            <Text className={`text-sm leading-6 ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>⚠️ {t('manual.adminWarning')}</Text>
                        </View>
                    </View>
                </View>
            </View>
        </ScrollView>
    );

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

    const toggleSelectRequest = (id: string) => {
        setSelectedReqIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleApproveRequest = async (req: any) => {
        showCustomAlert(
            t('admin.approveAlliance'),
            t('admin.approveConfirm', { server: req.serverId, alliance: req.allianceName }),
            'confirm',
            async () => {
                try {
                    const userRef = doc(db, 'users', req.adminId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        showCustomAlert(t('common.error_title'), t('admin.idExists'), 'error');
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
                        contact: req.contact || '',
                        createdAt: Date.now()
                    });
                    const reqRef = doc(db, 'alliance_requests', req.id);
                    await updateDoc(reqRef, { status: 'approved' });
                    showCustomAlert(t('common.success'), t('admin.approveSuccess'), 'success');
                } catch (error: any) {
                    showCustomAlert(t('common.error_title'), error.message, 'error');
                }
            }
        );
    };

    const handleBulkApprove = async () => {
        if (selectedReqIds.size === 0) return;

        showCustomAlert(
            t('admin.bulkApprove'),
            t('admin.bulkApproveConfirm', { count: selectedReqIds.size }),
            'confirm',
            async () => {
                try {
                    const batch = writeBatch(db);
                    const selectedReqs = allRequests.filter(r => selectedReqIds.has(r.id));

                    for (const req of selectedReqs) {
                        // Create User
                        const userRef = doc(db, 'users', req.adminId);
                        batch.set(userRef, {
                            uid: `admin_${req.serverId.replace('#', '')}_${req.allianceId}`,
                            username: req.adminId,
                            password: req.adminPassword,
                            nickname: `${req.allianceId} 관리자`,
                            role: 'alliance_admin',
                            status: 'active',
                            serverId: req.serverId,
                            allianceId: req.allianceId,
                            contact: req.contact || '',
                            createdAt: Date.now()
                        });

                        // Update Request Status
                        const reqRef = doc(db, 'alliance_requests', req.id);
                        batch.update(reqRef, { status: 'approved' });
                    }

                    await batch.commit();
                    setSelectedReqIds(new Set());
                    showCustomAlert(t('common.success'), t('admin.bulkApproveSuccess'), 'success');
                } catch (error: any) {
                    showCustomAlert(t('common.error_title'), t('admin.bulkApproveError', { error: error.message }), 'error');
                }
            }
        );
    };

    const handleResetPasswordAdmin = async (req: any) => {
        setCustomAlert({
            visible: true,
            title: t('admin.resetPassword'),
            message: t('admin.resetPwConfirm', { id: req.adminId }),
            type: 'confirm',
            onConfirm: async () => {
                try {
                    const hashed = await hashPassword('1234');
                    await updateDoc(doc(db, "users", req.adminId), {
                        password: hashed
                    });
                    showCustomAlert(t('common.success'), t('admin.resetPwSuccess'), 'success');
                } catch (e) {
                    console.error(e);
                    showCustomAlert(t('common.error_title'), t('admin.resetPwError'), 'error');
                }
            }
        });
    };

    const handleDeleteAlliance = async (req: any) => {
        setCustomAlert({
            visible: true,
            title: t('admin.deleteAlliance'),
            message: t('admin.deleteAllianceConfirm', { id: req.allianceId }),
            type: 'confirm',
            onConfirm: async () => {
                try {
                    // 1. Delete user account
                    await deleteDoc(doc(db, "users", req.adminId));
                    // 2. Delete alliance request (approved record)
                    await deleteDoc(doc(db, "alliance_requests", req.id));
                    showCustomAlert(t('common.success'), t('admin.deleteAllianceSuccess'), 'success');
                } catch (e: any) {
                    console.error(e);
                    showCustomAlert(t('common.error_title'), t('admin.deleteAllianceError'), 'error');
                }
            }
        });
    };

    const handleRejectRequest = async (req: any) => {
        showCustomAlert(
            t('admin.rejectAlliance'),
            t('admin.rejectConfirm', { server: req.serverId, alliance: req.allianceName }),
            'confirm',
            async () => {
                try {
                    const reqRef = doc(db, 'alliance_requests', req.id);
                    await updateDoc(reqRef, { status: 'rejected' });
                    showCustomAlert(t('common.success'), t('admin.rejectSuccess'), 'success');
                } catch (error: any) {
                    showCustomAlert(t('common.error_title'), error.message, 'error');
                }
            }
        );
    };

    const handleBulkReject = async () => {
        if (selectedReqIds.size === 0) return;

        showCustomAlert(
            t('admin.bulkReject'),
            t('admin.bulkRejectConfirm', { count: selectedReqIds.size }),
            'confirm',
            async () => {
                try {
                    const batch = writeBatch(db);
                    selectedReqIds.forEach(id => {
                        const reqRef = doc(db, 'alliance_requests', id);
                        batch.update(reqRef, { status: 'rejected' });
                    });
                    await batch.commit();
                    setSelectedReqIds(new Set());
                    showCustomAlert(t('common.success'), t('admin.bulkRejectSuccess'), 'success');
                } catch (error: any) {
                    showCustomAlert('오류', '선택 거절 중 오류가 발생했습니다: ' + error.message, 'error');
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

                if (rServers) {
                    const parsed = JSON.parse(rServers);
                    setRecentServers(parsed);
                    if (parsed.length > 0) setInputServer(parsed[0]);
                }
                if (rAlliances) {
                    const parsed = JSON.parse(rAlliances);
                    setRecentAlliances(parsed);
                    if (parsed.length > 0) setInputAlliance(parsed[0]);
                }
                if (rUsers) {
                    const parsed = JSON.parse(rUsers);
                    setRecentUserIds(parsed);
                    if (parsed.length > 0) setInputUserId(parsed[0]);
                }
                if (savedAdminId) setLoginInput(savedAdminId);
            } catch (e) {
                console.error('Failed to load history:', e);
            }
        };
        loadHistory();
    }, []);

    const handleResetSettings = async () => {
        showCustomAlert(t('manual.resetInfo'), t('manual.resetInfoConfirm'), 'confirm', async () => {
            try {
                await AsyncStorage.multiRemove(['lastAdminId', 'lastAdminRole', 'recent_server', 'recent_alliance', 'recent_userid']);
                setInputServer('');
                setInputAlliance('');
                setInputUserId('');
                setInputPassword('');
                setAllianceInfo(null, null);
                setIsGateOpen(true);
                showCustomAlert(t('common.success'), t('manual.resetInfoSuccess'), 'success');
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

        setGateLoginError(null);
        setIsLoginLoading(true);

        // Simulate network delay for smooth UX
        await new Promise(resolve => setTimeout(resolve, 600));

        if (isRegisterMode) {
            if (!forceServer || !forceAlliance) {
                setGateLoginError(t('manual.gateLoginAndApply'));
                setIsLoginLoading(false);
                return;
            }
            if (!inputId || !inputPw) {
                setGateLoginError(t('manual.requireAdminAuth'));
                setIsLoginLoading(false);
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

                showCustomAlert(t('manual.applySuccess'), t('manual.applySuccessDesc'), 'success');
                setIsRegisterMode(false); // Switch back to login mode
            } catch (error: any) {
                setGateLoginError(t('manual.applyError') + ': ' + error.message);
            }
            setIsLoginLoading(false);
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
                            setIsLoginLoading(false);
                            return;
                        } else {
                            setGateLoginError(t('manual.masterPwError'));
                            setIsLoginLoading(false);
                            return;
                        }
                    }

                    // For non-master users, Server/Alliance are required
                    if (!forceServer || !forceAlliance) {
                        setGateLoginError(t('manual.requireAllFields'));
                        setIsLoginLoading(false);
                        return;
                    }

                    // 2. Global Users Check (New system: master, super_admin, alliance_admin)
                    let globalUserData = null;
                    let globalUserId = inputId;
                    const userRef = doc(db, "users", inputId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        globalUserData = userSnap.data();
                    } else {
                        // Search by username or nickname if no direct ID match
                        const qUsers = query(collection(db, "users"), where("username", "==", inputId));
                        const qUsersSnap = await getDocs(qUsers);
                        if (!qUsersSnap.empty) {
                            globalUserData = qUsersSnap.docs[0].data();
                            globalUserId = qUsersSnap.docs[0].id;
                        } else {
                            const qNick = query(collection(db, "users"), where("nickname", "==", inputId));
                            const qNickSnap = await getDocs(qNick);
                            if (!qNickSnap.empty) {
                                globalUserData = qNickSnap.docs[0].data();
                                globalUserId = qNickSnap.docs[0].id;
                            }
                        }
                    }

                    if (globalUserData) {
                        const userData = globalUserData;
                        const storedPw = userData.password?.toString();

                        if (storedPw === hashed || storedPw === inputPw) {
                            const finalServer = (userData.role === 'master' || userData.role === 'super_admin')
                                ? (forceServer || '#000')
                                : userData.serverId;
                            const finalAlliance = (userData.role === 'master' || userData.role === 'super_admin')
                                ? (forceAlliance || 'SYSTEM')
                                : userData.allianceId;

                            console.log(`[Gate Login] Auth Success. Switching to Server: ${finalServer}, Alliance: ${finalAlliance}`);

                            if (finalServer && finalAlliance) {
                                setAllianceInfo(finalServer, finalAlliance);
                                await saveToHistory('server', finalServer);
                                await saveToHistory('alliance', finalAlliance);
                                await saveToHistory('userid', inputId);
                                await login(globalUserId, userData.role || 'user');
                                setIsGateOpen(false);
                                setIsLoginLoading(false);
                                return;
                            }
                        } else {
                            console.log(`[Gate Login] PW Mismatch. Input: ${inputPw}, Hashed: ${hashed}`);
                            setGateLoginError(t('auth.pwMismatchRetry'));
                            setIsLoginLoading(false);
                            return;
                        }
                    }

                    // 3. Legacy Alliance Admin / Operation Admin Check (Sub-collection)
                    let adminData = null;
                    let finalAdminId = inputId;
                    const adminRef = doc(db, "servers", forceServer, "alliances", forceAlliance, "admins", inputId);
                    const adminSnap = await getDoc(adminRef);
                    if (adminSnap.exists()) {
                        adminData = adminSnap.data();
                    } else {
                        // Search by name if no direct ID match
                        const qAdmin = query(
                            collection(db, "servers", forceServer, "alliances", forceAlliance, "admins"),
                            where("name", "==", inputId)
                        );
                        const qAdminSnap = await getDocs(qAdmin);
                        if (!qAdminSnap.empty) {
                            adminData = qAdminSnap.docs[0].data();
                            finalAdminId = qAdminSnap.docs[0].id;
                        }
                    }

                    if (adminData) {
                        const storedPw = adminData.password?.toString();
                        if (storedPw === hashed || storedPw === inputPw) {
                            setAllianceInfo(forceServer, forceAlliance);

                            await saveToHistory('server', forceServer);
                            await saveToHistory('alliance', forceAlliance);
                            await saveToHistory('userid', inputId);

                            await login(finalAdminId, adminData.role || 'admin');
                            setIsGateOpen(false);
                            setIsLoginLoading(false);
                            return;
                        } else {
                            setGateLoginError(t('auth.passwordMismatch'));
                            setIsLoginLoading(false);
                            return;
                        }
                    }

                    // 3. General Member Check (Check by ID or Nickname)
                    let memberData = null;
                    let finalMemberId = inputId;

                    const memberRef = doc(db, "servers", forceServer, "alliances", forceAlliance, "members", inputId);
                    const memberSnap = await getDoc(memberRef);
                    if (memberSnap.exists()) {
                        memberData = memberSnap.data();
                    } else {
                        // If ID not found, search by nickname in the alliance members
                        const q = query(
                            collection(db, "servers", forceServer, "alliances", forceAlliance, "members"),
                            where("nickname", "==", inputId)
                        );
                        const qSnap = await getDocs(q);
                        if (!qSnap.empty) {
                            memberData = qSnap.docs[0].data();
                            finalMemberId = qSnap.docs[0].id;
                        }
                    }

                    if (memberData) {
                        const storedPw = memberData.password?.toString();
                        if (storedPw === inputPw || storedPw === hashed) {
                            setAllianceInfo(forceServer, forceAlliance);

                            await saveToHistory('server', forceServer);
                            await saveToHistory('alliance', forceAlliance);
                            await saveToHistory('userid', inputId);

                            await login(finalMemberId, 'user');
                            setIsGateOpen(false);
                            setIsLoginLoading(false);
                            return;
                        } else {
                            setGateLoginError(t('auth.passwordMismatch'));
                            setIsLoginLoading(false);
                            return;
                        }
                    }

                    setGateLoginError(t('auth.userNotFound'));
                    setIsLoginLoading(false);
                } catch (e) {
                    console.error('Auth error:', e);
                    setGateLoginError(t('auth.authError'));
                    setIsLoginLoading(false);
                }
            } else {
                // No ID/PW provided - requires server/alliance for anonymous entry
                if (inputId) {
                    setGateLoginError(t('auth.onlyIdError'));
                    setIsLoginLoading(false);
                    return;
                }
                if (!forceServer || !forceAlliance) {
                    setGateLoginError(t('auth.requireServerAlliance'));
                    setIsLoginLoading(false);
                    return;
                }
                setAllianceInfo(forceServer, forceAlliance);

                await saveToHistory('server', forceServer);
                await saveToHistory('alliance', forceAlliance);

                setIsGateOpen(false);
                setIsLoginLoading(false);
            }
        }
    };

    const [now, setNow] = useState(new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const getEventSchedule = (event: any) => {
        if (!event) return null;
        const id = (event.id || event.eventId || '').trim();
        return schedules.find(s => {
            const sid = (s.eventId || '').trim();
            if (sid === id) return true;

            const mappings: { [key: string]: string[] } = {
                'a_joe': ['alliance_joe'],
                'alliance_joe': ['a_joe'],
                'a_bear': ['alliance_bear', 'alliance_bear_title'],
                'alliance_bear': ['a_bear'],
                'a_weapon': ['alliance_frost_league'],
                'alliance_frost_league': ['a_weapon'],
                'a_operation': ['alliance_operation'],
                'alliance_operation': ['a_operation'],
                'a_mobilization': ['alliance_mobilization'],
                'alliance_mobilization': ['a_mobilization', 'a_total'],
                'a_total': ['alliance_mobilization'],
                'a_foundry': ['alliance_foundry'],
                'alliance_foundry': ['a_foundry'],
                'a_fortress': ['alliance_fortress'],
                'alliance_fortress': ['a_fortress'],
                'a_citadel': ['alliance_citadel'],
                'alliance_citadel': ['a_citadel'],
                'a_canyon': ['alliance_canyon'],
                'alliance_canyon': ['a_canyon']
            };

            return mappings[id]?.includes(sid) || mappings[sid]?.includes(id);
        });
    };

    const getEventEndDate = (event: any) => {
        try {
            const schedule = getEventSchedule(event);

            // 0. Check startDate first (for one-time weekly events)
            const startDate = schedule?.startDate || event.startDate;
            if (startDate) {
                try {
                    const timeStr = schedule?.time || event.time || '00:00';
                    // Extract first time if multiple slots (e.g., "1군: 화(22:30) / 2군: 목(21:00)")
                    const timeMatch = timeStr.match(/(\d{2}):(\d{2})/);
                    const finalTime = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '00:00';
                    const dateTimeStr = `${startDate}T${finalTime}:00`;
                    const eventDateTime = new Date(dateTimeStr);
                    if (!isNaN(eventDateTime.getTime())) {
                        // Add 1 hour buffer
                        return new Date(eventDateTime.getTime() + 3600000);
                    }
                } catch (e) { }
            }

            const dayStr = schedule?.day || event.day || '';
            const timeStr = schedule?.time || event.time || '';
            const combined = `${dayStr} ${timeStr} `;

            // 1. Date Range Match (Improved regex for various separators and optional day info)
            // Expected: YYYY.MM.DD (Day) HH:mm ~ YYYY.MM.DD (Day) HH:mm or YYYY-MM-DD ...
            const rangeMatch = combined.match(/(\d{4}[\.-]\d{2}[\.-]\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})?\s*~\s*(\d{4}[\.-]\d{2}[\.-]\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})?/);
            if (rangeMatch) {
                const endDatePart = rangeMatch[3].replace(/\./g, '-');
                const endTimePart = rangeMatch[4] || '23:59';
                const end = new Date(`${endDatePart}T${endTimePart}:00`);
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

    const checkWeeklyExpired = (str: string) => {
        if (!str || str.includes('상시') || str.includes('상설')) return false;
        // 월요일~일요일이 한 주 (월요일 00:00 리셋)
        const dayMapObj: { [key: string]: number } = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
        // JavaScript getDay()는 일요일=0이므로 월요일=0으로 변환
        const currentDay = (now.getDay() + 6) % 7; // 월(0), 화(1), 수(2), 목(3), 금(4), 토(5), 일(6)
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Points
        const explicitMatches = Array.from(str.matchAll(/([일월화수목금토]|[매일])\s*\(?(\d{1,2}):(\d{2})\)?/g));
        if (explicitMatches.length > 0) {
            return explicitMatches.every(m => {
                const dayStr = m[1];
                const h = parseInt(m[2]);
                const min = parseInt(m[3]);
                const scheduledDays = (dayStr === '매일') ? ['일', '월', '화', '수', '목', '금', '토'] : [dayStr];
                return scheduledDays.every(d => {
                    const dayIdx = dayMapObj[d];
                    if (dayIdx === undefined) return true;
                    if (currentDay > dayIdx) return true;
                    if (currentDay === dayIdx) return currentMinutes >= (h * 60 + min + 30);
                    return false;
                });
            });
        }

        // Weekly Range
        const weeklyMatch = str.match(/([일월화수목금토])\s*(\d{2}):(\d{2})\s*~\s*([일월화수목금토])\s*(\d{2}):(\d{2})/);
        if (weeklyMatch) {
            const endDayIdx = dayMapObj[weeklyMatch[4]];
            const endH = parseInt(weeklyMatch[5]);
            const endMin = parseInt(weeklyMatch[6]);
            if (currentDay > endDayIdx) return true;
            if (currentDay === endDayIdx) return currentMinutes >= (endH * 60 + endMin);
            return false;
        }

        return false;
    };

    const isEventExpired = (event: any) => {
        // originalEventId를 우선 사용 (분할된 이벤트의 경우)
        const originalId = (event.originalEventId || '').trim();
        const id = (originalId || event.id || event.eventId || '').trim();

        // 곰 사냥 작전은 항상 예정 스케줄에 머물도록 함 (종료 일정으로 보내지 않음)
        // 반복 이벤트이므로 종료되지 않음
        if (id === 'a_bear' || id === 'alliance_bear' || id.includes('_bear')) return false;

        const schedule = getEventSchedule(event);

        // 1. startDate가 있으면 날짜 기준 판단 (우선순위 높음)
        // 미치광이 조이, 협곡, 요새, 성채, 무기공장 등 일회성 주간 이벤트용
        const startDate = schedule?.startDate || event.startDate;
        if (startDate) {
            try {
                const timeStr = schedule?.time || event.time || '00:00';
                const dateTimeStr = `${startDate}T${timeStr}:00`;
                const eventDateTime = new Date(dateTimeStr);
                if (!isNaN(eventDateTime.getTime())) {
                    // 이벤트 시작 후 1시간이 지나면 만료로 간주
                    const expireTime = new Date(eventDateTime.getTime() + 3600000);
                    return now > expireTime;
                }
            } catch (e) {
                // startDate 파싱 실패 시 기존 로직으로 fallback
            }
        }

        // 2. 기존 날짜 범위 체크
        const end = getEventEndDate(event);
        if (end) return now > end;

        // 3. 주간 반복 일정 만료 체크 (startDate 없는 경우)
        const dayStr = schedule?.day || event.day || '';
        const timeStr = schedule?.time || event.time || '';
        const combined = `${dayStr} ${timeStr}`;

        return checkWeeklyExpired(combined);
    };

    const getRemainingSeconds = (str: string) => {
        if (!str || str.includes('상시') || str.includes('상설')) return null;
        // 월요일~일요일이 한 주 (월요일 00:00 리셋)
        const dayMapObj: { [key: string]: number } = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
        const currentDay = (now.getDay() + 6) % 7; // 월(0), 화(1), 수(2), 목(3), 금(4), 토(5), 일(6)
        const currentTotal = currentDay * 1440 * 60 + now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const totalWeekSeconds = 7 * 1440 * 60;

        // 점형 일시 체크
        const explicitMatches = Array.from(str.matchAll(/([일월화수목금토]|[매일])\s*\(?(\d{1,2}):(\d{2})\)?/g));
        if (explicitMatches.length > 0) {
            let secRemaining: number | null = null;
            explicitMatches.forEach(m => {
                const dayStr = m[1];
                const h = parseInt(m[2]);
                const min = parseInt(m[3]);
                const scheduledDays = (dayStr === '매일') ? ['일', '월', '화', '수', '목', '금', '토'] : [dayStr];

                scheduledDays.forEach(d => {
                    const dayOffset = dayMapObj[d];
                    if (dayOffset === undefined) return;
                    const startTotal = dayOffset * 1440 * 60 + h * 3600 + min * 60;
                    let endTotal = startTotal + 1800; // 30 mins = 1800s

                    if (currentTotal >= startTotal && currentTotal <= endTotal) {
                        const rem = endTotal - currentTotal;
                        if (secRemaining === null || rem < secRemaining) secRemaining = rem;
                    } else if (endTotal >= totalWeekSeconds && currentTotal <= (endTotal % totalWeekSeconds)) {
                        const rem = (endTotal % totalWeekSeconds) - currentTotal;
                        if (secRemaining === null || rem < secRemaining) secRemaining = rem;
                    }
                });
            });
            return secRemaining;
        }
        return null;
    };

    const getNextResetSeconds = () => {
        const d = new Date(now);
        d.setHours(9, 0, 0, 0);
        if (d <= now) d.setDate(d.getDate() + 1);
        return Math.floor((d.getTime() - now.getTime()) / 1000);
    };

    const formatRemainingTime = (seconds: number) => {
        const d = Math.floor(seconds / (24 * 3600));
        const h = Math.floor((seconds % (24 * 3600)) / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;

        let res = "";
        if (d > 0) res += `${d}일 `;
        if (h > 0 || d > 0) res += `${String(h).padStart(2, '0')}:`;
        res += `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return res;
    };

    // -- 일정 단위가 활성 상태인지 체크하는 헬퍼 함수 --
    const checkItemActive = (str: string) => {
        if (!str) return false;
        // 월요일~일요일이 한 주 (월요일 00:00 리셋)
        const dayMapObj: { [key: string]: number } = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
        const currentDay = (now.getDay() + 6) % 7; // 월(0), 화(1), 수(2), 목(3), 금(4), 토(5), 일(6)
        const currentTotal = currentDay * 1440 + now.getHours() * 60 + now.getMinutes();
        const totalWeekMinutes = 7 * 1440;

        if (str.includes('상시') || str.includes('상설')) return true;

        // 1. 기간형 체크 (예: 2024.01.01 10:00 ~ 2024.01.03 10:00)
        // YYYY.MM.DD 또는 YYYY-MM-DD, 요일 정보 포함 여부, 시간 생략 등 대응
        const dateRangeMatch = str.match(/(\d{4}[\.-]\d{2}[\.-]\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})?\s*~\s*(\d{4}[\.-]\d{2}[\.-]\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})?/);
        if (dateRangeMatch) {
            const sDate = dateRangeMatch[1].replace(/\./g, '-');
            const sTime = dateRangeMatch[2] || '00:00';
            const eDate = dateRangeMatch[3].replace(/\./g, '-');
            const eTime = dateRangeMatch[4] || '23:59';
            const start = new Date(`${sDate}T${sTime}:00`);
            const end = new Date(`${eDate}T${eTime}:00`);
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
                    const endTotal = startTotal + 30; // 30분 지속
                    if (startTotal <= endTotal) {
                        return currentTotal >= startTotal && currentTotal <= endTotal;
                    } else { // 자정 근처 주간 순환
                        if (endTotal >= totalWeekMinutes) {
                            return currentTotal >= startTotal || currentTotal <= (endTotal % totalWeekMinutes);
                        }
                    }
                    return false;
                });
            });
        }
        return false;
    };

    const isVisibleInList = (event: any) => {
        const end = getEventEndDate(event);
        if (!end) return true; // For weekly/everlasting events, keep them visible.

        // For one-time events with startDate, keep visible for 7 days (rest of the week)
        const schedule = getEventSchedule(event);
        const hasStartDate = !!(schedule?.startDate || event.startDate);
        const bufferDays = hasStartDate ? 7 : 2;

        const bufferMs = bufferDays * 24 * 60 * 60 * 1000;
        const threshold = new Date(end.getTime() + bufferMs);
        return now <= threshold;
    };

    const isEventActive = (event: any) => {
        try {
            const schedule = getEventSchedule(event);
            const dayStr = schedule?.day || event.day || '';
            const timeStr = schedule?.time || event.time || '';

            // 모든 내부 로직은 '현재 유저의 로컬 시간'과 비교하므로, KST 데이터를 로컬로 변환하여 체크합니다.
            return checkItemActive(toLocal(dayStr)) || checkItemActive(toLocal(timeStr));
        } catch (e) { return false; }
    };

    const pad = (n: number) => n.toString().padStart(2, '0');

    // --- Timezone Conversion Helpers ---
    const toLocal = (kstStr: string) => {
        const userOffset = -new Date().getTimezoneOffset();
        const kstOffset = 540; // UTC+9
        return processConversion(kstStr, userOffset - kstOffset);
    };

    const toUTC = (kstStr: string) => {
        return processConversion(kstStr, -540);
    };

    const convertTime = (kstStr: string) => {
        if (!kstStr) return kstStr;
        return timezone === 'LOCAL' ? toLocal(kstStr) : toUTC(kstStr);
    };

    const processConversion = (str: string, diffMinutes: number) => {
        if (!str || diffMinutes === 0) return str;

        // 1. Full Date Range Case (2026.02.13 09:00)
        let processed = str.replace(/(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{2}):(\d{2})/g, (match, y, m, d, h, min) => {
            const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min));
            if (isNaN(date.getTime())) return match;
            const converted = new Date(date.getTime() + diffMinutes * 60000);
            return `${converted.getFullYear()}.${pad(converted.getMonth() + 1)}.${pad(converted.getDate())} ${pad(converted.getHours())}:${pad(converted.getMinutes())}`;
        });

        // 2. Weekly Day Case (화(22:00))
        processed = processed.replace(/([일월화수목금토]|[매일])\s*\(?(\d{1,2}):(\d{2})\)?/g, (match, day, h, m) => {
            const hour = parseInt(h);
            const min = parseInt(m);
            const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(d => t(`events.days.${d}`));
            let dayIdx = days.indexOf(day);

            if (dayIdx === -1) { // '매일'
                let totalMin = hour * 60 + min + diffMinutes;
                while (totalMin < 0) totalMin += 1440;
                totalMin %= 1440;
                const newH = Math.floor(totalMin / 60);
                const newM = totalMin % 60;
                return `${day}(${pad(newH)}:${pad(newM)})`;
            }

            let totalMin = dayIdx * 1440 + hour * 60 + min + diffMinutes;
            while (totalMin < 0) totalMin += 10080;
            totalMin %= 10080;

            const newDayIdx = Math.floor(totalMin / 1440);
            const remain = totalMin % 1440;
            const newH = Math.floor(remain / 60);
            const newM = remain % 60;
            return `${days[newDayIdx]}(${pad(newH)}:${pad(newM)})`;
        });

        return processed;
    };
    // ------------------------------------

    const splitSchedulePart = (str: string) => {
        if (!str) return { date: '', time: '' };

        // 1. Handle full date range type (2024.01.01 10:00)
        const fullDateMatch = str.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{2}):(\d{2})/);
        if (fullDateMatch) {
            const [_, y, m, d, h, min] = fullDateMatch;
            const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(d => t(`events.days.${d}`));
            const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            const dateStr = `${m}월 ${d}일 (${days[dateObj.getDay()]})`;
            return { date: dateStr, time: `${h}:${min}` };
        }

        // 2. Handle date only (2024.01.01)
        const justDateMatch = str.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})/);
        if (justDateMatch) {
            const [_, y, m, d] = justDateMatch;
            const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(d => t(`events.days.${d}`));
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

    // Gate Login States
    const [gateLoginError, setGateLoginError] = useState<string | null>(null);
    const [isLoginLoading, setIsLoginLoading] = useState(false);

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

        if (!input || !pw) {
            setLoginError(t('auth.loginInputError'));
            return;
        }

        try {
            const hashed = await hashPassword(pw);
            const lowerId = input.toLowerCase();

            // 1. Master Admin Check
            const master = MASTER_CREDENTIALS.find(m => m.id.toLowerCase() === lowerId);
            if (master && (master.pw === hashed || master.pw === pw)) {
                await performLogin(input, 'master');
                return;
            }

            // 2. Global Users Check (Alliance Admins / Super Admins)
            let globalUserData = null;
            let globalUserId = input;
            const userRef = doc(db, "users", input);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                globalUserData = userSnap.data();
            } else {
                const qUsers = query(collection(db, "users"), where("username", "==", input));
                const qUsersSnap = await getDocs(qUsers);
                if (!qUsersSnap.empty) {
                    globalUserData = qUsersSnap.docs[0].data();
                    globalUserId = qUsersSnap.docs[0].id;
                } else {
                    const qNick = query(collection(db, "users"), where("nickname", "==", input));
                    const qNickSnap = await getDocs(qNick);
                    if (!qNickSnap.empty) {
                        globalUserData = qNickSnap.docs[0].data();
                        globalUserId = qNickSnap.docs[0].id;
                    }
                }
            }

            if (globalUserData) {
                const userData = globalUserData;
                const storedPw = userData.password?.toString();

                if (storedPw === hashed || storedPw === pw) {
                    console.log(`[Modal Login] Auth Success. Switching to Server: ${userData.serverId}, Alliance: ${userData.allianceId}`);
                    // For alliance admins, update the context to their assigned alliance
                    if (userData.serverId && userData.allianceId) {
                        setAllianceInfo(userData.serverId, userData.allianceId);
                    }
                    await performLogin(globalUserId, userData.role || 'user');
                    return;
                } else {
                    setLoginError(t('auth.passwordMismatch'));
                    return;
                }
            }

            // 3. Dynamic Admin Check (Legacy Operation Admins)
            const dynamic = dynamicAdmins.find(a => {
                const aNameLower = a.name.toLowerCase();
                const aPw = (a.password || '').toLowerCase();
                return aNameLower === lowerId && (aPw === hashed || aPw === pw.toLowerCase());
            });

            if (dynamic) {
                await performLogin(dynamic.name, dynamic.role || 'admin');
            } else {
                setLoginError(t('auth.loginFailed'));
            }
        } catch (e) {
            console.error('[Modal Login] Error:', e);
            setLoginError(t('auth.authError'));
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
        const roleName = role === 'master' ? t('auth.role_master') : role === 'alliance_admin' ? t('auth.role_alliance_admin') : role === 'admin' ? t('auth.role_op_admin') : t('auth.role_general');
        showCustomAlert(t('auth.authSuccess'), t('auth.welcome', { id, role: roleName }), 'success');
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

                        // Simplify individual times (Remove Departure/Return etc)
                        const simplifiedTime = teamTime.split(/[,|]/).map(t => {
                            return t.replace(/출격|귀환|시작|종료/g, '').trim();
                        }).join(', ');

                        processedList.push({
                            ...e,
                            eventId: `${e.eventId}_team${idx + 1} `,
                            originalEventId: e.eventId,
                            title: t('events.alliance_bear_title'),
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
                            title: cleanLabel ? `${t('events.canyon_title')}(${cleanLabel})` : t('events.canyon_title'),
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

        // Helper to get a stable group ID for bundling related events (e.g., Fortress/Citadel)
        const getBundleId = (ev: any) => {
            const gid = ev.originalEventId || ev.eventId;
            if (gid === 'a_fortress' || gid === 'a_citadel' || gid === 'alliance_fortress' || gid === 'alliance_citadel') return 'fortress_bundle';
            return gid;
        };

        // 3. Sort the final processed list
        // Helper to get chronological sort weight for an event entry
        const getSortTime = (ev: any) => {
            const dStr = ev.day || '';
            const tStr = ev.time || '';
            const dayMap: { [key: string]: number } = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };

            // 1. Date Range Priority (Single occurrence events)
            const rangeMatch = (dStr + tStr).match(/(\d{4})[\.-](\d{2})[\.-](\d{2})/);
            if (rangeMatch) return new Date(rangeMatch[1] + '-' + rangeMatch[2] + '-' + rangeMatch[3]).getTime();

            // 2. Weekly Recurring
            const firstDay = (dStr + tStr).match(/[월화수목금토일]/)?.[0];
            const timeMatch = (dStr + tStr).match(/(\d{2}:\d{2})/)?.[1] || '00:00';
            if (firstDay) {
                const [h, m] = timeMatch.split(':').map(Number);
                return dayMap[firstDay] * 86400000 + h * 3600000 + m * 60000;
            }
            return 9999999999999;
        };

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

    // Pulsing Animation for Return Button
    const returnPulseAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(returnPulseAnim, {
                    toValue: 1,
                    duration: 1500,
                    useNativeDriver: false,
                }),
                Animated.timing(returnPulseAnim, {
                    toValue: 0,
                    duration: 1500,
                    useNativeDriver: false,
                }),
            ])
        ).start();
    }, []);

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

    // Event Time Formatting Helpers
    const getKoreanDayOfWeek = (date: Date) => {
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        return t(`events.days.${days[date.getDay()]}`);
    };

    // Translate Korean day to current language
    const translateDay = (day: string) => {
        const dayMap: { [key: string]: string } = {
            '일': 'sun', '월': 'mon', '화': 'tue', '수': 'wed',
            '목': 'thu', '금': 'fri', '토': 'sat'
        };
        return dayMap[day] ? t(`events.days.${dayMap[day]}`) : day;
    };

    // Translate fortress/citadel labels
    const translateLabel = (label: string) => {
        if (!label) return '';
        return label
            .replace(/요새\s*#?(\d+)/g, (match, num) => `${t('events.fortress')} ${num}`)
            .replace(/성채\s*#?(\d+)/g, (match, num) => `${t('events.citadel')} ${num}`);
    };

    const renderWithHighlightedDays = (str: string, isUpcomingSoon: boolean) => {
        const parts = str.split(/([일월화수목금토]|\((?:일|월|화|수|목|금|토)\))/g);
        return parts.map((part, i) => {
            const isDay = /([일월화수목금토]|\((?:일|월|화|수|목|금|토)\))/.test(part);
            if (isDay) {
                const translatedDay = translateDay(part.replace(/[\(\)]/g, ''));
                return (
                    <Text key={i} style={{
                        fontWeight: '900',
                        color: isUpcomingSoon ? (isDark ? '#34d399' : '#059669') : (isDark ? '#38bdf8' : '#2563eb')
                    }}>
                        {translatedDay}
                    </Text>
                );
            }
            return <Text key={i}>{part}</Text>;
        });
    };

    const formatEventTimeCompact = (timeStr: string, isUpcomingSoon: boolean) => {
        if (!timeStr) return null;

        // 1. Date Range Case: "2026.02.13 09:00 ~ 2026.02.15 09:00"
        const rangeMatch = timeStr.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{2}:\d{2})\s*~\s*(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{2}:\d{2})/);
        if (rangeMatch) {
            const [_, y1, m1, d1, t1, y2, m2, d2, t2] = rangeMatch;
            const start = new Date(parseInt(y1), parseInt(m1) - 1, parseInt(d1));
            const end = new Date(parseInt(y2), parseInt(m2) - 1, parseInt(d2));
            const startDay = getKoreanDayOfWeek(start);
            const endDay = getKoreanDayOfWeek(end);

            const startPart = `${m1}.${d1}(${startDay})\u00A0${t1}`;
            const endPart = `${m2}.${d2}(${endDay})\u00A0${t2}`;

            return (
                <Text
                    adjustsFontSizeToFit
                    numberOfLines={2}
                    minimumFontScale={0.7}
                    style={{ color: isDark ? '#cbd5e1' : '#475569', fontSize: 18 * fontSizeScale, fontWeight: '700' }}
                >
                    {renderWithHighlightedDays(startPart, isUpcomingSoon)}{"\u00A0"}~ {renderWithHighlightedDays(endPart, isUpcomingSoon)}
                </Text>
            );
        }

        // 2. Grouped Day Case: "요새7 금(23:00), 요새10 금(23:00)" or "요새전: 요새7 금 23:00"
        // Also handles "월(22:00)" without space
        const dayTimeMatches = Array.from(timeStr.matchAll(/(?:^|[,，/]+)\s*(.*?)\s+([일월화수목금토])[\s\(]*(\d{2}:\d{2})[\s\)]*/g));
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

                // Calculate expiration considering week wrap-around
                const currentDayIndex = now.getDay();
                const targetDayIndex = dayMapObj[day];

                // Simple expiration logic: if day passed, or same day and time passed
                // Note: Sunday is 0 in JS, but 7 in our logic context (if Mon-Sun)
                // Let's stick to standard JSgetDay: Sun=0, Mon=1...Sat=6.
                // But dayMapObj: 일=0, 월=1...토=6. matching.

                // If current day > target day, expired.
                // But what about next week? Usually schedule shows this week.
                // Let's assume standard weekly view.

                if (currentDayIndex > dayIdx) {
                    isItemExpired = true;
                } else if (currentDayIndex === dayIdx) {
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

            // Sort: Expired items last? Or just keep order? User asked for strikethrough.
            // Let's valid items first, then expired items.
            const resultParts = Object.values(groups).sort((a, b) => {
                if (a.isExpired === b.isExpired) return 0;
                return a.isExpired ? 1 : -1;
            });

            if (resultParts.length === 0) return null;

            return (
                <View className="flex-col gap-1.5 mt-2">
                    {resultParts.map((part, i) => (
                        <View key={i} className={`flex-row items-center mb-1 ${part.isExpired ? 'opacity-40' : ''}`}>
                            <Ionicons
                                name="time-outline"
                                size={14}
                                color={isDark ? '#cbd5e1' : '#475569'}
                                style={{ marginRight: 6 }}
                            />
                            <Text style={{
                                color: isDark ? '#cbd5e1' : '#475569',
                                fontSize: 18 * fontSizeScale,
                                fontWeight: '700',
                                textDecorationLine: part.isExpired ? 'line-through' : 'none'
                            }}>
                                {renderWithHighlightedDays(part.days.join('·'), isUpcomingSoon)} {part.time}
                            </Text>

                            {part.label ? (
                                <View className={`ml-2 px-2 py-0.5 rounded ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                    <Text style={{
                                        fontSize: 13 * fontSizeScale,
                                        fontWeight: '700',
                                        color: isDark ? '#94a3b8' : '#64748b',
                                        textDecorationLine: part.isExpired ? 'line-through' : 'none'
                                    }}>
                                        {translateLabel(part.label).replace(/\s+/g, ' ')}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    ))}
                </View>);
        }

        // 3. Simple String (Mixed or unformatted) -> Try to parse "Day(Time)" first to unify UI
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
                style={{ color: isDark ? '#cbd5e1' : '#475569', fontSize: 18 * fontSizeScale, fontWeight: '700' }}
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

        const checkIsSoon = (str: string) => {
            if (!str) return false;
            // 월요일~일요일이 한 주 (월요일 00:00 리셋)
            const dayMapObj: { [key: string]: number } = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };
            const currentDay = (now.getDay() + 6) % 7; // 월(0), 화(1), 수(2), 목(3), 금(4), 토(5), 일(6)
            const currentTotal = currentDay * 1440 + now.getHours() * 60 + now.getMinutes();
            const totalWeekMinutes = 7 * 1440;

            const dateRangeMatch = str.match(/(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{2}):(\d{2})/);
            if (dateRangeMatch) {
                const [_, y, m, d, h, min] = dateRangeMatch;
                const start = new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min));
                if (!isNaN(start.getTime())) {
                    const diff = (start.getTime() - now.getTime()) / 60000;
                    return diff > 0 && diff <= 30;
                }
            }

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
                        if (diff < 0) diff += totalWeekMinutes;
                        return diff > 0 && diff <= 30;
                    });
                });
            }
            return false;
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
                        padding: 8,
                        width: isActive ? '100%' : (windowWidth >= 480 ? '50%' : '100%'),
                        transform: [{ scale: pressed && auth.isLoggedIn ? 0.98 : (hovered && auth.isLoggedIn ? 1.02 : 1) }],
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        // @ts-ignore - Web property
                        cursor: 'pointer',
                        zIndex: hovered && auth.isLoggedIn ? 10 : 1
                    }
                ]}
            >
                {({ hovered }: any) => {
                    const currentSchedule = getEventSchedule(event);

                    const displayDay = currentSchedule?.day || event.day;
                    const displayTime = (event.isBearSplit || event.isFoundrySplit || event.isFortressSplit || event.isCanyonSplit) ? event.time : (currentSchedule?.time || event.time);

                    return isActive ? (
                        <View className={`w-full rounded-[32px] border ${hovered ? 'border-blue-400' : 'border-blue-500/40'} overflow-hidden bg-slate-950 transition-all`} style={{
                            shadowColor: '#3b82f6',
                            shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: hovered ? 0.5 : 0.3,
                            shadowRadius: hovered ? 30 : 20,
                            elevation: 15
                        }}>
                            <ImageBackground
                                source={require('../assets/images/selection_gate_bg.png')}
                                style={{ width: '100%', padding: 24 }}
                                imageStyle={{ opacity: hovered ? 0.6 : 0.4, transform: [{ scale: 1.2 }] }}
                            >
                                <View
                                    style={{
                                        shadowColor: '#3b82f6',
                                        shadowOffset: { width: 0, height: 4 },
                                        shadowOpacity: hovered ? 0.7 : 0.5,
                                        shadowRadius: hovered ? 20 : 15,
                                    }}
                                    className={`bg-slate-900/90 border-2 rounded-[24px] p-5 flex-row flex-wrap items-center w-full transition-all ${hovered ? 'border-blue-400' : 'border-blue-500'}`}
                                >
                                    <View className={`w-16 h-16 rounded-2xl items-center justify-center mr-5 border-2 transition-all ${hovered ? 'bg-blue-500/20 border-blue-400' : 'bg-blue-500/10 border-blue-500/20'}`}>
                                        {eventImageUrl ? (
                                            <Image
                                                source={typeof eventImageUrl === 'string' ? { uri: eventImageUrl } : eventImageUrl}
                                                className="w-12 h-12"
                                                resizeMode="contain"
                                            />
                                        ) : (
                                            <Ionicons name={getEventIcon(event.originalEventId || event.eventId)} size={32} color="#3b82f6" />
                                        )}
                                    </View>
                                    <View className="flex-1 min-w-[160px] py-1">
                                        <Text className="text-white text-xl font-black tracking-tighter mb-1" style={{ fontSize: 22 * fontSizeScale }}>
                                            {(() => {
                                                const eventId = event.eventId || '';
                                                const originalId = event.originalEventId || '';

                                                // Handle fortress/citadel titles
                                                if (eventId.includes('citadel')) {
                                                    return t('events.citadel_battle_title');
                                                }
                                                if (eventId.includes('fortress')) {
                                                    return t('events.fortress_battle_title');
                                                }

                                                // Handle other events
                                                const cleanId = (originalId || eventId).replace(/_fortress|_citadel|_team\d+/g, '');
                                                return t(`events.${cleanId}_title`, { defaultValue: event.title });
                                            })()}
                                        </Text>
                                        <View className="mb-2">
                                            {(() => {
                                                let activeStr = displayTime || displayDay || '-';
                                                if (displayDay && displayTime && !displayTime.includes(displayDay)) {
                                                    if (!event.isBearSplit && !event.isFoundrySplit && !event.isCanyonSplit) activeStr = `${displayDay} ${displayTime}`;
                                                }
                                                return formatEventTimeCompact(convertTime(activeStr), checkIsSoon(toLocal(activeStr)));
                                            })()}
                                        </View>
                                        <Text className={`text-[11px] font-bold leading-4 transition-all ${hovered ? 'text-slate-300' : 'text-slate-400'}`} numberOfLines={1}>
                                            {event.eventId.includes('total') || event.eventId.includes('operation')
                                                ? t('dashboard.hero_combination_desc')
                                                : t('dashboard.winning_strategy_desc')}
                                        </Text>
                                    </View>

                                    <View className="items-end justify-center ml-auto pl-4 border-l border-white/5 py-1" style={{ minWidth: 160 }}>
                                        {(() => {
                                            // 남은 시간 계산은 항상 '로컬'로 변환된 값과 '현지 now'를 비교합니다.
                                            let remSeconds = getRemainingSeconds(toLocal(displayDay)) || getRemainingSeconds(toLocal(displayTime));
                                            if (remSeconds === null) {
                                                const endDate = getEventEndDate({ ...event, day: toLocal(displayDay), time: toLocal(displayTime) });
                                                if (endDate && now < endDate) {
                                                    remSeconds = Math.floor((endDate.getTime() - now.getTime()) / 1000);
                                                }
                                            }

                                            if (remSeconds !== null) {
                                                return (
                                                    <View className="items-end w-full">
                                                        <Text
                                                            adjustsFontSizeToFit
                                                            numberOfLines={1}
                                                            minimumFontScale={0.6}
                                                            className="text-white font-black tracking-tighter text-right w-full"
                                                            style={{ fontSize: 32 * fontSizeScale, lineHeight: 32 * fontSizeScale }}
                                                        >
                                                            {formatRemainingTime(remSeconds)}
                                                        </Text>
                                                        <Text className="text-sky-400/60 text-[10px] font-black tracking-[0.2em] uppercase mt-1">Remaining</Text>
                                                    </View>
                                                );
                                            }
                                            return (
                                                <View className="px-4 py-2 rounded-2xl bg-blue-500/20 border border-blue-400/30">
                                                    <Text className="text-blue-400 text-sm font-black uppercase tracking-widest">Active</Text>
                                                </View>
                                            );
                                        })()}
                                    </View>
                                </View>
                            </ImageBackground>
                        </View>
                    ) : (
                        <View className={`rounded-[32px] border ${hovered ? 'border-slate-500 bg-slate-500/5' : 'border-slate-700 bg-slate-900/40'} p-4 transition-all`} style={{ height: '100%' }}>
                            <View className="flex-row items-center mb-4">
                                <View className={`w-8 h-8 rounded-lg items-center justify-center mr-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`} style={{ overflow: 'hidden' }}>
                                    {eventImageUrl ? (
                                        <Image
                                            source={typeof eventImageUrl === 'string' ? { uri: eventImageUrl } : eventImageUrl}
                                            className="w-6 h-6"
                                            resizeMode="contain"
                                        />
                                    ) : (
                                        <Ionicons name={getEventIcon(event.originalEventId || event.eventId)} size={16} color={isDark ? '#94a3b8' : '#64748b'} />
                                    )}
                                </View>
                                <Text className={`text-lg font-bold tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 18 * fontSizeScale }}>
                                    {(() => {
                                        const eventId = event.eventId || '';
                                        const originalId = event.originalEventId || '';

                                        // Handle fortress/citadel titles
                                        if (eventId.includes('citadel')) {
                                            return t('events.citadel_battle_title');
                                        }
                                        if (eventId.includes('fortress')) {
                                            return t('events.fortress_battle_title');
                                        }

                                        // Handle other events
                                        const cleanId = (originalId || eventId).replace(/_fortress|_citadel|_team\d+/g, '');
                                        return t(`events.${cleanId}_title`, { defaultValue: event.title });
                                    })()}
                                </Text>
                            </View>

                            <View className="flex-1 justify-center">
                                {(!displayDay && !displayTime) ? (
                                    <View className="items-center opacity-30 py-4"><Text className="text-slate-500 text-sm">{t('dashboard.unassigned')}</Text></View>
                                ) : (
                                    <View className="space-y-2">
                                        {(() => {
                                            let finalStr = displayTime || displayDay || '-';

                                            // Combine day and time if they are separate and shouldn't be
                                            if (displayDay && displayTime && !displayTime.includes(displayDay)) {
                                                if (!event.isBearSplit && !event.isFoundrySplit && !event.isCanyonSplit) {
                                                    finalStr = `${displayDay}(${displayTime})`;
                                                }
                                            }

                                            // Clean up: replace "요일 00:00" or "요일 (00:00)" with "요일(00:00)"
                                            finalStr = finalStr.replace(/([일월화수목금토])\s*\(?(\d{1,2}:\d{2})\)?/g, '$1($2)');

                                            return (
                                                <View className="flex-row items-start mt-1 pr-1">
                                                    <View className={`flex-1 ${isExpired ? 'opacity-50' : ''}`}>
                                                        {/* UI 표시는 선택된 타임존(convertTime)으로, '곧 시작' 체크는 항상 로컬(toLocal) 기준으로 수행 */}
                                                        {formatEventTimeCompact(convertTime(finalStr), checkIsSoon(toLocal(finalStr)))}
                                                    </View>
                                                </View>
                                            );
                                        })()}
                                    </View>
                                )}
                            </View>
                        </View>
                    );
                }}
            </Pressable >
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
                        // @ts-ignore - Web-specific property
                        tabIndex={-1}
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
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)' }} />
                <View className="flex-1 w-full h-full justify-center items-center p-4">
                    <BlurView intensity={40} tint="dark" className="absolute inset-0" />

                    <View className="w-full max-w-md p-6 rounded-[40px] border border-white/10 bg-slate-900/60 shadow-2xl overflow-hidden">
                        <BlurView intensity={80} className="absolute inset-0" />

                        <View className="items-center mb-4 relative">
                            {/* Help Button */}
                            <Pressable
                                onPress={() => openModalWithHistory(setIsGateManualVisible)}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        position: 'absolute',
                                        top: 0,
                                        right: 0,
                                        padding: 8,
                                        borderRadius: 9999,
                                        backgroundColor: hovered ? 'rgba(71, 85, 105, 0.6)' : 'rgba(30, 41, 59, 0.6)',
                                        borderWidth: 1,
                                        borderColor: hovered ? 'rgba(148, 163, 184, 0.5)' : 'rgba(51, 65, 85, 0.5)',
                                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                        transition: 'all 0.2s',
                                        zIndex: 10,
                                        cursor: 'pointer'
                                    }
                                ]}
                                // @ts-ignore - Web-specific property
                                tabIndex={-1}
                            >
                                <Ionicons name="book-outline" size={20} color="#f59e0b" />
                            </Pressable>

                            {/* Language Toggle Switch (Timezone style) */}
                            <View className="absolute top-0 left-0 flex-row p-1 rounded-2xl border bg-slate-800/50 border-slate-600" style={{ zIndex: 10 }}>
                                <Pressable
                                    onPress={() => changeLanguage('ko')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 12,
                                            backgroundColor: language === 'ko'
                                                ? '#2563eb'
                                                : (hovered ? 'rgba(59, 130, 246, 0.2)' : 'transparent'),
                                            borderColor: language === 'ko' ? 'transparent' : (hovered ? '#60a5fa' : 'transparent'),
                                            borderWidth: 1,
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                    // @ts-ignore
                                    tabIndex={-1}
                                >
                                    <View className="flex-row items-center">
                                        <Ionicons
                                            name="language"
                                            size={14}
                                            color={language === 'ko' ? 'white' : '#64748b'}
                                            style={{ marginRight: 6 }}
                                        />
                                        <Text className={`text-[11px] font-black ${language === 'ko' ? 'text-white' : 'text-slate-500'}`}>한국어</Text>
                                    </View>
                                </Pressable>

                                <Pressable
                                    onPress={() => changeLanguage('en')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            paddingHorizontal: 16,
                                            paddingVertical: 8,
                                            borderRadius: 12,
                                            backgroundColor: language === 'en'
                                                ? '#2563eb'
                                                : (hovered ? 'rgba(59, 130, 246, 0.2)' : 'transparent'),
                                            borderColor: language === 'en' ? 'transparent' : (hovered ? '#60a5fa' : 'transparent'),
                                            borderWidth: 1,
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                    // @ts-ignore
                                    tabIndex={-1}
                                >
                                    <View className="flex-row items-center">
                                        <Ionicons
                                            name="globe-outline"
                                            size={14}
                                            color={language === 'en' ? 'white' : '#64748b'}
                                            style={{ marginRight: 6 }}
                                        />
                                        <Text className={`text-[11px] font-black ${language === 'en' ? 'text-white' : 'text-slate-500'}`}>English</Text>
                                    </View>
                                </Pressable>
                            </View>

                            {/* Clear Data (Eraser / Trash) Button */}
                            <Pressable
                                onPress={handleResetSettings}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        position: 'absolute',
                                        top: 48,
                                        right: 0,
                                        padding: 8,
                                        borderRadius: 9999,
                                        backgroundColor: hovered ? 'rgba(71, 85, 105, 0.6)' : 'rgba(30, 41, 59, 0.6)',
                                        borderWidth: 1,
                                        borderColor: hovered ? 'rgba(148, 163, 184, 0.5)' : 'rgba(51, 65, 85, 0.5)',
                                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                        transition: 'all 0.2s',
                                        zIndex: 10,
                                    }
                                ]}
                                // @ts-ignore - Web-specific property
                                tabIndex={-1}
                            >
                                <Ionicons name="trash-outline" size={20} color="#a78bfa" />
                            </Pressable>

                            <View className={`w-12 h-12 rounded-2xl ${isRegisterMode ? 'bg-amber-500/20 shadow-amber-500/20' : 'bg-sky-500/20 shadow-sky-500/20'} items-center justify-center mb-3 border ${isRegisterMode ? 'border-amber-400/30' : 'border-sky-400/30'} shadow-lg`}>
                                <Ionicons name="snow" size={28} color={isRegisterMode ? "#fbbf24" : "#38bdf8"} />
                            </View>
                            <Text className="text-2xl font-black text-white text-center tracking-tighter">{t('dashboard.title')}</Text>
                            <Text className={`${isRegisterMode ? 'text-amber-400/80' : 'text-sky-400/80'} font-bold mt-0.5 tracking-[0.2em] uppercase text-[9px]`}>{t('dashboard.subtitle')}</Text>
                        </View>

                        <View className="flex-row bg-slate-950/40 p-1 rounded-2xl mb-5 border border-white/5 items-center">
                            <Pressable
                                onPress={() => setIsRegisterMode(false)}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        flex: 1,
                                        paddingVertical: 10,
                                        borderRadius: 12,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: !isRegisterMode
                                            ? 'rgba(56, 189, 248, 0.2)'
                                            : (hovered ? 'rgba(255,255,255,0.05)' : 'transparent'),
                                        borderWidth: 1,
                                        borderColor: !isRegisterMode
                                            ? 'rgba(56, 189, 248, 0.3)'
                                            : (hovered ? 'rgba(255,255,255,0.1)' : 'transparent'),
                                        opacity: !isRegisterMode ? 1 : (hovered ? 0.9 : 0.7),
                                        transform: [{ scale: pressed ? 0.98 : 1 }],
                                        transition: 'all 0.2s',
                                        cursor: 'pointer'
                                    }
                                ]}
                                // @ts-ignore - Web-specific property
                                tabIndex={-1}
                            >
                                <Text className={`font-black text-xs ${!isRegisterMode ? 'text-sky-400' : 'text-white/90'}`}>{t('dashboard.dashboardEntrance')}</Text>
                            </Pressable>

                            {/* Middle Divider */}
                            <View className="w-[1px] h-4 bg-white/10" />

                            <Pressable
                                onPress={() => setIsRegisterMode(true)}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        flex: 1,
                                        paddingVertical: 10,
                                        borderRadius: 12,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: isRegisterMode
                                            ? 'rgba(245, 158, 11, 0.2)'
                                            : (hovered ? 'rgba(255,255,255,0.05)' : 'transparent'),
                                        borderWidth: 1,
                                        borderColor: isRegisterMode
                                            ? 'rgba(245, 158, 11, 0.3)'
                                            : (hovered ? 'rgba(255,255,255,0.1)' : 'transparent'),
                                        opacity: isRegisterMode ? 1 : (hovered ? 0.9 : 0.7),
                                        transform: [{ scale: pressed ? 0.98 : 1 }],
                                        transition: 'all 0.2s',
                                        cursor: 'pointer'
                                    }
                                ]}
                                // @ts-ignore
                                tabIndex={-1}
                            >
                                <Text className={`font-black text-xs ${isRegisterMode ? 'text-amber-400' : 'text-white/90'}`}>{t('dashboard.applyAdmin')}</Text>
                            </Pressable>
                        </View>

                        <View className="space-y-2.5">
                            {/* Row 1: Server and Alliance */}
                            <View className="flex-row gap-2.5" style={{ zIndex: (activeInput === 'server' || activeInput === 'alliance') ? 100 : 50 }}>
                                {/* Server Number */}
                                <View className="flex-1" style={{ zIndex: activeInput === 'server' ? 100 : 50 }}>
                                    <View className="flex-row justify-between items-center ml-4 mb-1.5 ">
                                        <Text className="text-white/60 text-[10px] font-black uppercase tracking-widest text-left ">{t('dashboard.serverNumber')}</Text>
                                        <Text className={`${isRegisterMode ? 'text-amber-500/80' : 'text-sky-500/80'} text-[8px] font-bold text-right `}>{t('dashboard.required')}</Text>
                                    </View>
                                    <View className="relative">
                                        <View className="absolute left-2 top-0 bottom-0 z-10 w-12 items-center justify-center">
                                            <Ionicons name="server-outline" size={20} color={isRegisterMode ? "#fbbf24" : "#38bdf8"} />
                                        </View>
                                        <TextInput
                                            placeholder="#1008"
                                            placeholderTextColor="rgba(30, 41, 59, 0.5)"
                                            value={inputServer}
                                            onChangeText={setInputServer}
                                            onFocus={() => setActiveInput('server')}
                                            onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                            className={`bg-slate-950/50 p-2.5 pl-14 rounded-2xl text-white font-black text-lg border-2 transition-all duration-200 ${(gateLoginError && !inputServer.trim()) ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : (activeInput === 'server' ? (isRegisterMode ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.3)]') : 'border-slate-800')}`}
                                            keyboardType="number-pad"
                                            // @ts-ignore - Web-specific property
                                            tabIndex={1}
                                        />
                                        {renderHistorySuggestions('server')}
                                    </View>
                                </View>

                                {/* Alliance Name */}
                                <View className="flex-1" style={{ zIndex: activeInput === 'alliance' ? 100 : 40 }}>
                                    <View className="flex-row justify-between items-center ml-4 mb-1.5 ">
                                        <Text className="text-white/60 text-[10px] font-black uppercase tracking-widest text-left ">{t('dashboard.allianceName')}</Text>
                                        <Text className={`${isRegisterMode ? 'text-amber-500/80' : 'text-sky-500/80'} text-[8px] font-bold text-right `}>{t('dashboard.required')}</Text>
                                    </View>
                                    <View className="relative">
                                        <View className="absolute left-2 top-0 bottom-0 z-10 w-12 items-center justify-center">
                                            <Ionicons name="shield-outline" size={20} color={isRegisterMode ? "#fbbf24" : "#38bdf8"} />
                                        </View>
                                        <TextInput
                                            placeholder="WBI"
                                            placeholderTextColor="rgba(30, 41, 59, 0.5)"
                                            value={inputAlliance}
                                            onChangeText={setInputAlliance}
                                            onFocus={() => setActiveInput('alliance')}
                                            onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                            className={`bg-slate-950/50 p-2.5 pl-14 rounded-2xl text-white font-black text-lg border-2 transition-all duration-200 ${(gateLoginError && !inputAlliance.trim()) ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : (activeInput === 'alliance' ? (isRegisterMode ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.3)]') : 'border-slate-800')}`}
                                            autoCapitalize="characters"
                                            // @ts-ignore - Web-specific property
                                            tabIndex={2}
                                        />
                                        {renderHistorySuggestions('alliance')}
                                    </View>
                                </View>
                            </View>

                            {/* Row 2: Lord Name and Password */}
                            <View className="flex-row gap-2.5" style={{ zIndex: (activeInput === 'userid' || activeInput === 'password') ? 100 : 30 }}>
                                {/* Lord Name */}
                                <View className="flex-1" style={{ zIndex: activeInput === 'userid' ? 100 : 30 }}>
                                    <Text className="text-white/60 text-[10px] font-black ml-4 mb-1.5 uppercase tracking-widest">{t('dashboard.lordName')}</Text>
                                    <View className="relative">
                                        <View className="absolute left-2 top-0 bottom-0 z-10 w-12 items-center justify-center">
                                            <Ionicons name="person-outline" size={20} color={isRegisterMode ? "#fbbf24" : "#38bdf8"} />
                                        </View>
                                        <TextInput
                                            placeholder={t('auth.onlyIdErrorPlaceholder')}
                                            placeholderTextColor="rgba(30, 41, 59, 0.5)"
                                            ref={gateUserIdRef}
                                            value={inputUserId}
                                            onChangeText={(text) => {
                                                setInputUserId(text);
                                                if (gateLoginError) setGateLoginError(null);
                                            }}
                                            onFocus={() => setActiveInput('userid')}
                                            onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                            onSubmitEditing={() => gatePasswordRef.current?.focus()}
                                            blurOnSubmit={false}
                                            className={`bg-slate-950/50 p-2.5 pl-14 rounded-2xl text-white font-black text-lg border-2 transition-all duration-200 ${(gateLoginError && !!inputUserId.trim()) ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : (activeInput === 'userid' ? (isRegisterMode ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.3)]') : 'border-slate-800')}`}
                                            // @ts-ignore - Web-specific property
                                            tabIndex={3}
                                        />
                                        {renderHistorySuggestions('userid')}
                                    </View>
                                </View>

                                {/* Password */}
                                <View className="flex-1" style={{ zIndex: activeInput === 'password' ? 100 : 20 }}>
                                    <View className="flex-row justify-between items-center ml-4 mb-1.5 ">
                                        <Text className="text-white/60 text-[10px] font-black uppercase tracking-widest text-left ">{t('dashboard.password')}</Text>
                                        {isRegisterMode && (
                                            <Text className="text-amber-500/80 text-[8px] font-bold text-right ">{t('dashboard.required')}</Text>
                                        )}
                                    </View>
                                    <View className="relative">
                                        <View className="absolute left-2 top-0 bottom-0 z-10 w-12 items-center justify-center">
                                            <Ionicons name="lock-closed-outline" size={20} color={isRegisterMode ? "#fbbf24" : "#38bdf8"} />
                                        </View>
                                        <TextInput
                                            ref={gatePasswordRef}
                                            placeholder="••••••"
                                            placeholderTextColor="rgba(30, 41, 59, 0.5)"
                                            value={inputPassword}
                                            onChangeText={(text) => {
                                                setInputPassword(text);
                                                if (gateLoginError) setGateLoginError(null);
                                            }}
                                            secureTextEntry={!showGatePw}
                                            onFocus={() => setActiveInput('password')}
                                            onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                            onSubmitEditing={handleEnterAlliance}
                                            className={`bg-slate-950/50 p-2.5 pl-14 pr-12 rounded-2xl text-white font-black text-lg border-2 transition-all duration-200 ${(gateLoginError && !!inputPassword.trim()) ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : (activeInput === 'password' ? (isRegisterMode ? 'border-amber-500 shadow-[0_0_15_rgba(245,158,11,0.3)]' : 'border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.3)]') : 'border-slate-800')}`}
                                            // @ts-ignore - Web-specific property
                                            tabIndex={4}
                                        />
                                        <TouchableOpacity
                                            onPress={() => setShowGatePw(!showGatePw)}
                                            className="absolute right-3 top-0 bottom-0 justify-center p-2"
                                            // @ts-ignore
                                            tabIndex={-1}
                                        >
                                            <Ionicons name={showGatePw ? "eye-off-outline" : "eye-outline"} size={20} color="#475569" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            {/* Inline Error Message */}
                            {gateLoginError && (
                                <View className="mt-3 flex-row items-center justify-center bg-rose-500/10 py-2 rounded-xl border border-rose-500/20">
                                    <Ionicons name="alert-circle" size={16} color="#f43f5e" style={{ marginRight: 6 }} />
                                    <Text className="text-rose-500 text-xs font-bold">{gateLoginError}</Text>
                                </View>
                            )}

                            <View className="flex-row items-center mt-4">
                                <Pressable
                                    onPress={handleEnterAlliance}
                                    disabled={isLoginLoading}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            flex: 1,
                                            paddingVertical: 10,
                                            borderRadius: 16,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            overflow: 'hidden',
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.02 : 1) }],
                                            opacity: isLoginLoading ? 0.7 : 1,
                                            // @ts-ignore
                                            boxShadow: isRegisterMode
                                                ? '0 10px 30px rgba(245, 158, 11, 0.3)'
                                                : '0 10px 30px rgba(56, 189, 248, 0.3)',
                                            transition: 'all 0.3s ease',
                                        }
                                    ]}
                                    // @ts-ignore - Web-specific property
                                    tabIndex={5}
                                >
                                    <LinearGradient
                                        colors={isRegisterMode ? ['#f59e0b', '#d97706'] : ['#38bdf8', '#0ea5e9']}
                                        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                    />
                                    {isLoginLoading ? (
                                        <ActivityIndicator color="white" size="small" />
                                    ) : (
                                        <Text className="text-white font-black text-lg tracking-tight relative z-10">
                                            {isRegisterMode
                                                ? t('dashboard.apply')
                                                : (!inputUserId.trim() && !inputPassword.trim())
                                                    ? t('dashboard.anonymousEntrance')
                                                    : t('dashboard.entrance')}
                                        </Text>
                                    )}
                                </Pressable>

                            </View>


                            {!!serverId && !!allianceId && (
                                <Pressable
                                    onPress={() => setIsGateOpen(false)}
                                    style={({ pressed, hovered }: any) => [
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
                                    <Animated.View
                                        style={{
                                            transform: [{
                                                scale: returnPulseAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [1, 1.1]
                                                })
                                            }]
                                        }}
                                    >
                                        <Animated.Text
                                            className="font-bold text-[12px] tracking-tight"
                                            style={{
                                                color: returnPulseAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: ['#94a3b8', '#ffffff']
                                                }),
                                                // @ts-ignore - Web-specific CSS property
                                                textShadow: returnPulseAnim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: ['0 0 0px rgba(56, 189, 248, 0)', '0 0 10px rgba(56, 189, 248, 0.3)']
                                                })
                                            }}
                                        >
                                            {t('dashboard.returnToDashboard')}
                                        </Animated.Text>
                                    </Animated.View>
                                </Pressable>
                            )}
                        </View>
                    </View>

                </View>

                {/* Gate Manual (Login Guide) */}
                <Modal visible={isGateManualVisible} transparent animationType="fade" onRequestClose={() => setIsGateManualVisible(false)}>
                    <View className="flex-1 bg-black/80 items-center justify-center p-6">
                        <BlurView intensity={40} className="absolute inset-0" />
                        <View className={`w-full max-w-2xl h-[80%] rounded-[40px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                            <View className={`px-10 py-4 border-b ${isDark ? 'bg-gradient-to-r from-slate-950 to-slate-900 border-slate-800' : 'bg-gradient-to-r from-slate-50 to-white border-slate-100'}`}>
                                <View className="flex-row items-center justify-between">
                                    <View className="flex-row items-center">
                                        <View className={`w-14 h-14 rounded-2xl items-center justify-center mr-5 ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
                                            <Ionicons name="help-circle" size={30} color="#f59e0b" />
                                        </View>
                                        <View>
                                            <Text className={`text-[10px] font-black tracking-[0.3em] uppercase mb-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{t('dashboard.gateGuide')}</Text>
                                            <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dashboard.loginGuide')}</Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity onPress={() => setIsGateManualVisible(false)} className={`w-12 h-12 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                        <Ionicons name="close" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            {renderGateManualContent()}
                            <View className="px-10 py-4 border-t border-slate-800">
                                <TouchableOpacity onPress={() => setIsGateManualVisible(false)} className="w-full py-2 items-center justify-center">
                                    <Text className="text-amber-500 font-black text-lg">{t('dashboard.understood')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                {/* Custom Alert Modal (Shared with Gate ) */}
                <Modal visible={customAlert.visible} transparent animationType="fade" onRequestClose={() => setCustomAlert({ ...customAlert, visible: false })}>
                    <View className="flex-1 bg-black/80 items-center justify-center p-6">
                        <BlurView intensity={40} className="absolute inset-0" />
                        <View className={`w-full max-w-sm p-8 rounded-[40px] border shadow-2xl items-center ${isDark ? 'bg-slate-900 border-slate-800/60' : 'bg-white border-slate-100'}`}>
                            {/* Icon Area */}
                            <View className={`w-20 h-20 rounded-full items-center justify-center mb-6 ${customAlert.type === 'success' ? (isDark ? 'bg-emerald-500/10' : 'bg-emerald-50') : (customAlert.type === 'error') ? (isDark ? 'bg-red-500/10' : 'bg-red-50') : (isDark ? 'bg-slate-800' : 'bg-slate-100')}`}>
                                <View className={`w-14 h-14 rounded-full items-center justify-center ${customAlert.type === 'success' ? 'bg-emerald-500' : (customAlert.type === 'error') ? 'bg-red-500' : 'bg-slate-600'}`}>
                                    <Ionicons
                                        name={customAlert.type === 'success' ? 'checkmark' : (customAlert.type === 'error') ? 'close' : 'trash-outline'}
                                        size={28}
                                        color="white"
                                    />
                                </View>
                            </View>

                            <Text className={`text-2xl font-black mb-3 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>{customAlert.title}</Text>
                            <Text className={`text-center mb-8 text-base leading-6 font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{customAlert.message}</Text>

                            {customAlert.type === 'confirm' ? (
                                <View className="flex-row w-full gap-3">
                                    <TouchableOpacity
                                        onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                                        className={`flex-1 py-4 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                                    >
                                        <Text className={`text-center font-bold text-base ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('common.cancel')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => {
                                            setCustomAlert({ ...customAlert, visible: false });
                                            customAlert.onConfirm?.();
                                        }}
                                        className={`flex-[1.5] py-4 rounded-2xl ${isDark ? 'bg-sky-500' : 'bg-sky-600'}`}
                                    >
                                        <Text className="text-center font-bold text-base text-white">{t('common.confirm')}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                                    className={`w-full py-4 rounded-2xl ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                                >
                                    <Text className={`text-center font-bold text-base ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('common.ok')}</Text>
                                </TouchableOpacity>
                            )}
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
                        <View className="pt-12 pb-6 flex-row justify-between items-start">
                            <View className="flex-1 mr-4">
                                <View className="flex-row items-center mb-1 gap-4">
                                    <View className="flex-row items-center opacity-70">
                                        <Ionicons name="time-outline" size={10} color={isDark ? "#38bdf8" : "#2563eb"} style={{ marginRight: 4 }} />
                                        <Text className={`font-mono text-[10px] font-black tracking-tight ${isDark ? 'text-sky-400' : 'text-blue-600'}`}>
                                            {now.getHours()}:{String(now.getMinutes()).padStart(2, '0')}:{String(now.getSeconds()).padStart(2, '0')}
                                        </Text>
                                    </View>
                                </View>
                                {/* Reset Timer Progress Bar */}
                                <View className="mt-2 flex-row items-center gap-2">
                                    <View className={`h-1.5 flex-1 rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                        <View
                                            className={`h-full ${isDark ? 'bg-sky-500' : 'bg-blue-500'}`}
                                            style={{ width: `${((86400 - getNextResetSeconds()) / 86400) * 100}%` }}
                                        />
                                    </View>
                                    <View className="flex-row items-center">
                                        <Ionicons name="refresh" size={10} color={isDark ? "#38bdf8" : "#2563eb"} style={{ marginRight: 3 }} />
                                        <Text className={`font-mono text-[10px] font-black ${isDark ? 'text-sky-400' : 'text-blue-600'}`}>
                                            {formatRemainingTime(getNextResetSeconds())}
                                        </Text>
                                    </View>
                                </View>
                                <Text className={`font-bold text-[9px] md:text-xs tracking-[0.4em] mb-1.5 uppercase ${isDark ? 'text-[#38bdf8]' : 'text-blue-600'}`}>{t('dashboard.whiteoutSurvival')}</Text>
                                <Text className={`text-3xl md:text-5xl font-bold tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dashboard.title')}</Text>
                                <View className="mt-4">
                                    <View className={`w-10 md:w-14 h-1 rounded-full ${isDark ? 'bg-[#38bdf8]' : 'bg-blue-600'}`} />
                                </View>
                                <Text className={`font-semibold text-[11px] md:text-xs mt-3.5 leading-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('dashboard.slogan')}</Text>

                                {!!serverId && !!allianceId && (
                                    <View className="flex-row items-center gap-4 mt-6 self-start">
                                        <Pressable
                                            onPress={() => {
                                                setInputServer(serverId);
                                                setInputAlliance(allianceId);
                                                setIsGateOpen(true);
                                            }}
                                            style={({ pressed, hovered }: any) => [
                                                {
                                                    transform: [{ scale: pressed ? 0.98 : (hovered ? 1.05 : 1) }],
                                                    // @ts-ignore
                                                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                                    cursor: 'pointer'
                                                }
                                            ]}
                                        >
                                            {({ hovered }: any) => (
                                                <View
                                                    className={`flex-row items-center px-5 py-3 rounded-2xl border-2 shadow-lg transition-all ${isDark
                                                        ? `bg-gradient-to-r ${hovered ? 'from-sky-500/30 to-blue-500/30 border-sky-400' : 'from-sky-500/20 to-blue-500/20 border-sky-400/50'} shadow-sky-500/20`
                                                        : `bg-gradient-to-r ${hovered ? 'from-white to-sky-100 border-sky-400' : 'from-sky-50 to-blue-50 border-sky-200'} shadow-sky-100`}`}
                                                    style={isDark ? { shadowColor: '#38bdf8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: hovered ? 0.6 : 0.3, shadowRadius: hovered ? 12 : 8 } : {}}
                                                >
                                                    <View className={`mr-3 w-8 h-8 rounded-full items-center justify-center transition-all ${isDark ? (hovered ? 'bg-sky-500/40' : 'bg-sky-500/30') : (hovered ? 'bg-sky-200' : 'bg-sky-100')}`}>
                                                        <Ionicons name="location" size={16} color={isDark ? (hovered ? "#7dd3fc" : "#38bdf8") : "#0284c7"} />
                                                    </View>
                                                    <Text className={`font-black text-sm tracking-tight transition-all ${isDark ? (hovered ? 'text-white' : 'text-sky-300') : (hovered ? 'text-sky-800' : 'text-sky-700')}`}>
                                                        {serverId?.toString().startsWith('#') ? serverId : '#' + serverId} · {allianceId}
                                                    </Text>
                                                    <View className={`ml-3 w-6 h-6 rounded-full items-center justify-center transition-all ${isDark ? (hovered ? 'bg-sky-500/30' : 'bg-sky-500/20') : (hovered ? 'bg-sky-200' : 'bg-sky-100')}`}>
                                                        <Ionicons name="chevron-forward" size={14} color={isDark ? (hovered ? "#7dd3fc" : "#38bdf8") : "#0284c7"} />
                                                    </View>
                                                </View>
                                            )}
                                        </Pressable>

                                        {/* Font Size Controls - Moved Here */}
                                        <View className={`flex-row p-1.5 rounded-2xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                                            <Pressable
                                                onPress={() => changeFontSize(Math.max(0.8, fontSizeScale - 0.1))}
                                                style={({ pressed, hovered }: any) => [
                                                    {
                                                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.15 : 1) }],
                                                        // @ts-ignore
                                                        transition: 'all 0.2s',
                                                        cursor: 'pointer'
                                                    }
                                                ]}
                                            >
                                                {({ hovered }: any) => (
                                                    <View className={`w-10 h-10 rounded-xl items-center justify-center mr-1 transition-all ${isDark ? (hovered ? 'bg-slate-600 border border-slate-500' : 'bg-slate-700') : (hovered ? 'bg-white border-blue-400 shadow-md' : 'bg-slate-50 border border-slate-100 shadow-sm')}`}>
                                                        <Ionicons name="text" size={14} color={isDark ? (hovered ? "white" : "#94a3b8") : (hovered ? "#2563eb" : "#64748b")} style={{ marginBottom: -2 }} />
                                                        <Ionicons name="remove" size={10} color={isDark ? (hovered ? "#38bdf8" : "white") : (hovered ? "#2563eb" : "black")} style={{ position: 'absolute', top: 6, right: 6 }} />
                                                    </View>
                                                )}
                                            </Pressable>
                                            <View className="h-full w-[1px] bg-slate-500/20 mx-1" />
                                            <Pressable
                                                onPress={() => changeFontSize(Math.min(1.5, fontSizeScale + 0.1))}
                                                style={({ pressed, hovered }: any) => [
                                                    {
                                                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.15 : 1) }],
                                                        // @ts-ignore
                                                        transition: 'all 0.2s',
                                                        cursor: 'pointer'
                                                    }
                                                ]}
                                            >
                                                {({ hovered }: any) => (
                                                    <View className={`w-10 h-10 rounded-xl items-center justify-center ml-1 transition-all ${isDark ? (hovered ? 'bg-slate-600 border border-slate-500' : 'bg-slate-700') : (hovered ? 'bg-white border-blue-400 shadow-md' : 'bg-slate-50 border border-slate-100 shadow-sm')}`}>
                                                        <Ionicons name="text" size={18} color={isDark ? (hovered ? "white" : "white") : (hovered ? "#2563eb" : "#0f172a")} style={{ marginBottom: -2, color: isDark ? (hovered ? 'white' : 'white') : (hovered ? '#2563eb' : '#0f172a') }} />
                                                        <Ionicons name="add" size={10} color={isDark ? "#38bdf8" : "#0284c7"} style={{ position: 'absolute', top: 4, right: 4 }} />
                                                    </View>
                                                )}
                                            </Pressable>
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
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                padding: 10,
                                                borderRadius: 9999,
                                                borderWidth: 1,
                                                backgroundColor: hovered
                                                    ? (isDark ? 'rgba(71, 85, 105, 0.4)' : 'rgba(226, 232, 240, 0.8)')
                                                    : (isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(248, 250, 252, 1)'),
                                                borderColor: isDark ? 'rgba(51, 65, 85, 1)' : 'rgba(226, 232, 240, 1)',
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.1 : 1) }],
                                                transition: 'all 0.2s',
                                                cursor: 'pointer',
                                                boxShadow: hovered
                                                    ? (isDark ? '0 0 15px rgba(251, 191, 36, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)')
                                                    : 'none',
                                            }
                                        ]}
                                    >
                                        <Ionicons name={isDark ? "sunny" : "moon"} size={22} color={isDark ? "#fbbf24" : "#333333"} />
                                    </Pressable>
                                    {hoveredHeaderBtn === 'theme' && (
                                        <View className="absolute top-12 right-0 z-[100] items-end animate-in fade-in slide-in-from-top-1 duration-200" style={{ pointerEvents: 'none' }}>
                                            <View className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-black' : 'bg-white border-slate-200 shadow-slate-200'} border px-4 py-2.5 rounded-xl shadow-2xl`} style={{ alignSelf: 'flex-end' }}>
                                                <Text numberOfLines={1} className={`${isDark ? 'text-slate-200' : 'text-slate-700'} text-[11px] font-bold whitespace-nowrap`}>
                                                    {t('dashboard.themeSwitch')}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>

                                <View className="relative">
                                    <Pressable
                                        onPress={() => openModalWithHistory(setIsManualVisible)}
                                        onHoverIn={() => setHoveredHeaderBtn('help')}
                                        onHoverOut={() => setHoveredHeaderBtn(null)}
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                padding: 10,
                                                borderRadius: 9999,
                                                borderWidth: 1,
                                                backgroundColor: hovered
                                                    ? (isDark ? 'rgba(71, 85, 105, 0.4)' : 'rgba(226, 232, 240, 0.8)')
                                                    : (isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(248, 250, 252, 1)'),
                                                borderColor: isDark ? 'rgba(51, 65, 85, 1)' : 'rgba(226, 232, 240, 1)',
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.1 : 1) }],
                                                transition: 'all 0.2s',
                                                boxShadow: hovered
                                                    ? (isDark ? '0 0 15px rgba(167, 139, 250, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)')
                                                    : 'none',
                                            }
                                        ]}
                                    >
                                        <Ionicons name="book-outline" size={22} color="#f59e0b" />
                                    </Pressable>
                                    {hoveredHeaderBtn === 'help' && (
                                        <View className="absolute top-12 right-0 z-[100] items-end animate-in fade-in slide-in-from-top-1 duration-200" style={{ pointerEvents: 'none' }}>
                                            <View className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-black' : 'bg-white border-slate-200 shadow-slate-200'} border px-4 py-2.5 rounded-xl shadow-2xl`} style={{ alignSelf: 'flex-end' }}>
                                                <Text numberOfLines={1} className={`${isDark ? 'text-slate-200' : 'text-slate-700'} text-[10px] font-black whitespace-nowrap`}>
                                                    {t('dashboard.userManual')}
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
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                padding: 10,
                                                borderRadius: 9999,
                                                borderWidth: 1,
                                                backgroundColor: hovered
                                                    ? (isDark ? 'rgba(71, 85, 105, 0.4)' : 'rgba(226, 232, 240, 0.8)')
                                                    : (isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(248, 250, 252, 1)'),
                                                borderColor: isDark ? 'rgba(51, 65, 85, 1)' : 'rgba(226, 232, 240, 1)',
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.1 : 1) }],
                                                transition: 'all 0.2s',
                                                boxShadow: hovered
                                                    ? (isDark ? '0 0 15px rgba(56, 189, 248, 0.2)' : '0 4px 6px -1px rgba(0, 0, 0, 0.1)')
                                                    : 'none',
                                            }
                                        ]}
                                    >
                                        <Ionicons name="download" size={22} color={isDark ? "#38bdf8" : "#0284c7"} />
                                    </Pressable>
                                    {hoveredHeaderBtn === 'install' && (
                                        <View className="absolute top-12 right-0 z-[100] items-end animate-in fade-in slide-in-from-top-1 duration-200" style={{ pointerEvents: 'none' }}>
                                            <View className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-black' : 'bg-white border-slate-200 shadow-slate-200'} border px-4 py-2.5 rounded-xl shadow-2xl`} style={{ alignSelf: 'flex-end' }}>
                                                <Text numberOfLines={1} className={`${isDark ? 'text-slate-200' : 'text-slate-700'} text-[10px] font-black whitespace-nowrap`}>
                                                    {t('dashboard.installGuide')}
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
                                        style={({ pressed, hovered }: any) => {
                                            const roleColors = auth.isLoggedIn
                                                ? (auth.role === 'super_admin' || auth.role === 'master')
                                                    ? { bg: isDark ? 'rgba(244, 63, 94, 0.4)' : 'rgba(255, 241, 242, 1)', border: '#fb7185' }
                                                    : auth.role === 'alliance_admin'
                                                        ? { bg: isDark ? 'rgba(99, 102, 241, 0.4)' : 'rgba(238, 242, 255, 1)', border: '#818cf8' }
                                                        : auth.role === 'admin'
                                                            ? { bg: isDark ? 'rgba(6, 182, 212, 0.4)' : 'rgba(236, 254, 255, 1)', border: '#22d3ee' }
                                                            : { bg: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(248, 250, 252, 1)', border: isDark ? 'rgba(51, 65, 85, 1)' : 'rgba(226, 232, 240, 1)' }
                                                : { bg: isDark ? 'rgba(30, 41, 59, 0.8)' : 'rgba(248, 250, 252, 1)', border: isDark ? 'rgba(51, 65, 85, 1)' : 'rgba(226, 232, 240, 1)' };

                                            return [
                                                {
                                                    padding: 10,
                                                    borderRadius: 9999,
                                                    borderWidth: 2,
                                                    backgroundColor: hovered ? (isDark ? 'rgba(71, 85, 105, 0.4)' : 'rgba(226, 232, 240, 0.8)') : roleColors.bg,
                                                    borderColor: hovered ? (isDark ? 'rgba(148, 163, 184, 0.5)' : 'rgba(148, 163, 184, 0.8)') : roleColors.border,
                                                    transform: [{ scale: pressed ? 0.95 : (hovered ? 1.1 : 1) }],
                                                    transition: 'all 0.2s',
                                                    cursor: 'pointer',
                                                    boxShadow: hovered
                                                        ? `0 0 15px ${roleColors.border}40`
                                                        : 'none',
                                                }
                                            ];
                                        }}
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
                                                    : (isDark ? "#ffffff" : "#94a3b8") // 비로그인 (흰색 강조)
                                            }
                                        />
                                    </Pressable>
                                    {hoveredHeaderBtn === 'admin' && (
                                        <View className="absolute top-12 right-0 z-[100] items-end animate-in fade-in slide-in-from-top-1 duration-200" style={{ pointerEvents: 'none' }}>
                                            <View className={`${isDark ? 'bg-slate-800 border-slate-700 shadow-black' : 'bg-white border-slate-200 shadow-slate-200'} border px-4 py-2.5 rounded-xl shadow-2xl`} style={{ alignSelf: 'flex-end' }}>
                                                <Text numberOfLines={1} className={`${isDark ? 'text-slate-200' : 'text-slate-700'} text-[10px] font-black whitespace-nowrap`}>
                                                    {auth.isLoggedIn
                                                        ? (auth.role === 'super_admin' || auth.role === 'master')
                                                            ? t('dashboard.role_super_admin')
                                                            : auth.role === 'alliance_admin'
                                                                ? t('dashboard.role_alliance_admin')
                                                                : auth.role === 'admin'
                                                                    ? t('dashboard.role_admin')
                                                                    : t('dashboard.role_general')
                                                        : t('dashboard.role_member_login')}
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* Notice Section */}
                        {!!notice && (!!notice.visible || !!auth.isLoggedIn) && (
                            <Pressable
                                onPress={() => {
                                    if (!auth.isLoggedIn) {
                                        showCustomAlert(t('common.member_only_title'), t('common.member_only_alert'), 'error');
                                        return;
                                    }
                                    setNoticeDetailVisible(true);
                                }}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        marginBottom: 24,
                                        width: '100%',
                                        transform: [{ scale: pressed ? 0.99 : (hovered ? 1.01 : 1) }],
                                        backgroundColor: hovered
                                            ? (isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 251, 235, 1)')
                                            : 'transparent',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        cursor: 'pointer'
                                    }
                                ]}
                            >
                                {({ hovered }: any) => (
                                    <View className={`py-3.5 px-5 rounded-3xl border flex-row items-center overflow-hidden ${notice.visible ? (isDark ? 'bg-slate-950/80 border-amber-900/50' : 'bg-amber-50/80 border-amber-300') : (isDark ? 'bg-slate-800/60 border-slate-700 border-dashed' : 'bg-slate-50 border-slate-200 border-dashed')} ${hovered ? (isDark ? 'bg-slate-900 border-amber-800' : 'bg-amber-100/50') : ''}`}
                                        style={notice.visible ? { shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: hovered ? 0.35 : 0.15, shadowRadius: 16, elevation: 4 } : {}}
                                    >
                                        {notice.visible && (
                                            <View className={`absolute left-0 top-0 bottom-0 w-1 ${isDark ? 'bg-amber-500' : 'bg-amber-400'}`} style={{ borderTopLeftRadius: 24, borderBottomLeftRadius: 24 }} />
                                        )}
                                        <View className="mr-4">
                                            <View className={`w-10 h-10 rounded-2xl items-center justify-center ${notice.visible ? (isDark ? 'bg-amber-500/15' : 'bg-amber-100') : (isDark ? 'bg-slate-700/50' : 'bg-slate-100/50')}`}>
                                                <Ionicons name={notice.visible ? "notifications" : "notifications-off"} size={22} color={notice.visible ? "#f59e0b" : "#94a3b8"} />
                                            </View>
                                        </View>
                                        <View className="flex-1">
                                            <Text className={`font-black text-[9px] tracking-widest uppercase mb-0.5 ${notice.visible ? (isDark ? 'text-amber-500/80' : 'text-amber-600') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{t('common.info')}</Text>
                                            <Text className={`text-sm font-bold ${notice.visible ? (isDark ? 'text-amber-100/90' : 'text-slate-800') : (isDark ? 'text-slate-400' : 'text-slate-500')}`} numberOfLines={1}>{notice.content || t('dashboard.notice_empty')}</Text>
                                        </View>
                                        {!!auth.isLoggedIn && (
                                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleOpenNotice(); }} className={`ml-3 p-1.5 rounded-xl border ${isDark ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white border-slate-200 shadow-sm'}`}><Ionicons name="pencil" size={14} color="#38bdf8" /></TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </Pressable>
                        )}

                        {/* Feature Cards Grid */}
                        <View className="flex-row flex-wrap gap-4 mb-8 w-full justify-center">
                            {[
                                { id: 'events', label: t('dashboard.menu_events'), desc: t('dashboard.menu_events_desc'), icon: 'calendar', path: '/growth/events', params: { viewMode: viewMode }, color: '#38bdf8', lightColor: '#3b82f6', iconBg: isDark ? 'from-blue-500/30 to-indigo-500/30' : 'from-sky-50 to-blue-100' },
                                { id: 'strategy', label: t('dashboard.menu_strategy'), desc: t('dashboard.menu_strategy_desc'), icon: 'map', path: '/strategy-sheet', color: '#10b981', lightColor: '#059669', iconBg: isDark ? 'from-emerald-500/30 to-green-500/30' : 'from-emerald-50 to-green-100' },
                                { id: 'hero', label: t('dashboard.menu_heroes'), desc: t('dashboard.menu_heroes_desc'), icon: 'people', path: '/hero-management', color: '#38bdf8', lightColor: '#2563eb', iconBg: isDark ? 'from-cyan-500/30 to-blue-500/30' : 'from-cyan-50 to-blue-100' }
                            ].map((card) => (
                                <Pressable
                                    key={card.id}
                                    onPress={() => {
                                        if (!auth.isLoggedIn) {
                                            showCustomAlert(t('common.member_only_title'), t('common.member_only_alert'), 'error');
                                            return;
                                        }
                                        router.push(card.path as any);
                                    }}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            flex: 1,
                                            minWidth: 260,
                                            padding: 24,
                                            borderRadius: 28,
                                            borderWidth: 2,
                                            opacity: !auth.isLoggedIn ? 0.7 : 1,
                                            backgroundColor: hovered && auth.isLoggedIn
                                                ? (isDark ? 'rgba(30, 41, 59, 1)' : 'rgba(241, 245, 249, 1)')
                                                : (isDark ? 'rgba(15, 23, 42, 0.8)' : '#ffffff'),
                                            borderColor: hovered && auth.isLoggedIn ? (isDark ? card.color : card.lightColor) : (isDark ? 'rgba(51, 65, 85, 1)' : 'rgba(226, 232, 240, 1)'),
                                            transform: [{ scale: pressed && auth.isLoggedIn ? 0.96 : (hovered && auth.isLoggedIn ? 1.05 : 1) }],
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            shadowColor: isDark ? card.color : card.lightColor,
                                            shadowOffset: { width: 0, height: hovered && auth.isLoggedIn ? 12 : 10 },
                                            shadowOpacity: hovered && auth.isLoggedIn ? 0.5 : 0.1,
                                            shadowRadius: hovered && auth.isLoggedIn ? 24 : 20,
                                            elevation: hovered && auth.isLoggedIn ? 15 : 10,
                                            // @ts-ignore - Web property
                                            cursor: 'pointer'
                                        }
                                    ]}
                                >
                                    {({ hovered }: any) => (
                                        <View className="flex-row items-center justify-center">
                                            <View className={`w-14 h-14 rounded-2xl items-center justify-center mr-4 bg-gradient-to-br ${!auth.isLoggedIn ? (isDark ? 'from-slate-800 to-slate-900' : 'from-slate-100 to-slate-200') : card.iconBg}`}
                                                style={isDark && hovered && auth.isLoggedIn ? { shadowColor: card.color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 10 } : {}}
                                            >
                                                <Ionicons name={!auth.isLoggedIn ? 'lock-closed' : card.icon as any} size={28} color={!auth.isLoggedIn ? (isDark ? '#475569' : '#94a3b8') : (isDark ? (hovered ? '#fff' : card.color) : (hovered ? card.lightColor : card.lightColor))} />
                                            </View>
                                            <View>
                                                <Text className={`text-xl font-black ${isDark ? (hovered ? 'text-white' : 'text-slate-200') : (hovered ? 'text-slate-900' : 'text-slate-800')}`} numberOfLines={1}>{card.label}</Text>
                                                <Text className={`font-semibold text-xs mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} numberOfLines={1}>{card.desc}</Text>
                                            </View>
                                        </View>
                                    )}
                                </Pressable>
                            ))}
                        </View>
                    </View>
                </View>

                {/* Section 2: Sticky Header (Weekly Program + Tabs) */}
                <View className={`w-full items-center z-50 py-3 ${isDark ? 'bg-[#060b14]/95' : 'bg-slate-50/95'}`} style={{ borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }}>
                    <View className="w-full max-w-6xl">
                        {/* Weekly Program Title & Timezone */}
                        <View className={`flex-row flex-wrap items-center justify-between gap-y-4 px-6 py-5 border ${isDark ? 'bg-slate-900 shadow-2xl shadow-black border-slate-800' : 'bg-white border-slate-200 shadow-xl'}`}>
                            <View className="flex-row items-center">
                                <View className="w-1.5 h-10 rounded-full mr-5 bg-[#38bdf8]" />
                                <View>
                                    <Text className={`text-[11px] font-black tracking-[0.25em] uppercase mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Weekly Program</Text>
                                    <Text className={`text-2xl md:text-3xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dashboard.weekly_event_title')}</Text>
                                </View>
                            </View>
                            <View className={`flex-row p-1.5 rounded-2xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200 shadow-inner'}`}>
                                <Pressable
                                    onPress={() => setTimezone('LOCAL')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            paddingHorizontal: 24,
                                            paddingVertical: 10,
                                            borderRadius: 12,
                                            backgroundColor: timezone === 'LOCAL'
                                                ? '#3b82f6'
                                                : (hovered ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : 'transparent'),
                                            borderColor: timezone === 'LOCAL' ? '#3b82f6' : (hovered ? (isDark ? '#60a5fa' : '#3b82f6') : 'transparent'),
                                            borderWidth: 1,
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                >
                                    <Text className={`text-[14px] font-black ${timezone === 'LOCAL' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>Local</Text>
                                </Pressable>
                                <Pressable
                                    onPress={() => setTimezone('UTC')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            paddingHorizontal: 24,
                                            paddingVertical: 10,
                                            borderRadius: 12,
                                            backgroundColor: timezone === 'UTC'
                                                ? '#3b82f6'
                                                : (hovered ? (isDark ? 'rgba(59, 130, 246, 0.2)' : 'rgba(59, 130, 246, 0.1)') : 'transparent'),
                                            borderColor: timezone === 'UTC' ? '#3b82f6' : (hovered ? (isDark ? '#60a5fa' : '#3b82f6') : 'transparent'),
                                            borderWidth: 1,
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                >
                                    <Text className={`text-[14px] font-black ${timezone === 'UTC' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>UTC</Text>
                                </Pressable>
                            </View>

                            {/* View Mode Toggle Switch (Orange Point) */}
                            <View className={`flex-row p-1.5 rounded-2xl border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                                <Pressable
                                    onPress={() => setViewMode('timeline')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            paddingHorizontal: 20,
                                            paddingVertical: 10,
                                            borderRadius: 12,
                                            backgroundColor: viewMode === 'timeline' ? '#f97316' : 'transparent',
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.2s',
                                        }
                                    ]}
                                >
                                    <Ionicons name="analytics" size={18} color={viewMode === 'timeline' ? 'white' : '#64748b'} />
                                </Pressable>
                                <Pressable
                                    onPress={() => setViewMode('list')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            paddingHorizontal: 20,
                                            paddingVertical: 10,
                                            borderRadius: 12,
                                            backgroundColor: viewMode === 'list' ? '#f97316' : 'transparent',
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.2s',
                                        }
                                    ]}
                                >
                                    <Ionicons name="list" size={20} color={viewMode === 'list' ? 'white' : '#64748b'} />
                                </Pressable>
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
                                                    paddingVertical: 14,
                                                    paddingHorizontal: 12,
                                                    borderTopLeftRadius: 16,
                                                    borderTopRightRadius: 16,
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
                                                        size={16}
                                                        color={isActive
                                                            ? (isDark ? tab.color : '#fff')
                                                            : (hovered ? (isDark ? '#94a3b8' : '#64748b') : (isDark ? '#475569' : '#94a3b8'))
                                                        }
                                                        style={{ marginRight: 6 }}
                                                    />
                                                    <Text className={`font-black tracking-tighter text-sm ${isActive
                                                        ? (isDark ? 'text-white' : 'text-white')
                                                        : (hovered ? (isDark ? 'text-slate-300' : 'text-slate-700') : (isDark ? 'text-slate-600' : 'text-slate-400'))}`}>
                                                        {tab.label} <Text className={`ml-1 ${isActive ? 'text-white/70' : 'opacity-60'} text-[11px]`}>{tab.count}</Text>
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
                    <View className={viewMode === 'timeline' ? 'w-full' : 'w-full max-w-6xl px-4 md:px-8'}>
                        <View className={viewMode === 'timeline' ? 'w-full' : 'flex-col gap-3'}>
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
                                                                    <Text className={`text-xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dashboard.event_active')}</Text>
                                                                    <Ionicons name={isActiveExpanded ? "chevron-up" : "chevron-down"} size={20} color={isDark ? '#475569' : '#94a3b8'} style={{ marginLeft: 6 }} />
                                                                </TouchableOpacity>
                                                                {activeEvents.length > 0 && <View className="bg-emerald-500/10 px-3 py-1 rounded-full"><Text className="text-emerald-500 font-black text-xs">{activeEvents.length}</Text></View>}
                                                            </View>
                                                            {isActiveExpanded && (
                                                                activeEvents.length > 0 ? (
                                                                    <View className="flex-row flex-wrap -mx-2">
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
                                                                {upcomingEvents.length > 0 && <View className="bg-sky-500/10 px-3 py-1 rounded-full"><Text className="text-sky-500 font-black text-xs">{upcomingEvents.length}</Text></View>}
                                                            </View>
                                                            {isUpcomingExpanded && (
                                                                upcomingEvents.length > 0 ? (
                                                                    <View className="flex-row flex-wrap -mx-2">
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
                                                                {expiredEvents.length > 0 && <View className="bg-slate-500/10 px-3 py-1 rounded-full"><Text className="text-slate-500 font-black text-xs">{expiredEvents.length}</Text></View>}
                                                            </View>
                                                            {isExpiredExpanded ? (
                                                                expiredEvents.length > 0 ? (
                                                                    <View className="flex-row flex-wrap -mx-2 opacity-60">
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
                <View className="mt-24 mb-32 items-center">
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
            </ScrollView>


            {/* Modals */}
            <Modal
                visible={loginModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setLoginModalVisible(false)}
            >
                <View className="flex-1 bg-black/85 items-center justify-center p-6">
                    <BlurView intensity={60} className="absolute inset-0" />
                    <View className={`w-full max-w-sm p-10 rounded-[48px] border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <View className="items-center mb-8">
                            <View className={`w-16 h-16 rounded-3xl items-center justify-center mb-4 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                                <Ionicons name="shield-checkmark" size={32} color="#38bdf8" />
                            </View>
                            <Text className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('admin.auth_title')}</Text>
                            <Text className={`mt-2 text-sm font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('admin.auth_desc')}</Text>
                        </View>

                        <View className="space-y-6 mb-12">
                            <View className="relative">
                                <View className="absolute left-6 top-6 z-10">
                                    <Ionicons name="person" size={20} color={isDark ? "#38bdf8" : "#2563eb"} />
                                </View>
                                <TextInput
                                    placeholder={t('dashboard.lordName')}
                                    placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                                    value={loginInput}
                                    onChangeText={(t) => { setLoginInput(t); setLoginError(''); }}
                                    autoCapitalize="none"
                                    onSubmitEditing={() => loginPasswordRef.current?.focus()}
                                    blurOnSubmit={false}
                                    className={`p-6 pl-16 rounded-3xl font-black border-2 text-lg ${isDark ? 'bg-slate-950 text-white border-slate-800 focus:border-blue-500/50' : 'bg-slate-50 text-slate-800 border-slate-100 focus:border-blue-500'}`}
                                />
                            </View>

                            <View className="relative mt-2">
                                <View className="absolute left-6 top-6 z-10">
                                    <Ionicons name="lock-closed" size={20} color={isDark ? "#38bdf8" : "#2563eb"} />
                                </View>
                                <TextInput
                                    ref={loginPasswordRef}
                                    placeholder={t('dashboard.password')}
                                    placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                                    value={passwordInput}
                                    onChangeText={(t) => { setPasswordInput(t); setLoginError(''); }}
                                    secureTextEntry={!showModalPw}
                                    autoCapitalize="none"
                                    onSubmitEditing={handleLogin}
                                    className={`p-6 pl-16 pr-14 rounded-3xl font-black border-2 text-lg ${isDark ? 'bg-slate-950 text-white border-slate-800 focus:border-blue-500/50' : 'bg-slate-50 text-slate-800 border-slate-100 focus:border-blue-500'}`}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowModalPw(!showModalPw)}
                                    className="absolute right-4 top-0 bottom-0 justify-center p-2"
                                >
                                    <Ionicons name={showModalPw ? "eye-off-outline" : "eye-outline"} size={20} color="#475569" />
                                </TouchableOpacity>
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
                                <Text className={`text-center font-bold text-lg ${isDark ? 'text-slate-600' : 'text-slate-500'}`}>{t('admin.cancel_btn')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleLogin}
                                className="flex-[2] bg-[#0091ff] py-5 rounded-[28px] shadow-2xl shadow-blue-500/60 items-center justify-center hover:bg-[#1a9dff] active:scale-95 transition-all"
                            >
                                <Text className="text-white text-center font-black text-xl tracking-tight">{t('admin.login_btn')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal >

            <Modal visible={adminMenuVisible} transparent animationType="slide" onRequestClose={() => setAdminMenuVisible(false)}>
                <View className="flex-1 bg-black/70 items-center justify-center p-6">
                    <View className={`w-full max-w-sm p-8 rounded-[40px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-950/95 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <View className="items-center justify-center mb-8 pt-2">
                            <View className={`w-16 h-16 rounded-3xl items-center justify-center mb-4 ${isDark ? 'bg-sky-500/20' : 'bg-sky-50'}`}>
                                <Ionicons name="shield-checkmark" size={32} color={isDark ? "#38bdf8" : "#2563eb"} />
                            </View>
                            <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {isSuperAdmin ? t('admin.menu_title_super') : t('admin.menu_title_alliance')}
                            </Text>
                            <View className={`mt-2 px-4 py-2 rounded-full ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
                                <Text className={`text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    ID: <Text className={isDark ? 'text-sky-400' : 'text-sky-600'}>{auth.adminName}</Text> ({auth.role === 'master' ? t('dashboard.role_super_admin') : auth.role === 'alliance_admin' ? t('dashboard.role_alliance_admin') : auth.role === 'admin' ? t('dashboard.role_admin') : t('dashboard.role_general')})
                                </Text>
                            </View>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} className="flex-none">
                            <TouchableOpacity
                                onPress={async () => {
                                    await logout();
                                    setLoginInput('');
                                    setPasswordInput('');
                                    setInputUserId('');
                                    setInputPassword('');
                                    setAdminMenuVisible(false);
                                    setAllianceInfo(null, null);
                                    setIsGateOpen(true);
                                }}
                                // @ts-ignore
                                onMouseEnter={() => setAdminMenuHover('logout')}
                                onMouseLeave={() => setAdminMenuHover(null)}
                                className={`p-5 rounded-[24px] mb-3 flex-row items-center justify-center border transition-all duration-300 ${adminMenuHover === 'logout' ? 'bg-red-500/20 border-red-500/50' : (isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200')}`}
                            >
                                <Ionicons name="log-out-outline" size={22} color="#ef4444" style={{ marginRight: 10 }} />
                                <Text className={`font-bold text-lg ${isDark ? 'text-red-400' : 'text-red-500'}`}>{t('admin.logout')}</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setAdminDashboardVisible(true)}
                                // @ts-ignore

                                className={`p-5 rounded-[24px] mb-3 flex-row items-center justify-center border transition-all duration-300 ${adminMenuHover === 'members' ? 'bg-sky-500/20 border-sky-500/50' : (isDark ? 'bg-sky-500/5 border-sky-500/15' : 'bg-sky-50 border-sky-200')}`}
                            >
                                <Ionicons name="people-outline" size={22} color={isDark ? '#38bdf8' : '#0284c7'} style={{ marginRight: 10 }} />
                                <Text className={`font-bold text-lg ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{t('admin.manage_members')}</Text>
                            </TouchableOpacity>

                            {!!isSuperAdmin && (
                                <View>
                                    <TouchableOpacity
                                        onPress={() => setShowAdminList(!showAdminList)}
                                        // @ts-ignore
                                        onMouseEnter={() => setAdminMenuHover('staff')}
                                        onMouseLeave={() => setAdminMenuHover(null)}
                                        className={`p-6 rounded-[24px] mb-4 flex-row items-center justify-center border transition-all duration-300 ${adminMenuHover === 'staff' ? 'bg-indigo-600/10 border-indigo-500/40' : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm')}`}
                                    >
                                        <Ionicons name="people-outline" size={20} color={adminMenuHover === 'staff' ? '#818cf8' : '#818cf8'} style={{ marginRight: 10 }} />
                                        <Text className={`font-bold text-lg ${adminMenuHover === 'staff' ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : (isDark ? 'text-white' : 'text-slate-800')}`}>{t('admin.manage_staff')}</Text>
                                    </TouchableOpacity>

                                    {!!showAdminList && (
                                        <View className={`p-4 rounded-[28px] mb-4 border ${isDark ? 'bg-black/20 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                            <View className="mb-3 space-y-2">
                                                <TextInput className={`w-full p-3 rounded-xl border text-sm font-semibold ${isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200'}`} placeholder={t('admin.add_staff_placeholder')} placeholderTextColor={isDark ? "#475569" : "#94a3b8"} value={newAdminName} onChangeText={setNewAdminName} />
                                                <TextInput className={`w-full p-3 rounded-xl border text-sm font-semibold ${isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200'}`} placeholder={t('admin.add_staff_pw_placeholder')} placeholderTextColor={isDark ? "#475569" : "#94a3b8"} value={newAdminPassword} onChangeText={setNewAdminPassword} secureTextEntry={true} />
                                                <View className="flex-row gap-2 pt-1">
                                                    <TouchableOpacity
                                                        onPress={() => setNewAdminRole(newAdminRole === 'admin' ? 'alliance_admin' : 'admin')}
                                                        className={`flex-[2.5] py-3 px-4 justify-center items-center rounded-xl border ${newAdminRole === 'alliance_admin' ? (isDark ? 'bg-sky-600/20 border-sky-500' : 'bg-sky-50 border-sky-200') : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200')}`}
                                                    >
                                                        <Text className={`${newAdminRole === 'alliance_admin' ? 'text-sky-500' : 'text-slate-400'} text-xs font-black`}>
                                                            {newAdminRole === 'alliance_admin' ? t('admin.role_alliance_admin_label') : t('admin.role_op_admin_label')}
                                                        </Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={async () => { const hashed = newAdminPassword ? await hashPassword(newAdminPassword) : ''; if (await addAdmin(newAdminName, auth.adminName || '', newAdminRole, hashed)) { setNewAdminName(''); setNewAdminPassword(''); showCustomAlert(t('common.success'), t('admin.staff_added_msg'), 'success'); } }} className="flex-1 bg-blue-600 py-3 justify-center items-center rounded-xl shadow-lg shadow-blue-500/30"><Ionicons name="add" size={20} color="white" /></TouchableOpacity>
                                                </View>
                                            </View>
                                            <View className="max-h-40 rounded-xl overflow-hidden">
                                                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true} style={{ flexGrow: 0 }}>
                                                    {dynamicAdmins.map(a => (
                                                        <View key={a.name} className={`flex-row justify-between items-center py-3 px-4 border-b ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
                                                            <Text className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{a.name}</Text>
                                                            <TouchableOpacity onPress={() => removeAdmin(a.name)} hitSlop={10}><Ionicons name="trash-outline" size={16} color="#ef4444" /></TouchableOpacity>
                                                        </View>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            )}

                            {auth.isLoggedIn && auth.role !== 'master' && (
                                <TouchableOpacity
                                    onPress={() => setIsUserPassChangeOpen(true)}
                                    // @ts-ignore
                                    onMouseEnter={() => setAdminMenuHover('password')}
                                    onMouseLeave={() => setAdminMenuHover(null)}
                                    className={`p-5 rounded-[24px] mb-3 flex-row items-center justify-center border transition-all duration-300 ${adminMenuHover === 'password' ? 'bg-amber-500/20 border-amber-500/50' : (isDark ? 'bg-amber-500/5 border-amber-500/15' : 'bg-amber-50 border-amber-200')}`}
                                >
                                    <Ionicons name="key-outline" size={22} color={isDark ? '#fbbf24' : '#d97706'} style={{ marginRight: 10 }} />
                                    <Text className={`font-bold text-lg ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{t('admin.change_pw')}</Text>
                                </TouchableOpacity>
                            )}

                            {!!isSuperAdmin && (
                                <View className={`mt-4 pt-6 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <Text className={`font-bold mb-4 text-center text-[10px] uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('admin.super_admin_manage')}</Text>

                                    <TouchableOpacity
                                        onPress={() => { setIsSuperAdminDashboardVisible(true); }}
                                        // @ts-ignore
                                        onMouseEnter={() => setAdminMenuHover('super')}
                                        onMouseLeave={() => setAdminMenuHover(null)}
                                        className={`p-6 rounded-[24px] mb-4 flex-row items-center justify-center border transition-all duration-300 ${adminMenuHover === 'super' ? 'bg-slate-800/50 border-slate-700' : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm')}`}
                                    >
                                        <Ionicons name="shield-checkmark-outline" size={22} color={adminMenuHover === 'super' ? '#38bdf8' : '#38bdf8'} style={{ marginRight: 10 }} />
                                        <Text className={`font-bold text-lg ${adminMenuHover === 'super' ? (isDark ? 'text-sky-400' : 'text-sky-600') : (isDark ? 'text-white' : 'text-slate-800')}`}>{t('admin.super_dashboard_title')}</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>

                        <View className="items-center justify-center mt-4 pb-2">
                            <TouchableOpacity
                                onPress={() => setAdminMenuVisible(false)}
                                className={`w-full p-5 rounded-[24px] flex-row items-center justify-center border ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                            >
                                <Ionicons name="close-circle-outline" size={20} color={isDark ? '#94a3b8' : '#64748b'} style={{ marginRight: 8 }} />
                                <Text className={`font-bold text-lg ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('admin.close_btn')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
                        <View className="mb-10 px-10">
                            <Text className={`text-xs font-black tracking-[0.3em] uppercase mb-1 ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{t('admin.super_admin_manage')}</Text>
                            <Text className={`text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('admin.super_dashboard_title')}</Text>
                            <View className="w-12 h-1 bg-sky-500 rounded-full mt-4" />
                        </View>

                        {/* Stats / Interactive Tabs */}
                        <View className="flex-row gap-4 mb-8 px-10">
                            <Pressable
                                onPress={() => setSuperAdminTab('pending')}
                                style={({ hovered, pressed }: any) => [
                                    {
                                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                        transition: 'all 0.2s'
                                    }
                                ]}
                                className={`flex-1 p-6 rounded-[32px] border ${superAdminTab === 'pending' ? 'border-sky-500 bg-sky-500/10 shadow-lg shadow-sky-500/20' : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')}`}
                            >
                                <Text className={`text-lg font-black uppercase tracking-widest mb-2 ${superAdminTab === 'pending' ? 'text-sky-500' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{t('admin.pending_count')}</Text>
                                <Text className={`text-4xl font-black ${superAdminTab === 'pending' ? (isDark ? 'text-sky-400' : 'text-sky-500') : (isDark ? 'text-slate-700' : 'text-slate-300')}`}>
                                    {allRequests.filter(r => r.status === 'pending').length}
                                </Text>
                            </Pressable>
                            <Pressable
                                onPress={() => setSuperAdminTab('alliances')}
                                style={({ hovered, pressed }: any) => [
                                    {
                                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                        transition: 'all 0.2s'
                                    }
                                ]}
                                className={`flex-1 p-6 rounded-[32px] border ${superAdminTab === 'alliances' ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20' : (isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm')}`}
                            >
                                <Text className={`text-lg font-black uppercase tracking-widest mb-2 ${superAdminTab === 'alliances' ? 'text-emerald-500' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{t('admin.approved_count')}</Text>
                                <Text className={`text-4xl font-black ${superAdminTab === 'alliances' ? (isDark ? 'text-emerald-400' : 'text-emerald-500') : (isDark ? 'text-slate-700' : 'text-slate-300')}`}>
                                    {allRequests.filter(r => r.status === 'approved').length}
                                </Text>
                            </Pressable>
                        </View>

                        <View className="flex-row items-center justify-between mb-8 px-10">
                            <View>
                                <View className="flex-row items-center gap-3 mb-1">
                                    <View className="w-1.5 h-6 bg-sky-500 rounded-full" />
                                    <Text className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                        {superAdminTab === 'pending' ? t('admin.pending_queue') : t('admin.registered_alliances')}
                                    </Text>
                                </View>
                                <Text className={`text-xs font-bold pl-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {superAdminTab === 'pending' ? t('admin.pending_desc') : t('admin.registered_desc')}
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
                                    className={`flex-row items-center px-4 py-3 rounded-2xl border transition-all ${selectedReqIds.size > 0 ? 'border-sky-500 bg-sky-500/10' : (isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white shadow-sm')}`}
                                >
                                    <Ionicons
                                        name={selectedReqIds.size === allRequests.filter(r => r.status === 'pending').length ? "checkbox" : "square-outline"}
                                        size={20}
                                        color={selectedReqIds.size > 0 ? "#38bdf8" : (isDark ? "#475569" : "#94a3b8")}
                                    />
                                    <Text className={`ml-2 font-black text-xs ${selectedReqIds.size > 0 ? (isDark ? 'text-white' : 'text-slate-900') : 'text-slate-500'}`}>
                                        {t('admin.select_all')}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {selectedReqIds.size > 0 && (
                            <View className={`flex-row gap-3 mb-8 mx-10 p-4 rounded-[24px] border shadow-xl transition-all ${isDark ? 'bg-slate-900/95 border-sky-500/20' : 'bg-white border-sky-100 shadow-sky-200/40'}`}>
                                <View className="flex-1 flex-row items-center bg-sky-500/10 px-4 py-2 rounded-xl">
                                    <Ionicons name="checkbox" size={18} color="#38bdf8" />
                                    <Text className={`ml-2 font-black text-base ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>
                                        {selectedReqIds.size}{t('common.count')} <Text className="text-xs font-bold opacity-60">{t('common.selected')}</Text>
                                    </Text>
                                </View>
                                <View className="flex-row gap-2">
                                    <TouchableOpacity
                                        onPress={handleBulkReject}
                                        activeOpacity={0.7}
                                        className={`px-4 py-3 rounded-xl border ${isDark ? 'border-red-500/30 bg-red-500/10' : 'border-red-100 bg-red-50'}`}
                                    >
                                        <Text className="text-xs font-bold text-red-500">{t('admin.reject_selected')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleBulkApprove}
                                        activeOpacity={0.7}
                                        className="px-6 py-3 bg-sky-500 rounded-xl shadow-lg shadow-sky-500/20 flex-row items-center"
                                    >
                                        <Ionicons name="checkmark-circle" size={16} color="white" style={{ marginRight: 6 }} />
                                        <Text className="font-black text-white text-sm">{t('admin.approve_selected')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        <View className="px-10">
                            {isSuperAdminLoading ? (
                                <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 40 }} />
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
                                        allRequests.filter(r => superAdminTab === 'pending' ? r.status === 'pending' : r.status === 'approved').map((req) => (
                                            <View key={req.id} className={`p-4 rounded-[24px] border mb-3 shadow-md ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                                <View className="flex-row">
                                                    {superAdminTab === 'pending' && (
                                                        <TouchableOpacity
                                                            onPress={() => toggleSelectRequest(req.id)}
                                                            className="mr-6 justify-center"
                                                        >
                                                            <View className={`w-10 h-10 rounded-2xl items-center justify-center border-2 ${selectedReqIds.has(req.id) ? 'bg-sky-500 border-sky-500' : (isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200')}`}>
                                                                {selectedReqIds.has(req.id) && <Ionicons name="checkmark" size={24} color="white" />}
                                                            </View>
                                                        </TouchableOpacity>
                                                    )}
                                                    <View style={{ flex: 1 }}>
                                                        <View className="flex-row justify-between mb-4">
                                                            <View style={{ flex: 1 }}>
                                                                <View className="flex-row items-center mb-1">
                                                                    <Text className="text-xs font-black px-2 py-0.5 rounded bg-sky-500/10 text-sky-500 mr-2">{req.serverId}</Text>
                                                                    <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{req.allianceId}</Text>
                                                                </View>
                                                            </View>

                                                            {superAdminTab === 'pending' ? (
                                                                <View className="flex-row gap-2">
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
                                                                <View className="flex-row gap-2">
                                                                    <TouchableOpacity
                                                                        onPress={() => handleResetPasswordAdmin(req)}
                                                                        activeOpacity={0.7}
                                                                        className={`px-3 py-2 rounded-xl border flex-row items-center ${isDark ? 'border-amber-500/30 bg-amber-500/10' : 'border-amber-100 bg-amber-50'}`}
                                                                    >
                                                                        <Ionicons name="key-outline" size={14} color="#f59e0b" />
                                                                        <Text className="text-[10px] font-bold text-amber-500 ml-1">{t('admin.reset_pw_short')}</Text>
                                                                    </TouchableOpacity>
                                                                    <TouchableOpacity
                                                                        onPress={() => handleDeleteAlliance(req)}
                                                                        activeOpacity={0.7}
                                                                        className={`px-3 py-2 rounded-xl border flex-row items-center ${isDark ? 'border-red-500/30 bg-red-500/10' : 'border-red-100 bg-red-50'}`}
                                                                    >
                                                                        <Ionicons name="trash-outline" size={14} color="#ef4444" />
                                                                        <Text className="text-[10px] font-bold text-red-500 ml-1">{t('admin.delete_short')}</Text>
                                                                    </TouchableOpacity>
                                                                </View>
                                                            )}
                                                        </View>

                                                        <View className={`flex-row justify-between items-center p-4 rounded-2xl ${isDark ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
                                                            <View>
                                                                <Text className={`text-sm font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Admin ID: <Text className={`text-lg ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{req.adminId}</Text></Text>
                                                                <Text className={`text-sm font-bold mt-1.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Contact: <Text className={`text-lg ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{req.contact || '-'}</Text></Text>
                                                            </View>
                                                            <Text className={`text-base font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{new Date(req.requestedAt).toLocaleDateString()}</Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            </View>
                                        ))
                                    )}
                                </View>
                            )}
                        </View>
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
                                    <Text className={`text-[10px] font-black tracking-widest uppercase ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{t('popup.announcement_label')}</Text>
                                    <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('popup.announcement')}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Content */}
                        <View className="px-8 py-6">
                            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
                                <Text className={`text-base leading-7 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {notice?.content || t('popup.noContent')}
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
                                <Text className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('popup.dontShowAgain')}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Buttons */}
                        <View className="flex-row gap-3 px-8 pb-8">
                            <TouchableOpacity
                                onPress={() => dismissNoticePopup(false, true)}
                                className={`flex-1 py-4 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                            >
                                <Text className={`text-center font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('popup.dontShowToday')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => dismissNoticePopup(noticePopupDontShow, false)}
                                className={`flex-[1.5] py-4 rounded-2xl ${isDark ? 'bg-amber-500' : 'bg-amber-500'}`}
                            >
                                <Text className="text-center font-black text-white">{t('common.confirm')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Password Change Modal */}
            <Modal visible={isUserPassChangeOpen} transparent animationType="fade">
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <BlurView intensity={40} className="absolute inset-0" />
                    <View className={`w-full max-w-sm rounded-[40px] border p-8 shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800/60' : 'bg-white border-slate-100'}`}>
                        <View className="items-center mb-8">
                            <View className={`w-20 h-20 rounded-3xl items-center justify-center mb-4 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                                <Ionicons name="key" size={40} color="#f59e0b" />
                            </View>
                            <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('auth.changePassword')}</Text>
                            <Text className={`mt-2 text-center text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('auth.newPasswordDesc')}</Text>
                        </View>

                        <View className="flex-col gap-4 mb-8">
                            <View>
                                <Text className={`text-[10px] font-black mb-2 ml-1 uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>New Password</Text>
                                <View className="relative">
                                    <TextInput
                                        className={`w-full h-16 px-6 pr-14 rounded-2xl border font-bold ${isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-200'}`}
                                        placeholder={t('auth.enterNewPassword')}
                                        placeholderTextColor={isDark ? "#334155" : "#94a3b8"}
                                        value={newPassword}
                                        onChangeText={setNewPassword}
                                        secureTextEntry={!showPass1}
                                    />
                                    <TouchableOpacity
                                        onPressIn={() => setShowPass1(true)}
                                        onPressOut={() => setShowPass1(false)}
                                        activeOpacity={0.5}
                                        className="absolute right-4 top-4 w-8 h-8 items-center justify-center"
                                    >
                                        <Ionicons name={showPass1 ? "eye-off-outline" : "eye-outline"} size={20} color={isDark ? "#475569" : "#94a3b8"} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <View>
                                <Text className={`text-[10px] font-black mb-2 mt-4 ml-1 uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Confirm Password</Text>
                                <View className="relative">
                                    <TextInput
                                        className={`w-full h-16 px-6 pr-14 rounded-2xl border font-bold ${isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-200'}`}
                                        placeholder={t('auth.confirmPasswordLabel')}
                                        placeholderTextColor={isDark ? "#334155" : "#94a3b8"}
                                        value={confirmPassword}
                                        onChangeText={setConfirmPassword}
                                        secureTextEntry={!showPass2}
                                    />
                                    <TouchableOpacity
                                        onPressIn={() => setShowPass2(true)}
                                        onPressOut={() => setShowPass2(false)}
                                        activeOpacity={0.5}
                                        className="absolute right-4 top-4 w-8 h-8 items-center justify-center"
                                    >
                                        <Ionicons name={showPass2 ? "eye-off-outline" : "eye-outline"} size={20} color={isDark ? "#475569" : "#94a3b8"} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>

                        <View className="flex-row gap-4">
                            <TouchableOpacity
                                onPress={() => {
                                    setIsUserPassChangeOpen(false);
                                    setNewPassword('');
                                    setConfirmPassword('');
                                }}
                                className={`flex-1 h-16 rounded-2xl items-center justify-center border ${isDark ? 'border-slate-800 bg-slate-800/30' : 'border-slate-50 bg-slate-50'}`}
                            >
                                <Text className={`font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={async () => {
                                    if (!auth.adminName) {
                                        showCustomAlert(t('common.error'), t('auth.loginRequired'), 'error');
                                        return;
                                    }
                                    if (!newPassword || !confirmPassword) {
                                        showCustomAlert(t('common.warning'), t('common.required'), 'warning');
                                        return;
                                    }
                                    if (newPassword !== confirmPassword) {
                                        showCustomAlert(t('common.warning'), t('auth.passwordMismatch'), 'warning');
                                        return;
                                    }
                                    if (newPassword.length < 4) {
                                        showCustomAlert(t('common.warning'), t('auth.passwordLength'), 'warning');
                                        return;
                                    }

                                    try {
                                        setIsChangingPassword(true);
                                        const hashed = await hashPassword(newPassword);
                                        const userRef = doc(db, 'users', auth.adminName!);
                                        await updateDoc(userRef, {
                                            password: hashed,
                                            updatedAt: Date.now()
                                        });

                                        showCustomAlert(t('common.success'), t('auth.changeSuccess'), 'success');
                                        setIsUserPassChangeOpen(false);
                                        setNewPassword('');
                                        setConfirmPassword('');
                                        setAdminMenuVisible(false);
                                    } catch (err: any) {
                                        showCustomAlert(t('common.error'), t('auth.changeError') + ' ' + err.message, 'error');
                                    } finally {
                                        setIsChangingPassword(false);
                                    }
                                }}
                                disabled={isChangingPassword}
                                className="flex-[2] h-16 bg-amber-500 rounded-2xl items-center justify-center shadow-lg shadow-amber-500/30"
                            >
                                {isChangingPassword ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <Text className="text-white font-black text-lg">{t('auth.change')}</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Notice Detail Modal */}
            <Modal visible={noticeDetailVisible} transparent animationType="fade" onRequestClose={() => setNoticeDetailVisible(false)}>
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <BlurView intensity={40} className="absolute inset-0" />
                    <View className={`w-full max-w-md rounded-[32px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <View className={`px-8 py-6 border-b ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                                        <Ionicons name="notifications" size={24} color="#f59e0b" />
                                    </View>
                                    <View>
                                        <Text className={`text-[10px] font-black tracking-widest uppercase ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>{t('dashboard.notice_label')}</Text>
                                        <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dashboard.noticeDetail')}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setNoticeDetailVisible(false)} className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <Ionicons name="close" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View className="p-8">
                            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                                <Text className={`text-base leading-7 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                                    {notice?.content || t('popup.noContent')}
                                </Text>
                            </ScrollView>
                        </View>
                        <View className="px-8 pb-8">
                            <TouchableOpacity
                                onPress={() => setNoticeDetailVisible(false)}
                                className={`w-full py-4 rounded-2xl items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                            >
                                <Text className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('common.close')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Notice Edit Modal */}
            <Modal visible={noticeModalVisible} transparent animationType="fade" onRequestClose={() => setNoticeModalVisible(false)}>
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <BlurView intensity={40} className="absolute inset-0" />
                    <View className={`w-full max-w-md rounded-[32px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <View className={`px-8 py-6 border-b ${isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                                        <Ionicons name="create" size={24} color="#3b82f6" />
                                    </View>
                                    <View>
                                        <Text className={`text-[10px] font-black tracking-widest uppercase ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{t('admin.setting_label')}</Text>
                                        <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('admin.noticeSetting')}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setNoticeModalVisible(false)} className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <Ionicons name="close" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View className="p-8">
                            <Text className={`text-xs font-black uppercase tracking-widest mb-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('admin.noticeContent')}</Text>
                            <TextInput
                                multiline
                                numberOfLines={6}
                                value={editNoticeContent}
                                onChangeText={setEditNoticeContent}
                                className={`w-full p-4 rounded-2xl border font-bold text-sm ${isDark ? 'bg-slate-950 text-white border-slate-800 focus:border-blue-500' : 'bg-slate-50 text-slate-900 border-slate-200 focus:border-blue-500'}`}
                                placeholder={t('admin.noticePlaceholder')}
                                placeholderTextColor={isDark ? "#334155" : "#94a3b8"}
                                style={{ textAlignVertical: 'top' }}
                            />

                            <View className="flex-row items-center justify-between mt-6">
                                <View>
                                    <Text className={`text-sm font-black ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{t('admin.dashboardExposure')}</Text>
                                    <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('admin.noticeActiveDesc')}</Text>
                                </View>
                                <Switch
                                    value={editNoticeVisible}
                                    onValueChange={setEditNoticeVisible}
                                    trackColor={{ false: '#334155', true: '#3b82f6' }}
                                    thumbColor={isDark ? '#fff' : '#fff'}
                                />
                            </View>
                        </View>
                        <View className="flex-row gap-3 px-8 pb-8">
                            <TouchableOpacity
                                onPress={() => setNoticeModalVisible(false)}
                                className={`flex-1 py-4 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                            >
                                <Text className={`text-center font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSaveNotice}
                                className="flex-[2] bg-blue-500 py-4 rounded-2xl shadow-lg shadow-blue-500/30"
                            >
                                <Text className="text-center font-black text-white">{t('common.save')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Install Guide Modal */}
            <Modal visible={installModalVisible} transparent animationType="fade" onRequestClose={() => setInstallModalVisible(false)}>
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <BlurView intensity={40} className="absolute inset-0" />
                    <View className={`w-full max-w-md rounded-[40px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <View className={`px-10 py-5 border-b ${isDark ? 'bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border-blue-500/20' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100'}`}>
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                                        <Ionicons name="download" size={24} color="#3b82f6" />
                                    </View>
                                    <View>
                                        <Text className={`text-[9px] font-black tracking-widest uppercase ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>PWA INSTALL</Text>
                                        <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('install.title')}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setInstallModalVisible(false)} className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <Ionicons name="close" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View className="p-8 pb-4">
                            <View className="gap-6">
                                <View className="flex-row items-center">
                                    <View className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                        <Text className="text-sm font-black text-blue-500">1</Text>
                                    </View>
                                    <Text className={`text-base font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('install.step1')}</Text>
                                </View>
                                <View className="flex-row items-center">
                                    <View className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                        <Text className="text-sm font-black text-blue-500">2</Text>
                                    </View>
                                    <Text className={`text-base font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('install.step2')}</Text>
                                </View>
                                <View className="flex-row items-center">
                                    <View className={`w-10 h-10 rounded-full items-center justify-center mr-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                        <Text className="text-sm font-black text-blue-500">3</Text>
                                    </View>
                                    <Text className={`text-base font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('install.step3')}</Text>
                                </View>
                            </View>
                        </View>
                        <View className="px-10 pb-10 pt-0 items-center justify-center">
                            <Pressable
                                onPress={() => setInstallModalVisible(false)}
                                style={({ hovered, pressed }: any) => [
                                    {
                                        paddingHorizontal: 48,
                                        paddingVertical: 5,
                                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                        opacity: pressed ? 0.8 : 1,
                                        transition: 'all 0.2s',
                                        // @ts-ignore
                                        textShadow: hovered ? '0 0 12px rgba(59, 130, 246, 0.4)' : 'none'
                                    }
                                ]}
                            >
                                <Text className="text-blue-500 font-black text-xl tracking-widest">{t('common.confirm')}</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Gate Manual (Login Guide) */}
            <Modal visible={isGateManualVisible} transparent animationType="fade" onRequestClose={() => setIsGateManualVisible(false)}>
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <BlurView intensity={40} className="absolute inset-0" />
                    <View className={`w-full max-w-2xl h-[70%] rounded-[40px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <View className={`px-10 py-5 border-b ${isDark ? 'bg-gradient-to-r from-slate-950 to-slate-900 border-slate-800' : 'bg-gradient-to-r from-slate-50 to-white border-slate-100'}`}>
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-5 ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
                                        <Ionicons name="help-circle" size={26} color="#f59e0b" />
                                    </View>
                                    <View>
                                        <Text className={`text-[9px] font-black tracking-[0.3em] uppercase mb-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>Gate Guide</Text>
                                        <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.loginTitle')}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setIsGateManualVisible(false)} className={`w-12 h-12 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <Ionicons name="close" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        {renderGateManualContent()}
                        <View className="px-10 pb-10 pt-0 items-center justify-center">
                            <Pressable
                                onPress={() => setIsGateManualVisible(false)}
                                style={({ hovered, pressed }: any) => [
                                    {
                                        paddingHorizontal: 48,
                                        paddingVertical: 5,
                                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                        opacity: pressed ? 0.8 : 1,
                                        transition: 'all 0.2s',
                                        // @ts-ignore
                                        textShadow: hovered ? '0 0 12px rgba(245, 158, 11, 0.4)' : 'none'
                                    }
                                ]}
                            >
                                <Text className="text-amber-500 font-black text-xl tracking-widest">{t('common.confirm')}</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Main Manual (Dashboard Guide) */}
            <Modal visible={isManualVisible} transparent animationType="fade" onRequestClose={() => setIsManualVisible(false)}>
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <BlurView intensity={40} className="absolute inset-0" />
                    <View className={`w-full max-w-2xl h-[70%] rounded-[40px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <View className={`px-10 py-5 border-b ${isDark ? 'bg-gradient-to-r from-slate-950 to-slate-900 border-slate-800' : 'bg-gradient-to-r from-slate-50 to-white border-slate-100'}`}>
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-5 ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
                                        <Ionicons name="book" size={26} color="#f59e0b" />
                                    </View>
                                    <View>
                                        <Text className={`text-[9px] font-black tracking-[0.3em] uppercase mb-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>User Manual</Text>
                                        <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.mainManualTitle')}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setIsManualVisible(false)} className={`w-12 h-12 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <Ionicons name="close" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        {renderMainManualContent()}
                        <View className="px-10 pb-10 pt-0 items-center justify-center">
                            <Pressable
                                onPress={() => setIsManualVisible(false)}
                                style={({ hovered, pressed }: any) => [
                                    {
                                        paddingHorizontal: 48,
                                        paddingVertical: 5,
                                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                        opacity: pressed ? 0.8 : 1,
                                        transition: 'all 0.2s',
                                        // @ts-ignore
                                        textShadow: hovered ? '0 0 12px rgba(245, 158, 11, 0.4)' : 'none'
                                    }
                                ]}
                            >
                                <Text className="text-amber-500 font-black text-xl tracking-widest">{t('common.confirm')}</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Custom Alert Modal */}
            <Modal visible={customAlert.visible} transparent animationType="fade">
                <View className="flex-1 bg-black/60 items-center justify-center p-6">
                    <BlurView intensity={20} className="absolute inset-0" />
                    <View className={`w-full max-w-sm rounded-[40px] border p-8 shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <View className="items-center mb-6">
                            <View className={`w-16 h-16 rounded-3xl items-center justify-center mb-4 ${customAlert.type === 'success' ? 'bg-emerald-500/20' :
                                customAlert.type === 'error' ? 'bg-red-500/20' :
                                    customAlert.type === 'warning' ? 'bg-amber-500/20' : 'bg-sky-500/20'
                                }`}>
                                <Ionicons
                                    name={
                                        customAlert.type === 'success' ? 'checkmark-circle' :
                                            customAlert.type === 'error' ? 'alert-circle' :
                                                customAlert.type === 'warning' ? 'warning' : 'help-circle'
                                    }
                                    size={32}
                                    color={
                                        customAlert.type === 'success' ? '#10b981' :
                                            customAlert.type === 'error' ? '#ef4444' :
                                                customAlert.type === 'warning' ? '#f59e0b' : '#0ea5e9'
                                    }
                                />
                            </View>
                            <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{customAlert.title}</Text>
                            <Text className={`mt-2 text-center font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{customAlert.message}</Text>
                        </View>

                        {customAlert.type === 'confirm' ? (
                            <View className="flex-row gap-3">
                                <TouchableOpacity
                                    onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                                    className={`flex-1 py-4 rounded-3xl border ${isDark ? 'border-slate-800' : 'border-slate-100'}`}
                                >
                                    <Text className={`text-center font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('common.cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        setCustomAlert({ ...customAlert, visible: false });
                                        if (customAlert.onConfirm) customAlert.onConfirm();
                                    }}
                                    className="flex-[2] bg-sky-500 py-4 rounded-3xl shadow-lg shadow-sky-500/30"
                                >
                                    <Text className="text-center font-black text-white">{t('common.confirm')}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                                className="bg-sky-500 py-4 rounded-3xl shadow-lg shadow-sky-500/30"
                            >
                                <Text className="text-center font-black text-white">{t('common.confirm')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );

}
