---
title: WOS Commander 권한 시스템 기획서
description: WOS Commander의 4단계 권한 계층 구조, 가입 프로세스, 화면 설계를 정의한 기획 문서입니다.
---

# 🛡️ WOS Commander 권한 시스템 총괄 기획서

## ✅ Current Progress (2026-02-05)
*   **Phase 1: 기초 공사 (DB & Auth Core)** -> **[완료 & 검증됨]**
    *   Auth Hook: `app/hooks/useAdminAuth.tsx` (구현 완료)
    *   Test Page: `app/test-auth.tsx` (로그인/시딩 테스트 완료)
    *   DB Schema: Firestore `users` 컬렉션 생성 및 Super Admin 계정(`admin`) 시딩 완료.
*   **Phase 2**: UI 적용 (Gate, Register) -> **[다음 작업]**
*   **Phase 3**: 관리자 대시보드 -> [예정]

---

## 1. 권한 계층 구조 (Role Hierarchy)

| 등급 (Role) | 명칭 | ID (DB Value) | 역할 및 권한 범위 | 생성 주체 |
| :--- | :--- | :--- | :--- | :--- |
| **Lv. 1** | **Super Admin** (전서버 관리자) | `super_admin` | 시스템 전체 총괄. 연맹 생성 승인 및 연맹 관리자 권한 부여. | 시스템 (최초 1인) |
| **Lv. 2** | **Alliance Admin** (연맹 관리자) | `alliance_admin` | 해당 연맹의 데이터(이벤트, 전략, 공지) 총괄. 하위 운영진 임명. | 본인 신청 → Super Admin 승인 |
| **Lv. 3** | **Operator** (운영자) | `operator` | 연맹원 가입 승인/관리, 일정 등록 등 실무 담당. | Alliance Admin이 생성 |
| **Lv. 4** | **User** (영주) | `user` | 컨텐츠 열람 및 개인 일정(참석) 관리. | 본인 신청 → Operator 승인 |

---

## 2. 권한 획득 프로세스 (Process Flow)

### A. 연맹 개설 및 관리자 권한 신청 (Alliance Admin)
> **핵심 전략**: [선생성 후승인] 방식 적용

1.  **[신청]**: 앱 초기 화면(Gate) 최하단 `[연맹 등록 및 관리자 신청]` 링크 클릭.
2.  **[입력]**:
    *   서버(#000) / 연맹ID / 연맹이름 / 대표자 연락처(이메일/디스코드).
    *   **사용할 ID / PW 직접 입력**.
    *   증빙 자료(스크린샷) 업로드.
3.  **[대기]**: DB에 `status: pending`으로 저장됨.
4.  **[알림]**: Super Admin에게 "새로운 신청 도착" 알림 (Discord Webhook 권장).
5.  **[승인]**: Super Admin이 대시보드에서 **[승인]** 클릭 → `status: active` 변경.
6.  **[완료]**: 신청자는 자신이 정한 ID/PW로 즉시 로그인 및 관리 시작.

### B. 일반 연맹원 가입 (User)
> **핵심 전략**: [승인 대기열] 시스템 적용

1.  **[가입]**: 앱 Gate 화면에서 `[회원가입]` 클릭 → ID/PW/닉네임/소속연맹 입력.
2.  **[대기]**: 로그인 시도 시 *"관리자 승인 대기 중"* 메시지 출력 (접속 불가).
3.  **[확인]**: 연맹 운영진(Admin/Operator) 앱에 **[가입 요청 배지]** 표시.
4.  **[승인]**: 운영진이 `[멤버 관리]` → `[승인 대기열]`에서 닉네임 확인 후 **[수락]**.
5.  **[접속]**: 유저는 승인 즉시 정상 로그인 가능.

---

## 3. 화면 UI 매뉴얼 (Screen Scenario)

개발해야 할 주요 화면과 기능 명세입니다.

### **#01. Gate Screen (초기 진입)**
*   **Main Area**: 서버/연맹 입력 후 [입장하기] (Guest/User 공통).
*   **Bottom Area**: *Secret Link* - "아직 등록되지 않은 연맹인가요? [연맹 등록 신청]"
*   **Login Modal**:
    *   **Old**: 단일 비밀번호 입력창.
    *   **New**: `ID` / `Password` 입력창 + `[회원가입]` 버튼 추가.

### **#02. 연맹 등록 신청 폼 (Modal)**
*   **입력 필드**:
    *   서버 번호 (필수)
    *   연맹 ID / 이름 (필수)
    *   **관리자 ID / PW (필수, 중복체크)**
    *   대표자 연락처 (이메일 등)
    *   증빙 이미지 첨부
*   **Action**: [신청하기] → DB 저장 및 닫기 → "승인 후 이용 가능합니다" Toast 메시지.

### **#03. Super Admin Dashboard (신규 화면)**
*   **Tab 1 [연맹 현황]**: 전체 등록된 연맹 리스트 조회.
*   **Tab 2 [승인 대기]**: `pending` 상태인 연맹 신청 목록.
    *   **List Item**: 연맹명 | 신청자연락처 | 신청일시
    *   **Detail**: 증빙사진 확인 → **[승인]** / **[거절]** 버튼.

### **#04. 관리자 페이지 (기존 Admin Page 개선)**
*   **Tab [멤버 관리]** 개선:
    *   상단에 **[가입 요청 🔔]** 섹션 추가.
    *   대기 중인 유저(닉네임, 신청시간) 카드 리스트 표시.
    *   각 카드에 **[수락(V)]**, **[거절(X)]** 버튼 배치.
*   **Tab [운영진 관리]** (Alliance Admin 전용):
    *   하위 `Operator` 계정 리스트.
    *   **[+ 운영진 추가]** 버튼 → ID/PW 생성 팝업.

---

## 4. DB Data Model (Firestore)

### `users` Collection (통합 계정 관리)
```json
{
  "uid": "auto_generated",
  "username": "user_input_id",
  "password": "hashed_string",
  "nickname": "ingame_name",
  "role": "super_admin" | "alliance_admin" | "operator" | "user",
  "status": "active" | "pending" | "rejected",
  "serverId": "#100",
  "allianceId": "KOR",
  "contact": "discord_id", // For Admins
  "createdAt": timestamp
}
```

### `servers` > `alliances` > `settings` (연맹 설정)
*   **notice**: 공지사항 데이터.
*   **eventSchedules**: 일정 데이터.
*   **strategySheet**: 전략 문서 데이터.

---

## 5. Next Action Items

1.  [DB] `users` 컬렉션 생성 및 기본 Super Admin 계정 시딩(Seeding).
2.  [Auth] `useAuth` 훅 리팩토링 (기존 비밀번호 방식 → ID/PW & DB 기반 인증).
3.  [UI] Gate 화면 하단 '연맹 신청' 링크 및 모달 구현.
4.  [UI] 회원가입 폼 및 '승인 대기' 로직 구현.
