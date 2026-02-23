import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal, TextInput, Alert, Pressable, Image } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
// @ts-ignore
import { WebView } from 'react-native-webview';
import { BlurView } from 'expo-blur';
import { useAuth, useTheme } from './context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFirestoreStrategySheet } from '../hooks/useFirestoreStrategySheet';
import { useTranslation } from 'react-i18next';

const DEFAULT_SHEET_ID = '1p-Q6jvTITyFmQjMGlTR4PSw9aFZW3jih-9NNNI0QIiI';
const DEFAULT_SHEET_URL = `https://docs.google.com/spreadsheets/d/${DEFAULT_SHEET_ID}/htmlview?embedded=true`;

export default function StrategySheet() {
    const router = useRouter();
    const { auth } = useAuth();
    const { theme, toggleTheme, fontSizeScale } = useTheme();
    const isDark = theme === 'dark';
    const { t } = useTranslation();
    const [zoom, setZoom] = useState(1.0);
    const webViewRef = useRef<any>(null);

    const [serverId, setServerId] = useState<string | null>(undefined as any);
    const [allianceId, setAllianceId] = useState<string | null>(undefined as any);

    useEffect(() => {
        const loadIds = async () => {
            const s = await AsyncStorage.getItem('serverId');
            const a = await AsyncStorage.getItem('allianceId');
            setServerId(s);
            setAllianceId(a);
        };
        loadIds();
    }, []);

    const { sheetData, saveSheetUrl } = useFirestoreStrategySheet(serverId, allianceId);

    // Edit Modal Logic
    const [modalVisible, setModalVisible] = useState(false);
    const [inputUrl, setInputUrl] = useState('');
    const [showTooltip, setShowTooltip] = useState(false);
    const [accessError, setAccessError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    const handleRetry = useCallback(() => {
        setLoadError(false);
        setIsLoading(true);
        setAccessError(false);
    }, []);

    // Skeleton Loader Component
    const SkeletonLoader = () => (
        <View className={`absolute inset-0 p-6 ${isDark ? 'bg-[#020617]' : 'bg-slate-50'}`}>
            {/* Header skeleton */}
            <View className="mb-6">
                <View className={`h-8 w-48 rounded-xl mb-3 animate-pulse ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <View className={`h-4 w-72 rounded-lg animate-pulse ${isDark ? 'bg-slate-800/60' : 'bg-slate-200/80'}`} />
            </View>
            {/* Table skeleton rows */}
            <View className={`rounded-2xl border overflow-hidden ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                {/* Table header */}
                <View className={`flex-row p-4 ${isDark ? 'bg-slate-800/50' : 'bg-slate-100'}`}>
                    {[80, 120, 100, 90, 110].map((w, i) => (
                        <View key={i} className={`h-4 rounded-md mr-4 animate-pulse ${isDark ? 'bg-slate-700' : 'bg-slate-300'}`} style={{ width: w }} />
                    ))}
                </View>
                {/* Table rows */}
                {Array.from({ length: 10 }).map((_, rowIdx) => (
                    <View key={rowIdx} className={`flex-row p-4 border-t ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                        {[80, 120, 100, 90, 110].map((w, i) => (
                            <View key={i} className={`h-3.5 rounded-md mr-4 animate-pulse ${isDark ? 'bg-slate-800/80' : 'bg-slate-200/60'}`} style={{ width: w * (0.7 + Math.random() * 0.6), animationDelay: `${(rowIdx * 5 + i) * 100}ms` } as any} />
                        ))}
                    </View>
                ))}
            </View>
            {/* Loading label */}
            <View className="items-center mt-8">
                <View className="flex-row items-center">
                    <Ionicons name="document-text" size={18} color={isDark ? '#38bdf8' : '#3b82f6'} style={{ marginRight: 8 }} />
                    <Text className={`font-bold text-sm ${isDark ? 'text-sky-400' : 'text-blue-600'}`}>{t('strategy.loading')}</Text>
                </View>
            </View>
        </View>
    );

    // Load Error Component
    const LoadErrorView = () => (
        <View className={`absolute inset-0 items-center justify-center p-8 ${isDark ? 'bg-[#020617]' : 'bg-slate-50'}`}>
            <View className="max-w-sm w-full items-center">
                <View className={`w-20 h-20 rounded-full items-center justify-center mb-6 ${isDark ? 'bg-rose-500/15' : 'bg-rose-50'}`}>
                    <Ionicons name="cloud-offline" size={40} color={isDark ? '#fb7185' : '#e11d48'} />
                </View>
                <Text className={`text-2xl font-black text-center mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('strategy.load_failed')}</Text>
                <Text className={`text-center text-sm font-medium mb-8 leading-5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    {t('strategy.network_error')}
                </Text>
                <View className="flex-row gap-3 w-full">
                    <TouchableOpacity
                        onPress={() => Platform.OS === 'web' ? window.open(targetUrl, '_blank') : null}
                        className={`flex-1 py-4 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                    >
                        <Text className={`text-center font-bold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{t('strategy.open_new_window')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleRetry}
                        className={`flex-1 py-4 rounded-2xl ${isDark ? 'bg-sky-500' : 'bg-blue-600'}`}
                    >
                        <View className="flex-row items-center justify-center">
                            <Ionicons name="refresh" size={16} color="white" style={{ marginRight: 6 }} />
                            <Text className="text-white font-bold">{t('strategy.retry')}</Text>
                        </View>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

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
        <View className={`flex-1 ${isDark ? 'bg-[#020617]' : 'bg-slate-50'}`}>
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header - Compact */}
            <View className={`pt-4 pb-1.5 px-6 border-b z-50 shadow-lg flex-row justify-between items-center ${isDark ? 'bg-[#0f172a] border-slate-800' : 'bg-white border-slate-100'}`}>
                <View className="flex-row items-center">
                    <TouchableOpacity onPress={() => router.back()} className={`mr-3 w-8 h-8 rounded-full items-center justify-center active:bg-slate-700 ${isDark ? 'bg-slate-800' : 'bg-slate-100 border border-slate-200'}`}>
                        <Ionicons name="arrow-back" size={16} color={isDark ? "white" : "#1e293b"} />
                    </TouchableOpacity>
                    <View>
                        <Text className={`font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`} style={{ fontSize: 16 * fontSizeScale }}>{t('strategy.title')}</Text>
                        <Text className={`font-bold mt-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} style={{ fontSize: 9 * fontSizeScale }}>
                            {isFile ? (sheetData?.fileName || t('strategy.uploaded_file')) : t('strategy.subtitle')}
                        </Text>
                    </View>
                </View>

                {isAdmin && (
                    <View className="relative z-50">
                        <Pressable
                            onPress={onOpenAdmin}
                            onHoverIn={() => setShowTooltip(true)}
                            onHoverOut={() => setShowTooltip(false)}
                            className={`p-2 rounded-full border active:bg-amber-500/20 ${isDark ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}
                        >
                            <Ionicons name="create-outline" size={18} color={isDark ? "#f59e0b" : "#d97706"} />
                        </Pressable>
                        {showTooltip && (
                            <View className={`absolute top-14 right-0 px-3 py-2 rounded-lg border shadow-xl w-48 z-50 ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-white border-slate-200'}`}>
                                <Text className={`text-xs font-bold text-center ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('strategy.manage_title')}</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Content Container */}
            <View className="flex-1 relative">
                {(accessError || loadError) ? (
                    <View className={`flex-1 items-start justify-center p-8 pt-16 ${isDark ? 'bg-[#020617]' : 'bg-slate-50'}`}>
                        <View className="max-w-md w-full mx-auto">
                            <View className={`w-24 h-24 rounded-[32px] items-center justify-center mb-10 mx-auto border rotate-3 ${isDark ? 'bg-amber-500/20 border-amber-500/30' : 'bg-amber-50 border-amber-200'}`}>
                                <Ionicons name="lock-closed" size={48} color={isDark ? "#f59e0b" : "#d97706"} />
                            </View>
                            <Text className={`font-black text-center mb-4 tracking-tighter ${isDark ? 'text-white' : 'text-slate-800'}`} style={{ fontSize: 36 * fontSizeScale }}>{t('strategy.access_denied')}</Text>
                            <Text className="text-slate-400 text-center leading-relaxed mb-12 font-medium" style={{ fontSize: 18 * fontSizeScale }}>
                                {isFile ? (
                                    t('strategy.access_denied_file')
                                ) : (
                                    t('strategy.access_denied_google')
                                )}
                            </Text>

                            <View className="space-y-4 mb-12">
                                <View className={`flex-row items-center p-5 rounded-3xl border shadow-sm ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-100 shadow-slate-200'}`}>
                                    <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-5 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                                        <Ionicons name="person-add" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`font-black text-sm mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('strategy.request_permission')}</Text>
                                        <Text className={`text-xs font-bold leading-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('strategy.request_permission_desc')}</Text>
                                    </View>
                                </View>
                                <View className={`flex-row items-center p-5 rounded-3xl border shadow-sm ${isDark ? 'bg-slate-900/80 border-slate-800' : 'bg-white border-slate-100 shadow-slate-200'}`}>
                                    <View className={`w-10 h-10 rounded-2xl items-center justify-center mr-5 ${isDark ? 'bg-slate-800' : 'bg-slate-50'}`}>
                                        <Ionicons name="log-in" size={20} color={isDark ? "#94a3b8" : "#64748b"} />
                                    </View>
                                    <View className="flex-1">
                                        <Text className={`font-black text-sm mb-1 ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('strategy.switch_account')}</Text>
                                        <Text className={`text-xs font-bold leading-5 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>{t('strategy.switch_account_desc')}</Text>
                                    </View>
                                </View>
                            </View>

                            <View className="flex-row gap-4 mt-4">
                                <TouchableOpacity
                                    onPress={() => Platform.OS === 'web' ? window.open(targetUrl, '_blank') : null}
                                    className={`flex-1 py-3.5 rounded-2xl border active:scale-95 transition-all ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}
                                >
                                    <Text className={`text-center font-black text-base ${isDark ? 'text-white' : 'text-slate-800'}`}>{t('strategy.open_new_window')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => { setAccessError(false); setLoadError(false); setIsLoading(true); }}
                                    className={`flex-1 py-3.5 rounded-2xl shadow-xl active:scale-95 transition-all ${isDark ? 'bg-[#38bdf8] shadow-blue-500/30' : 'bg-blue-600 shadow-blue-200'}`}
                                >
                                    <Text className={`text-center font-black text-base ${isDark ? 'text-[#0f172a]' : 'text-white'}`}>{t('strategy.retry')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ) : (
                    <View className="flex-1">
                        {Platform.OS === 'web' ? (
                            <>
                                <iframe
                                    key={loadError ? 'retry' : 'initial'}
                                    src={targetUrl}
                                    onLoad={() => { setIsLoading(false); setLoadError(false); }}
                                    onError={() => { setIsLoading(false); setLoadError(true); }}
                                    style={{
                                        width: `${100 / zoom}%`,
                                        height: `${100 / zoom}%`,
                                        border: 'none',
                                        transform: `scale(${zoom})`,
                                        transformOrigin: 'top left',
                                        transition: 'transform 0.2s ease-out, width 0.2s ease-out, height 0.2s ease-out',
                                        opacity: isLoading ? 0 : 1,
                                    }}
                                />
                                {isLoading && !loadError && <SkeletonLoader />}
                                {loadError && <LoadErrorView />}
                            </>
                        ) : (
                            <WebView
                                ref={webViewRef}
                                source={{ uri: targetUrl }}
                                style={{ flex: 1 }}
                                javaScriptEnabled={true}
                                scalesPageToFit={true}
                                domStorageEnabled={true}
                                startInLoadingState={true}
                                onLoadStart={() => setIsLoading(true)}
                                onLoadEnd={() => setIsLoading(false)}
                                onError={() => { setIsLoading(false); setLoadError(true); }}
                                onMessage={(event: any) => {
                                    const title = event.nativeEvent.data;
                                    if (!isFile && (title.includes('권한') || title.includes('Access') || title.includes('Denied') || title.includes('Login'))) {
                                        setAccessError(true);
                                    }
                                }}
                                renderLoading={() => <SkeletonLoader />}
                                injectedJavaScript={`
                                    (function() {
                                        window.ReactNativeWebView.postMessage(document.title);
                                    })();
                                    document.body.style.zoom = '${zoom}'; 
                                    true;
                                `}
                            />
                        )}
                    </View>
                )}

                {/* Floating Zoom Controls - Minimal & Transparent - Bottom Center */}
                {!accessError && !loadError && !isLoading && (
                    <View className="absolute bottom-4 left-0 right-0 items-center justify-center z-10" style={{ pointerEvents: 'none' }}>
                        <View className={`flex-row backdrop-blur-[2px] p-1 rounded-full border items-center ${isDark ? 'bg-slate-900/30 border-slate-700/30' : 'bg-white/30 border-slate-200/30'}`} style={{ pointerEvents: 'auto' }}>
                            <TouchableOpacity
                                onPress={() => handleZoom(-0.1)}
                                className={`w-7 h-7 items-center justify-center rounded-full mr-1.5 active:bg-slate-700/50 border ${isDark ? 'bg-slate-800/40 border-slate-600/30' : 'bg-slate-100/40 border-slate-200/30'}`}
                            >
                                <Ionicons name="remove" size={14} color={isDark ? "white" : "#1e293b"} />
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleResetZoom}
                                className={`h-7 px-2.5 items-center justify-center rounded-full mr-1.5 active:bg-slate-700/50 border min-w-[50px] ${isDark ? 'bg-slate-800/40 border-slate-600/30' : 'bg-slate-100/40 border-slate-200/30'}`}
                            >
                                <Text className={`font-black text-[11px] ${isDark ? 'text-white' : 'text-slate-800'}`}>{Math.round(zoom * 100)}%</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => handleZoom(0.1)}
                                className="w-7 h-7 items-center justify-center bg-[#38bdf8]/60 rounded-full active:bg-[#0ea5e9]/80 shadow-sm"
                            >
                                <Ionicons name="add" size={14} color="#0f172a" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </View>

            {/* Admin Config Modal - Kept for legacy but ideally redirected to Admin Page */}
            <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
                <View className="flex-1 bg-black/80 items-center justify-center p-6">
                    <BlurView intensity={20} className="absolute inset-0" />
                    <View className={`w-full max-w-lg p-8 rounded-[32px] border shadow-2xl ${isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'}`}>
                        <Text className={`text-2xl font-black mb-2 ${isDark ? 'text-white' : 'text-slate-800'}`}>전략 문서 설정</Text>
                        <Text className={`text-sm mb-6 font-bold ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>연동할 구글 스프레드시트 주소를 입력하세요.</Text>

                        <View className={`p-4 rounded-2xl mb-6 border ${isDark ? 'bg-slate-800 border-slate-600' : 'bg-slate-50 border-slate-200'}`}>
                            <TextInput
                                value={inputUrl}
                                onChangeText={setInputUrl}
                                placeholder="https://docs.google.com/spreadsheets/d/..."
                                placeholderTextColor={isDark ? "#475569" : "#94a3b8"}
                                className={`text-lg font-medium h-12 ${isDark ? 'text-white' : 'text-slate-800'}`}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        <View className="flex-row gap-3">
                            <TouchableOpacity onPress={() => setModalVisible(false)} className={`flex-1 py-4 rounded-2xl border ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
                                <Text className={`text-center font-bold text-lg ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>취소</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleSaveUrl} className={`flex-1 py-4 rounded-2xl shadow-lg ${isDark ? 'bg-[#38bdf8] shadow-blue-500/20' : 'bg-blue-600 shadow-blue-200'}`}>
                                <Text className={`text-center font-black text-lg ${isDark ? 'text-[#0f172a]' : 'text-white'}`}>저장하기</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>


        </View>
    );
}

