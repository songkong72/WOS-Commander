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
        const data: any = {
            url,
            type,
            updatedAt: Date.now()
        };

        // fileName이 있을 때만 포함하여 undefined 에러 방지
        if (fileName) {
            data.fileName = fileName;
        }

        await setDoc(docRef, data, { merge: true });
    };

    const uploadStrategyFile = async (fileBlob: Blob, fileName: string) => {
        try {
            console.log('--- uploadStrategyFile Hook Start ---');
            const timestamp = Date.now();
            const safeFileName = fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
            const storagePath = `strategy/${timestamp}_${safeFileName}`;
            const storageRef = ref(storage, storagePath);

            console.log('Uploading blob to path:', storagePath, 'Blob size:', fileBlob.size);

            // uploadBytes performs the actual upload
            const uploadResult = await uploadBytes(storageRef, fileBlob);
            console.log('uploadBytes successful:', uploadResult.metadata.fullPath);

            const downloadURL = await getDownloadURL(storageRef);
            console.log('getDownloadURL successful:', downloadURL);

            await saveSheetUrl(downloadURL, 'file', fileName);
            console.log('saveSheetUrl (Firestore) successful');

            return downloadURL;
        } catch (error: any) {
            console.error('Error in uploadStrategyFile hook:', error);
            // More detailed error classification if possible
            if (error.code === 'storage/unauthorized') {
                throw new Error('Firebase Storage 권한이 없습니다. (Rules 확인 필요)');
            } else if (error.code === 'storage/canceled') {
                throw new Error('업로드가 취소되었습니다.');
            }
            throw error;
        } finally {
            console.log('--- uploadStrategyFile Hook End ---');
        }
    };

    return { sheetData, loading, saveSheetUrl, uploadStrategyFile };
};

