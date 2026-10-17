import { API, REPOSITORY, CONTENT_PATH, GitHubClient, validateContent, safeURL, decodeBase64, fileName, zonedTimestamp, TIME_ZONES, timezoneLabel, humanDate, autoCountdownIDs, syncCountdown, migrateContent } from './core.mjs?v=14bc50818ebd';

const $ = id => document.getElementById(id);
const frame = $('preview');
const DRAFT_KEY = 'revolucion-editor-borrador-v1';
let schema, content, savedContent, baseSHA, client = null, busy = false, dirty = false, lastCommit = null;
const uploads = new Map();
const objectURLs = new Map();
let fieldsByID = new Map(), draftCandidate = null;
const attachedDocuments = new WeakSet();

function message(text, error = false) { $('status').textContent = text; $('status').classList.toggle('error', error); }
function buttons() {
  $('publish').disabled = busy || !dirty;
  $('publish').textContent = busy ? 'Guardando…' : 'Publicar cambios';
  $('download').disabled = !content;
  $('reload').disabled = busy;
  $('connect').disabled = busy;
  $('open-countdown').disabled = busy || !content;
}
function setDirty() {
  dirty = JSON.stringify(content) !== JSON.stringify(savedContent) || uploads.size > 0;
  buttons();
  try {
    if (dirty && uploads.size === 0) sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ baseSHA, content }));
    else sessionStorage.removeItem(DRAFT_KEY);
  } catch { /* El modo privado puede deshabilitar el almacenamiento. */ }
  message(dirty ? 'Tienes cambios sin publicar. Revisa la vista previa y pulsa Publicar cambios.' : 'Sin cambios pendientes.');
}

