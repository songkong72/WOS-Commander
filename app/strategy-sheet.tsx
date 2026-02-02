import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal, TextInput, Alert, Pressable, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import { useAuth } from './_layout';
import { useFirestoreStrategySheet } from '../hooks/useFirestoreStrategySheet';

const DEFAULT_SHEET_ID = '1p-Q6jvTITyFmQjMGlTR4PSw9aFZW3jih-9NNNI0QIiI';
const DEFAULT_SHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/htmlview?embedded=true`;

export default function StrategySheet() {
    const router = useRouter();
    const { auth } = useAuth();
    const { sheetData, saveSheetUrl } = useFirestoreStrategySheet();

    const [zoom, setZoom] = useState(1.0);
    const webViewRef = useRef<any>(null);

    // Edit Modal Logic
    const [modalVisible, setModalVisible] = useState(false);
    const [inputUrl, setInputUrl] = useState('');
    const [showTooltip, setShowTooltip] = useState(false);
    const [accessError, setAccessError] = useState(false);
    const [viewMode, setViewMode] = useState<'sheet' | 'guide'>('sheet');

    // Determine the URL to display
    let targetUrl = DEFAULT_SHEET_URL;
    const isFile = sheetData?.type === 'file';

    if (sheetData && sheetData.url) {
        if (isFile) {
            targetUrl = sheetData.url;
        } else {
            // Check if it's a google sheet URL and clean it if necessary
            const match = sheetData.url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (match && match[1]) {
                targetUrl = `https://docs.google.com/spreadsheets/d/${match[1]}/htmlview?embedded=true`;
            } else {
                targetUrl = sheetData.url;
            }
        }
    }

    const handleZoom = (delta: number) => {
        const newZoom = Math.max(0.5, Math.min(3.0, zoom + delta));
        setZoom(Number(newZoom.toFixed(1)));

        if (Platform.OS !== 'web' && webViewRef.current) {
            // Inject JS for native zoom
            const jsCode = `document.body.style.zoom = '${newZoom}'; true;`;
            webViewRef.current.injectJavaScript(jsCode);
        }
    };

    const handleResetZoom = () => {
        setZoom(1.0);
        if (Platform.OS !== 'web' && webViewRef.current) {
            webViewRef.current.injectJavaScript(`document.body.style.zoom = '1.0'; true;`);
        }
    };

    const onOpenAdmin = () => {
        // Since we have a dedicated Admin Dashboard section, let's navigate there
        router.push('/admin');
    };

    const handleSaveUrl = async () => {
        if (!inputUrl.trim()) return;

        try {
            // If it's a google sheet, we clean it. Otherwise we save as is.
            const match = inputUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
            if (match && match[1]) {
                const id = match[1];
                const cleanUrl = `https://docs.google.com/spreadsheets/d/${id}/htmlview?embedded=true`;
                await saveSheetUrl(cleanUrl, 'url');
            } else {
                await saveSheetUrl(inputUrl, 'url');
            }
            setModalVisible(false);
            Alert.alert('성공', '전략 문서 주소가 업데이트되었습니다.');
        } catch (e: any) {
            Alert.alert('오류', '저장 중 문제가 발생했습니다: ' + e.message);
        }
    };

    const isAdmin = auth.isLoggedIn;

    return (
        <View className="flex-1 bg-[#020617]">
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="pt-16 pb-6 px-6 bg-[#0f172a] border-b border-slate-800 z-50 shadow-lg flex-row justify-between items-center">
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className="mr-4 p-3 bg-slate-800 rounded-full active:bg-slate-700">
                        <Ionicons name="arrow-back" size={28} color="white" />
                    </TouchableOpacity>
                    <View>
                        <Text className="text-white text-3xl font-black tracking-tight">전략 문서</Text>
                        <Text className="text-slate-400 text-sm font-bold mt-1">
                            {isFile ? (sheetData?.fileName || '업로드된 파일') : '실시간 연맹 공지 및 배치도'}
                        </Text>
                    </View>
                </View>

                {isAdmin && (
                    <View className="relative z-50">
                        <Pressable
                            onPress={onOpenAdmin}
                            onHoverIn={() => setShowTooltip(true)}
                            onHoverOut={() => setShowTooltip(false)}
                            className="p-3 bg-amber-500/10 rounded-full border border-amber-500/30 active:bg-amber-500/20"
                        >
                            <Ionicons name="create-outline" size={24} color="#f59e0b" />
                        </Pressable>
                        {showTooltip && (
                            <View className="absolute top-14 right-0 bg-slate-800 px-3 py-2 rounded-lg border border-slate-600 shadow-xl w-48 z-50">
                                <Text className="text-white text-xs font-bold text-center">전략 문서 관리 (관리자 전용)</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* View Mode Toggle Tabs */}
            <View className="bg-[#0f172a] flex-row h-12 border-b border-black">
                <TouchableOpacity
                    onPress={() => setViewMode('sheet')}
                    className={`flex-1 items-center justify-center border-b-2 ${viewMode === 'sheet' ? 'border-[#38bdf8] bg-[#38bdf8]/5' : 'border-transparent'}`}
                >
                    <View className="flex-row items-center">
                        <Ionicons name="document-text" size={16} color={viewMode === 'sheet' ? "#38bdf8" : "#64748b"} className="mr-2" />
                        <Text className={`font-black text-sm ${viewMode === 'sheet' ? 'text-white' : 'text-slate-500'}`}>
                            {isFile ? '문서 보기' : '전략 문서'}
                        </Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setViewMode('guide')}
                    className={`flex-1 items-center justify-center border-b-2 ${viewMode === 'guide' ? 'border-amber-500 bg-amber-500/5' : 'border-transparent'}`}
                >
                    <View className="flex-row items-center">
                        <Ionicons name="help-circle" size={16} color={viewMode === 'guide' ? "#f59e0b" : "#64748b"} className="mr-2" />
                        <Text className={`font-black text-sm ${viewMode === 'guide' ? 'text-white' : 'text-slate-500'}`}>권한 가이드</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Content Container */}
            <View className="flex-1 bg-white relative">
                {(accessError || viewMode === 'guide') ? (
                    <View className="flex-1 bg-[#020617] items-center justify-center p-8">
                        <View className="max-w-md w-full">
                            <View className="w-24 h-24 bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-[32px] items-center justify-center mb-8 mx-auto border border-amber-500/30 rotate-3">
                                <Ionicons name="lock-closed" size={48} color="#f59e0b" />
                            </View>
                            <Text className="text-white text-4xl font-black text-center mb-4 tracking-tighter">접근 제한됨</Text>
                            <Text className="text-slate-400 text-center text-lg leading-relaxed mb-12 font-medium">
                                {isFile ? (
                                    "파일을 불러오는 중 문제가 발생했습니다. 관리자에게 문의하세요."
                                ) : (
                                    <>
                                        해당 문서는 외부 보호 영역에 있습니다.{"\n"}권한이 있는 <Text className="text-amber-500 font-bold">구글 계정</Text>으로 로그인이 필요합니다.
                                    </>
                                )}
                            </Text>

                            <View className="space-y-4 mb-12">
                                <View className="flex-row items-center bg-slate-900/80 p-5 rounded-3xl border border-slate-800 shadow-sm">
                                    <View className="w-10 h-10 bg-slate-800 rounded-2xl items-center justify-center mr-5">
                                        <Ionicons name="person-add" size={20} color="#94a3b8" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white font-black text-sm mb-1">권한 요청</Text>
                                        <Text className="text-slate-500 text-xs font-bold leading-5">관리자에게 본인의 이메일을 알려주고 '뷰어' 권한을 요청하세요.</Text>
                                    </View>
                                </View>
                                <View className="flex-row items-center bg-slate-900/80 p-5 rounded-3xl border border-slate-800 shadow-sm">
                                    <View className="w-10 h-10 bg-slate-800 rounded-2xl items-center justify-center mr-5">
                                        <Ionicons name="log-in" size={20} color="#94a3b8" />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-white font-black text-sm mb-1">계정 전환</Text>
                                        <Text className="text-slate-500 text-xs font-bold leading-5">현재 브라우저가 다른 계정으로 로그인되어 있는지 확인해보세요.</Text>
                                    </View>
                                </View>
                            </View>

                            <View className="flex-row gap-4">
                                <TouchableOpacity
                                    onPress={() => Platform.OS === 'web' ? window.open(targetUrl, '_blank') : null}
                                    className="flex-1 bg-slate-800 py-5 rounded-[24px] border border-slate-700 active:scale-95 transition-all"
                                >
                                    <Text className="text-white text-center font-black text-lg">새 창에서 열기</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => { setAccessError(false); setViewMode('sheet'); }}
                                    className="flex-1 bg-[#38bdf8] py-5 rounded-[24px] shadow-xl shadow-blue-500/30 active:scale-95 transition-all"
                                >
                                    <Text className="text-[#0f172a] text-center font-black text-lg">재시도</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ) : (
                    Platform.OS === 'web' ? (
                        <iframe
                            src={targetUrl}
                            style={{
                                width: `${100 / zoom}%`,
                                height: `${100 / zoom}%`,
                                border: 'none',
                                transform: `scale(${zoom})`,
                                transformOrigin: 'top left',
                                transition: 'transform 0.2s ease-out, width 0.2s ease-out, height 0.2s ease-out'
                            }}
                        />
                    ) : (
                        <WebView
                            ref={webViewRef}
                            source={{ uri: targetUrl }}
                            style={{ flex: 1 }}
                            javaScriptEnabled={true}
                            scalesPageToFit={true}
                            domStorageEnabled={true}
                            startInLoadingState={true}
                            onMessage={(event: any) => {
                                const title = event.nativeEvent.data;
                                // Only trigger access error for google sheet related messages
                                if (!isFile && (title.includes('권한') || title.includes('Access') || title.includes('Denied') || title.includes('Login'))) {
                                    setAccessError(true);
                                }
                            }}
                            renderLoading={() => (
                                <View className="absolute inset-0 items-center justify-center bg-[#0f172a]">
                                    <Text className="text-[#38bdf8] font-bold text-lg">문서를 불러오는 중...</Text>
                                </View>
                            )}
                            injectedJavaScript={`
                                (function() {
                                    window.ReactNativeWebView.postMessage(document.title);
                                })();
                                document.body.style.zoom = '${zoom}'; 
                                true;
                            `}
                        />
                    )
                )}

                {/* Floating Zoom Controls */}
                <View className="absolute bottom-12 left-0 right-0 items-center justify-center pointer-events-none z-10">
                    <View className="flex-row bg-[#0f172a]/90 backdrop-blur-md p-2 rounded-full border border-slate-700 shadow-2xl pointer-events-auto items-center">
                        <TouchableOpacity
                            onPress={() => handleZoom(-0.1)}
                            className="w-12 h-12 items-center justify-center bg-slate-800 rounded-full mr-2 active:bg-slate-700 border border-slate-600"
                        >
                            <Ionicons name="remove" size={24} color="white" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleResetZoom}
                            className="h-12 px-6 items-center justify-center bg-slate-800 rounded-full mr-2 active:bg-slate-700 border border-slate-600 min-w-[80px]"
                        >
                            <Text className="text-white font-black text-lg">{Math.round(zoom * 100)}%</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => handleZoom(0.1)}
                            className="w-12 h-12 items-center justify-center bg-[#38bdf8] rounded-full active:bg-[#0ea5e9] shadow-lg shadow-blue-500/30"
                        >
                            <Ionicons name="add" size={24} color="#0f172a" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Admin Config Modal - Kept for legacy but ideally redirected to Admin Page */}
            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <BlurView intensity={20} className="absolute inset-0" />
                    <View className="bg-slate-900 w-full max-w-lg p-8 rounded-[32px] border border-slate-700 shadow-2xl">
                        <Text className="text-white text-2xl font-black mb-2">전략 문서 설정</Text>
                        <Text className="text-slate-400 text-sm mb-6 font-bold">연동할 구글 스프레드시트 주소를 입력하세요.</Text>

                        <View className="bg-slate-800 p-4 rounded-2xl mb-6 border border-slate-600">
                            <TextInput
                                value={inputUrl}
                                onChangeText={setInputUrl}
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                placeholderTextColor="#475569"
                                className="text-white text-lg font-medium h-12"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View className="flex-row gap-3">
                            <TouchableOpacity onPress={() => setModalVisible(false)} className="flex-1 bg-slate-800 py-4 rounded-2xl border border-slate-700">
                                <Text className="text-slate-400 text-center font-bold text-lg">취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSaveUrl} className="flex-1 bg-[#38bdf8] py-4 rounded-2xl shadow-lg shadow-blue-500/20">
                                <Text className="text-[#0f172a] text-center font-black text-lg">저장하기</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

        </View>
    );
}

