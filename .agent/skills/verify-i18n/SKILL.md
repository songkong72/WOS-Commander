---
name: verify-i18n
description: 다국어(i18n) 규칙 준수 여부를 검증합니다. 하드코딩된 텍스트와 누락된 번역 키를 탐지합니다.
---

# 다국어(i18n) 준수 검증

## Purpose
1. 소스 코드 내 하드코딩된 한글/영어 텍스트 탐지
2. `ko.json`과 `en.json`의 키 동기화 상태 점검 (수동 확인 가이드)
3. i18n 함수(`t()`)의 올바른 사용 여부 점검

## When to Run
- UI 텍스트가 포함된 컴포넌트 수정 후
- 새로운 기능 구현 후 PR 전
- `CLAUDE.md`의 Internationalization Guidelines 준수 여부 확인 시

## Related Files
| File | Purpose |
|------|---------|
| `app/**/*.tsx` | UI 컴포넌트 및 화면 (검증 대상) |
| `components/**/*.tsx` | 재사용 컴포넌트 (검증 대상) |
| `services/i18n/locales/ko.json` | 한국어 번역 리소스 |
| `services/i18n/locales/en.json` | 영어 번역 리소스 |

## Workflow

### Step 1: 하드코딩된 한글 텍스트 탐지

**설명:** 주석이나 로그를 제외한 코드 영역에 한글 문자열이 직접 작성되었는지 확인합니다.

**명령어:**
```bash
# .tsx, .ts 파일에서 한글 패턴 검색 (주석 제외는 육안 확인 필요)
grep -rDn "[\u3131-\uD79D]" app components --include="*.tsx" --include="*.ts"
```

**Pass 기준:**
- 검색 결과가 없거나, 검색된 라인이 주석(`//`, `/*`) 또는 로그(`console.log`)인 경우.

**Fail 기준:**
- UI 렌더링 부분(`return`, `Text` 등)에 한글이 직접 포함된 경우.

**수정 방법:**
1. 해당 텍스트를 `ko.json`, `en.json`에 추가.
2. 코드에서 `t('key_name')` 형태로 변경.

### Step 2: 번역 함수 사용 패턴 점검

**설명:** `t()` 함수가 올바르게 사용되고 있는지, 혹은 잘못된 패턴(변수 혼용 등)이 없는지 확인합니다.

**명령어:**
```bash
# t() 함수 사용처 검색
grep -rDn "t\(" app components --include="*.tsx" --include="*.ts"
```

**Pass 기준:**
- `t('category.key')` 와 같이 문자열 리터럴로 키가 전달되는 경우.

**Fail 기준:**
- `t(someVariable)` 형태로 사용되어 키 추적이 어려운 경우 (예외적으로 허용될 수 있으나 주의 필요).

### Step 3: 번역 파일 키 동기화 (수동 점검)

**설명:** `ko.json`에 있는 키가 `en.json`에도 존재하는지 확인합니다. (현재 자동화 툴 부재로 수동 프로세스)

**명령어:**
```bash
# 파일 내용 확인
cat services/i18n/locales/ko.json
cat services/i18n/locales/en.json
```

**수정 방법:**
- 두 파일을 비교하여 누락된 키를 채워넣습니다.

## Output Format
```markdown
### verify-i18n 결과

| 파일 | 라인 | 이슈 유형 | 내용 |
|------|------|-----------|------|
| `app/index.tsx` | 42 | 하드코딩 | `<Text>안녕하세요</Text>` |
| `ko.json` | - | 키 누락 | `en.json`에 "welcome" 키 없음 |
```

## Exceptions
- `console.log("한글 메시지")` : 디버깅용 로그는 허용 (단, 프로덕션 배포 전 제거 권장)
- `// 주석` : 주석 내 한글은 허용
- `const TEMP_DATA = ["임시", "데이터"]` : 개발 중 임시 데이터는 일시적 허용
