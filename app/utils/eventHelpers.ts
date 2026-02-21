/**
 * Event Helper Utilities
 * Extracted from app/index.tsx for better maintainability
 */

// --- Pure Utility Functions ---

/** Pad a number to 2 digits */
export const pad = (n: number | undefined | null) => (n ?? 0).toString().padStart(2, '0');

/** Format remaining time as "Xd HH:MM:SS" */
export const formatRemainingTime = (seconds: number) => {
    const d = Math.floor(seconds / (24 * 3600));
    const h = Math.floor((seconds % (24 * 3600)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    let res = "";
    if (d > 0) res += `${d}일 `;
    if (h > 0 || d > 0) res += `${String(h).padStart(2, '0')}:`;
    res += `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return res;
};

// --- Timezone Conversion Helpers ---
// Note: `t` = i18n translation function, passed as parameter

/** Convert KST string to local timezone */
export const toLocal = (kstStr: string, processConversionFn: (str: string, diff: number) => string) => {
    const userOffset = -new Date().getTimezoneOffset();
    const kstOffset = 540; // UTC+9
    return processConversionFn(kstStr, userOffset - kstOffset);
};

/** Convert KST string to UTC */
export const toUTC = (kstStr: string, processConversionFn: (str: string, diff: number) => string) => {
    return processConversionFn(kstStr, -540);
};

/** Core timezone conversion logic */
export const processConversion = (str: string, diffMinutes: number, t: (key: string) => string, now: Date) => {
    if (!str || diffMinutes === 0) return str;

    // 1. Full Date Range Case (2026.02.13 09:00) - '/' 및 연도 생략 대응 + 요일 마커 대응
    let processed = str.replace(/(?:(\d{2,4})[\.\/\-])?(\d{2})[\.\/\-](\d{2})\s*[^\d~\.]*\s*(\d{1,2}):(\d{2})/g, (match, y, m, d, h, min) => {
        const currentYear = now.getFullYear();
        let yearNum = parseInt(y || currentYear.toString());
        if (y && y.length === 2) yearNum += 2000;
        const date = new Date(yearNum, parseInt(m) - 1, parseInt(d), parseInt(h), parseInt(min));
        if (isNaN(date.getTime())) return match;
        const converted = new Date(date.getTime() + diffMinutes * 60000);

        return `${converted.getFullYear()}.${pad(converted.getMonth() + 1)}.${pad(converted.getDate())} ${pad(converted.getHours())}:${pad(converted.getMinutes())}`;
    });

    // 2. Weekly Day Case (화(22:00))
    processed = processed.replace(/([일월화수목금토]|[매일])\s*\(?(\d{1,2}):(\d{2})\)?/g, (match, day, h, m) => {
        const hour = parseInt(h);
        const min = parseInt(m);
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(d => t(`events.days.${d}`));
        let dayIdx = days.indexOf(day);

        if (dayIdx === -1) { // '매일'
            let totalMin = hour * 60 + min + diffMinutes;
            while (totalMin < 0) totalMin += 1440;
            totalMin %= 1440;
            const newH = Math.floor(totalMin / 60);
            const newM = totalMin % 60;
            return `${day}(${pad(newH)}:${pad(newM)})`;
        }

        let totalMin = dayIdx * 1440 + hour * 60 + min + diffMinutes;
        while (totalMin < 0) totalMin += 10080;
        totalMin %= 10080;

        const newDayIdx = Math.floor(totalMin / 1440);
        const remain = totalMin % 1440;
        const newH = Math.floor(remain / 60);
        const newM = remain % 60;
        return `${days[newDayIdx]}(${pad(newH)}:${pad(newM)})`;
    });

    return processed;
};

/** Parse schedule string into date and time parts */
export const splitSchedulePart = (str: string, t: (key: string) => string, now: Date) => {
    if (!str) return { date: '', time: '' };

    // 1. Handle full date range type (2024.01.01 10:00)
    const fullDateMatch = str.match(/(?:(\d{4})[\.\/\-])?(\d{2})[\.\/\-](\d{2})\s*[^\d\s~\.\/\-]*\s*(\d{2}):(\d{2})/);
    if (fullDateMatch) {
        const currentYear = now.getFullYear();
        const y = fullDateMatch[1] || currentYear.toString();
        const m = fullDateMatch[2];
        const d = fullDateMatch[3];
        const h = fullDateMatch[4];
        const min = fullDateMatch[5];
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(d => t(`events.days.${d}`));
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const dateStr = `${m}/${d}(${days[dateObj.getDay()]})`;
        return { date: dateStr, time: `${pad(parseInt(h))}:${pad(parseInt(min))}` };
    }

    // 2. Handle date only (2024.01.01)
    const justDateMatch = str.match(/(?:(\d{4})[\.\/\-])?(\d{2})[\.\/\-](\d{2})/);
    if (justDateMatch) {
        const currentYear = now.getFullYear();
        const y = justDateMatch[1] || currentYear.toString();
        const m = justDateMatch[2];
        const d = justDateMatch[3];
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map(d => t(`events.days.${d}`));
        const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const dateStr = `${m}/${d}(${days[dateObj.getDay()]})`;
        return { date: dateStr, time: '' };
    }

    // 3. Handle UTC format MM/DD HH:mm
    const utcMatch = str.match(/(\d{2})\/(\d{2})\s+(\d{2}:\d{2})/);
    if (utcMatch) {
        return { date: `${utcMatch[1]}/${utcMatch[2]}`, time: utcMatch[3] };
    }

    // 4. Handle UTC format MM/DD
    const utcDateMatch = str.match(/(\d{2})\/(\d{2})/);
    if (utcDateMatch && str.trim().length <= 5) {
        return { date: `${utcDateMatch[1]}/${utcDateMatch[2]}`, time: '' };
    }

    // 5. Handle weekly type (월(10:00) or similar)
    const weeklyMatch = str.match(/([일월화수목금토매일]+)\(?(\d{2}:\d{2})\)?/);
    if (weeklyMatch) {
        return { date: weeklyMatch[1].replace(/[()]/g, ''), time: weeklyMatch[2] };
    }

    return { date: str, time: '' };
};

// --- Translation Helpers ---

/** Get localized day of week from Date object */
export const getKoreanDayOfWeek = (date: Date, t: (key: string) => string) => {
    const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return t(`events.days.${days[date.getDay()]}`);
};

/** Translate Korean day character to localized string */
export const translateDay = (day: string, t: (key: string) => string) => {
    const dayMap: { [key: string]: string } = {
        '일': 'sun', '월': 'mon', '화': 'tue', '수': 'wed',
        '목': 'thu', '금': 'fri', '토': 'sat'
    };
    return dayMap[day] ? t(`events.days.${dayMap[day]}`) : day;
};

/** Format display date as MM/DD(Day) HH:mm */
export const formatDisplayDate = (str: string, t: (key: string) => string, now: Date, mode: 'LOCAL' | 'UTC' = 'LOCAL') => {
    if (!str) return '';
    const userOffset = -new Date().getTimezoneOffset();
    const kstOffset = 540; // UTC+9
    const diffMinutes = mode === 'LOCAL' ? (userOffset - kstOffset) : -kstOffset;

    const converted = processConversion(str, diffMinutes, t, now);

    // YYYY.MM.DD HH:mm 형식이면 리포맷팅, 아니면 그대로 반환
    const match = converted.match(/^(\d{4})[\.-](\d{2})[\.-](\d{2})\s+(\d{1,2}:\d{2})$/);
    if (match) {
        const [_, y, m, d, timePart] = match;
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
        const dayStr = t(`events.days.${days[date.getDay()]}`);
        return `${pad(parseInt(m))}/${pad(parseInt(d))}(${dayStr}) ${timePart}`;
    }
    return converted;
};

/** Format time string as 12-hour AM/PM format */
export const formatTime12h = (timeStr: string, t: (key: string) => string) => {
    if (!timeStr) return '';
    const [hStr, mStr] = timeStr.split(':');
    const h = parseInt(hStr || '0');
    const m = parseInt(mStr || '0');
    const isPM = h >= 12;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = isPM ? t('common.pm') : t('common.am');
    return `${ampm} ${h12}:${m.toString().padStart(2, '0')}`;
};

/** Translate fortress/citadel and group labels */
export const translateLabel = (label: string, t: (key: string) => string) => {
    if (!label) return '';
    return label
        .replace(/요새\s*#?(\d+)/g, (match, num) => `${t('events.fortress')} ${num}`)
        .replace(/성채\s*#?(\d+)/g, (match, num) => `${t('events.citadel')} ${num}`)
        .replace(/(?:^|\s|\()1군(?:\s|\)|$)/g, (match) => match.replace('1군', t('events.team1')))
        .replace(/(?:^|\s|\()2군(?:\s|\)|$)/g, (match) => match.replace('2군', t('events.team2')));
};
