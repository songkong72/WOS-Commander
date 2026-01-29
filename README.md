# 🛡️ WOS Commander

> **Whiteout Survival 전략 관리 앱** - 빙하기 생존을 위한 최적의 지휘 도구

[![Deploy with Vercel](https://vercel.com/button)](https://wos-commander.vercel.app)
[![GitHub](https://img.shields.io/github/license/songkong72/WOS-Commander)](https://github.com/songkong72/WOS-Commander)

## 📱 프로젝트 소개

**WOS Commander**는 모바일 게임 'Whiteout Survival'을 플레이하는 연맹(Alliance)을 위한 전략 관리 웹 애플리케이션입니다. 영웅 조합 분석, 이벤트 스케줄 관리, 참석자 명단 관리 등 연맹 운영에 필요한 핵심 기능을 제공합니다.

### ✨ 주요 기능

- 🛡️ **영웅 관리**: 70+ 영웅의 스탯, 스킬, 조합 분석
- 📅 **이벤트 스케줄**: 주간 이벤트 일정 및 가이드
- 👥 **참석자 관리**: 연맹 이벤트 참석 명단 및 영웅 조합 등록 (Firebase 실시간 동기화)
- 🔐 **관리자 인증**: 연맹 관리자 전용 기능
- 🌐 **반응형 디자인**: 모바일/태블릿/데스크톱 지원

## 🚀 빠른 시작

### 웹사이트 접속

**배포된 사이트**: [https://wos-commander.vercel.app](https://wos-commander.vercel.app)

### 로컬 개발 환경 설정

```bash
# 1. 저장소 클론
git clone https://github.com/songkong72/WOS-Commander.git
cd WOS-Commander

# 2. 의존성 설치
npm install

# 3. 개발 서버 실행
npm start

# 4. 웹 브라우저에서 실행 (자동으로 열림)
# 또는 터미널에서 'w' 키 입력
```

## 🛠️ 기술 스택

### Frontend
- **React Native Web** - 크로스 플랫폼 UI
- **Expo Router** - 파일 기반 라우팅
- **NativeWind** - Tailwind CSS for React Native
- **TypeScript** - 타입 안전성

### Backend & Services
- **Firebase Firestore** - 실시간 데이터베이스
- **Firebase Authentication** - 사용자 인증 (예정)
- **Vercel** - 자동 배포 및 호스팅

### Development Tools
- **Metro Bundler** - React Native 번들러
- **Git** - 버전 관리
- **GitHub Actions** - CI/CD (예정)

## 📂 프로젝트 구조

```
WOS-Commander/
├── app/                          # 앱 화면 (Expo Router)
│   ├── index.tsx                 # 메인 홈 화면
│   ├── _layout.tsx               # 레이아웃 및 Context
│   ├── hero-management/          # 영웅 관리
│   │   ├── index.tsx             # 영웅 목록
│   │   └── [id].tsx              # 영웅 상세
│   └── growth/                   # 성장 도구
│       └── events.tsx            # 이벤트 스케줄
├── assets/                       # 이미지 및 아이콘
│   ├── icon.png                  # 앱 아이콘
│   ├── splash.png                # 스플래시 화면
│   └── images/                   # 게임 이미지
├── components/                   # 재사용 컴포넌트
├── data/                         # 정적 데이터
│   ├── heroes.json               # 영웅 데이터베이스
│   ├── event-guides.ts           # 이벤트 가이드
│   └── admin-config.ts           # 관리자 설정
├── hooks/                        # Custom Hooks
│   └── useFirestoreAttendees.ts  # Firestore 연동
├── firebaseConfig.ts             # Firebase 설정
├── vercel.json                   # Vercel 배포 설정
└── package.json                  # 프로젝트 메타데이터
```

## 🎨 디자인 시스템

### 컬러 팔레트
- **Primary (Ice Blue)**: `#38bdf8` - 브랜드 강조색
- **Background (Dark Navy)**: `#020617` - 메인 배경
- **Text (White/Slate)**: `#ffffff`, `#94a3b8` - 텍스트

### 테마
- **Ice Age Apocalypse** - 빙하기 생존 콘셉트
- **Glassmorphism UI** - 반투명 글래스 효과
- **Dark Mode** - 기본 다크 테마

## 🔧 주요 기능 상세

### 1. 영웅 관리
- 70개 이상의 영웅 데이터베이스
- 스탯, 스킬, 등급별 필터링
- 영웅별 상세 정보 및 이미지

### 2. 이벤트 스케줄
- 주간 이벤트 캘린더
- 카테고리별 필터 (개인/연맹/초보자)
- 이벤트별 공략 가이드

### 3. 참석자 관리 (연맹 이벤트)
- 실시간 참석 명단 등록
- 영웅 조합 (3슬롯) 입력
- Firebase 실시간 동기화
- 관리자 전용 편집 권한

### 4. 관리자 인증
- 로컬 스토리지 기반 로그인 상태 유지
- 등록된 영주 이름 기반 인증
- 관리자 전용 기능 접근 제어

## 🔐 Firebase 설정

프로젝트에서 Firebase를 사용하려면 `firebaseConfig.ts` 파일에 본인의 Firebase 프로젝트 정보를 입력해야 합니다.

```typescript
// firebaseConfig.ts
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### Firebase 설정 방법
1. [Firebase Console](https://console.firebase.google.com/) 접속
2. 새 프로젝트 생성
3. Firestore Database 활성화
4. 웹 앱 추가 후 설정 정보 복사
5. `firebaseConfig.ts`에 붙여넣기

## 📦 배포

### Vercel (자동 배포)
이 프로젝트는 GitHub와 Vercel이 연동되어 있어, `main` 브랜치에 Push하면 자동으로 배포됩니다.

```bash
git add .
git commit -m "Update features"
git push origin main
# Vercel이 자동으로 빌드 및 배포 시작
```

### 수동 배포
```bash
npm install -g vercel
vercel --prod
```

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 👥 제작자

**WOS Commander Alliance**
- GitHub: [@songkong72](https://github.com/songkong72)

## 🙏 감사의 말

- [Whiteout Survival Wiki](https://www.whiteoutsurvival.wiki/) - 게임 데이터 참조
- [Expo](https://expo.dev/) - 크로스 플랫폼 프레임워크
- [Firebase](https://firebase.google.com/) - 백엔드 서비스
- [Vercel](https://vercel.com/) - 호스팅 플랫폼

---

**© 2026 WOS COMMANDER ALLIANCE. ALL RIGHTS RESERVED.**

*이 프로젝트는 Whiteout Survival 게임의 팬 메이드 도구이며, 공식 게임과는 무관합니다.*
