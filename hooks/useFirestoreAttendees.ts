import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Attendee } from '../data/mock-attendees';

export const useFirestoreAttendees = (eventId: string | undefined, serverId?: string | null, allianceId?: string | null) => {
    const [attendees, setAttendees] = useState<Partial<Attendee>[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getDocRef = () => {
        if (serverId && allianceId && eventId) {
            // servers/{serverId}/alliances/{allianceId}/events/{eventId}
            return doc(db, "servers", serverId, "alliances", allianceId, "events", eventId);
        }
        return eventId ? doc(db, "events", eventId) : null;
    };

    useEffect(() => {
        if (!eventId || serverId === undefined || allianceId === undefined) return;

        setLoading(true);
        const eventDocRef = getDocRef();
        if (!eventDocRef) { setLoading(false); return; }

        const unsubscribe = onSnapshot(eventDocRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                if (data && data.attendees) {
                    setAttendees(data.attendees);
                } else {
                    setAttendees([]);
                }
            } else {
                setAttendees([]); // Document doesn't exist yet
            }
            setLoading(false);
        }, (err) => {
            console.error("Firestore Error:", err);
            setError(err.message);
            setLoading(false);
        });

        const timeout = setTimeout(() => {
            setLoading(false);
        }, 5000);

        return () => {
            unsubscribe();
            clearTimeout(timeout);
        };
    }, [eventId, serverId, allianceId]);

    const saveAttendeesToFirestore = async (newAttendees: Partial<Attendee>[], eventTitle?: string) => {
        if (!eventId) return;
        try {
            const eventDocRef = getDocRef();
            if (!eventDocRef) return;
            const dataToSave: any = { attendees: newAttendees };
            if (eventTitle) {
                dataToSave.title = eventTitle;
            }
            if (serverId && allianceId) {
                dataToSave.serverId = serverId;
                dataToSave.allianceId = allianceId;
            }
            // We overwrite the attendees array for this event, and merge the title
            await setDoc(eventDocRef, dataToSave, { merge: true });
        } catch (err: any) {
            console.error("Error saving attendees:", err);
            throw err;
        }
    };

    return { attendees, loading, error, saveAttendeesToFirestore };
};
