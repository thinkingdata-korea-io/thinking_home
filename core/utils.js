/**
 * 공통 유틸리티 모듈
 * 모든 추적 모듈에서 공통으로 사용하는 함수들
 */

// =============================================================================
// 상수 정의
// =============================================================================

// 봇 감지 관련 상수
const BOT_DETECTION_CONFIG = {
  // 신뢰도 임계값
  CONFIDENCE_THRESHOLD: 70,
  
  // 각 검사별 신뢰도 점수
  CONFIDENCE_SCORES: {
    USER_AGENT_PATTERN: 80,
    WEBDRIVER_PROPERTY: 90,
    AUTOMATION_INDICATORS: 60,
    DEFAULT_LANGUAGE: 20,
    NO_PLUGINS: 30,
    BOT_RESOLUTION: 25,
    FAST_LOAD_TIME: 15,
    NO_USER_INTERACTION: 40,
    SERVER_INFO_EXPOSED: 10
  },
  
  // 검사 관련 설정
  USER_INTERACTION_TIMEOUT: 5000, // 5초
  FAST_LOAD_THRESHOLD: 1000, // 1초
  AUTOMATION_INDICATOR_THRESHOLD: 3
};

// 봇 패턴 정의
const BOT_PATTERNS = {
  // 검색엔진 봇
  'googlebot': { name: 'Google Bot', type: 'search_engine' },
  'bingbot': { name: 'Bing Bot', type: 'search_engine' },
  'slurp': { name: 'Yahoo Slurp', type: 'search_engine' },
  'duckduckbot': { name: 'DuckDuckGo Bot', type: 'search_engine' },
  'baiduspider': { name: 'Baidu Spider', type: 'search_engine' },
  'naverbot': { name: 'Naver Bot', type: 'search_engine' },
  'daumoa': { name: 'Daum Bot', type: 'search_engine' },
  
  // 소셜 미디어 봇
  'facebookexternalhit': { name: 'Facebook Bot', type: 'social_media' },
  'twitterbot': { name: 'Twitter Bot', type: 'social_media' },
  'linkedinbot': { name: 'LinkedIn Bot', type: 'social_media' },
  'whatsapp': { name: 'WhatsApp Bot', type: 'social_media' },
  
  // AI/챗봇 봇
  'chatgpt': { name: 'ChatGPT', type: 'ai_chatbot' },
  'claude': { name: 'Claude', type: 'ai_chatbot' },
  'bard': { name: 'Google Bard', type: 'ai_chatbot' },
  'copilot': { name: 'GitHub Copilot', type: 'ai_chatbot' },
  'perplexity': { name: 'Perplexity', type: 'ai_chatbot' },
  
  // 자동화 도구
  'selenium': { name: 'Selenium', type: 'automation' },
  'webdriver': { name: 'WebDriver', type: 'automation' },
  'puppeteer': { name: 'Puppeteer', type: 'automation' },
  'playwright': { name: 'Playwright', type: 'automation' },
  'cypress': { name: 'Cypress', type: 'automation' },
  'headless': { name: 'Headless Browser', type: 'automation' },
  
  // 일반 크롤러
  'scraper': { name: 'Web Scraper', type: 'scraper' },
  'crawler': { name: 'Web Crawler', type: 'crawler' },
  'spider': { name: 'Web Spider', type: 'crawler' },
  'bot': { name: 'Generic Bot', type: 'generic_bot' },
  
  // HTTP 클라이언트
  'curl': { name: 'cURL', type: 'http_client' },
  'wget': { name: 'wget', type: 'http_client' },
  'python': { name: 'Python Bot', type: 'script' },
  'requests': { name: 'Python Requests', type: 'script' },
  'urllib': { name: 'Python urllib', type: 'script' }
};

// AI 챗봇 패턴
const AI_CHATBOT_PATTERNS = {
  'chatgpt': 'ChatGPT',
  'claude': 'Claude',
  'bard': 'Google Bard',
  'copilot': 'GitHub Copilot',
  'perplexity': 'Perplexity',
  'bing': 'Bing Chat',
  'duckduckgo': 'DuckDuckGo AI'
};

