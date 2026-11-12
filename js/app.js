'use strict';
/* ================= Helpers ================= */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
const isHan = c => /[㐀-鿿豈-﫿]/.test(c);
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0;[a[i], a[j]] = [a[j], a[i]]; } return a; };
const fold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const short = m => m.split(/[;(]/)[0].trim();
const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
let toastTimer;
function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms); }

/* ================= Data ================= */
const TYPE_NAMES = {
  TH: ['Tượng hình', 'vẽ lại hình dáng sự vật'],
  CS: ['Chỉ sự', 'dùng ký hiệu để chỉ ý'],
  HY: ['Hội ý', 'ghép các phần lại thành ý mới'],
  HT: ['Hình thanh', 'một phần chỉ nghĩa + một phần gợi âm'],
};
const CHARS = {}, CHAR_LIST = [];
CHAR_RAW.trim().split('\n').forEach((line, i) => {
  const [c, py, hv, sc, m, rad, parts, type, ex] = line.split('|');
  const o = { c, py, hv, sc, m, rad, parts: parts.trim() ? parts.trim().split(/\s+/) : [], type, ex, idx: i };
  CHARS[c] = o; CHAR_LIST.push(o);
});
const COMPS = {};
COMP_RAW.trim().split('\n').forEach(line => {
  const [c, name, mean, no, base] = line.split('|');
  COMPS[c] = { c, name, mean, no: +no || 0, base: base || '' };
});
const WORDS = [], WORDMAP = {};
let MAXW = 2;
WORD_RAW.trim().split('\n').forEach(line => {
  const [w, py, hv, m] = line.split('|');
  const o = { w, py: py.trim().split(/\s+/), hv, m };
  if (o.py.length !== [...w].length) console.warn('Pinyin không khớp', w);
  WORDS.push(o); WORDMAP[w] = o; MAXW = Math.max(MAXW, [...w].length);
});
const VI_OFF = window.VI_OFFICIAL || [];
const LESSON_LIST = LESSONS.map(([text, vi], i) => ({ i, text, vi, viOff: VI_OFF[i] || vi }));
const PARAS = [[0, 6], [7, 11], [12, 13], [14, 19]];

const CHAR_WORDS = {};
WORDS.forEach(w => [...new Set(w.w)].forEach(c => (CHAR_WORDS[c] ||= []).push(w)));
const CHAR_LESSONS = {};
LESSON_LIST.forEach(l => [...new Set(l.text)].forEach(c => { if (CHARS[c]) (CHAR_LESSONS[c] ||= []).push(l.i); }));
const compBase = k => (COMPS[k] && COMPS[k].base) || k;
const COMP_INDEX = {};
CHAR_LIST.forEach(o => new Set([o.rad, ...o.parts].map(compBase)).forEach(k => { if (k !== o.c) (COMP_INDEX[k] ||= []).push(o.c); }));
function compInfo(k) {
  if (COMPS[k]) return COMPS[k];
  if (CHARS[k]) return { c: k, name: CHARS[k].hv, mean: short(CHARS[k].m), no: 0, base: '' };
  return { c: k, name: '', mean: '', no: 0, base: '' };
}

