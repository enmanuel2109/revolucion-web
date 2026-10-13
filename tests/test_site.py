import unittest,json,re,hashlib,sys,copy
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from build import ROOT,render,valid_url

class Parser(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.stack=[];self.nodes={};self.ids=set();self.links=[];self.resources=[]
 def handle_starttag(self,t,a):
  d=dict(a);n={'attrs':d,'texts':[],'tag':t}
  if d.get('data-edit-node'):self.nodes[d['data-edit-node']]=n
  if d.get('id'):self.ids.add(d['id'])
  if t=='a' and d.get('href','').startswith('#'):self.links.append(d['href'][1:])
  for k in ['src','poster']:
   if d.get(k):self.resources.append(d[k])
  if t=='link' and d.get('rel')=='stylesheet':self.resources.append(d['href'])
  if t not in ['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']:self.stack.append(n)
 def handle_startendtag(self,t,a):
  self.handle_starttag(t,a)
  if self.stack and self.stack[-1]['tag']==t:self.stack.pop()
 def handle_endtag(self,t):
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i]['tag']==t:self.stack=self.stack[:i];break
 def handle_data(self,d):
  if self.stack:self.stack[-1]['texts'].append(d)

class SiteTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.schema=json.loads((ROOT/'public_html/admin/schema.json').read_text())
  cls.content=json.loads((ROOT/'content/site.json').read_text())
 def test_original_html_is_unchanged_except_editor_attributes(self):
  default={'version':1,'values':{f['id']:f['initial'] for f in self.schema['fields']}}
  result=render(self.schema,default,(ROOT/'sources/index.html').read_text())
  result=re.sub(r' data-edit-node="n\d+"','',result)
  self.assertEqual(hashlib.sha256(result.encode()).hexdigest(),'aceb08adbd026a07d558c4792b39e86627e9a39384dd4c90aa983b5fa9b039ed')
 def test_original_css_is_identical(self):
  default={'version':1,'values':{f['id']:f['initial'] for f in self.schema['fields']}}
  css=render(self.schema,default,(ROOT/'sources/styles.css').read_text())
  self.assertEqual(hashlib.sha256(css.encode()).hexdigest(),'87bbca27e8ffdc1f41c3d2604987334bfa05fda8f350eb86316bd9dbda84b8f5')
 def test_every_editable_target_matches_its_content(self):
  html=render(self.schema,self.content,(ROOT/'sources/index.html').read_text());p=Parser();p.feed(html)
  for f in self.schema['fields']:
   t=f['target'];value=self.content['values'][f['id']]
   if t.get('node'):
    self.assertIn(t['node'],p.nodes,f['id']);node=p.nodes[t['node']]
    if 'textIndex' in t:self.assertEqual(node['texts'][t['textIndex']].strip(),value,f['id'])
    else:self.assertEqual(node['attrs'][t['attr']],value,f['id'])
 def test_references_and_anchors(self):
  web=ROOT/'public_html';p=Parser();p.feed((web/'index.html').read_text())
  for a in p.links:self.assertIn(a,p.ids)
  refs=[(web,u) for u in p.resources]
  for css in (web/'assets/css').glob('*.css'):
   refs.extend((css.parent,u) for u in re.findall(r'url\([\'\"]?([^\'\"\)]+)',css.read_text()))
  for directory,u in refs:
   if not urlsplit(u).scheme:self.assertTrue((directory/unquote(urlsplit(u).path)).is_file(),u)
 def test_text_edit_is_escaped_and_preserves_inline_styles(self):
  data=copy.deepcopy(self.content);f=next(f for f in self.schema['fields'] if f['label'].startswith('Título: Certifícate'))
  data['values'][f['id']]='Hola <script>alert(1)</script> & familia'
  result=render(self.schema,data,(ROOT/'sources/index.html').read_text())
  self.assertIn('Hola &lt;script&gt;alert(1)&lt;/script&gt; &amp; familia',result)
  self.assertIn('<span class="ital"',result)
 def test_invalid_media_and_links_do_not_build(self):
  f=next(f for f in self.schema['fields'] if f['type']=='image')
  for bad in ['javascript:alert(1)','data:text/html,evil','../../secreto','http://example.com/a.jpg','assets/../x','//example.com/a.jpg']:
   data=copy.deepcopy(self.content);data['values'][f['id']]=bad
   with self.assertRaises(ValueError):render(self.schema,data,'')
 def test_missing_field_is_rejected(self):
  data=copy.deepcopy(self.content);data['values'].pop(next(iter(data['values'])))
  with self.assertRaises(ValueError):render(self.schema,data,'')
 def test_miami_date_has_correct_winter_offset(self):
  data=copy.deepcopy(self.content);f=next(f for f in self.schema['fields'] if f['type']=='datetime');data['values'][f['id']]='2026-12-20T10:00'
  result=render(self.schema,data,(ROOT/'sources/main.js').read_text())
  self.assertIn('2026-12-20T15:00:00+00:00',result)
  self.assertIn('20 de diciembre de 2026, 10:00 a. m.',result)
 def test_invalid_calendar_date_and_dst_gap_are_rejected(self):
  f=next(f for f in self.schema['fields'] if f['type']=='datetime')
  for value in ['2026-02-30T10:00','2027-03-14T02:30']:
   data=copy.deepcopy(self.content);data['values'][f['id']]=value
   with self.assertRaises(ValueError):render(self.schema,data,'')
 def test_uploaded_image_css_path_and_html_path(self):
  data=copy.deepcopy(self.content);f=next(f for f in self.schema['fields'] if f['target'].get('cssImage'))
  data['values'][f['id']]='assets/uploads/fondo.jpg'
  self.assertIn('url(../uploads/fondo.jpg)',render(self.schema,data,(ROOT/'sources/styles.css').read_text()))
 def test_all_media_bytes_match_downloaded_inventory(self):
  inventory=json.loads((ROOT/'inventario.json').read_text())
  for item in inventory['assets']:
   if item['path'].endswith('fonts.css'):continue
   file=ROOT/item['path'];self.assertEqual(hashlib.sha256(file.read_bytes()).hexdigest(),item['sha256'],item['path'])

if __name__=='__main__':unittest.main()
