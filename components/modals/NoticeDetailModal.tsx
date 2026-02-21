import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    ScrollView
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface NoticeDetailModalProps {
    isVisible: boolean;
    onClose: () => void;
    isDark: boolean;
    notice: any;
}

export const NoticeDetailModal = ({ isVisible, onClose, isDark, notice }: NoticeDetailModalProps) => {
    const { t } = useTranslation();

    return (
        <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 bg-black/80 items-center justify-center p-6">
                <BlurView intensity={40} className="absolute inset-0" />
                <View className={`w-full max-w-md rounded-[32px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                    <View className={`px-5 py-4 border-b ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-amber-500/10' : 'bg-amber-50'}`}>
                                    <Ionicons name="notifications" size={24} color="#f59e0b" />
                                </View>
                                <View>
                                    <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('dashboard.noticeDetail')}</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={onClose} className={`w-9 h-9 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <Ionicons name="close" size={22} color={isDark ? "#94a3b8" : "#64748b"} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View className={`mx-5 mt-5 mb-2 p-6 rounded-[32px] ${isDark ? 'bg-slate-950/50 border border-slate-700/50' : 'bg-emerald-50 border border-emerald-100'}`}>
                        <ScrollView style={{ maxHeight: 550 }} showsVerticalScrollIndicator={false}>
                            <Text className={`text-base font-normal leading-7 ${isDark ? 'text-slate-100' : 'text-slate-800'}`}>
                                {notice?.content || t('popup.noContent')}
                            </Text>
                        </ScrollView>
                    </View>
                    <View className="px-5 pb-4 items-center">
                        <TouchableOpacity
                            onPress={onClose}
                            className="py-2"
                        >
                            <Text className={`font-black text-lg ${isDark ? 'text-emerald-400' : 'text-slate-900'}`}>{t('common.close')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
