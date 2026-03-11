# Thinking Home

ThinkingData 웹 트래킹 & Google Search Console 데이터 파이프라인

## 개요

웹사이트 방문자 행동 데이터와 검색 성과 데이터를 ThinkingData 플랫폼으로 통합 수집하는 시스템입니다.

- **웹 트래킹** - 브라우저에서 페이지뷰, 클릭, 스크롤 등 사용자 행동을 실시간 수집
- **GSC 동기화** - Google Search Console 검색 데이터를 서버/GitHub Actions로 자동 수집

## 프로젝트 구조

```
thinking-home/
├── main.js                      # 브라우저 트래킹 진입점
├── config.js                    # 브라우저 환경 설정
├── config-github-actions.js     # GitHub Actions 환경 설정
├── gsc-collector.js             # GSC 데이터 수집 CLI
├── scheduler.js                 # 로컬 크론 스케줄러
├── google-search-console.js     # GSC API 래퍼
├── user-attributes.js           # 유저 속성 수집
├── core/
│   ├── thinking-data-init.js    # ThinkingData SDK 초기화
│   ├── thinking-data-node.js    # Node.js 클라이언트
│   ├── search-console-tracker.js # GSC → ThinkingData 변환
│   ├── session-manager.js       # 세션 관리
│   ├── operate-sdk-init.js      # Operate SDK 초기화
│   └── utils.js                 # 유틸리티 함수
├── tracking/
│   ├── pageview.js              # 페이지뷰 추적
│   ├── click.js                 # 클릭 추적
│   ├── scroll.js                # 스크롤 깊이 추적
│   ├── section-scroll.js        # 섹션별 가시성 추적
│   ├── form.js                  # 폼 제출 추적
│   ├── popup.js                 # 팝업 추적
│   ├── operate-popup.js         # Operate 팝업 추적
│   ├── exit.js                  # 이탈 추적
│   ├── resource.js              # 리소스 다운로드 추적
│   └── search-performance.js    # 검색 성과 추적
├── scripts/                     # 설정 스크립트
├── .github/workflows/           # GitHub Actions CI/CD
├── tests/                       # 테스트
└── docs/                        # 문서
```

## 웹 트래킹

### 추적 항목

| 모듈 | 설명 |
|------|------|
| Pageview | 페이지뷰 이벤트 |
| Click | 링크, 버튼 클릭 |
| Scroll | 스크롤 깊이 (0/25/50/75/90/100%) |
| Section Scroll | 섹션별 가시성 추적 (IntersectionObserver) |
| Form | 폼 제출 및 유효성 검사 |
| Popup | 팝업 노출/클릭 |
| Operate Popup | Operate SDK 기반 팝업 (모달, 배너, 토스트, 슬라이드) |
| Exit | 페이지 이탈 |
| Resource | 리소스 다운로드 |
| User Attributes | UTM, 기기 정보, 브라우저 등 |

### 설치

웹사이트 HTML에 아래 스크립트를 추가합니다.

```html
<script>
  window.TE_APP_ID = 'your-app-id';
  window.TE_SERVER_URL = 'your-server-url';
</script>
<script type="module" src="main.js"></script>
```

설정 방법은 `window` 변수 외에도 meta 태그, data 속성, 런타임 함수를 지원합니다.

```html
<!-- meta 태그 -->
<meta name="TE_APP_ID" content="your-app-id">

<!-- 런타임 설정 -->
<script>
  window.setThinkingDataConfig('your-app-id', 'your-server-url');
</script>
```

### 초기화 이벤트

트래킹 초기화 완료 시 `tracking:ready` 커스텀 이벤트가 발생합니다.

```javascript
window.addEventListener('tracking:ready', (e) => {
  console.log('SDK 초기화:', e.detail.sdkInitialized);
  console.log('활성 모듈:', e.detail.modules);
});
```

## Google Search Console 동기화

GSC API에서 검색 성과 데이터(쿼리, 페이지, 국가, 디바이스별)를 수집하여 ThinkingData로 전송합니다.

### 로컬 실행

```bash
npm install

# 어제 데이터
npm run gsc:yesterday

# 최근 3일 / 7일 / 30일
npm run gsc:last-3-days
npm run gsc:last-week
npm run gsc:last-month

# 커스텀 기간
node gsc-collector.js --start-date 2024-01-01 --end-date 2024-01-31
```

### GitHub Actions 자동화

매일 KST 새벽 3시에 최근 3일치 데이터를 자동 수집합니다. 수동 실행 시 동기화 범위를 선택할 수 있습니다.

#### 필요한 GitHub Secrets

| Secret | 설명 |
|--------|------|
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Google Service Account JSON 키 |
| `TE_APP_ID` | ThinkingData APP ID |
| `TE_SERVER_URL` | ThinkingData 서버 URL |

#### 수동 실행

1. GitHub > **Actions** 탭
2. **Google Search Console → ThinkingData 통합 동기화** 선택
3. **Run workflow** > 동기화 타입 선택 (yesterday / last-3-days / last-week / last-month)

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `TE_APP_ID` | ThinkingData APP ID | (필수) |
| `TE_SERVER_URL` | ThinkingData 서버 URL | (필수) |
| `GSC_SITE_URL` | Google Search Console 사이트 URL | `https://www.thinkingdata.kr/` |
| `LOG_LEVEL` | 로그 레벨 | `info` |
| `BATCH_SIZE` | 배치 전송 크기 | `100` |

## 테스트

```bash
npm test              # 전체 테스트
npm run test:watch    # watch 모드
```

## 기술 스택

- **런타임**: Node.js 18+
- **API**: Google Search Console API (googleapis)
- **SDK**: ThinkingData Web SDK, Operate SDK
- **스케줄링**: node-cron, GitHub Actions
- **테스트**: Vitest

## 라이선스

MIT
