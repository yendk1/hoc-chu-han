"""Gộp dữ liệu đã chú giải thành các file dữ liệu của app.

python tools/zfl1/build.py <scratchpad>
  <scratchpad>/src/zfl1_struct.json      (prep.py)
  <scratchpad>/out/bNN/pPP.json          (gióng câu + chú giải, b10 = Luận ngữ tiếng Anh)
  <scratchpad>/chars/outK.txt            (âm Hán Việt, nghĩa, cấu tạo của chữ mới)
  <scratchpad>/dict/                     (Unihan, mmh.txt, CVDICT.u8)
Ghi ra:
  js/data-chars2.js, js/data-components.js (bổ sung), js/books/zfl1/*.js, js/books/lunyu/en.js
  <scratchpad>/jobs_more.json  (việc tạo âm thanh còn thiếu)
"""
import json, re, os, sys, glob, collections, unicodedata
from pypinyin import pinyin, Style
import eng_to_ipa

S = sys.argv[1]; ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
J = lambda *p: os.path.join(S, *p)
R = lambda *p: os.path.join(ROOT, *p)
isHan = lambda c: '㐀' <= c <= '鿿' or '豈' <= c <= '﫿'
jsstr = lambda s: json.dumps(s, ensure_ascii=False)
def tpl(s): return s.replace('\\', '\\\\').replace('`', "'").replace('${', '$ {')

st = json.load(open(J('src', 'zfl1_struct.json'), encoding='utf8'))
SENTS = st['sents']; N = len(SENTS)

# ---------- đọc kết quả chú giải ----------
ANN = {}
for f in glob.glob(J('out', 'b0*', 'p*.json')):
    for s in json.load(open(f, encoding='utf8'))['sents']: ANN[s['i']] = s
LUN = {}
for f in glob.glob(J('out', 'b10', 'p*.json')):
    for s in json.load(open(f, encoding='utf8'))['sents']: LUN[s['i']] = s
print('chú giải:', len(ANN), '/', N, 'câu · Luận ngữ EN:', len(LUN))

# ---------- từ điển ----------
U = collections.defaultdict(dict)
for f in ['Unihan_Readings.txt', 'Unihan_Variants.txt', 'Unihan_IRGSources.txt']:
    for l in open(J('dict', f), encoding='utf8'):
        if l.startswith('U+'):
            cp, k, v = l.rstrip('\n').split('\t', 2); U[chr(int(cp[2:], 16))][k] = v
MMH = {}
for l in open(J('dict', 'mmh.txt'), encoding='utf8'):
    if l.strip(): o = json.loads(l); MMH[o['character']] = o

lun = json.load(open(J('lunyu_data.json'), encoding='utf8'))
OLD = {l.split('|')[0]: l.split('|') for l in lun['CHAR_RAW'].strip().split('\n')}
COMPS = {l.split('|')[0] for l in lun['COMP_RAW'].strip().split('\n')}

# ---------- âm Hán Việt / nghĩa / cấu tạo của chữ mới ----------
HV = {}
for f in sorted(glob.glob(J('chars', 'out*.txt'))):
    for l in open(f, encoding='utf8'):
        p = l.rstrip('\n').split('|')
        if len(p) >= 5 and len(p[0]) == 1: HV[p[0]] = p[1:5]

def rad_of(c):
    rs = U[c].get('kRSUnicode', '').split()[0] if U[c].get('kRSUnicode') else ''
    m = re.match(r"(\d+)", rs)
    return unicodedata.normalize('NFKC', chr(0x2F00 + int(m.group(1)) - 1)) if m else ''
IDS2 = set('⿰⿱⿴⿵⿶⿷⿸⿹⿺⿻'); IDS3 = set('⿲⿳')
def parse_ids(s, i=0):
    c = s[i]
    if c in IDS2 or c in IDS3:
        kids, j = [], i + 1
        for _ in range(3 if c in IDS3 else 2):
            node, j = parse_ids(s, j); kids.append(node)
        return (c, kids), j
    return c, i + 1
def leaves(n): return [n] if isinstance(n, str) else [x for k in n[1] for x in leaves(k)]
def parts_of(c):
    d = MMH.get(c, {}).get('decomposition', '')
    if not d or d == '？': return []
    try: tree, _ = parse_ids(d)
    except Exception: return []
    if isinstance(tree, str): return [] if tree == c else [tree]
    out = []
    for k in tree[1]:
        out += [k] if isinstance(k, str) else leaves(k)
    return [x for x in out if x not in '？' and x != c]
