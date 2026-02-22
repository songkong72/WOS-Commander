/**
 * Event Status and Calculation Utilities
 * Extracted from app/index.tsx for better maintainability
 */

export const DATE_RANGE_IDS = [
    'a_castle', 'server_castle', 'a_operation', 'alliance_operation', 'alliance_champion', 'a_champ', 'a_weapon',
    'alliance_frost_league', 'server_svs_prep', 'server_svs_battle',
    'server_immigrate', 'server_merge', 'a_mobilization', 'alliance_mobilization',
    'p26'
];

export const SINGLE_SLOT_IDS = [
    'a_center', 'alliance_center', 'p29_center',
    'alliance_champion', 'a_champ',

    'a_mercenary', 'alliance_mercenary',
    'a_immigrate', 'alliance_immigrate', 'server_immigrate',
    'a_trade', 'alliance_trade',
    'a_mobilization', 'alliance_mobilization',
    'a_merge', 'alliance_merge', 'server_merge',
    'a_svs', 'alliance_svs', 'server_svs_prep', 'server_svs_battle',
    'a_dragon', 'alliance_dragon', 'server_dragon',
    'a_joe', 'alliance_joe',
    'alliance_frost_league', 'a_weapon'
];

/** Get the canonical ID for an event to handle legacy/alternate IDs */
export const getCanonicalEventId = (id: string): string => {
    if (!id) return '';
    const cleanId = id.trim();

    const mappings: { [key: string]: string } = {
        'a_weapon': 'a_weapon',
        'alliance_frost_league': 'a_weapon',
        'a_operation': 'alliance_operation',
        'alliance_operation': 'alliance_operation',
        'a_joe': 'alliance_joe',
        'alliance_joe': 'alliance_joe',
        'a_champ': 'alliance_champion',
        'alliance_champion': 'alliance_champion',
        'a_citadel': 'a_citadel',
        'alliance_citadel': 'a_citadel',
        'a_fortress': 'a_fortress',
        'alliance_fortress': 'a_fortress',
        'a_bear': 'alliance_bear',
        'alliance_bear': 'alliance_bear',
        'a_canyon': 'alliance_canyon',
        'alliance_canyon': 'alliance_canyon',
        'a_foundry': 'alliance_foundry',
        'alliance_foundry': 'alliance_foundry',
        'a_trade': 'alliance_trade',
        'alliance_trade': 'alliance_trade',
        'a_center': 'alliance_center',
        'alliance_center': 'alliance_center',
        'a_mobilization': 'alliance_mobilization',
        'alliance_mobilization': 'alliance_mobilization',
        'a_total': 'alliance_mobilization',
        'a_mercenary': 'alliance_mercenary',
        'alliance_mercenary': 'alliance_mercenary'
    };

    return mappings[cleanId] || cleanId;
};

/** Get schedule data for a specific event */
export const getEventSchedule = (event: any, schedules: any[]) => {
    if (!event || !schedules) return null;
    const rawId = (event.id || event.eventId || '').trim();
    const cleanId = (event.originalEventId || rawId).replace(/(_team\d+|_fortress|_citadel|_bundle)\s*$/g, '').trim();

    const canonicalId = getCanonicalEventId(cleanId);

    return schedules.find(s => {
        const sid = (s.eventId || '').trim();
        return getCanonicalEventId(sid) === canonicalId;
    });
};