async function loadContent() {
  const response = await fetch(`${API}/contents/${CONTENT_PATH}?ref=main`, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
  if (!response.ok) throw new Error('No pude cargar la última versión de GitHub. Reintenta en unos minutos; puede ser un problema de conexión o el límite de consultas de GitHub.');
  const file = await response.json();
  const data = migrateContent(schema,JSON.parse(decodeBase64(file.content)));
  validateContent(schema, data);
  content = data; savedContent = structuredClone(data); baseSHA = file.sha;
}

function populateGroups() {
  const groups = [...new Set(schema.fields.map(f => f.group))];
  const select = $('group'); select.replaceChildren();
  for (const group of groups) { const o = document.createElement('option'); o.value = group; o.textContent = group; select.append(o); }
  const all = document.createElement('option'); all.value = '__all'; all.textContent = 'Todas las secciones'; select.append(all);
  select.value = groups.includes('Portada') ? 'Portada' : groups[0];
}

function mediaURL(value) { return objectURLs.get(value) || new URL(value, new URL('../', location.href)).href; }
function makeLabel(text, id) { const label = document.createElement('label'); label.htmlFor = id; label.textContent = text; return label; }

function calendarCard(field) {
  const card=document.createElement('div');card.className='field calendar-card';card.id=`card-${field.id}`;
  const title=document.createElement('h2');title.textContent='Inicio de la cuenta atrás';card.append(title);
  const grid=document.createElement('div');grid.className='calendar-grid';
  const [day,hour]=content.values[field.id].split('T');
  const date=document.createElement('input');date.type='date';date.id='countdown-date';date.value=day;
  const time=document.createElement('input');time.type='time';time.id='countdown-time';time.step='60';time.value=hour;
  const zone=document.createElement('select');zone.id='countdown-zone';
  for(const item of TIME_ZONES){const option=document.createElement('option');option.value=item.id;option.textContent=item.label;zone.append(option);}
  zone.value=content.countdown?.timeZone||'America/New_York';
  for(const [label,input] of [['Fecha de inicio',date],['Hora de inicio',time],['Zona horaria',zone]]){
    const row=document.createElement('div');row.append(makeLabel(label,input.id),input);grid.append(row);
  }
  const summary=document.createElement('p');summary.className='calendar-summary';summary.id='calendar-summary';
  const hint=document.createElement('small');hint.textContent='Estos controles actualizan los dos contadores y la fecha que aparece debajo. Los cambios se publican al guardar.';
  const update=()=>{
    if(busy)return;
    content.values[field.id]=`${date.value}T${time.value}`;content.countdown={timeZone:zone.value};
    try {syncCountdown(schema,content);summary.textContent=`${humanDate(content.values[field.id])} · ${timezoneLabel(zone.value)}`;summary.classList.remove('error');}
    catch(error){summary.textContent=error.message;summary.classList.add('error');}
    applyPreview();setDirty();
  };
  try {summary.textContent=`${humanDate(content.values[field.id])} · ${timezoneLabel(zone.value)}`;} catch(error){summary.textContent=error.message;summary.classList.add("error");}
  date.addEventListener('input',update);time.addEventListener('input',update);zone.addEventListener('change',update);
  card.append(grid,summary,hint);return card;
}

function renderFields(focusID) {
  const query = $('search').value.trim().toLocaleLowerCase('es');
  const group = $('group').value;
  const shown = schema.fields.filter(f => (group === '__all' || f.group === group) && (!query || `${f.label} ${f.group} ${content.values[f.id]}`.toLocaleLowerCase('es').includes(query)));
  $('fields').replaceChildren();
  const automatic=autoCountdownIDs(schema),clock=schema.fields.find(f=>f.type==='datetime');
  const showClock=['Portada','Calendario','Cuenta atrás','__all'].includes(group) && (!query || /fecha|hora|cuenta|inicio|calendario/i.test(query) || shown.some(f=>automatic.has(f.id)));
  if(showClock)$('fields').append(calendarCard(clock));
  $('field-count').textContent = `${shown.length} ${shown.length === 1 ? 'campo' : 'campos'} en esta selección`;
  for (const field of shown) {
    if(field.type==='datetime') {if(!showClock)$('fields').append(calendarCard(field));continue;}
    if(automatic.has(field.id))continue;
    const card = document.createElement('div'); card.className = 'field'; card.id = `card-${field.id}`;
    const input = document.createElement(field.type === 'multiline' ? 'textarea' : 'input');
    input.id = `input-${field.id}`; input.value = content.values[field.id]; input.dataset.field = field.id;
    if (input.tagName === 'INPUT') input.type = field.type === 'datetime' ? 'datetime-local' : 'text';
    input.maxLength = 12000; input.autocomplete = 'off';
    input.addEventListener('input', () => editField(field, input.value));
    card.append(makeLabel(field.label, input.id), input);
    if (field.type === 'datetime') {
      const hint = document.createElement('small'); hint.textContent = 'Hora local de Miami. Se actualiza la cuenta atrás y la fecha que aparece junto a ella.'; card.append(hint);
    }
    if (['image', 'video'].includes(field.type)) {
      if (field.type === 'image' && safeURL(input.value, true)) {
        const image = document.createElement('img'); image.className = 'thumb'; image.alt = 'Imagen actual'; image.src = mediaURL(input.value); image.dataset.thumbnail = field.id; card.append(image);
      }
      const file = document.createElement('input'); file.type = 'file'; file.id = `file-${field.id}`;
      file.accept = field.type === 'image' ? 'image/jpeg,image/png,image/webp,image/gif' : 'video/mp4,video/webm';
      file.addEventListener('change', () => selectFile(field, file));
      const label = makeLabel(field.type === 'image' ? 'Sustituir con una imagen' : 'Sustituir con un vídeo', file.id); label.className = 'file-label';
      const hint = document.createElement('small'); hint.textContent = field.type === 'image' ? 'JPG, PNG, WebP o GIF · máximo 10 MB.' : 'MP4 o WebM · máximo 20 MB. Los archivos pesados tardan más en subir.';
      card.append(label, file, hint);
    }
    if (field.type === 'link') { const hint = document.createElement('small'); hint.textContent = 'Acepta enlaces web, teléfono, correo o una sección como #inversion.'; card.append(hint); }
    if (field.target.node || field.target.selector) {
      const jump = document.createElement('button'); jump.className = 'jump'; jump.textContent = 'Ver en la vista previa'; jump.addEventListener('click', () => showInPreview(field)); card.append(jump);
    }
    $('fields').append(card);
  }
  if (!shown.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = 'No encontré campos con esa búsqueda.'; $('fields').append(empty); }
  if (focusID) { const input = $(`input-${focusID}`) || $('countdown-date'); if (input) { input.focus({ preventScroll: true }); input.closest('.field').scrollIntoView({ block: 'nearest' }); } }
}

function editField(field, value) {
  if (busy) return;
  content.values[field.id] = value;
  if (field.type === 'datetime' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))) {
    syncCountdown(schema,content);
  }
  const thumb = document.querySelector(`[data-thumbnail="${field.id}"]`);
  if (thumb && safeURL(value, true)) thumb.src = mediaURL(value);
  applyPreview(); setDirty();
}

