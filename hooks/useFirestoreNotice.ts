import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface Notice {
    content: string;
    visible: boolean;
    updatedAt: number;
}

export const useFirestoreNotice = (serverId?: string | null, allianceId?: string | null) => {
    const [notice, setNotice] = useState<Notice | null>(null);
    const [loading, setLoading] = useState(true);

    const getDocRef = () => {
        if (serverId && allianceId) {
            return doc(db, "servers", serverId, "alliances", allianceId, "settings", "notice");
        }
        return doc(db, 'config', 'notice');
    };

    useEffect(() => {
        if (serverId === undefined || allianceId === undefined) return;
        const docRef = getDocRef();
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
    }, [serverId, allianceId]);

    const saveNotice = async (content: string, visible: boolean) => {
        const docRef = getDocRef();
        const data: any = {
            content,
            visible,
            updatedAt: Date.now()
        };

        if (serverId && allianceId) {
            data.serverId = serverId;
            data.allianceId = allianceId;
        }

        await setDoc(docRef, data, { merge: true });
    };

    return { notice, loading, saveNotice };
};
