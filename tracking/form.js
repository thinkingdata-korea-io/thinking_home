/**
 * 폼 제출 추적 모듈 - ThinkingData 홈페이지 최적화
 */

import {
  maskEmail,
  maskPhone,
  maskName,
  addTETimeProperties,
  trackingLog,
  trackEvent,
} from "../core/utils.js";
import { updateSessionActivity } from "../core/session-manager.js";
import { trackFormSubmission } from "../user-attributes.js";

// Webflow 폼의 data-name 속성으로 필드 값 가져오기
function getFieldValueByDataName(form, dataNames) {
  for (const name of dataNames) {
    const field = form.querySelector(`[data-name="${name}"]`);
    if (field && field.value) return field.value;
  }
  return "";
}

let formTrackingInitialized = false;

// 폼 제출/오류 추적 메인 함수
export function initFormTracking() {
  if (formTrackingInitialized) return;
  formTrackingInitialized = true;

  trackingLog("📝 폼 추적 초기화 시작...");

  // SDK 로드 체크
  function isSDKLoaded() {
    return (
      typeof window.te !== "undefined" && typeof window.te.track === "function"
    );
  }

  function handleFormSubmit(event) {
    const form = event.target;
    updateSessionActivity();

    trackingLog("📝 폼 제출 감지:", form);

    // 폼 데이터 수집 (개인정보 제외, data-name 속성 우선 사용)
    const formData = new FormData(form);
    const formFields = {};

    // Webflow 폼은 data-name 속성으로 필드를 식별 (name="field"로 중복됨)
    const allFields = form.querySelectorAll(
      'input:not([type="hidden"]):not([type="submit"]), textarea, select'
    );
    allFields.forEach((field) => {
      const fieldName =
        field.getAttribute("data-name") || field.name || field.id;
      if (fieldName && !isPersonalInfo(fieldName)) {
        formFields[fieldName] = field.value;
      }
    });

    // 개인정보 동의 체크박스 확인 (ThinkingData 폼 구조에 맞춤)
    const privacyCheckbox = form.querySelector(
      'input[type="checkbox"][name*="privacy"], input[type="checkbox"][name*="agreement"], input[type="checkbox"][name*="동의"], input[type="checkbox"][data-name*="동의"], input[type="checkbox"][data-name*="개인정보"]'
    );
    const privacyAgreed = privacyCheckbox ? privacyCheckbox.checked : false;

    // ThinkingData 공식 폼 구분
    const formType = getFormType(form);
    const formInfo = getThinkingDataFormInfo(form);

    // 실제 폼 값들 수집 (data-name 속성 우선, FormData 폴백)
    const rawName =
      getFieldValueByDataName(form, ["이름", "Name", "name"]) ||
      formData.get("name") ||
      formData.get("이름") ||
      formData.get("gameplus_Name") ||
      "";
    const rawEmail =
      getFieldValueByDataName(form, ["이메일", "회사 이메일", "Email", "email"]) ||
      formData.get("email") ||
      formData.get("이메일") ||
      formData.get("gameplus_email") ||
      "";
    const rawPhone =
      getFieldValueByDataName(form, ["연락처", "휴대폰 번호", "Phone", "phone"]) ||
      formData.get("phone") ||
      formData.get("연락처") ||
      formData.get("gameplus_phone") ||
      "";

    const formSubmitData = {
      form_id: form.id || form.name || "unknown_form",
      form_name: getFormName(form),
      form_type: formType,
      form_url: window.location.href,
      form_page_title: document.title,
      form_fields_submitted_info: {
        name: rawName ? maskName(rawName) : "",
        email: rawEmail ? maskEmail(rawEmail) : "",
        phone: rawPhone ? maskPhone(rawPhone) : "",
        company_name:
          getFieldValueByDataName(form, ["회사명", "Company", "company"]) ||
          formData.get("company") ||
          formData.get("회사명") ||
          formData.get("gameplus_company") ||
          "",
        inquiry_source:
          getFieldValueByDataName(form, [
            "씽킹데이터를 어떻게 아셨나요?",
            "알게된경로",
          ]) ||
          formData.get("source") ||
          formData.get("알게된경로") ||
          "",
        message_length: (
          getFieldValueByDataName(form, ["문의사항", "Message", "message"]) ||
          formData.get("message") ||
          formData.get("문의사항") ||
          ""
        ).length,
        has_name: !!rawName,
        has_email: !!rawEmail,
        has_phone: !!rawPhone,
      },
      privacy_agreement_checked: privacyAgreed,
      submission_status: "pending",
      // ThinkingData 특화 정보
      form_info: formInfo,
      form_validation_passed: true,
      form_submission_time: new Date()
        .toISOString()
        .replace("T", " ")
        .slice(0, 23),
    };

    // TE 시간 형식 속성 추가
    const formSubmitDataWithTETime = addTETimeProperties(formSubmitData);

    trackEvent("te_form_submit", formSubmitDataWithTETime);
    trackingLog("📝 폼 제출 이벤트 전송:", formSubmitDataWithTETime);

    // 🚀 유저 속성에 폼 제출 추적
    trackFormSubmission();

    // 폼 제출 결과 확인 (로그만 기록, 중복 te_form_submit 방지)
    setTimeout(() => {
      const submitButton = form.querySelector(
        'button[type="submit"], input[type="submit"]'
      );
      if (submitButton && submitButton.disabled) {
        trackingLog("📝 폼 제출 성공 확인 (버튼 비활성화 감지)");
      }
    }, 1000);

    // 폼 제출 성공 메시지 감지 (로그만 기록, 중복 te_form_submit 방지)
    setTimeout(() => {
      const successMessage = document.querySelector(
        ".w-form-done, .success-message, [data-success-message]"
      );
      if (successMessage && successMessage.style.display !== "none") {
        trackingLog("📝 폼 제출 성공 메시지 감지 (DOM 확인)");
      }
    }, 2000);
  }

  function handleFormInvalid(event) {
    updateSessionActivity();
    const form = event.target.closest("form");
    if (form) {
      const errorData = {
        form_name: getFormName(form),
        form_type: getFormType(form),
        form_url: window.location.href,
        error_type: "validation_error",
        field_name: event.target.getAttribute("data-name") || event.target.name || event.target.id,
        field_type: event.target.type,
        error_message: event.target.validationMessage,
        error_time: new Date().toISOString().replace("T", " ").slice(0, 23),
      };

      // TE 시간 형식 속성 추가
      const errorDataWithTETime = addTETimeProperties(errorData);

      trackEvent("te_form_submit_error", errorDataWithTETime);
      trackingLog("📝 폼 제출 오류 이벤트 전송:", errorDataWithTETime);
    }
  }

  function bindFormEvents() {
    document.addEventListener("submit", handleFormSubmit);
    document.addEventListener("invalid", handleFormInvalid, true);
    trackingLog("📝 폼 이벤트 바인딩 완료");
  }

  // SDK가 로드될 때까지 재시도
  function tryInit(retry = 0) {
    if (isSDKLoaded()) {
      bindFormEvents();
      trackingLog("✅ 폼 트래킹 SDK 연동 및 이벤트 바인딩 완료");
    } else if (retry < 5) {
      trackingLog("⚠️ ThinkingData SDK가 로드되지 않음, 2초 후 재시도...");
      setTimeout(() => tryInit(retry + 1), 2000);
    } else {
      trackingLog("❌ 폼 트래킹: SDK 로드 실패, 이벤트 바인딩 중단");
    }
  }

  // 필드 상호작용 이벤트 리스너 등록 (initFormTracking 내부에서만 실행)
  document.addEventListener("input", function (event) {
    const field = event.target;
    if (field.tagName === "INPUT" || field.tagName === "TEXTAREA") {
      trackFieldInteraction(field, "input");
    }
  });

  document.addEventListener("focusin", function (event) {
    const field = event.target;
    if (field.tagName === "INPUT" || field.tagName === "TEXTAREA") {
      trackFieldInteraction(field, "focus");
    }
  });

  document.addEventListener("focusout", function (event) {
    const field = event.target;
    if (field.tagName === "INPUT" || field.tagName === "TEXTAREA") {
      trackFieldInteraction(field, "blur");
    }
  });

  // iframe 폼 추적 초기화
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initIframeFormTracking);
  } else {
    initIframeFormTracking();
  }

  trackingLog("✅ 폼 추적 초기화 완료");

  tryInit();
}

