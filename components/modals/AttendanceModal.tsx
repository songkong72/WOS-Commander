import React, { memo, useState, useCallback } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, ActivityIndicator, Pressable, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { WikiEvent } from '../../data/wiki-events';
import { Attendee } from '../../data/mock-attendees';
import { MemberPicker, HeroPicker } from '../events/EventPickers';

interface AttendanceModalProps {
    visible: boolean;
    event: WikiEvent | null;
    groupIndex: number;
    attendees: Partial<Attendee>[];
    isSaving: boolean;
    isDark: boolean;
    isAdmin: boolean;
    members: any[];
    onClose: () => void;
    onAddRow: () => void;
    onDeleteRow: (id: string) => void;
    onUpdateField: (id: string, field: keyof Attendee, value: string) => void;
    onSave: () => void;
}

const AttendanceModal = memo(({
    visible, event, groupIndex, attendees, isSaving, isDark, isAdmin, members,
    onClose, onAddRow, onDeleteRow, onUpdateField, onSave
}: AttendanceModalProps) => {
    const { t } = useTranslation();
    const [overlayContent, setOverlayContent] = useState<React.ReactNode | null>(null);
    const [penaltyTarget, setPenaltyTarget] = useState<{ id: string, name: string } | null>(null);

    const applyPenalty = (id: string, name: string) => {
        setPenaltyTarget({ id, name });
    };

    if (!event) return null;

    const isBearOrFoundry = event.id.includes('bear') || event.id.includes('foundry') || event.id.includes('canyon');
    const isBear = event.id.includes('bear');

    return (
        <Modal visible={visible} transparent animationType="slide">
            <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
                <Pressable className="flex-1 justify-end" onPress={() => { }}>
                    <View className={`flex-1 rounded-t-[24px] border-t overflow-hidden ${isDark ? 'bg-[#191F28] border-[#333D4B] shadow-2xl' : 'bg-white border-transparent shadow-2xl'}`}>
                        <View className={`h-16 flex-row items-center justify-between px-6 border-b ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-[#E5E8EB]'}`}>
                            <View className="flex-row items-center flex-1 mr-2">
                                <Text className={`text-xl font-bold ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>
                                    {event.title}
                                </Text>
                            </View>
                            <View className="flex-row items-center">
                                {isAdmin && (
                                    <TouchableOpacity
                                        onPress={onAddRow}
                                        className={`mr-3 px-3 py-2 rounded-full border flex-row items-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}
                                    >
                                        <Ionicons name="add" size={14} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginRight: 4 }} />
                                        <Text className={`text-xs font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                            {t('events.modal.add_lord')}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={onClose} className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}>
                                    <Ionicons name="close" size={24} color={isDark ? "#B0B8C1" : "#4E5968"} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <FlatList
                            data={attendees}
                            keyExtractor={(item, index) => item.id || index.toString()}
                            renderItem={({ item: attendee, index }) => (
                                <View
                                    style={{ zIndex: attendees.length - index, elevation: attendees.length - index }}
                                    className={`mb-4 p-4 rounded-[20px] border relative ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-[#E5E8EB]'}`}
                                >
                                    <View className="flex-row items-center mb-3" style={{ zIndex: 50, elevation: 50 }}>
                                        <View className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}>
                                            <Text className={`font-bold ${isDark ? 'text-[#B0B8C1]' : 'text-[#4E5968]'}`}>{index + 1}</Text>
                                        </View>
                                        <View className="flex-1">
                                            <MemberPicker
                                                value={attendee.name || ''}
                                                onSelect={(v) => onUpdateField(attendee.id!, 'name', v)}
                                                members={members}
                                                isAdmin={isAdmin}
                                                setOverlayContent={setOverlayContent}
                                                isDark={isDark}
                                            />
                                            {attendee.penalty && (
                                                <Text className="text-[10px] text-red-500 mt-1 font-bold ml-1">
                                                    {attendee.penalty === 'NO_SHOW' ? t('events.modal.penalty_no_show') : t('events.modal.penalty_notice')}
                                                </Text>
                                            )}
                                        </View>
                                        {isAdmin && (
                                            <View className="flex-row items-center ml-2">
                                                <TouchableOpacity
                                                    onPress={() => applyPenalty(attendee.id!, attendee.name || '')}
                                                    className={`p-3 rounded-xl border mr-2 ${attendee.penalty === 'NO_SHOW' ? 'bg-red-500/20 border-red-500' : (attendee.penalty === 'NOTICE' ? 'bg-yellow-500/20 border-yellow-500' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'))}`}
                                                >
                                                    <Ionicons
                                                        name={attendee.penalty ? "skull" : "skull-outline"}
                                                        size={16}
                                                        color={attendee.penalty === 'NO_SHOW' ? '#ef4444' : (attendee.penalty === 'NOTICE' ? '#eab308' : (isDark ? '#94a3b8' : '#64748b'))}
                                                    />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => onDeleteRow(attendee.id!)} className={`p-3 rounded-xl border ${isDark ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-100'}`}>
                                                    <Ionicons name="trash-outline" size={16} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>

                                    <View className="flex-row gap-2" style={{ zIndex: 1, pointerEvents: 'auto' }}>
                                        <HeroPicker isDark={isDark} num={1} value={attendee.hero1 || ''} onSelect={(v) => onUpdateField(attendee.id!, 'hero1', v)} />
                                        <HeroPicker isDark={isDark} num={2} value={attendee.hero2 || ''} onSelect={(v) => onUpdateField(attendee.id!, 'hero2', v)} />
                                        <HeroPicker isDark={isDark} num={3} value={attendee.hero3 || ''} onSelect={(v) => onUpdateField(attendee.id!, 'hero3', v)} />
                                    </View>
                                </View>
                            )}
                            ListEmptyComponent={
                                <View className="items-center justify-center py-10 opacity-50">
                                    <Ionicons name="documents-outline" size={48} color="#94a3b8" />
                                    <Text className="text-slate-400 mt-4 font-semibold">{t('events.modal.no_attendees_registered')}</Text>
                                    <Text className="text-slate-600 text-xs mt-1">{t('events.modal.admin_add_attendees_message')}</Text>
                                </View>
                            }
                            contentContainerStyle={{ padding: 16, paddingBottom: 150 }}
                            style={{ flex: 1 }}
                            showsVerticalScrollIndicator={true}
                            indicatorStyle={isDark ? 'white' : 'black'}
                            keyboardShouldPersistTaps="handled"
                        />

                        <View className={`p-6 border-t ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                            {isAdmin ? (
                                <TouchableOpacity
                                    onPress={onSave}
                                    disabled={isSaving}
                                    className={`mt-4 w-full h-14 rounded-2xl flex-row items-center justify-center shadow-lg ${isSaving ? (isDark ? 'bg-slate-800' : 'bg-slate-200') : 'bg-blue-600'}`}
                                >
                                    {isSaving ? (
                                        <ActivityIndicator color={isDark ? "#94a3b8" : "#64748b"} />
                                    ) : (
                                        <>
                                            <Ionicons name="save-outline" size={20} color="white" style={{ marginRight: 8 }} />
                                            <Text className="text-white text-base font-bold">
                                                {(() => {
                                                    const teamLabel = isBear ? t(`events.bear${groupIndex + 1}`) : `${t('events.team_unit')}${groupIndex + 1}`;
                                                    const label = isBearOrFoundry ? `[${teamLabel}] ` : '';
                                                    const count = attendees.filter(a => a.name?.trim()).length;
                                                    return `${label}${t('events.modal.save_attendees')} (${count}${t('events.person_unit')})`;
                                                })()}
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            ) : (
                                <View className="w-full py-4 items-center">
                                    <Text className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('events.modal.admin_only_edit_attendees')}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                    {overlayContent}
                    {penaltyTarget && (
                        <View className="absolute inset-0 z-50 items-center justify-center bg-black/60">
                            <View className={`w-80 p-6 rounded-[32px] border ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`} style={{ elevation: 100 }}>
                                <View className="items-center mb-6">
                                    <View className={`w-12 h-12 rounded-full items-center justify-center mb-3 ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                        <Ionicons name="skull" size={24} color={isDark ? "#94a3b8" : "#64748b"} />
                                    </View>
                                    <Text className={`text-lg font-bold text-center ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                        {penaltyTarget.name}
                                    </Text>
                                    <Text className={`text-sm mt-1 text-center ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        {t('events.modal.select_absence_reason')}
                                    </Text>
                                </View>

                                <View className="gap-3 w-full">
                                    <TouchableOpacity
                                        onPress={() => {
                                            onUpdateField(penaltyTarget.id, 'penalty', 'NOTICE');
                                            setPenaltyTarget(null);
                                        }}
                                        className="w-full py-4 bg-yellow-500/10 border border-yellow-500/50 rounded-2xl items-center flex-row justify-center"
                                    >
                                        <Ionicons name="warning" size={18} color="#eab308" style={{ marginRight: 8 }} />
                                        <Text className="text-yellow-500 font-bold">{t('events.modal.penalty_notice')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => {
                                            onUpdateField(penaltyTarget.id, 'penalty', 'NO_SHOW');
                                            setPenaltyTarget(null);
                                        }}
                                        className="w-full py-4 bg-red-500/10 border border-red-500/50 rounded-2xl items-center flex-row justify-center"
                                    >
                                        <Ionicons name="skull" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                                        <Text className="text-red-500 font-bold">{t('events.modal.penalty_no_show')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => {
                                            onUpdateField(penaltyTarget.id, 'penalty', '');
                                            setPenaltyTarget(null);
                                        }}
                                        className={`w-full py-4 border rounded-2xl items-center flex-row justify-center ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                                    >
                                        <Ionicons name="refresh" size={18} color={isDark ? "#94a3b8" : "#64748b"} style={{ marginRight: 8 }} />
                                        <Text className={`font-bold ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{t('events.modal.reset_status')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => setPenaltyTarget(null)}
                                        className="w-full py-3 items-center mt-2"
                                    >
                                        <Text className={isDark ? 'text-slate-500' : 'text-slate-400'}>{t('common.cancel')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    )}
                </Pressable>
            </Pressable>
        </Modal>
    );
});

export default AttendanceModal;
