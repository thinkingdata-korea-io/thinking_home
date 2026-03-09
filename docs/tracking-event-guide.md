# ThinkingData 이벤트 수집 가이드

> 대상 사이트: https://www.thinkingdata.kr/
> 작성일: 2026-03-10
> 목적: 교육용 - 어떤 데이터가, 언제, 어떻게 수집되는지에 대한 종합 가이드

---

## 목차

1. [전체 구조 개요](#1-전체-구조-개요)
2. [공통 이벤트 속성 (Super Properties)](#2-공통-이벤트-속성-super-properties)
3. [이벤트 목록 및 상세](#3-이벤트-목록-및-상세)
4. [유저 속성 (User Properties)](#4-유저-속성-user-properties)
5. [수집 타이밍 다이어그램](#5-수집-타이밍-다이어그램)
6. [GSC 서버 수집 이벤트](#6-gsc-서버-수집-이벤트)
7. [활용 방안](#7-활용-방안)

---

## 1. 전체 구조 개요

### 수집 아키텍처

```
사용자 브라우저
  │
  ├─ [페이지 로드] → SDK 초기화 → 공통 속성 설정 → te_pageview
  ├─ [클릭]        → te_element_click
  ├─ [스크롤]      → te_scroll_depth (25%, 50%, 75%, 90%, 100%)
  ├─ [폼 제출]     → te_form_submit / te_form_submit_error
  ├─ [페이지 종료] → te_page_exit / te_browser_exit / te_page_final_exit / te_page_visibility_exit
  ├─ [팝업]        → popup_shown / popup_action
  ├─ [다운로드]    → resource_download
  ├─ [섹션 스크롤] → section_scroll_depth
  └─ [세션 관리]   → te_session_start / te_session_engaged / te_session_end

서버 (GitHub Actions, 매일 새벽 3시)
  └─ Google Search Console API → search_performance_v2 / keyword_performance_v2 / page_performance_v2
```

### 진입점 및 초기화 순서

**파일:** `main.js:27-176`
**트리거:** `document.addEventListener('DOMContentLoaded', main)` (line 182) 또는 DOM 이미 로드 시 즉시 실행 (line 185)

```
1. registerGlobalUtils()                          ← main.js:41
2. initSDK(config.thinkingData)                   ← main.js:46  → Super Properties 설정
3. initSession(config.session)                    ← main.js:53  → te_session_start 발생
4. initClickTracking()       [if modules.click]   ← main.js:62
5. initExitTracking()        [if modules.exit]    ← main.js:71
6. initScrollTracking()      [if modules.scroll]  ← main.js:80
7. initFormTracking()        [if modules.form]    ← main.js:89
8. initPopupTracking()       [if modules.popup]   ← main.js:98
9. initResourceTracking()    [if modules.resource] ← main.js:107
10. initSectionScrollTracking() [if modules.sectionScroll] ← main.js:116
11. initUserAttributes()     [if modules.userAttributes]   ← main.js:127
12. initOperateSDK(config)   [if operate.enabled && window.TDApp] ← main.js:138
13. trackPageView()          [if SDK 초기화 성공]  ← main.js:156  → te_pageview 발생
14. window.dispatchEvent(new CustomEvent('tracking:ready')) ← main.js:166
```

---

## 2. 공통 이벤트 속성 (Super Properties)

> 모든 이벤트에 자동으로 포함되는 속성.

**설정 코드:** `core/thinking-data-init.js:162-237` — `createSuperProperties()` 함수
**적용 코드:** `window.te.setSuperProperties(superProperties)` — `core/thinking-data-init.js:372`

### 2.1 비즈니스 컨텍스트

| 속성명 | 타입 | 설명 | 값 결정 로직 (파일:라인) |
|--------|------|------|------------------------|
| `channel` | string | 트래픽 채널 | 고정값 `"webflow"` (`thinking-data-init.js:182`) |
| `platform` | string | 플랫폼 | 고정값 `"web"` (`thinking-data-init.js:183`) |
| `page_type` | string | 페이지 유형 | `getPageType()` — URL 경로 기반 (`thinking-data-init.js:264-274`) |
| `page_category` | string | 페이지 카테고리 | `getPageCategory()` — URL 경로 기반 (`thinking-data-init.js:277-285`) |
| `page_section` | string | 페이지 섹션 | `getPageSection()` — URL 경로 기반 (`thinking-data-init.js:288-298`) |
| `source` | string | 유입 소스 | `getTrafficSource()` — UTM > referrer 순서 (`thinking-data-init.js:301-320`) |

**page_type 결정 로직:**
```
pathname 포함 "/blog/"    → "blog"
pathname 포함 "/product/" → "product"
pathname 포함 "/contact"  → "contact"
pathname 포함 "/about"    → "about"
pathname === "/" 또는 ""   → "home"
기타                       → "other"
```

**source 결정 로직:**
```
1순위: URL의 utm_source 파라미터
2순위: referrer 호스트명 → google/naver/facebook → 해당 이름
3순위: referrer 있지만 매칭 안 됨 → "referral"
4순위: referrer 없음 → "direct"
```

### 2.2 세션 정보

| 속성명 | 타입 | 설명 | 값 소스 |
|--------|------|------|---------|
| `session_id` | string | 현재 세션 고유 ID | `localStorage.getItem('te_session_id')` (`thinking-data-init.js:165`) |
| `session_number` | number | 누적 세션 번호 | `localStorage.getItem('te_session_number')` (`thinking-data-init.js:166`) |

### 2.3 봇 감지

| 속성명 | 타입 | 설명 | 감지 로직 |
|--------|------|------|----------|
| `is_bot` | boolean | 봇 여부 | `detectBot()` — BOT_KEYWORDS 매칭 + `navigator.webdriver` 체크 (`thinking-data-init.js:57-68`) |

### 2.4 디바이스 정보

| 속성명 | 타입 | 설명 | 값 소스 (thinking-data-init.js:100-120) |
|--------|------|------|---------|
| `device_type` | string | 디바이스 유형 | UA로 mobile/tablet/desktop 판단 |
| `common_screen_resolution` | string | 화면 해상도 | `screen.width` x `screen.height` |
| `common_viewport_size` | string | 뷰포트 크기 | `window.innerWidth` x `window.innerHeight` |
| `common_timezone_offset` | number | 시간대 오프셋 (시간) | `new Date().getTimezoneOffset() / -60` |

### 2.5 페이지 정보

| 속성명 | 타입 | 값 소스 |
|--------|------|---------|
| `common_url` | string | `window.location.href` |
| `common_title` | string | `document.title` |
| `common_page_path` | string | `window.location.pathname` |
| `common_host` | string | `window.location.hostname` |
| `common_search_params` | string | `window.location.search` |

### 2.6 리퍼러 정보

| 속성명 | 타입 | 값 소스 |
|--------|------|---------|
| `common_referrer` | string | `document.referrer` |
| `common_referrer_host` | string | `new URL(document.referrer).hostname` |

### 2.7 브라우저 정보

| 속성명 | 타입 | 값 소스 |
|--------|------|---------|
| `common_language` | string | `navigator.language` |
| `common_user_agent` | string | `navigator.userAgent` |
| `common_browser` | string | `getBrowserInfo().name` — BROWSER_PATTERNS 매칭 (`thinking-data-init.js:71-97`) |
| `common_browser_version` | string | `getBrowserInfo().version` — 정규식 추출 |

### 2.8 UTM 파라미터 (유입 시에만)

**추출 코드:** `extractUTMParameters()` — `thinking-data-init.js:125-159`

| 속성명 | 타입 | 설명 |
|--------|------|------|
| `utm_source` | string | 캠페인 소스 |
| `utm_medium` | string | 매체 |
| `utm_campaign` | string | 캠페인명 |
| `utm_term` | string | 검색 키워드 |
| `utm_content` | string | 광고 콘텐츠 구분자 |
| `utm_id` | string | 캠페인 ID |
| `gclid` | string | Google Ads 클릭 ID |
| `fbclid` | string | Facebook 클릭 ID |
| `msclkid` | string | Microsoft Ads 클릭 ID |

**UTM 우선순위:**
```
1순위: localStorage.getItem('te_session_utm') — 세션 시작 시 저장된 UTM
2순위: 현재 URL의 query string — 새 캠페인 진입 시 덮어쓰기
```

---

## 3. 이벤트 목록 및 상세

---

### 3.1 `te_pageview` — 페이지뷰

**파일:** `tracking/pageview.js:14-49`

**트리거:**
```
main.js:156 → trackPageView() 직접 호출
조건: SDK 초기화 성공 시 (sdkInitialized === true)
시점: 모든 모듈 초기화 완료 후 마지막에 1회 실행
```

**SDK 호출:** `window.te.track('te_pageview', pageviewData)` — `pageview.js:33`
**폴백:** `window.ta.quick('autoTrack', pageviewData)` — `pageview.js:37` (하위 호환)

| 속성명 | 타입 | 값 소스 |
|--------|------|---------|
| `page_url` | string | `window.location.href` |
| `page_path` | string | `window.location.pathname` |
| `page_title` | string | `document.title` |
| `referrer` | string | `document.referrer` |
| + 봇 정보 | | `addBotInfoToEvent()` |
| + TE 시간 | | `addTETimeProperties()` |
| + Super Properties | | 자동 포함 |

---

### 3.2 `te_session_start` — 세션 시작

**파일:** `core/session-manager.js:212-272`

**트리거:**
```
session-manager.js:177 → startNewSession() 호출 시 자동 발생

startNewSession()이 호출되는 경우:
  1. 최초 방문 (저장된 세션 없음) → session-manager.js:177
  2. 세션 타임아웃 (30분 비활동) → checkSessionTimeout() → session-manager.js:362
     ↳ setInterval(checkSessionTimeout, 60000) — session-manager.js:181 (1분마다 체크)
  3. UTM 변경 감지 → checkUtmChange() → session-manager.js:819
  4. 사용자 ID 변경 → checkUserChange() → session-manager.js:834
```

**SDK 호출:** `safeTrackEvent('te_session_start', sessionStartDataWithTETime)` — `session-manager.js:259`

| 속성명 | 타입 | 값 소스 |
|--------|------|---------|
| `session_id` | string | `generateSessionId()` → `${Date.now()}-${crypto.getRandomValues(...).toString(36)}` |
| `session_number` | number | 이전 값 + 1, `localStorage('te_session_number')` |
| `is_engaged_session` | boolean | 초기값 `false` |
| `session_start_time` | number | `Date.now()` |
| `page_url` | string | `window.location.href` |
| `page_title` | string | `document.title` |
| `referrer` | string | `document.referrer` |
| `user_agent` | string | `navigator.userAgent` |
| `device_type` | string | `getDeviceType()` — utils.js에서 import |
| `browser_info` | object | `getBrowserInfo()` — utils.js에서 import |
| `is_bot` | boolean | `addBotInfoToEvent()`로 추가 |
| `bot_type` | string | 봇인 경우에만 포함 |

---

### 3.3 `te_session_engaged` — 인게이지 세션

**파일:** `core/session-manager.js:331-339`

**트리거:**
```
session-manager.js:307 → updateSessionActivity() 호출 시 내부 판정

판정 조건 (둘 중 하나 충족):
  - Date.now() - sessionStartTime >= 10000 (10초 경과)   ← session-manager.js:325
  - interactionCount >= 2 (2회 이상 상호작용)              ← session-manager.js:326

updateSessionActivity()는 다음에서 호출:
  - 클릭 발생 시: click.js:48 → updateSessionActivity()
  - 스크롤 발생 시: scroll.js:61 → updateSessionActivity()
  - 폼 제출 시: form.js:43 → updateSessionActivity()
  - 팝업 상호작용 시: popup.js:20, 27 → updateSessionActivity()
  - 리소스 다운로드 시: resource.js:145 → updateSessionActivity()

중복 방지: sessionEventsTracked.session_engaged = true (세션당 1회)
```

**SDK 호출:** `safeTrackEvent('te_session_engaged', {...})` — `session-manager.js:332`

| 속성명 | 타입 | 값 소스 |
|--------|------|---------|
| `session_id` | string | 현재 세션 ID |
| `session_number` | number | 현재 세션 번호 |
| `time_to_engage` | number | `Math.round((Date.now() - sessionStartTime) / 1000)` — 초 단위 |
| `interaction_count` | number | 현재까지의 상호작용 횟수 |

---

### 3.4 `te_session_end` — 세션 종료

**파일:** `core/session-manager.js:369-397`

**트리거:**
```
setupSessionEndTracking() — session-manager.js:435-454 에서 등록:

  1. window.addEventListener('beforeunload', ...) → endSession('page_exit')   ← line 437
  2. window.addEventListener('pagehide', ...)     → endSession('page_hide')   ← line 451
  3. setInterval(checkSessionTimeout, 60000)      → endSession('timeout')     ← line 181→361
  4. checkUtmChange()                              → endSession('utm_change')  ← line 818
  5. checkUserChange()                             → endSession('user_change') ← line 833

중복 방지: sessionEventsTracked.session_end = true (세션당 1회)
```

**SDK 호출:** `safeTrackEvent('te_session_end', {...})` — `session-manager.js:378`

| 속성명 | 타입 | 값 소스 |
|--------|------|---------|
| `session_id` | string | 현재 세션 ID |
| `session_number` | number | 현재 세션 번호 |
| `session_duration` | number | `Math.round((Date.now() - sessionStartTime) / 1000)` — 초 단위 |
| `is_engaged_session` | boolean | 인게이지 여부 |
| `interaction_count` | number | 총 상호작용 횟수 |
| `end_reason` | string | `"page_exit"`, `"page_hide"`, `"timeout"`, `"utm_change"`, `"user_change"` |

---

### 3.5 `te_element_click` — 요소 클릭

**파일:** `tracking/click.js:45-66`

**트리거:**
```
click.js:96 → document.addEventListener('click', handleClick)

handleClick 내부에서 클릭 대상 요소 탐색:
  click.js:46 → event.target.closest('a, button, [role="button"], .btn, .button, input[type="submit"], input[type="button"]')

  ※ closest()로 탐색하므로 해당 요소의 자식 요소를 클릭해도 감지됨
  ※ 매칭되는 요소가 없으면 이벤트 무시 (line 47: if (!element) return)
```

**SDK 호출:** `trackEvent('te_element_click', clickData)` — `click.js:65`

| 속성명 | 타입 | 값 소스 (click.js:28-43) |
|--------|------|---------|
| `element_id` | string | `element.id \|\| classList.join('_') \|\| tagName` |
| `element_text` | string | `element.textContent.trim()` |
| `element_class_list` | array | `element.className.split(' ').filter(Boolean)` |
| `element_html_id` | string | `element.id` |
| `element_tag_name` | string | `element.tagName.toLowerCase()` |
| `element_href` | string | `element.href` |
| `element_pattern` | string | `matchPattern(text)` — 아래 표 참조 |
| `page_url` | string | `window.location.href` |
| `page_title` | string | `document.title` |
| `click_coordinates` | object | `{x: event.clientX, y: event.clientY, pageX: event.pageX, pageY: event.pageY}` |
| `viewport_size` | object | `{width: window.innerWidth, height: window.innerHeight}` |

**element_pattern 분류 (click.js:11-17):**

| 패턴 | 매칭 키워드 (요소 textContent에 포함 시) |
|------|-----------|
| `cta` | `문의하기`, `상담신청`, `체험하기`, `시작하기`, `가입하기`, `무료체험` |
| `nav` | `홈`, `서비스`, `제품`, `가격`, `고객사례`, `회사소개`, `블로그` |
| `footer` | `개인정보처리방침`, `이용약관`, `고객센터`, `사업자정보` |
| `social` | `공유`, `페이스북`, `트위터`, `링크드인`, `카카오톡` |
| `download` | `다운로드`, `내려받기`, `PDF`, `자료받기` |
| `other` | 위 패턴에 매칭되지 않는 클릭 |

---

### 3.6 `te_scroll_depth` — 스크롤 깊이

**파일:** `tracking/scroll.js:54-95`

**트리거:**
```
scroll.js:58 → window.addEventListener('scroll', () => { ... })

디바운싱: clearTimeout(scrollTimeout); scrollTimeout = setTimeout(handler, 100)
  ※ 스크롤 멈춘 후 100ms 뒤에 실행 (line 59-60)

임계값: [0, 25, 50, 75, 90, 100] (line 10)
  ※ 각 임계값 도달 시 1회만 발생 (Set으로 중복 방지, line 11)
  ※ 계산: (scrollTop + windowHeight) / documentHeight * 100 (line 24-26)
```

**SDK 호출:** `window.te.track('te_scroll_depth', eventData)` — `scroll.js:82`
**추가 동작:** 100% 도달 시 `trackFullScroll()` 호출 → 유저 속성 `total_scroll_depth_100` +1 (line 86-88)

| 속성명 | 타입 | 값 소스 |
|--------|------|---------|
| `scroll_depth_percentage` | number | 도달한 임계값 (25, 50, 75, 90, 100) |
| `scroll_depth_pixels` | number | `window.pageYOffset \|\| document.documentElement.scrollTop` |
| `page_total_height_pixels` | number | `Math.max(body.scrollHeight, body.offsetHeight, ...)` |
| `page_name` | string | `document.title` |
| `page_url` | string | `window.location.href` |
| `scroll_direction` | string | 고정값 `"vertical"` |
| `max_scroll_depth` | number | 현재 세션 내 최대 스크롤 깊이 (%) |
| `scroll_speed` | number | `scrollDiff / timeDiff * 1000` — px/초 (line 51) |

---

### 3.7 `te_form_submit` — 폼 제출

**파일:** `tracking/form.js:41-166`

**트리거 (일반 폼):**
```
form.js:192 → document.addEventListener('submit', handleFormSubmit)

대상: 페이지 내 모든 <form> 태그의 submit 이벤트 (document 레벨 위임)
제외: data-no-track 속성이 있는 폼 (form.js:372-374)

※ SDK 로드 재시도: tryInit() — 2초 간격 최대 5회 (line 198-208)
```

**트리거 (SalesMap iframe 폼 — /data-voucher 페이지 전용):**
```
form.js:536-748 → initIframeFormTracking()
조건: window.location.href.includes('/data-voucher') (line 538)

3가지 감지 방식:
  1. postMessage 수신 (line 575-628)
     ↳ window.addEventListener('message', ...)
     ↳ origin 검증: 'https://salesmap.kr', 'https://www.salesmap.kr'
     ↳ 성공 키워드: 'submitted', 'success', 'complete', '감사', '완료'
     ↳ detection_method: "postmessage"

  2. iframe navigation 감지 (line 633-644)
     ↳ document.querySelector('iframe[src*="salesmap"]').addEventListener('load', ...)
     ↳ 2번째 load 이벤트 = 폼 제출 후 감사 페이지 전환
     ↳ detection_method: "iframe_navigation"

  3. DOM mutation 감지 (line 647-683)
     ↳ document.querySelector('a[href*="salesmap.kr"]') 주변 컨테이너
     ↳ MutationObserver → "감사합니다" + "완료" 텍스트 + 입력 필드 사라짐
     ↳ detection_method: "dom_mutation"

중복 방지: salesMapFormSubmitTracked = true (페이지당 1회)
```

**SDK 호출:** `trackEvent('te_form_submit', formSubmitDataWithTETime)` — `form.js:141`

| 속성명 | 타입 | 값 소스 |
|--------|------|---------|
| `form_id` | string | `form.id \|\| form.name \|\| 'unknown_form'` (line 94) |
| `form_name` | string | `getFormName(form)` — 아래 폼 식별 로직 참조 |
| `form_type` | string | `getFormType(form)` — 아래 폼 타입 로직 참조 |
| `form_url` | string | `window.location.href` |
| `form_page_title` | string | `document.title` |
| `form_fields_submitted_info` | object | 마스킹된 필드 정보 (아래 상세) |
| `privacy_agreement_checked` | boolean | 체크박스 셀렉터로 확인 (line 64-67) |
| `form_info` | object | `getThinkingDataFormInfo(form)` — 폼 메타데이터 |
| `form_validation_passed` | boolean | 고정값 `true` |
| `form_submission_time` | string | `new Date().toISOString()` TE 포맷 |
| `submission_status` | string | 고정값 `"pending"` |

**폼 이름 식별 로직 (`getFormName()` — form.js:405-437):**

| 우선순위 | 조건 | form_name |
|---------|------|-----------|
| 1 | URL 포함 `/form-demo` | `"데모 신청 폼"` |
| 2 | URL 포함 `/form-ask` | `"문의하기 폼"` |
| 3 | URL 포함 `/form-gameplus` | `"게임더하기 폼"` |
| 4 | URL 포함 `/data-voucher` | `"데이터바우처 도입 문의"` |
| 5 | `form.id` 또는 `form.name` 포함 `gameplus` | `"게임더하기 폼"` |
| 6 | `form.id` 또는 `form.name` 포함 `voucher` | `"데이터바우처 도입 문의"` |
| 7 | `form.id` 또는 `form.name` 포함 `newsletter`/`Newsletter` | `"뉴스레터 구독 폼"` |
| 8 | `form.title`, `data-form-name`, `data-name`, `form.id`, `form.name` | 해당 값 |
| 9 | 폼 내부 `<h1>`, `<h2>`, `<h3>` 텍스트 | 해당 텍스트 |
| 10 | URL 경로 마지막 세그먼트 | `"{segment} 폼"` |
| 11 | 위 모두 없음 | `"자동 감지 폼"` |

**폼 타입 식별 로직 (`getFormType()` — form.js:440-481):**

| 조건 | form_type |
|------|-----------|
| URL `/form-demo` 또는 `form.id` 포함 `demo` | `"demo_request"` |
| URL `/form-ask` 또는 `form.id` 포함 `contact`/`ask` | `"contact_inquiry"` |
| URL `/form-gameplus` 또는 `form.id`/`form.name` 포함 `gameplus` | `"gameplus"` |
| URL `/data-voucher` 또는 `form.id`/`form.name` 포함 `voucher` | `"data_voucher"` |
| `form.id`/`form.name` 포함 `newsletter`/`Newsletter` | `"newsletter"` |
| 기타: `form.id`/`form.name`/`data-name` | 해당 값 소문자+언더스코어 변환 |
| 모두 없음 | `"auto_detected"` |

**개인정보 체크박스 탐색 셀렉터 (line 64-66):**
```css
input[type="checkbox"][name*="privacy"],
input[type="checkbox"][name*="agreement"],
input[type="checkbox"][name*="동의"],
input[type="checkbox"][data-name*="동의"],
input[type="checkbox"][data-name*="개인정보"]
```

**form_fields_submitted_info 상세 (line 73-126):**

필드 값 탐색 우선순위 (Webflow `data-name` 속성 우선):

| 필드 | 탐색 순서 |
|------|----------|
| name | `data-name="이름"` → `data-name="Name"` → `data-name="name"` → `FormData.get('name')` → `FormData.get('이름')` → `FormData.get('gameplus_Name')` |
| email | `data-name="이메일"` → `data-name="회사 이메일"` → `data-name="Email"` → `data-name="email"` → `FormData.get('email')` → `FormData.get('이메일')` → `FormData.get('gameplus_email')` |
| phone | `data-name="연락처"` → `data-name="휴대폰 번호"` → `data-name="Phone"` → `data-name="phone"` → `FormData.get('phone')` → `FormData.get('연락처')` → `FormData.get('gameplus_phone')` |
| company | `data-name="회사명"` → `data-name="Company"` → `data-name="company"` → `FormData.get('company')` → `FormData.get('회사명')` → `FormData.get('gameplus_company')` |
| inquiry_source | `data-name="씽킹데이터를 어떻게 아셨나요?"` → `data-name="알게된경로"` → `FormData.get('source')` → `FormData.get('알게된경로')` |
| message_length | `data-name="문의사항"` → `data-name="Message"` → `FormData.get('message')` → `FormData.get('문의사항')` → `.length` |

**개인정보 마스킹:** `maskName()`, `maskEmail()`, `maskPhone()` — `core/utils.js`에서 import

---

### 3.8 `te_form_submit_error` — 폼 유효성 오류

**파일:** `tracking/form.js:168-189`

**트리거:**
```
form.js:193 → document.addEventListener('invalid', handleFormInvalid, true)

※ capture: true (세 번째 인수) — 이벤트 캡처 단계에서 감지
※ HTML5 required, type="email" 등의 브라우저 기본 유효성 검사 실패 시 발생
※ event.target = 유효성 검사 실패한 <input>/<textarea>/<select> 요소
※ event.target.closest('form')으로 부모 폼 탐색 (line 170)
```

**SDK 호출:** `trackEvent('te_form_submit_error', errorDataWithTETime)` — `form.js:186`

| 속성명 | 타입 | 값 소스 |
|--------|------|---------|
| `form_name` | string | `getFormName(form)` |
| `form_type` | string | `getFormType(form)` |
| `form_url` | string | `window.location.href` |
| `error_type` | string | 고정값 `"validation_error"` |
| `field_name` | string | `event.target.getAttribute('data-name') \|\| event.target.name \|\| event.target.id` |
| `field_type` | string | `event.target.type` |
| `error_message` | string | `event.target.validationMessage` (브라우저 기본 메시지) |
| `error_time` | string | `new Date().toISOString()` TE 포맷 |

---

### 3.9 `te_form_field_interaction` — 폼 필드 상호작용

**파일:** `tracking/form.js:229-335`

**트리거:**
```
form.js:347-367 → 모듈 최상위 레벨에서 등록 (import 시 즉시 실행)

  document.addEventListener('input', ...)     ← line 347 (INPUT, TEXTAREA 입력 시)
  document.addEventListener('focusin', ...)   ← line 355 (필드 포커스 진입)
  document.addEventListener('focusout', ...)  ← line 362 (필드 포커스 이탈)

필터링:
  - event.target.tagName이 'INPUT' 또는 'TEXTAREA'인 경우만
  - isThinkingDataForm(form) === true (data-no-track 속성 없는 폼)

디바운싱 (line 274-289):
  - input 이벤트: 의미 있는 변화 아니면 2초(fieldTrackingConfig.debounceDelay) 대기
  - focus/blur 이벤트: 즉시 전송
  - 의미 있는 변화 = 빈↔값 전환 또는 3글자(lengthThreshold) 단위 변경
```

**SDK 호출:** `trackEvent('te_form_field_interaction', fieldDataWithTETime)` — `form.js:328`

| 속성명 | 타입 | 값 소스 |
|--------|------|---------|
| `form_name` | string | `getFormName(form)` |
| `form_type` | string | `getFormType(form)` |
| `field_name` | string | `field.getAttribute('data-name') \|\| field.name \|\| field.id` |
| `field_type` | string | `field.type` |
| `field_value_length` | number | `field.value.length` |
| `field_has_value` | boolean | `!!field.value` |
| `interaction_count` | number | 해당 필드의 누적 상호작용 횟수 (Map으로 관리) |
| `trigger_type` | string | `"input"`, `"focus"`, `"blur"`, `"debounced"` |
| `field_value_preview` | string | 첫 10글자 + `"..."` (개인정보 필드 제외) |
| `length_category` | string | `0→"empty"`, `≤5→"short"`, `≤20→"medium"`, `≤50→"long"`, `>50→"very_long"` |

---

### 3.10 `te_form_view` — 폼 섹션 노출 (/data-voucher 전용)

**파일:** `tracking/form.js:696-724`

**트리거:**
```
IntersectionObserver — threshold: 0.3 (30% 이상 노출)
대상: document.querySelector('#data-voucher-form') (line 696)
조건: /data-voucher 페이지에서만 동작 (line 538)
1회만 발생 (formViewed = true)
```

---

### 3.11 `te_form_cta_click` — 폼 CTA 클릭 (/data-voucher 전용)

**파일:** `tracking/form.js:727-747`

**트리거:**
```
form.js:727-728 →
  document.querySelectorAll('a[href="#data-voucher-form"], a[href*="data-voucher-form"]')
  .forEach(link => link.addEventListener('click', ...))
```

---

### 3.12 페이지 종료 이벤트 4종

**파일:** `tracking/exit.js:48-58`

**트리거 및 이벤트명:**

| 이벤트명 | 리스너 등록 (exit.js) | 발생 조건 |
|----------|---------------------|----------|
| `te_page_exit` | `window.addEventListener('beforeunload', ...)` (line 53) | 페이지 떠나기 직전 |
| `te_browser_exit` | `window.addEventListener('unload', ...)` (line 54) | 브라우저/탭 닫힘 |
| `te_page_final_exit` | `window.addEventListener('pagehide', ...)` (line 55) | 페이지 숨겨짐 (모바일 안정적) |
| `te_page_visibility_exit` | `document.addEventListener('visibilitychange', ...)` (line 56) | `document.visibilityState === 'hidden'` |

**공통 속성 (exit.js:12-25):**

| 속성명 | 타입 | 값 소스 |
|--------|------|---------|
| `exit_type` | string | `"beforeunload"`, `"unload"`, `"pagehide"`, `"visibility_hidden"` |
| `page_url` | string | `window.location.href` |
| `page_title` | string | `document.title` |
| `user_agent` | string | `navigator.userAgent` |
| `timestamp` | number | `Date.now()` |
| `is_persisted` | boolean | `event.persisted` (pagehide만 해당) |

---

### 3.13 `popup_shown` — 팝업 노출

**파일:** `tracking/popup.js:19-24`

**트리거:**
```
1. 초기 스캔 (line 39-44):
   document.querySelectorAll('.modal, .popup, .modal-container, [role="dialog"]')
   → 이미 표시된 팝업 즉시 감지 (data-popup-tracked 없는 경우)

2. 동적 감지 (line 47-64):
   MutationObserver → document.body 감시 (childList: true, subtree: true)
   → 새로 추가된 노드가 아래 조건에 해당하면 감지:
     node.classList.contains('modal')
     node.classList.contains('popup')
     node.classList.contains('modal-container')
     node.getAttribute('role') === 'dialog'
```

**SDK 호출:** `window.te.track('popup_shown', getPopupInfo(node))` — `popup.js:22`

| 속성명 | 타입 | 값 소스 (popup.js:9-17) |
|--------|------|---------|
| `popup_id` | string | `node.id \|\| node.getAttribute('data-popup-id') \|\| 'unknown'` |
| `popup_class` | string | `node.className` |
| `popup_type` | string | `node.getAttribute('data-popup-type') \|\| 'modal'` |
| `page_url` | string | `window.location.href` |
| `page_title` | string | `document.title` |

---

### 3.14 `popup_action` — 팝업 액션 (클릭/닫기)

**파일:** `tracking/popup.js:26-35, 70-100`

**트리거:**
```
document.addEventListener('click', ...) — popup.js:71

혜택 확인 클릭 (line 74-78):
  target.textContent에 '혜택 확인하기' 포함
  → action_type: 'benefit_check_click'

닫기 버튼 클릭 (line 80-90):
  target.classList.contains('close')
  target.classList.contains('modal-close')
  target.getAttribute('aria-label') === 'Close'
  target.textContent === '+'
  target.closest('.popup-close')
  → action_type: 'popup_close', close_method: 'button_click'

ESC 키 닫기 (line 94-99):
  document.addEventListener('keydown', ...) — event.key === 'Escape'
  열린 팝업: document.querySelector('.modal[style*="display: block"], .popup[style*="display: block"], ...')
  → action_type: 'popup_close', close_method: 'escape_key'
```

| 속성명 | 타입 | 설명 |
|--------|------|------|
| popup_id, popup_class, popup_type, page_url, page_title | | popup_shown과 동일 |
| `action_type` | string | `"benefit_check_click"` 또는 `"popup_close"` |
| `button_text` | string | 클릭된 버튼 텍스트 (혜택 확인 시) |
| `close_method` | string | `"button_click"` 또는 `"escape_key"` (닫기 시) |

---

### 3.15 `resource_download` — 리소스 다운로드

**파일:** `tracking/resource.js:134-169`

**트리거:**
```
resource.js:135 → document.addEventListener('click', (event) => { ... })

대상 탐색: event.target.closest('a') (line 137)
조건: link.href의 확장자가 DOWNLOAD_EXTENSIONS에 포함 (line 143)
```

**감지 대상 확장자 (resource.js:10-18):**
```
문서:    .pdf, .doc, .docx, .txt
스프레드: .xls, .xlsx, .csv
프레젠:  .ppt, .pptx
압축:    .zip, .rar, .7z, .tar, .gz
미디어:  .mp3, .mp4, .avi, .mov, .wmv
이미지:  .jpg, .jpeg, .png, .gif, .bmp, .svg
데이터:  .json, .xml
소프트:  .exe, .msi, .dmg, .pkg, .apk, .ipa
```

**SDK 호출:** `window.te.track('resource_download', eventData)` — `resource.js:163`
**추가 동작:** `trackDownload()` → 유저 속성 `total_downloads` +1 (line 167)

| 속성명 | 타입 | 값 소스 |
|--------|------|---------|
| `page_name` | string | `document.title` |
| `page_url` | string | `window.location.href` |
| `download_url` | string | `link.href` |
| `download_filename` | string | `link.href.split('/').pop()` |
| `file_extension` | string | URL에서 추출한 확장자 |
| `resource_type` | string | `getResourceType(link)` — 확장자/텍스트/클래스/ID 기반 분류 |
| `file_size_bytes` | number | URL 쿼리 파라미터 `size` 또는 `filesize` |
| `download_success` | boolean | 고정값 `true` |
| `link_text` | string | `link.textContent.trim()` |
| `link_id` | string | `link.id` |
| `link_class_list` | array | `Array.from(link.classList)` |
| `click_coordinates` | object | `{x: event.pageX, y: event.pageY}` |

**resource_type 분류 (resource.js:20-99):**
| 타입 | 매칭 기준 |
|------|----------|
| `document` | .pdf, .doc, .docx, .txt / 텍스트 "문서", "pdf" |
| `spreadsheet` | .xls, .xlsx, .csv / 텍스트 "엑셀" |
| `presentation` | .ppt, .pptx / 텍스트 "파워포인트" |
| `archive` | .zip, .rar, .7z / 텍스트 "압축" |
| `image` | .jpg, .png, .gif, .svg / 텍스트 "이미지" |
| `software` | .exe, .dmg, .apk / 텍스트 "소프트웨어" |
| `api_documentation` | 텍스트 "API", "개발문서" |
| `user_guide` | 텍스트 "가이드", "온보딩" |
| `case_study` | 텍스트 "사례", "케이스" |
| `whitepaper` | 텍스트 "백서" |
| `demo_request` | 텍스트 "데모", "체험" |
| `contact_form` | 텍스트 "문의", "연락" |
| `general` | 위 모두 매칭 안 됨 |

---

### 3.16 `section_scroll_depth` — 섹션별 스크롤 깊이

**파일:** `tracking/section-scroll.js:16-72`

**트리거:**
```
section-scroll.js:65 → window.addEventListener('scroll', () => { ... })
디바운싱: 100ms (line 67)

대상 요소: document.querySelectorAll('section[id]') (line 20)
  ※ id 속성이 있는 <section> 태그만 대상

임계값: [0, 25, 50, 75, 100] (line 7)
  ※ 뷰포트에서 섹션이 해당 % 이상 노출될 때 발생
  ※ 각 임계값은 섹션당 1회만 발생 (Set으로 관리)

초기화 시점 (robustSectionScrollInit — line 75-102):
  1. DOMContentLoaded
  2. window load 이벤트
  3. 'thinkingdata:ready' 커스텀 이벤트
```

**SDK 호출:** `window.te.track('section_scroll_depth', eventData)` — `section-scroll.js:56`

| 속성명 | 타입 | 값 소스 |
|--------|------|---------|
| `section_id` | string | `section.id` |
| `section_index` | number | 섹션 순서 (1부터) |
| `section_class` | string | `section.className` |
| `scroll_depth_percentage` | number | 도달한 임계값 (0, 25, 50, 75, 100) |
| `section_height` | number | `section.offsetHeight` |
| `visible_height` | number | 뷰포트에서 보이는 높이 |
| `page_name` | string | `document.title` |
| `page_url` | string | `window.location.href` |

---

### 3.17 `te_date_change_in_session` — 세션 내 날짜 변경

**파일:** `core/session-manager.js:840-857`

**트리거:**
```
session-manager.js:344 → checkDateChange() 호출
  ↳ updateSessionActivity() 내부에서 매 상호작용마다 체크

조건: localStorage('te_session_date') !== 오늘 날짜 (YYYY-MM-DD)
```

**SDK 호출:** `safeTrackEvent('te_date_change_in_session', {...})` — `session-manager.js:846`

| 속성명 | 타입 | 값 소스 |
|--------|------|---------|
| `session_id` | string | 현재 세션 ID |
| `previous_date` | string | `localStorage('te_session_date')` |
| `current_date` | string | `new Date().toISOString().split('T')[0]` |
| `session_duration_so_far` | number | `Math.round((Date.now() - sessionStartTime) / 1000)` |

---

## 4. 유저 속성 (User Properties)

**파일:** `user-attributes.js` — `UserAttributeTracker` 클래스

**초기화 트리거:**
```
main.js:127 → initUserAttributes() 호출

initUserAttributes() (user-attributes.js:952-977):
  1. new UserAttributeTracker() → initializeUser() (line 81)
  2. document.addEventListener('DOMContentLoaded', () => { updatePageInterests(); startPageEngagement(); }) (line 959)
  3. window.addEventListener('beforeunload', () => { updateSessionTimeMetrics(); endPageEngagement(); }) (line 963)
  4. setInterval(() => { pathname 변경 감지 → updatePageInterests() }, 1000) (line 969-975)
```

### 4.1 최초 1회 설정 (userSetOnce)

> `window.te.userSetOnce()`로 전송. 값이 이미 존재하면 덮어쓰지 않음.

**설정 시점:** `initializeUser()` (line 175-242) + `recordFirstVisitSource()` (line 293-371)
**트리거:** 유저 속성 초기화 시 1회

| 속성명 | 타입 | 설명 | 값 소스 |
|--------|------|------|---------|
| `first_visit_timestamp` | string | 최초 방문 시간 | `new Date(Date.now()).toISOString()` TE 포맷 (line 204-205) |
| `first_channel` | string | 최초 유입 채널 | `determineChannel()` (line 374-419) |
| `first_source` | string | 최초 유입 소스 | `utm_source \|\| referrer hostname \|\| 'direct'` |
| `first_medium` | string | 최초 유입 매체 | `utm_medium` |
| `first_campaign` | string | 최초 유입 캠페인 | `utm_campaign` |
| `first_term` | string | 최초 검색 키워드 | `utm_term` |
| `first_content` | string | 최초 광고 콘텐츠 | `utm_content` |
| `first_gclid` | string | 최초 Google Ads ID | URL `gclid` 파라미터 |
| `first_referrer` | string | 최초 리퍼러 URL | `document.referrer` |
| `first_referrer_domain` | string | 최초 리퍼러 도메인 | `new URL(referrer).hostname` |
| `first_landing_page_url` | string | 최초 랜딩 페이지 | `window.location.href` |
| `first_organic_keyword` | string | 최초 자연 검색어 | `extractOrganicKeyword(referrer)` — `q`/`query`/`p`/`wd` 파라미터 추출 |

**first_channel 결정 로직 (`determineChannel()` — line 374-419):**
```
gclid 있음                                         → "Paid Search"
utm_medium = cpc/ppc/paidsearch                     → "Paid Search"
utm_medium = cpm/cpa/paid-social                    → "Paid Social"
referrer 호스트 = google/naver/daum/bing/yahoo      → "Organic Search"
utm_medium = social/social-network/social-media     → "Social"
referrer 호스트 = facebook/instagram/twitter/linkedin → "Social"
referrer 있음 & UTM 없음                            → "Referral"
referrer 없음 & UTM 없음                            → "Direct"
기타                                                 → utm_medium 또는 utm_source 또는 "Other"
```

### 4.2 누적 속성 (userAdd)

> `window.te.userAdd()`로 전송. 기존 값에 +N 누적.

| 속성명 | 타입 | 트리거 코드 | 설명 |
|--------|------|-----------|------|
| `total_sessions` | number | `user-attributes.js:212` → `sendImmediate('userAdd', { total_sessions: 1 })` | 세션 시작 시 +1 |
| `total_form_submissions` | number | `user-attributes.js:609` → `sendImmediate('userAdd', { total_form_submissions: 1 })` | 폼 제출 시 +1 (form.js:145 → trackFormSubmission()) |
| `total_downloads` | number | `user-attributes.js:618` → `sendImmediate('userAdd', { total_downloads: 1 })` | 다운로드 시 +1 (resource.js:167 → trackDownload()) |
| `total_scroll_depth_100` | number | `user-attributes.js:629` → `sendImmediate('userAdd', { total_scroll_depth_100: 1 })` | 100% 스크롤 시 +1 (scroll.js:87 → trackFullScroll()) |
| `total_time_spent` | number | `user-attributes.js:706` → `sendImmediate('userAdd', { total_time_spent: sessionDuration })` | 세션 종료(beforeunload) 시 체류 시간 누적 |
| `popup_interactions` | number | `user-attributes.js:639` → `queueUpdate('userAdd', { popup_interactions: 1 })` | 팝업 상호작용 시 +1 |
| `external_link_clicks` | number | `user-attributes.js:647` → `queueUpdate('userAdd', { external_link_clicks: 1 })` | 외부 링크 클릭 시 +1 |
| `session_count_today` | number | `user-attributes.js:224` → `sendImmediate('userAdd', { session_count_today: 1 })` | 같은 날 재방문 시 +1 (날짜 변경 시 리셋) |

### 4.3 동적 업데이트 속성 (userSet)

> `window.te.userSet()`로 전송. 최신 값으로 덮어쓰기.

| 속성명 | 타입 | 트리거 | 값 결정 |
|--------|------|--------|---------|
| `session_count_today` | number | 날짜 변경 시 리셋 (line 220) | `1`로 초기화 |
| `is_returning_visitor` | boolean | `total_sessions >= 2` (line 229) | `true` |
| `current_page_section` | string | `updatePageInterests()` (line 446-493) | `sectionMapping` 기반 (home, blog, user_case, ...) |
| `current_page_category` | string | 위와 동일 | `getPageCategory()` (landing, content, company, product, conversion) |
| `visited_conversion_page` | boolean | URL `/form-` 또는 `/data-voucher` 방문 시 (line 515) | `true` |
| `engagement_level` | string | 폼 제출/다운로드/스크롤 후 자동 계산 (line 739-788) | `"low"` (0-49), `"medium"` (50-199), `"high"` (200+) |
| `engagement_score` | number | 위와 동일 | 폼*50 + 다운*30 + 스크롤*15 + 팝업*10 + 링크*5 + 세션*10(max100) + 체류시간(max200) |
| `visitor_lifecycle_stage` | string | `updateLifecycleStage()` (line 830-853) | 아래 참조 |
| `interaction_frequency` | string | `updateInteractionFrequency()` (line 856-891) | 총 상호작용 / 세션 수 → low(<1), medium(1-3), high(3+) |
| `content_depth_preference` | string | 스크롤/체류 패턴 (line 791-827) | `"surface"` (30초+), `"medium"` (10초+), `"deep"` (100% 스크롤) |
| `most_visited_section` | string | `updateMostVisitedSection()` (line 593-605) | 방문 횟수 최다 섹션 |
| `viewed_pages` | array | 페이지 방문 시 (line 466-477) | 최근 방문 경로 최대 10개 |
| `preferred_visit_time` | string | `updateTimeAttributes()` (line 654-693) | hour: 6-11→morning, 12-17→afternoon, 18-21→evening, 22-5→night |
| `last_visit_day_of_week` | string | 위와 동일 | `new Date().toLocaleDateString('en', {weekday: 'long'}).toLowerCase()` |

**visitor_lifecycle_stage 결정 로직 (line 830-853):**
```
폼 제출 > 0 OR 회사소개 방문 >= 2 OR 고객사례 방문 >= 2  → "decision"
세션 >= 3 OR 다운로드 > 0 OR 회사소개/고객사례 방문 > 0   → "consideration"
기타                                                       → "awareness"
```

---

## 5. 수집 타이밍 다이어그램

### 사용자 여정별 이벤트 발생 순서

```
[사용자가 구글에서 "thinkingdata" 검색 후 클릭]
  │
  ▼ DOMContentLoaded (main.js:182)
  │
  ├── SDK 초기화 (main.js:46)
  │   └── Super Properties 설정 (thinking-data-init.js:372)
  │
  ├── te_session_start              ← session-manager.js:259 (startNewSession)
  │   └── userSetOnce(first_*)      ← user-attributes.js:354 (첫 방문자만)
  │   └── userAdd(total_sessions:1) ← user-attributes.js:212
  │
  ├── 이벤트 리스너 등록
  │   ├── click → document.addEventListener('click', handleClick)     ← click.js:96
  │   ├── exit  → window.addEventListener('beforeunload', ...)        ← exit.js:53
  │   ├── scroll → window.addEventListener('scroll', ...)             ← scroll.js:58
  │   ├── form  → document.addEventListener('submit', ...)            ← form.js:192
  │   ├── popup → MutationObserver on document.body                   ← popup.js:64
  │   └── resource → document.addEventListener('click', ...)          ← resource.js:135
  │
  └── te_pageview                   ← main.js:156 → pageview.js:33
  │
  ▼ 10초 경과 (또는 2회 상호작용)
  └── te_session_engaged            ← session-manager.js:332 (세션당 1회)
  │
  ▼ 스크롤
  ├── te_scroll_depth (25%)         ← scroll.js:82 (100ms 디바운싱 후)
  ├── section_scroll_depth          ← section-scroll.js:56 (section[id] 노출 시)
  ├── te_scroll_depth (50%)
  ├── te_scroll_depth (75%)
  ├── te_scroll_depth (90%)
  └── te_scroll_depth (100%)
      └── userAdd(total_scroll_depth_100:1) ← user-attributes.js:629
  │
  ▼ CTA 버튼 클릭
  └── te_element_click              ← click.js:65 (element_pattern: "cta")
  │
  ▼ 문의 폼 작성 (/form-ask 페이지)
  ├── te_form_field_interaction × N ← form.js:328 (input/focus/blur)
  │   ├── trigger_type: "focus" (필드 클릭 시 즉시)
  │   ├── trigger_type: "input" 또는 "debounced" (입력 시)
  │   └── trigger_type: "blur" (필드 이탈 시 즉시)
  │
  └── te_form_submit                ← form.js:141 (submit 이벤트)
      └── userAdd(total_form_submissions:1) ← user-attributes.js:609
      └── engagement_level 재계산    ← user-attributes.js:739
  │
  ▼ PDF 다운로드 링크 클릭
  └── resource_download             ← resource.js:163 (href 확장자 .pdf 매칭)
      └── userAdd(total_downloads:1) ← user-attributes.js:618
  │
  ▼ 페이지 떠남 (여러 이벤트 동시 발생)
  ├── te_page_exit                  ← exit.js:28 (beforeunload)
  ├── te_session_end                ← session-manager.js:378 (beforeunload)
  ├── te_page_final_exit            ← exit.js:36 (pagehide)
  └── userAdd(total_time_spent)     ← user-attributes.js:706 (beforeunload)
```

### 세션 상태 전환

```
[신규 방문] ──▶ startNewSession() ──▶ te_session_start
     │                                    │
     │ (30분 이내 활동)                    │ localStorage에 저장:
     │                                    │  te_session_id, te_session_number,
     │                                    │  te_session_start_time, te_session_utm
     │
     ├── 10초 이상 OR 2회 상호작용 ──▶ te_session_engaged (1회)
     │
     ├── 자정 넘김 (checkDateChange) ──▶ te_date_change_in_session
     │
     ├── UTM 변경 (checkUtmChange) ──▶ te_session_end → startNewSession()
     │
     ├── 30분 타임아웃 (setInterval 1분마다 체크) ──▶ te_session_end (timeout) → startNewSession()
     ├── beforeunload ──▶ te_session_end (page_exit)
     └── pagehide ──▶ te_session_end (page_hide)
```

---

## 6. GSC 서버 수집 이벤트

> GitHub Actions에서 매일 새벽 3시(KST) 자동 수집.
> **워크플로우:** `.github/workflows/integrated-sync.yml`
> **수집기:** `gsc-collector.js` → `google-search-console.js` → `core/search-console-tracker.js`
> **전송:** `core/thinking-data-node.js` — TE RESTful API로 직접 전송

### 6.1 `search_performance_v2` — 검색 성과 요약

| 속성명 | 타입 | 설명 |
|--------|------|------|
| `date` | string | 수집 날짜 |
| `total_clicks` | number | 총 클릭수 |
| `total_impressions` | number | 총 노출수 |
| `average_ctr` | number | 평균 CTR |
| `average_position` | number | 평균 순위 |

### 6.2 `keyword_performance_v2` — 키워드별 성과

| 속성명 | 타입 | 설명 |
|--------|------|------|
| `date` | string | 날짜 |
| `query` | string | 검색 키워드 |
| `clicks` | number | 클릭수 |
| `impressions` | number | 노출수 |
| `ctr` | number | CTR |
| `position` | number | 평균 순위 |

### 6.3 `page_performance_v2` — 페이지별 성과

| 속성명 | 타입 | 설명 |
|--------|------|------|
| `date` | string | 날짜 |
| `page` | string | 페이지 URL |
| `clicks` | number | 클릭수 |
| `impressions` | number | 노출수 |
| `ctr` | number | CTR |
| `position` | number | 평균 순위 |

---

## 7. 활용 방안

### 7.1 핵심 지표 대시보드

| 지표 | 이벤트/속성 | 분석 방법 |
|------|-----------|----------|
| **일일 방문자 수** | `te_pageview` | 일별 고유 사용자 수 집계 |
| **신규 vs 재방문** | `is_returning_visitor` | 유저 속성 기반 세그먼트 |
| **평균 세션 시간** | `te_session_end.session_duration` | 세션 종료 이벤트의 duration 평균 |
| **바운스율** | `te_session_end.is_engaged_session` | 인게이지되지 않은 세션 비율 |
| **페이지별 조회수** | `te_pageview.page_path` | 경로별 그룹핑 |
| **콘텐츠 소비 깊이** | `te_scroll_depth` | 스크롤 깊이별 분포 |

### 7.2 마케팅 분석

| 분석 항목 | 활용 데이터 |
|----------|-----------|
| **채널별 유입 분석** | `utm_source`, `utm_medium`, `first_channel` |
| **캠페인 ROI** | `utm_campaign` + `te_form_submit` 전환율 |
| **검색어 성과** | `keyword_performance_v2` (GSC) |
| **랜딩 페이지 효과** | `first_landing_page_url` + 전환 연결 |
| **광고 클릭 추적** | `gclid`, `fbclid`, `msclkid` |

### 7.3 전환 퍼널 분석

```
퍼널: 방문 → 콘텐츠 소비 → 전환 페이지 → 폼 제출

단계 1: te_pageview
단계 2: te_scroll_depth (scroll_depth_percentage >= 75)
단계 3: te_element_click (element_pattern = "cta")
단계 4: te_form_submit (form_type = "demo_request" 또는 "contact_inquiry")
```

**세그먼트 활용:**
- `visitor_lifecycle_stage` = `"decision"` → 전환 가능성 높은 사용자
- `engagement_level` = `"high"` → 적극적 사용자
- `content_depth_preference` = `"deep"` → 깊은 콘텐츠 소비자

### 7.4 콘텐츠 최적화

| 분석 항목 | 활용 데이터 |
|----------|-----------|
| **인기 콘텐츠** | `te_pageview.page_path` 상위 페이지 |
| **콘텐츠 완독률** | `te_scroll_depth` 100% 비율 |
| **이탈 지점** | 마지막 `te_scroll_depth.scroll_depth_percentage` |
| **섹션별 노출** | `section_scroll_depth.section_id` + `visible_height` |
| **CTA 효과** | `te_element_click` (element_pattern = "cta") 클릭률 |

### 7.5 폼 최적화

| 분석 항목 | 활용 데이터 |
|----------|-----------|
| **폼 완료율** | `te_form_submit` 수 / `te_form_field_interaction` 첫 발생 수 |
| **이탈 필드** | `te_form_field_interaction` 마지막 `field_name` (submit 없는 세션) |
| **에러 패턴** | `te_form_submit_error.field_name` + `error_message` |
| **폼별 전환율** | `te_form_submit.form_type`별 비교 |
| **필드별 입력 시간** | `te_form_field_interaction.trigger_type = "focus"` → `"blur"` 간격 |

### 7.6 사용자 세그먼테이션

| 세그먼트 | 조건 | 활용 |
|----------|------|------|
| **고관여 사용자** | `engagement_level` = `"high"` | 리타겟팅 대상 |
| **전환 임박** | `visitor_lifecycle_stage` = `"decision"` | CTA 강화 |
| **깊은 콘텐츠 소비자** | `content_depth_preference` = `"deep"` | 심화 콘텐츠 제공 |
| **신규 방문자** | `total_sessions` = 1 | 온보딩 콘텐츠 |
| **충성 방문자** | `total_sessions` >= 5 | 전환 유도 |
| **오전 활동형** | `preferred_visit_time` = `"morning"` | 시간대별 콘텐츠 노출 |

### 7.7 SEO 성과 모니터링 (GSC 데이터)

| 분석 항목 | 활용 데이터 |
|----------|-----------|
| **키워드 순위 추이** | `keyword_performance_v2.position` 시계열 |
| **클릭율(CTR) 개선** | `keyword_performance_v2.ctr` 모니터링 |
| **페이지별 검색 유입** | `page_performance_v2` + `te_pageview` 매칭 |
| **신규 키워드 발견** | `keyword_performance_v2.query` 일별 비교 |

---

## 부록: 이벤트-트리거-속성 빠른 참조표

| 이벤트명 | 트리거 코드 | 고유 속성 |
|----------|-----------|----------|
| `te_pageview` | `main.js:156 → trackPageView()` | page_url, page_path, page_title, referrer |
| `te_session_start` | `session-manager.js:259 → startNewSession()` 내부 | session_id, session_number, session_start_time, device_type, browser_info |
| `te_session_engaged` | `session-manager.js:332 → updateSessionActivity()` 내부 (10초/2회) | time_to_engage, interaction_count |
| `te_session_end` | `session-manager.js:378 → beforeunload/pagehide/timeout` | session_duration, end_reason, is_engaged_session |
| `te_element_click` | `click.js:96 → document.addEventListener('click')` → `.closest('a,button,[role="button"],.btn,.button,input[type="submit"],input[type="button"]')` | element_id, element_text, element_pattern, click_coordinates |
| `te_scroll_depth` | `scroll.js:58 → window.addEventListener('scroll')` → 100ms 디바운싱 → 임계값 체크 | scroll_depth_percentage, max_scroll_depth, scroll_speed |
| `te_form_submit` | `form.js:192 → document.addEventListener('submit')` | form_name, form_type, form_fields_submitted_info |
| `te_form_submit` (iframe) | `form.js:575 → postMessage` / `iframe[src*="salesmap"] load` / `MutationObserver` | form_source: "salesmap", detection_method |
| `te_form_submit_error` | `form.js:193 → document.addEventListener('invalid', ..., true)` | error_type, field_name, error_message |
| `te_form_field_interaction` | `form.js:347 → document.addEventListener('input')` / `focusin` / `focusout` | field_name, field_type, trigger_type, interaction_count |
| `te_form_view` | `form.js:696 → IntersectionObserver('#data-voucher-form', threshold:0.3)` | form_name, form_source |
| `te_form_cta_click` | `form.js:727 → a[href*="data-voucher-form"].addEventListener('click')` | cta_text, cta_action |
| `te_page_exit` | `exit.js:53 → window.addEventListener('beforeunload')` | exit_type: "beforeunload" |
| `te_browser_exit` | `exit.js:54 → window.addEventListener('unload')` | exit_type: "unload" |
| `te_page_final_exit` | `exit.js:55 → window.addEventListener('pagehide')` | exit_type: "pagehide", is_persisted |
| `te_page_visibility_exit` | `exit.js:56 → document.addEventListener('visibilitychange')` | exit_type: "visibility_hidden" |
| `popup_shown` | `popup.js:39 → querySelectorAll('.modal,.popup,.modal-container,[role="dialog"]')` + `MutationObserver` | popup_id, popup_class, popup_type |
| `popup_action` | `popup.js:71 → document.addEventListener('click')` / `keydown(Escape)` | action_type, close_method, button_text |
| `resource_download` | `resource.js:135 → document.addEventListener('click')` → `closest('a')` → 확장자 매칭 | download_url, file_extension, resource_type |
| `section_scroll_depth` | `section-scroll.js:65 → window.addEventListener('scroll')` → `querySelectorAll('section[id]')` 가시성 계산 | section_id, section_index, visible_height |
| `te_date_change_in_session` | `session-manager.js:844 → checkDateChange()` (매 상호작용 시 체크) | previous_date, current_date |
| `search_performance_v2` | GitHub Actions cron (매일 KST 03:00) → `gsc-collector.js` | total_clicks, total_impressions, average_ctr |
| `keyword_performance_v2` | 위와 동일 | query, clicks, impressions, ctr, position |
| `page_performance_v2` | 위와 동일 | page, clicks, impressions, ctr, position |
