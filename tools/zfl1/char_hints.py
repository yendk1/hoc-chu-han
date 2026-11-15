"""Tạo gợi ý cho từng chữ mới (chưa có trong Luận ngữ): pinyin, âm Việt (Unihan), nghĩa CVDICT, cấu tạo MMH."""
import json, re, sys, os, collections
S = sys.argv[1]; D = os.path.join(S, 'dict')
U = collections.defaultdict(dict)
for f in ['Unihan_Readings.txt', 'Unihan_Variants.txt', 'Unihan_IRGSources.txt']:
    for l in open(os.path.join(D, f), encoding='utf8'):
        if l.startswith('U+'):
            cp, k, v = l.rstrip('\n').split('\t', 2); U[chr(int(cp[2:], 16))][k] = v
MMH = {}
for l in open(os.path.join(D, 'mmh.txt'), encoding='utf8'):
    if l.strip(): o = json.loads(l); MMH[o['character']] = o
CV = collections.defaultdict(list)
for l in open(os.path.join(D, 'CVDICT.u8'), encoding='utf8'):
    if l.startswith('#'): continue
    m = re.match(r'(\S+) (\S+) \[([^\]]+)\] /(.*)/', l)
    if m and len(m.group(1)) == 1: CV[m.group(1)].append((m.group(3), m.group(4)))
st = json.load(open(os.path.join(S, 'src', 'zfl1_struct.json'), encoding='utf8'))
lun = json.load(open(os.path.join(S, 'lunyu_data.json'), encoding='utf8'))
have = {l.split('|')[0] for l in lun['CHAR_RAW'].strip().split('\n')}
freq = collections.Counter(c for s in st['sents'] for c in s if '㐀' <= c <= '鿿')
new = [c for c, _ in freq.most_common() if c not in have]
out = []
for c in new:
    m = MMH.get(c, {}); et = m.get('etymology', {})
    out.append({'c': c, 'n': freq[c], 'py': U[c].get('kMandarin', ''), 'viet_unihan': U[c].get('kVietnamese', ''),
                'cvdict': ' || '.join(f'[{p}] {g[:160]}' for p, g in CV[c][:3]), 'en': U[c].get('kDefinition', '')[:120],
                'decomp': m.get('decomposition', ''), 'etym': et})
os.makedirs(os.path.join(S, 'chars'), exist_ok=True)
half = (len(out) + 1) // 2
for k, part in enumerate([out[:half], out[half:]]):
    json.dump(part, open(os.path.join(S, 'chars', f'in{k}.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=0)
print(len(new), 'chars;', sum(1 for o in out if not o['decomp']), 'không có trong MMH')
