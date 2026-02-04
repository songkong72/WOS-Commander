import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const useFirestoreEventsWithAttendees = (serverId: string | null | undefined, allianceId: string | null | undefined) => {
    const [eventsWithAttendees, setEventsWithAttendees] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!serverId || !allianceId) {
            setLoading(false);
            return;
        }

        const eventsCollRef = collection(db, "servers", serverId, "alliances", allianceId, "events");

        const unsubscribe = onSnapshot(eventsCollRef, (snapshot) => {
            const withAttendees = new Set<string>();
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.attendees && Array.isArray(data.attendees) && data.attendees.length > 0) {
                    withAttendees.add(doc.id);
                }
            });
            setEventsWithAttendees(withAttendees);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching events with attendees:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [serverId, allianceId]);

    return { eventsWithAttendees, loading };
};
