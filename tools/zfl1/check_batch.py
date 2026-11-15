"""Kiểm tra file kết quả của một lô: python check_batch.py <batch.json> <out_dir>
Mỗi đoạn p có file <out_dir>/p<PP>.json = {"sents": [ {...}, ... ]}"""
import json, re, sys, os
ROLES = {'CN', 'V', 'TN', 'DN', 'TR', 'BN', 'LT', 'P'}
nows = lambda s: re.sub(r'\s+', '', s or '')
def check(batch_path, out_dir):
    B = json.load(open(batch_path, encoding='utf8'))
    lunyu = B.get('mode') == 'lunyu'
    errs, done = [], 0
    for P in B['paragraphs']:
        f = os.path.join(out_dir, f"p{P['p']:02d}.json")
        if not os.path.exists(f): errs.append(f'p{P["p"]:02d}: chưa có file'); continue
        try: S = json.load(open(f, encoding='utf8'))['sents']
        except Exception as e: errs.append(f'p{P["p"]:02d}: JSON lỗi {e}'); continue
        byi = {s.get('i'): s for s in S}
        E = lambda m: errs.append(f'p{P["p"]:02d} {m}')
        for z in P['zh']:
            s = byi.get(z['i'])
            if not s: E(f'thiếu câu i={z["i"]}'); continue
            i = z['i']
            if not lunyu:
                g = s.get('g') or []
                if ''.join(c[0] for c in g) != z['t']: E(f'i={i}: ghép các cụm "g" không đúng nguyên câu.\n   câu : {z["t"]}\n   ghép: {"".join(c[0] for c in g)}')
                for c in g:
                    if len(c) != 3 or c[1] not in ROLES: E(f'i={i}: cụm g sai dạng {c}')
                n = s.get('n') or []
                if not 1 <= len(n) <= 5 or any(len(x) != 3 for x in n): E(f'i={i}: "n" cần 1–5 mục [mẫu, tiêu đề, giải thích]')
                for w in s.get('w') or []:
                    if len(w) != 2 or w[0] not in z['t'] or len(w[0]) < 2: E(f'i={i}: từ "w" không có trong câu hoặc sai dạng: {w}')
            eg = s.get('eg') or []
            if s.get('en'):
                if nows(''.join(c[0] for c in eg)) != nows(s['en']): E(f'i={i}: ghép các cụm "eg" không khớp "en".\n   en : {s["en"]}\n   ghép: {" ".join(c[0] for c in eg)}')
                for c in eg:
                    if len(c) != 3 or c[1] not in ROLES: E(f'i={i}: cụm eg sai dạng {c}')
                if not 1 <= len(s.get('en_n') or []) <= 5 or any(len(x) != 3 for x in s['en_n']): E(f'i={i}: "en_n" cần 1–5 mục')
                for v in s.get('v') or []:
                    if len(v) != 4 or v[0].lower() not in s['en'].lower(): E(f'i={i}: từ vựng "v" không có trong câu en hoặc sai dạng: {v}')
        for L in (('en',) if lunyu else ('en', 'vi')):
            joined = ''.join((byi.get(z['i']) or {}).get(L, '') for z in P['zh'])
            if nows(joined) != nows(P[L]):
                a, b = nows(joined), nows(P[L]); k = next((j for j in range(min(len(a), len(b))) if a[j] != b[j]), min(len(a), len(b)))
                E(f'các đoạn "{L}" ghép lại không đúng nguyên văn đoạn chính thức (lệch từ vị trí ~{k}: "...{b[max(0,k-30):k+40]}..." / bạn có: "...{a[max(0,k-30):k+40]}...")')
        if not any(e.startswith(f'p{P["p"]:02d}') for e in errs): done += 1
    return errs, done, len(B['paragraphs'])
if __name__ == '__main__':
    import io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    errs, done, tot = check(sys.argv[1], sys.argv[2])
    for e in errs: print('✗', e)
    print(f'{done}/{tot} đoạn đạt' + (' — XONG' if done == tot else ''))
