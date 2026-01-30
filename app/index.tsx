import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Alert, Platform, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useAuth } from './_layout';
import { ADMIN_USERS } from '../data/admin-config';
import { useFirestoreEventSchedules } from '../hooks/useFirestoreEventSchedules';
import { INITIAL_WIKI_EVENTS } from '../data/wiki-events';
import { Ionicons } from '@expo/vector-icons';

import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Home() {
    const router = useRouter();
    const { auth, login, logout } = useAuth();
    const [loginModalVisible, setLoginModalVisible] = useState(false);
    const [loginInput, setLoginInput] = useState('');
    const { schedules, loading } = useFirestoreEventSchedules();

    // Map schedules to titles
    const displayEvents = React.useMemo(() => {
        return schedules.map(s => {
            const eventInfo = INITIAL_WIKI_EVENTS.find(e => e.id === s.eventId);
            return {
                ...s,
                title: eventInfo ? eventInfo.title : '알 수 없는 이벤트',
            };
        }).sort((a, b) => {
            const days = ['월', '화', '수', '목', '금', '토', '일'];
            const dayDiff = days.indexOf(a.day) - days.indexOf(b.day);
            if (dayDiff !== 0) return dayDiff;
            return a.time.localeCompare(b.time);
        });
    }, [schedules]);

    // PWA Install Logic
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            const handler = (e: any) => {
                e.preventDefault();
                setDeferredPrompt(e);
            };
            window.addEventListener('beforeinstallprompt', handler);
            return () => window.removeEventListener('beforeinstallprompt', handler);
        }
    }, []);

    const handleInstallClick = () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then(() => {
                setDeferredPrompt(null);
            });
        } else {
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.alert('설치 가능한 상태가 아니거나 이미 설치되었습니다.\n\n[설치 방법]\n1. 브라우저 주소창 우측 아이콘 확인\n2. 브라우저 메뉴(점 3개) > "앱 설치" 선택\n\n(iOS는 공유 버튼 > 홈 화면에 추가)');
            } else {
                Alert.alert('앱 설치 안내', '이미 설치되었거나 지원하지 않는 브라우저일 수 있습니다.');
            }
        }
    };

    React.useEffect(() => {
        const loadLastLogin = async () => {
            try {
                const savedName = await AsyncStorage.getItem('lastAdminName');
                if (savedName) setLoginInput(savedName);
            } catch (e) { }
        };
        loadLastLogin();
    }, []);

    const handleLogin = async () => {
        if (ADMIN_USERS.includes(loginInput)) {
            login(loginInput);
            setLoginModalVisible(false);
            try { await AsyncStorage.setItem('lastAdminName', loginInput); } catch (e) { }
            Alert.alert('인증 성공', `${loginInput} 관리자님, 환영합니다.`);
        } else {
            Alert.alert('인증 실패', '등록된 관리자 영주 이름이 아닙니다.');
        }
    };

    return (
        <View className="flex-1 bg-[#020617]">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Top Navigation Icons / Admin */}
            <View className="absolute top-6 right-6 flex-row items-center space-x-4 z-50">
                <TouchableOpacity className="p-2 opacity-60">
                    <Ionicons name="share-outline" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity className="p-2 opacity-60">
                    <Ionicons name="copy-outline" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity className="p-2 opacity-60">
                    <Ionicons name="download-outline" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => auth.isLoggedIn ? logout() : setLoginModalVisible(true)}
                    className="ml-2"
                >
                    <Ionicons name="settings-outline" size={24} color={auth.isLoggedIn ? "#38bdf8" : "white"} />
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 100 }} className="flex-1">
                {/* Hero Section */}
                <View className="pt-24 pb-12 items-center">
                    <Text className="text-[#38bdf8] text-xs font-black tracking-[0.2em] mb-3 uppercase">Whiteout Survival</Text>
                    <Text className="text-5xl font-black text-white mb-6 text-center">WOS 커맨더</Text>
                    <View className="h-1 w-12 bg-[#38bdf8] mb-10 rounded-full" />

                    <Text className="text-slate-300 text-center text-base font-bold leading-6 px-6">
                        최적의 영웅 조합과 전략으로{"\n"}빙하기의 생존을 지휘하세요
                    </Text>
                </View>

                {/* Grid Content */}
                <View className="px-6 flex-row flex-wrap lg:flex-nowrap justify-center lg:items-start lg:space-x-8">

                    {/* Left Column: Menu Cards */}
                    <View className="w-full lg:w-[400px] space-y-6">
                        <TouchableOpacity
                            onPress={() => router.push('/hero-management')}
                            className="bg-[#0f172a]/80 p-6 rounded-[32px] border border-slate-800/50 shadow-2xl"
                        >
                            <View className="w-14 h-14 bg-[#38bdf8]/10 rounded-2xl items-center justify-center border border-[#38bdf8]/20 mb-6">
                                <Ionicons name="shield-outline" size={28} color="#38bdf8" />
                            </View>
                            <Text className="text-white text-2xl font-black mb-1">영웅 관리</Text>
                            <Text className="text-slate-500 font-bold text-sm">영웅 스탯 및 스킬 분석</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => router.push('/growth/events')}
                            className="bg-[#0f172a]/80 p-6 rounded-[32px] border border-slate-800/50 shadow-2xl"
                        >
                            <View className="w-14 h-14 bg-blue-500/10 rounded-2xl items-center justify-center border border-blue-400/20 mb-6 font-black">
                                <Ionicons name="calendar-outline" size={28} color="#60a5fa" />
                            </View>
                            <Text className="text-white text-2xl font-black mb-1">이벤트 스케줄</Text>
                            <View className="flex-row items-center justify-between">
                                <Text className="text-slate-500 font-bold text-sm">연맹 작전 및 주간 일정</Text>
                                <Ionicons name="arrow-forward" size={20} color="#60a5fa" />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Right Column: Weekly Events List */}
                    <View className="w-full lg:w-[450px] mt-8 lg:mt-0">
                        <View className="bg-[#0f172a]/90 rounded-[40px] border border-slate-800/80 shadow-2xl overflow-hidden">
                            <View className="flex-row items-center justify-between p-7 border-b border-slate-800/50">
                                <Text className="text-white text-xl font-black">이주의 이벤트</Text>
                                <View className="p-2 bg-blue-500/10 rounded-xl">
                                    <Ionicons name="calendar" size={20} color="#3b82f6" />
                                </View>
                            </View>

                            <View className="p-4">
                                {loading ? (
                                    <Text className="text-slate-500 p-6 text-center italic font-bold">일정을 불러오는 중...</Text>
                                ) : displayEvents.length > 0 ? (
                                    displayEvents.map((event, idx) => (
                                        <View key={`${event.eventId}-${event.day}`} className={`flex-row items-center justify-between p-4 ${idx !== displayEvents.length - 1 ? 'border-b border-slate-800/30' : ''}`}>
                                            <View className="flex-row items-center flex-1">
                                                <View className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-4" />
                                                <Text className="text-slate-300 font-bold text-sm mr-2">{event.day}</Text>
                                                <Text className="text-slate-400 font-medium text-xs mr-3">{event.time}</Text>
                                                <Text className="text-white font-black text-sm flex-1" numberOfLines={1}>{event.title}</Text>
                                            </View>
                                            <Ionicons name="chevron-forward" size={14} color="#334155" />
                                        </View>
                                    ))
                                ) : (
                                    <View className="p-10 items-center">
                                        <Text className="text-slate-600 font-bold text-center">등록된 연맹 일정이 없습니다.{"\n"}관리자를 통해 일정을 등록하세요.</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </View>

                {/* Coming Soon Section */}
                <View className="flex-row mt-16 space-x-12 px-6 justify-center">
                    <View className="items-center">
                        <Text className="text-white font-black text-base">집결 계산</Text>
                        <Text className="text-[#38bdf8]/40 text-[10px] font-black mt-1">COMING SOON</Text>
                    </View>
                    <View className="w-[1px] h-10 bg-slate-800" />
                    <View className="items-center">
                        <Text className="text-white font-black text-base">이벤트 달력</Text>
                        <Text className="text-[#38bdf8]/40 text-[10px] font-black mt-1">COMING SOON</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Bottom Fixed Install Button - Solid Style */}
            <View className="absolute bottom-0 left-0 right-0 bg-[#020617] border-t border-slate-800/50 p-4 pb-8 lg:pb-4">
                <TouchableOpacity
                    onPress={handleInstallClick}
                    className="bg-[#38bdf8] h-16 rounded-2xl flex-row items-center justify-center shadow-xl shadow-[#38bdf8]/20"
                >
                    <Text className="text-2xl mr-3">📲</Text>
                    <Text className="text-brand-dark font-black text-lg">WOS 커맨더 앱으로 설치하기</Text>
                </TouchableOpacity>
            </View>

            {/* Login Modal */}
            <Modal visible={loginModalVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <BlurView intensity={30} className="absolute inset-0" />
                    <View className="bg-slate-900 w-full max-w-sm p-8 rounded-[40px] border border-slate-800">
                        <Text className="text-white text-2xl font-black mb-2">관리자 인증</Text>
                        <Text className="text-slate-400 text-xs font-bold mb-8">등록된 관리자 영주 이름을 입력하세요.</Text>
                        <TextInput
                            placeholder="영주 이름"
                            placeholderTextColor="#475569"
                            value={loginInput}
                            onChangeText={setLoginInput}
                            onSubmitEditing={handleLogin}
                            returnKeyType="done"
                            autoFocus={true}
                            className="bg-slate-900/50 p-5 rounded-2xl text-white font-bold mb-8 border border-slate-800/50"
                        />
                        <View className="flex-row space-x-3">
                            <TouchableOpacity onPress={() => setLoginModalVisible(false)} className="flex-1 bg-slate-800 py-4 rounded-2xl">
                                <Text className="text-slate-400 text-center font-black">취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleLogin} className="flex-1 bg-[#38bdf8] py-4 rounded-2xl">
                                <Text className="text-brand-dark text-center font-black">로그인</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