// 브라우저 감지 패턴 (통합)
const BROWSER_PATTERNS = [
  { name: 'Chrome', pattern: 'Chrome', exclude: null, versionRegex: /Chrome\/(\d+\.\d+)/ },
  { name: 'Firefox', pattern: 'Firefox', exclude: null, versionRegex: /Firefox\/(\d+\.\d+)/ },
  { name: 'Safari', pattern: 'Safari', exclude: 'Chrome', versionRegex: /Version\/(\d+\.\d+)/ },
  { name: 'Edge', pattern: 'Edge', exclude: null, versionRegex: /Edge\/(\d+\.\d+)/ },
  { name: 'Internet Explorer', pattern: ['MSIE', 'Trident'], exclude: null, versionRegex: /(MSIE|rv:)\s*(\d+\.\d+)/ }
];

// 디바이스 감지 패턴
const DEVICE_PATTERNS = {
  MOBILE: /mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i,
  TABLET: /tablet|ipad/i,
  DESKTOP: /desktop|windows|macintosh|linux/i
};

// 일반적인 봇 해상도 패턴
const BOT_RESOLUTIONS = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1024, height: 768 },
  { width: 800, height: 600 }
];

// 자동화 도구 감지 지표
const AUTOMATION_INDICATORS = [
  'window.chrome && window.chrome.runtime',
  'window.Notification',
  'window.outerHeight',
  'window.outerWidth',
  'window.screenX',
  'window.screenY'
];

// 기타 설정
const UTILS_CONFIG = {
  PENDING_EVENTS_MAX: 100,
  PENDING_EVENTS_KEY: 'te_pending_events',
  STORAGE_TEST_KEY: 'te_storage_test',
  
  // 캐시 설정
  BROWSER_INFO_CACHE_TIME: 300000, // 5분
  DEVICE_INFO_CACHE_TIME: 300000,  // 5분
  PAGE_INFO_CACHE_TIME: 60000      // 1분
};

// 캐시 관련 변수
let botDetectionCache = null;
let botDetectionCacheTime = 0;
let browserInfoCache = null;
let browserInfoCacheTime = 0;
let deviceInfoCache = null;
let deviceInfoCacheTime = 0;

const BOT_DETECTION_CACHE_TIME = 60000; // 1분

// =============================================================================
// 핵심 유틸리티 함수들
// =============================================================================

// 안전한 ThinkingData SDK 호출
export function safeTeCall(method, ...args) {
  try {
    if (typeof window.te !== 'undefined' && window.te[method]) {
      return window.te[method](...args);
    } else {
      console.warn(`ThinkingData SDK의 ${method} 메서드를 사용할 수 없습니다.`);
      return false;
    }
  } catch (error) {
    console.error(`ThinkingData SDK ${method} 호출 실패:`, error);
    return false;
  }
}

