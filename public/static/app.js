/* 골프 페널티 정산표 — 엑셀/구글시트 형식, localStorage 저장 */
(function () {
  'use strict';

  var STORE_KEY = 'golf-penalty-sheet-v2';
  var DEFAULT_ROWS = 8; // 기본 회원 행 수

  var state = load();

  // ---------- 저장/로드 ----------
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        return {
          members: (d.members && d.members.length) ? d.members : makeDefaultMembers(),
          dates: d.dates || [],
          cells: d.cells || {},
          manager: d.manager || { name: '', phone: '' }
        };
      }
    } catch (e) {}
    return { members: makeDefaultMembers(), dates: [], cells: {}, manager: { name: '', phone: '' } };
  }
  function makeDefaultMembers() {
    var arr = [];
    for (var i = 0; i < DEFAULT_ROWS; i++) arr.push({ id: uid(), name: '', phone: '' });
    return arr;
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---------- 숫자 ----------
  function fmt(n) { n = Number(n) || 0; return n.toLocaleString('ko-KR'); }
  function parseNum(str) {
    if (str == null) return 0;
    var v = String(str).replace(/[^\d.-]/g, '');
    var n = parseFloat(v);
    return isNaN(n) ? 0 : Math.round(n);
  }
  function cellKey(m, d) { return m + '|' + d; }

  // ---------- 합계 ----------
  function memberTotal(id) {
    var s = 0;
    state.dates.forEach(function (d) { s += Number(state.cells[cellKey(id, d.id)]) || 0; });
    return s;
  }
  function dateTotal(id) {
    var s = 0;
    state.members.forEach(function (m) { s += Number(state.cells[cellKey(m.id, id)]) || 0; });
    return s;
  }
  function grandTotal() {
    var s = 0;
    state.members.forEach(function (m) { s += memberTotal(m.id); });
    return s;
  }

  // ---------- 날짜 ----------
  function fmtDate(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p.length === 3 ? (Number(p[1]) + '/' + Number(p[2])) : iso;
  }
  function fmtDateFull(iso) { return iso ? iso.replace(/-/g, '.') : ''; }
  function todayIso() {
    var d = new Date(), p = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---------- 렌더 ----------
  var head = document.getElementById('sheet-head');
  var body = document.getElementById('sheet-body');
  var foot = document.getElementById('sheet-foot');

  function render() { renderHead(); renderBody(); renderFoot(); }

  function renderHead() {
    var h = '<tr>';
    h += '<th class="col-no">No</th>';
    h += '<th class="col-name">회원 이름</th>';
    h += '<th class="col-phone">전화번호</th>';
    state.dates.forEach(function (d) {
      h += '<th class="col-date">' +
        '<div class="date-head">' +
        '<span class="date-text">' + fmtDate(d.iso) + '</span>' +
        '<span class="date-sub">' + fmtDateFull(d.iso) + '</span>' +
        '<button class="date-del" data-del-date="' + d.id + '" title="이 날짜 삭제"><i class="fas fa-xmark"></i></button>' +
        '</div></th>';
    });
    h += '<th class="col-total">합계</th>';
    h += '</tr>';
    head.innerHTML = h;
  }

  function renderBody() {
    var h = '';
    state.members.forEach(function (m, idx) {
      h += '<tr>';
      h += '<td class="cell-no">' + (idx + 1) +
        '<button class="row-del" data-del-member="' + m.id + '" title="이 회원 삭제"><i class="fas fa-xmark"></i></button>' +
        '</td>';
      // 이름 (인라인 편집)
      h += '<td class="cell-name"><input type="text" class="name-input" data-name="' + m.id + '" ' +
        'value="' + escapeHtml(m.name) + '" placeholder="이름 입력" /></td>';
      // 전화번호 (인라인 편집)
      h += '<td class="cell-phone"><input type="tel" inputmode="tel" class="phone-input" data-phone="' + m.id + '" ' +
        'value="' + escapeHtml(m.phone) + '" placeholder="010-0000-0000" /></td>';
      // 금액칸
      state.dates.forEach(function (d) {
        var val = state.cells[cellKey(m.id, d.id)];
        h += '<td class="cell-money"><input type="text" inputmode="numeric" ' +
          'data-m="' + m.id + '" data-d="' + d.id + '" ' +
          'class="money-input' + (val ? ' has-val' : '') + '" ' +
          'value="' + (val ? fmt(val) : '') + '" placeholder="0" /></td>';
      });
      // 합계
      h += '<td class="cell-total" data-total-member="' + m.id + '">' + fmt(memberTotal(m.id)) + '</td>';
      h += '</tr>';
    });
    body.innerHTML = h;
  }

  function renderFoot() {
    var h = '<tr>';
    h += '<td class="foot-label" colspan="3"><i class="fas fa-calculator"></i> 날짜별 합계</td>';
    state.dates.forEach(function (d) {
      h += '<td class="foot-date" data-total-date="' + d.id + '">' + fmt(dateTotal(d.id)) + '</td>';
    });
    h += '<td class="foot-grand">' + fmt(grandTotal()) + '</td>';
    h += '</tr>';
    foot.innerHTML = h;
  }

  function refreshTotals() {
    state.members.forEach(function (m) {
      var el = body.querySelector('[data-total-member="' + m.id + '"]');
      if (el) el.textContent = fmt(memberTotal(m.id));
    });
    state.dates.forEach(function (d) {
      var el = foot.querySelector('[data-total-date="' + d.id + '"]');
      if (el) el.textContent = fmt(dateTotal(d.id));
    });
    var g = foot.querySelector('.foot-grand');
    if (g) g.textContent = fmt(grandTotal());
  }

  // ---------- 입력 이벤트 ----------
  body.addEventListener('input', function (e) {
    var t = e.target;
    if (t.matches('.money-input')) {
      var num = parseNum(t.value);
      var k = cellKey(t.getAttribute('data-m'), t.getAttribute('data-d'));
      if (num) state.cells[k] = num; else delete state.cells[k];
      t.classList.toggle('has-val', !!num);
      refreshTotals(); save();
    } else if (t.matches('.name-input')) {
      var m1 = findMember(t.getAttribute('data-name'));
      if (m1) { m1.name = t.value; save(); }
    } else if (t.matches('.phone-input')) {
      var m2 = findMember(t.getAttribute('data-phone'));
      if (m2) { m2.phone = t.value; save(); }
    }
  });

  // 금액칸 포커스/블러 시 콤마 처리
  body.addEventListener('focus', function (e) {
    var t = e.target;
    if (!t.matches('.money-input')) return;
    var num = parseNum(t.value);
    t.value = num ? String(num) : '';
    setTimeout(function () { try { t.select(); } catch (x) {} }, 0);
  }, true);
  body.addEventListener('blur', function (e) {
    var t = e.target;
    if (!t.matches('.money-input')) return;
    var num = parseNum(t.value);
    t.value = num ? fmt(num) : '';
  }, true);

  function findMember(id) {
    for (var i = 0; i < state.members.length; i++) if (state.members[i].id === id) return state.members[i];
    return null;
  }

  // ---------- 회원 삭제 ----------
  body.addEventListener('click', function (e) {
    var del = e.target.closest('[data-del-member]');
    if (!del) return;
    var id = del.getAttribute('data-del-member');
    var m = findMember(id);
    var label = (m && m.name) ? ('"' + m.name + '"') : '이';
    if (confirm(label + ' 회원 행을 삭제할까요?')) {
      state.members = state.members.filter(function (x) { return x.id !== id; });
      Object.keys(state.cells).forEach(function (k) { if (k.split('|')[0] === id) delete state.cells[k]; });
      save(); render();
    }
  });

  // ---------- 날짜 삭제 ----------
  head.addEventListener('click', function (e) {
    var del = e.target.closest('[data-del-date]');
    if (!del) return;
    var id = del.getAttribute('data-del-date');
    var d = null;
    for (var i = 0; i < state.dates.length; i++) if (state.dates[i].id === id) d = state.dates[i];
    if (d && confirm('"' + fmtDateFull(d.iso) + '" 날짜 열을 삭제할까요? 해당 금액도 삭제됩니다.')) {
      state.dates = state.dates.filter(function (x) { return x.id !== id; });
      Object.keys(state.cells).forEach(function (k) { if (k.split('|')[1] === id) delete state.cells[k]; });
      save(); render();
    }
  });

  // ---------- 회원 추가 ----------
  document.getElementById('btn-add-member').addEventListener('click', function () {
    state.members.push({ id: uid(), name: '', phone: '' });
    save(); render();
    // 새로 추가된 행 이름칸에 포커스
    var inputs = body.querySelectorAll('.name-input');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  // ---------- 날짜 추가 ----------
  document.getElementById('btn-add-date').addEventListener('click', function () {
    var input = prompt('골프 친 날짜를 입력하세요 (예: 2026-07-28)', todayIso());
    if (input === null) return;
    var iso = input.trim();
    if (!iso) iso = todayIso();
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(iso)) {
      var p = iso.split('-');
      iso = p[0] + '-' + p[1].padStart(2, '0') + '-' + p[2].padStart(2, '0');
    } else {
      var dt = new Date(iso);
      if (isNaN(dt.getTime())) { alert('날짜 형식이 올바르지 않습니다.\n예: 2026-07-28'); return; }
      var q = function (n) { return String(n).padStart(2, '0'); };
      iso = dt.getFullYear() + '-' + q(dt.getMonth() + 1) + '-' + q(dt.getDate());
    }
    state.dates.push({ id: uid(), iso: iso });
    state.dates.sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0; });
    save(); render();
    document.getElementById('table-wrap').scrollLeft = 99999;
  });

  // ---------- 담당자 ----------
  var mgrName = document.getElementById('manager-name');
  var mgrPhone = document.getElementById('manager-phone');
  mgrName.value = state.manager.name || '';
  mgrPhone.value = state.manager.phone || '';
  mgrName.addEventListener('input', function () { state.manager.name = mgrName.value; save(); });
  mgrPhone.addEventListener('input', function () { state.manager.phone = mgrPhone.value; save(); });

  // ---------- 초기화 ----------
  document.getElementById('btn-clear').addEventListener('click', function () {
    if (confirm('모든 데이터를 지우고 빈 표(8명)로 초기화할까요?')) {
      state = { members: makeDefaultMembers(), dates: [], cells: {}, manager: { name: '', phone: '' } };
      mgrName.value = ''; mgrPhone.value = '';
      save(); render();
    }
  });

  // ---------- CSV 내보내기 ----------
  document.getElementById('btn-export').addEventListener('click', function () {
    var rows = [];
    var header = ['No', '회원 이름', '전화번호'];
    state.dates.forEach(function (d) { header.push(fmtDateFull(d.iso)); });
    header.push('합계');
    rows.push(header);

    state.members.forEach(function (m, i) {
      var row = [i + 1, m.name || '', m.phone || ''];
      state.dates.forEach(function (d) { row.push(state.cells[cellKey(m.id, d.id)] || 0); });
      row.push(memberTotal(m.id));
      rows.push(row);
    });

    var footer = ['', '날짜별 합계', ''];
    state.dates.forEach(function (d) { footer.push(dateTotal(d.id)); });
    footer.push(grandTotal());
    rows.push(footer);

    var csv = rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c == null ? '' : c);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');

    var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = '골프페널티_' + todayIso() + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ---------- 시작 ----------
  render();
})();
