const labels = { research: 'Papers Científicos', news: 'Notícias', trends: 'Tendências' };
const API_BASE = location.protocol === 'file:' ? '' : 'http://127.0.0.1:8765';
let data = null;
let activeCategory = '';
let activeSubcategory = '';

const $ = (id) => document.getElementById(id);

async function loadData() {
  if (location.protocol === 'file:') {
    try {
      const res = await fetch('./data.json?ts=' + Date.now());
      data = await res.json();
      renderAll();
    } catch (e) {
      document.getElementById('status').textContent = 'Não consegui carregar data.json local.';
    }
    return;
  }
  const res = await fetch(API_BASE + '/api/data?ts=' + Date.now());
  data = await res.json();
  renderAll();
}

function flattenItems() {
  const sections = data?.sections || {};
  return Object.entries(sections).flatMap(([category, items]) =>
    (items || []).map(it => ({...it, category: it.category || category}))
  ).filter(it => !it.deleted && !(data.deleted_urls || []).includes(it.url || it.id));
}

function uniq(arr) { return [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR')); }

function renderAll() {
  $('period').textContent = `${data.period || ''} · Última atualização: ${data.generated_at || 'n/d'}`;
  $('takeaways').innerHTML = (data.takeaways || []).map(t => `<li>${escapeHtml(t)}</li>`).join('');
  renderSources();
  renderButtons();
  renderCards();
}

function renderSources() {
  const current = $('sourceSelect').value;
  const sources = uniq(flattenItems().map(i => i.source));
  $('sourceSelect').innerHTML = '<option value="">Todas as fontes</option>' + sources.map(s => `<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('');
  $('sourceSelect').value = sources.includes(current) ? current : '';
}

function renderButtons() {
  const items = flattenItems();
  const categories = uniq(items.map(i => i.category));
  $('categoryButtons').innerHTML = buttonHtml('', 'Todas', activeCategory === '') + categories.map(c => buttonHtml(c, labels[c] || c, activeCategory === c)).join('');

  const subItems = activeCategory ? items.filter(i => i.category === activeCategory) : items;
  const subs = uniq(subItems.map(i => i.subcategory || 'Geral'));
  $('subcategoryButtons').innerHTML = buttonHtml('', 'Todas', activeSubcategory === '') + subs.map(s => buttonHtml(s, s, activeSubcategory === s, 'sub')).join('');

  document.querySelectorAll('[data-cat]').forEach(btn => btn.onclick = () => { activeCategory = btn.dataset.cat; activeSubcategory = ''; renderButtons(); renderCards(); });
  document.querySelectorAll('[data-sub]').forEach(btn => btn.onclick = () => { activeSubcategory = btn.dataset.sub; renderButtons(); renderCards(); });
}

function buttonHtml(value, label, active, kind='cat') {
  return `<button class="${active ? 'active' : ''}" data-${kind}="${escapeAttr(value)}">${escapeHtml(label)}</button>`;
}

function passesFilters(it) {
  if (activeCategory && it.category !== activeCategory) return false;
  if (activeSubcategory && (it.subcategory || 'Geral') !== activeSubcategory) return false;
  const from = $('dateFrom').value;
  const to = $('dateTo').value;
  const d = (it.date || '').slice(0,10);
  if (from && d && d < from) return false;
  if (to && d && d > to) return false;
  const source = $('sourceSelect').value;
  if (source && it.source !== source) return false;
  const q = $('textSearch').value.trim().toLowerCase();
  if (q) {
    const blob = [it.title, it.summary, it.why_it_matters, it.source, it.subcategory, ...(it.tags || [])].join(' ').toLowerCase();
    if (!blob.includes(q)) return false;
  }
  return true;
}

function renderCards() {
  const items = flattenItems().filter(passesFilters).sort((a,b)=>(b.date || '').localeCompare(a.date || ''));
  $('status').textContent = `${items.length} item(ns) exibido(s).`;
  $('cards').innerHTML = items.map(cardHtml).join('') || '<div class="panel">Nenhum item encontrado com os filtros atuais.</div>';
  document.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = () => deleteItem(btn.dataset.delete));
}

function cardHtml(it) {
  const url = it.url || it.id || '';
  const title = url ? `<a href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(it.title || 'Sem título')}</a>` : escapeHtml(it.title || 'Sem título');
  const signal = it.signal_type ? ` · ${escapeHtml(it.signal_type)}` : '';
  const tags = [labels[it.category] || it.category, it.subcategory, ...(it.tags || [])].filter(Boolean);
  return `<article class="card">
    <h3>${title}</h3>
    <div class="meta">${escapeHtml(it.date || 's/data')} · ${escapeHtml(it.source || 'fonte n/d')}${signal} · <span class="cred-${escapeAttr(it.credibility || 'medium')}">${escapeHtml(it.credibility || 'medium')}</span></div>
    <p class="summary">${escapeHtml(it.summary || '')}</p>
    <p class="why"><strong>Por que importa:</strong> ${escapeHtml(it.why_it_matters || '')}</p>
    <div class="chips">${tags.map(t => `<span class="chip">${escapeHtml(t)}</span>`).join('')}</div>
    <button class="delete" data-delete="${escapeAttr(url)}">Excluir do dashboard</button>
  </article>`;
}

async function deleteItem(url) {
  if (!url) return;
  if (!confirm('Excluir este item do dashboard? Ele não voltará em futuras atualizações locais.')) return;
  await fetch(API_BASE + '/api/delete', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({url})});
  await loadData();
}

async function updateSearches() {
  const btn = $('updateBtn');
  btn.disabled = true;
  btn.textContent = 'Atualizando...';
  $('status').textContent = 'Buscando papers, notícias e tendências novas. Isso pode levar alguns segundos.';
  try {
    const res = await fetch(API_BASE + '/api/update', {method:'POST'});
    data = await res.json();
    const added = data.last_update?.added ?? 0;
    $('status').textContent = `Atualização concluída: ${added} novo(s) item(ns) adicionado(s).`;
    renderAll();
  } catch (e) {
    $('status').textContent = 'Não consegui atualizar. Verifique se o servidor local está rodando.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Atualizar buscas';
  }
}

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function escapeAttr(s) { return escapeHtml(s); }

['dateFrom','dateTo','sourceSelect','textSearch'].forEach(id => $(id).addEventListener('input', renderCards));
$('clearFilters').onclick = () => { activeCategory=''; activeSubcategory=''; ['dateFrom','dateTo','sourceSelect','textSearch'].forEach(id => $(id).value=''); renderButtons(); renderCards(); };
$('updateBtn').onclick = updateSearches;
loadData();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
}