// 안전한 이벤트 전송 (SDK 없어도 동작, 최적화)
export function trackEvent(eventName, properties = {}) {
  try {
    // SDK가 있는 경우 정상 전송
    if (window.te?.track) {
      return window.te.track(eventName, properties);
    }
    
    // SDK가 없는 경우 로컬 스토리지에 임시 저장
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const pendingEventsJson = localStorage.getItem(UTILS_CONFIG.PENDING_EVENTS_KEY) || '[]';
      const pendingEvents = JSON.parse(pendingEventsJson);
      
      pendingEvents.push({
        eventName,
        properties,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
      
      // 최대 개수 제한 (메모리 보호)
      if (pendingEvents.length > UTILS_CONFIG.PENDING_EVENTS_MAX) {
        pendingEvents.splice(0, pendingEvents.length - UTILS_CONFIG.PENDING_EVENTS_MAX);
      }
      
      localStorage.setItem(UTILS_CONFIG.PENDING_EVENTS_KEY, JSON.stringify(pendingEvents));
      
      trackingLog(`📤 이벤트 임시 저장: ${eventName}`, properties);
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.warn(`이벤트 전송 실패 (${eventName}):`, error);
    return false;
  }
}

// 세션 활동 업데이트 함수 (세션 관리자에서 실제 구현)
export function updateSessionActivity() {
  if (
    typeof window.updateSessionActivity === 'function' &&
    window.updateSessionActivity !== updateSessionActivity
  ) {
    window.updateSessionActivity();
  } else {
    // 기본 동작 또는 아무것도 안함
    // 예: window.lastActivityTime = Date.now();
  }
}

// 안전한 시간 형식 통일 함수
export function formatTimestamp(date = new Date()) {
  try {
    return date.toISOString().replace('T', ' ').slice(0, 23);
  } catch (error) {
    console.warn('시간 형식 변환 실패:', error);
    return new Date().toISOString().replace('T', ' ').slice(0, 23);
  }
}

// 안전한 텍스트 추출 함수 (null/undefined 안전)
export function safeGetText(element) {
  try {
    return element?.textContent?.trim() || '';
  } catch (error) {
    console.warn('텍스트 추출 실패:', error);
    return '';
  }
}

// 안전한 속성 추출 함수
export function safeGetAttribute(element, attribute) {
  try {
    return element?.getAttribute?.(attribute) || '';
  } catch (error) {
    console.warn(`속성 ${attribute} 추출 실패:`, error);
    return '';
  }
}

// 안전한 클래스 리스트 추출
export function safeGetClassList(element) {
  try {
    return element?.className ? element.className.split(' ').filter(cls => cls.trim()) : [];
  } catch (error) {
    console.warn('클래스 리스트 추출 실패:', error);
    return [];
  }
}

// 중앙화된 에러 핸들러
export function handleError(context, error, fallback = null) {
  console.error(`[${context}] 오류:`, error);
  // 에러 로깅 (나중에 외부 서비스 연동 가능)
  if (window.te && typeof window.te.track === 'function') {
    try {
      window.te.track('tracking_error', {
        context: context,
        error_message: error?.message || String(error),
        timestamp: formatTimestamp()
      });
    } catch (e) {
      // 에러 추적도 실패한 경우 조용히 무시
    }
  }
  return fallback;
}

// 디바이스 타입 감지 (캐싱 적용)
export function getDeviceType() {
  // 캐시 체크
  const now = Date.now();
  if (deviceInfoCache && (now - deviceInfoCacheTime) < UTILS_CONFIG.DEVICE_INFO_CACHE_TIME) {
    return deviceInfoCache.type;
  }
  
  const userAgent = navigator.userAgent.toLowerCase();
  let deviceType = 'desktop';
  
  if (DEVICE_PATTERNS.MOBILE.test(userAgent)) {
    deviceType = DEVICE_PATTERNS.TABLET.test(userAgent) ? 'tablet' : 'mobile';
  }
  
  // 캐시 저장
  deviceInfoCache = {
    type: deviceType,
    screen_width: screen.width,
    screen_height: screen.height,
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight
  };
  deviceInfoCacheTime = now;
  
  return deviceType;
}

// 브라우저 정보 추출 (캐싱 적용, 중복 로직 제거)
export function getBrowserInfo() {
  // 캐시 체크
  const now = Date.now();
  if (browserInfoCache && (now - browserInfoCacheTime) < UTILS_CONFIG.BROWSER_INFO_CACHE_TIME) {
    return { ...browserInfoCache };
  }
  
  const userAgent = navigator.userAgent;
  let browser = 'unknown';
  let version = 'unknown';
  
  // BROWSER_PATTERNS를 사용하여 통합된 로직
  for (const browserPattern of BROWSER_PATTERNS) {
    const patterns = Array.isArray(browserPattern.pattern) ? browserPattern.pattern : [browserPattern.pattern];
    const hasPattern = patterns.some(pattern => userAgent.includes(pattern));
    const hasExclude = browserPattern.exclude && userAgent.includes(browserPattern.exclude);
    
    if (hasPattern && !hasExclude) {
      browser = browserPattern.name;
      const versionMatch = userAgent.match(browserPattern.versionRegex);
      if (versionMatch) {
        version = versionMatch[1] || versionMatch[2] || 'unknown';
      }
      break;
    }
  }
  
  // 캐시 저장
  browserInfoCache = { browser, version };
  browserInfoCacheTime = now;
  
  return { browser, version };
}

// 간단한 해시 함수
export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 32비트 정수로 변환
  }
  return Math.abs(hash).toString(36);
}

// 텍스트 기반 ID 생성
export function generateTextBasedId(text) {
  if (!text) return 'no_text';
  
  const cleanText = text.replace(/[^a-zA-Z0-9가-힣]/g, '').toLowerCase();
  const hash = simpleHash(cleanText);
  
  return `text_${cleanText.substring(0, 10)}_${hash}`;
}