// 🚀 폼 필드 추적 최적화 설정
const fieldTrackingConfig = {
  debounceDelay: 2000, // 디바운싱 지연 시간 (ms)
  lengthThreshold: 3, // 길이 변화 임계값 (3글자 단위로 변경)
  enableDebouncing: true, // 디바운싱 활성화
  enableLengthCategory: true, // 길이 카테고리 분석 활성화
  enablePreview: true, // 값 미리보기 (개인정보 아닌 경우)
  ...(window.formTrackingConfig || {}), // 사용자 커스텀 설정
};

trackingLog("📝 폼 필드 추적 설정:", fieldTrackingConfig);

// 🚀 최적화된 폼 필드 변경 추적 (이벤트 폭발 방지)
const fieldTrackingState = new Map(); // 필드별 상태 관리
const fieldDebounceTimers = new Map(); // 디바운싱 타이머

function trackFieldInteraction(field, triggerType = "input") {
  const form = field.closest("form");
  if (!form || !isThinkingDataForm(form)) return;

  const fieldDataName = field.getAttribute("data-name") || field.name || field.id || "field";
  const fieldKey = `${form.id || "form"}_${fieldDataName}`;
  const currentLength = field.value ? field.value.length : 0;
  const hasValue = !!field.value;

  // 이전 상태 가져오기
  const previousState = fieldTrackingState.get(fieldKey) || {
    length: 0,
    hasValue: false,
    lastTrackedLength: 0,
    interactionCount: 0,
  };

  // 의미 있는 변화인지 확인 (설정 기반)
  const isSignificantChange =
    // 1. 상태 변화 (빈 값 ↔ 값 있음)
    previousState.hasValue !== hasValue ||
    // 2. 길이가 설정된 임계값 단위로 변함
    Math.floor(currentLength / fieldTrackingConfig.lengthThreshold) !==
      Math.floor(
        previousState.lastTrackedLength / fieldTrackingConfig.lengthThreshold
      ) ||
    // 3. 포커스 이벤트
    triggerType === "focus" ||
    triggerType === "blur";

  // 상태 업데이트
  const newState = {
    length: currentLength,
    hasValue: hasValue,
    lastTrackedLength: isSignificantChange
      ? currentLength
      : previousState.lastTrackedLength,
    interactionCount: previousState.interactionCount + 1,
  };
  fieldTrackingState.set(fieldKey, newState);

  // 의미 있는 변화가 아니면 디바운싱 적용 (설정에 따라)
  if (
    !isSignificantChange &&
    triggerType === "input" &&
    fieldTrackingConfig.enableDebouncing
  ) {
    // 기존 타이머 클리어
    if (fieldDebounceTimers.has(fieldKey)) {
      clearTimeout(fieldDebounceTimers.get(fieldKey));
    }

    // 설정된 지연 시간 후에 전송하도록 디바운싱
    const timer = setTimeout(() => {
      sendFieldInteractionEvent(field, fieldKey, newState, "debounced");
      fieldDebounceTimers.delete(fieldKey);
    }, fieldTrackingConfig.debounceDelay);

    fieldDebounceTimers.set(fieldKey, timer);
    return;
  }

  // 즉시 전송 (의미 있는 변화)
  sendFieldInteractionEvent(field, fieldKey, newState, triggerType);
}

