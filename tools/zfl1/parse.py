"""Tách Bài giảng thứ nhất (zh / en / vi) thành các mục + đoạn văn. Ghi ra corpus.json"""
import re, html, json, sys, os
SRC = sys.argv[1]  # thư mục chứa các file html đã tải
def clean(s):
    s = re.sub(r'<sup.*?</sup>', '', s, flags=re.S | re.I)
    s = html.unescape(re.sub(r'<[^>]+>', '', s))
    return re.sub(r'\s+', ' ', s).strip()
def blocks(s, start, heads):
    i = s.find(start); j = s.rfind('<p', 0, i); s = s[j if j > i - 80 else i:]
    out = []
    for m in re.finditer(r'<(p|h3)[^>]*>(.*?)</\1>', s, re.S | re.I):
        t = clean(m.group(2))
        if not t: continue
        is_head = m.group(1).lower() == 'h3' or heads(m.group(2), t)
        out.append(('H' if is_head else 'P', t))
    return out
def group(bl):
    secs = []
    for k, t in bl:
        if k == 'H': secs.append({'title': t, 'paras': []})
        elif secs: secs[-1]['paras'].append(t)
    return secs
zh = open(os.path.join(SRC, 'big5.falundafa.org_chibig5_zfl_1.htm'), encoding='utf8').read()
zhb = blocks(zh, '<a name="1">', lambda raw, t: '<a name=' in raw.lower() and len(t) < 30)
en = open(os.path.join(SRC, 'zfl_2014_1.html'), encoding='utf8').read()
enb = blocks(en, '<a name="1">', lambda raw, t: '<a name=' in raw.lower() and len(t) < 90)
vi = open(os.path.join(SRC, 'lecture1_vi.html'), encoding='utf8').read()
vib = blocks(vi, '<a id="1">', lambda raw, t: False)
out = {'zh': group(zhb), 'en': group(enb), 'vi': group(vib)}
last = out['vi'][-1]['paras']
out['vi_notes'] = [x for x in last if re.match(r'^\d+\. ', x)]
out['vi'][-1]['paras'] = [x for x in last if not re.match(r'^\d+\. ', x)]
for L in ('zh', 'en', 'vi'):
    print(L, [len(s['paras']) for s in out[L]], [s['title'][:25] for s in out[L]])
json.dump(out, open(os.path.join(SRC, 'corpus.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
