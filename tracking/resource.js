/**
 * 리소스 다운로드 추적 모듈
 * ThinkingData SDK와 연동하여 파일 다운로드 이벤트 추적
 */

import { updateSessionActivity } from '../core/session-manager.js';
import { trackDownload } from '../user-attributes.js';
import { trackingLog } from '../core/utils.js';

const DOWNLOAD_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv',
  '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg',
  '.txt', '.csv', '.json', '.xml',
  '.exe', '.msi', '.dmg', '.pkg',
  '.apk', '.ipa'
];

const RESOURCE_TYPE_MAPPINGS = {
  'document': {
    extensions: ['.pdf', '.doc', '.docx', '.txt'],
    text: ['문서', 'document', 'pdf', 'doc'],
    class: ['document-link', 'pdf-link', 'doc-link'],
    id: ['document', 'pdf', 'doc']
  },
  'spreadsheet': {
    extensions: ['.xls', '.xlsx', '.csv'],
    text: ['엑셀', '스프레드시트', 'excel', 'spreadsheet', 'csv'],
    class: ['excel-link', 'spreadsheet-link', 'csv-link'],
    id: ['excel', 'spreadsheet', 'csv']
  },
  'presentation': {
    extensions: ['.ppt', '.pptx'],
    text: ['파워포인트', '프레젠테이션', 'powerpoint', 'presentation'],
    class: ['ppt-link', 'presentation-link'],
    id: ['ppt', 'presentation']
  },
  'archive': {
    extensions: ['.zip', '.rar', '.7z', '.tar', '.gz'],
    text: ['압축', 'zip', 'rar', 'archive'],
    class: ['zip-link', 'archive-link'],
    id: ['zip', 'archive']
  },
  'image': {
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg'],
    text: ['이미지', '사진', 'image', 'photo', 'picture'],
    class: ['image-link', 'photo-link'],
    id: ['image', 'photo']
  },
  'software': {
    extensions: ['.exe', '.msi', '.dmg', '.pkg', '.apk', '.ipa'],
    text: ['소프트웨어', '프로그램', '앱', 'software', 'app', 'program'],
    class: ['software-link', 'app-link'],
    id: ['software', 'app']
  },
  'data': {
    extensions: ['.csv', '.json', '.xml'],
    text: ['데이터', 'data'],
    class: ['data-link'],
    id: ['data']
  },
  'api_documentation': {
    text: ['개발문서', 'API', 'api', 'docs', 'documentation'],
    url: ['api', 'docs', 'documentation'],
    class: ['api-link', 'docs-link'],
    id: ['api', 'docs']
  },
  'user_guide': {
    text: ['온보딩', '가이드', 'guide', 'onboarding', '매뉴얼'],
    url: ['guide', 'onboarding', 'manual'],
    class: ['guide-link', 'manual-link'],
    id: ['guide', 'manual']
  },
  'case_study': {
    text: ['사례', '케이스', 'case', 'example', '스터디'],
    url: ['case', 'example', 'study'],
    class: ['case-link', 'example-link'],
    id: ['case', 'example']
  },
  'whitepaper': {
    text: ['백서', 'whitepaper', 'white paper'],
    url: ['whitepaper'],
    class: ['whitepaper-link'],
    id: ['whitepaper']
  },
  'demo_request': {
    text: ['데모', 'demo', '체험', 'trial'],
    url: ['demo', 'trial'],
    class: ['demo-link', 'trial-link'],
    id: ['demo', 'trial']
  },
  'contact_form': {
    text: ['문의', 'contact', '연락'],
    url: ['contact', 'inquiry'],
    class: ['contact-link', 'inquiry-link'],
    id: ['contact', 'inquiry']
  }
};

function getFileExtension(url) {
  const filename = url.split('/').pop();
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex > 0 ? filename.substring(lastDotIndex).toLowerCase() : '';
}

function getFileSize(url) {
  try {
    const urlParams = new URLSearchParams(url.split('?')[1] || '');
    const size = urlParams.get('size') || urlParams.get('filesize');
    return size ? parseInt(size) : 0;
  } catch (e) {
    return 0;
  }
}

function getResourceType(link) {
  const url = link.href.toLowerCase();
  const text = link.textContent ? link.textContent.toLowerCase() : '';
  const classList = Array.from(link.classList).map(cls => cls.toLowerCase());
  const id = link.id ? link.id.toLowerCase() : '';

  for (const [type, patterns] of Object.entries(RESOURCE_TYPE_MAPPINGS)) {
    if (patterns.extensions && patterns.extensions.some(ext => url.includes(ext))) return type;
    if (patterns.text && patterns.text.some(p => text.includes(p))) return type;
    if (patterns.url && patterns.url.some(p => url.includes(p))) return type;
    if (patterns.class && patterns.class.some(p => classList.some(cls => cls.includes(p)))) return type;
    if (patterns.id && patterns.id.some(p => id.includes(p))) return type;
  }

  return 'general';
}

export function initResourceTracking() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    const link = target.closest('a');
    if (!link || !link.href) return;

    const url = link.href.toLowerCase();
    const extension = getFileExtension(url);

    if (!DOWNLOAD_EXTENSIONS.includes(extension)) return;

    if (typeof updateSessionActivity === 'function') updateSessionActivity();

    const eventData = {
      page_name: document.title,
      page_url: window.location.href,
      download_url: link.href,
      download_filename: link.href.split('/').pop(),
      file_extension: extension,
      resource_type: getResourceType(link),
      file_size_bytes: getFileSize(url),
      download_success: true,
      link_text: link.textContent ? link.textContent.trim() : '',
      link_id: link.id || null,
      link_class_list: Array.from(link.classList),
      click_coordinates: { x: event.pageX, y: event.pageY }
    };

    if (window.te && typeof window.te.track === 'function') {
      window.te.track('resource_download', eventData);
      trackingLog('📥 리소스 다운로드 이벤트 전송:', eventData);
    }

    trackDownload();
  });
}
