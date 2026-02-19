/**
 * ThinkingData 추적 시스템 설정 (브라우저 환경 전용)
 * 중앙화된 설정 관리
 * 
 * 환경변수 설정 방법:
 * 1. HTML에서 직접 설정:
 *    <script>
 *      window.TE_APP_ID = 'your-app-id';
 *      window.TE_SERVER_URL = 'your-server-url';
 *    </script>
 * 
 * 2. Meta 태그로 설정:
 *    <meta name="TE_APP_ID" content="your-app-id">
 *    <meta name="TE_SERVER_URL" content="your-server-url">
 * 
 * 3. Data 속성으로 설정:
 *    <div data-te-app-id="your-app-id" data-te-server-url="your-server-url"></div>
 * 
 * 4. 런타임에 설정:
 *    window.setThinkingDataConfig('your-app-id', 'your-server-url');
 */

// 브라우저 환경에서 환경변수 처리
function getEnvVar(name, defaultValue) {
  // 1. window 객체에 직접 설정된 환경변수 확인
  if (window[name]) {
    return window[name];
  }
  
  // 2. meta 태그에서 환경변수 확인
  const safeName = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(name) : name.replace(/[^\w-]/g, '');
  const metaTag = document.querySelector(`meta[name="${safeName}"]`);
  if (metaTag && metaTag.getAttribute('content')) {
    return metaTag.getAttribute('content');
  }
  
  // 3. data 속성에서 환경변수 확인
  const dataElement = document.querySelector(`[data-${name.toLowerCase()}]`);
  if (dataElement) {
    return dataElement.getAttribute(`data-${name.toLowerCase()}`);
  }
  
  // 4. 기본값 반환
  return defaultValue;
}

const config = {
  // ThinkingData SDK 설정
  thinkingData: {
    appId: getEnvVar('TE_APP_ID', '79ed7051fc51493798b16328c0ebd0bc'),
    serverUrl: getEnvVar('TE_SERVER_URL', 'https://te-receiver-naver.thinkingdata.kr/sync_js'),
    showLog: false, // SDK 로그 활성화 (개발/운영 환경에 따라 조정)
    batch: false, // 🚀 실시간 전송으로 변경 (기본값: true)
    autoTrack: {
      pageShow: true,
      pageHide: true
    },
  },

  // 세션 관리 설정
  session: {
    timeout: 30 * 60 * 1000, // 30분
    engagementThreshold: 10000, // 10초
    interactionThreshold: 2 // 2회 상호작용
  },

  // 추적 모듈 활성화 설정
  modules: {
    click: true,
    exit: true,
    scroll: true,
    form: true,
    popup: true,
    resource: true,
    userAttributes: true,
    sectionScroll: true,
    operatePopup: true // 운영 팝업 모듈
  },

  // 스크롤 추적 설정
  scroll: {
    thresholds: [0, 25, 50, 75, 90, 100],
    debounceTime: 100
  },

  // 클릭 추적 설정
  click: {
    trackExternalLinks: true,
    trackMenuClicks: true,
    elementSelectors: ['a', 'button', '[role="button"]', '.btn', '.button']
  },

  // 폼 추적 설정
  form: {
    maskPersonalInfo: true,
    trackValidationErrors: true
  },

  // 디버그 설정
  debug: {
    enabled: false, // 운영환경에서는 false, 개발환경에서는 true
    logLevel: 'warn', // 'error', 'warn', 'info', 'debug'
    showConsoleLogs: false // 우리가 만든 console.log들 제어 (테스트용)
  },

  // 운영 SDK 설정 (TDStrategy - 클라이언트 트리거 과제)
  operate: {
    enabled: true, // 운영 SDK 활성화 여부
    mode: 'none', // SDK 모드: 'none' (운영), 'debug' (디버그), 'debugOnly' (디버그 전용)
    clientParams: {
      // 과제 조건에 사용할 초기 클라이언트 파라미터
      // 예: user_level: 'guest', membership: 'free'
    },
    // 팝업 모듈 설정
    popup: {
      enabled: true, // 팝업 모듈 활성화
      autoRegister: true, // 트리거 핸들러 자동 등록
      showAllTriggers: false, // true: 모든 트리거를 팝업으로 표시, false: popupType 지정된 것만
      defaultType: 'modal' // 기본 팝업 타입: 'modal', 'banner', 'toast', 'slide'
    }
  }
};

// 설정 유효성 검사
function validateConfig() {
  if (!config.thinkingData.appId) {
    console.warn('⚠️ ThinkingData APP_ID가 설정되지 않았습니다.');
  }
  
  if (!config.thinkingData.serverUrl) {
    console.error('❌ ThinkingData 서버 URL이 설정되지 않았습니다.');
    return false;
  }
  
  return true;
}

// 설정 로드 시 유효성 검사
validateConfig();

// 설정 업데이트 함수
function updateConfig(module, updates) {
  if (!config[module]) {
    config[module] = {};
  }
  
  config[module] = { ...config[module], ...updates };
  return config[module];
}

// 모듈별 설정 가져오기
function getModuleConfig(module) {
  return config[module] || {};
}

// 환경변수 설정 헬퍼 함수 (런타임에 설정 가능)
function setEnvVar(name, value) {
  window[name] = value;
}

// 전역으로 노출 (HTML에서 직접 설정 가능)
window.setThinkingDataConfig = function(appId, serverUrl) {
  if (appId) setEnvVar('TE_APP_ID', appId);
  if (serverUrl) setEnvVar('TE_SERVER_URL', serverUrl);
};

export default config;
export { validateConfig, updateConfig, getModuleConfig, setEnvVar }; 