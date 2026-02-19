# 운영 모듈 SDK 통합 현황 & 팝업 적용 가이드

> 현재 프로젝트에 ThinkingData 운영 SDK(TDStrategy)가 어떻게 붙어있는지,
> 팝업을 어떻게 적용해야 하는지 한 곳에서 파악하기 위한 문서

---

## 1. 아키텍처 전체 그림

```
HTML 페이지
  │
  ├── <script> SDK 스크립트 4종 로드 (외부 CDN)
  │     ├── thinkingdata.umd.min.js  (TDAnalytics - 데이터 수집)
  │     ├── tdcore.umd.min.js        (TDCore - 통합 초기화)
  │     ├── tdremoteconfig.umd.min.js (TDRemoteConfig - 원격 설정)
  │     └── tdstrategy.umd.min.js    (TDStrategy - 클라이언트 트리거)
  │
  └── <script type="module"> main.js 로드
        │
        ├── config.js                    ← 중앙 설정
        ├── core/thinking-data-init.js   ← TDAnalytics 초기화
        ├── core/operate-sdk-init.js     ← TDApp.init() 운영 SDK 초기화
        ├── core/session-manager.js      ← 세션 관리
        ├── tracking/operate-popup.js    ← 팝업 렌더링 & 이벤트
        └── tracking/*.js               ← 기타 추적 모듈들
```

### 초기화 순서 (main.js 기준)

```
1. config.js 로드 → window.trackingConfig에 전역 노출
2. initSDK()          → TDAnalytics 초기화 (기존 트래킹용)
3. initSession()      → 세션 관리자
4. 각 tracking 모듈   → click, scroll, form, exit 등
5. initOperateSDK()   → TDApp.init() (운영 SDK - TDApp이 있을 때만)
6. initOperatePopup() → 팝업 모듈 (운영 SDK 성공 시)
7. trackPageView()    → 페이지뷰 이벤트
```

**핵심 포인트:** 운영 SDK는 기존 트래킹과 **독립적**으로 동작합니다. 운영 SDK가 실패해도 나머지 트래킹은 정상 작동합니다.

---

## 2. 파일별 역할 & 현재 적용 상태

### 2-1. config.js - 중앙 설정

| 설정 경로 | 현재 값 | 설명 |
|-----------|---------|------|
| `operate.enabled` | `true` | 운영 SDK 활성화 |
| `operate.mode` | `'none'` | 운영 모드 (`'debug'`로 바꾸면 테스트 가능) |
| `operate.clientParams` | `{}` | 작업 조건용 초기 파라미터 (비어있음) |
| `operate.popup.enabled` | `true` | 팝업 모듈 활성화 |
| `operate.popup.autoRegister` | `true` | 트리거 핸들러 자동 등록 |
| `operate.popup.showAllTriggers` | `false` | popupType 지정된 작업만 팝업 표시 |
| `operate.popup.defaultType` | `'modal'` | 기본 팝업 타입 |
| `modules.operatePopup` | `true` | 운영 팝업 모듈 on/off |

### 2-2. core/operate-sdk-init.js - 운영 SDK 초기화

**하는 일:**
- `window.TDApp.init()` 호출 (SDK 통합 초기화)
- `triggerListener` 등록 (TE 콘솔 작업 수신 콜백)
- `ops_receive` 이벤트 자동 전송 (작업 도달 퍼널)
- 트리거 핸들러 관리 (등록/제거)
- 클라이언트 파라미터 설정

**전역 API:** `window.TEOperate`

| 메서드 | 용도 |
|--------|------|
| `init(config)` | SDK 초기화 |
| `isInitialized()` | 초기화 여부 확인 |
| `addTriggerHandler(fn)` | 트리거 핸들러 등록 |
| `removeTriggerHandler(fn)` | 트리거 핸들러 제거 |
| `setClientParams(params)` | 클라이언트 파라미터 설정 |
| `fetchRemoteConfig()` | 원격 설정 수동 가져오기 |
| `trackOpsClick(opsProperties)` | 클릭 퍼널 이벤트 수동 전송 |
| `initPopup(config)` | 팝업 모듈 초기화 |

### 2-3. tracking/operate-popup.js - 팝업 렌더링

**하는 일:**
- 4가지 팝업 타입 렌더링 (modal, banner, toast, slide)
- 자동 이벤트 전송 (ops_show, ops_click, ops_close)
- CSS 스타일 자동 삽입
- 닫기 방법 추적 (button, overlay, ESC, auto_close)

