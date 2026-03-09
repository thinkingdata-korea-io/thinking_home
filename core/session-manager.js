/**
 * 세션 관리자 - ThinkingData 추적 시스템용
 * 세션 생성, 유지, 종료 및 관련 이벤트 전송을 담당
 */

import { 
  trackEvent, 
  addBotInfoToEvent, 
  addTETimeProperties, 
  trackingLog, 
  updateSuperPropertiesWithSession,
  getDeviceType,
  getBrowserInfo
} from './utils.js';

// 세션 설정 상수
const SESSION_CONFIG = {
  DEFAULT_TIMEOUT: 30 * 60 * 1000, // 30분
  ENGAGEMENT_TIME_THRESHOLD: 10000, // 10초
  ENGAGEMENT_INTERACTION_THRESHOLD: 2, // 2회 상호작용
  TIMEOUT_CHECK_INTERVAL: 60000, // 1분
  UTM_PARAMETERS: ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id'],
  TRACKING_IDS: ['gclid', 'fbclid', 'msclkid', '_ga'],
  SESSION_STORAGE_KEYS: {
    SESSION_ID: 'te_session_id',
    SESSION_NUMBER: 'te_session_number',
    SESSION_START_TIME: 'te_session_start_time',
    LAST_ACTIVITY_TIME: 'te_last_activity_time',
    IS_ENGAGED_SESSION: 'te_is_engaged_session',
    SESSION_DATE: 'te_session_date',
    PREVIOUS_UTM: 'te_previous_utm',
    PREVIOUS_USER: 'te_previous_user',
    SESSION_UTM: 'te_session_utm' // 세션 기간 동안 유지되는 UTM 정보
  }
};

// 세션 통계 키
const SESSION_STATS_KEYS = {
  TOTAL_SESSIONS: 'te_total_sessions',
  TOTAL_SESSION_TIME: 'te_total_session_time',
  AVERAGE_SESSION_TIME: 'te_average_session_time',
  LONGEST_SESSION_TIME: 'te_longest_session_time',
  ENGAGED_SESSIONS: 'te_engaged_sessions'
};

// 초기화 상태 추적
let isInitialized = false;
let initializationPromise = null;

// 세션 변수들 (모듈 내부 캡슐화)
let sessionId = null;
let sessionNumber = parseInt(safeGetItem(SESSION_CONFIG.SESSION_STORAGE_KEYS.SESSION_NUMBER) || '0');
let sessionStartTime = null;
let sessionEndTime = null;
let isEngagedSession = false;
let interactionCount = 0;
let lastActivityTime = Date.now();
let sessionTimeout = SESSION_CONFIG.DEFAULT_TIMEOUT;
let isSessionTrackingEnabled = true;
let sessionTimeoutIntervalId = null;

// 세션 이벤트 추적 (중복 전송 방지)
const sessionEventsTracked = {
  session_start: false,
  session_end: false,
  session_engaged: false
};

// 무한 재귀 방지를 위한 플래그
let isUpdatingSession = false;

// 안전한 로컬스토리지 접근
function safeGetItem(key, defaultValue = null) {
  try {
    const value = localStorage.getItem(key);
    return value !== null ? value : defaultValue;
  } catch (e) {
    console.warn(`로컬스토리지 읽기 실패 (${key}):`, e);
    return defaultValue;
  }
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    console.warn(`로컬스토리지 쓰기 실패 (${key}):`, e);
    return false;
  }
}

// 안전한 이벤트 전송
function safeTrackEvent(eventName, properties = {}) {
  try {
    if (typeof window.te !== 'undefined' && window.te.track) {
      window.te.track(eventName, properties);
      return true;
    } else {
      console.warn('ThinkingData SDK가 로드되지 않음');
      return false;
    }
  } catch (e) {
    console.error('이벤트 전송 실패:', e);
    return false;
  }
}

/**
 * 세션 초기화 및 시작
 * @param {Object} config - 세션 설정
 * @returns {Promise} 초기화 완료 Promise
 */
