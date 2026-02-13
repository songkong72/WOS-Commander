import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, Platform, ActivityIndicator, Modal } from 'react-native';
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
import { collection, getDocs, query, writeBatch, doc } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';

interface AdminManagementProps {
    serverId: string | null;
    allianceId: string | null;
    onBack: () => void;
}

export default function AdminManagement({ serverId, allianceId, onBack }: AdminManagementProps) {
    const { auth } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';

    const { members, loading: membersLoading, saveMembers, clearAllMembers, deleteMember, updateMemberPassword } = useFirestoreMembers(serverId, allianceId);
    const { sheetData, saveSheetUrl, uploadStrategyFile } = useFirestoreStrategySheet(serverId, allianceId);

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
        <View className={`flex-1 p-6 ${isDark ? 'bg-[#020617]' : 'bg-slate-50'}`}>
            <View className="max-w-4xl mx-auto w-full flex-1">
                <View className="flex-row items-center mb-6 mt-8">
                    <TouchableOpacity onPress={onBack} className={`mr-4 p-2.5 rounded-2xl shadow-lg border transition-all active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <Ionicons name="arrow-back" size={20} color={isDark ? "white" : "#1e293b"} />
                    </TouchableOpacity>
                    <Text className={`text-2xl font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>관리자 대시보드</Text>
                </View>

                {/* Modern Tab Bar */}
                <View className={`flex-row p-1.5 rounded-[24px] mb-8 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('members')}
                        className={`flex-1 flex-row items-center justify-center py-4 rounded-[18px] transition-all duration-300 ${activeTab === 'members' ? (isDark ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20' : 'bg-white shadow-md') : ''}`}
                    >
                        <Ionicons name="people" size={20} color={activeTab === 'members' ? (isDark ? 'white' : '#4f46e5') : (isDark ? '#475569' : '#94a3b8')} style={{ marginRight: 10 }} />
                        <Text className={`font-black text-sm ${activeTab === 'members' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>영주 관리</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('strategy')}
                        className={`flex-1 flex-row items-center justify-center py-4 rounded-[18px] transition-all duration-300 ${activeTab === 'strategy' ? (isDark ? 'bg-amber-500 shadow-lg shadow-amber-500/20' : 'bg-white shadow-md') : ''}`}
                    >
                        <Ionicons name="document-text" size={20} color={activeTab === 'strategy' ? (isDark ? 'white' : '#d97706') : (isDark ? '#475569' : '#94a3b8')} style={{ marginRight: 10 }} />
                        <Text className={`font-black text-sm ${activeTab === 'strategy' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>전략 문서 관리</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                    {activeTab === 'strategy' && (
                        <View className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Strategy Document Section */}
                            <View className={`p-5 rounded-2xl border shadow-2xl mb-6 ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                                <View className={`flex-row items-center mb-4 border-b pb-3 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <View className={`w-8 h-8 rounded-lg items-center justify-center mr-3 ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
                                        <Ionicons name="map-outline" size={20} color={isDark ? "#f59e0b" : "#d97706"} />
                                    </View>
                                    <Text className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>전략 문서 관리</Text>
                                </View>

                                <View className={`p-4 rounded-xl border mb-6 ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50/50 border-amber-100'}`}>
                                    <View className="flex-row items-center mb-3">
                                        <Ionicons name="information-circle" size={20} color={isDark ? "#f59e0b" : "#d97706"} className="mr-2" />
                                        <Text className={`font-bold text-sm ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>중요: 외부 링크 사용 안내</Text>
                                    </View>
                                    <Text className={`text-xs leading-5 font-medium ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                                        서버 저장 공간 제한으로 인해 직접 업로드 대신 {"\n"}
                                        <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-semibold`}>외부 파일 링크</Text>를 활용하는 것을 권장합니다.
                                    </Text>
                                </View>

                                <View className={`p-4 rounded-2xl border shadow-inner ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                    <Text className={`font-bold text-sm mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>문서 / 시트 / 이미지 주소(URL)</Text>
                                    <View className="space-y-4">
                                        <TextInput
                                            className={`p-5 rounded-2xl border font-semibold text-sm ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                                            placeholder="https://docs.google.com/..."
                                            placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                                            value={strategyUrl}
                                            onChangeText={setStrategyUrl}
                                        />
                                        <TouchableOpacity
                                            onPress={handleSaveStrategyUrl}
                                            disabled={saveLoading}
                                            className={`py-5 rounded-2xl items-center justify-center shadow-xl shadow-amber-500/20 ${saveLoading ? 'bg-slate-700' : 'bg-amber-500 active:bg-amber-600'}`}
                                        >
                                            {saveLoading ? <ActivityIndicator color="white" /> : (
                                                <View className="flex-row items-center">
                                                    <Ionicons name="save-outline" size={20} color="#0f172a" style={{ marginRight: 8 }} />
                                                    <Text className="text-[#0f172a] font-bold text-lg">전략 문서 주소 저장</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>

                                        {/* URL Preview Section */}
                                        {sheetData?.url && Platform.OS === 'web' && (
                                            <View className="mt-6">
                                                <View className="flex-row items-center mb-3">
                                                    <Ionicons name="eye-outline" size={16} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginRight: 6 }} />
                                                    <Text className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>미리보기</Text>
                                                </View>
                                                <View className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`} style={{ height: 200 }}>
                                                    <iframe
                                                        src={sheetData.url}
                                                        style={{ width: '100%', height: '100%', border: 'none' }}
                                                        title="Strategy Document Preview"
                                                    />
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
                            <View className={`p-8 rounded-[32px] border shadow-2xl ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                                <View className={`flex-row items-center justify-between mb-6 border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <View className="flex-row items-center">
                                        <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                                            <Ionicons name="people" size={24} color={isDark ? "#818cf8" : "#4f46e5"} />
                                        </View>
                                        <Text className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>영주관리</Text>
                                    </View>
                                    <Text className={`font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{members.length}명</Text>
                                </View>

                                <View className={`mb-6 p-6 rounded-[24px] border ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                    <View className="flex-row items-center mb-5">
                                        <View className={`p-1.5 rounded-lg mr-2 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
                                            <Ionicons name="documents" size={16} color={isDark ? "#818cf8" : "#4f46e5"} />
                                        </View>
                                        <Text className={`font-bold text-base ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>일괄 영주 등록</Text>
                                    </View>

                                    {/* Drag & Drop Zone */}
                                    <View
                                        // @ts-ignore - Web-specific events
                                        onDragOver={(e: any) => { e.preventDefault(); setIsDragOver(true); }}
                                        onDragLeave={() => setIsDragOver(false)}
                                        onDrop={handleDrop}
                                        className={`items-center justify-center py-8 px-6 rounded-2xl border-2 border-dashed mb-4 transition-all duration-300 ${isDragOver ? (isDark ? 'bg-indigo-500/15 border-indigo-400' : 'bg-indigo-50 border-indigo-400') : (isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200')}`}
                                    >
                                        <View className={`w-14 h-14 rounded-2xl items-center justify-center mb-3 ${isDragOver ? (isDark ? 'bg-indigo-500/30' : 'bg-indigo-100') : (isDark ? 'bg-slate-800' : 'bg-slate-100')}`}>
                                            <Ionicons name={isDragOver ? "cloud-upload" : "document-text-outline"} size={28} color={isDragOver ? (isDark ? "#818cf8" : "#4f46e5") : (isDark ? "#64748b" : "#94a3b8")} />
                                        </View>
                                        {uploading ? (
                                            <View className="items-center">
                                                <ActivityIndicator size="small" color={isDark ? "#818cf8" : "#4f46e5"} />
                                                <Text className={`text-xs font-bold mt-2 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>파일 처리 중...</Text>
                                            </View>
                                        ) : isDragOver ? (
                                            <Text className={`text-sm font-black ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>여기에 놓으세요!</Text>
                                        ) : (
                                            <View className="items-center">
                                                <Text className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>Excel 파일을 이곳에 드래그하세요</Text>
                                                <Text className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>.xlsx, .xls, .csv 지원</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Action Buttons */}
                                    <View className="flex-row gap-3 w-full">
                                        <TouchableOpacity onPress={handleExcelUpload} disabled={uploading} className={`flex-1 py-3.5 rounded-xl border items-center flex-row justify-center ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                                            <Ionicons name="folder-open-outline" size={16} color={isDark ? "white" : "#475569"} style={{ marginRight: 6 }} />
                                            <Text className={`font-bold text-xs ${isDark ? 'text-white' : 'text-slate-600'}`}>파일 선택</Text>
                                        </TouchableOpacity>
                                        {previewData.length > 0 ? (
                                            <TouchableOpacity onPress={handleSaveMembers} className="flex-1 bg-indigo-600 py-3.5 rounded-xl items-center flex-row justify-center">
                                                <Ionicons name="save-outline" size={16} color="white" style={{ marginRight: 6 }} />
                                                <Text className="text-white font-bold text-xs">명단 저장 ({previewData.length}건)</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity onPress={downloadTemplate} className={`flex-1 py-3.5 rounded-xl border items-center flex-row justify-center ${isDark ? 'bg-slate-800 border-indigo-500/30' : 'bg-white border-indigo-100'}`}>
                                                <Ionicons name="download-outline" size={16} color={isDark ? "#818cf8" : "#4f46e5"} style={{ marginRight: 6 }} />
                                                <Text className={`font-bold text-xs ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>양식 다운로드</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                <View className={`mb-8 p-6 rounded-[24px] border ${isDark ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                                    <View className="flex-row items-center mb-5">
                                        <View className={`p-1.5 rounded-lg mr-2 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-100'}`}>
                                            <Ionicons name="person-add" size={16} color={isDark ? "#818cf8" : "#4f46e5"} />
                                        </View>
                                        <Text className={`font-bold text-base ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`}>개별 영주 등록</Text>
                                    </View>
                                    <View className="flex-row gap-2 items-stretch h-14">
                                        <View className="flex-1">
                                            <TextInput
                                                className={`w-full h-full px-4 rounded-xl border text-sm font-bold ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                                                placeholder="닉네임 *"
                                                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                                value={manualNick}
                                                onChangeText={setManualNick}
                                                // @ts-ignore - Web-specific property
                                                style={{ fontStyle: manualNick ? 'normal' : 'italic' }}
                                            />
                                        </View>
                                        <View className="flex-[1.2]">
                                            <TextInput
                                                className={`w-full h-full px-4 rounded-xl border text-sm font-bold ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                                                placeholder="ID (선택)"
                                                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                                value={manualId}
                                                onChangeText={setManualId}
                                                keyboardType="numeric"
                                                // @ts-ignore - Web-specific property
                                                style={{ fontStyle: manualId ? 'normal' : 'italic' }}
                                            />
                                        </View>
                                        <View className="flex-[1]">
                                            <TextInput
                                                className={`w-full h-full px-4 rounded-xl border text-sm font-bold ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                                                placeholder="비번(옵션)"
                                                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                                value={manualPw}
                                                onChangeText={setManualPw}
                                                // @ts-ignore - Web-specific property
                                                style={{ fontStyle: manualPw ? 'normal' : 'italic' }}
                                            />
                                        </View>
                                        <TouchableOpacity onPress={handleManualAdd} className="bg-indigo-600 px-6 rounded-xl items-center justify-center"><Text className="text-white font-black text-sm">등록</Text></TouchableOpacity>
                                    </View>
                                </View>

                                {/* Filter & Search */}
                                <View className="mb-6">
                                    <View className="flex-row gap-2 mb-4">
                                        {(['all', 'staff', 'general'] as const).map((filter) => (
                                            <TouchableOpacity key={filter} onPress={() => setRoleFilter(filter)} className={`flex-1 py-3 rounded-xl border items-center justify-center ${roleFilter === filter ? 'bg-indigo-600 border-indigo-500' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100 shadow-sm')}`}>
                                                <Text className={`text-[10px] font-black ${roleFilter === filter ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                                                    {filter === 'all' ? '전체' : filter === 'staff' ? '운영관리자' : '일반영주'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <View className="flex-row gap-2 items-center">
                                        <View className={`flex-1 flex-row items-center rounded-[20px] px-5 py-4 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                                            <Ionicons name="search" size={18} color={isDark ? "#818cf8" : "#4f46e5"} style={{ marginRight: 12 }} />
                                            <TextInput
                                                placeholder="영주 검색..."
                                                placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                                                value={searchTerm}
                                                onChangeText={setSearchTerm}
                                                className={`flex-1 font-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}
                                            />
                                        </View>

                                        <View className="flex-row gap-2">
                                            <TouchableOpacity
                                                onPress={handleSelectedReset}
                                                className={`px-4 h-14 rounded-[20px] border flex-row items-center justify-center ${isDark ? 'bg-red-500/10 border-red-500/30' : 'bg-red-50 border-red-200 shadow-sm'}`}
                                            >
                                                <Ionicons name="key" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                                                <View className="items-center">
                                                    <Text className="text-red-500 font-black text-[10px] leading-tight">비번초기화</Text>
                                                    <Text className="text-red-500 font-bold text-[9px] opacity-70">(1234)</Text>
                                                </View>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                onPress={handleSelectedDelete}
                                                className={`px-4 h-14 rounded-[20px] border flex-row items-center justify-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200 shadow-sm'}`}
                                            >
                                                <Ionicons name="trash" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                                                <Text className={`${isDark ? 'text-slate-300' : 'text-slate-700'} font-black text-xs`}>명단삭제</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>

                                <View className={`rounded-[24px] border overflow-hidden ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-100 shadow-lg'}`}>
                                    {/* List Header */}
                                    <View className={`flex-row items-center px-5 py-3 border-b ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-100/50 border-slate-200'}`}>
                                        <TouchableOpacity onPress={toggleSelectAll} className={`w-6 h-6 rounded-md items-center justify-center border-2 mr-4 ${selectedIds.length === filteredMembers.length && filteredMembers.length > 0 ? 'bg-indigo-500 border-indigo-500' : (isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300')}`}>
                                            {selectedIds.length === filteredMembers.length && filteredMembers.length > 0 && <Ionicons name="checkmark" size={14} color="white" />}
                                        </TouchableOpacity>
                                        <Text className={`flex-1 text-[11px] font-black ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>영주 목록 (전체선택)</Text>
                                        <Text className={`text-[11px] font-black ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>권한/삭제</Text>
                                    </View>

                                    {membersLoading ? <ActivityIndicator color="#818cf8" style={{ margin: 20 }} /> : (
                                        <ScrollView className="max-h-96" nestedScrollEnabled>
                                            {filteredMembers.map((m, idx) => {
                                                const isRowStaff = dynamicAdmins.some(a => a.name === m.nickname);
                                                const isHovered = hoveredRow === m.id;
                                                return (
                                                    <TouchableOpacity
                                                        key={m.id}
                                                        activeOpacity={0.9}
                                                        onPress={() => toggleSelectMember(m.id)}
                                                        // @ts-ignore
                                                        onMouseEnter={() => setHoveredRow(m.id)}
                                                        onMouseLeave={() => setHoveredRow(null)}
                                                        className={`flex-row items-center justify-between p-4 transition-all duration-200 ${isHovered ? (isDark ? 'bg-slate-700/40' : 'bg-indigo-50/50') : (idx % 2 === 0 ? (isDark ? 'bg-slate-800/20' : 'bg-slate-50/30') : '')} border-b ${isDark ? 'border-slate-800' : 'border-slate-100'}`}
                                                    >
                                                        <View className="flex-row items-center flex-1">
                                                            {/* Checkbox */}
                                                            <View
                                                                className={`w-5 h-5 rounded-md items-center justify-center border-2 mr-3 ${selectedIds.includes(m.id) ? 'bg-indigo-500 border-indigo-500' : (isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300')}`}
                                                            >
                                                                {selectedIds.includes(m.id) && <Ionicons name="checkmark" size={12} color="white" />}
                                                            </View>

                                                            {/* Avatar Circle */}
                                                            <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isRowStaff ? (isDark ? 'bg-sky-500/20 border-2 border-sky-500/40' : 'bg-sky-100 border-2 border-sky-200') : (isDark ? 'bg-slate-700 border-2 border-slate-600' : 'bg-slate-200 border-2 border-slate-300')}`}>
                                                                <Text className={`text-sm font-black ${isRowStaff ? (isDark ? 'text-sky-400' : 'text-sky-600') : (isDark ? 'text-slate-300' : 'text-slate-600')}`}>
                                                                    {m.nickname.charAt(0).toUpperCase()}
                                                                </Text>
                                                            </View>

                                                            {/* Info */}
                                                            <View className="flex-1">
                                                                <View className="flex-row items-center">
                                                                    <Text className={`font-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>{m.nickname}</Text>
                                                                    {isRowStaff && (
                                                                        <View className="ml-2 flex-row items-center px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/25">
                                                                            <Ionicons name="shield-checkmark" size={10} color={isDark ? "#38bdf8" : "#0284c7"} style={{ marginRight: 3 }} />
                                                                            <Text className={`text-[9px] font-black ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>운영관리자</Text>
                                                                        </View>
                                                                    )}
                                                                </View>
                                                                <Text className={`text-[11px] mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>UID: {m.id}</Text>
                                                            </View>
                                                        </View>
                                                        <View className="flex-row gap-2">
                                                            <View className="relative">
                                                                <TouchableOpacity
                                                                    onPress={(e) => { e.stopPropagation(); toggleStaff(m); }}
                                                                    // @ts-ignore
                                                                    onMouseEnter={() => setHoveredStaffBtn(m.id)}
                                                                    onMouseLeave={() => setHoveredStaffBtn(null)}
                                                                    className={`w-9 h-9 rounded-xl items-center justify-center border ${isRowStaff ? 'bg-sky-500 border-sky-400' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')}`}
                                                                >
                                                                    <Ionicons name={isRowStaff ? "shield-checkmark" : "shield-outline"} size={16} color={isRowStaff ? "white" : (isDark ? "#64748b" : "#94a3b8")} />
                                                                </TouchableOpacity>
                                                                {hoveredStaffBtn === m.id && (
                                                                    <View className={`absolute top-1/2 -translate-y-1/2 right-full mr-3 border px-3 py-2 rounded-lg shadow-xl z-50 flex-row items-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                                        <Text numberOfLines={1} className={`text-[10px] font-black whitespace-nowrap ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>운영진 권한 설정</Text>
                                                                        <View className={`absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rotate-45 border-t border-r ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`} />
                                                                    </View>
                                                                )}
                                                            </View>
                                                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); showCustomAlert('영주 삭제', `${m.nickname}님을 삭제하시겠습니까?`, 'confirm', () => deleteMember(m.id)); }} className="w-9 h-9 rounded-xl items-center justify-center border border-red-500/20 bg-red-500/10"><Ionicons name="trash-outline" size={16} color="#ef4444" /></TouchableOpacity>
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
            </View>

            {/* Modals & Alerts */}
            <Modal visible={customAlert.visible} transparent animationType="fade">
                <View className="flex-1 bg-black/60 items-center justify-center p-6 text-center">
                    <View className={`w-full max-w-sm p-8 rounded-[40px] border shadow-2xl items-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                        {/* Type-specific Icon */}
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
            </Modal>
        </View>
    );
}
