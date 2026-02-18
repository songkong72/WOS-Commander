import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, Platform, ActivityIndicator, Modal, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useTheme } from '../app/context';
import { useFirestoreMembers } from '../hooks/useFirestoreMembers';
import { useFirestoreAdmins } from '../hooks/useFirestoreAdmins';
import { useFirestoreStrategySheet } from '../hooks/useFirestoreStrategySheet';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as XLSX from 'xlsx';
import { hashPassword } from '../utils/crypto';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, writeBatch, doc, where } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';

interface AdminManagementProps {
    serverId: string | null;
    allianceId: string | null;
    onBack: () => void;
}

export default function AdminManagement({ serverId, allianceId, onBack }: AdminManagementProps) {
    const { t } = useTranslation();
    const { auth } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { width } = useWindowDimensions();
    const isMobile = width < 600;

    const [targetServerId, setTargetServerId] = useState(serverId);
    const [targetAllianceId, setTargetAllianceId] = useState(allianceId);

    const { members, loading: membersLoading, saveMembers, clearAllMembers, deleteMember, updateMemberPassword } = useFirestoreMembers(targetServerId, targetAllianceId);
    const { sheetData, saveSheetUrl, uploadStrategyFile } = useFirestoreStrategySheet(targetServerId, targetAllianceId);

    const [searchTerm, setSearchTerm] = useState('');
    const [uploading, setUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [strategyUploading, setStrategyUploading] = useState(false);
    const [previewData, setPreviewData] = useState<{ id: string, nickname: string }[]>([]);
    const [showGuide, setShowGuide] = useState(false);
    const [strategyUrl, setStrategyUrl] = useState('');
    const [saveLoading, setSaveLoading] = useState(false);

    // -- Manual Entry States --
    const [manualNick, setManualNick] = useState('');
    const [manualId, setManualId] = useState('');
    const [manualPw, setManualPw] = useState('');

    const [selectedMember, setSelectedMember] = useState<any>(null);
    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [roleFilter, setRoleFilter] = useState<'all' | 'staff' | 'general'>('all');
    const [hoveredRow, setHoveredRow] = useState<string | null>(null);
    const [hoveredStaffBtn, setHoveredStaffBtn] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'members' | 'strategy'>('members');

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

    const [allServers, setAllServers] = useState<string[]>([]);
    const [allAlliances, setAllAlliances] = useState<{ id: string, serverId: string }[]>([]);

    useEffect(() => {
        if (auth.role === 'master' || auth.role === 'super_admin') {
            const fetchAlliances = async () => {
                const q = query(collection(db, 'alliance_requests'), where('status', '==', 'approved'));
                const snapshot = await getDocs(q);
                // Deduplicate alliances
                const uniqueMap = new Map();
                snapshot.docs.forEach(d => {
                    const data = d.data();
                    const key = `${data.serverId}_${data.allianceId}`;
                    if (!uniqueMap.has(key)) {
                        uniqueMap.set(key, { id: data.allianceId, serverId: data.serverId });
                    }
                });

                const uniqueAlliances = Array.from(uniqueMap.values()) as { id: string, serverId: string }[];
                const uniqueServers = Array.from(new Set(uniqueAlliances.map(a => a.serverId))).sort();

                setAllServers(uniqueServers);
                setAllAlliances(uniqueAlliances);

                if (!serverId && uniqueServers.length > 0) {
                    setTargetServerId(uniqueServers[0]);
                }
            };
            fetchAlliances();
        }
    }, [auth.role]);

    useEffect(() => {
        if ((auth.role === 'master' || auth.role === 'super_admin') && targetServerId) {
            const serverAlliances = allAlliances.filter(a => a.serverId === targetServerId);
            if (serverAlliances.length > 0 && (!targetAllianceId || !serverAlliances.find(a => a.id === targetAllianceId))) {
                setTargetAllianceId(serverAlliances[0].id);
            }
        }
    }, [targetServerId, allAlliances]);

    const showCustomAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'confirm' = 'error', onConfirm?: () => void) => {
        setCustomAlert({ visible: true, title, message, type, onConfirm });
    };

    useEffect(() => {
        if (sheetData?.url) {
            setStrategyUrl(sheetData.url);
        }
    }, [sheetData]);

    const downloadTemplate = () => {
        try {
            const data = [
                { 'ID': '12345678', '닉네임': '영광의사령관' },
                { 'ID': '87654321', '닉네임': '세종대왕' },
                { 'ID': '11223344', '닉네임': '화이트아웃' }
            ];

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "연맹원명단양식");

            /* generate XLSX file and send to client */
            XLSX.writeFile(wb, "연맹원_등록_양식.xlsx");
        } catch (error) {
            console.error('Template download error:', error);
            Alert.alert('오류', '양식 다운로드 중 문제가 발생했습니다.');
        }
    };

    const processExcelFile = (file: File) => {
        setUploading(true);
        const reader = new FileReader();
        reader.onload = (e: any) => {
            try {
                const ab = e.target.result;
                const wb = XLSX.read(ab, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const json: any[] = XLSX.utils.sheet_to_json(ws);

                const formatted = json.map(row => {
                    const keys = Object.keys(row);
                    const idKey = keys.find(k => k.toLowerCase().includes('id') || k.includes('아이디'));
                    const nickKey = keys.find(k => k.toLowerCase().includes('nick') || k.includes('닉네임') || k.includes('이름'));
                    return {
                        id: String(row[idKey || keys[0]] || ''),
                        nickname: String(row[nickKey || keys[1]] || '')
                    };
                }).filter(item => item.id && item.nickname);

                setPreviewData(formatted);
            } catch (err) {
                console.error('Excel parse error:', err);
                showCustomAlert('오류', '파일을 읽는 중 문제가 발생했습니다.', 'error');
            } finally {
                setUploading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDrop = (e: any) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];
        if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
            showCustomAlert('파일 오류', '.xlsx, .xls, .csv 파일만 업로드할 수 있습니다.', 'warning');
            return;
        }
        processExcelFile(file);
    };

    const handleExcelUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                    'text/csv'
                ]
            });

            if (result.canceled) return;

            setUploading(true);
            const file = result.assets[0];

            if (Platform.OS === 'web') {
                // @ts-ignore
                const actualFile = file.file;
                const reader = new FileReader();
                reader.onload = (e: any) => {
                    const ab = e.target.result;
                    const wb = XLSX.read(ab, { type: 'array' });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const json: any[] = XLSX.utils.sheet_to_json(ws);

                    const formatted = json.map(row => {
                        const keys = Object.keys(row);
                        const idKey = keys.find(k => k.toLowerCase().includes('id') || k.includes('아이디'));
                        const nickKey = keys.find(k => k.toLowerCase().includes('nick') || k.includes('닉네임') || k.includes('이름'));

                        return {
                            id: String(row[idKey || keys[0]] || ''),
                            nickname: String(row[nickKey || keys[1]] || '')
                        };
                    }).filter(item => item.id && item.nickname);

                    setPreviewData(formatted);
                    setUploading(false);
                };
                reader.readAsArrayBuffer(actualFile);
            } else {
                Alert.alert('알림', '모바일에서의 엑셀 파싱은 현재 웹 버전에서 권장됩니다.');
                setUploading(false);
            }

        } catch (error) {
            console.error('Excel upload error:', error);
            Alert.alert('오류', '파일을 읽는 중 문제가 발생했습니다.');
            setUploading(false);
        }
    };

    const handleSaveMembers = async () => {
        if (previewData.length === 0) return;
        try {
            await saveMembers(previewData);
            setPreviewData([]);
            Alert.alert('성공', `${previewData.length}명의 연맹원 정보가 저장되었습니다.`);
        } catch (error) {
            Alert.alert('오류', '명단 저장 중 오류가 발생했습니다.');
        }
    };

    const handleManualAdd = async () => {
        if (!manualNick.trim()) {
            showCustomAlert('입력 오류', '닉네임을 입력해주세요.', 'warning');
            return;
        }
        try {
            const finalId = manualId.trim() || `auto_${Date.now()}`;
            await saveMembers([{
                id: finalId,
                nickname: manualNick.trim(),
                password: manualPw.trim() || '1234'
            }]);
            setManualNick('');
            setManualId('');
            setManualPw('');
            showCustomAlert('성공', '연맹원이 성공적으로 등록되었습니다.' + (manualPw.trim() ? ` (비밀번호: ${manualPw.trim()})` : ` (기본 비밀번호: 1234)`), 'success');
        } catch (error) {
            showCustomAlert('오류', '멤버 등록 중 오류가 발생했습니다.', 'error');
        }
    };

    const { dynamicAdmins, addAdmin, removeAdmin } = useFirestoreAdmins(serverId, allianceId);

    const handleSelectedReset = async () => {
        if (selectedIds.length === 0) {
            showCustomAlert('알림', '먼저 작업을 수행할 대상을 선택해주세요.', 'warning');
            return;
        }

        showCustomAlert('비밀번호 초기화', `선택한 ${selectedIds.length}명의 비밀번호를 '1234'로 초기화하시겠습니까?`, 'confirm', async () => {
            try {
                const batch = writeBatch(db);
                selectedIds.forEach(id => {
                    const memberDoc = members.find(m => m.id === id);
                    if (memberDoc) {
                        const ref = doc(db, "servers", serverId!, "alliances", allianceId!, "members", id);
                        batch.update(ref, { password: '1234', updatedAt: Date.now() });
                    }
                });

                await batch.commit();
                setSelectedIds([]);
                showCustomAlert('성공', `${selectedIds.length}명의 비밀번호가 초기화되었습니다.`, 'success');
            } catch (error: any) {
                showCustomAlert('오류', '초기화 중 오류 발생: ' + error.message, 'error');
            }
        });
    };

    const handleSelectedDelete = async () => {
        if (selectedIds.length === 0) {
            showCustomAlert('알림', '먼저 삭제할 대상을 선택해주세요.', 'warning');
            return;
        }

        showCustomAlert('명단 삭제', `선택한 ${selectedIds.length}명의 데이터를 정말로 삭제하시겠습니까?`, 'confirm', async () => {
            try {
                const batch = writeBatch(db);
                selectedIds.forEach(id => {
                    const ref = doc(db, "servers", serverId!, "alliances", allianceId!, "members", id);
                    batch.delete(ref);
                });

                await batch.commit();
                setSelectedIds([]);
                showCustomAlert('성공', `${selectedIds.length}명의 데이터가 삭제되었습니다.`, 'success');
            } catch (error: any) {
                showCustomAlert('오류', '삭제 중 오류 발생: ' + error.message, 'error');
            }
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredMembers.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredMembers.map(m => m.id));
        }
    };

    const toggleSelectMember = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleStaff = async (member: any) => {
        const isAdmin = dynamicAdmins.some(a => a.name === member.nickname);
        if (isAdmin) {
            await removeAdmin(member.nickname);
            showCustomAlert('해제 완료', `${member.nickname}님의 운영관리자 권한을 해제했습니다.`, 'success');
        } else {
            const hashed = await hashPassword('1234');
            await addAdmin(member.nickname, auth.adminName || 'Admin', 'admin', hashed);
            showCustomAlert('권한 부여', `${member.nickname}님을 운영관리자로 임명했습니다.\n(초기 비밀번호: 1234)`, 'success');
        }
    };

    const handleStrategyFileUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'image/*',
                    'application/pdf',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                    'text/csv'
                ],
            });

            if (result.canceled) return;

            setStrategyUploading(true);
            const file = result.assets[0];

            let blob: Blob;
            if (Platform.OS === 'web') {
                try {
                    const response = await fetch(file.uri);
                    blob = await response.blob();
                } catch (fetchError) {
                    // @ts-ignore
                    if (file.file) {
                        // @ts-ignore
                        blob = file.file;
                    } else {
                        throw new Error('파일 데이터를 가져올 수 없습니다.');
                    }
                }
            } else {
                const response = await fetch(file.uri);
                blob = await response.blob();
            }

            await uploadStrategyFile(blob, file.name);
            Alert.alert('성공', '전략 문서 파일이 등록되었습니다.');
        } catch (error: any) {
            console.error('Strategy upload error:', error);
            Alert.alert('오류', '파일 등록 중 문제가 발생했습니다.');
        } finally {
            setStrategyUploading(false);
        }
    };

    const handleSaveStrategyUrl = async () => {
        if (!strategyUrl.trim()) {
            const msg = '주소를 입력해주세요.';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('알림', msg);
            return;
        }

        setSaveLoading(true);
        try {
            await saveSheetUrl(strategyUrl.trim(), 'url');
            showCustomAlert('저장 성공', '전략 문서 주소가 성공적으로 저장되었습니다.', 'success');
        } catch (error: any) {
            showCustomAlert('저장 실패', '주소 저장 중 문제가 발생했습니다.', 'error');
        } finally {
            setSaveLoading(false);
        }
    };

    const filteredMembers = React.useMemo(() => {
        return members.filter(m => {
            const matchesSearch = m.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.id.toLowerCase().includes(searchTerm.toLowerCase());

            const isAdmin = dynamicAdmins.some(a => a.name === m.nickname);
            const matchesRole = roleFilter === 'all' ? true :
                roleFilter === 'staff' ? isAdmin : !isAdmin;

            return matchesSearch && matchesRole;
        });
    }, [members, searchTerm, roleFilter, dynamicAdmins]);

    return (
        <View className={`flex-1 ${isMobile ? 'p-4' : 'p-8'} ${isDark ? 'bg-[#020617]' : 'bg-slate-50'}`}>
            <View className="max-w-4xl mx-auto w-full flex-1">
                <View className={`flex-row items-center ${isMobile ? 'mb-5 mt-4' : 'mb-8 mt-6'}`}>
                    <TouchableOpacity onPress={onBack} className={`mr-4 ${isMobile ? 'p-2' : 'p-3'} rounded-2xl shadow-lg border transition-all active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <Ionicons name="arrow-back" size={isMobile ? 18 : 22} color={isDark ? "white" : "#1e293b"} />
                    </TouchableOpacity>
                    <Text className={`${isMobile ? 'text-xl' : 'text-3xl'} font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>관리자 대시보드</Text>
                </View>

                {/* Master Context Selector */}
                {(auth.role === 'master' || auth.role === 'super_admin') && (
                    <View className={`mb-6 p-4 rounded-3xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                        <View className="flex-row items-center mb-3">
                            <Ionicons name="globe-outline" size={18} color="#38bdf8" className="mr-2" />
                            <Text className={`font-black ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>관리 대상 선택 (Master Mode)</Text>
                        </View>
                        <View className="flex-row gap-3">
                            <View className="flex-1 space-y-2">
                                <Text className={`text-xs font-bold ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>서버 (Server)</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                                    {allServers.map(s => (
                                        <TouchableOpacity
                                            key={s}
                                            onPress={() => setTargetServerId(s)}
                                            className={`px-4 py-2 rounded-xl border ${targetServerId === s ? 'bg-sky-500 border-sky-500' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200')}`}
                                        >
                                            <Text className={`font-bold text-xs ${targetServerId === s ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-600')}`}>{s}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </View>
                        <View className="flex-row gap-3 mt-4">
                            <View className="flex-1 space-y-2">
                                <View className="flex-row items-center justify-between">
                                    <Text className={`text-xs font-bold ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                        {targetServerId ? `[${targetServerId}] 소속 연맹 (${allAlliances.filter(a => a.serverId === targetServerId).length})` : '연맹 (Alliance)'}
                                    </Text>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                                    {allAlliances.filter(a => a.serverId === targetServerId).length > 0 ? (
                                        allAlliances.filter(a => a.serverId === targetServerId).map(a => (
                                            <TouchableOpacity
                                                key={a.id}
                                                onPress={() => setTargetAllianceId(a.id)}
                                                className={`px-4 py-2 rounded-xl border flex-row items-center gap-2 ${targetAllianceId === a.id ? 'bg-indigo-500 border-indigo-500' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200')}`}
                                            >
                                                <Ionicons name="shield-half" size={12} color={targetAllianceId === a.id ? 'white' : (isDark ? '#cbd5e1' : '#64748b')} />
                                                <Text className={`font-bold text-xs ${targetAllianceId === a.id ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-600')}`}>{a.id}</Text>
                                            </TouchableOpacity>
                                        ))
                                    ) : (
                                        <Text className={`text-xs p-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
                                            해당 서버에 등록된 연맹이 없습니다.
                                        </Text>
                                    )}
                                </ScrollView>
                            </View>
                        </View>
                    </View>
                )}

                {/* Modern Tab Bar */}
                <View className={`flex-row p-1 rounded-[24px] ${isMobile ? 'mb-6' : 'mb-10'} border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('members')}
                        className={`flex-1 flex-row items-center justify-center ${isMobile ? 'py-3' : 'py-4'} rounded-[20px] transition-all duration-300 ${activeTab === 'members' ? (isDark ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20' : 'bg-white shadow-md') : ''}`}
                    >
                        <Ionicons name="people" size={isMobile ? 16 : 20} color={activeTab === 'members' ? (isDark ? 'white' : '#4f46e5') : (isDark ? '#475569' : '#94a3b8')} style={{ marginRight: 8 }} />
                        <Text className={`font-black ${isMobile ? 'text-xs' : 'text-sm'} ${activeTab === 'members' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>영주 관리</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('strategy')}
                        className={`flex-1 flex-row items-center justify-center ${isMobile ? 'py-3' : 'py-4'} rounded-[20px] transition-all duration-300 ${activeTab === 'strategy' ? (isDark ? 'bg-amber-500 shadow-lg shadow-amber-500/20' : 'bg-white shadow-md') : ''}`}
                    >
                        <Ionicons name="document-text" size={isMobile ? 16 : 20} color={activeTab === 'strategy' ? (isDark ? 'white' : '#d97706') : (isDark ? '#475569' : '#94a3b8')} style={{ marginRight: 8 }} />
                        <Text className={`font-black ${isMobile ? 'text-xs' : 'text-sm'} ${activeTab === 'strategy' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>전략 문서</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                    {activeTab === 'strategy' && (
                        <View className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Strategy Document Section */}
                            <View className={`${isMobile ? 'p-4' : 'p-6'} rounded-3xl border shadow-xl mb-6 ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                                <View className={`flex-row items-center mb-6 border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <View className={`w-8 h-8 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
                                        <Ionicons name="map-outline" size={isMobile ? 18 : 22} color={isDark ? "#f59e0b" : "#d97706"} />
                                    </View>
                                    <Text className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>전략 문서 관리</Text>
                                </View>

                                <View className={`p-4 rounded-xl border mb-6 ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50/50 border-amber-100'}`}>
                                    <View className="flex-row items-center mb-2">
                                        <Ionicons name="information-circle" size={18} color={isDark ? "#f59e0b" : "#d97706"} className="mr-2" />
                                        <Text className={`font-bold ${isMobile ? 'text-[10px]' : 'text-xs'} ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>안내</Text>
                                    </View>
                                    <Text className={`${isMobile ? 'text-[9px]' : 'text-[11px]'} leading-5 font-medium ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                                        외부 파일 링크(구글 시트 등)를 권장합니다.
                                    </Text>
                                </View>

                                <View className={`p-4 rounded-2xl border shadow-inner ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                    <Text className={`font-bold ${isMobile ? 'text-[9px]' : 'text-[10px]'} mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>URL 주소</Text>
                                    <View className="space-y-4">
                                        <TextInput
                                            className={`${isMobile ? 'p-3.5 h-12' : 'p-4 h-14'} rounded-xl border font-semibold ${isMobile ? 'text-xs' : 'text-sm'} ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                                            placeholder="https://docs.google.com/..."
                                            placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                                            value={strategyUrl}
                                            onChangeText={setStrategyUrl}
                                        />
                                        <TouchableOpacity
                                            onPress={handleSaveStrategyUrl}
                                            disabled={saveLoading}
                                            className={`${isMobile ? 'h-12' : 'h-14'} rounded-xl items-center justify-center shadow-lg shadow-amber-500/20 ${saveLoading ? 'bg-slate-700' : 'bg-amber-500 active:bg-amber-600'}`}
                                        >
                                            {saveLoading ? <ActivityIndicator color="white" /> : (
                                                <View className="flex-row items-center">
                                                    <Ionicons name="save-outline" size={isMobile ? 16 : 18} color="#0f172a" style={{ marginRight: 6 }} />
                                                    <Text className={`text-[#0f172a] font-bold ${isMobile ? 'text-sm' : 'text-base'}`}>저장하기</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>

                                        {sheetData?.url && Platform.OS === 'web' && (
                                            <View className="mt-4">
                                                <View className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`} style={{ height: isMobile ? 160 : 240 }}>
                                                    <iframe src={sheetData.url} style={{ width: '100%', height: '100%', border: 'none' }} title="Preview" />
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}

                    {activeTab === 'members' && (
                        <View className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Member Management Section */}
                            <View className={`${isMobile ? 'p-3' : 'p-6'} rounded-3xl border shadow-xl ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                                <View className={`flex-row items-center justify-between mb-4 border-b pb-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <View className="flex-row items-center">
                                        <View className={`w-7 h-7 rounded-lg items-center justify-center mr-2 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                                            <Ionicons name="people" size={16} color={isDark ? "#818cf8" : "#4f46e5"} />
                                        </View>
                                        <Text className={`${isMobile ? 'text-base' : 'text-xl'} font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>영주관리</Text>
                                    </View>
                                    <Text className={`font-bold ${isMobile ? 'text-[10px]' : 'text-sm'} ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{members.length}명</Text>
                                </View>

                                <View className={`mb-4 ${isMobile ? 'p-3' : 'p-5'} rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                    <View className="flex-row items-center mb-3">
                                        <Ionicons name="documents" size={14} color={isDark ? "#818cf8" : "#4f46e5"} className="mr-2" />
                                        <Text className={`font-bold ${isMobile ? 'text-xs' : 'text-sm'} ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>일괄 등록</Text>
                                    </View>

                                    <View
                                        // @ts-ignore
                                        onDragOver={(e: any) => { e.preventDefault(); setIsDragOver(true); }}
                                        onDragLeave={() => setIsDragOver(false)}
                                        onDrop={handleDrop}
                                        className={`items-center justify-center ${isMobile ? 'py-5' : 'py-8'} px-3 rounded-xl border-2 border-dashed mb-3 ${isDragOver ? (isDark ? 'bg-indigo-500/15 border-indigo-400' : 'bg-indigo-50 border-indigo-400') : (isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200')}`}
                                    >
                                        <Ionicons name={isDragOver ? "cloud-upload" : "document-text-outline"} size={20} color={isDark ? "#64748b" : "#94a3b8"} className="mb-1" />
                                        <Text className={`${isMobile ? 'text-[8px]' : 'text-[10px]'} text-center font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Excel 파일을 선택하세요</Text>
                                    </View>

                                    <View className="flex-row gap-2">
                                        <TouchableOpacity onPress={handleExcelUpload} disabled={uploading} className={`flex-1 py-2.5 rounded-lg border items-center flex-row justify-center ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                                            <Text className={`font-bold ${isMobile ? 'text-[10px]' : 'text-xs'} ${isDark ? 'text-white' : 'text-slate-600'}`}>파일 선택</Text>
                                        </TouchableOpacity>
                                        {previewData.length > 0 ? (
                                            <TouchableOpacity onPress={handleSaveMembers} className="flex-1 bg-indigo-600 py-2.5 rounded-lg items-center flex-row justify-center">
                                                <Text className={`text-white font-bold ${isMobile ? 'text-[10px]' : 'text-xs'}`}>저장 ({previewData.length})</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity onPress={downloadTemplate} className={`flex-1 py-2.5 rounded-lg border items-center flex-row justify-center ${isDark ? 'bg-slate-800 border-indigo-500/30' : 'bg-white border-indigo-100'}`}>
                                                <Text className={`font-bold ${isMobile ? 'text-[10px]' : 'text-xs'} ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>양식 받기</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                <View className={`mb-4 ${isMobile ? 'p-3' : 'p-5'} rounded-2xl border ${isDark ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                                    <View className="flex-row items-center mb-3">
                                        <Ionicons name="person-add" size={14} color={isDark ? "#818cf8" : "#4f46e5"} className="mr-2" />
                                        <Text className={`font-bold ${isMobile ? 'text-xs' : 'text-sm'} ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>개별 등록</Text>
                                    </View>
                                    <View className="space-y-4">
                                        <View className="flex-row gap-2 w-full">
                                            <TextInput
                                                style={{ flex: isMobile ? 1 : 1.5, minWidth: 0 }}
                                                className={`${isMobile ? 'h-11' : 'h-12'} px-3 rounded-xl border ${isMobile ? 'text-[11px]' : 'text-xs'} font-bold ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                                                placeholder="닉네임 *"
                                                value={manualNick}
                                                onChangeText={setManualNick}
                                            />
                                            <TextInput
                                                style={{ flex: 1, minWidth: 0 }}
                                                className={`${isMobile ? 'h-11' : 'h-12'} px-3 rounded-xl border ${isMobile ? 'text-[11px]' : 'text-xs'} font-bold ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                                                placeholder="ID"
                                                value={manualId}
                                                onChangeText={setManualId}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                        <View className="flex-row gap-2">
                                            <TextInput
                                                className={`flex-1 ${isMobile ? 'h-11' : 'h-12'} px-3 rounded-xl border ${isMobile ? 'text-[11px]' : 'text-xs'} font-bold ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                                                placeholder="비밀번호"
                                                value={manualPw}
                                                onChangeText={setManualPw}
                                                secureTextEntry
                                            />
                                            <TouchableOpacity onPress={handleManualAdd} className={`bg-indigo-600 ${isMobile ? 'w-16 h-11' : 'px-8 h-12'} rounded-xl items-center justify-center`}>
                                                <Text className={`text-white font-black ${isMobile ? 'text-[10px]' : 'text-sm'}`}>등록</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>

                                {/* Filter & Search (Redesigned) */}
                                <View className="mb-4">
                                    <View className={`flex-row items-center justify-between gap-3 ${isMobile ? 'flex-col items-stretch' : ''}`}>
                                        {/* Search Input */}
                                        <View className={`flex-1 flex-row items-center rounded-xl ${isMobile ? 'px-3 py-2.5 h-10' : 'px-4 py-2 h-10'} border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                            <Ionicons name="search" size={isMobile ? 14 : 16} color={isDark ? "#94a3b8" : "#64748b"} className="mr-2" />
                                            <TextInput
                                                placeholder={t('dashboard.search', '검색...')}
                                                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                                value={searchTerm}
                                                onChangeText={setSearchTerm}
                                                className={`flex-1 font-bold ${isMobile ? 'text-[11px]' : 'text-xs'} ${isDark ? 'text-white' : 'text-slate-800'}`}
                                            />
                                            {searchTerm.length > 0 && (
                                                <TouchableOpacity onPress={() => setSearchTerm('')}>
                                                    <Ionicons name="close-circle" size={16} color={isDark ? "#64748b" : "#94a3b8"} />
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        {/* Filter Tabs */}
                                        <View className={`flex-row p-1 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                            {(['all', 'staff', 'general'] as const).map((filter) => (
                                                <TouchableOpacity
                                                    key={filter}
                                                    onPress={() => setRoleFilter(filter)}
                                                    className={`px-3 py-1.5 rounded-lg items-center justify-center ${roleFilter === filter ? (isDark ? 'bg-indigo-500' : 'bg-indigo-500 shadow-sm') : ''}`}
                                                >
                                                    <Text className={`${isMobile ? 'text-[10px]' : 'text-xs'} font-black ${roleFilter === filter ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                                                        {filter === 'all' ? '전체' : filter === 'staff' ? '운영' : '일반'}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </View>

                                <View className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                                    {/* List Header */}
                                    <View className={`flex-row items-center ${isMobile ? 'px-3 py-2.5' : 'px-4 py-3'} border-b ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                        <TouchableOpacity onPress={toggleSelectAll} className={`w-4.5 h-4.5 rounded-md items-center justify-center border-2 mr-2 ${selectedIds.length === filteredMembers.length && filteredMembers.length > 0 ? 'bg-indigo-500 border-indigo-500' : (isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-300')}`}>
                                            {selectedIds.length === filteredMembers.length && filteredMembers.length > 0 && <Ionicons name="checkmark" size={10} color="white" />}
                                        </TouchableOpacity>
                                        <Text className={`flex-1 ${isMobile ? 'text-[9px]' : 'text-[10px]'} font-black ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>영주 목록</Text>
                                        <Text className={`${isMobile ? 'text-[9px]' : 'text-[10px]'} font-black mr-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>관리</Text>
                                    </View>

                                    {membersLoading ? (
                                        <View className="py-10 items-center"><ActivityIndicator color="#818cf8" /></View>
                                    ) : (
                                        <ScrollView className={`${isMobile ? 'max-h-[350px]' : 'max-h-[500px]'}`} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                                            {filteredMembers.map((m) => {
                                                const isRowStaff = dynamicAdmins.some(a => a.name === m.nickname);
                                                const isSelected = selectedIds.includes(m.id);
                                                return (
                                                    <TouchableOpacity key={m.id} onPress={() => toggleSelectMember(m.id)} className={`flex-row items-center ${isMobile ? 'px-3 py-3' : 'px-4 py-4'} border-b ${isSelected ? (isDark ? 'bg-indigo-500/10' : 'bg-indigo-50/50') : ''} ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                                                        <View className="flex-row items-center flex-1">
                                                            <View className={`w-4 h-4 rounded items-center justify-center border mr-2 ${isSelected ? 'bg-indigo-500 border-indigo-500' : (isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}`}>
                                                                {isSelected && <Ionicons name="checkmark" size={10} color="white" />}
                                                            </View>
                                                            <View className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg items-center justify-center mr-2.5 ${isRowStaff ? (isDark ? 'bg-indigo-500/20' : 'bg-indigo-50') : (isDark ? 'bg-slate-800' : 'bg-slate-100')}`}>
                                                                <Text className={`${isMobile ? 'text-[11px]' : 'text-sm'} font-black ${isRowStaff ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>{m.nickname.charAt(0)}</Text>
                                                            </View>
                                                            <View className="flex-1 mr-2">
                                                                <View className="flex-row items-center flex-wrap">
                                                                    <Text numberOfLines={1} className={`font-black ${isMobile ? 'text-xs' : 'text-sm'} ${isDark ? 'text-white' : 'text-slate-800'}`}>{m.nickname}</Text>
                                                                    {isRowStaff && <View className="ml-1 px-1 py-0.5 rounded-full bg-indigo-500/10"><Text className="text-[7px] font-black text-indigo-500">운영</Text></View>}
                                                                </View>
                                                                <Text numberOfLines={1} className={`text-[9px] mt-0.5 font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>UID: {m.id}</Text>
                                                            </View>
                                                        </View>
                                                        <View className="flex-row gap-1.5">
                                                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleStaff(m); }} className={`${isMobile ? 'w-8 h-8' : 'w-9 h-9'} rounded-lg items-center justify-center border ${isRowStaff ? 'bg-indigo-600 border-indigo-500' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')}`}>
                                                                <Ionicons name={isRowStaff ? "shield-checkmark" : "shield-outline"} size={isMobile ? 14 : 16} color={isRowStaff ? "white" : (isDark ? "#64748b" : "#94a3b8")} />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); showCustomAlert('삭제', `${m.nickname}님을 삭제?`, 'confirm', () => deleteMember(m.id)); }} className={`${isMobile ? 'w-8 h-8' : 'w-9 h-9'} rounded-lg items-center justify-center border ${isDark ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-100'}`}>
                                                                <Ionicons name="trash-outline" size={isMobile ? 14 : 16} color="#f43f5e" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    )}
                                </View>
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Sticky Bottom Action Bar for Bulk Selection */}
                {
                    selectedIds.length > 0 && (
                        <View className={`absolute ${isMobile ? 'bottom-4' : 'bottom-8'} left-4 right-4 animate-in slide-in-from-bottom-5 flex-row gap-2 ${isMobile ? 'p-2' : 'p-3'} rounded-2xl bg-slate-900 shadow-2xl items-center z-50`}>
                            <View className="flex-1 px-2.5">
                                <Text className="text-white font-black text-xs">{selectedIds.length}명</Text>
                                <TouchableOpacity onPress={() => setSelectedIds([])}><Text className="text-indigo-400 font-bold text-[9px]">취소</Text></TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={handleSelectedReset} className="bg-slate-800 px-4 py-2.5 rounded-xl flex-row items-center border border-slate-700 active:scale-95">
                                <Ionicons name="key" size={14} color="#fbbf24" style={{ marginRight: 4 }} />
                                <Text className="text-white font-black text-[10px]">초기화</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSelectedDelete} className="bg-rose-600 px-4 py-2.5 rounded-xl flex-row items-center shadow-lg active:scale-95">
                                <Ionicons name="trash" size={14} color="white" style={{ marginRight: 4 }} />
                                <Text className="text-white font-black text-[10px]">삭제</Text>
                            </TouchableOpacity>
                        </View>
                    )
                }
            </View >

            {/* Modals & Alerts */}
            < Modal visible={customAlert.visible} transparent animationType="fade" >
                <View className="flex-1 bg-black/60 items-center justify-center p-6 text-center">
                    <View className={`w-full max-w-sm p-8 rounded-[40px] border shadow-2xl items-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        <View className={`w-16 h-16 rounded-full items-center justify-center mb-5 ${customAlert.type === 'success' ? (isDark ? 'bg-emerald-500/20' : 'bg-emerald-50') :
                            customAlert.type === 'error' ? (isDark ? 'bg-rose-500/20' : 'bg-rose-50') :
                                customAlert.type === 'warning' ? (isDark ? 'bg-amber-500/20' : 'bg-amber-50') :
                                    (isDark ? 'bg-red-500/20' : 'bg-red-50')
                            }`}>
                            <Ionicons
                                name={
                                    customAlert.type === 'success' ? 'checkmark-circle' :
                                        customAlert.type === 'error' ? 'close-circle' :
                                            customAlert.type === 'warning' ? 'warning' :
                                                'alert-circle'
                                }
                                size={36}
                                color={
                                    customAlert.type === 'success' ? '#10b981' :
                                        customAlert.type === 'error' ? '#f43f5e' :
                                            customAlert.type === 'warning' ? '#f59e0b' :
                                                '#ef4444'
                                }
                            />
                        </View>
                        <Text className={`text-2xl font-black mb-3 text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>{customAlert.title}</Text>
                        <Text className={`text-center mb-8 text-sm font-medium leading-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{customAlert.message}</Text>
                        <View className="flex-row gap-3 w-full">
                            {customAlert.type === 'confirm' && (
                                <TouchableOpacity onPress={() => setCustomAlert({ ...customAlert, visible: false })} className={`flex-1 py-4 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                                    <Text className={`text-center font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>취소</Text>
                                </TouchableOpacity>
                            )}
                            <TouchableOpacity
                                onPress={() => { setCustomAlert({ ...customAlert, visible: false }); customAlert.onConfirm?.(); }}
                                className={`flex-1 py-4 rounded-2xl ${customAlert.type === 'confirm' ? 'bg-red-500' :
                                    customAlert.type === 'success' ? 'bg-emerald-500' :
                                        customAlert.type === 'warning' ? 'bg-amber-500' :
                                            'bg-blue-600'
                                    }`}
                            >
                                <Text className={`text-center font-bold ${customAlert.type === 'warning' ? 'text-black' : 'text-white'}`}>
                                    {customAlert.type === 'confirm' ? '삭제' : '확인'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal >
        </View >
    );
}
