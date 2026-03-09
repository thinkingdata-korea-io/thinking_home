# thinking-home 프로젝트 개선 방향서

> 작성일: 2026-03-09
> 대상: thinkingdata.kr 웹사이트 트래킹 코드 (thinking-home)

---

## 1. 현재 상태 요약

### 프로젝트 구성
| 구분 | 내용 |
|------|------|
| 언어 | JavaScript (ES Module) |
| 환경 | 브라우저 (웹 트래킹) + Node.js (GSC 데이터 수집) |
| SDK | ThinkingData Web SDK + TDStrategy (운영 SDK) |
| 배포 | GitHub Actions (GSC 자동 수집), 브라우저 코드는 수동 배포 |
| 테스트 | Vitest (utils.test.js 1개만 존재) |

### 아키텍처
```
main.js (진입점)
├── core/thinking-data-init.js   → SDK 초기화 + 공통 속성
├── core/session-manager.js      → 세션 관리
├── core/operate-sdk-init.js     → 운영 SDK
├── tracking/pageview.js         → 페이지뷰
├── tracking/click.js            → 클릭
├── tracking/scroll.js           → 스크롤 깊이
├── tracking/form.js             → 폼 제출
├── tracking/exit.js             → 이탈 의도
├── tracking/popup.js            → 팝업
├── tracking/resource.js         → 리소스 다운로드
├── tracking/section-scroll.js   → 섹션 가시성
└── user-attributes.js           → 유저 속성 관리
```

---

## 2. Critical 이슈 (즉시 수정 필요)

### 2.1 APP ID 하드코딩 (보안)

**위치:** `config.js:50`, `config-github-actions.js:14`

```javascript
// 현재 - APP ID가 코드에 평문 노출
appId: getEnvVar('TE_APP_ID', '79ed7051fc51493798b16328c0ebd0bc'),
```

**문제:** git 히스토리에 영구 기록. 프로젝트 보안 가이드라인 직접 위반.

**수정 방안:**
```javascript
// 기본값을 빈 문자열로 변경, 환경변수 필수화
appId: getEnvVar('TE_APP_ID', ''),
// validateConfig()에서 appId 빈 값 시 에러 던지기
```

---

### 2.2 form.js 이벤트 리스너가 모듈 최상위에서 즉시 등록 (버그)

**위치:** `tracking/form.js:347-367`

모듈이 import되는 순간 `input`, `focusin`, `focusout` 리스너가 등록됨. `config.modules.form = false`여도 동작.

**수정:** 세 개의 `addEventListener`를 `initFormTracking()` 함수 내부로 이동.

---

### 2.3 sendPendingEvents 성공 처리 로직 버그

**위치:** `core/utils.js:1062`

```javascript
// 현재 - 처음 N개 성공을 가정 (중간 실패 시 데이터 유실)
const remainingEvents = pendingEvents.slice(successCount);
```

**수정:** 성공/실패를 개별 인덱스로 추적 후 필터링.

---

## 3. Important 이슈

### 3.1 봇 감지 / 브라우저 패턴 중복 정의

| 파일 | 내용 |
|------|------|
| `core/utils.js:35-98` | `BOT_PATTERNS`, `BROWSER_PATTERNS` (상세 버전) |
| `core/thinking-data-init.js:7-19` | `BOT_KEYWORDS`, `BROWSER_PATTERNS` (간소 버전) |

두 파일의 패턴 목록이 독립적으로 관리되어 업데이트 시 불일치 발생 위험.

**수정:** `thinking-data-init.js`의 로컬 정의 삭제 → `utils.js`에서 import.

---

### 3.2 setInterval 미해제 (메모리 리크)

**위치:** `core/session-manager.js:181`

```javascript
setInterval(checkSessionTimeout, SESSION_CONFIG.TIMEOUT_CHECK_INTERVAL);
// intervalId를 저장하지 않아 cleanup 불가
```

---

### 3.3 config.js의 window 가드 부재

`config.js`가 `window` 존재 여부를 확인하지 않고 직접 참조. Node.js 환경에서 import 시 오류 발생 가능.

---

### 3.4 불변성 규칙 위반

**위치:** `core/operate-sdk-init.js:98-101`

```javascript
triggerHandlers.splice(index, 1); // 직접 뮤테이션
```

코딩 스타일 가이드의 "불변성 패턴 사용" 규칙 위반.

---

## 4. 개선 방향

### 4.1 테스트 커버리지 확대 (최우선)

현재 `tests/utils.test.js` 1개만 존재. 핵심 트래킹 로직에 대한 테스트가 전무.

**단계별 계획:**

| 단계 | 대상 | 목표 커버리지 |
|------|------|-------------|
| 1단계 | `core/session-manager.js` | 세션 생성/만료/인게이지 판정 |
| 2단계 | `core/thinking-data-init.js` | Super Properties 생성, UTM 처리 |
| 3단계 | `tracking/form.js` | 개인정보 마스킹, 폼 타입 감지 |
| 4단계 | `tracking/click.js` | 클릭 패턴 매칭, 요소 ID 생성 |
| 5단계 | `user-attributes.js` | 유저 속성 업데이트 로직 |

**추천 테스트 전략:**
- 브라우저 의존 코드는 `jsdom` 환경에서 테스트
- SDK 호출은 mock으로 검증
- 세션 타임아웃 등 시간 의존 테스트는 `vi.useFakeTimers()` 활용

---

