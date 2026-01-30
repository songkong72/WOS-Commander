import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, Alert, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useAuth } from './_layout';
import { ADMIN_USERS } from '../data/admin-config';

import AsyncStorage from '@react-native-async-storage/async-storage';

export default function Home() {
    const router = useRouter();
    const { auth, login, logout } = useAuth();
    const [loginModalVisible, setLoginModalVisible] = useState(false);
    const [loginInput, setLoginInput] = useState('');

    // Load last login name on mount
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
            // Explicit Web Alert using window.alert
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.alert('설치 가능한 상태가 아니거나 이미 설치되었습니다.\n\n[설치 방법]\n1. 브라우저 주소창 우측 아이콘 확인\n2. 브라우저 메뉴(점 3개) > "앱 설치" 선택\n\n(iOS는 공유 버튼 > 홈 화면에 추가)');
            } else {
                Alert.alert(
                    '앱 설치 안내',
                    '이미 설치되었거나 지원하지 않는 브라우저일 수 있습니다.\n\n브라우저 메뉴를 확인해주세요.'
                );
            }
        }
    };
    React.useEffect(() => {
        const loadLastLogin = async () => {
            try {
                const savedName = await AsyncStorage.getItem('lastAdminName');
                if (savedName) {
                    setLoginInput(savedName);
                }
            } catch (e) {
                console.error('Failed to load last login name', e);
            }
        };
        loadLastLogin();
    }, []);

    const handleLogin = async () => {
        if (ADMIN_USERS.includes(loginInput)) {
            login(loginInput);
            setLoginModalVisible(false);

            // Save successful login name
            try {
                await AsyncStorage.setItem('lastAdminName', loginInput);
            } catch (e) {
                console.error('Failed to save login name', e);
            }

            Alert.alert('인증 성공', `${loginInput} 관리자님, 환영합니다.`);
        } else {
            Alert.alert('인증 실패', '등록된 관리자 영주 이름이 아닙니다.');
        }
    };

    return (
        <View className="flex-1 bg-brand-dark items-center justify-center">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Admin Status / Login Header */}
            <View className="absolute top-12 left-0 right-0 items-center z-10">
                {auth.isLoggedIn ? (
                    <TouchableOpacity
                        onPress={() => {
                            logout();
                            Alert.alert('로그아웃', '정상적으로 로그아웃되었습니다.');
                        }}
                        className="bg-brand-accent/20 px-4 py-2 rounded-2xl border border-brand-accent/30 flex-row items-center"
                    >
                        <View className="w-2 h-2 rounded-full bg-brand-accent mr-2" />
                        <Text className="text-brand-accent font-black text-xs">{auth.adminName} (관리자)</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        onPress={() => setLoginModalVisible(true)}
                        className="bg-slate-900/90 px-5 py-2.5 rounded-2xl border border-brand-accent/40 shadow-2xl items-center"
                    >
                        <Text className="text-brand-accent font-black text-xs">관리자 로그인</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View className="p-6 w-full max-w-md items-center">
                <Text className="text-brand-accent text-sm font-black tracking-widest mb-2 uppercase">Whiteout Survival</Text>
                <Text className="text-6xl font-black text-white mb-2 text-center shadow-2xl shadow-black">WOS 커맨더</Text>
                <View className="h-1.5 w-24 bg-brand-accent mb-8 rounded-full" />

                <Text className="text-slate-100 text-center mb-12 text-lg leading-7 font-black shadow-lg shadow-black">
                    최적의 영웅 조합과 전략으로{"\n"}빙하기의 생존을 지휘하세요
                </Text>

                <View className="px-6 space-y-4 w-full">
                    <TouchableOpacity
                        onPress={() => router.push('/hero-management')}
                        className="bg-slate-900/80 p-8 rounded-[40px] border border-slate-800 shadow-2xl flex-row items-center justify-between mb-4"
                    >
                        <View className="flex-row items-center">
                            <View className="w-16 h-16 bg-brand-accent/10 rounded-2xl items-center justify-center border border-brand-accent/20 mr-6">
                                <Text className="text-3xl">🛡️</Text>
                            </View>
                            <View>
                                <Text className="text-white text-2xl font-black tracking-tighter mb-1">영웅 관리</Text>
                                <Text className="text-slate-500 font-bold text-sm">영웅 스탯 및 스킬 분석</Text>
                            </View>
                        </View>
                        <Text className="text-brand-accent text-2xl font-black">→</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => router.push('/growth/events')}
                        className="bg-slate-900/80 p-8 rounded-[40px] border border-slate-800 shadow-2xl flex-row items-center justify-between"
                    >
                        <View className="flex-row items-center">
                            <View className="w-16 h-16 bg-blue-500/10 rounded-2xl items-center justify-center border border-blue-500/20 mr-6">
                                <Text className="text-3xl">📅</Text>
                            </View>
                            <View>
                                <Text className="text-white text-2xl font-black tracking-tighter mb-1">이벤트 스케줄</Text>
                                <Text className="text-slate-500 font-bold text-sm">위키 기반 주간 일정</Text>
                            </View>
                        </View>
                        <Text className="text-blue-400 text-2xl font-black">→</Text>
                    </TouchableOpacity>
                </View>

                <View className="flex-row mt-12 space-x-8">
                    <View className="items-center">
                        <Text className="text-white font-black text-base">집결 계산</Text>
                        <Text className="text-brand-accent/60 text-xs font-bold mt-1">COMING SOON</Text>
                    </View>
                    <View className="w-[1px] h-10 bg-slate-700" />
                    <View className="items-center">
                        <Text className="text-white font-black text-base">이벤트 달력</Text>
                        <Text className="text-brand-accent/60 text-xs font-bold mt-1">COMING SOON</Text>
                    </View>
                </View>

                {/* Install App Button */}
                <TouchableOpacity
                    onPress={handleInstallClick}
                    className="mt-8 bg-slate-800/80 px-6 py-3 rounded-full border border-slate-700 flex-row items-center space-x-2"
                >
                    <Text className="text-xl">📲</Text>
                    <Text className="text-slate-300 font-bold text-sm">앱으로 설치하기</Text>
                </TouchableOpacity>
            </View>

            <Text className="absolute bottom-10 text-slate-500 text-xs font-bold tracking-tighter">
                © 2026 WOS COMMANDER ALLIANCE. ALL RIGHTS RESERVED.
            </Text>

            {/* Login Modal */}
            <Modal visible={loginModalVisible} transparent animationType="fade">
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <BlurView intensity={30} className="absolute inset-0" />
                    <View className="bg-slate-900 w-full p-8 rounded-[40px] border border-slate-800">
                        <Text className="text-white text-2xl font-black mb-2">관리자 인증</Text>
                        <Text className="text-slate-400 text-xs font-bold mb-6">등록된 영주 이름을 입력하세요.</Text>
                        <TextInput
                            placeholder="영주 이름"
                            placeholderTextColor="#64748b"
                            value={loginInput}
                            onChangeText={setLoginInput}
                            onSubmitEditing={handleLogin}
                            returnKeyType="done"
                            autoFocus={true}
                            className="bg-slate-800 p-5 rounded-2xl text-white font-bold mb-6 border border-slate-700"
                        />
                        <View className="flex-row space-x-3">
                            <TouchableOpacity onPress={() => setLoginModalVisible(false)} className="flex-1 bg-slate-800 py-4 rounded-2xl">
                                <Text className="text-slate-400 text-center font-black">취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleLogin} className="flex-1 bg-brand-accent py-4 rounded-2xl">
                                <Text className="text-brand-dark text-center font-black">로그인</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
