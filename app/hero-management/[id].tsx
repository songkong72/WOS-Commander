import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, Pressable } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import heroesData from '../../data/heroes.json';
import { heroImages } from '../../assets/images/heroes';
import { skillIcons } from '../../assets/images/skill-icons';
import { useAuth, useTheme } from '../context';


const SkillImage = ({ icon, className, style }: { icon: string, className?: string, style?: any }) => {
    const [tryIndex, setTryIndex] = useState(0);
    const baseUrls = [
        'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/04/',
        'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/03/',
        'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/01/',
        'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/',
        'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/10/',
        'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/11/',
        'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/12/',
        'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/09/',
        'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/08/',
        'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/05/',
        'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/07/',
        'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/08/',
    ];

    const source = React.useMemo(() => {
        if (!icon) return require('../../assets/icon.png');

        // Check if we have a local icon mapping (e.g. for Edith)
        if (skillIcons[icon]) {
            return skillIcons[icon];
        }

        if (icon.startsWith('http')) return { uri: icon };
        if (tryIndex >= baseUrls.length) return require('../../assets/icon.png');
        return { uri: `${baseUrls[tryIndex]}${icon}` };
    }, [icon, tryIndex]);

    return (
        <Image
            source={source}
            className={className}
            style={style}
            resizeMode="contain"
            onError={() => setTryIndex(prev => prev + 1)}

        />
    );
};

import { useTranslation } from 'react-i18next';

