import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, StyleSheet, TextInput, Modal, Alert } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useAuth } from '../../_layout';
import { ADMIN_USERS } from '../../../data/admin-config';

const INITIAL_ATTENDEES = [
    { id: '1', name: '영광의사령관', power: '245.8M', furnace: 'Lv.30 (심화 5)', role: '맹주', heroCombo: '플린트/바히티/몰리' },
    { id: '2', name: '빙원의늑대', power: '182.4M', furnace: 'Lv.30 (심화 3)', role: '부맹주', heroCombo: '플린트/몰리/세르게이' },
    { id: '3', name: '얼음폭풍', power: '156.2M', furnace: 'Lv.30 (심화 2)', role: '지휘관', heroCombo: '바히티/몰리/진먼' },
    { id: '4', name: '고독한영주', power: '120.5M', furnace: 'Lv.30', role: '전사', heroCombo: '세르게이/바히티/재시' },
    { id: '5', name: '화염의기사', power: '98.7M', furnace: 'Lv.28', role: '전사', heroCombo: '플린트/진먼/바히티' },
    { id: '6', name: '세종대왕', power: '310.2M', furnace: 'Lv.30 (심화 5)', role: '장로', heroCombo: '진먼/플린트/몰리' },
    { id: '7', name: '리틀영주', power: '45.1M', furnace: 'Lv.22', role: '신입', heroCombo: '세르게이/바히티/몰리' },
];

