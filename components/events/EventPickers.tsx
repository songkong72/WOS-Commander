import React, { useState, useMemo, useEffect, useRef, useCallback, memo } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import heroesData from '../../data/heroes.json';

const HERO_NAMES = heroesData.map(h => h.name);

// --- HeroPicker ---
export const HeroPicker = memo(({ value, onSelect, num, isDark }: { value: string, onSelect: (v: string) => void, num: number, isDark: boolean }) => {
    const { t } = useTranslation();
    const [showDropdown, setShowDropdown] = useState(false);
    const [search, setSearch] = useState(value);

    const filteredHeroes = useMemo(() => HERO_NAMES.filter(name =>
        name.toLowerCase().includes(search.toLowerCase())
    ), [search]);

    useEffect(() => {
        if (value !== search) {
            setSearch(value);
        }
    }, [value]);

    return (
        <View className="flex-1 relative" style={{ zIndex: showDropdown ? 60 : 1 }}>
            <Text className={`text-[9px] font-bold mb-1.5 ml-1 uppercase ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('events.hero_placeholder', { num })}</Text>
            <TextInput
                placeholder={t('events.no_hero')}
                placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                value={search}
                onChangeText={(v) => {
                    setSearch(v);
                    onSelect(v);
                    setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                className={`p-3 rounded-xl text-xs font-semibold border ${isDark ? 'bg-slate-900/40 text-white border-slate-800' : 'bg-white text-slate-800 border-slate-200 shadow-sm'}`}
            />
            {showDropdown && filteredHeroes.length > 0 && (
                <View
                    style={{ zIndex: 9999, elevation: 9999, minHeight: 160 }}
                    className={`absolute top-16 left-0 right-0 border rounded-xl max-h-80 shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true} className="flex-1">
                        {filteredHeroes.map((name) => (
                            <TouchableOpacity
                                key={name}
                                onPress={() => {
                                    onSelect(name);
                                    setSearch(name);
                                    setShowDropdown(false);
                                }}
                                className={`p-3 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-100'}`}
                            >
                                <Text className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
});

// --- OptionPicker ---
export const OptionPicker = memo(({ value, options, onSelect, label, isDark, direction = 'down', isOpen, onToggle }: { value: string, options: string[], onSelect: (v: string) => void, label: string, isDark: boolean, direction?: 'up' | 'down', isOpen?: boolean, onToggle?: (v: boolean) => void }) => {
    const [internalShow, setInternalShow] = useState(false);
    const show = isOpen !== undefined ? isOpen : internalShow;
    const setShow = (v: boolean) => {
        if (onToggle) onToggle(v);
        setInternalShow(v);
    };

    return (
        <View className="relative w-44" style={{ zIndex: show ? 100 : 1 }}>
            <TouchableOpacity
                onPress={() => setShow(!show)}
                className={`p-3 rounded-xl border flex-row justify-between items-center ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200 shadow-sm'}`}
            >
                <Text className={`font-bold ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>{value || label}</Text>
                <Ionicons name={show ? "chevron-up-outline" : "chevron-down-outline"} size={14} color="#64748b" />
            </TouchableOpacity>
            {show && (
                <View
                    style={{ zIndex: 9999, elevation: 9999, minHeight: 160 }}
                    className={`absolute ${direction === 'up' ? 'bottom-16' : 'top-14'} left-0 right-0 rounded-2xl border max-h-64 shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true} className="flex-1">
                        {options.map(opt => (
                            <TouchableOpacity
                                key={opt}
                                onPress={() => { onSelect(opt); setShow(false); }}
                                className={`p-3 border-b ${isDark ? 'border-slate-700/50' : 'border-slate-100'} ${value === opt ? (isDark ? 'bg-sky-500/20' : 'bg-sky-50') : ''}`}
                            >
                                <Text className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>{opt}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}
        </View>
    );
});

// --- MemberPicker ---
export const MemberPicker = memo(({ value, onSelect, members, isAdmin, setOverlayContent, isDark }: { value: string, onSelect: (v: string) => void, members: any[], isAdmin: boolean, setOverlayContent: (node: React.ReactNode | null) => void, isDark: boolean }) => {
    const { t } = useTranslation();
    const [search, setSearch] = useState(value);
    const containerRef = useRef<View>(null);
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        if (value !== search) {
            setSearch(value);
        }
    }, [value]);

    const filteredMembers = useMemo(() => {
        if (!members || !Array.isArray(members)) return [];
        const safeSearch = (search || '').toLowerCase();
        return members.filter(m =>
            (m?.nickname || '').toLowerCase().includes(safeSearch) ||
            (m?.id || '').toLowerCase().includes(safeSearch)
        );
    }, [members, search]);

    const updateOverlay = useCallback(() => {
        if (!isAdmin || !isFocused || filteredMembers.length === 0) {
            setOverlayContent(null);
            return;
        }

        containerRef.current?.measure((x, y, width, height, pageX, pageY) => {
            const dropdownHeight = Math.min(filteredMembers.length * 48, 300);
            const screenHeight = Dimensions.get('window').height;
            const spaceBelow = screenHeight - (pageY + height);
            const showUp = spaceBelow < dropdownHeight && pageY > dropdownHeight;
            const topPos = showUp ? (pageY - dropdownHeight - 4) : (pageY + height + 4);

            setOverlayContent(
                <View
                    style={{
                        position: 'absolute',
                        top: topPos,
                        left: pageX,
                        width: width,
                        height: dropdownHeight,
                        zIndex: 99999,
                        elevation: 100,
                    }}
                    className={`border rounded-xl shadow-2xl overflow-hidden ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                >
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={true} className="flex-1">
                        {filteredMembers.map((m) => (
                            <TouchableOpacity
                                key={m.id}
                                onPress={() => {
                                    onSelect(m.nickname);
                                    setSearch(m.nickname);
                                    setOverlayContent(null);
                                    setIsFocused(false);
                                }}
                                className={`p-3 border-b flex-row justify-between items-center ${isDark ? 'border-slate-700/50' : 'border-slate-100'}`}
                            >
                                <View>
                                    <Text className={`text-xs font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{m.nickname}</Text>
                                    <Text className={`text-[9px] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>ID: {m.id}</Text>
                                </View>
                                <Ionicons name="add-circle-outline" size={16} color="#38bdf8" />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            );
        });
    }, [isAdmin, isFocused, filteredMembers, isDark, onSelect, setOverlayContent]);

    useEffect(() => {
        updateOverlay();
    }, [updateOverlay]);

    return (
        <View ref={containerRef} className="flex-1 relative" style={{ zIndex: 1 }}>
            <TextInput
                placeholder={t('events.member_placeholder')}
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                value={search}
                onChangeText={(v) => {
                    setSearch(v);
                    onSelect(v);
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                    setTimeout(() => {
                        setIsFocused(false);
                        setOverlayContent(null);
                    }, 200);
                }}
                editable={isAdmin}
                className={`p-3 rounded-xl font-semibold border ${isDark ? 'bg-slate-900 text-white border-slate-700' : 'bg-white text-slate-800 border-slate-200 shadow-sm'} ${!isAdmin ? 'opacity-70' : ''}`}
            />
        </View>
    );
});
