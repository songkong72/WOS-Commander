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
        let dIdx = dayMapObj[targetDayStr?.toLowerCase() || ''];
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
        let finalStr = convertTime(`${displayDay || ''} ${displayTime || ''}`);
        return finalStr.replace(/20(\d{2})[\.\/-]/g, '$1.');
    };

    const formattedDateRange = getFormattedDateRange();
    const remSoonSeconds = !isActive && !isExpired ? (getRemainingSeconds(displayDay, event.eventId) ?? getRemainingSeconds(displayTime, event.eventId)) : null;
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
            // Use word-joiner (\u2060) to keep "(1군)" together as a single unit
            const teamBadge = `\u2060(\u2060${translatedTeam}\u2060)\u2060`;

            // Only move to next line if REALLY narrow (below 340px)
            if (windowWidth < 340) {
                return `${baseTitle}\n${teamBadge}`;
            }
            return `${baseTitle} ${teamBadge}`;
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
                        borderRadius: 20,
                        overflow: 'hidden',
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                        borderWidth: 1.5,
                        borderColor: isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.5)',
                        elevation: 5,
                        opacity: pressed ? 0.98 : 1,
                        transform: [{ scale: (hovered && !isLocked) ? 1.02 : 1 }],
                        marginBottom: 12,
                        shadowColor: '#10b981',
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: isDark ? 0.2 : 0.1,
                        shadowRadius: 8,
                    }
                ]}
            >
                {isLocked && (
                    <View className={`absolute top-3 right-3 z-20 flex-row items-center px-2 py-1 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-600'}`}>
                        <Ionicons name="lock-closed" size={10} color="#fbbf24" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 9 * fontSizeScale, color: '#ffffff', fontWeight: '500' }}>{t('common.member_only_title')}</Text>
                    </View>
                )}

                {/* Background 워터마크 아이콘 */}
                <View className="absolute right-[-20px] top-[-20px] opacity-10" style={{ pointerEvents: 'none' }}>
                    <Ionicons name={getEventIcon(event.originalEventId || event.eventId) as any} size={140} color="#10b981" />
                </View>

                <View className="p-4 pl-5">
                    {/* 상단 타이틀 & 남은시간 묶음 */}
                    <View className="flex-row justify-between items-start mb-4">
                        <View className="flex-1 pr-2">
                            <View className="flex-row items-center mb-1.5">
                                <View className="px-1.5 py-0.5 rounded-[4px] bg-emerald-500 shadow-sm flex-row items-center">
                                    <View className="w-1.5 h-1.5 rounded-full bg-white mr-1 opacity-90" />
                                    <Text className="text-[9px] font-black uppercase tracking-wider text-white">ONGOING</Text>
                                </View>
                            </View>
                            <Text className={`font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 18 * fontSizeScale, lineHeight: 22 * fontSizeScale }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                                {renderEventTitle()}
                            </Text>
                        </View>

                        <View className="items-end pl-2">
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
                                        <View className="items-end">
                                            <View className="flex-row items-baseline mb-0.5">
                                                {d > 0 && <Text className={`font-black mr-1 tracking-tighter ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} style={{ fontSize: 15 * fontSizeScale }}>{d}{t('common.day_short')}</Text>}
                                                <Text className={`font-black tracking-widest tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} style={{ fontSize: 18 * fontSizeScale }}>{timeStr}</Text>
                                            </View>
                                            <Text className={`text-[9px] font-bold uppercase tracking-[0.2em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>REMAINING</Text>
                                        </View>
                                    );
                                }
                                return (
                                    <Text className="text-sm font-bold uppercase tracking-widest text-emerald-500">Active</Text>
                                );
                            })()}
                        </View>
                    </View>

                    {/* 하단 프로그레스 바 & 기간 */}
                    <View className="w-full">
                        {(() => {
                            // 날짜 문자열 파싱해서 실제 진행률(%) 계산
                            let progressPct = 100;
                            const parts = formattedDateRange.split(' ~ ');
                            if (parts.length === 2) {
                                const parseDatePattern = (str: string) => {
                                    const match = str.match(/(\d{2})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2})/);
                                    if (match) {
                                        return new Date(2000 + parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5])).getTime();
                                    }
                                    return 0;
                                };
                                const startMs = parseDatePattern(parts[0]);
                                const endMs = parseDatePattern(parts[1]);
                                if (startMs && endMs && now.getTime() >= startMs && now.getTime() <= endMs) {
                                    const totalDuration = endMs - startMs;
                                    const elapsed = now.getTime() - startMs;
                                    progressPct = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
                                }
                            }

                            return (
                                <>
                                    <View className={`w-full h-1.5 rounded-full overflow-hidden mb-2 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                        <View
                                            className="absolute left-0 top-0 bottom-0 bg-emerald-500 rounded-full"
                                            style={{ width: `${progressPct}%` }}
                                        />
                                    </View>
                                    <View className="flex-row items-center">
                                        <Ionicons name="time-outline" size={13} color={isDark ? '#cbd5e1' : '#64748b'} style={{ marginRight: 4 }} />
                                        {parts.length === 2 ? (
                                            <Text className={`font-medium tracking-tight ${isDark ? 'text-slate-300' : 'text-slate-600'}`} style={{ fontSize: 11 * fontSizeScale }}>
                                                {parts[0]} <Text className="text-slate-500 opacity-50 mx-1">➔</Text> {parts[1]}
                                            </Text>
                                        ) : (
                                            <Text className={`font-medium tracking-tight ${isDark ? 'text-slate-300' : 'text-slate-600'}`} style={{ fontSize: 11 * fontSizeScale }}>
                                                {formattedDateRange}
                                            </Text>
                                        )}
                                    </View>
                                </>
                            );
                        })()}
                    </View>
                </View>
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
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                    borderWidth: 1.5,
                    borderColor: isUpcomingSoon
                        ? '#38bdf8'
                        : (isExpired
                            ? (isDark ? 'rgba(100, 116, 139, 0.8)' : 'rgba(148, 163, 184, 0.8)')
                            : (isDark ? 'rgba(56, 189, 248, 0.5)' : 'rgba(59, 130, 246, 0.5)')),
                    opacity: pressed ? 0.98 : 1,
                    transform: [{ scale: (hovered && !isLocked) ? 1.02 : 1 }],
                }
            ]}
        >
            {isLocked && (
                <View className={`absolute top-3 right-3 z-20 flex-row items-center p-1.5 rounded-full ${isDark ? 'bg-slate-800/80' : 'bg-slate-500/80'}`}>
                    <Ionicons name="lock-closed" size={10} color="#fbbf24" />
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
                        <Text
                            className="flex-1 font-bold text-white"
                            style={{
                                fontSize: (windowWidth < 340 ? 13 : (windowWidth < 380 ? 15 : 18)) * fontSizeScale,
                                lineHeight: (windowWidth < 340 ? 17 : (windowWidth < 380 ? 19 : 22)) * fontSizeScale
                            }}
                            numberOfLines={2}
                            adjustsFontSizeToFit
                            minimumFontScale={0.7}
                        >
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
