import { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Alert } from 'react-native';

export interface AdminUser {
    name: string;
    addedAt: number;
    addedBy?: string;
}

export const useFirestoreAdmins = () => {
    const [dynamicAdmins, setDynamicAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const q = query(collection(db, 'sys_admins'), orderBy('addedAt', 'desc'));
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

        return () => unsubscribe();
    }, []);

    const addAdmin = async (name: string, addedBy: string) => {
        try {
            if (!name.trim()) return false;
            await setDoc(doc(db, 'sys_admins', name.trim()), {
                name: name.trim(),
                addedAt: Date.now(),
                addedBy
            });
            return true;
        } catch (error: any) {
            Alert.alert('오류', '관리자 추가 실패: ' + error.message);
            return false;
        }
    };

    const removeAdmin = async (name: string) => {
        try {
            await deleteDoc(doc(db, 'sys_admins', name));
            return true;
        } catch (error: any) {
            Alert.alert('오류', '관리자 삭제 실패: ' + error.message);
            return false;
        }
    };

    return { dynamicAdmins, loading, addAdmin, removeAdmin };
};
