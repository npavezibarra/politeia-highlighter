// assets/js/highlighter.js
(function () {
  'use strict';
  if (!window.politeiaHL) return;

  const API = { base: politeiaHL.rest_url, nonce: politeiaHL.nonce };
  const notesById = new Map();
  let lastMouse = { x: 0, y: 0 }; // viewport coords
  let lastSelectionRange = null; // persists user selection even if focus moves

  // ---------- Helpers ----------
  const byId = (id) => document.getElementById(id);
  const getRoot = () => document.querySelector('#politeia-highlighter-root');
  const getPostId = () => {
    const r = getRoot();
    return r ? parseInt(r.getAttribute('data-post-id'), 10) : null;
  };
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  // Track mouse (viewport coords for fixed positioning)
  document.addEventListener('mousemove', (e) => { lastMouse = { x: e.clientX, y: e.clientY }; });

  // ---------- Popover (fixed, no scroll offsets) ----------
  function ensureNotePopover() {
    let p = byId('politeia-hl-note-popover');
    if (p) return p;
    p = document.createElement('div');
    p.id = 'politeia-hl-note-popover';
    Object.assign(p.style, {
      position: 'fixed', zIndex: '2147483647', padding: '10px',
      maxWidth: '360px', display: 'none'
    });
    // Basic popover structure for viewing notes
    p.innerHTML = `
      <div class="note-content" role="dialog" aria-modal="true" aria-label="${politeiaHL.strings.viewNote}">
        <div class="note-text" id="hl-note-text" style="margin-bottom:8px; white-space:pre-wrap;"></div>
        <div class="actions" style="display:flex; gap:8px; justify-content:flex-end;">
          <button id="hl-popover-delete">${politeiaHL.strings.delete}</button>
          <button id="hl-popover-close">${politeiaHL.strings.close}</button>
        </div>
      </div>
    `;
    document.body.appendChild(p);

    document.addEventListener('click', (e) => {
      const inside = p.contains(e.target);
      const isDot = e.target && e.target.classList && e.target.classList.contains('hl-note-dot');
      if (e.target.id === 'hl-popover-close' || (!inside && p.style.display === 'block' && !isDot)) hideNotePopover();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideNotePopover(); });

    p.addEventListener('click', async (e) => {
      if (e.target && e.target.id === 'hl-popover-delete') {
        const id = p.dataset.hlId ? parseInt(p.dataset.hlId, 10) : null;
        if (!id) return hideNotePopover();
        try {
          await apiDeleteHighlight(id);
          const mark = document.querySelector(`mark.politeia-hl-mark[data-hl-id="${id}"]`);
          if (mark) {
            const next = mark.nextSibling;
            if (next && next.classList && next.classList.contains('hl-note-dot')) next.remove();
            const text = document.createTextNode(mark.textContent);
            mark.parentNode.replaceChild(text, mark);
          }
          notesById.delete(id);
          hideNotePopover();
        } catch (err) {
          console.error(err);
          alert(politeiaHL.strings.errDelete);
        }
      }
    });
    return p;
  }

  function showNotePopover(anchorEl, text, id) {
    const pop = ensureNotePopover();
    const rect = anchorEl.getBoundingClientRect();
    // initial placement below anchor
    let x = rect.left;
    let y = rect.bottom + 8;

    // make visible to measure
    pop.style.visibility = 'hidden';
    pop.style.display = 'block';
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;

    // clamp to viewport
    x = clamp(x, 8, window.innerWidth - w - 8);
    y = clamp(y, 8, window.innerHeight - h - 8);

    pop.style.left = x + 'px';
    pop.style.top = y + 'px';

    byId('hl-note-text').innerText = (text && String(text).trim()) || politeiaHL.strings.noNote;
    pop.dataset.hlId = id ? String(id) : '';

    pop.style.visibility = 'visible';
  }

  function hideNotePopover() {
    const pop = byId('politeia-hl-note-popover');
    if (pop) { pop.style.display = 'none'; pop.dataset.hlId = ''; }
  }

  // ---------- Toolbar (fixed near selection/mouse) ----------
  function ensureToolbar() {
    let bar = byId('politeia-hl-toolbar');
    if (bar) return bar;

    bar = document.createElement('div');
    bar.id = 'politeia-hl-toolbar';
    Object.assign(bar.style, {
      position: 'fixed', zIndex: '2147483647', display: 'none',
      left: '0px', top: '0px', background: '#fff', border: '1px solid #ddd',
      borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,.12)', padding: '10px',
      gap: '10px', maxWidth: '420px', width: 'max-content'
    });
    // Toolbar contains color swatches, note textarea and action buttons
    bar.innerHTML = `
      <div class="hl-colors" style="display:flex; gap:6px; flex-wrap:wrap;"></div>
      <textarea id="politeia-hl-note" placeholder="${politeiaHL.strings.notePlaceholder}" style="min-width:260px; min-height:60px;"></textarea>
      <div style="display:flex; gap:8px; align-items:center;">
        <button id="politeia-hl-save">${politeiaHL.strings.save}</button>
        <button id="politeia-hl-cancel" class="muted">${politeiaHL.strings.cancel}</button>
      </div>
    `;
    document.body.appendChild(bar);

    const colorsWrap = bar.querySelector('.hl-colors');
    (politeiaHL.colors || ['#ffe066']).forEach(c => {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'hl-swatch';
      sw.setAttribute('data-color', c);
      Object.assign(sw.style, {
        width: '22px', height: '22px', borderRadius: '50%',
        border: '1px solid rgba(0,0,0,.15)', background: c, cursor: 'pointer'
      });
      colorsWrap.appendChild(sw);
    });
    // Select first color by default so user sees an active swatch
    if (colorsWrap.firstElementChild) colorsWrap.firstElementChild.classList.add('active');
    return bar;
  }

  function selectionRect() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const range = sel.getRangeAt(0);
    const rects = range.getClientRects();
    const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return null;
    return rect; // viewport coords
  }

  function showToolbarNearSelection() {
    const rect = selectionRect();
    if (!rect) return false;

    const bar = ensureToolbar();
    // make visible to measure
    bar.style.visibility = 'hidden';
    bar.style.display = 'block';

    const w = bar.offsetWidth;
    const h = bar.offsetHeight;

    // prefer above the selection; if not enough room, place below; fallback near mouse
    let x = rect.left;
    let y = rect.top - h - 10;
    if (y < 8) y = rect.bottom + 10;
    if (y > window.innerHeight - h - 8) y = lastMouse.y + 12;

    x = clamp(x, 8, window.innerWidth - w - 8);
    y = clamp(y, 8, window.innerHeight - h - 8);

    bar.style.left = x + 'px';
    bar.style.top = y + 'px';
    bar.style.visibility = 'visible';
    return true;
  }

  function showToolbarAtMouse() {
    const bar = ensureToolbar();
    bar.style.visibility = 'hidden';
    bar.style.display = 'block';
    const w = bar.offsetWidth;
    const h = bar.offsetHeight;
    let x = lastMouse.x + 12;
    let y = lastMouse.y + 12;
    x = clamp(x, 8, window.innerWidth - w - 8);
    y = clamp(y, 8, window.innerHeight - h - 8);
    bar.style.left = x + 'px';
    bar.style.top = y + 'px';
    bar.style.visibility = 'visible';
  }

  function hideToolbar() {
    const bar = byId('politeia-hl-toolbar');
    if (bar) {
      bar.style.display = 'none';
      const ta = byId('politeia-hl-note'); if (ta) ta.value = '';
      bar.querySelectorAll('.hl-swatch.active').forEach(el => el.classList.remove('active'));
    }
    lastSelectionRange = null;
  }

  function currentColor() {
    const active = document.querySelector('.hl-swatch.active');
    return active ? active.getAttribute('data-color') : (politeiaHL.colors ? politeiaHL.colors[0] : '#ffe066');
  }

  // ---------- API (send cookies) ----------
  async function apiCreateHighlight(payload) {
    const url = new URL(API.base, window.location.origin);
    const res = await fetch(url.toString(), {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': API.nonce },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(politeiaHL.strings.errCreate);
    return res.json();
  }
  async function apiListHighlights(post_id) {
    const url = new URL(API.base, window.location.origin);
    url.searchParams.set('post_id', post_id);
    const res = await fetch(url.toString(), { credentials: 'same-origin', headers: { 'X-WP-Nonce': API.nonce } });
    if (!res.ok) throw new Error(politeiaHL.strings.errList);
    return res.json();
  }
  async function apiDeleteHighlight(id) {
    const url = new URL(API.base + '/' + id, window.location.origin);
    const res = await fetch(url.toString(), { method: 'DELETE', credentials: 'same-origin', headers: { 'X-WP-Nonce': API.nonce } });
    if (!res.ok && res.status !== 204) throw new Error(politeiaHL.strings.errDeleteGeneric);
    return true;
  }

  // ---------- Matching / render ----------
  function* textNodesUnder(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let n; while ((n = walker.nextNode())) yield n;
  }
  const normalizeSpaces = (s) => (s || '').replace(/\s+/g, ' ').trim();

    function findBestMatch(exact, prefix, suffix, scopeEl) {
      exact = normalizeSpaces(exact);
      const pfx = normalizeSpaces(prefix);
      const sfx = normalizeSpaces(suffix);
      if (!exact) return null;

      const scope = scopeEl || document.body;
      let best = null;
      for (const tn of textNodesUnder(scope)) {
        const raw = tn.nodeValue;
        if (!raw || !raw.trim()) continue;

        let from = 0;
        while (true) {
          const idx = raw.indexOf(exact, from);
          if (idx === -1) break;

          const LEFT = raw.slice(Math.max(0, idx - 220), idx);
          const RIGHT = raw.slice(idx + exact.length, idx + exact.length + 220);

          let score = 0;
          if (pfx) score += similarityTail(LEFT, pfx);
          if (sfx) score += similarityHead(RIGHT, sfx);

          const parentEl = tn.parentElement;
          if (parentEl && parentEl.closest('#politeia-hl-toolbar, #politeia-hl-note-popover')) score -= 100;

          if (!best || score > best.score) best = { node: tn, start: idx, end: idx + exact.length, score };
          from = idx + exact.length;
        }
      }
      if (best) return best;

      // Fallback: allow matches spanning multiple text nodes.
      const joined = normalizeSpaces(scope.innerText || scope.textContent || '');
      const idx = joined.indexOf(exact);
      if (idx === -1) return null;

      let offset = 0;
      let startNode = null; let endNode = null; let start = 0; let end = 0;
      for (const tn of textNodesUnder(scope)) {
        const len = tn.nodeValue.length;
        if (!startNode && idx < offset + len) {
          startNode = tn;
          start = idx - offset;
        }
        if (!endNode && idx + exact.length <= offset + len) {
          endNode = tn;
          end = idx + exact.length - offset;
          break;
        }
        offset += len;
      }
      if (!startNode || !endNode) return null;
      return { node: startNode, start, endNode, end, score: 0 };
    }
  function similarityTail(a, b) { a = normalizeSpaces(a); b = normalizeSpaces(b); const len = Math.min(a.length, b.length, 60); if (!len) return 0; let same = 0; for (let i = 1; i <= len; i++) { if (a[a.length - i] === b[b.length - i]) same++; else break; } return same; }
  function similarityHead(a, b) { a = normalizeSpaces(a); b = normalizeSpaces(b); const len = Math.min(a.length, b.length, 60); if (!len) return 0; let same = 0; for (let i = 0; i < len; i++) { if (a[i] === b[i]) same++; else break; } return same; }

  function wrapRange(range, color, id, note) {
    if (!range) return null;
    const r = range.cloneRange();
    const mark = document.createElement('mark');
    mark.className = 'politeia-hl-mark';
    mark.style.background = color || (politeiaHL.colors ? politeiaHL.colors[0] : '#ffe066');
    if (id != null) mark.setAttribute('data-hl-id', String(id));
    try {
      r.surroundContents(mark);
    } catch (err) {
      return null;
    }
    if (note && String(note).trim()) injectNoteBadge(mark, note);
    return mark;
  }

  function wrapMatch(best, color, id, note) {
    if (!best || !best.node) return null;
    const r = document.createRange();
    r.setStart(best.node, best.start);
    r.setEnd(best.endNode || best.node, best.end);

    const mark = document.createElement('mark');
    mark.className = 'politeia-hl-mark';
    mark.style.background = color || (politeiaHL.colors ? politeiaHL.colors[0] : '#ffe066');
    if (id != null) mark.setAttribute('data-hl-id', String(id));
    try {
      r.surroundContents(mark);
    } catch (err) {
      return null;
    }

    if (note && String(note).trim()) injectNoteBadge(mark, note);
    return mark;
  }

  function injectNoteBadge(markEl, noteText) {
    if (markEl.nextSibling && markEl.nextSibling.classList && markEl.nextSibling.classList.contains('hl-note-dot')) return;
    const id = markEl.getAttribute('data-hl-id');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hl-note-dot';
    // Small square badge next to highlighted text showing there is a note
    const color = markEl.style.background;
    Object.assign(btn.style, {
      display: 'inline-block', width: '10px', height: '10px', marginLeft: '4px',
      borderRadius: '2px', border: '0', background: color, cursor: 'pointer', verticalAlign: 'middle'
    });
    btn.setAttribute('aria-label', politeiaHL.strings.viewNote);
    btn.title = politeiaHL.strings.viewNote;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const txt = notesById.get(Number(id)) || noteText || politeiaHL.strings.noNote;
      showNotePopover(btn, txt, id);
    });
    markEl.parentNode.insertBefore(btn, markEl.nextSibling);
  }

  async function paintHighlights(post_id) {
    const list = await apiListHighlights(post_id);
    notesById.clear();
    for (const h of list) notesById.set(Number(h.id), h.note || '');
    for (const h of list) {
      const scope = document.querySelector('article, .entry-content, main') || document.body;
      const best = findBestMatch(h.anchor_exact, h.anchor_prefix, h.anchor_suffix, scope);
      const mark = wrapMatch(best, h.color, h.id, h.note);
      if (!mark && h.anchor_exact) {
        const fb = findBestMatch(h.anchor_exact, '', '', document.body);
        wrapMatch(fb, h.color, h.id, h.note);
      }
    }
  }

  // ---------- Selection UX ----------
  function bindSelection() {
    // Show/hide on mouseup
      document.addEventListener('mouseup', (e) => {
        if (e.target && e.target.closest('#politeia-hl-toolbar')) return;
        const s = window.getSelection();
        const txt = s ? s.toString().trim() : '';
        if (txt) {
          lastSelectionRange = s.getRangeAt(0).cloneRange();
          // Prefer near selection; fallback near mouse
          if (!showToolbarNearSelection()) showToolbarAtMouse();
        } else {
          hideToolbar();
        }
      });

    // Swatches
    document.addEventListener('click', (e) => {
      if (e.target && e.target.matches('.hl-swatch')) {
        document.querySelectorAll('.hl-swatch.active').forEach(el => el.classList.remove('active'));
        e.target.classList.add('active');
      }
    });

    // Save / Cancel
    document.addEventListener('click', async (e) => {
      if (e.target && e.target.id === 'politeia-hl-save') {
        const sel = lastSelectionRange;
        const text = sel ? sel.toString().trim() : '';
        if (!text) { hideToolbar(); return; }

        const selector = (function buildSelectorFromRange(range) {
          const container = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
          const block = container.closest ? (container.closest('p,div,article,section,main') || document.body) : document.body;
          const full = (block.innerText || block.textContent || '').replace(/\s+/g, ' ');
          const idx = full.indexOf(text);
          let anchor_prefix = '', anchor_suffix = '';
          if (idx !== -1) {
            anchor_prefix = full.slice(Math.max(0, idx - 200), idx);
            anchor_suffix = full.slice(idx + text.length, idx + text.length + 200);
          }
          return { exact: text, anchor_prefix, anchor_suffix };
        })(sel);

        const note = (byId('politeia-hl-note')?.value || '').slice(0, 1000);
        const payload = {
          post_id: getPostId(),
          anchor_exact: selector.exact,
          anchor_prefix: selector.anchor_prefix || '',
          anchor_suffix: selector.anchor_suffix || '',
          color: currentColor(),
          note
        };

        try {
          const created = await apiCreateHighlight(payload);
          notesById.set(Number(created.id), note || '');
          const mark = wrapRange(sel, payload.color, created.id, note);
          if (!mark) {
            const scope = document.querySelector('article, .entry-content, main') || document.body;
            wrapMatch(findBestMatch(payload.anchor_exact, payload.anchor_prefix, payload.anchor_suffix, scope), payload.color, created.id, note);
          }
        } catch (err) {
          console.error(err);
          alert(politeiaHL.strings.errSave);
        } finally {
          hideToolbar();
          window.getSelection()?.removeAllRanges();
        }
      }
      if (e.target && e.target.id === 'politeia-hl-cancel') {
        hideToolbar();
        window.getSelection()?.removeAllRanges();
      }
    });

    // Reposition on scroll/resize if visible
    const reposition = () => {
      const bar = byId('politeia-hl-toolbar');
      if (!bar || bar.style.display === 'none') return;
      if (!showToolbarNearSelection()) hideToolbar();
    };
    window.addEventListener('scroll', reposition, { passive: true });
    window.addEventListener('resize', reposition);
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', () => {
    const postId = getPostId();
    if (!postId) return;
    bindSelection();
    paintHighlights(postId).catch(console.error);
  });
})();
