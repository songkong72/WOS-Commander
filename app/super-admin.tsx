import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    Platform,
    Image,
    StyleSheet,
    Modal
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, orderBy, Timestamp, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { useAuth, useTheme } from './context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface AllianceRequest {
    id: string;
    serverId: string;
    allianceId: string;
    allianceName: string;
    adminId: string;
    adminPassword?: string;
    contact?: string;
    status: 'pending' | 'approved' | 'rejected';
    requestedAt: number;
}

export default function SuperAdminDashboard() {
    const router = useRouter();
    const { auth } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const [activeTab, setActiveTab] = useState<'pending' | 'alliances'>('pending');
    const [requests, setRequests] = useState<AllianceRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedReqIds, setSelectedReqIds] = useState<Set<string>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Custom Alert State
    const [customAlert, setCustomAlert] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'warning' | 'confirm';
        onConfirm?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'error'
    });

    const showCustomAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'confirm' = 'error', onConfirm?: () => void) => {
        setCustomAlert({ visible: true, title, message, type, onConfirm });
    };

    // Super Admin 체크 (Role 또는 ID로 체크)
    const isSuperAdmin = auth.isLoggedIn && (
        auth.role === 'master' ||
        auth.role === 'super_admin' ||
        auth.adminName === 'admin' ||
        auth.adminName === 'master' ||
        auth.adminName === '관리자'
    );

    useEffect(() => {
        if (!isSuperAdmin) {
            Alert.alert('권한 없음', '전서버관리자만 접근 가능한 페이지입니다.');
            router.replace('/');
            return;
        }

        const q = query(
            collection(db, 'alliance_requests'),
            orderBy('requestedAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const reqs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as AllianceRequest));
            setRequests(reqs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isSuperAdmin]);

    const toggleSelect = (id: string) => {
        setSelectedReqIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBulkApprove = async () => {
        if (selectedReqIds.size === 0 || isSubmitting) return;
        showCustomAlert(
            '일괄 승인',
            `선택한 ${selectedReqIds.size}개의 연맹을 일괄 승인하고 계정을 생성하시겠습니까?`,
            'confirm',
            async () => {
                try {
                    setIsSubmitting(true);
                    const batch = writeBatch(db);
                    const selectedReqs = requests.filter(r => selectedReqIds.has(r.id));

                    for (const req of selectedReqs) {
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

                        const reqRef = doc(db, 'alliance_requests', req.id);
                        batch.update(reqRef, { status: 'approved' });
                    }

                    await batch.commit();
                    setSelectedReqIds(new Set());
                    showCustomAlert('성공', '선택한 연맹들의 승인 및 계정 생성이 완료되었습니다.', 'success');
                } catch (error: any) {
                    showCustomAlert('오류', '일괄 승인 중 오류가 발생했습니다: ' + error.message, 'error');
                } finally {
                    setIsSubmitting(false);
                }
            }
        );
    };

    const handleBulkReject = async () => {
        if (selectedReqIds.size === 0 || isSubmitting) return;
        showCustomAlert(
            '일괄 거절',
            `선택한 ${selectedReqIds.size}개의 가입 신청을 일괄 거절하시겠습니까?`,
            'confirm',
            async () => {
                try {
                    setIsSubmitting(true);
                    const batch = writeBatch(db);
                    selectedReqIds.forEach(id => {
                        const reqRef = doc(db, 'alliance_requests', id);
                        batch.update(reqRef, { status: 'rejected' });
                    });
                    await batch.commit();
                    setSelectedReqIds(new Set());
                    showCustomAlert('성공', '선택한 신청들이 모두 거절되었습니다.', 'success');
                } catch (error: any) {
                    showCustomAlert('오류', '일괄 거절 중 오류가 발생했습니다: ' + error.message, 'error');
                } finally {
                    setIsSubmitting(false);
                }
            }
        );
    };

    const handleApprove = async (req: AllianceRequest) => {
        showCustomAlert(
            '연맹 승인',
            `[${req.serverId}] ${req.allianceName} 연맹을 승인하시겠습니까?`,
            'confirm',
            async () => {
                try {
                    setIsSubmitting(true);
                    const userRef = doc(db, 'users', req.adminId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        showCustomAlert('오류', '이미 존재하는 관리자 ID입니다. 신청자에게 확인 요청하세요.', 'error');
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

                    showCustomAlert('성공', '연맹 승인 및 관리자 계정 생성이 완료되었습니다.', 'success');
                } catch (error: any) {
                    showCustomAlert('오류', error.message, 'error');
                } finally {
                    setIsSubmitting(false);
                }
            }
        );
    };

    const handleReject = async (req: AllianceRequest) => {
        showCustomAlert(
            '연맹 거절',
            `[${req.serverId}] ${req.allianceName} 연맹 가입 신청을 거절하시겠습니까?`,
            'confirm',
            async () => {
                try {
                    setIsSubmitting(true);
                    const reqRef = doc(db, 'alliance_requests', req.id);
                    await updateDoc(reqRef, { status: 'rejected' });
                    showCustomAlert('성공', '신청이 거절되었습니다.', 'success');
                } catch (error: any) {
                    showCustomAlert('오류', error.message, 'error');
                } finally {
                    setIsSubmitting(false);
                }
            }
        );
    };

    if (!isSuperAdmin) return null;

    const filteredRequests = activeTab === 'pending'
        ? requests.filter(r => r.status === 'pending')
        : requests.filter(r => r.status === 'approved');

    return (
        <View style={{ flex: 1, backgroundColor: '#020617' }}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Global Fixed Background Layer */}
            <View style={{
                position: Platform.OS === 'web' ? 'fixed' : 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                zIndex: -1,
                backgroundColor: '#020617',
            } as any}>
                <Image
                    source={require('../assets/images/bg-main.png')}
                    style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        width: '100%',
                        height: '100%',
                        ...(Platform.OS === 'web' ? { objectFit: 'cover' } : {})
                    } as any}
                    resizeMode="cover"
                />
                <View style={{
                    position: 'absolute',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: isDark ? 'rgba(2, 6, 23, 0.85)' : 'rgba(255, 255, 255, 0.2)'
                }} />
            </View>

            <ScrollView className={`flex-1`} contentContainerStyle={{ paddingTop: 40 }}>
                <View style={{ marginBottom: 20, paddingHorizontal: 40 }}>
                    <Text className={`text-[10px] font-black tracking-[0.3em] uppercase mb-1 ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>System Administration</Text>
                    <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>시스템관리자 대시보드</Text>
                    <View className="w-10 h-1 bg-sky-500 rounded-full mt-2" />
                </View>

                {/* Stats / Interactive Tabs */}
                <View className="flex-row gap-4 mb-8 px-10">
                    <TouchableOpacity
                        onPress={() => setActiveTab('pending')}
                        activeOpacity={0.7}
                        className={`flex-1 p-6 rounded-[32px] border transition-all duration-200 ${activeTab === 'pending' ? 'border-sky-500 bg-sky-500/10 shadow-lg shadow-sky-500/20' : (isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/50' : 'bg-white border-slate-100 shadow-sm hover:bg-slate-50')}`}
                    >
                        <Text className={`text-lg font-black uppercase tracking-widest mb-2 ${activeTab === 'pending' ? 'text-sky-500' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>승인대기중 건수</Text>
                        <Text className={`text-4xl font-black ${activeTab === 'pending' ? (isDark ? 'text-sky-400' : 'text-sky-500') : (isDark ? 'text-slate-700' : 'text-slate-300')}`}>
                            {requests.filter(r => r.status === 'pending').length}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('alliances')}
                        activeOpacity={0.7}
                        className={`flex-1 p-6 rounded-[32px] border transition-all duration-200 ${activeTab === 'alliances' ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20' : (isDark ? 'bg-slate-900 border-slate-800 hover:bg-slate-800/50' : 'bg-white border-slate-100 shadow-sm hover:bg-slate-50')}`}
                    >
                        <Text className={`text-lg font-black uppercase tracking-widest mb-2 ${activeTab === 'alliances' ? 'text-emerald-500' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>승인완료 건수</Text>
                        <Text className={`text-4xl font-black ${activeTab === 'alliances' ? (isDark ? 'text-emerald-400' : 'text-emerald-500') : (isDark ? 'text-slate-700' : 'text-slate-300')}`}>
                            {requests.filter(r => r.status === 'approved').length}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View className="flex-row items-center justify-between mb-8 px-10">
                    <View>
                        <View className="flex-row items-center gap-3 mb-1">
                            <View className="w-1.5 h-6 bg-sky-500 rounded-full" />
                            <Text className={`text-3xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {activeTab === 'pending' ? '신청 대기열' : '등록된 연맹'}
                            </Text>
                        </View>
                        <Text className={`text-xs font-bold pl-4 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {activeTab === 'pending' ? '새로운 연맹 가입 신청 내역입니다.' : '현재 시스템에 등록된 활성 연맹 목록입니다.'}
                        </Text>
                    </View>

                    {activeTab === 'pending' && requests.filter(r => r.status === 'pending').length > 0 && (
                        <TouchableOpacity
                            onPress={() => {
                                const pendingReqs = requests.filter(r => r.status === 'pending');
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
                                name={selectedReqIds.size === requests.filter(r => r.status === 'pending').length ? "checkbox" : "square-outline"}
                                size={20}
                                color={selectedReqIds.size > 0 ? "#38bdf8" : (isDark ? "#475569" : "#94a3b8")}
                            />
                            <Text className={`ml-2 font-black text-xs ${selectedReqIds.size > 0 ? (isDark ? 'text-white' : 'text-slate-900') : 'text-slate-500'}`}>
                                전체 선택
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Bulk Actions Menu */}
                {selectedReqIds.size > 0 && (
                    <View className={`flex-row gap-3 mb-8 mx-10 p-4 rounded-[24px] border shadow-xl transition-all ${isDark ? 'bg-slate-900/95 border-sky-500/20' : 'bg-white border-sky-100 shadow-sky-200/40'}`}>
                        <View className="flex-1 flex-row items-center bg-sky-500/10 px-4 py-2 rounded-xl">
                            <Ionicons name="checkbox" size={18} color="#38bdf8" />
                            <Text className={`ml-2 font-black text-base ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>
                                {selectedReqIds.size}개 <Text className="text-xs font-bold opacity-60">선택</Text>
                            </Text>
                        </View>
                        <View className="flex-row gap-2">
                            <TouchableOpacity
                                onPress={handleBulkReject}
                                activeOpacity={0.7}
                                className={`px-4 py-3 rounded-xl border ${isDark ? 'border-red-500/30 bg-red-500/10' : 'border-red-100 bg-red-50'}`}
                            >
                                <Text className="text-xs font-bold text-red-500">선택 거절</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleBulkApprove}
                                activeOpacity={0.7}
                                className="px-6 py-3 bg-sky-500 rounded-xl shadow-lg shadow-sky-500/20 flex-row items-center"
                            >
                                <Ionicons name="checkmark-circle" size={16} color="white" style={{ marginRight: 6 }} />
                                <Text className="font-black text-white text-sm">선택 승인</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {loading ? (
                    <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 40 }} />
                ) : (
                    <View className="px-10 pb-20">
                        {requests.filter(r => activeTab === 'pending' ? r.status === 'pending' : r.status === 'approved').length === 0 ? (
                            <View className="items-center justify-center py-20">
                                <Ionicons name="documents-outline" size={64} color={isDark ? '#334155' : '#cbd5e1'} />
                                <Text className={`mt-4 font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    {activeTab === 'pending' ? '대기 중인 신청이 없습니다.' : '등록된 연맹이 없습니다.'}
                                </Text>
                            </View>
                        ) : (
                            requests.filter(r => activeTab === 'pending' ? r.status === 'pending' : r.status === 'approved').map((req) => (
                                <View
                                    key={req.id}
                                    className={`p-4 rounded-[24px] border mb-3 shadow-md ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-slate-200/50'}`}
                                >
                                    <View className="flex-row">
                                        {activeTab === 'pending' && (
                                            <TouchableOpacity
                                                onPress={() => toggleSelect(req.id)}
                                                className="mr-6 justify-center"
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
                                                        <Text className={`text-[10px] font-black px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-500 mr-2 mb-1`}>{req.serverId}</Text>
                                                        <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'} mb-1`} numberOfLines={1} ellipsizeMode="tail">{req.allianceId}</Text>
                                                    </View>
                                                    <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`} numberOfLines={1}>{req.allianceName}</Text>
                                                </View>

                                                {activeTab === 'pending' && (
                                                    <View className="flex-row gap-2 shrink-0">
                                                        <TouchableOpacity
                                                            onPress={() => handleReject(req)}
                                                            activeOpacity={0.7}
                                                            className={`px-3 py-2 rounded-xl border flex-row items-center ${isDark ? 'border-red-500/30 bg-red-500/10' : 'border-red-100 bg-red-50'}`}
                                                        >
                                                            <Ionicons name="close-circle-outline" size={16} color="#ef4444" />
                                                            <Text className="text-xs font-bold text-red-500 ml-1">거절</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity
                                                            onPress={() => handleApprove(req)}
                                                            activeOpacity={0.7}
                                                            className="px-4 py-2 bg-sky-500 rounded-xl shadow-sm flex-row items-center"
                                                        >
                                                            <Ionicons name="checkmark-circle" size={16} color="white" />
                                                            <Text className="text-xs font-black text-white ml-1">승인</Text>
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
                                                    <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                                                        {new Date(req.requestedAt).toLocaleDateString()}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                )}
            </ScrollView>

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
                                    <Text className={`text-center font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>취소</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        setCustomAlert({ ...customAlert, visible: false });
                                        if (customAlert.onConfirm) customAlert.onConfirm();
                                    }}
                                    className="flex-[2] bg-sky-500 py-4 rounded-3xl shadow-lg shadow-sky-500/30"
                                >
                                    <Text className="text-center font-black text-white">확인</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                                className="bg-sky-500 py-4 rounded-3xl shadow-lg shadow-sky-500/30"
                            >
                                <Text className="text-center font-black text-white">확인</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Custom Floating Close Button - Placed at the end to ensure top Z-Index */}
            <TouchableOpacity
                onPress={() => router.replace('/?showAdminMenu=true')}
                style={{
                    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
                    top: 25,
                    right: 25,
                    zIndex: 9999,
                    width: 54,
                    height: 54,
                    borderRadius: 27,
                    backgroundColor: '#0ea5e9', // Sky 500
                    alignItems: 'center',
                    justifyContent: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.5,
                    shadowRadius: 12,
                    elevation: 15,
                    borderWidth: 2,
                    borderColor: 'rgba(255, 255, 255, 0.3)'
                } as any}
            >
                <Ionicons name="close" size={32} color="white" />
            </TouchableOpacity>
        </View>
    );
}
