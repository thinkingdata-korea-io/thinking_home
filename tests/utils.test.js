import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  simpleHash,
  maskEmail,
  maskPhone,
  maskName,
  formatTimestamp,
  convertToTETimeFormat,
  addTETimeProperties,
  convertTimePropertyToTE,
  generateTextBasedId,
  isExternalLink,
} from '../core/utils.js';

// --- simpleHash ---
describe('simpleHash', () => {
  it('returns a string', () => {
    expect(typeof simpleHash('hello')).toBe('string');
  });

  it('returns consistent hash for same input', () => {
    expect(simpleHash('test')).toBe(simpleHash('test'));
  });

  it('returns different hashes for different inputs', () => {
    expect(simpleHash('abc')).not.toBe(simpleHash('xyz'));
  });

  it('handles empty string', () => {
    expect(simpleHash('')).toBe('0');
  });

  it('handles unicode characters', () => {
    const hash = simpleHash('한글테스트');
    expect(typeof hash).toBe('string');
    expect(hash.length).toBeGreaterThan(0);
  });
});

// --- maskEmail ---
describe('maskEmail', () => {
  it('masks a standard email', () => {
    const result = maskEmail('john@example.com');
    expect(result).toBe('j***@e***.com');
  });

  it('masks single-char local part', () => {
    const result = maskEmail('a@test.com');
    expect(result).toBe('***@t***.com');
  });

  it('returns empty string for null/undefined', () => {
    expect(maskEmail(null)).toBe('');
    expect(maskEmail(undefined)).toBe('');
  });

  it('returns empty string for non-string', () => {
    expect(maskEmail(123)).toBe('');
  });

  it('returns fallback for invalid email without @', () => {
    expect(maskEmail('notanemail')).toBe('***@***.***');
  });

  it('handles multi-dot domains', () => {
    const result = maskEmail('user@sub.domain.co.kr');
    expect(result).toContain('@');
    expect(result).toContain('***');
  });
});

// --- maskPhone ---
describe('maskPhone', () => {
  it('masks a 11-digit phone number', () => {
    const result = maskPhone('01012345678');
    expect(result).toBe('010-****-5678');
  });

  it('masks phone with dashes', () => {
    const result = maskPhone('010-1234-5678');
    expect(result).toBe('010-****-5678');
  });

  it('masks a 10-digit phone', () => {
    const result = maskPhone('0212345678');
    expect(result).toBe('021-****-5678');
  });

  it('masks a 7-digit phone', () => {
    const result = maskPhone('1234567');
    expect(result).toBe('12***67');
  });

  it('returns fallback for short number', () => {
    expect(maskPhone('123')).toBe('***-****-****');
  });

  it('returns empty string for null/undefined', () => {
    expect(maskPhone(null)).toBe('');
    expect(maskPhone(undefined)).toBe('');
  });

  it('returns empty string for non-string', () => {
    expect(maskPhone(123)).toBe('');
  });
});

// --- maskName ---
describe('maskName', () => {
  it('masks a 3-char name', () => {
    expect(maskName('홍길동')).toBe('홍***동');
  });

  it('masks a 2-char name', () => {
    expect(maskName('홍길')).toBe('홍*');
  });

  it('masks a 1-char name', () => {
    expect(maskName('홍')).toBe('*');
  });

  it('masks a long name', () => {
    const result = maskName('Alexander');
    expect(result).toBe('A***r');
  });

  it('handles whitespace-padded name', () => {
    expect(maskName('  김철수  ')).toBe('김***수');
  });

  it('returns empty string for null/undefined', () => {
    expect(maskName(null)).toBe('');
    expect(maskName(undefined)).toBe('');
  });

  it('returns empty string for non-string', () => {
    expect(maskName(42)).toBe('');
  });
});

// --- formatTimestamp ---
describe('formatTimestamp', () => {
  it('formats a known date', () => {
    const date = new Date('2024-06-15T10:30:45.123Z');
    const result = formatTimestamp(date);
    // Format: "YYYY-MM-DD HH:MM:SS.mmm" (in UTC via toISOString)
    expect(result).toBe('2024-06-15 10:30:45.123');
  });

  it('returns a string for default (no argument)', () => {
    const result = formatTimestamp();
    expect(typeof result).toBe('string');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
  });
});

