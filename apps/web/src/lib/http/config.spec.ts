import { readApiUrl } from './config';

describe('readApiUrl', () => {
  it('returns the configured API origin without a trailing slash', () => {
    expect(readApiUrl({ VITE_API_URL: 'http://localhost:3000' })).toBe('http://localhost:3000');
    expect(readApiUrl({ VITE_API_URL: 'http://localhost:3000/' })).toBe('http://localhost:3000');
  });

  it.each([undefined, '', '   '])('fails with a clear message when VITE_API_URL is %p', (value) => {
    expect(() => readApiUrl({ VITE_API_URL: value })).toThrow('VITE_API_URL');
  });

  it('rejects a value that is not an http(s) URL', () => {
    expect(() => readApiUrl({ VITE_API_URL: 'not a url' })).toThrow('VITE_API_URL');
    expect(() => readApiUrl({ VITE_API_URL: 'ftp://localhost' })).toThrow('VITE_API_URL');
  });

  describe('development default', () => {
    it.each([undefined, '', '   '])(
      'falls back to http://localhost:3000 in development when VITE_API_URL is %p',
      (value) => {
        expect(readApiUrl({ VITE_API_URL: value, DEV: true })).toBe('http://localhost:3000');
      },
    );

    it('prefers an explicit value, even in development', () => {
      expect(readApiUrl({ VITE_API_URL: 'http://localhost:4000', DEV: true })).toBe(
        'http://localhost:4000',
      );
    });

    it('does not hide a malformed value in development', () => {
      expect(() => readApiUrl({ VITE_API_URL: 'not a url', DEV: true })).toThrow('VITE_API_URL');
    });

    it.each([undefined, '', '   '])(
      'stays mandatory in production when VITE_API_URL is %p',
      (value) => {
        expect(() => readApiUrl({ VITE_API_URL: value, DEV: false })).toThrow('VITE_API_URL');
      },
    );

    it('treats a missing DEV flag as production', () => {
      expect(() => readApiUrl({})).toThrow('VITE_API_URL');
    });
  });
});
