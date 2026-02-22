## 📚 프로젝트 문서 지도 (Document Index)

프로젝트의 모든 지침과 계획은 기능에 따라 다음과 같이 분류되어 있습니다.

| 분류 | 파일 경로 | 주요 용도 |
| :--- | :--- | :--- |
| **운영 (Operational)** | [CLAUDE.md](./CLAUDE.md) | **(현재 파일)** 빌드/실행 명령어 및 기술적 핵심 지침 |
| **규정 (Compliance)** | [PROJECT_RULES.md](./PROJECT_RULES.md) | 코딩 스타일, 아키텍처 원칙 및 AI 행동 규칙 |
| **계획 (Strategic)** | [.agent/plans/](./.agent/plans/) | 리팩토링 계획 및 신규 시스템 설계 문서 |
| **스킬 (Behavioral)** | [.agent/skills/](./.agent/skills/) | AI 전용 특수 스킬(검증, 페르소나 등) 정의 |
| **가이드 (General)** | [README.md](./README.md) | 프로젝트 소개 및 사용자 메뉴얼 |

---

## 🛠 Skills & Automation

커스텀 검증 및 유지보수 스킬은 `.agent/skills/`에 정의되어 있습니다.

| Skill | Purpose |
|-------|---------|
| `verify-implementation` | 프로젝트의 모든 verify 스킬을 순차 실행하여 통합 검증 보고서 생성 |
| `verify-i18n` | 다국어(i18n) 규칙 준수 여부(하드코딩 등) 검증 |
| `manage-skills` | 세션 변경사항 분석, 스킬 생성/업데이트 및 문서 관리 |
| `moon` | AI 개발부장 '문' 페르소나 및 행동 수칙 정의 |

## 👤 User Preferences
- **Language**: 모든 답변은 항상 **한국어**로 작성합니다. (Always respond in Korean)
- **Persona**: `.agent/skills/moon/SKILL.md`의 '문 개발부장' 페르소나를 적극 활용합니다.

## Internationalization (i18n) Guidelines

이 프로젝트는 **다국어(한국어/영어)를 지원**합니다. 모든 소스 수정 시 반드시 다음 규칙을 준수하세요.

### 1. 하드코딩 금지
- ❌ **절대 금지**: 한글/영어 텍스트를 직접 작성
  ```typescript
  // ❌ 잘못된 예시
  <Text>곰 사냥 작전</Text>
  <Text>Bear Hunt</Text>
  ```
- ✅ **올바른 방법**: i18n 번역 키 사용
  ```typescript
  // ✅ 올바른 예시
  <Text>{t('events.alliance_bear_title')}</Text>
  ```

### 2. 번역 파일 필수 업데이트
- 새로운 UI 텍스트 추가 시 **반드시** 번역 파일 업데이트
- 위치: `services/i18n/locales/ko.json`, `services/i18n/locales/en.json`
- 양쪽 파일 모두 동일한 키로 추가

### 3. 동적 값 처리
- 팀 번호, 요새/성채 번호 등은 **코드에서 동적 추가**
  ```typescript
  // ✅ 올바른 예시
  const title = t('events.bear_hunt_title'); // "Bear Hunt"
  const fullTitle = teamNum ? `${title} (Team ${teamNum})` : title;
  ```
- 번역 키에 동적 값을 포함하지 않음 (예: `bear_hunt_team1_title` ❌)

### 4. 중복 방지 체크
- 동적 값을 추가하기 전 **이미 포함되어 있는지 확인**
  ```typescript
  // ✅ 중복 방지
  if (teamMatch && !displayTitle.includes(`Team ${teamMatch[1]}`)) {
      displayTitle = `${displayTitle} (Team ${teamMatch[1]})`;
  }
  ```

### 5. 날짜/시간 포맷
- 요일, 월 이름 등도 번역 키 사용
  ```typescript
  // ✅ 올바른 예시
  const dayMap = { '월': 'mon', '화': 'tue', ... };
  const translatedDay = t(`events.days.${dayMap[day]}`);
  ```

### 6. 수정 전 체크리스트
소스 코드 수정 시 항상 확인:
- [ ] 하드코딩된 한글/영어 텍스트가 없는가?
- [ ] 번역 키가 양쪽 언어 파일에 모두 존재하는가?
- [ ] 동적 값이 중복으로 추가되지 않는가?
- [ ] 양쪽 언어 모드에서 모두 정상 작동하는가?

## Token Optimization Rules

토큰 사용을 최소화하기 위한 필수 규칙:

### 1. 파일 읽기 최적화
- **큰 파일(1000줄 이상)**: 반드시 `offset`/`limit` 파라미터 사용
- **재읽기 방지**: 이미 읽은 파일은 다시 읽지 않음 (컨텍스트 참조)
- **부분 검색**: 전체 파일 대신 `Grep`으로 필요한 부분만 검색

### 2. 도구 사용 효율화
- **병렬 처리**: 독립적인 작업은 단일 메시지에서 동시 실행
- **Grep 우선**: 파일 내용 검색 시 `Read` 대신 `Grep` 사용
- **Glob 우선**: 파일 찾기 시 `Bash find` 대신 `Glob` 사용

### 3. 서브에이전트 사용 제한
- **단순 작업**: 직접 도구 사용 (Grep, Glob, Read)
- **복잡한 탐색**: 3회 이상 쿼리가 필요할 때만 Explore 에이전트 사용
- **중복 방지**: 서브에이전트에게 위임한 작업을 직접 다시 수행하지 않음

### 4. 응답 간결화
- **핵심만**: 불필요한 설명 생략
- **코드 중심**: 긴 설명 대신 코드 예시로 표현
- **이모지 최소화**: 특별 요청 시에만 사용

### 5. 컨텍스트 관리
- **메모리 활용**: 반복되는 패턴은 `MEMORY.md`에 기록
- **요약 선호**: 긴 결과는 요약해서 전달
- **불필요한 로그 제외**: 에러 메시지나 긴 출력은 핵심만 발췌

### 6. 토큰 사용량 모니터링
- **작업 완료 후 체크**: 매 작업 완료 시 토큰 사용량 및 예상 비용 보고
- **보고 형식**:
  ```
  📊 토큰 사용 통계
  - 세션 전체: X.Xk 토큰 (200K 중 XX%) | XXX원
  - 이번 작업: X.Xk 토큰 (전체 대비 XX%) | XXX원
  ```
- **작업별 세부 통계**: 여러 작업을 수행한 경우 각 작업별 토큰 사용량과 비율 표시
  ```
  📊 토큰 사용 통계
  - 세션 전체: 6.9k 토큰 (200K 중 34%) | 592원
  - 작업1 (영어 툴팁 수정): 1.3k 토큰 (18.8%) | 116원
  - 작업2 (이벤트 배치 로직): 1.5k 토큰 (21.7%) | 125원
  ```
- **비용 계산**: Input(70%) × $3 + Output(30%) × $15 per 1M tokens, 환율 1,300원 기준
- **참고**: 정확한 Input/Output 비율을 알 수 없어 대략적인 추정치임
- **목적**: 사용자가 작업별 토큰 효율성을 파악하고 세션 관리 가능
