import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Modal,
    Pressable,
    Image,
    Platform,
    Share,
    Alert
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface QRInviteModalProps {
    isVisible: boolean;
    onClose: () => void;
    isDark: boolean;
    isMobile: boolean;
    serverId: string | null;
    allianceId: string | null;
}

export const QRInviteModal = ({ isVisible, onClose, isDark, isMobile, serverId, allianceId }: QRInviteModalProps) => {
    const { t } = useTranslation();

    // Construct the recruitment link
    // Default to the current web domain or a placeholder if not available
    const baseUrl = Platform.OS === 'web' ? window.location.origin : 'https://wos-commander.web.app';
    const inviteUrl = serverId && allianceId
        ? `${baseUrl}?server=${serverId}&alliance=${allianceId}`
        : baseUrl;

    // QR Code API (QRServer)
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(inviteUrl)}&color=020617&bgcolor=ffffff&margin=2`;

    const handleShare = async () => {
        try {
            const result = await Share.share({
                message: `🏰 [WOS Commander] ${serverId} 서버 ${allianceId} 연맹 작전 지휘실에 초대합니다!\n\n🔗 접속하기: ${inviteUrl}`,
                url: inviteUrl,
            });
        } catch (error: any) {
            Alert.alert('오류', error.message);
        }
    };

    const handleCopyUrl = () => {
        if (Platform.OS === 'web') {
            navigator.clipboard.writeText(inviteUrl);
            Alert.alert('성공', '초대 링크가 복사되었습니다.');
        }
    };

    return (
        <Modal visible={isVisible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 bg-black/80 items-center justify-center p-4">
                <BlurView intensity={40} className="absolute inset-0" />

                <View className={`w-full max-w-sm rounded-[32px] border shadow-2xl overflow-hidden ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                    {/* Header */}
                    <View className="px-6 py-5 border-b flex-row items-center justify-between border-slate-800/10">
                        <View className="flex-row items-center">
                            <View className="w-10 h-10 rounded-xl bg-amber-500/20 items-center justify-center mr-3">
                                <Ionicons name="share-social" size={20} color="#f59e0b" />
                            </View>
                            <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>{t('recruit.invite_title', { defaultValue: '연맹원 초대하기' })}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} className="w-8 h-8 rounded-full bg-slate-800 items-center justify-center">
                            <Ionicons name="close" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    <View className="p-8 items-center">
                        <Text className={`text-center mb-6 font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                            {t('recruit.invite_desc', { defaultValue: '동료 사령관에게 이 QR 코드를 보여주거나 링크를 공유하세요.' })}
                        </Text>

                        {/* QR Code Container */}
                        <View className="p-4 bg-white rounded-3xl shadow-inner mb-6">
                            <Image
                                source={{ uri: qrImageUrl }}
                                style={{ width: 220, height: 220 }}
                                resizeMode="contain"
                            />
                        </View>

                        <Text className={`text-xl font-black mb-1 ${isDark ? 'text-white' : 'text-slate-900'}`}>{allianceId}</Text>
                        <Text className={`text-sm font-bold mb-8 ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>Server #{serverId}</Text>

                        {/* Buttons */}
                        <View className="w-full gap-3">
                            <TouchableOpacity
                                onPress={handleShare}
                                className="w-full py-4 rounded-2xl bg-amber-500 flex-row items-center justify-center"
                            >
                                <Ionicons name="paper-plane" size={18} color="white" style={{ marginRight: 8 }} />
                                <Text className="text-white font-black text-base">{t('recruit.share_link', { defaultValue: '링크 공유하기' })}</Text>
                            </TouchableOpacity>

                            {Platform.OS === 'web' && (
                                <TouchableOpacity
                                    onPress={handleCopyUrl}
                                    className={`w-full py-4 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                                >
                                    <Text className={`text-center font-bold ${isDark ? 'text-white' : 'text-slate-700'}`}>{t('recruit.copy_link', { defaultValue: '초대 링크 복사' })}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Footer */}
                    <View className={`px-6 py-4 items-center ${isDark ? 'bg-slate-950/30' : 'bg-slate-50'}`}>
                        <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>WOS COMMANDER STRATEGY CENTER</Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
};
