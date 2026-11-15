// Chọn bài (cuốn sách) đang học rồi nạp đúng dữ liệu của bài đó, sau cùng là app.
// Thêm bài mới: khai báo ở BOOKS + tạo các file dữ liệu cùng định dạng (xem README).
(function () {
  var BOOKS = {
    lunyu: {
      id: 'lunyu', zh: '論語', vi: 'Luận ngữ', en: 'Lunyu', short: 'Luận ngữ',
      desc: '20 câu · 250 chữ – bài mở đầu, ngữ pháp phân tích kỹ từng câu.',
      audio: 'audio/', slowFiles: true,
      files: ['js/data-words.js', 'js/data-grammar.js', 'js/data-vi.js', 'js/books/lunyu/en.js'],
    },
    zfl1: {
      id: 'zfl1', zh: '轉法輪 · 第一講', vi: 'Chuyển Pháp Luân – Bài giảng thứ nhất', en: 'Zhuan Falun – Lecture One', short: 'Bài giảng 1',
      desc: '7 mục · 672 câu · ~1000 chữ – có bản tiếng Việt và tiếng Anh từng câu.',
      audio: 'audio/zfl1/', slowFiles: false,
      files: ['js/books/zfl1/words.js', 'js/books/zfl1/grammar.js', 'js/books/zfl1/vi.js', 'js/books/zfl1/en.js'],
    },
  };
  var id = null;
  try { id = new URLSearchParams(location.search).get('book'); } catch (e) {}
  if (!id || !BOOKS[id]) { try { id = localStorage.getItem('hht_book') || (JSON.parse(localStorage.getItem('hht_settings') || '{}').book); } catch (e) {} }
  if (!id || !BOOKS[id]) id = 'lunyu';
  try { localStorage.setItem('hht_book', id); } catch (e) {}
  window.BOOKS = BOOKS; window.BOOK = BOOKS[id];
  var files = ['js/vendor/hanzi-writer.min.js', 'js/data-chars.js', 'js/data-chars2.js', 'js/data-components.js', 'js/data-audio.js', 'js/data-en-gloss.js']
    .concat(BOOKS[id].files, ['js/app.js', 'js/english.js']);
  for (var i = 0; i < files.length; i++) document.write('<script src="' + files[i] + '"><\/script>');
})();
