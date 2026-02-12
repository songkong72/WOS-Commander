import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Image, Platform, ViewStyle, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface TimelineViewProps {
    events: any[];
    isDark: boolean;
    onEventPress: (event: any) => void;
    checkIsOngoing: (event: any) => boolean;
    timezone?: 'LOCAL' | 'UTC';
}

const TimelineView: React.FC<TimelineViewProps> = ({ events, isDark, onEventPress, checkIsOngoing, timezone = 'LOCAL' }) => {
    const [now, setNow] = useState(new Date());
    const [hoveredBarId, setHoveredBarId] = useState<string | null>(null);

    const pulseAnim = useRef(new Animated.Value(0.4)).current;
    const shimmerAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);

        // Pulse animation loop
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: false }),
                Animated.timing(pulseAnim, { toValue: 0.4, duration: 1200, useNativeDriver: false }),
            ])
        ).start();

        // Shimmer animation loop
        Animated.loop(
            Animated.timing(shimmerAnim, {
                toValue: 1,
                duration: 2500,
                useNativeDriver: false,
            })
        ).start();

        return () => clearInterval(timer);
    }, []);

    const dayMs = 24 * 60 * 60 * 1000;
    const totalMs = 7 * dayMs; // 7 days (exactly 1 week) to prevent day duplicates

    // Fixed Baseline calculation - Align to the start of the current week (Monday)
    const getBaseline = () => {
        const d = new Date(now.getTime());
        if (timezone === 'UTC') {
            d.setUTCHours(0, 0, 0, 0);
            const day = d.getUTCDay();
            const diff = day === 0 ? 6 : day - 1; // Since Monday (ISO)
            d.setUTCDate(d.getUTCDate() - diff);
        } else {
            d.setHours(0, 0, 0, 0);
            const day = d.getDay();
            const diff = day === 0 ? 6 : day - 1; // Since Monday
            d.setDate(d.getDate() - diff);
        }
        const start = d.getTime();
        const end = start + totalMs;
        return { start, end };
    };

    const { start: winStart, end: winEnd } = getBaseline();

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const KR_DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

    const formatTs = (ts: number) => {
        // Use an offset-based approach to ensure visibility of the change
        const d = new Date(ts);
        if (timezone === 'UTC') {
            // Force UTC display by using UTC methods which naturally show the 9-hour difference from KST
            const dw = d.getUTCDay();
            const dy = dayNames[dw];
            return `${d.getUTCDate()}일(${dy}) ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
        }
        const dw = d.getDay();
        const dy = dayNames[dw];
        return `${d.getDate()}일(${dy}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    // Core positioning logic used for EVERY bar
    const getPosList = (ev: any) => {
        const comb = ((ev.day || '') + ' ' + (ev.time || '')).trim();
        if (!comb || comb === '.') return [];
        const res: { st: number, et: number, isR: boolean, left: string, width: string, timeText: string, isWeekly?: boolean }[] = [];

        const add = (st: number, et: number, isR: boolean, isWeekly = false) => {
            const s = Math.max(st, winStart);
            const e = Math.min(et, winEnd);
            if (s < e) {
                const leftPct = (s - winStart) / totalMs * 100;
                // If it ends beyond the window, force it to fill up to 100%
                const widthPct = et >= winEnd ? (100 - leftPct) : ((e - s) / totalMs * 100);
                res.push({
                    st, et, isR, isWeekly,
                    left: `${leftPct.toFixed(4)}%`,
                    width: `${widthPct.toFixed(4)}%`,
                    timeText: isR ? `${formatTs(st)} ~ ${formatTs(et)}` : formatTs(st)
                });
            }
        };

        const parseDateVal = (dStr: string, tStr: string) => {
            const dp = dStr.trim().split(/[\.\-\/]/).map(Number);
            const tp = tStr.trim().split(':').map(Number);
            const cy = now.getFullYear();
            let y, m, d;
            if (dp.length === 3) { y = dp[0]; m = dp[1]; d = dp[2]; }
            else if (dp.length === 2) { y = cy; m = dp[0]; d = dp[1]; }
            else return null;
            const hh = tp[0], mm = tp[1] || 0;
            // ALWAYS parse as Local to keep the absolute time fixed, then let formatTs handle the timezone shift
            return new Date(y, m - 1, d, hh, mm, 0).getTime();
        };

        const getLocalStart = () => {
            const d = new Date(now);
            d.setHours(0, 0, 0, 0);
            const day = d.getDay();
            const diff = day === 0 ? 6 : day - 1;
            d.setDate(d.getDate() - diff);
            return d.getTime();
        };
        const localStart = getLocalStart();

        // 1. ISO/Fixed Range (e.g., 2026.02.13 09:00 ~ 2026.02.15 09:00)
        const mIsoRange = comb.match(/(\d{2,4}[\.\-\/]\d{1,2}[\.\-\/]\d{1,2})\s*(\d{1,2}:\d{2})\s*~\s*(\d{2,4}[\.\-\/]\d{1,2}[\.\-\/]\d{1,2})\s*(\d{1,2}:\d{2})/);
        if (mIsoRange) {
            const s = parseDateVal(mIsoRange[1], mIsoRange[2]), e = parseDateVal(mIsoRange[3], mIsoRange[4]);
            if (s && e) add(s, e, true);
        }
        else {
            const mIsoSingle = comb.match(/(\d{2,4}[\.\-\/]\d{1,2}[\.\-\/]\d{1,2})\s*(\d{1,2}:\d{2})/);
            if (mIsoSingle) {
                const s = parseDateVal(mIsoSingle[1], mIsoSingle[2]);
                if (s) add(s, s + 3600000, false); // Default 1 hour for better clickability
            }
        }

        // 2. Day-of-Month (fixed day but not ISO)
        const mDayRange = comb.match(/(\d{1,2})일(?:\s*(\d{1,2}:\d{2}))?\s*~\s*(\d{1,2})일(?:\s*(\d{1,2}:\d{2}))?/);
        if (mDayRange) {
            const sD = parseInt(mDayRange[1]), sT = mDayRange[2] || '00:00', eD = parseInt(mDayRange[3]), eT = mDayRange[4] || '23:59';
            const [sh, sm] = sT.split(':').map(Number), [eh, em] = eT.split(':').map(Number);
            for (let o = -1; o <= 1; o++) {
                const s = new Date(now.getFullYear(), now.getMonth() + o, sD, sh, sm, 0).getTime();
                let e = new Date(now.getFullYear(), now.getMonth() + o, eD, eh, em, 59).getTime();
                if (e < s) e = new Date(now.getFullYear(), now.getMonth() + o + 1, eD, eh, em, 59).getTime();
                add(s, e, true);
            }
        }
        else {
            const mDaySingle = comb.match(/(\d{1,2})일\s*(\d{1,2}:\d{2})/);
            if (mDaySingle) {
                const sD = parseInt(mDaySingle[1]), [sh, sm] = mDaySingle[2].split(':').map(Number);
                for (let o = -1; o <= 1; o++) {
                    const s = new Date(now.getFullYear(), now.getMonth() + o, sD, sh, sm, 0).getTime();
                    add(s, s + 3600000, false); // Default 1 hour
                }
            }
        }

        // 3. Recurring (Lowest Priority) - Only if not a range handled above
        const mRec = /(?:^|[^\d])([일월화수목금토]|[매일])\s*\(?(\d{1,2}:\d{2})\)?(?:\s*~\s*([일월화수목금토]|[매일])\s*\(?(\d{1,2}:\d{2})\)?)?/g;
        let match;
        while ((match = mRec.exec(comb)) !== null) {
            const sW = match[1], sT = match[2], eW = match[3] || sW, eT = match[4] || sT, isR = !!match[3];
            const [sh, sm] = sT.split(':').map(Number), [eh, em] = eT.split(':').map(Number);

            if (sW === '매일') {
                for (let i = 0; i < 8; i++) {
                    const st = localStart + i * dayMs + sh * 3600000 + sm * 60000;
                    let et = winStart + i * dayMs + eh * 3600000 + em * 60000;
                    if (isR && et <= st) et += dayMs;
                    add(st, isR ? et : st + 3600000, isR, true); // Default 1 hour for single recurring points
                }
            } else {
                const targetIdx = dayNames.indexOf(sW);
                if (targetIdx !== -1) {
                    for (let i = 0; i < 8; i++) {
                        const dAtWin = new Date(localStart + i * dayMs);
                        if (dAtWin.getDay() === targetIdx) {
                            const st = localStart + i * dayMs + sh * 3600000 + sm * 60000;
                            let et = winStart + i * dayMs + eh * 3600000 + em * 60000;
                            if (isR) {
                                if (eW !== sW) {
                                    const d = (dayNames.indexOf(eW) - dayNames.indexOf(sW) + 7) % 7;
                                    et += d * dayMs;
                                } else if (et <= st) et += dayMs;
                            }
                            add(st, isR ? et : st + 3600000, isR, true);
                        }
                    }
                }
            }
        }
        return res.sort((a, b) => a.st - b.st);
    };

    const expanded = useMemo(() => {
        const r: any[] = [];
        events.forEach((ev, globalIdx) => {
            const comb = ((ev.day || '') + ' ' + (ev.time || '')).trim();
            const baseId = ev.eventId || ev.id || `ev-${globalIdx}`;

            // Auto-infer category if missing
            let category = ev.category;
            if (!category || category === '기타') {
                const eid = (ev.originalEventId || ev.eventId || '').toLowerCase();
                const title = (ev.title || '').toLowerCase();

                // 1. Alliance Events (Prefix 'a' or specific keywords)
                if (eid.startsWith('a') || eid.includes('alliance') || eid.includes('bear') || eid.includes('operation') || eid.includes('joe') || eid.includes('fortress') || eid.includes('citadel') || eid.includes('foundry') || eid.includes('frost_league') || eid.includes('weapon') || title.includes('연맹') || title.includes('곰 사냥')) {
                    category = '연맹';
                }
                // 2. Server Events (Prefix 's' or specific keywords)
                else if (eid.startsWith('s') || eid.includes('server') || eid.includes('castle') || eid.includes('monument') || eid.includes('ke') || title.includes('서버') || title.includes('국왕') || title.includes('최강 영주')) {
                    category = '서버';
                }
                // 3. Personal Events (Prefix 'p' or specific keywords)
                else if (eid.startsWith('p') || eid.includes('personal') || eid.includes('growth') || eid.includes('hero') || eid.includes('gathering') || title.includes('개인') || title.includes('야수') || title.includes('영웅') || title.includes('훈련') || title.includes('채집') || title.includes('룰렛') || title.includes('광산') || title.includes('참전')) {
                    category = '개인';
                } else {
                    category = '기타';
                }
            }

            const isBearOrFoundry = baseId === 'a_bear' || baseId === 'alliance_bear' || baseId === 'a_foundry' || baseId === 'alliance_foundry';
            const parts = comb.split(/\s*\/\s*/).filter(p => p.trim());

            if ((isBearOrFoundry && parts.length > 1) || (comb.includes('1군:') && comb.includes('2군:'))) {
                parts.forEach((p, i) => {
                    const trimmed = p.trim();
                    const colonIdx = trimmed.indexOf(':');
                    let label = `${i + 1}군`;
                    let timePart = trimmed;

                    // Parse label if exists (e.g., "1군: ...")
                    if (colonIdx > -1) {
                        const before = trimmed.substring(0, colonIdx).trim();
                        const after = trimmed.substring(colonIdx + 1).trim();
                        // Check if it's NOT a time colon (like 22:00)
                        const isTimeColon = /\d$/.test(before) && /^\d/.test(after);
                        if (!isTimeColon) {
                            label = before;
                            timePart = after;
                        }
                    }

                    if (baseId.includes('bear')) {
                        label = i === 0 ? '곰1' : '곰2';
                    }

                    const subId = `${baseId}_t${i}_${globalIdx}`;
                    const sub = { ...ev, category, _original: ev, _teamIdx: i, id: subId, title: `${ev.title} (${label})`, time: timePart, day: ev.day };
                    const bars = getPosList(sub);
                    if (bars.length > 0) r.push({ ...sub, _bars: bars });
                });
            } else {
                const bars = getPosList(ev);
                if (bars.length > 0) {
                    const uniqueId = `${baseId}_${globalIdx}`;
                    r.push({ ...ev, category, _original: ev, id: uniqueId, _bars: bars });
                }
            }
        });
        return r;
    }, [events, winStart, winEnd, timezone]);

    const grouped = useMemo(() => {
        const g: any = {};
        expanded.forEach(e => {
            const c = e.category || '기타';
            if (!g[c]) g[c] = [];
            g[c].push(e);
        });
        return g;
    }, [expanded]);

    const weekDaysArr = [];
    for (let i = 0; i < 7; i++) weekDaysArr.push(new Date(winStart + i * dayMs));

    const indicatorLeft = `${((now.getTime() - winStart) / totalMs * 100).toFixed(4)}%`;

    return (
        <View style={{ flex: 1 }} className={isDark ? 'bg-[#0f172a]' : 'bg-[#f1f5f9]'}>
            <LinearGradient colors={['#38bdf8', '#0284c7']} className="py-2.5 px-4 flex-row items-center justify-between shadow-md">
                <View style={{ width: 80 }} />
                <Text className="text-white font-black text-[11px] uppercase tracking-widest text-center shadow-lg">
                    {`${timezone} : ${timezone === 'UTC' ? now.toISOString().replace('T', ' ').substring(0, 19).replace(/-/g, '.') : `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`}`}
                </Text>
                <View className="bg-white/20 px-2 py-0.5 rounded-full border border-white/30">
                    <Text className="text-white text-[7px] font-black tracking-tighter">[v23-WEEK-START-MON]</Text>
                </View>
            </LinearGradient>

            <View className={`flex-row py-4 ${isDark ? 'bg-slate-900/50' : 'bg-white'} border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                {weekDaysArr.map((d, i) => {
                    const isToday = timezone === 'LOCAL' ? d.toDateString() === now.toDateString() : d.getUTCDate() === now.getUTCDate() && d.getUTCMonth() === now.getUTCMonth() && d.getUTCFullYear() === now.getUTCFullYear();
                    const dIdx = timezone === 'UTC' ? d.getUTCDay() : d.getDay();
                    const dv = timezone === 'UTC' ? d.getUTCDate() : d.getDate();
                    const mv = (timezone === 'UTC' ? d.getUTCMonth() : d.getMonth()) + 1;
                    return (
                        <View key={`day-header-${i}`} className="flex-1 items-center">
                            <View className={`items-center px-3 py-1.5 rounded-2xl ${isToday ? 'bg-[#f97316] shadow-md scale-105' : ''}`}>
                                <Text className={`text-[9px] font-bold ${isToday ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{KR_DAYS[dIdx].substring(0, 3)}</Text>
                                <Text className={`text-[12px] font-black ${isToday ? 'text-white' : (isDark ? 'text-slate-300' : 'text-slate-600')}`}>{mv}/{dv}</Text>
                            </View>
                            {isToday && <View className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1 shadow-sm" />}
                        </View>
                    );
                })}
            </View>

            <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 60 }}>
                <View className="absolute inset-x-0 top-0 bottom-0 flex-row pointer-events-none">
                    {[...Array(7)].map((_, i) => (
                        <View key={`grid-line-${i}`} className="flex-1 border-r border-sky-500/10" />
                    ))}
                </View>

                {['연맹', '서버', '개인', '기타'].map((ck, idx) => {
                    const evs = grouped[ck];
                    if (!evs || evs.length === 0) return null;
                    const cfg = (() => {
                        switch (ck) {
                            case '연맹': return { label: '연맹 이벤트', gradient: ['#f43f5e', '#9f1239'] as [string, string] }; // Vibrant Rose to Deep Crimson
                            case '서버': return { label: '서버 이벤트', gradient: ['#3b82f6', '#1e40af'] as [string, string] }; // Royal Blue to Deep Navy
                            case '개인': return { label: '개인 이벤트', gradient: ['#eab308', '#a16207'] as [string, string] }; // Golden Amber to Brown Gold
                            default: return { label: '기타 이벤트', gradient: ['#64748b', '#334155'] as [string, string] }; // Sleek Slate to Navy Gray
                        }
                    })();
                    return (
                        <View key={`cat-${ck}-${idx}`} className="mb-6">
                            <Text key={`cat-label-${ck}`} className={`text-[11px] font-black mb-2 px-4 uppercase tracking-wide ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{cfg.label}</Text>
                            {evs.map((ev: any, evIdx: number) => {
                                const isTopRow = ck === '연맹' && evIdx < 2;
                                const isRowHovered = hoveredBarId?.startsWith(ev.id);
                                return (
                                    <View
                                        key={`${ev.id}-${ck}-${evIdx}`}
                                        className="h-10 relative mb-2 justify-center"
                                        style={{ zIndex: isRowHovered ? 1000 : 1 }}
                                    >
                                        <View key={`rail-${ev.id}`} className={`absolute inset-x-0 h-8 rounded-lg ${isDark ? 'bg-slate-800/40' : 'bg-slate-200/60'}`} />
                                        {ev._bars.map((p: any, bi: number) => {
                                            const barKey = `bar-${ev.id}-${bi}`;
                                            const isHovered = hoveredBarId === barKey;
                                            const isActive = checkIsOngoing(ev._original || ev);
                                            return (
                                                <View
                                                    key={barKey}
                                                    className="absolute h-10 py-1"
                                                    style={{
                                                        left: p.left,
                                                        width: p.width,
                                                        zIndex: isHovered ? 999 : 10
                                                    }}
                                                >
                                                    <Pressable
                                                        onPress={() => onEventPress(ev)}
                                                        className="w-full h-full"
                                                        // @ts-ignore
                                                        onMouseEnter={() => setHoveredBarId(barKey)}
                                                        // @ts-ignore
                                                        onMouseLeave={() => setHoveredBarId(null)}
                                                    >
                                                        {({ hovered }: any) => {
                                                            const activeHover = hovered || isHovered;
                                                            return (
                                                                <View key="bar-inner-wrap" className="w-full h-full" style={{ overflow: 'visible' }}>
                                                                    {/* Floating Icon OUTSIDE: for short bars (<= 1 hour) OR Castle Battle */}
                                                                    {(p.et - p.st <= 3600000 || (ev.id && ev.id.includes('castle'))) && (
                                                                        <View
                                                                            key="floating-icon"
                                                                            pointerEvents="none"
                                                                            style={{
                                                                                position: 'absolute',
                                                                                left: -32,
                                                                                top: 4,
                                                                                zIndex: 150,
                                                                                shadowColor: '#000',
                                                                                shadowOffset: { width: 0, height: 2 },
                                                                                shadowOpacity: 0.4,
                                                                                shadowRadius: 4,
                                                                                // @ts-ignore
                                                                                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
                                                                            } as any}
                                                                        >
                                                                            <View className={`w-6 h-6 rounded-full items-center justify-center border-2 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                                                {!!ev.imageUrl ? (
                                                                                    <Image
                                                                                        source={typeof ev.imageUrl === 'string' ? { uri: ev.imageUrl } : ev.imageUrl}
                                                                                        className="w-4 h-4 rounded-full"
                                                                                    />
                                                                                ) : (
                                                                                    <Text style={{ fontSize: 10 }}>📅</Text>
                                                                                )}
                                                                            </View>
                                                                        </View>
                                                                    )}

                                                                    <Animated.View
                                                                        style={{
                                                                            flex: 1,
                                                                            borderRadius: 8,
                                                                            overflow: 'hidden',
                                                                            transform: [{ scale: activeHover ? 1.02 : (isActive ? 1.01 : 1) }],
                                                                            borderWidth: isActive ? 2 : 0,
                                                                            borderColor: isActive ? pulseAnim.interpolate({
                                                                                inputRange: [0.4, 1],
                                                                                outputRange: ['rgba(255,255,255,0.3)', 'rgba(255,255,255,1)']
                                                                            }) : 'transparent',
                                                                            // @ts-ignore
                                                                            boxShadow: isActive ? pulseAnim.interpolate({
                                                                                inputRange: [0.4, 1],
                                                                                outputRange: ['0 0 5px rgba(255,255,255,0.2)', '0 0 20px rgba(255,255,255,0.6)']
                                                                            }) : 'none'
                                                                        } as any}
                                                                    >
                                                                        <LinearGradient
                                                                            colors={cfg.gradient}
                                                                            start={{ x: 0, y: 0 }}
                                                                            end={{ x: 1, y: 0 }}
                                                                            className="h-full flex-row items-center px-3 shadow-lg"
                                                                        >
                                                                            {/* Icon INSIDE: only for long bars (> 1 hour) AND NOT Castle Battle */}
                                                                            {(p.et - p.st > 3600000 && !(ev.id && ev.id.includes('castle'))) && (
                                                                                <View key="icon-wrap" className="w-5 h-5 rounded-full bg-white/30 items-center justify-center mr-2 shadow-sm">
                                                                                    {!!ev.imageUrl && <Image source={typeof ev.imageUrl === 'string' ? { uri: ev.imageUrl } : ev.imageUrl} className="w-3.5 h-3.5 rounded-full" />}
                                                                                </View>
                                                                            )}
                                                                            <Text key="title-text" className="text-white font-black text-[10px] flex-1" numberOfLines={1}>{ev.title}</Text>
                                                                            {isActive && (
                                                                                <View key="live-badge" className="flex-row items-center bg-white/20 px-1.5 py-0.5 rounded-md ml-1 border border-white/30">
                                                                                    <Text key="live-text" className="text-[8px] text-white font-black tracking-tighter">LIVE</Text>
                                                                                </View>
                                                                            )}

                                                                            {/* Dynamic Shimmer Effect Overlay */}
                                                                            {isActive && (
                                                                                <Animated.View
                                                                                    style={{
                                                                                        position: 'absolute',
                                                                                        top: 0,
                                                                                        bottom: 0,
                                                                                        width: '40%',
                                                                                        left: shimmerAnim.interpolate({
                                                                                            inputRange: [0, 1],
                                                                                            outputRange: ['-100%', '200%']
                                                                                        }),
                                                                                        opacity: 0.3
                                                                                    }}
                                                                                >
                                                                                    <LinearGradient
                                                                                        colors={['transparent', 'rgba(255,255,255,0.5)', 'transparent']}
                                                                                        start={{ x: 0, y: 0 }}
                                                                                        end={{ x: 1, y: 0 }}
                                                                                        style={{ flex: 1 }}
                                                                                    />
                                                                                </Animated.View>
                                                                            )}
                                                                        </LinearGradient>
                                                                    </Animated.View>
                                                                    {activeHover && Platform.OS === 'web' && (
                                                                        <View
                                                                            className={`absolute ${isTopRow ? 'top-10' : '-top-28'} border border-white/20 p-4 rounded-2xl shadow-2xl z-[200]`}
                                                                            style={{
                                                                                minWidth: 220,
                                                                                pointerEvents: 'none',
                                                                                backgroundColor: '#0f172a', // Solid Opaque
                                                                                left: parseFloat(p.left) > 70 ? 'auto' : 0,
                                                                                right: parseFloat(p.left) > 70 ? 0 : 'auto'
                                                                            }}
                                                                        >
                                                                            <View className="flex-row items-center mb-3">
                                                                                <View className="w-6 h-6 rounded-full bg-white/10 items-center justify-center mr-2.5">
                                                                                    {!!ev.imageUrl && <Image source={typeof ev.imageUrl === 'string' ? { uri: ev.imageUrl } : ev.imageUrl} className="w-4 h-4 rounded-full" />}
                                                                                </View>
                                                                                <Text className="text-white font-black text-[14px]">{ev.title}</Text>
                                                                            </View>
                                                                            <View className="gap-2">
                                                                                {[...ev._bars].sort((a, b) => a.st - b.st).map((b: any, i: number) => (
                                                                                    <View key={`tt-bar-${ev.id}-${i}`} className="flex-row items-center">
                                                                                        <View className={`w-1.5 h-1.5 rounded-full mr-3 ${b.st === p.st ? 'bg-orange-500' : 'bg-slate-700'}`} />
                                                                                        <Text className={`text-[12px] ${b.st === p.st ? 'text-orange-300 font-bold' : 'text-slate-400 font-medium'}`}>
                                                                                            {formatTs(b.st)}{b.isR ? ` ~ ${formatTs(b.et)}` : ''}
                                                                                        </Text>
                                                                                    </View>
                                                                                ))}
                                                                            </View>
                                                                            <View
                                                                                className={`absolute ${isTopRow ? '-top-1.5 border-l border-t' : '-bottom-1.5 border-r border-b'} w-3 h-3 border-white/20 transform rotate-45`}
                                                                                style={{
                                                                                    backgroundColor: '#0f172a', // Solid Opaque
                                                                                    left: parseFloat(p.left) > 70 ? 'auto' : 18,
                                                                                    right: parseFloat(p.left) > 70 ? 18 : 'auto'
                                                                                }}
                                                                            />
                                                                        </View>
                                                                    )}
                                                                </View>
                                                            );
                                                        }}
                                                    </Pressable>
                                                </View>
                                            );
                                        })}
                                    </View>
                                );
                            })}
                        </View>
                    );
                })}

                <View key="indicator" className="absolute top-0 bottom-0 w-[3px] bg-orange-500 z-50 pointer-events-none" style={{ left: indicatorLeft } as ViewStyle}>
                    <View key="indicator-dot" className="w-5 h-5 rounded-full bg-orange-500 -ml-[8.5px] -mt-2.5 border-2 border-white shadow-2xl items-center justify-center">
                        <View key="indicator-inner" className="w-2 h-2 rounded-full bg-white" />
                    </View>
                    <View key="indicator-glow" className="absolute h-full w-[10px] -left-[3.5px] bg-orange-500/25" />
                </View>
            </ScrollView>
        </View>
    );
};

export default TimelineView;
