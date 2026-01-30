import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ImageBackground, Image, Dimensions } from 'react-native';
import { Stack, Link, useRouter, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
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
    const router = useRouter();
    const params = useLocalSearchParams();
    const [selectedCategory, setSelectedCategory] = useState('레어'); // Default first tab

    // Update category from URL parameter if provided
    React.useEffect(() => {
        if (params.category && typeof params.category === 'string') {
            setSelectedCategory(params.category);
        }
    }, [params.category]);

    const categories = [
        { id: '레어', label: '레어' },
        { id: '에픽', label: '에픽' },
        ...Array.from({ length: 15 }, (_, i) => ({ id: `S${i + 1}`, label: `S${i + 1}` })),
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
        <View className="flex-1 bg-brand-dark">
            <Stack.Screen options={{
                headerShown: false,
            }} />

            <View className="flex-1 flex-row">
                {/* Fixed Sidebar for PC / Scrollable for Mobile */}
                <View className="w-20 md:w-32 bg-slate-900/50 border-r border-slate-800 pt-12">
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {categories.map((cat) => (
                            <TouchableOpacity
                                key={cat.id}
                                onPress={() => setSelectedCategory(cat.id)}
                                className={`py-4 items-center border-l-4 ${selectedCategory === cat.id ? 'bg-brand-accent/10 border-brand-accent' : 'border-transparent'}`}
                            >
                                <Text className={`font-black text-xs md:text-sm ${selectedCategory === cat.id ? 'text-brand-accent' : 'text-slate-300'}`}>
                                    {cat.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <View className="h-20" />
                    </ScrollView>
                </View>

                {/* Main Content Area */}
                <View className="flex-1 bg-brand-dark/40">
                    <View className="p-6 md:p-10">
                        <View className="mb-10 flex-row justify-between items-end">
                            <View className="flex-1">
                                <Text className="text-brand-accent font-black text-xs tracking-widest mb-1 uppercase">Hero Archive</Text>
                                <Text className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tighter">{selectedCategory} 영웅 목록</Text>
                                <View className="h-1 w-12 bg-brand-accent rounded-full" />
                            </View>
                            <TouchableOpacity
                                onPress={() => router.replace('/')}
                                className="flex-row items-center bg-white/5 px-4 py-2 rounded-xl border border-white/10"
                            >
                                <Ionicons name="home-outline" size={18} color="#FFD700" className="mr-2" />
                                <Text className="text-white font-black text-xs">뒤로가기</Text>
                            </TouchableOpacity>
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
                                                <TouchableOpacity activeOpacity={0.8} className="overflow-hidden bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl group">
                                                    {/* Image Placeholder with Gradients */}
                                                    <View className="aspect-square bg-slate-800 relative">
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
                                                    <View className="bg-slate-900 py-3 items-center justify-center border-t border-slate-800">
                                                        <Text className="text-white font-black text-[12px] md:text-sm tracking-tighter" numberOfLines={1}>
                                                            {hero.name}
                                                        </Text>
                                                    </View>
                                                </TouchableOpacity>
                                            </Link>
                                        </View>
                                    ))
                                ) : (
                                    <View className="w-full py-20 items-center justify-center">
                                        <Text className="text-slate-600 font-bold text-lg">해당 세대의 영웅 정보가 아직 준비 중입니다.</Text>
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