async function selectFile(field, input) {
  const file = input.files?.[0]; if (!file || busy) return;
  const allowed = field.type === 'image' ? ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] : ['video/mp4', 'video/webm'];
  const extensions = field.type === 'image' ? /\.(jpe?g|png|webp|gif)$/i : /\.(mp4|webm)$/i;
  const limit = (field.type === 'image' ? 10 : 20) * 1024 * 1024;
  if (!allowed.includes(file.type) || !extensions.test(file.name) || file.size > limit || file.size === 0) {
    message('El archivo no tiene un formato admitido, está vacío o supera el tamaño máximo.', true); input.value = ''; return;
  }
  const remaining = [...uploads.values()].filter(f => f.field !== field.id).reduce((n, f) => n + f.bytes, 0);
  if (remaining + file.size > 30 * 1024 * 1024) { message('Publica los archivos pendientes antes de añadir más. El máximo por publicación es 30 MB.', true); input.value = ''; return; }
  message('Preparando el archivo…');
  try {
    const bytes = new Uint8Array(await file.arrayBuffer()); let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const path = fileName(file.name, crypto.randomUUID());
    for (const [p, item] of uploads) if (item.field === field.id) { uploads.delete(p); URL.revokeObjectURL(objectURLs.get(p)); objectURLs.delete(p); }
    uploads.set(path, { path, field: field.id, bytes: file.size, base64: btoa(binary) });
    objectURLs.set(path, URL.createObjectURL(file));
    editField(field, path); renderFields();
  } catch { message('No pude leer el archivo. Prueba otra vez con un archivo más pequeño.', true); }
}

function elementFor(field, doc) { return field.target.node ? doc.querySelector(`[data-edit-node="${field.target.node}"]`) : field.target.selector ? doc.querySelector(field.target.selector) : null; }

function applyPreview() {
  const doc = frame.contentDocument; if (!schema || !content || !doc?.body) return;
  const countdown = schema.fields.find(field => field.target.countdown);
  if (countdown) {
    const value = content.values[countdown.id];
    try { frame.contentWindow.dispatchEvent(new CustomEvent('editor-countdown', { detail: { timestamp: zonedTimestamp(value,content.countdown?.timeZone||'America/New_York'), label: humanDate(value),zoneLabel:timezoneLabel(content.countdown?.timeZone||'America/New_York') } })); } catch {}
  }
  for (const field of schema.fields) {
    const value = content.values[field.id]; const target = field.target;
    if (target.countdown) continue;
    const el = elementFor(field, doc); if (!el) continue;
    if (target.cssImage) {
      if (!safeURL(value, true)) continue;
      const url = mediaURL(value);
      // Conservar el degradado y el resto de la composición original.
      const existing = el.style.backgroundImage || frame.contentWindow.getComputedStyle(el).backgroundImage;
      const background = existing.replace(/url\([^)]*\)/g, `url("${url}")`);
      doc.querySelectorAll(target.selector).forEach(node => { node.style.backgroundImage = background; });
    } else if (target.attr) {
      if (['link', 'image', 'video'].includes(field.type) && !safeURL(value, field.type !== 'link')) continue;
      const previewValue = ['src', 'poster'].includes(target.attr) ? mediaURL(value) : value;
      if (el.getAttribute(target.attr) !== previewValue) {
        el.setAttribute(target.attr, previewValue);
        if (el.tagName === 'VIDEO' && target.attr === 'src') el.load();
      }
    } else {
      const text = [...el.childNodes].filter(node => node.nodeType === 3)[target.textIndex];
      if (text) { const visible = (field.prefix || '') + value + (field.suffix || ''); if (text.textContent !== visible) text.textContent = visible; }
    }
  }
}