// 클래스 기반 ID 생성
export function generateClassBasedId(classList) {
  if (!classList || classList.length === 0) return 'no_class';
  
  const meaningfulClassPatterns = window.meaningfulClassPatterns || [
    'btn', 'button', 'link', 'w-', 'brix', 'div-block'
  ];
  
  const meaningfulClasses = classList.filter(cls => 
    meaningfulClassPatterns.some(pattern => cls.includes(pattern))
  );
  
  if (meaningfulClasses.length === 0) return 'no_meaningful_class';
  
  const classString = meaningfulClasses.join('_');
  const hash = simpleHash(classString);
  
  return `class_${classString.substring(0, 15)}_${hash}`;
}

// 위치 기반 ID 생성
export function generatePositionBasedId(element) {
  const rect = element.getBoundingClientRect();
  const pageY = window.pageYOffset + rect.top;
  const pageX = window.pageXOffset + rect.left;
  
  const positionHash = simpleHash(`${Math.round(pageX)}_${Math.round(pageY)}`);
  
  return `pos_${Math.round(pageX)}_${Math.round(pageY)}_${positionHash}`;
}

// 외부 링크 판단
export function isExternalLink(url) {
  try {
    const linkHost = new URL(url).hostname;
    const currentHost = window.location.hostname;
    return linkHost !== currentHost;
  } catch (e) {
    return false;
  }
}

// 개인정보 마스킹 함수들
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  
  const parts = email.split('@');
  if (parts.length !== 2) return '***@***.***';
  
  const [localPart, domain] = parts;
  const domainParts = domain.split('.');
  
  const maskedLocal = localPart.length > 1 ? localPart[0] + '***' : '***';
  const maskedDomain = domainParts.length > 1 ? 
    domainParts[0][0] + '***.' + domainParts[domainParts.length - 1] : 
    '***.' + domainParts[0];
    
  return maskedLocal + '@' + maskedDomain;
}

export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  
  const numbers = phone.replace(/\D/g, '');
  
  if (numbers.length >= 10) {
    return numbers.substring(0, 3) + '-****-' + numbers.slice(-4);
  } else if (numbers.length >= 7) {
    return numbers.substring(0, 2) + '***' + numbers.slice(-2);
  } else {
    return '***-****-****';
  }
}

export function maskName(name) {
  if (!name || typeof name !== 'string') return '';
  
  const trimmed = name.trim();
  if (trimmed.length <= 1) {
    return '*';
  } else if (trimmed.length === 2) {
    return trimmed[0] + '*';
  } else {
    return trimmed[0] + '***' + trimmed[trimmed.length - 1];
  }
}

// 요소 가시성 확인
export function isElementVisible(element) {
  if (!element) return false;
  
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  
  return rect.width > 0 && 
         rect.height > 0 && 
         style.visibility !== 'hidden' && 
         style.display !== 'none' &&
         rect.top < window.innerHeight &&
         rect.bottom > 0;
}

// 페이지 로드 시간 측정 (최적화)
export function getPageLoadTime() {
  try {
    if (performance?.timing) {
      const { loadEventEnd, navigationStart } = performance.timing;
      return loadEventEnd && navigationStart ? loadEventEnd - navigationStart : 0;
    } 
    
    if (performance?.getEntriesByType) {
      const navigation = performance.getEntriesByType('navigation')?.[0];
      if (navigation?.loadEventEnd && navigation?.startTime) {
        return navigation.loadEventEnd - navigation.startTime;
      }
    }
  } catch (error) {
    console.warn('페이지 로드 시간 측정 실패:', error);
  }
  
  return 0;
}

// 안전한 패턴 매칭 함수
export function safeMatchPatterns(element, patterns) {
  try {
    if (!element || !patterns) return '';
    
    const text = safeGetText(element);
    const href = element.href || '';
    const classList = safeGetClassList(element);
    const id = safeGetAttribute(element, 'id');
    
    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.text && pattern.text.some(p => text.toLowerCase().includes(p.toLowerCase()))) {
        return type;
      }
      if (pattern.url && pattern.url.some(p => href.toLowerCase().includes(p.toLowerCase()))) {
        return type;
      }
      if (pattern.id && pattern.id.some(p => id.toLowerCase().includes(p.toLowerCase()))) {
        return type;
      }
      if (pattern.class && pattern.class.some(p => classList.some(cls => cls.toLowerCase().includes(p.toLowerCase())))) {
        return type;
      }
    }
    
    return '';
  } catch (error) {
    return handleError('safeMatchPatterns', error, '');
  }
}