/** Calculate event end date based on schedule or event data */
export const getEventEndDate = (event: any, schedules: any[], now: Date) => {
    try {
        const schedule = getEventSchedule(event, schedules);

        const originalId = (event.originalEventId || '').trim();
        const id = (originalId || event.id || event.eventId || '').trim();

        const isSplit = !!(event.isBearSplit || event.isFoundrySplit || event.isCanyonSplit || event.isFortressSplit);
        const dayStr = isSplit ? event.day : (schedule?.day || event.day || '');
        const timeStr = isSplit ? event.time : (schedule?.time || event.time || '');
        const combined = `${dayStr} ${timeStr} `;

        // 0. DATE_RANGE_IDS 이벤트는 day 필드의 날짜 범위를 우선 확인
        const isDateRangeEvent = DATE_RANGE_IDS.includes(id) || DATE_RANGE_IDS.includes(event.eventId);
        if (isDateRangeEvent && combined.includes('~')) {
            const rangeMatch = combined.match(/(?:(\d{4})[\.\\/-])?(\d{2})[\.\\/-](\d{2})\s*[^\d~]*\s*(\d{2}:\d{2})?\s*~\s*(?:(\d{4})[\.\\/-])?(\d{2})[\.\\/-](\d{2})\s*[^\d~]*\s*(\d{2}:\d{2})?/);
            if (rangeMatch) {
                const currentYear = now.getFullYear();
                const eYear = parseInt(rangeMatch[5] || currentYear.toString());
                const eMonth = parseInt(rangeMatch[6]) - 1;
                const eDay = parseInt(rangeMatch[7]);
                const timePart = rangeMatch[8] || '23:59';
                const [eH, eM] = timePart.split(':').map(Number);

                const end = new Date(eYear, eMonth, eDay, eH, eM);
                if (!isNaN(end.getTime())) return end;
            }
        }

        // 1. Check startDate (for one-time weekly events, non date-range)
        const startDate = schedule?.startDate || event.startDate;
        if (startDate) {
            try {
                const sTimeStr = schedule?.time || event.time || '00:00';
                const timeMatch = sTimeStr.match(/(\d{2}):(\d{2})/);
                const finalTime = timeMatch ? `${timeMatch[1]}:${timeMatch[2]}` : '00:00';
                const dateTimeStr = `${startDate}T${finalTime}:00`;
                const eventDateTime = new Date(dateTimeStr);
                if (!isNaN(eventDateTime.getTime())) {
                    // Add 1 hour buffer
                    return new Date(eventDateTime.getTime() + 3600000);
                }
            } catch (e) { }
        }

        // 2. Fallback: Generic Date Range Match
        const genericRangeMatch = combined.match(/(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(\d{2}:\d{2})?\s*~\s*(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(\d{2}:\d{2})?/);
        if (genericRangeMatch) {
            const currentYear = now.getFullYear();
            const eYear = parseInt(genericRangeMatch[5] || currentYear.toString());
            const eMonth = parseInt(genericRangeMatch[6]) - 1;
            const eDay = parseInt(genericRangeMatch[7]);
            const timePart = genericRangeMatch[8] || '23:59';
            const [eH, eM] = timePart.split(':').map(Number);

            const end = new Date(eYear, eMonth, eDay, eH, eM);
            if (!isNaN(end.getTime())) return end;
        }

        // 3. Single Date Match
        const singleMatch = combined.match(/(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(?:오후|오전)?\s*(\d{1,2}):(\d{2})/);
        if (singleMatch) {
            const currentYear = now.getFullYear();
            const y = parseInt(singleMatch[1] || currentYear.toString());
            const m = parseInt(singleMatch[2]) - 1;
            const d = parseInt(singleMatch[3]);
            const h = parseInt(singleMatch[4]);
            const min = parseInt(singleMatch[5]);
            const end = new Date(y, m, d, h + 1, min); // 1 hour buffer
            if (!isNaN(end.getTime())) return end;
        }
    } catch (e) { }
    return null;
};

/** Check if a weekly recurring event string is expired */
export const checkWeeklyExpired = (str: string, now: Date) => {
    if (!str || str.includes('상시') || str.includes('상설')) return false;
    const dayMapObj: { [key: string]: number } = {
        '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6,
        'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6
    };
    const currentDay = (now.getDay() + 6) % 7;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const explicitMatches = Array.from(str.matchAll(/([일월화수목금토]|[매일]|sun|mon|tue|wed|thu|fri|sat|daily)\s*\(?(\d{1,2}):(\d{2})\)?/gi));
    if (explicitMatches.length > 0) {
        return explicitMatches.every(m => {
            const dayStr = m[1];
            const h = parseInt(m[2]);
            const min = parseInt(m[3]);
            const scheduledDays = (dayStr === '매일') ? ['일', '월', '화', '수', '목', '금', '토'] : [dayStr];
            return scheduledDays.every(d => {
                const dayIdx = dayMapObj[d.toLowerCase()];
                if (dayIdx === undefined) return true;
                if (currentDay > dayIdx) return true;
                if (currentDay === dayIdx) return currentMinutes >= (h * 60 + min + 60);
                return false;
            });
        });
    }

    const weeklyMatch = str.match(/([일월화수목금토])\s*(\d{2}):(\d{2})\s*~\s*([일월화수목금토])\s*(\d{2}):(\d{2})/);
    if (weeklyMatch) {
        const endDayIdx = dayMapObj[weeklyMatch[4]];
        const endH = parseInt(weeklyMatch[5]);
        const endMin = parseInt(weeklyMatch[6]);
        if (currentDay > endDayIdx) return true;
        if (currentDay === endDayIdx) return currentMinutes >= (endH * 60 + endMin);
        return false;
    }

    return false;
};

/** Determine if an event is currently expired */
export const isEventExpired = (event: any, schedules: any[], now: Date) => {
    const originalId = (event.originalEventId || '').trim();
    const id = (originalId || event.id || event.eventId || '').trim();

    if (id === 'a_bear' || id === 'alliance_bear') return false;

    const schedule = getEventSchedule(event, schedules);
    const startDate = schedule?.startDate || event.startDate;
    const isSplit = !!(event.isBearSplit || event.isFoundrySplit || event.isCanyonSplit || event.isFortressSplit);
    const dayStr = isSplit ? event.day : (schedule?.day || event.day || '');
    const isRange = dayStr.includes('~') || event.category === '개인' || DATE_RANGE_IDS.includes(id);

    if (startDate && !isRange) {
        try {
            const timeStr = isSplit ? event.time : (schedule?.time || event.time || '00:00');
            const dateTimeStr = `${startDate}T${timeStr}:00`;
            const eventDateTime = new Date(dateTimeStr);
            if (!isNaN(eventDateTime.getTime())) {
                const expireTime = new Date(eventDateTime.getTime() + 3600000);
                return now > expireTime;
            }
        } catch (e) { }
    }

    const end = getEventEndDate(event, schedules, now);
    if (end) return now > end;

    const timeStr = isSplit ? event.time : (schedule?.time || event.time || '');
    const combined = `${dayStr} ${timeStr}`;
    return checkWeeklyExpired(combined, now);
};

/** Get remaining seconds for a recurring or date-specific event slot */
export const getRemainingSeconds = (str: string, now: Date, eventId?: string) => {
    if (!str || str.includes('상시') || str.includes('상설')) return null;
    const dayMapObj: { [key: string]: number } = {
        '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6,
        'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6
    };

    // 1. One-time Date Specific Check (YYYY.MM.DD HH:mm)
    const dateMatch = str.match(/(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(\d{1,2}:\d{2})/);
    if (dateMatch) {
        const currentYear = now.getFullYear();
        const y = parseInt(dateMatch[1] || currentYear.toString());
        const m = parseInt(dateMatch[2]) - 1;
        const d = parseInt(dateMatch[3]);
        const [h, min] = dateMatch[4].split(':').map(Number);
        const startTime = new Date(y, m, d, h, min);

        if (!isNaN(startTime.getTime())) {
            const diffSec = Math.floor((startTime.getTime() - now.getTime()) / 1000);

            // Upcoming within 24 hours (86400 seconds)
            if (diffSec > 0 && diffSec <= 86400) return diffSec;

            // Active check (within duration)
            const normalizedStr = (str + ' ' + (eventId || '')).toLowerCase();
            const isLongEvent = normalizedStr.includes('협곡') || normalizedStr.includes('무기') || normalizedStr.includes('공장') || normalizedStr.includes('요새') || normalizedStr.includes('성채') || normalizedStr.includes('전투');
            const durationSec = isLongEvent ? 3600 : 1800;
            const endSec = Math.floor((startTime.getTime() + durationSec * 1000 - now.getTime()) / 1000);
            if (diffSec <= 0 && endSec > 0) return endSec;
        }
    }

    // 2. Weekly Recurring Check
    const currentDay = (now.getDay() + 6) % 7;
    const currentTotal = currentDay * 1440 * 60 + now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const totalWeekSeconds = 7 * 1440 * 60;

    const explicitMatches = Array.from(str.matchAll(/([일월화수목금토]|[매일]|sun|mon|tue|wed|thu|fri|sat|daily)\s*\(?(\d{1,2}):(\d{2})\)?/gi));
    if (explicitMatches.length > 0) {
        let nearestResult: number | null = null;
        explicitMatches.forEach(m => {
            const dayStr = m[1];
            const h = parseInt(m[2]);
            const min = parseInt(m[3]);
            const scheduledDays = (dayStr === '매일' || dayStr === 'daily') ? ['일', '월', '화', '수', '목', '금', '토'] : [dayStr];

            const normalizedStr = (str + ' ' + (eventId || '')).toLowerCase();
            const isLongEvent =
                normalizedStr.includes('협곡') || normalizedStr.includes('무기') || normalizedStr.includes('공장') ||
                normalizedStr.includes('요새') || normalizedStr.includes('성채') || normalizedStr.includes('전투') ||
                normalizedStr.includes('canyon') || normalizedStr.includes('foundry') ||
                normalizedStr.includes('fortress') || normalizedStr.includes('citadel') ||
                normalizedStr.includes('battle');
            const isBear = normalizedStr.includes('곰') || normalizedStr.includes('bear');
            const durationSec = (isLongEvent && !isBear) ? 3600 : 1800;

            scheduledDays.forEach(d => {
                const dayOffset = dayMapObj[d.toLowerCase()];
                if (dayOffset === undefined) return;
                const startTotal = dayOffset * 1440 * 60 + h * 3600 + min * 60;
                let endTotal = startTotal + durationSec;

                // Case: Active (currently running)
                if ((currentTotal >= startTotal && currentTotal <= endTotal) ||
                    (endTotal >= totalWeekSeconds && currentTotal <= (endTotal % totalWeekSeconds))) {
                    const rem = currentTotal >= startTotal ? (endTotal - currentTotal) : ((endTotal % totalWeekSeconds) - currentTotal);
                    if (nearestResult === null || rem < nearestResult) nearestResult = rem;
                } else {
                    // Case: Upcoming (Starts in...)
                    let diff = startTotal - currentTotal;
                    if (diff < 0) diff += totalWeekSeconds; // Next week's occurrence

                    if (diff <= 86400) { // 24 hours threshold
                        if (nearestResult === null || diff < nearestResult) nearestResult = diff;
                    }
                }
            });
        });
        return nearestResult;
    }
    return null;
};

/** Get seconds until the next 09:00 reset */
export const getNextResetSeconds = (now: Date) => {
    const d = new Date(now);
    d.setHours(9, 0, 0, 0);
    if (d <= now) d.setDate(d.getDate() + 1);
    return Math.floor((d.getTime() - now.getTime()) / 1000);
};

/** Check if a specific schedule item is active */
export const checkItemActive = (str: string, now: Date, eventId?: string) => {
    if (!str) return false;
    const dayMapObj: { [key: string]: number } = {
        '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6,
        'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6
    };
    const currentDay = (now.getDay() + 6) % 7;
    const currentTotal = currentDay * 1440 + now.getHours() * 60 + now.getMinutes();
    const totalWeekMinutes = 7 * 1440;

    if (str.includes('상시') || str.includes('상설')) return true;

    const dateRangeMatch = str.match(/(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(\d{1,2}:\d{2})?\s*~\s*(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(\d{1,2}:\d{2})?/);
    if (dateRangeMatch) {
        const currentYear = now.getFullYear();
        const sYear = dateRangeMatch[1] || currentYear.toString();
        const sMonth = dateRangeMatch[2];
        const sDay = dateRangeMatch[3];
        const sTime = dateRangeMatch[4] || '00:00';

        const eYear = dateRangeMatch[5] || currentYear.toString();
        const eMonth = dateRangeMatch[6];
        const eDay = dateRangeMatch[7];
        const eTime = dateRangeMatch[8] || '23:59';

        const [hStart, mStart] = sTime.split(':').map(Number);
        const [hEnd, mEnd] = eTime.split(':').map(Number);

        const start = new Date(parseInt(sYear), parseInt(sMonth) - 1, parseInt(sDay), hStart, mStart);
        const end = new Date(parseInt(eYear), parseInt(eMonth) - 1, parseInt(eDay), hEnd, mEnd);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
            return now >= start && now <= end;
        }
    }

    const singleDateMatch = str.match(/(?:(\d{4})[\.\/-])?(\d{2})[\.\/-](\d{2})\s*[^\d~]*\s*(?:오후|오전)?\s*(\d{1,2}):(\d{2})/);
    if (singleDateMatch) {
        const currentYear = now.getFullYear();
        const y = parseInt(singleDateMatch[1] || currentYear.toString());
        const m = parseInt(singleDateMatch[2]) - 1;
        const d = parseInt(singleDateMatch[3]);
        const h = parseInt(singleDateMatch[4]);
        const min = parseInt(singleDateMatch[5]);

        const start = new Date(y, m, d, h, min);
        const end = new Date(start.getTime() + 60 * 60000); // Unified to 60 minutes
        return now >= start && now <= end;
    }

    const weeklyMatch = str.match(/([일월화수목금토])\s*(\d{2}):(\d{2})\s*~\s*([일월화수목금토])\s*(\d{2}):(\d{2})/);
    if (weeklyMatch) {
        const startTotal = dayMapObj[weeklyMatch[1]] * 1440 + parseInt(weeklyMatch[2]) * 60 + parseInt(weeklyMatch[3]);
        const endTotal = dayMapObj[weeklyMatch[4]] * 1440 + parseInt(weeklyMatch[5]) * 60 + parseInt(weeklyMatch[6]);
        if (startTotal <= endTotal) return currentTotal >= startTotal && currentTotal <= endTotal;
        return currentTotal >= startTotal || currentTotal <= endTotal;
    }

    const hasDateInfo = /\d{4}[\.-]\d{2}[\.-]\d{2}/.test(str);
    if (!hasDateInfo) {
        const explicitMatches = Array.from(str.matchAll(/([일월화수목금토]|[매일]|sun|mon|tue|wed|thu|fri|sat|daily)\s*\(?(\d{1,2}):(\d{2})\)?/gi));
        if (explicitMatches.length > 0) {
            return explicitMatches.some(m => {
                const dayStr = m[1];
                const h = parseInt(m[2]);
                const min = parseInt(m[3]);
                const scheduledDays = (dayStr === '매일') ? ['일', '월', '화', '수', '목', '금', '토'] : [dayStr];

                return scheduledDays.some(d => {
                    const dayOffset = dayMapObj[d.toLowerCase()];
                    if (dayOffset === undefined) return false;
                    const startTotal = dayOffset * 1440 + h * 60 + min;

                    // 점형 일시 이벤트 지속 시간 설정
                    const normalizedStr = (str + ' ' + (eventId || '')).toLowerCase();
                    const isLongEvent =
                        normalizedStr.includes('협곡') || normalizedStr.includes('무기') || normalizedStr.includes('공장') ||
                        normalizedStr.includes('요새') || normalizedStr.includes('성채') || normalizedStr.includes('전투') ||
                        normalizedStr.includes('canyon') || normalizedStr.includes('foundry') ||
                        normalizedStr.includes('fortress') || normalizedStr.includes('citadel') ||
                        normalizedStr.includes('battle');

                    const isBear = normalizedStr.includes('곰') || normalizedStr.includes('bear');
                    const duration = (isLongEvent && !isBear) ? 60 : 30;
                    const endTotal = startTotal + duration;

                    if (currentTotal >= startTotal && currentTotal <= endTotal) return true;
                    if (endTotal >= totalWeekMinutes && currentTotal <= (endTotal % totalWeekMinutes)) return true;
                    return false;
                });
            });
        }
    }
    return false;
};

/** Determine if event should be visible in the current list */
export const isVisibleInList = (event: any, schedules: any[], now: Date) => {
    const end = getEventEndDate(event, schedules, now);
    if (!end) return true;

    const schedule = getEventSchedule(event, schedules);
    const hasStartDate = !!(schedule?.startDate || event.startDate);
    const bufferDays = hasStartDate ? 7 : 2;

    const bufferMs = bufferDays * 24 * 60 * 60 * 1000;
    const threshold = new Date(end.getTime() + bufferMs);
    return now <= threshold;
};

/** Calculate Bear Hunt rotation day */
export const calculateBearHuntDay = (event: any, schedules: any[], now: Date, targetTime?: string): string => {
    const rawId = (event.id || event.eventId || '').trim();
    const isBear = rawId.includes('bear') || (event.originalEventId || '').includes('bear');
    const schedule = getEventSchedule(event, schedules);
    const registeredDay = event.day || schedule?.day || '';
    if (!isBear || !registeredDay) return registeredDay;

    const dayMap: { [key: string]: number } = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
    const dayMapReverse: { [key: number]: string } = { 0: '일', 1: '월', 2: '화', 3: '수', 4: '목', 5: '금', 6: '토' };

    const firstDayMatch = registeredDay.match(/[일월화수목금토]/);
    if (!firstDayMatch) return registeredDay;
    const regDayNum = dayMap[firstDayMatch[0]];

    const todayNum = now.getDay();
    const daysSinceRegistered = (todayNum - regDayNum + 7) % 7;
    const isEventDay = daysSinceRegistered % 2 === 0;

    if (isEventDay) {
        const checkTime = targetTime || event.time || '';
        const allTimes = Array.from(checkTime.matchAll(/(\d{1,2}):(\d{2})/g));
        let latestEventMinutes = -1;

        for (const match of allTimes) {
            const h = parseInt(match[1]);
            const m = parseInt(match[2]);
            const eventMinutes = h * 60 + m;
            if (eventMinutes > latestEventMinutes) latestEventMinutes = eventMinutes;
        }

        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        if (latestEventMinutes >= 0 && currentMinutes > latestEventMinutes + 30) {
            const nextEventNum = (todayNum + 2) % 7;
            return dayMapReverse[nextEventNum];
        }
        return dayMapReverse[todayNum];
    }

    const nextEventNum = (todayNum + (2 - (daysSinceRegistered % 2))) % 7;
    return dayMapReverse[nextEventNum];
};

/** Check if event is currently active */
export const isEventActive = (event: any, schedules: any[], now: Date, toLocalFn: (str: string) => string, checkItemActiveFn: (str: string, now: Date, eventId?: string) => boolean, calculateBearHuntDayFn: (e: any, s: any[], n: Date) => string) => {
    try {
        const schedule = getEventSchedule(event, schedules);
        const startDate = schedule?.startDate || event.startDate;

        const originalId = (event.originalEventId || '').trim();
        const id = (originalId || event.id || event.eventId || '').trim();

        const dayStrRaw = schedule?.day || event.day || '';
        const titleMatch = (event.title || '').includes('집결') || (event.title || '').includes('공연') || (event.title || '').includes('전당');
        const isRange = dayStrRaw.includes('~') || event.category === '개인' || DATE_RANGE_IDS.includes(id) || DATE_RANGE_IDS.includes(event.eventId) || titleMatch;

        if (startDate && !isRange) {
            const [y, m, d] = startDate.split(/[-.]/).map(Number);
            const eventDate = new Date(y, (m || 1) - 1, d || 1);
            const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            if (eventDate.getTime() !== nowDate.getTime()) return false;

            const timeStr = schedule?.time || event.time || '';
            // Fix: Include date info to ensure matches singleDateMatch/checkItemActive
            const dateStr = startDate.includes('-') ? startDate.replace(/-/g, '.') : startDate;
            const combinedWithDate = `${dateStr} ${timeStr}`;
            return checkItemActiveFn(toLocalFn(combinedWithDate), now);
        }

        const isBear = (id.includes('bear') || id === 'a_bear' || id === 'alliance_bear');
        const isSplit = !!(event.isBearSplit || event.isFoundrySplit || event.isCanyonSplit || event.isFortressSplit);

        // For split events, use THEIR specific day/time to avoid raw schedule label issues
        const dayStr = isSplit ? event.day : (isBear ? calculateBearHuntDayFn(event, schedules, now) : (schedule?.day || event.day || ''));
        const timeStr = isSplit ? event.time : (schedule?.time || event.time || '');
        const combinedStr = `${dayStr || ''} ${timeStr || ''}`.trim();

        return checkItemActiveFn(toLocalFn(combinedStr), now, id);
    } catch (e) { return false; }
};

/** Get bundle ID for grouping events */
export const getBundleId = (ev: any) => {
    const gid = ev.originalEventId || ev.eventId;
    if (gid === 'a_fortress' || gid === 'a_citadel' || gid === 'alliance_fortress' || gid === 'alliance_citadel') return 'fortress_bundle';
    return gid;
};

/** Get sort weight for event scheduling */
export const getSortTime = (ev: any, now: Date) => {
    const dStr = ev.day || '';
    const tStr = ev.time || '';
    const dayMap: { [key: string]: number } = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6 };

    const rangeMatch = (dStr + tStr).match(/(\d{4})[\.-](\d{2})[\.-](\d{2})/);
    if (rangeMatch) return new Date(rangeMatch[1] + '-' + rangeMatch[2] + '-' + rangeMatch[3]).getTime();

    const currentDay = (now.getDay() + 6) % 7;
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const matches = Array.from((dStr + ' ' + tStr).matchAll(/([일월화수목금토매일상시])\s*\(?(\d{1,2}:\d{2})\)?/g));
    if (matches.length > 0) {
        let nextSlot = matches.find(m => {
            const dRaw = m[1];
            const [h, min] = m[2].split(':').map(Number);
            if (dRaw === '매일' || dRaw === '상시') return true;
            const dIdx = dayMap[dRaw];
            if (dIdx > currentDay) return true;
            if (dIdx === currentDay) return currentMins < (h * 60 + min + 30);
            return false;
        });

        if (!nextSlot) nextSlot = matches[0];

        const [_, dRaw, tPart] = nextSlot;
        const [h, min] = tPart.split(':').map(Number);
        const dIdx = dRaw === '매일' || dRaw === '상시' ? -1 : (dayMap[dRaw] ?? 9);
        return dIdx * 86400000 + h * 3600000 + min * 60000;
    }

    const firstDay = (dStr + tStr).match(/[월화수목금토일]/)?.[0];
    const timeMatch = (dStr + tStr).match(/(\d{2}:\d{2})/)?.[1] || '00:00';
    if (firstDay) {
        const [h, m] = timeMatch.split(':').map(Number);
        return dayMap[firstDay] * 86400000 + h * 3600000 + m * 60000;
    }
    return 9999999999999;
};