/* ================= Storage & SRS ================= */
const store = {
  get(k, d) { try { const v = localStorage.getItem('hht_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('hht_' + k, JSON.stringify(v)); } catch { } },
};
let SRS = store.get('srs', {}), NOTES = store.get('notes', {}), DONE = store.get('done', {}), CUSTOM = store.get('custom', []);
const SETTINGS = Object.assign({ py: true, hv: true, vi: true, viOn: true, rad: true, lesson: 0, mode: 'flash', scope: 'smart', count: 15 }, store.get('settings', {}));
const saveSettings = () => store.set('settings', SETTINGS);

const DAY = 864e5, INTERVALS = [0, 1, 3, 7, 14, 30, 60];
function status(c) { const s = SRS[c]; if (!s) return 'new'; return s.b >= 4 ? 'known' : 'learning'; }
const isDue = c => SRS[c] && SRS[c].d <= Date.now();
function grade(c, q) {
  const s = SRS[c] || { b: 0, d: 0, n: 0 }; s.n++;
  if (q === 0) { s.b = 1; s.d = Date.now() + 5 * 60e3; }
  else if (q === 1) { s.b = Math.max(1, s.b); s.d = Date.now() + DAY; }
  else { s.b = Math.min(6, s.b + (q === 3 ? 2 : 1)); s.d = Date.now() + INTERVALS[s.b] * DAY; }
  SRS[c] = s; store.set('srs', SRS); refreshStatus(c);
}
function setStatus(c, st) {
  const n = SRS[c]?.n || 0;
  if (st === 'new') delete SRS[c];
  else if (st === 'learning') SRS[c] = { b: 1, d: Date.now(), n };
  else SRS[c] = { b: 4, d: Date.now() + 14 * DAY, n };
  store.set('srs', SRS); refreshStatus(c);
}
function refreshStatus(c) {
  const st = status(c);
  $$(`[data-c="${c}"]`).forEach(el => { el.classList.remove('st-new', 'st-learning', 'st-known'); el.classList.add('st-' + st); });
  updateStats();
}
function updateStats() {
  const known = CHAR_LIST.filter(o => status(o.c) === 'known').length;
  const due = CHAR_LIST.filter(o => isDue(o.c)).length;
  $('#stats').innerHTML = `Đã thuộc <b>${known}</b>/${CHAR_LIST.length} · Cần ôn <i>${due}</i>`;
}

/* ================= Speech =================
 * Thứ tự ưu tiên:
 *  1. File MP3 có sẵn trong audio/ (chữ, từ, 20 câu) – không cần cài gì, chạy offline sau lần nghe đầu.
 *  2. Giọng tiếng Trung có sẵn trong máy/trình duyệt (Web Speech API).
 *  3. Văn bản tự nhập mà máy không có giọng: ghép file MP3 của từng từ/chữ đã có.
 */
let zhVoice = null;
function pickVoice() {
  const vs = speechSynthesis.getVoices();
  zhVoice = vs.find(v => /zh[-_](CN|Hans)/i.test(v.lang)) || vs.find(v => /zh[-_]TW/i.test(v.lang)) || vs.find(v => /^(zh|cmn)/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
const AUDIO = window.AUDIO_FILES || new Set();
const audioKey = t => [...t].map(c => c.codePointAt(0).toString(16)).join('-');
const SENT_IDX = new Map(LESSONS.map((x, i) => [x[0], i]));
const FULL_TEXT = LESSONS.map(x => x[0]).join('');
const player = new Audio();
let playQueue = [], playToken = 0;

function stopSpeech() {
  playToken++; playQueue = [];
  try { player.pause(); } catch (e) {}
  if (typeof ftReset === 'function') ftReset();
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}
// Âm thanh im lặng rất ngắn: phát ngay trong lúc chạm để iOS "mở khóa" trình phát.
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
const blobCache = new Map();
function audioSrc(url) {
  if (/^https?:/.test(url)) return Promise.resolve(url);           // giọng trực tuyến: phát trực tiếp
  if (!blobCache.has(url)) blobCache.set(url, fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
    .then(b => URL.createObjectURL(b)).catch(e => { blobCache.delete(url); throw e; }));
  return blobCache.get(url);                                        // file của app: tải bằng fetch (service worker lưu offline)
}
function playFiles(urls, onFail) {
  const token = ++playToken; playQueue = urls.slice();
  const fail = () => { if (token === playToken) { playQueue = []; onFail?.(); } };
  try { player.src = SILENT; player.play()?.catch?.(() => {}); } catch (e) {}
  const next = () => {
    if (token !== playToken || !playQueue.length) return;
    const u = playQueue.shift();
    if (playQueue[0]) audioSrc(playQueue[0]).catch(() => {});      // tải trước đoạn kế tiếp
    audioSrc(u).then(src => {
      if (token !== playToken) return;
      player.src = src; player.onended = next; player.onerror = fail;
      const pr = player.play(); if (pr && pr.catch) pr.catch(err => { if (err.name !== 'AbortError') fail(); });
    }, fail);
  };
  next();
}
function localFiles(text, slow) {
  const t = text.trim();
  if (SENT_IDX.has(t)) return [`audio/s${SENT_IDX.get(t)}${slow ? '-slow' : ''}.mp3`];
  if (t === FULL_TEXT) return LESSONS.map((_, i) => `audio/s${i}${slow ? '-slow' : ''}.mp3`);
  const k = audioKey(t); if (AUDIO.has(k)) return [`audio/${k}.mp3`];
  return null;
}
// Văn bản tự nhập: ghép file có sẵn của từng từ/chữ (chữ chưa có file thì bỏ qua)
function pieceFiles(text) {
  const out = []; let missing = 0;
  for (const t of segment(text)) {
    const k = t.w ? audioKey(t.w.w) : null;
    if (k && AUDIO.has(k)) { out.push(`audio/${k}.mp3`); continue; }
    for (const c of (t.chars || [t.c])) {
      const kc = audioKey(c);
      if (AUDIO.has(kc)) out.push(`audio/${kc}.mp3`); else if (/\p{Script=Han}/u.test(c)) missing++;
    }
  }
  return { files: out, missing };
}
function speakWithVoice(text, rate) {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = zhVoice.lang; u.voice = zhVoice; u.rate = rate;
  speechSynthesis.speak(u);
}
const VOICE_HELP = 'Máy chưa có giọng đọc tiếng Trung nên chữ mới được đọc từng chữ (chữ lạ sẽ bị bỏ qua). Muốn đọc liền mạch: xem hướng dẫn cài giọng ở mục “Nghe không được?” cuối trang.';
let warnedPieces = false;
function speak(text, rate = 0.8) {
  if (!text) return;
  stopSpeech();
  const slow = rate <= 0.6;
  const noSound = () => toast('Không phát được âm thanh. Hãy kiểm tra âm lượng (iPhone: gạt tắt chế độ im lặng) và kết nối mạng.', 5000);
  const files = localFiles(text, slow);
  if (files) return playFiles(files, () => zhVoice ? speakWithVoice(text, rate) : noSound());
  if (zhVoice) return speakWithVoice(text, rate);
  const { files: pieces, missing } = pieceFiles(text);
  if (!pieces.length) return toast(VOICE_HELP, 7000);
  playFiles(pieces, noSound);
  if (missing && !warnedPieces) { warnedPieces = true; toast(VOICE_HELP, 7000); }
}

/* ================= Stroke data ================= */
const strokeCache = {};
function loadStrokes(c) {
  if (!strokeCache[c]) {
    // Chữ có sẵn trong bài: dùng dữ liệu nét đóng gói kèm app (chạy offline); chữ mới: lấy từ CDN
    const url = CHARS[c] ? `data/strokes/${c.codePointAt(0).toString(16)}.json`
      : 'https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/' + encodeURIComponent(c) + '.json';
    strokeCache[c] = fetch(url)
      .then(r => { if (!r.ok) throw new Error('no data'); return r.json(); })
      .catch(e => {
        if (!CHARS[c]) throw e;
        // Thiếu file nét cục bộ, hoặc mở bằng file:// (trình duyệt chặn đọc file) → lấy từ CDN
        return fetch('https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/' + encodeURIComponent(c) + '.json')
          .then(r => { if (!r.ok) throw new Error('no data'); return r.json(); });
      });
    strokeCache[c].catch(() => delete strokeCache[c]);
  }
  return strokeCache[c];
}
const charDataLoader = (c, onLoad, onError) => { loadStrokes(c).then(onLoad, onError); };
function makeWriter(el, c, opts = {}) {
  if (!el || !el.isConnected) return null;
  el.innerHTML = '';
  const size = Math.max(120, Math.floor(el.clientWidth || 280));
  return HanziWriter.create(el, c, Object.assign({
    width: size, height: size, padding: Math.round(size * 0.06),
    showOutline: true, strokeColor: cssVar('--ink') || '#222', outlineColor: cssVar('--line') || '#ddd',
    radicalColor: SETTINGS.rad ? (cssVar('--accent') || '#b5352a') : null,
    drawingColor: cssVar('--blue') || '#2b6cb0', highlightColor: cssVar('--gold') || '#b9832f',
    strokeAnimationSpeed: 1, delayBetweenStrokes: 220, drawingWidth: Math.max(14, size / 18), charDataLoader,
    onLoadCharDataError: () => { el.innerHTML = '<div class="muted" style="padding:20px;text-align:center">Không tải được dữ liệu nét viết (cần kết nối Internet).</div>'; },
  }, opts));
}
const GRID_SVG = '<g class="gridl"><rect x="8" y="8" width="1008" height="1008"/><line x1="0" y1="0" x2="1024" y2="1024"/><line x1="1024" y1="0" x2="0" y2="1024"/><line x1="512" y1="0" x2="512" y2="1024"/><line x1="0" y1="512" x2="1024" y2="512"/></g>';
async function renderSteps(c, el) {
  el.innerHTML = '<div class="muted">Đang tải nét…</div>';
  try {
    const d = await loadStrokes(c);
    let html = '';
    d.strokes.forEach((_, i) => {
      const paths = d.strokes.map((p, j) => `<path d="${p}" class="${j < i ? 'done' : j === i ? 'cur' : 'todo'}"/>`).join('');
      const m = d.medians[i][0];
      html += `<div class="step" title="Nét ${i + 1}"><svg viewBox="0 0 1024 1024">${GRID_SVG}<g transform="translate(0,900) scale(1,-1)">${paths}<circle cx="${m[0]}" cy="${m[1]}" r="42" class="start"/></g></svg><span>${i + 1}</span></div>`;
    });
    el.innerHTML = html;
    return d.strokes.length;
  } catch { el.innerHTML = '<div class="muted">Không tải được dữ liệu nét (cần Internet).</div>'; return 0; }
}

/* ================= Extra dictionary (for new texts) ================= */
let MMH = null, mmhPromise = null;
function loadMMH() {
  if (MMH) return Promise.resolve(MMH);
  if (!mmhPromise) {
    toast('Đang tải từ điển bổ sung (~2,5 MB)…');
    mmhPromise = fetch('https://cdn.jsdelivr.net/gh/skishore/makemeahanzi@master/dictionary.txt').then(r => r.text()).then(t => {
      MMH = {};
      t.split('\n').forEach(l => { if (!l) return; try { const o = JSON.parse(l); MMH[o.character] = o; } catch { } });
      return MMH;
    }).catch(e => { mmhPromise = null; toast('Không tải được từ điển bổ sung'); throw e; });
  }
  return mmhPromise;
}
const pyOf = c => CHARS[c]?.py || (MMH && MMH[c]?.pinyin?.[0]) || '';

/* ================= Segmentation & reader ================= */
function segment(text) {
  const arr = [...text], out = [];
  let i = 0;
  while (i < arr.length) {
    let w = null;
    for (let L = Math.min(MAXW, arr.length - i); L >= 2; L--) { const s = arr.slice(i, i + L).join(''); if (WORDMAP[s]) { w = WORDMAP[s]; break; } }
    if (w) { const L = [...w.w].length; out.push({ w, chars: arr.slice(i, i + L) }); i += L; }
    else { out.push({ c: arr[i] }); i++; }
  }
  return out;
}
function charSpan(c, py) {
  const d = CHARS[c];
  const hv = d ? d.hv.split('/')[0].toLowerCase() : '';
  const title = d ? `${d.hv} – ${short(d.m)}` : '';
  return `<span class="ch st-${status(c)}" data-c="${c}" title="${esc(title)}"><span class="py">${esc(py) || '&nbsp;'}</span><span class="hz">${c}</span><span class="hv">${esc(hv) || '&nbsp;'}</span></span>`;
}
function renderReader(text) {
  return segment(text).map(t => {
    if (t.w) return `<span class="wd" data-w="${t.w.w}" title="${esc(t.w.hv + ' – ' + t.w.m)}">${t.chars.map((c, k) => charSpan(c, t.w.py[k])).join('')}</span>`;
    if (isHan(t.c)) return charSpan(t.c, pyOf(t.c));
    if (/\s/.test(t.c)) return '<span class="pn"> </span>';
    return `<span class="pn">${esc(t.c)}</span>`;
  }).join('');
}
const lessonWords = l => [...new Map(segment(l.text).filter(t => t.w).map(t => [t.w.w, t.w])).values()];
const uniqHan = text => [...new Set([...text].filter(isHan))];
const firstLesson = c => (CHAR_LESSONS[c] || [99])[0];

function charCard(c, extra = '') {
  const d = CHARS[c];
  if (!d) return `<button class="card st-new" data-c="${c}"><span class="hz">${c}</span><span class="m">chưa có dữ liệu</span></button>`;
  return `<button class="card st-${status(c)}" data-c="${c}"><i class="dot"></i>${extra}<span class="hz">${c}</span><span class="hv">${esc(d.hv)}</span><span class="py">${esc(d.py)}</span><span class="m">${esc(short(d.m))}</span></button>`;
}
const wordCard = w => `<button class="wcard" data-w="${w.w}"><span class="hz">${w.w}</span><span class="py">${esc(w.py.join(' '))}</span> · <span class="hv">${esc(w.hv)}</span><span class="m">${esc(w.m)}</span></button>`;


/* ================= Grammar ================= */
const ROLES = {
  CN: ['Chủ ngữ', 'ai / cái gì'], V: ['Vị ngữ', 'làm gì / thế nào'], TN: ['Tân ngữ', 'đối tượng của động từ'],
  DN: ['Định ngữ', 'bổ nghĩa cho danh từ'], TR: ['Trạng ngữ', 'thời gian, nơi chốn, cách thức…'], BN: ['Bổ ngữ', 'bổ sung sau động từ'], LT: ['Liên từ', 'nối các vế câu'],
};
const GRAM = GRAMMAR.map(g => ({
  chunks: [...g.s.matchAll(/(\S+?)\[(\w+):([^\]]*)\]/g)].map(m => ({ t: m[1], r: m[2], g: m[3] })),
  notes: g.n.map(([p, title, ex]) => ({ p, title, ex })),
}));
GRAM.forEach((g, i) => { if (g.chunks.map(c => c.t).join('') !== LESSONS[i][0]) console.warn('Ngữ pháp không khớp câu', i + 1); });
const GRAM_INDEX = [];
{
  const byKey = {};
  GRAM.forEach((g, i) => g.notes.forEach(n => {
    let e = byKey[n.p];
    if (!e) { e = byKey[n.p] = { p: n.p, title: n.title, ex: n.ex, lessons: [] }; GRAM_INDEX.push(e); }
    if (n.ex.length > e.ex.length && !/^Lặp lại|^Gặp lại/.test(n.ex)) e.ex = n.ex;
    if (!e.lessons.includes(i)) e.lessons.push(i);
  }));
}
const hzText = s => esc(s).replace(/([\u3400-\u9fff\uf900-\ufaff][\u3400-\u9fff\uf900-\ufaff、，。；…─]*)/g, '<span class="hz">$1</span>');
const roleLegend = () => `<div class="g-legend">${Object.entries(ROLES).map(([k, [n, d]]) => `<span class="r-${k}" title="${esc(d)}"><i></i>${n}</span>`).join('')}</div>`;
function renderSentenceAnalysis(i) {
  const g = GRAM[i]; if (!g) return '';
  return `<div class="g-sent">${g.chunks.map(c => c.r === 'P'
    ? `<span class="g-p hz">${esc(c.t)}</span>`
    : `<div class="g-chunk r-${c.r}"><span class="g-t hz">${[...c.t].map(ch => isHan(ch) && CHARS[ch] ? `<span data-c="${ch}">${ch}</span>` : esc(ch)).join('')}</span><span class="g-r">${ROLES[c.r]?.[0] || c.r}</span><span class="g-g">${esc(c.g)}</span></div>`).join('')}</div>`;
}
const noteCard = (n, lessons) => `<div class="g-note"><div class="g-pat">${hzText(n.p)}</div><div class="g-title">${esc(n.title)}</div><div class="g-ex">${hzText(n.ex)}</div>${lessons && lessons.length ? `<div class="chips" style="margin-top:8px"><small style="align-self:center">Gặp ở:</small>${lessons.map(i => `<button class="chip" data-goto-lesson="${i}">Bài ${i + 1}</button>`).join('')}</div>` : ''}</div>`;
function renderGrammarPanel(i) {
  const g = GRAM[i]; if (!g) return '';
  return `<div class="panel" style="margin-top:16px">
    <h3 class="sec-title" style="margin-top:0">📐 Ngữ pháp câu này <small>phân tích thành phần câu – bấm vào chữ để xem chi tiết</small></h3>
    ${roleLegend()}
    ${renderSentenceAnalysis(i)}
    <h4 class="sec-title" style="font-size:15px">Điểm ngữ pháp (${g.notes.length})</h4>
    <div class="g-notes">${g.notes.map(n => noteCard(n, GRAM_INDEX.find(e => e.p === n.p).lessons.filter(x => x !== i))).join('')}</div>
  </div>`;
}

/* ================= Modal ================= */
const modalStack = [];
let activeWriter = null;
function openModal(view, push = true) {
  if (push) modalStack.push(view);
  $('#modal').hidden = false;
  $('#modalBack').style.visibility = modalStack.length > 1 ? 'visible' : 'hidden';
  activeWriter = null;
  if (view.type === 'char') renderCharView(view.c);
  else if (view.type === 'word') renderWordView(view.w);
  else if (view.type === 'comp') renderCompView(view.k);
  else if (view.type === 'help') renderVoiceHelp();
  else if (view.type === 'sent') renderSentView(view);
  $('.modal-panel').scrollTop = 0;
}
function closeModal() { $('#modal').hidden = true; modalStack.length = 0; activeWriter = null; if (!FT.mode) stopSpeech(); }
const openChar = c => openModal({ type: 'char', c });
const openWord = w => openModal({ type: 'word', w });
const openComp = k => openModal({ type: 'comp', k });

function compChip(k, cls = '') {
  const o = compInfo(k);
  const base = o.base ? ` · dạng của ${o.base}` : '';
  return `<button class="comp ${cls}" data-comp="${esc(k)}" title="Xem các chữ có thành phần này"><span class="hz">${esc(k)}</span><span><span class="cn">${esc(o.name || '—')}${o.no ? ` <small>(bộ ${o.no})</small>` : ''}</span><br><span class="cm">${esc(o.mean)}${esc(base)}</span></span></button>`;
}
function compChipSmall(k) {
  const o = compInfo(k);
  return `<button class="comp" data-comp="${esc(k)}"><span class="hz">${esc(k)}</span><span class="cn">${esc(o.name || '—')}</span><span class="cm">${esc(o.mean)}</span></button>`;
}

function renderCharView(c) {
  const d = CHARS[c];
  if (!d) return renderUnknownChar(c);
  $('#modalTitle').textContent = `Chữ ${c} · ${d.hv}`;
  const selfOnly = d.parts.length === 0 || (d.parts.length === 1 && d.parts[0] === c);
  const formula = selfOnly
    ? `<div class="muted">Chữ độc thể – không tách thành các bộ nhỏ hơn. Hãy nhớ theo hình vẽ gốc bên dưới.</div>`
    : `<div class="formula">${d.parts.map(compChipSmall).join('<span class="op">+</span>')}<span class="op">=</span><span class="res">${c}</span></div>`;
  const words = (CHAR_WORDS[c] || []);
  const lessons = (CHAR_LESSONS[c] || []);
  const st = status(c);
  const idx = d.idx;
  $('#modalBody').innerHTML = `
  <div class="cd">
    <div class="cd-left">
      <div class="writer-box" id="cdWriter"></div>
      <div class="btn-row">
        <button class="btn" data-act="anim">▶ Viết mẫu</button>
        <button class="btn" data-act="quiz">✍️ Tự viết</button>
        <button class="btn ${SETTINGS.rad ? 'on' : ''}" data-act="rad" title="Tô màu đỏ phần bộ thủ">Tô bộ thủ</button>
      </div>
      <div class="quiz-msg" id="cdMsg">Bấm “Tự viết” rồi dùng chuột/ngón tay viết vào ô.</div>
    </div>
    <div class="cd-right">
      <div class="cd-head">
        <div class="cd-hz">${c}</div>
        <div>
          <div class="cd-hv">${esc(d.hv)}</div>
          <div class="cd-py">${esc(d.py)} <button class="icon" data-say="${c}" title="Nghe">🔊</button></div>
          ${d.sc ? `<div class="cd-sc">Giản thể: <b class="hz">${d.sc}</b></div>` : `<div class="cd-sc">Phồn thể = giản thể</div>`}
          <div class="cd-strokes" id="cdStrokes">&nbsp;</div>
        </div>
      </div>
      <div class="cd-mean">${esc(d.m)}</div>
      <h4>Bộ thủ (tra từ điển)</h4>
      ${compChip(d.rad, 'rad')}
      <h4>Cấu tạo <span class="badge t-${d.type}">${TYPE_NAMES[d.type][0]}</span><small>${TYPE_NAMES[d.type][1]}</small></h4>
      ${formula}
      <div class="ex">💡 ${esc(d.ex)}</div>
      ${words.length ? `<h4>Từ ghép trong bài (${words.length})</h4><div class="chips">${words.map(w => `<button class="chip" data-w="${w.w}"><span class="hz">${w.w}</span>${esc(w.hv)}</button>`).join('')}</div>` : ''}
      ${lessons.length ? `<h4>Xuất hiện ở bài</h4><div class="chips">${lessons.map(i => `<button class="chip" data-goto-lesson="${i}">Bài ${i + 1}</button>`).join('')}</div>` : ''}
      <h4>Mức độ thuộc</h4>
      <div class="status-row">
        <button class="btn ${st === 'new' ? 'sel-new' : ''}" data-status="new">Chưa học</button>
        <button class="btn ${st === 'learning' ? 'sel-learning' : ''}" data-status="learning">Đang học</button>
        <button class="btn ${st === 'known' ? 'sel-known' : ''}" data-status="known">Đã thuộc ✓</button>
      </div>
      <h4>Ghi chú / mẹo nhớ của bạn</h4>
      <textarea class="note" id="cdNote" placeholder="Viết câu chuyện giúp bạn nhớ chữ này…">${esc(NOTES[c] || '')}</textarea>
    </div>
  </div>
  <h4 style="margin:22px 0 10px;font-size:13px;text-transform:uppercase;letter-spacing:.6px;color:var(--muted)">Thứ tự nét viết <small style="text-transform:none">(chấm vàng = điểm đặt bút)</small></h4>
  <div class="steps" id="cdSteps"></div>
  <div class="cd-nav">
    <button class="btn" data-nav="${idx - 1}" ${idx === 0 ? 'disabled' : ''}>‹ ${idx > 0 ? CHAR_LIST[idx - 1].c : ''} Chữ trước</button>
    <button class="btn" data-nav="${idx + 1}" ${idx === CHAR_LIST.length - 1 ? 'disabled' : ''}>Chữ sau ${idx < CHAR_LIST.length - 1 ? CHAR_LIST[idx + 1].c : ''} ›</button>
  </div>`;
  $('#cdNote').addEventListener('input', e => { const v = e.target.value.trim(); if (v) NOTES[c] = v; else delete NOTES[c]; store.set('notes', NOTES); });
  setupWriterPanel(c, $('#cdWriter'), $('#cdMsg'));
  renderSteps(c, $('#cdSteps')).then(n => { const el = $('#cdStrokes'); if (el && n) el.textContent = `Số nét: ${n}`; });
}

function setupWriterPanel(c, box, msg) {
  requestAnimationFrame(() => {
    activeWriter = makeWriter(box, c);
    activeWriter?.animateCharacter();
  });
  box.closest('.cd-left, .write-main, .cd').querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
    const act = b.dataset.act;
    if (act === 'anim') { msg.className = 'quiz-msg'; msg.textContent = 'Xem viết mẫu…'; activeWriter = makeWriter(box, c); activeWriter.animateCharacter({ onComplete: () => msg.textContent = 'Xong! Thử tự viết nhé.' }); }
    if (act === 'rad') { SETTINGS.rad = !SETTINGS.rad; saveSettings(); b.classList.toggle('on', SETTINGS.rad); activeWriter = makeWriter(box, c); activeWriter.showCharacter(); }
    if (act === 'quiz') startQuiz(c, box, msg, true);
    if (act === 'blind') startQuiz(c, box, msg, false);
  });
}
function startQuiz(c, box, msg, outline, done) {
  activeWriter = makeWriter(box, c, { showCharacter: false, showOutline: outline });
  if (!activeWriter) return;
  let mistakes = 0;
  msg.className = 'quiz-msg'; msg.textContent = outline ? 'Viết theo nét mờ, đúng thứ tự nét…' : 'Viết từ trí nhớ (sai 3 lần sẽ có gợi ý)…';
  activeWriter.quiz({
    showHintAfterMisses: 3,
    onMistake: s => { mistakes++; msg.className = 'quiz-msg bad'; msg.textContent = `Chưa đúng nét ${s.strokeNum + 1} – thử lại (${mistakes} lỗi)`; },
    onCorrectStroke: s => { msg.className = 'quiz-msg'; msg.textContent = `✓ Nét ${s.strokeNum + 1}/${s.strokeNum + 1 + s.strokesRemaining}`; },
    onComplete: s => {
      msg.className = 'quiz-msg ok';
      msg.textContent = s.totalMistakes === 0 ? '🎉 Tuyệt vời! Không sai nét nào.' : `Hoàn thành với ${s.totalMistakes} lỗi.`;
      done && done(s.totalMistakes);
    },
  });
}

async function renderUnknownChar(c) {
  $('#modalTitle').textContent = `Chữ ${c}`;
  $('#modalBody').innerHTML = `<div class="cd"><div class="cd-left"><div class="writer-box" id="cdWriter"></div>
    <div class="btn-row"><button class="btn" data-act="anim">▶ Viết mẫu</button><button class="btn" data-act="quiz">✍️ Tự viết</button></div>
    <div class="quiz-msg" id="cdMsg"></div></div>
    <div class="cd-right"><div class="cd-head"><div class="cd-hz">${c}</div><div><div class="cd-py" id="ukPy">…</div><button class="icon" data-say="${c}">🔊</button><div class="cd-strokes" id="cdStrokes"></div></div></div>
    <div class="ex" style="background:var(--gold-soft)">Chữ này chưa có trong bộ dữ liệu tiếng Việt của bài. Thông tin dưới đây lấy từ từ điển Make Me a Hanzi (tiếng Anh).</div>
    <div id="ukInfo" class="muted" style="margin-top:12px">Đang tải…</div></div></div>
    <h4 style="margin:22px 0 10px">Thứ tự nét viết</h4><div class="steps" id="cdSteps"></div>`;
  setupWriterPanel(c, $('#cdWriter'), $('#cdMsg'));
  renderSteps(c, $('#cdSteps')).then(n => { if (n && $('#cdStrokes')) $('#cdStrokes').textContent = `Số nét: ${n}`; });
  try {
    const dict = await loadMMH(); const o = dict[c];
    if (!$('#ukInfo')) return;
    if (!o) { $('#ukInfo').textContent = 'Không tìm thấy trong từ điển.'; return; }
    $('#ukPy').textContent = (o.pinyin || []).join(', ');
    const et = o.etymology || {};
    const etType = { pictographic: 'Tượng hình', ideographic: 'Hội ý', pictophonetic: 'Hình thanh' }[et.type] || '';
    const parts = [...(o.decomposition || '')].filter(x => isHan(x) || COMPS[x]);
    $('#ukInfo').innerHTML = `
      <div class="cd-mean">${esc(o.definition || '')} <small>(EN)</small></div>
      <h4>Bộ thủ</h4>${compChip(o.radical, 'rad')}
      ${parts.length ? `<h4>Cấu tạo ${etType ? `<span class="badge t-${{ 'Tượng hình': 'TH', 'Hội ý': 'HY', 'Hình thanh': 'HT' }[etType]}">${etType}</span>` : ''}</h4><div class="formula">${parts.map(compChipSmall).join('<span class="op">+</span>')}<span class="op">=</span><span class="res">${c}</span></div>` : ''}
      ${et.type === 'pictophonetic' ? `<div class="ex">Phần chỉ nghĩa: <b class="hz">${esc(et.semantic || '?')}</b> · Phần gợi âm: <b class="hz">${esc(et.phonetic || '?')}</b>${et.hint ? `<br><small>${esc(et.hint)}</small>` : ''}</div>` : et.hint ? `<div class="ex">${esc(et.hint)} <small>(EN)</small></div>` : ''}`;
  } catch { if ($('#ukInfo')) $('#ukInfo').textContent = 'Không tải được từ điển bổ sung.'; }
}

function renderWordView(wk) {
  const w = WORDMAP[wk];
  $('#modalTitle').textContent = `Từ ${wk}`;
  const chars = [...wk];
  const lessons = LESSON_LIST.filter(l => l.text.includes(wk));
  const explain = chars.map(c => CHARS[c] ? `<b class="hz">${c}</b> <b>${esc(CHARS[c].hv.split('/')[0])}</b> (${esc(short(CHARS[c].m))})` : c).join(' + ');
  $('#modalBody').innerHTML = `
    <div class="word-head"><span class="hz">${wk}</span><div>
      <div class="cd-py">${esc(w.py.join(' '))} <button class="icon" data-say="${wk}">🔊</button></div>
      <div class="cd-hv" style="text-transform:capitalize">${esc(w.hv)}</div></div></div>
    <div class="cd-mean">${esc(w.m)}</div>
    <h4 class="sec-title">Hiểu từ qua từng chữ</h4>
    <div class="ex">${explain} <br>→ <b class="hz">${wk}</b> <b style="text-transform:capitalize">${esc(w.hv)}</b>: ${esc(w.m)}</div>
    <div class="word-break" style="margin-top:14px">${chars.map(c => charCard(c)).join('')}</div>
    ${lessons.length ? `<h4 class="sec-title">Có trong bài</h4><div class="chips">${lessons.map(l => `<button class="chip" data-goto-lesson="${l.i}">Bài ${l.i + 1}</button>`).join('')}</div>` : ''}`;
}

function renderCompView(k) {
  const o = compInfo(k), b = compBase(k);
  const variants = Object.values(COMPS).filter(x => x.c !== k && (x.base === b || x.c === b)).map(x => x.c);
  const list = COMP_INDEX[b] || [];
  $('#modalTitle').textContent = `Thành phần ${k}`;
  $('#modalBody').innerHTML = `
    <div class="word-head"><span class="hz">${esc(k)}</span><div>
      <div class="cd-hv">${esc(o.name || '—')}</div>
      <div>${esc(o.mean)}</div>
      ${o.no ? `<small>Bộ thủ số ${o.no} trong 214 bộ Khang Hy</small>` : '<small>Thành phần (không phải bộ thủ độc lập)</small>'}
      ${variants.length ? `<div style="margin-top:6px">Dạng liên quan: ${variants.map(v => `<button class="chip" data-comp="${v}"><span class="hz">${v}</span>${esc(COMPS[v]?.name || '')}</button>`).join(' ')}</div>` : ''}
      ${CHARS[k] ? `<div style="margin-top:8px"><button class="btn" data-c="${k}">Xem chữ ${k} chi tiết</button></div>` : ''}
    </div></div>
    <h4 class="sec-title">Các chữ trong bài có thành phần này (${list.length})</h4>
    <div class="char-grid">${list.map(c => charCard(c)).join('') || '<span class="muted">Không có.</span>'}</div>`;
}

/* ================= Tabs ================= */
const renderers = {};
let currentTab = 'text';
function showTab(tab) {
  if (FT.mode && tab !== 'text') stopSpeech();
  currentTab = tab;
  $$('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tab').forEach(s => s.classList.toggle('active', s.id === 'tab-' + tab));
  renderers[tab]?.();
  window.scrollTo({ top: 0 });
}

/* ---------- Lessons ---------- */
renderers.lessons = () => {
  const i = Math.min(SETTINGS.lesson, LESSON_LIST.length - 1);
  const l = LESSON_LIST[i];
  const doneCount = Object.keys(DONE).length;
  const chars = uniqHan(l.text);
  const words = lessonWords(l);
  const newChars = chars.filter(c => firstLesson(c) === i);
  const pct = ls => { const cs = uniqHan(ls.text); return Math.round(100 * cs.filter(c => status(c) === 'known').length / cs.length); };
  $('#tab-lessons').innerHTML = `
  <div class="lesson-layout">
    <aside class="panel ls-list">
      <div class="ls-progress">Đã học ${doneCount}/${LESSON_LIST.length} bài<div class="bar"><i style="width:${100 * doneCount / LESSON_LIST.length}%"></i></div></div>
      ${LESSON_LIST.map(x => `<button class="ls-item ${x.i === i ? 'active' : ''} ${DONE[x.i] ? 'done' : ''}" data-lesson="${x.i}"><span class="n">${x.i + 1}</span><span class="t hz">${esc(x.text.slice(0, 12))}</span><span class="pct">${pct(x)}%</span></button>`).join('')}
    </aside>
    <div>
      <div class="panel">
        <div class="lesson-head">
          <h2>Bài ${i + 1}<small>/ ${LESSON_LIST.length}</small></h2>
          <div class="btn-row">
            <button class="btn" data-say-text="${i}">🔊 Nghe cả câu</button>
            <button class="btn" data-say-text="${i}" data-slow>🐢 Đọc chậm</button>
            <button class="btn" data-review-lesson="${i}">🃏 Ôn chữ của bài</button>
            <button class="btn" data-write-lesson="${i}">✍️ Luyện viết</button>
          </div>
        </div>
        <div class="reader big">${renderReader(l.text)}</div>
        <div class="vi ${SETTINGS.vi ? '' : 'blur'}" id="viBox" title="Bấm để ẩn/hiện bản dịch"><span class="lbl">BẢN DỊCH (bấm để ẩn/hiện)</span>${esc(l.viOff)}<div class="vi-lit"><b>Dịch sát từng chữ:</b> ${esc(l.vi)}</div></div>
      </div>
      ${renderGrammarPanel(i)}
      <h3 class="sec-title">Từ vựng trong câu <small>${words.length} từ – bấm để xem cách ghép nghĩa</small></h3>
      <div class="word-grid">${words.map(wordCard).join('')}</div>
      <h3 class="sec-title">Chữ Hán trong câu <small>${chars.length} chữ · ${newChars.length} chữ mới</small></h3>
      <div class="char-grid">${chars.map(c => charCard(c, firstLesson(c) === i ? '<i class="new">mới</i>' : '')).join('')}</div>
      <div class="lesson-nav">
        <button class="btn" data-lesson="${i - 1}" ${i === 0 ? 'disabled' : ''}>‹ Bài trước</button>
        <button class="btn ${DONE[i] ? 'on' : 'primary'}" id="btnDone">${DONE[i] ? '✓ Đã học xong' : 'Đánh dấu đã học xong'}</button>
        <button class="btn" data-lesson="${i + 1}" ${i === LESSON_LIST.length - 1 ? 'disabled' : ''}>Bài sau ›</button>
      </div>
    </div>
  </div>`;
  $('#viBox').onclick = () => { SETTINGS.vi = !SETTINGS.vi; saveSettings(); $('#viBox').classList.toggle('blur', !SETTINGS.vi); };
  $('#btnDone').onclick = () => {
    if (DONE[i]) delete DONE[i]; else { DONE[i] = Date.now(); newChars.forEach(c => { if (!SRS[c]) setStatus(c, 'learning'); }); toast(`Đã thêm ${newChars.length} chữ mới vào danh sách ôn tập`); }
    store.set('done', DONE); renderers.lessons();
  };
};
function gotoLesson(i) { SETTINGS.lesson = i; saveSettings(); closeModal(); showTab('lessons'); }

/* ---------- Full text ---------- */
const pill = (key, label) => `<button class="pill ${SETTINGS[key] ? 'on' : ''}" data-pill="${key}" aria-pressed="${!!SETTINGS[key]}">${label}</button>`;
function setToggle(key, on) {
  SETTINGS[key] = on; saveSettings(); applyToggles();
  if (key === 'py') $('#tglPy').checked = on;
  if (key === 'hv') $('#tglHv').checked = on;
  $$(`[data-pill="${key}"]`).forEach(b => { b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
}
renderers.text = () => {
  $('#tab-text').innerHTML = `
    <div class="tx-head">
      <div><h2><span class="hz">論語</span> <small>Luận ngữ</small></h2>
        <p class="tx-hint">👆 Chạm vào một câu để xem ngữ pháp, cách ghép chữ và tập viết.</p></div>
      <div class="tx-tools">
        <div class="pills">${pill('py', 'Pinyin')}${pill('hv', 'Hán Việt')}${pill('viOn', 'Tiếng Việt')}</div>
        <div class="btn-row">
          <button class="btn ft-btn" data-ft="normal"></button>
          <button class="btn ft-btn" data-ft="slow"></button>
        </div>
      </div>
    </div>
    ${PARAS.map(([a, b]) => `<div class="tx-para">${LESSON_LIST.slice(a, b + 1).map(l => `
      <div class="sent" data-sent="${l.i}" role="button" tabindex="0" aria-label="Câu ${l.i + 1}">
        <span class="sent-n">${l.i + 1}</span>
        <div class="sent-body"><div class="reader">${renderReader(l.text)}</div><div class="sent-vi">${esc(l.viOff)}</div></div>
      </div>`).join('')}</div>`).join('')}
    <p class="tx-src">Bản dịch tiếng Việt: <a href="${esc(window.VI_SOURCE || '#')}" target="_blank" rel="noopener">vi.falundafa.org</a></p>`;
  ftUI();
};

/* Nghe toàn bài: bấm 1 lần = đọc, bấm lần nữa = tạm dừng, bấm tiếp = nghe tiếp */
const FT = { mode: null, idx: 0, paused: false, token: 0 };
const FT_LABEL = { normal: ['🔊 Nghe toàn bài', '⏸ Tạm dừng', '▶ Nghe tiếp'], slow: ['🐢 Nghe chậm', '⏸ Tạm dừng', '▶ Nghe tiếp'] };
function ftUI() {
  $$('[data-ft]').forEach(b => {
    const m = b.dataset.ft, active = FT.mode === m;
    b.textContent = FT_LABEL[m][!active ? 0 : FT.paused ? 2 : 1];
    b.classList.toggle('on', active);
  });
  $$('.sent.playing').forEach(el => el.classList.remove('playing'));
  if (FT.mode) $(`.sent[data-sent="${FT.idx}"]`)?.classList.add('playing');
}
function ftReset() { if (!FT.mode) return; FT.mode = null; FT.paused = false; ftUI(); }
function ftPlay(i) {
  const token = FT.token;
  if (i >= LESSONS.length) { ftReset(); return; }
  FT.idx = i; ftUI();
  const el = $(`.sent[data-sent="${i}"]`);
  if (el && currentTab === 'text' && $('#modal').hidden) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  audioSrc(`audio/s${i}${FT.mode === 'slow' ? '-slow' : ''}.mp3`).then(src => {
    if (token !== FT.token || token !== playToken) return;
    player.src = src;
    player.onended = () => { if (token === FT.token && token === playToken) ftPlay(i + 1); };
    player.onerror = () => { if (token === FT.token) { ftReset(); toast('Không phát được âm thanh. Kiểm tra mạng và âm lượng.'); } };
    if (!FT.paused) player.play()?.catch?.(err => { if (err.name !== 'AbortError' && token === FT.token) { ftReset(); toast('Không phát được âm thanh. Kiểm tra âm lượng (iPhone: tắt chế độ im lặng).'); } });
  }, () => { if (token === FT.token) { ftReset(); toast('Không tải được âm thanh (cần mạng lần đầu).'); } });
}
function ftToggle(mode) {
  if (FT.mode === mode) {
    FT.paused = !FT.paused;
    if (FT.paused) player.pause(); else player.play()?.catch?.(() => {});
    ftUI(); return;
  }
  stopSpeech();                                   // dừng mọi âm thanh khác (cũng reset FT cũ)
  try { player.src = SILENT; player.play()?.catch?.(() => {}); } catch (e) {}   // mở khóa âm thanh trên iOS
  FT.mode = mode; FT.paused = false; FT.token = playToken;
  ftPlay(0);
}
const openSent = (i, tab = 'gram') => openModal({ type: 'sent', i, tab, wc: 0 });

/* ---------- Sentence popup ---------- */
const SENT_TABS = [['gram', '📐 Ngữ pháp'], ['words', '🧩 Từ & chữ'], ['write', '✍️ Tập viết']];
function renderSentView(v) {
  const i = v.i, l = LESSON_LIST[i], last = LESSON_LIST.length - 1;
  $('#modalTitle').textContent = `Câu ${i + 1} / ${LESSON_LIST.length}`;
  $('#modalBody').innerHTML = `
    <div class="sv-top">
      <div class="reader sv-reader">${renderReader(l.text)}</div>
      <div class="sv-vi">${esc(l.viOff)}</div>
      <div class="sv-actions">
        <button class="btn" data-say-text="${i}">🔊 Nghe</button>
        <button class="btn" data-say-text="${i}" data-slow>🐢 Chậm</button>
        <span class="sp"></span>
        <button class="btn nav" data-sv-nav="${i - 1}" ${i === 0 ? 'disabled' : ''} title="Câu trước">‹</button>
        <button class="btn nav" data-sv-nav="${i + 1}" ${i === last ? 'disabled' : ''} title="Câu sau">›</button>
      </div>
    </div>
    <div class="seg" role="tablist">${SENT_TABS.map(([k, n]) => `<button role="tab" class="${v.tab === k ? 'on' : ''}" data-sv-tab="${k}">${n}</button>`).join('')}</div>
    <div id="svPane"></div>`;
  drawSentPane(v);
}
// Các từ / chữ của câu theo thứ tự xuất hiện (không lặp)
function sentUnits(text) {
  const seen = new Set(), out = [];
  for (const t of segment(text)) {
    const k = t.w ? t.w.w : t.c;
    if (!k || seen.has(k) || !(t.w || CHARS[t.c])) continue;
    seen.add(k); out.push(k);
  }
  return out;
}
function snippet(text, key, r = 7) {
  const p = text.indexOf(key); if (p < 0) return esc(text);
  const a = Math.max(0, p - r), b = Math.min(text.length, p + key.length + r);
  return (a > 0 ? '…' : '') + esc(text.slice(a, p)) + `<mark>${esc(key)}</mark>` + esc(text.slice(p + key.length, b)) + (b < text.length ? '…' : '');
}
const isSelfOnly = (d, c) => !d.parts.length || (d.parts.length === 1 && d.parts[0] === c);
function unitItem(k, i) {
  const w = WORDMAP[k], chars = [...k], d1 = chars.length === 1 ? CHARS[k] : null;
  const py = w ? w.py.join(' ') : d1.py, hv = w ? w.hv : d1.hv, m = w ? w.m : d1.m;
  const glue = w ? `<div class="wi-sum">${chars.map(c => CHARS[c] ? `<b class="hz">${c}</b> ${esc(CHARS[c].hv.split('/')[0])} <small>(${esc(short(CHARS[c].m))})</small>` : `<b class="hz">${c}</b>`).join(' <span class="op">+</span> ')}
      <div class="wi-res">→ <b class="hz">${k}</b> <b class="cap">${esc(hv)}</b>: ${esc(m)}</div></div>` : '';
  const charRows = chars.filter(c => CHARS[c]).map(c => {
    const d = CHARS[c];
    const parts = isSelfOnly(d, c) ? '<div class="muted small">Chữ độc thể (không tách thành bộ nhỏ hơn)</div>' : `<div class="formula sm">${d.parts.map(compChipSmall).join('<span class="op">+</span>')}</div>`;
    if (d1) return `<div class="wi-one">${parts}<div class="wi-ex">💡 ${esc(d.ex)}</div><button class="link" data-c="${c}">Xem chi tiết chữ ${c} ›</button></div>`;
    return `<div class="wi-ch">
      <button class="big" data-c="${c}" title="Xem chi tiết chữ">${c}</button>
      <div><div class="wi-chhead"><b>${esc(d.hv)}</b> <span class="wi-py">${esc(d.py)}</span> · ${esc(short(d.m))}</div>
        ${parts}<div class="wi-ex">💡 ${esc(d.ex)}</div></div></div>`;
  }).join('');
  const others = LESSON_LIST.filter(l => l.i !== i && l.text.includes(k)).slice(0, 4);
  const moreWords = d1 ? (CHAR_WORDS[k] || []).slice(0, 6) : [];
  const uses = others.length || moreWords.length ? `<div class="wi-uses"><div class="sv-h sm">Gặp ở chỗ khác</div>
      ${others.map(l => `<button class="use" data-sv-nav="${l.i}"><span class="use-n">Câu ${l.i + 1}</span><span class="hz">${snippet(l.text, k)}</span></button>`).join('')}
      ${moreWords.length ? `<div class="chips" style="margin-top:6px">${moreWords.map(x => `<button class="chip" data-w="${x.w}"><span class="hz">${x.w}</span>${esc(x.hv)}</button>`).join('')}</div>` : ''}</div>` : '';
  return `<details class="wi">
    <summary><span class="wi-hz">${k}</span><span class="wi-top"><span class="wi-py">${esc(py)}</span><b class="cap">${esc(hv)}</b><button class="icon" data-say="${k}" title="Nghe">🔊</button></span><span class="wi-m">${esc(short(m))}</span></summary>
    <div class="wi-body">${glue}${charRows}${uses}</div></details>`;
}
function drawSentPane(v) {
  const pane = $('#svPane'); if (!pane) return;
  const i = v.i, l = LESSON_LIST[i], g = GRAM[i];
  if (v.tab === 'gram') {
    pane.innerHTML = !g ? '<p class="muted">Chưa có phân tích.</p>' : `
      <p class="sv-lead">Câu được chia thành các <b>cụm từ</b>. Màu cho biết vai trò của cụm trong câu; dòng chữ nhỏ là nghĩa của cụm.</p>
      ${roleLegend()}
      ${renderSentenceAnalysis(i)}
      <div class="sv-h">Điểm ngữ pháp (${g.notes.length})</div>
      <div class="sv-notes">${g.notes.map(n => {
        const seen = GRAM_INDEX.find(e => e.p === n.p).lessons.filter(x => x !== i);
        return `<div class="g-note"><div class="g-pat">${hzText(n.p)}</div><div class="g-title">${esc(n.title)}</div><div class="g-ex">${hzText(n.ex)}</div>
          ${seen.length ? `<div class="sv-seen">Cũng gặp ở: ${seen.map(x => `<button class="chip" data-sv-nav="${x}">Câu ${x + 1}</button>`).join('')}</div>` : ''}</div>`;
      }).join('')}</div>`;
  } else if (v.tab === 'words') {
    const units = sentUnits(l.text);
    pane.innerHTML = `<p class="sv-lead">${units.length} từ/chữ theo thứ tự trong câu. Chạm vào từng dòng để xem nghĩa được ghép từ các bộ thế nào và ví dụ ở câu khác.</p>
      <div class="wi-list">${units.map(k => unitItem(k, i)).join('')}</div>
      <details class="vi-lit-box"><summary>Xem bản dịch sát từng chữ</summary><p>${esc(l.vi)}</p></details>`;
    pane.querySelector('details.wi')?.setAttribute('open', '');
  } else {
    const chars = uniqHan(l.text).filter(c => CHARS[c]);
    const k = Math.max(0, Math.min(v.wc || 0, chars.length - 1)), c = chars[k], d = CHARS[c];
    pane.innerHTML = `
      <p class="sv-lead">Chọn chữ để luyện (${chars.length} chữ trong câu):</p>
      <div class="chips sv-chars">${chars.map((x, j) => `<button class="chip ${j === k ? 'on' : ''} st-${status(x)}" data-sv-wc="${j}"><span class="hz">${x}</span></button>`).join('')}</div>
      <div class="sv-wgrid">
        <div class="cd-left">
          <div class="writer-box" id="svWriter"></div>
          <div class="btn-row">
            <button class="btn" data-act="anim">▶ Viết mẫu</button>
            <button class="btn" data-act="quiz">✍️ Tự viết</button>
            <button class="btn" data-act="blind" title="Không có nét mờ gợi ý">🙈 Viết nhớ</button>
          </div>
          <div class="quiz-msg" id="svMsg">Bấm “Tự viết” rồi viết bằng ngón tay/chuột vào ô.</div>
        </div>
        <div class="sv-winfo">
          <div class="cd-head"><div class="cd-hz">${c}</div><div>
            <div class="cd-hv">${esc(d.hv)}</div>
            <div class="cd-py">${esc(d.py)} <button class="icon" data-say="${c}" title="Nghe">🔊</button></div>
            <div class="cd-strokes" id="svStrokes">&nbsp;</div></div></div>
          <div class="cd-mean">${esc(d.m)}</div>
          ${isSelfOnly(d, c) ? '' : `<div class="formula sm" style="margin-top:10px">${d.parts.map(compChipSmall).join('<span class="op">+</span>')}<span class="op">=</span><span class="res">${c}</span></div>`}
          <div class="btn-row" style="margin-top:14px">
            <button class="btn" data-sv-wc="${k - 1}" ${k === 0 ? 'disabled' : ''}>‹ Chữ trước</button>
            <button class="btn" data-sv-wc="${k + 1}" ${k === chars.length - 1 ? 'disabled' : ''}>Chữ sau ›</button>
            <button class="btn" data-c="${c}">Chi tiết chữ</button>
          </div>
        </div>
      </div>
      <div class="sv-h">Thứ tự nét <small>(chấm vàng = điểm đặt bút)</small></div>
      <div class="steps" id="svSteps"></div>`;
    setupWriterPanel(c, $('#svWriter'), $('#svMsg'));
    renderSteps(c, $('#svSteps')).then(n => { const el = $('#svStrokes'); if (el && n) el.textContent = `Số nét: ${n}`; });
  }
}

/* ---------- Chars ---------- */
let charFilter = { q: '', st: 'all', sort: 'order' };
renderers.chars = () => {
  if (!$('#charGrid')) {
    $('#tab-chars').innerHTML = `
      <div class="toolbar">
        <input type="search" id="charQ" placeholder="Tìm theo chữ, Hán Việt, pinyin, nghĩa… (vd: phap, fa, luật)">
        <select id="charSt"><option value="all">Tất cả</option><option value="new">Chưa học</option><option value="learning">Đang học</option><option value="known">Đã thuộc</option><option value="due">Cần ôn hôm nay</option></select>
        <select id="charSort"><option value="order">Theo thứ tự trong bài</option><option value="hv">Theo Hán Việt (A–Z)</option><option value="rad">Theo bộ thủ</option></select>
        <span class="legend"><span><i style="background:var(--line)"></i>chưa học</span><span><i style="background:var(--gold)"></i>đang học</span><span><i style="background:var(--green)"></i>đã thuộc</span></span>
      </div>
      <div id="charCount" class="muted" style="margin-bottom:10px"></div>
      <div class="char-grid" id="charGrid"></div>`;
    $('#charQ').oninput = e => { charFilter.q = e.target.value; drawChars(); };
    $('#charSt').onchange = e => { charFilter.st = e.target.value; drawChars(); };
    $('#charSort').onchange = e => { charFilter.sort = e.target.value; drawChars(); };
  }
  drawChars();
};
function drawChars() {
  const q = fold(charFilter.q.trim());
  let list = CHAR_LIST.filter(o => {
    if (charFilter.st === 'due' ? !isDue(o.c) : (charFilter.st !== 'all' && status(o.c) !== charFilter.st)) return false;
    if (!q) return true;
    return o.c === charFilter.q.trim() || fold(o.hv).includes(q) || fold(o.py).replace(/\s/g, '').includes(q.replace(/\s/g, '')) || fold(o.m).includes(q) || (o.sc && o.sc === charFilter.q.trim());
  });
  if (charFilter.sort === 'hv') list = [...list].sort((a, b) => a.hv.localeCompare(b.hv, 'vi'));
  if (charFilter.sort === 'rad') list = [...list].sort((a, b) => (compInfo(a.rad).no || 999) - (compInfo(b.rad).no || 999) || a.idx - b.idx);
  $('#charCount').textContent = `${list.length} chữ`;
  $('#charGrid').innerHTML = list.map(o => charCard(o.c)).join('');
}

/* ---------- Radicals ---------- */
renderers.radicals = () => {
  const groups = {};
  CHAR_LIST.forEach(o => (groups[o.rad] ||= []).push(o.c));
  const rads = Object.keys(groups).sort((a, b) => (compInfo(a).no || 999) - (compInfo(b).no || 999));
  const compCount = {};
  CHAR_LIST.forEach(o => new Set(o.parts.filter(p => p !== o.c).map(compBase)).forEach(k => compCount[k] = (compCount[k] || 0) + 1));
  const common = Object.entries(compCount).filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]);
  const radCard = (k, chars, label) => {
    const o = compInfo(k);
    const vars = Object.values(COMPS).filter(x => x.base === k).map(x => x.c).join(' ');
    return `<button class="rad-card" data-comp="${esc(k)}"><span class="big hz">${esc(k)}</span><span>
      <span class="name">${esc(o.name)}</span> ${vars ? `<span class="hz muted">(${vars})</span>` : ''}<br>
      <span class="mean">${esc(o.mean)}</span><br>
      <span class="no">${o.no ? `Bộ số ${o.no} · ` : ''}${label}</span>
      <div class="list hz">${chars.join('')}</div></span></button>`;
  };
  $('#tab-radicals').innerHTML = `
    <div class="panel" style="margin-bottom:16px"><b>Mẹo:</b> Phần lớn chữ Hán là chữ <b>hình thanh</b>: một bộ chỉ <i>nghĩa</i> (thường ở bên trái hoặc phía trên) + một phần gợi <i>âm đọc</i>.
      Nhớ được khoảng 50 bộ thủ hay gặp là bạn đoán được nghĩa của rất nhiều chữ. Ví dụ: chữ có <span class="hz">氵</span> thường liên quan đến nước, <span class="hz">扌</span> đến tay, <span class="hz">言</span> đến lời nói, <span class="hz">辶</span> đến việc đi lại.</div>
    <h3 class="sec-title">Bộ thủ của 250 chữ trong bài <small>${rads.length} bộ – xếp theo số thứ tự Khang Hy</small></h3>
    <div class="rad-grid">${rads.map(k => radCard(k, groups[k], `${groups[k].length} chữ`)).join('')}</div>
    <h3 class="sec-title">Thành phần hay gặp nhất <small>xuất hiện trong ≥ 3 chữ</small></h3>
    <div class="rad-grid">${common.map(([k, n]) => radCard(k, (COMP_INDEX[k] || []), `có trong ${n} chữ`)).join('')}</div>`;
};


/* ---------- Grammar index ---------- */
let gramQ = '';
renderers.grammar = () => {
  if (!$('#gramList')) {
    $('#tab-grammar').innerHTML = `
      <div class="panel" style="margin-bottom:16px"><h2>Ngữ pháp trong bài <small>${GRAM_INDEX.length} điểm ngữ pháp từ 20 câu</small></h2>
        <p class="muted" style="margin:6px 0 10px">Ba điểm khác biệt lớn nhất so với tiếng Việt: <b>(1)</b> phần bổ nghĩa đứng <b>trước</b> danh từ (<span class="hz">創世主的智慧</span> = trí tuệ của Đấng Sáng Thế); <b>(2)</b> trạng ngữ thời gian, nơi chốn đứng <b>trước</b> động từ (<span class="hz">在正法中修煉</span> = tu luyện trong Chính Pháp); <b>(3)</b> từ phương vị đứng <b>sau</b> danh từ (<span class="hz">天空中</span> = trong bầu trời).</p>
        ${roleLegend()}
        <input type="search" id="gramQ" placeholder="Tìm mẫu câu… (vd: 是, bị động, 才, so sánh)" style="width:100%;margin-top:10px"></div>
      <div class="g-notes" id="gramList"></div>`;
    $('#gramQ').oninput = e => { gramQ = e.target.value; drawGrammar(); };
  }
  drawGrammar();
};
function drawGrammar() {
  const q = fold(gramQ.trim());
  const list = GRAM_INDEX.filter(e => !q || fold(e.p + ' ' + e.title + ' ' + e.ex).includes(q));
  $('#gramList').innerHTML = list.map(e => noteCard(e, e.lessons)).join('') || '<p class="muted">Không tìm thấy.</p>';
}

/* ---------- Review ---------- */
let RV = null;
renderers.review = () => { if (RV && RV.active) return drawReview(); drawReviewSetup(); };
function drawReviewSetup() {
  const due = CHAR_LIST.filter(o => isDue(o.c)).length;
  const fresh = CHAR_LIST.filter(o => status(o.c) === 'new').length;
  const learning = CHAR_LIST.filter(o => status(o.c) === 'learning').length;
  const known = CHAR_LIST.filter(o => status(o.c) === 'known').length;
  const modes = [
    ['flash', '🃏 Nhận mặt chữ', 'Nhìn chữ → tự nhớ Hán Việt, nghĩa, cấu tạo, rồi lật thẻ tự chấm.'],
    ['quiz', '✅ Trắc nghiệm', 'Nhìn chữ → chọn đúng âm Hán Việt và nghĩa trong 4 đáp án.'],
    ['write', '✍️ Viết chữ', 'Nhìn nghĩa + âm → tự viết chữ đúng thứ tự nét.'],
    ['word', '🔗 Từ ghép', 'Nhìn từ ghép → nhớ nghĩa và cách đọc.'],
  ];
  $('#tab-review').innerHTML = `
    <div class="panel">
      <div class="toolbar"><h2 style="flex:1">Ôn tập theo phương pháp lặp lại ngắt quãng</h2>
        <span class="chips"><span class="chip">Cần ôn: <b>${due}</b></span><span class="chip">Chưa học: ${fresh}</span><span class="chip">Đang học: ${learning}</span><span class="chip">Đã thuộc: ${known}</span></span></div>
      <div class="review-setup">
        <div class="opt-group"><b>Kiểu ôn</b>${modes.map(([v, t, d]) => `<label class="opt"><input type="radio" name="rvMode" value="${v}" ${SETTINGS.mode === v ? 'checked' : ''}><span><b>${t}</b><small>${d}</small></span></label>`).join('')}</div>
        <div class="opt-group"><b>Phạm vi</b>
          <select id="rvScope">
            <option value="smart">Thông minh: chữ đến hạn ôn + chữ mới</option>
            <option value="due">Chỉ chữ đến hạn ôn (${due})</option>
            <option value="learning">Chữ đang học (${learning})</option>
            <option value="known">Chữ đã thuộc (${known})</option>
            <option value="all">Tất cả 250 chữ (ngẫu nhiên)</option>
            ${LESSON_LIST.map(l => `<option value="lesson:${l.i}">Bài ${l.i + 1}: ${esc(l.text.slice(0, 10))}…</option>`).join('')}
          </select>
          <b>Số thẻ mỗi lượt</b>
          <select id="rvCount">${[10, 15, 20, 30, 50].map(n => `<option ${SETTINGS.count == n ? 'selected' : ''}>${n}</option>`).join('')}</select>
          <p class="muted" style="margin:6px 0">Chấm “Nhớ/Dễ” thì thẻ được giãn lịch ôn (1 → 3 → 7 → 14 → 30 ngày). Chấm “Quên” thì thẻ quay lại sau 5 phút. Chữ ôn đúng đến mốc 14 ngày được tính là <b>đã thuộc</b>.</p>
          <button class="btn primary" id="rvStart" style="align-self:flex-start;padding:10px 22px">Bắt đầu ôn ▶</button>
        </div>
      </div>
    </div>`;
  const sc = $('#rvScope'); sc.value = [...sc.options].some(o => o.value === SETTINGS.scope) ? SETTINGS.scope : 'smart';
  $('#rvStart').onclick = () => {
    SETTINGS.mode = $('input[name=rvMode]:checked').value; SETTINGS.scope = sc.value; SETTINGS.count = +$('#rvCount').value; saveSettings();
    startReview(SETTINGS.mode, SETTINGS.scope, SETTINGS.count);
  };
}
function buildQueue(scope, n) {
  const all = CHAR_LIST.map(o => o.c);
  let q;
  if (scope === 'smart') {
    const due = all.filter(isDue).sort((a, b) => SRS[a].d - SRS[b].d);
    const fresh = all.filter(c => !SRS[c]).sort((a, b) => firstLesson(a) - firstLesson(b) || CHARS[a].idx - CHARS[b].idx);
    q = [...due, ...fresh].slice(0, n);
    return shuffle(q);
  }
  if (scope === 'due') q = all.filter(isDue);
  else if (scope === 'learning') q = all.filter(c => status(c) === 'learning');
  else if (scope === 'known') q = all.filter(c => status(c) === 'known');
  else if (scope.startsWith('lesson:')) q = uniqHan(LESSON_LIST[+scope.split(':')[1]].text).filter(c => CHARS[c]);
  else q = all;
  return shuffle(q).slice(0, n);
}
function startReview(mode, scope, n) {
  let items;
  if (mode === 'word') {
    let pool = WORDS;
    if (scope.startsWith('lesson:')) pool = lessonWords(LESSON_LIST[+scope.split(':')[1]]);
    items = shuffle(pool).slice(0, n).map(w => w.w);
  } else items = buildQueue(scope, n);
  if (!items.length) { toast('Không có thẻ nào trong phạm vi này 🎉 Hãy chọn phạm vi khác.'); return; }
  RV = { active: true, mode, items, pos: 0, results: [], flipped: false };
  showTab('review');
}
function drawReview() {
  if (RV.pos >= RV.items.length) return drawReviewSummary();
  const item = RV.items[RV.pos];
  const top = `<div class="rv-top"><span>${RV.pos + 1} / ${RV.items.length}</span><div class="bar" style="flex:1;margin:0 14px"><i style="width:${100 * RV.pos / RV.items.length}%"></i></div><button class="btn" id="rvQuit">Kết thúc</button></div>`;
  const el = $('#tab-review');
  RV.flipped = false;
  if (RV.mode === 'flash') {
    const d = CHARS[item];
    el.innerHTML = `<div class="rv-stage">${top}<div class="panel rv-card">
      <div class="rv-hz">${item}</div>
      <div class="btn-row" style="justify-content:center"><button class="btn" data-say="${item}">🔊</button><button class="btn" id="rvHint">Gợi ý pinyin</button></div>
      <div id="rvHintBox" class="cd-py" style="min-height:28px"></div>
      <div id="rvBack"></div>
      <button class="btn primary" id="rvFlip" style="margin-top:14px;padding:10px 26px">Lật thẻ <span class="kbd">(Space)</span></button>
    </div></div>`;
    $('#rvHint').onclick = () => $('#rvHintBox').textContent = d.py;
    $('#rvFlip').onclick = flipCard;
  } else if (RV.mode === 'quiz') {
    const d = CHARS[item];
    const opts = shuffle([d, ...shuffle(CHAR_LIST.filter(o => o.c !== item && o.hv !== d.hv)).slice(0, 3)]);
    el.innerHTML = `<div class="rv-stage">${top}<div class="panel rv-card">
      <div class="rv-hz">${item}</div><p class="muted">Chữ này đọc Hán Việt là gì, nghĩa là gì?</p>
      <div class="choices">${opts.map((o, k) => `<button class="choice" data-ans="${o.c}"><span class="kbd">${k + 1}</span> <b>${esc(o.hv)}</b> – ${esc(short(o.m))}</button>`).join('')}</div>
      <div id="rvBack"></div></div></div>`;
    $$('.choice').forEach(b => b.onclick = () => answerQuiz(b));
  } else if (RV.mode === 'write') {
    const d = CHARS[item];
    el.innerHTML = `<div class="rv-stage">${top}<div class="panel rv-card">
      <div class="rv-prompt"><div class="hv">${esc(d.hv)}</div><div class="py">${esc(d.py)} <button class="icon" data-say="${item}">🔊</button></div><div>${esc(d.m)}</div></div>
      <div class="btn-row" style="justify-content:center;margin-top:10px">
        <button class="btn" id="rvParts">💡 Gợi ý cấu tạo</button><button class="btn" id="rvOutline">Hiện nét mờ</button><button class="btn" id="rvGiveUp">Xem đáp án</button></div>
      <div id="rvPartsBox" class="muted" style="min-height:24px;margin-top:8px"></div>
      <div class="rv-writer"><div class="writer-box" id="rvWriter"></div></div>
      <div class="quiz-msg" id="rvMsg"></div><div id="rvBack"></div></div></div>`;
    let used = 0;
    $('#rvParts').onclick = () => { used = Math.max(used, 1); $('#rvPartsBox').innerHTML = d.parts.length && !(d.parts.length === 1 && d.parts[0] === item) ? 'Gồm: ' + d.parts.map(p => `<b class="hz" style="font-size:22px">${p}</b> (${esc(compInfo(p).name)})`).join(' + ') : 'Chữ độc thể: ' + esc(d.ex); };
    const finish = mistakes => {
      const q = mistakes < 0 ? 0 : mistakes === 0 && !used ? 3 : mistakes <= 2 ? 2 : mistakes <= 5 ? 1 : 0;
      grade(item, q); RV.results.push({ c: item, q });
      $('#rvBack').innerHTML = `<div class="rv-back"><div class="ex">💡 ${esc(d.ex)}</div><button class="btn primary" id="rvNext" style="margin-top:12px">Tiếp ›</button></div>`;
      $('#rvNext').onclick = nextCard; RV.flipped = true;
    };
    requestAnimationFrame(() => startQuiz(item, $('#rvWriter'), $('#rvMsg'), false, finish));
    $('#rvOutline').onclick = () => { used = 2; activeWriter?.showOutline(); };
    $('#rvGiveUp').onclick = () => { if (RV.flipped) return; activeWriter = makeWriter($('#rvWriter'), item); activeWriter.animateCharacter(); finish(-1); };
  } else if (RV.mode === 'word') {
    const w = WORDMAP[item];
    el.innerHTML = `<div class="rv-stage">${top}<div class="panel rv-card">
      <div class="rv-hz" style="font-size:84px">${item}</div>
      <div class="btn-row" style="justify-content:center"><button class="btn" data-say="${item}">🔊</button></div>
      <div id="rvBack"></div>
      <button class="btn primary" id="rvFlip" style="margin-top:14px;padding:10px 26px">Lật thẻ <span class="kbd">(Space)</span></button></div></div>`;
    $('#rvFlip').onclick = flipCard;
  }
  $('#rvQuit').onclick = () => { RV.items = RV.items.slice(0, RV.pos); drawReviewSummary(); };
}
function flipCard() {
  if (RV.flipped) return; RV.flipped = true;
  const item = RV.items[RV.pos];
  $('#rvFlip')?.remove();
  let back;
  if (RV.mode === 'word') {
    const w = WORDMAP[item];
    back = `<div class="hv" style="text-transform:capitalize">${esc(w.hv)}</div><div class="py">${esc(w.py.join(' '))}</div><div style="font-size:17px;margin-top:6px">${esc(w.m)}</div>
      <div class="ex">${[...item].map(c => CHARS[c] ? `<b class="hz">${c}</b> ${esc(CHARS[c].hv)} (${esc(short(CHARS[c].m))})` : c).join(' + ')}</div>`;
  } else {
    const d = CHARS[item];
    const parts = d.parts.length && !(d.parts.length === 1 && d.parts[0] === item) ? `<div class="formula" style="justify-content:center;margin-top:10px">${d.parts.map(compChipSmall).join('<span class="op">+</span>')}</div>` : '';
    back = `<div class="hv">${esc(d.hv)}</div><div class="py">${esc(d.py)}</div><div style="font-size:17px;margin-top:6px">${esc(d.m)}</div>${parts}<div class="ex">💡 ${esc(d.ex)}</div>`;
  }
  $('#rvBack').innerHTML = `<div class="rv-back">${back}
    <div class="grades">
      <button class="btn g0" data-grade="0">Quên<small>phím 1 · 5 phút</small></button>
      <button class="btn g1" data-grade="1">Khó<small>phím 2 · 1 ngày</small></button>
      <button class="btn g2" data-grade="2">Nhớ<small>phím 3</small></button>
      <button class="btn g3" data-grade="3">Dễ<small>phím 4</small></button>
    </div></div>`;
  $$('[data-grade]').forEach(b => b.onclick = () => gradeCard(+b.dataset.grade));
  speak(item);
}
function gradeCard(q) {
  const item = RV.items[RV.pos];
  if (RV.mode === 'word') { [...item].forEach(c => { if (CHARS[c] && q < 2 && !SRS[c]) setStatus(c, 'learning'); }); }
  else grade(item, q);
  RV.results.push({ c: item, q });
  nextCard();
}
function answerQuiz(btn) {
  if (RV.flipped) return; RV.flipped = true;
  const item = RV.items[RV.pos], ok = btn.dataset.ans === item;
  $$('.choice').forEach(b => { b.disabled = true; if (b.dataset.ans === item) b.classList.add('right'); });
  if (!ok) btn.classList.add('wrong');
  grade(item, ok ? 2 : 0); RV.results.push({ c: item, q: ok ? 2 : 0 });
  const d = CHARS[item];
  $('#rvBack').innerHTML = `<div class="rv-back"><div class="${ok ? 'quiz-msg ok' : 'quiz-msg bad'}">${ok ? '✓ Chính xác!' : '✗ Chưa đúng'}</div>
    <div class="py">${esc(d.py)}</div><div class="ex">💡 ${esc(d.ex)}</div><button class="btn primary" id="rvNext" style="margin-top:12px">Tiếp › <span class="kbd">(Enter)</span></button></div>`;
  $('#rvNext').onclick = nextCard;
  speak(item);
}
function nextCard() { RV.pos++; drawReview(); }
function drawReviewSummary() {
  RV.active = false;
  const r = RV.results, good = r.filter(x => x.q >= 2).length;
  const weak = r.filter(x => x.q < 2).map(x => x.c);
  $('#tab-review').innerHTML = `<div class="rv-stage"><div class="panel rv-card">
    <h2>Hoàn thành lượt ôn 🎉</h2>
    <div class="summary-num">${good}/${r.length}</div><p class="muted">thẻ nhớ tốt</p>
    ${weak.length ? `<h4 class="sec-title" style="justify-content:center">Cần xem lại</h4><div class="chips" style="justify-content:center">${weak.map(c => `<button class="chip" ${WORDMAP[c] && [...c].length > 1 ? `data-w="${c}"` : `data-c="${c}"`}><span class="hz">${c}</span></button>`).join('')}</div>` : ''}
    <div class="btn-row" style="justify-content:center;margin-top:20px">
      <button class="btn primary" id="rvAgain">Ôn lượt mới</button><button class="btn" id="rvSetup">Đổi kiểu ôn</button></div></div></div>`;
  $('#rvAgain').onclick = () => startReview(SETTINGS.mode, SETTINGS.scope, SETTINGS.count);
  $('#rvSetup').onclick = drawReviewSetup;
}

/* ---------- Write practice ---------- */
let WR = { lesson: -1, c: null, auto: true };
renderers.write = () => {
  const pool = WR.lesson >= 0 ? uniqHan(LESSON_LIST[WR.lesson].text).filter(c => CHARS[c]) : CHAR_LIST.map(o => o.c);
  if (!WR.c || !pool.includes(WR.c)) WR.c = pool[0];
  const d = CHARS[WR.c];
  $('#tab-write').innerHTML = `
  <div class="write-layout">
    <aside class="panel write-pick">
      <b>Chọn chữ để luyện</b>
      <select id="wrLesson" style="width:100%;margin:8px 0">
        <option value="-1">Tất cả 250 chữ</option>
        ${LESSON_LIST.map(l => `<option value="${l.i}" ${WR.lesson === l.i ? 'selected' : ''}>Bài ${l.i + 1}: ${esc(l.text.slice(0, 10))}…</option>`).join('')}
      </select>
      <div class="chips">${pool.map(c => `<button class="chip hz st-${status(c)} ${c === WR.c ? 'active' : ''}" data-wr="${c}" style="font-size:20px">${c}</button>`).join('')}</div>
      <label class="tgl" style="margin-top:10px"><input type="checkbox" id="wrAuto" ${WR.auto ? 'checked' : ''}> Tự chuyển chữ tiếp khi viết đúng</label>
    </aside>
    <div class="panel">
      <div class="write-main">
        <div class="cd-left">
          <div class="writer-box" id="wrBox"></div>
          <div class="btn-row">
            <button class="btn" data-act="anim">▶ Viết mẫu</button>
            <button class="btn" data-act="quiz">✍️ Tô theo nét mờ</button>
            <button class="btn" data-act="blind">🧠 Viết không nhìn</button>
          </div>
          <div class="quiz-msg" id="wrMsg"></div>
        </div>
        <div class="write-info cd-right">
          <div class="cd-head"><div class="hz-big">${WR.c}</div><div><div class="cd-hv">${esc(d.hv)}</div><div class="cd-py">${esc(d.py)} <button class="icon" data-say="${WR.c}">🔊</button></div></div></div>
          <div class="cd-mean">${esc(d.m)}</div>
          <div class="ex">💡 ${esc(d.ex)}</div>
          <div class="btn-row" style="margin-top:12px"><button class="btn" data-c="${WR.c}">Xem chi tiết chữ</button>
            <button class="btn" id="wrPrev">‹ Chữ trước</button><button class="btn" id="wrNext">Chữ sau ›</button></div>
          <h4>Mẹo viết đúng</h4>
          <ul class="muted" style="margin:0;padding-left:18px;font-size:13.5px">
            <li>Trên trước, dưới sau · Trái trước, phải sau</li><li>Ngang trước, sổ sau · Phẩy trước, mác sau</li>
            <li>Ngoài trước, trong sau, đóng khung sau cùng (như 國, 因)</li><li>Bộ 辶 thường viết sau cùng (như 道, 這)</li>
          </ul>
        </div>
      </div>
      <h4 style="margin:20px 0 10px;color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:.6px">Thứ tự nét từng bước</h4>
      <div class="steps" id="wrSteps"></div>
    </div>
  </div>`;
  const go = dir => { const k = pool.indexOf(WR.c) + dir; if (k >= 0 && k < pool.length) { WR.c = pool[k]; renderers.write(); } };
  $('#wrLesson').onchange = e => { WR.lesson = +e.target.value; WR.c = null; renderers.write(); };
  $('#wrAuto').onchange = e => WR.auto = e.target.checked;
  $('#wrPrev').onclick = () => go(-1); $('#wrNext').onclick = () => go(1);
  $$('[data-wr]').forEach(b => b.onclick = () => { WR.c = b.dataset.wr; renderers.write(); });
  const box = $('#wrBox'), msg = $('#wrMsg');
  requestAnimationFrame(() => { activeWriter = makeWriter(box, WR.c); activeWriter?.animateCharacter(); });
  const done = m => { if (m <= 2 && WR.auto) setTimeout(() => go(1), 1300); };
  $$('#tab-write [data-act]').forEach(b => b.onclick = () => {
    const act = b.dataset.act;
    if (act === 'anim') { activeWriter = makeWriter(box, WR.c); msg.className = 'quiz-msg'; msg.textContent = ''; activeWriter.animateCharacter(); }
    if (act === 'quiz') startQuiz(WR.c, box, msg, true, done);
    if (act === 'blind') startQuiz(WR.c, box, msg, false, done);
  });
  renderSteps(WR.c, $('#wrSteps'));
};

/* ---------- Custom text ---------- */
let customText = '';
renderers.custom = () => {
  $('#tab-custom').innerHTML = `
    <div class="panel">
      <h2>Học một đoạn văn bản mới</h2>
      <p class="muted">Dán đoạn tiếng Trung bất kỳ (phồn thể hoặc giản thể). Chữ đã có trong bộ dữ liệu sẽ hiện đầy đủ Hán Việt & chiết tự; chữ mới sẽ lấy pinyin, nghĩa (tiếng Anh) và cấu tạo từ từ điển Make Me a Hanzi. Tất cả đều xem được thứ tự nét viết.</p>
      <textarea id="cuText" rows="6" placeholder="Dán văn bản tiếng Trung vào đây…">${esc(customText)}</textarea>
      <div class="btn-row" style="margin-top:10px"><button class="btn primary" id="cuGo">Phân tích</button><button class="btn" id="cuSave">💾 Lưu văn bản</button></div>
    </div>
    ${CUSTOM.length ? `<h3 class="sec-title">Văn bản đã lưu</h3><div class="saved-list">${CUSTOM.map((t, i) => `<div class="saved-item"><span class="t" data-cu="${i}">${esc(t.slice(0, 60))}</span><button class="icon" data-cu-del="${i}" title="Xóa">🗑</button></div>`).join('')}</div>` : ''}
    <div id="cuOut"></div>`;
  $('#cuGo').onclick = () => analyzeCustom($('#cuText').value);
  $('#cuSave').onclick = () => { const t = $('#cuText').value.trim(); if (!t) return; if (!CUSTOM.includes(t)) { CUSTOM.unshift(t); store.set('custom', CUSTOM); } toast('Đã lưu'); renderers.custom(); analyzeCustom(t); };
  $$('[data-cu]').forEach(b => b.onclick = () => { $('#cuText').value = CUSTOM[+b.dataset.cu]; analyzeCustom(CUSTOM[+b.dataset.cu]); });
  $$('[data-cu-del]').forEach(b => b.onclick = () => { CUSTOM.splice(+b.dataset.cuDel, 1); store.set('custom', CUSTOM); renderers.custom(); });
  if (customText) analyzeCustom(customText);
};
async function analyzeCustom(text) {
  customText = text.trim();
  const out = $('#cuOut'); if (!customText) { out.innerHTML = ''; return; }
  const chars = uniqHan(customText);
  const unknown = chars.filter(c => !CHARS[c]);
  if (unknown.length) { out.innerHTML = '<p class="muted">Đang tải từ điển bổ sung…</p>'; try { await loadMMH(); } catch { } }
  out.innerHTML = `
    <div class="panel" style="margin-top:16px"><div class="btn-row" style="justify-content:flex-end;margin-bottom:10px"><button class="btn" id="cuSay">🔊 Nghe</button></div>
      <div class="reader big">${renderReader(customText)}</div></div>
    <h3 class="sec-title">Các chữ trong văn bản <small>${chars.length} chữ · ${chars.length - unknown.length} chữ có dữ liệu tiếng Việt · ${unknown.length} chữ mới</small></h3>
    <div class="char-grid">${chars.map(c => CHARS[c] ? charCard(c) : `<button class="card st-new" data-c="${c}"><span class="hz">${c}</span><span class="py">${esc(MMH?.[c]?.pinyin?.[0] || '')}</span><span class="m">${esc((MMH?.[c]?.definition || 'chữ mới').split(/[;,]/)[0])}</span></button>`).join('')}</div>`;
  $('#cuSay').onclick = () => speak(customText);
}

/* ================= Global events ================= */
document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-close]')) return closeModal();
  const say = t.closest('[data-say]'); if (say) { speak(say.dataset.say); return; }
  const sayText = t.closest('[data-say-text]'); if (sayText) { speak(LESSONS[+sayText.dataset.sayText][0], sayText.hasAttribute('data-slow') ? 0.5 : 0.8); return; }
  const ftb = t.closest('[data-ft]'); if (ftb) return ftToggle(ftb.dataset.ft);
  const pl = t.closest('[data-pill]'); if (pl) return setToggle(pl.dataset.pill, !SETTINGS[pl.dataset.pill]);
  const svt = t.closest('[data-sv-tab]'); if (svt) { const v = modalStack.at(-1); v.tab = svt.dataset.svTab; $$('[data-sv-tab]').forEach(b => b.classList.toggle('on', b === svt)); activeWriter = null; drawSentPane(v); return; }
  const svn = t.closest('[data-sv-nav]'); if (svn && !svn.disabled) { e.preventDefault(); const v = modalStack.at(-1); modalStack[modalStack.length - 1] = { type: 'sent', i: +svn.dataset.svNav, tab: v?.type === 'sent' ? v.tab : 'gram', wc: 0 }; openModal(modalStack.at(-1), false); return; }
  const svw = t.closest('[data-sv-wc]'); if (svw && !svw.disabled) { const v = modalStack.at(-1); v.wc = +svw.dataset.svWc; drawSentPane(v); return; }
  const sent = t.closest('[data-sent]'); if (sent && !t.closest('#modal')) return openSent(+sent.dataset.sent);
  const tab = t.closest('#tabs [data-tab]'); if (tab) { if (tab.dataset.tab === 'review' && RV) RV.active = RV.active && currentTab === 'review'; return showTab(tab.dataset.tab); }
  const gl = t.closest('[data-goto-lesson]'); if (gl) return gotoLesson(+gl.dataset.gotoLesson);
  const ls = t.closest('[data-lesson]'); if (ls && !ls.disabled) { SETTINGS.lesson = +ls.dataset.lesson; saveSettings(); if (currentTab !== 'lessons') return showTab('lessons'); renderers.lessons(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  const rl = t.closest('[data-review-lesson]'); if (rl) { const s = 'lesson:' + rl.dataset.reviewLesson; SETTINGS.scope = s; saveSettings(); return startReview(SETTINGS.mode, s, 50); }
  const wl = t.closest('[data-write-lesson]'); if (wl) { WR.lesson = +wl.dataset.writeLesson; WR.c = null; return showTab('write'); }
  const st = t.closest('[data-status]'); if (st) { const c = modalStack.at(-1)?.c; if (c) { setStatus(c, st.dataset.status); $$('[data-status]').forEach(b => b.className = 'btn' + (b.dataset.status === status(c) ? ' sel-' + status(c) : '')); toast('Đã cập nhật'); } return; }
  const nav = t.closest('[data-nav]'); if (nav && !nav.disabled) { const o = CHAR_LIST[+nav.dataset.nav]; if (o) { modalStack[modalStack.length - 1] = { type: 'char', c: o.c }; openModal(modalStack.at(-1), false); } return; }
  const comp = t.closest('[data-comp]'); if (comp) return openComp(comp.dataset.comp);
  const ch = t.closest('[data-c]'); if (ch) return openChar(ch.dataset.c);
  const w = t.closest('[data-w]'); if (w && WORDMAP[w.dataset.w]) { if (t.closest('.wd') && !t.closest('.ch')) return openWord(w.dataset.w); if (!t.closest('.wd')) return openWord(w.dataset.w); }
});
// Double-click a word in the reader opens the word
document.addEventListener('dblclick', e => { const w = e.target.closest('.wd'); if (w && !w.closest('.sent')) { e.preventDefault(); openWord(w.dataset.w); } });
$('#modalBack').onclick = () => { if (modalStack.length > 1) { modalStack.pop(); openModal(modalStack.at(-1), false); } };
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) return;
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-sent]') && $('#modal').hidden) { e.preventDefault(); return openSent(+e.target.dataset.sent); }
  if (!$('#modal').hidden) {
    if (e.key === 'Escape') closeModal();
    const cur = modalStack.at(-1);
    if (cur?.type === 'sent' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const j = cur.i + (e.key === 'ArrowLeft' ? -1 : 1);
      if (LESSON_LIST[j]) { modalStack[modalStack.length - 1] = { ...cur, i: j, wc: 0 }; openModal(modalStack.at(-1), false); }
      return;
    }
    if (cur?.type === 'char' && CHARS[cur.c] && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      const o = CHAR_LIST[CHARS[cur.c].idx + (e.key === 'ArrowLeft' ? -1 : 1)];
      if (o) { modalStack[modalStack.length - 1] = { type: 'char', c: o.c }; openModal(modalStack.at(-1), false); }
    }
    return;
  }
  if (currentTab === 'review' && RV?.active) {
    if (e.key === ' ' && (RV.mode === 'flash' || RV.mode === 'word')) { e.preventDefault(); flipCard(); }
    else if (/^[1-4]$/.test(e.key)) {
      if (RV.mode === 'quiz' && !RV.flipped) { const b = $$('.choice')[+e.key - 1]; b && answerQuiz(b); }
      else if (RV.flipped && (RV.mode === 'flash' || RV.mode === 'word')) gradeCard(+e.key - 1);
    } else if (e.key === 'Enter' && $('#rvNext')) { e.preventDefault(); nextCard(); }
  }
});
$('#tglPy').checked = SETTINGS.py; $('#tglHv').checked = SETTINGS.hv;
const applyToggles = () => { document.body.classList.toggle('show-py', SETTINGS.py); document.body.classList.toggle('show-hv', SETTINGS.hv); document.body.classList.toggle('hide-vi', !SETTINGS.viOn); };
$('#tglPy').onchange = e => setToggle('py', e.target.checked);
$('#tglHv').onchange = e => setToggle('hv', e.target.checked);
$('#stats').onclick = () => showTab('review');

