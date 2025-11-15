/**
 * Build Order UI
 * Renders build order list with drag-and-drop reordering
 */

import { $ } from '../utils/dom.js';
import { imageOrFallback, tryAlternateExt } from '../utils/image.js';
import { state } from '../core/state.js';

/**
 * Render build order list
 * @param {boolean} animate - Whether to animate last item
 */
export function renderBuildList(animate = false) {
  const list = $('#buildList');
  if (!list) return;

  list.innerHTML = '';

  state.build.forEach((item, idx) => {
    const li = document.createElement('li');
    li.className =
      'flex items-center gap-2 p-2 rounded border bg-white/60 dark:bg-slate-900/50';

    if (animate && idx === state.build.length - 1) {
      li.classList.add('fade-in');
    }

    // Drag and drop
    li.draggable = true;
    li.addEventListener('dragstart', e =>
      e.dataTransfer.setData('text/plain', String(idx))
    );
    li.addEventListener('dragover', e => e.preventDefault());
    li.addEventListener('drop', e => {
      e.preventDefault();
      const from = Number(e.dataTransfer.getData('text/plain'));
      if (!Number.isNaN(from) && from !== idx) {
        state.reorderBuild(from, idx);
        renderBuildList();
      }
    });

    // Image
    const img = document.createElement('img');
    img.loading = 'lazy';
    img.className = 'w-8 h-8 rounded object-cover';
    img.src = item.image || imageOrFallback(null, state.race, state.imageRoot);
    img.onerror = () => {
      state.brokenImages.add(img.src);
      if (!tryAlternateExt(img, img.src, state.race, (url) => state.brokenImages.add(url))) {
        img.src = imageOrFallback(null, state.race, state.imageRoot);
      }
    };

    // Kind tag
    const tag = document.createElement('span');
    tag.className = 'text-[11px] px-2 py-0.5 rounded-full border';
    tag.textContent = item.kind;

    // Name
    const name = document.createElement('div');
    name.className = 'text-sm font-medium truncate';
    name.textContent = item.name;

    // Missing prereqs
    const reqWrap = document.createElement('div');
    reqWrap.className = 'flex flex-wrap gap-1 text-[10px] text-slate-500';
    if (item.missing?.length) {
      const t = document.createElement('span');
      t.textContent = 'Missing:';
      reqWrap.appendChild(t);
      item.missing.forEach(m => {
        const chip = document.createElement('span');
        chip.className =
          'px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200';
        chip.textContent = m;
        reqWrap.appendChild(chip);
      });
    }

    // Locked badge
    if (item.locked) {
      const badge = document.createElement('span');
      badge.className =
        'text-[11px] ml-2 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200';
      badge.textContent = 'Locked';
      li.appendChild(badge);
    }

    // Remove button
    const del = document.createElement('button');
    del.className = 'ml-auto text-xs px-2 py-1 rounded border';
    del.textContent = 'Remove';
    del.addEventListener('click', () => {
      state.removeFromBuild(idx);
      renderBuildList();
    });

    li.appendChild(img);
    li.appendChild(tag);
    li.appendChild(name);
    li.appendChild(reqWrap);
    li.appendChild(del);
    list.appendChild(li);
  });

  // Update totals
  const totals = state.getBuildTotals();
  const totMineral = $('#totMineral');
  const totGas = $('#totGas');
  const totSupply = $('#totSupply');

  if (totMineral) totMineral.textContent = totals.mineral;
  if (totGas) totGas.textContent = totals.gas;
  if (totSupply) totSupply.textContent = totals.supply;

  // Update warnings
  const locked = state.getLockedItems();
  const warnings = $('#buildWarnings');
  if (warnings) {
    warnings.textContent = locked.length
      ? `${locked.length} step(s) are locked due to unmet prerequisites.`
      : '';
  }
}
