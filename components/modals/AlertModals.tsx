import React, { memo } from 'react';
import { View, Text, Modal, TouchableOpacity, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

interface CustomAlertProps {
    visible: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'confirm';
    onConfirm?: () => void;
    onClose: () => void;
    confirmLabel?: string;
    isDark: boolean;
}

export const CustomAlert = memo(({ visible, title, message, type, onConfirm, onClose, confirmLabel, isDark }: CustomAlertProps) => {
    const { t } = useTranslation();

    const getIcon = () => {
        switch (type) {
            case 'success': return { name: 'checkmark-circle', color: '#10b981' };
            case 'error': return { name: 'alert-circle', color: '#ef4444' };
            case 'warning': return { name: 'warning', color: '#f59e0b' };
            case 'confirm': return { name: 'help-circle', color: '#0ea5e9' };
            default: return { name: 'information-circle', color: '#0ea5e9' };
        }
    };

    const icon = getIcon();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 bg-black/60 items-center justify-center p-6" style={{ zIndex: 10000 }}>
                <BlurView intensity={isDark ? 30 : 60} tint={isDark ? 'dark' : 'light'} className="absolute inset-0" />
                <View className={`w-full max-w-sm rounded-[40px] border p-8 shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <View className="items-center mb-6">
                        <View className={`w-16 h-16 rounded-3xl items-center justify-center mb-4 ${type === 'success' ? 'bg-emerald-500/20' :
                            type === 'error' ? 'bg-red-500/20' :
                                type === 'warning' ? 'bg-amber-500/20' : 'bg-sky-500/20'
                            }`}>
                            <Ionicons name={icon.name as any} size={32} color={icon.color} />
                        </View>
                        <Text className={`text-2xl font-bold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</Text>
                        <Text className={`mt-4 text-center text-lg font-medium leading-7 ${isDark ? 'text-slate-100' : 'text-slate-600'}`}>{message}</Text>
                    </View>

                    {type === 'confirm' ? (
                        <View className="flex-row gap-3">
                            <TouchableOpacity
                                onPress={onClose}
                                className={`flex-1 py-4 rounded-3xl border ${isDark ? 'border-slate-800' : 'border-slate-100'}`}
                            >
                                <Text className={`text-center font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('common.cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => {
                                    onConfirm?.();
                                    onClose();
                                }}
                                className="flex-[2] bg-sky-500 py-4 rounded-3xl shadow-lg"
                            >
                                <Text className="text-center font-bold text-white">{confirmLabel || t('common.confirm')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <TouchableOpacity
                            onPress={onClose}
                            className="bg-sky-500 py-4 rounded-3xl shadow-lg"
                        >
                            <Text className="text-center font-bold text-white">{t('common.confirm')}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
});

interface WarningModalProps {
    visible: boolean;
    isDark: boolean;
    onCancel: () => void;
    onConfirm: () => void;
}

export const WarningModal = memo(({ visible, isDark, onCancel, onConfirm }: WarningModalProps) => {
    const { t } = useTranslation();

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
            <View className="flex-1 bg-black/60 items-center justify-center p-6" style={{ zIndex: 10000 }}>
                <BlurView intensity={isDark ? 30 : 60} tint={isDark ? 'dark' : 'light'} className="absolute inset-0" />
                <View className={`w-full max-w-sm rounded-[40px] border p-8 shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <View className="items-center mb-6">
                        <View className="w-16 h-16 rounded-3xl bg-amber-500/20 items-center justify-center mb-4">
                            <Ionicons name="warning" size={32} color="#f59e0b" />
                        </View>
                        <Text className={`text-2xl font-bold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('events.warning_title')}</Text>
                        <Text className={`mt-4 text-center text-lg font-medium leading-7 ${isDark ? 'text-slate-100' : 'text-slate-600'}`}>{t('events.warning_message')}</Text>
                    </View>

                    <View className="flex-row gap-3 w-full">
                        <TouchableOpacity
                            onPress={onCancel}
                            className={`flex-1 py-4 rounded-3xl border ${isDark ? 'border-slate-800' : 'border-slate-100'}`}
                        >
                            <Text className={`text-center font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('common.cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={onConfirm}
                            className="flex-[2] bg-sky-500 py-4 rounded-3xl shadow-lg"
                        >
                            <Text className="text-center font-bold text-white">{t('common.confirm')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
});

