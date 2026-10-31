import { DIANGO_WELCOME_SEEN_KEY, readDiangoWelcomeSeen } from './diango-welcome';

describe('Diango welcome mark (TS-IAM-001 hasSeenWelcome, ADR-011)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('uses the agreed key', () => {
    expect(DIANGO_WELCOME_SEEN_KEY).toBe('youpetme:diango-welcome-seen');
  });

  it('is true only when the key holds exactly "true"', () => {
    window.localStorage.setItem(DIANGO_WELCOME_SEEN_KEY, 'true');

    expect(readDiangoWelcomeSeen()).toBe(true);
  });

  it.each(['false', 'True', 'TRUE', '1', 'yes', '', ' true', 'true '])(
    'is false for the value %p',
    (value) => {
      window.localStorage.setItem(DIANGO_WELCOME_SEEN_KEY, value);

      expect(readDiangoWelcomeSeen()).toBe(false);
    },
  );

  it('is false when the key is missing', () => {
    expect(readDiangoWelcomeSeen()).toBe(false);
  });

  it('is false when reading localStorage throws (private mode, blocked storage)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(readDiangoWelcomeSeen()).toBe(false);
  });

  it('is false when merely accessing window.localStorage throws', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError');
    });

    expect(readDiangoWelcomeSeen()).toBe(false);
  });

  it('never writes to storage', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    readDiangoWelcomeSeen();

    expect(setItem).not.toHaveBeenCalled();
  });
});