**전역 API:** `window.TEPopup`

| 메서드 | 용도 |
|--------|------|
| `init(options)` | 팝업 모듈 초기화 |
| `show(triggerResult, options)` | 팝업 표시 |
| `close(popupId, method)` | 특정 팝업 닫기 |
| `closeAll()` | 모든 팝업 닫기 |
| `getActivePopups()` | 현재 열린 팝업 ID 목록 |
| `TYPES` | 팝업 타입 상수 (MODAL, BANNER, TOAST, SLIDE) |

---

## 3. 데이터 흐름 (작업 수신 ~ 팝업 표시)

```
TE 콘솔에서 작업 활성화
        │
        ▼
사용자가 웹사이트 방문
        │
        ▼
TDApp.init()의 triggerListener 콜백 호출
        │
        ▼
defaultTriggerListener(result) 실행
  ├── ops_receive 이벤트 자동 전송
  ├── te:trigger 커스텀 이벤트 발생
  └── 등록된 핸들러들에게 result 전달
        │
        ▼
operate-popup.js 핸들러
  ├── popupType 확인 (content 또는 userParams)
  ├── 팝업 타입에 따른 DOM 생성
  ├── ops_show 이벤트 전송
  └── 이벤트 리스너 등록
        │
        ├── 닫기 버튼 → ops_close (close_method: 'button_click')
        ├── 오버레이 클릭 → ops_close (close_method: 'overlay_click')
        ├── ESC 키 → ops_close (close_method: 'escape_key')
        ├── 자동 닫기 (toast) → ops_close (close_method: 'auto_close')
        └── CTA 버튼 클릭 → ops_click (button_action: 'primary'|'secondary')
```

### triggerResult 객체 구조

```javascript
{
  channelMsgType: "popup",          // 채널 메시지 타입
  appId: "79ed7051...",             // 프로젝트 app id
  pushId: "push_12345",            // 채널 발송 ID
  taskId: "task_67890",            // 작업 ID
  content: {                        // 작업 콘텐츠 (TE 콘솔에서 설정한 값)
    popupType: "modal",
    title: "...",
    body: "...",
    image: "...",
    primaryButton: "...",
    primaryButtonUrl: "...",
    secondaryButton: "...",
    secondaryButtonUrl: "...",
    style: { ... },                 // 디자인 커스텀 (객체 그룹 1)
    styleText: { ... }              // 디자인 커스텀 (객체 그룹 2)
  },
  userParams: { ... },              // 커스텀 클라이언트 파라미터
  opsProperties: {                  // 퍼널 이벤트 회신용 파라미터 (자동 생성)
    // ops_receive, ops_show, ops_click, ops_close에 포함됨
  }
}
```

---

## 4. 팝업 적용 방법

### 방법 A: 기존 통합 모듈 사용 (현재 적용된 방식)

현재 프로젝트에서는 `main.js`가 모든 것을 자동으로 처리합니다.

**조건:** HTML에 SDK 4종 스크립트 + `main.js`가 로드되어 있으면 됩니다.

```html
<head>
  <!-- SDK 스크립트 4종 -->
  <script src="thinkingdata/web_td_strategy/thinkingdata.umd.min.js"></script>
  <script src="thinkingdata/web_td_strategy/tdcore.umd.min.js"></script>
  <script src="thinkingdata/web_td_strategy/tdremoteconfig.umd.min.js"></script>
  <script src="thinkingdata/web_td_strategy/tdstrategy.umd.min.js"></script>
</head>
<body>
  <!-- main.js가 자동으로 SDK 초기화 + 팝업 모듈 연결 -->
  <script type="module" src="main.js"></script>
</body>
```

**이 경우 자동으로:**
1. `config.js`의 설정 읽기
2. `TDApp.init()` 호출
3. `triggerListener`에 `defaultTriggerListener` 등록
4. 팝업 모듈 초기화 & 핸들러 등록
5. TE 콘솔 작업 수신 시 자동 팝업 표시

### 방법 B: 독립 사용 (main.js 없이)

특정 페이지에서만 팝업을 쓰거나, 기존 트래킹 없이 팝업만 필요한 경우:

