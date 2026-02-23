import { useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { WikiEvent } from '../../data/wiki-events';
import { SINGLE_SLOT_IDS, DATE_RANGE_IDS, getEventSchedule, getCanonicalEventId } from '../utils/eventStatus';
import {
    pad,
    processConversion,
    getNextOccurrenceDate,
    translateDay as translateDayUtil,
    translateLabel as translateLabelUtil,
    getRegistrationWeekDate
} from '../utils/eventHelpers';


interface UseScheduleEditorProps {
    serverId: string | null;
    allianceId: string | null;
    schedules: any[];
    updateSchedule: (data: any) => Promise<void>;
    t: any;
    showCustomAlert: (title: string, message: string, type: 'success' | 'error' | 'warning' | 'confirm', onConfirm?: () => void, confirmLabel?: string) => void;
    scheduleNotification: (event: WikiEvent, day: string, time: string) => Promise<void>;
    timezone?: 'LOCAL' | 'UTC';
    now?: Date;
}


export const useScheduleEditor = ({
    serverId,
    allianceId,
    schedules,
    updateSchedule,
    t,
    showCustomAlert,
    scheduleNotification,
    timezone = 'LOCAL',
    now: currentNow
}: UseScheduleEditorProps) => {


    const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
    const [editingEvent, setEditingEvent] = useState<WikiEvent | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedTeamTabs, setSelectedTeamTabs] = useState<{ [eventId: string]: number }>({});


    // UI States for Modal
    const [activeTab, setActiveTab] = useState<1 | 2>(1);
    const [slots1, setSlots1] = useState<any[]>([]);
    const [slots2, setSlots2] = useState<any[]>([]);
    const [initialSlots1, setInitialSlots1] = useState<any[]>([]);
    const [initialSlots2, setInitialSlots2] = useState<any[]>([]);

    // Recurrence states
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrenceValue, setRecurrenceValue] = useState('1');
    const [recurrenceUnit, setRecurrenceUnit] = useState<'day' | 'week'>('week');

    const [enableStartDate, setEnableStartDate] = useState(false);
    const [eventStartDate, setEventStartDate] = useState('');

    // Team 1 backing stores
    const [isRecurring1, setIsRecurring1] = useState(false);
    const [recValue1, setRecValue1] = useState('1');
    const [recUnit1, setRecUnit1] = useState<'day' | 'week'>('week');

    const [enableSD1, setEnableSD1] = useState(false);
    const [eventSD1, setEventSD1] = useState('');

    // Team 2 backing stores
    const [isRecurring2, setIsRecurring2] = useState(false);
    const [recValue2, setRecValue2] = useState('1');
    const [recUnit2, setRecUnit2] = useState<'day' | 'week'>('week');

    const [enableSD2, setEnableSD2] = useState(false);
    const [eventSD2, setEventSD2] = useState('');

    // Fortress/Citadel specific
    const [fortressList, setFortressList] = useState<any[]>([]);
    const [citadelList, setCitadelList] = useState<any[]>([]);
    const [activeNamePickerId, setActiveNamePickerId] = useState<string | null>(null);
    const [activeFortressDropdown, setActiveFortressDropdown] = useState<string | null>(null);
    const [selectedFortressName, setSelectedFortressName] = useState('');

    // Slot editing
    const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
    const [selectedDayForSlot, setSelectedDayForSlot] = useState('');
    const [editHour, setEditHour] = useState('00');
    const [editMinute, setEditMinute] = useState('00');
    const [pickerSyncKey, setPickerSyncKey] = useState(0);
    const [activeDateDropdown, setActiveDateDropdown] = useState<string | null>(null);

    // Mobilization/Range specific
    const [mStart, setMStart] = useState('');
    const [mEnd, setMEnd] = useState('');
    const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | 'startDate' | null>(null);

    const parseScheduleStr = useCallback((str: string) => {
        if (!str || str === '.') return [];
        const slots: { day: string, time: string, id: string, isNew?: boolean }[] = [];
        const parts = str.split(/[,|]/);
        parts.forEach(p => {
            const trimP = p.trim();
            if (!trimP) return;
            const match = trimP.match(/([일월화수목금토]|[매일]|[상시])\s*(?:\(([^)]+)\))?/);
            if (match) {
                slots.push({
                    day: match[1],
                    time: match[2] || '',
                    id: Math.random().toString(),
                    isNew: false
                });
            }
        });
        return slots;
    }, []);

    const handleTabSwitch = useCallback((targetTab: 1 | 2) => {
        if (activeTab === targetTab) return;

        // Save current UI state to team-specific backing store before switching
        if (activeTab === 1) {
            setIsRecurring1(isRecurring);
            setRecValue1(recurrenceValue);
            setRecUnit1(recurrenceUnit);
            setEnableSD1(enableStartDate);
            setEventSD1(eventStartDate);
        } else {
            setIsRecurring2(isRecurring);
            setRecValue2(recurrenceValue);
            setRecUnit2(recurrenceUnit);
            setEnableSD2(enableStartDate);
            setEventSD2(eventStartDate);
        }

        // Set UI states from target team backing store
        if (targetTab === 1) {
            setIsRecurring(isRecurring1);
            setRecurrenceValue(recValue1);
            setRecurrenceUnit(recUnit1);
            setEnableStartDate(enableSD1);
            setEventStartDate(eventSD1);
        } else {
            setIsRecurring(isRecurring2);
            setRecurrenceValue(recValue2);
            setRecurrenceUnit(recUnit2);
            setEnableStartDate(enableSD2);
            setEventStartDate(eventSD2);
        }

        setEditingSlotId(null);
        setActiveTab(targetTab);
    }, [activeTab, isRecurring, recurrenceValue, recurrenceUnit, enableStartDate, eventStartDate,
        isRecurring1, recValue1, recUnit1, enableSD1, eventSD1,
        isRecurring2, recValue2, recUnit2, enableSD2, eventSD2]);

    const openScheduleModal = useCallback((event: WikiEvent, initialTabIdx?: number) => {
        const canonicalId = getCanonicalEventId(event.id);
        setEditingEvent(event);
        const currentTabIdx = initialTabIdx !== undefined ? initialTabIdx : (selectedTeamTabs[event.id] || 0);
        setActiveTab(currentTabIdx === 0 ? 1 : 2);
        setActiveNamePickerId(null);
        setActiveFortressDropdown(null);
        setSelectedFortressName('');

        // Mobilization / Date Range
        const isRange = event.category === '개인' ||
            DATE_RANGE_IDS.includes(event.id) ||
            (event.originalEventId && DATE_RANGE_IDS.includes(event.originalEventId));

        if (isRange) {
            const now = currentNow || new Date();

            const defaultDate = `${now.getFullYear()}.${pad(now.getMonth() + 1)}.${pad(now.getDate())}`;
            const defaultStr = `${defaultDate} 09:00`;
            const defaultEndStr = `${defaultDate} 10:00`;

            const currentSchedule = getEventSchedule(event, schedules);
            const dStr = (currentSchedule?.day || event.day || "").trim();
            const tStr = (currentSchedule?.time || event.time || "").trim();


            // For date range events, combine day (dates) and time (hours) if they are separated
            let combinedStr = dStr;
            if (tStr && tStr !== '.' && !dStr.includes(':')) {
                const dParts = dStr.split(/[~～]+/).map(s => s.trim());
                const tParts = tStr.split(/[~～]+/).map(s => s.trim());
                if (dParts.length >= 2) {
                    if (tParts.length >= 2) {
                        combinedStr = `${dParts[0]} ${tParts[0]} ~ ${dParts[1]} ${tParts[1]}`;
                    } else {
                        // Apply single time to both start and end if it's a range
                        combinedStr = `${dParts[0]} ${tStr} ~ ${dParts[1]} ${tStr}`;
                    }
                } else {
                    combinedStr = `${dStr} ${tStr}`;
                }
            }


            let realDayStr = combinedStr;

            // Apply standardization and timezone conversion
            if (realDayStr && realDayStr !== '.') {
                const userOffset = -new Date().getTimezoneOffset();
                const kstOffset = 540; // UTC+9
                const diffMinutes = timezone === 'LOCAL' ? (userOffset - kstOffset) : -kstOffset;
                // Always call processConversion to standardize format (YYYY.MM.DD HH:mm), even if diffMinutes is 0
                realDayStr = processConversion(realDayStr, diffMinutes, t, now);
            }


            const rawParts = realDayStr.split(/[~～]+/).map(x => x.trim());
            const sRaw = rawParts[0] || "";
            const eRaw = rawParts.length > 1 ? rawParts[1] : "";


            // Enforce time if missing
            let finalStart = sRaw ? String(sRaw).trim() : defaultStr;
            if (finalStart && !finalStart.includes(':')) {
                finalStart = `${finalStart} 09:00`;
            }


            let finalEnd = eRaw ? String(eRaw).trim() : (sRaw ? String(sRaw).trim() : defaultEndStr);
            if (finalEnd && !finalEnd.includes(':')) {
                finalEnd = `${finalEnd} 10:00`;
            }


            setMStart(finalStart);

            setMEnd(finalEnd);


            setIsRecurring(!!event.isRecurring);
            setRecurrenceValue(event.recurrenceValue || '1');
            setRecurrenceUnit(event.recurrenceUnit || 'week');
            setEnableStartDate(!!event.startDate);
            setEventStartDate(event.startDate || '');
        }

        // Fortress / Citadel
        if (canonicalId === 'a_fortress' || canonicalId === 'a_citadel') {
            setIsRecurring(!!event.isRecurring);
            setRecurrenceValue(event.recurrenceValue || '1');
            setRecurrenceUnit(event.recurrenceUnit || 'week');
            setEnableStartDate(!!event.startDate);
            setEventStartDate(event.startDate || '');

            let fParsed: any[] = [];
            let cParsed: any[] = [];

            if (event.time) {
                let cleanTime = event.time;
                if (cleanTime.includes('요새전:')) {
                    cleanTime = cleanTime.replace('요새전:', '').trim();
                    if (cleanTime.includes('/ 성채전:')) {
                        const parts = cleanTime.split('/ 성채전:');
                        const fPart = parts[0].trim();
                        const cPart = parts[1] ? parts[1].trim() : '';

                        const fItems = fPart.split(',');
                        fItems.forEach((item, idx) => {
                            const match = item.trim().match(/(.+?)\s+([월화수목금토일\s]+)\s*\(?(\d{2}):(\d{2})\)?/);
                            if (match) fParsed.push({ id: `f_${idx}`, name: match[1].trim(), day: match[2].trim(), h: match[3], m: match[4] });
                            else {
                                const simpleMatch = item.trim().match(/(.+?)\s*\(?(\d{2}):(\d{2})\)?/);
                                if (simpleMatch) fParsed.push({ id: `f_${idx}_s`, name: simpleMatch[1].trim(), day: '토', h: simpleMatch[2], m: simpleMatch[3] });
                            }
                        });

                        const cItems = cPart.split(',');
                        cItems.forEach((item, idx) => {
                            const match = item.trim().match(/(.+?)\s+([월화수목금토일\s]+)\s*\(?(\d{2}):(\d{2})\)?/);
                            if (match) cParsed.push({ id: `c_${idx}`, name: match[1].trim(), day: match[2].trim(), h: match[3], m: match[4] });
                            else {
                                const simpleMatch = item.trim().match(/(.+?)\s*\(?(\d{2}):(\d{2})\)?/);
                                if (simpleMatch) cParsed.push({ id: `c_${idx}_s`, name: simpleMatch[1].trim(), day: '일', h: simpleMatch[2], m: simpleMatch[3] });
                            }
                        });
                    } else {
                        const items = cleanTime.split(',');
                        items.forEach((item, idx) => {
                            const trimmed = item.trim();
                            // Standard: "Name Day (HH:mm)" or "Name Day HH:mm"
                            const match = trimmed.match(/^(.+?)\s+([월화수목금토일])\s*\(?(\d{2}):(\d{2})\)?$/);
                            if (match) {
                                fParsed.push({ id: `f_${idx}`, name: match[1].trim(), day: match[2].trim(), h: match[3], m: match[4] });
                            } else {
                                // Fallback: "Day HH:mm" (no name) or "Name (HH:mm)"
                                const simpleMatch = trimmed.match(/^([월화수목금토일])?\s*(?:(.+?)\s+)?\(?(\d{2}):(\d{2})\)?$/) || trimmed.match(/^(.+?)\s*\(?(\d{2}):(\d{2})\)?$/);
                                if (simpleMatch) {
                                    const hasDay = simpleMatch[1] && '일월화수목금토'.includes(simpleMatch[1]);
                                    const namePart = hasDay ? (simpleMatch[2] || '요새') : (simpleMatch[1] || '요새');
                                    const dayPart = hasDay ? simpleMatch[1] : '토';
                                    fParsed.push({ id: `f_${idx}_s`, name: namePart.trim(), day: dayPart.trim(), h: simpleMatch[simpleMatch.length - 2], m: simpleMatch[simpleMatch.length - 1] });
                                }
                            }
                        });
                    }
                } else if (cleanTime.includes('성채전:')) {
                    cleanTime = cleanTime.replace('성채전:', '').trim();
                    const items = cleanTime.split(',');
                    items.forEach((item, idx) => {
                        const match = item.trim().match(/(.+?)\s+([월화수목금토일\s]+)\s*\(?(\d{2}):(\d{2})\)?/);
                        if (match) cParsed.push({ id: `c_${idx}`, name: match[1].trim(), day: match[2].trim(), h: match[3], m: match[4] });
                    });
                } else {
                    const parts = cleanTime.split(/[\/|]/);
                    parts.forEach((p, idx) => {
                        const trimP = p.trim();
                        // Improved regex to make the name part optional
                        const match = trimP.match(/^(?:(.+?)\s+)?([월화수목금토일]*)?\s*\(?(\d{2}):(\d{2})\)?/);
                        if (match) {
                            const name = (match[1] || (canonicalId === 'a_fortress' ? '요새' : '성채')).trim();
                            const day = match[2]?.trim() || (name.includes('성채') ? '일' : '토');
                            const h = match[3];
                            const m = match[4];
                            if (name.includes('성채')) cParsed.push({ id: `c_old_${idx}`, name, day, h, m });
                            else fParsed.push({ id: `f_old_${idx}`, name, day, h, m });
                        }
                    });
                }
            }

            if (canonicalId === 'a_fortress') {
                setFortressList(fParsed);
                setCitadelList([]);
            } else {
                setCitadelList(cParsed);
                setFortressList([]);
            }
        }

        // Standard Schedule
        let s1: any[] = [];
        let s2: any[] = [];
        const isSplitCapable = (canonicalId === 'a_foundry' || canonicalId === 'alliance_foundry' ||
            canonicalId === 'alliance_canyon' ||
            canonicalId === 'a_bear' || canonicalId === 'alliance_bear');

        // For split-capable events, get the full original schedule string to populate both tabs correctly
        let scheduleTime = event.time || '';
        if (isSplitCapable) {
            const savedSchedule = schedules.find(s => getCanonicalEventId(s.eventId) === canonicalId);
            if (savedSchedule && savedSchedule.time && savedSchedule.time !== '.') {
                scheduleTime = savedSchedule.time;
            }
        }

        if (canonicalId === 'a_fortress' || canonicalId === 'a_citadel') {
            // slots1/slots2 are handled via fortressList/citadelList for these types
            setSlots1([]);
            setSlots2([]);
            setInitialSlots1([]);
            setInitialSlots2([]);
        } else {
            if (isSplitCapable || ((event.category === '연맹' || event.category === '서버') && !SINGLE_SLOT_IDS.includes(event.id))) {
                const parts = scheduleTime.split(' / ');
                parts.forEach(p => {
                    if (p.startsWith('1군:') || p.startsWith('Team1:')) s1 = parseScheduleStr(p.replace(/^(1군:|Team1:)\s*/, ''));
                    if (p.startsWith('2군:') || p.startsWith('Team2:')) s2 = parseScheduleStr(p.replace(/^(2군:|Team2:)\s*/, ''));
                });
                // If no labels were found but it's a split event, try to parse the whole string as Team 1
                if (s1.length === 0 && s2.length === 0) s1 = parseScheduleStr(scheduleTime);
            } else {
                s1 = parseScheduleStr(scheduleTime);
            }

            setSlots1(s1);
            setSlots2(s2);
            setInitialSlots1(s1.map(s => ({ day: s.day, time: s.time })));
            setInitialSlots2(s2.map(s => ({ day: s.day, time: s.time })));
        }

        // --- Picker Initialization Logic ---
        const activeSlots = (currentTabIdx === 1 ? s1 : s2);
        const now = currentNow || new Date();

        if (activeSlots.length > 0) {
            // Priority 1: Sync with the first registered slot
            const firstSlot = activeSlots[0];
            setSelectedDayForSlot(firstSlot.day);
            if (firstSlot.time && firstSlot.time.includes(':')) {
                const [h, m] = firstSlot.time.split(':');
                setEditHour(h.padStart(2, '0'));
                setEditMinute(m.padStart(2, '0'));
            } else {
                setEditHour('00');
                setEditMinute('00');
            }
        } else {
            // Priority 2: Use current time if no schedule is registered
            const dayMap = ['일', '월', '화', '수', '목', '금', '토'];
            const currentDayStr = dayMap[now.getDay()];
            setSelectedDayForSlot(currentDayStr);
            setEditHour(now.getHours().toString().padStart(2, '0'));
            // Round minutes to nearest 5 or just use exact
            const roundedMin = Math.floor(now.getMinutes() / 5) * 5;
            setEditMinute(roundedMin.toString().padStart(2, '0'));
        }
        setPickerSyncKey(Math.random());

        // Initialize backing stores
        const isRec1 = !!event.isRecurring;
        const rv1 = event.recurrenceValue || '1';
        const ru1 = event.recurrenceUnit || 'week';
        const esd1 = !!(event as any).startDate;
        const esdValue1 = (event as any).startDate || '';

        setIsRecurring1(isRec1);
        setRecValue1(rv1);
        setRecUnit1(ru1);
        setEnableSD1(esd1);
        setEventSD1(esdValue1);

        const isRec2 = !!((event as any).isRecurring2);
        const rv2 = ((event as any).recurrenceValue2) || '1';
        const ru2 = ((event as any).recurrenceUnit2) || 'week';
        const esd2Token = !!((event as any).startDate2);
        const esdValue2 = (event as any).startDate2 || '';

        setIsRecurring2(isRec2);
        setRecValue2(rv2);
        setRecUnit2(ru2);
        setEnableSD2(esd2Token);
        setEventSD2(esdValue2);

        // Synchronize UI state with the current team tab
        if (currentTabIdx === 1) { // 2군 (Team 2)
            setIsRecurring(isRec2);
            setRecurrenceValue(rv2);
            setRecurrenceUnit(ru2);
            setEnableStartDate(esd2Token);
            setEventStartDate(esdValue2);
        } else { // 1군 (Team 1, default)
            setIsRecurring(isRec1);
            setRecurrenceValue(rv1);
            setRecurrenceUnit(ru1);
            setEnableStartDate(esd1);
            setEventStartDate(esdValue1);
        }

        setScheduleModalVisible(true);

    }, [schedules, parseScheduleStr, timezone, t, currentNow, selectedTeamTabs]);


    const hasScheduleChanges = useMemo(() => {
        const s1Changed = JSON.stringify(slots1.map(s => ({ day: s.day, time: s.time }))) !== JSON.stringify(initialSlots1);
        const s2Changed = JSON.stringify(slots2.map(s => ({ day: s.day, time: s.time }))) !== JSON.stringify(initialSlots2);
        return s1Changed || s2Changed;
    }, [slots1, slots2, initialSlots1, initialSlots2]);

    const handleCloseScheduleModal = useCallback(() => {
        if (hasScheduleChanges) {
            showCustomAlert(
                t('common.confirm'),
                t('events.modal.discard_changes'),
                'confirm',
                () => {
                    setScheduleModalVisible(false);
                    setEditingSlotId(null);
                },
                t('common.ok')
            );
        } else {
            setScheduleModalVisible(false);
            setEditingSlotId(null);
        }
    }, [hasScheduleChanges, t, showCustomAlert]);

    const addTimeSlot = useCallback(() => {
        const timeStr = `${editHour}:${editMinute}`;
        const day = selectedDayForSlot || '월';

        if (editingSlotId) {
            // Update existing slot
            const updateFn = (prev: any[]) => prev.map(s =>
                s.id === editingSlotId ? { ...s, day, time: timeStr, isNew: true } : s
            );
            if (activeTab === 1) setSlots1(updateFn);
            else setSlots2(updateFn);
            setEditingSlotId(null);
        } else {
            // Add new slot
            const newSlot = {
                id: Date.now().toString(),
                day,
                time: timeStr,
                isNew: true
            };
            if (activeTab === 1) setSlots1(prev => [...prev, newSlot]);
            else setSlots2(prev => [...prev, newSlot]);
        }
    }, [activeTab, editingSlotId, selectedDayForSlot, editHour, editMinute]);

    const removeTimeSlot = useCallback((id: string) => {
        if (activeTab === 1) setSlots1(prev => prev.filter(s => s.id !== id));
        else setSlots2(prev => prev.filter(s => s.id !== id));
        if (editingSlotId === id) setEditingSlotId(null);
    }, [activeTab, editingSlotId]);

    const addFortressSlot = useCallback(() => {
        const canonicalId = getCanonicalEventId(editingEvent?.id || '');

        if (!selectedFortressName.trim()) {
            const errorMsg = canonicalId === 'a_fortress' ? t('events.error_fortress_required') : t('events.error_citadel_required');
            showCustomAlert(t('common.info'), errorMsg, 'warning');
            return;
        }

        const name = selectedFortressName.trim();
        const day = selectedDayForSlot || (canonicalId === 'a_fortress' ? '토' : '일');

        const newSlot = {
            id: editingSlotId || `f_${Date.now()}`,
            name,
            day,
            h: editHour,
            m: editMinute
        };

        if (editingSlotId) {
            const updateFn = (prev: any[]) => prev.map(s => s.id === editingSlotId ? newSlot : s);
            if (canonicalId === 'a_fortress') setFortressList(updateFn);
            else setCitadelList(updateFn);
            setEditingSlotId(null);
        } else {
            if (canonicalId === 'a_fortress') setFortressList(prev => [...prev, newSlot]);
            else setCitadelList(prev => [...prev, newSlot]);
        }
        setSelectedFortressName('');
        setActiveNamePickerId(null);
    }, [editingEvent, selectedFortressName, selectedDayForSlot, editHour, editMinute, editingSlotId, t]);

    const removeFortressSlot = useCallback((id: string) => {
        const canonicalId = getCanonicalEventId(editingEvent?.id || '');
        if (canonicalId === 'a_fortress') setFortressList(prev => prev.filter(f => f.id !== id));
        else setCitadelList(prev => prev.filter(c => c.id !== id));
    }, [editingEvent]);

    const handleDeleteSchedule = useCallback(async () => {
        if (!editingEvent) return;

        const canonicalId = getCanonicalEventId(editingEvent.originalEventId || editingEvent.id);
        const targetId = canonicalId;
        const isSplitCapable = (canonicalId === 'a_foundry' || canonicalId === 'alliance_foundry' ||
            canonicalId === 'alliance_canyon' ||
            canonicalId === 'a_bear' || canonicalId === 'alliance_bear');

        if (isSplitCapable) {
            // Only clear the slots for the active tab
            if (activeTab === 1) setSlots1([]);
            else setSlots2([]);

            // Get the state of slots *after* clearing the active tab's slots
            const currentSlots1 = activeTab === 1 ? [] : slots1;
            const currentSlots2 = activeTab === 2 ? [] : slots2;

            // If the other tab still has data, we should update instead of deleting the entire record
            if (currentSlots1.length > 0 || currentSlots2.length > 0) {
                setIsSaving(true);
                try {
                    const s1Str = currentSlots1.map(s => `${s.day}(${s.time})`).join(', ');
                    const s2Str = currentSlots2.map(s => `${s.day}(${s.time})`).join(', ');

                    const finalTime = `1군: ${s1Str || '.'} / 2군: ${s2Str || '.'}`;
                    const finalDay = (currentSlots1[0]?.day || currentSlots2[0]?.day || '');

                    await updateSchedule({
                        eventId: targetId,
                        day: finalDay || '.',
                        time: finalTime,
                        strategy: editingEvent.strategy || '',
                        // Preserve recurrence settings for the remaining team
                        isRecurring: isRecurring1,
                        recurrenceValue: recValue1,
                        recurrenceUnit: recUnit1,
                        startDate: enableSD1 ? eventSD1 : undefined,
                        isRecurring2: isRecurring2,
                        recurrenceValue2: recValue2,
                        recurrenceUnit2: recUnit2,
                        startDate2: enableSD2 ? eventSD2 : undefined,
                    });
                    setScheduleModalVisible(false);
                    showCustomAlert(t('common.completed'), t('events.schedule_updated', { title: editingEvent.title }), 'success');
                } catch (error: any) {
                    showCustomAlert(t('common.error'), t('events.save_error', { error: error.message }), 'error');
                } finally {
                    setIsSaving(false);
                }
                return; // Exit after updating
            }
        }

        // Default behavior for non-split events or when both teams are empty after clearing
        setIsSaving(true);
        try {
            await updateSchedule({
                eventId: targetId,
                day: '.',
                time: '.',
                strategy: editingEvent.strategy || ''
            });
            setScheduleModalVisible(false);
            showCustomAlert(t('common.completed'), t('events.schedule_deleted', { title: editingEvent.title }), 'success');
        } catch (error: any) {
            showCustomAlert(t('common.error'), t('events.save_error', { error: error.message }), 'error');
        } finally {
            setIsSaving(false);
        }
    }, [editingEvent, updateSchedule, t, showCustomAlert, activeTab, slots1, slots2, isRecurring1, recValue1, recUnit1, enableSD1, eventSD1, isRecurring2, recValue2, recUnit2, enableSD2, eventSD2]);

    const saveSchedule = useCallback(async (setEvents: any) => {
        if (!editingEvent) return;
        setIsSaving(true);

        try {
            const canonicalId = getCanonicalEventId(editingEvent.originalEventId || editingEvent.id);
            const targetId = canonicalId;
            let finalDay = '';
            let finalTime = '';

            if (editingEvent.category === '개인' || DATE_RANGE_IDS.includes(editingEvent.id)) {
                let startVal = mStart;
                let endVal = mEnd;

                // Convert back to KST for saving to DB
                const userOffset = -new Date().getTimezoneOffset();
                const kstOffset = 540; // UTC+9
                const diffMinutes = timezone === 'LOCAL' ? (kstOffset - userOffset) : kstOffset;

                if (diffMinutes !== 0) {
                    const now = currentNow || new Date();
                    startVal = processConversion(startVal, diffMinutes, t, now);
                    endVal = processConversion(endVal, diffMinutes, t, now);
                }

                finalDay = `${startVal} ~ ${endVal}`;
            } else if (canonicalId === 'a_fortress' || canonicalId === 'a_citadel') {
                const isFortress = canonicalId === 'a_fortress';
                const currentList = isFortress ? fortressList : citadelList;

                if (currentList.length === 0) {
                    const errorMsg = isFortress ? t('events.error_fortress_required') : t('events.error_citadel_required');
                    showCustomAlert(t('common.info'), errorMsg, 'warning');
                    setIsSaving(false);
                    return;
                }

                if (isFortress) {
                    finalTime = `${t('events.fortress_battle')}: ${fortressList.map(f => `${f.name.replace(/\s+/g, '')} ${f.day || '토'} ${f.h}:${f.m}`).join(', ')}`;
                    finalDay = t('events.fortress_battle');
                } else {
                    finalTime = `${t('events.citadel_battle')}: ${citadelList.map(c => `${c.name.replace(/\s+/g, '')} ${c.day || '일'} ${c.h}:${c.m}`).join(', ')}`;
                    finalDay = t('events.citadel_battle');
                }
            } else {
                // Team-based schedules
                const s1Str = slots1.map(s => `${s.day}(${s.time})`).join(', ');
                const s2Str = slots2.map(s => `${s.day}(${s.time})`).join(', ');

                // Events that naturally support 1군/2군 splitting
                const canonicalId = getCanonicalEventId(editingEvent.originalEventId || editingEvent.id);
                const isSplitCapable = (canonicalId === 'a_foundry' || canonicalId === 'alliance_foundry' ||
                    canonicalId === 'alliance_canyon' ||
                    canonicalId === 'a_bear' || canonicalId === 'alliance_bear');

                if (isSplitCapable) {
                    // Always enforce labels for split-capable events to prevent data from shifting to the wrong team during parsing
                    finalTime = `1군: ${s1Str || '.'} / 2군: ${s2Str || '.'}`;
                    finalDay = (slots1[0]?.day || slots2[0]?.day || '');
                } else if (s1Str && s2Str) {
                    // Fallback for other events that might have been saved with labels
                    finalTime = `1군: ${s1Str} / 2군: ${s2Str}`;
                    finalDay = `${slots1[0]?.day || ''}, ${slots2[0]?.day || ''}`;
                } else {
                    finalTime = s1Str || s2Str;
                    finalDay = (slots1[0]?.day || slots2[0]?.day || '');
                }
            }

            const finalIsRecurring1 = activeTab === 1 ? isRecurring : isRecurring1;
            const finalIsRecurring2 = activeTab === 2 ? isRecurring : isRecurring2;

            let finalSD1 = activeTab === 1 ? (enableStartDate ? eventStartDate : undefined) : (enableSD1 ? eventSD1 : undefined);
            let finalSD2 = activeTab === 2 ? (enableStartDate ? eventStartDate : undefined) : (enableSD2 ? eventSD2 : undefined);

            // Auto-fill startDate for non-recurring events if not manually set
            const now = currentNow || new Date();
            if (!finalIsRecurring1 && !finalSD1 && slots1.length > 0) {
                finalSD1 = getRegistrationWeekDate(slots1[0].day, now) || undefined;
            }
            if (!finalIsRecurring2 && !finalSD2 && slots2.length > 0) {
                finalSD2 = getRegistrationWeekDate(slots2[0].day, now) || undefined;
            }

            const updateData: any = {
                eventId: targetId,
                day: finalDay,
                time: finalTime,
                strategy: editingEvent.strategy || '',
                // Main / Team 1 fields
                isRecurring: finalIsRecurring1,
                recurrenceValue: activeTab === 1 ? recurrenceValue : recValue1,
                recurrenceUnit: activeTab === 1 ? recurrenceUnit : recUnit1,
                startDate: finalSD1,
            };

            // Only add Team 2 fields for split-capable events
            const isSplitCapable = (canonicalId === 'a_foundry' || canonicalId === 'alliance_foundry' ||
                canonicalId === 'alliance_canyon' ||
                canonicalId === 'a_bear' || canonicalId === 'alliance_bear');

            if (isSplitCapable) {
                updateData.isRecurring2 = finalIsRecurring2;
                updateData.recurrenceValue2 = activeTab === 2 ? recurrenceValue : recValue2;
                updateData.recurrenceUnit2 = activeTab === 2 ? recurrenceUnit : recUnit2;
                updateData.startDate2 = finalSD2;
            }

            await updateSchedule(updateData);

            // Optimistic Update
            setEvents((prev: WikiEvent[]) => prev.map(e => {
                const isMatch = e.id === targetId || e.originalEventId === targetId ||
                    (targetId === 'a_weapon' && (e.id === 'alliance_frost_league' || e.originalEventId === 'alliance_frost_league'));

                if (isMatch) {
                    return {
                        ...e,
                        day: finalDay,
                        time: finalTime,
                        // Team 1
                        isRecurring: updateData.isRecurring,
                        recurrenceValue: updateData.recurrenceValue,
                        recurrenceUnit: updateData.recurrenceUnit,
                        startDate: updateData.startDate,
                        // Team 2
                        isRecurring2: updateData.isRecurring2,
                        recurrenceValue2: updateData.recurrenceValue2,
                        recurrenceUnit2: updateData.recurrenceUnit2,
                        startDate2: updateData.startDate2,
                        updatedAt: Date.now()
                    };
                }
                return e;
            }));

            // Notifications
            if (Platform.OS !== 'web') {
                await Notifications.cancelAllScheduledNotificationsAsync();
                if (canonicalId === 'a_fortress') {
                    for (const f of fortressList) await scheduleNotification(editingEvent, f.day || '토', `${f.h}:${f.m}`);
                } else if (canonicalId === 'a_citadel') {
                    for (const c of citadelList) await scheduleNotification(editingEvent, c.day || '일', `${c.h}:${c.m}`);
                } else {
                    const allSlots = [...slots1, ...slots2];
                    for (const s of allSlots) await scheduleNotification(editingEvent, s.day, s.time);
                }
            }

            setScheduleModalVisible(false);
            showCustomAlert(t('common.completed'), t('events.schedule_saved', { title: editingEvent.title }), 'success');
        } catch (error: any) {
            showCustomAlert(t('common.error'), t('events.save_error', { error: error.message }), 'error');
        } finally {
            setIsSaving(false);
        }
    }, [editingEvent, mStart, mEnd, fortressList, citadelList, slots1, slots2, isRecurring, recurrenceValue, recurrenceUnit, enableStartDate, eventStartDate, activeTab, isRecurring2, recValue2, recUnit2, enableSD2, eventSD2, isRecurring1, recValue1, recUnit1, enableSD1, eventSD1, updateSchedule, t, showCustomAlert, scheduleNotification]);

    return {
        scheduleModalVisible,
        setScheduleModalVisible,
        editingEvent,
        setEditingEvent,
        isSaving,
        activeTab,
        setActiveTab,
        slots1,
        setSlots1,
        slots2,
        setSlots2,
        isRecurring,
        setIsRecurring,
        recurrenceValue,
        setRecurrenceValue,
        recurrenceUnit,
        setRecurrenceUnit,
        enableStartDate,
        setEnableStartDate,
        eventStartDate,
        setEventStartDate,
        fortressList,
        setFortressList,
        citadelList,
        setCitadelList,
        activeNamePickerId,
        setActiveNamePickerId,
        activeFortressDropdown,
        setActiveFortressDropdown,
        selectedFortressName,
        setSelectedFortressName,
        editingSlotId,
        setEditingSlotId,
        selectedDayForSlot,
        setSelectedDayForSlot,
        editHour,
        setEditHour,
        editMinute,
        setEditMinute,
        pickerSyncKey,
        setPickerSyncKey,
        activeDateDropdown,
        setActiveDateDropdown,
        mStart,
        setMStart,
        mEnd,
        setMEnd,
        showDatePicker,
        setShowDatePicker,
        openScheduleModal,
        handleCloseScheduleModal,
        handleDeleteSchedule,
        saveSchedule,
        addTimeSlot,
        removeTimeSlot,
        addFortressSlot,
        removeFortressSlot,
        handleTabSwitch,
        parseScheduleStr,
        selectedTeamTabs,
        setSelectedTeamTabs
    };

};
