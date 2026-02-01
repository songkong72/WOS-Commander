import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Switch, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './_layout';
import { useFirestoreNotice } from '../hooks/useFirestoreNotice';

export default function AdminPage() {
    const router = useRouter();
    const { auth } = useAuth();
    const { notice, saveNotice } = useFirestoreNotice();

    const [content, setContent] = useState('');
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!auth.isLoggedIn) {
            Alert.alert('접근 거부', '관리자 권한이 필요합니다.');
            router.replace('/');
        }
    }, [auth]);

    useEffect(() => {
        if (notice) {
            setContent(notice.content);
            setVisible(notice.visible);
        }
    }, [notice]);

    const handleSave = async () => {
        await saveNotice(content, visible);
        Alert.alert('저장 완료', '공지사항이 저장되었습니다.');
    };

    return (
        <View className="flex-1 bg-[#020617] p-6">
            <View className="max-w-4xl mx-auto w-full">
                <View className="flex-row items-center mb-8 mt-12">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4 p-2 bg-slate-800 rounded-full">
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                    <Text className="text-white text-3xl font-black">관리자 대시보드</Text>
                </View>

                <View className="bg-slate-900/80 p-8 rounded-[32px] border border-slate-800 shadow-2xl">
                    <View className="flex-row items-center mb-6 border-b border-slate-800 pb-4">
                        <View className="w-10 h-10 bg-amber-500/20 rounded-xl items-center justify-center mr-3">
                            <Ionicons name="megaphone" size={24} color="#fbbf24" />
                        </View>
                        <Text className="text-white text-2xl font-bold">공지사항 관리</Text>
                    </View>

                    <View className="mb-6">
                        <Text className="text-slate-400 mb-3 font-bold ml-1">공지 내용</Text>
                        <TextInput
                            multiline
                            placeholder="공지 내용을 입력하세요..."
                            placeholderTextColor="#475569"
                            value={content}
                            onChangeText={setContent}
                            className="bg-slate-800 p-5 rounded-2xl text-white text-base leading-6 h-40 text-top border border-slate-700 focus:border-[#38bdf8]"
                            style={{ textAlignVertical: 'top' }}
                        />
                    </View>

                    <View className="flex-row items-center justify-between mb-8 bg-slate-800/50 p-4 rounded-2xl border border-slate-700/50">
                        <View>
                            <Text className="text-white font-bold mb-1">메인 화면 노출</Text>
                            <Text className="text-slate-500 text-xs">활성화 시 모든 사용자에게 공지가 표시됩니다.</Text>
                        </View>
                        <Switch
                            value={visible}
                            onValueChange={setVisible}
                            trackColor={{ false: '#334155', true: '#38bdf8' }}
                            thumbColor={visible ? '#ffffff' : '#94a3b8'}
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleSave}
                        className="bg-[#38bdf8] py-5 rounded-2xl shadow-lg shadow-blue-500/20 active:scale-[0.98] transition-all"
                    >
                        <Text className="text-brand-dark text-center font-black text-lg">설정 저장하기</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}
