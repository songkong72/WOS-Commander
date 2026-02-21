import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, Animated, Easing, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface NoticeBannerProps {
    notice: any;
    auth: any;
    isDark: boolean;
    setNoticeDetailVisible: (v: boolean) => void;
    showCustomAlert: (title: string, desc: string, type: string) => void;
    handleOpenNotice: () => void;
}

export const NoticeBanner = ({
    notice,
    auth,
    isDark,
    setNoticeDetailVisible,
    showCustomAlert,
    handleOpenNotice,
}: NoticeBannerProps) => {
    const { t } = useTranslation();
    const noticeScrollAnim = useRef(new Animated.Value(0)).current;
    const [noticeTextWidth, setNoticeTextWidth] = useState(0);
    const [noticeContainerWidth, setNoticeContainerWidth] = useState(0);

    useEffect(() => {
        if (notice?.content && noticeTextWidth > 0 && noticeContainerWidth > 0) {
            noticeScrollAnim.setValue(noticeContainerWidth);

            const distance = noticeTextWidth + noticeContainerWidth;
            const duration = distance * 30; // 30ms per pixel, adjust for speed

            const anim = Animated.loop(
                Animated.sequence([
                    Animated.timing(noticeScrollAnim, {
                        toValue: -noticeTextWidth,
                        duration: duration,
                        easing: Easing.linear,
                        useNativeDriver: false,
                    }),
                    Animated.timing(noticeScrollAnim, {
                        toValue: noticeContainerWidth,
                        duration: 0,
                        useNativeDriver: false,
                    })
                ])
            );

            anim.start();
            return () => anim.stop();
        }
    }, [notice?.content, noticeTextWidth, noticeContainerWidth]);

    if (!notice || (!notice.visible && !auth.isLoggedIn)) {
        return null;
    }

    return (
        <View className="w-full max-w-6xl px-4 md:px-8">
            <Pressable
                onPress={() => auth.isLoggedIn ? setNoticeDetailVisible(true) : showCustomAlert(t('common.member_only_title'), t('common.member_only_alert'), 'error')}
                className={`mb-6 p-4 rounded-[28px] border-2 flex-row items-center ${notice.visible ? (isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200 shadow-md') : (isDark ? 'bg-slate-800/40 border-slate-700 border-dashed' : 'bg-slate-50 border-slate-200 border-dashed')}`}
            >
                <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 flex-shrink-0 ${notice.visible ? 'bg-amber-500/20' : 'bg-slate-700/10'}`}>
                    <Ionicons name={notice.visible ? "notifications" : "notifications-off"} size={20} color={notice.visible ? "#f59e0b" : "#94a3b8"} />
                </View>
                <View
                    className="flex-1 min-w-0 pr-2 overflow-hidden h-10 justify-center"
                    onLayout={(e) => setNoticeContainerWidth(e.nativeEvent.layout.width)}
                >
                    <Animated.View style={{ transform: [{ translateX: noticeScrollAnim }], width: noticeTextWidth + noticeContainerWidth + 50, flexDirection: 'row' }}>
                        <Text
                            className={`text-base font-black ${isDark ? 'text-white' : 'text-slate-950'}`}
                            onLayout={(e) => setNoticeTextWidth(e.nativeEvent.layout.width)}
                            numberOfLines={1}
                        >
                            {notice.content || t('dashboard.notice_empty')}
                        </Text>
                    </Animated.View>
                </View>
                {!!auth.isLoggedIn && (
                    <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleOpenNotice(); }} className="p-2.5 bg-sky-500/10 rounded-xl flex-shrink-0">
                        <Ionicons name="pencil" size={18} color="#38bdf8" />
                    </TouchableOpacity>
                )}
            </Pressable>
        </View>
    );
};