function sendFieldInteractionEvent(field, fieldKey, state, triggerType) {
  const form = field.closest("form");
  const fieldIdentifier = field.getAttribute("data-name") || field.name || field.id;
  const fieldData = {
    form_name: getFormName(form),
    form_type: getFormType(form),
    field_name: fieldIdentifier,
    field_type: field.type,
    field_value_length: state.length,
    field_has_value: state.hasValue,
    interaction_count: state.interactionCount,
    trigger_type: triggerType, // 'input', 'focus', 'blur', 'debounced'
    interaction_time: new Date().toISOString().replace("T", " ").slice(0, 23),
  };

  // 개인정보 필드가 아닌 경우에만 값 미리보기 전송 (설정에 따라)
  if (
    fieldTrackingConfig.enablePreview &&
    !isPersonalInfo(fieldIdentifier)
  ) {
    fieldData.field_value_preview = field.value
      ? field.value.substring(0, 10) + "..."
      : "";
  }

  // 길이 구간 정보 추가 (설정에 따라)
  if (fieldTrackingConfig.enableLengthCategory) {
    fieldData.length_category = getLengthCategory(state.length);
  }

  // TE 시간 형식 속성 추가
  const fieldDataWithTETime = addTETimeProperties(fieldData);

  trackEvent("te_form_field_interaction", fieldDataWithTETime);

  trackingLog(
    `📝 필드 상호작용 추적 (${triggerType}):`,
    field.name,
    `길이: ${state.length}`
  );
}