function showInPreview(field) {
  const el = elementFor(field, frame.contentDocument); if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  const old = el.style.outline; el.style.outline = '3px solid #ff6b7c';
  setTimeout(() => { el.style.outline = old; }, 1800);
}

function selectFromPreview(event) {
  if (event.target.closest('a')) event.preventDefault();
  let el = event.target.closest('[data-edit-node]');
  while (el) {
    const node = el.dataset.editNode;
    const matches = schema.fields.filter(f => f.target.node === node);
    const field = matches.find(f => f.type === 'image' || f.type === 'video') || matches.find(f => f.target.textIndex !== undefined) || matches[0];
    if (field) { const isClock=autoCountdownIDs(schema).has(field.id);$('group').value = isClock?'Cuenta atrás':field.group; $('search').value = ''; renderFields(isClock?schema.fields.find(f=>f.type==='datetime').id:field.id); return; }
    el = el.parentElement?.closest('[data-edit-node]');
  }
}

function onFrameLoad() {
  applyPreview();
  const doc = frame.contentDocument;
  if (doc && !attachedDocuments.has(doc)) { doc.addEventListener('click', selectFromPreview); attachedDocuments.add(doc); }
}

function downloadDraft() {
  const data = { repository: REPOSITORY, savedAt: new Date().toISOString(), baseSHA, content, uploads: [...uploads.values()].map(({ path, base64, bytes, field }) => ({ path, base64, bytes, field })) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'borrador-revolucion.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importDraft(input) {
  const file=input.files?.[0];if(!file||busy)return;
  try {
    if(file.size>45*1024*1024)throw new Error('El borrador supera el tamaño máximo de 45 MB.');
    const draft=JSON.parse(await file.text());
    if(draft.repository!==REPOSITORY)throw new Error('Este borrador pertenece a otra web.');
    const restored=migrateContent(schema,draft.content);const pending=[];let total=0;
    for(const item of draft.uploads||[]){
      const field=fieldsByID.get(item.field);
      if(!field||!['image','video'].includes(field.type)||!/^assets\/uploads\/[a-zA-Z0-9._-]+$/.test(item.path)||typeof item.base64!=='string'||!/^[-A-Za-z0-9+/=]+$/.test(item.base64))throw new Error('El borrador contiene un archivo no válido.');
      const binary=atob(item.base64);total+=binary.length;
      if(total>30*1024*1024||binary.length>(field.type==='image'?10:20)*1024*1024)throw new Error('Los archivos del borrador superan el tamaño admitido.');
      const ext=item.path.split('.').pop().toLowerCase();const type=({jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp',gif:'image/gif',mp4:'video/mp4',webm:'video/webm'})[ext];
      if(!type||!type.startsWith(field.type==='image'?'image/':'video/'))throw new Error('Formato de archivo no admitido en el borrador.');
      const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));pending.push({...item,bytes:bytes.length,blob:new Blob([bytes],{type})});
    }
    if(dirty&&!confirm('Importar este borrador sustituirá los cambios de este panel. ¿Quieres continuar?'))return;
    for(const url of objectURLs.values())URL.revokeObjectURL(url);objectURLs.clear();uploads.clear();
    content=restored;
    for(const {blob,...item} of pending){uploads.set(item.path,item);objectURLs.set(item.path,URL.createObjectURL(blob));}
    renderFields();applyPreview();setDirty();message('Borrador importado. Tus cambios están en la vista previa; todavía no se han publicado.');
  } catch(error){message('No pude importar el borrador. '+error.message,true);}
  finally {input.value='';}
}

async function connectAccess() {
  const token = $('token').value.trim(); $('token').value = '';
  if (!token) { $('access-error').textContent = 'Introduce tu clave de acceso.'; return; }
  $('connect').disabled = true; $('access-error').textContent = '';
  const candidate = new GitHubClient(token);
  try {
    await candidate.connect(); client?.clear(); client = candidate;
    $('connection').textContent = 'Acceso de edición conectado'; $('access').textContent = 'Gestionar acceso'; $('disconnect').hidden = false;
    $('access-dialog').close(); message('Acceso conectado. Puedes publicar los cambios pendientes.');
  } catch (error) { candidate.clear(); $('access-error').textContent = error.message; }
  finally { $('connect').disabled = false; }
}

async function awaitDeployment(snapshot, commit) {
  const deadline = Date.now() + 150000;
  while (Date.now() < deadline && lastCommit === commit) {
    try {
      const url = new URL('../content/site.json', location.href); url.searchParams.set('v', `${commit}-${Date.now()}`);
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok && JSON.stringify(await response.json()) === JSON.stringify(snapshot)) {
        message('Cambios publicados. La web pública ya está actualizada.');
        for (const url of objectURLs.values()) URL.revokeObjectURL(url); objectURLs.clear();
        frame.src = `../index.html?editor-preview=1&v=${commit}`;
        return;
      }
      const runResponse=await fetch(`https://api.github.com/repos/${REPOSITORY}/actions/runs?head_sha=${encodeURIComponent(commit)}&per_page=5`,{cache:'no-store',headers:{Accept:'application/vnd.github+json'}});
      if(runResponse.ok){
        const runs=await runResponse.json();
        const run=runs.workflow_runs?.find(r=>r.head_sha===commit&&r.name==='Publicar web en GitHub Pages');
        if(run?.status==='completed'&&run.conclusion!=='success'){
          message('Tus cambios están guardados en GitHub, pero falló la publicación de la web. No necesitas volver a escribirlos. Revisa el detalle de publicación en GitHub.',true);
          const link=document.createElement('a');link.href=`https://github.com/${REPOSITORY}/actions/runs/${run.id}`;link.target='_blank';link.rel='noopener noreferrer';link.textContent=' Ver error de publicación ↗';$('status').append(link);return;
        }
      }
    } catch { /* Esperar a la siguiente comprobación de la publicación. */ }
    await new Promise(resolve => setTimeout(resolve, 7000));
  }
  if (lastCommit === commit) message('Contenido guardado en GitHub. La publicación aún no está confirmada; consulta Actions en el repositorio y recarga la web en unos minutos.');
}

