import { useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { WikiEvent } from '../../data/wiki-events';
import { SINGLE_SLOT_IDS, DATE_RANGE_IDS, getEventSchedule } from '../utils/eventStatus';
import { pad, processConversion } from '../utils/eventHelpers';


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

        setActiveTab(targetTab);
    }, [activeTab, isRecurring, recurrenceValue, recurrenceUnit, enableStartDate, eventStartDate,
        isRecurring1, recValue1, recUnit1, enableSD1, eventSD1,
        isRecurring2, recValue2, recUnit2, enableSD2, eventSD2]);

    const openScheduleModal = useCallback((event: WikiEvent, initialTabIdx?: number) => {
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
        if (event.id === 'a_fortress' || event.id === 'a_citadel') {
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
                            const match = item.trim().match(/(.+?)\s+([월화수목금토일\s]+)\s*\(?(\d{2}):(\d{2})\)?/);
                            if (match) fParsed.push({ id: `f_${idx}`, name: match[1].trim(), day: match[2].trim(), h: match[3], m: match[4] });
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
                        const match = trimP.match(/(.+?)\s*[\(]?\s*([월화수목금토일]*)?\s*(\d{2}):(\d{2})[\)]?/);
                        if (match) {
                            const name = match[1].trim();
                            const day = match[2] || (name.includes('성채') ? '일' : '토');
                            const h = match[3];
                            const m = match[4];
                            if (name.includes('성채')) cParsed.push({ id: `c_old_${idx}`, name, day, h, m });
                            else fParsed.push({ id: `f_old_${idx}`, name, day, h, m });
                        }
                    });
                }
            }

            if (event.id === 'a_fortress') {
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
        if ((event.category === '연맹' || event.category === '서버') && !SINGLE_SLOT_IDS.includes(event.id)) {
            const parts = (event.time || '').split(' / ');
            parts.forEach(p => {
                if (p.startsWith('1군:') || p.startsWith('Team1:')) s1 = parseScheduleStr(p.replace(/^(1군:|Team1:)\s*/, ''));
                if (p.startsWith('2군:') || p.startsWith('Team2:')) s2 = parseScheduleStr(p.replace(/^(2군:|Team2:)\s*/, ''));
            });
            if (s1.length === 0 && s2.length === 0) s1 = parseScheduleStr(event.time || '');
        } else {
            s1 = parseScheduleStr(event.time || '');
        }

        setSlots1(s1);
        setSlots2(s2);
        setInitialSlots1(s1.map(s => ({ day: s.day, time: s.time })));
        setInitialSlots2(s2.map(s => ({ day: s.day, time: s.time })));

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
        setIsRecurring1(!!event.isRecurring);
        setRecValue1(event.recurrenceValue || '1');
        setRecUnit1(event.recurrenceUnit || 'week');
        setEnableSD1(!!(event as any).startDate);
        setEventSD1((event as any).startDate || '');

        setIsRecurring2(!!((event as any).isRecurring2));
        setRecValue2(((event as any).recurrenceValue2) || '1');
        setRecUnit2(((event as any).recurrenceUnit2) || 'week');
        setEnableSD2(!!((event as any).startDate2));
        setEventSD2((event as any).startDate2 || '');

        if (currentTabIdx === 2) { // currentTabIdx is 1-based, adjusted to match setSlots2 logic if needed
            setIsRecurring(!!((event as any).isRecurring2));
            setRecurrenceValue(((event as any).recurrenceValue2) || '1');
            setRecurrenceUnit(((event as any).recurrenceUnit2) || 'week');
            setEnableStartDate(!!((event as any).startDate2));
            setEventStartDate((event as any).startDate2 || '');
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
        const name = selectedFortressName.trim() || (editingEvent?.id === 'a_fortress' ? t('events.fortress_battle') : t('events.citadel_battle'));
        const day = selectedDayForSlot || (editingEvent?.id === 'a_fortress' ? '토' : '일');

        const newSlot = {
            id: editingSlotId || `f_${Date.now()}`,
            name,
            day,
            h: editHour,
            m: editMinute
        };

        if (editingSlotId) {
            const updateFn = (prev: any[]) => prev.map(s => s.id === editingSlotId ? newSlot : s);
            if (editingEvent?.id === 'a_fortress') setFortressList(updateFn);
            else setCitadelList(updateFn);
            setEditingSlotId(null);
        } else {
            if (editingEvent?.id === 'a_fortress') setFortressList(prev => [...prev, newSlot]);
            else setCitadelList(prev => [...prev, newSlot]);
        }
        setSelectedFortressName('');
        setActiveNamePickerId(null);
    }, [editingEvent, selectedFortressName, selectedDayForSlot, editHour, editMinute, editingSlotId, t]);

    const removeFortressSlot = useCallback((id: string) => {
        if (editingEvent?.id === 'a_fortress') setFortressList(prev => prev.filter(f => f.id !== id));
        else setCitadelList(prev => prev.filter(c => c.id !== id));
    }, [editingEvent]);

    const handleDeleteSchedule = useCallback(async () => {
        if (!editingEvent) return;
        setIsSaving(true);
        try {
            await updateSchedule({
                eventId: editingEvent.id,
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
    }, [editingEvent, updateSchedule, t, showCustomAlert]);

    const saveSchedule = useCallback(async (setEvents: any) => {
        if (!editingEvent) return;
        setIsSaving(true);

        try {
            let finalDay = '';
            let finalTime = '';
            const targetId = (editingEvent.id === 'alliance_frost_league' || editingEvent.id === 'a_weapon') ? 'a_weapon' : editingEvent.id;

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
            } else if (editingEvent.id === 'a_fortress' || editingEvent.id === 'a_citadel') {

                if (editingEvent.id === 'a_fortress') {
                    finalTime = fortressList.length > 0 ? `${t('events.fortress_battle')}: ${fortressList.map(f => `${f.name.replace(/\s+/g, '')} ${f.day || '토'} ${f.h}:${f.m}`).join(', ')}` : '';
                    finalDay = fortressList.length > 0 ? t('events.fortress_battle') : '';
                } else {
                    finalTime = citadelList.length > 0 ? `${t('events.citadel_battle')}: ${citadelList.map(c => `${c.name.replace(/\s+/g, '')} ${c.day || '일'} ${c.h}:${c.m}`).join(', ')}` : '';
                    finalDay = citadelList.length > 0 ? t('events.citadel_battle') : '';
                }
            } else {
                // Team-based schedules
                const s1Str = slots1.map(s => `${s.day}(${s.time})`).join(', ');
                const s2Str = slots2.map(s => `${s.day}(${s.time})`).join(', ');

                if (s1Str && s2Str) {
                    finalTime = `1군: ${s1Str} / 2군: ${s2Str}`;
                    finalDay = `${slots1[0]?.day || ''}, ${slots2[0]?.day || ''}`;
                } else {
                    finalTime = s1Str || s2Str;
                    finalDay = (slots1[0]?.day || slots2[0]?.day || '');
                }
            }

            // Sync backing stores for currently active tab
            let team2Data = {};
            if (activeTab === 1) {
                // Current tab is 1, so use its states and save tab 2 backing store
                team2Data = {
                    isRecurring2: isRecurring2,
                    recurrenceValue2: recValue2,
                    recurrenceUnit2: recUnit2,
                    startDate2: enableSD2 ? eventSD2 : undefined
                };
            } else {
                // Current tab is 2, use its states and save tab 1 backing store
                team2Data = {
                    isRecurring1: isRecurring1,
                    recurrenceValue1: recValue1,
                    recurrenceUnit1: recUnit1,
                    startDate1: enableSD1 ? eventSD1 : undefined
                };
            }

            const updateData = {
                eventId: targetId,
                day: finalDay,
                time: finalTime,
                strategy: editingEvent.strategy || '',
                startDate: enableStartDate ? eventStartDate : undefined,
                isRecurring,
                recurrenceValue,
                recurrenceUnit,
                ...team2Data
            };

            await updateSchedule(updateData);

            // Optimistic Update
            setEvents((prev: WikiEvent[]) => prev.map(e =>
                (e.id === editingEvent.id || (editingEvent.id === 'alliance_frost_league' && e.id === 'a_weapon') || (editingEvent.id === 'a_weapon' && e.id === 'alliance_frost_league'))
                    ? { ...e, day: finalDay, time: finalTime, startDate: enableStartDate ? eventStartDate : e.startDate, isRecurring, recurrenceValue, recurrenceUnit, updatedAt: Date.now() }
                    : e
            ));

            // Notifications
            if (Platform.OS !== 'web') {
                await Notifications.cancelAllScheduledNotificationsAsync();
                if (editingEvent.id === 'a_fortress') {
                    for (const f of fortressList) await scheduleNotification(editingEvent, f.day || '토', `${f.h}:${f.m}`);
                } else if (editingEvent.id === 'a_citadel') {
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