// 설정 관리자 클래스
export class ConfigManager {
    constructor() {
      this.configs = {};
    }
    
    setConfig(module, config) {
      this.configs[module] = { ...this.configs[module], ...config };
    }
    
    getConfig(module) {
      return this.configs[module] || {};
    }
    
    updateConfig(module, updates) {
      this.setConfig(module, updates);
      trackingLog(`🔄 ${module} 설정 업데이트 완료:`, updates);
    }
  }
  
// 모듈 상태 관리자 클래스
export class ModuleStateManager {
    constructor() {
      this.initialized = new Set();
      this.pending = new Set();
      this.failed = new Set();
    }
    
    isInitialized(moduleName) {
      return this.initialized.has(moduleName);
    }
    
    markInitialized(moduleName) {
      this.initialized.add(moduleName);
      this.pending.delete(moduleName);
      this.failed.delete(moduleName);
    }
    
    markPending(moduleName) {
      this.pending.add(moduleName);
    }
    
    markFailed(moduleName, error) {
      this.failed.add(moduleName);
      this.pending.delete(moduleName);
      handleError(`ModuleStateManager`, `${moduleName} 초기화 실패: ${error}`);
    }
    
    getStatus(moduleName) {
      if (this.initialized.has(moduleName)) return 'initialized';
      if (this.pending.has(moduleName)) return 'pending';
      if (this.failed.has(moduleName)) return 'failed';
      return 'not_started';
    }
  }
  
// 전역 객체에 유틸리티 함수 등록 (하위 호환성 유지)
export function registerGlobalUtils() {
  // 중복 등록 방지
  if (window.utilsRegistered) return;
  
  // 주요 함수들을 전역 객체에 등록
  const utils = {
    safeTeCall, trackEvent, updateSessionActivity, formatTimestamp,
    safeGetText, safeGetAttribute, safeGetClassList, handleError,
    getDeviceType, getBrowserInfo, simpleHash,
    generateTextBasedId, generateClassBasedId, generatePositionBasedId,
    isExternalLink, maskEmail, maskPhone, maskName,
    isElementVisible, getPageLoadTime, safeMatchPatterns,
    sendPendingEvents
  };
  
  // 전역 객체에 등록
  Object.entries(utils).forEach(([name, func]) => {
    window[name] = func;
  });
  
  // 클래스 인스턴스 생성 및 등록
  if (!window.configManager) {
    window.ConfigManager = ConfigManager;
    window.configManager = new ConfigManager();
  }
  
  if (!window.moduleStateManager) {
  window.ModuleStateManager = ModuleStateManager;
  window.moduleStateManager = new ModuleStateManager();
}

  window.utilsRegistered = true;
      trackingLog('✅ 공통 유틸리티 함수 전역 등록 완료');
}

// 전역 함수 등록 (선택적으로 호출 가능)
// registerGlobalUtils(); 

// =============================================================================
// 봇 감지 관련 함수들 (모듈화)
// =============================================================================

/**
 * User-Agent 기반 봇 감지
 */
function checkUserAgentPatterns(userAgent, botInfo) {
  let confidence = 0;
  
  for (const [pattern, info] of Object.entries(BOT_PATTERNS)) {
    if (userAgent.includes(pattern)) {
      botInfo.is_bot = true;
      botInfo.bot_type = info.type;
      botInfo.bot_name = info.name;
      botInfo.detection_method.push('user_agent_pattern');
      confidence += BOT_DETECTION_CONFIG.CONFIDENCE_SCORES.USER_AGENT_PATTERN;
      break;
    }
  }
  
  return confidence;
}

/**
 * WebDriver 속성 체크
 */
function checkWebDriverProperty(botInfo) {
  let confidence = 0;
  
  if (navigator.webdriver) {
    botInfo.is_bot = true;
    botInfo.bot_type = botInfo.bot_type || 'automation';
    botInfo.bot_name = botInfo.bot_name || 'WebDriver Bot';
    botInfo.detection_method.push('webdriver_property');
    confidence += BOT_DETECTION_CONFIG.CONFIDENCE_SCORES.WEBDRIVER_PROPERTY;
  }
  
  return confidence;
}

/**
 * 자동화 도구 감지
 */
