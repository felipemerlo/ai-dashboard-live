// Enhanced client-side updater for file:// usage
const labels = { research: 'Papers Científicos', news: 'Notícias', trends: 'Tendências' };
const API_BASE = location.protocol === 'file:' ? '' : 'http://127.0.0.1:8765';
let data = null;
let activeCategory = '';
let activeSubcategory = '';

const $ = (id) => document.getElementById(id);

async function loadData() {
  if (location.protocol === 'file:') {
    // load local snapshot if present
    try {
      const res = await fetch('./data.json?ts=' + Date.now());
      data = await res.json();
    } catch (e) {
      data = { title: 'Dashboard de Inteligência Artificial', sections: {}, takeaways: [], period: '', generated_at: null, deleted_urls: [] };
    }
    // attempt to refresh from public sources so opening the file regenerates content
    await tryClientSideCollect();
    renderAll();
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
    if (location.protocol === 'file:') {
      await tryClientSideCollect(true);
      $('status').textContent = 'Atualização local concluída (coleta via browser).';
      renderAll();
    } else {
      const res = await fetch(API_BASE + '/api/update', {method:'POST'});
      data = await res.json();
      const added = data.last_update?.added ?? 0;
      $('status').textContent = `Atualização concluída: ${added} novo(s) item(ns) adicionado(s).`;
      renderAll();
    }
  } catch (e) {
    $('status').textContent = 'Não consegui atualizar. Verifique se o servidor local está rodando.';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Atualizar buscas';
  }
}

function escapeHtml(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c])); }
function escapeAttr(s) { return escapeHtml(s); }

// client-side collectors (best-effort, tolerant of CORS failures)
async function tryClientSideCollect(force=false) {
  const now = new Date();
  const existingGen = data?.generated_at ? new Date(data.generated_at) : null;
  if (!force && existingGen && (now - existingGen) < 1000 * 60 * 30) return; // fresh within 30m

  const sections = data.sections || {};
  const added = [];

  // helper: push unique by url
  function pushUnique(sec, item) {
    sec = sections[sec] = sections[sec] || [];
    if (!sec.some(it => (it.url||it.id) === (item.url||item.id))) sec.push(item);
  }

  // 1) try to fetch published data.json from GH Pages
  try {
    const gh = await fetch('https://felipemerlo.github.io/ai-dashboard-live/data.json');
    if (gh.ok) {
      const j = await gh.json();
      // merge simple: prefer GH data sections
      Object.entries(j.sections || {}).forEach(([k,arr]) => {
        (arr||[]).forEach(it => pushUnique(k, it));
      });
    }
  } catch(e){/*ignore*/}

  // 2) arXiv (Atom) - CORS allowed generally
  try {
    const q = 'cat:cs.AI OR cat:cs.CL OR cat:cs.LG OR cat:cs.CV';
    const url = 'http://export.arxiv.org/api/query?search_query=' + encodeURIComponent(q) + '&sortBy=submittedDate&sortOrder=descending&start=0&max_results=6';
    const res = await fetch(url);
    if (res.ok) {
      const txt = await res.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(txt, 'application/xml');
      const entries = doc.getElementsByTagName('entry');
      for (let e of entries) {
        const title = (e.getElementsByTagName('title')[0]?.textContent || '').trim();
        const id = e.getElementsByTagName('id')[0]?.textContent || '';
        const published = (e.getElementsByTagName('published')[0]?.textContent || '').slice(0,10);
        const summary = (e.getElementsByTagName('summary')[0]?.textContent || '').trim();
        const low = (title + ' ' + summary).toLowerCase();
        const sub = low.includes('agent') ? 'Agentes e arquitetura' : (low.match(/video|vision|multimodal|vlm|image/) ? 'Multimodal e VLM' : 'Pesquisa aplicada');
        pushUnique('research', {id, title, date: published, source: 'arXiv', url: id, summary, why_it_matters: 'Paper recente (coleta client-side).', tags:['paper','AI'], subcategory: sub, credibility: 'high'});
      }
    }
  } catch(e){/*ignore*/}

  // 3) Hacker News via Algolia
  try {
    const hn = await fetch('https://hn.algolia.com/api/v1/search_by_date?query=AI%20LLM%20agent&tags=story&hitsPerPage=8');
    if (hn.ok) {
      const j = await hn.json();
      (j.hits||[]).slice(0,6).forEach(h => {
        const title = h.title || h.story_title || 'Discussão HN';
        const link = h.url || ('https://news.ycombinator.com/item?id=' + h.objectID);
        const date = (h.created_at || '').slice(0,10);
        pushUnique('trends', {title, date, source: 'Hacker News', url: link, summary: `Discussão HN (pontos: ${h.points||0})`, why_it_matters: 'Discussão recente via HN', tags:['HN','community'], subcategory: 'Discussões de builders', credibility: 'low'});
      });
    }
  } catch(e){/*ignore*/}

  // 4) GitHub search (public, unauthenticated limits)
  try {
    const q = encodeURIComponent('AI LLM pushed:>2026-05-13');
    const gh = await fetch('https://api.github.com/search/repositories?q=' + q + '&sort=stars&order=desc&per_page=5');
    if (gh.ok) {
      const j = await gh.json();
      (j.items||[]).forEach(r => {
        const name = r.full_name || r.name || 'Repo';
        const pushed = (r.pushed_at||r.created_at||'').slice(0,10);
        const desc = r.description || '';
        const link = r.html_url || '';
        pushUnique('trends', {title: `${name} — ${r.stargazers_count || 0} estrelas`, date: pushed, source: 'GitHub', url: link, summary: desc || 'Repositório ativo', why_it_matters: 'Sinal de adoção técnica', tags:['GitHub','open-source'], subcategory: 'Modelos e comunidade', credibility: 'medium'});
      });
    }
  } catch(e){/*ignore*/}

  data.sections = sections;
  data.generated_at = new Date().toISOString();
  data.last_update = {added: 0, at: data.generated_at};
}

// wire up interactions
['dateFrom','dateTo','sourceSelect','textSearch'].forEach(id => $(id).addEventListener('input', renderCards));
$('clearFilters').onclick = () => { activeCategory=''; activeSubcategory=''; ['dateFrom','dateTo','sourceSelect','textSearch'].forEach(id => $(id).value=''); renderButtons(); renderCards(); };
$('updateBtn').onclick = updateSearches;
loadData();
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
}
