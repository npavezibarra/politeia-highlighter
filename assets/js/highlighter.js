(function () {
  if (!window.politeiaHL) return;

  const API = { base: politeiaHL.rest_url, nonce: politeiaHL.nonce };
  const notesById = new Map(); // id → note (para mostrar nota al hacer clic en el <mark>)

  // ---------- Helpers DOM ----------
  function byId(id) { return document.getElementById(id); }
  function getRoot() { return document.querySelector('#politeia-highlighter-root'); }
  function getPostId() { const r = getRoot(); return r ? parseInt(r.getAttribute('data-post-id'), 10) : null; }

  // ---------- Popover de nota ----------
  function ensureNotePopover() {
    let p = byId('politeia-hl-note-popover');
    if (p) return p;

    p = document.createElement('div');
    p.id = 'politeia-hl-note-popover';
    p.innerHTML = `
      <div class="note-content" role="dialog" aria-modal="true" aria-label="Nota del highlight">
        <div class="note-text" id="hl-note-text"></div>
        <div class="actions">
          <button id="hl-popover-delete">Eliminar</button>
          <button id="hl-popover-close">Cerrar</button>
        </div>
      </div>
    `;
    document.body.appendChild(p);

    // Cerrar con botón/esc/clic-fuera
    document.addEventListener('click', (e) => {
      const inside = p.contains(e.target);
      const isDot = e.target && e.target.classList && e.target.classList.contains('hl-note-dot');
      if (e.target.id === 'hl-popover-close' || (!inside && p.style.display === 'block' && !isDot)) {
        hideNotePopover();
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hideNotePopover();
    });

    // Borrar highlight
    p.addEventListener('click', async (e) => {
      if (e.target && e.target.id === 'hl-popover-delete') {
        const id = p.dataset.hlId ? parseInt(p.dataset.hlId, 10) : null;
        if (!id) return hideNotePopover();

        try {
          await apiDeleteHighlight(id);
          // Quitar <mark> y badge del DOM
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
          alert('No se pudo eliminar el highlight.');
        }
      }
    });

    return p;
  }

  function showNotePopover(anchorEl, text, id) {
    const pop = ensureNotePopover();
    const rect = anchorEl.getBoundingClientRect();
    const y = window.scrollY + rect.bottom + 8;
    const x = window.scrollX + rect.left;
    pop.style.top = y + 'px';
    pop.style.left = x + 'px';
    byId('hl-note-text').innerText = (text && String(text).trim()) || '(Sin nota)';
    pop.dataset.hlId = id ? String(id) : '';
    pop.style.display = 'block';
  }

  function hideNotePopover() {
    const pop = byId('politeia-hl-note-popover');
    if (pop) {
      pop.style.display = 'none';
      pop.dataset.hlId = '';
    }
  }

  // ---------- Toolbar (guardar) ----------
  function ensureToolbar() {
    let bar = byId('politeia-hl-toolbar');
    if (bar) return bar;

    bar = document.createElement('div');
    bar.id = 'politeia-hl-toolbar';
    bar.innerHTML = `
      <div class="hl-colors"></div>
      <textarea id="politeia-hl-note" placeholder="Nota opcional..."></textarea>
      <button id="politeia-hl-save">Guardar highlight</button>
      <button id="politeia-hl-cancel" class="muted">Cancelar</button>
    `;
    document.body.appendChild(bar);

    const colorsWrap = bar.querySelector('.hl-colors');
    (politeiaHL.colors || ['#ffe066']).forEach(c => {
      const sw = document.createElement('button');
      sw.className = 'hl-swatch';
      sw.setAttribute('data-color', c);
      sw.style.background = c;
      colorsWrap.appendChild(sw);
    });

    return bar;
  }

  function showToolbar(x, y) {
    const bar = ensureToolbar();
    bar.style.display = 'block';
    bar.style.left = x + 'px';
    bar.style.top  = y + 'px';
  }

  function hideToolbar() {
    const bar = byId('politeia-hl-toolbar');
    if (bar) {
      bar.style.display = 'none';
      const ta = byId('politeia-hl-note');
      if (ta) ta.value = '';
      bar.querySelectorAll('.hl-swatch.active').forEach(el => el.classList.remove('active'));
    }
  }

  function currentColor() {
    const active = document.querySelector('.hl-swatch.active');
    return active ? active.getAttribute('data-color') : (politeiaHL.colors ? politeiaHL.colors[0] : '#ffe066');
  }

  // ---------- API ----------
  async function apiCreateHighlight(payload) {
    const res = await fetch(API.base, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': API.nonce },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('No se pudo crear el highlight');
    return res.json(); // incluye id
  }

  async function apiListHighlights(post_id) {
    const url = new URL(API.base, window.location.origin);
    url.searchParams.set('post_id', post_id);
    const res = await fetch(url.toString(), { headers: { 'X-WP-Nonce': API.nonce } });
    if (!res.ok) throw new Error('No se pudo obtener la lista');
    return res.json();
  }

  async function apiDeleteHighlight(id) {
    const url = API.base + '/' + id;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'X-WP-Nonce': API.nonce }
    });
    if (!res.ok && res.status !== 204) throw new Error('No se pudo borrar');
    return true;
  }

  // ---------- Matching robusto ----------
  function* textNodesUnder(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null);
    let n; while (n = walker.nextNode()) yield n;
  }

  function normalizeSpaces(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

  /** Devuelve {node, start, end} de la mejor coincidencia para exact usando prefix/suffix como pistas */
  function findBestMatch(exact, prefix, suffix, scopeEl) {
    exact = normalizeSpaces(exact);
    const pfx = normalizeSpaces(prefix);
    const sfx = normalizeSpaces(suffix);
    if (!exact) return null;

    let best = null;
    for (const tn of textNodesUnder(scopeEl || document.body)) {
      const raw = tn.nodeValue;
      if (!raw || !raw.trim()) continue;

      // Buscamos todas las ocurrencias de 'exact' en este nodo
      let from = 0;
      while (true) {
        const idx = raw.indexOf(exact, from);
        if (idx === -1) break;

        // Construimos contexto alrededor para puntuar
        const LEFT = raw.slice(Math.max(0, idx - 220), idx);
        const RIGHT = raw.slice(idx + exact.length, idx + exact.length + 220);

        // Score básico por coincidencias parciales de prefix/suffix
        let score = 0;
        if (pfx) score += similarityTail(LEFT, pfx);   // coincide fin de LEFT vs fin de prefix
        if (sfx) score += similarityHead(RIGHT, sfx);  // coincide inicio de RIGHT vs inicio de suffix

        // Penalizar zonas de UI del plugin
        const parentEl = tn.parentElement;
        if (parentEl && parentEl.closest('#politeia-hl-toolbar, #politeia-hl-note-popover')) {
          score -= 100;
        }

        if (!best || score > best.score) {
          best = { node: tn, start: idx, end: idx + exact.length, score };
        }
        from = idx + exact.length;
      }
    }
    return best;
  }

  function similarityTail(a, b) {
    a = normalizeSpaces(a); b = normalizeSpaces(b);
    const len = Math.min(a.length, b.length, 60);
    if (!len) return 0;
    let same = 0;
    for (let i = 1; i <= len; i++) {
      if (a[a.length - i] === b[b.length - i]) same++;
      else break;
    }
    return same;
  }

  function similarityHead(a, b) {
    a = normalizeSpaces(a); b = normalizeSpaces(b);
    const len = Math.min(a.length, b.length, 60);
    if (!len) return 0;
    let same = 0;
    for (let i = 0; i < len; i++) {
      if (a[i] === b[i]) same++;
      else break;
    }
    return same;
  }

  // ---------- Wrapping + badge ----------
  function wrapMatch(best, color, id, note) {
    if (!best || !best.node) return null;
    const r = document.createRange();
    r.setStart(best.node, best.start);
    r.setEnd(best.node, best.end);

    const mark = document.createElement('mark');
    mark.className = 'politeia-hl-mark';
    mark.style.background = color || (politeiaHL.colors ? politeiaHL.colors[0] : '#ffe066');
    if (id != null) mark.setAttribute('data-hl-id', String(id));
    r.surroundContents(mark);

    // Badge de nota si corresponde
    if (note && String(note).trim()) {
      injectNoteBadge(mark, note);
    }
    return mark;
  }

  function injectNoteBadge(markEl, noteText) {
    // Evita duplicados
    if (markEl.nextSibling && markEl.nextSibling.classList && markEl.nextSibling.classList.contains('hl-note-dot')) return;

    const id = markEl.getAttribute('data-hl-id');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hl-note-dot';
    btn.setAttribute('aria-label', 'Ver nota');
    btn.title = 'Ver nota';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const txt = notesById.get(Number(id)) || noteText || '(Sin nota)';
      showNotePopover(btn, txt, id);
    });

    markEl.parentNode.insertBefore(btn, markEl.nextSibling);
  }

  // ---------- Pintado ----------
  async function paintHighlights(post_id) {
    const list = await apiListHighlights(post_id);

    // Rellena mapa de notas para acceso rápido desde <mark> y badge
    notesById.clear();
    for (const h of list) {
      notesById.set(Number(h.id), h.note || '');
    }

    for (const h of list) {
      const scope = document.querySelector('article, .entry-content, main') || document.body;
      const best = findBestMatch(h.anchor_exact, h.anchor_prefix, h.anchor_suffix, scope);
      const mark = wrapMatch(best, h.color, h.id, h.note);
      if (!mark && h.anchor_exact) {
        // Fallback simple: buscar por exact en todo el body
        const fb = findBestMatch(h.anchor_exact, '', '', document.body);
        wrapMatch(fb, h.color, h.id, h.note);
      }
    }
  }

  // ---------- Selección + guardado ----------
  function selectionCoordinates() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return { x: 0, y: 0 };
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    return { x: Math.max(rect.left, 0) + window.scrollX, y: Math.max(rect.top - 48, 0) + window.scrollY };
  }

  function buildSelectorFromSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return null;
    const exact = sel.toString().trim();
    if (!exact) return null;

    const range = sel.getRangeAt(0);
    const container = range.startContainer.nodeType === 1
      ? range.startContainer
      : range.startContainer.parentElement;
    const block = container.closest ? (container.closest('p,div,article,section,main') || document.body) : document.body;

    const full = (block.innerText || block.textContent || '').replace(/\s+/g, ' ');
    const idx = full.indexOf(exact);
    let anchor_prefix = '', anchor_suffix = '';
    if (idx !== -1) {
      anchor_prefix = full.slice(Math.max(0, idx - 200), idx);
      anchor_suffix = full.slice(idx + exact.length, idx + exact.length + 200);
    }
    return { exact, anchor_prefix, anchor_suffix };
  }

  function bindSelection() {
    document.addEventListener('mouseup', (e) => {
      const s = window.getSelection();
      const txt = s ? s.toString().trim() : '';
      if (txt && !e.target.closest('#politeia-hl-toolbar')) {
        const { x, y } = selectionCoordinates();
        showToolbar(x, y);
      } else if (!txt && !e.target.closest('#politeia-hl-toolbar')) {
        hideToolbar();
      }
    });

    document.addEventListener('click', (e) => {
      if (e.target && e.target.matches('.hl-swatch')) {
        document.querySelectorAll('.hl-swatch.active').forEach(el => el.classList.remove('active'));
        e.target.classList.add('active');
      }
    });

    document.addEventListener('click', async (e) => {
      if (e.target && e.target.id === 'politeia-hl-save') {
        const selector = buildSelectorFromSelection();
        if (!selector) { hideToolbar(); return; }

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
          const created = await apiCreateHighlight(payload); // incluye id
          notesById.set(Number(created.id), note || '');
          const scope = document.querySelector('article, .entry-content, main') || document.body;
          const best = findBestMatch(payload.anchor_exact, payload.anchor_prefix, payload.anchor_suffix, scope);
          const mark = wrapMatch(best, payload.color, created.id, note);
          if (!mark) {
            const fb = findBestMatch(payload.anchor_exact, '', '', document.body);
            wrapMatch(fb, payload.color, created.id, note);
          }
        } catch (err) {
          console.error(err);
          alert('No se pudo guardar el highlight.');
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

    // Abrir popover al clicar el texto resaltado
    document.addEventListener('click', (e) => {
      const mark = e.target.closest && e.target.closest('mark.politeia-hl-mark');
      if (!mark) return;
      const idStr = mark.getAttribute('data-hl-id');
      if (!idStr) return;
      const id = Number(idStr);
      const badge = mark.nextSibling && mark.nextSibling.classList && mark.nextSibling.classList.contains('hl-note-dot') ? mark.nextSibling : mark;
      const note = notesById.get(id) || '(Sin nota)';
      showNotePopover(badge, note, id);
    });
  }

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', () => {
    const postId = getPostId();
    if (!postId) return;
    bindSelection();
    paintHighlights(postId).catch(console.error);
  });
})();
