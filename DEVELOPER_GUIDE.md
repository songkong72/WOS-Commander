# WOS-Commander 프로젝트 개발자 가이드

이 문서는 **WOS-Commander** (Whiteout Survival Commander) 헬퍼 웹/앱 애플리케이션의 구조와 기술 스택, 개발 규칙을 안내하는 공식 가이드입니다.

---

## 1. 기술 스택 (Tech Stack)

본 프로젝트는 크로스 플랫폼(Web, iOS, Android) 지원을 위해 **React Native** (Expo) 기반으로 구축되었습니다.

* **프레임워크**: React Native, Expo (SDK 50)
* **라우팅**: Expo Router (파일 기반 라우팅)
* **언어**: TypeScript
* **스타일링**: [NativeWind](https://www.nativewind.dev/) (React Native 환경에서 Tailwind CSS 사용)
* **데이터베이스 및 인증**: Firebase (Firestore, Auth)
* **다국어 지원**: `react-i18next` (다국어 번역)
* **로컬 데이터 저장**: `AsyncStorage` (유저 세팅, 테마 저장 등)

---

## 2. 프로젝트 설치 및 실행 방법

### 필수 조건
* **Node.js**: v18 이상 권장
* **패키지 매니저**: `npm` 사용

### 설치 및 로컬 서버 실행
```bash
# 1. 패키지 설치
npm install

# 2. 웹 버전 실행 (주요 개발 환경)
npm run web
# (또는 expo start --web)

# 3. 모바일(Expo Go) 환경 테스트
npm run start
# 이후 터미널에 나타나는 QR 코드를 모바일 Expo Go 앱으로 스캔합니다.
```

---

## 3. 디렉토리 구조 (Directory Structure)

프로젝트 루트 디렉토리의 핵심 폴더 구조와 역할은 다음과 같습니다:

```text
WOS-Commander/
├── app/                  # 화면(Screen) 및 라우팅 설정 (Expo Router 기반)
│   ├── _layout.tsx       # 최상위 레이아웃, Context Provider, 초기화 로직
│   ├── index.tsx         # 메인 대시보드 화면
│   ├── screens/          # 라우팅 외 개별 화면 컴포넌트
│   └── hooks/            # 로컬 라우터용 훅
├── components/           # 재사용 가능한 UI 컴포넌트 모음
│   ├── common/           # 버튼, 텍스트 등 기본 UI
│   ├── events/           # 이벤트 카드, 필터 등 이벤트 도구 컴포넌트
│   └── modals/           # 커스텀 모달 창 (EventGuideModal 등)
├── hooks/                # 전역 비즈니스 로직 및 Firebase 연동 Custom Hooks
│   ├── useFirestoreEventsWithAttendees.ts # 이벤트 데이터 동기화
│   ├── useFirestoreMembers.ts             # 연맹원 데이터 로드 등
├── services/             # API 호출, 외부 통신, 유틸리티 서비스
│   ├── i18n/             # 다국어 설정 및 번역 파일 (ko.json, en.json 등)
│   └── NotificationService.ts # Discord Webhook 등 알림 전송 로직
├── data/                 # 정적(Static) 데이터 및 JSON, 기본 환경설정 값
├── assets/               # 이미지, 폰트, 아이콘 리소스
├── docs/                 # 영웅 공략 리소스(HTML) 등 문서 백업
└── global.css            # 웹 브라우저용 전역 CSS (스크롤바, Tailwind Base 설정 등)
```

---

## 4. 주요 개발 컨벤션 및 팁 (Conventions)

### 4.1. 스타일링 (Styling)
* StyleSheet 대신 **NativeWind (Tailwind CSS)**의 `className` 속성을 사용하여 스타일링합니다.
* 다크모드 대응을 위해 삼항 연산자를 자주 사용합니다: 
  ```tsx
  <View className={`p-4 rounded-xl ${isDark ? 'bg-slate-800' : 'bg-white'}`}>
  ```
* 웹 환경 전용 스타일이 필요한 경우 `Platform.select({ web: { ... }, default: { ... } })` 패턴을 사용합니다.

### 4.2. 상태 관리 및 데이터 흐름
* 전역 상태 유지(테마, 로그인 정보 등)는 `context/` 훅을 사용하거나, Firestore 실시간 동기화 훅(`useFirestore~`)을 호출하여 `index.tsx` 등 최상위에서 내려주는(Props Down) 방식을 권장합니다.
* Firebase 데이터는 모달이나 개별 컴포넌트 내에서 직접 수정하기보다는 상위 컴포넌트에서 전달받은 콜백 이벤트(ex: `onSave`, `onUpdate`)를 통해 처리합니다.

### 4.3. 다국어 (i18n) 적용
* 소스 코드 내에 한글/영문 텍스트를 직접 하드코딩하지 않습니다.
* 모든 화면의 텍스트는 `const { t } = useTranslation();`을 불러온 뒤, `t('events.title')` 형태로 작성합니다.
* 수정 및 추가된 키(Key) 값은 반드시 `services/i18n/locales/ko.json` (한국어) 및 `en.json` (영어) 양쪽에 모두 추가해야 합니다.

### 4.4 컴포넌트 최적화
* 연산이 무겁거나 자주 렌더링을 유발하는 목록(List) 데이터는 `useMemo`와 `React.memo`를 사용하여 불필요한 재렌더링을 방지합니다.
* 특히 `EventPickers`나 긴 목록 데이터(Hero, Member)를 `filter` 처리할 때는 대상 배열이 Undefined인지 확인하는 **방어 코드**를 반드시 포함합니다.

---

## 5. 초보자를 위한 코드 스터디 가이드 (React & TypeScript)

리액트와 타입스크립트에 입문하는 팀원들을 위해, 프로젝트 내 핵심 기능들을 단계별로 학습할 수 있는 **4대 교과서 파일**을 추천합니다. 해당 파일들에는 작동 원리가 아주 상세하게 한글 주석으로 기록되어 있습니다.

아래 순서대로 코드를 읽어보며 프로젝트의 전체적인 흐름을 파악하는 것을 권장합니다:

1. **[EventCard.tsx](file:///e:/project/workspace/WOS-Commander/components/events/EventCard.tsx) (기초 UI와 컴포넌트 분리)**
   * **학습 포인트**: 리액트 컴포넌트 선언법(FC), JSX/TSX 렌더링 문법, 부모 컴포넌트로부터 넘어오는 데이터(`Props`)와 이를 엄격하게 규정하는 타입스크립트 `interface` 사용법.

2. **[useAdminAuth.ts](file:///e:/project/workspace/WOS-Commander/app/hooks/useAdminAuth.ts) (상태 관리와 훅)**
   * **학습 포인트**: 데이터 상태를 보관하고 화면을 새로고침하는 `useState`, 화면이 렌더링될 때 딱 한 번 실행되거나 데이터 변화를 감지하는 `useEffect`, 그리고 화면 요소의 위치를 기억하는 `useRef`의 실전 활용. (파이어베이스 로그인 로직 포함)

3. **[_layout.tsx](file:///e:/project/workspace/WOS-Commander/app/_layout.tsx) (앱의 시작점과 레이아웃)**
   * **학습 포인트**: 앱이 켜졌을 때 맨 처음 실행되는 진입점(Entry Point). 테마, 언어, 로그인 정보 등 전역(Global) 데이터를 보관하고 앱 전체 화면에 한 방에 뿌려주는 마법, `Context Provider` 렌더링 기법.

4. **[useFirestoreMembers.ts](file:///e:/project/workspace/WOS-Commander/hooks/useFirestoreMembers.ts) (파이어베이스 실시간 동기화)**
   * **학습 포인트**: 구글 파이어베이스 DB 통신 기초. 한 번 가져오고 마는 것이 아니라 DB가 변할 때마다 실시간으로 알림을 받는 `onSnapshot` 구독 패턴과, 수십 장의 데이터를 네트워크 한 방으로 효율적으로 저장/수정하는 `writeBatch` 최적화 기법.
