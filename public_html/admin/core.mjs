export const REPOSITORY = 'enmanuel2109/revolucion-web';
export const BRANCH = 'main';
export const CONTENT_PATH = 'content/site.json';
export const API = `https://api.github.com/repos/${REPOSITORY}`;
export const TIME_ZONES = [
  { id:'America/New_York', label:'Miami / Orlando' },
  { id:'America/Santiago', label:'Santiago de Chile' },
  { id:'America/Lima', label:'Lima' },
  { id:'Europe/Madrid', label:'Barcelona / Madrid' },
  { id:'UTC', label:'UTC' }
];
export function timezoneLabel(zone) { return ({'America/New_York':'Miami','America/Santiago':'Santiago','America/Lima':'Lima','Europe/Madrid':'Madrid','UTC':'UTC'})[zone] || zone; }
export function humanDate(value) {
  const [day,time]=value.split('T');const [hours,minutes]=time.split(':').map(Number);
  const date=new Intl.DateTimeFormat('es',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
  return `${date} · ${hours%12||12}:${String(minutes).padStart(2,'0')} ${hours>=12?'p. m.':'a. m.'}`;
}
export function autoCountdownIDs(schema) {
  const clock=schema.fields.find(f=>f.type==='datetime');
  return new Set([...(clock?.related||[]),...schema.fields.filter(f=>f.initial==='(hora de Miami)').map(f=>f.id)]);
}
export function syncCountdown(schema,content) {
  const clock=schema.fields.find(f=>f.type==='datetime');if(!clock)return content;
  const zone=content.countdown?.timeZone || 'America/New_York';
  zonedTimestamp(content.values[clock.id],zone);
  content.countdown={timeZone:zone};
  for(const id of clock.related||[])content.values[id]=humanDate(content.values[clock.id]);
  for(const field of schema.fields.filter(f=>f.initial==='(hora de Miami)'))content.values[field.id]=`(hora de ${timezoneLabel(zone)})`;
  return content;
}
export function migrateContent(schema,input) {
  if(!input?.values)throw new Error('El archivo no contiene un borrador válido de esta web.');
  const content={version:input.version,values:structuredClone(input.values)},clock=schema.fields.find(f=>f.type==='datetime');
  if(input.countdown)content.countdown={timeZone:input.countdown.timeZone};
  if(!content.countdown && content.values[clock.id]===clock.initial){
    const shown=content.values[clock.related?.[0]];
    const months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const m=shown?.match(/^(\d{1,2}) de (\w+) de (\d{4})\s*[·,]\s*(\d{1,2}):(\d{2})\s*([ap])\.\s*m\./i);
    if(m && shown!==schema.fields.find(f=>f.id===clock.related[0]).initial){
      const month=months.indexOf(m[2].toLowerCase())+1;
      if(month)content.values[clock.id]=`${m[3]}-${String(month).padStart(2,'0')}-${m[1].padStart(2,'0')}T${String((Number(m[4])%12)+(m[6].toLowerCase()==='p'?12:0)).padStart(2,'0')}:${m[5]}`;
    }
    const label=schema.fields.filter(f=>f.initial==='(hora de Miami)').map(f=>content.values[f.id]).join(' ');
    content.countdown={timeZone:/Santiago/i.test(label)?'America/Santiago':/Lima/i.test(label)?'America/Lima':/Madrid|Barcelona/i.test(label)?'Europe/Madrid':'America/New_York'};
  }
  validateContent(schema,content);return syncCountdown(schema,content);
}

export function safeURL(value, media = false) {
  if (typeof value !== 'string' || !value || /[\x00-\x1f\\"'<>()[\]]/.test(value)) return false;
  const scheme = value.match(/^([a-z][a-z\d+.-]*):/i);
  if (scheme) {
    if (media && scheme[1].toLowerCase() !== 'https') return false;
    if (!media && !['http', 'https', 'tel', 'mailto'].includes(scheme[1].toLowerCase())) return false;
    try { const url = new URL(value); return !url.username && !url.password && (!media || !!url.hostname); } catch { return false; }
  }
  if (value.startsWith('//') || value.split('/').includes('..')) return false;
  return !media || /^(assets|videos)\/[A-Za-z\d_./%+ -]+$/.test(value);
}

export function utf8Base64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export function decodeBase64(text) {
  return new TextDecoder().decode(Uint8Array.from(atob(text.replace(/\s/g, '')), c => c.charCodeAt(0)));
}

export function validateContent(schema, content) {
  if (content?.version !== 1 || !content.values || Object.keys(content.values).length !== schema.fields.length) throw new Error('El borrador no corresponde a esta web.');
  for (const field of schema.fields) {
    const value = content.values[field.id];
    if (typeof value !== 'string' || value.length > 12000) throw new Error(`Revisa «${field.label}».`);
    if (['link', 'image', 'video'].includes(field.type) && !safeURL(value, field.type !== 'link')) throw new Error(`El enlace de «${field.label}» no es válido. Usa HTTPS o una ruta de la web.`);
    if (field.type === 'datetime') zonedTimestamp(value,content.countdown?.timeZone || 'America/New_York');
  }
  return true;
}

export function miamiTimestamp(value) { return zonedTimestamp(value,'America/New_York'); }
export function zonedTimestamp(value,zone='America/New_York') {
  if(!TIME_ZONES.some(z=>z.id===zone))throw new Error('Selecciona una zona horaria admitida.');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Selecciona una fecha y hora válidas para la cuenta atrás.');
  const [y,m,d,h,min] = value.split(/[-T:]/).map(Number);
  const naive = Date.UTC(y,m-1,d,h,min);
  if (new Date(naive).toISOString().slice(0,16) !== value) throw new Error('La fecha de la cuenta atrás no existe.');
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone:zone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' });
  const parts = stamp => Object.fromEntries(formatter.formatToParts(new Date(stamp)).filter(p => p.type !== 'literal').map(p => [p.type,Number(p.value)]));
  let stamp = naive;
  for (let i=0;i<3;i++) { const p=parts(stamp); const shown=Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute,p.second); stamp += naive-shown; }
  const final = parts(stamp);
  if (final.year !== y || final.month !== m || final.day !== d || final.hour !== h || final.minute !== min) throw new Error('Esa hora no existe en la zona elegida por el cambio de horario. Selecciona otra hora.');
  return stamp;
}

export function fileName(name, nonce) {
  const base = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/^\.+/, '').slice(-95);
  return `assets/uploads/${nonce}-${base || 'archivo'}`;
}

export class GitHubClient {
  #token;
  constructor(token, transport = globalThis.fetch.bind(globalThis)) { this.#token = token; this.transport = transport; }
  clear() { this.#token = ''; }
  async request(path, method = 'GET', body) {
    if (!this.#token) throw new Error('Conecta tu acceso a GitHub para publicar.');
    const response = await this.transport(path ? `${API}/${path}` : API, {
      method,
      headers: { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${this.#token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      cache: 'no-store'
    });
    if (!response.ok) {
      const detail=await response.json().catch(()=>({}));
      const remaining=response.headers?.get('x-ratelimit-remaining');
      const messages = {
        401: 'La clave no es válida o ha caducado. Vuelve a conectar tu acceso.',
        403: remaining==='0' ? 'GitHub ha agotado el límite de consultas. Espera a que se restablezca para volver a conectar.' : 'La clave no permite guardar en revolucion-web. En GitHub selecciona Resource owner: enmanuel2109, Only select repositories: revolucion-web y Contents: Read and write. Después vuelve a conectar tu acceso.',
        404: 'No se encontró el archivo o la clave no tiene acceso a revolucion-web.',
        409: 'Otra persona ha guardado cambios. Recarga el contenido antes de publicar.',
        422: 'GitHub rechazó la actualización. Puede haber cambios de otra persona; recarga antes de volver a guardar.'
      };
      const reason=typeof detail.message==='string' ? ` Motivo de GitHub: ${detail.message.slice(0,220)}.` : '';
      const error=new Error((messages[response.status] || `GitHub no pudo completar la operación (${response.status}). Tu borrador sigue en este panel.`)+reason);
      error.status=response.status;throw error;
    }
    return response.status === 204 ? null : response.json();
  }
  async connect() {
    const repo = await this.request('');
    if (repo.full_name.toLowerCase() !== REPOSITORY.toLowerCase()) throw new Error('El acceso no corresponde a esta web.');
    // Comprobar Contents:write sin crear commits ni cambiar la web.
    await this.request('git/blobs','POST',{content:'',encoding:'utf-8'});
    return repo;
  }
  async publish(content, expectedBlob, uploads = [], progress = () => {}) {
    const ref = await this.request(`git/ref/heads/${BRANCH}`);
    const head = ref.object.sha;
    const current = await this.request(`contents/${CONTENT_PATH}?ref=${head}`);
    if (current.sha !== expectedBlob) throw new Error('Otra persona ha cambiado el contenido. Descarga tu borrador y recarga el panel para revisar la última versión.');
    const commit = await this.request(`git/commits/${head}`);
    const entries = [];
    for (let i = 0; i < uploads.length; i++) {
      const file = uploads[i];
      if (!/^assets\/uploads\/[a-zA-Z0-9._-]+$/.test(file.path)) throw new Error('Ruta de archivo no válida.');
      progress(`Subiendo archivo ${i + 1} de ${uploads.length}…`);
      const blob = await this.request('git/blobs', 'POST', { content: file.base64, encoding: 'base64' });
      entries.push({ path: `public_html/${file.path}`, mode: '100644', type: 'blob', sha: blob.sha });
    }
    progress('Guardando el contenido…');
    const data = await this.request('git/blobs', 'POST', { content: JSON.stringify(content, null, 2) + '\n', encoding: 'utf-8' });
    entries.push({ path: CONTENT_PATH, mode: '100644', type: 'blob', sha: data.sha });
    const tree = await this.request('git/trees', 'POST', { base_tree: commit.tree.sha, tree: entries });
    const next = await this.request('git/commits', 'POST', { message: 'Actualizar contenido desde el panel de edición', tree: tree.sha, parents: [head] });
    const latest = await this.request(`git/ref/heads/${BRANCH}`);
    if (latest.object.sha !== head) throw new Error('El repositorio ha cambiado mientras guardabas. Tu borrador se conserva; recarga y revisa la última versión.');
    await this.request(`git/refs/heads/${BRANCH}`, 'PATCH', { sha: next.sha, force: false });
    return { commit: next.sha, contentSHA: data.sha };
  }
}
