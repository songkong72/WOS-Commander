import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
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
                    setSchedules(data.schedules || []);
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

        return () => unsubscribe();
    }, []);

    const saveSchedules = async (newSchedules: EventSchedule[]) => {
        try {
            const scheduleDocRef = doc(db, "settings", "eventSchedules");
            await setDoc(scheduleDocRef, { schedules: newSchedules }, { merge: true });
        } catch (err: any) {
            console.error("Error saving event schedules:", err);
            throw err;
        }
    };

    return { schedules, loading, error, saveSchedules };
};