export default function EventDetail() {
    const params = useLocalSearchParams();
    const router = useRouter();
    const { auth } = useAuth();
    const [activeTab, setActiveTab] = useState<'guide' | 'attendees'>('guide');
    const [attendees, setAttendees] = useState(INITIAL_ATTENDEES);

    // Form state for Add/Edit
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editingAttendee, setEditingAttendee] = useState<any>(null);
    const [formData, setFormData] = useState({ name: '', power: '', furnace: '', role: '전사', heroCombo: '' });

    const { id, title, category, imageUrl, description } = params;
    const isAllianceEvent = category === '연맹';


    const openEditModal = (attendee?: any) => {
        if (attendee) {
            setEditingAttendee(attendee);
            setFormData({ name: attendee.name, power: attendee.power, furnace: attendee.furnace, role: attendee.role, heroCombo: attendee.heroCombo || '' });
        } else {
            setEditingAttendee(null);
            setFormData({ name: '', power: '', furnace: '', role: '전사', heroCombo: '' });
        }
        setEditModalVisible(true);
    };

    const saveAttendee = () => {
        if (!formData.name || !formData.power || !formData.furnace) {
            Alert.alert('입력 오류', '모든 필드를 입력해주세요.');
            return;
        }

        if (editingAttendee) {
            setAttendees(attendees.map(a => a.id === editingAttendee.id ? { ...a, ...formData } : a));
        } else {
            const newAttendee = {
                id: Date.now().toString(),
                ...formData
            };
            setAttendees([...attendees, newAttendee]);
        }
        setEditModalVisible(false);
    };

    const deleteAttendee = (targetId: string) => {
        Alert.alert(
            '참석자 삭제',
            '정말로 이 영주를 참석 명단에서 삭제하시겠습니까?',
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '삭제', style: 'destructive', onPress: () => {
                        setAttendees(attendees.filter(a => a.id !== targetId));
                    }
                }
            ]
        );
    };

    // Specific content mapper (omitted for brevity in this snippet but assumed present)
    const getEventContent = (eventId: string) => {
        switch (eventId) {
            case 'a1': // 서리 영역 병기 리그
                return {
                    overview: "서리 영역 병기 리그는 ‘무기 공장 쟁탈전’ 이벤트를 토너먼트 형식으로 진행하는 18일간의 대규모 이벤트입니다. 구역별 상위 64개 군단이 선발되어 치열한 본선을 치르며, 시즌 챔피언을 가립니다.",
                    howToPlay: [
                        { text: "참가 신청 및 시간 선택: R5/R4가 2, 7, 12, 14, 19 UTC 중 3개의 선호 시간을 선택하여 신청합니다.", images: ["https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/11/1-1-139x300.png"] },
                        { text: "군단 구성: 총 50명(참전자 30명, 후보자 20명)의 팀을 구성합니다.", images: ["https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2025/11/2-1-300x88.png"] }
                    ],
                    tips: ["탈락하더라도 누적 득실 포인트가 반영되므로 매 경기 최선을 다하세요."]
                };
            // ... (other cases)
            default:
                return {
                    overview: description || "가이드 준비 중입니다.",
                    howToPlay: [{ text: "미션을 확인하세요." }],
                    tips: ["정보를 확인하세요."]
                };
        }
    };

    const content = getEventContent(id as string);

    return (
        <View className="flex-1 bg-brand-dark">
            <Stack.Screen options={{ headerShown: false }} />

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Banner Section */}
                <ImageBackground
                    source={imageUrl ? { uri: imageUrl as string } : require('../../../assets/images/app_main_bg.png')}
                    className="h-80 w-full"
                >
                    <BlurView intensity={20} className="absolute inset-0 bg-black/30" />
                    <View className="mt-16 px-6">
                        <TouchableOpacity
                            onPress={() => router.back()}
                            className="w-10 h-10 rounded-full bg-black/40 items-center justify-center border border-white/20"
                        >
                            <Text className="text-white text-xl font-bold">←</Text>
                        </TouchableOpacity>
                    </View>

                    <View className="mt-auto px-6 pb-8">
                        <View className="px-3 py-1 bg-brand-accent rounded-lg self-start mb-3">
                            <Text className="text-[10px] font-black text-brand-dark">{category}</Text>
                        </View>
                        <Text className="text-white text-4xl font-black tracking-tighter shadow-lg">{title}</Text>
                    </View>
                </ImageBackground>

                <View className="p-6 -mt-8 bg-brand-dark rounded-t-[40px]">
                    {/* Tab Switcher */}
                    {isAllianceEvent && (
                        <View className="flex-row bg-slate-900/60 p-1.5 rounded-2xl mb-8 border border-slate-800">
                            <TouchableOpacity
                                onPress={() => setActiveTab('guide')}
                                className={`flex-1 py-3 rounded-xl items-center ${activeTab === 'guide' ? 'bg-brand-accent' : ''}`}
                            >
                                <Text className={`font-black text-xs ${activeTab === 'guide' ? 'text-brand-dark' : 'text-slate-300'}`}>공략 가이드</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setActiveTab('attendees')}
                                className={`flex-1 py-3 rounded-xl items-center ${activeTab === 'attendees' ? 'bg-brand-accent' : ''}`}
                            >
                                <Text className={`font-black text-xs ${activeTab === 'attendees' ? 'text-brand-dark' : 'text-slate-300'}`}>참석 영주 ({attendees.length})</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {activeTab === 'guide' ? (
                        <View>
                            <Text className="text-brand-accent text-sm font-black mb-3 ml-1 uppercase tracking-widest">Description</Text>
                            <View className="bg-slate-900/60 p-6 rounded-[32px] border border-slate-800 mb-10">
                                <Text className="text-slate-300 text-base font-bold leading-7">{content.overview}</Text>
                            </View>

                            <Text className="text-brand-accent text-sm font-black mb-3 ml-1 uppercase tracking-widest">How to Play</Text>
                            <View className="space-y-6 mb-10">
                                {content.howToPlay.map((item, index) => (
                                    <View key={index} className="bg-slate-900/40 p-5 rounded-[24px] border border-slate-800/50">
                                        <Text className="text-slate-200 text-sm font-bold leading-6 mb-3">{index + 1}. {item.text}</Text>
                                        {item.images && (
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                                {item.images.map((img, i) => (
                                                    <ImageBackground key={i} source={{ uri: img }} className="w-24 h-40 mr-3 rounded-xl overflow-hidden border border-white/10" />
                                                ))}
                                            </ScrollView>
                                        )}
                                    </View>
                                ))}
                            </View>

                            <Text className="text-brand-accent text-sm font-black mb-3 ml-1 uppercase tracking-widest">Pro Tips</Text>
                            <View className="bg-slate-900/60 p-6 rounded-[32px] border border-slate-800">
                                {content.tips.map((tip, i) => (
                                    <Text key={i} className="text-slate-300 text-sm font-bold leading-6 mb-2">❄️ {tip}</Text>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <View className="space-y-4">
                            <View className="flex-row justify-between items-center mb-4">
                                <Text className="text-brand-accent text-sm font-black ml-1 uppercase tracking-widest">Alliance Participants</Text>
                                {auth.isLoggedIn && (
                                    <View className="flex-row space-x-2">
                                        <TouchableOpacity onPress={() => openEditModal()} className="bg-brand-accent px-4 py-2 rounded-xl">
                                            <Text className="text-brand-dark font-black text-xs">영주 추가</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {attendees.map((attendee) => (
                                <View key={attendee.id} className="bg-slate-900/60 p-5 rounded-3xl border border-slate-800 flex-row items-center">
                                    <View className="w-12 h-12 rounded-full bg-slate-800 items-center justify-center mr-4 border border-slate-700">
                                        <Text className="text-white text-lg">🛡️</Text>
                                    </View>
                                    <View className="flex-1">
                                        <View className="flex-row justify-between items-center mb-1">
                                            <Text className="text-white text-lg font-black">{attendee.name}</Text>
                                            <View className="px-2 py-0.5 bg-brand-accent/20 rounded">
                                                <Text className="text-brand-accent text-[10px] font-black">{attendee.role}</Text>
                                            </View>
                                        </View>
                                        <View className="flex-row items-center">
                                            <Text className="text-slate-500 text-[10px] font-bold mr-1">전투력</Text>
                                            <Text className="text-slate-200 text-xs font-black mr-4">{attendee.power}</Text>
                                            <Text className="text-slate-500 text-[10px] font-bold mr-1">용광로</Text>
                                            <Text className="text-slate-200 text-xs font-black mr-4">{attendee.furnace}</Text>
                                            <Text className="text-brand-accent text-[10px] font-black mr-1">조합</Text>
                                            <Text className="text-brand-accent/80 text-[10px] font-bold">{attendee.heroCombo}</Text>
                                        </View>
                                    </View>
                                    {auth.isLoggedIn && (
                                        <View className="flex-row ml-2 space-x-2">
                                            <TouchableOpacity onPress={() => openEditModal(attendee)} className="p-2 bg-blue-500/20 rounded-lg">
                                                <Text className="text-blue-400 font-black text-[10px]">편집</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => deleteAttendee(attendee.id)} className="p-2 bg-red-500/20 rounded-lg">
                                                <Text className="text-red-400 font-black text-[10px]">삭제</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>
                    )}

                    {/* Global Admin Login Trigger at the bottom */}
                    {!auth.isLoggedIn && (
                        <View className="mt-12 items-center">
                            <TouchableOpacity
                                onPress={() => router.replace('/')} // Redirect to home for login
                                className="bg-slate-800/40 px-8 py-4 rounded-2xl border border-slate-700 flex-row items-center"
                            >
                                <Text className="text-slate-400 font-black text-sm mr-2">🔒 관리자 모드로 전환하기</Text>
                                <Text className="text-slate-600 text-[10px] font-bold">(첫 화면에서 로그인하세요)</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View className="h-20" />
                </View>
            </ScrollView>

            {/* Edit/Add Modal */}
            <Modal visible={editModalVisible} transparent animationType="slide">
                <View className="flex-1 bg-black/80 items-center justify-end">
                    <View className="bg-slate-900 w-full p-8 rounded-t-[40px] border-t border-slate-800">
                        <Text className="text-white text-2xl font-black mb-6">{editingAttendee ? '영주 정보 수정' : '새 영주 등록'}</Text>
                        <View className="space-y-4 mb-8">
                            <TextInput
                                placeholder="영주 이름" placeholderTextColor="#64748b" value={formData.name}
                                onChangeText={(t) => setFormData({ ...formData, name: t })}
                                className="bg-slate-800 p-5 rounded-2xl text-white font-bold border border-slate-700"
                            />
                            <TextInput
                                placeholder="전투력 (예: 250.5M)" placeholderTextColor="#64748b" value={formData.power}
                                onChangeText={(t) => setFormData({ ...formData, power: t })}
                                className="bg-slate-800 p-5 rounded-2xl text-white font-bold border border-slate-700"
                            />
                            <TextInput
                                placeholder="용광로 레벨 (예: Lv.30)" placeholderTextColor="#64748b" value={formData.furnace}
                                onChangeText={(t) => setFormData({ ...formData, furnace: t })}
                                className="bg-slate-800 p-5 rounded-2xl text-white font-bold border border-slate-700"
                            />
                            <TextInput
                                placeholder="영웅 조합 (예: 플린트/몰리/재시)" placeholderTextColor="#64748b" value={formData.heroCombo}
                                onChangeText={(t) => setFormData({ ...formData, heroCombo: t })}
                                className="bg-slate-800 p-5 rounded-2xl text-white font-bold border border-slate-700"
                            />
                            <View className="flex-row space-x-2">
                                {['전사', '지휘관', '장로', '부맹주', '맹주'].map((r) => (
                                    <TouchableOpacity
                                        key={r} onPress={() => setFormData({ ...formData, role: r })}
                                        className={`px-3 py-2 rounded-lg border ${formData.role === r ? 'bg-brand-accent border-brand-accent' : 'bg-slate-800 border-slate-700'}`}
                                    >
                                        <Text className={`text-[10px] font-black ${formData.role === r ? 'text-brand-dark' : 'text-slate-300'}`}>{r}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                        <View className="flex-row space-x-3">
                            <TouchableOpacity onPress={() => setEditModalVisible(false)} className="flex-1 bg-slate-800 py-4 rounded-2xl">
                                <Text className="text-slate-400 text-center font-black">취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={saveAttendee} className="flex-1 bg-brand-accent py-4 rounded-2xl">
                                <Text className="text-brand-dark text-center font-black">저장</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
