/**
 * 스크롤 깊이 추적 모듈
 * ThinkingData SDK와 연동하여 스크롤 깊이 이벤트 추적
 */

import { updateSessionActivity } from '../core/session-manager.js';
import { trackFullScroll } from '../user-attributes.js';
import { trackingLog } from '../core/utils.js';

const scrollDepthThresholds = [0, 25, 50, 75, 90, 100];
let scrollDepthTracked = new Set();
let maxScrollDepth = 0;

function calculateScrollDepth() {
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
  const windowHeight = window.innerHeight;
  const documentHeight = Math.max(
    document.body.scrollHeight,
    document.body.offsetHeight,
    document.documentElement.clientHeight,
    document.documentElement.scrollHeight,
    document.documentElement.offsetHeight
  );
  const scrollDepthPercentage = Math.round(
    ((scrollTop + windowHeight) / documentHeight) * 100
  );
  return {
    percentage: Math.min(scrollDepthPercentage, 100),
    pixels: scrollTop,
    totalHeight: documentHeight
  };
}

let lastScrollTime = 0;
let lastScrollTop = 0;

function calculateScrollSpeed() {
  const currentTime = Date.now();
  const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;

  if (!lastScrollTime) {
    lastScrollTime = currentTime;
    lastScrollTop = currentScrollTop;
    return 0;
  }

  const timeDiff = currentTime - lastScrollTime;
  const scrollDiff = Math.abs(currentScrollTop - lastScrollTop);
  lastScrollTime = currentTime;
  lastScrollTop = currentScrollTop;
  return timeDiff > 0 ? Math.round(scrollDiff / timeDiff * 1000) : 0;
}

export function initScrollTracking() {
  trackingLog('📜 스크롤 깊이 추적 초기화...');

  let scrollTimeout;
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      if (typeof updateSessionActivity === 'function') updateSessionActivity();

      const scrollData = calculateScrollDepth();
      if (scrollData.percentage > maxScrollDepth) {
        maxScrollDepth = scrollData.percentage;
      }

      scrollDepthThresholds.forEach(threshold => {
        if (scrollData.percentage >= threshold && !scrollDepthTracked.has(threshold)) {
          scrollDepthTracked.add(threshold);
          const eventData = {
            scroll_depth_percentage: threshold,
            scroll_depth_pixels: scrollData.pixels,
            page_total_height_pixels: scrollData.totalHeight,
            page_name: document.title,
            page_url: window.location.href,
            scroll_direction: 'vertical',
            max_scroll_depth: maxScrollDepth,
            scroll_speed: calculateScrollSpeed()
          };
          if (window.te && typeof window.te.track === 'function') {
            window.te.track('te_scroll_depth', eventData);
            trackingLog('📜 스크롤 깊이 이벤트 전송:', eventData);
          }

          if (threshold === 100) {
            trackFullScroll();
          }
        }
      });
    }, 100);
  });

  trackingLog('✅ 스크롤 깊이 추적 초기화 완료');
}
