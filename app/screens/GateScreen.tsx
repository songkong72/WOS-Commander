import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Pressable,
    TextInput,
    Image,
    ImageBackground,
    ActivityIndicator,
    ScrollView,
    Modal,
    Animated,
    Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context';
import { useGateLogic } from '../hooks/useGateLogic';

interface GateScreenProps {
    isLoading: boolean;
    isGateOpen: boolean;
    serverId: string | null;
    allianceId: string | null;
    setIsGateOpen: (open: boolean) => void;
    // States from useAdminAuth
    adminAuth: any;
    fontSizeScale: number;
    isMobile: boolean;
    changeLanguage: (lang: 'ko' | 'en') => void;
    language: string;
}

export const GateScreen = ({
    isLoading,
    isGateOpen,
    serverId,
    allianceId,
    setIsGateOpen,
    adminAuth,
    fontSizeScale,
    isMobile,
    changeLanguage,
    language
}: GateScreenProps) => {
    const { t } = useTranslation();
    const { theme, setTheme } = useTheme();
    const isDark = theme === 'dark';
    const [activeInput, setActiveInput] = useState<'server' | 'alliance' | 'userid' | 'password' | null>(null);
    const [showGatePw, setShowGatePw] = useState(false);
    const [isGateManualVisible, setIsGateManualVisible] = useState(false);

    const { flickerAnim, scaleAnim, returnPulseAnim } = useGateLogic();

    // Destructure from adminAuth hook
    const {
        inputServer, setInputServer,
        inputAlliance, setInputAlliance,
        inputUserId, setInputUserId,
        inputPassword, setInputPassword,
        isRegisterMode, setIsRegisterMode,
        recentServers, recentAlliances, recentUserIds,
        gateUserIdRef, gatePasswordRef,
        handleEnterAlliance, handleResetSettings,
        gateLoginError, setGateLoginError,
        isLoginLoading
    } = adminAuth;

    const toggleTemporaryTheme = () => {
        setTheme(isDark ? 'light' : 'dark');
    };

    const renderHistorySuggestions = (type: 'server' | 'alliance' | 'userid') => {
        if (activeInput !== type) return null;
        const list = type === 'server' ? recentServers : type === 'alliance' ? recentAlliances : recentUserIds;
        if (!list || list.length === 0) return null;

        return (
            <View className={`absolute top-full left-0 right-0 mt-2 z-[100] rounded-2xl border overflow-hidden shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                {list.map((item: string, index: number) => (
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
                        <View className={`p-8 rounded-[40px] ${isDark ? 'bg-slate-950/30 border-2 border-slate-800' : 'bg-slate-50 border-2 border-slate-200 shadow-md'}`}>
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

    if (isLoading) {
        return (
            <View className={`flex-1 ${isDark ? 'bg-[#020617]' : 'bg-slate-50'} items-center justify-center`}>
                <ImageBackground
                    source={require('../../assets/images/selection_gate_bg.png')}
                    style={{ position: 'absolute', width: '100%', height: '100%' }}
                    resizeMode="cover"
                />
                <View className={`absolute inset-0 ${isDark ? 'bg-slate-950/60' : 'bg-white/40'}`} />
                <Animated.View style={{ opacity: flickerAnim, transform: [{ scale: scaleAnim }] }} className="items-center">
                    <View className={`w-24 h-24 rounded-[40px] ${isDark ? 'bg-sky-500/20 border-sky-400/30' : 'bg-sky-100 border-sky-200'} items-center justify-center mb-8 border`}>
                        <Ionicons name="snow" size={54} color="#38bdf8" />
                    </View>
                    <Text className={`font-black tracking-[0.3em] ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 24 * fontSizeScale }}>{t('common.initializing').toUpperCase()}</Text>
                    <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 24 }} />
                </Animated.View>
            </View>
        );
    }

    if (isGateOpen || !serverId || !allianceId) {
        return (
            <View className={`flex-1 w-full h-screen ${isDark ? 'bg-[#0f172a]' : 'bg-slate-50'}`}>
                <ImageBackground
                    source={require('../../assets/images/selection_gate_bg.png')}
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
                            <View className={`absolute top-0 right-0 flex-row p-1.5 rounded-2xl border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white/60 border-slate-200'} shadow-sm`} style={{ zIndex: 10 }}>
                                <Pressable
                                    onPress={() => setIsGateManualVisible(true)}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            width: isMobile ? 38 : 36,
                                            height: isMobile ? 38 : 36,
                                            borderRadius: isMobile ? 10 : 10,
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
                                            width: isMobile ? 38 : 36,
                                            height: isMobile ? 38 : 36,
                                            borderRadius: isMobile ? 10 : 10,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: hovered ? (isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)') : 'transparent',
                                            marginLeft: isMobile ? 6 : 4,
                                            transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                            transition: 'all 0.2s',
                                            cursor: 'pointer'
                                        }
                                    ]}
                                    // @ts-ignore
                                    tabIndex={-1}
                                >
                                    <Ionicons name={isDark ? "sunny" : "moon"} size={20} color="#f59e0b" />
                                </Pressable>

                                <Pressable
                                    onPress={handleResetSettings}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            width: isMobile ? 38 : 36,
                                            height: isMobile ? 38 : 36,
                                            borderRadius: isMobile ? 10 : 10,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: hovered ? 'rgba(167, 139, 250, 0.2)' : 'transparent',
                                            marginLeft: isMobile ? 6 : 4,
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
                            <View className={`absolute top-0 left-0 flex-row p-1.5 rounded-2xl border ${isDark ? 'bg-slate-800/60 border-slate-700' : 'bg-white/60 border-slate-200'} shadow-sm`} style={{ zIndex: 10 }}>
                                <Pressable
                                    onPress={() => changeLanguage('ko')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            width: isMobile ? 38 : 36,
                                            height: isMobile ? 38 : 36,
                                            borderRadius: isMobile ? 10 : 10,
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
                                        size={isMobile ? 20 : 18}
                                        color={language === 'ko' ? 'white' : '#64748b'}
                                    />
                                </Pressable>

                                <Pressable
                                    onPress={() => changeLanguage('en')}
                                    style={({ pressed, hovered }: any) => [
                                        {
                                            width: isMobile ? 38 : 36,
                                            height: isMobile ? 38 : 36,
                                            borderRadius: isMobile ? 10 : 10,
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: language === 'en'
                                                ? '#2563eb'
                                                : (hovered ? 'rgba(59, 130, 246, 0.2)' : 'transparent'),
                                            borderColor: language === 'en' ? 'transparent' : (hovered ? '#60a5fa' : 'transparent'),
                                            borderWidth: 1,
                                            marginLeft: isMobile ? 6 : 4,
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
                                        size={isMobile ? 20 : 18}
                                        color={language === 'en' ? 'white' : '#64748b'}
                                    />
                                </Pressable>
                            </View>

                            <View className="items-center justify-center mb-6" style={{ marginTop: isMobile ? 64 : 46 }}>
                                <View className="w-28 h-28 items-center justify-center mb-2">
                                    <Image
                                        source={require('../../assets/icon.png')}
                                        style={{ width: '120%', height: '120%' }}
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
                            <View className={`${isMobile ? 'flex-col' : 'flex-row'} gap-2.5`} style={{ zIndex: (activeInput === 'server' || activeInput === 'alliance') ? 100 : 50 }}>
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
                            <View className={`${isMobile ? 'flex-col' : 'flex-row'} gap-2.5`} style={{ zIndex: (activeInput === 'userid' || activeInput === 'password') ? 100 : 30 }}>
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

    return null;
};
