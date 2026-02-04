import { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Alert } from 'react-native';

export interface AdminUser {
    name: string;
    password?: string;
    addedAt: number;
    addedBy?: string;
    role?: 'admin' | 'super_admin';
}

export const useFirestoreAdmins = (serverId?: string | null, allianceId?: string | null) => {
    const [dynamicAdmins, setDynamicAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);

    const getCollectionRef = () => {
        if (serverId && allianceId) {
            // New structure: servers/{serverId}/alliances/{allianceId}/admins
            return collection(db, "servers", serverId, "alliances", allianceId, "admins");
        }
        return collection(db, 'sys_admins');
    };

    useEffect(() => {
        if (serverId === undefined || allianceId === undefined) return;

        const q = query(getCollectionRef(), orderBy('addedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list: AdminUser[] = [];
            snapshot.forEach((doc) => {
                list.push(doc.data() as AdminUser);
            });
            setDynamicAdmins(list);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching admins:", error);
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

    const addAdmin = async (name: string, addedBy: string, role: 'admin' | 'super_admin' = 'admin', password?: string) => {
        try {
            if (!name.trim()) return false;
            const ref = getCollectionRef();
            const data: any = {
                name: name.trim(),
                password: password || '',
                addedAt: Date.now(),
                addedBy,
                role
            };

            if (serverId && allianceId) {
                data.serverId = serverId;
                data.allianceId = allianceId;
            }

            await setDoc(doc(ref, name.trim()), data);
            return true;
        } catch (error: any) {
            Alert.alert('오류', '관리자 추가 실패: ' + error.message);
            return false;
        }
    };

    const removeAdmin = async (name: string) => {
        try {
            const ref = getCollectionRef();
            await deleteDoc(doc(ref, name));
            return true;
        } catch (error: any) {
            Alert.alert('오류', '관리자 삭제 실패: ' + error.message);
            return false;
        }
    };

    return { dynamicAdmins, loading, addAdmin, removeAdmin };
};
