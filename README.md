# Thinking Home

ThinkingData 웹 트래킹 시스템 및 Google Search Console 데이터 연동 프로젝트

## 개요

이 프로젝트는 두 가지 핵심 기능을 제공합니다:

1. **웹 트래킹 (브라우저)** - 웹사이트 방문자 행동을 ThinkingData로 수집
2. **GSC 데이터 동기화 (서버/GitHub Actions)** - Google Search Console 검색 성과 데이터를 ThinkingData로 전송

## 프로젝트 구조

```
thinking-home/
├── main.js                    # 브라우저 트래킹 진입점
├── config.js                  # 브라우저 환경 설정
├── config-github-actions.js   # GitHub Actions 환경 설정
├── gsc-collector.js           # GSC 데이터 수집 CLI
├── scheduler.js               # 로컬 스케줄러 (cron)
├── google-search-console.js   # GSC API 래퍼
├── user-attributes.js         # 유저 속성 추적
├── core/
│   ├── thinking-data-init.js  # ThinkingData SDK 초기화
│   ├── thinking-data-node.js  # ThinkingData Node.js 클라이언트
│   ├── search-console-tracker.js  # GSC → ThinkingData 변환
│   ├── session-manager.js     # 세션 관리
│   ├── operate-sdk-init.js    # 운영 SDK 초기화
│   └── utils.js               # 유틸리티 함수
├── tracking/
│   ├── pageview.js            # 페이지뷰 추적
│   ├── click.js               # 클릭 추적
│   ├── scroll.js              # 스크롤 추적
│   ├── section-scroll.js      # 섹션별 스크롤 추적
│   ├── form.js                # 폼 추적
│   ├── popup.js               # 팝업 추적
│   ├── operate-popup.js       # 운영 팝업 추적
│   ├── exit.js                # 이탈 추적
│   ├── resource.js            # 리소스 다운로드 추적
│   └── search-performance.js  # 검색 성과 추적
├── config/
│   └── search-console-config.js  # GSC 상세 설정
├── scripts/
│   ├── setup-cron.sh          # 크론 설정 스크립트
│   └── setup-github-actions.sh
├── .github/
│   └── workflows/
│       └── integrated-sync.yml  # GitHub Actions 워크플로우
└── docs/                      # 문서
```

## 1. 웹 트래킹

브라우저 환경에서 동작하는 트래킹 모듈입니다.

### 추적 항목

| 모듈 | 설명 |
|------|------|
| Pageview | 페이지뷰 이벤트 |
| Click | 링크, 버튼 클릭 |
| Scroll | 스크롤 깊이 (0/25/50/75/90/100%) |
| Section Scroll | 섹션별 가시성 추적 |
| Form | 폼 제출 및 유효성 검사 |
| Popup | 팝업 노출/클릭 |
| Exit | 페이지 이탈 |
| Resource | 리소스 다운로드 |
| User Attributes | 유저 속성 (UTM, 기기 정보 등) |

### 웹사이트 설치

```html
<script>
  window.TE_APP_ID = 'your-app-id';
  window.TE_SERVER_URL = 'your-server-url';
</script>
<script type="module" src="main.js"></script>
```

## 2. Google Search Console 데이터 동기화

GSC API에서 검색 성과 데이터를 수집하여 ThinkingData로 전송합니다.

### 수집 데이터

- 검색 쿼리별 성과 (클릭, 노출, CTR, 순위)
- 페이지별 성과
- 국가별 성과
- 디바이스별 성과

### 로컬 실행

```bash
npm install

# 어제 데이터
npm run gsc:yesterday

# 최근 3일
npm run gsc:last-3-days

# 최근 7일
npm run gsc:last-week

# 최근 30일
npm run gsc:last-month

# 커스텀 기간
node gsc-collector.js --start-date 2024-01-01 --end-date 2024-01-31
```

### GitHub Actions 자동 실행

매일 KST 새벽 3시에 자동으로 최근 3일치 데이터를 수집합니다.
수동 실행도 지원하며, 동기화 범위를 선택할 수 있습니다.

#### 필요한 GitHub Secrets

| Secret 이름 | 설명 |
|-------------|------|
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Google Service Account JSON 키 전체 내용 |
| `TE_APP_ID` | ThinkingData APP ID |
| `TE_SERVER_URL` | ThinkingData 서버 URL |

#### Secrets 설정 방법

1. GitHub 리포지토리 > **Settings** > **Secrets and variables** > **Actions**
2. **New repository secret** 클릭
3. 위 테이블의 각 항목을 추가

#### 수동 실행

1. GitHub 리포지토리 > **Actions** 탭
2. **Google Search Console → ThinkingData 통합 동기화** 워크플로우 선택
3. **Run workflow** 클릭
4. 동기화 타입 선택 (yesterday / last-3-days / last-week / last-month)

## 환경변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `TE_APP_ID` | ThinkingData APP ID | - |
| `TE_SERVER_URL` | ThinkingData 서버 URL | - |
| `GSC_SITE_URL` | Google Search Console 사이트 URL | `https://www.thinkingdata.kr/` |
| `LOG_LEVEL` | 로그 레벨 | `info` |
| `BATCH_SIZE` | 배치 전송 크기 | `100` |

## 라이선스

MIT