async function publish() {
  if (busy || !dirty) return;
  if (!client) { $('access-error').textContent = ''; $('access-dialog').showModal(); return; }
  try { validateContent(schema, content); }
  catch (error) { message(error.message, true); return; }
  busy = true; buttons(); $('fields').inert = true;
  const snapshot = structuredClone(content);
  try {
    // Solo subir los archivos que continúan referenciados en el contenido.
    const used = new Set(Object.values(snapshot.values));
    const result = await client.publish(snapshot, baseSHA, [...uploads.values()].filter(f => used.has(f.path)), message);
    baseSHA = result.contentSHA; savedContent = structuredClone(snapshot); uploads.clear(); dirty = false; lastCommit = result.commit;
    try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
    message('Guardado en GitHub. Publicando la web; normalmente tarda uno o dos minutos…');
    void awaitDeployment(snapshot, result.commit);
  } catch (error) { if(error.status===403){client?.clear();client=null;$('connection').textContent='Permiso de escritura pendiente';$('access').textContent='Conectar acceso';$('disconnect').hidden=true;}message(error.message, true); }
  finally { busy = false; $('fields').inert = false; buttons(); }
}

async function reloadContent() {
  if (busy) return;
  if (dirty && !confirm('Tienes cambios sin publicar. ¿Quieres descartarlos y cargar la última versión de GitHub? Puedes cancelar y descargar tu borrador primero.')) return;
  try {
    await loadContent(); uploads.clear(); for (const url of objectURLs.values()) URL.revokeObjectURL(url); objectURLs.clear();
    try { sessionStorage.removeItem(DRAFT_KEY); } catch {}
    dirty = false; renderFields(); applyPreview(); buttons(); message('Última versión de GitHub cargada.');
  } catch (error) { message(error.message, true); }
}