// --- convertToTETimeFormat ---
describe('convertToTETimeFormat', () => {
  it('converts a Date object', () => {
    const date = new Date('2024-01-15T09:30:00.000Z');
    const result = convertToTETimeFormat(date);
    // Should be local time representation
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('converts an ISO string with Z', () => {
    const result = convertToTETimeFormat('2024-03-10T12:00:00.000Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('converts an ISO string without Z', () => {
    const result = convertToTETimeFormat('2024-03-10T12:00:00');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('converts a millisecond timestamp', () => {
    const ts = new Date('2024-06-01T00:00:00Z').getTime(); // 13 digits
    const result = convertToTETimeFormat(ts);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('converts a second timestamp (10 digits)', () => {
    const ts = Math.floor(new Date('2024-06-01T00:00:00Z').getTime() / 1000);
    const result = convertToTETimeFormat(ts);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('returns current time for non-date input', () => {
    const result = convertToTETimeFormat(null);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('returns current time for invalid date string', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = convertToTETimeFormat('not-a-date');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
    console.warn.mockRestore();
  });
});

// --- addTETimeProperties ---
describe('addTETimeProperties', () => {
  it('adds _te suffix for known time properties', () => {
    const props = { local_time: '2024-01-01T00:00:00Z' };
    const result = addTETimeProperties(props);
    expect(result).toHaveProperty('local_time');
    expect(result).toHaveProperty('local_time_te');
    expect(result.local_time_te).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/);
  });

  it('adds current_time_te always', () => {
    const result = addTETimeProperties({});
    expect(result).toHaveProperty('current_time_te');
  });

  it('preserves non-time properties', () => {
    const props = { page_url: 'https://example.com', local_time: new Date().toISOString() };
    const result = addTETimeProperties(props);
    expect(result.page_url).toBe('https://example.com');
  });

  it('skips null/undefined time values', () => {
    const props = { local_time: null, timestamp: undefined };
    const result = addTETimeProperties(props);
    expect(result).not.toHaveProperty('local_time_te');
    expect(result).not.toHaveProperty('timestamp_te');
  });

  it('handles numeric timestamps', () => {
    const props = { first_visit_timestamp: Date.now() };
    const result = addTETimeProperties(props);
    expect(result).toHaveProperty('first_visit_timestamp_te');
  });
});

// --- convertTimePropertyToTE ---
describe('convertTimePropertyToTE', () => {
  it('converts a specific time property', () => {
    const props = { created_at: '2024-06-01T12:00:00Z', name: 'test' };
    const result = convertTimePropertyToTE(props, 'created_at');
    expect(result).toHaveProperty('created_at_te');
    expect(result.name).toBe('test');
  });

  it('returns original if property does not exist', () => {
    const props = { name: 'test' };
    const result = convertTimePropertyToTE(props, 'created_at');
    expect(result).not.toHaveProperty('created_at_te');
    expect(result.name).toBe('test');
  });
});

// --- generateTextBasedId ---
describe('generateTextBasedId', () => {
  it('generates id from text', () => {
    const result = generateTextBasedId('Hello World');
    expect(result).toMatch(/^text_helloworld_/);
  });

  it('returns no_text for empty input', () => {
    expect(generateTextBasedId('')).toBe('no_text');
    expect(generateTextBasedId(null)).toBe('no_text');
    expect(generateTextBasedId(undefined)).toBe('no_text');
  });

  it('truncates long text to 10 chars', () => {
    const result = generateTextBasedId('abcdefghijklmnopqrstuvwxyz');
    const textPart = result.split('_')[1];
    expect(textPart.length).toBeLessThanOrEqual(10);
  });

  it('handles Korean text', () => {
    const result = generateTextBasedId('안녕하세요');
    expect(result).toMatch(/^text_/);
    expect(result).toContain('안녕하세요');
  });
});

// --- isExternalLink ---
describe('isExternalLink', () => {
  beforeEach(() => {
    // Mock window.location for consistent tests
    vi.stubGlobal('window', {
      location: { hostname: 'www.thinkingdata.kr' }
    });
  });

  it('detects external link', () => {
    expect(isExternalLink('https://www.google.com/search')).toBe(true);
  });

  it('detects internal link', () => {
    expect(isExternalLink('https://www.thinkingdata.kr/about')).toBe(false);
  });

  it('returns false for invalid URL', () => {
    expect(isExternalLink('not-a-url')).toBe(false);
  });

  it('detects subdomain as external', () => {
    expect(isExternalLink('https://blog.example.com')).toBe(true);
  });
});
