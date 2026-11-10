/**
 * Defers a layout-changing reaction (a field's blur validation) while a pointer is pressed.
 *
 * Pressing a control blurs the focused field. If the field's error appeared right away, it would
 * move the content down before the release, the release would land on another element and the
 * browser would fire no click (SCRUM-51). The reaction waits for the release instead, and for the
 * task after it, so the click is already dispatched. Without a pressed pointer (keyboard) it runs
 * at once.
 */

/** Longest wait when the release never arrives, e.g. a pointer released outside the window. */
export const POINTER_RELEASE_SAFETY_MS = 1000;

let pressed = false;
let pending: (() => void)[] = [];
let safetyTimer: ReturnType<typeof setTimeout> | undefined;
let clickTimer: ReturnType<typeof setTimeout> | undefined;

function flush() {
  clearTimeout(safetyTimer);
  safetyTimer = undefined;
  const runs = pending;
  pending = [];
  for (const run of runs) run();
}

function release() {
  clearTimeout(clickTimer);
  clickTimer = undefined;
  if (!pressed) return;
  pressed = false;
  if (pending.length > 0) setTimeout(flush, 0);
}

function onPointerUp(event: PointerEvent) {
  if (event.pointerType === 'touch' || event.pointerType === 'pen') {
    // The browser emulates mousedown, mouseup and click only after the touch ends, and the field
    // is blurred on that mousedown: wait for the click, or give up after the safety delay.
    clearTimeout(clickTimer);
    clickTimer = setTimeout(release, POINTER_RELEASE_SAFETY_MS);
    return;
  }
  release();
}

if (typeof window !== 'undefined') {
  // Capture phase, so the state is known before any handler of the pressed element runs.
  window.addEventListener(
    'pointerdown',
    () => {
      clearTimeout(clickTimer);
      clickTimer = undefined;
      pressed = true;
    },
    true,
  );
  window.addEventListener('pointerup', onPointerUp, true);
  window.addEventListener('click', release, true);
  window.addEventListener('pointercancel', release, true);
  // Releasing outside the window may never send pointerup; leaving the window always blurs it.
  window.addEventListener('blur', release);
}

/** Runs `run` now, or after the pressed pointer is released (at most POINTER_RELEASE_SAFETY_MS). */
export function afterPointerRelease(run: () => void): void {
  if (!pressed) {
    run();
    return;
  }
  pending.push(run);
  safetyTimer ??= setTimeout(() => {
    pressed = false;
    flush();
  }, POINTER_RELEASE_SAFETY_MS);
}
