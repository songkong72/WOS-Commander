import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface SuperAdminModalProps {
    isVisible: boolean;
    onClose: () => void;
    isDark: boolean;
    superAdminTab: string;
    setSuperAdminTab: (tab: any) => void;
    allRequests: any[];
    selectedReqIds: Set<string>;
    setSelectedReqIds: (set: Set<string>) => void;
    handleBulkApprove: () => void;
    handleBulkReject: () => void;
    handleApproveRequest: (req: any) => void;
    handleRejectRequest: (req: any) => void;
    handleResetPasswordAdmin: (req: any) => void;
    handleDeleteAlliance: (req: any) => void;
    isSuperAdminLoading: boolean;
    t: (key: string, options?: any) => string;
    fontSizeScale: number;
    globalThemeConfig: any;
    saveGlobalTheme: (mode: 'dark' | 'light') => void;
    setTheme: (mode: 'dark' | 'light') => void;
    setFontSize: (size: 'small' | 'medium' | 'large') => void;
    fontSize: 'small' | 'medium' | 'large';
    toggleSelectRequest: (id: string) => void;
}

export const SuperAdminModal: React.FC<SuperAdminModalProps> = ({
    isVisible,
    onClose,
    isDark,
    superAdminTab,
    setSuperAdminTab,
    allRequests,
    selectedReqIds,
    setSelectedReqIds,
    handleBulkApprove,
    handleBulkReject,
    handleApproveRequest,
    handleRejectRequest,
    handleResetPasswordAdmin,
    handleDeleteAlliance,
    isSuperAdminLoading,
    t,
    fontSizeScale,
    globalThemeConfig,
    saveGlobalTheme,
    setTheme,
    setFontSize,
    fontSize,
    toggleSelectRequest
}) => {
    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#f8fafc' }}>
                {/* Global Fixed Background Layer */}
                <View style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    zIndex: -1,
                }}>
                    <Image
                        source={require('../../assets/images/bg-main.png')}
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
                            onPress={onClose}
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
            </View>
        </Modal>
    );
};
