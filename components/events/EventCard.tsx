/**
 * 리액트(React) 컴포넌트 구조와 타입스크립트(TypeScript) 입문을 위한 핵심 파일입니다.
 * 
 * 1. 컴포넌트(Component): 레고 블록처럼 화면의 일부분(여기서는 '이벤트 카드' 하나)을 담당하는 단위입니다.
 * 2. 상태(State)와 훅(Hook): 화면 안에서 계속 변하는 값(예: 남은 시간 타이머)을 관리합니다.
 */
import React, { useState, useEffect } from 'react';
// --- 리액트 네이티브(앱) 기본 UI 태그들 ---
// View: 보이지 않는 네모 박스 (HTML의 div 역할)
// Text: 글자를 렌더링하는 태그
// Pressable: 터치(클릭)가 가능한 투명한 버튼
// Image, ImageBackground: 이미지 출력용 태그
// Dimensions, Platform: 현재 기기의 화면 크기나 종류(웹/iOS/안드로이드)를 확인할 때 사용
import { View, Text, Pressable, Image, ImageBackground, Dimensions, Platform } from 'react-native';

// --- 엑스포(Expo) 아이콘 꾸러미 ---
// Ionicons: 수천 개의 무료 아이콘 세트. 아이콘 이름만 지정하면 화면에 멋진 그림이 나옵니다.
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// --- 외부 데이터(Data) 불러오기 ---
// import { 가져올_변수명 } from '파일_위치': 다른 파츠에서 정의해둔 데이터를 이 파일로 가져옵니다.
// ../ 기호는 "지금 내 폴더에서 한 칸 위로(상위 폴더로) 가라"는 뜻입니다.
// INITIAL_WIKI_EVENTS: 기존 위키 사이트에서 가져왔던 기본 이벤트 데이터 목록
//import { ... } from ... (가져오기)
//ADDITIONAL_EVENTS (가져올 물건의 이름)
//'../../data/new-events' (물건이 있는 위치/주소)
import { INITIAL_WIKI_EVENTS } from '../../data/wiki-events';
// ADDITIONAL_EVENTS: 최근에 프로젝트에 새롭게 추가된 신규 이벤트 데이터 목록
import { ADDITIONAL_EVENTS } from '../../data/new-events';

/**
 * 인터페이스(interface): 타입스크립트의 핵심 기능으로, 이 컴포넌트가 부모로부터 넘겨받아야 할
 * 데이터(Props)들의 '모양(타입)'을 엄격하게 정의하는 설명서입니다.
 * 예: "event는 아무거나(any) 받아도 되지만, isDark는 무조건 boolean(참/거짓)이어야 해!"
 */
interface EventCardProps {
    event: any;                         // 표시할 이벤트의 상세 정보 (이름, 시간 등)
    isDark: boolean;                    // 다크모드 여부 (true면 다크모드)
    isMobile: boolean;                  // 현재 화면이 모바일 화면 크기인지 여부
    fontSizeScale: number;              // 폰트 크기 배율 (모바일 최적화용)
    windowWidth: number;                // 현재 기기의 가로 너비
    now: Date;                          // 현재 시간
    timezone: 'LOCAL' | 'UTC';          // 시간대 (내 지역 시간인지, 국제 표준 UTC인지)
    viewMode: 'list' | 'timeline';      // 카드를 보여줄 방식 (리스트형 vs 타임라인형)

    // 함수형 Props: 부모가 자식에게 "너 이거 클릭되면 이 함수를 실행해!"라고 넘겨주는 리모컨 역할
    t: (key: string, options?: any) => string; // 언어 번역 함수 (예: t('events.title'))
    auth: {
        isLoggedIn: boolean;            // 로그인 여부 (락(Lock) 아이콘 표시용)
        adminName?: string | null;
        role?: any;
    };
    onPress: (event: any) => void;      // 카드를 클릭했을 때 실행할 함수
    isEventActive: (event: any) => boolean; // 현재 이벤트가 "진행 중(ONGOING)"인지 판별하는 함수
    isEventExpired: (event: any) => boolean; // 이벤트가 "끝났는지" 판별하는 함수
    getRemainingSeconds: (str: string, eventId?: string) => number | null; // 시작까지 남은 초(Second) 계산
    getEventEndDate: (event: any) => Date | null;
    toLocal: (kstStr: string) => string; // 한국 시간을 내 지역 시간으로 변환
    toUTC: (kstStr: string) => string;   // 한국 시간을 UTC로 변환
    pad: (n: number) => string;          // 숫자 앞에 0을 붙여주는 함수 (예: 9 -> 09)
    translateDay: (day: string) => string;
    translateLabel: (label: string) => string;
    getEventSchedule: (event: any) => any;
    formatRemainingTime: (seconds: number) => string; // 120초 -> "02:00" 형태로 변환
}

