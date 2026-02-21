import React, { memo, useMemo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, Switch, Platform, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { WikiEvent } from '../../data/wiki-events';
import WheelPicker from '../common/WheelPicker';
import RenderDateSelector from '../events/RenderDateSelector';

import { SINGLE_SLOT_IDS, DATE_RANGE_IDS } from '../../app/utils/eventStatus';


const FORTRESS_IDS = Array.from({ length: 12 }, (_, i) => `fortress_${i + 1}`);
const CITADEL_IDS = Array.from({ length: 4 }, (_, i) => `citadel_${i + 1}`);

// Helper
const pad = (n: number | string) => n.toString().padStart(2, '0');

interface ScheduleModalProps {
    visible: boolean;
    isDark: boolean;
    editingEvent: WikiEvent | null;
    activeTab: 1 | 2;
    setActiveTab: (tab: 1 | 2) => void;
    slots1: any[];
    slots2: any[];
    isRecurring: boolean;
    setIsRecurring: (v: boolean) => void;
    recurrenceValue: string;
    setRecurrenceValue: (v: string) => void;
    recurrenceUnit: 'day' | 'week';
    setRecurrenceUnit: (v: 'day' | 'week') => void;
    enableStartDate: boolean;
    setEnableStartDate: (v: boolean) => void;
    eventStartDate: string;
    mStart: string;
    setMStart: (v: string) => void;
    mEnd: string;
    setMEnd: (v: string) => void;
    selectedDayForSlot: string;
    setSelectedDayForSlot: (v: string) => void;
    editHour: string;
    setEditHour: (v: string) => void;
    editMinute: string;
    setEditMinute: (v: string) => void;
    editingSlotId: string | null;
    setEditingSlotId: (v: string | null) => void;
    pickerSyncKey: number;
    selectedFortressName: string;
    setSelectedFortressName: (v: string) => void;
    activeNamePickerId: string | null;
    setActiveNamePickerId: (v: string | null) => void;
    activeFortressDropdown: any | null;
    setActiveFortressDropdown: (v: any) => void;
    activeDateDropdown: any | null;
    setActiveDateDropdown: (v: any) => void;
    onClose: () => void;
    onSave: () => void;
    onDelete: () => void;
    onAddTimeSlot: () => void;
    onRemoveTimeSlot: (id: string) => void;
    onToggleDay: (day: string) => void;
    onAddFortressSlot: () => void;
    setShowDatePicker: (v: 'start' | 'end' | 'startDate' | null) => void;
    setPickerSyncKey: (v: number) => void;
    timezone?: 'LOCAL' | 'UTC';
}


const ScheduleModal = memo(({
    visible, isDark, editingEvent, activeTab, setActiveTab, slots1, slots2,
    isRecurring, setIsRecurring, recurrenceValue, setRecurrenceValue, recurrenceUnit, setRecurrenceUnit,
    enableStartDate, setEnableStartDate, eventStartDate, mStart, setMStart, mEnd, setMEnd,
    selectedDayForSlot, setSelectedDayForSlot, editHour, setEditHour, editMinute, setEditMinute,
    editingSlotId, setEditingSlotId, pickerSyncKey, selectedFortressName, setSelectedFortressName,
    activeNamePickerId, setActiveNamePickerId, activeFortressDropdown, setActiveFortressDropdown,
    activeDateDropdown, setActiveDateDropdown, onClose, onSave, onDelete, onAddTimeSlot, onRemoveTimeSlot,
    onToggleDay, onAddFortressSlot, setShowDatePicker, setPickerSyncKey, timezone = 'LOCAL'
}: ScheduleModalProps) => {

    const { t } = useTranslation();

    const dayOptionsForPicker = useMemo(() => ['일', '월', '화', '수', '목', '금', '토'].map(d => ({
        label: t(`events.days.${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][['일', '월', '화', '수', '목', '금', '토'].indexOf(d)]}`),
        value: d
    })), [t]);

    const hourOptionsForPicker = useMemo(() => Array.from({ length: 24 }, (_, i) => pad(i)), []);
    const minuteOptionsForPicker = useMemo(() => ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'], []);

    if (!visible) return null;

    const cat = editingEvent?.category || 'alliance';

    return (
        <Modal visible={visible} transparent animationType="slide">
            <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
                <Pressable className={`flex-1 max-h-[92%] rounded-t-[32px] border-t overflow-hidden ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-transparent shadow-2xl'}`} onPress={() => { }}>
                    {/* Modal Header */}
                    <View className={`h-20 flex-row items-center justify-between px-8 border-b ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-[#E5E8EB]'}`}>
                        <View className="flex-row items-center flex-1 mr-4">
                            <View className={`w-10 h-10 rounded-xl items-center justify-center mr-4 ${isDark ? 'bg-sky-500/10' : 'bg-sky-50'}`}>
                                <Ionicons name="calendar" size={20} color="#3182F6" />
                            </View>
                            <View className="flex-col items-start">
                                <Text className={`text-[10px] font-bold opacity-60 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} style={{ letterSpacing: 1.5 }}>{t('events.set_schedule')}</Text>
                                <Text className={`text-lg font-black ${isDark ? 'text-white' : 'text-slate-900'} mt-0.5`}>{editingEvent ? t(`events.${editingEvent.id}_title`, { defaultValue: editingEvent.title }) : ''}</Text>
                                <View className={`mt-1.5 px-2 py-0.5 rounded-md ${isDark ? 'bg-sky-500/20' : 'bg-sky-100'}`}>
                                    <Text className={`text-[9px] font-black ${isDark ? 'text-sky-300' : 'text-sky-700'}`}>
                                        {timezone === 'UTC' ? 'UTC' : `GMT${new Date().getTimezoneOffset() <= 0 ? '+' : '-'}${Math.abs(new Date().getTimezoneOffset() / 60)}`}
                                    </Text>
                                </View>
                            </View>


                        </View>
                        <TouchableOpacity onPress={onClose} className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}>
                            <Ionicons name="close" size={24} color={isDark ? "#B0B8C1" : "#4E5968"} />
                        </TouchableOpacity>
                    </View>

                    <View className="flex-1">
                        {editingEvent?.id === 'a_fortress' || editingEvent?.id === 'a_citadel' ? (
                            <View className="flex-1" style={{ overflow: 'visible', zIndex: (activeNamePickerId || activeFortressDropdown) ? 200 : 1 }}>
                                <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
                                    {/* Registered Fortress Slots Table */}
                                    <View className="mb-6">
                                        <View className="flex-row items-center justify-between mb-4 px-1">
                                            <Text className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-slate-200' : 'text-slate-600'}`}>{t('events.modal.registered_schedule')}</Text>
                                            <View className={`px-2 py-1 rounded-lg ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                                <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{slots1.length} {t('events.count_unit')}</Text>
                                            </View>
                                        </View>

                                        {slots1.map((slot, idx) => (
                                            <View key={slot.id} className={`flex-row items-center py-4 px-5 mb-3 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
                                                <View className="flex-1 flex-row items-center gap-3">
                                                    <View className={`px-3 py-1.5 rounded-xl ${isDark ? 'bg-sky-500/10' : 'bg-sky-50'}`}>
                                                        <Text className={`text-xs font-black ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>#{idx + 1}</Text>
                                                    </View>
                                                    <View className="flex-1">
                                                        <Text className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>{slot.name}</Text>
                                                        <Text className={`text-xs font-medium mt-0.5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t(`events.days.${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][['일', '월', '화', '수', '목', '금', '토'].indexOf(slot.day)]}`)} {slot.h}:{slot.m}</Text>
                                                    </View>
                                                </View>
                                                <TouchableOpacity onPress={() => onRemoveTimeSlot(slot.id)} className={`w-10 h-10 rounded-xl items-center justify-center ${isDark ? 'bg-rose-500/10' : 'bg-rose-50'}`}>
                                                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                                </TouchableOpacity>
                                            </View>
                                        ))}

                                        {slots1.length === 0 && (
                                            <View className={`py-12 items-center justify-center rounded-2xl border border-dashed ${isDark ? 'border-slate-800 bg-slate-900/20' : 'border-slate-200 bg-slate-50'}`}>
                                                <Ionicons name="calendar-outline" size={32} color={isDark ? "#475569" : "#cbd5e1"} />
                                                <Text className={`text-sm font-medium mt-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('events.modal.no_schedule')}</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* Recurrence Selection */}
                                    <View className={`mb-6 p-4 rounded-2xl border ${isDark ? 'bg-slate-900/40 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                        <View className="flex-row items-center justify-between">
                                            <View className="flex-row items-center">
                                                <Ionicons name="repeat-outline" size={18} color="#8b5cf6" style={{ marginRight: 8 }} />
                                                <Text className={`font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('events.recurrence')}</Text>
                                            </View>
                                            <Switch
                                                value={isRecurring}
                                                onValueChange={setIsRecurring}
                                                trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: '#8b5cf6' }}
                                                thumbColor={'white'}
                                                style={{ transform: [{ scale: 0.8 }] }}
                                            />
                                        </View>
                                        {isRecurring && (
                                            <View className="mt-4 flex-row items-center gap-3">
                                                <TextInput
                                                    value={recurrenceValue}
                                                    onChangeText={setRecurrenceValue}
                                                    keyboardType="numeric"
                                                    placeholder="1"
                                                    placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                                                    className={`w-20 p-3 rounded-xl border text-center font-bold text-base ${isDark ? 'bg-slate-900/60 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                                                />
                                                <View className={`flex-row p-1 rounded-2xl items-center flex-1 ${isDark ? 'bg-slate-900/40' : 'bg-slate-200/30'}`}>
                                                    <TouchableOpacity
                                                        onPress={() => setRecurrenceUnit('day')}
                                                        className={`flex-1 py-3 items-center rounded-xl ${recurrenceUnit === 'day' ? 'bg-indigo-600 shadow-lg' : ''}`}
                                                    >
                                                        <Text className={`text-xs font-bold ${recurrenceUnit === 'day' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-500')}`}>{t('events.recurrence_days')}</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => setRecurrenceUnit('week')}
                                                        className={`flex-1 py-3 items-center rounded-xl ${recurrenceUnit === 'week' ? 'bg-indigo-600 shadow-lg' : ''}`}
                                                    >
                                                        <Text className={`text-xs font-bold ${recurrenceUnit === 'week' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-500')}`}>{t('events.recurrence_weeks')}</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}
                                    </View>

                                    {/* Compact Form to add new slot */}
                                    <View className={`rounded-3xl p-6 border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                        <Text className={`text-sm font-black uppercase tracking-widest mb-4 ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{t('events.modal.new_schedule')}</Text>

                                        {/* Fortress/Citadel Horizontal Picker */}
                                        <View className="mb-6">
                                            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row" contentContainerStyle={{ paddingVertical: 4 }}>
                                                {(editingEvent?.id === 'a_fortress' ? FORTRESS_IDS : CITADEL_IDS).map((id) => {
                                                    const isFortress = editingEvent?.id === 'a_fortress';
                                                    const fName = isFortress ? `요새 ${id.split('_')[1]}` : `성채 ${id.split('_')[1]}`;
                                                    const isSelected = selectedFortressName === fName;
                                                    return (
                                                        <TouchableOpacity
                                                            key={id}
                                                            onPress={() => setSelectedFortressName(fName)}
                                                            className={`mr-3 px-5 py-3 rounded-2xl flex-row items-center border ${isSelected ? (isDark ? 'bg-sky-500 border-sky-400 shadow-lg' : 'bg-sky-500 border-sky-500 shadow-lg') : (isDark ? 'bg-slate-800 border-slate-700/60' : 'bg-white border-slate-200 shadow-sm')}`}
                                                        >
                                                            <Text className="mr-2 text-sm">{isFortress ? '🏰' : '🛡️'}</Text>
                                                            <Text className={`font-bold text-[14px] ${isSelected ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-600')}`}>
                                                                {isFortress ? t('events.fortress') : t('events.citadel')} {id.split('_')[1]}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    );
                                                })}
                                            </ScrollView>
                                        </View>

                                        {/* Triple Wheel Picker */}
                                        <View className="mb-6">
                                            <View className="flex-row items-center justify-between mb-3 px-1">
                                                <Text className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('events.day_of_week')}</Text>
                                                <Text className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('events.modal.set_time')}</Text>
                                            </View>
                                            <View className={`rounded-3xl border flex-row items-center justify-around ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`} style={{ height: 140, overflow: 'hidden' }}>
                                                <View pointerEvents="none" style={{ position: 'absolute', top: '50%', left: 10, right: 10, height: 40, marginTop: -20, backgroundColor: isDark ? '#38bdf812' : '#38bdf805', borderRadius: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: isDark ? '#38bdf825' : '#38bdf812', zIndex: 30 }} />

                                                <WheelPicker
                                                    options={['일', '월', '화', '수', '목', '금', '토'].map(d => ({
                                                        label: t(`events.days.${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][['일', '월', '화', '수', '목', '금', '토'].indexOf(d)]}`),
                                                        value: d
                                                    }))}
                                                    value={selectedDayForSlot}
                                                    onChange={setSelectedDayForSlot}
                                                    isDark={isDark}
                                                    width={85}
                                                    showHighlight={false}
                                                    syncKey={pickerSyncKey}
                                                    containerBgColor={isDark ? '#0f172a' : '#ffffff'}
                                                />
                                                <View className="w-[1px] h-10 bg-slate-700/20" />
                                                <WheelPicker
                                                    options={Array.from({ length: 24 }, (_, i) => pad(i))}
                                                    value={editHour}
                                                    onChange={setEditHour}
                                                    isDark={isDark}
                                                    width={75}
                                                    showHighlight={false}
                                                    syncKey={pickerSyncKey}
                                                    containerBgColor={isDark ? '#0f172a' : '#ffffff'}
                                                />
                                                <Text className={`text-xl font-black ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>:</Text>
                                                <WheelPicker
                                                    options={Array.from({ length: 6 }, (_, i) => pad(i * 10))}
                                                    value={editMinute}
                                                    onChange={setEditMinute}
                                                    isDark={isDark}
                                                    width={75}
                                                    showHighlight={false}
                                                    syncKey={pickerSyncKey}
                                                    containerBgColor={isDark ? '#0f172a' : '#ffffff'}
                                                />
                                            </View>
                                        </View>

                                        <TouchableOpacity
                                            onPress={onAddFortressSlot}
                                            className={`w-full py-4 rounded-2xl items-center flex-row justify-center shadow-lg ${editingSlotId ? 'bg-emerald-600' : 'bg-[#3182F6]'}`}
                                        >
                                            <Ionicons name={editingSlotId ? "checkmark-circle" : "add-circle-outline"} size={20} color="white" style={{ marginRight: 8 }} />
                                            <Text className="text-white font-bold text-base">
                                                {editingSlotId ? t('events.modal.update_schedule') : t('events.add_schedule_entry')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            </View>
                        ) : DATE_RANGE_IDS.includes(editingEvent?.id || '') || editingEvent?.category === '개인' ? (
                            <View className="flex-1" style={{ overflow: 'visible', zIndex: 1 }}>
                                <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 150 }} showsVerticalScrollIndicator={false}>
                                    <View className={`p-6 rounded-3xl border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                                        <View className="flex-row items-center mb-6">
                                            <View className={`w-10 h-10 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-sky-500/10' : 'bg-sky-50'}`}>
                                                <Ionicons name="calendar-number-outline" size={20} color="#3182F6" />
                                            </View>
                                            <Text className={`text-sm font-black uppercase tracking-widest ${isDark ? 'text-sky-400' : 'text-sky-600'}`}>{t('events.set_schedule')}</Text>
                                        </View>

                                        <RenderDateSelector
                                            label={t('events.start_datetime')}
                                            value={mStart}
                                            onChange={setMStart}
                                            type="start"
                                            activeDateDropdown={activeDateDropdown}
                                            setActiveDateDropdown={setActiveDateDropdown}
                                            isDark={isDark}
                                            setShowDatePicker={setShowDatePicker}
                                        />
                                        <RenderDateSelector
                                            label={t('events.end_datetime')}
                                            value={mEnd}
                                            onChange={setMEnd}
                                            type="end"
                                            activeDateDropdown={activeDateDropdown}
                                            setActiveDateDropdown={setActiveDateDropdown}
                                            isDark={isDark}
                                            setShowDatePicker={setShowDatePicker}
                                        />

                                        {/* Duration Summary */}
                                        {mStart && mEnd && (() => {
                                            const parseDate = (v: string) => {
                                                const [dp, tp] = v.split(' ');
                                                const [y, mo, d] = dp.split('.');
                                                const [hh, mm] = (tp || '00:00').split(':');
                                                return new Date(+y, +mo - 1, +d, +hh, +mm);
                                            };
                                            const s = parseDate(mStart);
                                            const e = parseDate(mEnd);
                                            const diffMs = e.getTime() - s.getTime();
                                            if (diffMs <= 0) return (
                                                <View className={`mt-2 p-4 rounded-2xl border border-dashed flex-row items-center justify-center ${isDark ? 'border-rose-500/40 bg-rose-500/5' : 'border-rose-300 bg-rose-50'}`}>
                                                    <Ionicons name="alert-circle-outline" size={18} color="#ef4444" style={{ marginRight: 8 }} />
                                                    <Text className="text-rose-500 text-sm font-bold">{t('events.error_end_before_start')}</Text>
                                                </View>
                                            );
                                            const days_diff = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                                            const hours_diff = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                            const mins_diff = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

                                            let durationText = '';
                                            if (days_diff > 0) durationText += `${days_diff}${t('events.day_unit')} `;
                                            if (hours_diff > 0) durationText += `${hours_diff}${t('events.hour_unit')} `;
                                            if (mins_diff > 0 && days_diff === 0) durationText += `${mins_diff}${t('events.min_unit')}`;

                                            return (
                                                <View className={`mt-2 p-4 rounded-2xl border flex-row items-center justify-center ${isDark ? 'bg-sky-500/10 border-sky-500/20' : 'bg-sky-50 border-sky-100'}`}>
                                                    <Ionicons name="timer-outline" size={18} color="#3182F6" style={{ marginRight: 8 }} />
                                                    <Text className={`text-sm font-bold ${isDark ? 'text-sky-300' : 'text-sky-600'}`}>{t('events.total_duration', { duration: durationText.trim() })}</Text>
                                                </View>
                                            );
                                        })()}
                                    </View>
                                </ScrollView>
                            </View>
                        ) : (
                            <View className="flex-1" style={{ overflow: 'visible', zIndex: 1 }}>
                                {/* Team Tabs for multi-team events */}
                                {editingEvent?.category === '연맹' && !SINGLE_SLOT_IDS.includes(editingEvent.id) && (
                                    <View className={`flex-row mx-5 mt-4 p-1 rounded-[18px] ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
                                        <TouchableOpacity
                                            onPress={() => setActiveTab(1)}
                                            className={`flex-1 py-3.5 items-center justify-center rounded-[14px] transition-all ${activeTab === 1 ? (isDark ? 'bg-[#333D4B] shadow-lg' : 'bg-white shadow-md border border-[#E5E8EB]') : ''}`}
                                        >
                                            <Text className={`font-black text-[14px] ${activeTab === 1 ? (isDark ? 'text-white' : 'text-[#3182F6]') : (isDark ? 'text-[#6B7684]' : 'text-[#8B95A1]')}`}>{t('events.slot1')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => setActiveTab(2)}
                                            className={`flex-1 py-3.5 items-center justify-center rounded-[14px] transition-all ${activeTab === 2 ? (isDark ? 'bg-[#333D4B] shadow-lg' : 'bg-white shadow-md border border-[#E5E8EB]') : ''}`}
                                        >
                                            <Text className={`font-black text-[14px] ${activeTab === 2 ? (isDark ? 'text-white' : 'text-[#3182F6]') : (isDark ? 'text-[#6B7684]' : 'text-[#8B95A1]')}`}>{t('events.slot2')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 80 }} showsVerticalScrollIndicator={false} className="flex-1">
                                    <View className={`rounded-[24px] p-3 border ${isDark ? 'bg-slate-900/40 border-slate-700/50' : 'bg-slate-50 border-slate-200'}`}>
                                        {/* Date and Recurrence at top */}
                                        <View className={`mb-2 p-3 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`}>
                                            <View className="flex-row items-center justify-between">
                                                <View className="flex-row items-center flex-1">
                                                    <View className={`w-8 h-8 rounded-lg items-center justify-center mr-3 ${isDark ? 'bg-sky-500/10' : 'bg-sky-50'}`}>
                                                        <Ionicons name="calendar-outline" size={16} color="#3182F6" />
                                                    </View>
                                                    <Text className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('events.specify_date')}</Text>
                                                </View>
                                                <Switch
                                                    value={enableStartDate}
                                                    onValueChange={setEnableStartDate}
                                                    trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: '#3182F6' }}
                                                    thumbColor={'white'}
                                                    style={{ transform: [{ scale: 0.8 }] }}
                                                />
                                            </View>
                                            {enableStartDate && (
                                                <TouchableOpacity
                                                    onPress={() => setShowDatePicker('startDate')}
                                                    className={`mt-4 p-4 rounded-xl border flex-row items-center justify-between ${isDark ? 'bg-slate-900/80 border-slate-600' : 'bg-slate-50 border-slate-200 shadow-inner'}`}
                                                >
                                                    <Text className={`font-mono text-lg font-bold ${eventStartDate ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                                                        {eventStartDate || 'YYYY-MM-DD'}
                                                    </Text>
                                                    <Ionicons name="calendar" size={20} color="#3182F6" />
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        <View className={`mb-2 p-3 rounded-2xl border ${isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-white border-slate-200'}`}>
                                            <View className="flex-row items-center justify-between">
                                                <View className="flex-row items-center flex-1">
                                                    <View className={`w-8 h-8 rounded-lg items-center justify-center mr-3 ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
                                                        <Ionicons name="repeat-outline" size={16} color="#6366f1" />
                                                    </View>
                                                    <View>
                                                        <Text className={`text-sm font-bold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{t('events.recurrence')}</Text>
                                                        {isRecurring && (
                                                            <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                                {t('events.recurrence_guide', {
                                                                    value: recurrenceValue,
                                                                    unit: recurrenceUnit === 'day' ? t('events.day_unit') : t('events.week_unit')
                                                                })}
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>
                                                <Switch
                                                    value={isRecurring}
                                                    onValueChange={setIsRecurring}
                                                    trackColor={{ false: isDark ? '#334155' : '#cbd5e1', true: '#6366f1' }}
                                                    thumbColor={'white'}
                                                    style={{ transform: [{ scale: 0.8 }] }}
                                                />
                                            </View>
                                            {isRecurring && (
                                                <View className="mt-4 flex-row items-center gap-3">
                                                    <TextInput
                                                        value={recurrenceValue}
                                                        onChangeText={setRecurrenceValue}
                                                        keyboardType="numeric"
                                                        placeholder="1"
                                                        placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                                                        className={`w-20 p-3.5 rounded-xl border text-center font-black text-lg ${isDark ? 'bg-slate-900/80 border-slate-600 text-white' : 'bg-white border-slate-300 text-slate-900'}`}
                                                    />
                                                    <View className={`flex-row p-1 rounded-2xl items-center flex-1 ${isDark ? 'bg-slate-900/40' : 'bg-slate-200/30'}`}>
                                                        <TouchableOpacity onPress={() => setRecurrenceUnit('day')} className={`flex-1 py-3 items-center rounded-xl ${recurrenceUnit === 'day' ? 'bg-indigo-600 shadow-md' : ''}`}>
                                                            <Text className={`text-xs font-bold ${recurrenceUnit === 'day' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-500')}`}>{t('events.recurrence_days')}</Text>
                                                        </TouchableOpacity>
                                                        <TouchableOpacity onPress={() => setRecurrenceUnit('week')} className={`flex-1 py-3 items-center rounded-xl ${recurrenceUnit === 'week' ? 'bg-indigo-600 shadow-md' : ''}`}>
                                                            <Text className={`text-xs font-bold ${recurrenceUnit === 'week' ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-500')}`}>{t('events.recurrence_weeks')}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            )}
                                        </View>

                                        {/* Registered Slots Chips */}
                                        <View className="mb-2">
                                            <View className="flex-row items-center justify-between mb-1.5 px-1">
                                                <Text className={`text-[12px] font-black uppercase tracking-[2px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('events.modal.registered_schedule')}</Text>
                                            </View>

                                            <View className="flex-row flex-wrap gap-2">
                                                {(activeTab === 1 ? slots1 : slots2).map((slot, index) => (
                                                    <TouchableOpacity
                                                        key={slot.id || index}
                                                        onPress={() => {
                                                            if (editingSlotId === slot.id) {
                                                                setEditingSlotId(null);
                                                            } else {
                                                                setEditingSlotId(slot.id);
                                                                onToggleDay(slot.day);
                                                                if (slot.time && slot.time.includes(':')) {
                                                                    const [sh, sm] = slot.time.split(':');
                                                                    setEditHour(sh);
                                                                    setEditMinute(sm);
                                                                }
                                                                setPickerSyncKey(Math.random());
                                                            }
                                                        }}
                                                        className={`flex-row items-center px-4 py-2.5 rounded-2xl border ${editingSlotId === slot.id ? (isDark ? 'bg-[#3182F6]/20 border-[#3182F6]' : 'bg-[#E8F3FF] border-[#3182F6]') : (isDark ? 'bg-[#333D4B] border-transparent' : 'bg-white border-slate-200 shadow-sm')}`}
                                                    >
                                                        <Text className={`text-sm font-black mr-2 ${editingSlotId === slot.id ? (isDark ? 'text-[#4F93F7]' : 'text-[#3182F6]') : (isDark ? 'text-[#B0B8C1]' : 'text-[#4E5968]')}`}>
                                                            {t(`events.days.${['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'daily', 'always'][['일', '월', '화', '수', '목', '금', '토', '매일', '상시'].indexOf(slot.day)]}`)}{slot.time ? ` (${slot.time})` : ''}
                                                        </Text>
                                                        <TouchableOpacity onPress={() => onRemoveTimeSlot(slot.id)}>
                                                            <Ionicons name="close-circle" size={18} color="#ef4444" />
                                                        </TouchableOpacity>
                                                    </TouchableOpacity>
                                                ))}
                                                {(activeTab === 1 ? slots1 : slots2).length === 0 && (
                                                    <View className={`w-full py-8 items-center justify-center rounded-2xl border border-dashed ${isDark ? 'border-slate-800 bg-slate-900/20' : 'border-slate-200 bg-slate-50/50'}`}>
                                                        <Text className={`text-xs font-bold ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>{t('events.modal.no_schedule')}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        </View>

                                        {/* Wheel Picker to add new slot */}
                                        {selectedDayForSlot !== '상시' ? (
                                            <View className="mb-2">
                                                <View className="flex-row items-center justify-between mb-1.5 px-1">
                                                    <Text className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('events.day_of_week')}</Text>
                                                    <Text className={`text-[11px] font-black uppercase tracking-widest ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('events.modal.set_time')}</Text>
                                                </View>
                                                <View className={`rounded-3xl border p-2 flex-row items-center justify-around ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-inner'}`} style={{ height: 120, overflow: 'hidden' }}>
                                                    <View pointerEvents="none" style={{ position: 'absolute', top: '50%', left: 10, right: 10, height: 38, marginTop: -19, backgroundColor: isDark ? '#38bdf812' : '#38bdf805', borderRadius: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: isDark ? '#38bdf825' : '#38bdf812', zIndex: 30 }} />

                                                    <WheelPicker
                                                        options={dayOptionsForPicker}
                                                        value={selectedDayForSlot}
                                                        onChange={setSelectedDayForSlot}
                                                        isDark={isDark}
                                                        width={90}
                                                        showHighlight={false}
                                                        syncKey={pickerSyncKey}
                                                        containerBgColor={isDark ? 'transparent' : '#ffffff'}
                                                    />
                                                    <View className="w-[1px] h-10 bg-slate-700/20" />
                                                    <View className="flex-row items-center">
                                                        <WheelPicker
                                                            options={hourOptionsForPicker}
                                                            value={editHour}
                                                            onChange={setEditHour}
                                                            isDark={isDark}
                                                            width={75}
                                                            showHighlight={false}
                                                            syncKey={pickerSyncKey}
                                                            containerBgColor={isDark ? 'transparent' : '#ffffff'}
                                                        />
                                                        <Text className={`text-xl font-black ${isDark ? 'text-slate-600' : 'text-slate-300'}`} style={{ marginHorizontal: -2 }}>:</Text>
                                                        <WheelPicker
                                                            options={minuteOptionsForPicker}
                                                            value={editMinute}
                                                            onChange={setEditMinute}
                                                            isDark={isDark}
                                                            width={75}
                                                            showHighlight={false}
                                                            syncKey={pickerSyncKey}
                                                            containerBgColor={isDark ? 'transparent' : '#ffffff'}
                                                        />
                                                    </View>
                                                </View>
                                            </View>
                                        ) : (
                                            <View className="mb-6 items-center justify-center p-8 rounded-3xl border border-dashed border-brand-accent/30 bg-brand-accent/5">
                                                <Ionicons name="infinite-outline" size={32} color="#3182F6" />
                                                <Text className="text-brand-accent font-bold mt-2">상시 이벤트 등록 상시 가능</Text>
                                            </View>
                                        )}

                                        <TouchableOpacity
                                            onPress={onAddTimeSlot}
                                            className={`w-full py-4 rounded-2xl items-center flex-row justify-center shadow-lg ${editingSlotId ? 'bg-emerald-600' : 'bg-[#3182F6]'}`}
                                        >
                                            <Ionicons name={editingSlotId ? "checkmark-circle" : "add-circle-outline"} size={20} color="white" style={{ marginRight: 8 }} />
                                            <Text className="text-white font-bold text-base">
                                                {editingSlotId ? t('events.modal.update_schedule') : t('events.modal.add_time_slot')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </ScrollView>
                            </View>
                        )}
                    </View>

                    {/* Bottom Action Footer */}
                    <View className={`px-8 pt-5 pb-8 border-t ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-[#E5E8EB]'}`} style={{ zIndex: 100 }}>
                        <View className="flex-row gap-4">
                            <TouchableOpacity onPress={onDelete} className={`flex-1 h-14 rounded-2xl items-center justify-center ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}>
                                <Text className={`font-black text-[16px] ${isDark ? 'text-[#B0B8C1]' : 'text-[#4E5968]'}`}>{t('common.reset')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={onSave} className="flex-[2] bg-[#3182F6] h-14 rounded-2xl items-center justify-center shadow-xl">
                                <Text className="text-white font-black text-[16px]">{t('common.save')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
});

export default ScheduleModal;
