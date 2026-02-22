import React, { memo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, ImageBackground, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { WikiEvent } from '../../data/wiki-events';

interface EventGuideModalProps {
    visible: boolean;
    event: WikiEvent | null;
    isDark: boolean;
    isAdmin: boolean;
    isEditingStrategy: boolean;
    strategyContent: string;
    onClose: () => void;
    onOpenWikiLink: (url: string) => void;
    onStartEditStrategy: () => void;
    onCancelEditStrategy: () => void;
    onSaveStrategy: () => void;
    onStrategyContentChange: (content: string) => void;
}

const EventGuideModal = memo(({
    visible, event, isDark, isAdmin, isEditingStrategy, strategyContent,
    onClose, onOpenWikiLink, onStartEditStrategy, onCancelEditStrategy, onSaveStrategy, onStrategyContentChange
}: EventGuideModalProps) => {
    const { t } = useTranslation();

    if (!event) return null;

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 bg-black/90 justify-center items-center p-6">
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={onClose}
                    className="absolute inset-0"
                />
                <View className={`w-full max-w-2xl max-h-[85%] rounded-[24px] border overflow-hidden shadow-2xl ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-transparent'}`}>
                    {/* Clean Solid Header */}
                    {event.imageUrl ? (
                        <View className={`min-h-[100px] w-full justify-end px-6 pb-5 relative ${isDark ? 'bg-[#191F28] border-b border-[#333D4B]' : 'bg-[#1e293b]'}`}>
                            <View className="flex-row items-center pt-8 pr-10">
                                <View className="w-8 h-8 rounded-xl border border-white/20 overflow-hidden mr-3 shadow-md bg-black/40">
                                    <ImageBackground source={typeof event.imageUrl === 'string' ? { uri: event.imageUrl } : event.imageUrl} className="w-full h-full" />
                                </View>
                                <Text className="text-white text-[22px] font-bold flex-shrink">{event.title}</Text>
                            </View>
                            <TouchableOpacity onPress={onClose} className="absolute top-4 right-4 bg-white/10 p-2 rounded-full">
                                <Ionicons name="close" size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View className={`h-24 w-full justify-center px-6 ${isDark ? 'bg-[#191F28]' : 'bg-white border-b border-[#E5E8EB]'}`}>
                            <Text className={`text-[22px] font-bold ${isDark ? 'text-[#F2F4F6]' : 'text-[#191F28]'}`}>{event.title}</Text>
                            <TouchableOpacity onPress={onClose} className="absolute top-4 right-4">
                                <Ionicons name="close" size={24} color={isDark ? "white" : "black"} />
                            </TouchableOpacity>
                        </View>
                    )}

                    <ScrollView className="p-6" contentContainerStyle={{ paddingBottom: 80 }}>
                        {/* Wiki Link Section */}
                        <View className={`mb-6 p-4 rounded-2xl border ${isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                            <View className="flex-row items-center justify-between mb-2">
                                <View className="flex-row items-center">
                                    <View className="w-1 h-4 bg-brand-accent rounded-full mr-2" />
                                    <Text className={`${isDark ? 'text-white' : 'text-slate-800'} font-semibold text-sm`}>{t('events.modal.wiki_title')}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => onOpenWikiLink(event.wikiUrl || '')}
                                    className="bg-[#38bdf8]/10 px-3 py-1.5 rounded-lg border border-[#38bdf8]/20"
                                >
                                    <Text className="text-[#38bdf8] text-xs font-semibold">{t('events.modal.wiki_btn')}</Text>
                                </TouchableOpacity>
                            </View>
                            <Text className={`${isDark ? 'text-slate-400' : 'text-slate-500'} text-xs leading-5`}>
                                {event.wikiUrl || t('events.modal.wiki_empty')}
                            </Text>
                        </View>

                        {/* Alliance Strategy Section */}
                        {(event.category === '연맹' || event.category === '서버') && (
                            <View className="mb-6">
                                <View className="flex-row items-center justify-between mb-3">
                                    <Text className="text-purple-400 font-bold text-sm uppercase tracking-widest">{t('events.modal.strategy_title')}</Text>
                                    {isAdmin && !isEditingStrategy && (
                                        <TouchableOpacity onPress={onStartEditStrategy} className={`p-2 rounded-lg border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}>
                                            <Text className={`${isDark ? 'text-slate-400' : 'text-slate-500'} text-[10px] font-semibold`}>{t('common.edit')}</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>

                                <View className={`rounded-2xl border ${isAdmin && isEditingStrategy ? (isDark ? 'border-purple-500/50 bg-slate-800' : 'border-purple-500/50 bg-white') : (isDark ? 'border-purple-500/20 bg-purple-500/5' : 'border-purple-200 bg-purple-50/50')} overflow-hidden`}>
                                    {isAdmin && isEditingStrategy ? (
                                        <View className="p-4">
                                            <TextInput
                                                multiline
                                                value={strategyContent}
                                                onChangeText={onStrategyContentChange}
                                                className={`${isDark ? 'text-slate-200' : 'text-slate-800'} text-sm leading-6 min-h-[100px] mb-4`}
                                                placeholder={t('events.modal.strategy_placeholder')}
                                                placeholderTextColor="#64748b"
                                                style={{ textAlignVertical: 'top' }}
                                            />
                                            <View className="flex-row justify-end gap-2">
                                                <TouchableOpacity onPress={onCancelEditStrategy} className={`px-4 py-2 rounded-xl ${isDark ? 'bg-slate-700' : 'bg-slate-100'}`}>
                                                    <Text className={`${isDark ? 'text-slate-300' : 'text-slate-600'} font-semibold text-xs`}>{t('common.cancel')}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={onSaveStrategy} className="bg-purple-600 px-4 py-2 rounded-xl shadow-md">
                                                    <Text className="text-white font-bold text-xs">{t('common.save')}</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ) : (
                                        <View className="p-5">
                                            {event.strategy ? (
                                                <Text className={`${isDark ? 'text-slate-300' : 'text-slate-700'} text-[15px] leading-7 font-medium`}>
                                                    {event.strategy}
                                                </Text>
                                            ) : (
                                                <View className="items-center py-6">
                                                    <Ionicons name="information-circle-outline" size={24} color={isDark ? "#475569" : "#cbd5e1"} />
                                                    <Text className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-slate-400'} font-medium`}>
                                                        {t('events.modal.strategy_empty')}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
});

export default EventGuideModal;