// 길이 카테고리 분류
function getLengthCategory(length) {
  if (length === 0) return "empty";
  if (length <= 5) return "short";
  if (length <= 20) return "medium";
  if (length <= 50) return "long";
  return "very_long";
}

// 필드 상호작용 이벤트 리스너는 initFormTracking() 내부에서 등록됨

// 추적 대상 폼인지 확인 (모든 폼 자동 추적, data-no-track으로 제외 가능)
function isThinkingDataForm(form) {
  return !form.hasAttribute("data-no-track");
}

// 개인정보 필드 판단 (ThinkingData 폼 구조에 맞춤)
function isPersonalInfo(fieldName) {
  if (!fieldName) return false;

  const personalFields = [
    "email",
    "phone",
    "name",
    "password",
    "ssn",
    "birthday",
    "이메일",
    "연락처",
    "이름",
    "비밀번호",
    "생년월일",
    "휴대폰",
    "tel",
    "mobile",
    "contact",
    "phone_number",
  ];

  return personalFields.some((field) =>
    fieldName.toLowerCase().includes(field)
  );
}

// 폼 이름 추출 (ThinkingData 폼 구조에 맞춤)
function getFormName(form) {
  if (window.location.href.includes("/form-demo")) return "데모 신청 폼";
  if (window.location.href.includes("/form-ask")) return "문의하기 폼";
  if (window.location.href.includes("/form-gameplus")) return "게임더하기 폼";
  if (window.location.href.includes("/data-voucher"))
    return "데이터바우처 도입 문의";
  if (form.id?.includes("gameplus") || form.name?.includes("gameplus"))
    return "게임더하기 폼";
  if (form.id?.includes("voucher") || form.name?.includes("voucher"))
    return "데이터바우처 도입 문의";
  if (
    form.id?.includes("newsletter") ||
    form.id?.includes("Newsletter") ||
    form.name?.includes("newsletter") ||
    form.name?.includes("Newsletter")
  )
    return "뉴스레터 구독 폼";
  // 폴백: 폼 속성 → 주변 heading → URL 경로에서 자동 추론
  const fallbackName =
    form.title ||
    form.getAttribute("data-form-name") ||
    form.getAttribute("data-name") ||
    form.id ||
    form.name ||
    form.querySelector("h1,h2,h3")?.textContent?.trim() ||
    "";

  if (fallbackName) return fallbackName;

  // URL 경로에서 추론 (예: /contact-us → "contact-us 폼")
  const pathSegment = window.location.pathname.split("/").filter(Boolean).pop();
  return pathSegment ? `${pathSegment} 폼` : "자동 감지 폼";
}

