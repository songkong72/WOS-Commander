import React, { memo } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

interface DatePickerModalProps {
    visible: boolean;
    type: 'start' | 'end' | 'startDate' | null;
    currentValue: string; // "YYYY.MM.DD HH:mm" or "YYYY-MM-DD"
    viewDate: Date;
    isDark: boolean;
    onClose: () => void;
    onViewDateChange: (date: Date) => void;
    onSelect: (dateStr: string) => void;
}

const DatePickerModal = memo(({
    visible, type, currentValue, viewDate, isDark, onClose, onViewDateChange, onSelect
}: DatePickerModalProps) => {
    const { t } = useTranslation();

    if (!visible) return null;

    // Determine selected values for highlighting
    let selY: number | undefined, selM: number | undefined, selD: number | undefined;
    if (currentValue) {
        if (type === 'startDate') {
            const parts = currentValue.split('-');
            selY = parseInt(parts[0]);
            selM = parseInt(parts[1]);
            selD = parseInt(parts[2]);
        } else {
            const [dp] = currentValue.split(' ');
            const parts = dp.split('.');
            selY = parseInt(parts[0]);
            selM = parseInt(parts[1]);
            selD = parseInt(parts[2]);
        }
    }

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    const changeMonth = (offset: number) => {
        onViewDateChange(new Date(year, month + offset, 1));
    };

    const monthNames = [
        t('common.month_1'), t('common.month_2'), t('common.month_3'), t('common.month_4'),
        t('common.month_5'), t('common.month_6'), t('common.month_7'), t('common.month_8'),
        t('common.month_9'), t('common.month_10'), t('common.month_11'), t('common.month_12')
    ];

    const dayNames = [
        t('events.days.sun'), t('events.days.mon'), t('events.days.tue'), t('events.days.wed'),
        t('events.days.thu'), t('events.days.fri'), t('events.days.sat')
    ];

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View className="flex-1 bg-black/60 items-center justify-center p-6">
                <TouchableOpacity activeOpacity={1} onPress={onClose} className="absolute inset-0" />
                <View className={`w-full max-w-sm rounded-[24px] overflow-hidden border shadow-2xl ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-white border-transparent'}`}>
                    {/* Calendar Header */}
                    <View className={`flex-row items-center justify-between p-6 border-b ${isDark ? 'border-[#333D4B]' : 'border-[#E5E8EB]'}`}>
                        <Text className={`text-[20px] font-bold ${isDark ? 'text-[#F2F4F6]' : 'text-[#191F28]'}`}>{year}{t('common.year')} {monthNames[month]}</Text>
                        <View className="flex-row gap-2">
                            <TouchableOpacity onPress={() => changeMonth(-1)} className={`w-9 h-9 items-center justify-center rounded-[10px] ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}><Ionicons name="chevron-back" size={20} color={isDark ? "#B0B8C1" : "#4E5968"} /></TouchableOpacity>
                            <TouchableOpacity onPress={() => changeMonth(1)} className={`w-9 h-9 items-center justify-center rounded-[10px] ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}><Ionicons name="chevron-forward" size={20} color={isDark ? "#B0B8C1" : "#4E5968"} /></TouchableOpacity>
                        </View>
                    </View>

                    {/* Days Header */}
                    <View className="flex-row px-4 pt-4">
                        {dayNames.map((d, i) => (
                            <View key={d} className="flex-1 items-center"><Text className={`text-[11px] font-black ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-slate-500'} uppercase tracking-tighter`}>{d}</Text></View>
                        ))}
                    </View>

                    {/* Calendar Grid */}
                    <View className="flex-row flex-wrap px-4 py-4">
                        {days.map((day, idx) => {
                            const isSelected = day === selD && (month + 1) === selM && year === selY;
                            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();

                            return (
                                <TouchableOpacity
                                    key={idx}
                                    onPress={() => {
                                        if (!day) return;
                                        if (type === 'startDate') {
                                            const isoDateStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
                                            onSelect(isoDateStr);
                                        } else {
                                            const dateStr = `${year}.${(month + 1).toString().padStart(2, '0')}.${day.toString().padStart(2, '0')}`;
                                            onSelect(dateStr);
                                        }
                                    }}
                                    className="w-[14.28%] aspect-square items-center justify-center p-1"
                                >
                                    {day && (
                                        <View className={`w-full h-full rounded-[14px] items-center justify-center ${isSelected ? 'bg-[#3182F6]' : isToday ? (isDark ? 'bg-[#3182F6]/20 border border-[#3182F6]/50' : 'bg-[#E8F3FF] border border-[#3182F6]/30') : ''}`}>
                                            <Text className={`text-[14px] font-bold ${isSelected ? 'text-white' : isToday ? (isDark ? 'text-[#4F93F7]' : 'text-[#3182F6]') : isDark ? (idx % 7 === 0 ? 'text-[#FF5F5F]' : idx % 7 === 6 ? 'text-[#4F93F7]' : 'text-[#B0B8C1]') : (idx % 7 === 0 ? 'text-[#F04452]' : idx % 7 === 6 ? 'text-[#3182F6]' : 'text-[#333D4B]')}`}>
                                                {day}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <TouchableOpacity
                        onPress={onClose}
                        className={`py-4 items-center border-t active:opacity-70 ${isDark ? 'border-[#333D4B]' : 'border-[#E5E8EB]'}`}
                    >
                        <Text className={`font-bold text-[16px] ${isDark ? 'text-[#B0B8C1]' : 'text-[#4E5968]'}`}>{t('common.close')}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
});

export default DatePickerModal;