function checkAutomationIndicators(botInfo) {
  let confidence = 0;
  let automationScore = 0;
  
  AUTOMATION_INDICATORS.forEach(indicator => {
    try {
      const parts = indicator.split('&&').map(p => p.trim());
      let result = true;
      for (const part of parts) {
        const props = part.split('.').map(p => p.trim());
        let obj = window;
        for (const prop of props) {
          if (prop === 'window') continue;
          obj = obj?.[prop];
          if (obj === undefined) { obj = undefined; break; }
        }
        if (!obj) { result = false; break; }
      }
      if (!result) {
        automationScore++;
      }
    } catch (e) {
      automationScore++;
    }
  });

  if (automationScore >= BOT_DETECTION_CONFIG.AUTOMATION_INDICATOR_THRESHOLD) {
    botInfo.is_bot = true;
    botInfo.bot_type = botInfo.bot_type || 'automation';
    botInfo.bot_name = botInfo.bot_name || 'Automation Tool';
    botInfo.detection_method.push('automation_indicators');
    confidence += BOT_DETECTION_CONFIG.CONFIDENCE_SCORES.AUTOMATION_INDICATORS;
  }
  
  return confidence;
}

/**
 * 언어/로케일 체크
 */
function checkDefaultLanguage(botInfo) {
  let confidence = 0;
  
  const language = navigator.language || navigator.userLanguage;
  const languages = navigator.languages;
  
  if (!language || language === 'en-US' || language === 'en') {
    if (!languages || languages.length === 0 || languages[0] === 'en-US') {
      confidence += BOT_DETECTION_CONFIG.CONFIDENCE_SCORES.DEFAULT_LANGUAGE;
      botInfo.detection_method.push('default_language');
    }
  }
  
  return confidence;
}

/**
 * 플러그인 체크
 */
function checkPlugins(botInfo) {
  let confidence = 0;
  
  try {
    const { plugins } = navigator;
    if (plugins && plugins.length === 0) {
      confidence += BOT_DETECTION_CONFIG.CONFIDENCE_SCORES.NO_PLUGINS;
      botInfo.detection_method.push('no_plugins');
    }
  } catch (error) {
    // 플러그인 접근 실패 시 봇 점수 추가
    confidence += BOT_DETECTION_CONFIG.CONFIDENCE_SCORES.NO_PLUGINS / 2;
    botInfo.detection_method.push('plugin_access_failed');
  }
  
  return confidence;
}

/**
 * 화면 해상도 체크
 */
function checkBotResolution(botInfo) {
  let confidence = 0;
  
  const screenWidth = window.screen.width;
  const screenHeight = window.screen.height;

  const isBotResolution = BOT_RESOLUTIONS.some(res => 
    screenWidth === res.width && screenHeight === res.height
  );

  if (isBotResolution) {
    confidence += BOT_DETECTION_CONFIG.CONFIDENCE_SCORES.BOT_RESOLUTION;
    botInfo.detection_method.push('bot_resolution');
  }
  
  return confidence;
}

/**
 * 페이지 로드 시간 체크 (최적화)
 */
function checkLoadTime(botInfo) {
  let confidence = 0;
  
  try {
    const pageLoadTime = getPageLoadTime(); // 기존 함수 재사용
    
    if (pageLoadTime > 0 && pageLoadTime < BOT_DETECTION_CONFIG.FAST_LOAD_THRESHOLD) {
      confidence += BOT_DETECTION_CONFIG.CONFIDENCE_SCORES.FAST_LOAD_TIME;
      botInfo.detection_method.push('fast_load_time');
    }
  } catch (error) {
    console.warn('로드 시간 체크 실패:', error);
  }
  
  return confidence;
}

/**
 * 사용자 상호작용 체크 (비동기)
 */
function checkUserInteraction(botInfo, callback) {
  let hasUserInteraction = false;
  
  const checkInteraction = () => {
    hasUserInteraction = true;
    document.removeEventListener('mousemove', checkInteraction);
    document.removeEventListener('keydown', checkInteraction);
    document.removeEventListener('click', checkInteraction);
  };

  document.addEventListener('mousemove', checkInteraction, { once: true });
  document.addEventListener('keydown', checkInteraction, { once: true });
  document.addEventListener('click', checkInteraction, { once: true });

  setTimeout(() => {
    if (!hasUserInteraction) {
      botInfo.detection_method.push('no_user_interaction');
      if (callback) {
        callback(BOT_DETECTION_CONFIG.CONFIDENCE_SCORES.NO_USER_INTERACTION);
      }
    }
  }, BOT_DETECTION_CONFIG.USER_INTERACTION_TIMEOUT);
}

