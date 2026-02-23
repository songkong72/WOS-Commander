import React, { useState, memo } from 'react';
import { View, Text, Pressable, Image, Platform, useWindowDimensions, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../app/context';
import { WikiEvent } from '../../data/wiki-events';
import { formatDisplayDate, formatRemainingTime } from '../../app/utils/eventHelpers';
import ShimmerIcon from '../common/ShimmerIcon';
import { LinearGradient } from 'expo-linear-gradient';

import { DATE_RANGE_IDS } from '../../app/utils/eventStatus';



interface GrowthEventCardProps {
    event: WikiEvent;
    isDark: boolean;
    timezone: 'LOCAL' | 'UTC';
    now: Date;
    auth: any;
    isAdmin: boolean;
    isOngoing: boolean;
    isExpired: boolean;
    selectedTeamTab: number;
    checkItemOngoing: (str: string) => boolean;
    openScheduleModal: (event: WikiEvent, initialTabIdx?: number) => void;
    openGuideModal: (event: WikiEvent, initialTabIdx?: number) => void;
    openAttendeeModal: (event: WikiEvent, groupIndex?: number) => void;
    openWikiLink: (url: string) => void;
    onSetSelectedTeamTab: (idx: number) => void;
    remSoonSeconds?: number | null;
    onLayout: (y: number) => void;
    isHighlighted?: boolean;
}

const GrowthEventCard = memo(({
    event, isDark, timezone, now, auth, isAdmin, isOngoing, isExpired, selectedTeamTab,
    checkItemOngoing, openScheduleModal, openGuideModal, openAttendeeModal, openWikiLink,
    onSetSelectedTeamTab, onLayout, remSoonSeconds, isHighlighted
}: GrowthEventCardProps) => {
    const { t } = useTranslation();
    const { fontSizeScale } = useTheme();

    // Hover states for web
    const [guideHover, setGuideHover] = useState(false);
    const [attendHover, setAttendHover] = useState(false);
    const [wikiHover, setWikiHover] = useState(false);

    const isUpcoming = !isOngoing && !isExpired;
    const textColor = isExpired ? (isDark ? 'text-slate-500' : 'text-slate-400') : (isDark ? 'text-white' : 'text-slate-900');

    const renderStartEndPeriod = (str: string, textClass: string, isUtc = false) => {
        const formatted = formatDisplayDate(str, t, now, isUtc ? 'UTC' : 'LOCAL');

        const renderStyledDate = (dateStr: string) => {
            const match = dateStr.match(/^(\d{2}\/\d{2})\((.*?)\)\s+(.*)$/);
            if (match) {
                const [_, datePart, dayPart, timePart] = match;
                return (
                    <View className="flex-row items-center">
                        <Text className={`${textClass} font-bold`} style={{ fontSize: 16 * fontSizeScale }}>{datePart}</Text>
                        <Text className={`mx-0.5 font-black ${isDark ? 'text-sky-400' : 'text-sky-600'}`} style={{ fontSize: 14 * fontSizeScale }}>({dayPart})</Text>
                        <Text className={`${textClass} font-bold ml-1`} style={{ fontSize: 16 * fontSizeScale }}>{timePart}</Text>
                    </View>
                );
            }
            return <Text className={`${textClass} font-medium`} style={{ fontSize: 16 * fontSizeScale }}>{dateStr}</Text>;
        };

        if (!str.includes('~')) return (
            <View className="flex-row items-center">
                <View className="mr-3">
                    <ShimmerIcon isDark={isDark} colors={{ bg: isDark ? '#1e3a5f' : '#dbeafe', shadow: isDark ? '#38bdf8' : '#0284c7', shimmer: isDark ? '#38bdf8' : '#60a5fa' }}>
                        <Ionicons name="calendar-clear" size={18} color={isDark ? '#38bdf8' : '#0284c7'} />
                    </ShimmerIcon>
                </View>
                {renderStyledDate(formatted)}
            </View>
        );

        const parts = str.split('~').map(s => s.trim());
        const startFormatted = formatDisplayDate(parts[0], t, now, isUtc ? 'UTC' : 'LOCAL');
        const endFormatted = formatDisplayDate(parts[1], t, now, isUtc ? 'UTC' : 'LOCAL');

        return (
            <View className="gap-3">
                <View className="flex-row items-center">
                    <View
                        className={`px-2.5 py-1.5 rounded-xl border mr-3 items-center justify-center shadow-sm ${isDark ? 'bg-emerald-500/20 border-emerald-500/40' : 'bg-emerald-50 border-emerald-100'}`}
                        style={Platform.select({
                            web: { boxShadow: `0 2px 4px ${isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.1)'}` },
                            default: { shadowColor: '#10b981', shadowOpacity: isDark ? 0.3 : 0.1, shadowRadius: 4, elevation: 2 }
                        }) as any}
                    >
                        <Text className={`font-black ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`} style={{ fontSize: 10 * fontSizeScale }}>{t('common.start')}</Text>
                    </View>
                    {renderStyledDate(startFormatted)}
                </View>
                <View className="flex-row items-center">
                    <View
                        className={`px-2.5 py-1.5 rounded-xl border mr-3 items-center justify-center shadow-sm ${isDark ? 'bg-rose-500/20 border-rose-500/40' : 'bg-rose-50 border-rose-100'}`}
                        style={Platform.select({
                            web: { boxShadow: `0 2px 4px ${isDark ? 'rgba(244, 63, 94, 0.3)' : 'rgba(244, 63, 94, 0.1)'}` },
                            default: { shadowColor: '#f43f5e', shadowOpacity: isDark ? 0.3 : 0.1, shadowRadius: 4, elevation: 2 }
                        }) as any}
                    >
                        <Text className={`font-black ${isDark ? 'text-rose-300' : 'text-rose-600'}`} style={{ fontSize: 10 * fontSizeScale }}>{t('common.end')}</Text>
                    </View>
                    {renderStyledDate(endFormatted)}
                </View>
            </View>
        );
    };

    const { width: windowWidth } = useWindowDimensions();
    const isTwoColumn = windowWidth >= 480;

    return (
        <View
            style={{ width: isTwoColumn ? '50%' : '100%', padding: 8, opacity: 1 }}
            onLayout={(e) => onLayout(e.nativeEvent.layout.y)}
        >
            <Pressable
                style={({ hovered }: any) => [
                    {
                        height: '100%',
                        transform: [{ scale: (hovered || isHighlighted) ? 1.02 : 1 }],
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        zIndex: (hovered || isHighlighted) ? 10 : 1,
                        ...Platform.select({
                            web: { boxShadow: (hovered || isHighlighted) ? `0 12px 16px ${isHighlighted ? 'rgba(59, 130, 246, 0.6)' : 'rgba(59, 130, 246, 0.3)'}` : '0 4px 4px rgba(59, 130, 246, 0)' },
                            default: {
                                shadowColor: '#3b82f6',
                                shadowOffset: { width: 0, height: (hovered || isHighlighted) ? 12 : 4 },
                                shadowOpacity: (hovered || isHighlighted) ? (isHighlighted ? 0.6 : 0.3) : 0,
                                shadowRadius: (hovered || isHighlighted) ? 16 : 4,
                                elevation: (hovered || isHighlighted) ? 10 : 0
                            }
                        })
                    }
                ]}
                className={`rounded-[24px] mb-4 overflow-hidden transition-all ${isHighlighted ? (isDark ? 'border-2 border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.6)]' : 'border-2 border-blue-500 shadow-xl shadow-blue-500/30') : (isOngoing ? (isDark ? 'bg-[#191F28] border border-blue-500/30' : 'bg-white shadow-lg shadow-blue-500/10 border border-blue-100') : (isUpcoming ? (isDark ? 'bg-[#191F28] border border-[#333D4B]' : 'bg-white border border-[#E5E8EB] shadow-sm') : (isDark ? 'bg-[#191F28]/60 border border-[#333D4B]' : 'bg-[#F9FAFB] border border-[#E5E8EB]')))}`}
            >
                <View className={`px-5 py-5 flex-col border-b ${isDark ? 'border-slate-800/60' : 'border-[#F2F4F6]'}`}>
                    <View className="flex-row items-center mb-2">
                        {event.imageUrl ? (
                            <View className={`w-10 h-10 rounded-[14px] border overflow-hidden mr-3 ${isDark ? 'border-[#333D4B] bg-[#191F28]' : 'border-[#E5E8EB] bg-[#F2F4F6]'}`}>
                                <Image source={typeof event.imageUrl === 'string' ? { uri: event.imageUrl } : event.imageUrl} className="w-full h-full" resizeMode="cover" />
                            </View>
                        ) : (
                            <View className={`w-10 h-10 rounded-[14px] items-center justify-center border mr-3 ${isDark ? 'bg-[#191F28] border-[#333D4B]' : 'bg-[#F2F4F6] border-[#E5E8EB]'}`}>
                                <Ionicons name="calendar-outline" size={20} color={isDark ? '#B0B8C1' : '#8B95A1'} />
                            </View>
                        )}
                        <View
                            className="flex-1"
                            style={{
                                minHeight: 44 * fontSizeScale,
                                paddingRight: 4,
                                justifyContent: 'center'
                            }}
                        >
                            <Text
                                className={`font-bold ${textColor}`}
                                numberOfLines={2}
                                adjustsFontSizeToFit
                                minimumFontScale={0.7}
                                style={Platform.select({
                                    web: { wordBreak: 'keep-all', letterSpacing: -1.0, fontSize: 18 * fontSizeScale, lineHeight: 22 * fontSizeScale } as any,
                                    default: { letterSpacing: -1.0, fontSize: 18 * fontSizeScale, lineHeight: 22 * fontSizeScale }
                                })}
                            >
                                {t(`events.${event.id}_title`, { defaultValue: event.title })}
                                {!!event.teamLabel ? `\n(${event.teamLabel.replace('1군', t('events.team1')).replace('2군', t('events.team2'))})` : ''}
                            </Text>
                        </View>
                        {!!event.wikiUrl && (
                            <Pressable
                                onPress={() => openWikiLink(event.wikiUrl || '')}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        transform: [{ scale: pressed ? 0.9 : (hovered ? 1.15 : 1) }],
                                        backgroundColor: hovered ? (isDark ? '#3b82f6' : '#2563eb') : (isDark ? '#1e293b' : '#f1f5f9'),
                                        ...Platform.select({
                                            web: { boxShadow: hovered ? '0 4px 8px rgba(59, 130, 246, 0.5)' : 'none' },
                                            default: {
                                                shadowColor: '#3b82f6',
                                                shadowOffset: { width: 0, height: hovered ? 4 : 0 },
                                                shadowOpacity: hovered ? 0.5 : 0,
                                                shadowRadius: 8,
                                                elevation: hovered ? 5 : 0,
                                            }
                                        }),
                                        cursor: 'pointer'
                                    }
                                ]}
                                className="w-8 h-8 rounded-xl items-center justify-center ml-2 border border-blue-500/20"
                            >
                                {({ hovered }: any) => (
                                    <Ionicons name="document-text" size={16} color={hovered ? '#fff' : (isDark ? '#60a5fa' : '#3b82f6')} />
                                )}
                            </Pressable>
                        )}
                    </View>
                    <Text className={`mb-4 leading-relaxed ${isExpired ? (isDark ? 'text-slate-600' : 'text-slate-400') : (isDark ? 'text-[#8B95A1]' : 'text-[#4E5968]')}`} numberOfLines={isOngoing ? undefined : 2} style={{ fontSize: 14 * fontSizeScale }}>
                        {t(`events.${event.id}_description`, { defaultValue: event.description || t(`events.${event.id}_title`, { defaultValue: event.title }) })}
                    </Text>
                    <View className="flex-row items-end flex-wrap gap-2">
                        <View className={`flex-row items-center px-2 py-1 rounded-[6px] border border-transparent ${isDark ? 'bg-[#333D4B]' : 'bg-[#F2F4F6]'}`}>
                            <Ionicons name={event.category === '연맹' ? 'flag' : event.category === '개인' ? 'person' : event.category === '서버' ? 'earth' : event.category === '초보자' ? 'star' : 'apps'} size={12} color={isDark ? '#B0B8C1' : '#6B7684'} />
                            <Text className={`font-bold ml-1 ${isDark ? 'text-[#B0B8C1]' : 'text-[#6B7684]'}`} style={{ fontSize: 11 * fontSizeScale }}>
                                {event.category === '연맹' ? t('events.category.alliance')
                                    : event.category === '개인' ? t('events.category.individual')
                                        : event.category === '서버' ? t('events.category.server')
                                            : event.category === '초보자' ? t('events.category.beginner')
                                                : t('events.category.etc')}
                            </Text>
                        </View>
                        {isOngoing ? (
                            <View className="bg-[#E8F3FF] px-2.5 py-1 rounded-[6px] flex-row items-center border border-[#3182F6]/30 dark:bg-[#3182F6]/10 dark:border-[#3182F6]/30">
                                <View className={`w-1.5 h-1.5 rounded-full bg-[#3182F6] dark:bg-[#4F93F7] mr-1.5 ${Platform.OS === 'web' ? 'animate-pulse' : ''}`} />
                                <Text className="text-[#3182F6] font-black tracking-wide dark:text-[#4F93F7]" style={{ fontSize: 11 * fontSizeScale }}>{t('events.status.ongoing')}</Text>
                            </View>
                        ) : remSoonSeconds !== undefined && remSoonSeconds !== null ? (
                            <View className={`px-2 py-1 rounded-[6px] flex-row items-center border border-transparent ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                                <Ionicons name="time" size={10} color={isDark ? '#fbbf24' : '#d97706'} style={{ marginRight: 2 }} />
                                <Text className={`font-black ${isDark ? 'text-amber-400' : 'text-amber-700'}`} style={{ fontSize: 11 * fontSizeScale }}>
                                    SOON
                                </Text>
                            </View>
                        ) : isExpired ? (
                            <View className={`px-2 py-1 rounded-[6px] flex-row items-center border border-transparent ${isDark ? 'bg-[#2C3544]' : 'bg-slate-200'}`}>
                                <Text className={`font-bold ${isDark ? 'text-[#8B95A1]' : 'text-slate-500'}`} style={{ fontSize: 11 * fontSizeScale }}>{t('events.status.ended')}</Text>
                            </View>
                        ) : (
                            <View className={`px-2 py-1 rounded-[6px] flex-row items-center border border-transparent ${isDark ? 'bg-[#FFF8DD]/10' : 'bg-[#FFF8DD]'}`}>
                                <Text className={`font-bold ${isDark ? 'text-[#F2B308]' : 'text-[#9B6F03]'}`} style={{ fontSize: 11 * fontSizeScale }}>{t('events.status.upcoming')}</Text>
                            </View>
                        )}
                        {isAdmin && (
                            <ShimmerScheduleButton onPress={() => openScheduleModal(event, (event as any)._teamIdx !== undefined ? (event as any)._teamIdx : selectedTeamTab)} isDark={isDark} />
                        )}
                    </View>
                </View>
                <View className="px-5 pt-4 pb-5 flex-1 justify-between">
                    <View className="mb-4">
                        {(!event.day && (!event.time || !event.time.trim())) ? (
                            <View className={`w-full py-3 border border-dashed rounded-2xl items-center justify-center ${isDark ? 'border-slate-800 bg-slate-900/40' : 'bg-slate-50 border-slate-200'}`}>
                                <Text className={`font-semibold ${isDark ? 'text-slate-500' : 'text-slate-500'}`} style={{ fontSize: 13 * fontSizeScale }}>{t('events.schedule_empty')}</Text>
                            </View>
                        ) : (
                            event.day && (!event.time || !event.time.trim() || DATE_RANGE_IDS.includes(event.id)) && event.day !== '상설' && event.day !== '상시' ? (
                                <View className={`w-full rounded-2xl border overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <View className={`${isDark ? 'bg-black/20' : 'bg-white'}`}>
                                        {event.day.split('/').map((d, dIdx) => {
                                            const cleanD = d.trim();
                                            const formattedDay = cleanD.replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                            return (
                                                <View key={dIdx} className={`px-4 py-3 border-b ${isDark ? 'border-slate-800/60' : 'border-slate-100'} last:border-0`}>
                                                    {renderStartEndPeriod(formattedDay, `${isDark ? 'text-slate-100' : 'text-slate-800'}`, timezone === 'UTC')}
                                                </View>
                                            );
                                        })}
                                    </View>
                                </View>
                            ) : null
                        )}
                        {!!event.time && (() => {
                            const isBearOrFoundry = event.id.includes('bear') || event.id.includes('foundry') || event.id.includes('canyon') || event.id.includes('fortress') || event.id.includes('citadel') || event.id.includes('a_weapon');
                            const parts = event.time.split(' / ').filter((p: string) => p.trim());
                            const hasMultipleParts = parts.length > 1;
                            const selectedTab = selectedTeamTab || 0;
                            if (isBearOrFoundry && (hasMultipleParts || event.id.includes('team'))) {
                                const getTabLabel = (part: string, idx: number) => {
                                    const trimmed = part.trim();
                                    const cleaned = trimmed.replace(/.*(요새전|성채전)[:\s：]*/, '').trim();
                                    const formatted = cleaned.replace(/(요새|성채)(\d+)/g, '$1 $2').trim();

                                    const colonIdx = formatted.indexOf(':');
                                    if (colonIdx > -1) {
                                        const isTimeColon = colonIdx > 0 && /\d/.test(formatted[colonIdx - 1]) && /\d/.test(formatted[colonIdx + 1]);
                                        if (!isTimeColon) {
                                            const label = formatted.substring(0, colonIdx).trim();
                                            const isBear = event.id.includes('bear');
                                            if (/^(1군|Team\s*1|곰\s*1|Bear\s*1)$/i.test(label)) {
                                                return isBear ? t('events.bear1') : t('events.team1');
                                            }
                                            if (/^(2군|Team\s*2|곰\s*2|Bear\s*2)$/i.test(label)) {
                                                return isBear ? t('events.bear2') : t('events.team2');
                                            }
                                            return label;
                                        }
                                    }

                                    const nameMatch = formatted.match(/^(.*?)\s+([일월화수목금토]|[매일])/);
                                    if (nameMatch) {
                                        const label = nameMatch[1].trim();
                                        const isBear = event.id.includes('bear');
                                        if (/^(1군|Team\s*1|곰\s*1|Bear\s*1)$/i.test(label)) {
                                            return isBear ? t('events.bear1') : t('events.team1');
                                        }
                                        if (/^(2군|Team\s*2|곰\s*2|Bear\s*2)$/i.test(label)) {
                                            return isBear ? t('events.bear2') : t('events.team2');
                                        }
                                        return label;
                                    }

                                    const isBear = event.id.includes('bear');
                                    return isBear ? t(`events.bear${idx + 1}`) : `${t('events.team_unit')}${idx + 1}`;
                                };
                                const selectedContent = ((part: string | undefined) => {
                                    if (!part) return "";
                                    const trimmed = part.trim();
                                    const cleaned = trimmed.replace(/.*(요새전|성채전)[:\s：]*/, '').trim();
                                    const formatted = cleaned.replace(/(요새|성채)(\d+)/g, '$1 $2').trim();

                                    const colonIdx = formatted.indexOf(':');
                                    if (colonIdx > -1) {
                                        const isTimeColon = colonIdx > 0 && /\d/.test(formatted[colonIdx - 1]) && /\d/.test(formatted[colonIdx + 1]);
                                        if (!isTimeColon) return formatted.substring(colonIdx + 1).trim();
                                    }
                                    return formatted;
                                })(parts[selectedTab] || event.time);
                                return (
                                    <View className="w-full gap-3">
                                        {hasMultipleParts && (
                                            <View className="flex-row gap-2">
                                                {parts.map((p: string, idx: number) => (
                                                    <Pressable
                                                        key={idx}
                                                        onPress={() => onSetSelectedTeamTab(idx)}
                                                        className={`flex-1 py-2.5 rounded-xl items-center justify-center transition-all ${idx === selectedTab ? 'bg-blue-600' : (isDark ? 'bg-slate-800/60' : 'bg-slate-100')}`}
                                                        style={({ pressed, hovered }: any) => [
                                                            {
                                                                transform: [{ scale: pressed ? 0.98 : (hovered ? 1.02 : 1) }],
                                                                cursor: 'pointer'
                                                            }
                                                        ]}
                                                    >
                                                        <Text className={`text-xs font-bold ${idx === selectedTab ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-600')}`}>{getTabLabel(p, idx)}</Text>
                                                    </Pressable>
                                                ))}
                                            </View>
                                        )}
                                        <View className={`rounded-[16px] overflow-hidden ${isDark ? 'bg-black/20' : 'bg-[#F9FAFB]'}`}>
                                            <View className="flex-col">
                                                {(() => {
                                                    const items = selectedContent ? selectedContent.split(/[,|]/).map(s => s.trim()).filter(s => s && s !== '.').filter((v, i, a) => a.indexOf(v) === i) : [];
                                                    if (items.length === 0) return (
                                                        <View className="px-4 py-3 items-center justify-center">
                                                            <Text className={`text-sm font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('events.schedule_empty')}</Text>
                                                        </View>
                                                    );

                                                    return items.map((item: string, iIdx: number) => {
                                                        const trimmedItem = item.trim();
                                                        const formatted = trimmedItem.replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                                        const isSlotOngoing = checkItemOngoing(trimmedItem);
                                                        return (
                                                            <View key={iIdx} className={`px-4 py-3 border-b flex-row items-center justify-between ${isDark ? 'border-[#333D4B]/50' : 'border-[#E5E8EB]'} last:border-0 ${isSlotOngoing ? (isDark ? 'bg-[#1C2539]' : 'bg-[#E8F3FF]') : ''}`}>
                                                                <View className="flex-row items-center flex-1">
                                                                    {(() => {
                                                                        const displayStr = formatDisplayDate(formatted, t, now, timezone);
                                                                        const dtMatch = displayStr.match(/^(.*?)\(?([일월화수목금토매일상시])\)?(?:\s*\(?(\d{1,2}:\d{2})\)?)?/);

                                                                        if (dtMatch) {
                                                                            const [_, prefix, dRaw, tPart] = dtMatch;
                                                                            const dStr = dRaw === '매일' ? t('events.days.daily')
                                                                                : dRaw === '상시' ? t('events.days.always')
                                                                                    : (() => {
                                                                                        const krDays = ['일', '월', '화', '수', '목', '금', '토'];
                                                                                        const enKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                                                                                        const idx = krDays.indexOf(dRaw);
                                                                                        return idx !== -1 ? t(`events.days.${enKeys[idx]}`) : dRaw;
                                                                                    })();

                                                                            return (
                                                                                <View className="flex-row items-center">
                                                                                    {!!prefix && !!prefix.trim() && (
                                                                                        <Text className={`${isDark ? 'text-slate-100' : 'text-slate-900'} font-bold text-base mr-2`}>
                                                                                            {prefix.trim()
                                                                                                .replace(/요새\s*(\d+)/, `${t('events.fortress')} $1`)
                                                                                                .replace(/성채\s*(\d+)/, `${t('events.citadel')} $1`)
                                                                                                .replace(/곰\s*(\d+)/, `${t('events.bear1').replace(/1|1군|Team\s*1/i, '')} $1`)
                                                                                            }
                                                                                        </Text>
                                                                                    )}
                                                                                    <Text className={`${isDark ? 'text-[#3182F6]' : 'text-[#3182F6]'} font-bold text-[15px]`}>{dStr}</Text>
                                                                                    <>
                                                                                        <Text className={`mx-2 ${isDark ? 'text-[#6B7684]' : 'text-[#8B95A1]'}`}>·</Text>
                                                                                        <Text className={`${isDark ? 'text-[#F2F4F6]' : 'text-[#333D4B]'} font-bold text-[15px]`}>
                                                                                            {tPart || `(${t('dashboard.unassigned')})`}
                                                                                        </Text>
                                                                                    </>
                                                                                </View>
                                                                            );
                                                                        }
                                                                        return (
                                                                            <View className="flex-row items-center">
                                                                                <Text className={`${isDark ? 'text-[#F2F4F6]' : 'text-[#333D4B]'} font-bold text-[15px]`}>{displayStr}</Text>
                                                                            </View>
                                                                        );
                                                                    })()}
                                                                </View>
                                                                {isSlotOngoing && (
                                                                    <View
                                                                        className="bg-[#00ff88] px-2 py-0.5 rounded-full flex-row items-center ml-2 border border-[#00cc6a]"
                                                                        style={Platform.select({
                                                                            web: { boxShadow: '0 0 10px rgba(0,255,136,0.5)' },
                                                                            default: { shadowColor: '#00ff88', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 3 }
                                                                        }) as any}
                                                                    >
                                                                        <Ionicons name="flash" size={8} color="#0f172a" style={{ marginRight: 2 }} />
                                                                        <Text className="text-[#333D4B] text-[10px] font-bold ml-0.5">{t('events.status.ongoing')}</Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                        );
                                                    });
                                                })()}
                                            </View>
                                        </View>
                                    </View>
                                );
                            }
                            return (
                                <View className="w-full gap-3">
                                    {parts.map((part: string, idx: number) => {
                                        const trimmed = part.trim();
                                        if (!trimmed) return null;
                                        const colonIdx = trimmed.indexOf(':');
                                        const isTimeColon = colonIdx > 0 && /\d/.test(trimmed[colonIdx - 1]) && /\d/.test(trimmed[colonIdx + 1]);
                                        const rawLabel = (colonIdx > -1 && !isTimeColon) ? trimmed.substring(0, colonIdx).trim() : '';

                                        const displayLabel = rawLabel
                                            .replaceAll('1군', t('events.team1'))
                                            .replaceAll('2군', t('events.team2'))
                                            .replaceAll('요새전', t('events.fortress_battle'))
                                            .replaceAll('성채전', t('events.citadel_battle'))
                                            .replace(/요새\s*(\d+)/, `${t('events.fortress')} $1`)
                                            .replace(/성채\s*(\d+)/, `${t('events.citadel')} $1`);

                                        const content = rawLabel ? trimmed.substring(colonIdx + 1).trim() : trimmed;
                                        if (content === "." || !content) return null;
                                        return (
                                            <View key={idx} className={`rounded-[16px] overflow-hidden ${isDark ? 'bg-black/20' : 'bg-[#F9FAFB]'}`}>
                                                {!!rawLabel && (
                                                    <View className={`px-4 py-2 border-b ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                                                        <Text className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>{displayLabel}</Text>
                                                    </View>
                                                )}
                                                <View className="flex-col">
                                                    {content.split(/[,|]/).map(s => s.trim()).filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map((item: string, iIdx: number) => {
                                                        const trimmedItem = item.trim();
                                                        const formatted = trimmedItem.replace(/([일월화수목금토])\s*(\d{1,2}:\d{2})/g, '$1($2)');
                                                        const displayStr = formatDisplayDate(formatted, t, now, timezone);


                                                        const dtMatch = displayStr.match(/^(.*?)([일월화수목금토매일상시])(?:\s*\(?(\d{1,2}:\d{2})\)?)?/);

                                                        if (dtMatch) {
                                                            const [_, prefix, dRaw, tPart] = dtMatch;
                                                            const dStr = dRaw === '매일' ? t('events.days.daily')
                                                                : dRaw === '상시' ? t('events.days.always')
                                                                    : (() => {
                                                                        const krDays = ['일', '월', '화', '수', '목', '금', '토'];
                                                                        const enKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
                                                                        const idx = krDays.indexOf(dRaw);
                                                                        return idx !== -1 ? t(`events.days.${enKeys[idx]}`) : dRaw;
                                                                    })();

                                                            return (
                                                                <View key={iIdx} className={`px-4 py-3 border-b flex-row items-center justify-between ${isDark ? 'border-[#333D4B]/50' : 'border-[#E5E8EB]'} last:border-0`}>
                                                                    <View className="flex-row items-center flex-1">
                                                                        {!!prefix && !!prefix.trim() && (
                                                                            <Text className={`${isDark ? 'text-slate-100' : 'text-slate-900'} font-bold text-base mr-2`}>
                                                                                {prefix.trim()
                                                                                    .replace(/요새\s*(\d+)/, `${t('events.fortress')} $1`)
                                                                                    .replace(/성채\s*(\d+)/, `${t('events.citadel')} $1`)
                                                                                    .replace(/곰\s*(\d+)/, `${t('events.bear1').replace(/1|1군|Team\s*1/i, '')} $1`)
                                                                                }
                                                                            </Text>
                                                                        )}
                                                                        <Text className={`${isDark ? 'text-[#3182F6]' : 'text-[#3182F6]'} font-bold text-[15px]`}>{dStr}</Text>
                                                                        <>
                                                                            <Text className={`mx-2 ${isDark ? 'text-[#6B7684]' : 'text-[#8B95A1]'}`}>·</Text>
                                                                            <Text className={`${isDark ? 'text-[#F2F4F6]' : 'text-[#333D4B]'} font-bold text-[15px]`}>
                                                                                {tPart || `(${t('dashboard.unassigned')})`}
                                                                            </Text>
                                                                        </>
                                                                    </View>
                                                                </View>
                                                            );
                                                        }

                                                        return (
                                                            <View key={iIdx} className={`px-4 py-3 border-b flex-row items-center justify-between ${isDark ? 'border-[#333D4B]/50' : 'border-[#E5E8EB]'} last:border-0`}>
                                                                <View className="flex-row items-center flex-1">
                                                                    <Text className={`${isDark ? 'text-[#F2F4F6]' : 'text-[#333D4B]'} font-bold text-[15px]`}>{displayStr}</Text>
                                                                </View>
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            );
                        })()}
                    </View>
                    <View className="flex-row gap-2 mt-4">
                        <Pressable
                            onPress={() => openGuideModal(event)}
                            className={`flex-1 h-[52px] rounded-[16px] flex-row items-center justify-center transition-all ${isDark ? 'bg-slate-800' : 'bg-violet-50'}`}
                            style={({ pressed, hovered }: any) => [
                                {
                                    transform: [{ scale: pressed ? 0.96 : (hovered ? 1.02 : 1) }],
                                    opacity: pressed ? 0.8 : 1,
                                    ...Platform.select({
                                        web: { boxShadow: hovered ? '0 4px 12px rgba(139, 92, 246, 0.2)' : 'none' },
                                        default: {
                                            shadowColor: '#8b5cf6',
                                            shadowOffset: { width: 0, height: hovered ? 4 : 0 },
                                            shadowOpacity: hovered ? 0.2 : 0,
                                            shadowRadius: 8,
                                            elevation: hovered ? 4 : 0
                                        }
                                    })
                                } as any
                            ]}
                        >
                            <Ionicons name="book-outline" size={18} color={isDark ? '#a78bfa' : '#7c3aed'} style={{ marginRight: 8 }} />
                            <Text className={`font-bold text-[15px] ${isDark ? 'text-violet-300' : 'text-violet-600'}`}>{t('events.guide')}</Text>
                        </Pressable>
                        {(event.category === '연맹' || event.category === '서버') && (
                            <Pressable
                                onPress={() => openAttendeeModal(event, selectedTeamTab || 0)}
                                className={`flex-1 h-[52px] rounded-[16px] flex-row items-center justify-center transition-all ${isDark ? 'bg-[#1C2539]' : 'bg-[#E8F3FF]'}`}
                                style={({ pressed, hovered }: any) => [
                                    {
                                        transform: [{ scale: pressed ? 0.96 : (hovered ? 1.02 : 1) }],
                                        opacity: pressed ? 0.8 : 1,
                                        ...Platform.select({
                                            web: { boxShadow: '0 4px 12px rgba(49, 130, 246, 0.4)' },
                                            default: {
                                                shadowColor: '#3182f6',
                                                shadowOffset: { width: 0, height: hovered ? 4 : 2 },
                                                shadowOpacity: hovered ? 0.4 : 0.4,
                                                shadowRadius: 8,
                                                elevation: 3
                                            }
                                        })
                                    } as any
                                ]}
                            >
                                <Ionicons name="people" size={18} color={isDark ? '#4F93F7' : '#3182F6'} style={{ marginRight: 8 }} />
                                <Text className={`font-bold text-[15px] ${isDark ? 'text-[#4F93F7]' : 'text-[#3182F6]'}`}>{t('events.attend')}</Text>
                            </Pressable>
                        )}
                    </View>
                </View>
            </Pressable >
        </View >
    );
});

const ShimmerScheduleButton = memo(({ onPress, isDark }: { onPress: () => void, isDark: boolean }) => {
    const { t } = useTranslation();
    const { fontSizeScale } = useTheme();
    const shimmerAnim = React.useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        const animate = () => {
            shimmerAnim.setValue(0);
            Animated.timing(shimmerAnim, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: false,
            }).start(() => animate());
        };
        animate();
    }, [shimmerAnim]);

    const shimmerTranslate = shimmerAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [-60, 60],
    });

    const pulseOpacity = shimmerAnim.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0.9, 1, 0.9],
    });

    return (
        <Pressable onPress={onPress} className="ml-auto"
            style={({ pressed, hovered }: any) => [
                {
                    transform: [{ scale: pressed ? 0.95 : (hovered ? 1.08 : 1) }],
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    cursor: 'pointer',
                    ...Platform.select({
                        web: { boxShadow: hovered ? `0 4px 12px ${isDark ? 'rgba(129, 140, 248, 0.6)' : 'rgba(99, 102, 241, 0.6)'}` : 'none' },
                        default: {
                            shadowColor: hovered ? (isDark ? '#818cf8' : '#6366f1') : 'transparent',
                            shadowOffset: { width: 0, height: hovered ? 4 : 0 },
                            shadowOpacity: hovered ? 0.6 : 0,
                            shadowRadius: hovered ? 12 : 0,
                            elevation: hovered ? 6 : 0,
                        }
                    })
                }
            ]}
        >
            <Animated.View
                style={{ opacity: pulseOpacity }}
                className="relative overflow-hidden px-2.5 py-1 rounded-[6px] border border-transparent flex-row items-center justify-center shadow-sm"
            >
                <LinearGradient
                    colors={isDark ? ['#7c3aed', '#4f46e5'] : ['#a78bfa', '#818cf8']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="absolute inset-0 w-full h-full"
                    style={{ borderRadius: 6 }}
                />
                <Ionicons name="calendar" size={12} color="white" style={{ marginRight: 4, position: 'relative', zIndex: 10 }} />
                <Text className="text-white font-bold relative z-10" style={{ fontSize: 11 * fontSizeScale }}>
                    {t('events.set_time')}
                </Text>
                <Animated.View
                    style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        width: 20,
                        transform: [{ translateX: shimmerTranslate }],
                        zIndex: 20
                    }}
                >
                    <LinearGradient
                        colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={{ flex: 1 }}
                    />
                </Animated.View>
            </Animated.View>
        </Pressable>
    );
});

export default GrowthEventCard;
