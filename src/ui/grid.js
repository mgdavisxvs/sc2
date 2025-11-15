/**
 * Grid Renderer
 * Renders entity cards in responsive grid layout
 */

import { $, $$ } from '../utils/dom.js';
import { imageOrFallback, tryAlternateExt } from '../utils/image.js';
import { buildPrereqTree, treeToHtml } from '../algorithms/graph.js';
import { state } from '../core/state.js';

/**
 * Create requirement chip
 * @param {string} name - Requirement name
 * @param {Function} findEntity - Function to find entity by name
 * @param {Function} jumpToEntity - Function to jump to entity
 * @returns {HTMLElement}
 */
function makeReqChip(name, findEntity, jumpToEntity) {
  const span = document.createElement('button');
  span.className =
    'text-[11px] px-2 py-0.5 rounded-full border hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1';

  const pic = document.createElement('img');
  pic.loading = 'lazy';
  pic.className = 'w-4 h-4 rounded object-cover';

  const entity = findEntity(name);
  const src = entity
    ? imageOrFallback(entity, state.race, state.imageRoot)
    : imageOrFallback(null, state.race, state.imageRoot);
  pic.src = src;
  pic.alt = `${name} icon`;

  pic.onerror = () => {
    state.brokenImages.add(pic.src);
    if (!tryAlternateExt(pic, pic.src, state.race, (url) => state.brokenImages.add(url))) {
      pic.src = imageOrFallback(null, state.race, state.imageRoot);
    }
  };

  span.appendChild(pic);
  span.appendChild(document.createTextNode(name));
  span.addEventListener('click', () => jumpToEntity(name));

  return span;
}

/**
 * Render entity grid
 * @param {Array} items - Entities to render
 * @param {Function} findEntity - Function to find entity by name
 * @param {Function} jumpToEntity - Function to jump to entity
 * @param {Function} tryAddToBuild - Function to add to build order
 */
export function renderGrid(items, findEntity, jumpToEntity, tryAddToBuild) {
  const wrap = $('#grid');
  if (!wrap) return;

  wrap.innerHTML = '';

  const tpl = $('#cardTpl');
  if (!tpl) return;

  items.forEach(item => {
    const node = tpl.content.cloneNode(true);
    const art = node.querySelector('article');
    const img = node.querySelector('.card-img');
    const title = node.querySelector('.title');
    const addBtn = node.querySelector('.addBtn');
    const reqs = node.querySelector('.reqs');
    const techTree = node.querySelector('.techTree');
    const toggleTree = node.querySelector('.toggleTree');
    const jumpDeps = node.querySelector('.jumpDeps');
    const openLightbox = node.querySelector('.openLightbox');

    // Set anchor ID for jumping
    const anchorId = `jump-${CSS.escape(item.name.toLowerCase().trim())}`;
    art.id = anchorId;

    // Set image
    img.src = imageOrFallback(item, state.race, state.imageRoot);
    img.alt = `${item.name} image`;
    img.onerror = () => {
      state.brokenImages.add(img.src);
      if (!tryAlternateExt(img, img.src, state.race, (url) => state.brokenImages.add(url))) {
        img.src = imageOrFallback(null, state.race, state.imageRoot);
      }
    };

    // Set title
    title.textContent = item.name;

    // Set stats
    ['mineral', 'gas', 'supply', 'buildtime'].forEach(k => {
      const span = node.querySelector(`[data-key="${k}"]`);
      const val = item[k];
      span.textContent =
        val === 0 || val === undefined || val === null ? '-' : String(val);
    });

    // Requirements
    const reqsArr = item.required || [];
    if (!reqsArr.length) {
      const none = document.createElement('span');
      none.className =
        'text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500';
      none.textContent = 'None';
      reqs.appendChild(none);
    } else {
      reqsArr.forEach(r => reqs.appendChild(makeReqChip(r, findEntity, jumpToEntity)));
    }

    // Tech tree
    const tree = buildPrereqTree(item, findEntity);
    techTree.innerHTML = treeToHtml(tree);
    toggleTree.addEventListener('click', () => {
      techTree.classList.toggle('hidden');
    });

    // Jump to dependencies
    jumpDeps.addEventListener('click', () => {
      reqsArr.forEach(jumpToEntity);
    });

    // Lightbox
    openLightbox.addEventListener('click', () => {
      const box = $('#lightbox');
      const lbImg = $('#lightboxImg');
      if (box && lbImg) {
        lbImg.src = img.src;
        lbImg.alt = `${item.name} enlarged image`;
        box.classList.remove('hidden');
        box.classList.add('flex');
      }
    });

    // Add to build button
    addBtn.addEventListener('click', () => tryAddToBuild(item));

    wrap.appendChild(node);
    state.idMap.set(item.name.toLowerCase().trim(), art);
  });

  // Setup lightbox close
  const lb = $('#lightbox');
  if (lb) {
    lb.addEventListener('click', () => {
      lb.classList.add('hidden');
      lb.classList.remove('flex');
    });
  }

  // Update broken image banner
  updateBrokenBanner();
}

/**
 * Update broken image banner
 */
function updateBrokenBanner() {
  const banner = $('#brokenBanner');
  const count = $('#brokenCount');

  if (banner && count) {
    if (state.brokenImages.size > 0) {
      count.textContent = String(state.brokenImages.size);
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }
}

/**
 * Render extras gallery
 * @param {Object} extras - Extras data
 */
export function renderExtras(extras) {
  const wrap = $('#extrasWrap');
  if (!wrap) return;

  wrap.innerHTML = '';

  ['units', 'buildings', 'upgrades'].forEach(sec => {
    if (!extras[sec]) return;

    const items = Object.entries(extras[sec]).map(([name, image]) => ({
      name,
      image,
    }));

    const card = document.createElement('div');
    card.className = 'card rounded-xl border shadow-sm p-3';
    card.innerHTML = `<div class="font-semibold mb-2 capitalize">${sec}</div>`;

    const grid = document.createElement('div');
    grid.className = 'grid grid-cols-2 gap-2';

    items.forEach(({ name, image }) => {
      const row = document.createElement('div');
      row.className =
        'flex gap-2 items-center p-2 rounded border bg-slate-50/50 dark:bg-slate-900/40';

      const pic = document.createElement('img');
      pic.loading = 'lazy';
      pic.className = 'w-8 h-8 rounded object-cover';
      const src = image
        ? imageOrFallback({ image }, state.race, state.imageRoot)
        : imageOrFallback(null, state.race, state.imageRoot);
      pic.src = src;
      pic.alt = `${name} asset`;

      pic.onerror = () => {
        state.brokenImages.add(pic.src);
        if (!tryAlternateExt(pic, pic.src, state.race, (url) => state.brokenImages.add(url))) {
          pic.src = imageOrFallback(null, state.race, state.imageRoot);
        }
      };

      const label = document.createElement('div');
      label.className = 'text-sm truncate';
      label.title = name;
      label.textContent = name;

      row.appendChild(pic);
      row.appendChild(label);
      grid.appendChild(row);
    });

    card.appendChild(grid);
    wrap.appendChild(card);
  });
}

/**
 * Jump to entity by name (scroll and highlight)
 * @param {string} name - Entity name
 */
export function jumpToEntity(name) {
  const id = `jump-${CSS.escape(name.toLowerCase().trim())}`;
  const el = document.getElementById(id);
  if (!el) return;

  el.classList.add('ring-2', 'ring-offset-2', 'ring-blue-400');
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });

  setTimeout(() => {
    el.classList.remove('ring-2', 'ring-offset-2', 'ring-blue-400');
  }, 1200);
}