/**
 * 봇 감지 메인 함수 (최적화 및 캐싱)
 */
export function detectBot() {
  // 캐시 체크
  const now = Date.now();
  if (botDetectionCache && (now - botDetectionCacheTime) < BOT_DETECTION_CACHE_TIME) {
    return { ...botDetectionCache }; // 복사본 반환
  }

  const botInfo = {
    is_bot: false,
    bot_type: null,
    bot_name: null,
    detection_method: [],
    confidence: 0
  };

  const userAgent = navigator.userAgent.toLowerCase();
  let confidence = 0;

  // 각 검사 수행
  confidence += checkUserAgentPatterns(userAgent, botInfo);
  confidence += checkWebDriverProperty(botInfo);
  confidence += checkAutomationIndicators(botInfo);
  confidence += checkDefaultLanguage(botInfo);
  confidence += checkPlugins(botInfo);
  confidence += checkBotResolution(botInfo);
  confidence += checkLoadTime(botInfo);

  // 비동기 사용자 상호작용 체크
  checkUserInteraction(botInfo, (additionalConfidence) => {
    botInfo.confidence += additionalConfidence;
    botInfo.confidence = Math.min(botInfo.confidence, 100);
    if (botInfo.confidence >= BOT_DETECTION_CONFIG.CONFIDENCE_THRESHOLD) {
      botInfo.is_bot = true;
    }
  });

  // 최종 신뢰도 계산
  botInfo.confidence = Math.min(confidence, 100);

  // 봇 판정
  if (botInfo.confidence >= BOT_DETECTION_CONFIG.CONFIDENCE_THRESHOLD) {
    botInfo.is_bot = true;
  }

  // 캐시 저장
  botDetectionCache = { ...botInfo };
  botDetectionCacheTime = now;

  return botInfo;
}

// 간단한 봇 감지 (빠른 체크, BOT_PATTERNS 재사용)
export function isBot() {
  const userAgent = navigator.userAgent.toLowerCase();
  
  // BOT_PATTERNS에서 패턴만 추출하여 체크
  const botKeywords = Object.keys(BOT_PATTERNS);
  
  return botKeywords.some(keyword => userAgent.includes(keyword)) || 
         navigator.webdriver === true;
}

// AI 챗봇 특별 감지 (상수 재사용)
export function detectAIChatbot() {
  const userAgent = navigator.userAgent.toLowerCase();
  
  // AI_CHATBOT_PATTERNS 상수 재사용
  for (const [pattern, name] of Object.entries(AI_CHATBOT_PATTERNS)) {
    if (userAgent.includes(pattern)) {
      return {
        is_ai_chatbot: true,
        ai_name: name,
        user_agent: userAgent
      };
    }
  }
  
  return { is_ai_chatbot: false };
}

// 봇 정보를 이벤트 속성에 추가하는 헬퍼 함수
export function addBotInfoToEvent(properties = {}) {
  const botInfo = detectBot();
  const aiInfo = detectAIChatbot();
  
  return {
    ...properties,
    is_bot: botInfo.is_bot,
    bot_type: botInfo.bot_type,
    bot_name: botInfo.bot_name,
    bot_confidence: botInfo.confidence,
    bot_detection_methods: botInfo.detection_method,
    is_ai_chatbot: aiInfo.is_ai_chatbot,
    ai_chatbot_name: aiInfo.ai_name
  };
}

// ThinkingData 시간 형식 변환 함수들
export function convertToTETimeFormat(dateInput) {
  try {
    let date;
    
    // 입력 타입에 따른 처리
    if (dateInput instanceof Date) {
      date = dateInput;
    } else if (typeof dateInput === 'string') {
      // ISO 문자열인 경우
      if (dateInput.includes('T') && dateInput.includes('Z')) {
        date = new Date(dateInput);
      } else if (dateInput.includes('T')) {
        // ISO 문자열이지만 Z가 없는 경우
        date = new Date(dateInput);
      } else {
        // 기타 문자열 형식
        date = new Date(dateInput);
      }
    } else if (typeof dateInput === 'number') {
      // 타임스탬프인 경우 (밀리초 단위로 가정)
      // 13자리면 밀리초, 10자리면 초 단위
      if (dateInput.toString().length === 10) {
        date = new Date(dateInput * 1000); // 초를 밀리초로 변환
      } else {
        date = new Date(dateInput); // 밀리초로 가정
      }
    } else {
      // 현재 시간
      date = new Date();
    }
    
    // 유효한 날짜인지 확인
    if (isNaN(date.getTime())) {
      console.warn('유효하지 않은 날짜 입력:', dateInput);
      return new Date().toISOString().replace('T', ' ').slice(0, 23);
    }
    
    // ThinkingData 형식: "yyyy-MM-dd HH:mm:ss.SSS"
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
  } catch (error) {
    console.warn('시간 형식 변환 실패:', error, '입력값:', dateInput);
    return new Date().toISOString().replace('T', ' ').slice(0, 23);
  }
}