// ThinkingData 공식 폼 타입 구분 (실제 URL 구조 기반)
function getFormType(form) {
  const url = window.location.href;
  if (url.includes("/form-demo") || form.id?.includes("demo"))
    return "demo_request";
  if (
    url.includes("/form-ask") ||
    form.id?.includes("contact") ||
    form.id?.includes("ask")
  )
    return "contact_inquiry";
  if (
    url.includes("/form-gameplus") ||
    form.id?.includes("gameplus") ||
    form.name?.includes("gameplus")
  )
    return "gameplus";
  if (
    url.includes("/data-voucher") ||
    form.id?.includes("voucher") ||
    form.name?.includes("voucher")
  )
    return "data_voucher";
  if (
    form.id?.includes("newsletter") ||
    form.id?.includes("Newsletter") ||
    form.name?.includes("newsletter") ||
    form.name?.includes("Newsletter")
  )
    return "newsletter";
  // 폴백: 폼 속성 → URL 경로에서 자동 추론
  const formIdentifier = form.id || form.name || form.getAttribute("data-name") || "";
  if (formIdentifier) {
    return formIdentifier.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  }

  const pathSegment = window.location.pathname.split("/").filter(Boolean).pop() || "";
  if (pathSegment) {
    return pathSegment.replace(/[^a-zA-Z0-9]+/g, "_");
  }

  return "auto_detected";
}

// ThinkingData 폼 상세 정보 수집
function getThinkingDataFormInfo(form) {
  const url = window.location.href;
  const formType = getFormType(form);

  const formInfo = {
    form_type: formType,
    form_url: url,
    form_page_title: document.title,
    form_has_required_fields: false,
    form_has_privacy_agreement: false,
    form_field_count: 0,
    form_required_field_count: 0,
  };

  // 폼 필드 분석
  const fields = form.querySelectorAll("input, textarea, select");
  formInfo.form_field_count = fields.length;

  fields.forEach((field) => {
    if (field.hasAttribute("required")) {
      formInfo.form_has_required_fields = true;
      formInfo.form_required_field_count++;
    }
  });

  // 개인정보 동의 체크박스 확인
  const privacyCheckbox = form.querySelector(
    'input[type="checkbox"][name*="privacy"], input[type="checkbox"][name*="agreement"], input[type="checkbox"][name*="동의"]'
  );
  formInfo.form_has_privacy_agreement = !!privacyCheckbox;

  // ThinkingData 특화 정보
  if (formType === "demo_request") {
    formInfo.demo_request_form = true;
    formInfo.form_purpose = "데모 신청";
  } else if (formType === "contact_inquiry") {
    formInfo.contact_inquiry_form = true;
    formInfo.form_purpose = "문의하기";
  } else if (formType === "data_voucher") {
    formInfo.data_voucher_form = true;
    formInfo.form_purpose = "데이터바우처 도입 문의";
  } else if (formType === "newsletter") {
    formInfo.newsletter_form = true;
    formInfo.form_purpose = "뉴스레터 구독";
  }

  return formInfo;
}

// 마스킹 함수들은 utils.js에서 가져와서 사용

