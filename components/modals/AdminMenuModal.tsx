import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ScrollView,
    TextInput,
    ActivityIndicator
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface AdminMenuModalProps {
    isVisible: boolean;
    onClose: () => void;
    isDark: boolean;
    auth: any;
    isSuperAdmin: boolean;
    setAdminDashboardVisible: (v: boolean) => void;
    setIsUserPassChangeOpen: (v: boolean) => void;
    setIsSuperAdminDashboardVisible: (v: boolean) => void;
    setSuperAdminTab: (tab: 'pending' | 'settings' | 'alliances') => void;
    handleLogout: (setter: (v: boolean) => void) => void;
    setAdminMenuVisible: (v: boolean) => void;
    showAdminList: boolean;
    setShowAdminList: (v: boolean) => void;
    loadingSuperAdmins: boolean;
    superAdminsList: any[];
    handleDeleteSuperAdmin: (id: string, name: string) => void;
    newAdminName: string;
    setNewAdminName: (v: string) => void;
    newAdminPassword: string;
    setNewAdminPassword: (v: string) => void;
    handleAddSuperAdmin: () => void;
    pendingCount?: number;
}

export const AdminMenuModal = ({
    isVisible,
    onClose,
    isDark,
    auth,
    isSuperAdmin,
    setAdminDashboardVisible,
    setIsUserPassChangeOpen,
    setIsSuperAdminDashboardVisible,
    setSuperAdminTab,
    handleLogout,
    setAdminMenuVisible,
    showAdminList,
    setShowAdminList,
    loadingSuperAdmins,
    superAdminsList,
    handleDeleteSuperAdmin,
    newAdminName,
    setNewAdminName,
    newAdminPassword,
    setNewAdminPassword,
    handleAddSuperAdmin,
    pendingCount = 0
}: AdminMenuModalProps) => {
    const { t } = useTranslation();

    return (
        <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
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
                            onPress={onClose}
                            className={`p-2 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}
                        >
                            <Ionicons name="close" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} className="p-6 pt-2">
                        <View className="gap-3">
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
                                        {pendingCount > 0 && (
                                            <View className="bg-rose-500 px-2 py-0.5 rounded-full mr-2">
                                                <Text className="text-[10px] font-black text-white">{pendingCount}</Text>
                                            </View>
                                        )}
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
                                onPress={() => handleLogout(onClose)}
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
    );
};