// 시간 속성을 TE 형식으로 변환하여 추가하는 함수
export function addTETimeProperties(properties = {}) {
  const teTimeProperties = {};
  
  // 시간 관련 속성들을 TE 형식으로 변환
  const timeProperties = [
    'local_time',
    'timestamp',
    'created_at',
    'updated_at',
    'start_time',
    'end_time',
    'event_time',
    'session_start_time',
    'session_end_time',
    'form_submission_time',
    'interaction_time',
    'error_time',
    // 숫자 타임스탬프 속성들 추가
    'first_visit_timestamp',
    'last_visit_timestamp',
    'session_start_timestamp',
    'session_end_timestamp',
    'page_load_timestamp',
    'interaction_timestamp',
    'form_timestamp',
    'click_timestamp',
    'scroll_timestamp',
    'exit_timestamp'
  ];
  
  timeProperties.forEach(propName => {
    if (properties[propName] !== undefined && properties[propName] !== null) {
      const teFormattedTime = convertToTETimeFormat(properties[propName]);
      teTimeProperties[`${propName}_te`] = teFormattedTime;
    }
  });
  
  // 현재 시간도 추가
  teTimeProperties['current_time_te'] = convertToTETimeFormat(new Date());
  
  return {
    ...properties,
    ...teTimeProperties
  };
}

// 특정 시간 속성을 TE 형식으로 변환
export function convertTimePropertyToTE(properties = {}, propertyName) {
  if (properties[propertyName]) {
    const teFormattedTime = convertToTETimeFormat(properties[propertyName]);
    return {
      ...properties,
      [`${propertyName}_te`]: teFormattedTime
    };
  }
  return properties;
}

// 트래킹 로그 전용 함수 (config.debug.showConsoleLogs로 제어)
export function trackingLog(...args) {
  // config에서 로그 설정 확인
  if (window.trackingConfig && window.trackingConfig.debug && window.trackingConfig.debug.showConsoleLogs) {
    console.log(...args);
  }
}

// 세션 정보가 포함된 슈퍼 프로퍼티 갱신 함수
export function updateSuperPropertiesWithSession(sessionId, sessionNumber, extraProps = {}) {
  if (window.te && typeof window.te.setSuperProperties === 'function') {
    const baseProps = {
      session_id: sessionId,
      session_number: sessionNumber,
      ...extraProps
    };
    window.te.setSuperProperties(baseProps);
    trackingLog('🪪 setSuperProperties 갱신:', baseProps);
  }
}

// 임시 저장된 이벤트들을 ThinkingData로 전송
export function sendPendingEvents() {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
      return false;
    }
    
    const pendingEvents = JSON.parse(localStorage.getItem('te_pending_events') || '[]');
    if (pendingEvents.length === 0) {
      return true;
    }
    
    if (typeof window.te === 'undefined' || typeof window.te.track !== 'function') {
      return false;
    }
    
    const failedEvents = [];
    let successCount = 0;

    pendingEvents.forEach(event => {
      try {
        window.te.track(event.eventName, event.properties);
        successCount++;
      } catch (error) {
        console.warn(`임시 이벤트 전송 실패 (${event.eventName}):`, error);
        failedEvents.push(event);
      }
    });

    // 실패한 이벤트만 남기고 나머지 제거
    if (successCount > 0) {
      localStorage.setItem('te_pending_events', JSON.stringify(failedEvents));
      
      if (window.trackingLog) {
        window.trackingLog(`📤 임시 이벤트 전송 완료: ${successCount}개 성공, ${failedEvents.length}개 실패`);
      }
    }
    
    return successCount > 0;
  } catch (error) {
    console.error('임시 이벤트 전송 중 오류:', error);
    return false;
  }
} 