function initializeSession(config = {}) {
  // 설정 적용
  if (config.timeout) {
    sessionTimeout = config.timeout;
  }
  
  if (isInitialized) {
    trackingLog('🔄 세션 관리자가 이미 초기화됨');
    return Promise.resolve();
  }

  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = new Promise((resolve, reject) => {
    trackingLog('🔄 세션 관리자 초기화 시작...');

    // ThinkingData SDK 확인 및 재시도 로직
    function checkAndInitialize() {
      if (typeof window.te === 'undefined') {
        console.warn('⚠️ ThinkingData SDK가 로드되지 않음, 3초 후 재시도...');
        setTimeout(checkAndInitialize, 3000);
        return;
      }

      try {
        // ✅ 세션 번호 초기화 검증
        const storedSessionNumber = safeGetItem(SESSION_CONFIG.SESSION_STORAGE_KEYS.SESSION_NUMBER);
        if (storedSessionNumber !== null) {
          const parsedNumber = parseInt(storedSessionNumber);
          if (!isNaN(parsedNumber) && parsedNumber >= 0) {
            sessionNumber = parsedNumber;
            trackingLog(`📊 기존 세션 번호 복원: ${sessionNumber}`);
          } else {
            console.warn('⚠️ 잘못된 세션 번호 발견, 0으로 리셋:', storedSessionNumber);
            sessionNumber = 0;
            safeSetItem(SESSION_CONFIG.SESSION_STORAGE_KEYS.SESSION_NUMBER, '0');
          }
        } else {
          trackingLog('📊 최초 방문자, 세션 번호 0으로 시작');
          sessionNumber = 0;
          safeSetItem(SESSION_CONFIG.SESSION_STORAGE_KEYS.SESSION_NUMBER, '0');
        }

        const storedSessionId = safeGetItem(SESSION_CONFIG.SESSION_STORAGE_KEYS.SESSION_ID);
        const storedStartTime = safeGetItem(SESSION_CONFIG.SESSION_STORAGE_KEYS.SESSION_START_TIME);
        const storedLastActivity = safeGetItem(SESSION_CONFIG.SESSION_STORAGE_KEYS.LAST_ACTIVITY_TIME);

        // 기존 세션 복원 또는 새 세션 시작
        if (storedSessionId && storedStartTime && storedLastActivity) {
          const timeSinceStart = Date.now() - parseInt(storedStartTime);
          const timeSinceLastActivity = Date.now() - parseInt(storedLastActivity);

          // 세션 타임아웃 체크
          if (timeSinceLastActivity < sessionTimeout && timeSinceStart < sessionTimeout * 2) {
            // 기존 세션 복원
            restoreSession(storedSessionId, parseInt(storedStartTime));
          } else {
            // 세션 만료 - 새 세션 시작
            startNewSession();
          }
        } else {
          // 최초 방문 - 새 세션 시작
          startNewSession();
        }

        // 세션 타임아웃 체크 주기 설정
        sessionTimeoutIntervalId = setInterval(checkSessionTimeout, SESSION_CONFIG.TIMEOUT_CHECK_INTERVAL);

        // 페이지 종료 시 세션 종료 이벤트 전송
        setupSessionEndTracking();

        // 전역 함수 등록 (중복 등록 방지)
        if (!window.updateSessionActivity) {
          window.updateSessionActivity = updateSessionActivity;
        }
        if (!window.endSession) {
          window.endSession = endSession;
        }

        isInitialized = true;
        trackingLog('✅ 세션 관리자 초기화 완료 (안전성 강화)');
        resolve();
      } catch (error) {
        console.error('세션 초기화 실패:', error);
        reject(error);
      }
    }

    checkAndInitialize();
  });

  return initializationPromise;
}

/**
 * 새 세션 시작 (GA4/Amplitude 방식)
 */
