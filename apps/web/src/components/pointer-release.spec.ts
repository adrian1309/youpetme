import { fireEvent } from '@testing-library/react';

import { afterPointerRelease, POINTER_RELEASE_SAFETY_MS } from './pointer-release';

describe('afterPointerRelease (SCRUM-51)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Leave no pointer pressed and nothing queued for the next test.
    fireEvent.pointerUp(document.body);
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('runs at once when no pointer is pressed, as when leaving a field with the keyboard', () => {
    const run = vi.fn();

    afterPointerRelease(run);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('waits while a pointer is pressed and runs after the release, once the click is dispatched', () => {
    const run = vi.fn();
    fireEvent.pointerDown(document.body);

    afterPointerRelease(run);
    expect(run).not.toHaveBeenCalled();

    fireEvent.pointerUp(document.body);
    // The click follows the release in the same task, so the change must wait for the next one.
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(0);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs after a cancelled pointer, such as a touch the browser turned into a scroll', () => {
    const run = vi.fn();
    fireEvent.pointerDown(document.body);
    afterPointerRelease(run);

    fireEvent.pointerCancel(document.body);
    vi.advanceTimersByTime(0);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('runs every queued change, in order', () => {
    const calls: string[] = [];
    fireEvent.pointerDown(document.body);
    afterPointerRelease(() => calls.push('first'));
    afterPointerRelease(() => calls.push('second'));

    fireEvent.pointerUp(document.body);
    vi.advanceTimersByTime(0);

    expect(calls).toEqual(['first', 'second']);
  });

  describe('touch and pen: the field is left after the release, on the emulated mousedown', () => {
    it('waits for the click that follows the release', () => {
      const run = vi.fn();
      fireEvent.pointerDown(document.body, { pointerType: 'touch' });
      fireEvent.pointerUp(document.body, { pointerType: 'touch' });

      // The browser blurs the field on the mousedown it emulates after the touch ends.
      afterPointerRelease(run);
      vi.advanceTimersByTime(0);
      expect(run).not.toHaveBeenCalled();

      fireEvent.click(document.body);
      expect(run).not.toHaveBeenCalled();
      vi.advanceTimersByTime(0);

      expect(run).toHaveBeenCalledTimes(1);
    });

    it('also waits for the click after a pen', () => {
      const run = vi.fn();
      fireEvent.pointerDown(document.body, { pointerType: 'pen' });
      fireEvent.pointerUp(document.body, { pointerType: 'pen' });
      afterPointerRelease(run);
      vi.advanceTimersByTime(0);
      expect(run).not.toHaveBeenCalled();

      fireEvent.click(document.body);
      vi.advanceTimersByTime(0);

      expect(run).toHaveBeenCalledTimes(1);
    });

    it('stops waiting after the safety delay when no click follows', () => {
      fireEvent.pointerDown(document.body, { pointerType: 'touch' });
      fireEvent.pointerUp(document.body, { pointerType: 'touch' });
      vi.advanceTimersByTime(POINTER_RELEASE_SAFETY_MS);

      const run = vi.fn();
      afterPointerRelease(run);

      expect(run).toHaveBeenCalledTimes(1);
    });
  });

  describe('safety exit when the release never arrives (pointer released outside the window)', () => {
    it('runs after the safety delay at most', () => {
      const run = vi.fn();
      fireEvent.pointerDown(document.body);
      afterPointerRelease(run);

      vi.advanceTimersByTime(POINTER_RELEASE_SAFETY_MS - 1);
      expect(run).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);

      expect(run).toHaveBeenCalledTimes(1);
      expect(POINTER_RELEASE_SAFETY_MS).toBeLessThanOrEqual(1000);
    });

    it('runs when the window loses the focus', () => {
      const run = vi.fn();
      fireEvent.pointerDown(document.body);
      afterPointerRelease(run);

      fireEvent.blur(window);
      vi.advanceTimersByTime(0);

      expect(run).toHaveBeenCalledTimes(1);
    });

    it('no longer waits once the safety exit has fired', () => {
      fireEvent.pointerDown(document.body);
      afterPointerRelease(vi.fn());
      vi.advanceTimersByTime(POINTER_RELEASE_SAFETY_MS);

      const next = vi.fn();
      afterPointerRelease(next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('does not run a change twice when the release follows the safety exit', () => {
      const run = vi.fn();
      fireEvent.pointerDown(document.body);
      afterPointerRelease(run);
      vi.advanceTimersByTime(POINTER_RELEASE_SAFETY_MS);

      fireEvent.pointerUp(document.body);
      vi.runAllTimers();

      expect(run).toHaveBeenCalledTimes(1);
    });
  });
});
