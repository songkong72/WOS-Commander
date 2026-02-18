import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, Image, Dimensions, Platform, Pressable } from 'react-native';
import { Stack, Link, useRouter, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { useAuth, useTheme } from '../context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import heroesData from '../../data/heroes.json';

import { heroImages } from '../../assets/images/heroes';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = width > 768 ? 4 : 3;
// const ITEM_WIDTH = (width - (width > 768 ? 200 : 48)) / COLUMN_COUNT; // Unused

// Sort order: Infantry (1) > Lancer (2) > Marksman (3)
const typeOrder: { [key: string]: number } = { '보병': 1, '창병': 2, '궁병': 3 };

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
    // S15 Roles
    '개척자': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/combat.png',
    '화가': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/construction.png',
    '단장': 'https://gom-s3-user-avatar.s3.us-west-2.amazonaws.com/wp-content/uploads/2023/05/combat.png',
};

export default function HeroManagement() {
    const { t } = useTranslation();
    const router = useRouter();
    const params = useLocalSearchParams();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const [selectedCategory, setSelectedCategory] = useState('레어'); // Default first tab (Internal ID stays Korean for filtering)

    // Update category from URL parameter if provided
    React.useEffect(() => {
        if (params.category && typeof params.category === 'string') {
            setSelectedCategory(params.category);
        }
    }, [params.category]);

    const categories = [
        { id: '레어', label: t('heroes.categories.rare') },
        { id: '에픽', label: t('heroes.categories.epic') },
        ...Array.from({ length: 15 }, (_, i) => ({ id: `S${i + 1}`, label: t('heroes.categories.gen_format', { gen: i + 1 }) })),
    ];

    const filteredHeroes = heroesData
        .filter(hero => {
            // Filter Logic
            if (selectedCategory === '레어') return hero.rarity === '레어';
            if (selectedCategory === '에픽') return hero.rarity === '에픽';
            // For S1...S15, look for matching 'gen'
            return hero.gen === selectedCategory;
        })
        .sort((a, b) => {
            // Sort Logic: Infantry > Lancer > Marksman
            const ordA = typeOrder[a.type] || 99;
            const ordB = typeOrder[b.type] || 99;
            return ordA - ordB;
        });

    return (
        <View className={`flex-1 ${isDark ? 'bg-brand-dark' : 'bg-slate-50'}`}>
            <Stack.Screen options={{
                headerShown: false,
            }} />

            <View className="flex-1 flex-row">
                {/* Fixed Sidebar for PC / Scrollable for Mobile */}
                <View className={`w-16 md:w-24 border-r pt-4 ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {categories.map((cat) => (
                            <Pressable
                                key={cat.id}
                                onPress={() => setSelectedCategory(cat.id)}
                                className={`py-2.5 items-center border-l-4 ${selectedCategory === cat.id ? (isDark ? 'bg-[#38bdf8]/10 border-[#38bdf8]' : 'bg-blue-50 border-blue-600') : 'border-transparent'}`}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        cursor: 'pointer',
                                        backgroundColor: selectedCategory === cat.id
                                            ? (isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(239, 246, 255, 1)')
                                            : (hovered ? (isDark ? 'rgba(56, 189, 248, 0.05)' : 'rgba(59, 130, 246, 0.05)') : 'transparent'),
                                        transform: [{ scale: pressed ? 0.98 : (hovered ? 1.05 : 1) }],
                                        borderLeftWidth: (selectedCategory === cat.id || hovered) ? 4 : 0,
                                        borderLeftColor: selectedCategory === cat.id ? (isDark ? '#38bdf8' : '#2563eb') : '#94a3b8',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                    }
                                ]}
                            >
                                <Text className={`font-bold text-[10px] md:text-xs ${selectedCategory === cat.id ? (isDark ? 'text-[#38bdf8]' : 'text-blue-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`}>
                                    {cat.label}
                                </Text>
                            </Pressable>
                        ))}
                        <View className="h-20" />
                    </ScrollView>
                </View>

                {/* Main Content Area */}
                <View className={`flex-1 ${isDark ? 'bg-brand-dark/40' : 'bg-white'}`}>
                    <View className="p-3 md:p-6">
                        <View className="mb-4 pt-4 flex-row items-center">
                            <Pressable
                                onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
                                className={`mr-3 p-2 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100 border border-slate-200 shadow-sm'}`}
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
                            <View className="flex-1">
                                <Text className={`font-black text-[9px] tracking-widest mb-0.5 uppercase ${isDark ? 'text-[#38bdf8]' : 'text-blue-600'}`}>{t('heroes.archive_title')}</Text>
                                <View className="flex-row items-baseline">
                                    <Text className={`text-xl font-black tracking-tighter ${isDark ? 'text-white' : 'text-slate-800'}`}>
                                        {selectedCategory.startsWith('S')
                                            ? t('heroes.categories.gen_format', { gen: selectedCategory.substring(1) })
                                            : t(`heroes.categories.${selectedCategory === '레어' ? 'rare' : 'epic'}`)}
                                    </Text>
                                    <Text className={`ml-1 text-sm font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{t('heroes.list_title')}</Text>
                                </View>
                            </View>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View className="flex-row flex-wrap -mx-2">
                                {filteredHeroes.length > 0 ? (
                                    filteredHeroes.map((hero) => (
                                        <View
                                            key={hero.id}
                                            style={{ width: `${100 / COLUMN_COUNT}%` }}
                                            className="p-2"
                                        >
                                            <Link href={`/hero-management/${hero.id}`} asChild>
                                                <Pressable
                                                    className={`overflow-hidden rounded-xl border shadow-2xl group ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'}`}
                                                    style={({ pressed, hovered }: any) => [
                                                        {
                                                            transform: [{ scale: pressed ? 0.98 : (hovered ? 1.02 : 1) }],
                                                            transition: 'all 0.2s',
                                                            cursor: 'pointer',
                                                            boxShadow: hovered ? (isDark ? '0 10px 15px -3px rgba(0, 0, 0, 0.5)' : '0 10px 15px -3px rgba(0, 0, 0, 0.1)') : 'none',
                                                        }
                                                    ]}
                                                >
                                                    {/* Image Placeholder with Gradients */}
                                                    <View className={`aspect-square relative ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                                                        <Image
                                                            source={heroImages[hero.image]} // Use local image
                                                            className="w-full h-full"
                                                            resizeMode="cover"
                                                        />

                                                        {/* Badge Overlay */}
                                                        <View className="absolute top-2 left-2 space-y-1">
                                                            <View className="w-6 h-6 rounded-lg bg-black/40 items-center justify-center border border-white/10">
                                                                <Image source={{ uri: typeIcons[hero.type] }} className="w-4 h-4" />
                                                            </View>
                                                            <View className="w-6 h-6 rounded-lg bg-black/40 items-center justify-center border border-white/10">
                                                                <Image source={{ uri: roleIcons[hero.displayInfo?.subClass || '전투'] }} className="w-4 h-4" />
                                                            </View>
                                                        </View>
                                                    </View>

                                                    {/* Name Bar */}
                                                    <View className={`py-2 items-center justify-center border-t ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-50'}`}>
                                                        <Text className={`font-bold text-[10px] md:text-xs tracking-tighter ${isDark ? 'text-white' : 'text-slate-800'}`} numberOfLines={1}>
                                                            {t(`heroes.names.${hero.id.toLowerCase()}`, { defaultValue: hero.name })}
                                                        </Text>
                                                    </View>
                                                </Pressable>
                                            </Link>
                                        </View>
                                    ))
                                ) : (
                                    <View className="w-full py-20 items-center justify-center">
                                        <Text className="text-slate-600 font-semibold text-lg">{t('heroes.empty_msg')}</Text>
                                    </View>
                                )}
                            </View>
                            <View className="h-40" />
                        </ScrollView>
                    </View>
                </View>
            </View>


        </View>
    );
}