$('group').addEventListener('change', () => renderFields());
$('search').addEventListener('input', () => { if ($('search').value) $('group').value = '__all'; renderFields(); });
$('publish').addEventListener('click', publish);
$('download').addEventListener('click', downloadDraft);
$('open-countdown').addEventListener('click',()=>{if(!content||busy)return;$('group').value='Cuenta atrás';$('search').value='';renderFields();$('countdown-date').scrollIntoView({block:'center',behavior:'smooth'});$('countdown-date').focus({preventScroll:true});});
$('import-draft').addEventListener('change',()=>importDraft($('import-draft')));
$('reload').addEventListener('click', reloadContent);
$('access').addEventListener('click', () => { $('access-error').textContent = ''; $('access-dialog').showModal(); });
$('close-access').addEventListener('click', () => { $('token').value = ''; $('access-dialog').close(); });
$('access-dialog').addEventListener('close', () => { $('token').value = ''; });
$('connect').addEventListener('click', connectAccess);
$('token').addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); void connectAccess(); } });
$('disconnect').addEventListener('click', () => { client?.clear(); client = null; $('connection').textContent = 'Sin conexión para publicar'; $('access').textContent = 'Conectar acceso'; $('disconnect').hidden = true; $('access-dialog').close(); message('Sesión cerrada. Tu borrador sigue en el panel.'); });
$('restore-draft').addEventListener('click', () => { const outdated = draftCandidate.baseSHA !== baseSHA; content = migrateContent(schema,draftCandidate.content); if (outdated) baseSHA = draftCandidate.baseSHA; $('draft-dialog').close(); renderFields(); applyPreview(); setDirty(); if (outdated) message('Borrador recuperado, pero GitHub tiene cambios más recientes. La publicación se bloqueará para evitar sobrescribirlos. Descarga el borrador y recarga el contenido para revisarlos.', true); });
$('discard-draft').addEventListener('click', () => { try { sessionStorage.removeItem(DRAFT_KEY); } catch {} $('draft-dialog').close(); message('Última versión de GitHub cargada.'); });
for (const button of document.querySelectorAll('[data-width]')) button.addEventListener('click', () => {
  for (const b of document.querySelectorAll('[data-width]')) b.setAttribute('aria-pressed', String(b === button));
  $('frame-wrap').className = ({ 1280: 'desktop', 768: 'tablet', 390: 'mobile', 320: 'small-mobile' })[button.dataset.width];
});
frame.addEventListener('load', onFrameLoad);
window.addEventListener('beforeunload', event => { if (dirty || busy) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('pagehide', () => { client?.clear(); client = null; });
window.addEventListener('pageshow', () => { if (!client) { $('connection').textContent = 'Sin conexión para publicar'; $('access').textContent = 'Conectar acceso'; $('disconnect').hidden = true; } });

async function start() {
  try {
    const response = await fetch('schema.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('No se encontró la configuración del editor.');
    schema = await response.json(); fieldsByID = new Map(schema.fields.map(f => [f.id, f]));
    await loadContent(); populateGroups(); renderFields(); onFrameLoad(); buttons();
    frame.src = `../index.html?editor-preview=1&v=${Date.now()}`;
    message('Selecciona un texto o una sección para empezar.');
    try {
      const draft = JSON.parse(sessionStorage.getItem(DRAFT_KEY));
      if (draft?.content && JSON.stringify(draft.content) !== JSON.stringify(content)) {
        validateContent(schema, draft.content); draftCandidate = draft; $('draft-dialog').showModal();
      }
    } catch { /* Ignorar borradores de otra versión o almacenamiento no disponible. */ }
    if (window.matchMedia('(max-width:720px)').matches) document.querySelector('[data-width="390"]').click();
  } catch (error) { message(error.message, true); }
}
void start();
