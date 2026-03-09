/**
 * ThinkingData 운영 SDK (TDStrategy) 초기화 모듈
 * TE 클라이언트 트리거 방식 과제 기능을 위한 SDK 연동
 *
 * 필수 SDK 로드 순서:
 * 1. thinkingdata.umd.min.js (Analytics)
 * 2. tdcore.umd.min.js (Core)
 * 3. tdremoteconfig.umd.min.js (Remote Config)
 * 4. tdstrategy.umd.min.js (Strategy)
 */

// 운영 SDK 초기화 상태
let isOperateSDKInitialized = false;

// 트리거 결과 핸들러 저장소
let triggerHandlers = [];

/**
 * 운영 SDK 존재 여부 확인
 * @returns {Object|null} SDK 객체 또는 null
 */
function findOperateSDK() {
  if (typeof window === 'undefined') {
    return null;
  }

  // TDApp (통합 초기화 객체) 확인
  if (typeof window.TDApp !== 'undefined') {
    return {
      TDApp: window.TDApp,
      TDAnalytics: window.TDAnalytics,
      TDStrategy: window.TDStrategy,
      TDRemoteConfig: window.TDRemoteConfig
    };
  }

  return null;
}

/**
 * 기본 트리거 리스너
 * 과제 트리거 결과를 처리하고 등록된 핸들러들에게 전달
 * @param {Object} result - 트리거 결과 객체
 */
function defaultTriggerListener(result) {
  if (window.trackingConfig?.debug?.showConsoleLogs) {
    console.log('📬 운영 과제 트리거 수신:', result);
  }

  // 결과 객체 구조
  // - channelMsgType: 채널 메시지 타입
  // - appId: 프로젝트 app id
  // - pushId: 과제의 채널 발송 ID
  // - taskId: 과제 ID
  // - content: 과제 푸시 내용
  // - userParams: 커스텀 클라이언트 파라미터
  // - opsProperties: 채널 정보 및 퍼널 이벤트 회신 파라미터

  // 등록된 핸들러들에게 결과 전달
  triggerHandlers.forEach(handler => {
    try {
      handler(result);
    } catch (error) {
      console.warn('⚠️ 트리거 핸들러 실행 오류:', error);
    }
  });

  // 도달 퍼널 이벤트 자동 전송 (opsProperties가 있는 경우)
  if (result.opsProperties && window.TDAnalytics) {
    try {
      window.TDAnalytics.track('ops_receive', result.opsProperties);
    } catch (error) {
      console.warn('⚠️ 도달 퍼널 이벤트 전송 실패:', error);
    }
  }

  // 커스텀 이벤트 발생
  window.dispatchEvent(new CustomEvent('te:trigger', {
    detail: result
  }));
}

/**
 * 트리거 핸들러 등록
 * @param {Function} handler - 트리거 결과를 처리할 핸들러 함수
 */
function addTriggerHandler(handler) {
  if (typeof handler === 'function') {
    triggerHandlers.push(handler);
  }
}

/**
 * 트리거 핸들러 제거
 * @param {Function} handler - 제거할 핸들러 함수
 */
function removeTriggerHandler(handler) {
  triggerHandlers = triggerHandlers.filter(h => h !== handler);
}

/**
 * 클라이언트 파라미터 설정
 * 과제 조건에 사용할 커스텀 파라미터 등록
 * @param {Object} params - 파라미터 객체
 */
function setClientParams(params) {
  if (!window.TDStrategy) {
    console.warn('⚠️ TDStrategy SDK가 로드되지 않았습니다.');
    return false;
  }

  try {
    window.TDStrategy.addClientParams(params);
    return true;
  } catch (error) {
    console.warn('⚠️ 클라이언트 파라미터 설정 실패:', error);
    return false;
  }
}

/**
 * 원격 설정 수동 가져오기
 */
function fetchRemoteConfig() {
  if (!window.TDStrategy) {
    console.warn('⚠️ TDStrategy SDK가 로드되지 않았습니다.');
    return false;
  }

  try {
    window.TDStrategy.fetch();
    return true;
  } catch (error) {
    console.warn('⚠️ 원격 설정 가져오기 실패:', error);
    return false;
  }
}

