import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, runTransaction, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface EventSchedule {
    eventId: string;
    day: string;
    time: string;
    strategy?: string;
}

export const useFirestoreEventSchedules = () => {
    const [schedules, setSchedules] = useState<EventSchedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const scheduleDocRef = doc(db, "settings", "eventSchedules");

        const unsubscribe = onSnapshot(
            scheduleDocRef,
            (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const data = docSnapshot.data();

                    // Robust handling of legacy 'schedules' field (could be Array or Object-Map)
                    let legacyArray: EventSchedule[] = [];
                    const rawSchedules = data.schedules;

                    if (Array.isArray(rawSchedules)) {
                        legacyArray = rawSchedules;
                    } else if (rawSchedules && typeof rawSchedules === 'object') {
                        // Recover from object-based save state
                        legacyArray = Object.values(rawSchedules) as EventSchedule[];
                    }

                    const newScheduleMap = data.scheduleMap || {};

                    console.log("DB Load - Legacy:", legacyArray.length, "Map:", Object.keys(newScheduleMap).length);

                    // Merge logic: Map takes precedence over Legacy
                    const mergedMap = new Map();

                    // 1. Add legacy items
                    legacyArray.forEach((s) => {
                        if (s && s.eventId) mergedMap.set(s.eventId, s);
                    });

                    // 2. Add/Overwrite new items
                    Object.values(newScheduleMap).forEach((s: any) => {
                        if (s && s.eventId) mergedMap.set(s.eventId, s);
                    });

                    const finalArray = Array.from(mergedMap.values());
                    console.log("Final Merged Data:", finalArray.length);
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

        // Add a safety timeout (e.g., 5 seconds) to ensure loading doesn't stay stuck
        const timeout = setTimeout(() => {
            setLoading((current) => {
                if (current) {
                    console.warn("Firestore loading timed out. Proceeding with default data.");
                    return false;
                }
                return false;
            });
        }, 5000);

        return () => {
            unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    // Deprecated: Use updateSchedule instead
    const saveSchedules = async (newSchedules: EventSchedule[]) => {
        try {
            const scheduleDocRef = doc(db, "settings", "eventSchedules");
            await setDoc(scheduleDocRef, { schedules: newSchedules }, { merge: true });
        } catch (err: any) {
            console.error("Error saving event schedules:", err);
            throw err;
        }
    };

    const updateSchedule = async (scheduleToUpdate: EventSchedule) => {
        const scheduleDocRef = doc(db, "settings", "eventSchedules");
        try {
            console.log("Attempting to update:", scheduleToUpdate.eventId);

            const updateData = {
                scheduleMap: {
                    [scheduleToUpdate.eventId]: scheduleToUpdate
                }
            };

            await setDoc(scheduleDocRef, updateData, { merge: true });

            // Immediate Verification
            const verifySnapshot = await getDoc(scheduleDocRef);
            const savedData = verifySnapshot.exists() ? verifySnapshot.data() : null;
            const savedItem = savedData?.scheduleMap?.[scheduleToUpdate.eventId];

            console.log("Verification check:", savedItem ? "EXISTS" : "MISSING");

            if (!savedItem) {
                throw new Error("서버 저장 검증 실패: 데이터가 기록되지 않았습니다.");
            }

        } catch (err: any) {
            console.error("Update failed: ", err);
            throw err;
        }
    };

    const migrateLegacyData = async (): Promise<{ success: boolean, count: number, message: string }> => {
        const scheduleDocRef = doc(db, "settings", "eventSchedules");
        console.log("Migration started...");
        try {
            const snapshot = await getDoc(scheduleDocRef);
            if (!snapshot.exists()) {
                console.log("Migration: No doc");
                return { success: false, count: 0, message: "데이터가 없습니다." };
            }

            const data = snapshot.data();
            const legacySchedules = Array.isArray(data.schedules) ? data.schedules : [];

            if (legacySchedules.length === 0) {
                console.log("Migration: Nothing to migrate");
                return { success: true, count: 0, message: "이미 최적화된 상태입니다." };
            }

            const updateMap: any = {};
            legacySchedules.forEach((s: EventSchedule) => {
                if (s && s.eventId) updateMap[s.eventId] = s;
            });

            if (Object.keys(updateMap).length > 0) {
                await setDoc(scheduleDocRef, { scheduleMap: updateMap }, { merge: true });
                console.log("Migrated items:", Object.keys(updateMap).length);
                return { success: true, count: Object.keys(updateMap).length, message: `${Object.keys(updateMap).length}건의 데이터 구조를 최적화했습니다.` };
            }
            return { success: true, count: 0, message: "변환할 데이터가 없습니다." };
        } catch (e: any) {
            console.error("Migration failed", e);
            return { success: false, count: 0, message: `마이그레이션 실패: ${e.message}` };
        }
    };

    const clearAllSchedules = async () => {
        const scheduleDocRef = doc(db, "settings", "eventSchedules");
        try {
            // Overwrite the document with empty structures to clear everything
            await setDoc(scheduleDocRef, { schedules: [], scheduleMap: {} });
            setSchedules([]); // Optimistic update
        } catch (err: any) {
            console.error("Error clearing all schedules:", err);
            throw err;
        }
    };

    return { schedules, loading, error, saveSchedules, updateSchedule, migrateLegacyData, clearAllSchedules };
};
