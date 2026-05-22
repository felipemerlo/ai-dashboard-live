const labels = { research: 'Papers', news: 'Notícias', trends: 'Tendências' };
const API_BASE = location.protocol === 'file:' ? 'http://127.0.0.1:8765' : '';
let data = null;
let activeCategory = '';
let activeSubcategory = '';
const $ = id => document.getElementById(id);

async function loadData(){
  const res = await fetch(API_BASE + '/api/data?ts=' + Date.now());
  data = await res.json();
  renderAll();
}
function flattenItems(){
  const sections = data?.sections || {};
  return Object.entries(sections).flatMap(([category, items]) => (items || []).map(it => ({...it, category: it.category || category}))).filter(it => !it.deleted && !(data.deleted_urls || []).includes(it.url || it.id));
}
const uniq = arr => [...new Set(arr.filter(Boolean))].sort((a,b)=>a.localeCompare(b,'pt-BR'));
function renderAll(){
  $('period').textContent = `${data.generated_at || 'Sem data'} · ${countItems()} itens`;
  $('takeaways').innerHTML = (data.takeaways || []).slice(0,4).map(t=>`<li>${esc(t)}</li>`).join('');
  renderSources(); renderButtons(); renderCards();
}
function countItems(){ return flattenItems().length; }
function renderSources(){
  const cur = $('sourceSelect').value;
  const sources = uniq(flattenItems().map(i=>i.source));
  $('sourceSelect').innerHTML = '<option value="">Todas</option>' + sources.map(s=>`<option value="${attr(s)}">${esc(s)}</option>`).join('');
  $('sourceSelect').value = sources.includes(cur) ? cur : '';
}
function renderButtons(){
  const items = flattenItems();
  const cats = uniq(items.map(i=>i.category));
  $('categoryButtons').innerHTML = pill('', 'Tudo', activeCategory==='') + cats.map(c=>pill(c, labels[c] || c, activeCategory===c)).join('');
  const subItems = activeCategory ? items.filter(i=>i.category===activeCategory) : items;
  const subs = uniq(subItems.map(i=>i.subcategory || 'Geral'));
  $('subcategoryButtons').innerHTML = pill('', 'Tudo', activeSubcategory==='', 'sub') + subs.map(s=>pill(s, s, activeSubcategory===s, 'sub')).join('');
  document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{activeCategory=b.dataset.cat;activeSubcategory='';renderButtons();renderCards();window.scrollTo({top:0,behavior:'smooth'});});
  document.querySelectorAll('[data-sub]').forEach(b=>b.onclick=()=>{activeSubcategory=b.dataset.sub;renderButtons();renderCards();window.scrollTo({top:0,behavior:'smooth'});});
}
function pill(value,label,active,kind='cat'){return `<button class="${active?'active':''}" data-${kind}="${attr(value)}">${esc(label)}</button>`;}
function passes(it){
  if(activeCategory && it.category!==activeCategory) return false;
  if(activeSubcategory && (it.subcategory||'Geral')!==activeSubcategory) return false;
  const d=(it.date||'').slice(0,10), from=$('dateFrom').value, to=$('dateTo').value;
  if(from && d && d<from) return false; if(to && d && d>to) return false;
  const source=$('sourceSelect').value; if(source && it.source!==source) return false;
  const q=$('textSearch').value.trim().toLowerCase();
  if(q){ const blob=[it.title,it.summary,it.why_it_matters,it.source,it.subcategory,...(it.tags||[])].join(' ').toLowerCase(); if(!blob.includes(q)) return false; }
  return true;
}
function renderCards(){
  const items=flattenItems().filter(passes).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  $('status').textContent = `${items.length} exibido(s)`;
  $('cards').innerHTML = items.map(card).join('') || '<article class="card">Nenhum item encontrado.</article>';
  document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteItem(b.dataset.delete));
}
function card(it){
  const url=it.url||it.id||'';
  const title=url?`<a href="${attr(url)}" target="_blank" rel="noopener noreferrer">${esc(it.title||'Sem título')}</a>`:esc(it.title||'Sem título');
  const tags=[labels[it.category]||it.category,it.subcategory,...(it.tags||[])].filter(Boolean);
  return `<article class="card"><h3>${title}</h3><div class="meta">${esc(it.date||'s/data')} · ${esc(it.source||'fonte n/d')} · <span class="cred-${attr(it.credibility||'medium')}">${esc(it.credibility||'medium')}</span></div><p class="summary">${esc(it.summary||'')}</p><p class="why"><strong>Importa:</strong> ${esc(it.why_it_matters||'')}</p><div class="chips">${tags.map(t=>`<span class="chip">${esc(t)}</span>`).join('')}</div><button class="delete" data-delete="${attr(url)}">Excluir</button></article>`;
}
async function deleteItem(url){ if(!url || !confirm('Excluir este item?')) return; await fetch(API_BASE+'/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})}); await loadData(); }
async function updateSearches(){
  const buttons=[$('updateBtn'),$('refreshTop')]; buttons.forEach(b=>b.disabled=true); $('status').textContent='Atualizando buscas...';
  try{ const res=await fetch(API_BASE+'/api/update',{method:'POST'}); data=await res.json(); renderAll(); $('status').textContent=`Atualização concluída: ${data.last_update?.added ?? 0} novo(s).`; }
  catch(e){ $('status').textContent='Falha ao atualizar. Verifique a conexão.'; }
  finally{ buttons.forEach(b=>b.disabled=false); }
}
function clearFilters(){ activeCategory=''; activeSubcategory=''; ['dateFrom','dateTo','sourceSelect','textSearch'].forEach(id=>$(id).value=''); renderButtons(); renderCards(); }
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));}
function attr(s){return esc(s);}
['dateFrom','dateTo','sourceSelect','textSearch'].forEach(id=>$(id).addEventListener('input',renderCards));
$('clearFilters').onclick=clearFilters; $('updateBtn').onclick=updateSearches; $('refreshTop').onclick=updateSearches;
$('summaryToggle').onclick=()=>document.querySelector('.summary-card').classList.toggle('collapsed');
loadData();
