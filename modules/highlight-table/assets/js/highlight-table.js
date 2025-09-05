document.addEventListener('DOMContentLoaded', function() {
  const table = document.querySelector('.politeia-hl-table');
  if (!table || !window.politeiaHLTable) return;

  const tbody = table.querySelector('tbody');
  const select = document.querySelector('#politeia-hl-color');

  if (select && Array.isArray(politeiaHLTable.colors)) {
    politeiaHLTable.colors.forEach(function(c) {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      select.appendChild(opt);
    });
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

  if (select) {
    select.addEventListener('change', function() {
      fetchHighlights(this.value);
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