function startNewSession() {
  const now = Date.now();
  sessionId = generateSessionId();

  // ✅ 세션 번호 증가 (안전한 방식)
  const previousSessionNumber = sessionNumber;
  sessionNumber = previousSessionNumber + 1;

  sessionStartTime = now;
  isEngagedSession = false;
  interactionCount = 0;
  lastActivityTime = now;

  // 세션 정보 저장
  safeSetItem(SESSION_CONFIG.SESSION_STORAGE_KEYS.SESSION_ID, sessionId.toString());
  safeSetItem(SESSION_CONFIG.SESSION_STORAGE_KEYS.SESSION_NUMBER, sessionNumber.toString());
  safeSetItem(SESSION_CONFIG.SESSION_STORAGE_KEYS.SESSION_START_TIME, sessionStartTime.toString());
  safeSetItem(SESSION_CONFIG.SESSION_STORAGE_KEYS.LAST_ACTIVITY_TIME, lastActivityTime.toString());
  safeSetItem(SESSION_CONFIG.SESSION_STORAGE_KEYS.IS_ENGAGED_SESSION, isEngagedSession.toString());

  // ✅ 세션 UTM 저장 (세션 시작 시 현재 URL의 UTM + gclid 등 저장)
  saveSessionUTM();

  // 🪪 세션 정보로 슈퍼 프로퍼티 갱신
  updateSuperPropertiesWithSession(sessionId, sessionNumber);

  // 세션 시작 이벤트 데이터 준비
  const sessionStartData = {
    session_id: sessionId,
    session_number: sessionNumber,
    is_engaged_session: isEngagedSession,
    session_start_time: sessionStartTime,
    page_url: window.location.href,
    page_title: document.title,
    referrer: document.referrer || '',
    user_agent: navigator.userAgent,
    device_type: getDeviceType(),
    browser_info: getBrowserInfo()
  };

  // 봇 정보 추가
  const sessionStartDataWithBot = addBotInfoToEvent(sessionStartData);
  
  // TE 시간 형식 속성 추가
  const sessionStartDataWithTETime = addTETimeProperties(sessionStartDataWithBot);

  // 세션 시작 이벤트 전송
  safeTrackEvent('te_session_start', sessionStartDataWithTETime);

      trackingLog('✅ 새 세션 시작:', {
    sessionId,
    sessionNumber,
    previousSessionNumber, // ✅ 이전 세션 번호도 로그에 포함
    isBot: sessionStartDataWithTETime.is_bot,
    botType: sessionStartDataWithTETime.bot_type,
    sessionStartTimeTE: sessionStartDataWithTETime.session_start_time_te
  });

  // 세션 통계 업데이트
  updateSessionStatistics(0);
}

/**
 * 기존 세션 복원
 */
function restoreSession(existingSessionId, existingStartTime) {
  sessionId = parseInt(existingSessionId);
  sessionStartTime = parseInt(existingStartTime);
  sessionNumber = parseInt(safeGetItem('te_session_number') || '0');
  isEngagedSession = safeGetItem('te_is_engaged_session') === 'true';
  interactionCount = 0;
  lastActivityTime = Date.now();
  
  // 🪪 세션 정보로 슈퍼 프로퍼티 갱신
  updateSuperPropertiesWithSession(sessionId, sessionNumber);
  
  // 로컬스토리지 업데이트
  safeSetItem('te_last_activity_time', lastActivityTime.toString());
  
  // 세션 시작 시 날짜/UTM/사용자 체크
  checkDateChange();
  checkUtmChange();
  checkUserChange();

      trackingLog('🔄 기존 세션 복원:', {
    sessionId,
    sessionNumber,
    startTime: new Date(sessionStartTime).toLocaleString(),
    duration: Math.round((Date.now() - sessionStartTime) / 1000) + '초'
  });
}

/**
 * 세션 활동 업데이트
 */
function updateSessionActivity() {
  // 무한 재귀 방지
  if (isUpdatingSession || !isSessionTrackingEnabled) {
    return;
  }
  
  isUpdatingSession = true;
  
  try {
    lastActivityTime = Date.now();
    interactionCount++;
    
    // 로컬스토리지 업데이트
    safeSetItem('te_last_activity_time', lastActivityTime.toString());
    
    // 인게이지 세션 조건: 설정된 시간 이상 또는 설정된 상호작용 횟수 이상
    if (!isEngagedSession) {
      const timeSpent = Date.now() - sessionStartTime;
      if (timeSpent >= SESSION_CONFIG.ENGAGEMENT_TIME_THRESHOLD || 
          interactionCount >= SESSION_CONFIG.ENGAGEMENT_INTERACTION_THRESHOLD) {
        isEngagedSession = true;
        safeSetItem('te_is_engaged_session', 'true');
        
        // 인게이지 세션 이벤트 전송 (중복 방지)
        if (!sessionEventsTracked.session_engaged) {
          safeTrackEvent('te_session_engaged', {
            session_id: sessionId,
            session_number: sessionNumber,
            time_to_engage: Math.round(timeSpent / 1000),
            interaction_count: interactionCount
          });
          sessionEventsTracked.session_engaged = true;
        }
      }
    }

    // 세션 시작 시 날짜/UTM/사용자 체크
    checkDateChange();
    checkUtmChange();
    checkUserChange();
  } finally {
    isUpdatingSession = false;
  }
}

