import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import WheelPicker from '../common/WheelPicker';

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTE_OPTIONS = ['00', '10', '20', '30', '40', '50'];

interface RenderDateSelectorProps {


    label: string;
    value: string;
    onChange: (v: string) => void;
    type: 'start' | 'end';
    activeDateDropdown: { type: 'start' | 'end', field: 'y' | 'm' | 'd' | 'h' | 'min' } | null;
    setActiveDateDropdown: (v: any) => void;
    isDark: boolean;
    setShowDatePicker: (v: 'start' | 'end' | null) => void;
}

const RenderDateSelector = memo(({ label, value, onChange, type, activeDateDropdown, setActiveDateDropdown, isDark, setShowDatePicker }: RenderDateSelectorProps) => {
    const { t } = useTranslation();
    const parts = value ? value.trim().split(/\s+/) : [];

    const datePart = parts[0] || ''; // YYYY.MM.DD
    const timePart = parts[1] || '';
    const [h, m] = timePart ? timePart.split(':').map(s => s.padStart(2, '0')) : ['00', '00'];



    return (
        <View className="mb-6" style={{ zIndex: activeDateDropdown?.type === type ? 10000 : 1, elevation: activeDateDropdown?.type === type ? 50 : 0, overflow: 'visible' }}>
            <View className="flex-row items-center mb-3 ml-1">
                <Ionicons name={type === 'start' ? 'play-circle' : 'stop-circle'} size={14} color={type === 'start' ? '#10b981' : '#ef4444'} style={{ marginRight: 6 }} />
                <Text className={`text-[11px] font-black uppercase tracking-widest ${type === 'start' ? 'text-emerald-400' : 'text-rose-400'}`}>{label}</Text>
            </View>
            <View className="flex-row" style={{ overflow: 'visible', zIndex: activeDateDropdown?.type === type ? 10001 : 1 }}>
                {/* Date Selection */}
                <View style={{ flex: 3, marginRight: 8 }}>
                    <TouchableOpacity
                        onPress={() => setShowDatePicker(type)}
                        className={`${isDark ? 'bg-slate-900/60 border-slate-700/50' : 'bg-white border-slate-200'} px-3 rounded-2xl border flex-row justify-between items-center shadow-inner`}
                        style={{ height: 52 }}
                    >
                        <View className="flex-row items-center flex-1">
                            <Ionicons name="calendar" size={16} color="#38bdf8" style={{ marginRight: 6 }} />
                            <Text
                                className={`font-black ${isDark ? 'text-white' : 'text-slate-800'} flex-1`}
                                style={{ fontSize: 15 }}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.9}
                            >
                                {datePart ? datePart.replace(/\./g, '-') : t('common.select_date')}
                            </Text>

                        </View>

                        <Ionicons name="chevron-down" size={14} color="#475569" />
                    </TouchableOpacity>
                </View>

                {/* Unified Inline Time Selection */}
                <View style={{ flex: 2, height: 52, overflow: 'hidden' }} className={`rounded-2xl border shadow-inner ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-slate-50 border-slate-200'} justify-center`}>

                    <View className="flex-row items-center justify-center px-4">
                        <View className="flex-1">
                            <WheelPicker
                                options={HOUR_OPTIONS}
                                value={h}
                                onChange={(val: string) => onChange(`${datePart} ${val}:${m}`)}

                                isDark={isDark}
                                width="100%"
                                showHighlight={false}
                                containerBgColor="transparent"
                                syncKey={value}
                                lines={1}
                            />
                        </View>
                        <Text className={`text-xl font-black mx-2 z-10 opacity-50 ${isDark ? 'text-sky-400' : 'text-slate-400'}`}>:</Text>
                        <View className="flex-1">
                            <WheelPicker
                                options={MINUTE_OPTIONS}
                                value={m}
                                onChange={(val: string) => onChange(`${datePart} ${h}:${val}`)}

                                isDark={isDark}
                                width="100%"
                                showHighlight={false}
                                containerBgColor="transparent"
                                syncKey={value}
                                lines={1}
                            />
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
});

export default RenderDateSelector;
