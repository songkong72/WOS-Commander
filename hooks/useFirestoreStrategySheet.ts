import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebaseConfig';

export interface StrategySheetData {
    url: string;
    updatedAt: number;
    type?: 'url' | 'file';
    fileName?: string;
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

    const saveSheetUrl = async (url: string, type: 'url' | 'file' = 'url', fileName?: string) => {
        const docRef = doc(db, 'settings', 'strategySheet');
        await setDoc(docRef, {
            url,
            type,
            fileName,
            updatedAt: Date.now()
        }, { merge: true });
    };

    const uploadStrategyFile = async (fileBlob: Blob, fileName: string) => {
        const timestamp = Date.now();
        const safeFileName = fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
        const storageRef = ref(storage, `strategy/${timestamp}_${safeFileName}`);

        await uploadBytes(storageRef, fileBlob);
        const downloadURL = await getDownloadURL(storageRef);

        await saveSheetUrl(downloadURL, 'file', fileName);
        return downloadURL;
    };

    return { sheetData, loading, saveSheetUrl, uploadStrategyFile };
};