/**
 * 세션 타임아웃 체크
 */
function checkSessionTimeout() {
  if (!isSessionTrackingEnabled) return;
  
  const now = Date.now();
  if (now - lastActivityTime > sessionTimeout) {
    // 세션 만료 - 종료 이벤트 전송 후 새 세션 시작
    endSession('timeout');
    startNewSession();
  }
}

/**
 * 세션 종료
 */
function endSession(reason = 'page_exit') {
  if (!isInitialized || !sessionId || sessionEventsTracked.session_end) {
    return;
  }
  
  const sessionDuration = Math.round((Date.now() - sessionStartTime) / 1000);
  sessionEndTime = Date.now();
  
  // 세션 종료 이벤트 전송
  safeTrackEvent('te_session_end', {
    session_id: sessionId,
    session_number: sessionNumber,
    session_duration: sessionDuration,
    is_engaged_session: isEngagedSession,
    interaction_count: interactionCount,
    end_reason: reason
  });
  
  // 세션 통계 업데이트
  updateSessionStatistics(sessionDuration);
  
  sessionEventsTracked.session_end = true;

  // 타임아웃 체크 인터벌 정리
  if (sessionTimeoutIntervalId !== null) {
    clearInterval(sessionTimeoutIntervalId);
    sessionTimeoutIntervalId = null;
  }

  trackingLog('🔄 세션 종료:', {
    sessionId,
    duration: sessionDuration + '초',
    reason
  });
}

/**
 * 세션 통계 업데이트
 */
function updateSessionStatistics(sessionDuration) {
  try {
    // 총 세션 수 증가
    const totalSessions = parseInt(safeGetItem('te_total_sessions') || '0') + 1;
    safeSetItem('te_total_sessions', totalSessions.toString());
    
    // 총 세션 시간 누적
    const totalSessionTime = parseInt(safeGetItem('te_total_session_time') || '0') + sessionDuration;
    safeSetItem('te_total_session_time', totalSessionTime.toString());
    
    // 평균 세션 시간 계산
    const averageSessionTime = Math.round(totalSessionTime / totalSessions);
    safeSetItem('te_average_session_time', averageSessionTime.toString());
    
    // 최장 세션 시간 갱신
    const longestSessionTime = parseInt(safeGetItem('te_longest_session_time') || '0');
    if (sessionDuration > longestSessionTime) {
      safeSetItem('te_longest_session_time', sessionDuration.toString());
    }
    
    // 인게이지 세션 수 증가
    if (isEngagedSession) {
      const engagedSessions = parseInt(safeGetItem('te_engaged_sessions') || '0') + 1;
      safeSetItem('te_engaged_sessions', engagedSessions.toString());
    }
  } catch (error) {
    console.warn('세션 통계 업데이트 실패:', error);
  }
}

/**
 * 페이지 종료 시 세션 종료 이벤트 전송 설정
 */
function setupSessionEndTracking() {
  // beforeunload: 페이지 떠나기 전
  window.addEventListener('beforeunload', function() {
    endSession('page_exit');
  });
  
  // visibilitychange: 탭 전환 등
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // 페이지가 숨겨질 때 세션 활동 시간 업데이트
      lastActivityTime = Date.now();
      safeSetItem('te_last_activity_time', lastActivityTime.toString());
    }
  });
  
  // pagehide: 모바일에서 더 안정적
  window.addEventListener('pagehide', function() {
    endSession('page_hide');
  });
}

/**
 * 세션 ID 생성
 */
function generateSessionId() {
  const timestamp = Date.now();
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return `${timestamp}-${array[0].toString(36)}`;
}

