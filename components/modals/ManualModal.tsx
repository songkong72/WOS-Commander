import React from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Modal,
    Pressable,
    Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';


interface ManualModalProps {
    isVisible: boolean;
    onClose: () => void;
    isDark: boolean;
    isMobile: boolean;
}

export const ManualModal = ({ isVisible, onClose, isDark, isMobile }: ManualModalProps) => {
    const { t } = useTranslation();

    const renderMainManualContent = () => (
        <ScrollView className={`flex-1 ${isMobile ? 'px-4 pt-4' : 'px-8 pt-8'}`} showsVerticalScrollIndicator={false}>
            <View className={`${isMobile ? 'gap-6' : 'gap-10'} pb-10`}>
                {/* 0. 왜 WOS 커맨더인가? (장점 섹션) */}
                <View className={`${isMobile ? 'p-5 rounded-[28px]' : 'p-8 rounded-[40px]'} border-2 ${isDark ? 'bg-amber-500/5 border-amber-500/20' : 'bg-amber-50/50 border-amber-100 shadow-sm'}`}>
                    <View className="flex-row items-center mb-6">
                        <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                            <Ionicons name="sparkles" size={20} color="#f59e0b" />
                        </View>
                        <Text className={`text-2xl font-black ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>{t('manual.benefits_title')}</Text>
                    </View>

                    <View className="gap-4">
                        {[
                            { title: t('manual.benefit_1_title'), desc: t('manual.benefit_1_desc') },
                            { title: t('manual.benefit_2_title'), desc: t('manual.benefit_2_desc') },
                            { title: t('manual.benefit_3_title'), desc: t('manual.benefit_3_desc') }
                        ].map((item, idx) => (
                            <View key={idx} className="flex-row gap-3">
                                <View className="mt-1">
                                    <View className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-amber-500' : 'bg-amber-600'}`} />
                                </View>
                                <View className="flex-1">
                                    <Text className={`text-base font-black mb-1 ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>{item.title}</Text>
                                    <Text className={`text-sm leading-6 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{item.desc}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

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

    return (
        <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
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
                            <TouchableOpacity onPress={onClose} className={`${isMobile ? 'w-10 h-10' : 'w-12 h-12'} rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <Ionicons name="close" size={isMobile ? 20 : 24} color={isDark ? "#94a3b8" : "#64748b"} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    {renderMainManualContent()}
                    <View className={`${isMobile ? 'px-6 py-4' : 'px-10 py-6'} items-center justify-center border-t ${isDark ? 'bg-slate-950/30 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <Pressable
                            onPress={onClose}
                            style={({ hovered, pressed }: any) => [
                                {
                                    paddingHorizontal: isMobile ? 32 : 48,
                                    paddingVertical: 5,
                                    transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                    opacity: pressed ? 0.8 : 1,
                                    transition: 'all 0.2s',
                                    // @ts-ignore
                                    textShadow: (hovered && Platform.OS === 'web') ? '0 0 12px rgba(245, 158, 11, 0.4)' : 'none'
                                }
                            ]}
                        >
                            <Text className={`text-amber-500 font-black text-lg tracking-widest`}>{t('common.confirm')}</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
