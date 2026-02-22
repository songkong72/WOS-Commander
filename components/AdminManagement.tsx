import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView, Platform, ActivityIndicator, Modal, useWindowDimensions, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useTheme } from '../app/context';
import { useFirestoreMembers } from '../hooks/useFirestoreMembers';
import { useFirestoreAdmins } from '../hooks/useFirestoreAdmins';
import { useFirestoreStrategySheet } from '../hooks/useFirestoreStrategySheet';
import { useFirestoreThemeConfig } from '../hooks/useFirestoreThemeConfig';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as XLSX from 'xlsx';
import { hashPassword } from '../utils/crypto';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, writeBatch, doc, where } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { useFirestoreNotificationSettings } from '../hooks/useFirestoreNotificationSettings';
import { sendWebhookNotification, createAllianceRegistrationMessage } from '../services/NotificationService';

interface AdminManagementProps {
    serverId: string | null;
    allianceId: string | null;
    onBack: () => void;
}

export default function AdminManagement({ serverId, allianceId, onBack }: AdminManagementProps) {
    const { t } = useTranslation();
    const { auth, showCustomAlert } = useAuth();
    const { theme, fontSizeScale } = useTheme();
    const isDark = theme === 'dark';
    const { width } = useWindowDimensions();
    const isMobile = width < 600;

    const [targetServerId, setTargetServerId] = useState(serverId);
    const [targetAllianceId, setTargetAllianceId] = useState(allianceId);

    const { members, loading: membersLoading, saveMembers, clearAllMembers, deleteMember, updateMemberPassword } = useFirestoreMembers(targetServerId, targetAllianceId);
    const { sheetData, saveSheetUrl, uploadStrategyFile } = useFirestoreStrategySheet(targetServerId, targetAllianceId);
    const { themeConfig, saveDefaultMode } = useFirestoreThemeConfig(targetServerId, targetAllianceId);
    const { settings: notificationSettings, saveWebhookUrl: saveAllianceWebhook } = useFirestoreNotificationSettings(targetServerId, targetAllianceId);

    const [searchTerm, setSearchTerm] = useState('');
    const [uploading, setUploading] = useState(false);
    const [isDragOver, setIsDragOver] = useState(false);
    const [strategyUploading, setStrategyUploading] = useState(false);
    const [previewData, setPreviewData] = useState<{ id: string, nickname: string }[]>([]);
    const [showGuide, setShowGuide] = useState(false);
    const [strategyUrl, setStrategyUrl] = useState('');
    const [saveLoading, setSaveLoading] = useState(false);

    // -- Manual Entry States --
    const [manualNick, setManualNick] = useState('');
    const [manualId, setManualId] = useState('');
    const [manualPw, setManualPw] = useState('');

    const [selectedMember, setSelectedMember] = useState<any>(null);
    const [isSettingsModalVisible, setIsSettingsModalVisible] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [roleFilter, setRoleFilter] = useState<'all' | 'staff' | 'general'>('all');
    const [hoveredRow, setHoveredRow] = useState<string | null>(null);
    const [hoveredStaffBtn, setHoveredStaffBtn] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'members' | 'strategy' | 'settings'>('members');
    const [sharingId, setSharingId] = useState<string | null>(null);

    const handleShareInvite = async (member: any) => {
        setSharingId(member.id);
        const appUrl = 'https://wos-commander.web.app';
        const inviteMessage = `[WOS 커맨더 초대장]\n\n🏰 대시보드 주소: ${appUrl}\n👤 아이디: ${member.nickname}\n🔑 초기 비밀번호: 1234\n\n지금 접속해서 전략과 일정을 확인하세요!`;

        try {
            if (Platform.OS === 'web') {
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(inviteMessage);
                    showCustomAlert(t('common.success'), t('admin.invite_copy_success', '초대 문구가 클립보드에 복사되었습니다. 대상에게 붙여넣기(Ctrl+V) 하세요!'), 'success');
                }
            } else {
                await Share.share({
                    message: inviteMessage,
                    title: 'WOS 커맨더 초대'
                });
            }
        } catch (error) {
            console.error('Share error:', error);
        } finally {
            setSharingId(null);
        }
    };


    const [allServers, setAllServers] = useState<string[]>([]);
    const [allAlliances, setAllAlliances] = useState<{ id: string, serverId: string }[]>([]);

    useEffect(() => {
        if (auth.role === 'master' || auth.role === 'super_admin') {
            const fetchAlliances = async () => {
                const q = query(collection(db, 'alliance_requests'), where('status', '==', 'approved'));
                const snapshot = await getDocs(q);
                // Deduplicate alliances
                const uniqueMap = new Map();
                snapshot.docs.forEach(d => {
                    const data = d.data();
                    const key = `${data.serverId}_${data.allianceId}`;
                    if (!uniqueMap.has(key)) {
                        uniqueMap.set(key, { id: data.allianceId, serverId: data.serverId });
                    }
                });

                const uniqueAlliances = Array.from(uniqueMap.values()) as { id: string, serverId: string }[];
                const uniqueServers = Array.from(new Set(uniqueAlliances.map(a => a.serverId))).sort();

                setAllServers(uniqueServers);
                setAllAlliances(uniqueAlliances);

                if (!serverId && uniqueServers.length > 0) {
                    setTargetServerId(uniqueServers[0]);
                }
            };
            fetchAlliances();
        }
    }, [auth.role]);

    useEffect(() => {
        if ((auth.role === 'master' || auth.role === 'super_admin') && targetServerId) {
            const serverAlliances = allAlliances.filter(a => a.serverId === targetServerId);
            if (serverAlliances.length > 0 && (!targetAllianceId || !serverAlliances.find(a => a.id === targetAllianceId))) {
                setTargetAllianceId(serverAlliances[0].id);
            }
        }
    }, [targetServerId, allAlliances]);


    useEffect(() => {
        if (sheetData?.url) {
            setStrategyUrl(sheetData.url);
        }
    }, [sheetData]);

    const downloadTemplate = () => {
        try {
            const data = [
                { [t('admin.idLabel')]: '12345678', [t('admin.nicknameLabel')]: '영광의사령관' },
                { [t('admin.idLabel')]: '87654321', [t('admin.nicknameLabel')]: '세종대왕' },
                { [t('admin.idLabel')]: '11223344', [t('admin.nicknameLabel')]: '화이트아웃' }
            ];

            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "연맹원명단양식");

            /* generate XLSX file and send to client */
            XLSX.writeFile(wb, "연맹원_등록_양식.xlsx");
        } catch (error) {
            console.error('Template download error:', error);
            showCustomAlert(t('common.error_title'), t('admin.template_error', '양식 다운로드 중 문제가 발생했습니다.'), 'error');
        }
    };

    const handleSaveDefaultTheme = async (mode: 'dark' | 'light') => {
        try {
            await saveDefaultMode(mode);
            showCustomAlert(t('admin.saveSuccess'), t('admin.saveSuccessDesc'), 'success');
        } catch (error: any) {
            showCustomAlert(t('admin.saveError'), t('admin.saveErrorDesc'), 'error');
        }
    };

    const processExcelFile = (file: File) => {
        setUploading(true);
        const reader = new FileReader();
        reader.onload = (e: any) => {
            try {
                const ab = e.target.result;
                const wb = XLSX.read(ab, { type: 'array' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const json: any[] = XLSX.utils.sheet_to_json(ws);

                const formatted = json.map(row => {
                    const keys = Object.keys(row);
                    const idKey = keys.find(k => k.toLowerCase().includes('id') || k.includes('아이디'));
                    const nickKey = keys.find(k => k.toLowerCase().includes('nick') || k.includes('닉네임') || k.includes('이름'));
                    return {
                        id: String(row[idKey || keys[0]] || ''),
                        nickname: String(row[nickKey || keys[1]] || '')
                    };
                }).filter(item => item.id && item.nickname);

                setPreviewData(formatted);
            } catch (err) {
                console.error('Excel parse error:', err);
                showCustomAlert(t('common.error_title'), t('admin.excel_read_error', '파일을 읽는 중 문제가 발생했습니다.'), 'error');
            } finally {
                setUploading(false);
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDrop = (e: any) => {
        e.preventDefault();
        setIsDragOver(false);
        const file = e.dataTransfer?.files?.[0];
        if (!file) return;
        const validTypes = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv'];
        if (!validTypes.includes(file.type) && !file.name.match(/\.(xlsx|xls|csv)$/i)) {
            showCustomAlert(t('admin.file_error', '파일 오류'), t('admin.invalid_file_type', '.xlsx, .xls, .csv 파일만 업로드할 수 있습니다.'), 'warning');
            return;
        }
        processExcelFile(file);
    };

    const handleExcelUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                    'text/csv'
                ]
            });

            if (result.canceled) return;

            setUploading(true);
            const file = result.assets[0];

            if (Platform.OS === 'web') {
                // @ts-ignore
                const actualFile = file.file;
                const reader = new FileReader();
                reader.onload = (e: any) => {
                    const ab = e.target.result;
                    const wb = XLSX.read(ab, { type: 'array' });
                    const wsname = wb.SheetNames[0];
                    const ws = wb.Sheets[wsname];
                    const json: any[] = XLSX.utils.sheet_to_json(ws);

                    const formatted = json.map(row => {
                        const keys = Object.keys(row);
                        const idKey = keys.find(k => k.toLowerCase().includes('id') || k.includes('아이디'));
                        const nickKey = keys.find(k => k.toLowerCase().includes('nick') || k.includes('닉네임') || k.includes('이름'));

                        return {
                            id: String(row[idKey || keys[0]] || ''),
                            nickname: String(row[nickKey || keys[1]] || '')
                        };
                    }).filter(item => item.id && item.nickname);

                    setPreviewData(formatted);
                    setUploading(false);
                };
                reader.readAsArrayBuffer(actualFile);
            } else {
                showCustomAlert(t('common.info'), t('admin.excel_web_only', '모바일에서의 엑셀 파싱은 현재 웹 버전에서 권장됩니다.'), 'warning');
                setUploading(false);
            }

        } catch (error) {
            console.error('Excel upload error:', error);
            showCustomAlert(t('common.error_title'), t('admin.excel_read_error', '파일을 읽는 중 문제가 발생했습니다.'), 'error');
            setUploading(false);
        }
    };

    const handleSaveMembers = async () => {
        if (previewData.length === 0) return;
        try {
            await saveMembers(previewData);

            // Send Notification
            if (notificationSettings?.webhookUrl) {
                const message = createAllianceRegistrationMessage(targetAllianceId || '', targetServerId || '', previewData.length);
                sendWebhookNotification(notificationSettings.webhookUrl, message);
            }

            setPreviewData([]);
            showCustomAlert(t('common.success'), t('admin.members_save_success', { count: previewData.length }), 'success');
        } catch (error) {
            showCustomAlert(t('common.error_title'), t('admin.members_save_error', '명단 저장 중 오류가 발생했습니다.'), 'error');
        }
    };

    const handleManualAdd = async () => {
        if (!manualNick.trim()) {
            showCustomAlert(t('common.error_title'), t('admin.input_nickname', '닉네임을 입력해주세요.'), 'warning');
            return;
        }
        try {
            const finalId = manualId.trim() || `auto_${Date.now()}`;
            await saveMembers([{
                id: finalId,
                nickname: manualNick.trim(),
                password: manualPw.trim() || '1234'
            }]);

            // Send Notification
            if (notificationSettings?.webhookUrl) {
                const message = createAllianceRegistrationMessage(targetAllianceId || '', targetServerId || '', 1);
                sendWebhookNotification(notificationSettings.webhookUrl, message);
            }

            setManualNick('');
            setManualId('');
            setManualPw('');
            showCustomAlert(t('common.success'), t('admin.member_add_success', { pw: manualPw.trim() || '1234' }), 'success');
        } catch (error) {
            showCustomAlert(t('common.error_title'), t('admin.member_add_error', '멤버 등록 중 오류가 발생했습니다.'), 'error');
        }
    };

    const { dynamicAdmins, addAdmin, removeAdmin } = useFirestoreAdmins(serverId, allianceId);

    const handleSelectedReset = async () => {
        if (selectedIds.length === 0) {
            showCustomAlert(t('common.info'), t('admin.select_target_first', '먼저 작업을 수행할 대상을 선택해주세요.'), 'warning');
            return;
        }

        showCustomAlert(t('admin.resetPassword'), t('admin.reset_selected_confirm', { count: selectedIds.length }), 'confirm', async () => {
            try {
                const batch = writeBatch(db);
                selectedIds.forEach(id => {
                    const ref = doc(db, "servers", targetServerId!, "alliances", targetAllianceId!, "members", id);
                    batch.update(ref, { password: '1234', updatedAt: Date.now() });
                });

                await batch.commit();
                setSelectedIds([]);
                showCustomAlert(t('common.success'), t('admin.reset_selected_success', { count: selectedIds.length }), 'success');
            } catch (error: any) {
                showCustomAlert(t('common.error_title'), t('admin.reset_error', '초기화 중 오류 발생: ') + error.message, 'error');
            }
        });
    };

    const handleSelectedDelete = async () => {
        if (selectedIds.length === 0) {
            showCustomAlert(t('common.info'), t('admin.select_delete_target', '먼저 삭제할 대상을 선택해주세요.'), 'warning');
            return;
        }

        showCustomAlert(t('admin.deleteMember'), t('admin.delete_selected_confirm', { count: selectedIds.length }), 'confirm', async () => {
            try {
                const batch = writeBatch(db);
                selectedIds.forEach(id => {
                    const ref = doc(db, "servers", targetServerId!, "alliances", targetAllianceId!, "members", id);
                    batch.delete(ref);
                });

                await batch.commit();
                setSelectedIds([]);
                showCustomAlert(t('common.success'), t('admin.delete_selected_success', { count: selectedIds.length }), 'success');
            } catch (error: any) {
                showCustomAlert(t('common.error_title'), t('admin.delete_error', '삭제 중 오류 발생: ') + error.message, 'error');
            }
        });
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredMembers.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredMembers.map(m => m.id));
        }
    };

    const toggleSelectMember = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const toggleStaff = async (member: any) => {
        const isAdmin = dynamicAdmins.some(a => a.name === member.nickname);
        if (isAdmin) {
            await removeAdmin(member.nickname);
            showCustomAlert(t('common.success'), t('admin.staff_removed', { name: member.nickname }), 'success');
        } else {
            const hashed = await hashPassword('1234');
            await addAdmin(member.nickname, auth.adminName || 'Admin', 'admin', hashed);
            showCustomAlert(t('admin.role_grant'), t('admin.staff_added', { name: member.nickname }), 'success');
        }
    };

    const handleStrategyFileUpload = async () => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: [
                    'image/*',
                    'application/pdf',
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'application/vnd.ms-excel',
                    'text/csv'
                ],
            });

            if (result.canceled) return;

            setStrategyUploading(true);
            const file = result.assets[0];

            let blob: Blob;
            if (Platform.OS === 'web') {
                try {
                    const response = await fetch(file.uri);
                    blob = await response.blob();
                } catch (fetchError) {
                    // @ts-ignore
                    if (file.file) {
                        // @ts-ignore
                        blob = file.file;
                    } else {
                        throw new Error('파일 데이터를 가져올 수 없습니다.');
                    }
                }
            } else {
                const response = await fetch(file.uri);
                blob = await response.blob();
            }

            await uploadStrategyFile(blob, file.name);
            showCustomAlert(t('common.success'), t('admin.strategy_upload_success'), 'success');
        } catch (error: any) {
            console.error('Strategy upload error:', error);
            showCustomAlert(t('common.error_title'), t('admin.strategy_upload_error'), 'error');
        } finally {
            setStrategyUploading(false);
        }
    };

    const handleSaveStrategyUrl = async () => {
        if (!strategyUrl.trim()) {
            showCustomAlert(t('common.error_title'), t('admin.input_url', '주소를 입력해주세요.'), 'warning');
            return;
        }

        setSaveLoading(true);
        try {
            await saveSheetUrl(strategyUrl.trim(), 'url');
            showCustomAlert(t('admin.saveSuccess'), t('admin.save_url_success'), 'success');
        } catch (error: any) {
            showCustomAlert(t('admin.saveError'), t('admin.save_url_error'), 'error');
        } finally {
            setSaveLoading(false);
        }
    };

    const filteredMembers = React.useMemo(() => {
        return members.filter(m => {
            const matchesSearch = m.nickname.toLowerCase().includes(searchTerm.toLowerCase()) ||
                m.id.toLowerCase().includes(searchTerm.toLowerCase());

            const isAdmin = dynamicAdmins.some(a => a.name === m.nickname);
            const matchesRole = roleFilter === 'all' ? true :
                roleFilter === 'staff' ? isAdmin : !isAdmin;

            return matchesSearch && matchesRole;
        });
    }, [members, searchTerm, roleFilter, dynamicAdmins]);

    return (
        <View className={`flex-1 ${isMobile ? 'p-4' : 'p-8'} ${isDark ? 'bg-[#020617]' : 'bg-slate-50'}`}>
            <View className="max-w-4xl mx-auto w-full flex-1">
                <View className={`flex-row items-center ${isMobile ? 'mb-5 mt-4' : 'mb-8 mt-6'}`}>
                    <TouchableOpacity onPress={onBack} className={`mr-4 ${isMobile ? 'p-2' : 'p-3'} rounded-2xl shadow-lg border transition-all active:scale-95 ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <Ionicons name="arrow-back" size={isMobile ? 18 : 22} color={isDark ? "white" : "#1e293b"} />
                    </TouchableOpacity>
                    <Text className={`font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`} style={{ fontSize: (isMobile ? 20 : 30) * fontSizeScale }}>{t('admin.dashboardTitle')}</Text>
                </View>

                {/* Master Context Selector */}
                {(auth.role === 'master' || auth.role === 'super_admin') && (
                    <View className={`mb-6 p-4 rounded-3xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                        <View className="flex-row items-center mb-3">
                            <Ionicons name="globe-outline" size={18} color="#38bdf8" className="mr-2" />
                            <Text className={`font-black ${isDark ? 'text-slate-300' : 'text-slate-600'}`} style={{ fontSize: 16 * fontSizeScale }}>{t('admin.selectTargetMaster')}</Text>
                        </View>
                        <View className="flex-row gap-3">
                            <View className="flex-1 space-y-2">
                                <Text className={`font-bold ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} style={{ fontSize: 12 * fontSizeScale }}>{t('admin.serverLabel')}</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                                    {allServers.map(s => (
                                        <TouchableOpacity
                                            key={s}
                                            onPress={() => setTargetServerId(s)}
                                            className={`px-4 py-2 rounded-xl border ${targetServerId === s ? 'bg-sky-500 border-sky-500' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200')}`}
                                        >
                                            <Text className={`font-bold ${targetServerId === s ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-600')}`} style={{ fontSize: 12 * fontSizeScale }}>{s}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            </View>
                        </View>
                        <View className="flex-row gap-3 mt-4">
                            <View className="flex-1 space-y-2">
                                <View className="flex-row items-center justify-between">
                                    <Text className={`font-bold ml-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} style={{ fontSize: 12 * fontSizeScale }}>
                                        {targetServerId ? `[${targetServerId}] 소속 연맹 (${allAlliances.filter(a => a.serverId === targetServerId).length})` : '연맹 (Alliance)'}
                                    </Text>
                                </View>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row gap-2">
                                    {allAlliances.filter(a => a.serverId === targetServerId).length > 0 ? (
                                        allAlliances.filter(a => a.serverId === targetServerId).map(a => (
                                            <TouchableOpacity
                                                key={a.id}
                                                onPress={() => setTargetAllianceId(a.id)}
                                                className={`px-4 py-2 rounded-xl border flex-row items-center gap-2 ${targetAllianceId === a.id ? 'bg-indigo-500 border-indigo-500' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200')}`}
                                            >
                                                <Ionicons name="shield-half" size={12} color={targetAllianceId === a.id ? 'white' : (isDark ? '#cbd5e1' : '#64748b')} />
                                                <Text className={`font-bold ${targetAllianceId === a.id ? 'text-white' : (isDark ? 'text-slate-400' : 'text-slate-600')}`} style={{ fontSize: 12 * fontSizeScale }}>{a.id}</Text>
                                            </TouchableOpacity>
                                        ))
                                    ) : (
                                        <Text className={`p-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`} style={{ fontSize: 12 * fontSizeScale }}>
                                            {t('admin.noAlliancesInServer')}
                                        </Text>
                                    )}
                                </ScrollView>
                            </View>
                        </View>
                    </View>
                )}

                {/* Modern Tab Bar */}
                <View className={`flex-row p-1 rounded-[24px] ${isMobile ? 'mb-6' : 'mb-10'} border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                    <TouchableOpacity
                        onPress={() => setActiveTab('members')}
                        className={`flex-1 flex-row items-center justify-center ${isMobile ? 'py-3' : 'py-4'} rounded-[20px] transition-all duration-300 ${activeTab === 'members' ? (isDark ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20' : 'bg-white shadow-md') : ''}`}
                    >
                        <Ionicons name="people" size={isMobile ? 16 : 20} color={activeTab === 'members' ? (isDark ? 'white' : '#4f46e5') : (isDark ? '#475569' : '#94a3b8')} style={{ marginRight: 8 }} />
                        <Text className={`font-black ${activeTab === 'members' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`} style={{ fontSize: (isMobile ? 12 : 14) * fontSizeScale }}>{t('admin.memberManagementTab')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('strategy')}
                        className={`flex-1 flex-row items-center justify-center ${isMobile ? 'py-3' : 'py-4'} rounded-[20px] transition-all duration-300 ${activeTab === 'strategy' ? (isDark ? 'bg-amber-500 shadow-lg shadow-amber-500/20' : 'bg-white shadow-md') : ''}`}
                    >
                        <Ionicons name="document-text" size={isMobile ? 16 : 20} color={activeTab === 'strategy' ? (isDark ? 'white' : '#d97706') : (isDark ? '#475569' : '#94a3b8')} style={{ marginRight: 8 }} />
                        <Text className={`font-black ${activeTab === 'strategy' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`} style={{ fontSize: (isMobile ? 12 : 14) * fontSizeScale }}>{t('admin.strategyDocumentTab')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => setActiveTab('settings')}
                        className={`flex-1 flex-row items-center justify-center ${isMobile ? 'py-3' : 'py-4'} rounded-[20px] transition-all duration-300 ${activeTab === 'settings' ? (isDark ? 'bg-rose-500 shadow-lg shadow-rose-500/20' : 'bg-white shadow-md') : ''}`}
                    >
                        <Ionicons name="settings" size={isMobile ? 16 : 20} color={activeTab === 'settings' ? (isDark ? 'white' : '#f43f5e') : (isDark ? '#475569' : '#94a3b8')} style={{ marginRight: 8 }} />
                        <Text className={`font-black ${activeTab === 'settings' ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`} style={{ fontSize: (isMobile ? 12 : 14) * fontSizeScale }}>{t('admin.settingsTab', '설정')}</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

                    {activeTab === 'strategy' && (
                        <View className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Strategy Document Section */}
                            <View className={`${isMobile ? 'p-4' : 'p-6'} rounded-3xl border shadow-xl mb-6 ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                                <View className={`flex-row items-center mb-6 border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <View className={`w-8 h-8 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-amber-500/20' : 'bg-amber-50'}`}>
                                        <Ionicons name="map-outline" size={isMobile ? 18 : 22} color={isDark ? "#f59e0b" : "#d97706"} />
                                    </View>
                                    <Text className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('admin.strategyManagement')}</Text>
                                </View>

                                <View className={`p-4 rounded-xl border mb-6 ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50/50 border-amber-100'}`}>
                                    <View className="flex-row items-center mb-2">
                                        <Ionicons name="information-circle" size={18} color={isDark ? "#f59e0b" : "#d97706"} className="mr-2" />
                                        <Text className={`font-bold ${isDark ? 'text-amber-500' : 'text-amber-600'}`} style={{ fontSize: (isMobile ? 10 : 12) * fontSizeScale }}>{t('common.info', '안내')}</Text>
                                    </View>
                                    <Text className={`leading-5 font-medium ${isDark ? 'text-slate-300' : 'text-slate-500'}`} style={{ fontSize: (isMobile ? 9 : 11) * fontSizeScale }}>
                                        {t('admin.strategyGuide')}
                                    </Text>
                                </View>

                                <View className={`p-4 rounded-2xl border shadow-inner ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                    <Text className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`} style={{ fontSize: (isMobile ? 9 : 10) * fontSizeScale }}>{t('admin.urlLabel')}</Text>
                                    <View className="space-y-4">
                                        <TextInput
                                            className={`${isMobile ? 'p-3.5 h-12' : 'p-4 h-14'} rounded-xl border font-semibold ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                                            placeholder="https://docs.google.com/..."
                                            placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                                            value={strategyUrl}
                                            onChangeText={setStrategyUrl}
                                            style={{ fontSize: (isMobile ? 12 : 14) * fontSizeScale }}
                                        />
                                        <TouchableOpacity
                                            onPress={handleSaveStrategyUrl}
                                            disabled={saveLoading}
                                            className={`${isMobile ? 'h-12' : 'h-14'} rounded-xl items-center justify-center shadow-lg shadow-amber-500/20 ${saveLoading ? 'bg-slate-700' : 'bg-amber-500 active:bg-amber-600'}`}
                                        >
                                            {saveLoading ? <ActivityIndicator color="white" /> : (
                                                <View className="flex-row items-center">
                                                    <Ionicons name="save-outline" size={isMobile ? 16 : 18} color="#0f172a" style={{ marginRight: 6 }} />
                                                    <Text className={`text-[#0f172a] font-bold`} style={{ fontSize: (isMobile ? 14 : 16) * fontSizeScale }}>{t('common.save', '저장하기')}</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>

                                        {sheetData?.url && Platform.OS === 'web' && (
                                            <View className="mt-4">
                                                <View className={`rounded-xl overflow-hidden border ${isDark ? 'border-slate-700' : 'border-slate-200'}`} style={{ height: isMobile ? 160 : 240 }}>
                                                    <iframe src={sheetData.url} style={{ width: '100%', height: '100%', border: 'none' }} title="Preview" />
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}

                    {activeTab === 'settings' && (
                        <View className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Notification Settings Section */}
                            <View className={`${isMobile ? 'p-4' : 'p-6'} rounded-3xl border shadow-xl mb-6 ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                                <View className={`flex-row items-center mb-6 border-b pb-4 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <View className={`w-8 h-8 rounded-xl items-center justify-center mr-3 ${isDark ? 'bg-rose-500/20' : 'bg-rose-50'}`}>
                                        <Ionicons name="notifications-outline" size={isMobile ? 18 : 22} color={isDark ? "#fb7185" : "#e11d48"} />
                                    </View>
                                    <Text className={`${isMobile ? 'text-lg' : 'text-xl'} font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('admin.alarmSettings', '알림 설정')}</Text>
                                </View>

                                <View className={`p-4 rounded-xl border mb-6 ${isDark ? 'bg-rose-500/10 border-rose-500/30' : 'bg-rose-50/50 border-rose-100'}`}>
                                    <View className="flex-row items-center mb-2">
                                        <Ionicons name="information-circle" size={18} color={isDark ? "#fb7185" : "#e11d48"} className="mr-2" />
                                        <Text className={`font-bold ${isDark ? 'text-rose-500' : 'text-rose-600'}`} style={{ fontSize: (isMobile ? 10 : 12) * fontSizeScale }}>{t('admin.webhookGuideTitle', '디스코드/텔레그램 연동')}</Text>
                                    </View>
                                    <Text className={`leading-5 font-medium ${isDark ? 'text-slate-300' : 'text-slate-500'}`} style={{ fontSize: (isMobile ? 9 : 11) * fontSizeScale }}>
                                        {t('admin.webhookGuideDesc', '연맹원 등록 알림을 받을 디스코드나 텔레그램의 웹훅 URL을 입력해주세요. 등록 시 즉시 알림이 전송됩니다.')}
                                    </Text>
                                </View>

                                <View className={`p-4 rounded-2xl border shadow-inner ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                    <Text className={`font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`} style={{ fontSize: (isMobile ? 9 : 10) * fontSizeScale }}>{t('admin.webhookUrlLabel', '웹훅 URL (Webhook URL)')}</Text>
                                    <View className="space-y-4">
                                        <TextInput
                                            className={`${isMobile ? 'p-3.5 h-12' : 'p-4 h-14'} rounded-xl border font-semibold ${isDark ? 'bg-slate-900 border-slate-600 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                                            placeholder="https://discord.com/api/webhooks/..."
                                            placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                                            value={notificationSettings?.webhookUrl || ''}
                                            onChangeText={(val) => saveAllianceWebhook(val)}
                                            style={{ fontSize: (isMobile ? 10 : 12) * fontSizeScale }}
                                        />
                                        <View className="mt-4 flex-row items-center gap-2">
                                            <Ionicons name="shield-checkmark" size={14} color="#10b981" />
                                            <Text className="text-[10px] text-emerald-500 font-bold">입력 시 자동 저장됩니다. (Auto-saved)</Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}

                    {activeTab === 'members' && (
                        <View className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                            {/* Member Management Section */}
                            <View className={`${isMobile ? 'p-3' : 'p-6'} rounded-3xl border shadow-xl ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
                                <View className={`flex-row items-center justify-between mb-4 border-b pb-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                                    <View className="flex-row items-center">
                                        <View className={`w-7 h-7 rounded-lg items-center justify-center mr-2 ${isDark ? 'bg-indigo-500/20' : 'bg-indigo-50'}`}>
                                            <Ionicons name="people" size={16} color={isDark ? "#818cf8" : "#4f46e5"} />
                                        </View>
                                        <Text className={`font-semibold ${isDark ? 'text-white' : 'text-slate-800'}`} style={{ fontSize: (isMobile ? 16 : 20) * fontSizeScale }}>{t('admin.memberManagementTab')}</Text>
                                    </View>
                                    <Text className={`font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} style={{ fontSize: (isMobile ? 10 : 14) * fontSizeScale }}>{t('admin.totalMembers', { count: members.length })}</Text>
                                </View>

                                <View className={`mb-4 ${isMobile ? 'p-3' : 'p-5'} rounded-2xl border ${isDark ? 'bg-slate-800/40 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                    <View className="flex-row items-center mb-3">
                                        <Ionicons name="documents" size={14} color={isDark ? "#818cf8" : "#4f46e5"} className="mr-2" />
                                        <Text className={`font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`} style={{ fontSize: (isMobile ? 12 : 14) * fontSizeScale }}>{t('admin.bulkRegister')}</Text>
                                    </View>

                                    <View
                                        // @ts-ignore
                                        onDragOver={(e: any) => { e.preventDefault(); setIsDragOver(true); }}
                                        onDragLeave={() => setIsDragOver(false)}
                                        onDrop={handleDrop}
                                        className={`items-center justify-center ${isMobile ? 'py-5' : 'py-8'} px-3 rounded-xl border-2 border-dashed mb-3 ${isDragOver ? (isDark ? 'bg-indigo-500/15 border-indigo-400' : 'bg-indigo-50 border-indigo-400') : (isDark ? 'bg-slate-900/50 border-slate-700' : 'bg-white border-slate-200')}`}
                                    >
                                        <Ionicons name={isDragOver ? "cloud-upload" : "document-text-outline"} size={20} color={isDark ? "#64748b" : "#94a3b8"} className="mb-1" />
                                        <Text className={`text-center font-bold ${isDark ? 'text-slate-500' : 'text-slate-400'}`} style={{ fontSize: (isMobile ? 8 : 10) * fontSizeScale }}>{t('admin.dragAndDropExcel')}</Text>
                                    </View>

                                    <View className="flex-row gap-2">
                                        <TouchableOpacity onPress={handleExcelUpload} disabled={uploading} className={`flex-1 py-2.5 rounded-lg border items-center flex-row justify-center ${isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'}`}>
                                            <Text className={`font-bold ${isDark ? 'text-white' : 'text-slate-600'}`} style={{ fontSize: (isMobile ? 10 : 12) * fontSizeScale }}>{t('admin.selectFile')}</Text>
                                        </TouchableOpacity>
                                        {previewData.length > 0 ? (
                                            <TouchableOpacity onPress={handleSaveMembers} className="flex-1 bg-indigo-600 py-2.5 rounded-lg items-center flex-row justify-center">
                                                <Text className={`text-white font-bold`} style={{ fontSize: (isMobile ? 10 : 12) * fontSizeScale }}>{t('common.save', '저장')} ({previewData.length})</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity onPress={downloadTemplate} className={`flex-1 py-2.5 rounded-lg border items-center flex-row justify-center ${isDark ? 'bg-slate-800 border-indigo-500/30' : 'bg-white border-indigo-100'}`}>
                                                <Text className={`font-bold ${isDark ? 'text-indigo-400' : 'text-indigo-600'}`} style={{ fontSize: (isMobile ? 10 : 12) * fontSizeScale }}>{t('admin.downloadTemplate')}</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </View>

                                <View className={`mb-4 ${isMobile ? 'p-3' : 'p-5'} rounded-2xl border ${isDark ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                                    <View className="flex-row items-center mb-3">
                                        <Ionicons name="person-add" size={14} color={isDark ? "#818cf8" : "#4f46e5"} className="mr-2" />
                                        <Text className={`font-bold ${isDark ? 'text-indigo-300' : 'text-indigo-700'}`} style={{ fontSize: (isMobile ? 12 : 14) * fontSizeScale }}>{t('admin.individualRegister')}</Text>
                                    </View>
                                    <View className="space-y-4">
                                        <View className="flex-row gap-2 w-full">
                                            <TextInput
                                                style={{ flex: isMobile ? 1 : 1.5, minWidth: 0, fontSize: (isMobile ? 11 : 12) * fontSizeScale }}
                                                className={`${isMobile ? 'h-11' : 'h-12'} px-3 rounded-xl border font-bold ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                                                placeholder={`${t('admin.nicknameLabel')} *`}
                                                value={manualNick}
                                                onChangeText={setManualNick}
                                            />
                                            <TextInput
                                                style={{ flex: 1, minWidth: 0, fontSize: (isMobile ? 11 : 12) * fontSizeScale }}
                                                className={`${isMobile ? 'h-11' : 'h-12'} px-3 rounded-xl border font-bold ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                                                placeholder={t('admin.idLabel')}
                                                value={manualId}
                                                onChangeText={setManualId}
                                                keyboardType="numeric"
                                            />
                                        </View>
                                        <View className="flex-row gap-2">
                                            <TextInput
                                                style={{ fontSize: (isMobile ? 11 : 12) * fontSizeScale }}
                                                className={`flex-1 ${isMobile ? 'h-11' : 'h-12'} px-3 rounded-xl border font-bold ${isDark ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200'}`}
                                                placeholder={t('admin.passwordLabel')}
                                                value={manualPw}
                                                onChangeText={setManualPw}
                                                secureTextEntry
                                            />
                                            <TouchableOpacity onPress={handleManualAdd} className={`bg-indigo-600 ${isMobile ? 'w-16 h-11' : 'px-8 h-12'} rounded-xl items-center justify-center`}>
                                                <Text className={`text-white font-black`} style={{ fontSize: (isMobile ? 10 : 14) * fontSizeScale }}>{t('admin.register')}</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>

                                {/* Filter & Search (Redesigned) */}
                                <View className="mb-4">
                                    <View className={`flex-row items-center justify-between gap-3 ${isMobile ? 'flex-col items-stretch' : ''}`}>
                                        {/* Search Input */}
                                        <View className={`flex-1 flex-row items-center rounded-xl ${isMobile ? 'px-3 py-2.5 h-10' : 'px-4 py-2 h-10'} border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
                                            <Ionicons name="search" size={isMobile ? 14 : 16} color={isDark ? "#94a3b8" : "#64748b"} className="mr-2" />
                                            <TextInput
                                                placeholder={t('dashboard.search', '검색...')}
                                                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                                                value={searchTerm}
                                                onChangeText={setSearchTerm}
                                                style={{ fontSize: (isMobile ? 11 : 12) * fontSizeScale }}
                                                className={`flex-1 font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}
                                            />
                                            {searchTerm.length > 0 && (
                                                <TouchableOpacity onPress={() => setSearchTerm('')}>
                                                    <Ionicons name="close-circle" size={16} color={isDark ? "#64748b" : "#94a3b8"} />
                                                </TouchableOpacity>
                                            )}
                                        </View>

                                        {/* Filter Tabs (Redesigned as Segmented Tabs) */}
                                        <View className={`flex-row p-1.5 rounded-2xl border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                                            {[
                                                { id: 'all', label: t('admin.all'), icon: 'apps' },
                                                { id: 'staff', label: t('admin.staff'), icon: 'shield-checkmark' },
                                                { id: 'general', label: t('admin.general'), icon: 'people' }
                                            ].map((filter) => (
                                                <TouchableOpacity
                                                    key={filter.id}
                                                    onPress={() => setRoleFilter(filter.id as any)}
                                                    activeOpacity={0.7}
                                                    className={`flex-1 flex-row items-center justify-center py-2.5 rounded-[14px] transition-all duration-300 ${roleFilter === filter.id ?
                                                        (isDark ? 'bg-indigo-600 shadow-lg shadow-indigo-500/20' : 'bg-white shadow-sm') : ''}`}
                                                >
                                                    <Ionicons
                                                        name={filter.icon as any}
                                                        size={isMobile ? 12 : 14}
                                                        color={roleFilter === filter.id ? (isDark ? 'white' : '#4f46e5') : (isDark ? '#475569' : '#94a3b8')}
                                                        style={{ marginRight: 6 }}
                                                    />
                                                    <Text className={`font-black ${roleFilter === filter.id ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`} style={{ fontSize: (isMobile ? 10 : 12) * fontSizeScale }}>
                                                        {filter.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </View>
                                </View>

                                <View className={`rounded-2xl border overflow-hidden ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white border-slate-100 shadow-sm'}`}>
                                    {/* List Header */}
                                    <View className={`flex-row items-center ${isMobile ? 'px-3 py-2.5' : 'px-4 py-3'} border-b ${isDark ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-100'}`}>
                                        <TouchableOpacity onPress={toggleSelectAll} className={`w-4.5 h-4.5 rounded-md items-center justify-center border-2 mr-2 ${selectedIds.length === filteredMembers.length && filteredMembers.length > 0 ? 'bg-indigo-500 border-indigo-500' : (isDark ? 'bg-slate-900 border-slate-600' : 'bg-white border-slate-300')}`}>
                                            {selectedIds.length === filteredMembers.length && filteredMembers.length > 0 && <Ionicons name="checkmark" size={10} color="white" />}
                                        </TouchableOpacity>
                                        <Text className={`flex-1 font-black ${isDark ? 'text-slate-500' : 'text-slate-400'}`} style={{ fontSize: (isMobile ? 9 : 10) * fontSizeScale }}>{t('admin.memberList')}</Text>
                                        <Text className={`font-black mr-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} style={{ fontSize: (isMobile ? 9 : 10) * fontSizeScale }}>{t('admin.role_staff_label', '관리')}</Text>
                                    </View>

                                    {membersLoading ? (
                                        <View className="py-10 items-center"><ActivityIndicator color="#818cf8" /></View>
                                    ) : (
                                        <ScrollView className={`${isMobile ? 'max-h-[350px]' : 'max-h-[500px]'}`} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                                            {filteredMembers.map((m) => {
                                                const isRowStaff = dynamicAdmins.some(a => a.name === m.nickname);
                                                const isSelected = selectedIds.includes(m.id);
                                                return (
                                                    <TouchableOpacity key={m.id} onPress={() => toggleSelectMember(m.id)} className={`flex-row items-center ${isMobile ? 'px-3 py-3' : 'px-4 py-4'} border-b ${isSelected ? (isDark ? 'bg-indigo-500/10' : 'bg-indigo-50/50') : ''} ${isDark ? 'border-slate-800' : 'border-slate-50'}`}>
                                                        <View className="flex-row items-center flex-1">
                                                            <View className={`w-4 h-4 rounded items-center justify-center border mr-2 ${isSelected ? 'bg-indigo-500 border-indigo-500' : (isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}`}>
                                                                {isSelected && <Ionicons name="checkmark" size={10} color="white" />}
                                                            </View>
                                                            <View className={`${isMobile ? 'w-8 h-8' : 'w-10 h-10'} rounded-lg items-center justify-center mr-2.5 ${isRowStaff ? (isDark ? 'bg-indigo-500/20' : 'bg-indigo-50') : (isDark ? 'bg-slate-800' : 'bg-slate-100')}`}>
                                                                <Text className={`font-black ${isRowStaff ? (isDark ? 'text-indigo-400' : 'text-indigo-600') : (isDark ? 'text-slate-400' : 'text-slate-500')}`} style={{ fontSize: (isMobile ? 11 : 14) * fontSizeScale }}>{m.nickname.charAt(0)}</Text>
                                                            </View>
                                                            <View className="flex-1 mr-2">
                                                                <View className="flex-row items-center flex-wrap">
                                                                    <Text numberOfLines={1} className={`font-black ${isDark ? 'text-white' : 'text-slate-800'}`} style={{ fontSize: (isMobile ? 12 : 14) * fontSizeScale }}>{m.nickname}</Text>
                                                                    {isRowStaff && <View className="ml-1 px-1 py-0.5 rounded-full bg-indigo-500/10"><Text className="font-black text-indigo-500" style={{ fontSize: 7 * fontSizeScale }}>{t('admin.staff')}</Text></View>}
                                                                </View>
                                                                <Text numberOfLines={1} className={`text-[9px] mt-0.5 font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>UID: {m.id}</Text>
                                                            </View>
                                                        </View>
                                                        <View className="flex-row gap-1.5">
                                                            <TouchableOpacity
                                                                onPress={(e) => { e.stopPropagation(); handleShareInvite(m); }}
                                                                className={`${isMobile ? 'w-8 h-8' : 'w-9 h-9'} rounded-lg items-center justify-center border ${isDark ? 'bg-sky-500/10 border-sky-500/20' : 'bg-sky-50 border-sky-100'}`}
                                                            >
                                                                {sharingId === m.id ? (
                                                                    <ActivityIndicator size="small" color="#0ea5e9" />
                                                                ) : (
                                                                    <Ionicons name="share-social-outline" size={isMobile ? 14 : 16} color="#0ea5e9" />
                                                                )}
                                                            </TouchableOpacity>
                                                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); toggleStaff(m); }} className={`${isMobile ? 'w-8 h-8' : 'w-9 h-9'} rounded-lg items-center justify-center border ${isRowStaff ? 'bg-indigo-600 border-indigo-500' : (isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')}`}>
                                                                <Ionicons name={isRowStaff ? "shield-checkmark" : "shield-outline"} size={isMobile ? 14 : 16} color={isRowStaff ? "white" : (isDark ? "#64748b" : "#94a3b8")} />
                                                            </TouchableOpacity>
                                                            <TouchableOpacity onPress={(e) => { e.stopPropagation(); showCustomAlert(t('common.delete'), `${m.nickname}님을 삭제하시겠습니까?`, 'confirm', () => deleteMember(m.id)); }} className={`${isMobile ? 'w-8 h-8' : 'w-9 h-9'} rounded-lg items-center justify-center border ${isDark ? 'bg-rose-500/10 border-rose-500/20' : 'bg-rose-50 border-rose-100'}`}>
                                                                <Ionicons name="trash-outline" size={isMobile ? 14 : 16} color="#f43f5e" />
                                                            </TouchableOpacity>
                                                        </View>
                                                    </TouchableOpacity>
                                                );
                                            })}
                                        </ScrollView>
                                    )}
                                </View>
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* Sticky Bottom Action Bar for Bulk Selection */}
                {
                    selectedIds.length > 0 && (
                        <View className={`absolute ${isMobile ? 'bottom-4' : 'bottom-8'} left-4 right-4 animate-in slide-in-from-bottom-5 flex-row gap-2 ${isMobile ? 'p-2' : 'p-3'} rounded-2xl bg-slate-900 shadow-2xl items-center z-50`}>
                            <View className="flex-1 px-2.5">
                                <Text className="text-white font-black text-xs">{selectedIds.length}명</Text>
                                <TouchableOpacity onPress={() => setSelectedIds([])}><Text className="text-indigo-400 font-bold text-[9px]">취소</Text></TouchableOpacity>
                            </View>
                            <TouchableOpacity onPress={handleSelectedReset} className="bg-slate-800 px-4 py-2.5 rounded-xl flex-row items-center border border-slate-700 active:scale-95">
                                <Ionicons name="key" size={14} color="#fbbf24" style={{ marginRight: 4 }} />
                                <Text className="text-white font-black text-[10px]">초기화</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSelectedDelete} className="bg-rose-600 px-4 py-2.5 rounded-xl flex-row items-center shadow-lg active:scale-95">
                                <Ionicons name="trash" size={14} color="white" style={{ marginRight: 4 }} />
                                <Text className="text-white font-black text-[10px]">삭제</Text>
                            </TouchableOpacity>
                        </View>
                    )
                }
            </View >

        </View >
    );
}
