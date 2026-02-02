import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, Platform, ActivityIndicator, Modal } from 'react-native';
import { useRouter, Redirect, useRootNavigationState } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';
import { useFirestoreMembers } from '../hooks/useFirestoreMembers';
import { useFirestoreStrategySheet } from '../hooks/useFirestoreStrategySheet';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';

export default function AdminPage() {
    const router = useRouter();
    const { auth } = useAuth();
    const { members, loading: membersLoading, saveMembers, clearAllMembers, deleteMember } = useFirestoreMembers();
    const { sheetData, saveSheetUrl, uploadStrategyFile } = useFirestoreStrategySheet();

    const [searchTerm, setSearchTerm] = useState('');
    const [uploading, setUploading] = useState(false);
    const [strategyUploading, setStrategyUploading] = useState(false);
    const [previewData, setPreviewData] = useState<{ id: string, nickname: string }[]>([]);
    const [showGuide, setShowGuide] = useState(false);
    const [strategyUrl, setStrategyUrl] = useState('');

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
                // @ts-ignore
                blob = file.file;
            } else {
                const response = await fetch(file.uri);
                blob = await response.blob();
            }

            await uploadStrategyFile(blob, file.name);
            Alert.alert('성공', '전략 문서 파일이 등록되었습니다.');
        } catch (error: any) {
            console.error('Strategy upload error:', error);
            // Check for CORS or Network errors to give better feedback
            if (error.message?.includes('Network Error') || error.message?.includes('CORS')) {
                Alert.alert('업로드 실패 (CORS)', '서버 보안 설정으로 인해 업로드가 차단되었습니다. 관리자에게 문의하거나 잠시 후 다시 시도해 주세요.');
            } else {
                Alert.alert('오류', '파일 등록 중 문제가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
            }
        } finally {
            setStrategyUploading(false);
        }
    };

    const handleSaveStrategyUrl = async () => {
        if (!strategyUrl.trim()) return;
        try {
            await saveSheetUrl(strategyUrl, 'url');
            Alert.alert('성공', '전략 문서 주소가 저장되었습니다.');
        } catch (error) {
            Alert.alert('오류', '주소 저장 중 문제가 발생했습니다.');
        }
    };

    const filteredMembers = members.filter(m =>
        m.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <View className="flex-1 bg-[#020617] p-6">
            <View className="max-w-4xl mx-auto w-full flex-1">
                <View className="flex-row items-center mb-8 mt-12">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 bg-slate-800 rounded-full shadow-lg border border-slate-700">
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                    <Text className="text-white text-3xl font-black">관리자 대시보드</Text>
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>

                    {/* Strategy Document Section - New! */}
                    <View className="bg-slate-900/80 p-8 rounded-[32px] border border-slate-800 shadow-2xl mb-8">
                        <View className="flex-row items-center mb-6 border-b border-slate-800 pb-4">
                            <View className="w-10 h-10 bg-amber-500/20 rounded-xl items-center justify-center mr-3">
                                <Ionicons name="map-outline" size={24} color="#f59e0b" />
                            </View>
                            <Text className="text-white text-2xl font-bold">전략 문서 관리</Text>
                        </View>

                        <Text className="text-slate-400 text-sm mb-6 leading-relaxed font-medium">
                            구글 시트 소유권 문제로 시트가 안 보일 경우, {"\n"}
                            <Text className="text-amber-500 font-bold">대체 파일(이미지/PDF/엑셀)</Text>을 등록하거나 외부 URL을 입력하세요.
                        </Text>

                        {/* File Upload Area */}
                        <TouchableOpacity
                            onPress={handleStrategyFileUpload}
                            disabled={strategyUploading}
                            className={`mb-6 p-10 rounded-2xl border-2 border-dashed ${strategyUploading ? 'border-slate-700' : 'border-amber-500/30 bg-amber-500/5'} items-center justify-center`}
                        >
                            {strategyUploading ? (
                                <ActivityIndicator color="#f59e0b" />
                            ) : (
                                <>
                                    <Ionicons name="cloud-upload-outline" size={48} color="#f59e0b" />
                                    <Text className="text-white font-black text-lg mt-4">파일 등록 (이미지 / PDF / EXCEL)</Text>
                                    <Text className="text-slate-500 text-xs mt-2 font-bold text-center">지원 확장자: JPG, PNG, WEBP, PDF, XLSX, XLS, CSV</Text>
                                    {sheetData?.type === 'file' && (
                                        <View className="mt-4 bg-slate-800 px-4 py-2 rounded-full border border-slate-700">
                                            <Text className="text-amber-400 text-[10px] font-bold">현재 등록됨: {sheetData.fileName || '파일'}</Text>
                                        </View>
                                    )}
                                </>
                            )}
                        </TouchableOpacity>


                        {/* URL Input Area */}
                        <View className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700">
                            <Text className="text-slate-300 font-bold text-sm mb-3">또는 외부 연동 URL 입력</Text>
                            <View className="flex-row gap-2">
                                <TextInput
                                    className="flex-1 bg-slate-900 text-white p-4 rounded-xl border border-slate-600 font-medium"
                                    placeholder="https://..."
                                    placeholderTextColor="#475569"
                                    value={strategyUrl}
                                    onChangeText={setStrategyUrl}
                                />
                                <TouchableOpacity
                                    onPress={handleSaveStrategyUrl}
                                    className="bg-amber-600 px-6 rounded-xl items-center justify-center shadow-lg shadow-amber-500/20"
                                >
                                    <Text className="text-white font-black">저장</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    {/* Member Management Section */}
                    <View className="bg-slate-900/80 p-8 rounded-[32px] border border-slate-800 shadow-2xl">
                        <View className="flex-row items-center justify-between mb-6 border-b border-slate-800 pb-4">
                            <View className="flex-row items-center">
                                <View className="w-10 h-10 bg-indigo-500/20 rounded-xl items-center justify-center mr-3">
                                    <Ionicons name="people" size={24} color="#818cf8" />
                                </View>
                                <Text className="text-white text-2xl font-bold">연맹원 명단 관리</Text>
                            </View>
                            <Text className="text-indigo-400 font-black">{members.length}명</Text>
                        </View>

                        {/* Upload Section */}
                        <View className="bg-slate-800/50 p-6 rounded-2xl border border-dashed border-slate-700 mb-8 items-center">
                            <Ionicons name="cloud-upload" size={40} color="#6366f1" />
                            <Text className="text-white font-bold text-lg mt-2 mb-1">엑셀 파일 일괄 등록</Text>
                            <View className="flex-row items-center mb-6">
                                <Text className="text-slate-500 text-xs text-center mr-2">ID와 닉네임 컬럼이 포함된 파일을 선택하세요.</Text>
                                <TouchableOpacity onPress={() => setShowGuide(true)}>
                                    <View className="bg-slate-700 w-5 h-5 rounded-full items-center justify-center">
                                        <Text className="text-white text-[10px] font-bold">?</Text>
                                    </View>
                                </TouchableOpacity>
                            </View>

                            <View className="flex-row gap-4 w-full">
                                <TouchableOpacity
                                    onPress={handleExcelUpload}
                                    disabled={uploading}
                                    className="flex-1 bg-slate-700 py-4 rounded-xl border border-slate-600 items-center"
                                >
                                    {uploading ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <View className="flex-row items-center">
                                            <Ionicons name="document-text-outline" size={18} color="white" style={{ marginRight: 6 }} />
                                            <Text className="text-white font-black">파일 선택</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                                {previewData.length > 0 ? (
                                    <TouchableOpacity
                                        onPress={handleSaveMembers}
                                        className="flex-1 bg-indigo-600 py-4 rounded-xl items-center shadow-lg shadow-indigo-500/30"
                                    >
                                        <Text className="text-white font-black">명단 저장 ({previewData.length}건)</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <TouchableOpacity
                                        onPress={downloadTemplate}
                                        className="flex-1 bg-slate-800 py-4 rounded-xl border border-indigo-500/30 items-center"
                                    >
                                        <View className="flex-row items-center">
                                            <Ionicons name="download-outline" size={18} color="#818cf8" style={{ marginRight: 6 }} />
                                            <Text className="text-indigo-400 font-black">양식 다운로드</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>

                        {/* Preview Table for Uploaded Data */}
                        {previewData.length > 0 && (
                            <View className="bg-slate-800/80 p-5 rounded-2xl border border-indigo-500/30 mb-8">
                                <View className="flex-row justify-between items-center mb-4">
                                    <Text className="text-indigo-400 font-black">업로드 미리보기</Text>
                                    <TouchableOpacity onPress={() => setPreviewData([])}>
                                        <Text className="text-red-400 text-xs font-bold">취소</Text>
                                    </TouchableOpacity>
                                </View>
                                <ScrollView className="max-h-60" nestedScrollEnabled>
                                    {previewData.map((p, idx) => (
                                        <View key={idx} className="flex-row justify-between py-2 border-b border-slate-700/50">
                                            <Text className="text-slate-400 text-xs">{p.id}</Text>
                                            <Text className="text-white text-xs font-bold">{p.nickname}</Text>
                                        </View>
                                    ))}
                                </ScrollView>
                            </View>
                        )}

                        {/* Search & List */}
                        <View className="mb-4">
                            <View className="flex-row items-center bg-slate-800 rounded-xl px-4 py-3 border border-slate-700">
                                <Ionicons name="search" size={20} color="#94a3b8" className="mr-2" />
                                <TextInput
                                    placeholder="닉네임 또는 ID로 검색..."
                                    placeholderTextColor="#475569"
                                    value={searchTerm}
                                    onChangeText={setSearchTerm}
                                    className="flex-1 text-white font-bold"
                                />
                            </View>
                        </View>

                        <View className="bg-slate-800/30 rounded-2xl border border-slate-800 overflow-hidden">
                            {membersLoading ? (
                                <View className="py-10 items-center">
                                    <ActivityIndicator color="#818cf8" />
                                </View>
                            ) : filteredMembers.length === 0 ? (
                                <View className="py-10 items-center">
                                    <Text className="text-slate-500 font-bold">등록된 연맹원이 없습니다.</Text>
                                </View>
                            ) : (
                                <ScrollView className="max-h-96" nestedScrollEnabled>
                                    {filteredMembers.map((m, idx) => (
                                        <View key={m.id} className={`flex-row items-center justify-between p-4 ${idx !== filteredMembers.length - 1 ? 'border-b border-slate-800' : ''}`}>
                                            <View>
                                                <Text className="text-white font-black text-base">{m.nickname}</Text>
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
                            <Text className="text-red-500/50 text-xs font-bold underline">명단 전체 초기화</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </View>

            {/* Format Guide Modal */}
            <Modal
                visible={showGuide}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowGuide(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                    <View className="bg-slate-900 border border-slate-700 p-8 rounded-[32px] w-full max-w-md shadow-2xl">
                        <View className="flex-row justify-between items-center mb-6">
                            <View className="flex-row items-center">
                                <Ionicons name="information-circle-outline" size={24} color="#818cf8" style={{ marginRight: 8 }} />
                                <Text className="text-white text-xl font-black">엑셀 양식 안내</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowGuide(false)}>
                                <Ionicons name="close" size={24} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>

                        <View className="space-y-6">
                            <View>
                                <Text className="text-indigo-400 font-bold mb-2 text-sm">필수 포함 컬럼</Text>
                                <View className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                    <Text className="text-slate-300 text-xs leading-5">
                                        • <Text className="text-white font-bold">ID</Text>: 게임 내 영주 고유 ID (숫자) {"\n"}
                                        • <Text className="text-white font-bold">닉네임</Text>: 게임 내 현재 사용 중인 영주 이름
                                    </Text>
                                </View>
                            </View>

                            <View>
                                <Text className="text-indigo-400 font-bold mb-2 text-sm">주의 사항</Text>
                                <View className="bg-slate-800 p-4 rounded-xl border border-slate-700">
                                    <Text className="text-slate-300 text-xs leading-5">
                                        • 파일 형식은 <Text className="text-amber-500 font-bold">.xlsx</Text> 또는 <Text className="text-amber-500 font-bold">.xls</Text>를 권장합니다. {"\n"}
                                        • 컬럼 이름은 'ID', '닉네임'이 포함되어 있어야 자동으로 인식됩니다. {"\n"}
                                        • 첫 번째 시트에 있는 데이터만 불러옵니다.
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                onPress={() => { downloadTemplate(); setShowGuide(false); }}
                                className="bg-indigo-600 py-4 rounded-2xl items-center shadow-lg shadow-indigo-500/20"
                            >
                                <Text className="text-white font-black">표준 양식 다운로드</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setShowGuide(false)}
                                className="bg-slate-800 py-4 rounded-2xl items-center border border-slate-700"
                            >
                                <Text className="text-slate-400 font-bold">닫기</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