function renderVoiceHelp() {
  $('#modalTitle').textContent = 'Nghe không được?';
  $('#modalBody').innerHTML = `<div class="help">
    <p><b>Chữ, từ và 20 câu bài học</b> đã có sẵn file âm thanh trong app – <b>không cần cài gì</b>. Nếu vẫn không nghe:</p>
    <ul><li>Tăng âm lượng; trên <b>iPhone</b> gạt tắt nút <b>im lặng</b> ở cạnh máy.</li>
    <li>Lần đầu nghe mỗi chữ cần có mạng; sau đó nghe được cả khi offline.</li>
    <li>Thấy thông báo “Đã có phiên bản mới” thì bấm <b>Cập nhật ngay</b>.</li></ul>
    <p>Trạng thái máy này: ${zhVoice ? `✅ có giọng tiếng Trung <i>(${esc(zhVoice.name)})</i>` : '⚠️ chưa có giọng tiếng Trung'} – chỉ cần cho <b>văn bản tự nhập</b> ở tab “Văn bản mới” để đọc liền mạch (không có thì app đọc từng chữ).</p>
    <h4>Cài giọng tiếng Trung (không bắt buộc)</h4>
    <ul>
      <li><b>Windows 10/11:</b> Settings → Time &amp; Language → <b>Speech</b> → <i>Manage voices</i> → <b>Add voices</b> → gõ “Chinese” → chọn <b>Chinese (Simplified, China)</b> → Add. Cài xong <b>tắt hẳn trình duyệt rồi mở lại</b>. (Trên Windows 11 có thể nằm ở Time &amp; Language → Language &amp; region → Add a language → Chinese (Simplified) → tích <i>Text-to-speech</i>.)</li>
      <li><b>Android:</b> Cài đặt → Hệ thống → Ngôn ngữ &amp; nhập liệu → <b>Đầu ra chuyển văn bản thành giọng nói</b> → bánh răng của <i>Dịch vụ lời nói của Google</i> → Cài đặt dữ liệu giọng nói → <b>Tiếng Trung (Trung Quốc đại lục)</b> → tải về.</li>
      <li><b>iPhone/iPad:</b> Cài đặt → Trợ năng → Nội dung được đọc → <b>Giọng nói</b> → Tiếng Trung → tải một giọng (vd. Tingting).</li>
      <li><b>Mac:</b> System Settings → Accessibility → Spoken Content → System voice → Manage Voices → Chinese.</li>
    </ul></div>`;
}
$('#btnVoiceHelp').onclick = () => { modalStack.length = 0; openModal({ type: 'help' }); };

