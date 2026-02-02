import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';
import { useFirestoreMembers } from '../hooks/useFirestoreMembers';
import * as DocumentPicker from 'expo-document-picker';
import * as XLSX from 'xlsx';

export default function AdminPage() {
    const router = useRouter();
    const { auth } = useAuth();
    const { members, loading: membersLoading, saveMembers, clearAllMembers } = useFirestoreMembers();

    const [searchTerm, setSearchTerm] = useState('');
    const [uploading, setUploading] = useState(false);
    const [previewData, setPreviewData] = useState<{ id: string, nickname: string }[]>([]);

    useEffect(() => {
        if (!auth.isLoggedIn) {
            Alert.alert('접근 거부', '관리자 권한이 필요합니다.');
            router.replace('/');
        }
    }, [auth]);

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

    const filteredMembers = members.filter(m =>
        m.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <View className="flex-1 bg-[#020617] p-6">
            <View className="max-w-4xl mx-auto w-full">
                <View className="flex-row items-center mb-8 mt-12">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 bg-slate-800 rounded-full">
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                    <Text className="text-white text-3xl font-black">관리자 대시보드</Text>
                </View>

                {/* Member Management Section */}
                <View className="bg-slate-900/80 p-8 rounded-[32px] border border-slate-800 shadow-2xl mt-8 mb-20">
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
                        <Ionicons name="cloud-upload" size={40} color="#6366f1" className="mb-3" />
                        <Text className="text-white font-bold text-lg mb-1">엑셀 파일 일괄 등록</Text>
                        <Text className="text-slate-500 text-xs mb-6 text-center">ID와 닉네임 컬럼이 포함된 파일을 선택하세요.</Text>

                        <View className="flex-row gap-4 w-full">
                            <TouchableOpacity
                                onPress={handleExcelUpload}
                                disabled={uploading}
                                className="flex-1 bg-slate-700 py-4 rounded-xl border border-slate-600 items-center"
                            >
                                {uploading ? (
                                    <ActivityIndicator size="small" color="white" />
                                ) : (
                                    <Text className="text-white font-black">파일 선택</Text>
                                )}
                            </TouchableOpacity>
                            {previewData.length > 0 && (
                                <TouchableOpacity
                                    onPress={handleSaveMembers}
                                    className="flex-1 bg-indigo-600 py-4 rounded-xl items-center"
                                >
                                    <Text className="text-white font-black">명단 저장 ({previewData.length}건)</Text>
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
                                                            { text: '삭제', style: 'destructive', onPress: () => { /* 구현 필요 */ } }
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
            </View>
        </View>
    );
}
