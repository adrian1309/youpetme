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
});
