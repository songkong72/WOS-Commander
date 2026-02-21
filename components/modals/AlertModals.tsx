import React, { memo } from 'react';
import { View, Text, Modal, TouchableOpacity, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';

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
            case 'confirm': return { name: 'help-circle', color: '#3b82f6' };
            default: return { name: 'information-circle', color: '#3b82f6' };
        }
    };

    const icon = getIcon();

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 bg-black/60 items-center justify-center p-8">
                <View className={`w-full max-w-xs rounded-[32px] p-8 items-center shadow-2xl border ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-transparent'}`}>
                    <View className="w-16 h-16 rounded-full items-center justify-center mb-6" style={{ backgroundColor: `${icon.color}15` }}>
                        <Ionicons name={icon.name as any} size={36} color={icon.color} />
                    </View>
                    <Text className={`text-xl font-bold text-center mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</Text>
                    <Text className={`text-sm text-center mb-8 leading-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{message}</Text>

                    <View className="w-full gap-3">
                        {type === 'confirm' ? (
                            <View className="flex-row gap-3 w-full">
                                <TouchableOpacity onPress={onClose} className={`flex-1 py-4 rounded-2xl items-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                    <Text className={`font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('common.cancel')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => { onConfirm?.(); onClose(); }} className="flex-1 py-4 rounded-2xl items-center bg-[#3182F6] shadow-lg">
                                    <Text className="text-white font-bold">{confirmLabel || t('common.confirm')}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={onClose} className="w-full py-4 rounded-2xl items-center bg-[#3182F6] shadow-lg">
                                <Text className="text-white font-bold">{t('common.confirm')}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
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
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 bg-black/60 items-center justify-center p-8">
                <View className={`w-full max-w-xs rounded-[32px] p-8 items-center shadow-2xl border ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-transparent'}`}>
                    <View className="w-16 h-16 rounded-full bg-amber-500/15 items-center justify-center mb-6">
                        <Ionicons name="warning" size={36} color="#f59e0b" />
                    </View>
                    <Text className={`text-xl font-bold text-center mb-3 ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('events.warning_title')}</Text>
                    <Text className={`text-sm text-center mb-8 leading-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('events.warning_message')}</Text>

                    <View className="flex-row gap-3 w-full">
                        <TouchableOpacity onPress={onCancel} className={`flex-1 py-4 rounded-2xl items-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                            <Text className={`font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('common.cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={onConfirm} className="flex-1 py-4 rounded-2xl items-center bg-[#3182F6] shadow-lg">
                            <Text className="text-white font-bold">{t('common.confirm')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
});
