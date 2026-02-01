import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Attendee } from '../data/mock-attendees';

export const useFirestoreAttendees = (eventId: string | undefined) => {
    const [attendees, setAttendees] = useState<Partial<Attendee>[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!eventId) return;

        setLoading(true);
        // Real-time listener
        const eventDocRef = doc(db, "events", eventId);

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
    }, [eventId]);

    const saveAttendeesToFirestore = async (newAttendees: Partial<Attendee>[], eventTitle?: string) => {
        if (!eventId) return;
        try {
            const eventDocRef = doc(db, "events", eventId);
            const dataToSave: any = { attendees: newAttendees };
            if (eventTitle) {
                dataToSave.title = eventTitle;
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
