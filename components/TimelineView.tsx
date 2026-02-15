import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Pressable, Image, Platform, ViewStyle, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../app/context';

interface TimelineViewProps {
    events: any[];
    isDark: boolean;
    onEventPress: (event: any) => void;
    checkIsOngoing: (event: any) => boolean;
    timezone?: 'LOCAL' | 'UTC';
}

const TimelineView: React.FC<TimelineViewProps> = ({ events, isDark, onEventPress, checkIsOngoing, timezone = 'LOCAL' }) => {
    const { t } = useTranslation();
    const { language } = useLanguage();
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
            // 오늘이 3번째 위치에 오도록 2일 전부터 시작
            d.setUTCDate(d.getUTCDate() - 2);
        } else {
            d.setHours(0, 0, 0, 0);
            // 오늘이 3번째 위치에 오도록 2일 전부터 시작
            d.setDate(d.getDate() - 2);
        }
        const start = d.getTime();
        const end = start + totalMs;
        return { start, end };
    };

    const { start: winStart, end: winEnd } = getBaseline();

    const dayNames = [
        t('events.days.sun'), t('events.days.mon'), t('events.days.tue'), t('events.days.wed'),
        t('events.days.thu'), t('events.days.fri'), t('events.days.sat')
    ];
    // Fixed Korean day names for internal parsing logic (since data source uses Korean)
    const KR_DAYS_PARSER = ['일', '월', '화', '수', '목', '금', '토'];

    const formatTs = (ts: number) => {
        const d = new Date(ts);
        if (timezone === 'UTC') {
            const dw = d.getUTCDay();
            const dy = dayNames[dw];
            return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${dy}) ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
        }
        const dw = d.getDay();
        const dy = dayNames[dw];
        return `${d.getMonth() + 1}/${d.getDate()}(${dy}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    // Core positioning logic used for EVERY bar
    const getPosList = (ev: any) => {
        // Check for startDate first (one-time events)
        const startDate = ev.startDate;
        if (startDate) {
            // Convert startDate to a format the timeline can process
            // Extract first time from the time field
            const timeStr = ev.time || '00:00';
            const timeMatch = timeStr.match(/(\d{2}):(\d{2})/);
            const finalTime = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '00:00';

            // Override fullComb to use the specific date instead of day-of-week
            const specificDateComb = `${startDate.replace(/-/g, '.')} ${finalTime}`;

            // Check if this date is within the timeline window
            const eventDate = new Date(`${startDate}T${finalTime}:00`);
            const eventTime = eventDate.getTime();

            // If event is outside the timeline window, don't show it
            if (eventTime + 3600000 < winStart || eventTime > winEnd) {
                return [];
            }

            // Let the ISO single date parser handle it
            const fullComb = specificDateComb;
            const res: { st: number, et: number, isR: boolean, left: string, width: string, timeText: string, isWeekly?: boolean, label?: string }[] = [];

            const parseDateVal = (dStr: string, tStr: string) => {
                if (!dStr) return null;
                const dp = dStr.replace(/\([^)]+\)/g, '').trim().split(/[.\-/]/).map(s => parseInt(s.trim()));
                const tp = (tStr || '00:00').trim().split(':').map(Number);
                let y, m, d;
                if (dp.length === 3) { y = dp[0]; m = dp[1]; d = dp[2]; }
                else return null;
                if (y < 100) y += 2000;
                const hh = tp[0], mm = tp[1] || 0;
                return new Date(y, m - 1, d, hh, mm, 0).getTime();
            };

            const mIsoSingle = fullComb.match(/(\d{2,4}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2})\s*(?:\([^)]+\))?\s*(\d{1,2}:\d{2})?/);
            if (mIsoSingle) {
                const sDate = mIsoSingle[1];
                const sTime = mIsoSingle[2] || '00:00';
                const st = parseDateVal(sDate, sTime);
                if (st) {
                    const duration = 3600000; // 1 hour
                    const et = st + duration;
                    const s = Math.max(st, winStart);
                    const e = Math.min(et, winEnd);
                    if (s < e) {
                        const leftPct = (s - winStart) / totalMs * 100;
                        const widthPct = et >= winEnd ? (100 - leftPct) : ((e - s) / totalMs * 100);
                        res.push({
                            st, et, isR: true,
                            left: `${leftPct.toFixed(4)}%`,
                            width: `${widthPct.toFixed(4)}%`,
                            timeText: `${formatTs(st)} ~ ${formatTs(et)}`
                        });
                    }
                }
            }

            return res;
        }

        const fullComb = ((ev.day || '') + ' ' + (ev.time || '')).trim();
        if (!fullComb || fullComb === '.') return [];

        // Bear Hunt weekly rotation logic
        // User registers ONE day/time (e.g., "월 22:00")
        // System generates 4 events per week at +0, +2, +4, +6 days from base
        // Each week, the base shifts by +1 day
        // Week 0: Mon(+0), Wed(+2), Fri(+4), Sun(+6) → Week 1: Tue(+0), Thu(+2), Sat(+4), Mon(+6)
        let processedComb = fullComb;
        const eventId = ev.id || ev.eventId || '';
        const isBearHunt = eventId.includes('bear') || eventId.includes('Bear');

        if (isBearHunt) {
            const updatedAt = ev.updatedAt || ev._original?.updatedAt;
            if (updatedAt) {
                // Extract the registered time
                const timeMatch = fullComb.match(/(\d{1,2}):(\d{2})/);

                if (timeMatch) {
                    const time = timeMatch[0];

                    // Get the saved date (when the schedule was registered)
                    const savedDate = new Date(updatedAt);
                    savedDate.setHours(0, 0, 0, 0);

                    // Generate all dates within timeline range at +2 day intervals
                    const dayNames = [];
                    let currentDate = savedDate.getTime();
                    const rangeStart = winStart - dayMs; // Include 1 day before
                    const rangeEnd = winEnd + dayMs; // Include 1 day after

                    // Iterate with +2 day intervals
                    while (currentDate < rangeEnd) {
                        if (currentDate >= rangeStart && currentDate <= rangeEnd) {
                            const d = new Date(currentDate);
                            const dayName = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
                            dayNames.push(dayName);
                        }
                        currentDate += 2 * dayMs; // +2 days
                    }

                    // Reconstruct as comma-separated days with single time
                    // e.g., "금, 일, 화, 목 22:00" → will be parsed by Multi-Day Single Time logic
                    if (dayNames.length > 0) {
                        processedComb = `${dayNames.join(', ')} ${time}`;
                    }
                }
            }
        }

        const res: { st: number, et: number, isR: boolean, left: string, width: string, timeText: string, isWeekly?: boolean, label?: string }[] = [];

        const getLocalStart = () => {
            // Use winStart instead of calculating week start
            // to ensure bars are generated within the timeline range
            return winStart;
        };
        const localStart = getLocalStart();

        // Split by '/' to handle multiple distinct time slots in one line
        const parts = processedComb.split(/\s*\/\s*/).filter(p => p.trim());

        parts.forEach(part => {
            const partBars: { st: number, et: number, isR: boolean, isWeekly: boolean, matchedStr: string }[] = [];

            const add = (st: number, et: number, isR: boolean, matchedStr: string, isWeekly = false) => {
                const s = Math.max(st, winStart);
                const e = Math.min(et, winEnd);
                if (s < e) {
                    partBars.push({ st, et, isR, isWeekly, matchedStr });
                }
            };

            const parseDateVal = (dStr: string, tStr: string) => {
                if (!dStr) return null;
                const dp = dStr.replace(/\([^)]+\)/g, '').trim().split(/[.\-/]/).map(s => parseInt(s.trim()));
                const tp = (tStr || '00:00').trim().split(':').map(Number);
                const cy = now.getFullYear();
                let y, m, d;
                if (dp.length === 3) { y = dp[0]; m = dp[1]; d = dp[2]; }
                else if (dp.length === 2) { y = cy; m = dp[0]; d = dp[1]; }
                else return null;

                // Ensure 2-digit years are handled (e.g., 26.02.15)
                if (y < 100) y += 2000;

                const hh = tp[0], mm = tp[1] || 0;
                return new Date(y, m - 1, d, hh, mm, 0).getTime();
            };

            // 0. Explicit Comma-Separated List (Priority for Fortress/Citadel)
            // e.g., "요새전: 요새7 금 23:00, 요새10 금 23:00"
            if (part.includes(',') && /[월화수목금토일]\s*\d{2}:\d{2}/.test(part)) {
                const subParts = part.split(',');
                let specificHandled = false;

                subParts.forEach(sp => {
                    const cleanSp = sp.trim().replace(/^.*(요새전|성채전|Fortress|Citadel)[:\s：]*/, '').trim();
                    const match = cleanSp.match(/(.+?)\s+([월화수목금토일])\s*(\d{2}:\d{2})/);

                    if (match) {
                        specificHandled = true;
                        const label = match[1].trim();
                        const dayStr = match[2];
                        const timeStr = match[3];

                        const targetIdx = KR_DAYS_PARSER.indexOf(dayStr);
                        if (targetIdx !== -1) {
                            const [sh, sm] = timeStr.split(':').map(Number);
                            for (let i = 0; i < 8; i++) {
                                const dAtWin = new Date(localStart + i * dayMs);
                                if (dAtWin.getDay() === targetIdx) {
                                    const st = localStart + i * dayMs + sh * 3600000 + sm * 60000;
                                    // Bear Hunt: 30 minutes, Others: 1 hour
                                    const duration = isBearHunt ? 1800000 : 3600000;
                                    const et = st + duration;

                                    // Add directly to res
                                    const s = Math.max(st, winStart);
                                    const e = Math.min(et, winEnd);
                                    if (s < e) {
                                        const leftPct = (s - winStart) / totalMs * 100;
                                        const widthPct = et >= winEnd ? (100 - leftPct) : ((e - s) / totalMs * 100);
                                        res.push({
                                            st, et, isR: true, isWeekly: true,
                                            left: `${leftPct.toFixed(4)}%`,
                                            width: `${widthPct.toFixed(4)}%`,
                                            timeText: `${formatTs(st)} ~ ${formatTs(et)}`,
                                            label: label
                                        });
                                    }
                                }
                            }
                        }
                    }
                });

                if (specificHandled) return; // Skip generic parsers
            }

            // 1. ISO/Fixed Range (e.g., 2026.02.13 09:00 ~ 2026.02.15 09:00 or 2026.02.13(금) ~ 02.15(일))
            // This regex handles: optional years, dots/dashes/slashes, optional day-of-week in parens, and optional times
            const mIsoRange = part.match(/(\d{2,4}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2})\s*(?:\([^)]+\))?\s*(\d{1,2}:\d{2})?\s*~\s*(\d{2,4}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2})?\s*(?:\([^)]+\))?\s*(\d{1,2}:\d{2})?/);
            if (mIsoRange) {
                const sDate = mIsoRange[1];
                const sTime = mIsoRange[2] || '00:00';
                const eRawDate = mIsoRange[3];
                const eTime = mIsoRange[4] || '23:59';

                const s = parseDateVal(sDate, sTime);
                // If end date is missing (e.g. "2026.01.01 09:00 ~ 11:00"), use start date
                const e = parseDateVal(eRawDate || sDate, eTime);

                if (s && e) add(s, e, true, mIsoRange[0]);
            }
            else {
                const mIsoSingle = part.match(/(\d{2,4}[.\-/]\s*\d{1,2}[.\-/]\s*\d{1,2})\s*(?:\([^)]+\))?\s*(\d{1,2}:\d{2})?/);
                if (mIsoSingle) {
                    const s = parseDateVal(mIsoSingle[1], mIsoSingle[2] || '00:00');
                    if (s) add(s, s + 3600000, false, mIsoSingle[0]);
                }
            }

            // 2. Day-of-Month (fixed day but not ISO)
            const mDayRange = part.match(/(\d{1,2})일(?:\s*(\d{1,2}:\d{2}))?\s*~\s*(\d{1,2})일(?:\s*(\d{1,2}:\d{2}))?/);
            if (mDayRange) {
                const sD = parseInt(mDayRange[1]), sT = mDayRange[2] || '00:00', eD = parseInt(mDayRange[3]), eT = mDayRange[4] || '23:59';
                const [sh, sm] = sT.split(':').map(Number), [eh, em] = eT.split(':').map(Number);
                for (let o = -1; o <= 1; o++) {
                    const s = new Date(now.getFullYear(), now.getMonth() + o, sD, sh, sm, 0).getTime();
                    let e = new Date(now.getFullYear(), now.getMonth() + o, eD, eh, em, 59).getTime();
                    if (e < s) e = new Date(now.getFullYear(), now.getMonth() + o + 1, eD, eh, em, 59).getTime();
                    add(s, e, true, mDayRange[0]);
                }
            }
            else {
                const mDaySingle = part.match(/(\d{1,2})일\s*(\d{1,2}:\d{2})/);
                if (mDaySingle) {
                    const sD = parseInt(mDaySingle[1]), [sh, sm] = mDaySingle[2].split(':').map(Number);
                    for (let o = -1; o <= 1; o++) {
                        const s = new Date(now.getFullYear(), now.getMonth() + o, sD, sh, sm, 0).getTime();
                        add(s, s + 3600000, false, mDaySingle[0]);
                    }
                }
            }

            // 2.5 Multi-Day Single Time (e.g., "월, 화, 수 22:00")
            // This handles cases where multiple days share one time, preventing the "unused days" from becoming a label.
            let handledByMultiDay = false;
            const mMultiDay = part.match(/([일월화수목금토](?:\s*,\s*[일월화수목금토])+)\s*(\d{1,2}:\d{2})/);
            if (mMultiDay) {
                handledByMultiDay = true;
                const daysStr = mMultiDay[1];
                const timeStr = mMultiDay[2];
                const days = daysStr.split(',').map(d => d.trim());
                const [sh, sm] = timeStr.split(':').map(Number);

                days.forEach(dName => {
                    const targetIdx = KR_DAYS_PARSER.indexOf(dName);
                    if (targetIdx !== -1) {
                        for (let i = 0; i < 8; i++) {
                            const dAtWin = new Date(localStart + i * dayMs);
                            if (dAtWin.getDay() === targetIdx) {
                                const st = localStart + i * dayMs + sh * 3600000 + sm * 60000;
                                // Bear Hunt: 30 minutes, Others: 1 hour
                                const duration = isBearHunt ? 1800000 : 3600000;
                                const et = st + duration;
                                add(st, et, true, mMultiDay[0]);
                            }
                        }
                    }
                });
            }

            // 3. Recurring (Lowest Priority) - Only if not already handled by Multi-Day
            if (!handledByMultiDay) {
                const mRec = /(?:^|[^\d])([일월화수목금토]|[매일])\s*\(?(\d{1,2}:\d{2})\)?(?:\s*~\s*([일월화수목금토]|[매일])\s*\(?(\d{1,2}:\d{2})\)?)?/g;
                let match;
                while ((match = mRec.exec(part)) !== null) {
                    const sW = match[1], sT = match[2], eW = match[3] || sW, eT = match[4] || sT, isR = !!match[3];
                    const [sh, sm] = sT.split(':').map(Number), [eh, em] = eT.split(':').map(Number);

                    if (sW === '매일') {
                        for (let i = 0; i < 8; i++) {
                            const st = localStart + i * dayMs + sh * 3600000 + sm * 60000;
                            let et = winStart + i * dayMs + eh * 3600000 + em * 60000;
                            if (isR && et <= st) et += dayMs;
                            const duration = isBearHunt ? 1800000 : 3600000;
                            add(st, isR ? et : st + duration, isR, match![0], true);
                        }
                    } else {
                        const targetIdx = KR_DAYS_PARSER.indexOf(sW);
                        if (targetIdx !== -1) {
                            for (let i = 0; i < 8; i++) {
                                const dAtWin = new Date(localStart + i * dayMs);
                                if (dAtWin.getDay() === targetIdx) {
                                    const st = localStart + i * dayMs + sh * 3600000 + sm * 60000;
                                    let et = winStart + i * dayMs + eh * 3600000 + em * 60000;
                                    if (isR) {
                                        if (eW !== sW) {
                                            const d = (KR_DAYS_PARSER.indexOf(eW) - KR_DAYS_PARSER.indexOf(sW) + 7) % 7;
                                            et += d * dayMs;
                                        } else if (et <= st) et += dayMs;
                                    }
                                    const duration = isBearHunt ? 1800000 : 3600000;
                                    add(st, isR ? et : st + duration, isR, match![0], true);
                                }
                            }
                        }
                    }
                }
            } // End of: if (!handledByMultiDay)

            // Calculate label for this part (remove matched date strings)
            let label = part;
            // Remove all unique matched strings
            const uniqueMatches = Array.from(new Set(partBars.map(b => b.matchedStr)));
            uniqueMatches.forEach(mStr => {
                label = label.replace(mStr, '').trim();
            });
            // Cleanup common prefixes/punctuation (e.g., "Fortress: Fortress7" -> "Fortress7")
            label = label.replace(/.*(요새전|성채전|Fortress|Citadel)[:\s：]*/g, '').replace(/^[:，,：\-\s]+/, '').replace(/[:，,：\-\s]+$/, '').trim();

            // Filter out redundant day labels (e.g. "화, 목", "월, 화, 수", "월,화,수,목,금,토(22:00)")
            const isDayTimeLabel = label && /^[일월화수목금토\s,]+(\(\d{1,2}:\d{2}\))?$/.test(label);
            if (isDayTimeLabel) label = '';

            partBars.forEach(b => {
                const s = Math.max(b.st, winStart);
                const e = Math.min(b.et, winEnd);
                const leftPct = (s - winStart) / totalMs * 100;
                const widthPct = b.et >= winEnd ? (100 - leftPct) : ((e - s) / totalMs * 100);

                res.push({
                    st: b.st,
                    et: b.et,
                    isR: b.isR,
                    isWeekly: b.isWeekly,
                    left: `${leftPct.toFixed(4)}%`,
                    width: `${widthPct.toFixed(4)}%`,
                    timeText: b.isR ? `${formatTs(b.st)} ~ ${formatTs(b.et)}` : formatTs(b.st),
                    label: label || undefined
                });
            });

        });
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
                const lowTitle = (ev.title || '').toLowerCase();
                const lowEid = (ev.originalEventId || ev.eventId || '').toLowerCase();

                // 1. Alliance Events
                if (lowEid.startsWith('a') || lowEid.includes('alliance') || lowEid.includes('bear') || lowEid.includes('operation') || lowEid.includes('joe') || lowEid.includes('fortress') || lowEid.includes('citadel') || lowEid.includes('foundry') || lowEid.includes('frost_league') || lowEid.includes('weapon') || lowTitle.includes('연맹') || lowTitle.includes('곰 사냥') || lowTitle.includes('성채') || lowTitle.includes('요새') || lowTitle.includes('fortress') || lowTitle.includes('citadel')) {
                    category = '연맹';
                }
                // 2. Server Events
                else if (lowEid.startsWith('s') || lowEid.includes('server') || lowEid.includes('castle') || lowEid.includes('monument') || lowEid.includes('ke') || lowTitle.includes('서버') || lowTitle.includes('국왕') || lowTitle.includes('최강 영주') || lowTitle.includes('왕성')) {
                    category = '서버';
                }
                // 3. Personal Events
                else if (lowEid.startsWith('p') || lowEid.includes('personal') || lowEid.includes('growth') || lowEid.includes('hero') || lowEid.includes('gathering') || lowTitle.includes('개인') || lowTitle.includes('야수') || lowTitle.includes('영웅') || lowTitle.includes('훈련') || lowTitle.includes('채집') || lowTitle.includes('룰렛') || lowTitle.includes('광산') || lowTitle.includes('참전')) {
                    category = '개인';
                } else {
                    category = '기타';
                }
            }

            const isBearOrFoundry = baseId === 'a_bear' || baseId === 'alliance_bear' || baseId === 'a_foundry' || baseId === 'alliance_foundry';
            const parts = comb.split(/\s*\/\s*/).filter(p => p.trim());

            if ((isBearOrFoundry && parts.length > 1) || (comb.includes('1군:') && comb.includes('2군:')) || (comb.includes('Team1:') && comb.includes('Team2:'))) {
                parts.forEach((p, i) => {
                    const trimmed = p.trim();
                    const colonIdx = trimmed.indexOf(':');
                    let label = i === 0 ? t('events.team1') : t('events.team2');
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
                        label = i === 0 ? t('events.bear1') : t('events.bear2');
                    }

                    const subId = `${baseId}_t${i}_${globalIdx}`;
                    const translatedTitle = t(`events.${baseId}_title`, { defaultValue: ev.title });
                    const sub = { ...ev, category, _original: ev, _teamIdx: i, id: subId, title: `${translatedTitle} (${label})`, time: timePart, day: ev.day };
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

    const ongoingCount = useMemo(() => {
        return events.filter(ev => checkIsOngoing(ev)).length;
    }, [events, checkIsOngoing, now]);

    const indicatorLeft = `${((now.getTime() - winStart) / totalMs * 100).toFixed(4)}%`;

    return (
        <View style={{ flex: 1 }} className={isDark ? 'bg-[#0f172a]' : 'bg-[#f1f5f9]'}>
            <LinearGradient colors={['#38bdf8', '#0284c7']} className="py-2.5 px-4 flex-row items-center justify-between shadow-md">
                <View style={{ width: 80 }} />
                <Text className="text-white font-black text-[11px] uppercase tracking-widest text-center shadow-lg">
                    {`${timezone} : ${timezone === 'UTC' ? now.toISOString().replace('T', ' ').substring(0, 19).replace(/-/g, '.') : `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`}`}
                </Text>
                <View className={`${ongoingCount > 0 ? 'bg-emerald-500 border-emerald-400 shadow-emerald-900/40' : 'bg-white/20 border-white/30'} px-3 py-1 rounded-full border flex-row items-center shadow-lg`}>
                    <Animated.View
                        style={{
                            opacity: ongoingCount > 0 ? pulseAnim : 1,
                            backgroundColor: ongoingCount > 0 ? 'white' : 'white',
                            width: 6,
                            height: 6,
                            borderRadius: 3,
                            marginRight: 6
                        }}
                    />
                    <Text className="text-white text-[10px] font-black tracking-tight">{t('events.modal.ongoing_count', { count: ongoingCount })}</Text>
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
                                <Text className={`text-[9px] font-bold ${isToday ? 'text-white' : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>{dayNames[dIdx].substring(0, 3)}</Text>
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

                {['연맹', '서버', '개인', '초보자', '기타'].map((ck, idx) => {
                    const evs = grouped[ck];
                    if (!evs || evs.length === 0) return null;
                    const cfg = (() => {
                        switch (ck) {
                            case '연맹': return { label: t('events.categories.alliance'), icon: 'people', color: '#be123c', bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-600', darkText: 'text-rose-400', gradient: ['#f43f5e', '#9f1239'] as [string, string] };
                            case '서버': return { label: t('events.categories.server'), icon: 'earth', color: '#1d4ed8', bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-600', darkText: 'text-blue-400', gradient: ['#3b82f6', '#1e40af'] as [string, string] };
                            case '개인': return { label: t('events.categories.personal'), icon: 'person', color: '#a16207', bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-600', darkText: 'text-amber-400', gradient: ['#eab308', '#a16207'] as [string, string] };
                            case '초보자': return { label: t('events.category.beginner'), icon: 'star', color: '#8b5cf6', bg: 'bg-violet-500/10', border: 'border-violet-500/20', text: 'text-violet-600', darkText: 'text-violet-400', gradient: ['#a78bfa', '#7c3aed'] as [string, string] };
                            default: return { label: t('events.categories.etc'), icon: 'grid', color: '#334155', bg: 'bg-slate-500/10', border: 'border-slate-500/20', text: 'text-slate-600', darkText: 'text-slate-400', gradient: ['#64748b', '#334155'] as [string, string] };
                        }
                    })();
                    return (
                        <View key={`cat-${ck}-${idx}`} className="mb-8">
                            <View className={`flex-row items-center px-4 mb-3`}>
                                <View className={`p-1.5 rounded-lg mr-2 ${cfg.bg} border ${cfg.border}`}>
                                    <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
                                </View>
                                <Text className={`text-[13px] font-black uppercase tracking-wide ${isDark ? cfg.darkText : cfg.text}`}>{cfg.label}</Text>
                            </View>
                            {evs.map((ev: any, evIdx: number) => {
                                const isTopRow = ck === '연맹' && evIdx < 2;
                                const isRowHovered = hoveredBarId?.startsWith(ev.id);
                                return (
                                    <View
                                        key={`${ev.id}-${ck}-${evIdx}`}
                                        className="h-14 relative mb-3 justify-center"
                                        style={{ zIndex: isRowHovered ? 1000 : 1 }}
                                    >
                                        <View key={`rail-${ev.id}`} className={`absolute inset-x-0 h-11 rounded-2xl ${isDark ? 'bg-slate-800/40' : 'bg-slate-200/40'}`} />
                                        {ev._bars.map((p: any, bi: number) => {
                                            const barKey = `bar-${ev.id}-${bi}`;
                                            const isHovered = hoveredBarId === barKey;
                                            const isActive = checkIsOngoing(ev._original || ev);
                                            const isFloatingIcon = p.et - p.st <= 3600000 || (ev.id && ev.id.includes('castle'));
                                            return (
                                                <View
                                                    key={barKey}
                                                    className="absolute h-14 py-1.5"
                                                    style={{
                                                        left: p.left,
                                                        width: p.width,
                                                        zIndex: isHovered ? 999 : 10
                                                    }}
                                                >
                                                    <Pressable
                                                        onPress={() => onEventPress(ev)}
                                                        // @ts-ignore
                                                        onMouseEnter={() => setHoveredBarId(barKey)}
                                                        // @ts-ignore
                                                        onMouseLeave={() => setHoveredBarId(null)}
                                                        style={{
                                                            position: 'absolute',
                                                            left: isFloatingIcon ? -40 : 0,
                                                            right: 0,
                                                            top: 0,
                                                            bottom: 0,
                                                            zIndex: isHovered ? 999 : 10
                                                        }}
                                                    >
                                                        {({ hovered }: any) => {
                                                            const activeHover = hovered || isHovered;
                                                            return (
                                                                <View key="bar-inner-wrap" style={{ position: 'absolute', left: isFloatingIcon ? 40 : 0, right: 0, top: 0, bottom: 0, overflow: 'visible' }}>
                                                                    {/* Floating Icon OUTSIDE: for short bars (<= 1 hour) OR Castle Battle */}
                                                                    {isFloatingIcon && (
                                                                        <View
                                                                            key="floating-icon"
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
                                                                            borderRadius: 12,
                                                                            overflow: 'hidden',
                                                                            transform: [{ scale: activeHover ? 1.04 : (isActive ? 1.01 : 1) }],
                                                                            borderWidth: isActive ? 2 : 0,
                                                                            borderColor: isActive ? pulseAnim.interpolate({
                                                                                inputRange: [0.4, 1],
                                                                                outputRange: ['rgba(255,255,255,0.3)', 'rgba(255,255,255,1)']
                                                                            }) : 'transparent',
                                                                            // @ts-ignore
                                                                            boxShadow: isActive ? pulseAnim.interpolate({
                                                                                inputRange: [0.4, 1],
                                                                                outputRange: ['0 0 5px rgba(255,255,255,0.2)', '0 0 20px rgba(255,255,255,0.6)']
                                                                            }) : (activeHover ? `0 4px 16px ${cfg.gradient[1]}80` : `0 2px 8px ${cfg.gradient[1]}40`)
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
                                                                            <Text key="title-text" className="text-white font-black text-[10px] flex-1" numberOfLines={1}>{t(`events.${(ev._original?.id || ev.id || ev.eventId || '').replace(/_(?:team\d+|t?\d+(?:_\d+)?)/g, '')}_title`)}</Text>
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
                                                                                <Text className="text-white font-black text-[14px]">
                                                                                    {(() => {
                                                                                        const eventId = ev._original?.id || ev.id || ev.eventId || '';
                                                                                        const baseId = eventId.replace(/_(?:team\d+|t?\d+(?:_\d+)?)/g, '');
                                                                                        const teamMatch = eventId.match(/_team(\d+)/);

                                                                                        let displayTitle = t(`events.${baseId}_title`, { defaultValue: ev.title });

                                                                                        // 팀 정보가 있으면 언어에 맞게 추가 (중복 방지)
                                                                                        if (teamMatch) {
                                                                                            const teamNum = teamMatch[1];
                                                                                            const teamSuffix = language === 'ko' ? `${teamNum}군` : `Team ${teamNum}`;
                                                                                            if (!displayTitle.includes(teamSuffix)) {
                                                                                                displayTitle = `${displayTitle} (${teamSuffix})`;
                                                                                            }
                                                                                        }

                                                                                        return displayTitle;
                                                                                    })()}
                                                                                </Text>
                                                                            </View>
                                                                            <View className="gap-2">
                                                                                {/* Show only the hovered bar's time */}
                                                                                <View key={`tt-bar-${ev.id}-current`} className="flex-row items-center">
                                                                                    <View className="w-1.5 h-1.5 rounded-full mr-3 bg-orange-500" />
                                                                                    <Text className="text-orange-300 font-bold text-[12px]">
                                                                                        {!!p.label ? (
                                                                                            <View className="flex-row items-center">
                                                                                                <Text className="text-[12px] font-bold text-orange-300">
                                                                                                    {dayNames[new Date(p.st).getDay()]}
                                                                                                </Text>
                                                                                                <Text className="text-slate-600 mx-1.5">•</Text>
                                                                                                <View className="flex-row items-center mr-2">
                                                                                                    <Text className="text-[12px] font-bold text-white">
                                                                                                        {String(new Date(p.st).getHours()).padStart(2, '0')}:{String(new Date(p.st).getMinutes()).padStart(2, '0')}
                                                                                                    </Text>
                                                                                                </View>
                                                                                                <View className="px-1.5 py-0.5 rounded bg-orange-500/20">
                                                                                                    <Text className="text-[10px] font-bold text-orange-300">
                                                                                                        {(p.label || '').replace('요새', t('events.fortress_label')).replace('성채', t('events.citadel_label'))}
                                                                                                    </Text>
                                                                                                </View>
                                                                                            </View>
                                                                                        ) : (
                                                                                            <Text className="text-[12px] text-orange-300 font-bold">
                                                                                                {formatTs(p.st)}
                                                                                            </Text>
                                                                                        )}
                                                                                    </Text>
                                                                                </View>
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
                    <View key="indicator-label" className="absolute -top-6 -left-5 bg-orange-500 px-1.5 py-0.5 rounded shadow-sm">
                        <Text className="text-white text-[10px] font-bold">
                            {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
                        </Text>
                    </View>
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
