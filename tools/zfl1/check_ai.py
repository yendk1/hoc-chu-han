"""Kiểm tra kết quả bản dịch AI + đánh giá: python check_ai.py <aibatch.json> <out_dir>
Mỗi đoạn p có file <out_dir>/p<PP>.json = {"sents": [ {i, en, eg, en_n, v, cmp:{tags, note}}, ... ]}"""
import json, re, sys, os
ROLES = {'CN', 'V', 'TN', 'DN', 'TR', 'BN', 'LT', 'P'}
TAGS = {'sát', 'diễn ý', 'lược bỏ', 'thêm ý', 'đổi sắc thái', 'thuật ngữ', 'gộp/tách câu', 'văn phong'}
nows = lambda s: re.sub(r'\s+', '', s or '')
def check(batch_path, out_dir):
    B = json.load(open(batch_path, encoding='utf8'))
    errs, done = [], 0
    for P in B['paragraphs']:
        f = os.path.join(out_dir, f"p{P['p']:02d}.json")
        E = lambda m: errs.append(f'p{P["p"]:02d} {m}')
        if not os.path.exists(f): E('chưa có file'); continue
        try: S = json.load(open(f, encoding='utf8'))['sents']
        except Exception as e: E(f'JSON lỗi {e}'); continue
        byi = {s.get('i'): s for s in S}
        for z in P['zh']:
            i = z['i']; s = byi.get(i)
            if not s: E(f'thiếu câu i={i}'); continue
            en = (s.get('en') or '').strip()
            if not en: E(f'i={i}: "en" (bản dịch mới) không được để trống'); continue
            if re.search(r'[㐀-鿿]', en): E(f'i={i}: "en" còn chữ Hán')
            eg = s.get('eg') or []
            if nows(''.join(c[0] for c in eg)) != nows(en): E(f'i={i}: ghép các cụm "eg" không khớp "en".\n   en : {en}\n   ghép: {" ".join(c[0] for c in eg)}')
            for c in eg:
                if len(c) != 3 or c[1] not in ROLES: E(f'i={i}: cụm eg sai dạng {c}')
            if not 1 <= len(s.get('en_n') or []) <= 5 or any(len(x) != 3 for x in s['en_n']): E(f'i={i}: "en_n" cần 1–5 mục [mẫu, tiêu đề, giải thích]')
            vs = s.get('v') or []
            if not 2 <= len(vs) <= 10: E(f'i={i}: "v" cần 2–10 mục')
            for v in vs:
                if len(v) != 4 or v[0].lower() not in en.lower(): E(f'i={i}: từ vựng "v" không có trong câu en hoặc sai dạng: {v}')
            c = s.get('cmp') or {}
            tags = c.get('tags') or []
            if not tags or any(t not in TAGS for t in tags): E(f'i={i}: "cmp.tags" phải là các nhãn trong danh sách {sorted(TAGS)}: {tags}')
            if 'sát' in tags and len(tags) > 1: E(f'i={i}: nhãn "sát" không đi cùng nhãn khác')
            if 'sát' not in tags and len((c.get('note') or '').strip()) < 15: E(f'i={i}: cần "cmp.note" nêu cụ thể chỗ khác biệt')
        if not any(e.startswith(f'p{P["p"]:02d}') for e in errs): done += 1
    return errs, done, len(B['paragraphs'])
if __name__ == '__main__':
    import io; sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    errs, done, tot = check(sys.argv[1], sys.argv[2])
    for e in errs[:60]: print('✗', e)
    if len(errs) > 60: print(f'… và {len(errs) - 60} lỗi khác')
    print(f'{done}/{tot} đoạn đạt' + (' — XONG' if done == tot else ''))
