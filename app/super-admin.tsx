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
import { collection, query, where, onSnapshot, doc, updateDoc, setDoc, orderBy, Timestamp, getDoc } from 'firebase/firestore';
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

    const handleApprove = async (req: AllianceRequest) => {
        showCustomAlert(
            '연맹 승인',
            `[${req.serverId}] ${req.allianceName} 연맹을 승인하시겠습니까?`,
            'confirm',
            async () => {
                try {
                    // 1. 유저 계정 생성 (Alliance Admin)
                    const userRef = doc(db, 'users', req.adminId);

                    // 이미 존재하는 ID인지 확인
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        showCustomAlert('오류', '이미 존재하는 관리자 ID입니다. 신청자에게 확인 요청하세요.', 'error');
                        return;
                    }

                    await setDoc(userRef, {
                        uid: `admin_${req.serverId.replace('#', '')}_${req.allianceId}`,
                        username: req.adminId,
                        password: req.adminPassword, // 이미 해싱된 상태여야 함
                        nickname: `${req.allianceId} 관리자`,
                        role: 'alliance_admin',
                        status: 'active',
                        serverId: req.serverId,
                        allianceId: req.allianceId,
                        contact: req.contact,
                        createdAt: Date.now()
                    });

                    // 2. 신청 상태 변경
                    const reqRef = doc(db, 'alliance_requests', req.id);
                    await updateDoc(reqRef, { status: 'approved' });

                    showCustomAlert('성공', '연맹 승인 및 관리자 계정 생성이 완료되었습니다.', 'success');
                } catch (error: any) {
                    showCustomAlert('오류', error.message, 'error');
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
                    const reqRef = doc(db, 'alliance_requests', req.id);
                    await updateDoc(reqRef, { status: 'rejected' });
                    showCustomAlert('완료', '신청이 거절되었습니다.', 'success');
                } catch (error: any) {
                    showCustomAlert('오류', error.message, 'error');
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

            <ScrollView className={`flex-1 px-4`} contentContainerStyle={{ paddingTop: 80 }}>
                {/* Custom Page Title */}
                <View style={{ marginBottom: 40, paddingHorizontal: 16 }}>
                    <Text className={`text-[10px] font-black tracking-[0.3em] uppercase mb-1 ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>System Administration</Text>
                    <Text className={`text-4xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>시스템관리자 대시보드</Text>
                    <View className="w-12 h-1 bg-sky-500 rounded-full mt-4" />
                </View>

                {/* Statistics Header */}
                <View className="flex-row gap-4 mb-8">
                    <View className={`flex-1 p-6 rounded-[32px] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <Text className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>승인 대기</Text>
                        <Text className={`text-4xl font-black ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>
                            {requests.filter(r => r.status === 'pending').length}
                        </Text>
                    </View>
                    <View className={`flex-1 p-6 rounded-[32px] border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <Text className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>활성 연맹 수</Text>
                        <Text className={`text-4xl font-black ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                            {requests.filter(r => r.status === 'approved').length}
                        </Text>
                    </View>
                </View>

                {/* Tabs */}
                <View className={`flex-row p-1.5 rounded-2xl mb-8 ${isDark ? 'bg-slate-900' : 'bg-slate-200/50'}`}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('pending')}
                        className={`flex-1 py-4 rounded-xl items-center ${activeTab === 'pending' ? (isDark ? 'bg-slate-800' : 'bg-white shadow-sm') : ''}`}
                    >
                        <Text className={`font-black text-xs ${activeTab === 'pending' ? (isDark ? 'text-white' : 'text-slate-900') : 'text-slate-500'}`}>승인 대기열</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('alliances')}
                        className={`flex-1 py-4 rounded-xl items-center ${activeTab === 'alliances' ? (isDark ? 'bg-slate-800' : 'bg-white shadow-sm') : ''}`}
                    >
                        <Text className={`font-black text-xs ${activeTab === 'alliances' ? (isDark ? 'text-white' : 'text-slate-900') : 'text-slate-500'}`}>등록된 연맹</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#38bdf8" style={{ marginTop: 40 }} />
                ) : (
                    <View className="pb-20">
                        {filteredRequests.length === 0 ? (
                            <View className="items-center justify-center py-20">
                                <Ionicons name="documents-outline" size={64} color={isDark ? '#334155' : '#cbd5e1'} />
                                <Text className={`mt-4 font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>데이터가 없습니다.</Text>
                            </View>
                        ) : (
                            filteredRequests.map((req) => (
                                <View
                                    key={req.id}
                                    className={`p-6 rounded-[32px] border mb-4 shadow-xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-slate-200/50'}`}
                                >
                                    <View className="flex-row justify-between mb-4">
                                        <View>
                                            <View className="flex-row items-center mb-1">
                                                <Text className={`text-xs font-black px-2 py-0.5 rounded bg-sky-500/10 text-sky-500 mr-2`}>{req.serverId}</Text>
                                                <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{req.allianceId}</Text>
                                            </View>
                                            <Text className={`text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{req.allianceName}</Text>
                                        </View>
                                        <View className="items-end">
                                            <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                {new Date(req.requestedAt).toLocaleDateString()}
                                            </Text>
                                            <View className={`mt-2 px-3 py-1 rounded-full ${req.status === 'pending' ? 'bg-amber-500/10' : 'bg-emerald-500/10'}`}>
                                                <Text className={`text-[10px] font-black uppercase ${req.status === 'pending' ? 'text-amber-500' : 'text-emerald-500'}`}>{req.status}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    <View className={`p-4 rounded-2xl mb-6 ${isDark ? 'bg-slate-950/50' : 'bg-slate-50'}`}>
                                        <View className="flex-row justify-between mb-2">
                                            <Text className={`text-xs font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Admin ID</Text>
                                            <Text className={`text-xs font-black ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{req.adminId}</Text>
                                        </View>
                                        <View className="flex-row justify-between">
                                            <Text className={`text-xs font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Contact</Text>
                                            <Text className={`text-xs font-black ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{req.contact || '-'}</Text>
                                        </View>
                                    </View>

                                    {req.status === 'pending' && (
                                        <View className="flex-row gap-3">
                                            <TouchableOpacity
                                                onPress={() => handleReject(req)}
                                                className={`flex-1 py-4 rounded-2xl border ${isDark ? 'border-slate-800' : 'border-slate-100'}`}
                                            >
                                                <Text className="text-center font-bold text-red-500">거절</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={() => handleApprove(req)}
                                                className="flex-[2] bg-sky-500 py-4 rounded-2xl shadow-lg shadow-sky-500/30"
                                            >
                                                <Text className="text-center font-black text-white px-2">승인 및 계정 생성</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
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
