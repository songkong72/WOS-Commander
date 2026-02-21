import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    TextInput,
    Switch
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface NoticeEditModalProps {
    isVisible: boolean;
    onClose: () => void;
    isDark: boolean;
    editNoticeContent: string;
    setEditNoticeContent: (v: string) => void;
    editNoticeVisible: boolean;
    setEditNoticeVisible: (v: boolean) => void;
    handleSaveNotice: () => void;
}

export const NoticeEditModal = ({
    isVisible,
    onClose,
    isDark,
    editNoticeContent,
    setEditNoticeContent,
    editNoticeVisible,
    setEditNoticeVisible,
    handleSaveNotice
}: NoticeEditModalProps) => {
    const { t } = useTranslation();

    return (
        <Modal
            visible={isVisible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/80 items-center justify-center p-6">
                <BlurView intensity={40} className="absolute inset-0" />
                <View className={`w-full max-w-md rounded-[32px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'}`}>
                    <View className={`px-5 py-4 border-b ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                        <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center">
                                <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-blue-500/10' : 'bg-blue-50'}`}>
                                    <Ionicons name="create" size={24} color="#3b82f6" />
                                </View>
                                <View>
                                    <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('admin.noticeSetting')}</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={onClose} className={`w-9 h-9 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <Ionicons name="close" size={22} color={isDark ? "#94a3b8" : "#64748b"} />
                            </TouchableOpacity>
                        </View>
                    </View>
                    <View className={`mx-5 mt-5 mb-1 p-5 rounded-[32px] ${isDark ? 'bg-slate-950/50 border border-slate-700/50' : 'bg-slate-50 border border-slate-200'}`}>
                        <TextInput
                            multiline
                            numberOfLines={12}
                            value={editNoticeContent}
                            onChangeText={setEditNoticeContent}
                            className={`w-full font-bold text-base ${isDark ? 'text-white' : 'text-slate-900'}`}
                            placeholder={t('admin.noticePlaceholder')}
                            placeholderTextColor={isDark ? "#334155" : "#94a3b8"}
                            style={{ textAlignVertical: 'top', minHeight: 400 }}
                        />
                    </View>

                    <View className="flex-row items-center justify-between mt-4 px-6">
                        <View className="flex-1 mr-4">
                            <Text className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('admin.dashboardExposure')}</Text>
                            <Text className={`text-[11px] font-bold mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('admin.noticeActiveDesc')}</Text>
                        </View>
                        <Switch
                            value={editNoticeVisible}
                            onValueChange={setEditNoticeVisible}
                            trackColor={{ false: '#334155', true: '#3b82f6' }}
                            thumbColor={isDark ? '#fff' : '#fff'}
                            style={{ transform: [{ scale: 1.0 }] }}
                        />
                    </View>
                    <View className="flex-row gap-4 px-5 pb-6 mt-4">
                        <TouchableOpacity
                            onPress={onClose}
                            className={`flex-1 py-4 rounded-[20px] border items-center justify-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                        >
                            <Text className={`text-center font-bold text-base ${isDark ? 'text-slate-100' : 'text-slate-600'}`}>{t('common.cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleSaveNotice}
                            className="flex-[2] bg-blue-500 py-4 rounded-[20px] shadow-lg shadow-blue-500/40 items-center justify-center"
                        >
                            <Text className="text-center font-black text-white text-lg">{t('common.save')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
