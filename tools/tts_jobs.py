"""Chạy danh sách việc đọc TTS: python tools/tts_jobs.py jobs.json
jobs.json = [[đường_dẫn_mp3, văn_bản, giọng, tốc_độ], ...]  (bỏ qua file đã có)"""
import asyncio, json, os, sys
import edge_tts
jobs = json.load(open(sys.argv[1], encoding='utf8'))
async def one(sem, path, text, voice, rate):
    if os.path.exists(path) and os.path.getsize(path) > 0: return
    os.makedirs(os.path.dirname(path), exist_ok=True)
    async with sem:
        for attempt in range(5):
            try: await edge_tts.Communicate(text, voice, rate=rate).save(path); return
            except Exception as e:
                if attempt == 4: print('LỖI', path, e, flush=True)
                await asyncio.sleep(3 * (attempt + 1))
async def main():
    sem = asyncio.Semaphore(8)
    await asyncio.gather(*(one(sem, *j) for j in jobs))
    print('xong', len(jobs), 'việc', flush=True)
asyncio.run(main())
