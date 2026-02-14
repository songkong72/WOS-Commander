import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, runTransaction, getDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface EventSchedule {
    eventId: string;
    day: string;
    time: string;
    strategy?: string;
    updatedAt?: number; // Timestamp for Bear Hunt bi-weekly rotation logic
}

const ID_MAP: { [key: string]: string } = {
    'a_bear': 'alliance_bear',
    'a_joe': 'alliance_joe',
    'a_mercenary': 'alliance_mercenary',
    'a_mobilization': 'alliance_mobilization',
    'a_operation': 'alliance_operation',
    'a_trade': 'alliance_trade',
    'a_champ': 'alliance_champion',
    'a_center': 'alliance_center',
    'a_canyon': 'alliance_canyon',
    'a_foundry': 'alliance_foundry',
    'a_weapon': 'alliance_frost_league',
    'a_castle': 'alliance_castle',
    'a_dragon': 'alliance_dragon',
    'a_svs': 'server_svs_prep',
    'alliance_citadel': 'a_citadel',
    'alliance_fortress': 'a_fortress'
};

const normalizeId = (id: string) => {
    if (!id) return id;
    const trimmed = id.trim();
    return ID_MAP[trimmed] || trimmed;
};

export const useFirestoreEventSchedules = (serverId?: string | null, allianceId?: string | null) => {
    const [schedules, setSchedules] = useState<EventSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    const getDocRef = () => {
        if (serverId && allianceId) {
            // New structure: servers/{serverId}/alliances/{allianceId}/settings/eventSchedules
            return doc(db, "servers", serverId, "alliances", allianceId, "settings", "eventSchedules");
        }
        // Fallback to legacy path if no server/alliance is provided
        return doc(db, "settings", "eventSchedules");
    };

    useEffect(() => {
        if (serverId === undefined || allianceId === undefined) return; // Wait for initial check

        setLoading(true);
        setSchedules([]);

        const scheduleDocRef = getDocRef();

        const unsubscribe = onSnapshot(
            scheduleDocRef,
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    const legacyArray = Array.isArray(data.schedules) ? data.schedules : [];
                    const newScheduleMap = data.scheduleMap || {};
                    const mergedMap = new Map();

                    // 1. Legacy Array (Lowest priority)
                    legacyArray.forEach((s) => {
                        if (s && s.eventId) {
                            const nid = normalizeId(s.eventId);
                            mergedMap.set(nid, s);
                        }
                    });

                    // 2. Flat fields recovery (Middle priority)
                    Object.keys(data).forEach(key => {
                        if (key.startsWith('scheduleMap.')) {
                            const eventName = key.split('.')[1];
                            const s = data[key];
                            if (s && eventName) {
                                const nid = normalizeId(s.eventId || eventName);
                                const existing = mergedMap.get(nid);
                                mergedMap.set(nid, { ...existing, ...s });
                            }
                        }
                    });

                    // 3. Nested ScheduleMap (Highest priority)
                    Object.entries(newScheduleMap).forEach(([key, s]: [string, any]) => {
                        if (s) {
                            const nid = normalizeId(s.eventId || key);
                            const existing = mergedMap.get(nid);
                            // Modern source overwrites legacy ones
                            mergedMap.set(nid, { ...existing, ...s });
                        }
                    });

                    const finalArray = Array.from(mergedMap.values());
                    setSchedules(finalArray);
                } else {
                    setSchedules([]);
                }
                setLoading(false);
            },
            (err) => {
                console.error("Error fetching event schedules:", err);
                setError(err as Error);
                setLoading(false);
            }
        );

        const timeout = setTimeout(() => {
            setLoading((current) => {
                if (current) {
                    console.warn("Firestore loading timed out.");
                    return false;
                }
                return false;
            });
        }, 5000);

        return () => {
            unsubscribe();
            clearTimeout(timeout);
        };
    }, [serverId, allianceId]);

    const saveSchedules = async (newSchedules: EventSchedule[]) => {
        try {
            const scheduleDocRef = getDocRef();
            const normalizedSchedules = newSchedules.map(s => ({ ...s, eventId: normalizeId(s.eventId) }));
            const data: any = { schedules: normalizedSchedules };
            if (serverId && allianceId) {
                data.serverId = serverId;
                data.allianceId = allianceId;
            }
            await setDoc(scheduleDocRef, data, { merge: true });
        } catch (err: any) {
            console.error("Error saving event schedules:", err);
            throw err;
        }
    };

    const updateSchedule = async (scheduleToUpdate: EventSchedule) => {
        const scheduleDocRef = getDocRef();
        try {
            const rawId = scheduleToUpdate.eventId.trim();
            const nid = normalizeId(rawId);

            // 낙관적 업데이트 (optimistic update with timestamp)
            const scheduleWithTimestamp = {
                ...scheduleToUpdate,
                updatedAt: Date.now()
            };
            setSchedules(prev => {
                const existingIdx = prev.findIndex(s => normalizeId(s.eventId) === nid);
                if (existingIdx > -1) {
                    const next = [...prev];
                    next[existingIdx] = scheduleWithTimestamp;
                    return next;
                }
                return [...prev, scheduleWithTimestamp];
            });

            await runTransaction(db, async (transaction) => {
                const sfDoc = await transaction.get(scheduleDocRef);
                let currentData: any = {};
                if (sfDoc.exists()) {
                    currentData = sfDoc.data();
                }

                // 1. Definitively merge existing data into a clean structure
                const mergedMap = new Map();

                // From Legacy Array
                if (Array.isArray(currentData.schedules)) {
                    currentData.schedules.forEach((s: any) => {
                        if (s && s.eventId) mergedMap.set(normalizeId(s.eventId), s);
                    });
                }

                // From Flat fields (recovery)
                Object.keys(currentData).forEach(key => {
                    if (key.startsWith('scheduleMap.')) {
                        const eventName = key.split('.')[1];
                        const s = currentData[key];
                        if (s && eventName) mergedMap.set(normalizeId(s.eventId || eventName), s);
                    }
                });

                // From Nested Map (highest priority)
                if (currentData.scheduleMap) {
                    Object.entries(currentData.scheduleMap).forEach(([k, s]: [string, any]) => {
                        if (s) mergedMap.set(normalizeId(s.eventId || k), s);
                    });
                }

                // 2. Apply the new update to our map (with timestamp for Bear Hunt rotation)
                const scheduleWithTimestamp = {
                    ...scheduleToUpdate,
                    updatedAt: Date.now() // Add timestamp for bi-weekly rotation calculations
                };
                mergedMap.set(nid, scheduleWithTimestamp);

                // 3. Prepare the CLEAN payload (No legacy fields!)
                const cleanScheduleMap: any = {};
                mergedMap.forEach((val, key) => {
                    cleanScheduleMap[key] = val;
                });

                const payload: any = {
                    scheduleMap: cleanScheduleMap,
                    // EXPLICITLY DELETE LEGACY FIELDS to prevent future ghosts
                    schedules: deleteField(),
                };

                // Also delete any existing flat fields we found
                Object.keys(currentData).forEach(key => {
                    if (key.startsWith('scheduleMap.')) {
                        payload[key] = deleteField();
                    }
                });

                if (serverId && allianceId) {
                    payload.serverId = serverId;
                    payload.allianceId = allianceId;
                }

                if (!sfDoc.exists()) {
                    transaction.set(scheduleDocRef, { ...payload, schedules: [] });
                } else {
                    transaction.update(scheduleDocRef, payload);
                }
            });

            console.log(`[Firestore] Successfully migrated and updated schedule for ${nid}`);
        } catch (err: any) {
            console.error("Update failed: ", err);
            throw err;
        }
    };

    const clearAllSchedules = async () => {
        const scheduleDocRef = getDocRef();
        try {
            await setDoc(scheduleDocRef, { schedules: [], scheduleMap: {} });
            setSchedules([]);
        } catch (err: any) {
            console.error("Error clearing all schedules:", err);
            throw err;
        }
    };

    return { schedules, loading, error, saveSchedules, updateSchedule, clearAllSchedules };
};
