(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => Array.from(document.querySelectorAll(selector));
  const editor = $('#editor');
  const preview = $('#preview');
  const workspace = $('#workspace');
  const filenameEl = $('#filename');
  const saveState = $('#save-state');
  const statusDot = $('#status-dot');
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.md,.markdown,.txt,text/markdown,text/plain';
  fileInput.hidden = true;
  document.body.appendChild(fileInput);

  let filename = '未命名.md';
  let dirty = false;
  let fileHandle = null;
  let toastTimer;

  const starter = [
    '# 歡迎使用墨流',
    '',
    '這是一款能在瀏覽器中直接使用的 **Markdown 編輯器**。你可以從左側開始寫作，右側會即時呈現結果。',
    '',
    '## 快速開始',
    '',
    '- 使用上方工具列插入常用格式',
    '- 在「編輯、左右、顯示」三種模式間切換',
    '- 開啟電腦中的 Markdown 檔案，完成後另存新檔',
    '',
    '> 好的工具應該退到背景，讓文字站到前景。',
    '',
    '### 小範例',
    '',
    '你可以加入 [連結](https://example.com)、`行內程式碼`，或待辦事項：',
    '',
    '- [x] 開啟墨流',
    '- [ ] 寫下今天的想法',
    '- [ ] 儲存成 Markdown 檔案',
    '',
    '| 功能 | 快捷鍵 |',
    '| --- | --- |',
    '| 粗體 | Ctrl + B |',
    '| 斜體 | Ctrl + I |',
    '| 連結 | Ctrl + K |',
    '| 儲存 | Ctrl + S |'
  ].join('\n');

  const icons = {
    'file-plus':'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6m-3 3h6"/>',
    'folder-open':'<path d="M3 19.5 5.3 10h16l-2.1 8.3a2 2 0 0 1-1.9 1.5H4.5A1.5 1.5 0 0 1 3 18.1V6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2"/>',
    'edit':'<path d="M14 2H6a2 2 0 0 0-2 2v16h16V8z"/><path d="M14 2v6h6M8 16l6-6 2 2-6 6-3 1z"/>',
    'columns':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16"/>',
    'eye':'<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="2.5"/>',
    'heading':'<path d="M6 4v16M18 4v16M6 12h12"/>',
    'bold':'<path d="M7 4h6a4 4 0 0 1 0 8H7zm0 8h7a4 4 0 0 1 0 8H7z"/>',
    'italic':'<path d="M10 4h7M7 20h7m0-16L10 20"/>',
    'strikethrough':'<path d="M17.5 7.5A5 5 0 0 0 13 5h-2a3.5 3.5 0 0 0-3.4 4.3M7 16.5A5 5 0 0 0 11.5 19h2a3.5 3.5 0 0 0 3.4-4.3M4 12h16"/>',
    'quote':'<path d="M4 17h4l2-5V6H4v6h4m4 5h4l2-5V6h-6v6h4"/>',
    'code':'<path d="m8 9-3 3 3 3m8-6 3 3-3 3m-2-9-4 12"/>',
    'code-square':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m9 9-3 3 3 3m6-6 3 3-3 3"/>',
    'list':'<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r=".5"/><circle cx="3.5" cy="12" r=".5"/><circle cx="3.5" cy="18" r=".5"/>',
    'list-ordered':'<path d="M10 6h11M10 12h11M10 18h11M4 4v4M3 4h1M3 10h2l-2 3h2m-2 3h2v4H3"/>',
    'check-square':'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="m8 12 3 3 5-6"/>',
    'link':'<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/>',
    'image':'<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1"/><path d="m21 15-5-5L5 20"/>',
    'table':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16m6-16v16"/>',
    'minus':'<path d="M5 12h14"/>'
  };

  $$('[data-icon]').forEach((node) => {
    node.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[node.dataset.icon] || '') + '</svg>';
  });

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
  }

  function inline(text) {
    const code = [];
    let value = escapeHtml(text);
    value = value.replace(/`([^`]+)`/g, (_, body) => '\u0000' + (code.push('<code>' + body + '</code>') - 1) + '\u0000');
    value = value.replace(/!\[([^\]]*)\]\(([^\s)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">');
    value = value.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|mailto:[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    value = value.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
    value = value.replace(/__([^_\n]+)__/g, '<strong>$1</strong>');
    value = value.replace(/~~([^~\n]+)~~/g, '<del>$1</del>');
    value = value.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    value = value.replace(/  \n/g, '<br>');
    return value.replace(/\u0000(\d+)\u0000/g, (_, index) => code[Number(index)]);
  }

  function renderMarkdown(source) {
    if (!source.trim()) return '<div class="empty-state"><div><strong>開始寫點什麼吧</strong>左側輸入的 Markdown 會在這裡顯示。</div></div>';
    const lines = source.replace(/\r\n?/g, '\n').split('\n');
    let html = '', paragraph = [], quote = [], table = [];

    function flushParagraph() {
      if (paragraph.length) { html += '<p>' + inline(paragraph.join('\n')) + '</p>'; paragraph = []; }
    }
    function flushQuote() {
      if (quote.length) { html += '<blockquote>' + renderMarkdown(quote.join('\n')) + '</blockquote>'; quote = []; }
    }
    function flushTable() {
      if (!table.length) return;
      const rows = table.map((row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
      html += '<table><thead><tr>' + rows[0].map((cell) => '<th>' + inline(cell) + '</th>').join('') + '</tr></thead><tbody>';
      rows.slice(2).forEach((row) => { html += '<tr>' + row.map((cell) => '<td>' + inline(cell) + '</td>').join('') + '</tr>'; });
      html += '</tbody></table>'; table = [];
    }
    function readListItem(line) {
      const match = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
      if (!match) return null;
      const task = match[3].match(/^\[([ xX])\]\s+(.+)$/);
      return {
        indent: match[1].replace(/\t/g, '  ').length,
        type: /^\d/.test(match[2]) ? 'ol' : 'ul',
        checked: task ? task[1].toLowerCase() === 'x' : null,
        text: task ? task[2] : match[3]
      };
    }
    function renderListBlock(start) {
      let output = '';
      const stack = [];
      let index = start;
      while (index < lines.length) {
        const item = readListItem(lines[index]);
        if (!item) break;
        if (!stack.length) {
          output += '<' + item.type + '><li' + (item.checked !== null ? ' class="task-item"' : '') + '>';
          stack.push({indent:item.indent, type:item.type});
        } else {
          while (stack.length && item.indent < stack[stack.length - 1].indent) {
            const level = stack.pop();
            output += '</li></' + level.type + '>';
          }
          if (!stack.length || item.indent > stack[stack.length - 1].indent) {
            output += '<' + item.type + '><li' + (item.checked !== null ? ' class="task-item"' : '') + '>';
            stack.push({indent:item.indent, type:item.type});
          } else {
            output += '</li>';
            if (item.type !== stack[stack.length - 1].type) {
              output += '</' + stack[stack.length - 1].type + '><' + item.type + '>';
              stack[stack.length - 1].type = item.type;
            }
            output += '<li' + (item.checked !== null ? ' class="task-item"' : '') + '>';
          }
        }
        if (item.checked !== null) output += '<input type="checkbox" disabled ' + (item.checked ? 'checked' : '') + '>';
        output += inline(item.text);
        index += 1;
      }
      while (stack.length) {
        const level = stack.pop();
        output += '</li></' + level.type + '>';
      }
      return {html:output, next:index};
    }

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (/^```/.test(line)) {
        flushParagraph(); flushQuote(); flushTable();
        const block = [];
        i += 1;
        while (i < lines.length && !/^```/.test(lines[i])) { block.push(lines[i]); i += 1; }
        html += '<pre><code>' + escapeHtml(block.join('\n')) + '</code></pre>';
        continue;
      }
      const tableNext = i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1]) && lines[i + 1].includes('|');
      if ((table.length || tableNext) && line.includes('|')) { flushParagraph(); flushQuote(); table.push(line); continue; }
      flushTable();
      if (/^\s*>/.test(line)) { flushParagraph(); quote.push(line.replace(/^\s*>\s?/, '')); continue; }
      flushQuote();
      if (!line.trim()) { flushParagraph(); continue; }
      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        flushParagraph();
        const level = heading[1].length;
        html += '<h' + level + '>' + inline(heading[2]) + '</h' + level + '>';
        continue;
      }
      if (/^\s*((\*\s*){3,}|(-\s*){3,}|(_\s*){3,})$/.test(line)) { flushParagraph(); html += '<hr>'; continue; }
      if (readListItem(line)) {
        flushParagraph();
        const rendered = renderListBlock(i);
        html += rendered.html;
        i = rendered.next - 1;
        continue;
      }
      paragraph.push(line);
    }
    flushParagraph(); flushQuote(); flushTable();
    return html;
  }

  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  function updateCursor() {
    const before = editor.value.slice(0, editor.selectionStart);
    const lines = before.split('\n');
    $('#cursor-position').textContent = '第 ' + lines.length + ' 行，第 ' + (lines[lines.length - 1].length + 1) + ' 欄';
  }

  function updatePreview() {
    preview.innerHTML = renderMarkdown(editor.value);
    const count = editor.value.replace(/\s+/g, '').length;
    $('#word-count').textContent = count.toLocaleString() + ' 字';
    $('#reading-time').textContent = '約 ' + Math.max(1, Math.ceil(count / 450)) + ' 分鐘閱讀';
    localStorage.setItem('inkflow-content', editor.value);
    localStorage.setItem('inkflow-filename', filename);
    updateCursor();
  }

  function markDirty(value) {
    dirty = value !== false;
    statusDot.classList.toggle('dirty', dirty);
    saveState.textContent = dirty ? '尚未儲存' : '已儲存';
    document.title = (dirty ? '● ' : '') + filename + ' — 墨流';
  }

  function setDocument(contentValue, name, saved) {
    editor.value = contentValue;
    filename = name || '未命名.md';
    filenameEl.textContent = filename;
    updatePreview();
    markDirty(saved === false);
    editor.focus();
    editor.setSelectionRange(0, 0);
    updateCursor();
  }

  function insertFormat(type) {
    if (['ul', 'ol', 'task'].includes(type)) {
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const lineStart = editor.value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
      const nextBreak = editor.value.indexOf('\n', end);
      const lineEnd = nextBreak === -1 ? editor.value.length : nextBreak;
      const prefix = type === 'ol' ? '1. ' : (type === 'task' ? '- [ ] ' : '- ');
      const converted = editor.value.slice(lineStart, lineEnd).split('\n').map((line) => {
        if (!line.trim()) return line;
        const match = line.match(/^(\s*)(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.*)$/);
        return (match ? match[1] : (line.match(/^\s*/) || [''])[0]) + prefix + (match ? match[2] : line.trimStart());
      }).join('\n');
      editor.setRangeText(converted, lineStart, lineEnd, 'select');
      editor.focus(); updatePreview(); markDirty(true);
      return;
    }

    const formats = {
      heading:['## ','','標題',true,false], bold:['**','**','粗體文字'], italic:['*','*','斜體文字'],
      strike:['~~','~~','刪除線文字'], quote:['> ','','引用文字',true,false], code:['`','`','程式碼'],
      codeblock:['```\n','\n```','程式碼',false,true], ul:['- ','','清單項目',true,false],
      ol:['1. ','','清單項目',true,false], task:['- [ ] ','','待辦事項',true,false],
      link:['[','](https://)','連結文字'], image:['![','](https://)','圖片說明'],
      table:['| 欄位一 | 欄位二 |\n| --- | --- |\n| 內容一 | 內容二 |','','',false,true],
      hr:['---','','',false,true]
    };
    const data = formats[type];
    if (!data) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.slice(start, end);
    let insert = data[0] + (selected || data[2]) + data[1];
    let offset = 0;
    if ((data[3] || data[4]) && start > 0 && editor.value[start - 1] !== '\n') {
      insert = '\n' + insert;
      offset = 1;
    }
    if (data[4] && end < editor.value.length && editor.value[end] !== '\n') insert += '\n';
    editor.setRangeText(insert, start, end, 'end');
    const selectionStart = start + offset + data[0].length;
    const selectionEnd = selectionStart + (selected || data[2]).length;
    if (selected || data[2]) editor.setSelectionRange(selectionStart, selectionEnd);
    editor.focus();
    updatePreview();
    markDirty(true);
  }

  function setMode(mode) {
    workspace.className = 'workspace ' + mode + '-mode';
    $$('.mode-button').forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
    localStorage.setItem('inkflow-mode', mode);
    if (mode !== 'preview') editor.focus();
  }

  async function openFile() {
    if (dirty && !confirm('目前有尚未儲存的內容，仍要開啟其他檔案嗎？')) return;
    if ('showOpenFilePicker' in window) {
      try {
        const handles = await window.showOpenFilePicker({
          types: [{description:'Markdown 文件', accept:{'text/markdown':['.md','.markdown'],'text/plain':['.txt']}}],
          multiple: false
        });
        fileHandle = handles[0];
        const file = await fileHandle.getFile();
        setDocument(await file.text(), file.name, true);
        showToast('已開啟 ' + file.name);
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    fileInput.click();
  }

  async function saveFile(saveAs) {
    const contentValue = editor.value;
    if ('showSaveFilePicker' in window) {
      try {
        if (!fileHandle || saveAs) {
          fileHandle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{description:'Markdown 文件', accept:{'text/markdown':['.md']}}]
          });
        }
        const writable = await fileHandle.createWritable();
        await writable.write(contentValue);
        await writable.close();
        const file = await fileHandle.getFile();
        filename = file.name;
        filenameEl.textContent = filename;
        markDirty(false);
        showToast('已儲存 ' + filename);
        return;
      } catch (error) {
        if (error.name === 'AbortError') return;
      }
    }
    const blob = new Blob([contentValue], {type:'text/markdown;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
    markDirty(false);
    showToast('已下載 ' + filename);
  }

  $('#new-file').addEventListener('click', () => {
    if (!dirty || confirm('目前有尚未儲存的內容，仍要建立新檔嗎？')) {
      fileHandle = null;
      setDocument('', '未命名.md', true);
      showToast('已建立新文件');
    }
  });
  $('#open-file').addEventListener('click', openFile);
  $('#save-file').addEventListener('click', () => saveFile(true));
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (file) {
      fileHandle = null;
      setDocument(await file.text(), file.name, true);
      showToast('已開啟 ' + file.name);
    }
    fileInput.value = '';
  });
  $$('.mode-button').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
  $$('[data-format]').forEach((button) => button.addEventListener('click', () => insertFormat(button.dataset.format)));
  editor.addEventListener('input', () => { updatePreview(); markDirty(true); });
  editor.addEventListener('click', updateCursor);
  editor.addEventListener('keyup', updateCursor);
  editor.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    event.preventDefault();
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const lineStart = editor.value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const nextBreak = editor.value.indexOf('\n', end);
    const lineEnd = nextBreak === -1 ? editor.value.length : nextBreak;
    const block = editor.value.slice(lineStart, lineEnd);
    const isListLine = /^\s*(?:[-*+]|\d+[.)])\s+/.test(block);
    if (isListLine || block.includes('\n') || event.shiftKey) {
      const changed = block.split('\n').map((line) => event.shiftKey ? line.replace(/^( {1,2}|\t)/, '') : (line.trim() ? '  ' + line : line)).join('\n');
      editor.setRangeText(changed, lineStart, lineEnd, 'select');
    } else {
      editor.setRangeText('  ', start, end, 'end');
    }
    updatePreview(); markDirty(true);
  });
  document.addEventListener('keydown', (event) => {
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && key === 's') { event.preventDefault(); saveFile(event.shiftKey); }
    if (mod && key === 'o') { event.preventDefault(); openFile(); }
    if (mod && key === 'n') { event.preventDefault(); $('#new-file').click(); }
    if (mod && key === 'b') { event.preventDefault(); insertFormat('bold'); }
    if (mod && key === 'i') { event.preventDefault(); insertFormat('italic'); }
    if (mod && key === 'k') { event.preventDefault(); insertFormat('link'); }
  });
  window.addEventListener('beforeunload', (event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  const restored = localStorage.getItem('inkflow-content');
  filename = localStorage.getItem('inkflow-filename') || '未命名.md';
  setDocument(restored === null ? starter : restored, filename, true);
  setMode(localStorage.getItem('inkflow-mode') || 'split');
})();
