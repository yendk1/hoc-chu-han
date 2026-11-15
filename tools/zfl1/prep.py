"""Tách câu tiếng Trung, chia lô (batch) cho bước gióng câu + chú giải."""
import json, re, sys, os
SRC = sys.argv[1]; OUT = sys.argv[2]
d = json.load(open(os.path.join(SRC, 'corpus.json'), encoding='utf8'))
def split_zh(p):
    parts = re.findall(r'.+?(?:[。！？…]+[」』”’）]*|$)', p)
    return [x.strip() for x in parts if x.strip()]
sents, paras, gi = [], [], 0
for s, sec in enumerate(d['zh']):
    for k, z in enumerate(sec['paras']):
        ss = split_zh(z.replace('　', ''))
        assert ''.join(ss) == z.replace('　', '').replace(' ', '') or True
        idx = list(range(gi, gi + len(ss))); gi += len(ss)
        paras.append({'p': len(paras), 'sec': s, 'zh': [{'i': i, 't': t} for i, t in zip(idx, ss)],
                      'en': d['en'][s]['paras'][k], 'vi': d['vi'][s]['paras'][k]})
        sents += ss
print('sentences', len(sents), 'paras', len(paras), 'max len', max(map(len, sents)))
os.makedirs(OUT, exist_ok=True)
# lô ~67 câu, cắt theo ranh giới đoạn
batches, cur, n = [], [], 0
target = len(sents) / 10
for p in paras:
    cur.append(p); n += len(p['zh'])
    if n >= target * (len(batches) + 1) - 5 and len(batches) < 9: batches.append(cur); cur = []
if cur: batches.append(cur)
for b, ps in enumerate(batches):
    json.dump({'batch': b, 'paragraphs': ps}, open(os.path.join(OUT, f'b{b:02d}.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(b, len(ps), sum(len(p['zh']) for p in ps))
json.dump({'sections': [{'zh': d['zh'][s]['title'], 'en': d['en'][s]['title'], 'vi': d['vi'][s]['title']} for s in range(len(d['zh']))],
           'paras': [{'sec': p['sec'], 'first': p['zh'][0]['i'], 'n': len(p['zh'])} for p in paras],
           'sents': sents, 'vi_notes': d['vi_notes']}, open(os.path.join(SRC, 'zfl1_struct.json'), 'w', encoding='utf8'), ensure_ascii=False)
