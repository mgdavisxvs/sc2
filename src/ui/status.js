/**
 * Status Messages
 * Toast notification system
 */

import { $ } from '../utils/dom.js';

let statusTimeout;

/**
 * Show status toast message
 * @param {string} message - Message to display
 * @param {string} kind - Message type (info|success|error)
 * @param {number} duration - Display duration in milliseconds
 */
export function showStatus(message, kind = 'info', duration = 2500) {
  const el = $('#status-message');
  if (!el) return;

  clearTimeout(statusTimeout);

  el.textContent = message;
  el.className = 'text-sm';

  const bg = kind === 'success'
    ? 'bg-green-600'
    : kind === 'error'
    ? 'bg-red-600'
    : 'bg-blue-500';

  el.classList.add(bg, 'text-white');
  el.classList.add('show');
  el.classList.remove('hide');

  statusTimeout = setTimeout(() => {
    el.classList.add('hide');
    el.classList.remove('show');
  }, duration);
}

/**
 * Hide status message immediately
 */
export function hideStatus() {
  const el = $('#status-message');
  if (!el) return;

  clearTimeout(statusTimeout);
  el.classList.add('hide');
  el.classList.remove('show');
}
