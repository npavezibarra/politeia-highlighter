document.addEventListener('DOMContentLoaded', function() {
  const table = document.querySelector('.politeia-hl-table');
  if (!table || !window.politeiaHLTable) return;

  const tbody = table.querySelector('tbody');
  const colorsWrap = document.querySelector('#politeia-hl-color');

  if (colorsWrap && Array.isArray(politeiaHLTable.colors)) {
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.textContent = 'All';
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
        data.forEach(function(row, idx) {
          const tr = document.createElement('tr');
          const created = new Date(row.created_at.replace(' ', 'T'));
          const dateStr = created.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
          const timeStr = created.toLocaleTimeString();
          tr.innerHTML =
            '<td class="hl-index">' + (idx + 1) + '</td>' +
            '<td class="hl-text">' + escapeHtml(row.anchor_exact) + '</td>' +
            '<td class="hl-date" data-timestamp="' + Math.floor(created.getTime() / 1000) + '">' +
              '<span class="hl-date-day">' + dateStr + '</span><br><small class="hl-date-time">' + timeStr + '</small>' +
            '</td>' +
            '<td class="hl-note">' + escapeHtml(row.note) + '</td>' +
            '<td class="hl-post">' + escapeHtml(row.post_title) + '</td>';
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
    if (key === 'index') {
      return parseInt(cell.textContent, 10);
    }
    if (key === 'date') {
      return parseInt(cell.dataset.timestamp, 10);
    }
    return 0;
  }

  fetchHighlights('');
});