$('#btnExport').onclick = () => {
  const blob = new Blob([JSON.stringify({ srs: SRS, notes: NOTES, done: DONE, custom: CUSTOM, settings: SETTINGS }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `hoc-chu-han-${new Date().toISOString().slice(0, 10)}.json`; a.click();
};
$('#btnImport').onclick = () => $('#fileImport').click();
$('#fileImport').onchange = async e => {
  try {
    const o = JSON.parse(await e.target.files[0].text());
    SRS = o.srs || {}; NOTES = o.notes || {}; DONE = o.done || {}; CUSTOM = o.custom || [];
    Object.assign(SETTINGS, o.settings || {});
    ['srs', 'notes', 'done', 'custom'].forEach(k => store.set(k, { srs: SRS, notes: NOTES, done: DONE, custom: CUSTOM }[k])); saveSettings();
    toast('Đã khôi phục tiến độ'); updateStats(); applyToggles(); showTab(currentTab);
  } catch { toast('File không hợp lệ'); }
};

applyToggles();
updateStats();
showTab('text');

/* ================= PWA: offline + cài đặt + cập nhật ================= */
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const onUpdate = w => {
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          const t = $('#toast');
          t.innerHTML = 'Đã có phiên bản mới. <button class="link" style="color:inherit;text-decoration:underline">Cập nhật ngay</button>';
          t.style.pointerEvents = 'auto'; t.classList.add('show');
          t.querySelector('button').onclick = () => w.postMessage('skipWaiting');
        }
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) onUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => onUpdate(reg.installing));
  }).catch(() => { });
  // Chỉ tải lại khi thay bản cũ bằng bản mới (không tải lại ở lần cài đầu tiên)
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
}
let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault(); installPrompt = e;
  if ($('#btnInstall')) return;
  const b = document.createElement('button');
  b.id = 'btnInstall'; b.className = 'stats'; b.textContent = '📲 Cài app';
  b.onclick = async () => { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; b.remove(); };
  $('.top-right').prepend(b);
});
