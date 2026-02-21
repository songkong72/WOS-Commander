import { useState, useRef, useEffect } from 'react';
import { TextInput, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { collection, doc, getDoc, getDocs, query, where, setDoc, deleteDoc, updateDoc, writeBatch, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebaseConfig';
import { hashPassword } from '../../utils/crypto';
import { MASTER_CREDENTIALS, AdminStatus } from '../../data/admin-config';
import { useAuth } from '../context';
import { useTranslation } from 'react-i18next';

interface UseAdminAuthProps {
    auth?: any;
    login?: (name: string, role?: AdminStatus['role']) => void;
    logout?: () => void;
    serverId?: string | null;
    allianceId?: string | null;
    setAllianceInfo?: (serverId: string | null, allianceId: string | null) => void;
    setIsGateOpen?: (open: boolean) => void;
    showCustomAlert?: (title: string, message: string, type?: 'success' | 'error' | 'warning' | 'confirm', onConfirm?: () => void) => void;
    t?: (key: string, options?: any) => string;
}

export const useAdminAuth = (props?: UseAdminAuthProps) => {
    const authCtx = useAuth();
    const { t: tI18n } = useTranslation();

    // Use props if provided, otherwise fallback to context
    const auth = props?.auth || authCtx.auth;
    const login = props?.login || authCtx.login;
    const logout = props?.logout || authCtx.logout;
    const serverId = props?.serverId || authCtx.serverId;
    const allianceId = props?.allianceId || authCtx.allianceId;
    const setAllianceInfo = props?.setAllianceInfo || authCtx.setAllianceInfo;
    const setIsGateOpen = props?.setIsGateOpen || authCtx.setIsGateOpen;
    const showCustomAlert = props?.showCustomAlert || authCtx.showCustomAlert;
    const t = props?.t || tI18n;

    // --- States ---
    const [loginInput, setLoginInput] = useState('');
    const [passwordInput, setPasswordInput] = useState('');
    const [loginError, setLoginError] = useState('');
    const [gateLoginError, setGateLoginError] = useState<string | null>(null);
    const [isLoginLoading, setIsLoginLoading] = useState(false);

    const [inputServer, setInputServer] = useState('');
    const [inputAlliance, setInputAlliance] = useState('');
    const [inputUserId, setInputUserId] = useState('');
    const [inputPassword, setInputPassword] = useState('');
    const [isRegisterMode, setIsRegisterMode] = useState(false);

    const [recentServers, setRecentServers] = useState<string[]>([]);
    const [recentAlliances, setRecentAlliances] = useState<string[]>([]);
    const [recentUserIds, setRecentUserIds] = useState<string[]>([]);

    // --- Super Admin Dashboard States ---
    const [allRequests, setAllRequests] = useState<any[]>([]);
    const [selectedReqIds, setSelectedReqIds] = useState<Set<string>>(new Set());
    const [superAdminTab, setSuperAdminTab] = useState<'pending' | 'alliances' | 'settings'>('pending');
    const [isSuperAdminLoading, setIsSuperAdminLoading] = useState(false);
    const [superAdminsList, setSuperAdminsList] = useState<any[]>([]);
    const [loadingSuperAdmins, setLoadingSuperAdmins] = useState(false);
    const [newAdminName, setNewAdminName] = useState('');
    const [newAdminPassword, setNewAdminPassword] = useState('');

    // --- Refs ---
    const gateUserIdRef = useRef<TextInput>(null);
    const gatePasswordRef = useRef<TextInput>(null);
    const loginPasswordRef = useRef<TextInput>(null);

    // --- Initial History Load ---
    useEffect(() => {
        const loadHistory = async () => {
            try {
                const [servers, alliances, userIds] = await Promise.all([
                    AsyncStorage.getItem('recent_server'),
                    AsyncStorage.getItem('recent_alliance'),
                    AsyncStorage.getItem('recent_userid'),
                ]);
                if (servers) setRecentServers(JSON.parse(servers));
                if (alliances) setRecentAlliances(JSON.parse(alliances));
                if (userIds) setRecentUserIds(JSON.parse(userIds));
            } catch (e) { }
        };
        loadHistory();
    }, []);

    const saveToHistory = async (key: string, value: string) => {
        if (!value || value.trim() === '') return;
        const storageKey = `recent_${key}`;
        try {
            const existing = await AsyncStorage.getItem(storageKey);
            let list: string[] = existing ? JSON.parse(existing) : [];
            list = [value, ...list.filter(item => item !== value)].slice(0, 5);
            await AsyncStorage.setItem(storageKey, JSON.stringify(list));
            if (key === 'server') setRecentServers(list);
            if (key === 'alliance') setRecentAlliances(list);
            if (key === 'userid') setRecentUserIds(list);
        } catch (e) {
            console.error('Save history error:', e);
        }
    };

    const performLogin = async (id: string, role: AdminStatus['role'] = 'admin') => {
        try {
            const { signInAnonymously } = require('firebase/auth');
            const { auth: firebaseAuth } = require('../../firebaseConfig');
            signInAnonymously(firebaseAuth).catch(() => { });
        } catch (e) { }

        await AsyncStorage.setItem('lastAdminId', id);
        await login(id, role);
        setPasswordInput('');

        const roleName = role === 'master' ? t('auth.role_master') :
            role === 'alliance_admin' ? t('auth.role_alliance_admin') :
                role === 'admin' ? t('auth.role_op_admin') : t('auth.role_general');

        showCustomAlert(t('auth.authSuccess'), t('auth.welcome', { id, role: roleName }), 'success');
    };

    const handleEnterAlliance = async () => {
        const forceServer = inputServer.trim() ? (inputServer.trim().startsWith('#') ? inputServer.trim() : `#${inputServer.trim()}`) : '';
        const forceAlliance = inputAlliance.trim();
        const inputId = inputUserId.trim();
        const inputPw = inputPassword.trim();

        setGateLoginError(null);
        setIsLoginLoading(true);

        // Simulate network delay for smooth UX
        await new Promise(resolve => setTimeout(resolve, 600));

        if (isRegisterMode) {
            if (!forceServer || !forceAlliance) {
                setGateLoginError(t('manual.gateLoginAndApply'));
                setIsLoginLoading(false);
                return;
            }
            if (!inputId || !inputPw) {
                setGateLoginError(t('manual.requireAdminAuth'));
                setIsLoginLoading(false);
                return;
            }

            try {
                const hashed = await hashPassword(inputPw);
                await setDoc(doc(collection(db, "alliance_requests")), {
                    serverId: forceServer,
                    allianceId: forceAlliance,
                    allianceName: forceAlliance,
                    adminId: inputId,
                    adminPassword: hashed,
                    status: 'pending',
                    requestedAt: Date.now()
                });

                showCustomAlert(t('manual.applySuccess'), t('manual.applySuccessDesc'), 'success');
                setIsRegisterMode(false);
            } catch (error: any) {
                setGateLoginError(t('manual.applyError') + ': ' + error.message);
            }
            setIsLoginLoading(false);
        } else {
            if (inputId && inputPw) {
                try {
                    const hashed = await hashPassword(inputPw);
                    const lowerId = inputId.toLowerCase();

                    // 1. Master Admin Check
                    const master = MASTER_CREDENTIALS.find(m => m.id.toLowerCase() === lowerId);
                    if (master) {
                        if (master.pw === hashed || master.pw === inputPw) {
                            await performLogin(inputId, 'master');
                            const finalServer = forceServer || serverId || '#000';
                            const finalAlliance = forceAlliance || allianceId || 'MASTER_SYSTEM';
                            setAllianceInfo(finalServer, finalAlliance);
                            await saveToHistory('server', finalServer);
                            await saveToHistory('alliance', finalAlliance);
                            await saveToHistory('userid', inputId);
                            setIsGateOpen(false);
                            setIsLoginLoading(false);
                            return;
                        } else {
                            setGateLoginError(t('manual.masterPwError'));
                            setIsLoginLoading(false);
                            return;
                        }
                    }

                    if (!forceServer || !forceAlliance) {
                        setGateLoginError(t('manual.requireAllFields'));
                        setIsLoginLoading(false);
                        return;
                    }

                    // 2. Global Users Check
                    let globalUserData = null;
                    let globalUserId = inputId;
                    const userRef = doc(db, "users", inputId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        globalUserData = userSnap.data();
                    } else {
                        const qUsers = query(collection(db, "users"), where("username", "==", inputId));
                        const qUsersSnap = await getDocs(qUsers);
                        if (!qUsersSnap.empty) {
                            globalUserData = qUsersSnap.docs[0].data();
                            globalUserId = qUsersSnap.docs[0].id;
                        } else {
                            const qNick = query(collection(db, "users"), where("nickname", "==", inputId));
                            const qNickSnap = await getDocs(qNick);
                            if (!qNickSnap.empty) {
                                globalUserData = qNickSnap.docs[0].data();
                                globalUserId = qNickSnap.docs[0].id;
                            }
                        }
                    }

                    if (globalUserData) {
                        const userData = globalUserData;
                        const storedPw = userData.password?.toString();

                        if (storedPw === hashed || storedPw === inputPw) {
                            const finalServer = (userData.role === 'master' || userData.role === 'super_admin') ? (forceServer || '#000') : userData.serverId;
                            const finalAlliance = (userData.role === 'master' || userData.role === 'super_admin') ? (forceAlliance || 'SYSTEM') : userData.allianceId;

                            if (finalServer && finalAlliance) {
                                setAllianceInfo(finalServer, finalAlliance);
                                await saveToHistory('server', finalServer);
                                await saveToHistory('alliance', finalAlliance);
                                await saveToHistory('userid', inputId);
                                await performLogin(globalUserId, userData.role || 'user');
                                setIsGateOpen(false);
                                setIsLoginLoading(false);
                                return;
                            }
                        } else {
                            setGateLoginError(t('auth.pwMismatchRetry'));
                            setIsLoginLoading(false);
                            return;
                        }
                    }

                    // 3. Legacy Alliance Admin Check
                    let adminData = null;
                    let finalAdminId = inputId;
                    const adminRef = doc(db, "servers", forceServer, "alliances", forceAlliance, "admins", inputId);
                    const adminSnap = await getDoc(adminRef);
                    if (adminSnap.exists()) {
                        adminData = adminSnap.data();
                    } else {
                        const qAdmin = query(collection(db, "servers", forceServer, "alliances", forceAlliance, "admins"), where("name", "==", inputId));
                        const qAdminSnap = await getDocs(qAdmin);
                        if (!qAdminSnap.empty) {
                            adminData = qAdminSnap.docs[0].data();
                            finalAdminId = qAdminSnap.docs[0].id;
                        }
                    }

                    if (adminData) {
                        const storedPw = adminData.password?.toString();
                        if (storedPw === hashed || storedPw === inputPw) {
                            setAllianceInfo(forceServer, forceAlliance);
                            await saveToHistory('server', forceServer);
                            await saveToHistory('alliance', forceAlliance);
                            await saveToHistory('userid', inputId);
                            await performLogin(finalAdminId, adminData.role || 'admin');
                            setIsGateOpen(false);
                            setIsLoginLoading(false);
                            return;
                        } else {
                            setGateLoginError(t('auth.passwordMismatch'));
                            setIsLoginLoading(false);
                            return;
                        }
                    }

                    // 4. General Member Check
                    let memberData = null;
                    let finalMemberId = inputId;
                    const memberRef = doc(db, "servers", forceServer, "alliances", forceAlliance, "members", inputId);
                    const memberSnap = await getDoc(memberRef);
                    if (memberSnap.exists()) {
                        memberData = memberSnap.data();
                    } else {
                        const q = query(collection(db, "servers", forceServer, "alliances", forceAlliance, "members"), where("nickname", "==", inputId));
                        const qSnap = await getDocs(q);
                        if (!qSnap.empty) {
                            memberData = qSnap.docs[0].data();
                            finalMemberId = qSnap.docs[0].id;
                        }
                    }

                    if (memberData) {
                        const storedPw = memberData.password?.toString();
                        if (storedPw === inputPw || storedPw === hashed) {
                            setAllianceInfo(forceServer, forceAlliance);
                            await saveToHistory('server', forceServer);
                            await saveToHistory('alliance', forceAlliance);
                            await saveToHistory('userid', inputId);
                            await performLogin(finalMemberId, 'user');
                            setIsGateOpen(false);
                            setIsLoginLoading(false);
                            return;
                        } else {
                            setGateLoginError(t('auth.passwordMismatch'));
                            setIsLoginLoading(false);
                            return;
                        }
                    }

                    setGateLoginError(t('auth.userNotFound'));
                    setIsLoginLoading(false);
                } catch (e) {
                    console.error('Auth error:', e);
                    setGateLoginError(t('auth.authError'));
                    setIsLoginLoading(false);
                }
            } else {
                if (inputId) {
                    setGateLoginError(t('auth.onlyIdError'));
                    setIsLoginLoading(false);
                    return;
                }
                if (!forceServer || !forceAlliance) {
                    setGateLoginError(t('auth.requireServerAlliance'));
                    setIsLoginLoading(false);
                    return;
                }
                setAllianceInfo(forceServer, forceAlliance);
                await saveToHistory('server', forceServer);
                await saveToHistory('alliance', forceAlliance);
                setIsGateOpen(false);
                setIsLoginLoading(false);
            }
        }
    };

    const handleLogin = async (dynamicAdmins: any[]) => {
        const input = (loginInput || '').trim();
        const pw = (passwordInput || '').trim();
        setLoginError('');

        if (!input || !pw) {
            setLoginError(t('auth.loginInputError'));
            return;
        }

        try {
            const hashed = await hashPassword(pw);
            const lowerId = input.toLowerCase();

            // 1. Master Admin Check
            const master = MASTER_CREDENTIALS.find(m => m.id.toLowerCase() === lowerId);
            if (master && (master.pw === hashed || master.pw === pw)) {
                await performLogin(input, 'master');
                return true;
            }

            // 2. Global Users Check
            let globalUserData = null;
            let globalUserId = input;
            const userRef = doc(db, "users", input);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                globalUserData = userSnap.data();
            } else {
                const qUsers = query(collection(db, "users"), where("username", "==", input));
                const qUsersSnap = await getDocs(qUsers);
                if (!qUsersSnap.empty) {
                    globalUserData = qUsersSnap.docs[0].data();
                    globalUserId = qUsersSnap.docs[0].id;
                } else {
                    const qNick = query(collection(db, "users"), where("nickname", "==", input));
                    const qNickSnap = await getDocs(qNick);
                    if (!qNickSnap.empty) {
                        globalUserData = qNickSnap.docs[0].data();
                        globalUserId = qNickSnap.docs[0].id;
                    }
                }
            }

            if (globalUserData) {
                const userData = globalUserData;
                const storedPw = userData.password?.toString();

                if (storedPw === hashed || storedPw === pw) {
                    if (userData.serverId && userData.allianceId) {
                        setAllianceInfo(userData.serverId, userData.allianceId);
                    }
                    await performLogin(globalUserId, userData.role || 'user');
                    return true;
                } else {
                    setLoginError(t('auth.passwordMismatch'));
                    return false;
                }
            }

            // 3. Dynamic Admin Check
            const dynamic = dynamicAdmins.find(a => {
                const aNameLower = a.name.toLowerCase();
                const aPw = (a.password || '').toLowerCase();
                return aNameLower === lowerId && (aPw === hashed || aPw === pw.toLowerCase());
            });

            if (dynamic) {
                await performLogin(dynamic.name, dynamic.role || 'admin');
                return true;
            } else {
                setLoginError(t('auth.loginFailed'));
                return false;
            }
        } catch (e) {
            console.error('[Modal Login] Error:', e);
            setLoginError(t('auth.authError'));
            return false;
        }
    };

    const fetchRequests = (onUpdate?: (reqs: any[]) => void) => {
        setIsSuperAdminLoading(true);
        const q = query(collection(db, 'alliance_requests'), orderBy('requestedAt', 'desc'));
        return onSnapshot(q, (snap) => {
            const reqs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            setAllRequests(reqs);
            if (onUpdate) onUpdate(reqs);
            setIsSuperAdminLoading(false);
        }, (err) => {
            console.error('Fetch requests error:', err);
            setIsSuperAdminLoading(false);
        });
    };

    const fetchSuperAdmins = async () => {
        setLoadingSuperAdmins(true);
        try {
            const q = query(collection(db, 'users'), where('role', '==', 'super_admin'));
            const snap = await getDocs(q);
            setSuperAdminsList(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) { }
        finally { setLoadingSuperAdmins(false); }
    };

    const handleApproveRequest = async (req: any) => {
        showCustomAlert(
            t('admin.approveAlliance'),
            t('admin.approveConfirm', { server: req.serverId, alliance: req.allianceName }),
            'confirm',
            async () => {
                try {
                    const userRef = doc(db, 'users', req.adminId);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists()) {
                        showCustomAlert(t('common.error_title'), t('admin.idExists'), 'error');
                        return;
                    }
                    await setDoc(userRef, {
                        uid: `admin_${req.serverId.replace('#', '')}_${req.allianceId}`,
                        username: req.adminId,
                        password: req.adminPassword,
                        nickname: `${req.allianceId} 관리자`,
                        role: 'alliance_admin',
                        status: 'active',
                        serverId: req.serverId,
                        allianceId: req.allianceId,
                        contact: req.contact || '',
                        createdAt: Date.now()
                    });
                    const reqRef = doc(db, 'alliance_requests', req.id);
                    await updateDoc(reqRef, { status: 'approved' });
                    setAllRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'approved' } : r));
                    showCustomAlert(t('common.success'), t('admin.approveSuccess'), 'success');
                } catch (error: any) {
                    showCustomAlert(t('common.error_title'), error.message, 'error');
                }
            }
        );
    };

    const handleRejectRequest = async (req: any) => {
        showCustomAlert(
            t('admin.rejectAlliance'),
            t('admin.rejectConfirm', { server: req.serverId, alliance: req.allianceName }),
            'confirm',
            async () => {
                try {
                    const reqRef = doc(db, 'alliance_requests', req.id);
                    await updateDoc(reqRef, { status: 'rejected' });
                    setAllRequests(prev => prev.map(r => r.id === req.id ? { ...r, status: 'rejected' } : r));
                    showCustomAlert(t('common.success'), t('admin.rejectSuccess'), 'success');
                } catch (error: any) {
                    showCustomAlert(t('common.error_title'), error.message, 'error');
                }
            }
        );
    };

    const handleBulkApprove = async () => {
        if (selectedReqIds.size === 0) return;
        showCustomAlert(
            t('admin.bulkApprove'),
            t('admin.bulkApproveConfirm', { count: selectedReqIds.size }),
            'confirm',
            async () => {
                try {
                    const batch = writeBatch(db);
                    const selectedReqs = allRequests.filter(r => selectedReqIds.has(r.id));
                    for (const req of selectedReqs) {
                        const userRef = doc(db, 'users', req.adminId);
                        batch.set(userRef, {
                            uid: `admin_${req.serverId.replace('#', '')}_${req.allianceId}`,
                            username: req.adminId,
                            password: req.adminPassword,
                            nickname: `${req.allianceId} 관리자`,
                            role: 'alliance_admin',
                            status: 'active',
                            serverId: req.serverId,
                            allianceId: req.allianceId,
                            contact: req.contact || '',
                            createdAt: Date.now()
                        });
                        const reqRef = doc(db, 'alliance_requests', req.id);
                        batch.update(reqRef, { status: 'approved' });
                    }
                    await batch.commit();
                    setAllRequests(prev => prev.map(r => selectedReqIds.has(r.id) ? { ...r, status: 'approved' } : r));
                    setSelectedReqIds(new Set());
                    showCustomAlert(t('common.success'), t('admin.bulkApproveSuccess'), 'success');
                } catch (error: any) {
                    showCustomAlert(t('common.error_title'), t('admin.bulkApproveError', { error: error.message }), 'error');
                }
            }
        );
    };

    const handleBulkReject = async () => {
        if (selectedReqIds.size === 0) return;
        showCustomAlert(
            t('admin.bulkReject'),
            t('admin.bulkRejectConfirm', { count: selectedReqIds.size }),
            'confirm',
            async () => {
                try {
                    const batch = writeBatch(db);
                    selectedReqIds.forEach(id => {
                        const reqRef = doc(db, 'alliance_requests', id);
                        batch.update(reqRef, { status: 'rejected' });
                    });
                    await batch.commit();
                    setAllRequests(prev => prev.map(r => selectedReqIds.has(r.id) ? { ...r, status: 'rejected' } : r));
                    setSelectedReqIds(new Set());
                    showCustomAlert(t('common.success'), t('admin.bulkRejectSuccess'), 'success');
                } catch (error: any) {
                    showCustomAlert('오류', '선택 거절 중 오류가 발생했습니다: ' + error.message, 'error');
                }
            }
        );
    };

    const handleResetPasswordAdmin = async (req: any) => {
        showCustomAlert(
            t('admin.resetPassword'),
            t('admin.resetPwConfirm', { id: req.adminId }),
            'confirm',
            async () => {
                try {
                    const hashed = await hashPassword('1234');
                    await updateDoc(doc(db, "users", req.adminId), {
                        password: hashed
                    });
                    showCustomAlert(t('common.success'), t('admin.resetPwSuccess'), 'success');
                } catch (e) {
                    console.error(e);
                    showCustomAlert(t('common.error_title'), t('admin.resetPwError'), 'error');
                }
            }
        );
    };

    const handleDeleteAlliance = async (req: any) => {
        showCustomAlert(
            t('admin.deleteAlliance'),
            t('admin.deleteAllianceConfirm', { id: req.allianceId }),
            'confirm',
            async () => {
                try {
                    await deleteDoc(doc(db, "users", req.adminId));
                    await deleteDoc(doc(db, "alliance_requests", req.id));
                    setAllRequests(prev => prev.filter(r => r.id !== req.id));
                    showCustomAlert(t('common.success'), t('admin.deleteAllianceSuccess'), 'success');
                } catch (e: any) {
                    console.error(e);
                    showCustomAlert(t('common.error_title'), t('admin.deleteAllianceError'), 'error');
                }
            }
        );
    };

    const handleDeleteSuperAdmin = async (adminId: string, name: string) => {
        showCustomAlert(
            '관리자 삭제',
            `${name}님을 삭제하시겠습니까?`,
            'confirm',
            async () => {
                try {
                    await deleteDoc(doc(db, 'users', adminId));
                    setSuperAdminsList(prev => prev.filter(a => a.id !== adminId));
                    showCustomAlert(t('common.success'), '삭제되었습니다.', 'success');
                } catch (e: any) {
                    showCustomAlert(t('common.error_title'), e.message, 'error');
                }
            }
        );
    };

    const handleAddSuperAdmin = async () => {
        if (!newAdminName.trim() || !newAdminPassword.trim()) {
            showCustomAlert(t('common.error_title'), '아이디와 비밀번호를 입력해주세요.', 'warning');
            return;
        }
        try {
            const userId = newAdminName.trim();
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                showCustomAlert(t('common.error_title'), '이미 존재하는 아이디입니다.', 'error');
                return;
            }
            const hashed = await hashPassword(newAdminPassword.trim());
            const newAdminData = {
                uid: `super_admin_${userId}`,
                username: userId,
                password: hashed,
                nickname: userId,
                role: 'super_admin',
                status: 'active',
                createdAt: Date.now()
            };
            await setDoc(userRef, newAdminData);
            setSuperAdminsList(prev => [...prev, { id: userId, ...newAdminData }]);
            setNewAdminName('');
            setNewAdminPassword('');
            showCustomAlert(t('common.success'), '슈퍼 관리자가 추가되었습니다.', 'success');
        } catch (e: any) {
            showCustomAlert(t('common.error_title'), e.message, 'error');
        }
    };

    const toggleSelectRequest = (id: string) => {
        const next = new Set(selectedReqIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedReqIds(next);
    };

    const register = async (profile: any, pw: string) => {
        try {
            const userRef = doc(db, 'users', profile.username);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                return { success: false, message: t('auth.idExists') || '이미 존재하는 아이디입니다.' };
            }

            const pwHash = await hashPassword(pw);
            const newUser = {
                ...profile,
                uid: `${profile.username}_${Date.now()}`,
                password: pwHash,
                status: 'pending',
                createdAt: Date.now(),
            };

            await setDoc(userRef, newUser);
            return { success: true };
        } catch (e: any) {
            return { success: false, message: e.message };
        }
    };

    const seedSuperAdmin = async () => {
        try {
            const adminId = 'admin';
            const exists = await getDoc(doc(db, 'users', adminId));
            if (!exists.exists()) {
                const pwHash = await hashPassword('wos1234');
                await setDoc(doc(db, 'users', adminId), {
                    uid: 'super_admin_001',
                    username: adminId,
                    nickname: 'System Admin',
                    password: pwHash,
                    role: 'super_admin',
                    status: 'active',
                    createdAt: Date.now()
                });
                return true;
            }
            return false;
        } catch (e) {
            console.error(e);
            return false;
        }
    };

    const handleLogout = async (setAdminMenuVisible: (v: boolean) => void) => {
        await logout();
        setLoginInput('');
        setPasswordInput('');
        setInputUserId('');
        setInputPassword('');
        setAdminMenuVisible(false);
        setAllianceInfo(null, null);
        setIsGateOpen(true);
    };

    const handleSettingsPress = (setAdminMenuVisible: (v: boolean) => void, setLoginModalVisible: (v: boolean) => void) => {
        auth.isLoggedIn ? setAdminMenuVisible(true) : setLoginModalVisible(true);
    };

    const handleResetSettings = async () => {
        showCustomAlert(t('manual.resetInfo'), t('manual.resetInfoConfirm'), 'confirm', async () => {
            try {
                await AsyncStorage.multiRemove(['lastAdminId', 'lastAdminRole', 'recent_server', 'recent_alliance', 'recent_userid']);
                setInputServer('');
                setInputAlliance('');
                setInputUserId('');
                setInputPassword('');
                setAllianceInfo(null, null);
                setIsGateOpen(true);
                showCustomAlert(t('common.success'), t('manual.resetInfoSuccess'), 'success');
            } catch (e) {
                console.error('Reset error:', e);
            }
        });
    };

    return {
        loginInput, setLoginInput,
        passwordInput, setPasswordInput,
        loginError, setLoginError,
        gateLoginError, setGateLoginError,
        isLoginLoading, setIsLoginLoading,
        inputServer, setInputServer,
        inputAlliance, setInputAlliance,
        inputUserId, setInputUserId,
        inputPassword, setInputPassword,
        isRegisterMode, setIsRegisterMode,
        recentServers, recentAlliances, recentUserIds,
        gateUserIdRef, gatePasswordRef, loginPasswordRef,
        allRequests, setAllRequests,
        selectedReqIds, setSelectedReqIds,
        superAdminTab, setSuperAdminTab,
        isSuperAdminLoading, setIsSuperAdminLoading,
        superAdminsList, setSuperAdminsList,
        loadingSuperAdmins, setLoadingSuperAdmins,
        newAdminName, setNewAdminName,
        newAdminPassword, setNewAdminPassword,
        handleEnterAlliance,
        handleLogin,
        handleLogout,
        handleSettingsPress,
        handleResetSettings,
        saveToHistory,
        fetchRequests,
        fetchSuperAdmins,
        handleApproveRequest,
        handleRejectRequest,
        handleBulkApprove,
        handleBulkReject,
        handleResetPasswordAdmin,
        handleDeleteAlliance,
        handleDeleteSuperAdmin,
        handleAddSuperAdmin,
        toggleSelectRequest,
        register,
        seedSuperAdmin,
        login,
        logout,
        // Compatibility Aliases
        user: auth,
        loading: isLoginLoading
    };
};
