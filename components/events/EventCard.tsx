import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, Image, ImageBackground, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { INITIAL_WIKI_EVENTS } from '../../data/wiki-events';
import { ADDITIONAL_EVENTS } from '../../data/new-events';

interface EventCardProps {
    event: any;
    isDark: boolean;
    isMobile: boolean;
    fontSizeScale: number;
    windowWidth: number;
    now: Date;
    timezone: 'LOCAL' | 'UTC';
    viewMode: 'list' | 'timeline';
    t: (key: string, options?: any) => string;
    auth: {
        isLoggedIn: boolean;
        adminName?: string | null;
        role?: any;
    };
    onPress: (event: any) => void;
    isEventActive: (event: any) => boolean;
    isEventExpired: (event: any) => boolean;
    getRemainingSeconds: (str: string, eventId?: string) => number | null;
    getEventEndDate: (event: any) => Date | null;
    toLocal: (kstStr: string) => string;
    toUTC: (kstStr: string) => string;
    pad: (n: number) => string;
    translateDay: (day: string) => string;
    translateLabel: (label: string) => string;
    getEventSchedule: (event: any) => any;
    formatRemainingTime: (seconds: number) => string;
}

export const EventCard: React.FC<EventCardProps> = ({
    event,
    isDark,
    isMobile,
    fontSizeScale,
    windowWidth,
    now: initialNow,
    timezone,
    viewMode,
    t,
    auth,
    onPress,
    isEventActive,
    isEventExpired,
    getRemainingSeconds,
    getEventEndDate,
    toLocal,
    toUTC,
    pad,
    translateDay,
    translateLabel,
    getEventSchedule,
    formatRemainingTime,
}) => {
    const [now, setNow] = useState(initialNow);

    // Internal ticker for countdowns
    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const isActive = isEventActive(event);
    const isExpired = isEventExpired(event);
    const isLocked = !auth.isLoggedIn;

    const convertTime = (kstStr: string) => {
        if (timezone === 'LOCAL') return toLocal(kstStr);
        return toUTC(kstStr);
    };

    const getEventIcon = (id: string) => {
        if (id.includes('bear')) return 'paw-outline';
        if (id.includes('frost') || id.includes('weapon')) return 'shield-half-outline';
        if (id.includes('castle') || id.includes('fortress')) return 'business-outline';
        if (id.includes('championship')) return 'trophy-outline';
        return 'calendar-clear-outline';
    };

    const getSoonRemainingSeconds = (str: string) => {
        if (!str) return null;
        const dayMapObj: { [key: string]: number } = {
            '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6,
            'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6
        };
        const currentDay = (now.getDay() + 6) % 7;
        const currentTotalSec = currentDay * 86400 + now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
        const totalWeekSec = 7 * 86400;

        // 1. Date Range Support (e.g. 2026.02.22 10:00 ~ ...)
        const rangeMatch = str.match(/(\d{4}\.\d{2}\.\d{2})\s*(?:\([^\)]+\))?\s*(\d{2}:\d{2})\s*~/);
        if (rangeMatch) {
            try {
                const startStr = `${rangeMatch[1].replace(/\./g, '-')}T${rangeMatch[2]}:00`;
                const startDate = new Date(startStr);
                if (!isNaN(startDate.getTime())) {
                    const diff = (startDate.getTime() - now.getTime()) / 1000;
                    if (diff > 0 && diff <= 1800) return Math.floor(diff);
                }
            } catch (e) { }
        }

        // 2. Weekly Range Support (e.g. 월 10:00 ~ 수 10:00)
        const weeklyMatch = str.match(/([일월화수목금토]|sun|mon|tue|wed|thu|fri|sat)\s*(\d{2}):(\d{2})\s*~\s*([일월화수목금토]|sun|mon|tue|wed|thu|fri|sat)\s*(\d{2}):(\d{2})/i);
        if (weeklyMatch) {
            const dayOffset = dayMapObj[weeklyMatch[1].toLowerCase()];
            if (dayOffset !== undefined) {
                const h = parseInt(weeklyMatch[2]);
                const min = parseInt(weeklyMatch[3]);
                const startTotalSec = dayOffset * 86400 + h * 3600 + min * 60;
                let diff = startTotalSec - currentTotalSec;
                if (diff < 0) diff += totalWeekSec;
                if (diff > 0 && diff <= 1800) return Math.floor(diff);
            }
        }

        const explicitMatches = Array.from(str.matchAll(/([일월화수목금토]|[매일]|sun|mon|tue|wed|thu|fri|sat|daily)\s*\(?(\d{1,2}):(\d{2})\)?/gi));
        if (explicitMatches.length > 0) {
            let minDiff: number | null = null;
            explicitMatches.forEach(m => {
                const dayStr = m[1];
                const h = parseInt(m[2]);
                const min = parseInt(m[3]);
                const scheduledDays = (dayStr === '매일') ? ['일', '월', '화', '수', '목', '금', '토'] : [dayStr];
                scheduledDays.forEach(d => {
                    const dayOffset = dayMapObj[d.toLowerCase()];
                    if (dayOffset === undefined) return;
                    let startTotalSec = dayOffset * 86400 + h * 3600 + min * 60;
                    let diff = startTotalSec - currentTotalSec;
                    if (diff < 0) diff += totalWeekSec;
                    const durationSec = 1800; // Strictly 30 minutes before as per user request

                    if (diff > 0 && diff <= durationSec) {
                        if (minDiff === null || diff < minDiff) minDiff = diff;
                    }
                });
            });
            return minDiff;
        }
        return null;
    };

    const allBaseEvents = [...INITIAL_WIKI_EVENTS, ...ADDITIONAL_EVENTS];
    const eventInfo = allBaseEvents.find(e => e.id === (event.originalEventId || event.eventId));
    const eventImageUrl = eventInfo?.imageUrl;

    const currentSchedule = getEventSchedule(event);
    let displayDay = (event.isBearSplit && event.day) ? event.day : (currentSchedule?.day || event.day);
    let displayTime = (event.isBearSplit || event.isFoundrySplit || event.isFortressSplit || event.isCanyonSplit) ? event.time : (currentSchedule?.time || event.time);

    // next slot logic for split events
    if (event.isBearSplit || event.isFoundrySplit || event.isCanyonSplit) {
        const dayMap: { [key: string]: number } = {
            '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6,
            'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6
        };
        const currentDay = (now.getDay() + 6) % 7;
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const matches = Array.from(displayTime.matchAll(/([일월화수목금토매일상시]|sun|mon|tue|wed|thu|fri|sat|daily)\s*\(?(\d{1,2}:\d{2})\)?/gi));

        if (matches.length > 0) {
            const nextSlot = matches.find(m => {
                const dRaw = m[1];
                const [h, min] = m[2].split(':').map(Number);
                if (dRaw === '매일' || dRaw === '상시') return true;
                const dIdx = dayMap[dRaw.toLowerCase()];
                if (dIdx > currentDay) return true;
                if (dIdx === currentDay) return currentMins < (h * 60 + min + 60);
                return false;
            });
            if (nextSlot) {
                displayDay = nextSlot[1];
                const upcomingMatches = matches.filter(m => {
                    const dRaw = m[1];
                    const [h, min] = m[2].split(':').map(Number);
                    if (dRaw === '매일' || dRaw === '상시') return true;
                    const dIdx = dayMap[dRaw.toLowerCase()];
                    if (dIdx > currentDay) return true;
                    if (dIdx === currentDay) return currentMins < (h * 60 + min + 60);
                    return false;
                });
                if (upcomingMatches.length > 0) {
                    displayTime = upcomingMatches.map(m => m[0]).join(', ');
                }
            }
        }
    }

    const getFormattedDateRange = () => {
        const dayMapObj: { [key: string]: number } = {
            '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6,
            'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6
        };
        const currentDay = (now.getDay() + 6) % 7;
        let targetDayStr = displayDay;
        let targetTimeStr = displayTime;
        let dIdx = dayMapObj[targetDayStr.toLowerCase()];
        if (dIdx !== undefined) {
            const [h, m] = (targetTimeStr.match(/(\d{1,2}):(\d{2})/) || []).slice(1).map(Number);
            if (!isNaN(h)) {
                let diffDays = dIdx - currentDay;
                const targetDate = new Date(now);
                targetDate.setDate(now.getDate() + diffDays);
                targetDate.setHours(h, m, 0, 0);
                const endDate = new Date(targetDate);
                endDate.setMinutes(endDate.getMinutes() + 60);
                const kstFormat = (d: Date) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                const kstStr = `${kstFormat(targetDate)} ~ ${kstFormat(endDate)}`;
                return convertTime(kstStr).replace(/20(\d{2})[\.\/-]/g, '$1.');
            }
        }
        let finalStr = convertTime(`${displayDay} ${displayTime}`);
        return finalStr.replace(/20(\d{2})[\.\/-]/g, '$1.');
    };

    const formattedDateRange = getFormattedDateRange();
    const remSoonSeconds = !isActive && !isExpired ? (getSoonRemainingSeconds(displayDay) ?? getSoonRemainingSeconds(displayTime)) : null;
    const isUpcomingSoon = remSoonSeconds !== null;

    const renderEventTitle = () => {
        const eventId = event.eventId || '';
        const originalId = event.originalEventId || '';
        if (eventId.includes('citadel')) return t('events.citadel_battle_title');
        if (eventId.includes('fortress')) return t('events.fortress_battle_title');

        const cleanId = (originalId || eventId).replace(/_fortress|_citadel|_team\d+/g, '');
        const baseTitle = t(`events.${cleanId}_title`, { defaultValue: event.title });

        if ((event.isBearSplit || event.isFoundrySplit || event.isCanyonSplit) && event.teamLabel) {
            const translatedTeam = event.teamLabel.replace('1군', t('events.team1')).replace('2군', t('events.team2'));
            return `${baseTitle} (${translatedTeam})`;
        }
        return baseTitle;
    };

    if (isActive) {
        return (
            <Pressable
                onPress={() => onPress(event)}
                style={({ pressed, hovered }: any) => [
                    {
                        width: '100%',
                        borderRadius: 24,
                        overflow: 'hidden',
                        backgroundColor: isDark ? 'rgba(25, 31, 40, 0.65)' : 'rgba(255, 255, 255, 0.8)',
                        elevation: 5,
                        opacity: isLocked ? 0.7 : (pressed ? 0.98 : 1),
                        transform: [{ scale: (hovered && !isLocked) ? 1.02 : 1 }],
                        marginBottom: 12,
                    }
                ]}
            >
                {isLocked && (
                    <View className="absolute top-3 right-3 z-20 flex-row items-center bg-black/60 px-2.5 py-1 rounded-full">
                        <Ionicons name="lock-closed" size={10} color="#94a3b8" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 9 * fontSizeScale, color: '#94a3b8', fontWeight: '700' }}>{t('common.member_only_title')}</Text>
                    </View>
                )}
                <ImageBackground
                    source={require('../../assets/images/selection_gate_bg.png')}
                    style={{ width: '100%' }}
                    imageStyle={{ opacity: 0.6 }}
                >
                    <View className="absolute inset-0 bg-black/50" />
                    <View className="p-5">
                        <View className="flex-col mb-1">
                            <View className="w-full mb-4">
                                <View className="flex-row items-center mb-2">
                                    <View className="px-2 py-1 rounded-[6px] bg-blue-500">
                                        <Text className="text-[11px] font-bold uppercase tracking-wider text-white">Ongoing</Text>
                                    </View>
                                    <View className="ml-2 w-2 h-2 rounded-full bg-green-400" />
                                </View>
                                <Text className="font-black tracking-tight text-white" style={{ fontSize: 22 * fontSizeScale, lineHeight: 26 * fontSizeScale }} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.8}>
                                    {renderEventTitle()}
                                </Text>
                            </View>

                            <View className="w-full items-end mb-2">
                                {(() => {
                                    let remSeconds = getRemainingSeconds(toLocal(displayDay), event.eventId) || getRemainingSeconds(toLocal(displayTime), event.eventId);
                                    if (remSeconds === null) {
                                        const endDate = getEventEndDate({ ...event, day: toLocal(displayDay), time: toLocal(displayTime) });
                                        if (endDate && now < endDate) {
                                            remSeconds = Math.floor((endDate.getTime() - now.getTime()) / 1000);
                                        }
                                    }

                                    if (remSeconds !== null) {
                                        const d = Math.floor(remSeconds / (24 * 3600));
                                        const h = Math.floor((remSeconds % (24 * 3600)) / 3600);
                                        const m = Math.floor((remSeconds % 3600) / 60);
                                        const s = remSeconds % 60;
                                        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                                        return (
                                            <View className={`w-full items-center justify-center px-4 py-3 rounded-xl border ${isDark ? 'bg-sky-500/10 border-sky-500/50' : 'bg-blue-50 border-blue-200'}`}>
                                                <View className="flex-row items-baseline justify-center">
                                                    {d > 0 && <Text className={`font-black mr-2 ${isDark ? 'text-[#38bdf8]' : 'text-[#2563eb]'}`} style={{ fontSize: 24 * fontSizeScale }}>{d}{t('common.day_short')}</Text>}
                                                    <Text className={`font-black tracking-widest tabular-nums ${isDark ? 'text-[#38bdf8]' : 'text-[#2563eb]'}`} style={{ fontSize: 28 * fontSizeScale }}>{timeStr}</Text>
                                                </View>
                                                <Text className={`text-[11px] font-bold uppercase tracking-[0.3em] mt-1 opacity-80 ${isDark ? 'text-sky-200' : 'text-blue-400'}`}>REMAINING</Text>
                                            </View>
                                        );
                                    }
                                    return (
                                        <View className="w-full items-center justify-center px-4 py-2 rounded-xl bg-blue-500/20">
                                            <Text className="text-sm font-bold uppercase tracking-widest text-blue-400">Active</Text>
                                        </View>
                                    );
                                })()}
                            </View>
                        </View>
                        <View className="flex-row flex-wrap items-center pt-2">
                            <View className="flex-row items-center mr-2 py-0.5">
                                <Ionicons name="calendar-outline" size={16} color="#CBD5E1" style={{ marginRight: 6 }} />
                                {(() => {
                                    const parts = formattedDateRange.split(' ~ ');
                                    if (parts.length === 2 && parts[0].includes(' ')) {
                                        const [date1, time1] = parts[0].split(' ');
                                        return (
                                            <View className="flex-row items-center">
                                                <Text className="font-bold text-white" style={{ fontSize: 18 * fontSizeScale }}>{date1}</Text>
                                                <Text className="text-slate-200" style={{ fontSize: 16 * fontSizeScale }}> {time1}</Text>
                                            </View>
                                        );
                                    }
                                    return <Text className="font-medium text-slate-300" style={{ fontSize: 18 * fontSizeScale }}>{formattedDateRange}</Text>;
                                })()}
                            </View>
                            {(() => {
                                const parts = formattedDateRange.split(' ~ ');
                                if (parts.length === 2 && parts[1].includes(' ')) {
                                    const [date2, time2] = parts[1].split(' ');
                                    return (
                                        <View className="flex-row items-center py-0.5">
                                            <Text className="text-white mx-1" style={{ fontSize: 18 * fontSizeScale }}>~</Text>
                                            <Text className="font-bold text-white" style={{ fontSize: 18 * fontSizeScale }}>{date2}</Text>
                                            <Text className="text-slate-200" style={{ fontSize: 16 * fontSizeScale }}> {time2}</Text>
                                        </View>
                                    );
                                }
                                return null;
                            })()}
                        </View>
                    </View>
                </ImageBackground>
            </Pressable>
        );
    }

    return (
        <Pressable
            onPress={() => onPress(event)}
            style={({ pressed, hovered }: any) => [
                {
                    width: '100%',
                    borderRadius: 24,
                    marginBottom: 8,
                    overflow: 'hidden',
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.35)' : 'rgba(255, 255, 255, 0.7)',
                    borderWidth: 1,
                    borderColor: isUpcomingSoon ? '#38bdf8' : (isDark ? 'rgba(51, 65, 85, 0.3)' : '#e2e8f0'),
                    opacity: isLocked ? 0.7 : (pressed ? 0.98 : 1),
                    transform: [{ scale: (hovered && !isLocked) ? 1.02 : 1 }],
                }
            ]}
        >
            {isLocked && (
                <View className="absolute top-3 right-3 z-20 flex-row items-center bg-black/40 px-2.5 py-1 rounded-full">
                    <Ionicons name="lock-closed" size={10} color="#94a3b8" style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 9 * fontSizeScale, color: '#94a3b8', fontWeight: '700' }}>{t('common.member_only_title')}</Text>
                </View>
            )}
            <View className={`${windowWidth < 380 ? 'px-3' : 'px-4'} py-4 flex-row items-center`}>
                <View className={`${windowWidth < 380 ? 'w-11 h-11 mr-2.5' : 'w-14 h-14 mr-4'} rounded-2xl items-center justify-center ${isDark ? 'bg-slate-800/80' : 'bg-slate-100'}`}>
                    {eventImageUrl ? (
                        <Image source={typeof eventImageUrl === 'string' ? { uri: eventImageUrl } : eventImageUrl} className={`${windowWidth < 380 ? 'w-7 h-7' : 'w-8 h-8'}`} resizeMode="contain" />
                    ) : (
                        <Ionicons name={getEventIcon(event.originalEventId || event.eventId)} size={windowWidth < 380 ? 20 : 24} color={isDark ? '#94a3b8' : '#64748b'} />
                    )}
                </View>
                <View className="flex-1 pr-1">
                    {isUpcomingSoon && !isExpired && (
                        <View className={`inline-flex flex-row items-center self-start px-1.5 py-0.5 rounded-md mb-1 ${isDark ? 'bg-amber-500/20' : 'bg-amber-100'}`}>
                            <Ionicons name="time" size={10} color={isDark ? '#fbbf24' : '#d97706'} style={{ marginRight: 2 }} />
                            <Text className={`text-[10px] font-black ${isDark ? 'text-amber-400' : 'text-amber-700'}`}>SOON</Text>
                        </View>
                    )}
                    <View className="flex-row items-center mb-1">
                        <Text className={`flex-1 font-bold ${isDark ? 'text-slate-100' : 'text-slate-900'}`} style={{ fontSize: (windowWidth < 380 ? 14 : 18) * fontSizeScale, lineHeight: (windowWidth < 380 ? 18 : 22) * fontSizeScale }} numberOfLines={2}>
                            {renderEventTitle()}
                        </Text>
                    </View>
                    <View>
                        {(!displayDay && !displayTime) ? (
                            <Text className="text-slate-400 text-sm">{t('dashboard.unassigned')}</Text>
                        ) : (
                            (() => {
                                let rawStr = displayTime || displayDay || '-';
                                if (displayDay && displayTime && !/[일월화수목금토]/.test(displayTime)) {
                                    if (!event.isFortressSplit) rawStr = `${displayDay} ${displayTime}`;
                                }
                                let finalStr = convertTime(rawStr).replace(/20(\d{2})[\.\/-]/g, '$1.').replace(/성채전\s*:\s*/g, '').replace(/,\s*/g, '\n');
                                const lines = Array.from(new Set(finalStr.split('\n').map(l => l.trim()).filter(Boolean)));
                                return (
                                    <View>
                                        {lines.map((line, idx) => {
                                            const formattedLine = line.replace(/([월화수목금토일])\s+(\d{2}:\d{2})/, '$1($2)');
                                            const parts = formattedLine.split(' ');
                                            return (
                                                <Text key={idx} className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`} style={{ fontSize: 16 * fontSizeScale, lineHeight: 22 * fontSizeScale }}>
                                                    {parts.map((part, pIdx) => {
                                                        const isKeyword = /^(요새|성채)\d+/.test(part);
                                                        const isTimePattern = /[월화수목금토일]\(\d{2}:\d{2}\)/.test(part);
                                                        return (
                                                            <Text key={pIdx} className={isKeyword ? (isDark ? 'text-sky-300 font-bold' : 'text-blue-600 font-bold') : ''}>
                                                                {isKeyword ? translateLabel(part) : (isTimePattern ? part.replace(/[월화수목금토일]/g, m => translateDay(m)) : translateDay(part))}{pIdx < parts.length - 1 ? ' ' : ''}
                                                            </Text>
                                                        );
                                                    })}
                                                </Text>
                                            );
                                        })}
                                    </View>
                                );
                            })()
                        )}
                    </View>
                </View>
                <View className="flex-row items-center pl-2">
                    {isUpcomingSoon && remSoonSeconds !== null && (
                        <View className="mr-3 items-end" style={{ width: 65 }}>
                            <Text className="text-[10px] font-black text-amber-500 uppercase tracking-tighter" style={{ marginBottom: -2 }}>Starts In</Text>
                            <Text className="text-lg font-black text-amber-500 tabular-nums" style={{ fontFamily: 'Orbitron' }}>{formatRemainingTime(remSoonSeconds)}</Text>
                        </View>
                    )}
                    <View className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        <Ionicons name="chevron-forward" size={18} color={isDark ? '#cbd5e1' : '#64748b'} />
                    </View>
                </View>
            </View>
        </Pressable>
    );
};
