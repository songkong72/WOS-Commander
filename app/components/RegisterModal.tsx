import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAdminAuth } from '../hooks/useAdminAuth';

interface RegisterModalProps {
    visible: boolean;
    onClose: () => void;
    isDark: boolean;
    initialServerId?: string | null;
    initialAllianceId?: string | null;
}

export default function RegisterModal({ visible, onClose, isDark, initialServerId, initialAllianceId }: RegisterModalProps) {
    const { register } = useAdminAuth();

    // Form States
    const [step, setStep] = useState<1 | 2 | 3>(1); // 1: 기본정보, 2: 서버/연맹 정보, 3: 완료
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [nickname, setNickname] = useState('');

    // 초기값 자동 세팅 (# 제거 후 넣기)
    const [serverInput, setServerInput] = useState(initialServerId?.replace('#', '') || '');
    const [allianceInput, setAllianceInput] = useState(initialAllianceId || '');
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleNext = () => {
        if (!username || !password || !nickname) {
            setErrorMessage('모든 정보를 입력해주세요.');
            return;
        }
        setErrorMessage(null);
        setStep(2);
    };

    const handleSubmit = async () => {
        setErrorMessage(null); // 에러 초기화
        if (!serverInput || !allianceInput) {
            setErrorMessage('서버와 연맹 정보를 입력해주세요.');
            return;
        }

        setLoading(true);
        // 서버 번호 포맷팅 (# 붙이기)
        const formattedServer = serverInput.startsWith('#') ? serverInput : `#${serverInput}`;

        const result = await register({
            username,
            nickname,
            role: 'user', // 기본 유저는 'user'
            serverId: formattedServer,
            allianceId: allianceInput
        }, password);

        setLoading(false);

        if (result.success) {
            setStep(3); // 성공 시 완료 화면으로 이동
        } else {
            // Alert 대신 화면에 에러 표시
            setErrorMessage(result.message || '오류가 발생했습니다.');
        }
    };

    const handleClose = () => {
        setStep(1);
        setUsername(''); setPassword(''); setNickname('');
        setServerInput(''); setAllianceInput('');
        setErrorMessage(null);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View className="flex-1 bg-black/60 items-center justify-center p-6">
                <View className={`w-full max-w-sm rounded-[32px] overflow-hidden ${isDark ? 'bg-slate-900 border border-slate-700' : 'bg-white border border-slate-200'}`}>

                    {/* Header */}
                    <View className={`px-6 py-5 border-b ${isDark ? 'border-slate-800' : 'border-slate-100'} flex-row justify-between items-center`}>
                        <View>
                            <Text className={`text-xl font-black ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                {step === 1 ? '계정 생성' : step === 2 ? '관리 권한 신청 정보' : '신청 완료'}
                            </Text>
                            <Text className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                {step === 1 ? '로그인에 사용할 정보를 입력하세요' : step === 2 ? '관리자로 활동할 연맹 정보를 확인하세요' : '가입 신청이 정상적으로 접수되었습니다'}
                            </Text>
                        </View>
                        {step !== 3 && (
                            <TouchableOpacity onPress={handleClose} className={`p-2 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-100'}`}>
                                <Ionicons name="close" size={20} color={isDark ? '#94a3b8' : '#64748b'} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <ScrollView className="p-6">
                        {step === 1 ? (
                            <View className="gap-4">
                                <View>
                                    <Text className={`text-xs font-bold mb-1.5 ml-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>아이디</Text>
                                    <TextInput
                                        className={`px-4 py-3.5 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                                        placeholder="사용할 아이디"
                                        placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                                        autoCapitalize="none"
                                        value={username}
                                        onChangeText={(t) => { setUsername(t); setErrorMessage(null); }}
                                    />
                                </View>
                                <View>
                                    <Text className={`text-xs font-bold mb-1.5 ml-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>비밀번호</Text>
                                    <TextInput
                                        className={`px-4 py-3.5 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                                        placeholder="비밀번호 (4자리 이상)"
                                        placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                                        secureTextEntry
                                        value={password}
                                        onChangeText={(t) => { setPassword(t); setErrorMessage(null); }}
                                    />
                                </View>
                                <View>
                                    <Text className={`text-xs font-bold mb-1.5 ml-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>닉네임</Text>
                                    <TextInput
                                        className={`px-4 py-3.5 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                                        placeholder="게임 내 닉네임 (정확히 입력)"
                                        placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                                        value={nickname}
                                        onChangeText={(t) => { setNickname(t); setErrorMessage(null); }}
                                    />
                                </View>
                            </View>
                        ) : step === 2 ? (
                            <View className="gap-4">
                                <View>
                                    <Text className={`text-xs font-bold mb-1.5 ml-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>서버 번호</Text>
                                    <TextInput
                                        className={`px-4 py-3.5 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} ${initialServerId ? 'opacity-50' : ''}`}
                                        placeholder="예: 864"
                                        placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                                        keyboardType="numeric"
                                        value={serverInput}
                                        onChangeText={(t) => { setServerInput(t); setErrorMessage(null); }}
                                        editable={!initialServerId}
                                    />
                                </View>
                                <View>
                                    <Text className={`text-xs font-bold mb-1.5 ml-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>연맹 ID (약칭)</Text>
                                    <TextInput
                                        className={`px-4 py-3.5 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-800'} ${initialAllianceId ? 'opacity-50' : ''}`}
                                        placeholder="예: KOR"
                                        placeholderTextColor={isDark ? '#475569' : '#94a3b8'}
                                        autoCapitalize="characters"
                                        value={allianceInput}
                                        onChangeText={(t) => { setAllianceInput(t); setErrorMessage(null); }}
                                        editable={!initialAllianceId}
                                    />
                                </View>
                                <View className={`p-4 rounded-xl mt-2 ${isDark ? 'bg-indigo-500/10' : 'bg-indigo-50'}`}>
                                    <View className="flex-row items-start">
                                        <Ionicons name="information-circle" size={16} color={isDark ? '#818cf8' : '#4f46e5'} style={{ marginTop: 2, marginRight: 6 }} />
                                        <Text className={`flex-1 text-xs leading-5 ${isDark ? 'text-indigo-200' : 'text-indigo-800'}`}>
                                            가입 신청 후 해당 연맹의 운영진(관리자)이 승인해야 로그인이 가능합니다.
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <View className="py-8 items-center">
                                <View className={`w-20 h-20 rounded-full items-center justify-center mb-6 ${isDark ? 'bg-green-500/10' : 'bg-green-50'}`}>
                                    <Ionicons name="checkmark" size={40} color="#22c55e" />
                                </View>
                                <Text className={`text-xl font-bold mb-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>신청이 완료되었습니다!</Text>
                                <Text className={`text-center leading-6 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                    운영진이 신청 내용을 확인한 뒤{'\n'}승인 처리를 진행할 예정입니다.
                                </Text>
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer Actions */}
                    <View className={`p-6 pt-2`}>
                        {errorMessage && (
                            <View className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex-row items-center justify-center">
                                <Ionicons name="alert-circle" size={16} color="#ef4444" style={{ marginRight: 6 }} />
                                <Text className="text-red-500 text-xs font-bold">{errorMessage}</Text>
                            </View>
                        )}

                        {step === 1 ? (
                            <TouchableOpacity
                                onPress={handleNext}
                                className={`w-full py-4 rounded-2xl items-center shadow-lg shadow-blue-500/30 bg-[#007BFF]`}
                            >
                                <Text className="text-white font-bold text-lg">다음 단계</Text>
                            </TouchableOpacity>
                        ) : step === 2 ? (
                            <View className="flex-row gap-3">
                                <TouchableOpacity
                                    onPress={() => setStep(1)}
                                    className={`flex-1 py-4 rounded-2xl items-center border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                                >
                                    <Text className={`font-bold text-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>이전</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={handleSubmit}
                                    disabled={loading}
                                    className={`flex-[2] py-4 rounded-2xl items-center shadow-lg shadow-blue-500/30 bg-[#007BFF] ${loading ? 'opacity-50' : ''}`}
                                >
                                    <Text className="text-white font-bold text-lg">{loading ? '가입 신청 중...' : '가입 신청 완료'}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                onPress={handleClose}
                                className={`w-full py-4 rounded-2xl items-center shadow-lg shadow-green-500/30 bg-green-500`}
                            >
                                <Text className="text-white font-bold text-lg">확인 완료</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                </View>
            </View>
        </Modal>
    );
}
