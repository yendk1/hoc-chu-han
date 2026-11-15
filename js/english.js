'use strict';
/* ================= Học tiếng Anh theo cùng bài =================
 * Dữ liệu: window.EN_DATA = { source, audio, sents: [{en, eg, n, v}], ipa: {từ: phiên âm} }
 *   en: câu tiếng Anh (bản dịch chính thức, gióng theo câu tiếng Trung)
 *   eg: [[cụm, VAI, nghĩa]]  · n: [[mẫu, tiêu đề, giải thích]]  · v: [[từ trong câu, từ gốc, từ loại, nghĩa]]
 * window.EN_WORD_AUDIO: danh sách từ có sẵn file audio/en/w/<từ>.mp3
 */
const ED = window.EN_DATA || null;
const EN_S = ED ? ED.sents : [];
const IPA = (ED && ED.ipa) || {};
const EN_WAUDIO = new Set(window.EN_WORD_AUDIO || []);
const POS = { n: 'danh từ', v: 'động từ', adj: 'tính từ', adv: 'trạng từ', prep: 'giới từ', conj: 'liên từ', pron: 'đại từ', phr: 'cụm từ', det: 'hạn định từ', num: 'số từ', int: 'thán từ' };
const enKey = w => w.toLowerCase().replace(/[’']/g, "'").replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
const wSlug = w => enKey(w).replace(/[^a-z0-9]+/g, '_');
SETTINGS.ipa ??= true; SETTINGS.zhOn ??= false;

/* ---------- Từ vựng tổng hợp (gom theo từ gốc) ---------- */
const VOCAB = {}, VOCAB_LIST = [];
EN_S.forEach((s, i) => (s?.v || []).forEach(([form, lemma, pos, m]) => {
  const k = enKey(lemma || form); if (!k) return;
  let o = VOCAB[k];
  if (!o) { o = VOCAB[k] = { k, lemma: lemma || form, pos, means: [], forms: new Set(), sents: [] }; VOCAB_LIST.push(o); }
  if (m && !o.means.includes(m)) o.means.push(m);
  o.forms.add(enKey(form)); if (!o.sents.includes(i)) o.sents.push(i);
}));
const FORM2VOCAB = {};
VOCAB_LIST.forEach(o => o.forms.forEach(f => { if (!FORM2VOCAB[f]) FORM2VOCAB[f] = o.k; }));
const ipaOf = w => { const k = enKey(w); return IPA[k] || (k.includes(' ') ? k.split(/\s+/).map(x => IPA[x] || '').filter(Boolean).join(' ') : ''); };

/* ---------- Ngữ pháp tiếng Anh: chỉ mục ---------- */
const EN_GRAM = [];
{
  const by = {};
  EN_S.forEach((s, i) => (s?.n || []).forEach(([p, title, ex]) => {
    let e = by[p];
    if (!e) { e = by[p] = { p, title, ex, sents: [] }; EN_GRAM.push(e); }
    if (ex.length > e.ex.length) e.ex = ex;
    if (!e.sents.includes(i)) e.sents.push(i);
  }));
  EN_GRAM.sort((a, b) => b.sents.length - a.sents.length);
}

/* ---------- Hiển thị câu tiếng Anh (có phiên âm IPA trên từng từ) ---------- */
function enReader(text, click = true) {
  return esc(text).replace(/[A-Za-z][A-Za-z’'\-]*[A-Za-z]|[A-Za-z]/g, w => {
    const ip = ipaOf(w.replace(/&#39;/g, "'"));
    return `<span class="ew"${click ? ` data-ew="${esc(enKey(w))}"` : ''}><span class="ipa">${ip ? esc(ip) : '&nbsp;'}</span><span class="et">${w}</span></span>`;
  });
}
const enSnippet = (text, forms) => {
  const re = new RegExp(`\\b(${[...forms].map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
  const m = text.match(re); if (!m) return esc(text);
  const a = Math.max(0, m.index - 40), b = Math.min(text.length, m.index + m[0].length + 40);
  return (a ? '…' : '') + esc(text.slice(a, m.index)) + `<mark>${esc(m[0])}</mark>` + esc(text.slice(m.index + m[0].length, b)) + (b < text.length ? '…' : '');
};
function wordSents(o, except = -1, limit = 6) {
  const re = new RegExp(`\\b(${[...o.forms, o.k].map(f => f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'i');
  const out = []; for (let i = 0; i < EN_S.length && out.length < limit; i++) if (i !== except && EN_S[i]?.en && re.test(EN_S[i].en)) out.push(i);
  return out;
}

/* ---------- Âm thanh tiếng Anh ---------- */
let enVoice = null;
function pickEnVoice() {
  const vs = 'speechSynthesis' in window ? speechSynthesis.getVoices() : [];
  enVoice = vs.find(v => /en[-_]US/i.test(v.lang) && /natural|neural|google|samantha|aria|jenny/i.test(v.name)) || vs.find(v => /en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickEnVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickEnVoice); }
function ttsEn(text, rate = 0.9) {
  if (!('speechSynthesis' in window)) return toast('Máy không hỗ trợ đọc tiếng Anh.');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text); u.lang = enVoice?.lang || 'en-US'; if (enVoice) u.voice = enVoice; u.rate = rate;
  speechSynthesis.speak(u);
}
function sayWord(w) {
  stopSpeech();
  const s = wSlug(w);
  if (EN_WAUDIO.has(s)) playFiles([`audio/en/w/${s}.mp3`], () => ttsEn(w, 0.85));
  else ttsEn(w, 0.85);
}
// Nút nghe câu tiếng Anh: bấm = đọc, bấm lần nữa = tạm dừng, bấm tiếp = nghe tiếp
const EP = { key: null, paused: false, token: -1, all: null };
const EN_RATE_SLOW = 0.7;
function epUI() {
  $$('[data-en-say]').forEach(b => {
    if (!b.dataset.label) b.dataset.label = b.innerHTML;
    const on = EP.key === b.dataset.enSay + (b.hasAttribute('data-slow') ? 's' : '');
    b.innerHTML = !on ? b.dataset.label : b.hasAttribute('data-icon') ? (EP.paused ? '▶' : '⏸') : EP.paused ? '▶ Nghe tiếp' : '⏸ Tạm dừng';
    b.classList.toggle('on', on);
  });
  $$('[data-en-all]').forEach(b => {
    const on = !!EP.all;
    b.textContent = !on ? '🔊 Nghe cả mục' : EP.paused ? '▶ Nghe tiếp' : '⏸ Tạm dừng';
    b.classList.toggle('on', on);
  });
  $$('.en-row.playing').forEach(el => el.classList.remove('playing'));
  if (EP.all) $(`.en-row[data-en-sent="${EP.all.i}"]`)?.classList.add('playing');
}
function epReset() { if (EP.key === null && !EP.all) return; EP.key = null; EP.paused = false; EP.token = -1; EP.all = null; epUI(); }
function enSentFiles(i) { return ED?.audio ? [`${ED.audio}e${i}.mp3`] : null; }
function epToggle(b) {
  const i = +b.dataset.enSay, slow = b.hasAttribute('data-slow'), k = i + (slow ? 's' : '');
  if (EP.key === k) { EP.paused = !EP.paused; if (EP.paused) player.pause(); else player.play()?.catch?.(() => {}); epUI(); return; }
  stopSpeech();
  const text = EN_S[i]?.en; if (!text) return;
  const files = enSentFiles(i);
  if (!files) { ttsEn(text, slow ? 0.65 : 0.92); return; }
  playFiles(files, () => ttsEn(text, slow ? 0.65 : 0.92), slow ? EN_RATE_SLOW : 1, () => { if (EP.token === tok) { EP.key = null; EP.paused = false; EP.token = -1; epUI(); } });
  const tok = playToken; EP.key = k; EP.paused = false; EP.token = tok; epUI();
}
// Nghe liên tục các câu tiếng Anh trong mục
function epAll() {
  if (EP.all) { EP.paused = !EP.paused; if (EP.paused) player.pause(); else player.play()?.catch?.(() => {}); epUI(); return; }
  const r = enRange(); stopSpeech();
  const all = { i: r.a, end: r.b };
  const step = i => {
    while (i <= all.end && !EN_S[i]?.en) i++;
    if (i > all.end) { epReset(); return; }
    all.i = i; EP.all = all; epUI();
    const row = $(`.en-row[data-en-sent="${i}"]`); if (row && $('#modal').hidden) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    playFiles(enSentFiles(i) || [], () => { epReset(); toast('Không phát được âm thanh tiếng Anh (cần mạng lần đầu).'); }, 1, () => { if (EP.all === all && EP.token === tok) step(i + 1); });
    const tok = playToken; EP.token = tok; EP.all = all;
  };
  EP.paused = false; step(r.a);
}

/* ---------- Khung tiếng Anh trong tab Bài học & popup câu ---------- */
const enRoleLegend = () => roleLegend();
function enChunks(eg) {
  return `<div class="g-sent en-g">${(eg || []).map(([t, r, g]) => r === 'P'
    ? `<span class="g-p">${esc(t)}</span>`
    : `<div class="g-chunk r-${r}"><span class="g-t en-t">${esc(t)}</span><span class="g-r">${ROLES[r]?.[0] || r}</span><span class="g-g">${esc(g)}</span></div>`).join('')}</div>`;
}
function enNotes(s, i) {
  return (s.n || []).map(([p, title, ex]) => {
    const e = EN_GRAM.find(x => x.p === p), seen = e ? e.sents.filter(x => x !== i) : [];
    return `<div class="g-note en-note"><div class="g-pat">${esc(p)}</div><div class="g-title">${esc(title)}</div><div class="g-ex">${esc(ex)}</div>
      ${seen.length ? `<div class="sv-seen">Cũng gặp ở: ${seen.slice(0, 10).map(x => `<button class="chip" data-en-open="${x}">Câu ${x + 1}</button>`).join('')}${seen.length > 10 ? `<span class="muted"> … +${seen.length - 10}</span>` : ''}</div>` : ''}</div>`;
  }).join('');
}
function vocabCard(o, form) {
  const ip = ipaOf(form || o.lemma) || ipaOf(o.lemma);
  return `<button class="vcard st-${status('en:' + o.k)}" data-ew="${esc(o.k)}"><i class="dot"></i>
    <span class="vw">${esc(form || o.lemma)}</span>${form && enKey(form) !== o.k ? `<span class="vl">← ${esc(o.lemma)}</span>` : ''}
    <span class="vi-ipa">${ip ? '/' + esc(ip) + '/' : ''}</span>
    <span class="vp">${esc(POS[o.pos] || o.pos || '')}</span>
    <span class="vm">${esc(o.means[0] || '')}</span></button>`;
}
function sentVocab(i) {
  return (EN_S[i]?.v || []).map(([form, lemma]) => { const o = VOCAB[enKey(lemma || form)]; return o ? vocabCard(o, form) : ''; }).join('');
}
function enLessonPanel(i) {
  const s = EN_S[i]; if (!s) return '';
  if (!s.en) return `<div class="panel en-panel"><h3 class="sec-title" style="margin-top:0">🇬🇧 Tiếng Anh</h3><p class="muted">Câu này được bản tiếng Anh gộp chung với câu trước.</p></div>`;
  return `<div class="panel en-panel">
    <div class="lesson-head"><h3 class="sec-title" style="margin:0">🇬🇧 Tiếng Anh <small>bản dịch chính thức</small></h3>
      <div class="btn-row"><button class="btn" data-en-say="${i}">🔊 Nghe</button><button class="btn" data-en-say="${i}" data-slow>🐢 Chậm</button>
      <button class="btn" data-en-open="${i}" data-en-tab="read">🗣 Luyện đọc</button><button class="btn" data-en-open="${i}" data-en-tab="write">✍️ Luyện viết</button></div></div>
    <div class="en-reader big">${enReader(s.en)}</div>
    <details class="en-more" open><summary>📐 Ngữ pháp câu tiếng Anh</summary>${enChunks(s.eg)}<div class="g-notes">${enNotes(s, i)}</div></details>
    <h4 class="sec-title" style="font-size:15px">📚 Từ vựng <small>bấm vào từ để nghe, xem nghĩa và ví dụ</small></h4>
    <div class="vgrid">${sentVocab(i)}</div>
  </div>`;
}
// Tab "English" trong popup câu tiếng Trung
function enSentPane(pane, i) {
  const s = EN_S[i];
  if (!s?.en) { pane.innerHTML = '<p class="muted">Câu này được bản tiếng Anh gộp chung với câu trước/sau.</p>'; return; }
  pane.innerHTML = `
    <div class="en-reader">${enReader(s.en)}</div>
    <div class="btn-row" style="margin:10px 0"><button class="btn" data-en-say="${i}">🔊 Nghe</button><button class="btn" data-en-say="${i}" data-slow>🐢 Chậm</button>
      <button class="btn" data-en-open="${i}" data-en-tab="read">🗣 Luyện đọc</button><button class="btn" data-en-open="${i}" data-en-tab="write">✍️ Luyện viết</button></div>
    <div class="sv-h">Cấu trúc câu</div>${enChunks(s.eg)}
    <div class="sv-h">Điểm ngữ pháp</div><div class="sv-notes">${enNotes(s, i)}</div>
    <div class="sv-h">Từ vựng</div><div class="vgrid">${sentVocab(i)}</div>`;
  epUI();
}

/* ---------- Popup: câu tiếng Anh ---------- */
const EN_TABS = [['gram', '📐 Ngữ pháp'], ['vocab', '📚 Từ vựng'], ['read', '🗣 Luyện đọc'], ['write', '✍️ Luyện viết']];
function enModal(v) {
  if (v.type === 'ensent') renderEnSent(v);
  else if (v.type === 'enword') renderEnWord(v.k);
  epUI();
}
function renderEnSent(v) {
  const i = v.i, s = EN_S[i], l = LESSON_LIST[i];
  $('#modalTitle').textContent = `🇬🇧 Câu ${i + 1} / ${EN_S.length}`;
  const prev = (() => { let j = i - 1; while (j >= 0 && !EN_S[j]?.en) j--; return j; })();
  const next = (() => { let j = i + 1; while (j < EN_S.length && !EN_S[j]?.en) j++; return j < EN_S.length ? j : -1; })();
  $('#modalBody').innerHTML = `
    <div class="sv-top">
      <div class="en-reader sv-reader">${enReader(s.en)}</div>
      <div class="sv-vi">${esc(l.viOff)}</div>
      <div class="sv-zh hz">${esc(l.text)} <button class="link" data-sent-zh="${i}">中 Học câu tiếng Trung ›</button></div>
      <div class="sv-actions">
        <button class="btn" data-en-say="${i}">🔊 Nghe</button>
        <button class="btn" data-en-say="${i}" data-slow>🐢 Chậm</button>
        <span class="sp"></span>
        <button class="btn nav" data-en-nav="${prev}" ${prev < 0 ? 'disabled' : ''} title="Câu trước">‹</button>
        <button class="btn nav" data-en-nav="${next}" ${next < 0 ? 'disabled' : ''} title="Câu sau">›</button>
      </div>
    </div>
    <div class="seg" role="tablist">${EN_TABS.map(([k, n]) => `<button role="tab" class="${v.tab === k ? 'on' : ''}" data-en-tab-sw="${k}">${n}</button>`).join('')}</div>
    <div id="enPane"></div>`;
  drawEnPane(v);
}
function drawEnPane(v) {
  const pane = $('#enPane'); if (!pane) return;
  const i = v.i, s = EN_S[i];
  stopRec();
  if (v.tab === 'gram') {
    pane.innerHTML = `<p class="sv-lead">Câu tiếng Anh được chia thành các <b>cụm</b>; màu cho biết vai trò trong câu, dòng nhỏ là nghĩa tiếng Việt.</p>
      ${enRoleLegend()}${enChunks(s.eg)}
      <div class="sv-h">Điểm ngữ pháp (${(s.n || []).length})</div><div class="sv-notes">${enNotes(s, i)}</div>`;
  } else if (v.tab === 'vocab') {
    pane.innerHTML = `<p class="sv-lead">Từ nên học trong câu. Chạm vào từ để nghe phát âm, xem nghĩa và các câu khác có từ này.</p>
      <div class="vgrid">${sentVocab(i)}</div>
      <div class="sv-h">Mọi từ trong câu</div><p class="sv-lead">Chạm vào bất kỳ từ nào trong câu ở trên để nghe và xem phiên âm.</p>`;
  } else if (v.tab === 'read') drawReadPane(pane, i);
  else drawWritePane(pane, v);
}
function renderEnWord(k) {
  const o = VOCAB[k];
  const word = o ? o.lemma : k, ip = ipaOf(word);
  $('#modalTitle').textContent = `Từ “${word}”`;
  const sents = o ? [...new Set([...o.sents, ...wordSents(o, -1, 8)])].slice(0, 10) : wordSents({ forms: new Set([k]), k }, -1, 10);
  const st = status('en:' + k);
  $('#modalBody').innerHTML = `
    <div class="ew-head"><div><div class="ew-word">${esc(word)}</div><div class="ew-ipa">${ip ? '/' + esc(ip) + '/' : ''} <button class="icon" data-en-word="${esc(word)}" title="Nghe">🔊</button></div>
      ${o ? `<div class="vp">${esc(POS[o.pos] || o.pos || '')}${o.forms.size > 1 || ![...o.forms].includes(k) ? ` · dạng gặp trong bài: <i>${esc([...o.forms].join(', '))}</i>` : ''}</div>` : ''}</div></div>
    ${o ? `<div class="cd-mean">${o.means.map(esc).join('<br>')}</div>` : '<p class="muted">Từ này chưa có trong danh sách từ vựng của bài – vẫn nghe được phát âm và xem các câu có từ này.</p>'}
    ${o ? `<h4>Mức độ thuộc</h4><div class="status-row">
      <button class="btn ${st === 'new' ? 'sel-new' : ''}" data-en-status="new">Chưa học</button>
      <button class="btn ${st === 'learning' ? 'sel-learning' : ''}" data-en-status="learning">Đang học</button>
      <button class="btn ${st === 'known' ? 'sel-known' : ''}" data-en-status="known">Đã thuộc ✓</button></div>` : ''}
    <h4 class="sec-title">Gặp trong bài (${sents.length})</h4>
    <div class="wi-uses">${sents.map(j => `<button class="use" data-en-open="${j}"><span class="use-n">Câu ${j + 1}</span><span>${enSnippet(EN_S[j].en, o ? new Set([...o.forms, o.k]) : new Set([k]))}</span></button>`).join('') || '<span class="muted">—</span>'}</div>`;
  modalStack.at(-1).k = k;
}

/* ---------- Luyện đọc: nghe mẫu → đọc to → máy chấm ---------- */
const SRec = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, mediaRec = null;
function stopRec() { try { rec?.abort(); } catch (e) { } rec = null; try { if (mediaRec && mediaRec.state !== 'inactive') mediaRec.stop(); } catch (e) { } }
const normWords = t => t.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9'\s-]/g, ' ').replace(/-/g, ' ').split(/\s+/).filter(Boolean);
// So khớp từ theo dãy con chung dài nhất (LCS) → đánh dấu từ đọc đúng/thiếu
function lcsMatch(target, said) {
  const n = target.length, m = said.length, L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let a = n - 1; a >= 0; a--) for (let b = m - 1; b >= 0; b--) L[a][b] = target[a] === said[b] ? L[a + 1][b + 1] + 1 : Math.max(L[a + 1][b], L[a][b + 1]);
  const ok = new Array(n).fill(false); let a = 0, b = 0;
  while (a < n && b < m) { if (target[a] === said[b]) { ok[a] = true; a++; b++; } else if (L[a + 1][b] >= L[a][b + 1]) a++; else b++; }
  return ok;
}
function markedTarget(text, ok) {
  let k = 0;
  return esc(text).replace(/[A-Za-z0-9][A-Za-z0-9’'\-]*/g, w => {
    const parts = normWords(w.replace(/&#39;/g, "'")); let cls = 'ok';
    parts.forEach(() => { if (!ok[k++]) cls = 'miss'; });
    return `<span class="rw ${cls}">${w}</span>`;
  });
}
function drawReadPane(pane, i) {
  const s = EN_S[i];
  const chunks = (s.eg || []).filter(c => c[1] !== 'P');
  pane.innerHTML = `
    <p class="sv-lead"><b>Cách luyện:</b> ① Nghe mẫu (có thể nghe chậm) ② Đọc theo từng cụm ③ Bấm 🎙 và đọc to cả câu – máy sẽ tô <span class="rw ok">xanh</span> từ đọc đúng, <span class="rw miss">đỏ</span> từ cần đọc lại.</p>
    <div class="sv-h">① Đọc theo từng cụm <small>(chạm để nghe cụm)</small></div>
    <div class="shadow-chunks">${chunks.map(([t, r, g]) => `<button class="shadow-c r-${r}" data-en-tts="${esc(t)}"><span>${esc(t)}</span><small>${esc(g)}</small></button>`).join('')}</div>
    <div class="sv-h">② Đọc to cả câu</div>
    <div class="rd-target" id="rdTarget">${esc(s.en)}</div>
    <div class="btn-row" style="margin-top:10px">
      <button class="btn" data-en-say="${i}">🔊 Nghe mẫu</button><button class="btn" data-en-say="${i}" data-slow>🐢 Chậm</button>
      <button class="btn primary" id="rdMic">${SRec ? '🎙 Bấm rồi đọc to' : '⏺ Ghi âm giọng tôi'}</button>
    </div>
    <div id="rdOut" class="rd-out"></div>
    ${SRec ? '' : '<p class="muted small">Trình duyệt này không có nhận dạng giọng nói (Chrome/Edge trên Android/máy tính và Safari trên iPhone thường có). Bạn vẫn có thể ghi âm rồi nghe lại để tự so với giọng mẫu.</p>'}`;
  $('#rdMic').onclick = () => SRec ? startRecognize(i) : recordSelf();
  epUI();
}
function startRecognize(i) {
  const s = EN_S[i], out = $('#rdOut'), btn = $('#rdMic');
  if (rec) { stopRec(); btn.textContent = '🎙 Bấm rồi đọc to'; return; }
  stopSpeech();
  rec = new SRec(); rec.lang = 'en-US'; rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 1;
  btn.textContent = '⏹ Dừng'; btn.classList.add('rec'); out.innerHTML = '<span class="muted">🎙 Đang nghe… hãy đọc to cả câu.</span>';
  let finalText = '';
  rec.onresult = e => {
    let txt = ''; for (const r of e.results) txt += r[0].transcript + ' ';
    finalText = txt.trim(); out.innerHTML = `<span class="muted">Máy nghe được:</span> “${esc(finalText)}”`;
  };
  rec.onerror = e => { out.innerHTML = `<span class="quiz-msg bad">${e.error === 'not-allowed' ? 'Bạn chưa cho phép dùng micro. Hãy bật quyền micro cho trang này.' : e.error === 'no-speech' ? 'Không nghe thấy gì – thử lại và nói gần micro hơn.' : 'Lỗi nhận giọng: ' + esc(e.error)}</span>`; };
  rec.onend = () => {
    rec = null; btn.textContent = '🎙 Đọc lại'; btn.classList.remove('rec');
    if (!finalText) return;
    const target = normWords(s.en), ok = lcsMatch(target, normWords(finalText));
    const score = Math.round(100 * ok.filter(Boolean).length / Math.max(1, target.length));
    $('#rdTarget').innerHTML = markedTarget(s.en, ok);
    out.innerHTML = `<div class="rd-score ${score >= 85 ? 'good' : score >= 60 ? 'mid' : 'low'}">${score}%</div>
      <div><span class="muted">Máy nghe được:</span> “${esc(finalText)}”</div>
      <div class="muted small" style="margin-top:4px">${score >= 85 ? '🎉 Rất tốt! Thử đọc nhanh và tự nhiên hơn nhé.' : score >= 60 ? '👍 Khá tốt. Nghe lại các từ màu đỏ rồi đọc lại.' : 'Hãy nghe chậm, đọc theo từng cụm ở trên rồi thử lại.'}</div>`;
  };
  try { rec.start(); } catch (e) { rec = null; btn.textContent = '🎙 Bấm rồi đọc to'; }
}
async function recordSelf() {
  const out = $('#rdOut'), btn = $('#rdMic');
  if (mediaRec && mediaRec.state === 'recording') { mediaRec.stop(); return; }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const chunks = []; mediaRec = new MediaRecorder(stream);
    mediaRec.ondataavailable = e => chunks.push(e.data);
    mediaRec.onstop = () => {
      stream.getTracks().forEach(t => t.stop()); btn.textContent = '⏺ Ghi âm lại';
      const url = URL.createObjectURL(new Blob(chunks, { type: mediaRec.mimeType || 'audio/webm' }));
      out.innerHTML = `<div class="muted">Giọng của bạn:</div><audio controls src="${url}" style="width:100%"></audio>`;
    };
    mediaRec.start(); btn.textContent = '⏹ Dừng ghi'; out.innerHTML = '<span class="muted">⏺ Đang ghi âm… đọc to cả câu rồi bấm Dừng.</span>';
  } catch (e) { out.innerHTML = '<span class="quiz-msg bad">Không dùng được micro (chưa cấp quyền hoặc máy không hỗ trợ).</span>'; }
}

/* ---------- Luyện viết: nghe – chép, điền từ, xếp cụm ---------- */
const WMODES = [['dict', '🎧 Nghe – chép'], ['cloze', '🔤 Điền từ'], ['order', '🧱 Xếp cụm']];
function drawWritePane(pane, v) {
  const i = v.i, s = EN_S[i]; v.wm ||= 'dict';
  pane.innerHTML = `<div class="seg sm">${WMODES.map(([k, n]) => `<button class="${v.wm === k ? 'on' : ''}" data-en-wm="${k}">${n}</button>`).join('')}</div><div id="wrPane"></div>`;
  const P = $('#wrPane');
  if (v.wm === 'dict') {
    P.innerHTML = `<p class="sv-lead">Nghe câu (bấm nhiều lần, có thể nghe chậm) rồi gõ lại chính xác. Không cần phân biệt hoa/thường.</p>
      <div class="btn-row"><button class="btn" data-en-say="${i}">🔊 Nghe</button><button class="btn" data-en-say="${i}" data-slow>🐢 Chậm</button><button class="btn" id="dcHint">💡 Gợi ý chữ cái đầu</button></div>
      <div id="dcHintBox" class="muted dc-hint"></div>
      <textarea id="dcIn" rows="4" class="en-input" placeholder="Gõ câu bạn nghe được…" autocapitalize="off" autocomplete="off" spellcheck="false"></textarea>
      <div class="btn-row"><button class="btn primary" id="dcCheck">Kiểm tra</button><button class="btn" id="dcShow">Xem đáp án</button></div>
      <div id="dcOut" class="rd-out"></div>`;
    $('#dcHint').onclick = () => $('#dcHintBox').textContent = s.en.replace(/([A-Za-z])([A-Za-z’'\-]*)/g, (m, a, b) => a + b.replace(/[A-Za-z]/g, '_'));
    $('#dcCheck').onclick = () => {
      const target = normWords(s.en), said = normWords($('#dcIn').value), ok = lcsMatch(target, said);
      const score = Math.round(100 * ok.filter(Boolean).length / Math.max(1, target.length));
      $('#dcOut').innerHTML = `<div class="rd-score ${score >= 95 ? 'good' : score >= 70 ? 'mid' : 'low'}">${score}%</div><div class="rd-target">${markedTarget(s.en, ok)}</div>
        <div class="muted small">Từ màu đỏ là từ bạn còn thiếu hoặc viết sai chính tả.</div>`;
    };
    $('#dcShow').onclick = () => { $('#dcOut').innerHTML = `<div class="rd-target">${esc(s.en)}</div>`; };
  } else if (v.wm === 'cloze') {
    const keys = [...new Set((s.v || []).map(x => x[0]).filter(f => !/\s/.test(f)))];
    let html = esc(s.en), n = 0;
    keys.sort((a, b) => b.length - a.length).forEach(f => {
      const re = new RegExp(`\\b${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
      html = html.replace(re, m => `<input class="cz" data-ans="${esc(m)}" size="${Math.max(3, m.length)}" autocapitalize="off" autocomplete="off" spellcheck="false" aria-label="ô trống ${++n}">`);
    });
    const bank = shuffle(keys);
    P.innerHTML = `<p class="sv-lead">Điền từ còn thiếu (gợi ý ở ngân hàng từ bên dưới). Bấm 🔊 để nghe câu.</p>
      <div class="btn-row"><button class="btn" data-en-say="${i}">🔊 Nghe</button><button class="btn" data-en-say="${i}" data-slow>🐢 Chậm</button></div>
      <div class="cz-bank">${bank.map(w => `<span class="chip">${esc(w)}</span>`).join('')}</div>
      <div class="rd-target cz-text">${html}</div>
      <div class="btn-row"><button class="btn primary" id="czCheck">Kiểm tra</button><button class="btn" id="czShow">Xem đáp án</button></div><div id="czOut" class="rd-out"></div>`;
    $('#czCheck').onclick = () => {
      let good = 0; const all = $$('.cz');
      all.forEach(el => { const ok = enKey(el.value) === enKey(el.dataset.ans); el.classList.toggle('ok', ok); el.classList.toggle('bad', !ok); if (ok) good++; });
      $('#czOut').innerHTML = `<div class="rd-score ${good === all.length ? 'good' : 'mid'}">${good}/${all.length}</div>`;
    };
    $('#czShow').onclick = () => $$('.cz').forEach(el => { el.value = el.dataset.ans; el.classList.add('ok'); el.classList.remove('bad'); });
  } else {
    const parts = (s.eg || []).map(c => c[0]).reduce((a, t) => { if (/^[\s.,;:!?”’"—–)\]]+$/.test(t) && a.length) a[a.length - 1] += t; else a.push(t); return a; }, []);
    let pool = shuffle(parts.map((t, k) => ({ t, k }))), built = [];
    const draw = () => {
      P.innerHTML = `<p class="sv-lead">Chạm lần lượt các cụm để xếp lại đúng thứ tự câu tiếng Anh. Chạm cụm đã xếp để bỏ ra. Nghĩa tiếng Việt: <i>${esc(LESSON_LIST[i].viOff)}</i></p>
        <div class="ord-built">${built.map((x, k) => `<button class="chip on" data-ord-back="${k}">${esc(x.t)}</button>`).join('') || '<span class="muted">…</span>'}</div>
        <div class="ord-pool">${pool.map((x, k) => `<button class="chip" data-ord="${k}">${esc(x.t)}</button>`).join('')}</div>
        <div class="btn-row"><button class="btn" data-en-say="${i}">🔊 Nghe</button><button class="btn" id="ordReset">Làm lại</button></div><div id="ordOut" class="rd-out"></div>`;
      $$('[data-ord]').forEach(b => b.onclick = () => { built.push(pool.splice(+b.dataset.ord, 1)[0]); draw(); });
      $$('[data-ord-back]').forEach(b => b.onclick = () => { pool.push(built.splice(+b.dataset.ordBack, 1)[0]); draw(); });
      $('#ordReset').onclick = () => { pool = shuffle(parts.map((t, k) => ({ t, k }))); built = []; draw(); };
      if (!pool.length) {
        const ok = built.every((x, k) => x.t === parts[k]);
        $('#ordOut').innerHTML = ok ? '<div class="quiz-msg ok">🎉 Chính xác!</div>' : `<div class="quiz-msg bad">Chưa đúng thứ tự. Đáp án:</div><div class="rd-target">${esc(s.en)}</div>`;
      }
      epUI();
    };
    draw();
  }
  epUI();
}

/* ---------- Tab "Tiếng Anh" ---------- */
const EN_VIEWS = [['read', '📖 Đọc'], ['vocab', '📚 Từ vựng'], ['gram', '📐 Ngữ pháp'], ['practice', '🎯 Luyện tập']];
let enView = 'read', vocabQ = '', vocabSt = 'all', EV = null;
function enRange() {
  if (SECTIONS) { const S = SECTIONS[curSec()]; return { a: S.a, b: S.b }; }
  return { a: 0, b: LESSONS.length - 1 };
}
renderers.english = () => {
  const el = $('#tab-english');
  if (!ED) { el.innerHTML = '<div class="panel"><p class="muted">Bài này chưa có dữ liệu tiếng Anh.</p></div>'; return; }
  el.innerHTML = `
    <div class="tx-head">
      <div><h2>🇬🇧 ${esc(BOOK.en || BOOK.vi)} <button class="btn sm book-sw" data-books>📚 Đổi bài</button></h2>
        <p class="tx-hint">Học tiếng Anh qua bản dịch chính thức: nghe, phiên âm IPA, ngữ pháp, từ vựng, luyện đọc và luyện viết từng câu.</p></div>
    </div>
    <div class="seg en-views">${EN_VIEWS.map(([k, n]) => `<button class="${enView === k ? 'on' : ''}" data-en-view="${k}">${n}</button>`).join('')}</div>
    <div id="enBody"></div>`;
  drawEnView();
};
function scrollSecNav() { $$('.sec-nav').forEach(n => { const on = n.querySelector('.on'); if (on) n.scrollLeft = on.offsetLeft - n.offsetLeft - 24; }); }
function drawEnView() {
  const B = $('#enBody'); if (!B) return;
  if (enView === 'read') drawEnRead(B);
  else if (enView === 'vocab') drawEnVocab(B);
  else if (enView === 'gram') drawEnGram(B);
  else drawEnPractice(B);
  epUI(); scrollSecNav();
}
function drawEnRead(B) {
  const sec = curSec(), S = sec >= 0 ? SECTIONS[sec] : null, r = enRange();
  const paras = PARAS.filter(([a]) => a >= r.a && a <= r.b);
  B.innerHTML = `
    <div class="tx-tools en-tools">
      <div class="pills">${pill('ipa', 'IPA')}${pill('viOn', 'Tiếng Việt')}${pill('zhOn', '中文')}</div>
      <button class="btn ft-btn" data-en-all></button>
    </div>
    ${S ? `<div class="sec-nav">${SECTIONS.map((x, k) => `<button class="chip ${k === sec ? 'on' : ''}" data-en-sec="${k}">${k + 1}. ${esc(x.en || x.vi)}</button>`).join('')}</div>
      <h3 class="sec-head"><span>${esc(S.en)}</span><small>${esc(S.vi)}</small></h3>` : ''}
    <p class="tx-hint">👆 Chạm vào một câu để học ngữ pháp, từ vựng, luyện đọc và viết.</p>
    ${paras.map(([a, b]) => `<div class="tx-para">${EN_S.slice(a, b + 1).map((s, k) => {
      const i = a + k; if (!s?.en) return '';
      return `<div class="sent en-row" data-en-sent="${i}" role="button" tabindex="0">
        <div class="sent-side"><span class="sent-n">${i + 1}</span><button class="sent-spk" data-en-say="${i}" data-icon title="Nghe câu này">🔊</button></div>
        <div class="sent-body"><div class="en-reader">${enReader(s.en, false)}</div><div class="sent-vi">${esc(LESSON_LIST[i].viOff)}</div><div class="en-zh hz">${esc(LESSON_LIST[i].text)}</div></div></div>`;
    }).join('')}</div>`).join('')}
    ${S ? `<div class="lesson-nav"><button class="btn" data-en-sec="${sec - 1}" ${sec === 0 ? 'disabled' : ''}>‹ Mục trước</button><span class="muted">Mục ${sec + 1} / ${SECTIONS.length}</span><button class="btn" data-en-sec="${sec + 1}" ${sec === SECTIONS.length - 1 ? 'disabled' : ''}>Mục sau ›</button></div>` : ''}
    <p class="tx-src">English: <a href="${esc(ED.source || '#')}" target="_blank" rel="noopener">en.falundafa.org</a> · Phiên âm IPA theo giọng Mỹ (CMU Pronouncing Dictionary).</p>`;
}
function drawEnVocab(B) {
  if (EV) return drawEnReview(B);
  const q = vocabQ.trim().toLowerCase(), qf = fold(q);
  const r = enRange();
  const list = VOCAB_LIST.filter(o => {
    const st = status('en:' + o.k);
    if (vocabSt === 'sec' ? !o.sents.some(i => i >= r.a && i <= r.b) : vocabSt !== 'all' && st !== vocabSt) return false;
    return !q || o.k.includes(q) || [...o.forms].some(f => f.includes(q)) || fold(o.means.join(' ')).includes(qf);
  });
  const cnt = s => VOCAB_LIST.filter(o => status('en:' + o.k) === s).length;
  B.innerHTML = `
    <div class="toolbar">
      <input type="search" id="vbQ" placeholder="Tìm từ tiếng Anh hoặc nghĩa tiếng Việt…" value="${esc(vocabQ)}">
      <select id="vbSt"><option value="all">Tất cả (${VOCAB_LIST.length})</option>${SECTIONS ? '<option value="sec">Mục đang học</option>' : ''}<option value="new">Chưa học (${cnt('new')})</option><option value="learning">Đang học (${cnt('learning')})</option><option value="known">Đã thuộc (${cnt('known')})</option></select>
    </div>
    <div class="btn-row" style="margin-bottom:12px">
      <button class="btn primary" data-ev-start="flash">🃏 Ôn thẻ từ</button>
      <button class="btn" data-ev-start="spell">🎧 Nghe – viết từ</button>
      <button class="btn" data-ev-start="mean">✅ Chọn nghĩa đúng</button>
      <span class="muted" style="align-self:center">Ôn theo danh sách đang lọc (${list.length} từ), ưu tiên từ đến hạn ôn.</span>
    </div>
    <div class="vgrid">${list.slice(0, 400).map(o => vocabCard(o)).join('') || '<p class="muted">Không có từ nào.</p>'}</div>
    ${list.length > 400 ? `<p class="muted">Đang hiện 400/${list.length} từ – hãy tìm hoặc lọc để thu hẹp.</p>` : ''}`;
  $('#vbQ').oninput = e => { vocabQ = e.target.value; const pos = e.target.selectionStart; drawEnVocab(B); const n = $('#vbQ'); n.focus(); n.setSelectionRange(pos, pos); };
  $('#vbSt').value = vocabSt; $('#vbSt').onchange = e => { vocabSt = e.target.value; drawEnVocab(B); };
  B._list = list;
}
function startEnReview(mode) {
  const list = $('#enBody')._list || VOCAB_LIST;
  const due = list.filter(o => isDue('en:' + o.k)).sort((a, b) => SRS['en:' + a.k].d - SRS['en:' + b.k].d);
  const fresh = list.filter(o => !SRS['en:' + o.k]);
  const rest = list.filter(o => SRS['en:' + o.k] && !isDue('en:' + o.k));
  const items = [...due, ...fresh, ...shuffle(rest)].slice(0, 15).map(o => o.k);
  if (!items.length) return toast('Không có từ nào để ôn.');
  if (currentTab === 'english') pushHist();
  EV = { mode, items: shuffle(items), pos: 0, good: 0, done: false };
  drawEnView();
}
function exampleOf(o) { const i = o.sents[0]; return i != null ? { i, html: enSnippet(EN_S[i].en, new Set([...o.forms, o.k])), vi: LESSON_LIST[i].viOff } : null; }
function drawEnReview(B) {
  if (EV.pos >= EV.items.length) {
    B.innerHTML = `<div class="rv-stage"><div class="panel rv-card"><h2>Xong lượt ôn 🎉</h2><div class="summary-num">${EV.good}/${EV.items.length}</div><p class="muted">từ nhớ tốt</p>
      <div class="btn-row" style="justify-content:center"><button class="btn primary" data-ev-start="${EV.mode}">Ôn lượt mới</button><button class="btn" id="evQuit">Về danh sách từ</button></div></div></div>`;
    $('#evQuit').onclick = () => { EV = null; drawEnView(); };
    return;
  }
  const o = VOCAB[EV.items[EV.pos]], ex = exampleOf(o), ip = ipaOf(o.lemma);
  const top = `<div class="rv-top"><span>${EV.pos + 1} / ${EV.items.length}</span><div class="bar" style="flex:1;margin:0 14px"><i style="width:${100 * EV.pos / EV.items.length}%"></i></div><button class="btn" id="evStop">Kết thúc</button></div>`;
  const back = `<div class="ew-word">${esc(o.lemma)}</div><div class="ew-ipa">${ip ? '/' + esc(ip) + '/' : ''} <button class="icon" data-en-word="${esc(o.lemma)}">🔊</button></div>
    <div class="vp">${esc(POS[o.pos] || '')}</div><div style="font-size:18px;margin:6px 0">${o.means.map(esc).join('; ')}</div>
    ${ex ? `<div class="ex en-ex">${ex.html}<br><small class="muted">${esc(ex.vi)}</small></div>` : ''}`;
  const grades = `<div class="grades"><button class="btn g0" data-ev-grade="0">Quên<small>5 phút</small></button><button class="btn g1" data-ev-grade="1">Khó<small>1 ngày</small></button><button class="btn g2" data-ev-grade="2">Nhớ</button><button class="btn g3" data-ev-grade="3">Dễ</button></div>`;
  if (EV.mode === 'flash') {
    B.innerHTML = `<div class="rv-stage">${top}<div class="panel rv-card">
      <div class="ew-word big">${esc(o.lemma)}</div><div class="ew-ipa">${ip ? '/' + esc(ip) + '/' : ''} <button class="icon" data-en-word="${esc(o.lemma)}">🔊</button></div>
      ${ex ? `<div class="ex en-ex">${ex.html}</div>` : ''}
      <div id="evBack"></div><button class="btn primary" id="evFlip" style="margin-top:14px;padding:10px 26px">Lật thẻ – xem nghĩa</button></div></div>`;
    $('#evFlip').onclick = () => { $('#evFlip').remove(); $('#evBack').innerHTML = `<div class="rv-back">${back}${grades}</div>`; };
    sayWord(o.lemma);
  } else if (EV.mode === 'spell') {
    B.innerHTML = `<div class="rv-stage">${top}<div class="panel rv-card">
      <p class="muted">Nghe rồi viết từ tiếng Anh có nghĩa:</p><div style="font-size:19px;margin-bottom:8px"><b>${o.means.map(esc).join('; ')}</b> <span class="vp">(${esc(POS[o.pos] || '')})</span></div>
      <div class="btn-row" style="justify-content:center"><button class="btn" data-en-word="${esc(o.lemma)}">🔊 Nghe</button><button class="btn" id="evHint">💡 Gợi ý</button></div>
      <div id="evHintBox" class="dc-hint muted"></div>
      <input id="evIn" class="en-input" style="text-align:center;font-size:22px;margin-top:10px" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="gõ từ…">
      <div class="btn-row" style="justify-content:center;margin-top:10px"><button class="btn primary" id="evCheck">Kiểm tra</button></div><div id="evBack"></div></div></div>`;
    let hints = 0;
    $('#evHint').onclick = () => { hints++; const w = o.lemma; $('#evHintBox').textContent = w.slice(0, hints) + w.slice(hints).replace(/[A-Za-z]/g, '_'); };
    const check = () => {
      const ok = enKey($('#evIn').value) === o.k || [...o.forms].includes(enKey($('#evIn').value));
      $('#evIn').classList.toggle('ok', ok); $('#evIn').classList.toggle('bad', !ok);
      $('#evCheck').remove();
      $('#evBack').innerHTML = `<div class="rv-back"><div class="quiz-msg ${ok ? 'ok' : 'bad'}">${ok ? '✓ Chính xác!' : '✗ Đáp án đúng:'}</div>${back}<button class="btn primary" data-ev-grade="${ok ? (hints ? 1 : 2) : 0}" style="margin-top:12px">Tiếp ›</button></div>`;
    };
    $('#evCheck').onclick = check; $('#evIn').onkeydown = e => { if (e.key === 'Enter' && $('#evCheck')) check(); };
    sayWord(o.lemma); setTimeout(() => $('#evIn')?.focus(), 50);
  } else {
    const others = shuffle(VOCAB_LIST.filter(x => x.k !== o.k && x.means[0] && x.means[0] !== o.means[0])).slice(0, 3);
    const opts = shuffle([o, ...others]);
    B.innerHTML = `<div class="rv-stage">${top}<div class="panel rv-card">
      <div class="ew-word big">${esc(o.lemma)}</div><div class="ew-ipa">${ip ? '/' + esc(ip) + '/' : ''} <button class="icon" data-en-word="${esc(o.lemma)}">🔊</button></div>
      <p class="muted">Nghĩa đúng là?</p>
      <div class="choices">${opts.map((x, k) => `<button class="choice" data-ev-ans="${esc(x.k)}"><span class="kbd">${k + 1}</span> ${esc(x.means[0])}</button>`).join('')}</div><div id="evBack"></div></div></div>`;
    $$('[data-ev-ans]').forEach(b => b.onclick = () => {
      if (EV.answered) return; EV.answered = true;
      const ok = b.dataset.evAns === o.k;
      $$('[data-ev-ans]').forEach(x => { x.disabled = true; if (x.dataset.evAns === o.k) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      $('#evBack').innerHTML = `<div class="rv-back">${back}<button class="btn primary" data-ev-grade="${ok ? 2 : 0}" style="margin-top:12px">Tiếp ›</button></div>`;
    });
    EV.answered = false; sayWord(o.lemma);
  }
  $('#evStop').onclick = () => { EV.items = EV.items.slice(0, EV.pos); drawEnView(); };
}
function drawEnGram(B) {
  B.innerHTML = `<div class="panel" style="margin-bottom:14px"><h2>Ngữ pháp tiếng Anh trong bài <small>${EN_GRAM.length} điểm ngữ pháp</small></h2>
    <p class="muted" style="margin:6px 0">Khác biệt lớn với tiếng Việt: động từ đổi dạng theo <b>thì</b> (have been, was, will…); tính từ đứng <b>trước</b> danh từ (<i>the entire society</i> = toàn xã hội); mệnh đề <b>who / which / that</b> bổ nghĩa đứng sau danh từ.</p>
    ${roleLegend()}<input type="search" id="egQ" placeholder="Tìm điểm ngữ pháp… (vd: passive, hiện tại hoàn thành, if)" style="width:100%;margin-top:10px"></div>
    <div class="g-notes" id="egList"></div>`;
  const draw = () => {
    const q = fold($('#egQ').value.trim());
    $('#egList').innerHTML = EN_GRAM.filter(e => !q || fold(e.p + ' ' + e.title + ' ' + e.ex).includes(q)).map(e => `<div class="g-note en-note"><div class="g-pat">${esc(e.p)}</div><div class="g-title">${esc(e.title)}</div><div class="g-ex">${esc(e.ex)}</div>
      <div class="sv-seen">Gặp ở (${e.sents.length}): ${e.sents.slice(0, 16).map(x => `<button class="chip" data-en-open="${x}" data-en-tab="gram">Câu ${x + 1}</button>`).join('')}${e.sents.length > 16 ? ` <span class="muted">… +${e.sents.length - 16}</span>` : ''}</div></div>`).join('') || '<p class="muted">Không tìm thấy.</p>';
  };
  $('#egQ').oninput = draw; draw();
}
function drawEnPractice(B) {
  const r = enRange();
  const sents = []; for (let i = r.a; i <= r.b; i++) if (EN_S[i]?.en) sents.push(i);
  const pick = () => sents[Math.random() * sents.length | 0];
  const cards = [
    ['write', 'dict', '🎧 Nghe – chép chính tả', 'Nghe một câu ngẫu nhiên rồi gõ lại. Máy chỉ ra từ sai.'],
    ['read', '', '🗣 Luyện đọc to', 'Đọc một câu ngẫu nhiên, máy nhận giọng và chấm điểm từng từ.'],
    ['write', 'cloze', '🔤 Điền từ vào câu', 'Điền các từ vựng còn thiếu trong câu.'],
    ['write', 'order', '🧱 Xếp cụm thành câu', 'Sắp xếp lại các cụm từ cho đúng trật tự câu tiếng Anh.'],
  ];
  B.innerHTML = `<p class="muted">Luyện với câu ngẫu nhiên trong ${SECTIONS ? `mục <b>${curSec() + 1}. ${esc(SECTIONS[curSec()].en)}</b> (đổi mục ở phần 📖 Đọc)` : 'bài'} – ${sents.length} câu.</p>
    <div class="practice-grid">${cards.map(([tab, wm, t, d]) => `<button class="panel practice-card" data-en-rand="${tab}" data-wm="${wm}"><b>${t}</b><span class="muted">${d}</span></button>`).join('')}
      <button class="panel practice-card" data-ev-start="flash" data-goto-vocab><b>🃏 Ôn thẻ từ vựng</b><span class="muted">Lặp lại ngắt quãng các từ tiếng Anh của bài.</span></button></div>`;
  B._pick = pick;
}

/* ---------- Sự kiện ---------- */
function openEnSent(i, tab = 'gram', wm) { if (i < 0 || !EN_S[i]?.en) return; openModal({ type: 'ensent', i, tab, wm }); }
function enClick(e, t) {
  const say = t.closest('[data-en-say]'); if (say) { epToggle(say); return true; }
  const all = t.closest('[data-en-all]'); if (all) { epAll(); return true; }
  const ws = t.closest('[data-en-word]'); if (ws) { sayWord(ws.dataset.enWord); return true; }
  const tts = t.closest('[data-en-tts]'); if (tts) { stopSpeech(); ttsEn(tts.dataset.enTts, 0.85); return true; }
  const vw = t.closest('[data-en-view]'); if (vw) { enView = vw.dataset.enView; EV = null; renderers.english(); return true; }
  const es = t.closest('[data-en-sec]'); if (es) { if (es.disabled) return true; stopSpeech(); setSecQuiet(+es.dataset.enSec); drawEnView(); window.scrollTo({ top: 0 }); return true; }
  const evs = t.closest('[data-ev-start]'); if (evs) { if (evs.hasAttribute('data-goto-vocab')) { enView = 'vocab'; renderers.english(); } startEnReview(evs.dataset.evStart); return true; }
  const evg = t.closest('[data-ev-grade]'); if (evg) { const o = VOCAB[EV.items[EV.pos]], q = +evg.dataset.evGrade; grade('en:' + o.k, q); if (q >= 2) EV.good++; EV.pos++; drawEnView(); return true; }
  const rnd = t.closest('[data-en-rand]'); if (rnd) { const i = $('#enBody')._pick?.(); if (i != null) openEnSent(i, rnd.dataset.enRand, rnd.dataset.wm || undefined); return true; }
  const op = t.closest('[data-en-open]'); if (op) {
    const i = +op.dataset.enOpen, tab = op.dataset.enTab || 'gram';
    if (!$('#modal').hidden && modalStack.at(-1)?.type === 'ensent') { modalStack[modalStack.length - 1] = { type: 'ensent', i, tab }; openModal(modalStack.at(-1), false); }
    else openEnSent(i, tab);
    return true;
  }
  const nav = t.closest('[data-en-nav]'); if (nav) { if (!nav.disabled) { const v = modalStack.at(-1); modalStack[modalStack.length - 1] = { ...v, i: +nav.dataset.enNav, wm: undefined }; openModal(modalStack.at(-1), false); } return true; }
  const tsw = t.closest('[data-en-tab-sw]'); if (tsw) { const v = modalStack.at(-1); v.tab = tsw.dataset.enTabSw; $$('[data-en-tab-sw]').forEach(b => b.classList.toggle('on', b === tsw)); drawEnPane(v); epUI(); return true; }
  const wm = t.closest('[data-en-wm]'); if (wm) { const v = modalStack.at(-1); v.wm = wm.dataset.enWm; drawEnPane(v); return true; }
  const stb = t.closest('[data-en-status]'); if (stb) { const k = modalStack.at(-1)?.k; if (k) { setStatus('en:' + k, stb.dataset.enStatus); $$('[data-en-status]').forEach(b => b.className = 'btn' + (b.dataset.enStatus === status('en:' + k) ? ' sel-' + status('en:' + k) : '')); toast('Đã cập nhật'); } return true; }
  const zh = t.closest('[data-sent-zh]'); if (zh) { openModal({ type: 'sent', i: +zh.dataset.sentZh, tab: 'gram', wc: 0 }); return true; }
  const ew = t.closest('[data-ew]'); if (ew) { openModal({ type: 'enword', k: ew.dataset.ew }); return true; }
  const row = t.closest('[data-en-sent]'); if (row) { openEnSent(+row.dataset.enSent); return true; }
  return false;
}
function setSecQuiet(k) { if (!SECTIONS || k < 0 || k >= SECTIONS.length) return; SETTINGS['sec_' + BOOK.id] = k; saveSettings(); }
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) return;
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-en-sent]') && $('#modal').hidden) { e.preventDefault(); openEnSent(+e.target.dataset.enSent); }
});
// Bật/tắt hiển thị
const _applyToggles = applyToggles;
function applyEnToggles() { document.body.classList.toggle('show-ipa', !!SETTINGS.ipa); document.body.classList.toggle('show-zh', !!SETTINGS.zhOn); }
document.addEventListener('click', e => { if (e.target.closest('[data-pill="ipa"], [data-pill="zhOn"]')) setTimeout(() => { applyEnToggles(); $$('[data-pill="ipa"]').forEach(b => b.classList.toggle('on', !!SETTINGS.ipa)); }, 0); });
applyEnToggles();
if (!ED) $('#tabs [data-tab="english"]')?.remove();
const _closeModal = closeModal;