```html
<script src="thinkingdata/web_td_strategy/thinkingdata.umd.min.js"></script>
<script src="thinkingdata/web_td_strategy/tdcore.umd.min.js"></script>
<script src="thinkingdata/web_td_strategy/tdremoteconfig.umd.min.js"></script>
<script src="thinkingdata/web_td_strategy/tdstrategy.umd.min.js"></script>
<script src="tracking/operate-popup.js"></script>

<script>
  // SDK 초기화
  window.TDApp.init({
    appId: 'YOUR_APP_ID',
    serverUrl: 'YOUR_SERVER_URL',
    mode: 'none',
    autoTrack: { pageShow: true, pageHide: true },
    triggerListener: function(result) {
      // 팝업 모듈에 전달
      if (window.TEPopup) {
        window.TEPopup.show(result);
      }
    }
  });
</script>
```

### 방법 C: 수동 팝업 호출 (SDK 작업 없이)

```javascript
window.TEPopup.show({
  taskId: 'manual-promo-001',
  content: {
    popupType: 'modal',
    image: 'https://example.com/banner.jpg',
    title: '특별 혜택',
    body: '지금 가입하면 20% 할인!',
    primaryButton: '가입하기',
    primaryButtonUrl: '/signup',
    secondaryButton: '나중에',
    style: {
      primaryColor: '#FF6B35',
      borderRadius: '16px'
    }
  }
});
```

---

## 5. TE 콘솔 작업 설정 시 팝업 콘텐츠 구조

### 기본 콘텐츠 필드

| 필드 | 설명 | 비고 |
|------|------|------|
| `popupType` | `modal` / `banner` / `toast` / `slide` | 미설정 시 modal |
| `image` | 이미지 URL | 선택 |
| `title` | 제목 | 선택 |
| `body` | 본문 | 선택 |
| `primaryButton` | 메인 버튼 텍스트 | 선택 |
| `primaryButtonUrl` | 메인 버튼 클릭 URL | 선택 (없으면 팝업 닫힘) |
| `secondaryButton` | 보조 버튼 텍스트 | 선택 |
| `secondaryButtonUrl` | 보조 버튼 클릭 URL | 선택 |
| `position` | banner 위치 (`top` / `bottom`) | banner 전용 |

### 디자인 커스텀 (style 객체 그룹)

TE 콘솔은 객체 그룹 10개 필드 제한이 있어 `style` + `styleText` 두 그룹으로 분리됩니다.

**style (최대 10개):**

| 필드 | 기본값 | 설명 |
|------|--------|------|
| `maxWidth` | `480px` | 팝업 최대 너비 |
| `backgroundColor` | `#ffffff` | 배경색 |
| `primaryColor` | `#4F46E5` | 메인 버튼 색 |
| `primaryHoverColor` | `#4338CA` | 메인 버튼 호버 색 |
| `secondaryColor` | `#E5E7EB` | 보조 버튼 색 |
| `secondaryHoverColor` | `#D1D5DB` | 보조 버튼 호버 색 |
| `borderRadius` | `12px` | 모서리 둥글기 |
| `titleColor` | `#333333` | 제목 색 |
| `titleFontSize` | `18px` | 제목 크기 |
| `bodyColor` | `#666666` | 본문 색 |

**styleText (나머지):**

| 필드 | 기본값 | 설명 |
|------|--------|------|
| `bodyFontSize` | `14px` | 본문 크기 |
| `imageWidth` | `100%` | 이미지 너비 |
| `imageHeight` | `auto` | 이미지 높이 |
| `imageFit` | `cover` | 이미지 맞춤 (`cover`/`contain`/`fill`/`none`) |

**배너 전용 스타일:**

| 필드 | 기본값 | 설명 |
|------|--------|------|
| `bannerBackground` | 보라 그라데이션 | 배너 배경 |
| `bannerTextColor` | `#ffffff` | 배너 텍스트 색 |
| `bannerBtnTextColor` | `#667eea` | 배너 버튼 텍스트 색 |

---

## 6. 자동 전송 이벤트 & 퍼널

```
사용자 방문 → SDK 조건 체크
                │
                ▼
          [ops_receive]  ← 작업 도달 (operate-sdk-init.js에서 자동 전송)
                │
                ▼
          [ops_show]     ← 팝업 표시 (operate-popup.js에서 자동 전송)
                │
          ┌─────┴─────┐
          ▼           ▼
    [ops_click]   [ops_close]
    버튼 클릭      팝업 닫기
```

| 이벤트 | 전송 위치 | 포함 속성 |
|--------|-----------|-----------|
| `ops_receive` | `operate-sdk-init.js:71` | `opsProperties` |
| `ops_show` | `operate-popup.js:808` | `opsProperties` + `popup_type` |
| `ops_click` | `operate-popup.js:855` | `opsProperties` + `button_action` + `button_text` |
| `ops_close` | `operate-popup.js:702` | `opsProperties` + `close_method` |

