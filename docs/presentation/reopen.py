from pathlib import Path
import json,hashlib
P=Path(__file__).resolve().parent
load=lambda n:json.loads((P/n).read_text())
m=load('bundle-manifest.json')
for f in m['files']:
 b=(P/f['path']).read_bytes()
 if len(b)!=f['bytes'] or hashlib.sha256(b).hexdigest()!=f['sha256']:raise SystemExit('Changed bundle member: '+f['path'])
a,b=load('before.json'),load('after.json');report=load('probe-report.json');assert report['scope']=='supplied-examples-only' and report['compatibilityProven'] is False
for key,name in [('before','before.json'),('after','after.json'),('cases','probes.json')]:
 raw=(P/name).read_bytes();assert report['inputs'][key]=={'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
assert load('cancel-preserved.json')==load('invalid-preserved.json')==b
old=json.loads(a['definitions']['read_voltage']);new=json.loads(b['definitions']['read_voltage']);suite=load('probes.json')['cases'];out=[]
for case,record in zip(suite,report['cases']):
 field='unit' if case['direction']=='input' else 'status';schema='inputSchema' if case['direction']=='input' else 'outputSchema';value=case['value'][field];before=value in old[schema]['properties'][field]['enum'];after=value in new[schema]['properties'][field]['enum'];assert record['before']['status']==('valid' if before else 'invalid') and record['after']['status']==('valid' if after else 'invalid');out.append(record['verdict'])
assert out==['accepted-example','input-regression','accepted-example','output-regression'];print(json.dumps({'files_verified':len(m['files']),'enum_witnesses_checked':4,'scope':'Only these synthetic enum cases; not universal JSON Schema or semantic compatibility'},indent=2))
