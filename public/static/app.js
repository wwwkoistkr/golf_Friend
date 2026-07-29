/* 골프 페널티 정산표 — 엑셀형, 컬럼 리사이즈, 관리자 자료실, localStorage */
(function () {
  'use strict';

  var STORE_KEY = 'golf-penalty-sheet-v3';
  var DEFAULT_ROWS = 8;
  var ADMIN_ID = 'admin';
  var ADMIN_PW = 'admin1234';

  var isAdmin = false; // 관리자 로그인 여부 (수정/삭제 권한)

  var state = load();

  // ---------- 저장/로드 ----------
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        return {
          members: (d.members && d.members.length) ? d.members : makeDefaultMembers(),
          dates: (d.dates && d.dates.length) ? d.dates : [makeDate(todayIso())],
          cells: d.cells || {},
          manager: d.manager || { name: '', phone: '' },
          widths: d.widths || {},
          assets: d.assets || []
        };
      }
    } catch (e) {}
    return {
      members: makeDefaultMembers(),
      dates: [makeDate(todayIso())],  // 골프 친 날짜 기본 1개
      cells: {}, manager: { name: '', phone: '' }, widths: {}, assets: []
    };
  }
  function makeDefaultMembers() {
    var arr = [];
    for (var i = 0; i < DEFAULT_ROWS; i++) arr.push({ id: uid(), name: '', phone: '' });
    return arr;
  }
  function makeDate(iso) { return { id: uid(), iso: iso }; }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---------- 숫자/날짜 ----------
  function fmt(n) { n = Number(n) || 0; return n.toLocaleString('ko-KR'); }
  function parseNum(str) {
    if (str == null) return 0;
    var v = String(str).replace(/[^\d.-]/g, '');
    var n = parseFloat(v); return isNaN(n) ? 0 : Math.round(n);
  }
  function cellKey(m, d) { return m + '|' + d; }
  function fmtDate(iso) { if (!iso) return ''; var p = iso.split('-'); return p.length === 3 ? (Number(p[1]) + '/' + Number(p[2])) : iso; }
  function fmtDateFull(iso) { return iso ? iso.replace(/-/g, '.') : ''; }
  function todayIso() { var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()); }
  function escapeHtml(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

  // ---------- 합계 ----------
  function memberTotal(id) { var s = 0; state.dates.forEach(function (d) { s += Number(state.cells[cellKey(id, d.id)]) || 0; }); return s; }
  function dateTotal(id) { var s = 0; state.members.forEach(function (m) { s += Number(state.cells[cellKey(m.id, id)]) || 0; }); return s; }
  function grandTotal() { var s = 0; state.members.forEach(function (m) { s += memberTotal(m.id); }); return s; }

  // ---------- 렌더 ----------
  var head = document.getElementById('sheet-head');
  var body = document.getElementById('sheet-body');
  var foot = document.getElementById('sheet-foot');

  function render() { renderHead(); renderBody(); renderFoot(); applyWidths(); }

  function wStyle(key) { return state.widths[key] ? (' style="width:' + state.widths[key] + 'px;min-width:' + state.widths[key] + 'px"') : ''; }

  function renderHead() {
    var h = '<tr>';
    h += '<th class="col-no">No</th>';
    h += '<th class="col-name" data-col="name"' + wStyle('name') + '>회원 이름<span class="col-resize" data-rz="name"></span></th>';
    h += '<th class="col-phone" data-col="phone"' + wStyle('phone') + '>양지번호<span class="col-resize" data-rz="phone"></span></th>';
    state.dates.forEach(function (d) {
      h += '<th class="col-date" data-col="date:' + d.id + '"' + wStyle('date:' + d.id) + '>' +
        '<div class="date-head">' +
        '<span class="date-text">' + fmtDate(d.iso) + '</span>' +
        '<span class="date-sub">' + fmtDateFull(d.iso) + '</span>' +
        (isAdmin ? '<button class="date-del" data-del-date="' + d.id + '" title="이 날짜 삭제"><i class="fas fa-xmark"></i></button>' : '') +
        '</div>' +
        '<span class="col-resize" data-rz="date:' + d.id + '"></span></th>';
    });
    h += '<th class="col-total">합계</th>';
    h += '</tr>';
    head.innerHTML = h;
  }

  // 일반 모드에서 "이미 값이 있는" 칸은 잠금(readonly). 관리자면 항상 편집 가능.
  function inputCls(baseCls, hasValue) {
    return baseCls + ((!isAdmin && hasValue) ? ' locked' : '');
  }

  function renderBody() {
    var h = '';
    state.members.forEach(function (m, idx) {
      h += '<tr>';
      h += '<td class="cell-no">' + (idx + 1) +
        (isAdmin ? '<button class="row-del" data-del-member="' + m.id + '" title="이 회원 삭제"><i class="fas fa-xmark"></i></button>' : '') +
        '</td>';
      var nameLocked = !isAdmin && !!m.name;
      var phoneLocked = !isAdmin && !!m.phone;
      h += '<td class="cell-name"' + wStyle('name') + '><input type="text" maxlength="6" class="' + inputCls('name-input', !!m.name) + '" data-name="' + m.id + '" value="' + escapeHtml(m.name) + '" placeholder="이름6자" ' + (nameLocked ? 'readonly' : '') + ' /></td>';
      h += '<td class="cell-phone"' + wStyle('phone') + '><input type="tel" inputmode="tel" maxlength="6" class="' + inputCls('phone-input', !!m.phone) + '" data-phone="' + m.id + '" value="' + escapeHtml(m.phone) + '" placeholder="번호6자" ' + (phoneLocked ? 'readonly' : '') + ' /></td>';
      state.dates.forEach(function (d) {
        var val = state.cells[cellKey(m.id, d.id)];
        var locked = !isAdmin && !!val;
        h += '<td class="cell-money"' + wStyle('date:' + d.id) + '><input type="text" inputmode="numeric" maxlength="13" data-m="' + m.id + '" data-d="' + d.id + '" class="' + inputCls('money-input', !!val) + (val ? ' has-val' : '') + '" value="' + (val ? fmt(val) : '') + '" placeholder="0000000000" ' + (locked ? 'readonly' : '') + ' /></td>';
      });
      h += '<td class="cell-total" data-total-member="' + m.id + '">' + fmt(memberTotal(m.id)) + '</td>';
      h += '</tr>';
    });
    body.innerHTML = h;
  }

  function renderFoot() {
    var h = '<tr>';
    h += '<td class="foot-label" colspan="3"><i class="fas fa-calculator"></i>날짜별 합계</td>';
    state.dates.forEach(function (d) { h += '<td class="foot-date" data-total-date="' + d.id + '"' + wStyle('date:' + d.id) + '>' + fmt(dateTotal(d.id)) + '</td>'; });
    h += '<td class="foot-grand">' + fmt(grandTotal()) + '</td>';
    h += '</tr>';
    foot.innerHTML = h;
  }

  function applyWidths() {
    Object.keys(state.widths).forEach(function (key) {
      var w = state.widths[key];
      document.querySelectorAll('[data-col="' + key.replace(/"/g, '') + '"]').forEach(function (el) {
        el.style.width = w + 'px'; el.style.minWidth = w + 'px';
      });
    });
  }

  function refreshTotals() {
    state.members.forEach(function (m) { var el = body.querySelector('[data-total-member="' + m.id + '"]'); if (el) el.textContent = fmt(memberTotal(m.id)); });
    state.dates.forEach(function (d) { var el = foot.querySelector('[data-total-date="' + d.id + '"]'); if (el) el.textContent = fmt(dateTotal(d.id)); });
    var g = foot.querySelector('.foot-grand'); if (g) g.textContent = fmt(grandTotal());
  }

  function findMember(id) { for (var i = 0; i < state.members.length; i++) if (state.members[i].id === id) return state.members[i]; return null; }

  // ---------- 입력 ----------
  body.addEventListener('input', function (e) {
    var t = e.target;
    if (t.matches('.money-input')) {
      var num = parseNum(t.value);
      var k = cellKey(t.getAttribute('data-m'), t.getAttribute('data-d'));
      // 일반 모드: 이미 저장된 값이 있으면 삭제/변경 금지 (관리자만 가능)
      if (!isAdmin && state.cells[k]) {
        alert('입력된 금액의 수정·삭제는 관리자만 할 수 있습니다.');
        t.value = fmt(state.cells[k]); return;
      }
      if (num) state.cells[k] = num; else delete state.cells[k];
      t.classList.toggle('has-val', !!num); refreshTotals(); save();
    } else if (t.matches('.name-input')) {
      var m1 = findMember(t.getAttribute('data-name'));
      if (m1) {
        if (!isAdmin && m1.name) { t.value = m1.name; alert('입력된 이름의 수정은 관리자만 할 수 있습니다.'); return; }
        m1.name = t.value; save();
      }
    } else if (t.matches('.phone-input')) {
      var m2 = findMember(t.getAttribute('data-phone'));
      if (m2) {
        if (!isAdmin && m2.phone) { t.value = m2.phone; alert('입력된 양지번호의 수정은 관리자만 할 수 있습니다.'); return; }
        m2.phone = t.value; save();
      }
    }
  });
  body.addEventListener('focus', function (e) {
    var t = e.target; if (!t.matches('.money-input')) return;
    var num = parseNum(t.value); t.value = num ? String(num) : '';
    setTimeout(function () { try { t.select(); } catch (x) {} }, 0);
  }, true);
  body.addEventListener('blur', function (e) {
    var t = e.target; if (!t.matches('.money-input')) return;
    var num = parseNum(t.value); t.value = num ? fmt(num) : '';
  }, true);

  // ---------- 회원/날짜 삭제 ----------
  body.addEventListener('click', function (e) {
    var del = e.target.closest('[data-del-member]'); if (!del) return;
    var id = del.getAttribute('data-del-member'); var m = findMember(id);
    var label = (m && m.name) ? ('"' + m.name + '"') : '이';
    if (confirm(label + ' 회원 행을 삭제할까요?')) {
      state.members = state.members.filter(function (x) { return x.id !== id; });
      Object.keys(state.cells).forEach(function (k) { if (k.split('|')[0] === id) delete state.cells[k]; });
      save(); render();
    }
  });
  head.addEventListener('click', function (e) {
    var del = e.target.closest('[data-del-date]'); if (!del) return;
    var id = del.getAttribute('data-del-date'); var d = null;
    for (var i = 0; i < state.dates.length; i++) if (state.dates[i].id === id) d = state.dates[i];
    if (d && confirm('"' + fmtDateFull(d.iso) + '" 날짜 열을 삭제할까요? 해당 금액도 삭제됩니다.')) {
      state.dates = state.dates.filter(function (x) { return x.id !== id; });
      Object.keys(state.cells).forEach(function (k) { if (k.split('|')[1] === id) delete state.cells[k]; });
      delete state.widths['date:' + id];
      save(); render();
    }
  });

  // ---------- 회원/날짜 추가 ----------
  document.getElementById('btn-add-member').addEventListener('click', function () {
    state.members.push({ id: uid(), name: '', phone: '' }); save(); render();
    var inputs = body.querySelectorAll('.name-input'); if (inputs.length) inputs[inputs.length - 1].focus();
  });
  document.getElementById('btn-add-date').addEventListener('click', function () {
    var input = prompt('골프 친 날짜를 입력하세요 (예: 2026-07-28)', todayIso());
    if (input === null) return;
    var iso = input.trim(); if (!iso) iso = todayIso();
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(iso)) { var p = iso.split('-'); iso = p[0] + '-' + p[1].padStart(2, '0') + '-' + p[2].padStart(2, '0'); }
    else { var dt = new Date(iso); if (isNaN(dt.getTime())) { alert('날짜 형식이 올바르지 않습니다.\n예: 2026-07-28'); return; } var q = function (n) { return String(n).padStart(2, '0'); }; iso = dt.getFullYear() + '-' + q(dt.getMonth() + 1) + '-' + q(dt.getDate()); }
    state.dates.push({ id: uid(), iso: iso });
    state.dates.sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0; });
    save(); render();
    document.getElementById('table-wrap').scrollLeft = 99999;
  });

  // ---------- 담당자 ----------
  var mgrName = document.getElementById('manager-name');
  var mgrPhone = document.getElementById('manager-phone');
  mgrName.value = state.manager.name || ''; mgrPhone.value = state.manager.phone || '';
  mgrName.addEventListener('input', function () { state.manager.name = mgrName.value; save(); });
  mgrPhone.addEventListener('input', function () { state.manager.phone = mgrPhone.value; save(); });

  // ---------- 초기화 ----------
  document.getElementById('btn-clear').addEventListener('click', function () {
    if (!isAdmin) { alert('초기화는 관리자만 할 수 있습니다.\n우측 상단 [관리자] 버튼으로 로그인해 주세요.'); return; }
    if (confirm('정산표(회원/날짜/금액)를 초기화할까요?\n※ 관리자 자료실 이미지는 유지됩니다.')) {
      state.members = makeDefaultMembers();
      state.dates = [makeDate(todayIso())];
      state.cells = {}; state.manager = { name: '', phone: '' }; state.widths = {};
      mgrName.value = ''; mgrPhone.value = '';
      save(); render();
    }
  });

  // ---------- CSV ----------
  function exportCsv() {
    var rows = [];
    var header = ['No', '회원 이름', '양지번호'];
    state.dates.forEach(function (d) { header.push(fmtDateFull(d.iso)); });
    header.push('합계'); rows.push(header);
    state.members.forEach(function (m, i) {
      var row = [i + 1, m.name || '', m.phone || ''];
      state.dates.forEach(function (d) { row.push(state.cells[cellKey(m.id, d.id)] || 0); });
      row.push(memberTotal(m.id)); rows.push(row);
    });
    var footer = ['', '날짜별 합계', ''];
    state.dates.forEach(function (d) { footer.push(dateTotal(d.id)); });
    footer.push(grandTotal()); rows.push(footer);
    var csv = rows.map(function (r) { return r.map(function (c) { var s = String(c == null ? '' : c); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(','); }).join('\n');
    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    downloadBlob(blob, '골프페널티_' + todayIso() + '.csv');
  }
  function downloadBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  }
  document.getElementById('btn-export').addEventListener('click', exportCsv);

  // ---------- 컬럼 리사이즈 (마우스 + 터치) ----------
  var rz = null;
  function startResize(key, startX, thEl) {
    rz = { key: key, startX: startX, startW: thEl.getBoundingClientRect().width };
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
  }
  function moveResize(x) {
    if (!rz) return;
    var w = Math.max(40, Math.round(rz.startW + (x - rz.startX)));
    state.widths[rz.key] = w;
    document.querySelectorAll('[data-col="' + rz.key + '"]').forEach(function (el) { el.style.width = w + 'px'; el.style.minWidth = w + 'px'; });
  }
  function endResize() { if (rz) { rz = null; document.body.style.userSelect = ''; document.body.style.cursor = ''; save(); } }

  head.addEventListener('mousedown', function (e) {
    var handle = e.target.closest('.col-resize'); if (!handle) return;
    e.preventDefault();
    startResize(handle.getAttribute('data-rz'), e.clientX, handle.closest('th'));
  });
  document.addEventListener('mousemove', function (e) { if (rz) moveResize(e.clientX); });
  document.addEventListener('mouseup', endResize);

  head.addEventListener('touchstart', function (e) {
    var handle = e.target.closest('.col-resize'); if (!handle) return;
    var t = e.touches[0];
    startResize(handle.getAttribute('data-rz'), t.clientX, handle.closest('th'));
  }, { passive: true });
  document.addEventListener('touchmove', function (e) { if (rz) { moveResize(e.touches[0].clientX); e.preventDefault(); } }, { passive: false });
  document.addEventListener('touchend', endResize);

  // ============================================================
  //  관리자 모드
  // ============================================================
  var loginModal = document.getElementById('login-modal');
  var loginId = document.getElementById('login-id');
  var loginPw = document.getElementById('login-pw');
  var loginError = document.getElementById('login-error');
  var viewSheet = document.getElementById('view-sheet');
  var viewAdmin = document.getElementById('view-admin');

  var btnAdmin = document.getElementById('btn-admin');

  function updateAdminBtn() {
    btnAdmin.innerHTML = isAdmin
      ? '<i class="fas fa-lock-open"></i><span class="btn-text"> 관리자ON</span>'
      : '<i class="fas fa-user-shield"></i><span class="btn-text"> 관리자</span>';
    btnAdmin.classList.toggle('admin-on', isAdmin);
    var banner = document.getElementById('mode-banner');
    if (banner) {
      if (isAdmin) {
        banner.className = 'mode-banner mode-admin';
        banner.innerHTML = '<i class="fas fa-lock-open"></i> 관리자 모드 · 모든 값을 <b>수정·삭제</b>할 수 있습니다';
      } else {
        banner.className = 'mode-banner mode-user';
        banner.innerHTML = '<i class="fas fa-pen"></i> 일반 사용자 모드 · <b>새 입력만</b> 가능합니다 (수정·삭제는 관리자)';
      }
    }
  }

  btnAdmin.addEventListener('click', function () {
    if (isAdmin) { openAdmin(); return; }
    loginError.classList.add('hidden'); loginId.value = ''; loginPw.value = '';
    loginModal.classList.remove('hidden');
    setTimeout(function () { loginId.focus(); }, 50);
  });
  document.getElementById('login-cancel').addEventListener('click', function () { loginModal.classList.add('hidden'); });
  loginModal.addEventListener('click', function (e) { if (e.target === loginModal) loginModal.classList.add('hidden'); });
  function tryLogin() {
    if (loginId.value.trim() === ADMIN_ID && loginPw.value === ADMIN_PW) {
      isAdmin = true; loginModal.classList.add('hidden');
      updateAdminBtn(); render(); openAdmin();
    } else { loginError.classList.remove('hidden'); }
  }
  document.getElementById('login-ok').addEventListener('click', tryLogin);
  loginPw.addEventListener('keydown', function (e) { if (e.key === 'Enter') tryLogin(); });
  loginId.addEventListener('keydown', function (e) { if (e.key === 'Enter') loginPw.focus(); });

  function openAdmin() { viewSheet.classList.add('hidden'); viewAdmin.classList.remove('hidden'); renderAdmin(); }
  function closeAdmin() { viewAdmin.classList.add('hidden'); viewSheet.classList.remove('hidden'); render(); }
  document.getElementById('btn-admin-close').addEventListener('click', closeAdmin);

  // 관리자 로그아웃
  document.getElementById('btn-logout').addEventListener('click', function () {
    isAdmin = false; updateAdminBtn(); closeAdmin();
    alert('관리자 모드를 종료했습니다. 이제 일반 사용자(입력만 가능) 상태입니다.');
  });

  function renderAdmin() {
    // 요약
    var totalPenalty = grandTotal();
    var namedMembers = state.members.filter(function (m) { return m.name.trim(); }).length;
    document.getElementById('admin-summary').innerHTML =
      '<div class="summary-item"><div class="num">' + namedMembers + '</div><div class="lbl">등록 회원</div></div>' +
      '<div class="summary-item"><div class="num">' + state.dates.length + '</div><div class="lbl">골프 날짜</div></div>' +
      '<div class="summary-item"><div class="num">' + fmt(totalPenalty) + '</div><div class="lbl">누적 페널티(원)</div></div>' +
      '<div class="summary-item"><div class="num">' + state.assets.length + '</div><div class="lbl">자료 개수</div></div>';
    renderAssets();
  }

  function renderAssets() {
    var list = document.getElementById('asset-list');
    if (!state.assets.length) { list.innerHTML = '<div class="asset-empty"><i class="fas fa-folder-open"></i> 등록된 자료가 없습니다. 이미지를 추가해 보세요.</div>'; return; }
    var h = '';
    state.assets.forEach(function (a) {
      h += '<div class="asset-item">' +
        '<button class="asset-del" data-del-asset="' + a.id + '" title="삭제"><i class="fas fa-trash"></i></button>' +
        '<img src="' + a.data + '" alt="' + escapeHtml(a.name) + '" data-view="' + a.id + '" />' +
        '<div class="asset-cap">' + escapeHtml(a.name) + '</div>' +
        '</div>';
    });
    list.innerHTML = h;
  }

  // 자료 추가
  var assetName = document.getElementById('asset-name');
  var assetFile = document.getElementById('asset-file');
  var pendingImage = null;
  assetFile.addEventListener('change', function () {
    var f = assetFile.files[0]; if (!f) { pendingImage = null; return; }
    if (f.size > 3 * 1024 * 1024) { alert('이미지 용량이 큽니다(최대 약 3MB 권장). 더 작은 이미지를 사용해 주세요.'); assetFile.value = ''; return; }
    var reader = new FileReader();
    reader.onload = function () { pendingImage = { data: reader.result, filename: f.name }; };
    reader.readAsDataURL(f);
  });
  document.getElementById('asset-save').addEventListener('click', function () {
    var name = assetName.value.trim();
    if (!pendingImage) { alert('이미지를 먼저 선택해 주세요.'); return; }
    if (!name) { name = pendingImage.filename || '자료'; }
    state.assets.unshift({ id: uid(), name: name, data: pendingImage.data, ts: Date.now() });
    save();
    assetName.value = ''; assetFile.value = ''; pendingImage = null;
    renderAdmin();
  });

  // 자료 삭제 / 크게보기
  document.getElementById('asset-list').addEventListener('click', function (e) {
    var del = e.target.closest('[data-del-asset]');
    if (del) {
      var id = del.getAttribute('data-del-asset');
      if (confirm('이 자료를 삭제할까요?')) { state.assets = state.assets.filter(function (a) { return a.id !== id; }); save(); renderAdmin(); }
      return;
    }
    var view = e.target.closest('[data-view]');
    if (view) {
      var vid = view.getAttribute('data-view');
      var a = null; for (var i = 0; i < state.assets.length; i++) if (state.assets[i].id === vid) a = state.assets[i];
      if (a) { document.getElementById('img-big').src = a.data; document.getElementById('img-caption').textContent = a.name; document.getElementById('img-modal').classList.remove('hidden'); }
    }
  });
  document.getElementById('img-close').addEventListener('click', function () { document.getElementById('img-modal').classList.add('hidden'); });
  document.getElementById('img-modal').addEventListener('click', function (e) { if (e.target.id === 'img-modal') document.getElementById('img-modal').classList.add('hidden'); });

  // 관리자: CSV / 백업 / 복원
  document.getElementById('admin-export').addEventListener('click', exportCsv);
  document.getElementById('admin-backup').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    downloadBlob(blob, '골프정산_백업_' + todayIso() + '.json');
  });
  document.getElementById('admin-restore').addEventListener('change', function (e) {
    var f = e.target.files[0]; if (!f) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var d = JSON.parse(reader.result);
        if (!d || !d.members) throw new Error('형식오류');
        state = {
          members: d.members || makeDefaultMembers(),
          dates: (d.dates && d.dates.length) ? d.dates : [makeDate(todayIso())],
          cells: d.cells || {}, manager: d.manager || { name: '', phone: '' },
          widths: d.widths || {}, assets: d.assets || []
        };
        save(); mgrName.value = state.manager.name || ''; mgrPhone.value = state.manager.phone || '';
        render(); renderAdmin();
        alert('백업을 복원했습니다.');
      } catch (x) { alert('올바른 백업 파일이 아닙니다.'); }
      e.target.value = '';
    };
    reader.readAsText(f);
  });

  // ---------- 시작 ----------
  updateAdminBtn();
  render();
})();
