import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import heroesData from '../../data/heroes.json';
import { heroImages } from '../../assets/images/heroes';

export default function HeroDetail() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const navigation = useNavigation();
    const hero = heroesData.find(h => h.id === id);
    const [activeTab, setActiveTab] = useState('story');
    const [skillType, setSkillType] = useState('exploration');

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

    if (!hero) {
        return (
            <View className="flex-1 bg-brand-dark items-center justify-center">
                <Text className="text-white">영웅 정보를 찾을 수 없습니다.</Text>
            </View>
        );
    }

    const renderHeader = () => (
        <View className="absolute top-0 left-0 right-0 z-50 flex-row justify-between items-center px-6 pt-12 pb-4">
            <TouchableOpacity
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
                className="w-10 h-10 rounded-full bg-black/40 items-center justify-center border border-white/10"
            >
                <Ionicons name="chevron-back" size={24} color="white" />
            </TouchableOpacity>
            <Text className="text-white font-black text-xl tracking-tighter">{hero.name}</Text>
            <View className="w-10 h-10" />
        </View>
    );

    const AttributeItem = ({ label, value, icon }: { label: string, value: string, icon: string }) => (
        <View className="flex-row items-center py-2 border-b border-white/5 gap-4">
            <Text className="text-slate-400 text-xs font-bold w-16">{label}</Text>
            <View className="flex-row items-center flex-1 justify-end gap-2">
                <Image source={{ uri: icon }} className="w-5 h-5" />
                <Text className="text-white text-xs font-black" numberOfLines={1}>{value}</Text>
            </View>
        </View>
    );

    const StatRow = ({ label, value, icon }: { label: string, value: string, icon?: string }) => (
        <View className="flex-row items-center justify-between py-1.5">
            <View className="flex-row items-center gap-2">
                {icon && <Image source={{ uri: icon }} className="w-4 h-4" />}
                <Text className="text-slate-400 text-[11px] font-bold">{label}</Text>
            </View>
            <Text className="text-white text-[11px] font-black">{value}</Text>
        </View>
    );

    return (
        <View className="flex-1 bg-brand-dark">
            <Stack.Screen options={{ headerShown: false }} />
            {renderHeader()}

            <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
                <View className="p-6 pt-24 flex-col md:flex-row gap-8">

                    {/* Left Sidebar / Info Section */}
                    <View className="md:w-80 mb-8 md:mb-0">
                        <View className="bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl mb-4">
                            <Image
                                source={heroImages[hero.image]}
                                className="w-full h-full"
                                resizeMode="contain"
                            />
                            <View className="bg-brand-accent py-3 items-center">
                                <Text className="text-black font-black text-lg">{hero.name}</Text>
                            </View>
                            <View className="p-4 space-y-1">
                                <AttributeItem
                                    label="희귀도"
                                    value={hero.displayInfo?.rarity || hero.rarity}
                                    icon="https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/hero_bg_021.png"
                                />
                                <AttributeItem
                                    label="등급"
                                    value={hero.displayInfo?.class || hero.type}
                                    icon={typeIcons[hero.type] || typeIcons['보병']}
                                />
                                <AttributeItem
                                    label="하위 등급"
                                    value={hero.displayInfo?.subClass || "전투"}
                                    icon={roleIcons[hero.displayInfo?.subClass || "전투"] || roleIcons['전투']}
                                />
                            </View>
                        </View>

                        <View className="bg-slate-900 rounded-3xl p-5 border border-slate-800 shadow-2xl">
                            <Text className="text-white font-black text-sm mb-4 tracking-tighter">영웅 스텟</Text>
                            <View className="mb-4">
                                <Text className="text-brand-accent text-[10px] font-black uppercase mb-2">탐험 (Exploration)</Text>
                                <StatRow label="공격" value={stats.atk.toLocaleString()} icon="https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/common_icon_attr_001.png" />
                                <StatRow label="방어" value={stats.def.toLocaleString()} icon="https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/common_icon_attr_002.png" />
                                <StatRow label="체력" value={stats.hp.toLocaleString()} icon="https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/common_icon_attr_003.png" />
                            </View>
                            <View>
                                <Text className="text-brand-accent text-[10px] font-black uppercase mb-2">원정 (Expedition)</Text>
                                <StatRow label="공격력" value={stats.expAtk} />
                                <StatRow label="방어력" value={stats.expDef} />
                            </View>
                        </View>
                    </View>

                    {/* Main Content Area */}
                    <View className="flex-1">
                        {/* Tab Buttons */}
                        <View className="flex-row flex-wrap gap-2 mb-6">
                            {['story', 'shards', 'skills', 'special'].map((tab) => (
                                <TouchableOpacity
                                    key={tab}
                                    onPress={() => setActiveTab(tab)}
                                    className={`px-6 py-3 rounded-2xl border transition-all ${activeTab === tab ? 'bg-brand-accent border-brand-accent' : 'bg-slate-800/60 border-slate-700'}`}
                                >
                                    <Text className={`font-black text-xs uppercase tracking-widest ${activeTab === tab ? 'text-black' : 'text-slate-300'}`}>
                                        {tab === 'story' ? '스토리' : tab === 'shards' ? '조각' : tab === 'skills' ? '스킬' : '스페셜'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Story Content */}
                        {activeTab === 'story' && (
                            <View className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl">
                                <Text className="text-brand-accent font-black text-lg mb-4">Hero Story</Text>
                                <Text className="text-slate-300 leading-7 text-sm">
                                    {hero.description || `${hero.name}의 상세 정보가 아직 업데이트되지 않았습니다.`}
                                </Text>
                            </View>
                        )}

                        {/* Shards Content */}
                        {activeTab === 'shards' && (
                            <View className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl">
                                <View className="flex-row items-center justify-between mb-6">
                                    <Text className="text-brand-accent font-black text-lg">성급 진화 (Shards)</Text>
                                    <Image source={{ uri: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/item_icon_500220.png' }} className="w-8 h-8" />
                                </View>
                                <View className="border border-slate-800 rounded-2xl overflow-hidden">
                                    <View className="flex-row bg-slate-800/50 py-3 px-4 border-b border-slate-800">
                                        <Text className="flex-1 text-slate-400 text-[10px] font-black uppercase">성급 | 티어</Text>
                                        <Text className="w-12 text-center text-slate-400 text-[10px] font-black uppercase">Total</Text>
                                    </View>
                                    {[
                                        { star: 1, total: 30 },
                                        { star: 2, total: 40 },
                                        { star: 3, total: 115 },
                                        { star: 4, total: 300 },
                                        { star: 5, total: 600 }
                                    ].map((row, i) => (
                                        <View key={i} className="flex-row py-4 px-4 border-b border-slate-800/50 last:border-b-0">
                                            <View className="flex-1 flex-row">
                                                {Array.from({ length: row.star }).map((_, j) => (
                                                    <Image key={j} source={{ uri: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/star.png' }} className="w-4 h-4 mr-0.5" />
                                                ))}
                                            </View>
                                            <Text className="w-12 text-center text-white text-xs font-black">{row.total}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}

                        {/* Skills Content */}
                        {activeTab === 'skills' && (
                            <View className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl">
                                <View className="flex-row gap-2 mb-6 justify-center">
                                    {['exploration', 'expedition', 'special'].filter(t => (hero.skills as any)?.[t]?.length > 0).map((t) => (
                                        <TouchableOpacity
                                            key={t}
                                            onPress={() => setSkillType(t)}
                                            className={`px-4 py-2 rounded-xl border ${skillType === t ? 'bg-white/10 border-white/20' : 'bg-slate-800/40 border-slate-700/50'}`}
                                        >
                                            <Text className={`text-[10px] font-black uppercase tracking-widest ${skillType === t ? 'text-white' : 'text-slate-300'}`}>
                                                {t === 'exploration' ? '탐험' : t === 'expedition' ? '원정' : '특성'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View className="space-y-4">
                                    {((hero.skills as any)?.[skillType] || []).map((skill: any, idx: number) => (
                                        <View key={idx} className="bg-slate-800/30 rounded-2xl p-4 flex-row gap-4 border border-white/5">
                                            <Image
                                                source={{ uri: skill.icon?.startsWith('http') ? skill.icon : `https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/04/${skill.icon}` }}
                                                className="w-16 h-16 rounded-xl"
                                                defaultSource={require('../../assets/icon.png')}
                                            />
                                            <View className="flex-1">
                                                <Text className="text-white font-black text-sm mb-1">{skill.name}</Text>
                                                <Text className="text-slate-400 text-xs leading-5">{skill.desc}</Text>
                                            </View>
                                        </View>
                                    ))}
                                    {(!(hero.skills as any)?.[skillType] || (hero.skills as any)[skillType].length === 0) && (
                                        <Text className="text-slate-500 text-center py-10">정보가 아직 등록되지 않았습니다.</Text>
                                    )}
                                </View>
                            </View>
                        )}

                        {/* Special Content */}
                        {activeTab === 'special' && (
                            <View className="bg-slate-900 rounded-3xl p-6 border border-slate-800 shadow-2xl">
                                <Text className="text-brand-accent font-black text-lg mb-6">스페셜 (전용 장비)</Text>
                                {(hero as any).equipment ? (
                                    <View className="bg-slate-800/30 rounded-3xl p-6 border border-white/5 mb-6">
                                        <View className="flex-row items-center gap-6 mb-8">
                                            <Image source={{ uri: `https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/01/${(hero as any).equipment.icon}` }} className="w-20 h-20 rounded-2xl" />
                                            <View>
                                                <Text className="text-white font-black text-lg mb-1">{(hero as any).equipment.name}</Text>
                                                <View className="flex-row items-center gap-2">
                                                    <Image source={{ uri: 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2024/03/power-e1711159096981.png' }} className="w-4 h-4" />
                                                    <Text className="text-brand-accent font-black">{(hero as any).equipment.power}</Text>
                                                </View>
                                            </View>
                                        </View>

                                        <View className="space-y-4">
                                            {(hero as any).equipment.skills.map((skill: any, idx: number) => (
                                                <View key={idx} className="flex-row gap-4 items-center">
                                                    <Image
                                                        source={{ uri: skill.icon?.startsWith('http') ? skill.icon : `https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/04/${skill.icon}` }}
                                                        className="w-12 h-12 rounded-lg"
                                                        defaultSource={require('../../assets/icon.png')}
                                                    />
                                                    <View className="flex-1">
                                                        <Text className="text-white font-black text-sm">{skill.name}</Text>
                                                        <Text className="text-slate-400 text-xs leading-5">{skill.desc}</Text>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                ) : (
                                    <Text className="text-slate-500 text-center py-10">전용 장비 정보가 아직 등록되지 않았습니다.</Text>
                                )}
                            </View>
                        )}
                    </View>
                </View>
                <View className="h-20" />
            </ScrollView>
        </View>
    );
}
