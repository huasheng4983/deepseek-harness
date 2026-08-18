/**
 * 工作区文件管理页面（自包含 HTML，嵌入本包，由 /workspace-files 路由提供）。
 * 页面内 JS 刻意不用模板字面量（避免与外围 TS 模板字符串嵌套转义）。
 * @module @deepseek-ai/dsh-host-workspace-files/src/page
 */

/** 完整页面文档字符串。 */
export const workspaceFilesPage: string = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>工作区文件 · DeepSeek Harness</title>
<style>
  :root {
    --bg: #10141a; --panel: #171c24; --panel2: #1d242e; --border: #2a3340;
    --text: #d8dee8; --muted: #8b95a3; --accent: #4f8cff; --danger: #e5534b;
    --radius: 8px;
  }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
    background: var(--bg); color: var(--text); font-size: 14px; }
  header { display: flex; align-items: center; gap: 12px; padding: 14px 20px;
    background: var(--panel); border-bottom: 1px solid var(--border); position: sticky; top: 0; z-index: 5; flex-wrap: wrap; }
  header h1 { font-size: 15px; margin: 0; font-weight: 600; }
  header .root { color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .spacer { flex: 1; }
  button { background: var(--panel2); color: var(--text); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 7px 14px; font-size: 13px; cursor: pointer; }
  button:hover { border-color: var(--accent); }
  button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
  button.primary:hover { filter: brightness(1.1); }
  button.link { background: none; border: none; padding: 4px 8px; color: var(--accent); }
  button.link.danger { color: var(--danger); }
  main { padding: 16px 20px; }
  .bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
  .bar .crumbs { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
  .bar .crumbs a { color: var(--accent); text-decoration: none; cursor: pointer; }
  .bar .crumbs a:hover { text-decoration: underline; }
  .bar .crumbs span.sep { color: var(--muted); }
  .status { font-size: 12px; color: var(--muted); }
  .status.error { color: var(--danger); }
  table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  th, td { text-align: left; padding: 9px 14px; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 500; font-size: 12px; background: var(--panel2); }
  tr:last-child td { border-bottom: none; }
  tr.row { cursor: pointer; }
  tr.row:hover { background: var(--panel2); }
  td.name .ic { margin-right: 8px; }
  td.size, td.time { color: var(--muted); white-space: nowrap; }
  td.actions { white-space: nowrap; text-align: right; }
  .empty { text-align: center; color: var(--muted); padding: 40px 0; }
  input[type=file] { display: none; }
  .uploading { position: fixed; right: 16px; bottom: 16px; background: var(--panel2);
    border: 1px solid var(--border); border-radius: var(--radius); padding: 10px 14px; font-size: 12px; max-width: 320px; }
</style>
</head>
<body>
<header>
  <h1>📁 工作区文件</h1>
  <span class="root" id="root-label"></span>
  <div class="spacer"></div>
  <button id="btn-upload" class="primary">上传文件</button>
  <button id="btn-mkdir">新建文件夹</button>
  <button id="btn-refresh">刷新</button>
</header>
<main>
  <div class="bar">
    <div class="crumbs" id="crumbs"></div>
    <div class="spacer"></div>
    <div class="status" id="status"></div>
  </div>
  <input type="file" id="file-input" multiple>
  <table>
    <thead><tr><th>名称</th><th style="width:110px">大小</th><th style="width:160px">修改时间</th><th style="width:140px"></th></tr></thead>
    <tbody id="tbody"></tbody>
  </table>
  <div class="empty" id="empty" style="display:none">目录为空</div>
  <div class="uploading" id="uploading" style="display:none"></div>
</main>
<script>
(function () {
  'use strict';
  var currentPath = '';
  var rootLabel = document.getElementById('root-label');
  var tbody = document.getElementById('tbody');
  var crumbs = document.getElementById('crumbs');
  var status = document.getElementById('status');
  var empty = document.getElementById('empty');
  var uploading = document.getElementById('uploading');

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtSize(n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    if (n < 1073741824) return (n / 1048576).toFixed(1) + ' MB';
    return (n / 1073741824).toFixed(2) + ' GB';
  }
  function fmtTime(t) {
    if (!t) return '-';
    var d = new Date(t * 1000);
    function p(x) { return (x < 10 ? '0' : '') + x; }
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function say(msg, isError) {
    status.textContent = msg || '';
    status.className = 'status' + (isError ? ' error' : '');
  }
  function apiError(err) {
    var msg = '请求失败';
    if (err && err.error) msg = err.error;
    if (err && err.message) msg = err.message;
    return msg;
  }

  function renderCrumbs(path) {
    crumbs.innerHTML = '';
    var segs = path === '' ? [] : path.split('/');
    var a = document.createElement('a');
    a.textContent = '根目录';
    a.onclick = function () { load(''); };
    crumbs.appendChild(a);
    var acc = '';
    segs.forEach(function (seg, i) {
      var sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = ' / ';
      crumbs.appendChild(sep);
      acc = acc === '' ? seg : acc + '/' + seg;
      var link = document.createElement('a');
      link.textContent = seg;
      if (i < segs.length - 1) {
        link.onclick = function () { load(acc); };
      } else {
        link.style.color = 'var(--text)';
        link.style.cursor = 'default';
      }
      crumbs.appendChild(link);
    });
  }

  function load(path) {
    currentPath = path || '';
    say('加载中…');
    var q = currentPath === '' ? '' : '?path=' + encodeURIComponent(currentPath);
    fetch('/workspace-files/api/list' + q).then(function (r) { return r.json(); }).then(function (data) {
      if (!data.ok) { say(apiError(data), true); return; }
      rootLabel.textContent = '根目录：' + data.root;
      renderCrumbs(data.path || '');
      tbody.innerHTML = '';
      var rows = data.entries || [];
      if (rows.length === 0) { empty.style.display = 'block'; } else { empty.style.display = 'none'; }
      rows.forEach(function (entry) {
        var tr = document.createElement('tr');
        tr.className = 'row';
        var tdName = document.createElement('td');
        tdName.className = 'name';
        tdName.innerHTML = (entry.is_dir ? '<span class="ic">📁</span>' : '<span class="ic">📄</span>') + esc(entry.name);
        if (entry.is_dir) {
          tr.onclick = function () { load(entry.path); };
        } else {
          tr.onclick = function () { download(entry.path, entry.name); };
        }
        var tdSize = document.createElement('td');
        tdSize.className = 'size';
        tdSize.textContent = entry.is_dir ? '-' : fmtSize(entry.size);
        var tdTime = document.createElement('td');
        tdTime.className = 'time';
        tdTime.textContent = fmtTime(entry.mtime);
        var tdActions = document.createElement('td');
        tdActions.className = 'actions';
        if (!entry.is_dir) {
          var btnDl = document.createElement('button');
          btnDl.className = 'link';
          btnDl.textContent = '下载';
          btnDl.onclick = function (e) { e.stopPropagation(); download(entry.path, entry.name); };
          tdActions.appendChild(btnDl);
        }
        var btnDel = document.createElement('button');
        btnDel.className = 'link danger';
        btnDel.textContent = '删除';
        btnDel.onclick = function (e) {
          e.stopPropagation();
          if (!window.confirm('确认删除「' + entry.name + '」？此操作不可恢复。')) return;
          fetch('/workspace-files/api/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: entry.path })
          }).then(function (r) { return r.json(); }).then(function (data) {
            if (!data.ok) { say(apiError(data), true); return; }
            say('已删除');
            load(currentPath);
          }).catch(function (e) { say(apiError(e), true); });
        };
        tdActions.appendChild(btnDel);
        tr.appendChild(tdName);
        tr.appendChild(tdSize);
        tr.appendChild(tdTime);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
      });
      say('共 ' + rows.length + ' 项');
    }).catch(function (e) { say(apiError(e), true); });
  }

  function download(path, name) {
    var a = document.createElement('a');
    a.href = '/workspace-files/api/download?path=' + encodeURIComponent(path);
    a.download = name || '';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function uploadFiles(files) {
    var list = Array.prototype.slice.call(files);
    if (list.length === 0) return;
    uploading.style.display = 'block';
    var done = 0;
    function next() {
      if (list.length === 0) {
        uploading.style.display = 'none';
        say('上传完成 ' + done + ' 个文件');
        load(currentPath);
        return;
      }
      var file = list.shift();
      uploading.textContent = '正在上传：' + file.name;
      var reader = new FileReader();
      reader.onload = function () {
        var content = String(reader.result).split(',')[1] || '';
        fetch('/workspace-files/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: currentPath, name: file.name, content: content })
        }).then(function (r) { return r.json(); }).then(function (data) {
          if (!data.ok) { say('上传失败：' + apiError(data), true); }
          else { done++; }
          next();
        }).catch(function (e) { say('上传失败：' + apiError(e), true); next(); });
      };
      reader.onerror = function () { say('读取文件失败：' + file.name, true); next(); };
      reader.readAsDataURL(file);
    }
    next();
  }

  document.getElementById('btn-upload').onclick = function () { document.getElementById('file-input').click(); };
  document.getElementById('file-input').onchange = function () { uploadFiles(this.files); this.value = ''; };
  document.getElementById('btn-refresh').onclick = function () { load(currentPath); };
  document.getElementById('btn-mkdir').onclick = function () {
    var name = window.prompt('输入新文件夹名称：');
    if (!name) return;
    var rel = currentPath === '' ? name : currentPath + '/' + name;
    fetch('/workspace-files/api/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: rel })
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (!data.ok) { say(apiError(data), true); return; }
      say('已创建');
      load(currentPath);
    }).catch(function (e) { say(apiError(e), true); });
  };

  load('');
})();
</script>
</body>
</html>`
