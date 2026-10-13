"""Construcción sin dependencias: los textos se escapan y las rutas se validan."""
from pathlib import Path
import json,re,html,posixpath,sys,hashlib
from datetime import datetime,timezone
from zoneinfo import ZoneInfo
from urllib.parse import urlsplit,quote

ROOT=Path(__file__).resolve().parents[1]
def valid_url(value,media=False):
 if not isinstance(value,str) or any(ord(c)<32 for c in value) or '\\' in value or any(c in value for c in ['"',"'",'<','>','(',')']):return False
 p=urlsplit(value)
 if media:
  if p.scheme:return p.scheme=='https' and bool(p.netloc) and not p.username and not p.password
  return bool(re.fullmatch(r'(assets|videos)/[A-Za-z0-9_./%+ -]+',value)) and '..' not in p.path.split('/')
 if p.scheme:return p.scheme in ['https','http','tel','mailto'] and not p.username and not p.password
 return bool(value) and not value.startswith('//') and '..' not in p.path.split('/')

def render(schema,content,source):
 values=dict(content['values']);specs={f['id']:f for f in schema['fields']}
 if content.get('version')!=1 or set(values)!=set(specs):raise ValueError('La estructura de contenido no coincide con el editor.')
 zone=content.get('countdown',{}).get('timeZone','America/New_York')
 labels={'America/New_York':'Miami','America/Santiago':'Santiago','America/Lima':'Lima','Europe/Madrid':'Madrid','UTC':'UTC'}
 if zone not in labels:raise ValueError('Zona horaria no admitida.')
 countdown=next(f for f in schema['fields'] if f['type']=='datetime')
 chosen=datetime.strptime(values[countdown['id']],'%Y-%m-%dT%H:%M')
 months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
 date_label=f'{chosen.day} de {months[chosen.month-1]} de {chosen.year} · {chosen.hour%12 or 12}:{chosen.minute:02d} '+('p. m.' if chosen.hour>=12 else 'a. m.')
 for fid in countdown.get('related',[]):values[fid]=date_label
 for field in schema['fields']:
  if field['initial']=='(hora de Miami)':values[field['id']]=f'(hora de {labels[zone]})'
 for fid,value in values.items():
  f=specs[fid]
  if not isinstance(value,str) or len(value)>12000:raise ValueError('Texto no válido: '+fid)
  if f['type'] in ['link','image','video'] and not valid_url(value,f['type']!='link'):raise ValueError('Enlace no válido: '+fid)
  if f['type']=='datetime':
   dt=datetime.strptime(value,'%Y-%m-%dT%H:%M').replace(tzinfo=ZoneInfo(zone))
   if dt.astimezone(timezone.utc).astimezone(ZoneInfo(zone)).strftime('%Y-%m-%dT%H:%M')!=value:raise ValueError('Hora inexistente por el cambio de horario.')
 def replace(m):
  fid=m.group(1);f=specs[fid];value=values[fid]
  if value==f['initial'] and not (f['encoding']=='datetime' and zone!='America/New_York'):return f['original']
  encoding=f['encoding']
  if encoding=='datetime':
   dt=datetime.strptime(value,'%Y-%m-%dT%H:%M').replace(tzinfo=ZoneInfo(zone)).astimezone(timezone.utc)
   return 'Date.parse('+json.dumps(dt.isoformat())+')'
  if encoding=='css':
   path=value if urlsplit(value).scheme else posixpath.relpath(value,'assets/css')
   return quote(path,safe='/:%?=&+#-._~')
  if encoding=='attr':return html.escape(value,quote=True)
  return f.get('prefix','')+html.escape(value,quote=False)+f.get('suffix','')
 result=re.sub(r'\{\{cms:(f\d+)\}\}',replace,source)
 countdown=next(f for f in schema['fields'] if f['type']=='datetime')
 value=values[countdown['id']]
 if value!=countdown['initial'] or zone!='America/New_York':
  dt=datetime.strptime(value,'%Y-%m-%dT%H:%M')
  months=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
  human=f'{dt.day} de {months[dt.month-1]} de {dt.year}, {dt.hour%12 or 12}:{dt.minute:02d} '+('p. m.' if dt.hour>=12 else 'a. m.')+f' (hora de {labels[zone]})'
  result=result.replace('26 de octubre de 2026, 10:00 a. m. (hora de Miami)',human)
 return result

def build():
 schema=json.loads((ROOT/'public_html/admin/schema.json').read_text())
 content=json.loads((ROOT/'content/site.json').read_text())
 for src,dst in [('index.html','index.html'),('styles.css','assets/css/styles.css'),('main.js','assets/js/main.js')]:
  result=render(schema,content,(ROOT/'sources'/src).read_text())
  (ROOT/'public_html'/dst).write_text(result)
 directory=ROOT/'public_html/content';directory.mkdir(exist_ok=True)
 (directory/'site.json').write_text(json.dumps(content,ensure_ascii=False,indent=2)+'\n')
 # Versionar recursos evita que el navegador conserve código o estilos anteriores.
 def stamp(text,path):
  digest=hashlib.sha256((ROOT/'public_html'/path).read_bytes()).hexdigest()[:12]
  return re.sub(re.escape(path)+r'(?:\?v=[a-f0-9]+)?',path+'?v='+digest,text)
 page=ROOT/'public_html/index.html';text=page.read_text()
 for asset in ['assets/css/fonts.css','assets/css/styles.css','assets/css/mobile-fixes.css','assets/js/main.js']:text=stamp(text,asset)
 page.write_text(text)
 editor=ROOT/'public_html/admin/editor.mjs';text=editor.read_text()
 digest=hashlib.sha256((ROOT/'public_html/admin/core.mjs').read_bytes()).hexdigest()[:12]
 text=re.sub(r'\./core\.mjs(?:\?v=[a-f0-9]+)?','./core.mjs?v='+digest,text);editor.write_text(text)
 admin=ROOT/'public_html/admin/index.html';text=admin.read_text()
 for asset in ['editor.css','editor.mjs']:
  digest=hashlib.sha256((ROOT/'public_html/admin'/asset).read_bytes()).hexdigest()[:12]
  text=re.sub(re.escape(asset)+r'(?:\?v=[a-f0-9]+)?',asset+'?v='+digest,text)
 admin.write_text(text)
 print('Contenido construido:',len(schema['fields']),'campos')

if __name__=='__main__':build()