def simp(c):
    v = U[c].get('kSimplifiedVariant', '').split()
    s = chr(int(v[0][2:], 16)) if v else ''
    return s if s != c else ''

chars = list(dict.fromkeys(c for s in SENTS for c in s if isHan(c)))
rows, missing_hv = [], []
for c in chars:
    if c in OLD: continue
    hv, m, typ, ex = HV.get(c, ['', '', '', ''])
    if not hv:
        missing_hv.append(c); hv = (U[c].get('kVietnamese', '').split() or ['?'])[0].capitalize()
        m = m or U[c].get('kDefinition', '')
    py = U[c].get('kMandarin', '').split()[0] if U[c].get('kMandarin') else (pinyin(c)[0][0])
    et = MMH.get(c, {}).get('etymology', {})
    typ = typ if typ in ('TH', 'CS', 'HY', 'HT') else {'pictographic': 'TH', 'ideographic': 'HY', 'pictophonetic': 'HT'}.get(et.get('type'), 'HY')
    rows.append('|'.join([c, py, hv, simp(c), m.replace('|', '/'), rad_of(c) or c, ' '.join(parts_of(c)), typ, ex.replace('|', '/')]))
print('chữ mới:', len(rows), '· thiếu âm HV (tạm lấy Unihan):', len(missing_hv), ''.join(missing_hv[:40]))
open(R('js', 'data-chars2.js'), 'w', encoding='utf8').write(
    '// Chữ Hán bổ sung cho Bài giảng thứ nhất (tự sinh bởi tools/zfl1/build.py)\n'
    '// chữ|pinyin|Hán Việt|giản thể|nghĩa|bộ thủ|thành phần|loại|giải thích\nwindow.CHAR_RAW2 = `\n' + tpl('\n'.join(rows)) + '\n`;\n')

# ---------- thành phần (bộ) mới ----------
NEWHV = {r.split('|')[0]: r.split('|') for r in rows}
need = set()
for r in rows:
    p = r.split('|'); need.add(p[5]); need.update(p[6].split())
newcomp = []
CNAMES = {}
if os.path.exists(J('comps', 'out.txt')):
    for l in open(J('comps', 'out.txt'), encoding='utf8'):
        p = l.rstrip('\n').split('|')
        if len(p) == 5 and p[0]: CNAMES[p[0]] = l.rstrip('\n')
for k in sorted(need):
    if k in CNAMES and k not in COMPS and k not in OLD and k not in NEWHV: newcomp.append(CNAMES[k]); continue
    if not k or k in COMPS or k in OLD or k in NEWHV: continue
    name = (HV.get(k, [''])[0]) or (U[k].get('kVietnamese', '').split() or [''])[0].capitalize()
    mean = (HV.get(k, ['', ''])[1]) or U[k].get('kDefinition', '')[:60]
    newcomp.append(f'{k}|{name}|{mean.replace("|", "/")}||')
src = open(R('js', 'data-components.js'), encoding='utf8').read()
MARK = '// --- bổ sung cho Bài giảng thứ nhất ---'
if MARK in src: src = src[:src.index(MARK)].rstrip() + '\n`;'
src = src.rstrip()
assert src.endswith('`;')
src = src[:-2].rstrip() + '\n' + MARK + '\n' + tpl('\n'.join(newcomp)) + '\n`;\n'
open(R('js', 'data-components.js'), 'w', encoding='utf8').write(src)
print('thành phần mới:', len(newcomp))

# ---------- pinyin theo câu ----------
def sent_py(s):
    hz = ''.join(c for c in s if isHan(c))
    return [x[0] for x in pinyin(hz, style=Style.TONE, errors='default')]
SENT_PY = []
for s in SENTS:
    p = sent_py(s); SENT_PY.append(' '.join(p))
    assert len(p) == sum(1 for c in s if isHan(c)), s

# ---------- từ ghép ----------
def hv_of(c):
    if c in OLD: return OLD[c][2].split('/')[0].lower()
    if c in NEWHV: return NEWHV[c][2].split('/')[0].lower()
    return ''
