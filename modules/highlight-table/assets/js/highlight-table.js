document.addEventListener('DOMContentLoaded', function() {
  const table = document.querySelector('.politeia-hl-table');
  if (!table || !window.politeiaHLTable) return;

  const tbody = table.querySelector('tbody');
  const colorsWrap = document.querySelector('#politeia-hl-color');
  const editLabel = politeiaHLTable.editLabel || 'Edit';
  const addLabel = politeiaHLTable.addLabel || 'Add Note';
  const saveLabel = politeiaHLTable.saveLabel || 'Save';
  const errSave = politeiaHLTable.errSave || 'Could not save note.';

  if (colorsWrap && Array.isArray(politeiaHLTable.colors)) {
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.textContent = politeiaHLTable.allLabel;
    allBtn.className = 'hl-swatch';
    Object.assign(allBtn.style, {
      height: '22px', borderRadius: '4px',
      border: '1px solid rgba(0,0,0,.15)', background: '#fff',
      cursor: 'pointer', padding: '0 8px'
    });
    colorsWrap.appendChild(allBtn);
    politeiaHLTable.colors.forEach(function(c) {
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
    if (colorsWrap.firstElementChild) colorsWrap.firstElementChild.classList.add('active');
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function fetchHighlights(color) {
    const url = new URL(politeiaHLTable.restUrl, window.location.origin);
    if (color) {
      url.searchParams.append('color', color);
    }

    fetch(url.toString(), {
      headers: { 'X-WP-Nonce': politeiaHLTable.nonce }
    })
      .then(res => res.json())
      .then(data => {
        tbody.innerHTML = '';
        data.forEach(function(row) {
          const tr = document.createElement('tr');
          const created = new Date(row.created_at.replace(' ', 'T'));
          const dateStr = created.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
          const timeStr = created.toLocaleTimeString();
            tr.innerHTML = `
              <td class="hl-text">
                <a class="hl-post-title" href="${escapeHtml(row.post_url)}">${escapeHtml(row.post_title)}</a>
                <div class="hl-highlight">${escapeHtml(row.anchor_exact)}</div>
                <hr class="hl-date-separator" />
                <div class="hl-date" data-timestamp="${Math.floor(created.getTime() / 1000)}">${dateStr} ${timeStr}</div>
              </td>
              <td class="hl-note" data-id="${row.id}">
                <div class="note-display">${escapeHtml(row.note)}</div>
                <a href="#" class="hl-note-edit">${(row.note && String(row.note).trim()) ? editLabel : addLabel}</a>
              </td>`;
          tbody.appendChild(tr);
        });
      });
  }

  if (colorsWrap) {
    colorsWrap.addEventListener('click', function(e) {
      const btn = e.target.closest('.hl-swatch');
      if (!btn) return;
      colorsWrap.querySelectorAll('.hl-swatch').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      fetchHighlights(btn.dataset.color || '');
    });
  }

  tbody.addEventListener('click', async function(e) {
    const link = e.target.closest('.hl-note-edit');
    if (!link) return;
    e.preventDefault();
    const cell = link.closest('.hl-note');
    const id = cell ? cell.dataset.id : null;
    if (!id) return;

    if (!cell.dataset.editing) {
      const text = cell.querySelector('.note-display')?.textContent || '';
      const textarea = document.createElement('textarea');
      textarea.className = 'hl-note-input';
      textarea.value = text;
      const width = cell.getBoundingClientRect().width;
      cell.style.width = width + 'px';
      textarea.style.width = '100%';
      cell.querySelector('.note-display').replaceWith(textarea);
      const resize = () => {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      };
      resize();
      textarea.addEventListener('input', resize);
      link.textContent = saveLabel;
      cell.dataset.editing = '1';
      textarea.focus();
    } else {
      const textarea = cell.querySelector('.hl-note-input');
      const note = textarea.value.slice(0, 1000);
      try {
        const url = new URL(politeiaHLTable.apiBase + '/' + id, window.location.origin);
        const res = await fetch(url.toString(), {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': politeiaHLTable.nonce },
          body: JSON.stringify({ note })
        });
        if (!res.ok) throw new Error();
        const div = document.createElement('div');
        div.className = 'note-display';
        div.textContent = note;
        textarea.replaceWith(div);
        link.textContent = editLabel;
        delete cell.dataset.editing;
        cell.style.width = '';
      } catch (err) {
        alert(errSave);
      }
    }
  });

  table.querySelectorAll('th[data-sort]').forEach(function(th) {
    th.addEventListener('click', function() {
      const key = th.dataset.sort;
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const direction = th.classList.contains('asc') ? -1 : 1;

      rows.sort(function(a, b) {
        const aVal = getVal(a, key);
        const bVal = getVal(b, key);
        return (aVal - bVal) * direction;
      });

      tbody.innerHTML = '';
      rows.forEach(function(row) { tbody.appendChild(row); });

      table.querySelectorAll('th[data-sort]').forEach(function(h) {
        h.classList.remove('asc', 'desc');
      });
      th.classList.add(direction === 1 ? 'asc' : 'desc');
    });
  });

  function getVal(row, key) {
    const cell = row.querySelector('.hl-' + key);
    if (key === 'date') {
      return parseInt(cell.dataset.timestamp, 10);
    }
    return 0;
  }

  fetchHighlights('');
});