// 캐시된 값들 (성능 최적화)
let cachedCapabilities = null;
let lastCapabilitiesUpdate = 0;
const CAPABILITIES_CACHE_TIME = 300000; // 5분
let cachedNetworkInfo = null;
let lastNetworkInfoUpdate = 0;
const NETWORK_INFO_CACHE_TIME = 30000; // 30초

/**
 * 페이지 정보 수집
 */
function getPageInfo() {
  return {
    page_host: window.location.hostname,
    page_protocol: window.location.protocol,
    page_hash: window.location.hash || null,
    page_query: window.location.search || null
  };
}

/**
 * 뷰포트 정보 수집
 */
function getViewportInfo() {
  return {
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    viewport_ratio: Math.round((window.innerWidth / window.innerHeight) * 100) / 100,
    device_pixel_ratio: window.devicePixelRatio || 1,
    orientation: window.innerHeight > window.innerWidth ? 'portrait' : 'landscape'
  };
}

/**
 * 브라우저 기능 지원 체크 (캐싱)
 */
function getBrowserCapabilities() {
  const now = Date.now();
  if (cachedCapabilities && (now - lastCapabilitiesUpdate) < CAPABILITIES_CACHE_TIME) {
    return cachedCapabilities;
  }

  lastCapabilitiesUpdate = now;
  cachedCapabilities = {
    local_storage_enabled: (() => {
      try {
        const testKey = 'te_storage_test';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        return true;
      } catch (e) {
        return false;
      }
    })(),
    
    cookies_enabled: navigator.cookieEnabled,
    
    webgl_enabled: (() => {
      try {
        const canvas = document.createElement('canvas');
        return !!(canvas.getContext('webgl') || canvas.getContext('experimental-webgl'));
      } catch (e) {
        return false;
      }
    })(),
    
    is_touch_device: 'ontouchstart' in window || navigator.maxTouchPoints > 0
  };

  return cachedCapabilities;
}

/**
 * 네트워크 정보 수집 (캐싱)
 */
function getNetworkInfo() {
  const now = Date.now();
  if (cachedNetworkInfo && (now - lastNetworkInfoUpdate) < NETWORK_INFO_CACHE_TIME) {
    return cachedNetworkInfo;
  }

  cachedNetworkInfo = {
    connection_type: navigator.connection?.effectiveType || null,
    connection_downlink: navigator.connection?.downlink || null,
    connection_rtt: navigator.connection?.rtt || null,
    is_online: navigator.onLine
  };

  lastNetworkInfoUpdate = now;
  return cachedNetworkInfo;
}

/**
 * UTM 및 추적 ID 수집
 */
function getMarketingParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const marketingData = {};
  
  // UTM 파라미터
  SESSION_CONFIG.UTM_PARAMETERS.forEach(param => {
    const value = urlParams.get(param);
    if (value) {
      marketingData[param] = value;
    }
  });
  
  // 추적 ID들
  SESSION_CONFIG.TRACKING_IDS.forEach(param => {
    const value = urlParams.get(param);
    if (value) {
      marketingData[param] = value;
    }
  });
  
  return marketingData;
}

/**
 * 성능 정보 수집
 */
function getPerformanceInfo() {
  return {
    dom_ready_state: document.readyState,
    performance_now: Math.round(performance.now()),
    memory_used: performance.memory?.usedJSHeapSize 
      ? Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) 
      : null
  };
}

/**
 * 공통 속성 업데이트 (최적화)
 */
function updateSuperProperties() {
  try {
    if (!window.te?.setSuperProperties) {
      console.warn('ThinkingData SDK setSuperProperties 메서드를 사용할 수 없습니다');
      return;
    }

    const superProperties = {
      // 세션 관련
      session_id: sessionId,
      session_number: sessionNumber,
      
      // 각종 정보 수집 (함수 분리)
      ...getPageInfo(),
      ...getViewportInfo(),
      ...getBrowserCapabilities(),
      ...getNetworkInfo(),
      ...getMarketingParameters(),
      ...getPerformanceInfo(),
      
      // 타이밍 정보
      timestamp: Date.now(),
      local_time: new Date().toISOString()
    };
    
    // TE 시간 형식 속성 추가
    const superPropertiesWithTETime = addTETimeProperties(superProperties);
    
    window.te.setSuperProperties(superPropertiesWithTETime);
    trackingLog('✅ 공통 속성 업데이트 완료 (최적화)');
  } catch (error) {
    console.error('공통 속성 업데이트 실패:', error);
  }
}

