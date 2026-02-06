import React, { useState, useEffect } from 'react';
import { useRouter, Redirect } from 'expo-router';
import { useAuth } from './context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AdminManagement from '../components/AdminManagement';

export default function AdminPage() {
    const router = useRouter();
    const { auth } = useAuth();
    const [serverId, setServerId] = useState<string | null>(null);
    const [allianceId, setAllianceId] = useState<string | null>(null);

    useEffect(() => {
        const loadIds = async () => {
            const s = await AsyncStorage.getItem('serverId');
            const a = await AsyncStorage.getItem('allianceId');
            setServerId(s);
            setAllianceId(a);
        };
        loadIds();
    }, []);

    if (!auth.isLoggedIn || auth.role === 'user') {
        return <Redirect href="/" />;
    }

    return (
        <AdminManagement
            serverId={serverId}
            allianceId={allianceId}
            onBack={() => router.replace('/?showAdminMenu=true')}
        />
    );
}
