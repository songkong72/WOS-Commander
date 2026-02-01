import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, Modal, TextInput, Alert, Pressable } from 'react-native';
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

    const targetUrl = (sheetData && sheetData.url) ? sheetData.url : DEFAULT_SHEET_URL;

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
        setInputUrl(targetUrl);
        setModalVisible(true);
    };

    const handleSaveUrl = async () => {
        if (!inputUrl.trim()) return;

        // Try to extract ID
        const match = inputUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
        if (match && match[1]) {
            const id = match[1];
            const cleanUrl = `https://docs.google.com/spreadsheets/d/${id}/htmlview?embedded=true`;
            try {
                await saveSheetUrl(cleanUrl);
                setModalVisible(false);
                Alert.alert('성공', '전략 문서 주소가 업데이트되었습니다.');
                // Trigger reload if needed
            } catch (e: any) {
                Alert.alert('오류', '저장 중 문제가 발생했습니다: ' + e.message);
            }
        } else {
            Alert.alert('유효하지 않은 주소', '구글 스프레드시트 주소(URL)를 정확히 입력해주세요.');
        }
    };

    const isAdmin = auth.isLoggedIn; // Assuming 'isLoggedIn' implies admin access as per app structure

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
                        <Text className="text-slate-400 text-sm font-bold mt-1">실시간 연맹 공지 및 배치도</Text>
                    </View>
                </View>

                {isAdmin && (
                    <View className="relative z-50">
                        <Pressable
                            onPress={onOpenAdmin}
                            onHoverIn={() => setShowTooltip(true)}
                            onHoverOut={() => setShowTooltip(false)}
                            className="p-3 bg-slate-800 rounded-full border border-slate-700 active:bg-slate-700"
                        >
                            <Ionicons name="link-outline" size={24} color="#38bdf8" />
                        </Pressable>
                        {showTooltip && (
                            <View className="absolute top-14 right-0 bg-slate-800 px-3 py-2 rounded-lg border border-slate-600 shadow-xl w-48 z-50">
                                <Text className="text-white text-xs font-bold text-center">시트 URL경로 입력해 주세요</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Content Container */}
            <View className="flex-1 bg-white relative">
                {Platform.OS === 'web' ? (
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
                        renderLoading={() => (
                            <View className="absolute inset-0 items-center justify-center bg-[#0f172a]">
                                <Text className="text-[#38bdf8] font-bold text-lg">문서를 불러오는 중...</Text>
                            </View>
                        )}
                        injectedJavaScript={`document.body.style.zoom = '${zoom}'; true;`}
                    />
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

            {/* Admin Config Modal */}
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
                                placeholderTextColor="#64748b"
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
