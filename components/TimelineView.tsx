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
    const [selectedBarId, setSelectedBarId] = useState<string | null>(null);
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

    const formatTs = (ts: number, timeOnly = false) => {
        const d = new Date(ts);
        if (timezone === 'UTC') {
            const dw = d.getUTCDay();
            const dy = dayNames[dw];
            const timeStr = `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
            if (timeOnly) return timeStr;
            return `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${dy}) ${timeStr}`;
        }
        const dw = d.getDay();
        const dy = dayNames[dw];
        const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        if (timeOnly) return timeStr;
        return `${d.getMonth() + 1}/${d.getDate()}(${dy}) ${timeStr}`;
    };

    // Core positioning logic used for EVERY bar
    const getPosList = (ev: any) => {
        // Check for startDate first (one-time events)
        const startDate = ev.startDate;
        if (startDate) {
            // Convert startDate to a format the timeline can process
            // Extract first time from the time field
            const timeStr = ev.time || '00:00';
            const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
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

        const eventIdString = ev.id || ev.eventId || '';
        const isBearHunt = eventIdString.toLowerCase().includes('bear');

        const res: { st: number, et: number, isR: boolean, left: string, width: string, timeText: string, isWeekly?: boolean, label?: string }[] = [];
        const localStart = winStart;

        // Split by '/' to handle multiple distinct time slots (Team 1 / Team 2)
        const parts = fullComb.split(/\s*\/\s*/).filter(p => p.trim());

        parts.forEach(part => {
            let handledByRecurrence = false;

            // Recurrence logic: Apply per-part to handle Team 1 and Team 2 independently
            const isRecurring = ev.isRecurring ?? ev._original?.isRecurring;
            const rawRecValue = ev.recurrenceValue || ev._original?.recurrenceValue;

            if (isRecurring && rawRecValue) {
                // IMPORTANT: Part might look like "1군: 수(00:00)" or just "수(00:00)"
                // Find all days and times within this part
                const match = part.match(/([일월화수목금토])\s*\(?(\d{1,2}:\d{2})\)?/);

                if (match) {
                    const registeredDay = match[1];
                    const timeStr = match[2];
                    const [sh, sm] = timeStr.split(':').map(Number);
                    const recurrenceValue = parseInt(rawRecValue);
                    const recurrenceUnit = ev.recurrenceUnit || ev._original?.recurrenceUnit || 'day';
                    const intervalMs = (recurrenceUnit === 'week' ? recurrenceValue * 7 : recurrenceValue) * dayMs;

                    const targetIdx = KR_DAYS_PARSER.indexOf(registeredDay);
                    const anchorDate = new Date(winStart);
                    anchorDate.setHours(0, 0, 0, 0);

                    const startIdx = anchorDate.getDay();
                    const diffDays = (targetIdx - startIdx + 7) % 7;
                    anchorDate.setDate(anchorDate.getDate() + diffDays);

                    let label = part.split(/[월화수목금토일\d]/)[0].replace(':', '').trim();
                    const anchorTs = anchorDate.getTime();

                    // Stabilize currentDate sequence
                    let currentDate = anchorTs;
                    while (currentDate > winStart - intervalMs) {
                        currentDate -= intervalMs;
                    }

                    const rangeEnd = winEnd + (2 * dayMs);

                    while (currentDate < rangeEnd) {
                        const st = currentDate + sh * 3600000 + sm * 60000;
                        const duration = isBearHunt ? 1800000 : 3600000;
                        const et = st + duration;

                        const s = Math.max(st, winStart);
                        const e = Math.min(et, winEnd);

                        if (s < e) {
                            handledByRecurrence = true;
                            const leftPct = (s - winStart) / totalMs * 100;
                            const widthPct = et >= winEnd ? (100 - leftPct) : ((e - s) / totalMs * 100);
                            res.push({
                                st, et, isR: true, isWeekly: true,
                                left: `${leftPct.toFixed(4)}%`,
                                width: `${widthPct.toFixed(4)}%`,
                                timeText: `${formatTs(st)} ~ ${formatTs(et)}`,
                                label: label || undefined
                            });
                        }
                        currentDate += intervalMs;
                    }
                }
            }

            if (handledByRecurrence) return; // Skip generic parsers if handled

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

                if (y < 100) y += 2000;
                const hh = tp[0], mm = tp[1] || 0;
                return new Date(y, m - 1, d, hh, mm, 0).getTime();
            };

            // 0. Explicit Comma-Separated List
            if (part.includes(',') && /[월화수목금토일]\s*\d{1,2}:\d{2}/.test(part)) {
                const subParts = part.split(',');
                let specificHandled = false;

                subParts.forEach(sp => {
                    const cleanSp = sp.trim().replace(/^.*(요새전|성채전|Fortress|Citadel)[:\s：]*/, '').trim();
                    const match = cleanSp.match(/(.+?)\s+([월화수목금토일])\s*(\d{1,2}:\d{2})/) || cleanSp.match(/([월화수목금토일])\s*(\d{1,2}:\d{2})/);

                    if (match) {
                        specificHandled = true;
                        const label = match.length === 4 ? match[1].trim() : '';
                        const dayStr = match.length === 4 ? match[2] : match[1];
                        const timeStr = match.length === 4 ? match[3] : match[2];

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

                const isSameDay = timezone === 'UTC'
                    ? (new Date(b.st).getUTCDate() === new Date(b.et).getUTCDate())
                    : (new Date(b.st).getDate() === new Date(b.et).getDate());

                res.push({
                    st: b.st,
                    et: b.et,
                    isR: b.isR,
                    isWeekly: b.isWeekly,
                    left: `${leftPct.toFixed(4)}%`,
                    width: `${widthPct.toFixed(4)}%`,
                    timeText: b.isR
                        ? (isSameDay ? `${formatTs(b.st)} ~ ${formatTs(b.et, true)}` : `${formatTs(b.st)} ~ ${formatTs(b.et)}`)
                        : formatTs(b.st),
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
            if (isBearOrFoundry || comb.includes('1군:') || comb.includes('Team1:')) {
                const rawDay = ev.day || '';
                const rawTime = ev.time || '';

                // Extract discrete parts by splitting both day and time by '/'
                const dayParts = rawDay.split(/\s*\/\s*/).map(d => d.trim()).filter(Boolean);
                const timeParts = rawTime.split(/\s*\/\s*/).map(t => t.trim()).filter(Boolean);

                const maxParts = Math.max(dayParts.length, timeParts.length);
                for (let i = 0; i < maxParts; i++) {
                    const dPart = dayParts[i] || dayParts[0] || '';
                    const tPart = timeParts[i] || timeParts[0] || '';

                    let label = i === 0 ? t('events.team1') : t('events.team2');
                    if (baseId.includes('bear')) label = i === 0 ? t('events.bear1') : t('events.bear2');

                    const subId = `${baseId}_t${i}_${globalIdx}`;
                    const translatedTitle = t(`events.${baseId}_title`, { defaultValue: ev.title });

                    // Create a sub-event with normalized day and time for this specific part
                    const sub = {
                        ...ev,
                        category,
                        _original: ev,
                        _teamIdx: i,
                        id: subId,
                        title: `${translatedTitle} (${label})`,
                        time: tPart,
                        day: dPart,
                        // Override recurrence fields for Team 2 (idx 1)
                        isRecurring: i === 0 ? ev.isRecurring : ev.isRecurring2,
                        recurrenceValue: i === 0 ? ev.recurrenceValue : ev.recurrenceValue2,
                        recurrenceUnit: i === 0 ? ev.recurrenceUnit : ev.recurrenceUnit2,
                        startDate: i === 0 ? ev.startDate : ev.startDate2
                    };

                    const bars = getPosList(sub);
                    if (bars.length > 0) r.push({ ...sub, _bars: bars });
                }
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

            <ScrollView
                className="flex-1"
                contentContainerStyle={{ paddingBottom: 60 }}
                onScroll={() => setSelectedBarId(null)}
                scrollEventThrottle={16}
            >
                <Pressable
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, minHeight: 1200 }}
                    onPress={() => setSelectedBarId(null)}
                />
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
                            <Pressable
                                onPress={() => setSelectedBarId(null)}
                                className={`flex-row items-center px-4 mb-3`}
                            >
                                <View className={`p-1.5 rounded-lg mr-2 ${cfg.bg} border ${cfg.border}`}>
                                    <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
                                </View>
                                <Text className={`text-[13px] font-black uppercase tracking-wide ${isDark ? cfg.darkText : cfg.text}`}>{cfg.label}</Text>
                            </Pressable>
                            {evs.map((ev: any, evIdx: number) => {
                                const isTopRow = ck === '연맹' && evIdx < 2;
                                const isRowHovered = hoveredBarId?.startsWith(`bar-${ev.id}-`);
                                return (
                                    <View
                                        key={`${ev.id}-${ck}-${evIdx}`}
                                        className="h-14 relative mb-3 justify-center"
                                        style={{ zIndex: isRowHovered ? 1000 : 1 }}
                                    >
                                        <Pressable
                                            key={`rail-${ev.id}`}
                                            onPress={() => setSelectedBarId(null)}
                                            className={`absolute inset-x-0 h-11 rounded-2xl ${isDark ? 'bg-slate-800/40' : 'bg-slate-200/40'}`}
                                        />
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
                                                        minWidth: 32,
                                                        zIndex: (isHovered || selectedBarId === barKey) ? 999 : 10
                                                    }}
                                                >
                                                    <Pressable
                                                        onPress={() => {
                                                            if (Platform.OS === 'web' && !('ontouchstart' in window)) {
                                                                onEventPress(ev);
                                                            } else {
                                                                setSelectedBarId(selectedBarId === barKey ? null : barKey);
                                                            }
                                                        }}
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
                                                            zIndex: (hoveredBarId === barKey || selectedBarId === barKey) ? 999 : 10
                                                        }}
                                                    >
                                                        {({ hovered }: any) => {
                                                            const activeHover = hovered || hoveredBarId === barKey || selectedBarId === barKey;
                                                            return (
                                                                <View key="bar-inner-wrap" style={{ position: 'absolute', left: isFloatingIcon ? 40 : 0, right: 0, top: 0, bottom: 0, overflow: 'visible' }}>
                                                                    {/* Floating Icon */}
                                                                    {isFloatingIcon && (
                                                                        <View
                                                                            key="floating-icon"
                                                                            style={{
                                                                                position: 'absolute',
                                                                                left: -32,
                                                                                top: 4,
                                                                                zIndex: 20,
                                                                                shadowColor: '#000',
                                                                                shadowOffset: { width: 0, height: 2 },
                                                                                shadowOpacity: 0.4,
                                                                                shadowRadius: 4,
                                                                            }}
                                                                        >
                                                                            <View className={`w-8 h-8 rounded-2xl items-center justify-center border-2 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                                                                {!!ev.imageUrl ? (
                                                                                    <Image source={typeof ev.imageUrl === 'string' ? { uri: ev.imageUrl } : ev.imageUrl} className="w-5 h-5 rounded-full" />
                                                                                ) : (
                                                                                    <Text style={{ fontSize: 12 }}>📅</Text>
                                                                                )}
                                                                            </View>
                                                                        </View>
                                                                    )}

                                                                    <Animated.View
                                                                        style={{
                                                                            flex: 1,
                                                                            borderRadius: 14,
                                                                            overflow: 'hidden',
                                                                            transform: [{ scale: activeHover ? 1.04 : (isActive ? 1.01 : 1) }],
                                                                            borderWidth: isActive ? 2 : 0,
                                                                            borderColor: isActive ? pulseAnim.interpolate({
                                                                                inputRange: [0.4, 1],
                                                                                outputRange: ['rgba(255,255,255,0.4)', 'rgba(255,255,255,1)']
                                                                            }) : 'transparent',
                                                                            // @ts-ignore
                                                                            boxShadow: activeHover ? `0 6px 20px ${cfg.gradient[1]}B0` : (isActive ? pulseAnim.interpolate({
                                                                                inputRange: [0.4, 1],
                                                                                outputRange: ['0 4px 10px rgba(255,255,255,0.3)', '0 8px 30px rgba(255,255,255,0.8)']
                                                                            }) : `0 4px 12px ${cfg.gradient[1]}60`)
                                                                        } as any}
                                                                    >
                                                                        <LinearGradient
                                                                            colors={cfg.gradient}
                                                                            start={{ x: 0, y: 0 }}
                                                                            end={{ x: 1, y: 0 }}
                                                                            className="h-full flex-row items-center px-4 shadow-lg"
                                                                        >
                                                                            {(p.et - p.st > 3600000 && !(ev.id && ev.id.includes('castle'))) && (
                                                                                <View className="w-6 h-6 rounded-full bg-white/30 items-center justify-center mr-2.5 shadow-sm border border-white/20">
                                                                                    {!!ev.imageUrl && <Image source={typeof ev.imageUrl === 'string' ? { uri: ev.imageUrl } : ev.imageUrl} className="w-4 h-4 rounded-full" />}
                                                                                </View>
                                                                            )}
                                                                            <Text key="title-text" className="text-white font-black text-[11px] flex-1 tracking-tight" numberOfLines={1}>
                                                                                {t(`events.${(ev._original?.id || ev.id || ev.eventId || '').replace(/_(?:team\d+|t?\d+(?:_\d+)?)/g, '')}_title`, { defaultValue: ev.title })}
                                                                            </Text>
                                                                            {isActive && (
                                                                                <View className="flex-row items-center bg-white/30 px-2 py-0.5 rounded-lg ml-1 border border-white/40">
                                                                                    <View className="w-1 h-1 rounded-full bg-white mr-1" />
                                                                                    <Text className="text-[8px] text-white font-black tracking-tighter">LIVE</Text>
                                                                                </View>
                                                                            )}
                                                                        </LinearGradient>
                                                                    </Animated.View>

                                                                    {activeHover && (
                                                                        <Pressable
                                                                            onPress={() => onEventPress(ev)}
                                                                            className={`absolute ${isTopRow ? 'top-12' : '-top-32'} border p-5 rounded-[28px] shadow-2xl z-[200]`}
                                                                            style={{
                                                                                minWidth: 280,
                                                                                pointerEvents: 'auto',
                                                                                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                                                                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                                                                                left: parseFloat(p.left) > 70 ? 'auto' : 0,
                                                                                right: parseFloat(p.left) > 70 ? 0 : 'auto'
                                                                            }}
                                                                        >
                                                                            <View className="flex-row items-center mb-4">
                                                                                <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-3 ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                                                                                    {!!ev.imageUrl ? (
                                                                                        <Image source={typeof ev.imageUrl === 'string' ? { uri: ev.imageUrl } : ev.imageUrl} className="w-7 h-7 rounded-full" />
                                                                                    ) : (
                                                                                        <Ionicons name="calendar" size={20} color={cfg.color} />
                                                                                    )}
                                                                                </View>
                                                                                <View className="flex-1">
                                                                                    <Text className={`font-black text-[16px] leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                                                                        {(() => {
                                                                                            const eventId = ev._original?.id || ev.id || ev.eventId || '';
                                                                                            const baseId = eventId.replace(/_(?:team\d+|t?\d+(?:_\d+)?)/g, '');
                                                                                            const teamMatch = eventId.match(/_team(\d+)/);
                                                                                            let displayTitle = t(`events.${baseId}_title`, { defaultValue: ev.title });
                                                                                            if (teamMatch) {
                                                                                                const teamIdx = parseInt(teamMatch[1]);
                                                                                                const teamLabel = teamIdx === 0 ? t('events.team1') : t('events.team2');
                                                                                                displayTitle += ` (${teamLabel})`;
                                                                                            }
                                                                                            return displayTitle;
                                                                                        })()}
                                                                                    </Text>
                                                                                    <Text className={`text-[11px] font-bold mt-0.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                                                                        {ck} Event
                                                                                    </Text>
                                                                                </View>
                                                                            </View>

                                                                            <View className={`flex-row items-center p-3 rounded-2xl ${isDark ? 'bg-slate-800/60' : 'bg-slate-50'}`}>
                                                                                <Ionicons name="time-outline" size={14} color={isDark ? '#94a3b8' : '#64748b'} style={{ marginRight: 8 }} />
                                                                                <Text
                                                                                    className={`font-mono text-[12px] font-black ${isDark ? 'text-sky-400' : 'text-blue-600'}`}
                                                                                    numberOfLines={1}
                                                                                >
                                                                                    {p.timeText}
                                                                                </Text>
                                                                            </View>

                                                                            <View className="mt-4 flex-row items-center justify-between">
                                                                                <Text className={`text-[10px] font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                                                                    {t('events.modal.tap_for_details')}
                                                                                </Text>
                                                                                <Ionicons name="chevron-forward" size={14} color={isDark ? '#475569' : '#cbd5e1'} />
                                                                            </View>

                                                                            <View
                                                                                className={`absolute -bottom-1 w-3 h-3 rotate-45 border-b border-r ${isDark ? 'bg-[#1e293b] border-white/10' : 'bg-white border-black/5'}`}
                                                                                style={{
                                                                                    left: parseFloat(p.left) > 70 ? 'auto' : 20,
                                                                                    right: parseFloat(p.left) > 70 ? 20 : 'auto'
                                                                                }}
                                                                            />
                                                                        </Pressable>
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

                {/* Current Time Indicator */}
                <View key="indicator" className="absolute top-0 bottom-0 w-[4px] bg-orange-500 z-50 pointer-events-none" style={{ left: indicatorLeft } as ViewStyle}>
                    <View key="indicator-label" className="absolute -top-6 -left-6 bg-orange-600 px-2 py-1 rounded-lg shadow-lg">
                        <Text className="text-white text-[10px] font-black tracking-tighter">
                            {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
                        </Text>
                        <View className="absolute -bottom-1 left-1.2 w-2 h-2 bg-orange-600 rotate-45 self-center" />
                    </View>
                    <View key="indicator-dot" className="w-5 h-5 rounded-full bg-orange-500 -ml-[8px] -mt-2.5 border-2 border-white shadow-2xl items-center justify-center">
                        <View key="indicator-inner" className="w-2.5 h-2.5 rounded-full bg-white" />
                    </View>
                    <View key="indicator-glow" className="absolute h-full w-[12px] -left-[4px] bg-orange-500/20" />
                </View>
            </ScrollView>
        </View>
    );
};

export default TimelineView;
