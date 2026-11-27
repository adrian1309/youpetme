import '@testing-library/jest-dom/vitest';
// The UI is built on translation keys: initialize i18n for every spec, as main.tsx does.
import '../lib/i18n';

// jsdom has no modal dialogs: a minimal stand-in for showModal/close, for tests only. The browser
// provides the real focus trap and Escape handling.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