// 디바이스/브라우저 정보 함수들은 utils.js에서 import하여 사용

/**
 * 세션 설정 업데이트
 */
function updateSessionConfig(newConfig) {
  if (newConfig.timeout) {
    sessionTimeout = newConfig.timeout;
  }
  if (typeof newConfig.enabled === 'boolean') {
    isSessionTrackingEnabled = newConfig.enabled;
  }
  trackingLog('✅ 세션 설정 업데이트:', newConfig);
}

/**
 * 세션 통계 조회
 */
function getSessionStatistics() {
  return {
    current_session: {
      id: sessionId,
      number: sessionNumber,
      start_time: sessionStartTime,
      is_engaged: isEngagedSession,
      interaction_count: interactionCount,
      duration: sessionStartTime ? Math.round((Date.now() - sessionStartTime) / 1000) : 0
    },
    total_sessions: parseInt(safeGetItem('te_total_sessions') || '0'),
    total_session_time: parseInt(safeGetItem('te_total_session_time') || '0'),
    average_session_time: parseInt(safeGetItem('te_average_session_time') || '0'),
    longest_session_time: parseInt(safeGetItem('te_longest_session_time') || '0'),
    engaged_sessions: parseInt(safeGetItem('te_engaged_sessions') || '0')
  };
}

/**
 * 디버깅용 함수
 */
function debugSession() {
  trackingLog('🔄 세션 디버깅 정보:');
  trackingLog('- 초기화 상태:', isInitialized);
  trackingLog('- 세션 ID:', sessionId);
  trackingLog('- 세션 번호:', sessionNumber);
  trackingLog('- localStorage 세션 번호:', safeGetItem('te_session_number'));
  trackingLog('- 세션 시작 시간:', sessionStartTime ? new Date(sessionStartTime).toLocaleString() : '없음');
  trackingLog('- 인게이지 세션:', isEngagedSession);
  trackingLog('- 상호작용 수:', interactionCount);
  trackingLog('- 마지막 활동 시간:', new Date(lastActivityTime).toLocaleString());
  trackingLog('- 세션 타임아웃:', Math.round(sessionTimeout / 60000) + '분');
  trackingLog('- ThinkingData SDK:', typeof window.te !== 'undefined' ? '로드됨' : '로드 안됨');
  
  // ✅ 추가 디버깅 정보
  trackingLog('- localStorage 전체 세션 관련 키들:');
  ['te_session_id', 'te_session_number', 'te_session_start_time', 'te_last_activity_time', 'te_is_engaged_session'].forEach(key => {
    trackingLog(`  ${key}:`, safeGetItem(key));
  });
}

// 세션 관리자 API
const sessionManager = {
  initialize: initializeSession,
  updateActivity: updateSessionActivity,
  endSession: endSession,
  getStatistics: getSessionStatistics,
  updateConfig: updateSessionConfig,
  debug: debugSession
};

// 브라우저 환경에서만 전역 등록 (중복 방지)
if (typeof window !== 'undefined' && !window.sessionManager) {
  window.sessionManager = sessionManager;
  
  // ✅ 추가 디버깅 함수들
  window.debugSessionNumber = function() {
    trackingLog('🔍 세션 번호 디버깅:');
    trackingLog('- 메모리 세션 번호:', sessionNumber);
    trackingLog('- localStorage 세션 번호:', safeGetItem('te_session_number'));
    trackingLog('- 세션 ID:', sessionId);
    trackingLog('- 세션 시작 시간:', sessionStartTime ? new Date(sessionStartTime).toLocaleString() : '없음');
    
    // localStorage 전체 확인
    trackingLog('- localStorage 전체 내용:');
    Object.keys(localStorage).filter(key => key.startsWith('te_')).forEach(key => {
      trackingLog(`  ${key}:`, localStorage.getItem(key));
    });
  };
  
  window.resetSessionNumber = function() {
    trackingLog('🔄 세션 번호 리셋...');
    sessionNumber = 0;
    safeSetItem('te_session_number', '0');
    trackingLog('✅ 세션 번호가 0으로 리셋되었습니다.');
  };
  
  window.forceNewSession = function() {
    trackingLog('🔄 강제 새 세션 시작...');
    endSession('manual_reset');
    startNewSession();
    trackingLog('✅ 새 세션이 시작되었습니다. 세션 번호:', sessionNumber);
  };
}

