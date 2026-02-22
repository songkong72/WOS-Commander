import { useState, useEffect } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export interface NotificationSettings {
    webhookUrl?: string;
    updatedAt: number;
}

export const useFirestoreNotificationSettings = (serverId?: string | null, allianceId?: string | null) => {
    const [settings, setSettings] = useState<NotificationSettings | null>(null);
    const [loading, setLoading] = useState(true);

    const getDocRef = () => {
        if (serverId && allianceId) {
            return doc(db, "servers", serverId, "alliances", allianceId, "settings", "notifications");
        }
        return doc(db, 'config', 'notifications');
    };

    useEffect(() => {
        const docRef = getDocRef();
        const unsubscribe = onSnapshot(docRef, (snap) => {
            if (snap.exists()) {
                setSettings(snap.data() as NotificationSettings);
            } else {
                setSettings({ webhookUrl: '', updatedAt: 0 });
            }
            setLoading(false);
        }, (error) => {
            console.error("NotificationSettings listener error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [serverId, allianceId]);

    const saveWebhookUrl = async (url: string) => {
        const docRef = getDocRef();
        const data: any = {
            webhookUrl: url,
            updatedAt: Date.now()
        };

        if (serverId && allianceId) {
            data.serverId = serverId;
            data.allianceId = allianceId;
        }

        await setDoc(docRef, data, { merge: true });
    };

    return { settings, loading, saveWebhookUrl };
};