/**
 * 도달 퍼널 클릭 이벤트 전송
 * 사용자가 과제 콘텐츠를 클릭했을 때 호출
 * @param {Object} opsProperties - 트리거 결과에서 받은 opsProperties
 */
function trackOpsClick(opsProperties) {
  if (!window.TDAnalytics) {
    console.warn('⚠️ TDAnalytics SDK가 로드되지 않았습니다.');
    return false;
  }

  try {
    window.TDAnalytics.track('ops_click', opsProperties);
    return true;
  } catch (error) {
    console.warn('⚠️ ops_click 이벤트 전송 실패:', error);
    return false;
  }
}

/**
 * 운영 SDK 초기화
 * TDApp.init()을 사용하여 모든 SDK를 통합 초기화
 * @param {Object} config - 설정 객체
 * @returns {boolean} 초기화 성공 여부
 */
function initOperateSDK(config) {
  if (typeof window === 'undefined') {
    console.warn('⚠️ 브라우저 환경이 아닙니다.');
    return false;
  }

  if (isOperateSDKInitialized) {
    if (window.trackingConfig?.debug?.showConsoleLogs) {
      console.log('ℹ️ 운영 SDK가 이미 초기화되었습니다.');
    }
    return true;
  }

  // TDApp 존재 여부 확인
  if (typeof window.TDApp === 'undefined') {
    console.warn('⚠️ TDApp이 로드되지 않았습니다. 운영 SDK 스크립트를 확인하세요.');
    return false;
  }

  try {
    const operateConfig = config.operate || {};
    const tdConfig = config.thinkingData || config;

    // TDApp 통합 초기화
    window.TDApp.init({
      appId: tdConfig.appId,
      serverUrl: tdConfig.serverUrl,
      enableLog: tdConfig.showLog || false,
      mode: operateConfig.mode || 'none', // 'none', 'debug', 'debugOnly'
      autoTrack: tdConfig.autoTrack || {
        pageShow: true,
        pageHide: true
      },
      triggerListener: defaultTriggerListener
    });

    // 초기 클라이언트 파라미터 설정
    if (operateConfig.clientParams && window.TDStrategy) {
      window.TDStrategy.addClientParams(operateConfig.clientParams);
    }

    isOperateSDKInitialized = true;

    if (window.trackingConfig?.debug?.showConsoleLogs) {
      console.log('✅ 운영 SDK 초기화 완료');
    }

    // 초기화 완료 이벤트
    window.dispatchEvent(new CustomEvent('te:operate:ready'));

    return true;

  } catch (error) {
    console.error('❌ 운영 SDK 초기화 실패:', error);
    return false;
  }
}

/**
 * 운영 SDK 초기화 여부 확인
 * @returns {boolean}
 */
function isOperateInitialized() {
  return isOperateSDKInitialized;
}

/**
 * 팝업 모듈 초기화
 * operate-popup.js가 로드된 경우 자동 연동
 */
function initPopupModule(config) {
  if (typeof window === 'undefined') return;

  const popupConfig = config?.popup || {};

  // TEPopup이 로드되었는지 확인
  if (window.TEPopup && typeof window.TEPopup.init === 'function') {
    window.TEPopup.init({
      autoRegister: popupConfig.autoRegister !== false,
      showAllTriggers: popupConfig.showAllTriggers || false,
      type: popupConfig.defaultType || 'modal'
    });

    if (window.trackingConfig?.debug?.showConsoleLogs) {
      console.log('✅ 운영 팝업 모듈 연동 완료');
    }
  }
}

// 전역 노출 (HTML에서 직접 사용 가능)
if (typeof window !== 'undefined') {
  window.TEOperate = {
    init: initOperateSDK,
    isInitialized: isOperateInitialized,
    addTriggerHandler: addTriggerHandler,
    removeTriggerHandler: removeTriggerHandler,
    setClientParams: setClientParams,
    fetchRemoteConfig: fetchRemoteConfig,
    trackOpsClick: trackOpsClick,
    initPopup: initPopupModule
  };
}

// ES Module export
export {
  initOperateSDK,
  isOperateInitialized,
  addTriggerHandler,
  removeTriggerHandler,
  setClientParams,
  fetchRemoteConfig,
  trackOpsClick
};