### 4.2 TypeScript 마이그레이션

현재 순수 JS로 런타임 타입 검사 없음. 점진적 마이그레이션 권장.

**단계:**
1. `tsconfig.json` 추가 (`allowJs: true`, `checkJs: true`)
2. JSDoc 타입 주석 보강으로 점진적 타입 체크
3. 핵심 모듈(`session-manager`, `utils`)부터 `.ts` 전환
4. 인터페이스 정의 (`TrackingEvent`, `SessionData`, `UserAttributes` 등)

---

### 4.3 빌드 시스템 도입

현재 빌드 스크립트 없음. 브라우저에 직접 배포하는 방식.

**권장:**
- Vite 또는 Rollup으로 빌드 파이프라인 구성
- 번들링 + 트리쉐이킹 + 미니파이
- 소스맵 생성 (디버깅용)
- 환경별 빌드 (`development` / `production`)
- CDN 배포 자동화

---

### 4.4 이벤트 스키마 검증 (데이터 품질)

현재 이벤트 속성에 대한 런타임 검증이 없음. 잘못된 타입이나 누락된 필드가 그대로 전송될 수 있음.

**권장:**
```javascript
// zod 또는 간단한 검증 함수
const pageviewSchema = {
  page_url: { type: 'string', required: true },
  page_path: { type: 'string', required: true },
  page_title: { type: 'string', required: true },
};

function validateEvent(eventName, properties, schema) {
  // 필수 필드 검증, 타입 체크, 예상 외 필드 경고
}
```

**효과:**
- 데이터 품질 보장
- 디버깅 시간 단축
- 스키마 변경 시 즉시 감지

---

### 4.5 모듈 초기화 경계 강화

문제: 일부 모듈(`form.js`)이 import 시점에 사이드 이펙트 발생.

**원칙:**
- 모든 사이드 이펙트(이벤트 리스너, 타이머, DOM 조작)는 `init*()` 함수 내부에서만 실행
- 모듈 최상위에는 상수 정의와 함수 선언만 허용
- `main.js`의 `config.modules.*` 플래그로 확실하게 ON/OFF 가능하도록

---

### 4.6 디버그 모드 강화

현재 `LOG_LEVEL` 설정은 있으나, 이벤트 전송 모니터링이 부족.

**권장:**
- 브라우저 콘솔에서 `window.__TE_DEBUG = true` 활성화 시:
  - 모든 이벤트 전송 내역 콘솔 출력
  - Super Properties 현재 값 확인
  - 세션 상태 실시간 모니터링
- Chrome DevTools 패널 또는 오버레이 UI (개발 환경)

---

### 4.7 express 의존성 정리

`package.json`에 `express`가 의존성으로 포함되어 있으나 실제 사용처가 불명확. 사용하지 않는다면 제거하여 의존성 경량화.

---

### 4.8 이벤트 네이밍 일관성

현재 이벤트명에 `te_` prefix와 비prefix가 혼재:

| Prefix 있음 | Prefix 없음 |
|------------|------------|
| `te_pageview` | `search_performance_v2` |
| `te_element_click` | `keyword_performance_v2` |
| `te_scroll_depth` | `page_performance_v2` |
| `te_session_start` | `section_viewed` |
| `te_form_submit` | `ops_receive` |

**권장:** 모든 이벤트에 `te_` prefix 통일 또는 도메인별 네임스페이스 적용.

---

### 4.9 GSC 데이터 수집 안정성

**현재 상태:**
- GitHub Actions에서 매일 자동 수집
- 에러 시 로그만 남기고 종료

**개선:**
- Slack/이메일 알림 연동 (수집 실패 시)
- 데이터 중복 수집 방지 메커니즘 (idempotency)
- 수집 이력 대시보드 (성공/실패/건수 추적)

---

## 5. 우선순위 로드맵

### Phase 1: 긴급 수정 (1-2일)
- [ ] APP ID 하드코딩 제거
- [ ] form.js 이벤트 리스너 위치 수정
- [ ] sendPendingEvents 로직 버그 수정
- [ ] setInterval ID 저장 및 cleanup 추가

### Phase 2: 코드 품질 (1주)
- [ ] 중복 상수/함수 통합 (`utils.js`로 일원화)
- [ ] 불변성 패턴 위반 수정
- [ ] config.js window 가드 추가
- [ ] express 미사용 의존성 제거

### Phase 3: 안정성 강화 (2주)
- [ ] 핵심 모듈 테스트 코드 작성 (세션, 폼, 클릭)
- [ ] 이벤트 스키마 검증 도입
- [ ] 디버그 모드 강화
- [ ] 이벤트 네이밍 일관성 정리

### Phase 4: 장기 개선 (1개월)
- [ ] TypeScript 점진적 마이그레이션
- [ ] Vite 빌드 시스템 도입
- [ ] GSC 수집 알림/모니터링
- [ ] CDN 기반 자동 배포 파이프라인

---

## 6. 참고 사항

### 잘 되어있는 부분
- 모듈화된 아키텍처 (core/tracking 분리)
- 개인정보 마스킹 처리 (이메일, 전화번호, 이름)
- 봇 감지 및 필터링 (100+ 패턴)
- 모듈별 독립적 에러 처리 (한 모듈 실패 → 나머지 정상 동작)
- 캐싱 전략 (봇 감지 1분, 브라우저 정보 5분)
- UTM 세션 일관성 유지
- GitHub Actions 자동화 (GSC 일일 수집)