export default function HeroDetail() {
    const { id } = useLocalSearchParams();
    const { t } = useTranslation();
    const router = useRouter();
    const navigation = useNavigation();
    const hero = heroesData.find(h => h.id === id);
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [activeTab, setActiveTab] = useState('story');
    const [skillType, setSkillType] = useState('exploration');
    const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);

    // Helper to generate consistent stats based on Generation
    const getHeroStats = (gen: string) => {
        const baseStats = { atk: 2128, def: 2220, hp: 41624 };
        let multiplier = 1.0;

        if (gen.startsWith('S')) {
            const genNum = parseInt(gen.substring(1)) || 1;
            multiplier = 1 + (genNum * 0.1);
        } else if (gen === '에픽' || gen === '상설') { // '상설' includes Epic/Rare
            multiplier = 0.8;
        } else if (gen === '레어') {
            multiplier = 0.6;
        }

        return {
            atk: Math.floor(baseStats.atk * multiplier),
            def: Math.floor(baseStats.def * multiplier),
            hp: Math.floor(baseStats.hp * multiplier),
            expAtk: (260.2 * multiplier).toFixed(1) + '%',
            expDef: (260.2 * multiplier).toFixed(1) + '%'
        };
    };

    const stats = hero ? getHeroStats(hero.gen) : { atk: 0, def: 0, hp: 0, expAtk: '0%', expDef: '0%' };

    // Mappings
    const typeIcons: { [key: string]: any } = {
        '보병': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/infantry.png',
        '창병': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/lancer.png',
        '궁병': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/marksman.png',
    };

    const roleIcons: { [key: string]: any } = {
        '전투': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/combat.png',
        '건설': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/construction.png',
        '수호': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/combat.png',
        '암살': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/combat.png',
        '지휘': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/combat.png',
        '점술': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/combat.png',
        '수집': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/construction.png',
        '생존자': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/construction.png',
        '음유시인': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/combat.png',
        '추적': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/combat.png',
        '기계': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/construction.png',
        '독약': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/combat.png',
        '공학': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/construction.png',
        '협객': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/combat.png',
        '환술': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/combat.png',
        '학자': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/construction.png',
        '용병단장': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/combat.png',
        '대장장이': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/construction.png',
        '벌목공': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/construction.png',
        '척탄병': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/combat.png',
        '음악가': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/construction.png',
        '노병': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/combat.png',
        '엔지니어': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/construction.png',
        '천재': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/construction.png',
    };

    const rarityMap: Record<string, string> = {
        '전설': 'legendary',
        '에픽': 'epic',
        '레어': 'rare',
        'SSR 전설': 'ssr',
        'SR 에픽': 'sr',
        'R 레어': 'r'
    };

    const classMap: Record<string, string> = {
        '보병': 'infantry',
        '창병': 'lancer',
        '궁병': 'marksman',
        '방패병': 'shield'
    };

    const roleMap: Record<string, string> = {
        '전투': 'combat',
        '건설': 'construction',
        '수호': 'guard',
        '암살': 'assassin',
        '지휘': 'command',
        '점술': 'divination',
        '수집': 'collection',
        '생존자': 'survivor',
        '음유시인': 'bard',
        '추적': 'tracking',
        '기계': 'mechanic',
        '독약': 'poison',
        '공학': 'engineering',
        '협객': 'mercenary',
        '환술': 'illusion',
        '학자': 'scholar',
        '용병단장': 'captain',
        '대장장이': 'smith',
        '벌목공': 'lumberjack',
        '척탄병': 'grenadier',
        '음악가': 'musician',
        '노병': 'veteran',
        '엔지니어': 'engineer',
        '천재': 'genius'
    };

    if (!hero) {
        return (
            <View className="flex-1 bg-brand-dark items-center justify-center">
                <Text className="text-white">{t('heroes.detail.not_found')}</Text>
            </View>
        );
    }

    const renderHeader = () => (
        <View className="absolute top-0 left-0 right-0 z-50 flex-row justify-between items-center px-6 pt-10 pb-2">
            <Pressable
                onPress={() => {
                    // Determine the category to return to based on hero's gen or rarity
                    const category = hero.gen || hero.rarity;
                    if (navigation.canGoBack()) {
                        router.back();
                        // Use replace with query param to set the category
                        router.setParams({ category });
                    } else {
                        router.replace(`/hero-management?category=${category}`);
                    }
                }}
                className={`w-9 h-9 rounded-full items-center justify-center border transition-all ${isDark ? 'bg-black/40 border-white/10' : 'bg-slate-100 border-slate-200 shadow-sm'}`}
                style={({ pressed, hovered }: any) => [
                    {
                        transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                        transition: 'all 0.2s',
                        cursor: 'pointer',
                        backgroundColor: hovered ? (isDark ? '#334155' : '#f1f5f9') : (isDark ? '#1e293b' : '#f8fafc'),
                    }
                ]}
            >
                <Ionicons name="arrow-back" size={20} color={isDark ? "white" : "#1e293b"} />
            </Pressable>
            <Text className={`font-bold text-lg tracking-tighter ${isDark ? 'text-white' : 'text-slate-800'}`}>{t(`heroes.names.${hero.id}`, { defaultValue: hero.name })}</Text>
            <View className="w-9 h-9" />
        </View>
    );

    const AttributeItem = ({ label, value, icon }: { label: string, value: string, icon: string }) => (
        <View className={`flex-row items-center py-2 border-b gap-4 ${isDark ? 'border-white/5' : 'border-slate-100'}`}>
            <Text className="text-slate-400 text-xs font-semibold w-16">{label}</Text>
            <View className="flex-row items-center flex-1 justify-end gap-2">
                <Image source={{ uri: icon }} className="w-5 h-5" />
                <Text className={`text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>{value}</Text>
            </View>
        </View>
    );

    const StatRow = ({ label, value, icon }: { label: string, value: string, icon?: string }) => (
        <View className="flex-row items-center justify-between py-1.5">
            <View className="flex-row items-center gap-2">
                {icon && <Image source={{ uri: icon }} className="w-4 h-4" />}
                <Text className="text-slate-400 text-[11px] font-semibold">{label}</Text>
            </View>
            <Text className={`text-[11px] font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{value}</Text>
        </View>
    );

    return (
        <View className={`flex-1 ${isDark ? 'bg-brand-dark' : 'bg-slate-50'}`}>
            <Stack.Screen options={{ headerShown: false }} />
            {renderHeader()}

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                <View className="p-6 pt-24 flex-col md:flex-row gap-8">

                    {/* Left Sidebar / Info Section */}
                    <View className="md:w-80 mb-8 md:mb-0">
                        <View className={`rounded-3xl overflow-hidden border shadow-2xl mb-4 ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                            <Image
                                source={heroImages[hero.image]}
                                className="w-full h-full"
                                resizeMode="contain"
                            />
                            <View className={`py-3 items-center ${isDark ? 'bg-[#38bdf8]' : 'bg-blue-600'}`}>
                                <Text className={`font-bold text-lg ${isDark ? 'text-black' : 'text-white'}`}>{t(`heroes.names.${hero.id}`, { defaultValue: hero.name })}</Text>
                            </View>
                            <View className="p-4 space-y-1">
                                <AttributeItem
                                    label={t('heroes.detail.rarity')}
                                    value={t(`heroes.detail.rarities.${rarityMap[hero.displayInfo?.rarity || hero.rarity] || 'legendary'}`)}
                                    icon="https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/hero_bg_021.png"
                                />
                                <AttributeItem
                                    label={t('heroes.detail.class')}
                                    value={t(`heroes.detail.classes.${classMap[hero.displayInfo?.class || hero.type] || 'infantry'}`)}
                                    icon={typeIcons[hero.type] || typeIcons['보병']}
                                />
                                <AttributeItem
                                    label={t('heroes.detail.sub_class')}
                                    value={t(`heroes.detail.roles.${roleMap[hero.displayInfo?.subClass || "전투"] || 'combat'}`)}
                                    icon={roleIcons[hero.displayInfo?.subClass || "전투"] || roleIcons['전투']}
                                />
                            </View>
                        </View>

                        <View className={`rounded-3xl p-5 border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                            <Text className={`font-bold text-sm mb-4 tracking-tighter ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('heroes.detail.stats_title')}</Text>
                            <View className="mb-4">
                                <Text className="text-brand-accent text-[10px] font-bold uppercase mb-2">{t('heroes.detail.exploration')}</Text>
                                <StatRow label={t('heroes.detail.atk')} value={stats.atk.toLocaleString()} icon="https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/common_icon_attr_001.png" />
                                <StatRow label={t('heroes.detail.def')} value={stats.def.toLocaleString()} icon="https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/common_icon_attr_002.png" />
                                <StatRow label={t('heroes.detail.hp')} value={stats.hp.toLocaleString()} icon="https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/common_icon_attr_003.png" />
                            </View>
                            <View>
                                <Text className="text-brand-accent text-[10px] font-bold uppercase mb-2">{t('heroes.detail.expedition')}</Text>
                                <StatRow label={t('heroes.detail.power')} value={stats.expAtk} />
                                <StatRow label={t('heroes.detail.def')} value={stats.expDef} />
                            </View>
                        </View>
                    </View>

                    {/* Main Content Area */}
                    <View className="flex-1">
                        {/* Tab Buttons */}
                        <View className="flex-row gap-2 mb-6">
                            {[
                                { id: 'story', label: t('heroes.detail.tabs.story'), icon: 'book-outline', color: '#fbbf24', tooltip: t('heroes.detail.tooltips.story') },
                                { id: 'shards', label: t('heroes.detail.tabs.shards'), icon: 'diamond-outline', color: '#f8fafc', tooltip: t('heroes.detail.tooltips.shards') },
                                { id: 'skills', label: t('heroes.detail.tabs.skills'), icon: 'flash-outline', color: '#22d3ee', tooltip: t('heroes.detail.tooltips.skills') }
                            ].map((tab) => (
                                <View key={tab.id} className="relative">
                                    <Pressable
                                        onPress={() => setActiveTab(tab.id)}
                                        onHoverIn={() => setHoveredTabId(tab.id)}
                                        onHoverOut={() => setHoveredTabId(null)}
                                        style={({ pressed, hovered }: any) => [
                                            {
                                                transform: [{ scale: pressed ? 0.98 : (hovered ? 1.02 : 1) }],
                                                transition: 'all 0.2s',
                                                cursor: 'pointer'
                                            }
                                        ]}
                                        className={`flex-row items-center px-4 py-3 rounded-2xl border transition-all ${activeTab === tab.id
                                            ? (isDark ? 'bg-slate-800 border-white/20 shadow-lg' : 'bg-white border-slate-200 shadow-md')
                                            : (isDark ? 'bg-slate-900/40 border-transparent opacity-60' : 'bg-slate-100/50 border-transparent opacity-50')}`}
                                    >
                                        <Ionicons
                                            name={tab.icon as any}
                                            size={18}
                                            color={activeTab === tab.id ? tab.color : (isDark ? '#94a3b8' : '#64748b')}
                                            style={{ marginRight: 8 }}
                                        />
                                        <Text className={`font-bold text-[14px] ${activeTab === tab.id ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                                            {tab.label}
                                        </Text>
                                        {activeTab === tab.id && (
                                            <View
                                                className="absolute -bottom-[1px] left-4 right-4 h-[2px] rounded-full"
                                                style={{ backgroundColor: tab.color }}
                                            />
                                        )}
                                    </Pressable>

                                    {/* Tooltip */}
                                    {hoveredTabId === tab.id && (
                                        <View
                                            className={`absolute -top-12 left-0 right-0 items-center z-[100] animate-in fade-in slide-in-from-bottom-2 duration-200`}
                                            style={{ pointerEvents: 'none' }}
                                        >
                                            <View className={`${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'} border px-3 py-2 rounded-xl shadow-xl`}>
                                                <Text className={`${isDark ? 'text-slate-200' : 'text-slate-700'} text-[11px] font-medium whitespace-nowrap`}>
                                                    {tab.tooltip}
                                                </Text>
                                                {/* Tooltip Arrow */}
                                                <View
                                                    className={`absolute -bottom-1.5 left-1/2 -ml-1.5 w-3 h-3 rotate-45 border-b border-r ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                                                />
                                            </View>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>

                        {/* Story Content */}
                        {activeTab === 'story' && (
                            <View className={`rounded-3xl p-6 border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                <Text className={`font-bold text-lg mb-4 ${isDark ? 'text-[#22d3ee]' : 'text-blue-600'}`}>{t('heroes.detail.story_title')}</Text>
                                <Text className={`leading-7 text-sm ${isDark ? 'text-slate-300' : 'text-slate-500'}`}>
                                    {t(`heroes.descriptions.${hero.id.toLowerCase()}`, { defaultValue: hero.description || `${t(`heroes.names.${hero.id.toLowerCase()}`, { defaultValue: hero.name })} ${t('heroes.detail.not_available')}` })}
                                </Text>
                            </View>
                        )}

                        {/* Shards Content */}
                        {activeTab === 'shards' && (
                            <View className={`rounded-3xl p-6 border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                <View className="flex-row items-center justify-between mb-6">
                                    <Text className={`font-bold text-lg ${isDark ? 'text-[#22d3ee]' : 'text-blue-600'}`}>{t('heroes.detail.shards_title')}</Text>
                                    <Image source={{ uri: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/item_icon_500220.png' }} className="w-8 h-8" />
                                </View>
                                <View className={`border rounded-2xl overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                    {/* ... table content remains same ... */}
                                    <View className={`py-3 px-4 border-b ${isDark ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                                        <Text className="flex-1 text-slate-400 text-[10px] font-bold uppercase">{t('heroes.detail.tier')}</Text>
                                        <Text className="w-12 text-center text-slate-400 text-[10px] font-bold uppercase">{t('heroes.detail.total')}</Text>
                                    </View>
                                    {[
                                        { star: 1, total: 30 },
                                        { star: 2, total: 40 },
                                        { star: 3, total: 115 },
                                        { star: 4, total: 300 },
                                        { star: 5, total: 600 }
                                    ].map((row, i) => (
                                        <View key={i} className={`flex-row py-4 px-4 border-b last:border-b-0 ${isDark ? 'border-slate-800/50' : 'border-slate-50'}`}>
                                            <View className="flex-1 flex-row">
                                                {Array.from({ length: row.star }).map((_, j) => (
                                                    <Image key={j} source={{ uri: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/star.png' }} className="w-4 h-4 mr-0.5" />
                                                ))}
                                            </View>
                                            <Text className={`w-12 text-center text-xs font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{row.total}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Skills Content */}
                        {activeTab === 'skills' && (
                            <View className={`rounded-3xl p-6 border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}>
                                <View className="flex-row gap-2 mb-6 justify-center">
                                    {['exploration', 'expedition', 'special'].filter(type => {
                                        if (type === 'special') {
                                            return !!((hero as any).equipment || (hero.skills as any)?.special?.length > 0);
                                        }
                                        return (hero.skills as any)?.[type]?.length > 0;
                                    }).map((type) => (
                                        <Pressable
                                            key={type}
                                            onPress={() => setSkillType(type)}
                                            className={`px-5 py-2.5 rounded-full border transition-all ${skillType === type
                                                ? (isDark ? 'bg-white border-white shadow-lg shadow-white/10' : 'bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/20')
                                                : (isDark ? 'bg-transparent border-slate-700' : 'bg-slate-50 border-slate-200')}`}
                                            style={({ pressed, hovered }: any) => [
                                                {
                                                    transform: [{ scale: pressed ? 0.95 : (hovered ? 1.05 : 1) }],
                                                    transition: 'all 0.2s',
                                                    cursor: 'pointer'
                                                }
                                            ]}
                                        >
                                            <Text className={`text-[11px] font-bold uppercase tracking-widest ${skillType === type ? (isDark ? 'text-slate-900' : 'text-white') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                                                {t(`heroes.detail.${type}`)}
                                            </Text>
                                        </Pressable>
                                    ))}
                                </View>

                                {skillType === 'special' ? (
                                    <View>
                                        <Text className="text-[#22d3ee] font-bold text-lg mb-6">{t('heroes.detail.equipment_title')}</Text>

                                        {(() => {
                                            const stats = (hero as any).skills?.special?.[0]?.equipment?.stats || (hero as any).equipment?.stats;
                                            if (stats) {
                                                return (
                                                    <View className="mb-8">
                                                        <Text className="text-white font-bold text-sm mb-3 pl-1">{t('heroes.detail.stats_title')}</Text>
                                                        <View className="flex-col md:flex-row gap-4">
                                                            <View className={`flex-1 rounded-2xl p-4 border ${isDark ? 'bg-slate-800/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                                                <View className={`py-1.5 rounded-lg mb-3 ${isDark ? 'bg-slate-900/80' : 'bg-slate-200'}`}>
                                                                    <Text className={`text-[11px] font-bold text-center ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('heroes.detail.exploration')}</Text>
                                                                </View>
                                                                <StatRow label={t('heroes.detail.atk')} value={stats.exploration.atk?.toLocaleString()} icon="https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/common_icon_attr_001.png" />
                                                                <StatRow label={t('heroes.detail.def')} value={stats.exploration.def?.toLocaleString()} icon="https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/common_icon_attr_002.png" />
                                                                <StatRow label={t('heroes.detail.hp')} value={stats.exploration.hp?.toLocaleString()} icon="https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/common_icon_attr_003.png" />
                                                            </View>
                                                            <View className={`flex-1 rounded-2xl p-4 border ${isDark ? 'bg-slate-800/50 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                                                <View className={`py-1.5 rounded-lg mb-3 ${isDark ? 'bg-slate-900/80' : 'bg-slate-200'}`}>
                                                                    <Text className={`text-[11px] font-bold text-center ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('heroes.detail.expedition')}</Text>
                                                                </View>
                                                                <StatRow label={t('heroes.detail.power')} value={stats.expedition.power} />
                                                                <StatRow label={t('heroes.detail.hp')} value={stats.expedition.hp} />
                                                            </View>
                                                        </View>
                                                    </View>
                                                );
                                            }
                                            return null;
                                        })()}

                                        {(() => {
                                            const equipmentData = (hero as any).equipment || (hero as any).skills?.special?.[0]?.equipment;

                                            if (!equipmentData) return (
                                                <Text className="text-slate-500 text-center py-10">{t('heroes.detail.not_available')}</Text>
                                            );

                                            const displayPower = equipmentData.power
                                                ? (typeof equipmentData.power === 'number'
                                                    ? equipmentData.power.toLocaleString()
                                                    : equipmentData.power)
                                                : '';

                                            return (
                                                <View className={`rounded-3xl p-6 border mb-6 ${isDark ? 'bg-slate-800/30 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                                    <View className="flex-row items-center gap-6 mb-8">
                                                        <SkillImage
                                                            icon={equipmentData.icon}
                                                            className="w-20 h-20 rounded-2xl"
                                                        />
                                                        <View>
                                                            <Text className={`font-bold text-lg mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{equipmentData.name}</Text>
                                                            <View className="flex-row items-center gap-2">
                                                                <Image source={{ uri: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/03/power-e1711159096981.png' }} className="w-5 h-5" />
                                                                <Text className="text-brand-accent font-bold">{displayPower}</Text>
                                                            </View>
                                                        </View>
                                                    </View>

                                                    <View className="space-y-4">
                                                        {equipmentData.skills.map((skill: any, idx: number) => (
                                                            <View key={idx} className="flex-row gap-4 items-center">
                                                                <SkillImage
                                                                    icon={skill.icon}
                                                                    className="w-12 h-12 rounded-lg"
                                                                />
                                                                <View className="flex-1">
                                                                    <Text className={`font-bold text-sm ${isDark ? 'text-white' : 'text-slate-800'}`}>{skill.name}</Text>
                                                                    <Text className={`text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{skill.desc}</Text>
                                                                </View>
                                                            </View>
                                                        ))}
                                                    </View>
                                                </View>
                                            );
                                        })()}
                                    </View>
                                ) : (
                                    <View className="space-y-4">
                                        {((hero.skills as any)?.[skillType] || []).map((skill: any, idx: number) => (
                                            <View key={idx} className={`rounded-2xl p-4 flex-row gap-4 border ${isDark ? 'bg-slate-800/30 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                                                <SkillImage
                                                    icon={skill.icon}
                                                    className="w-16 h-16 rounded-xl"
                                                />
                                                <View className="flex-1">
                                                    <Text className={`font-bold text-sm mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{skill.name}</Text>
                                                    <Text className={`text-xs leading-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{skill.desc}</Text>
                                                </View>
                                            </View>
                                        ))}
                                        {(!(hero.skills as any)?.[skillType] || (hero.skills as any)[skillType].length === 0) && (
                                            <Text className="text-slate-500 text-center py-10">{t('heroes.detail.not_available')}</Text>
                                        )}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                </View>
                <View className="h-20" />
            </ScrollView >
        </View >
    );
}