// 외부 iframe 폼 추적 (salesmap.kr 등 cross-origin iframe)
function initIframeFormTracking() {
  const url = window.location.href;
  if (!url.includes("/data-voucher")) return;

  trackingLog("📝 SalesMap 폼 추적 초기화 (data-voucher 페이지)");

  // 중복 방지 플래그 (페이지당 1회만 te_form_submit 발생)
  let salesMapFormSubmitTracked = false;

  function trackSalesMapFormSubmit(detectionMethod, extraData = {}) {
    if (salesMapFormSubmitTracked) {
      trackingLog("📝 SalesMap 폼 제출 이미 추적됨 (중복 방지)");
      return;
    }
    salesMapFormSubmitTracked = true;

    const submitData = {
      form_id: "salesmap_data_voucher",
      form_name: "데이터바우처 도입 문의",
      form_type: "data_voucher",
      form_url: url,
      form_page_title: document.title,
      form_source: "salesmap",
      detection_method: detectionMethod,
      submission_status: "success",
      form_submission_time: new Date()
        .toISOString()
        .replace("T", " ")
        .slice(0, 23),
      ...extraData,
    };

    const dataWithTETime = addTETimeProperties(submitData);
    trackEvent("te_form_submit", dataWithTETime);
    trackFormSubmission();
    trackingLog("📝 SalesMap 폼 제출 이벤트 전송:", detectionMethod);
  }

  // 1. salesmap.kr postMessage 리스너 (제출 관련 메시지만 필터링)
  window.addEventListener("message", function (event) {
    const ALLOWED_ORIGINS = ['https://salesmap.kr', 'https://www.salesmap.kr'];
    if (!ALLOWED_ORIGINS.some(origin => event.origin === origin || event.origin.endsWith('.salesmap.kr'))) return;

    trackingLog("📝 salesmap 메시지 수신:", event.data);

    const messageData =
      typeof event.data === "string"
        ? (() => {
            try {
              return JSON.parse(event.data);
            } catch {
              return null;
            }
          })()
        : event.data;

    if (!messageData) return;

    // 메시지 내용을 문자열로 변환하여 제출 성공 관련 키워드 확인
    const msgStr = JSON.stringify(messageData).toLowerCase();
    const messageType = String(
      messageData.type || messageData.event || messageData.action || ""
    ).toLowerCase();

    // 실패/오류 관련 키워드가 포함되면 제출 성공이 아님
    const isError =
      msgStr.includes("error") ||
      msgStr.includes("fail") ||
      msgStr.includes("invalid") ||
      msgStr.includes("validation") ||
      msgStr.includes("required");

    // 제출 성공 관련 키워드 (submit 단독은 너무 광범위하므로 제외)
    const isSuccess =
      !isError &&
      (messageType.includes("submitted") ||
        messageType.includes("success") ||
        messageType.includes("complete") ||
        messageType.includes("conversion") ||
        msgStr.includes("감사") ||
        msgStr.includes("완료"));

    if (isSuccess) {
      trackSalesMapFormSubmit("postmessage", {
        iframe_message_type: messageType || "unknown",
      });
    } else {
      trackingLog(
        "📝 salesmap 비제출 메시지 (무시):",
        messageType || typeof event.data
      );
    }
  });

  // 2. SalesMap 폼 DOM 변화 감지 (팝업 폼 → 감사 페이지 전환)
  function watchForFormCompletion() {
    // iframe 방식: iframe load 이벤트로 페이지 전환 감지
    const salesMapIframe = document.querySelector('iframe[src*="salesmap"]');
    if (salesMapIframe) {
      let iframeLoadCount = 0;
      salesMapIframe.addEventListener("load", function () {
        iframeLoadCount++;
        // 최초 로드(1회) 이후의 로드는 폼 제출 후 감사 페이지 전환
        if (iframeLoadCount > 1) {
          trackSalesMapFormSubmit("iframe_navigation");
        }
      });
      trackingLog("📝 SalesMap iframe load 이벤트 감시 설정");
    }

    // 직접 임베딩 방식: MutationObserver로 감사 메시지 전환 감지
    const salesMapLink = document.querySelector('a[href*="salesmap.kr"]');
    if (salesMapLink) {
      const formContainer =
        salesMapLink.closest('[class*="shadow"]') ||
        salesMapLink.closest('[style*="width: 542px"]') ||
        salesMapLink.parentElement?.parentElement;

      if (formContainer) {
        const mutationObserver = new MutationObserver(() => {
          if (salesMapFormSubmitTracked) {
            mutationObserver.disconnect();
            return;
          }

          const containerText = formContainer.textContent || "";
          const hasThankYou =
            containerText.includes("감사합니다") &&
            containerText.includes("완료");
          const hasFormInputs = formContainer.querySelector(
            'input:not([type="hidden"]):not([type="radio"]), textarea'
          );

          // 감사 메시지가 있고 입력 필드가 사라진 경우 = 폼 제출 성공
          if (hasThankYou && !hasFormInputs) {
            mutationObserver.disconnect();
            trackSalesMapFormSubmit("dom_mutation");
          }
        });

        mutationObserver.observe(formContainer, {
          childList: true,
          subtree: true,
          characterData: true,
        });
        trackingLog("📝 SalesMap 폼 컨테이너 MutationObserver 설정 완료");
      }
    }
  }

  // DOM 로드 후 감시 시작 (SalesMap 위젯 로드 대기)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () =>
      setTimeout(watchForFormCompletion, 1000)
    );
  } else {
    setTimeout(watchForFormCompletion, 1000);
  }

  // 3. 폼 섹션 가시성 추적 (IntersectionObserver)
  const formSection = document.querySelector("#data-voucher-form");
  if (formSection) {
    let formViewed = false;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !formViewed) {
            formViewed = true;
            const viewData = {
              form_name: "데이터바우처 도입 문의",
              form_type: "data_voucher",
              form_url: url,
              form_source: "salesmap",
              form_section_visible: true,
              view_time: new Date()
                .toISOString()
                .replace("T", " ")
                .slice(0, 23),
            };
            const viewDataWithTETime = addTETimeProperties(viewData);
            trackEvent("te_form_view", viewDataWithTETime);
            trackingLog("📝 데이터바우처 폼 섹션 노출 추적");
          }
        });
      },
      { threshold: 0.3 }
    );
    observer.observe(formSection);
  }

  // 4. CTA 버튼 클릭 추적 (폼으로 스크롤하는 버튼)
  const ctaLinks = document.querySelectorAll(
    'a[href="#data-voucher-form"], a[href*="data-voucher-form"]'
  );
  ctaLinks.forEach((link) => {
    link.addEventListener("click", function () {
      const ctaData = {
        form_name: "데이터바우처 도입 문의",
        form_type: "data_voucher",
        form_url: url,
        cta_text: link.textContent.trim(),
        cta_action: "scroll_to_form",
        click_time: new Date()
          .toISOString()
          .replace("T", " ")
          .slice(0, 23),
      };
      const ctaDataWithTETime = addTETimeProperties(ctaData);
      trackEvent("te_form_cta_click", ctaDataWithTETime);
      trackingLog("📝 데이터바우처 폼 CTA 클릭 추적:", link.textContent.trim());
    });
  });
}

// iframe 폼 추적은 initFormTracking() 호출 시 내부에서 초기화됨
// 직접 호출 제거 - config.modules.form 설정에 따라 제어

// 디버깅용 함수
function debugFormTracking() {
  trackingLog("📝 폼 추적 디버깅 정보:");
  trackingLog("- 현재 URL:", window.location.href);
  trackingLog("- 페이지 제목:", document.title);
  trackingLog("- 폼 개수:", document.querySelectorAll("form").length);
  trackingLog(
    "- ThinkingData SDK:",
    typeof window.te !== "undefined" ? "로드됨" : "로드 안됨"
  );

  // 폼 상세 정보
  document.querySelectorAll("form").forEach((form, index) => {
    trackingLog(`- 폼 ${index + 1}:`, {
      id: form.id,
      name: form.name,
      action: form.action,
      method: form.method,
      field_count: form.querySelectorAll("input, textarea, select").length,
    });
  });
}

// 전역 함수로 노출
window.debugFormTracking = debugFormTracking;
