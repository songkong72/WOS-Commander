import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, query, writeBatch, getDocs, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface Member {
    id: string; // Game ID
    nickname: string;
    password?: string;
    updatedAt: number;
}

export const useFirestoreMembers = (serverId?: string | null, allianceId?: string | null) => {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);

    const getCollectionRef = () => {
        if (serverId && allianceId) {
            // New structure: servers/{serverId}/alliances/{allianceId}/members
            return collection(db, "servers", serverId, "alliances", allianceId, "members");
        }
        return collection(db, 'members');
    };

    useEffect(() => {
        if (serverId === undefined || allianceId === undefined) return;

        const q = query(getCollectionRef());
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
    }, [serverId, allianceId]);

    const saveMembers = async (newList: { id: string, nickname: string, password?: string }[]) => {
        if (newList.length === 0) return;

        const batch = writeBatch(db);
        const colRef = getCollectionRef();
        newList.forEach((m) => {
            if (!m.id) return;
            const docRef = doc(colRef, String(m.id));
            batch.set(docRef, {
                nickname: m.nickname,
                password: m.password || '',
                updatedAt: Date.now(),
                serverId: serverId || null,
                allianceId: allianceId || null
            }, { merge: true });
        });
        await batch.commit();
    };

    const clearAllMembers = async () => {
        const colRef = getCollectionRef();
        const q = query(colRef);
        const snap = await getDocs(q);
        const batch = writeBatch(db);
        snap.forEach((docSnap) => {
            batch.delete(docSnap.ref);
        });
        await batch.commit();
    };

    const deleteMember = async (memberId: string) => {
        try {
            const colRef = getCollectionRef();
            const docRef = doc(colRef, memberId);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Delete member error:", error);
            throw error;
        }
    };

    const updateMemberPassword = async (memberId: string, newPassword: string) => {
        try {
            const colRef = getCollectionRef();
            const docRef = doc(colRef, memberId);
            await updateDoc(docRef, {
                password: newPassword,
                updatedAt: Date.now()
            });
        } catch (error) {
            console.error("Update password error:", error);
            throw error;
        }
    };

    return { members, loading, saveMembers, clearAllMembers, deleteMember, updateMemberPassword };
};
