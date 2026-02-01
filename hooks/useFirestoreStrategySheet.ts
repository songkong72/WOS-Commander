import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface StrategySheetData {
    url: string;
    updatedAt: number;
}

export const useFirestoreStrategySheet = () => {
    const [sheetData, setSheetData] = useState<StrategySheetData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const docRef = doc(db, 'settings', 'strategySheet');
        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                setSheetData(snap.data() as StrategySheetData);
            } else {
                // Default fallback or empty
                setSheetData({ url: '', updatedAt: 0 });
            }
            setLoading(false);
        }, (error) => {
            console.error("Strategy Sheet listener error:", error);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const saveSheetUrl = async (url: string) => {
        const docRef = doc(db, 'settings', 'strategySheet');
        await setDoc(docRef, {
            url,
            updatedAt: Date.now()
        }, { merge: true });
    };

    return { sheetData, loading, saveSheetUrl };
};