WORDS = {}
for i in range(N):
    a = ANN.get(i)
    if not a: continue
    s = SENTS[i]; spy = SENT_PY[i].split(); hzpos = [k for k, c in enumerate(s) if isHan(c)]
    for w, m in a.get('w', []):
        if w in WORDS or not all(isHan(c) for c in w) or len(w) < 2: continue
        p = s.find(w)
        if p < 0: continue
        k0 = hzpos.index(p)
        WORDS[w] = (' '.join(spy[k0:k0 + len(w)]), ' '.join(hv_of(c) for c in w), m.replace('|', '/'))
print('từ ghép:', len(WORDS))

os.makedirs(R('js', 'books', 'zfl1'), exist_ok=True)
with open(R('js', 'books', 'zfl1', 'words.js'), 'w', encoding='utf8') as f:
    f.write('// Bài giảng thứ nhất – từ ghép, câu, pinyin theo câu (tự sinh bởi tools/zfl1/build.py)\n')
    f.write('window.WORD_RAW = `\n' + tpl('\n'.join(f'{w}|{p}|{h}|{m}' for w, (p, h, m) in WORDS.items())) + '\n`;\n')
    f.write('window.LESSONS = [\n' + ',\n'.join(jsstr([s, '']) for s in SENTS) + '\n];\n')
    f.write('window.SENT_PY = ' + jsstr(SENT_PY) + ';\n')

# ---------- ngữ pháp ----------
def gstr(g, s):
    if not g or ''.join(c[0] for c in g) != s: return f'{s}[V:]'
    return ' '.join(f"{t.replace(' ', '')}[{r}:{gl.replace(']', ')').replace('[', '(')}]" for t, r, gl in g)
with open(R('js', 'books', 'zfl1', 'grammar.js'), 'w', encoding='utf8') as f:
    f.write('// Bài giảng thứ nhất – phân tích ngữ pháp từng câu (tự sinh)\nwindow.GRAMMAR = [\n')
    for i, s in enumerate(SENTS):
        a = ANN.get(i, {})
        f.write(json.dumps({'s': gstr(a.get('g'), s), 'n': a.get('n') or []}, ensure_ascii=False) + ',\n')
    f.write('];\n')

# ---------- tiếng Việt + cấu trúc mục/đoạn ----------
secs, paras = [], []
for p in st['paras']: paras.append([p['first'], p['first'] + p['n'] - 1])
for k, sc in enumerate(st['sections']):
    ps = [paras[j] for j, p in enumerate(st['paras']) if p['sec'] == k]
    secs.append({'zh': sc['zh'], 'vi': sc['vi'], 'en': sc['en'], 'a': ps[0][0], 'b': ps[-1][1]})
with open(R('js', 'books', 'zfl1', 'vi.js'), 'w', encoding='utf8') as f:
    f.write('// Bài giảng thứ nhất – bản dịch tiếng Việt chính thức (vi.falundafa.org), gióng theo câu\n')
    f.write("window.VI_SOURCE = 'https://vi.falundafa.org/book/zfl_2024_html/lecture1.html';\n")
    f.write('window.VI_OFFICIAL = [\n' + ',\n'.join(jsstr(ANN.get(i, {}).get('vi', '')) for i in range(N)) + '\n];\n')
    f.write('window.BOOK_SECTIONS = ' + jsstr(secs) + ';\nwindow.BOOK_PARAS = ' + jsstr(paras) + ';\n')
    f.write('window.VI_NOTES = ' + jsstr(st['vi_notes']) + ';\n')

# ---------- tiếng Anh ----------
IPA_CACHE = {}
def ipa(w):
    if w not in IPA_CACHE:
        r = eng_to_ipa.convert(w)
        IPA_CACHE[w] = '' if '*' in r else r
    return IPA_CACHE[w]
WORD_RE = re.compile(r"[A-Za-z][A-Za-z’'\-]*[A-Za-z]|[A-Za-z]")
def en_key(w): return re.sub(r"^[^a-z0-9]+|[^a-z0-9]+$", '', w.lower().replace('’', "'"))
def ipa_for(text):
    out = {}
    for w in WORD_RE.findall(text):
        k = en_key(w)
        if not k or k in out: continue
        v = ipa(k)
        if not v and '-' in k: v = ' '.join(ipa(x) for x in k.split('-') if ipa(x))
        if not v and k.endswith("'s"): v = ipa(k[:-2]) + ('z' if ipa(k[:-2]) else '')
        if v: out[k] = v
    return out
