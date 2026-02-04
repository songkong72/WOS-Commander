import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface EventSchedule {
    eventId: string;
    day: string;
    time: string;
    strategy?: string;
}

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

        const scheduleDocRef = getDocRef();

        const unsubscribe = onSnapshot(
            scheduleDocRef,
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();
                    let legacyArray: EventSchedule[] = [];
                    const rawSchedules = data.schedules;

                    if (Array.isArray(rawSchedules)) {
                        legacyArray = rawSchedules;
                    } else if (rawSchedules && typeof rawSchedules === 'object') {
                        legacyArray = Object.values(rawSchedules) as EventSchedule[];
                    }

                    const newScheduleMap = data.scheduleMap || {};
                    const mergedMap = new Map();

                    legacyArray.forEach((s) => {
                        if (s && s.eventId) mergedMap.set(s.eventId, s);
                    });

                    Object.values(newScheduleMap).forEach((s: any) => {
                        if (s && s.eventId) mergedMap.set(s.eventId, s);
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
            const data: any = { schedules: newSchedules };
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
            const updateData: any = {
                scheduleMap: {
                    [scheduleToUpdate.eventId]: scheduleToUpdate
                }
            };
            if (serverId && allianceId) {
                updateData.serverId = serverId;
                updateData.allianceId = allianceId;
            }
            await setDoc(scheduleDocRef, updateData, { merge: true });
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
