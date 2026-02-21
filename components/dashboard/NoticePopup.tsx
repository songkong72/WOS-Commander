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
import { dfs, FontSizeSetting } from '../../app/utils/dynamicFontSize';

interface NoticePopupProps {
    isVisible: boolean;
    onClose: (permanent: boolean, today: boolean) => void;
    isDark: boolean;
    isMobile: boolean;
    notice: any;
    noticePopupDontShow: boolean;
    setNoticePopupDontShow: (v: boolean) => void;
    fontSize: FontSizeSetting;
}

export const NoticePopup = ({
    isVisible,
    onClose,
    isDark,
    isMobile,
    notice,
    noticePopupDontShow,
    setNoticePopupDontShow,
    fontSize = 'medium'
}: NoticePopupProps) => {
    const { t } = useTranslation();

    return (
        <Modal visible={isVisible} transparent animationType="fade" onRequestClose={() => onClose(false, false)}>
            <View className={`flex-1 bg-black/80 items-center justify-center ${isMobile ? 'p-4' : 'p-6'}`}>
                <BlurView intensity={40} className="absolute inset-0" />
                <View className={`w-full max-w-md rounded-[32px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800/60' : 'bg-white border-slate-100'}`}>
                    {/* Header */}
                    <View className={`${isMobile ? 'px-4 py-3' : 'px-5 py-4'} border-b ${isDark ? 'bg-gradient-to-r from-amber-900/10 to-orange-900/10 border-amber-500/10' : 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'}`}>
                        <View className="flex-row items-center">
                            <View className={`${isMobile ? 'w-10 h-10 mr-3' : 'w-12 h-12 mr-4'} rounded-xl items-center justify-center ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                                <Ionicons name="notifications" size={isMobile ? 20 : 24} color="#f59e0b" />
                            </View>
                            <View className="flex-1">
                                <Text className={`${isMobile ? 'text-lg' : 'text-xl'} font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('popup.announcement')}</Text>
                            </View>
                        </View>
                    </View>

                    {/* Content */}
                    <View className={`${isMobile ? 'px-4 py-4' : 'px-5 py-5'}`}>
                        <ScrollView style={{ maxHeight: isMobile ? 250 : 300 }} showsVerticalScrollIndicator={false}>
                            <Text className={`${isMobile ? dfs('text-base', fontSize) : dfs('text-lg', fontSize)} font-bold leading-7 ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                {notice?.content || t('popup.noContent')}
                            </Text>
                        </ScrollView>
                    </View>

                    {/* Options */}
                    <View className={`px-6 py-3 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                        <TouchableOpacity
                            onPress={() => setNoticePopupDontShow(!noticePopupDontShow)}
                            className="flex-row items-center mb-2"
                        >
                            <View className={`w-5 h-5 rounded-lg border-2 mr-3 items-center justify-center ${noticePopupDontShow ? 'bg-amber-500 border-amber-500' : (isDark ? 'border-slate-600' : 'border-slate-300')}`}>
                                {noticePopupDontShow && <Ionicons name="checkmark" size={12} color="white" />}
                            </View>
                            <Text className={`font-semibold text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('popup.dontShowAgain')}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Buttons */}
                    <View className="flex-row gap-3 px-6 pb-6">
                        <TouchableOpacity
                            onPress={() => onClose(false, true)}
                            className={`flex-1 py-3 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                        >
                            <Text className={`text-center font-bold text-[13px] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('popup.dontShowToday')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => onClose(noticePopupDontShow, false)}
                            className={`flex-[1.5] py-3 rounded-2xl ${isDark ? 'bg-amber-500' : 'bg-amber-500'}`}
                        >
                            <Text className="text-center font-black text-white text-base">{t('common.confirm')}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