def en_book(sents_by_i, n, source, audio_dir, out_path, comment):
    sents, ipa_all, words = [], {}, set()
    for i in range(n):
        a = sents_by_i.get(i, {})
        e = {'en': a.get('en', ''), 'eg': a.get('eg') or [], 'n': a.get('en_n') or [], 'v': a.get('v') or []}
        sents.append(e)
        ipa_all.update(ipa_for(e['en']))
        for w in WORD_RE.findall(e['en']): words.add(w.replace('’', "'"))
        for v in e['v']:
            for w in (v[0], v[1]):
                if w and w.strip(): ipa_all.update(ipa_for(w)); words.add(w.strip())
    data = {'source': source, 'audio': audio_dir, 'sents': sents, 'ipa': ipa_all}
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf8') as f:
        f.write(comment + '\nwindow.EN_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    return sents, words
zs, zw = en_book(ANN, N, 'https://en.falundafa.org/eng/zfl2014/zfl_2014_1.html', 'audio/en/zfl1/', R('js', 'books', 'zfl1', 'en.js'),
                 '// Bài giảng thứ nhất – tiếng Anh (bản dịch chính thức 2014), ngữ pháp & từ vựng từng câu (tự sinh)')
ls, lw = en_book(LUN, 20, 'https://en.falundafa.org/eng/zfl2014/zfl_2014_0.html', 'audio/en/lunyu/', R('js', 'books', 'lunyu', 'en.js'),
                 '// Luận ngữ – tiếng Anh (bản dịch chính thức 2015), ngữ pháp & từ vựng từng câu (tự sinh)')

# ---------- nghĩa các từ thông dụng (ngoài danh sách từ vựng) ----------
GL = {}
if os.path.exists(J('enwords_out.txt')):
    for l in open(J('enwords_out.txt'), encoding='utf8'):
        p = l.rstrip('\n').split('|')
        if len(p) == 4 and p[0]: GL[en_key(p[0])] = [p[1], p[2], p[3]]
with open(R('js', 'data-en-gloss.js'), 'w', encoding='utf8') as f:
    f.write('// Nghĩa tiếng Việt của các từ tiếng Anh thông dụng trong bài (ngoài danh sách từ vựng) – tự sinh\n')
    f.write('window.EN_GLOSS = ' + json.dumps(GL, ensure_ascii=False, separators=(',', ':')) + ';\n')
print('nghĩa từ thông dụng:', len(GL))

# ---------- âm thanh còn thiếu ----------
slug = lambda w: re.sub(r'[^a-z0-9]+', '_', en_key(w))
jobs = []
for book, sents in (('zfl1', zs), ('lunyu', ls)):
    for i, e in enumerate(sents):
        if e['en']: jobs.append([R('audio', 'en', book, f'e{i}.mp3'), e['en'], 'en-US-AvaNeural', '-5%'])
all_words = sorted({slug(w): w for w in zw | lw if slug(w)}.items())
for sl, w in all_words: jobs.append([R('audio', 'en', 'w', f'{sl}.mp3'), w, 'en-US-AvaNeural', '-10%'])
key = lambda t: '-'.join('%x' % ord(c) for c in t)
for r in rows:
    c = r.split('|')[0]; jobs.append([R('audio', key(c) + '.mp3'), c, 'zh-CN-XiaoxiaoNeural', '-15%'])
for w in WORDS: jobs.append([R('audio', key(w) + '.mp3'), w, 'zh-CN-XiaoxiaoNeural', '-15%'])
json.dump(jobs, open(J('jobs_more.json'), 'w', encoding='utf8'), ensure_ascii=False)
print('việc âm thanh:', len(jobs), '(bỏ qua file đã có khi chạy)')

# danh sách file âm thanh
have = sorted(f[:-4] for f in os.listdir(R('audio')) if f.endswith('.mp3') and os.path.getsize(R('audio', f)) > 0)
wdir = R('audio', 'en', 'w'); wav = sorted(f[:-4] for f in os.listdir(wdir)) if os.path.isdir(wdir) else []
with open(R('js', 'data-audio.js'), 'w', encoding='utf-8') as fh:
    fh.write('// Tự sinh – danh sách file trong audio/ (chữ, từ) và audio/en/w/ (từ tiếng Anh)\n')
    fh.write('window.AUDIO_FILES = new Set(' + json.dumps(have) + ');\n')
    fh.write('window.EN_WORD_AUDIO = ' + json.dumps(wav) + ';\n')
print('audio:', len(have), 'chữ/từ ·', len(wav), 'từ tiếng Anh')
