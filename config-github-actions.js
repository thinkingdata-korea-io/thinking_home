/**
 * GitHub Actions 환경 전용 설정
 * Node.js 환경에서만 사용되는 설정들
 */

// GitHub Actions 환경에서 환경변수 처리
function getEnvVar(name, defaultValue) {
  return process.env[name] || defaultValue;
}

const config = {
  // ThinkingData SDK 설정 (GitHub Actions용)
  thinkingData: {
    appId: getEnvVar('TE_APP_ID', '79ed7051fc51493798b16328c0ebd0bc'),
    serverUrl: getEnvVar('TE_SERVER_URL', 'https://te-receiver-naver.thinkingdata.kr/sync_json'),
    showLog: false,
    autoTrack: {
      pageShow: true,
      pageHide: true
    },
  },

  // Google Search Console 설정
  googleSearchConsole: {
    siteUrl: getEnvVar('GSC_SITE_URL', 'https://www.thinkingdata.kr/')
  },

  // GitHub Actions 전용 설정
  githubActions: {
    // 로그 레벨
    logLevel: getEnvVar('LOG_LEVEL', 'info'),
    
    // 재시도 설정
    retryAttempts: parseInt(getEnvVar('RETRY_ATTEMPTS', '3')),
    retryDelay: parseInt(getEnvVar('RETRY_DELAY', '5000')),
    
    // 배치 설정
    batchSize: parseInt(getEnvVar('BATCH_SIZE', '100')),
    batchTimeout: parseInt(getEnvVar('BATCH_TIMEOUT', '30000')),
    
    // 타임아웃 설정
    requestTimeout: parseInt(getEnvVar('REQUEST_TIMEOUT', '30000')),
    
    // 데이터 수집 설정
    maxRowsPerRequest: parseInt(getEnvVar('MAX_ROWS_PER_REQUEST', '1000')),
    defaultDaysToCollect: parseInt(getEnvVar('DEFAULT_DAYS_TO_COLLECT', '3'))
  }
};

// 설정 유효성 검사
function validateConfig() {
  console.log('🔧 GitHub Actions 설정 로드:', {
    appId: config.thinkingData.appId ? '설정됨' : '기본값 사용',
    serverUrl: config.thinkingData.serverUrl,
    siteUrl: config.googleSearchConsole.siteUrl,
    logLevel: config.githubActions.logLevel
  });
  
  if (!config.thinkingData.appId) {
    console.error('❌ ThinkingData APP_ID가 설정되지 않았습니다. 환경변수 TE_APP_ID를 설정해주세요.');
    return false;
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
  console.log(`🔄 ${module} 설정 업데이트 완료:`, updates);
  return config[module];
}

// 모듈별 설정 가져오기
function getModuleConfig(module) {
  return config[module] || {};
}

export default config;
export { validateConfig, updateConfig, getModuleConfig }; 