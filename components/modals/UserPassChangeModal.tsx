import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    TextInput,
    ActivityIndicator
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { hashPassword } from '../../utils/crypto';

interface UserPassChangeModalProps {
    isVisible: boolean;
    onClose: () => void;
    isDark: boolean;
    auth: any;
    showCustomAlert: (title: string, message: string, type: 'success' | 'warning' | 'error') => void;
    setAdminMenuVisible: (v: boolean) => void;
    newPassword: string;
    setNewPassword: (v: string) => void;
    confirmPassword: string;
    setConfirmPassword: (v: string) => void;
    isChangingPassword: boolean;
    setIsChangingPassword: (v: boolean) => void;
}

export const UserPassChangeModal = ({
    isVisible,
    onClose,
    isDark,
    auth,
    showCustomAlert,
    setAdminMenuVisible,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    isChangingPassword,
    setIsChangingPassword
}: UserPassChangeModalProps) => {
    const { t } = useTranslation();
    const [showPass1, setShowPass1] = useState(false);
    const [showPass2, setShowPass2] = useState(false);

    return (
        <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 bg-black/80 items-center justify-center p-6">
                <BlurView intensity={40} className="absolute inset-0" />
                <View className={`w-full max-w-sm rounded-[40px] border p-8 shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800/60' : 'bg-white border-slate-100'}`}>
                    <View className="items-center mb-8">
                        <View className={`w-20 h-20 rounded-3xl items-center justify-center mb-4 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                            <Ionicons name="key" size={40} color="#f59e0b" />
                        </View>
                        <Text className={`text-2xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('auth.changePassword')}</Text>
                        <Text className={`mt-2 text-center text-sm font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('auth.newPasswordDesc')}</Text>
                    </View>

                    <View className="flex-col gap-4 mb-8">
                        <View>
                            <Text className={`text-[10px] font-black mb-2 ml-1 uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>New Password</Text>
                            <View className="relative">
                                <TextInput
                                    className={`w-full h-16 px-6 pr-14 rounded-2xl border font-bold ${isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-200'}`}
                                    placeholder={t('auth.enterNewPassword')}
                                    placeholderTextColor={isDark ? "#334155" : "#94a3b8"}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    secureTextEntry={!showPass1}
                                />
                                <TouchableOpacity
                                    onPressIn={() => setShowPass1(true)}
                                    onPressOut={() => setShowPass1(false)}
                                    activeOpacity={0.5}
                                    className="absolute right-4 top-4 w-8 h-8 items-center justify-center"
                                >
                                    <Ionicons name={showPass1 ? "eye-off-outline" : "eye-outline"} size={20} color={isDark ? "#475569" : "#94a3b8"} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        <View>
                            <Text className={`text-[10px] font-black mb-2 mt-4 ml-1 uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Confirm Password</Text>
                            <View className="relative">
                                <TextInput
                                    className={`w-full h-16 px-6 pr-14 rounded-2xl border font-bold ${isDark ? 'bg-slate-950 text-white border-slate-800' : 'bg-slate-50 text-slate-900 border-slate-200'}`}
                                    placeholder={t('auth.confirmPasswordLabel')}
                                    placeholderTextColor={isDark ? "#334155" : "#94a3b8"}
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry={!showPass2}
                                />
                                <TouchableOpacity
                                    onPressIn={() => setShowPass2(true)}
                                    onPressOut={() => setShowPass2(false)}
                                    activeOpacity={0.5}
                                    className="absolute right-4 top-4 w-8 h-8 items-center justify-center"
                                >
                                    <Ionicons name={showPass2 ? "eye-off-outline" : "eye-outline"} size={20} color={isDark ? "#475569" : "#94a3b8"} />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>

                    <View className="flex-row gap-4">
                        <TouchableOpacity
                            onPress={() => {
                                onClose();
                                setNewPassword('');
                                setConfirmPassword('');
                            }}
                            className={`flex-1 h-16 rounded-2xl items-center justify-center border ${isDark ? 'border-slate-800 bg-slate-800/30' : 'border-slate-50 bg-slate-50'}`}
                        >
                            <Text className={`font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('common.cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={async () => {
                                if (!auth.adminName) {
                                    showCustomAlert(t('common.error'), t('auth.loginRequired'), 'error');
                                    return;
                                }
                                if (!newPassword || !confirmPassword) {
                                    showCustomAlert(t('common.warning'), t('common.required'), 'warning');
                                    return;
                                }
                                if (newPassword !== confirmPassword) {
                                    showCustomAlert(t('common.warning'), t('auth.passwordMismatch'), 'warning');
                                    return;
                                }
                                if (newPassword.length < 4) {
                                    showCustomAlert(t('common.warning'), t('auth.passwordLength'), 'warning');
                                    return;
                                }

                                try {
                                    setIsChangingPassword(true);
                                    const hashed = await hashPassword(newPassword);
                                    const userRef = doc(db, 'users', auth.adminName!);
                                    await updateDoc(userRef, {
                                        password: hashed,
                                        updatedAt: Date.now()
                                    });

                                    showCustomAlert(t('common.success'), t('auth.changeSuccess'), 'success');
                                    onClose();
                                    setNewPassword('');
                                    setConfirmPassword('');
                                    setAdminMenuVisible(false);
                                } catch (err: any) {
                                    showCustomAlert(t('common.error'), t('auth.changeError') + ' ' + err.message, 'error');
                                } finally {
                                    setIsChangingPassword(false);
                                }
                            }}
                            disabled={isChangingPassword}
                            className="flex-[2] h-16 bg-amber-500 rounded-2xl items-center justify-center shadow-lg shadow-amber-500/30"
                        >
                            {isChangingPassword ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white font-black text-lg">{t('auth.change')}</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
