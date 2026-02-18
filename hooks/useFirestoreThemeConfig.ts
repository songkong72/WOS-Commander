import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface ThemeConfig {
    defaultMode: 'dark' | 'light';
    updatedAt: number;
}

export const useFirestoreThemeConfig = (serverId?: string | null, allianceId?: string | null) => {
    const [themeConfig, setThemeConfig] = useState<ThemeConfig | null>(null);
    const [loading, setLoading] = useState(true);

    const getDocRef = () => {
        if (serverId && allianceId) {
            // servers/{serverId}/alliances/{allianceId}/settings/themeConfig
            return doc(db, "servers", serverId, "alliances", allianceId, "settings", "themeConfig");
        }
        return doc(db, 'config', 'themeConfig');
    };

    useEffect(() => {
        if (serverId === undefined || allianceId === undefined) return;
        const docRef = getDocRef();
        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                setThemeConfig(snap.data() as ThemeConfig);
            } else {
                // Default fallback
                setThemeConfig({ defaultMode: 'dark', updatedAt: 0 });
            }
            setLoading(false);
        }, (error) => {
            console.error("ThemeConfig listener error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [serverId, allianceId]);

    const saveDefaultMode = async (mode: 'dark' | 'light') => {
        const docRef = getDocRef();
        const data: any = {
            defaultMode: mode,
            updatedAt: Date.now()
        };

        if (serverId && allianceId) {
            data.serverId = serverId;
            data.allianceId = allianceId;
        }

        await setDoc(docRef, data, { merge: true });
    };

    return { themeConfig, loading, saveDefaultMode };
};