/**
 * 세션 초기화 함수 (외부 노출용)
 * @param {Object} config - 세션 설정
 * @returns {Promise} 초기화 완료 Promise
 */
export async function initSession(config = {}) {
  return initializeSession(config);
}

// 기타 함수 내보내기
export { updateSessionActivity, endSession, getSessionStatistics };

// ============================================
// 세션 UTM 관리 함수
// ============================================

/**
 * 세션 시작 시 UTM 파라미터 저장
 * - 현재 URL에서 UTM + 광고 ID (gclid, fbclid 등) 추출
 * - 세션 동안 유지되어 모든 이벤트에 포함됨
 */
function saveSessionUTM() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const utmData = {};

    // UTM 파라미터 추출
    SESSION_CONFIG.UTM_PARAMETERS.forEach(key => {
      const value = urlParams.get(key);
      if (value) {
        utmData[key] = value;
      }
    });

    // 광고 트래킹 ID 추출 (gclid, fbclid 등)
    SESSION_CONFIG.TRACKING_IDS.forEach(key => {
      const value = urlParams.get(key);
      if (value) {
        utmData[key] = value;
      }
    });

    // UTM 데이터가 있으면 저장
    if (Object.keys(utmData).length > 0) {
      safeSetItem(SESSION_CONFIG.SESSION_STORAGE_KEYS.SESSION_UTM, JSON.stringify(utmData));
      trackingLog('✅ 세션 UTM 저장:', utmData);
    } else {
      // UTM이 없으면 기존 저장된 값 삭제 (새 세션이므로)
      localStorage.removeItem(SESSION_CONFIG.SESSION_STORAGE_KEYS.SESSION_UTM);
    }
  } catch (e) {
    console.warn('세션 UTM 저장 실패:', e);
  }
}

/**
 * 저장된 세션 UTM 가져오기
 * - 이벤트 공통 속성에서 사용
 */
function getSessionUTM() {
  try {
    const stored = safeGetItem(SESSION_CONFIG.SESSION_STORAGE_KEYS.SESSION_UTM);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('세션 UTM 파싱 실패:', e);
  }
  return {};
}

// 세션 UTM 함수 내보내기
export { getSessionUTM };

// UTM 파라미터 변경 감지
function checkUtmChange() {
  const urlParams = new URLSearchParams(window.location.search);
  const currentUtm = urlParams.get('utm_source') || urlParams.get('utm_medium') || urlParams.get('utm_campaign');
  const previousUtm = safeGetItem('te_previous_utm');
  if (currentUtm && previousUtm && currentUtm !== previousUtm) {
    endSession('utm_change');
    startNewSession();
  }
  if (currentUtm) {
    safeSetItem('te_previous_utm', currentUtm);
  }
}

// 사용자 ID 변경 감지
function checkUserChange() {
  if (!window.te || !window.te.getDistinctId) return;
  const currentUser = window.te.getDistinctId();
  const previousUser = safeGetItem('te_previous_user');
  if (previousUser && currentUser !== previousUser) {
    endSession('user_change');
    startNewSession();
  }
  if (currentUser) {
    safeSetItem('te_previous_user', currentUser);
  }
}

// 날짜 변경 감지 및 기록 (세션 분리 X, 이벤트만 기록)
function checkDateChange() {
  const currentDate = new Date().toISOString().split('T')[0];
  const sessionDate = safeGetItem('te_session_date');
  if (sessionDate && currentDate !== sessionDate) {
    // 날짜가 바뀌었지만 세션은 유지
    safeTrackEvent('te_date_change_in_session', {
      session_id: sessionId,
      previous_date: sessionDate,
      current_date: currentDate,
      session_duration_so_far: Math.round((Date.now() - sessionStartTime) / 1000)
    });
    // 세션 속성에 날짜 변경 표시 추가
    if (window.te && window.te.userSetOnce) {
      window.te.userSetOnce({ has_date_change: true });
    }
  }
  safeSetItem('te_session_date', currentDate);
}