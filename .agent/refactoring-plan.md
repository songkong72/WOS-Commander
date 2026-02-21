# 📋 프로젝트 리팩토링 계획서

> **최종 업데이트**: 2026-02-21
> **원칙**: 세션별 1모듈 분리 → 빌드 확인 → 커밋 → 다음 세션

---

## ✅ 완료된 작업

### ~~events.tsx 인라인 모달 → 컴포넌트 교체~~

| # | 항목 | 줄 수 | 상태 |
|---|---|---|---|
| ~~1-1~~ | ~~**Attendee Modal** → `AttendanceModal`~~ | ~~198줄~~ | ✅ 완료 |
| ~~1-2~~ | ~~**Date Picker Modal** → `DatePickerModal`~~ | ~~107줄~~ | ✅ 완료 |
| ~~1-3~~ | ~~**Custom Alert Modal** → `CustomAlert`~~ | ~~53줄~~ | ✅ 완료 |
| ~~1-4~~ | ~~**Warning Modal** → `WarningModal`~~ | ~~41줄~~ | ✅ 완료 |
| ~~1-5~~ | ~~**미사용 import/state 정리** (BlurView, FlatList 등)~~ | ~~30줄~~ | ✅ 완료 |

📊 **events.tsx: 3,170줄 → 1,611줄** (1,559줄 감소, 49%)


### ~~index.tsx 세션 1: 유틸 함수 분리~~

| 항목 | 상태 |
|---|---|
| ~~`app/utils/eventHelpers.ts` 생성~~ | ✅ 완료 (197줄) |
| ~~`app/utils/dynamicFontSize.ts` 생성~~ | ✅ 완료 (26줄) |

### ~~index.tsx 세션 2: 이벤트 상태 판정 로직 분리~~

| 항목 | 상태 |
|---|---|
| ~~`app/utils/eventStatus.ts` 생성~~ | ✅ 완료 (455줄) |

### ~~index.tsx 세션 3: Gate/로딩 화면 분리~~

| 항목 | 상태 |
|---|---|
| ~~`app/screens/GateScreen.tsx` 생성~~ | ✅ 완료 (863줄) |
| ~~`app/hooks/useGateLogic.ts` 생성~~ | ✅ 완료 (70줄) |

### ~~기타~~

| 항목 | 상태 |
|---|---|
| ~~shadow-* deprecated 경고 수정~~ | ✅ 완료 (global.css) |

---

## ⬜ 남은 작업

### 세션 4: 이벤트 카드 + 대시보드 컴포넌트 분리 (index.tsx)

**새 파일**: `app/components/EventCard.tsx`

| 함수명 | 라인 | 설명 |
|:---|:---:|:---|
| `renderEventCard` | 904-936 | 이벤트 카드 래퍼 (32줄) | ✅ 완료 |
| `formatEventTimeCompact` | - | (이전 세션에서 정리됨) | ✅ 완료 |
| `renderWithHighlightedDays` | - | (이전 세션에서 정리됨) | ✅ 완료 |

**새 파일**: `components/dashboard/EventSectionHeader.tsx`

추출 범위: `EventSectionList.tsx` 상단 헤더
- Section 2: Sticky Header (Weekly Program + Tabs) | ✅ 완료 |
- Timezone 토글
- View Mode 토글

**새 파일**: `components/dashboard/DashboardCards.tsx`

추출 범위: `index.tsx` 상단 섹션
- Feature Cards (이벤트, 전략, 영웅) | ✅ 완료 |
- Welcome 헤더
- 로그인 가이드

**⚠️ 주의사항**:
- `renderEventCard`가 가장 크고 복잡 (465줄, 중첩 함수 3개 포함)
- `getFormattedDateRange`, `getEventIcon`, `getSoonRemainingSeconds`도 함께 이동
- 카드는 많은 props 필요 → interface 정의 필수

---

### 중복/미사용 코드 정리

| # | 항목 | 설명 | 상태 |
|---|---|---|---|
| 2-1 | 구 `EventCard` 통합 | index.tsx는 구 EventCard 사용, events.tsx는 GrowthEventCard 사용 | ⬜ 세션 4와 통합 |
| 2-2 | `showCustomAlert` 중복 | 11개 파일에서 각각 로컬 정의 → Context 통합 검토 | ⬜ 대기 |
| 2-3 | `getKoreanDayOfWeek` 중복 | events.tsx + eventHelpers.ts | ⬜ 대기 |
| 2-4 | `parseScheduleStr` 중복 | events.tsx + eventHelpers.ts + GrowthEventCard | ⬜ 대기 |

---

### 커스텀 Hook 추출

| # | 대상 | 현재 위치 | 상태 |
|---|---|---|---|
| ~~3-1~~ | ~~`useScheduleEditor` hook~~ | ~~events.tsx (~20개 state)~~ | ✅ 완료 |

| 3-2 | `useAttendeeManager` hook | events.tsx (벌크 참가자 관리) | ⬜ 대기 |
| 3-3 | `useEventFilter` hook | events.tsx (카테고리, 검색, 필터) | ⬜ 대기 |
| 3-4 | `useDashboard` hook | index.tsx (36개 useState) | ⬜ 대기 |

---

### 기타 대형 파일

| # | 파일 | 줄 수 | 설명 | 상태 |
|---|---|---|---|---|
| 4-1 | `app/hooks/useAdminAuth.ts` | 782 | 인증+관리자 로직 분리 가능 | ⬜ 대기 |
| 4-2 | `app/super-admin.tsx` | 533 | SuperAdminModal로 일부 이동 | ⬜ 대기 |
| 4-3 | `components/AdminManagement.tsx` | 878 | 섹션별 컴포넌트 분리 | ⬜ 대기 |

---

## 📁 현재 파일 크기

```
app/growth/events.tsx        1,611줄

app/index.tsx                1,170줄 (모듈화 완료)
components/dashboard/EventSectionList.tsx  250줄
components/events/EventCard.tsx            415줄
components/TimelineView.tsx    913줄
components/AdminManagement.tsx 878줄
app/screens/GateScreen.tsx     863줄
app/hooks/useAdminAuth.ts      782줄
```

---

## 🛡️ 안전 규칙

1. **한 세션에 한 모듈만** 분리
2. **반드시 빌드 확인** 후 커밋
3. 분리 시 **원본 동작 변경 금지** (리팩토링만, 기능 변경 없음)
4. **import 경로** 꼼꼼히 확인 (상대 경로 주의)
5. 분리 대상 함수가 컴포넌트 내부 state에 의존하면 **파라미터화**
6. TypeScript 타입은 별도 `types.ts`로 분리 검토