/**
 * EventCard 컴포넌트 선언부
 * React.FC<EventCardProps> : "이 EventCard는 함수형 컴포넌트(FC)인데, 아까 정의한 EventCardProps 규칙을 따를거야" 라는 뜻입니다.
 * ({ ... }) : 부모가 넘겨준 물건들(Props)을 하나하나 이름표를 붙여서 꺼내쓰는 문법(비구조화 할당)입니다.
 */
export const EventCard: React.FC<EventCardProps> = ({
    event,
    isDark,
    isMobile,
    fontSizeScale,
    windowWidth,
    now: initialNow, // 부모가 준 'now'라는 이름을 여기서는 'initialNow'로 바꿔서 쓸게! 라는 뜻
    timezone,
    viewMode,
    t,
    auth,
    onPress,
    isEventActive,
    isEventExpired,
    getRemainingSeconds,
    getEventEndDate,
    toLocal,
    toUTC,
    pad,
    translateDay,
    translateLabel,
    getEventSchedule,
    formatRemainingTime,
}) => {
    // useState: 컴포넌트 안에서 '변하는 값'을 담는 바구니입니다.
    // [현재값, 값을바꾸는함수] = useState(초기값)
    const [now, setNow] = useState(initialNow);

    // useEffect: 이 컴포넌트가 화면에 '나타날 때', '사라질 때', 혹은 '특정 값이 변할 때' 일을 시키는 훅(Hook)입니다.
    // 두 번째 인자로 빈 배열 []을 주면 "처음 화면에 뜰 때 딱 한 번만 실행해!" 라는 의미입니다.
    useEffect(() => {
        // 1초(1000ms)마다 setInterval 안의 화살표 함수가 실행됩니다.
        const timer = setInterval(() => {
            // setNow를 호출하면 -> now 값이 바뀜 -> 리액트가 그걸 눈치채고 화면을 1초마다 다시 그려줍니다!
            setNow(new Date());
        }, 1000);

        // 컴포넌트가 화면에서 사라질 때(언마운트) 타이머를 끄는 청소(Cleanup) 작업입니다. 
        // 안 끄면 타이머가 좀비처럼 계속 돌아서 폰이 느려집니다.
        return () => clearInterval(timer);
    }, []);

    const isActive = isEventActive(event);
    const isExpired = isEventExpired(event);
    const isLocked = !auth.isLoggedIn;

    const convertTime = (kstStr: string) => {
        if (timezone === 'LOCAL') return toLocal(kstStr);
        return toUTC(kstStr);
    };

    const getEventIcon = (id: string) => {
        if (id.includes('bear')) return 'paw-outline';
        if (id.includes('frost') || id.includes('weapon')) return 'shield-half-outline';
        if (id.includes('castle') || id.includes('fortress')) return 'business-outline';
        if (id.includes('championship')) return 'trophy-outline';
        return 'calendar-clear-outline';
    };

    const allBaseEvents = [...INITIAL_WIKI_EVENTS, ...ADDITIONAL_EVENTS];
    const eventInfo = allBaseEvents.find(e => e.id === (event.originalEventId || event.eventId));
    const eventImageUrl = eventInfo?.imageUrl;

    const currentSchedule = getEventSchedule(event);
    let displayDay = (event.isBearSplit && event.day) ? event.day : (currentSchedule?.day || event.day);
    let displayTime = (event.isBearSplit || event.isFoundrySplit || event.isFortressSplit || event.isCanyonSplit) ? event.time : (currentSchedule?.time || event.time);

    // next slot logic for split events
    if (event.isBearSplit || event.isFoundrySplit || event.isCanyonSplit) {
        const dayMap: { [key: string]: number } = {
            '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6,
            'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6
        };
        const currentDay = (now.getDay() + 6) % 7;
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const matches = Array.from(displayTime.matchAll(/([일월화수목금토매일상시]|sun|mon|tue|wed|thu|fri|sat|daily)\s*\(?(\d{1,2}:\d{2})\)?/gi));

        if (matches.length > 0) {
            const nextSlot = matches.find(m => {
                const dRaw = m[1];
                const [h, min] = m[2].split(':').map(Number);
                if (dRaw === '매일' || dRaw === '상시') return true;
                const dIdx = dayMap[dRaw.toLowerCase()];
                if (dIdx > currentDay) return true;
                if (dIdx === currentDay) return currentMins < (h * 60 + min + 60);
                return false;
            });
            if (nextSlot) {
                displayDay = nextSlot[1];
                const upcomingMatches = matches.filter(m => {
                    const dRaw = m[1];
                    const [h, min] = m[2].split(':').map(Number);
                    if (dRaw === '매일' || dRaw === '상시') return true;
                    const dIdx = dayMap[dRaw.toLowerCase()];
                    if (dIdx > currentDay) return true;
                    if (dIdx === currentDay) return currentMins < (h * 60 + min + 60);
                    return false;
                });
                if (upcomingMatches.length > 0) {
                    displayTime = upcomingMatches.map(m => m[0]).join(', ');
                }
            }
        }
    }

    const getFormattedDateRange = () => {
        const dayMapObj: { [key: string]: number } = {
            '월': 0, '화': 1, '수': 2, '목': 3, '금': 4, '토': 5, '일': 6,
            'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6
        };
        const currentDay = (now.getDay() + 6) % 7;
        let targetDayStr = displayDay;
        let targetTimeStr = displayTime;
        let dIdx = dayMapObj[targetDayStr?.toLowerCase() || ''];
        if (dIdx !== undefined) {
            const [h, m] = (targetTimeStr.match(/(\d{1,2}):(\d{2})/) || []).slice(1).map(Number);
            if (!isNaN(h)) {
                let diffDays = dIdx - currentDay;
                const targetDate = new Date(now);
                targetDate.setDate(now.getDate() + diffDays);
                targetDate.setHours(h, m, 0, 0);
                const endDate = new Date(targetDate);
                endDate.setMinutes(endDate.getMinutes() + 60);
                const kstFormat = (d: Date) => `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                const kstStr = `${kstFormat(targetDate)} ~ ${kstFormat(endDate)}`;
                return convertTime(kstStr).replace(/20(\d{2})[\.\/-]/g, '$1.');
            }
        }
        let finalStr = convertTime(`${displayDay || ''} ${displayTime || ''}`);
        return finalStr.replace(/20(\d{2})[\.\/-]/g, '$1.');
    };

    const formattedDateRange = getFormattedDateRange();
    const remSoonSeconds = !isActive && !isExpired ? (getRemainingSeconds(displayDay, event.eventId) ?? getRemainingSeconds(displayTime, event.eventId)) : null;
    const isUpcomingSoon = remSoonSeconds !== null;

    const renderEventTitle = () => {
        const eventId = event.eventId || '';
        const originalId = event.originalEventId || '';
        if (eventId.includes('citadel')) return t('events.citadel_battle_title');
        if (eventId.includes('fortress')) return t('events.fortress_battle_title');

        const cleanId = (originalId || eventId).replace(/_fortress|_citadel|_team\d+/g, '');
        const baseTitle = t(`events.${cleanId}_title`, { defaultValue: event.title });

        if ((event.isBearSplit || event.isFoundrySplit || event.isCanyonSplit) && event.teamLabel) {
            const translatedTeam = event.teamLabel.replace('1군', t('events.team1')).replace('2군', t('events.team2'));
            // Use word-joiner (\u2060) to keep "(1군)" together as a single unit
            const teamBadge = `\u2060(\u2060${translatedTeam}\u2060)\u2060`;

            // Only move to next line if REALLY narrow (below 340px)
            if (windowWidth < 340) {
                return `${baseTitle}\n${teamBadge}`;
            }
            return `${baseTitle} ${teamBadge}`;
        }
        return baseTitle;
    };

    // 여기서부터가 실제 화면에 그려지는 부분(View)입니다.
    // 리액트에서는 HTML과 비슷하게 생긴 JSX(타입스크립트는 TSX) 문법을 씁니다.
    if (isActive) {
        return (
            // Pressable: 터치(클릭)가 가능한 영역을 만드는 투명한 버튼 박스입니다.
            <Pressable
                onPress={() => onPress(event)} // 누르면 부모가 준 onPress 함수를 실행합니다.
                style={({ pressed, hovered }: any) => [
                    {
                        width: '100%',
                        borderRadius: 20,
                        overflow: 'hidden',
                        backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
                        borderWidth: 1.5,
                        borderColor: isDark ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.5)',
                        elevation: 5,
                        opacity: pressed ? 0.98 : 1,
                        transform: [{ scale: (hovered && !isLocked) ? 1.02 : 1 }],
                        marginBottom: 12,
                        ...Platform.select({
                            web: { boxShadow: `0 4px 8px ${isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)'}` },
                            default: {
                                shadowColor: '#10b981',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: isDark ? 0.2 : 0.1,
                                shadowRadius: 8,
                            }
                        })
                    }
                ]}
            >
                {/* 
                  중괄호 {} 안에는 자바스크립트/타입스크립트 코드를 적을 수 있습니다.
                  isLocked && (UI) 문법은 "isLocked가 참(true)일 때만 뒤의 UI를 그려라!" 라는 단축 문법입니다.
                */}
                {isLocked && (
                    <View className={`absolute top-3 right-3 z-20 flex-row items-center px-2 py-1 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-600'}`}>
                        <Ionicons name="lock-closed" size={10} color="#fbbf24" style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: 9 * fontSizeScale, color: '#ffffff', fontWeight: '500' }}>{t('common.member_only_title')}</Text>
                    </View>
                )}

                {/* Background 워터마크 아이콘 */}
                <View className="absolute right-[-20px] top-[-20px] opacity-10" style={{ pointerEvents: 'none' }}>
                    <Ionicons name={getEventIcon(event.originalEventId || event.eventId) as any} size={140} color="#10b981" />
                </View>

                <View className="p-4 pl-5">
                    {/* 상단 타이틀 & 남은시간 묶음 */}
                    <View className="flex-row justify-between items-start mb-4">
                        <View className="flex-1 pr-2">
                            <View className="flex-row items-center mb-1.5">
                                <View className="px-1.5 py-0.5 rounded-[4px] bg-emerald-500 shadow-sm flex-row items-center">
                                    <View className="w-1.5 h-1.5 rounded-full bg-white mr-1 opacity-90" />
                                    <Text className="text-[9px] font-black uppercase tracking-wider text-white">ONGOING</Text>
                                </View>
                            </View>
                            {/* numberOfLines={1}: 글자가 1줄을 넘어가면 뒷부분을 ...으로 잘라줍니다 (말줄임표) */}
                            {/* adjustsFontSizeToFit: 공간이 모자라면 폰트 크기를 스스로 줄여서 1줄 안에 다 맞춰넣는 신기한 속성입니다! */}
                            <Text className={`font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`} style={{ fontSize: 18 * fontSizeScale, lineHeight: 22 * fontSizeScale }} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                                {renderEventTitle()}
                            </Text>
                        </View>

                        <View className="items-end pl-2">
                            {(() => {
                                let remSeconds = getRemainingSeconds(toLocal(displayDay), event.eventId) || getRemainingSeconds(toLocal(displayTime), event.eventId);
                                if (remSeconds === null) {
                                    const endDate = getEventEndDate({ ...event, day: toLocal(displayDay), time: toLocal(displayTime) });
                                    if (endDate && now < endDate) {
                                        remSeconds = Math.floor((endDate.getTime() - now.getTime()) / 1000);
                                    }
                                }

                                if (remSeconds !== null) {
                                    const d = Math.floor(remSeconds / (24 * 3600));
                                    const h = Math.floor((remSeconds % (24 * 3600)) / 3600);
                                    const m = Math.floor((remSeconds % 3600) / 60);
                                    const s = remSeconds % 60;
                                    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
                                    return (
                                        <View className="items-end">
                                            <View className="flex-row items-baseline mb-0.5">
                                                {d > 0 && <Text className={`font-black mr-1 tracking-tighter ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} style={{ fontSize: 15 * fontSizeScale }}>{d}{t('common.day_short')}</Text>}
                                                <Text className={`font-black tracking-widest tabular-nums ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} style={{ fontSize: 18 * fontSizeScale }}>{timeStr}</Text>
                                            </View>
                                            <Text className={`text-[9px] font-bold uppercase tracking-[0.2em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>REMAINING</Text>
                                        </View>
                                    );
                                }
                                return (
                                    <Text className="text-sm font-bold uppercase tracking-widest text-emerald-500">Active</Text>
                                );
                            })()}
                        </View>
                    </View>

                    {/* 하단 프로그레스 바 & 기간 */}
                    <View className="w-full">
                        {(() => {
                            // 날짜 문자열 파싱해서 실제 진행률(%) 계산
                            let progressPct = 100;
                            const parts = formattedDateRange.split(' ~ ');
                            if (parts.length === 2) {
                                const parseDatePattern = (str: string) => {
                                    const match = str.match(/(\d{2})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2})/);
                                    if (match) {
                                        return new Date(2000 + parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]), parseInt(match[4]), parseInt(match[5])).getTime();
                                    }
                                    return 0;
                                };
                                const startMs = parseDatePattern(parts[0]);
                                const endMs = parseDatePattern(parts[1]);
                                if (startMs && endMs && now.getTime() >= startMs && now.getTime() <= endMs) {
                                    const totalDuration = endMs - startMs;
                                    const elapsed = now.getTime() - startMs;
                                    progressPct = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
                                }
                            }

                            return (
                                <>
                                    <View className={`w-full h-1.5 rounded-full overflow-hidden mb-2 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`}>
                                        <View
                                            className="absolute left-0 top-0 bottom-0 bg-emerald-500 rounded-full"
                                            style={{ width: `${progressPct}%` }}
                                        />
                                    </View>
                                    <View className="flex-row items-center">
                                        <Ionicons name="time-outline" size={13} color={isDark ? '#cbd5e1' : '#64748b'} style={{ marginRight: 4 }} />
                                        {parts.length === 2 ? (
                                            <Text className={`font-medium tracking-tight ${isDark ? 'text-slate-300' : 'text-slate-600'}`} style={{ fontSize: 11 * fontSizeScale }}>
                                                {parts[0]} <Text className="text-slate-500 opacity-50 mx-1">➔</Text> {parts[1]}
                                            </Text>
                                        ) : (
                                            <Text className={`font-medium tracking-tight ${isDark ? 'text-slate-300' : 'text-slate-600'}`} style={{ fontSize: 11 * fontSizeScale }}>
                                                {formattedDateRange}
                                            </Text>
                                        )}
                                    </View>
                                </>
                            );
                        })()}
                    </View>
                </View>
            </Pressable>
        );
    }

    return (
        <Pressable
            onPress={() => onPress(event)}
            style={({ pressed, hovered }: any) => [
                {
                    width: '100%',
                    borderRadius: 20,
                    marginBottom: 10,
                    overflow: 'hidden',
                    backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.95)',
                    borderWidth: 1.5,
                    borderColor: isUpcomingSoon
                        ? (isDark ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.6)')
                        : (isExpired
                            ? (isDark ? 'rgba(71, 85, 105, 0.3)' : 'rgba(148, 163, 184, 0.4)')
                            : (isDark ? 'rgba(56, 189, 248, 0.3)' : 'rgba(59, 130, 246, 0.4)')),
                    opacity: pressed ? 0.96 : 1,
                    transform: [{ scale: (hovered && !isLocked) ? 1.02 : 1 }],
                }
            ]}
        >
            {isLocked && (
                <View className={`absolute top-3 right-3 z-20 flex-row items-center px-2 py-1 rounded-full ${isDark ? 'bg-slate-800' : 'bg-slate-600'}`}>
                    <Ionicons name="lock-closed" size={10} color="#fbbf24" style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 9 * fontSizeScale, color: '#ffffff', fontWeight: '500' }}>{t('common.member_only_title')}</Text>
                </View>
            )}

            <View className={`p-4 flex-row`}>
                {/* 좌측 아이콘 영역 */}
                <View className={`w-12 h-12 mr-3.5 rounded-2xl items-center justify-center mt-0.5 ${isDark ? 'bg-slate-800/80 shadow-inner' : 'bg-slate-100 shadow-sm'}`}>
                    {eventImageUrl ? (
                        <Image source={typeof eventImageUrl === 'string' ? { uri: eventImageUrl } : eventImageUrl} className="w-7 h-7" resizeMode="contain" />
                    ) : (
                        <Ionicons name={getEventIcon(event.originalEventId || event.eventId)} size={24} color={isDark ? '#94a3b8' : '#64748b'} />
                    )}
                </View>

                {/* 우측 텍스트 및 액션 영역 (수직 분할) */}
                <View className="flex-1 overflow-hidden justify-center">

                    {/* 상단 1열: 타이틀 + 우측 타이머 & 화살표 */}
                    <View className="flex-row justify-between items-center mb-1.5">
                        <View className="flex-1 flex-row items-center pr-2">
                            <Text
                                className={`flex-1 font-black tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}
                                style={{ fontSize: 16 * fontSizeScale }}
                                numberOfLines={1}
                                adjustsFontSizeToFit
                                minimumFontScale={0.75}
                            >
                                {renderEventTitle()}
                            </Text>
                        </View>

                        <View className="flex-row items-center">
                            {isUpcomingSoon && remSoonSeconds !== null && (
                                <View className="items-end mr-3">
                                    <Text className={`text-[8px] font-black uppercase tracking-widest leading-none mb-0.5 ${isDark ? 'text-amber-500' : 'text-amber-600'}`}>Starts In</Text>
                                    <Text className={`font-black tabular-nums tracking-wider ${isDark ? 'text-amber-400' : 'text-amber-600'}`} style={{ fontSize: 13 * fontSizeScale }}>
                                        {formatRemainingTime(remSoonSeconds)}
                                    </Text>
                                </View>
                            )}
                            {isExpired && (
                                <View className="items-end mr-3">
                                    <Text className={`text-[9px] font-black uppercase tracking-widest ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>Ended</Text>
                                </View>
                            )}
                            <View className={`w-7 h-7 rounded-full items-center justify-center ${isDark ? 'bg-slate-800/80 shadow-inner' : 'bg-slate-100 shadow-sm'}`}>
                                <Ionicons name="chevron-forward" size={12} color={isDark ? '#94a3b8' : '#64748b'} />
                            </View>
                        </View>
                    </View>

                    {/* 하단 2열: 날짜 라인 (우측 버튼의 간섭 없이 전체 폭 100% 사용) */}
                    <View className="flex-col w-full">
                        {(!displayDay && !displayTime) ? (
                            <Text className="text-slate-400 text-xs font-medium">{t('dashboard.unassigned')}</Text>
                        ) : (
                            (() => {
                                let rawStr = displayTime || displayDay || '-';
                                if (displayDay && displayTime && !/[일월화수목금토]/.test(displayTime)) {
                                    if (!event.isFortressSplit) rawStr = `${displayDay} ${displayTime}`;
                                }
                                let finalStr = convertTime(rawStr).replace(/20(\d{2})[\.\/-]/g, '$1.').replace(/성채전\s*:\s*/g, '').replace(/,\s*/g, '\n');
                                const lines = Array.from(new Set(finalStr.split('\n').map(l => l.trim()).filter(Boolean)));

                                return lines.map((line, idx) => {
                                    const compactLine = line.replace(' ~ ', ' ➔ ');
                                    return (
                                        <Text
                                            key={idx}
                                            className={`font-medium tracking-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}
                                            style={{ fontSize: 12 * fontSizeScale }}
                                            numberOfLines={1}
                                            adjustsFontSizeToFit
                                        >
                                            <Ionicons name="calendar-outline" size={10} color={isDark ? '#64748b' : '#94a3b8'} /> {compactLine}
                                        </Text>
                                    );
                                });
                            })()
                        )}
                    </View>
                </View>
            </View>
        </Pressable>
    );
};
