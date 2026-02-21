import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    Pressable,
    Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface InstallModalProps {
    isVisible: boolean;
    onClose: () => void;
    isDark: boolean;
}

export const InstallModal = ({ isVisible, onClose, isDark }: InstallModalProps) => {
    const { t } = useTranslation();

    return (
        <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 bg-black/80 items-center justify-center p-6">
                <BlurView intensity={40} className="absolute inset-0" />
                <View className={`w-full max-w-md rounded-[40px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    <View className={`px-10 py-5 border-b ${isDark ? 'bg-gradient-to-r from-blue-900/20 to-indigo-900/20 border-blue-500/20' : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-100'}`}>
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className={`w-12 h-12 rounded-2xl items-center justify-center mr-4 ${isDark ? 'bg-blue-500/20' : 'bg-blue-100'}`}>
                                    <Ionicons name="download" size={24} color="#3b82f6" />
                                </View>
                                <View>
                                    <Text className={`text-[8px] font-black tracking-widest uppercase ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>PWA INSTALL</Text>
                                    <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('install.title')}</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={onClose} className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <Ionicons name="close" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View className="p-8 pb-4">
                        <View className="gap-6">
                            <View className="flex-row items-center">
                                <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100 shadow-sm'}`}>
                                    <Text className="text-lg font-black text-blue-500">1</Text>
                                </View>
                                <Text className={`flex-1 text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('install.step1')}</Text>
                            </View>
                            <View className="flex-row items-center">
                                <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100 shadow-sm'}`}>
                                    <Text className="text-lg font-black text-blue-500">2</Text>
                                </View>
                                <Text className={`flex-1 text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('install.step2')}</Text>
                            </View>
                            <View className="flex-row items-center">
                                <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${isDark ? 'bg-slate-800' : 'bg-slate-100 shadow-sm'}`}>
                                    <Text className="text-lg font-black text-blue-500">3</Text>
                                </View>
                                <Text className={`flex-1 text-lg font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('install.step3')}</Text>
                            </View>
                        </View>
                    </View>
                    <View className="px-10 pb-10 pt-0 items-center justify-center">
                        <Pressable
                            onPress={onClose}
                            style={({ hovered, pressed }: any) => [
                                {
                                    paddingHorizontal: 48,
                                    paddingVertical: 5,
                                    transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                    opacity: pressed ? 0.8 : 1,
                                    transition: 'all 0.2s',
                                    // @ts-ignore
                                    textShadow: (hovered && Platform.OS === 'web') ? '0 0 12px rgba(59, 130, 246, 0.4)' : 'none'
                                }
                            ]}
                        >
                            <Text className="text-blue-500 font-black text-lg tracking-widest">{t('common.confirm')}</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
