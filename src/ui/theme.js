/**
 * Theme Management
 * Handles light/dark mode and race-specific theming
 */

import { $, $$ } from '../utils/dom.js';
import { RACE_COLORS } from '../core/config.js';

/**
 * Initialize theme toggle
 */
export function initTheme() {
  const themeToggle = $('#themeToggle');
  const darkModeToggle = $('#darkModeToggle');

  themeToggle?.addEventListener('click', () => {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
  });

  darkModeToggle?.addEventListener('click', () => {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
      html.classList.remove('dark');
    } else {
      html.classList.add('dark');
    }
  });
}

/**
 * Apply race-specific theme
 * @param {string} race - Race name
 * @param {string} section - Section name
 */
export function applyRaceTheme(race, section) {
  // Update badge
  const badge = $('#raceBadge');
  if (badge) {
    badge.textContent = race[0].toUpperCase() + race.slice(1);
  }

  // Update race indicator dot
  const dot = $('#raceDot');
  if (dot) {
    const colors = RACE_COLORS[race];
    dot.className = `w-3 h-3 rounded-full ${colors?.dot || 'bg-steel'}`;
  }

  // Update race tabs
  $$('.race-tab').forEach(btn => {
    const active = btn.dataset.race === race;
    btn.classList.toggle('bg-slate-900', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('dark:bg-slate-100', active);
    btn.classList.toggle('dark:text-slate-900', active);
  });

  // Update section tabs
  $$('.section-tab').forEach(btn => {
    const active = btn.dataset.section === section;
    btn.classList.toggle('bg-slate-900', active);
    btn.classList.toggle('text-white', active);
    btn.classList.toggle('dark:bg-slate-100', active);
    btn.classList.toggle('dark:text-slate-900', active);
  });
}
