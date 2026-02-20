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
// @ts-ignore
import { useFirestoreNotice } from '../hooks/useFirestoreNotice';
import { useFirestoreThemeConfig } from '../hooks/useFirestoreThemeConfig';
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

const DATE_RANGE_IDS = [
    'a_castle', 'server_castle', 'a_operation', 'alliance_operation',
    'a_trade', 'alliance_trade', 'alliance_champion', 'a_weapon',
    'alliance_frost_league', 'server_svs_prep', 'server_svs_battle',
    'server_immigrate', 'server_merge', 'a_mobilization', 'alliance_mobilization',
    'p26'
];

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
    const [loginInput, setLoginInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [loginError, setLoginError] = useState('');
    const [isSuperAdminDashboardVisible, setIsSuperAdminDashboardVisible] = useState(false);
    const [superAdminTab, setSuperAdminTab] = useState<'pending' | 'alliances' | 'settings'>('pending');
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
    const dfs = (baseClass: string) => {
        if (fontSize === 'medium') return baseClass;

        const sizeMap: Record<string, { small: string, medium: string, large: string }> = {
            'text-[8px]': { small: 'text-[7px]', medium: 'text-[8px]', large: 'text-[9px]' },
            'text-[9px]': { small: 'text-[8px]', medium: 'text-[9px]', large: 'text-[10px]' },
            'text-[10px]': { small: 'text-[9px]', medium: 'text-[10px]', large: 'text-xs' },
            'text-xs': { small: 'text-[10px]', medium: 'text-xs', large: 'text-sm' },
            'text-sm': { small: 'text-xs', medium: 'text-sm', large: 'text-base' },
            'text-base': { small: 'text-sm', medium: 'text-base', large: 'text-lg' },
            'text-lg': { small: 'text-base', medium: 'text-lg', large: 'text-xl' },
            'text-xl': { small: 'text-lg', medium: 'text-xl', large: 'text-2xl' },
            'text-2xl': { small: 'text-xl', medium: 'text-2xl', large: 'text-3xl' },
            'text-3xl': { small: 'text-2xl', medium: 'text-3xl', large: 'text-4xl' },
            'text-4xl': { small: 'text-3xl', medium: 'text-4xl', large: 'text-5xl' },
        };

        return sizeMap[baseClass]?.[fontSize] || baseClass;
    };

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
        <ScrollView className={`flex-1 ${isMobile ? 'px-4 pt-4' : 'px-8 pt-8'}`} showsVerticalScrollIndicator={false}>
            <View className={`${isMobile ? 'gap-6' : 'gap-12'} pb-20`}>
                {/* 1. Gate 화면 개요 */}
                <View>
                    <View className={`flex-row items-center ${isMobile ? 'mb-3' : 'mb-6'}`}>
                        <View className={`${isMobile ? 'w-10 h-10 rounded-xl mr-3' : 'w-14 h-14 rounded-2xl mr-5'} items-center justify-center ${isDark ? 'bg-sky-500/20' : 'bg-sky-50'}`}>
                            <Ionicons name="apps-outline" size={isMobile ? 24 : 32} color="#38bdf8" />
                        </View>
                        <View>
                            <Text className={`${isMobile ? 'text-lg' : 'text-2xl'} font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.gateTitle')}</Text>
                        </View>
                    </View>
                    <Text className={`${isMobile ? 'text-xs leading-5 mb-4' : 'text-lg leading-7 mb-8'} font-bold ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{t('manual.gateDesc')}</Text>

                    <View className={`flex-row rounded-[24px] overflow-hidden border-2 ${isDark ? 'border-sky-500/20 bg-slate-900/50' : 'border-sky-100 bg-white shadow-md'} ${isMobile ? 'mb-4' : 'mb-8'}`}>
                        <View className={`flex-1 ${isMobile ? 'p-3' : 'p-6'} items-center border-r border-sky-500/10`}>
                            <Ionicons name="enter-outline" size={isMobile ? 20 : 28} color="#38bdf8" className="mb-1" />
                            <Text className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-black text-sky-400`}>{t('manual.enterDashboard')}</Text>
                        </View>
                        <View className={`flex-1 ${isMobile ? 'p-3' : 'p-6'} items-center`}>
                            <Ionicons name="person-add-outline" size={isMobile ? 20 : 28} color="#94a3b8" className="mb-1" />
                            <Text className={`${isMobile ? 'text-[10px]' : 'text-sm'} font-black text-slate-500`}>{t('manual.applyAdmin')}</Text>
                        </View>
                    </View>

                    <View className={`${isMobile ? 'gap-3' : 'gap-5'} px-2`}>
                        <View className="flex-row items-start">
                            <View className="w-1.5 h-1.5 rounded-full bg-sky-500 mt-2 mr-3" />
                            <Text className={`flex-1 ${isMobile ? 'text-xs' : 'text-base'} font-bold leading-6 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                <Text className="text-sky-400 font-black">{t('manual.enterDashboard')}:</Text> {t('manual.enterDashboardDesc')}
                            </Text>
                        </View>
                        <View className="flex-row items-start">
                            <View className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-2 mr-3" />
                            <Text className={`flex-1 ${isMobile ? 'text-xs' : 'text-base'} font-bold leading-6 ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>
                                <Text className="text-slate-400 font-black">{t('manual.applyAdmin')}:</Text> {t('manual.applyAdminDesc')}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* 2. 시작하기 (연계 가이드) */}
                <View>
                    <View className={`flex-row items-center ${isMobile ? 'mb-3' : 'mb-6'}`}>
                        <View className={`${isMobile ? 'w-10 h-10 rounded-xl mr-3' : 'w-14 h-14 rounded-2xl mr-5'} items-center justify-center ${isDark ? 'bg-blue-500/20' : 'bg-blue-50'}`}>
                            <Ionicons name="rocket-outline" size={isMobile ? 24 : 32} color="#3b82f6" />
                        </View>
                        <View>
                            <Text className={`${isMobile ? 'text-lg' : 'text-2xl'} font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.startTitle')}</Text>
                        </View>
                    </View>
                    <View className={`${isMobile ? 'p-4 rounded-[24px]' : 'p-8 rounded-[40px]'} border-2 ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100 shadow-md'}`}>
                        <View className={`flex-row items-start ${isMobile ? 'mb-2' : 'mb-4'}`}>
                            <View className="w-2 h-2 rounded-full bg-sky-500 mt-2 mr-3" />
                            <Text className={`flex-1 ${isMobile ? 'text-sm' : 'text-base'} font-black leading-7 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.enterDashboard')}</Text>
                        </View>
                        <Text className={`${isMobile ? 'text-xs' : 'text-base'} font-bold leading-6 ml-5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            {t('manual.enterDashboardDesc')}
                        </Text>
                    </View>
                </View>

                {/* 3. 대시보드 입장 (로그인) */}
                <View>
                    <View className={`flex-row items-center ${isMobile ? 'mb-3' : 'mb-6'}`}>
                        <View className={`${isMobile ? 'w-10 h-10 rounded-xl mr-3' : 'w-14 h-14 rounded-2xl mr-5'} items-center justify-center ${isDark ? 'bg-emerald-500/20' : 'bg-emerald-50'}`}>
                            <Ionicons name="lock-open-outline" size={isMobile ? 24 : 32} color="#10b981" />
                        </View>
                        <View>
                            <Text className={`${isMobile ? 'text-lg' : 'text-2xl'} font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.loginTitle')}</Text>
                        </View>
                    </View>
                    <View className={isMobile ? 'gap-3' : 'gap-6'}>
                        <View className={`${isMobile ? 'p-4 rounded-[24px]' : 'p-8 rounded-[40px]'} border-2 ${isDark ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                            <Text className={`${isMobile ? 'text-sm mb-4' : 'text-xl mb-8'} font-black ${isDark ? 'text-emerald-400' : 'text-emerald-700'}`}>📝 {t('manual.inputGuide')}</Text>
                            <View className={isMobile ? 'gap-4' : 'gap-8'}>
                                {[
                                    { title: t('manual.serverNum'), desc: t('manual.serverNumDesc'), icon: 'server-outline' },
                                    { title: t('manual.allianceAbbr'), desc: t('manual.allianceAbbrDesc'), icon: 'flag-outline' },
                                    { title: t('manual.lordName'), desc: t('manual.lordNameDesc'), icon: 'person-outline' },
                                    { title: t('auth.password'), desc: t('manual.passwordDesc'), icon: 'key-outline' }
                                ].map((item, idx) => (
                                    <View key={idx} className="flex-row items-center">
                                        <View className={`${isMobile ? 'w-10 h-10 rounded-xl mr-3' : 'w-14 h-14 rounded-2xl mr-6'} items-center justify-center ${isDark ? 'bg-slate-900' : 'bg-white border border-slate-100 shadow-sm'}`}>
                                            <Ionicons name={item.icon as any} size={isMobile ? 22 : 28} color="#10b981" />
                                        </View>
                                        <View className="flex-1">
                                            <Text className={`${isMobile ? 'text-xs' : 'text-lg'} font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.title}</Text>
                                            <Text className={`${isMobile ? 'text-[10px]' : 'text-base'} font-bold mt-1 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{item.desc}</Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                        <View className={`${isMobile ? 'p-3 rounded-[16px]' : 'p-6 rounded-[32px]'} flex-row items-center ${isDark ? 'bg-sky-500/10' : 'bg-sky-50'}`}>
                            <View className={`${isMobile ? 'w-8 h-8 mr-3' : 'w-12 h-12 mr-5'} rounded-full bg-sky-500/20 items-center justify-center`}>
                                <Ionicons name="bulb-outline" size={isMobile ? 18 : 24} color="#0ea5e9" />
                            </View>
                            <Text className={`flex-1 ${isMobile ? 'text-xs' : 'text-lg'} font-black leading-6 ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>{t('manual.autoComplete')}</Text>
                        </View>
                    </View>
                </View>

                {/* 4. 역할(권한) 체계 */}
                <View>
                    <View className={`flex-row items-center ${isMobile ? 'mb-3' : 'mb-6'}`}>
                        <View className={`${isMobile ? 'w-10 h-10 rounded-xl mr-3' : 'w-14 h-14 rounded-2xl mr-5'} items-center justify-center ${isDark ? 'bg-rose-500/20' : 'bg-rose-50'}`}>
                            <Ionicons name="people-outline" size={isMobile ? 24 : 32} color="#fb7185" />
                        </View>
                        <View>
                            <Text className={`${isMobile ? 'text-xl' : 'text-3xl'} font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.roleSystem')}</Text>
                        </View>
                    </View>
                    <View className={isMobile ? 'gap-3' : 'gap-6'}>
                        {[
                            { label: t('manual.sysMaster'), color: '#fb7185', desc: t('manual.sysMasterDesc'), badge: '🔴' },
                            { label: t('admin.allianceAdmin'), color: '#818cf8', desc: t('manual.allianceAdminDesc'), badge: '🔵' },
                            { label: t('admin.opAdmin'), color: '#22d3ee', desc: t('manual.opAdminDesc'), badge: '🟢' },
                            { label: t('manual.generalLord'), color: '#94a3b8', desc: t('manual.generalLordDesc'), badge: '⚪' }
                        ].map((role) => (
                            <View key={role.label} className={`${isMobile ? 'p-4 rounded-[24px] border-l-4' : 'p-8 rounded-[40px] border-2 border-l-8'} ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-white border-slate-100 shadow-md'}`} style={{ borderLeftColor: role.color }}>
                                <Text style={{ color: role.color }} className={`font-black ${isMobile ? 'text-base mb-1' : 'text-2xl mb-3'}`}>{role.badge} {role.label}</Text>
                                <Text className={`${isMobile ? 'text-sm leading-6' : 'text-lg leading-8'} font-black ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{role.desc}</Text>
                            </View>
                        ))}
                    </View>
                    <View className={`${isMobile ? 'mt-4 p-4 rounded-[16px]' : 'mt-8 p-6 rounded-[32px]'} border-2 border-dashed ${isDark ? 'bg-rose-500/5 border-rose-500/20' : 'bg-rose-50 border-rose-200'}`}>
                        <Text className={`${isMobile ? 'text-sm leading-6' : 'text-lg leading-8'} font-black text-center ${isDark ? 'text-rose-300' : 'text-rose-700'}`}>⚠️ {t('manual.roleWarning')}</Text>
                    </View>
                </View>

                {/* 5. 연맹 관리자 신청 */}
                <View>
                    <View className="flex-row items-center mb-6">
                        <View className={`w-14 h-14 rounded-2xl items-center justify-center mr-5 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                            <Ionicons name="clipboard-outline" size={32} color="#818cf8" />
                        </View>
                        <View>
                            <Text className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.adminApplyTitle')}</Text>
                        </View>
                    </View>
                    <View className="gap-8">
                        <View className={`p-8 rounded-[40px] ${isDark ? 'bg-slate-950/30 border-2 border-slate-800' : 'bg-slate-50 border-2 border-slate-200 shadowed-md'}`}>
                            <View className="flex-row items-center justify-between">
                                {(t('manual.adminApplySteps', { returnObjects: true }) as string[]).map((step, idx, arr) => (
                                    <View key={step} className="flex-1 items-center relative">
                                        <View className={`w-12 h-12 rounded-full items-center justify-center mb-4 ${isDark ? 'bg-indigo-500/30' : 'bg-indigo-50 shadow-sm border border-indigo-100'}`}>
                                            <Text className="text-sm font-black text-indigo-400">{idx + 1}</Text>
                                        </View>
                                        <Text className="text-xs font-black text-slate-500 uppercase tracking-tight text-center px-1">{step}</Text>
                                        {idx < arr.length - 1 && (
                                            <View className={`absolute right-[-40%] top-6 w-[80%] h-[2px] ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                                        )}
                                    </View>
                                ))}
                            </View>
                        </View>
                        <View className={`p-8 rounded-[32px] flex-row items-center ${isDark ? 'bg-amber-500/10' : 'bg-amber-50 shadow-sm'}`}>
                            <View className="w-12 h-12 rounded-full bg-amber-500/20 items-center justify-center mr-5">
                                <Ionicons name="time-outline" size={24} color="#f59e0b" />
                            </View>
                            <Text className={`flex-1 text-lg font-black leading-7 ${isDark ? 'text-amber-300' : 'text-amber-700'}`}>{t('manual.adminApplyWait')}</Text>
                        </View>
                    </View>
                </View>

                {/* 6. 편리한 도구 및 기타 */}
                <View>
                    <View className={`flex-row items-center ${isMobile ? 'mb-4' : 'mb-6'}`}>
                        <View className={`${isMobile ? 'w-10 h-10 rounded-xl mr-3' : 'w-14 h-14 rounded-2xl mr-5'} items-center justify-center ${isDark ? 'bg-cyan-500/20' : 'bg-cyan-50'}`}>
                            <Ionicons name="construct-outline" size={isMobile ? 24 : 32} color="#06b6d4" />
                        </View>
                        <View>
                            <Text className={`${isMobile ? 'text-xl' : 'text-3xl'} font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.toolsAndEtc')}</Text>
                        </View>
                    </View>
                    <View className={isMobile ? 'gap-3' : 'gap-6'}>
                        {[
                            { icon: 'eye-off-outline', title: t('manual.anonymousLogin'), desc: t('manual.anonymousLoginDesc') },
                            { icon: 'color-palette-outline', title: t('manual.themeFont'), desc: t('manual.themeFontDesc') },
                            { icon: 'download-outline', title: t('manual.pwaInstall'), desc: t('manual.pwaInstallDesc') }
                        ].map((tool, idx) => (
                            <View key={idx} className={`${isMobile ? 'p-4 rounded-[24px]' : 'p-8 rounded-[40px]'} border-2 ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-white border-slate-100 shadow-md'}`}>
                                <View className={`flex-row items-center ${isMobile ? 'mb-2' : 'mb-4'}`}>
                                    <View className={`${isMobile ? 'w-8 h-8 mr-3' : 'w-10 h-10 mr-4'} rounded-full bg-cyan-500/10 items-center justify-center`}>
                                        <Ionicons name={tool.icon as any} size={isMobile ? 18 : 24} color="#06b6d4" />
                                    </View>
                                    <Text className={`${isMobile ? 'text-lg' : 'text-2xl'} font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{tool.title}</Text>
                                </View>
                                <Text className={`${isMobile ? 'text-sm leading-6' : 'text-lg leading-8'} font-black ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{tool.desc}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* 7. 자주 묻는 질문 (FAQ) */}
                <View>
                    <View className={`flex-row items-center ${isMobile ? 'mb-4' : 'mb-8'}`}>
                        <View className={`${isMobile ? 'w-10 h-10 rounded-xl mr-3' : 'w-14 h-14 rounded-2xl mr-5'} items-center justify-center ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
                            <Ionicons name="help-buoy-outline" size={isMobile ? 24 : 32} color="#f59e0b" />
                        </View>
                        <View>
                            <Text className={`${isMobile ? 'text-xl' : 'text-3xl'} font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.faq')}</Text>
                        </View>
                    </View>
                    <View className={isMobile ? 'gap-4' : 'gap-8'}>
                        <View>
                            <Text className={`${isMobile ? 'text-base mb-2' : 'text-xl mb-4'} font-black ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>Q. {t('manual.qPw')}</Text>
                            <View className={`${isMobile ? 'p-4 rounded-[20px]' : 'p-8 rounded-[32px]'} border-2 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-100 shadow-sm'}`}>
                                <Text className={`${isMobile ? 'text-sm leading-6' : 'text-lg leading-8'} font-black ${isDark ? 'text-white' : 'text-slate-700'}`}>A. {t('manual.aPw')}</Text>
                            </View>
                        </View>
                        <View>
                            <Text className={`${isMobile ? 'text-base mb-2' : 'text-xl mb-4'} font-black ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>Q. {t('manual.qUnreg')}</Text>
                            <View className={`${isMobile ? 'p-4 rounded-[20px]' : 'p-8 rounded-[32px]'} border-2 ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-100 shadow-sm'}`}>
                                <Text className={`${isMobile ? 'text-sm leading-6' : 'text-lg leading-8'} font-black ${isDark ? 'text-white' : 'text-slate-700'}`}>A. {t('manual.aUnreg')}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        </ScrollView>
    );


    const renderMainManualContent = () => (
        <ScrollView className={`flex-1 ${isMobile ? 'px-4 pt-4' : 'px-8 pt-8'}`} showsVerticalScrollIndicator={false}>
            <View className={`${isMobile ? 'gap-6' : 'gap-12'} pb-10`}>
                {/* 1. 권한 관리 시스템 */}
                <View>
                    <View className={`flex-row items-center ${isMobile ? 'mb-4' : 'mb-8'}`}>
                        <View className={`${isMobile ? 'w-10 h-10 rounded-xl mr-3' : 'w-14 h-14 rounded-2xl mr-5'} items-center justify-center ${isDark ? 'bg-rose-500/20' : 'bg-rose-50 shadow-sm'}`}>
                            <Text className={isMobile ? 'text-xl' : 'text-3xl'}>🔐</Text>
                        </View>
                        <Text className={`${isMobile ? 'text-xl' : 'text-3xl'} font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.roleMgmtSystem')}</Text>
                    </View>
                    <View className={isMobile ? 'gap-3' : 'gap-6'}>
                        {[
                            { label: `🔴 ${t('admin.superAdmin')}`, color: '#fb7185', desc: t('manual.roleMasterDesc') },
                            { label: `🔵 ${t('admin.allianceAdmin')}`, color: '#818cf8', desc: t('manual.roleAllianceAdminDesc') },
                            { label: `🟢 ${t('admin.opAdmin')}`, color: '#22d3ee', desc: t('manual.roleOpAdminDesc') },
                            { label: `⚪ ${t('manual.generalLord')}`, color: '#94a3b8', desc: t('manual.roleGeneralDesc') }
                        ].map((role) => (
                            <View key={role.label} className={`${isMobile ? 'p-4 rounded-[24px]' : 'p-8 rounded-[40px]'} border-2 ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                                <Text style={{ color: role.color }} className={`font-black ${isMobile ? 'text-lg mb-1' : 'text-2xl mb-2'}`}>{role.label}</Text>
                                <Text className={`${isMobile ? 'text-sm leading-6' : 'text-lg leading-8'} font-black ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{role.desc}</Text>
                            </View>
                        ))}
                    </View>
                    <View className={`${isMobile ? 'mt-4 p-4 rounded-[16px]' : 'mt-8 p-6 rounded-[32px]'} ${isDark ? 'bg-sky-500/10' : 'bg-sky-50 shadow-sm'}`}>
                        <Text className={`${isMobile ? 'text-sm' : 'text-lg'} font-bold leading-6 ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>💡 {t('manual.roleTip')}</Text>
                    </View>
                </View>

                {/* 2. 헤더 버튼 가이드 */}
                <View>
                    <View className={`flex-row items-center ${isMobile ? 'mb-4' : 'mb-8'}`}>
                        <View className={`${isMobile ? 'w-10 h-10 rounded-xl mr-3' : 'w-14 h-14 rounded-2xl mr-5'} items-center justify-center ${isDark ? 'bg-blue-500/20' : 'bg-blue-50 shadow-sm'}`}>
                            <Text className={isMobile ? 'text-xl' : 'text-3xl'}>🔘</Text>
                        </View>
                        <Text className={`${isMobile ? 'text-xl' : 'text-3xl'} font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.headerBtnGuide')}</Text>
                    </View>
                    <View className={isMobile ? 'gap-3' : 'gap-6'}>
                        {[
                            { title: t('manual.themeSwitch'), icon: '☀️', desc: t('manual.themeSwitchDesc') },
                            { title: t('manual.guideBtn'), icon: '📖', desc: t('manual.guideBtnDesc') },
                            { title: t('manual.installBtn'), icon: '📥', desc: t('manual.installBtnDesc') },
                            { title: t('manual.profileAdmin'), icon: '👤', desc: t('manual.profileAdminDesc') }
                        ].map((btn, idx) => (
                            <View key={idx} className={`${isMobile ? 'p-4 rounded-[24px]' : 'p-8 rounded-[40px]'} border-2 ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-slate-50 border-slate-200 shadow-sm'}`}>
                                <Text className={`${isMobile ? 'text-lg mb-1' : 'text-2xl mb-3'} font-black ${isDark ? 'text-blue-400' : 'text-blue-700'}`}>{btn.icon} {btn.title}</Text>
                                <Text className={`${isMobile ? 'text-sm leading-6' : 'text-lg leading-8'} font-black ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{btn.desc}</Text>
                            </View>
                        ))}
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


    // Dynamic Admins Support
    const { dynamicAdmins, addAdmin, removeAdmin } = useFirestoreAdmins(serverId, allianceId);
    const [newAdminName, setNewAdminName] = useState('');
    const [newAdminPassword, setNewAdminPassword] = useState('');
    const [newAdminRole, setNewAdminRole] = useState<'admin' | 'alliance_admin'>('admin');
    const [showAdminList, setShowAdminList] = useState(false);
    const [superAdminsList, setSuperAdminsList] = useState<any[]>([]);
    const [loadingSuperAdmins, setLoadingSuperAdmins] = useState(false);
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

    useEffect(() => {
        if (showAdminList) {
            setLoadingSuperAdmins(true);
            const q = query(collection(db, 'users'), where('role', '==', 'super_admin'));
            getDocs(q).then(snapshot => {
                const admins = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                setSuperAdminsList(admins);
                setLoadingSuperAdmins(false);
            }).catch(err => {
                console.error(err);
                setLoadingSuperAdmins(false);
            });
        }
    }, [showAdminList]);

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
        showCustomAlert(
            t('admin.resetPassword'),
            t('admin.resetPwConfirm', { id: req.adminId }),
            'confirm',
            async () => {
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
        );
    };

    const handleDeleteAlliance = async (req: any) => {
        showCustomAlert(
            t('admin.deleteAlliance'),
            t('admin.deleteAllianceConfirm', { id: req.allianceId }),
            'confirm',
            async () => {
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
        );
    };

    const handleDeleteSuperAdmin = async (adminId: string, name: string) => {
        showCustomAlert(
            '관리자 삭제',
            `${name}님을 삭제하시겠습니까?`,
            'confirm',
            async () => {
                try {
                    await deleteDoc(doc(db, 'users', adminId));
                    setSuperAdminsList(prev => prev.filter(a => a.id !== adminId));
                    showCustomAlert(t('common.success'), '삭제되었습니다.', 'success');
                } catch (e: any) {
                    showCustomAlert(t('common.error_title'), e.message, 'error');
                }
            }
        );
    };

    const handleAddSuperAdmin = async () => {
        if (!newAdminName.trim() || !newAdminPassword.trim()) {
            showCustomAlert(t('common.error_title'), '아이디와 비밀번호를 입력해주세요.', 'warning');
            return;
        }

        try {
            const userId = newAdminName.trim();
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {
                showCustomAlert(t('common.error_title'), '이미 존재하는 아이디입니다.', 'error');
                return;
            }

            const hashed = await hashPassword(newAdminPassword.trim());
            const newAdminData = {
                uid: `super_admin_${userId}`,
                username: userId,
                password: hashed,
                nickname: userId,
                role: 'super_admin',
                status: 'active',
                createdAt: Date.now()
            };

            await setDoc(userRef, newAdminData);
            setSuperAdminsList(prev => [...prev, { id: userId, ...newAdminData }]);
            setNewAdminName('');
            setNewAdminPassword('');
            showCustomAlert(t('common.success'), '슈퍼 관리자가 추가되었습니다.', 'success');
        } catch (e: any) {
            showCustomAlert(t('common.error_title'), e.message, 'error');
        }
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

            const originalId = (event.originalEventId || '').trim();
            const id = (originalId || event.id || event.eventId || '').trim();

            const dayStr = schedule?.day || event.day || '';
            const timeStr = schedule?.time || event.time || '';
            const combined = `${dayStr} ${timeStr} `;

            // 0. DATE_RANGE_IDS 이벤트는 day 필드의 날짜 범위를 우선 확인
            const isDateRangeEvent = DATE_RANGE_IDS.includes(id) || DATE_RANGE_IDS.includes(event.eventId);
            if (isDateRangeEvent && combined.includes('~')) {
                const rangeMatch = combined.match(/(?:(\d{4})[\.\\/-])?(\d{2})[\.\\/-](\d{2})\s*[^\d~]*\s*(\d{2}:\d{2})?\s*~\s*(?:(\d{4})[\.\\/-])?(\d{2})[\.\\/-](\d{2})\s*[^\d~]*\s*(\d{2}:\d{2})?/);
                if (rangeMatch) {
                    const currentYear = now.getFullYear();
                    const eYear = parseInt(rangeMatch[5] || currentYear.toString());
                    const eMonth = parseInt(rangeMatch[6]) - 1;
                    const eDay = parseInt(rangeMatch[7]);
                    const timePart = rangeMatch[8] || '23:59';
                    const [eH, eM] = timePart.split(':').map(Number);

                    const end = new Date(eYear, eMonth, eDay, eH, eM);
                    if (!isNaN(end.getTime())) return end;
                }
            }

            // 1. Check startDate (for one-time weekly events, non date-range)
            const startDate = schedule?.startDate || event.startDate;
            if (startDate) {
                try {
                    const sTimeStr = schedule?.time || event.time || '00:00';
                    const timeMatch = sTimeStr.match(/(\d{2}):(\d{2})/);
                    const finalTime = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '00:00';
                    const dateTimeStr = `${startDate}T${finalTime}:00`;
                    const eventDateTime = new Date(dateTimeStr);
                    if (!isNaN(eventDateTime.getTime())) {
                        // Add 1 hour buffer
                        return new Date(eventDateTime.getTime() + 3600000);
                    }
                } catch (e) { }
            }

            // 2. Fallback: Generic Date Range Match
            const genericRangeMatch = combined.match(/(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(\d{2}:\d{2})?\s*~\s*(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(\d{2}:\d{2})?/);
            if (genericRangeMatch) {
                const currentYear = now.getFullYear();
                const eYear = parseInt(genericRangeMatch[5] || currentYear.toString());
                const eMonth = parseInt(genericRangeMatch[6]) - 1;
                const eDay = parseInt(genericRangeMatch[7]);
                const timePart = genericRangeMatch[8] || '23:59';
                const [eH, eM] = timePart.split(':').map(Number);

                const end = new Date(eYear, eMonth, eDay, eH, eM);
                if (!isNaN(end.getTime())) return end;
            }

            // 3. Single Date Match
            const singleMatch = combined.match(/(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(?:오후|오전)?\s*(\d{1,2}):(\d{2})/);
            if (singleMatch) {
                const currentYear = now.getFullYear();
                const y = parseInt(singleMatch[1] || currentYear.toString());
                const m = parseInt(singleMatch[2]) - 1;
                const d = parseInt(singleMatch[3]);
                const h = parseInt(singleMatch[4]);
                const min = parseInt(singleMatch[5]);
                const end = new Date(y, m, d, h + 1, min); // 1 hour buffer
                if (!isNaN(end.getTime())) return end;
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

        // 곰사냥은 반복 이벤트이므로 대시보드에서 만료된 섹션으로 보내지 않음
        if (id === 'a_bear' || id === 'alliance_bear') return false;

        const schedule = getEventSchedule(event);

        // 1. startDate가 있으면 날짜 기준 판단 (우선순위 높음)
        // 미치광이 조이, 협곡, 요새, 성채, 무기공장 등 일회성 주간 이벤트용
        const startDate = schedule?.startDate || event.startDate;
        const dayStr = schedule?.day || event.day || '';
        const isRange = dayStr.includes('~') || event.category === '개인' || DATE_RANGE_IDS.includes(id);

        if (startDate && !isRange) {
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
        const dateRangeMatch = str.match(/(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(\d{1,2}:\d{2})?\s*~\s*(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(\d{1,2}:\d{2})?/);
        if (dateRangeMatch) {
            const currentYear = now.getFullYear();
            const sYear = dateRangeMatch[1] || currentYear.toString();
            const sMonth = dateRangeMatch[2];
            const sDay = dateRangeMatch[3];
            const sTime = dateRangeMatch[4] || '00:00';

            const eYear = dateRangeMatch[5] || currentYear.toString();
            const eMonth = dateRangeMatch[6];
            const eDay = dateRangeMatch[7];
            const eTime = dateRangeMatch[8] || '23:59';

            const [hStart, mStart] = sTime.split(':').map(Number);
            const [hEnd, mEnd] = eTime.split(':').map(Number);

            const start = new Date(parseInt(sYear), parseInt(sMonth) - 1, parseInt(sDay), hStart, mStart);
            const end = new Date(parseInt(eYear), parseInt(eMonth) - 1, parseInt(eDay), hEnd, mEnd);
            if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                return now >= start && now <= end;
            }
        }

        // 2. 단일 날짜 체크 (예: 2026-02-22 일(23:00) 또는 2026.02.22 10:00)
        const singleDateMatch = str.match(/(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(?:오후|오전)?\s*(\d{1,2}):(\d{2})/);
        if (singleDateMatch) {
            const currentYear = now.getFullYear();
            const y = parseInt(singleDateMatch[1] || currentYear.toString());
            const m = parseInt(singleDateMatch[2]) - 1;
            const d = parseInt(singleDateMatch[3]);
            const h = parseInt(singleDateMatch[4]);
            const min = parseInt(singleDateMatch[5]);

            const start = new Date(y, m, d, h, min);
            const end = new Date(start.getTime() + 30 * 60000); // 30 min duration
            return now >= start && now <= end;
        }

        // 3. 주간 요일 범위 체크 (예: 월 10:00 ~ 수 10:00)
        const weeklyMatch = str.match(/([일월화수목금토])\s*(\d{2}):(\d{2})\s*~\s*([일월화수목금토])\s*(\d{2}):(\d{2})/);
        if (weeklyMatch) {
            const startTotal = dayMapObj[weeklyMatch[1]] * 1440 + parseInt(weeklyMatch[2]) * 60 + parseInt(weeklyMatch[3]);
            const endTotal = dayMapObj[weeklyMatch[4]] * 1440 + parseInt(weeklyMatch[5]) * 60 + parseInt(weeklyMatch[6]);
            if (startTotal <= endTotal) return currentTotal >= startTotal && currentTotal <= endTotal;
            return currentTotal >= startTotal || currentTotal <= endTotal;
        }

        // 4. 점형 일시 체크 (예: 화 23:50, 매일 10:00) - 날짜 없는 주간 반복만
        // 날짜가 포함되어 있으면 주간 반복으로 인식하지 않음
        const hasDateInfo = /\d{4}[\.-]\d{2}[\.-]\d{2}/.test(str);
        if (!hasDateInfo) {
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

    // 곰사냥 2일 단위 로테이션: 다음 이벤트 요일 계산
    const calculateBearHuntDay = useCallback((event: any, targetTime?: string): string => {
        const isBear = (event.eventId === 'a_bear' || event.eventId === 'alliance_bear' || event.originalEventId === 'a_bear' || event.originalEventId === 'alliance_bear');
        const schedule = getEventSchedule(event);
        const registeredDay = event.day || schedule?.day || '';
        if (!isBear || !registeredDay) return registeredDay;

        const dayMap: { [key: string]: number } = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
        const dayMapReverse: { [key: number]: string } = { 0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토' };

        // 여러 요일이 쉼표로 연결된 경우 첫 번째 요일을 기준으로 로테이션 계산
        const firstDayMatch = registeredDay.match(/[일월화수목금토]/);
        if (!firstDayMatch) return registeredDay;
        const regDayNum = dayMap[firstDayMatch[0]];

        const todayNum = now.getDay();
        const daysSinceRegistered = (todayNum - regDayNum + 7) % 7;
        const isEventDay = daysSinceRegistered % 2 === 0;

        if (isEventDay) {
            // 체크할 대상 시간 결정 (특정 팀 시간이 주어지면 그것을 사용, 아니면 이벤트 전체의 마지막 시간)
            const checkTime = targetTime || event.time || '';
            const allTimes = Array.from(checkTime.matchAll(/(\d{1,2}):(\d{2})/g));
            let latestEventMinutes = -1;

            for (const match of allTimes) {
                const h = parseInt(match[1]);
                const m = parseInt(match[2]);
                const eventMinutes = h * 60 + m;
                if (eventMinutes > latestEventMinutes) latestEventMinutes = eventMinutes;
            }

            const currentMinutes = now.getHours() * 60 + now.getMinutes();
            // 해당 팀 시간이 이미 지났으면(30분 지속 고려) 다음 로테이션(2일 후)으로
            if (latestEventMinutes >= 0 && currentMinutes > latestEventMinutes + 30) {
                const nextEventNum = (todayNum + 2) % 7;
                return dayMapReverse[nextEventNum];
            }
            return dayMapReverse[todayNum];
        }

        // 오늘이 이벤트 날이 아니면 다음 로테이션 요일 계산
        const nextEventNum = (todayNum + (2 - (daysSinceRegistered % 2))) % 7;
        return dayMapReverse[nextEventNum];
    }, [now, getEventSchedule]);

    const isEventActive = (event: any) => {
        try {
            const schedule = getEventSchedule(event);
            const startDate = schedule?.startDate || event.startDate;

            const originalId = (event.originalEventId || '').trim();
            const id = (originalId || event.id || event.eventId || '').trim();

            const dayStrRaw = schedule?.day || event.day || '';
            const titleMatch = (event.title || '').includes('집결') || (event.title || '').includes('공연') || (event.title || '').includes('전당');
            const isRange = dayStrRaw.includes('~') || event.category === '개인' || DATE_RANGE_IDS.includes(id) || DATE_RANGE_IDS.includes(event.eventId) || titleMatch;

            // startDate가 있고, 기간형 이벤트가 아닐 때만 단일 날짜 체크
            if (startDate && !isRange) {
                const eventDate = new Date(startDate);
                const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

                // 날짜가 일치하지 않으면 진행중 아님
                if (eventDate.getTime() !== nowDate.getTime()) {
                    return false;
                }

                // 날짜가 일치하면 시간 체크
                const timeStr = schedule?.time || event.time || '';
                return checkItemActive(toLocal(timeStr));
            }

            // startDate 없으면 주간 반복 이벤트
            const isBear = (id === 'a_bear' || id === 'alliance_bear');
            const dayStr = isBear ? calculateBearHuntDay(event) : (schedule?.day || event.day || '');
            const timeStr = schedule?.time || event.time || '';
            const combinedStr = `${dayStr || ''} ${timeStr || ''}`.trim();

            return checkItemActive(toLocal(combinedStr));
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

        // 1. Full Date Range Case (2026.02.13 09:00) - '/' 및 연도 생략 대응 + 요일 마커 대응
        let processed = str.replace(/(?:(\d{2,4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~\.]*\s*(\d{1,2}):(\d{2})/g, (match, y, m, d, h, min) => {
            const currentYear = now.getFullYear();
            let yearNum = parseInt(y || currentYear.toString());
            if (y && y.length === 2) yearNum += 2000;
            const date = new Date(yearNum, parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min));
            if (isNaN(date.getTime())) return match;
            const converted = new Date(date.getTime() + diffMinutes * 60000);

            // Output format based on timezone setting
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
        const fullDateMatch = str.match(/(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d\s~\.\/-]*\s*(\d{2}):(\d{2})/);
        if (fullDateMatch) {
            const currentYear = now.getFullYear();
            const y = fullDateMatch[1] || currentYear.toString();
            const m = fullDateMatch[2];
            const d = fullDateMatch[3];
            const h = fullDateMatch[4];
            const min = fullDateMatch[5];
            const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(d => t(`events.days.${d}`));
            const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            const dateStr = `${m}/${d}(${days[dateObj.getDay()]})`;
            return { date: dateStr, time: `${pad(parseInt(h))}:${pad(parseInt(min))}` };
        }

        // 2. Handle date only (2024.01.01)
        const justDateMatch = str.match(/(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})/);
        if (justDateMatch) {
            const currentYear = now.getFullYear();
            const y = justDateMatch[1] || currentYear.toString();
            const m = justDateMatch[2];
            const d = justDateMatch[3];
            const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(d => t(`events.days.${d}`));
            const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            const dateStr = `${m}/${d}(${days[dateObj.getDay()]})`;
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
    const noticeScrollAnim = useRef(new Animated.Value(0)).current;
    const [noticeTextWidth, setNoticeTextWidth] = useState(0);
    const [noticeContainerWidth, setNoticeContainerWidth] = useState(0);

    useEffect(() => {
        if (notice?.content && noticeTextWidth > 0 && noticeContainerWidth > 0) {
            // Only marquee if content is significantly long or always? User said "like billboard".
            // Let's make it always scroll.

            noticeScrollAnim.setValue(noticeContainerWidth);

            const distance = noticeTextWidth + noticeContainerWidth;
            const duration = distance * 30; // 30ms per pixel, adjust for speed

            const anim = Animated.loop(
                Animated.sequence([
                    Animated.timing(noticeScrollAnim, {
                        toValue: -noticeTextWidth,
                        duration: duration,
                        easing: Easing.linear,
                        useNativeDriver: true,
                    }),
                    Animated.timing(noticeScrollAnim, {
                        toValue: noticeContainerWidth,
                        duration: 0,
                        useNativeDriver: true,
                    })
                ])
            );

            anim.start();
            return () => anim.stop();
        }
    }, [notice?.content, noticeTextWidth, noticeContainerWidth]);

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
            const currentDay = (now.getDay() + 6) % 7;
            const currentMins = now.getHours() * 60 + now.getMinutes();

            const matches = Array.from((dStr + ' ' + tStr).matchAll(/([일월화수목금토매일상시])\s*\(?(\d{1,2}:\d{2})\)?/g));
            if (matches.length > 0) {
                // Find first non-expired slot
                let nextSlot = matches.find(m => {
                    const dRaw = m[1];
                    const [h, min] = m[2].split(':').map(Number);
                    if (dRaw === '매일' || dRaw === '상시') return true;
                    const dIdx = dayMap[dRaw];
                    if (dIdx > currentDay) return true;
                    if (dIdx === currentDay) return currentMins < (h * 60 + min + 30);
                    return false;
                });

                // If all expired this week, show first slot of next week or just the first match
                if (!nextSlot) nextSlot = matches[0];

                const [_, dRaw, tPart] = nextSlot;
                const [h, min] = tPart.split(':').map(Number);
                const dIdx = dRaw === '매일' || dRaw === '상시' ? -1 : (dayMap[dRaw] ?? 9);
                return dIdx * 86400000 + h * 3600000 + min * 60000;
            }

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

    // Translate fortress/citadel and group labels
    const translateLabel = (label: string) => {
        if (!label) return '';
        return label
            .replace(/요새\s*#?(\d+)/g, (match, num) => `${t('events.fortress')} ${num}`)
            .replace(/성채\s*#?(\d+)/g, (match, num) => `${t('events.citadel')} ${num}`)
            .replace(/(?:^|\s|\()1군(?:\s|\)|$)/g, (match) => match.replace('1군', t('events.team1')))
            .replace(/(?:^|\s|\()2군(?:\s|\)|$)/g, (match) => match.replace('2군', t('events.team2')));
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
                            elevation: 5
                        }}>
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
                            }}
                        >
                            <View className={`${windowWidth < 380 ? 'px-2' : 'px-4'} py-4 flex-row items-center`}>
                                {/* Icon */}
                                <View className={`${windowWidth < 380 ? 'w-11 h-11 mr-2' : 'w-14 h-14 mr-4'} rounded-2xl items-center justify-center ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`}>
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
                                            numberOfLines={1}
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
                                                                    numberOfLines={1}
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
                        <Text className={`font-black ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 16 * fontSizeScale }}>{item}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    if (isLoading) {
        return (
            <View className={`flex-1 ${isDark ? 'bg-[#020617]' : 'bg-slate-50'} items-center justify-center`}>
                <ImageBackground
                    source={require('../assets/images/selection_gate_bg.png')}
                    style={{ position: 'absolute', width: '100%', height: '100%' }}
                    resizeMode="cover"
                />
                <View className={`absolute inset-0 ${isDark ? 'bg-slate-950/60' : 'bg-white/40'}`} />
                <Animated.View style={{ opacity: flickerAnim, transform: [{ scale: scaleAnim }] }} className="items-center">
                    <View className={`w-24 h-24 rounded-[40px] ${isDark ? 'bg-sky-500/20 border-sky-400/30' : 'bg-sky-100 border-sky-200'} items-center justify-center mb-8 border`}>
                        <Ionicons name="snow" size={54} color="#38bdf8" />
                    </View>
                    <Text className={`font-black tracking-[0.3em] ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 24 * fontSizeScale }}>INITIALIZING</Text>
                    <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 24 }} />
                </Animated.View>
            </View>
        );
    }

    if (isGateOpen || !serverId || !allianceId) {
        return (
            <View className={`flex-1 w-full h-screen ${isDark ? 'bg-[#0f172a]' : 'bg-slate-50'}`}>
                <ImageBackground
                    source={require('../assets/images/selection_gate_bg.png')}
                    style={{ position: 'absolute', width: '100%', height: '100%' }}
                    resizeMode="cover"
                />
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.7)' }} />
                <View className="flex-1 w-full h-full justify-center items-center p-4">
                    <BlurView intensity={isDark ? 40 : 20} tint={isDark ? "dark" : "light"} className="absolute inset-0" />

                    <View className={`w-full max-w-md ${isMobile ? 'p-5' : 'p-6'} rounded-[40px] border ${isDark ? 'border-white/10 bg-slate-900/60' : 'border-slate-200 bg-white/80'} shadow-2xl overflow-hidden`}>
                        <BlurView intensity={isDark ? 80 : 40} className="absolute inset-0" />

                        <View className="items-center mb-4 relative">
                            {/* Top Right Controls: Help & Reset */}
                            <View className={`absolute top-0 right-0 flex-row p-1 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-white/50 border-slate-200'}`} style={{ zIndex: 10 }}>
                                <Pressable
                                    onPress={() => openModalWithHistory(setIsGateManualVisible)}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            width: 36,
                                            height: 36,
                                            borderRadius: 10,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: hovered ? 'rgba(71, 85, 105, 0.4)' : 'transparent',
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.2s',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                    // @ts-ignore
                                    tabIndex={-1}
                                >
                                    <Ionicons name="book-outline" size={20} color="#f59e0b" />
                                </Pressable>

                                {/* Temporary Theme Toggle */}
                                <Pressable
                                    onPress={toggleTemporaryTheme}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            width: 36,
                                            height: 36,
                                            borderRadius: 10,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: hovered ? (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)') : 'transparent',
                                            marginLeft: 4,
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.2s',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                    // @ts-ignore
                                    tabIndex={-1}
                                >
                                    <Ionicons name={isDark ? "moon" : "sunny"} size={20} color={isDark ? "#f59e0b" : "#f59e0b"} />
                                </Pressable>

                                <Pressable
                                    onPress={handleResetSettings}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            width: 36,
                                            height: 36,
                                            borderRadius: 10,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: hovered ? 'rgba(167, 139, 250, 0.2)' : 'transparent',
                                            marginLeft: 4,
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.2s',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                    // @ts-ignore
                                    tabIndex={-1}
                                >
                                    <Ionicons name="refresh-outline" size={20} color="#a78bfa" />
                                </Pressable>
                            </View>

                            {/* Language Toggle Switch (Icon Only) */}
                            <View className={`absolute top-0 left-0 flex-row p-1 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-600' : 'bg-white/50 border-slate-200'}`} style={{ zIndex: 10 }}>
                                <Pressable
                                    onPress={() => changeLanguage('ko')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            width: 36,
                                            height: 36,
                                            borderRadius: 10,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: language === 'ko'
                                                ? '#2563eb'
                                                : (hovered ? 'rgba(59, 130, 246, 0.2)' : 'transparent'),
                                            borderColor: language === 'ko' ? 'transparent' : (hovered ? '#60a5fa' : 'transparent'),
                                            borderWidth: 1,
                                            transform: [{ scale: pressed ? 0.92 : (hovered ? 1.08 : 1) }],
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                    // @ts-ignore
                                    tabIndex={-1}
                                >
                                    <Ionicons
                                        name="language"
                                        size={18}
                                        color={language === 'ko' ? 'white' : '#64748b'}
                                    />
                                </Pressable>

                                <Pressable
                                    onPress={() => changeLanguage('en')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            width: 36,
                                            height: 36,
                                            borderRadius: 10,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: language === 'en'
                                                ? '#2563eb'
                                                : (hovered ? 'rgba(59, 130, 246, 0.2)' : 'transparent'),
                                            borderColor: language === 'en' ? 'transparent' : (hovered ? '#60a5fa' : 'transparent'),
                                            borderWidth: 1,
                                            marginLeft: 4,
                                            transform: [{ scale: pressed ? 0.92 : (hovered ? 1.08 : 1) }],
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                    // @ts-ignore
                                    tabIndex={-1}
                                >
                                    <Ionicons
                                        name="globe-outline"
                                        size={18}
                                        color={language === 'en' ? 'white' : '#64748b'}
                                    />
                                </Pressable>



                            </View>



                            <View className="items-center justify-center mb-6" style={{ marginTop: 46 }}>
                                <View className="w-24 h-24 rounded-[32px] bg-white/10 items-center justify-center border border-white/20 shadow-2xl overflow-hidden mb-2">
                                    <Image
                                        source={require('../assets/icon.png')}
                                        style={{ width: 80, height: 80 }}
                                        resizeMode="contain"
                                    />
                                </View>
                            </View>
                            <Text className={`font-black ${isDark ? 'text-white' : 'text-slate-900'} text-center tracking-tighter`} style={{ fontSize: (isMobile ? 20 : 24) * fontSizeScale }}>{t('dashboard.title')}</Text>
                            <Text className={`${isRegisterMode ? (isDark ? 'text-amber-400/80' : 'text-amber-600/90') : (isDark ? 'text-sky-400/80' : 'text-sky-600/90')} font-bold mt-0.5 tracking-[0.2em] uppercase`} style={{ fontSize: (isMobile ? 8 : 9) * fontSizeScale }}>{t('dashboard.subtitle')}</Text>
                        </View>

                        <View className={`flex-row ${isDark ? 'bg-slate-950/40 border-white/5' : 'bg-slate-100 border-slate-200'} p-1 rounded-2xl mb-5 border items-center`}>
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
                                <Text className={`font-black ${!isRegisterMode ? 'text-sky-400' : (isDark ? 'text-slate-400' : 'text-slate-500')}`} style={{ fontSize: (isMobile ? 11 : 12) * fontSizeScale }}>{t('dashboard.dashboardEntrance')}</Text>
                            </Pressable>

                            {/* Middle Divider */}
                            <View className={`w-[1px] h-4 ${isDark ? 'bg-white/10' : 'bg-slate-300'}`} />

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
                                <Text className={`font-black ${isRegisterMode ? 'text-amber-400' : (isDark ? 'text-slate-400' : 'text-slate-500')}`} style={{ fontSize: (isMobile ? 11 : 12) * fontSizeScale }}>{t('dashboard.applyAdmin')}</Text>
                            </Pressable>
                        </View>

                        <View className="space-y-2.5">
                            {/* Row 1: Server and Alliance */}
                            <View className="flex-row gap-2.5" style={{ zIndex: (activeInput === 'server' || activeInput === 'alliance') ? 100 : 50 }}>
                                {/* Server Number */}
                                <View className="flex-1" style={{ zIndex: activeInput === 'server' ? 100 : 50 }}>
                                    <View className="flex-row justify-between items-center ml-4 mb-1.5 ">
                                        <Text className={`${isDark ? 'text-white/60' : 'text-slate-500'} font-black uppercase tracking-widest text-left`} style={{ fontSize: 10 * fontSizeScale }}>{t('dashboard.serverNumber')}</Text>
                                        <Text className={`${isRegisterMode ? 'text-amber-500/80' : 'text-sky-500/80'} font-bold text-right`} style={{ fontSize: 8 * fontSizeScale }}>{t('dashboard.required')}</Text>
                                    </View>
                                    <View className="relative">
                                        <View className="absolute left-2 top-0 bottom-0 z-10 w-12 items-center justify-center">
                                            <Ionicons name="server-outline" size={20} color={isRegisterMode ? "#fbbf24" : "#38bdf8"} />
                                        </View>
                                        <TextInput
                                            placeholder="#1008"
                                            placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(30, 41, 59, 0.4)"}
                                            value={inputServer}
                                            onChangeText={setInputServer}
                                            onFocus={() => setActiveInput('server')}
                                            onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                            className={`${isDark ? 'bg-slate-950/50 text-white border-slate-800' : 'bg-slate-100 text-slate-900 border-slate-300'} ${isMobile ? 'p-2' : 'p-2.5'} pl-14 rounded-2xl font-black border-2 transition-all duration-200 ${(gateLoginError && !inputServer.trim()) ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : (activeInput === 'server' ? (isRegisterMode ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.3)]') : '')}`}
                                            style={{ fontSize: (isMobile ? 14 : 18) * fontSizeScale }}
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
                                        <Text className={`${isDark ? 'text-white/60' : 'text-slate-500'} font-black uppercase tracking-widest text-left`} style={{ fontSize: 10 * fontSizeScale }}>{t('dashboard.allianceName')}</Text>
                                        <Text className={`${isRegisterMode ? 'text-amber-500/80' : 'text-sky-500/80'} font-bold text-right`} style={{ fontSize: 8 * fontSizeScale }}>{t('dashboard.required')}</Text>
                                    </View>
                                    <View className="relative">
                                        <View className="absolute left-2 top-0 bottom-0 z-10 w-12 items-center justify-center">
                                            <Ionicons name="shield-outline" size={20} color={isRegisterMode ? "#fbbf24" : "#38bdf8"} />
                                        </View>
                                        <TextInput
                                            placeholder="WBI"
                                            placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(30, 41, 59, 0.4)"}
                                            value={inputAlliance}
                                            onChangeText={setInputAlliance}
                                            onFocus={() => setActiveInput('alliance')}
                                            onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                            className={`${isDark ? 'bg-slate-950/50 text-white border-slate-800' : 'bg-slate-100 text-slate-900 border-slate-300'} ${isMobile ? 'p-2' : 'p-2.5'} pl-14 rounded-2xl font-black border-2 transition-all duration-200 ${(gateLoginError && !inputAlliance.trim()) ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : (activeInput === 'alliance' ? (isRegisterMode ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.3)]') : '')}`}
                                            style={{ fontSize: (isMobile ? 14 : 18) * fontSizeScale }}
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
                                    <Text className={`${isDark ? 'text-white/60' : 'text-slate-500'} font-black ml-4 mb-1.5 uppercase tracking-widest`} style={{ fontSize: 10 * fontSizeScale }}>{t('dashboard.lordName')}</Text>
                                    <View className="relative">
                                        <View className="absolute left-2 top-0 bottom-0 z-10 w-12 items-center justify-center">
                                            <Ionicons name="person-outline" size={20} color={isRegisterMode ? "#fbbf24" : "#38bdf8"} />
                                        </View>
                                        <TextInput
                                            placeholder={t('auth.onlyIdErrorPlaceholder')}
                                            placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(30, 41, 59, 0.4)"}
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
                                            className={`${isDark ? 'bg-slate-950/50 text-white border-slate-800' : 'bg-slate-100 text-slate-900 border-slate-300'} ${isMobile ? 'p-2' : 'p-2.5'} pl-14 rounded-2xl font-black border-2 transition-all duration-200 ${(gateLoginError && !!inputUserId.trim()) ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : (activeInput === 'userid' ? (isRegisterMode ? 'border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.3)]') : '')}`}
                                            style={{ fontSize: (isMobile ? 14 : 18) * fontSizeScale }}
                                            // @ts-ignore - Web-specific property
                                            tabIndex={3}
                                        />
                                        {renderHistorySuggestions('userid')}
                                    </View>
                                </View>

                                {/* Password */}
                                <View className="flex-1" style={{ zIndex: activeInput === 'password' ? 100 : 20 }}>
                                    <View className="flex-row justify-between items-center ml-4 mb-1.5 ">
                                        <Text className={`${isDark ? 'text-white/60' : 'text-slate-500'} font-black uppercase tracking-widest text-left`} style={{ fontSize: 10 * fontSizeScale }}>{t('dashboard.password')}</Text>
                                        {isRegisterMode && (
                                            <Text className="text-amber-500/80 font-bold text-right" style={{ fontSize: 8 * fontSizeScale }}>{t('dashboard.required')}</Text>
                                        )}
                                    </View>
                                    <View className="relative">
                                        <View className="absolute left-2 top-0 bottom-0 z-10 w-12 items-center justify-center">
                                            <Ionicons name="lock-closed-outline" size={20} color={isRegisterMode ? "#fbbf24" : "#38bdf8"} />
                                        </View>
                                        <TextInput
                                            ref={gatePasswordRef}
                                            placeholder="••••••"
                                            placeholderTextColor={isDark ? "rgba(255, 255, 255, 0.3)" : "rgba(30, 41, 59, 0.4)"}
                                            value={inputPassword}
                                            onChangeText={(text) => {
                                                setInputPassword(text);
                                                if (gateLoginError) setGateLoginError(null);
                                            }}
                                            secureTextEntry={!showGatePw}
                                            onFocus={() => setActiveInput('password')}
                                            onBlur={() => setTimeout(() => setActiveInput(null), 200)}
                                            onSubmitEditing={handleEnterAlliance}
                                            className={`${isDark ? 'bg-slate-950/50 text-white border-slate-800' : 'bg-slate-100 text-slate-900 border-slate-300'} ${isMobile ? 'p-2' : 'p-2.5'} pl-14 pr-12 rounded-2xl font-black border-2 transition-all duration-200 ${(gateLoginError && !!inputPassword.trim()) ? 'border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.3)]' : (activeInput === 'password' ? (isRegisterMode ? 'border-amber-500 shadow-[0_0_15_rgba(245,158,11,0.3)]' : 'border-sky-500 shadow-[0_0_15px_rgba(56,189,248,0.3)]') : '')}`}
                                            style={{ fontSize: (isMobile ? 14 : 18) * fontSizeScale }}
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
                                    <Text className="text-rose-500 font-bold" style={{ fontSize: 12 * fontSizeScale }}>{gateLoginError}</Text>
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
                                        <Text className={`text-white font-black tracking-tight relative z-10`} style={{ fontSize: (isMobile ? 16 : 18) * fontSizeScale }}>
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
                                            backgroundColor: hovered ? (isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(56, 189, 248, 0.05)') : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                                            borderWidth: 1,
                                            borderColor: hovered ? '#38bdf8' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'),
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
                                        <View className="flex-row items-center justify-center">
                                            <Animated.View
                                                style={{
                                                    marginRight: 6,
                                                    opacity: returnPulseAnim.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: [0.6, 1]
                                                    })
                                                }}
                                            >
                                                <Ionicons
                                                    name="arrow-back-circle-outline"
                                                    size={16}
                                                    color={isDark ? '#94a3b8' : '#64748b'}
                                                />
                                            </Animated.View>
                                            <Animated.Text
                                                className="font-bold tracking-tight"
                                                style={{
                                                    fontSize: 12 * fontSizeScale,
                                                    color: returnPulseAnim.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: isDark ? ['#94a3b8', '#ffffff'] : ['#64748b', '#0f172a']
                                                    }),
                                                    // @ts-ignore - Web-specific CSS property
                                                    textShadow: isDark ? returnPulseAnim.interpolate({
                                                        inputRange: [0, 1],
                                                        outputRange: ['0 0 0px rgba(56, 189, 248, 0)', '0 0 10px rgba(56, 189, 248, 0.3)']
                                                    }) : 'none'
                                                }}
                                            >
                                                {t('dashboard.returnToDashboard')}
                                            </Animated.Text>
                                        </View>
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
                                            <Text className={`font-black tracking-[0.3em] uppercase mb-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`} style={{ fontSize: 10 * fontSizeScale }}>{t('dashboard.gateGuide')}</Text>
                                            <Text className={`font-black ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 24 * fontSizeScale }}>{t('dashboard.loginGuide')}</Text>
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
                                    <Text className="text-amber-500 font-black" style={{ fontSize: 18 * fontSizeScale }}>{t('dashboard.understood')}</Text>
                                </TouchableOpacity>
                            </View>
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
                        <View className="pt-4 pb-2">
                            <View className="flex-row justify-between items-center mb-6">
                                <View className="flex-1 mr-3">
                                    <View className="flex-row items-center mb-1 gap-3">
                                        <View className="flex-row items-center opacity-70">
                                            <Ionicons name="time-outline" size={9} color={isDark ? "#38bdf8" : "#2563eb"} style={{ marginRight: 3 }} />
                                            <Text className={`font-mono text-[9px] font-black tracking-tight ${isDark ? 'text-sky-400' : 'text-blue-600'}`}>
                                                {now.getHours()}:{String(now.getMinutes()).padStart(2, '0')}:{String(now.getSeconds()).padStart(2, '0')}
                                            </Text>
                                        </View>
                                    </View>
                                    {/* Reset Timer Progress Bar */}
                                    <View className="mt-1.5 flex-row items-center gap-2">
                                        <View className={`h-1 flex-1 max-w-[120px] rounded-full overflow-hidden ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                            <View
                                                className={`h-full ${isDark ? 'bg-sky-500' : 'bg-blue-500'}`}
                                                style={{ width: `${((86400 - getNextResetSeconds()) / 86400) * 100}%` }}
                                            />
                                        </View>
                                        <View className="flex-row items-center">
                                            <Ionicons name="refresh" size={9} color={isDark ? "#38bdf8" : "#2563eb"} style={{ marginRight: 2 }} />
                                            <Text className={`font-mono text-[9px] font-black ${isDark ? 'text-sky-400' : 'text-blue-600'}`}>
                                                {formatRemainingTime(getNextResetSeconds())}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Header Buttons (Top Right) */}
                                <View className="flex-row gap-1.5 md:gap-2">
                                    <Pressable
                                        onPress={toggleTheme}
                                        className={`p-1.5 rounded-full border ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}
                                    >
                                        <Ionicons name={isDark ? "sunny" : "moon"} size={16} color={isDark ? "#fbbf24" : "#333333"} />
                                    </Pressable>
                                    <Pressable
                                        onPress={() => auth.isLoggedIn ? openModalWithHistory(setIsManualVisible) : openModalWithHistory(setIsGateManualVisible)}
                                        className={`p-1.5 rounded-full border ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}
                                    >
                                        <Ionicons name="book-outline" size={16} color="#f59e0b" />
                                    </Pressable>
                                    <Pressable
                                        onPress={handleInstallClick}
                                        className={`p-1.5 rounded-full border ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}
                                    >
                                        <Ionicons name="download" size={16} color={isDark ? "#38bdf8" : "#0284c7"} />
                                    </Pressable>
                                    <Pressable
                                        onPress={handleSettingsPress}
                                        className={`p-1.5 rounded-full border-2 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}
                                        style={auth.isLoggedIn ? { borderColor: (auth.role === 'super_admin' || auth.role === 'master') ? '#fb7185' : auth.role === 'alliance_admin' ? '#818cf8' : '#22d3ee' } : {}}
                                    >
                                        <Ionicons name="person-circle" size={16} color={auth.isLoggedIn ? ((auth.role === 'super_admin' || auth.role === 'master') ? '#fb7185' : auth.role === 'alliance_admin' ? '#818cf8' : '#22d3ee') : (isDark ? '#fff' : '#94a3b8')} />
                                    </Pressable>
                                </View>
                            </View>

                            <View className="mb-4 flex-row items-center">
                                <View className={`w-16 h-16 rounded-2xl items-center justify-center mr-4 ${isDark ? 'bg-white/10' : 'bg-slate-100 shadow-sm'}`}>
                                    <Image
                                        source={require('../assets/icon.png')}
                                        style={{ width: 52, height: 52 }}
                                        resizeMode="contain"
                                    />
                                </View>
                                <View className="flex-1">
                                    <Text className={`font-bold text-[8px] md:text-xs tracking-[0.4em] mb-1 uppercase ${isDark ? 'text-sky-400' : 'text-slate-500'}`}>{t('dashboard.whiteoutSurvival')}</Text>
                                    <Text className={`text-2xl md:text-4xl font-black tracking-tighter leading-tight ${isDark ? 'text-white' : 'text-slate-950'}`}>{t('dashboard.title')}</Text>
                                    <View className="mt-2.5 flex-row items-center">
                                        <View className="h-0.5 w-8 bg-brand-accent rounded-full mr-2.5" />
                                        <Text className={`text-[11px] font-bold leading-relaxed tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('dashboard.subtitle')}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                        {!!serverId && !!allianceId && (
                            <View className="flex-row flex-wrap items-center gap-4 mt-3 mb-6">
                                <Pressable
                                    onPress={() => {
                                        setInputServer(serverId);
                                        setInputAlliance(allianceId);
                                        setIsGateOpen(true);
                                    }}
                                    className={`flex-row items-center px-4 py-3 rounded-2xl border-2 transition-all ${isDark ? 'bg-sky-500/10 border-sky-400/50' : 'bg-sky-50 border-sky-200 shadow-sm'}`}
                                >
                                    <View className={`mr-2.5 w-7 h-7 rounded-full items-center justify-center ${isDark ? 'bg-sky-500/20' : 'bg-sky-100'}`}>
                                        <Ionicons name="location" size={14} color={isDark ? "#38bdf8" : "#0284c7"} />
                                    </View>
                                    <Text className={`font-black text-xs tracking-tight ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>
                                        {serverId?.toString().startsWith('#') ? serverId : '#' + serverId} · {allianceId}
                                    </Text>
                                    <Ionicons name="chevron-forward" size={12} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginLeft: 8 }} />
                                </Pressable>

                            </View>
                        )}
                    </View>


                    {/* Notice Section */}
                    {!!notice && (!!notice.visible || !!auth.isLoggedIn) && (
                        <View className="w-full max-w-6xl px-4 md:px-8">
                            <Pressable
                                onPress={() => auth.isLoggedIn ? setNoticeDetailVisible(true) : showCustomAlert(t('common.member_only_title'), t('common.member_only_alert'), 'error')}
                                className={`mb-6 p-4 rounded-[28px] border-2 flex-row items-center ${notice.visible ? (isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200 shadow-md') : (isDark ? 'bg-slate-800/40 border-slate-700 border-dashed' : 'bg-slate-50 border-slate-200 border-dashed')}`}
                            >
                                <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 flex-shrink-0 ${notice.visible ? 'bg-amber-500/20' : 'bg-slate-700/10'}`}>
                                    <Ionicons name={notice.visible ? "notifications" : "notifications-off"} size={20} color={notice.visible ? "#f59e0b" : "#94a3b8"} />
                                </View>
                                <View
                                    className="flex-1 min-w-0 pr-2 overflow-hidden h-10 justify-center"
                                    onLayout={(e) => setNoticeContainerWidth(e.nativeEvent.layout.width)}
                                >
                                    <Animated.View style={{ transform: [{ translateX: noticeScrollAnim }], width: noticeTextWidth + noticeContainerWidth + 50, flexDirection: 'row' }}>
                                        <Text
                                            className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-950'}`}
                                            onLayout={(e) => setNoticeTextWidth(e.nativeEvent.layout.width)}
                                            numberOfLines={1}
                                        >
                                            {notice.content || t('dashboard.notice_empty')}
                                        </Text>
                                    </Animated.View>
                                </View>
                                {!!auth.isLoggedIn && (
                                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleOpenNotice(); }} className="p-2.5 bg-sky-500/10 rounded-xl flex-shrink-0">
                                        <Ionicons name="pencil" size={18} color="#38bdf8" />
                                    </TouchableOpacity>
                                )}
                            </Pressable>
                        </View>
                    )}

                    {/* Feature Cards Grid */}
                    <View className="w-full max-w-6xl px-4 md:px-8 flex-col sm:flex-row gap-4 mb-10">
                        {[
                            { id: 'events', label: t('dashboard.menu_events'), desc: t('dashboard.menu_events_desc'), icon: 'calendar', path: '/growth/events', color: '#38bdf8' },
                            { id: 'strategy', label: t('dashboard.menu_strategy'), desc: t('dashboard.menu_strategy_desc'), icon: 'map', path: '/strategy-sheet', color: '#10b981' },
                            { id: 'hero', label: t('dashboard.menu_heroes'), desc: t('dashboard.menu_heroes_desc'), icon: 'people', path: '/hero-management', color: '#38bdf8' }
                        ].map((card) => (
                            <Pressable
                                key={card.id}
                                onPress={() => auth.isLoggedIn ? router.push(card.path as any) : showCustomAlert(t('common.member_only_title'), t('common.member_only_alert'), 'error')}
                                className={`w-full sm:flex-1 p-4 md:p-6 rounded-3xl border-2 flex-row items-center ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}
                            >
                                <View className={`w-11 h-11 rounded-2xl items-center justify-center mr-3 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`} style={{ borderColor: card.color, borderLeftWidth: 3 }}>
                                    <Ionicons name={!auth.isLoggedIn ? 'lock-closed' : card.icon as any} size={22} color={card.color} />
                                </View>
                                <View>
                                    <Text className={`text-2xl font-black ${isDark ? 'text-slate-100' : 'text-slate-950'}`}>{card.label}</Text>
                                    <Text className={`text-[11px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>{card.desc}</Text>
                                </View>
                            </Pressable>
                        ))}
                    </View>
                </View>

                {/* Section 2: Sticky Header (Weekly Program + Tabs) */}
                <View className={`w-full items-center z-50 py-3 ${isDark ? 'bg-[#060b14]/95' : 'bg-slate-50/95'}`} style={{ borderBottomWidth: 1, borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }}>
                    <View className="w-full max-w-6xl">
                        {/* Weekly Program Title & Timezone */}
                        <View className={`flex-row items-center justify-between px-3 md:px-6 py-3 md:py-5 border ${isDark ? 'bg-slate-900 shadow-2xl shadow-black border-slate-800' : 'bg-white border-slate-200 shadow-xl'}`}>
                            <View className="flex-row items-center flex-1 mr-2">
                                <View className={`w-1 h-6 md:w-1.5 md:h-10 rounded-full ${windowWidth < 380 ? 'mr-2' : 'mr-5'} bg-[#38bdf8]`} />
                                <View>
                                    {windowWidth > 400 && (
                                        <Text className={`text-[11px] font-black tracking-[0.25em] uppercase mb-0.5 ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>Weekly Program</Text>
                                    )}
                                    <Text className={`font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: (windowWidth < 380 ? 20 : 24) * fontSizeScale }}>
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
                                                paddingHorizontal: windowWidth < 380 ? 8 : (isMobile ? 12 : 24),
                                                height: windowWidth < 380 ? 28 : (isMobile ? 32 : 40),
                                                borderRadius: windowWidth < 380 ? 8 : 12,
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
                                                paddingHorizontal: windowWidth < 380 ? 8 : (isMobile ? 12 : 24),
                                                height: windowWidth < 380 ? 28 : (isMobile ? 32 : 40),
                                                borderRadius: windowWidth < 380 ? 8 : 12,
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
                                                paddingHorizontal: windowWidth < 380 ? 8 : (isMobile ? 12 : 20),
                                                height: windowWidth < 380 ? 28 : (isMobile ? 32 : 40),
                                                borderRadius: windowWidth < 380 ? 8 : 12,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: viewMode === 'timeline' ? '#f97316' : 'transparent',
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                                transition: 'all 0.2s',
                                            }
                                        ]}
                                    >
                                        <Ionicons name="analytics" size={windowWidth < 380 ? 16 : 20} color={viewMode === 'timeline' ? 'white' : '#f97316'} />
                                    </Pressable>
                                    <Pressable
                                        onPress={() => setViewMode('list')}
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                paddingHorizontal: windowWidth < 380 ? 8 : (isMobile ? 12 : 20),
                                                height: windowWidth < 380 ? 28 : (isMobile ? 32 : 40),
                                                borderRadius: windowWidth < 380 ? 8 : 12,
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                backgroundColor: viewMode === 'list' ? '#f97316' : 'transparent',
                                                transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                                transition: 'all 0.2s',
                                            }
                                        ]}
                                    >
                                        <Ionicons name="list" size={windowWidth < 380 ? 16 : 20} color={viewMode === 'list' ? 'white' : '#f97316'} />
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
                    <View className={`w-full max-w-sm p-8 rounded-[40px] border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <View className="items-center mb-8">
                            <View className={`w-16 h-16 rounded-2xl items-center justify-center mb-4 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                                <Ionicons name="shield-checkmark" size={32} color="#38bdf8" />
                            </View>
                            <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('admin.auth_title')}</Text>
                            <Text className={`mt-2 text-sm font-bold text-center ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{t('admin.auth_desc')}</Text>
                        </View>

                        <View className="space-y-4 mb-8">
                            <View className="relative">
                                <View className="absolute left-5 top-5 z-10">
                                    <Ionicons name="person" size={20} color={isDark ? "#38bdf8" : "#2563eb"} />
                                </View>
                                <TextInput
                                    placeholder={t('dashboard.lordName')}
                                    placeholderTextColor={isDark ? "#475569" : "#64748b"}
                                    value={loginInput}
                                    onChangeText={(t) => { setLoginInput(t); setLoginError(''); }}
                                    autoCapitalize="none"
                                    onSubmitEditing={() => loginPasswordRef.current?.focus()}
                                    blurOnSubmit={false}
                                    className={`p-5 pl-14 rounded-[24px] font-black border-2 text-lg ${isDark ? 'bg-slate-950 text-white border-slate-800 focus:border-blue-500/50' : 'bg-slate-50 text-slate-700 border-slate-100 focus:border-blue-500'}`}
                                />
                            </View>

                            <View className="relative mt-3">
                                <View className="absolute left-5 top-5 z-10">
                                    <Ionicons name="lock-closed" size={20} color={isDark ? "#38bdf8" : "#2563eb"} />
                                </View>
                                <TextInput
                                    ref={loginPasswordRef}
                                    placeholder={t('dashboard.password')}
                                    placeholderTextColor={isDark ? "#475569" : "#64748b"}
                                    value={passwordInput}
                                    onChangeText={(t) => { setPasswordInput(t); setLoginError(''); }}
                                    secureTextEntry={!showModalPw}
                                    autoCapitalize="none"
                                    onSubmitEditing={handleLogin}
                                    className={`p-5 pl-14 pr-14 rounded-[24px] font-black border-2 text-lg ${isDark ? 'bg-slate-950 text-white border-slate-800 focus:border-blue-500/50' : 'bg-slate-50 text-slate-700 border-slate-100 focus:border-blue-500'}`}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowModalPw(!showModalPw)}
                                    className="absolute right-5 top-0 bottom-0 justify-center p-2"
                                >
                                    <Ionicons name={showModalPw ? "eye-off-outline" : "eye-outline"} size={22} color="#475569" />
                                </TouchableOpacity>
                            </View>

                            {!!loginError && (
                                <View className="flex-row items-center mt-3 px-2">
                                    <Ionicons name="alert-circle" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                                    <Text className="text-red-500 font-black text-sm">{loginError}</Text>
                                </View>
                            )}
                        </View>

                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={() => { setLoginModalVisible(false); setLoginError(''); setPasswordInput(''); }}
                                className={`flex-1 py-4 rounded-[24px] border items-center justify-center active:scale-95 transition-all ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                            >
                                <Text className={`text-center font-bold text-lg ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('admin.cancel_btn')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleLogin}
                                className="flex-[2] bg-[#0091ff] py-4 rounded-[24px] shadow-lg shadow-blue-500/30 items-center justify-center active:scale-95 transition-all"
                            >
                                <Text className="text-white text-center font-black text-lg tracking-tight">{t('admin.login_btn')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Modal visible={adminMenuVisible} transparent animationType="fade" onRequestClose={() => setAdminMenuVisible(false)}>
                <View className="flex-1 bg-black/60 items-center justify-center p-4">
                    <BlurView intensity={40} tint="dark" className="absolute inset-0" />

                    <View className={`w-full max-w-sm overflow-hidden rounded-[32px] border ${isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-white/90 border-white/50'} shadow-2xl`}>
                        {/* Header with Close Button */}
                        <View className="flex-row items-center justify-between p-6 pb-2">
                            <View className="flex-row items-center gap-2">
                                <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('settings.administration')}</Text>
                                {/* Role Badge */}
                                <View className={`px-2 py-0.5 rounded-md border ${auth.role === 'master' ? 'bg-rose-500/20 border-rose-500/50' :
                                    auth.role === 'super_admin' ? 'bg-purple-500/20 border-purple-500/50' :
                                        auth.role === 'alliance_admin' ? 'bg-blue-500/20 border-blue-500/50' :
                                            'bg-emerald-500/20 border-emerald-500/50'
                                    }`}>
                                    <Text className={`text-[10px] font-black uppercase ${auth.role === 'master' ? 'text-rose-500' :
                                        auth.role === 'super_admin' ? 'text-purple-500' :
                                            auth.role === 'alliance_admin' ? 'text-blue-500' :
                                                'text-emerald-500'
                                        }`}>
                                        {auth.role === 'master' ? 'MASTER' :
                                            auth.role === 'super_admin' ? 'SUPER ADMIN' :
                                                auth.role === 'alliance_admin' ? 'ALLIANCE ADMIN' : 'OP ADMIN'}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => setAdminMenuVisible(false)}
                                className={`p-2 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                            >
                                <Ionicons name="close" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} className="p-6 pt-2">
                            <View className="gap-3">
                                {/* Admin Actions Grid */}
                                {/* Admin Actions List */}
                                <TouchableOpacity
                                    onPress={() => setAdminDashboardVisible(true)}
                                    className={`p-4 rounded-2xl flex-row items-center border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}
                                >
                                    <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                                        <Ionicons name="people" size={20} color="#818cf8" />
                                    </View>
                                    <Text className={`flex-1 font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('admin.manage_members')}</Text>
                                    <Ionicons name="chevron-forward" size={16} color={isDark ? '#64748b' : '#94a3b8'} />
                                </TouchableOpacity>

                                {auth.isLoggedIn && auth.role !== 'master' && (
                                    <TouchableOpacity
                                        onPress={() => setIsUserPassChangeOpen(true)}
                                        className={`p-4 rounded-2xl flex-row items-center border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}
                                    >
                                        <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
                                            <Ionicons name="key" size={20} color="#fbbf24" />
                                        </View>
                                        <Text className={`flex-1 font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('admin.change_pw')}</Text>
                                        <Ionicons name="chevron-forward" size={16} color={isDark ? '#64748b' : '#94a3b8'} />
                                    </TouchableOpacity>
                                )}

                                {!!isSuperAdmin && (
                                    <>
                                        <View className={`h-[1px] w-full my-2 ${isDark ? 'bg-slate-700/50' : 'bg-slate-200'}`} />

                                        <Text className={`text-[10px] font-black uppercase tracking-widest pl-1 mb-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('admin.super_admin_manage')}</Text>

                                        <TouchableOpacity
                                            onPress={() => setShowAdminList(!showAdminList)}
                                            className={`p-4 rounded-2xl flex-row items-center border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}
                                        >
                                            <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-purple-500/20' : 'bg-purple-50'}`}>
                                                <Ionicons name="ribbon" size={20} color="#a855f7" />
                                            </View>
                                            <Text className={`flex-1 font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('admin.manage_staff')}</Text>
                                            <Ionicons name={showAdminList ? "chevron-up" : "chevron-forward"} size={16} color={isDark ? '#64748b' : '#94a3b8'} />
                                        </TouchableOpacity>

                                        {showAdminList && (
                                            <View className={`mt-2 ml-4 pl-4 border-l-2 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                                                {loadingSuperAdmins ? (
                                                    <ActivityIndicator size="small" color="#a855f7" className="py-4" />
                                                ) : superAdminsList.filter(a => a.role === 'super_admin').length === 0 ? (
                                                    <Text className={`text-xs py-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>등록된 슈퍼 관리자가 없습니다.</Text>
                                                ) : (
                                                    superAdminsList.filter(a => a.role === 'super_admin').map((admin, index) => (
                                                        <View key={admin.id || index} className={`flex-row items-center justify-between py-3 pr-2 border-b last:border-0 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                                            <View className="flex-row items-center gap-3">
                                                                <View className={`w-8 h-8 rounded-xl bg-purple-500/10 items-center justify-center`}>
                                                                    <Text className="text-xs font-black text-purple-500">{admin.nickname?.[0] || 'A'}</Text>
                                                                </View>
                                                                <View>
                                                                    <Text className={`text-sm font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{admin.nickname || 'Unknown'}</Text>
                                                                    <Text className="text-[10px] text-slate-400">ID: {admin.username}</Text>
                                                                </View>
                                                            </View>
                                                            {auth.role === 'master' && (
                                                                <TouchableOpacity
                                                                    onPress={() => handleDeleteSuperAdmin(admin.id, admin.nickname)}
                                                                    className={`p-2 rounded-lg ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}
                                                                >
                                                                    <Ionicons name="trash-outline" size={14} color="#f43f5e" />
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>
                                                    ))
                                                )}

                                                {/* Add Super Admin Form (Master Only) */}
                                                {auth.role === 'master' && (
                                                    <View className={`mt-4 pt-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                                                        <Text className={`text-xs font-bold mb-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>슈퍼 관리자 추가</Text>
                                                        <View className="flex-row gap-2 mb-2">
                                                            <TextInput
                                                                className={`flex-1 p-2 rounded-lg border text-xs font-bold ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                                placeholder="ID / Nickname"
                                                                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                                                value={newAdminName}
                                                                onChangeText={setNewAdminName}
                                                                autoCapitalize="none"
                                                            />
                                                            <TextInput
                                                                className={`flex-1 p-2 rounded-lg border text-xs font-bold ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'}`}
                                                                placeholder="Password"
                                                                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                                                value={newAdminPassword}
                                                                onChangeText={setNewAdminPassword}
                                                                secureTextEntry
                                                            />
                                                        </View>
                                                        <TouchableOpacity
                                                            onPress={handleAddSuperAdmin}
                                                            className="w-full py-2 bg-purple-500 rounded-lg items-center justify-center active:scale-95 transition-all"
                                                        >
                                                            <Text className="text-white text-xs font-black">관리자 추가 (Add Staff)</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                )}
                                            </View>
                                        )}

                                        <TouchableOpacity
                                            onPress={() => {
                                                setSuperAdminTab('pending');
                                                setIsSuperAdminDashboardVisible(true);
                                            }}
                                            className={`mt-4 p-4 rounded-2xl flex-row items-center border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}
                                        >
                                            <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-sky-500/20' : 'bg-sky-50'}`}>
                                                <Ionicons name="planet" size={20} color="#38bdf8" />
                                            </View>
                                            <Text className={`flex-1 font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('admin.super_dashboard_title')}</Text>
                                            <Ionicons name="chevron-forward" size={16} color={isDark ? '#64748b' : '#94a3b8'} />
                                        </TouchableOpacity>

                                        {auth.role === 'master' && (
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setSuperAdminTab('settings');
                                                    setIsSuperAdminDashboardVisible(true);
                                                }}
                                                className={`mt-4 p-4 rounded-2xl flex-row items-center border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'}`}
                                            >
                                                <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                                                    <Ionicons name="desktop" size={20} color="#6366f1" />
                                                </View>
                                                <Text className={`flex-1 font-bold ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>{t('admin.screen_management')}</Text>
                                                <Ionicons name="chevron-forward" size={16} color={isDark ? '#64748b' : '#94a3b8'} />
                                            </TouchableOpacity>
                                        )}
                                    </>
                                )}

                                <View className={`h-[1px] w-full my-2 ${isDark ? 'bg-slate-700/50' : 'bg-slate-200'}`} />

                                {/* Logout Button */}
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
                                    className="p-4 rounded-2xl flex-row items-center justify-center bg-red-500 shadow-lg shadow-red-500/30 active:scale-95 transition-all"
                                >
                                    <Ionicons name="log-out" size={20} color="white" style={{ marginRight: 8 }} />
                                    <Text className="font-black text-white">{t('admin.logout')}</Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
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
                                                                        {req.allianceName && <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{req.allianceName}</Text>}
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

            {/* Notice Popup Modal */}
            <Modal visible={noticePopupVisible} transparent animationType="fade" onRequestClose={() => dismissNoticePopup()}>
                <View className={`flex-1 bg-black/80 items-center justify-center ${isMobile ? 'p-4' : 'p-6'}`}>
                    <BlurView intensity={40} className="absolute inset-0" />
                    <View className={`w-full max-w-md rounded-[32px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800/60' : 'bg-white border-slate-100'}`}>
                        {/* Header */}
                        <View className={`${isMobile ? 'px-4 py-3' : 'px-5 py-4'} border-b ${isDark ? 'bg-gradient-to-r from-amber-900/10 to-orange-900/10 border-amber-500/10' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'}`}>
                            <View className="flex-row items-center">
                                <View className={`${isMobile ? 'w-10 h-10 mr-3' : 'w-12 h-12 mr-4'} rounded-xl items-center justify-center ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                                    <Ionicons name="notifications" size={isMobile ? 20 : 24} color="#f59e0b" />
                                </View>
                                <View className="flex-1">
                                    <Text className={`${isMobile ? 'text-lg' : 'text-xl'} font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('popup.announcement')}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Content */}
                        <View className={`${isMobile ? 'px-4 py-4' : 'px-5 py-5'}`}>
                            <ScrollView style={{ maxHeight: isMobile ? 250 : 300 }} showsVerticalScrollIndicator={false}>
                                <Text className={`${isMobile ? dfs('text-base') : dfs('text-lg')} font-bold leading-7 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                    {notice?.content || t('popup.noContent')}
                                </Text>
                            </ScrollView>
                        </View>

                        {/* Options */}
                        <View className={`px-6 py-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                            <TouchableOpacity
                                onPress={() => setNoticePopupDontShow(!noticePopupDontShow)}
                                className="flex-row items-center mb-2"
                            >
                                <View className={`w-5 h-5 rounded-lg border-2 mr-3 items-center justify-center ${noticePopupDontShow ? 'bg-amber-500 border-amber-500' : (isDark ? 'border-slate-600' : 'border-slate-300')}`}>
                                    {noticePopupDontShow && <Ionicons name="checkmark" size={12} color="white" />}
                                </View>
                                <Text className={`font-semibold text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('popup.dontShowAgain')}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Buttons */}
                        <View className="flex-row gap-3 px-6 pb-6">
                            <TouchableOpacity
                                onPress={() => dismissNoticePopup(false, true)}
                                className={`flex-1 py-3 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                            >
                                <Text className={`text-center font-bold text-[13px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('popup.dontShowToday')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => dismissNoticePopup(noticePopupDontShow, false)}
                                className={`flex-[1.5] py-3 rounded-2xl ${isDark ? 'bg-amber-500' : 'bg-amber-500'}`}
                            >
                                <Text className="text-center font-black text-white text-base">{t('common.confirm')}</Text>
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
                    <View className={`w-full max-w-md rounded-[32px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <View className={`px-5 py-4 border-b ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                                        <Ionicons name="notifications" size={24} color="#f59e0b" />
                                    </View>
                                    <View>
                                        <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dashboard.noticeDetail')}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setNoticeDetailVisible(false)} className={`w-9 h-9 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <Ionicons name="close" size={22} color={isDark ? "#94a3b8" : "#64748b"} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View className={`mx-5 mt-5 mb-2 p-6 rounded-[32px] ${isDark ? 'bg-slate-950/50 border border-slate-700/50' : 'bg-emerald-50 border border-emerald-100'}`}>
                            <ScrollView style={{ maxHeight: 550 }} showsVerticalScrollIndicator={false}>
                                <Text className={`text-base font-normal leading-7 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                                    {notice?.content || t('popup.noContent')}
                                </Text>
                            </ScrollView>
                        </View>
                        <View className="px-5 pb-4 items-center">
                            <TouchableOpacity
                                onPress={() => setNoticeDetailVisible(false)}
                                className="py-2"
                            >
                                <Text className={`font-black text-lg ${isDark ? 'text-emerald-400' : 'text-slate-900'}`}>{t('common.close')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Notice Edit Modal */}
            <Modal
                visible={noticeModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setNoticeModalVisible(false)}
            >
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <BlurView intensity={40} className="absolute inset-0" />
                    <View className={`w-full max-w-md rounded-[32px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                        <View className={`px-5 py-4 border-b ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                                        <Ionicons name="create" size={24} color="#3b82f6" />
                                    </View>
                                    <View>
                                        <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('admin.noticeSetting')}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setNoticeModalVisible(false)} className={`w-9 h-9 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <Ionicons name="close" size={22} color={isDark ? "#94a3b8" : "#64748b"} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View className={`mx-5 mt-5 mb-1 p-5 rounded-[32px] ${isDark ? 'bg-slate-950/50 border border-slate-700/50' : 'bg-slate-50 border border-slate-200'}`}>
                            <TextInput
                                multiline
                                numberOfLines={12}
                                value={editNoticeContent}
                                onChangeText={setEditNoticeContent}
                                className={`w-full font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}
                                placeholder={t('admin.noticePlaceholder')}
                                placeholderTextColor={isDark ? "#334155" : "#94a3b8"}
                                style={{ textAlignVertical: 'top', minHeight: 400 }}
                            />
                        </View>

                        <View className="flex-row items-center justify-between mt-4 px-6">
                            <View className="flex-1 mr-4">
                                <Text className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('admin.dashboardExposure')}</Text>
                                <Text className={`text-[11px] font-bold mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('admin.noticeActiveDesc')}</Text>
                            </View>
                            <Switch
                                value={editNoticeVisible}
                                onValueChange={setEditNoticeVisible}
                                trackColor={{ false: '#334155', true: '#3b82f6' }}
                                thumbColor={isDark ? '#fff' : '#fff'}
                                style={{ transform: [{ scale: 1.0 }] }}
                            />
                        </View>
                        <View className="flex-row gap-4 px-5 pb-6 mt-4">
                            <TouchableOpacity
                                onPress={() => setNoticeModalVisible(false)}
                                className={`flex-1 py-4 rounded-[20px] border items-center justify-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                            >
                                <Text className={`text-center font-bold text-base ${isDark ? 'text-slate-100' : 'text-slate-600'}`}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleSaveNotice}
                                className="flex-[2] bg-blue-500 py-4 rounded-[20px] shadow-lg shadow-blue-500/40 items-center justify-center"
                            >
                                <Text className="text-center font-black text-white text-lg">{t('common.save')}</Text>
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
                                        <Text className={`text-[8px] font-black tracking-widest uppercase ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>PWA INSTALL</Text>
                                        <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('install.title')}</Text>
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
                                    <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100 shadow-sm'}`}>
                                        <Text className="text-lg font-black text-blue-500">1</Text>
                                    </View>
                                    <Text className={`flex-1 text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('install.step1')}</Text>
                                </View>
                                <View className="flex-row items-center">
                                    <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100 shadow-sm'}`}>
                                        <Text className="text-lg font-black text-blue-500">2</Text>
                                    </View>
                                    <Text className={`flex-1 text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('install.step2')}</Text>
                                </View>
                                <View className="flex-row items-center">
                                    <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100 shadow-sm'}`}>
                                        <Text className="text-lg font-black text-blue-500">3</Text>
                                    </View>
                                    <Text className={`flex-1 text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('install.step3')}</Text>
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
                                <Text className="text-blue-500 font-black text-lg tracking-widest">{t('common.confirm')}</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Gate Manual (Login Guide) */}
            <Modal visible={isGateManualVisible} transparent animationType="fade" onRequestClose={() => setIsGateManualVisible(false)}>
                <View className="flex-1 bg-black/80 items-center justify-center p-4">
                    <BlurView intensity={40} className="absolute inset-0" />
                    <View className={`w-full max-w-2xl ${isMobile ? 'h-[90%]' : 'h-[80%]'} rounded-[32px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <View className={`${isMobile ? 'px-6 py-4' : 'px-10 py-5'} border-b ${isDark ? 'bg-gradient-to-r from-slate-950 to-slate-900 border-slate-800' : 'bg-gradient-to-r from-slate-50/80 to-white border-slate-200 shadow-sm'}`}>
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <View className={`${isMobile ? 'w-10 h-10 rounded-xl mr-3' : 'w-12 h-12 rounded-2xl mr-5'} items-center justify-center ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
                                        <Ionicons name="help-circle" size={isMobile ? 22 : 26} color="#f59e0b" />
                                    </View>
                                    <View>
                                        <Text className={`${isMobile ? 'text-[8px]' : 'text-[9px]'} font-black tracking-[0.3em] uppercase mb-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>Gate Guide</Text>
                                        <Text className={`${isMobile ? 'text-lg' : 'text-xl'} font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.loginTitle')}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setIsGateManualVisible(false)} className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <Ionicons name="close" size={isMobile ? 20 : 24} color={isDark ? "#94a3b8" : "#64748b"} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        {renderGateManualContent()}
                        <View className={`${isMobile ? 'px-6 py-4' : 'px-10 py-6'} items-center justify-center border-t ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-white border-slate-200'}`}>
                            <Pressable
                                onPress={() => setIsGateManualVisible(false)}
                                style={({ hovered, pressed }: any) => [
                                    {
                                        paddingHorizontal: isMobile ? 32 : 48,
                                        paddingVertical: 5,
                                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                        opacity: pressed ? 0.8 : 1,
                                        transition: 'all 0.2s',
                                        // @ts-ignore
                                        textShadow: hovered ? '0 0 12px rgba(245, 158, 11, 0.4)' : 'none'
                                    }
                                ]}
                            >
                                <Text className={`text-amber-500 font-black text-lg tracking-widest`}>{t('common.confirm')}</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Main Manual (Dashboard Guide) */}
            <Modal visible={isManualVisible} transparent animationType="fade" onRequestClose={() => setIsManualVisible(false)}>
                <View className="flex-1 bg-black/80 items-center justify-center p-4">
                    <BlurView intensity={40} className="absolute inset-0" />
                    <View className={`w-full max-w-2xl ${isMobile ? 'h-[90%]' : 'h-[80%]'} rounded-[32px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <View className={`${isMobile ? 'px-6 py-4' : 'px-10 py-5'} border-b ${isDark ? 'bg-gradient-to-r from-slate-950 to-slate-900 border-slate-800' : 'bg-gradient-to-r from-slate-50/80 to-white border-slate-200 shadow-sm'}`}>
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <View className={`${isMobile ? 'w-10 h-10 rounded-xl mr-3' : 'w-12 h-12 rounded-2xl mr-5'} items-center justify-center ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
                                        <Ionicons name="book" size={isMobile ? 22 : 26} color="#f59e0b" />
                                    </View>
                                    <View>
                                        <Text className={`${isMobile ? 'text-[8px]' : 'text-[9px]'} font-black tracking-[0.3em] uppercase mb-1 ${isDark ? 'text-amber-400' : 'text-amber-600'}`}>User Manual</Text>
                                        <Text className={`${isMobile ? 'text-lg' : 'text-xl'} font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('manual.mainManualTitle')}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={() => setIsManualVisible(false)} className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <Ionicons name="close" size={isMobile ? 20 : 24} color={isDark ? "#94a3b8" : "#64748b"} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        {renderMainManualContent()}
                        <View className={`${isMobile ? 'px-6 py-4' : 'px-10 py-6'} items-center justify-center border-t ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-white border-slate-200'}`}>
                            <Pressable
                                onPress={() => setIsManualVisible(false)}
                                style={({ hovered, pressed }: any) => [
                                    {
                                        paddingHorizontal: isMobile ? 32 : 48,
                                        paddingVertical: 5,
                                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                        opacity: pressed ? 0.8 : 1,
                                        transition: 'all 0.2s',
                                        // @ts-ignore
                                        textShadow: hovered ? '0 0 12px rgba(245, 158, 11, 0.4)' : 'none'
                                    }
                                ]}
                            >
                                <Text className={`text-amber-500 font-black text-lg tracking-widest`}>{t('common.confirm')}</Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