### close_method 값

| 값 | 의미 |
|----|------|
| `button_click` | X 버튼 또는 CTA 버튼 클릭 |
| `overlay_click` | 배경 오버레이 클릭 (modal, slide) |
| `escape_key` | ESC 키 |
| `auto_close` | 자동 닫기 (toast 기본 10초) |
| `close_all` | `TEPopup.closeAll()` 호출 |

---

## 7. 커스텀 이벤트 (JavaScript)

팝업 동작에 따라 커스텀 로직을 추가할 수 있습니다:

```javascript
// 작업 트리거 수신 시
window.addEventListener('te:trigger', (e) => {
  console.log('작업 수신:', e.detail);
});

// 팝업 표시 시
window.addEventListener('te:popup:show', (e) => {
  const { popupId, taskId, popupType } = e.detail;
});

// 팝업 버튼 클릭 시
window.addEventListener('te:popup:click', (e) => {
  const { popupId, taskId, action, buttonText } = e.detail;
  // action: 'primary' 또는 'secondary'
});

// 팝업 닫힐 때
window.addEventListener('te:popup:close', (e) => {
  const { popupId, taskId, closeMethod } = e.detail;
});

// 운영 SDK 초기화 완료 시
window.addEventListener('te:operate:ready', () => {
  // 초기화 후 클라이언트 파라미터 설정 가능
  window.TEOperate.setClientParams({
    user_level: 'vip',
    page_category: 'product'
  });
});
```

---

## 8. 디버깅 체크리스트

### SDK 로드 확인

```javascript
console.log('TDApp:', typeof window.TDApp);         // undefined면 SDK 미로드
console.log('TDAnalytics:', typeof window.TDAnalytics);
console.log('TDStrategy:', typeof window.TDStrategy);
console.log('TEOperate:', typeof window.TEOperate);  // undefined면 운영 SDK 미초기화
console.log('TEPopup:', typeof window.TEPopup);      // undefined면 팝업 모듈 미로드
```

### 설정 확인

```javascript
console.log(window.trackingConfig.operate);
// { enabled: true, mode: 'none', popup: { enabled: true, ... } }
```

### 디버그 모드 켜기

`config.js`에서:
```javascript
debug: {
  showConsoleLogs: true  // 내부 로그 활성화
}
```

또는 `operate.mode`를 `'debug'`로 변경하면 TE 콘솔에서 테스트 발송 가능.

### 흔한 문제

| 증상 | 원인 | 해결 |
|------|------|------|
| 팝업이 안 뜸 | SDK 스크립트 미로드 | HTML에 4종 스크립트 추가 확인 |
| 팝업이 안 뜸 | TE 콘솔 채널 OFF | 채널 스위치 ON 확인 |
| 팝업이 안 뜸 | `showAllTriggers: false` + popupType 미지정 | 콘텐츠에 `popupType` 추가 또는 `showAllTriggers: true` |
| 이벤트 미전송 | TDAnalytics 미초기화 | SDK 로드 순서 확인 |
| 스타일 깨짐 | CSS 충돌 | `te-popup` 접두사로 격리됨, 외부 CSS 확인 |

---

## 9. 설정 변경 포인트 요약

| 변경 목적 | 파일 | 설정 |
|-----------|------|------|
| 운영 SDK 끄기/켜기 | `config.js` | `operate.enabled` |
| 팝업 모듈 끄기/켜기 | `config.js` | `operate.popup.enabled` |
| 기본 팝업 타입 변경 | `config.js` | `operate.popup.defaultType` |
| 모든 트리거 팝업 표시 | `config.js` | `operate.popup.showAllTriggers` |
| 디버그 모드 | `config.js` | `operate.mode: 'debug'` |
| 콘솔 로그 | `config.js` | `debug.showConsoleLogs: true` |
| 팝업 기본 디자인 | `operate-popup.js` | `DEFAULT_STYLE` 상수 |

---

## 참고 문서

- [OPERATE-SDK-GUIDE.md](./OPERATE-SDK-GUIDE.md) - SDK & 팝업 상세 가이드 (콘솔 작업 설정, 타입별 JSON 예시)
- [OPERATE-POPUP-QUICKSTART.md](./OPERATE-POPUP-QUICKSTART.md) - 처음부터 끝까지 따라하는 빠른 시작 가이드
- [docs/popup-preview.html](./popup-preview.html) - 팝업 미리보기 도구
