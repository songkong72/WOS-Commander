import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useAdminAuth } from './hooks/useAdminAuth';

// 스타일을 인라인으로 변경하여 NativeWind 의존성 제거 (White Screen 방지)
export default function TestAuthPage() {
    const { user, handleLogin: performLogin, logout, register, seedSuperAdmin, loading, setLoginInput, setPasswordInput } = useAdminAuth();

    // Login State
    const [loginId, setLoginId] = useState('');
    const [loginPw, setLoginPw] = useState('');

    // Register State
    const [regId, setRegId] = useState('');
    const [regPw, setRegPw] = useState('');
    const [regNick, setRegNick] = useState('');

    // Logs
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

    const handleSeed = async () => {
        addLog('Seeding Super Admin...');
        const res = await seedSuperAdmin();
        addLog(res ? 'Success: Super Admin created.' : 'Info: Super Admin already exists.');
    };

    const handleLogin = async () => {
        addLog(`Attempting login: ${loginId}`);
        setLoginInput(loginId);
        setPasswordInput(loginPw);
        const success = await performLogin([]); // Pass empty dynamicAdmins for testing
        if (success) addLog('Login Success!');
        else addLog(`Login Failed: Check credentials or logs`);
    };

    const handleRegister = async () => {
        addLog(`Registering: ${regId} (#111/KOR)`);
        const res = await register({
            username: regId,
            nickname: regNick,
            role: 'alliance_admin',
            serverId: '#111',
            allianceId: 'KOR'
        }, regPw);

        if (res.success) addLog('Register Request Success! (Status: pending)');
        else addLog(`Register Failed: ${res.message}`);
    };

    return (
        <ScrollView style={styles.container}>
            <Stack.Screen options={{ title: 'Auth System Test' }} />

            <Text style={styles.header}>🔑 Auth System V2 Test Console</Text>

            {/* Status Panel */}
            <View style={styles.panel}>
                <Text style={styles.label}>CURRENT USER STATUS</Text>
                {loading ? (
                    <Text>Loading...</Text>
                ) : user ? (
                    <View>
                        <Text style={styles.loggedIn}>LOGGED IN</Text>
                        <Text>ID: {user.adminName}</Text>
                        <Text>Role: {user.role}</Text>
                        <TouchableOpacity onPress={logout} style={[styles.btn, styles.btnRed]}>
                            <Text style={styles.btnText}>Logout</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <Text style={styles.notLoggedIn}>NOT LOGGED IN</Text>
                )}
            </View>

            {/* Actions */}
            <View style={styles.row}>
                {/* 1. SEED */}
                <View style={[styles.panel, { flex: 1 }]}>
                    <Text style={styles.subHeader}>1. Initial Setup</Text>
                    <TouchableOpacity onPress={handleSeed} style={[styles.btn, styles.btnDark]}>
                        <Text style={styles.btnText}>🌱 Seed Super Admin</Text>
                    </TouchableOpacity>
                    <Text style={styles.hint}>Create 'admin' / 'wos1234'</Text>
                </View>

                {/* 2. LOGIN */}
                <View style={[styles.panel, { flex: 1 }]}>
                    <Text style={styles.subHeader}>2. Login Test</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="ID"
                        value={loginId}
                        onChangeText={setLoginId}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="PW"
                        secureTextEntry
                        value={loginPw}
                        onChangeText={setLoginPw}
                    />
                    <TouchableOpacity onPress={handleLogin} style={[styles.btn, styles.btnBlue]}>
                        <Text style={styles.btnText}>Login</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* 3. REGISTER */}
            <View style={styles.panel}>
                <Text style={styles.subHeader}>3. Registration Test</Text>
                <View style={styles.row}>
                    <TextInput style={[styles.input, { flex: 1 }]} placeholder="New ID" value={regId} onChangeText={setRegId} />
                    <TextInput style={[styles.input, { flex: 1, marginHorizontal: 5 }]} placeholder="Password" value={regPw} onChangeText={setRegPw} />
                    <TextInput style={[styles.input, { flex: 1 }]} placeholder="Nickname" value={regNick} onChangeText={setRegNick} />
                </View>
                <TouchableOpacity onPress={handleRegister} style={[styles.btn, styles.btnIndigo]}>
                    <Text style={styles.btnText}>Register (Pending)</Text>
                </TouchableOpacity>
            </View>

            {/* LOGS */}
            <View style={styles.logPanel}>
                <Text style={styles.logHeader}>$ SYSTEM LOGS</Text>
                {logs.map((log, i) => (
                    <Text key={i} style={styles.logText}>{log}</Text>
                ))}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc', padding: 20 },
    header: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
    subHeader: { fontWeight: 'bold', marginBottom: 10 },
    panel: { backgroundColor: 'white', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 20 },
    label: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 5 },
    loggedIn: { color: '#16a34a', fontWeight: 'bold', fontSize: 18 },
    notLoggedIn: { color: '#94a3b8', fontWeight: 'bold' },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    input: { borderWidth: 1, borderColor: '#cbd5e1', padding: 8, borderRadius: 5, marginBottom: 8, backgroundColor: '#f1f5f9' },
    btn: { padding: 10, borderRadius: 5, alignItems: 'center', marginTop: 5 },
    btnText: { color: 'white', fontWeight: 'bold' },
    btnRed: { backgroundColor: '#ef4444', alignSelf: 'flex-start' },
    btnDark: { backgroundColor: '#1e293b' },
    btnBlue: { backgroundColor: '#2563eb' },
    btnIndigo: { backgroundColor: '#4f46e5' },
    hint: { fontSize: 10, color: '#64748b', marginTop: 5 },
    logPanel: { backgroundColor: '#0f172a', padding: 15, borderRadius: 10, minHeight: 200, marginBottom: 50 },
    logHeader: { color: '#4ade80', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: 10 },
    logText: { color: '#cbd5e1', fontFamily: 'monospace', fontSize: 12 }
});
