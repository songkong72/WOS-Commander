import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface DashboardFeatureCardsProps {
    isDark: boolean;
    auth: any;
    router: any;
    showCustomAlert: (title: string, desc: string, type: string) => void;
}

export const DashboardFeatureCards = ({
    isDark,
    auth,
    router,
    showCustomAlert,
}: DashboardFeatureCardsProps) => {
    const { t } = useTranslation();

    return (
        <View className="w-full max-w-6xl px-4 md:px-8 flex-col sm:flex-row gap-4 mb-10">
            {[
                { id: 'events', label: t('dashboard.menu_events'), desc: t('dashboard.menu_events_desc'), icon: 'calendar', path: '/growth/events', color: '#38bdf8' },
                { id: 'strategy', label: t('dashboard.menu_strategy'), desc: t('dashboard.menu_strategy_desc'), icon: 'map', path: '/strategy-sheet', color: '#10b981' },
                { id: 'hero', label: t('dashboard.menu_heroes'), desc: t('dashboard.menu_heroes_desc'), icon: 'people', path: '/hero-management', color: '#38bdf8' }
            ].map((card) => (
                <Pressable
                    key={card.id}
                    onPress={() => auth.isLoggedIn ? router.push(card.path as any) : showCustomAlert(t('common.member_only_title'), t('common.member_only_alert'), 'error')}
                    className={`w-full sm:flex-1 p-4 md:p-6 rounded-3xl border-2 flex-row items-center ${isDark ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}
                >
                    <View className={`w-11 h-11 rounded-2xl items-center justify-center mr-3 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`} style={{ borderColor: card.color, borderLeftWidth: 3 }}>
                        <Ionicons name={!auth.isLoggedIn ? 'lock-closed' : card.icon as any} size={22} color={card.color} />
                    </View>
                    <View>
                        <Text className={`text-2xl font-black ${isDark ? 'text-slate-100' : 'text-slate-950'}`}>{card.label}</Text>
                        <Text className={`text-[11px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>{card.desc}</Text>
                    </View>
                </Pressable>
            ))}
        </View>
    );
};
