import React, { RefObject } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    TextInput
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface LoginModalProps {
    isVisible: boolean;
    onClose: () => void;
    isDark: boolean;
    loginInput: string;
    setLoginInput: (val: string) => void;
    passwordInput: string;
    setPasswordInput: (val: string) => void;
    loginError: string;
    setLoginError: (val: string) => void;
    showModalPw: boolean;
    setShowModalPw: (val: boolean) => void;
    loginPasswordRef: RefObject<TextInput>;
    handleLogin: (dynamicAdmins: any[]) => void;
    dynamicAdmins: any[];
}

export const LoginModal = ({
    isVisible,
    onClose,
    isDark,
    loginInput,
    setLoginInput,
    passwordInput,
    setPasswordInput,
    loginError,
    setLoginError,
    showModalPw,
    setShowModalPw,
    loginPasswordRef,
    handleLogin,
    dynamicAdmins
}: LoginModalProps) => {
    const { t } = useTranslation();

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/85 items-center justify-center p-6">
                <BlurView intensity={60} className="absolute inset-0" />
                <View className={`w-full max-w-sm p-8 rounded-[40px] border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <View className="items-center mb-8">
                        <View className={`w-16 h-16 rounded-2xl items-center justify-center mb-4 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                            <Ionicons name="shield-checkmark" size={32} color="#38bdf8" />
                        </View>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('admin.auth_title')}</Text>
                        <Text className={`mt-2 text-sm font-bold text-center ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>{t('admin.auth_desc')}</Text>
                    </View>

                    <View className="space-y-4 mb-8">
                        <View className="relative">
                            <View className="absolute left-5 top-5 z-10">
                                <Ionicons name="person" size={20} color={isDark ? "#38bdf8" : "#2563eb"} />
                            </View>
                            <TextInput
                                placeholder={t('dashboard.lordName')}
                                placeholderTextColor={isDark ? "#475569" : "#64748b"}
                                value={loginInput}
                                onChangeText={(t) => { setLoginInput(t); setLoginError(''); }}
                                autoCapitalize="none"
                                onSubmitEditing={() => loginPasswordRef.current?.focus()}
                                blurOnSubmit={false}
                                className={`p-5 pl-14 rounded-[24px] font-black border-2 text-lg ${isDark ? 'bg-slate-950 text-white border-slate-800 focus:border-blue-500/50' : 'bg-slate-50 text-slate-700 border-slate-100 focus:border-blue-500'}`}
                            />
                        </View>

                        <View className="relative mt-3">
                            <View className="absolute left-5 top-5 z-10">
                                <Ionicons name="lock-closed" size={20} color={isDark ? "#38bdf8" : "#2563eb"} />
                            </View>
                            <TextInput
                                ref={loginPasswordRef}
                                placeholder={t('dashboard.password')}
                                placeholderTextColor={isDark ? "#475569" : "#64748b"}
                                value={passwordInput}
                                onChangeText={(t) => { setPasswordInput(t); setLoginError(''); }}
                                secureTextEntry={!showModalPw}
                                autoCapitalize="none"
                                onSubmitEditing={() => handleLogin(dynamicAdmins)}
                                className={`p-5 pl-14 pr-14 rounded-[24px] font-black border-2 text-lg ${isDark ? 'bg-slate-950 text-white border-slate-800 focus:border-blue-500/50' : 'bg-slate-50 text-slate-700 border-slate-100 focus:border-blue-500'}`}
                            />
                            <TouchableOpacity
                                onPress={() => setShowModalPw(!showModalPw)}
                                className="absolute right-5 top-0 bottom-0 justify-center p-2"
                            >
                                <Ionicons name={showModalPw ? "eye-off-outline" : "eye-outline"} size={22} color="#475569" />
                            </TouchableOpacity>
                        </View>

                        {!!loginError && (
                            <View className="flex-row items-center mt-3 px-2">
                                <Ionicons name="alert-circle" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                                <Text className="text-red-500 font-black text-sm">{loginError}</Text>
                            </View>
                        )}
                    </View>

                    <View className="flex-row gap-3">
                        <TouchableOpacity
                            onPress={() => { onClose(); setLoginError(''); setPasswordInput(''); }}
                            className={`flex-1 py-4 rounded-[24px] border items-center justify-center active:scale-95 transition-all ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                        >
                            <Text className={`text-center font-bold text-lg ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('admin.cancel_btn')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => handleLogin(dynamicAdmins)}
                            className="flex-[2] bg-[#0091ff] py-4 rounded-[24px] shadow-lg shadow-blue-500/30 items-center justify-center active:scale-95 transition-all"
                        >
                            <Text className="text-white text-center font-black text-lg tracking-tight">{t('admin.login_btn')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
