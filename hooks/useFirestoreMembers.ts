import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, query, writeBatch, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface Member {
    id: string; // Game ID
    nickname: string;
    updatedAt: number;
}

export const useFirestoreMembers = () => {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'members'));
        const unsubscribe = onSnapshot(q, (snap) => {
            const list: Member[] = [];
            snap.forEach((docSnap) => {
                list.push({ id: docSnap.id, ...docSnap.data() } as Member);
            });
            setMembers(list.sort((a, b) => a.nickname.localeCompare(b.nickname)));
            setLoading(false);
        }, (error) => {
            console.error("Members listener error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const saveMembers = async (newList: { id: string, nickname: string }[]) => {
        if (newList.length === 0) return;

        // Use batch to save multiple members
        const batch = writeBatch(db);
        newList.forEach((m) => {
            if (!m.id) return;
            const docRef = doc(db, 'members', String(m.id));
            batch.set(docRef, {
                nickname: m.nickname,
                updatedAt: Date.now()
            }, { merge: true });
        });
        await batch.commit();
    };

    const clearAllMembers = async () => {
        const q = query(collection(db, 'members'));
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach((docSnap) => {
            batch.delete(docSnap.ref);
        });
        await batch.commit();
    };

    return { members, loading, saveMembers, clearAllMembers };
};
