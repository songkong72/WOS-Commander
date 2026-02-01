import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface Notice {
    content: string;
    visible: boolean;
    updatedAt: number;
}

export const useFirestoreNotice = () => {
    const [notice, setNotice] = useState<Notice | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 'config' collection, 'notice' document
        const docRef = doc(db, 'config', 'notice');
        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                setNotice(snap.data() as Notice);
            } else {
                // Default empty notice if not exists
                setNotice({ content: '', visible: false, updatedAt: 0 });
            }
            setLoading(false);
        }, (error) => {
            console.error("Notice listener error:", error);
            setLoading(false);
        });

        const timeout = setTimeout(() => {
            setLoading(false);
        }, 5000);

        return () => {
            unsubscribe();
            clearTimeout(timeout);
        };
    }, []);

    const saveNotice = async (content: string, visible: boolean) => {
        const docRef = doc(db, 'config', 'notice');
        await setDoc(docRef, {
            content,
            visible,
            updatedAt: Date.now()
        }, { merge: true });
    };

    return { notice, loading, saveNotice };
};
