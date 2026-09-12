'use strict';
// Progressive enhancement: the complete catalog stays readable without JavaScript.
const grid = document.querySelector('[data-catalog]');
if (grid) {
  const entries = Array.from(grid.querySelectorAll('[data-entry]'));
  const filters = Array.from(document.querySelectorAll('[data-filter]'));
  const search = document.querySelector('#catalog-search');
  const status = document.querySelector('#catalog-status');
  const empty = document.querySelector('#catalog-empty');
  const clear = document.querySelector('#clear-search');
  let category = 'all';
  const normalise = value => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const searchable = entries.map(entry => normalise(entry.textContent + ' ' + (entry.dataset.keywords || '')));
  function applyFilters() {
    const query = normalise(search ? search.value.trim() : '');
    let visible = 0;
    entries.forEach((entry, index) => {
      const matchesCategory = category === 'all' || (entry.dataset.category || '').split(' ').includes(category);
      const matchesQuery = query.split(/\s+/).every(word => searchable[index].includes(word));
      entry.hidden = !(matchesCategory && matchesQuery);
      if (!entry.hidden) visible++;
    });
    if (status) status.textContent = `${visible} of ${entries.length} ${grid.dataset.catalog} shown`;
    if (empty) empty.hidden = visible !== 0;
    if (clear) clear.hidden = !query && category === 'all';
  }
  filters.forEach(button => button.addEventListener('click', () => {
    category = button.dataset.filter;
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter === button)));
    applyFilters();
  }));
  if (search) search.addEventListener('input', applyFilters);
  if (clear) clear.addEventListener('click', () => {
    if (search) search.value = '';
    category = 'all';
    filters.forEach(filter => filter.setAttribute('aria-pressed', String(filter.dataset.filter === 'all')));
    applyFilters();
    if (search) search.focus();
  });
  applyFilters();
}
// Do not keep a manually started comparison playing in a background tab.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) document.querySelectorAll('video').forEach(video => video.pause());
});
