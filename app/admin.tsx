import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, Platform, ActivityIndicator, Modal } from 'react-native';
import { useRouter, Redirect, useRootNavigationState } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useTheme } from './_layout';
import { useFirestoreMembers } from '../hooks/useFirestoreMembers';
import { useFirestoreStrategySheet } from '../hooks/useFirestoreStrategySheet';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';

export default function AdminPage() {
    const router = useRouter();
    const { auth } = useAuth();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const { members, loading: membersLoading, saveMembers, clearAllMembers, deleteMember } = useFirestoreMembers();
    const { sheetData, saveSheetUrl, uploadStrategyFile } = useFirestoreStrategySheet();

    const [searchTerm, setSearchTerm] = useState('');
    const [uploading, setUploading] = useState(false);
    const [strategyUploading, setStrategyUploading] = useState(false);
    const [previewData, setPreviewData] = useState<{ id: string, nickname: string }[]>([]);
    const [showGuide, setShowGuide] = useState(false);
    const [strategyUrl, setStrategyUrl] = useState('');
    const [saveLoading, setSaveLoading] = useState(false);

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

    const rootNavigationState = useRootNavigationState();

    if (!rootNavigationState?.key) return null;

    if (!auth.isLoggedIn) {
        return <Redirect href="/" />;
    }

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

    const handleStrategyFileUpload = async () => {
        try {
            console.log('--- Strategy File Upload Start ---');
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'image/*',
                    'application/pdf',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                    'text/csv'
                ],
            });

            if (result.canceled) {
                console.log('File picker canceled');
                return;
            }

            setStrategyUploading(true);
            const file = result.assets[0];
            console.log('File selected:', {
                name: file.name,
                size: file.size,
                mimeType: file.mimeType,
                uri: file.uri.substring(0, 50) + '...'
            });

            let blob: Blob;
            if (Platform.OS === 'web') {
                try {
                    console.log('Fetching blob from URI for web...');
                    const response = await fetch(file.uri);
                    blob = await response.blob();
                    console.log('Blob created from URI, size:', blob.size);
                } catch (fetchError) {
                    console.warn('Failed to fetch blob from URI, trying direct file object:', fetchError);
                    // @ts-ignore
                    if (file.file) {
                        // @ts-ignore
                        blob = file.file;
                        console.log('Using direct file object from assets');
                    } else {
                        throw new Error('파일 데이터를 가져올 수 없습니다.');
                    }
                }
            } else {
                console.log('Fetching blob from URI for native...');
                const response = await fetch(file.uri);
                blob = await response.blob();
                console.log('Blob created for native, size:', blob.size);
            }

            console.log('Calling uploadStrategyFile...');
            const downloadURL = await uploadStrategyFile(blob, file.name);
            console.log('Upload success! URL:', downloadURL);

            Alert.alert('성공', '전략 문서 파일이 등록되었습니다.');
        } catch (error: any) {
            console.error('Detailed Strategy upload error:', error);

            let errorMessage = '파일 등록 중 문제가 발생했습니다.';
            if (error.code === 'storage/unauthorized') {
                errorMessage = '업로드 권한이 없습니다. Firebase Storage 보안 규칙을 확인하세요.';
            } else if (error.code === 'storage/retry-limit-exceeded') {
                errorMessage = '업로드 시간이 초과되었습니다. 네트워크 상태를 확인하세요.';
            } else if (error.message) {
                errorMessage += ` (${error.message})`;
            }

            Alert.alert('오류', errorMessage);
        } finally {
            setStrategyUploading(false);
            console.log('--- Strategy File Upload End ---');
        }
    };

    const handleSaveStrategyUrl = async () => {
        if (!strategyUrl.trim()) {
            const msg = '주소를 입력해주세요.';
            Platform.OS === 'web' ? window.alert(msg) : Alert.alert('알림', msg);
            return;
        }

        setSaveLoading(true);
        console.log('--- Strategy URL Save Start ---');
        console.log('Target URL:', strategyUrl);

        try {
            await saveSheetUrl(strategyUrl.trim(), 'url');
            console.log('Firestore save successful');
            showCustomAlert('저장 성공', '전략 문서 주소가 성공적으로 저장되었습니다.', 'success');
        } catch (error: any) {
            console.error('Strategy URL Save Error:', error);
            showCustomAlert('저장 실패', '주소 저장 중 문제가 발생했습니다: ' + (error.message || '알 수 없는 오류'), 'error');
        } finally {
            setSaveLoading(false);
            console.log('--- Strategy URL Save End ---');
        }
    };

    const filteredMembers = members.filter(m =>
        m.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <View className={`flex-1 p-6 ${isDark ? 'bg-[#020617]' : 'bg-slate-50'}`}>
            <View className="max-w-4xl mx-auto w-full flex-1">
                <View className="flex-row items-center mb-6 mt-8">
                    <TouchableOpacity onPress={() => router.back()} className={`mr-4 p-1.5 rounded-full shadow-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <Ionicons name="arrow-back" size={20} color={isDark ? "white" : "#1e293b"} />
                    </TouchableOpacity>
                    <Text className={`text-2xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>관리자 대시보드</Text>
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                    {/* Strategy Document Section - Updated for Link Method */}
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

                            <View className="mt-4 space-y-2">
                                <View className="flex-row items-center">
                                    <View className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2" />
                                    <Text className="text-slate-400 text-[11px] font-semibold">이미지: ImgBB 등에 올린 뒤 '직접 링크' 사용</Text>
                                </View>
                                <View className="flex-row items-center">
                                    <View className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2" />
                                    <Text className="text-slate-400 text-[11px] font-semibold">구글 시트/드라이브: '모든 사용자 보기' 권한 설정 후 주소 복사</Text>
                                </View>
                            </View>
                        </View>


                        {/* Link Input Area - Main Section */}
                        <View className={`p-4 rounded-2xl border shadow-inner ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                            <Text className={`font-bold text-sm mb-3 ${isDark ? 'text-white' : 'text-slate-800'}`}>문서 / 시트 / 이미지 주소(URL)</Text>
                            <View className="space-y-4">
                                <TextInput
                                    className={`p-5 rounded-2xl border font-semibold text-sm ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                                    placeholder="https://docs.google.com/..."
                                    placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                                    value={strategyUrl}
                                    onChangeText={setStrategyUrl}
                                    multiline={false}
                                />
                                <TouchableOpacity
                                    onPress={handleSaveStrategyUrl}
                                    disabled={saveLoading}
                                    className={`py-5 rounded-2xl items-center justify-center shadow-xl shadow-amber-500/20 ${saveLoading ? 'bg-slate-700' : 'bg-amber-500 active:bg-amber-600'}`}
                                >
                                    {saveLoading ? (
                                        <ActivityIndicator color="white" />
                                    ) : (
                                        <View className="flex-row items-center">
                                            <Ionicons name="save-outline" size={20} color="#0f172a" className="mr-2" />
                                            <Text className="text-[#0f172a] font-bold text-lg">전략 문서 주소 저장</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>

                            {sheetData && (
                                <View className={`mt-6 pt-6 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                                    <Text className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-2">현재 설정된 정보</Text>
                                    <View className={`flex-row items-center justify-between p-3 rounded-xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                        <View className="flex-row items-center flex-1 mr-4">
                                            <Ionicons
                                                name={sheetData.type === 'file' ? "image" : "link"}
                                                size={16}
                                                color="#64748b"
                                                className="mr-2"
                                            />
                                            <Text className="text-slate-300 text-xs font-medium truncate flex-1" numberOfLines={1}>
                                                {sheetData.url}
                                            </Text>
                                        </View>
                                        <View className="bg-amber-500/10 px-2 py-1 rounded-md">
                                            <Text className="text-amber-500 text-[10px] font-bold">
                                                {sheetData.type === 'file' ? '파일' : 'URL'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Secret manual upload button (hidden/minimized) */}
                        <TouchableOpacity
                            onPress={handleStrategyFileUpload}
                            className="mt-4 self-center opacity-20"
                        >
                            <Text className="text-slate-500 text-[10px] font-semibold underline">직접 업로드 (스토리지 설정 필요 시)</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Member Management Section */}
                    <View className={`p-8 rounded-[32px] border shadow-2xl ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                        <View className={`flex-row items-center justify-between mb-6 border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                            <View className="flex-row items-center">
                                <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                                    <Ionicons name="people" size={24} color={isDark ? "#818cf8" : "#4f46e5"} />
                                </View>
                                <Text className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>연맹원 명단 관리</Text>
                            </View>
                            <Text className={`font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>{members.length}명</Text>
                        </View>

                        {/* Upload Section */}
                        <View className={`p-6 rounded-2xl border border-dashed mb-8 items-center ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <Ionicons name="cloud-upload" size={40} color={isDark ? "#6366f1" : "#4f46e5"} />
                            <Text className={`font-semibold text-lg mt-2 mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>엑셀 파일 일괄 등록</Text>
                            <View className="flex-row items-center mb-6">
                                <Text className="text-slate-500 text-xs text-center mr-2">ID와 닉네임 컬럼이 포함된 파일을 선택하세요.</Text>
                                <TouchableOpacity onPress={() => setShowGuide(true)}>
                                    <View className="bg-slate-700 w-5 h-5 rounded-full items-center justify-center">
                                        <Text className="text-white text-[10px] font-semibold">?</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <View className="flex-row gap-4 w-full">
                                <TouchableOpacity
                                    onPress={handleExcelUpload}
                                    disabled={uploading}
                                    className={`flex-1 py-4 rounded-xl border items-center ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}
                                >
                                    {uploading ? (
                                        <ActivityIndicator size="small" color={isDark ? "white" : "#4f46e5"} />
                                    ) : (
                                        <View className="flex-row items-center">
                                            <Ionicons name="document-text-outline" size={18} color={isDark ? "white" : "#475569"} style={{ marginRight: 6 }} />
                                            <Text className={`font-bold ${isDark ? 'text-white' : 'text-slate-600'}`}>파일 선택</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                                {previewData.length > 0 ? (
                                    <TouchableOpacity
                                        onPress={handleSaveMembers}
                                        className="flex-1 bg-indigo-600 py-4 rounded-xl items-center shadow-lg shadow-indigo-500/30"
                                    >
                                        <Text className="text-white font-bold">명단 저장 ({previewData.length}건)</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        onPress={downloadTemplate}
                                        className={`flex-1 py-4 rounded-xl border items-center ${isDark ? 'bg-slate-800 border-indigo-500/30' : 'bg-white border-indigo-100'}`}
                                    >
                                        <View className="flex-row items-center">
                                            <Ionicons name="download-outline" size={18} color={isDark ? "#818cf8" : "#4f46e5"} style={{ marginRight: 6 }} />
                                            <Text className={`font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>양식 다운로드</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Preview Table for Uploaded Data */}
                        {previewData.length > 0 && (
                            <View className={`p-5 rounded-2xl border mb-8 ${isDark ? 'bg-slate-800/80 border-indigo-500/30' : 'bg-slate-50 border-indigo-100'}`}>
                                <View className="flex-row justify-between items-center mb-4">
                                    <Text className="text-indigo-400 font-bold">업로드 미리보기</Text>
                                    <TouchableOpacity onPress={() => setPreviewData([])}>
                                        <Text className="text-red-400 text-xs font-semibold">취소</Text>
                                    </TouchableOpacity>
                                </View>
                                <ScrollView className="max-h-60" nestedScrollEnabled>
                                    {previewData.map((p, idx) => (
                                        <View key={idx} className={`flex-row justify-between py-2 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-100'}`}>
                                            <Text className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{p.id}</Text>
                                            <Text className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-700'}`}>{p.nickname}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Search & List */}
                        <View className="mb-4">
                            <View className={`flex-row items-center rounded-xl px-4 py-3 border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                <Ionicons name="search" size={20} color={isDark ? "#94a3b8" : "#64748b"} className="mr-2" />
                                <TextInput
                                    placeholder="닉네임 또는 ID로 검색..."
                                    placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                                    value={searchTerm}
                                    onChangeText={setSearchTerm}
                                    className={`flex-1 font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}
                                />
                            </View>
                        </View>

                        <View className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-800/30 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                            {membersLoading ? (
                                <View className="py-10 items-center">
                                    <ActivityIndicator color="#818cf8" />
                                </View>
                            ) : filteredMembers.length === 0 ? (
                                <View className="py-10 items-center">
                                    <Text className={`font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>등록된 연맹원이 없습니다.</Text>
                                </View>
                            ) : (
                                <ScrollView className="max-h-96" nestedScrollEnabled>
                                    {filteredMembers.map((m, idx) => (
                                        <View key={m.id} className={`flex-row items-center justify-between p-4 ${idx !== filteredMembers.length - 1 ? (isDark ? 'border-b border-slate-800' : 'border-b border-slate-100') : ''}`}>
                                            <View>
                                                <Text className={`font-bold text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>{m.nickname}</Text>
                                                <Text className="text-slate-500 text-[10px] mt-0.5">ID: {m.id}</Text>
                                            </View>
                                            <View className="flex-row gap-2">
                                                <TouchableOpacity
                                                    className="w-8 h-8 rounded-lg bg-red-500/10 items-center justify-center"
                                                    onPress={() => {
                                                        Alert.alert(
                                                            '멤버 삭제',
                                                            `${m.nickname}님을 명단에서 삭제하시겠습니까?`,
                                                            [
                                                                { text: '취소', style: 'cancel' },
                                                                {
                                                                    text: '삭제',
                                                                    style: 'destructive',
                                                                    onPress: async () => {
                                                                        try {
                                                                            await deleteMember(m.id);
                                                                        } catch (error) {
                                                                            Alert.alert('오류', '멤버 삭제 중 오류가 발생했습니다.');
                                                                        }
                                                                    }
                                                                }
                                                            ]
                                                        );
                                                    }}
                                                >
                                                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))}
                                </ScrollView>
                            )}
                        </View>

                        <TouchableOpacity
                            onPress={() => {
                                Alert.alert(
                                    '전체 삭제',
                                    '등록된 모든 연맹원 명단을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
                                    [
                                        { text: '취소', style: 'cancel' },
                                        { text: '전체 삭제', style: 'destructive', onPress: clearAllMembers }
                                    ]
                                );
                            }}
                            className="mt-6 self-end"
                        >
                            <Text className="text-red-500/50 text-xs font-semibold underline">명단 전체 초기화</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>

            {/* Custom Alert Modal */}
            <Modal visible={customAlert.visible} transparent animationType="fade" onRequestClose={() => setCustomAlert({ ...customAlert, visible: false })}>
                <View className="flex-1 bg-black/60 items-center justify-center p-6">
                    <View className={`w-full max-w-sm p-8 rounded-[40px] border shadow-2xl items-center ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                        <View className={`w-20 h-20 rounded-full items-center justify-center mb-6 ${customAlert.type === 'success' ? 'bg-emerald-500/10' : (customAlert.type === 'error' || customAlert.type === 'confirm') ? 'bg-red-500/10' : 'bg-amber-500/10'}`}>
                            <Ionicons
                                name={customAlert.type === 'success' ? 'checkmark-circle' : (customAlert.type === 'error' || customAlert.type === 'confirm') ? 'alert-circle' : 'warning'}
                                size={48}
                                color={customAlert.type === 'success' ? '#10b981' : (customAlert.type === 'error' || customAlert.type === 'confirm') ? '#ef4444' : '#fbbf24'}
                            />
                        </View>
                        <Text className={`text-2xl font-bold mb-4 text-center ${isDark ? 'text-white' : 'text-slate-800'}`}>{customAlert.title}</Text>
                        <Text className={`text-center mb-8 text-lg leading-7 font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                            {customAlert.message}
                        </Text>

                        {customAlert.type === 'confirm' ? (
                            <View className="flex-row gap-3 w-full">
                                <TouchableOpacity
                                    onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                                    className={`flex-1 py-4 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200 shadow-sm'}`}
                                >
                                    <Text className={`text-center font-bold text-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>취소</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => {
                                        setCustomAlert({ ...customAlert, visible: false });
                                        if (customAlert.onConfirm) customAlert.onConfirm();
                                    }}
                                    className="flex-1 py-4 bg-red-600 rounded-2xl"
                                >
                                    <Text className="text-white text-center font-bold text-lg">확인</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={() => setCustomAlert({ ...customAlert, visible: false })}
                                className={`py-4 w-full rounded-2xl ${customAlert.type === 'success' ? 'bg-emerald-600' : customAlert.type === 'error' ? 'bg-red-600' : 'bg-amber-600'}`}
                            >
                                <Text className="text-white text-center font-bold text-lg">확인</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal >

            {/* Format Guide Modal */}
            <Modal
                visible={showGuide}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowGuide(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View className={`border p-8 rounded-[32px] w-full max-w-md shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <View className="flex-row justify-between items-center mb-6">
                            <View className="flex-row items-center">
                                <Ionicons name="information-circle-outline" size={24} color={isDark ? "#818cf8" : "#4f46e5"} style={{ marginRight: 8 }} />
                                <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>엑셀 양식 안내</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowGuide(false)}>
                                <Ionicons name="close" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
                            </TouchableOpacity>
                        </View>

                        <View className="space-y-6">
                            <View>
                                <Text className={`font-semibold mb-2 text-sm ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>필수 포함 컬럼</Text>
                                <View className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                    <Text className={`text-xs leading-5 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                                        • <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-semibold`}>ID</Text>: 게임 내 영주 고유 ID (숫자) {"\n"}
                                        • <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-semibold`}>닉네임</Text>: 게임 내 현재 사용 중인 영주 이름
                                    </Text>
                                </View>
                            </View>

                            <View>
                                <Text className={`font-semibold mb-2 text-sm ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`}>주의 사항</Text>
                                <View className={`p-4 rounded-xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                    <Text className={`text-xs leading-5 ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                                        • 파일 형식은 <Text className="text-amber-500 font-semibold">.xlsx</Text> 또는 <Text className="text-amber-500 font-semibold">.xls</Text>를 권장합니다. {"\n"}
                                        • 컬럼 이름은 'ID', '닉네임'이 포함되어 있어야 자동으로 인식됩니다. {"\n"}
                                        • 첫 번째 시트에 있는 데이터만 불러옵니다.
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={() => { downloadTemplate(); setShowGuide(false); }}
                                className="bg-indigo-600 py-4 rounded-2xl items-center shadow-lg shadow-indigo-500/20"
                            >
                                <Text className="text-white font-bold">표준 양식 다운로드</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setShowGuide(false)}
                                className={`py-4 rounded-2xl items-center border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                            >
                                <Text className={`font-semibold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>닫기</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

