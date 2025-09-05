document.addEventListener('DOMContentLoaded', function() {
  const table = document.querySelector('.politeia-hl-table');
  if (!table) return;

  const tbody = table.querySelector('tbody');
  table.querySelectorAll('th[data-sort]').forEach(function(th) {
    th.addEventListener('click', function() {
      const key = th.dataset.sort;
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const direction = th.classList.contains('asc') ? -1 : 1;

      rows.sort(function(a, b) {
        const aVal = getVal(a, key);
        const bVal = getVal(b, key);
        if (key === 'index' || key === 'date') {
          return (aVal - bVal) * direction;
        }
        if (key === 'color') {
          return aVal.localeCompare(bVal) * direction;
        }
        return 0;
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
    if (key === 'color') {
      return cell.dataset.color;
    }
    return cell.textContent;
  }
});
