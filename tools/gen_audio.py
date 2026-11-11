"""Tạo file âm thanh MP3 cho chữ, từ và câu trong app (giọng Microsoft Neural, qua edge-tts).

Cách dùng:   pip install edge-tts
             python tools/gen_audio.py          # chỉ tạo file còn thiếu
             python tools/gen_audio.py --force  # tạo lại tất cả
Kết quả:     audio/<mã-hex>.mp3  (chữ / từ),  audio/s<số câu>.mp3 và audio/s<số câu>-slow.mp3
             js/data-audio.js    (danh sách file có sẵn để app biết)
"""
import asyncio, os, re, sys
import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VOICE = 'zh-CN-XiaoxiaoNeural'
OUT = os.path.join(ROOT, 'audio')
FORCE = '--force' in sys.argv

def read(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()
def raw_block(src, name):
    m = re.search(r'window\.' + name + r'\s*=\s*`(.*?)`', src, re.S); return m.group(1)
def key(text): return '-'.join('%x' % ord(c) for c in text)

chars = [l.split('|')[0].strip() for l in raw_block(read('js/data-chars.js'), 'CHAR_RAW').splitlines() if '|' in l]
wsrc = read('js/data-words.js')
words = [l.split('|')[0].strip() for l in raw_block(wsrc, 'WORD_RAW').splitlines() if '|' in l]
lessons = re.findall(r"\[\s*[\"']([^\"']*)[\"']\s*,", wsrc[wsrc.index('window.LESSONS'):])

jobs = []  # (file, text, rate)
for t in dict.fromkeys(chars + words):
    if t: jobs.append((key(t) + '.mp3', t, '-15%'))
for i, s in enumerate(lessons):
    jobs.append((f's{i}.mp3', s, '-10%'))
    jobs.append((f's{i}-slow.mp3', s, '-45%'))

async def one(sem, f, text, rate):
    path = os.path.join(OUT, f)
    if not FORCE and os.path.exists(path) and os.path.getsize(path) > 0: return
    async with sem:
        for attempt in range(4):
            try:
                await edge_tts.Communicate(text, VOICE, rate=rate).save(path); return
            except Exception as e:
                if attempt == 3: print('LỖI', f, text, e)
                await asyncio.sleep(2 * (attempt + 1))

async def main():
    os.makedirs(OUT, exist_ok=True)
    sem = asyncio.Semaphore(8)
    await asyncio.gather(*(one(sem, *j) for j in jobs))
    have = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith('.mp3') and os.path.getsize(os.path.join(OUT, f)) > 0)
    with open(os.path.join(ROOT, 'js', 'data-audio.js'), 'w', encoding='utf-8') as fh:
        fh.write('// Tự sinh bởi tools/gen_audio.py – danh sách file trong audio/\n')
        fh.write('window.AUDIO_FILES = new Set(' + repr(have).replace("'", '"') + ');\n')
    print(f'{len(chars)} chữ, {len(words)} từ, {len(lessons)} câu -> {len(have)} file trong audio/')

asyncio.run(main())
