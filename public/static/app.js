/* 골프 페널티 정산표 — 엑셀형, 컬럼 리사이즈, 관리자 자료실, localStorage */
(function () {
  'use strict';

  var STORE_KEY = 'golf-penalty-sheet-v3';
  var DEFAULT_ROWS = 8;
  var ADMIN_ID = 'admin';
  var ADMIN_PW = 'admin1234';

  var isAdmin = false; // 관리자 로그인 여부 (수정/삭제 권한)
  var MAX_MONEY = 100000; // 금액 입력 상한: 십만원
  var adminKey = '';       // 서버 자료실 쓰기용 관리자 키 (로그인 시 저장)
  var assetsCache = [];    // 서버(R2)에서 받아온 자료실 목록
  var assetsLoaded = false;

  // 날짜가 많아 화면을 넘어가면 가운데 오래된 날짜 열을 자동으로 접어(숨겨)
  // 회원이름·양지번호·최근 날짜 몇 개·합계가 한 화면에 보이게 함.
  // (합계 금액은 접힌 날짜까지 전부 포함해 그대로 계산)
  var collapseEnabled = true;   // 접기 사용 여부
  var expandTimer = null;       // '초기화(펼쳐보기)' 후 자동 복귀 타이머

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
          widths: d.widths || {}
          // assets(자료실 이미지)는 이제 서버(R2)에 저장 → localStorage에 두지 않음
        };
      }
    } catch (e) {}
    return {
      members: makeDefaultMembers(),
      dates: [makeDate(todayIso())],  // 골프 친 날짜 기본 1개
      cells: {}, manager: { name: '', phone: '' }, widths: {}
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

  function render() {
    _vd = computeVisibleDates();
    renderHead(); renderBody(); renderFoot(); applyWidths();
    // 표 너비가 바뀌면 상단 헤더(버튼 영역)도 그 길이에 맞춰 확장
    requestAnimationFrame(syncHeaderWidth);
  }

  // 표가 옆으로 길어질수록 상단 헤더 내부 폭을 표 너비만큼 넓혀
  // 버튼들이 "날짜가 늘어나는 길이만큼" 그 위에 자리하도록 함.
  function syncHeaderWidth() {
    var sheet = document.getElementById('sheet');
    var inner = document.getElementById('app-header-inner');
    if (!sheet || !inner) return;
    var tableW = sheet.getBoundingClientRect().width;
    // 좌우 패딩(28px)을 더해 표 오른쪽 끝까지 헤더가 이어지도록
    inner.style.minWidth = (tableW + 28) + 'px';
  }

  function wStyle(key) { return state.widths[key] ? (' style="width:' + state.widths[key] + 'px;min-width:' + state.widths[key] + 'px"') : ''; }

  // 현재 화면 폭에서 "최근 날짜 몇 개"를 보여줄 수 있는지 계산.
  // 반환: { visible: [표시할 date...], hiddenCount: 접힌 개수, hiddenTotal: 접힌 금액합 }
  function computeVisibleDates() {
    var dates = state.dates;
    // 접기 꺼짐 or 날짜가 적으면 전부 표시
    if (!collapseEnabled) return { visible: dates.slice(), hiddenCount: 0, hiddenIds: [] };

    var wrap = document.getElementById('table-wrap');
    var avail = (wrap ? wrap.clientWidth : window.innerWidth) - 24; // 여유
    // 고정 열(No/이름/양지번호/합계) 폭을 뺀 나머지에 날짜를 채움
    var noW = cssPx('--w-no', 54), nameW = colW('name', '--w-name', 132),
        phoneW = colW('phone', '--w-phone', 96), totalW = cssPx('--w-total', 110);
    var fixed = noW + nameW + phoneW + totalW;
    var foldW = 34; // '···' 접힘 표시 열 폭
    var room = avail - fixed;

    // 뒤(최근)에서부터 들어갈 수 있는 만큼만 채움
    var visible = [];
    var used = 0;
    for (var i = dates.length - 1; i >= 0; i--) {
      var dw = colW('date:' + dates[i].id, '--w-date', 92);
      var reserve = (i > 0) ? foldW : 0; // 앞에 더 있으면 접힘열 자리 확보
      if (used + dw + reserve <= room || visible.length === 0) {
        visible.unshift(dates[i]);
        used += dw;
      } else {
        break;
      }
    }
    var visibleIds = {};
    visible.forEach(function (d) { visibleIds[d.id] = true; });
    var hiddenIds = [];
    dates.forEach(function (d) { if (!visibleIds[d.id]) hiddenIds.push(d.id); });
    return { visible: visible, hiddenCount: hiddenIds.length, hiddenIds: hiddenIds };
  }
  // CSS 변수 px값 읽기(없으면 기본)
  function cssPx(varName, def) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(varName);
    var n = parseInt(v, 10); return isNaN(n) ? def : n;
  }
  // 열의 실제 지정폭(사용자가 리사이즈했으면 그 값, 아니면 CSS 변수)
  function colW(key, varName, def) {
    if (state.widths[key]) return state.widths[key];
    return cssPx(varName, def);
  }
  // 접힌 날짜들의 합계(회원 기준 memberTotal에서 접힌 부분만 필요할 때 사용)
  function hiddenMemberTotal(mid, hiddenIds) {
    var s = 0; for (var i = 0; i < hiddenIds.length; i++) s += Number(state.cells[cellKey(mid, hiddenIds[i])]) || 0; return s;
  }
  function hiddenGrandTotal(hiddenIds) {
    var s = 0; state.members.forEach(function (m) { s += hiddenMemberTotal(m.id, hiddenIds); }); return s;
  }

  var _vd = { visible: [], hiddenCount: 0, hiddenIds: [] }; // 마지막 계산 결과 캐시

  function renderHead() {
    var h = '<tr>';
    h += '<th class="col-no">No</th>';
    h += '<th class="col-name" data-col="name"' + wStyle('name') + '>회원 이름<span class="col-resize" data-rz="name"></span></th>';
    h += '<th class="col-phone" data-col="phone"' + wStyle('phone') + '>양지번호<span class="col-resize" data-rz="phone"></span></th>';
    // 접힌 날짜가 있으면 맨 앞에 '···N일' 접힘 열을 표시(누르면 전체 펼침)
    if (_vd.hiddenCount > 0) {
      h += '<th class="col-fold" title="숨겨진 날짜 ' + _vd.hiddenCount + '개 · 눌러서 전체 펼치기">' +
        '<div class="fold-head"><span class="fold-dots">···</span>' +
        '<span class="fold-cnt">+' + _vd.hiddenCount + '일</span></div></th>';
    }
    _vd.visible.forEach(function (d) {
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

  // 모든 입력칸은 누구나 자유롭게 입력·수정 가능(잠금 없음).
  function inputCls(baseCls, hasValue) {
    return baseCls;
  }

  function renderBody() {
    var h = '';
    state.members.forEach(function (m, idx) {
      h += '<tr>';
      h += '<td class="cell-no">' + (idx + 1) +
        (isAdmin ? '<button class="row-del" data-del-member="' + m.id + '" title="이 회원 삭제"><i class="fas fa-xmark"></i></button>' : '') +
        '</td>';
      h += '<td class="cell-name" data-col="name"' + wStyle('name') + '><input type="text" maxlength="6" class="' + inputCls('name-input', !!m.name) + '" data-name="' + m.id + '" value="' + escapeHtml(m.name) + '" placeholder="이름6자" /></td>';
      h += '<td class="cell-phone" data-col="phone"' + wStyle('phone') + '><input type="tel" inputmode="tel" maxlength="6" class="' + inputCls('phone-input', !!m.phone) + '" data-phone="' + m.id + '" value="' + escapeHtml(m.phone) + '" placeholder="번호6자" /></td>';
      // 접힌 날짜: 각 회원의 접힌 부분 합계를 요약 셀로 표시
      if (_vd.hiddenCount > 0) {
        var hSum = hiddenMemberTotal(m.id, _vd.hiddenIds);
        h += '<td class="cell-fold" title="숨겨진 날짜 합계">' + (hSum ? fmt(hSum) : '') + '</td>';
      }
      _vd.visible.forEach(function (d) {
        var val = state.cells[cellKey(m.id, d.id)];
        h += '<td class="cell-money" data-col="date:' + d.id + '"' + wStyle('date:' + d.id) + '><input type="text" inputmode="numeric" maxlength="7" data-m="' + m.id + '" data-d="' + d.id + '" class="' + inputCls('money-input', !!val) + (val ? ' has-val' : '') + '" value="' + (val ? fmt(val) : '') + '" placeholder="0" /></td>';
      });
      h += '<td class="cell-total" data-total-member="' + m.id + '">' + fmt(memberTotal(m.id)) + '</td>';
      h += '</tr>';
    });
    body.innerHTML = h;
  }

  function renderFoot() {
    var h = '<tr>';
    // No 열은 왼쪽 고정(sticky) 대상이므로 별도 셀로 분리.
    h += '<td class="foot-no"></td>';
    h += '<td class="foot-label" colspan="2"><i class="fas fa-calculator"></i>날짜별 합계</td>';
    if (_vd.hiddenCount > 0) {
      var hg = hiddenGrandTotal(_vd.hiddenIds);
      h += '<td class="foot-fold" title="숨겨진 날짜 합계">' + (hg ? fmt(hg) : '') + '</td>';
    }
    _vd.visible.forEach(function (d) { h += '<td class="foot-date" data-col="date:' + d.id + '" data-total-date="' + d.id + '"' + wStyle('date:' + d.id) + '>' + fmt(dateTotal(d.id)) + '</td>'; });
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
      // 금액 상한: 십만원(100,000). 초과 입력 시 상한값으로 고정
      if (num > MAX_MONEY) { num = MAX_MONEY; t.value = String(MAX_MONEY); }
      if (num < 0) num = 0;
      if (num) state.cells[k] = num; else delete state.cells[k];
      t.classList.toggle('has-val', !!num); refreshTotals(); save();
      if (qpTarget === t && quickCur) quickCur.textContent = fmt(num); // 팝오버 현재값 동기화
    } else if (t.matches('.name-input')) {
      var m1 = findMember(t.getAttribute('data-name'));
      if (m1) { m1.name = t.value; save(); }
    } else if (t.matches('.phone-input')) {
      var m2 = findMember(t.getAttribute('data-phone'));
      if (m2) { m2.phone = t.value; save(); }
    }
  });
  body.addEventListener('focus', function (e) {
    var t = e.target; if (!t.matches('.money-input')) return;
    var num = parseNum(t.value); t.value = num ? String(num) : '';
    setTimeout(function () { try { t.select(); } catch (x) {} }, 0);
    openQuickPad(t); // 천원 단위 빠른입력 팝오버 표시
  }, true);
  body.addEventListener('blur', function (e) {
    var t = e.target; if (!t.matches('.money-input')) return;
    var num = parseNum(t.value); t.value = num ? fmt(num) : '';
  }, true);

  // 표 입력칸에서 Enter → 다음 회원(아래 행)의 같은 열로 이동.
  // 마지막 행에서 Enter면 회원을 자동 추가하고 새 행으로 이동(추가입력처럼 계속 넘어감).
  body.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var t = e.target;
    var kind = null, id = null;
    if (t.matches('.name-input')) { kind = 'name'; id = t.getAttribute('data-name'); }
    else if (t.matches('.phone-input')) { kind = 'phone'; id = t.getAttribute('data-phone'); }
    else if (t.matches('.money-input')) { kind = 'money'; id = t.getAttribute('data-m'); }
    else return;
    e.preventDefault();

    var idx = -1;
    for (var i = 0; i < state.members.length; i++) if (state.members[i].id === id) { idx = i; break; }
    if (idx === -1) return;

    // 마지막 행이면 회원 추가
    if (idx === state.members.length - 1) {
      state.members.push({ id: uid(), name: '', phone: '' });
      save(); render();
    }
    // 다음 행의 같은 종류 칸으로 포커스
    var rows = body.querySelectorAll('tr');
    var next = rows[idx + 1];
    if (!next) return;
    var sel = kind === 'name' ? '.name-input' : kind === 'phone' ? '.phone-input' : '.money-input';
    var el;
    if (kind === 'money') {
      // 금액은 같은 날짜(data-d) 열을 유지
      var d = t.getAttribute('data-d');
      el = next.querySelector('.money-input[data-d="' + d + '"]');
    } else {
      el = next.querySelector(sel);
    }
    if (el) { el.focus(); try { el.select(); } catch (x) {} }
  });

  // ---------- 천원 단위 빠른입력 팝오버 ----------
  var quickPad = document.getElementById('quick-pad');
  var quickCur = document.getElementById('quick-cur');
  var qpTarget = null; // 현재 편집 중인 money-input

  function qpCanEdit(t) {
    // 모든 금액칸을 누구나 편집 가능
    return true;
  }

  function openQuickPad(t) {
    if (!qpCanEdit(t)) { quickPad.classList.add('hidden'); qpTarget = null; return; }
    qpTarget = t;
    quickCur.textContent = fmt(parseNum(t.value));
    positionQuickPad(t);
    quickPad.classList.remove('hidden');
  }

  function positionQuickPad(t) {
    var r = t.getBoundingClientRect();
    var padW = 236;
    // 입력칸 바로 아래에 배치, 화면 밖으로 나가지 않게 보정
    var left = r.left + (r.width / 2) - (padW / 2);
    if (left < 8) left = 8;
    if (left + padW > window.innerWidth - 8) left = window.innerWidth - 8 - padW;
    var top = r.bottom + 6;
    // 아래 공간이 부족하면 위쪽에 표시
    if (top + 150 > window.innerHeight) top = r.top - 156;
    quickPad.style.left = left + 'px';
    quickPad.style.top = top + 'px';
  }

  function applyQuickValue(num) {
    if (!qpTarget) return;
    if (num > MAX_MONEY) num = MAX_MONEY;
    if (num < 0) num = 0;
    var k = cellKey(qpTarget.getAttribute('data-m'), qpTarget.getAttribute('data-d'));
    if (num) state.cells[k] = num; else delete state.cells[k];
    qpTarget.value = num ? String(num) : '';
    qpTarget.classList.toggle('has-val', !!num);
    quickCur.textContent = fmt(num);
    refreshTotals(); save();
  }

  function closeQuickPad() { quickPad.classList.add('hidden'); qpTarget = null; }

  quickPad.addEventListener('mousedown', function (e) { e.preventDefault(); }); // 입력칸 blur 방지
  quickPad.addEventListener('click', function (e) {
    var add = e.target.closest('[data-add]');
    var clr = e.target.closest('[data-clear]');
    var done = e.target.closest('.qp-done');
    if (add) {
      if (!qpTarget) return;
      applyQuickValue(parseNum(qpTarget.value) + Number(add.getAttribute('data-add')));
    } else if (clr) {
      applyQuickValue(0);
    } else if (done) {
      var tv = qpTarget; closeQuickPad();
      if (tv) { var n = parseNum(tv.value); tv.value = n ? fmt(n) : ''; }
    }
  });
  // 팝오버·입력칸 바깥을 누르면 닫기
  document.addEventListener('mousedown', function (e) {
    if (quickPad.classList.contains('hidden')) return;
    if (e.target.closest('#quick-pad')) return;
    if (e.target.closest('.money-input')) return;
    closeQuickPad();
  });
  var resizeReRenderTimer = null;
  window.addEventListener('resize', function () {
    if (qpTarget) positionQuickPad(qpTarget);
    syncHeaderWidth();
    // 화면 폭이 바뀌면 접힘 개수도 달라지므로 다시 렌더(입력 중이면 건너뜀)
    if (resizeReRenderTimer) clearTimeout(resizeReRenderTimer);
    resizeReRenderTimer = setTimeout(function () {
      var ae = document.activeElement;
      if (ae && (ae.classList && (ae.classList.contains('name-input') || ae.classList.contains('phone-input') || ae.classList.contains('money-input')))) return;
      if (collapseEnabled) render();
    }, 250);
  });
  // 표를 가로로 스크롤하면 상단 헤더도 같은 위치로 스크롤 → 버튼이 표 위를 따라감
  var tableWrapEl = document.getElementById('table-wrap');
  var appHeaderEl = document.getElementById('app-header');
  tableWrapEl.addEventListener('scroll', function () {
    if (qpTarget) positionQuickPad(qpTarget);
    if (appHeaderEl) appHeaderEl.scrollLeft = tableWrapEl.scrollLeft;
  });
  // 헤더를 직접 스크롤해도 표가 같이 움직이도록(양방향 동기화)
  if (appHeaderEl) {
    appHeaderEl.addEventListener('scroll', function () {
      tableWrapEl.scrollLeft = appHeaderEl.scrollLeft;
    });
  }

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
  // 접힘 열('···+N일') 클릭 → 전체 날짜 펼쳐보기(15초 후 자동 복귀)
  head.addEventListener('click', function (e) {
    if (e.target.closest('.col-fold')) { expandAllTemporarily(); }
  });
  body.addEventListener('click', function (e) {
    if (e.target.closest('.cell-fold')) { expandAllTemporarily(); }
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
  // 선택한 날짜(iso: YYYY-MM-DD)를 실제로 표에 추가
  function addDateColumn(iso) {
    if (!iso) return;
    // 같은 날짜가 이미 있으면 중복 추가하지 않음
    for (var i = 0; i < state.dates.length; i++) {
      if (state.dates[i].iso === iso) {
        alert('이미 추가된 날짜입니다: ' + fmtDateFull(iso));
        return;
      }
    }
    var newId = uid();
    // 새 날짜 열은 "직전 날짜 열과 같은 너비"로 생성 (사용자가 조절한 폭을 그대로 상속)
    if (state.dates.length) {
      var lastDate = state.dates[state.dates.length - 1];
      var lastW = state.widths['date:' + lastDate.id];
      if (lastW) state.widths['date:' + newId] = lastW;
    }
    state.dates.push({ id: newId, iso: iso });
    state.dates.sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0; });
    save(); render();
    // 접기 상태면 최근 날짜가 이미 화면에 보이므로 왼쪽(0) 유지,
    // 펼침 상태면 오른쪽 끝(새 날짜)으로 스크롤
    document.getElementById('table-wrap').scrollLeft = collapseEnabled ? 0 : 99999;
  }

  // 날짜추가 버튼 → 브라우저 기본 달력(캘린더)을 바로 띄움
  var datePicker = document.getElementById('date-picker');
  document.getElementById('btn-add-date').addEventListener('click', function () {
    datePicker.value = todayIso(); // 오늘 날짜에서 시작
    // showPicker(): 최신 브라우저에서 달력을 즉시 표시
    if (typeof datePicker.showPicker === 'function') {
      try { datePicker.showPicker(); return; } catch (e) {}
    }
    // 폴백: 포커스 후 클릭(구형 브라우저)
    datePicker.focus(); datePicker.click();
  });
  // 달력에서 날짜를 클릭(선택)하면 즉시 열 추가
  datePicker.addEventListener('change', function () {
    var iso = datePicker.value; // 이미 YYYY-MM-DD 형식
    datePicker.value = '';
    addDateColumn(iso);
  });

  // ---------- 담당자 ----------
  var mgrName = document.getElementById('manager-name');
  var mgrPhone = document.getElementById('manager-phone');
  mgrName.value = state.manager.name || ''; mgrPhone.value = state.manager.phone || '';
  mgrName.addEventListener('input', function () { state.manager.name = mgrName.value; save(); });
  mgrPhone.addEventListener('input', function () { state.manager.phone = mgrPhone.value; save(); });
  // 담당자 이름 입력 후 Enter → 양지번호로, 양지번호에서 Enter → 표 첫 이름칸으로
  mgrName.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); mgrPhone.focus(); mgrPhone.select && mgrPhone.select(); } });
  mgrPhone.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      var first = body.querySelector('.name-input');
      if (first) { first.focus(); try { first.select(); } catch (x) {} }
    }
  });

  // ---------- 초기화(=전체 펼쳐보기) ----------
  // 버튼을 누르면 접혀 있던 모든 날짜를 펼쳐 보여주고, 약 15초 후 원래(접힘) 상태로 복귀.
  var EXPAND_SECONDS = 15;
  function expandAllTemporarily() {
    collapseEnabled = false;      // 접기 해제 → 전체 표시
    if (expandTimer) clearTimeout(expandTimer);
    render();
    document.getElementById('table-wrap').scrollLeft = 0; // 처음(오래된 날짜)부터 보이게
    showExpandNotice(EXPAND_SECONDS);
    expandTimer = setTimeout(function () {
      collapseEnabled = true;     // 다시 접힘
      expandTimer = null;
      render();
      hideExpandNotice();
    }, EXPAND_SECONDS * 1000);
  }
  // 펼침 상태 안내 배너 + 남은 초 카운트다운
  var noticeTimer = null;
  function showExpandNotice(sec) {
    var banner = document.getElementById('mode-banner');
    if (!banner) return;
    banner.dataset.prev = banner.dataset.prev || banner.innerHTML;
    var left = sec;
    function paint() {
      banner.className = 'mode-banner mode-expand';
      banner.innerHTML = '<i class="fas fa-eye"></i> 전체 날짜를 펼쳐 보는 중 · <b>' + left + '초</b> 후 자동으로 접힙니다 · <button id="collapse-now" class="banner-btn">지금 접기</button>';
    }
    paint();
    if (noticeTimer) clearInterval(noticeTimer);
    noticeTimer = setInterval(function () {
      left--; if (left <= 0) { clearInterval(noticeTimer); noticeTimer = null; return; }
      paint();
    }, 1000);
  }
  function hideExpandNotice() {
    if (noticeTimer) { clearInterval(noticeTimer); noticeTimer = null; }
    updateAdminBtn(); // 배너를 원래(모드) 문구로 복원
  }
  // '지금 접기' 버튼(배너 안) 클릭
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'collapse-now') {
      if (expandTimer) { clearTimeout(expandTimer); expandTimer = null; }
      collapseEnabled = true; render(); hideExpandNotice();
    }
  });

  document.getElementById('btn-clear').addEventListener('click', expandAllTemporarily);

  // 관리자 전용: 정산표 완전 초기화(데이터 삭제)는 관리자 화면에서 수행
  function fullReset() {
    if (!isAdmin) { alert('초기화는 관리자만 할 수 있습니다.'); return; }
    if (confirm('정산표(회원/날짜/금액)를 완전히 초기화할까요?\n※ 관리자 자료실 이미지는 유지됩니다.')) {
      state.members = makeDefaultMembers();
      state.dates = [makeDate(todayIso())];
      state.cells = {}; state.manager = { name: '', phone: '' }; state.widths = {};
      mgrName.value = ''; mgrPhone.value = '';
      collapseEnabled = true;
      save(); render();
    }
  }

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
  function endResize() { if (rz) { rz = null; document.body.style.userSelect = ''; document.body.style.cursor = ''; save(); syncHeaderWidth(); } }

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
        banner.innerHTML = '<i class="fas fa-pen"></i> 일반 사용자 모드 · 모든 칸을 <b>자유롭게 입력·수정</b>할 수 있습니다 (회원·날짜 삭제, 자료실은 관리자)';
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
      isAdmin = true;
      adminKey = loginPw.value; // 서버 자료실 API 쓰기 인증에 사용(x-admin-key)
      loginModal.classList.add('hidden');
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
    isAdmin = false; adminKey = ''; updateAdminBtn(); closeAdmin();
    alert('관리자 모드를 종료했습니다. 이제 일반 사용자(입력만 가능) 상태입니다.');
  });

  function updateAssetCount() {
    var el = document.getElementById('asset-count-num');
    if (el) el.textContent = assetsCache.length;
  }

  function renderAdmin() {
    // 요약
    var totalPenalty = grandTotal();
    var namedMembers = state.members.filter(function (m) { return m.name.trim(); }).length;
    document.getElementById('admin-summary').innerHTML =
      '<div class="summary-item"><div class="num">' + namedMembers + '</div><div class="lbl">등록 회원</div></div>' +
      '<div class="summary-item"><div class="num">' + state.dates.length + '</div><div class="lbl">골프 날짜</div></div>' +
      '<div class="summary-item"><div class="num">' + fmt(totalPenalty) + '</div><div class="lbl">누적 페널티(원)</div></div>' +
      '<div class="summary-item"><div class="num" id="asset-count-num">' + assetsCache.length + '</div><div class="lbl">자료 개수</div></div>';
    // 서버(R2)에서 자료실 목록을 불러와 렌더
    loadAssetsFromServer();
  }

  // 서버에서 자료실 목록 로드
  function loadAssetsFromServer() {
    var list = document.getElementById('asset-list');
    list.innerHTML = '<div class="asset-empty"><i class="fas fa-spinner fa-spin"></i> 자료를 불러오는 중…</div>';
    fetch('/api/assets')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        assetsCache = (d && d.ok && d.assets) ? d.assets : [];
        assetsLoaded = true;
        updateAssetCount();
        renderAssets();
      })
      .catch(function () {
        list.innerHTML = '<div class="asset-empty"><i class="fas fa-triangle-exclamation"></i> 자료실을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div>';
      });
  }

  function renderAssets() {
    var list = document.getElementById('asset-list');
    if (!assetsCache.length) { list.innerHTML = '<div class="asset-empty"><i class="fas fa-folder-open"></i> 등록된 자료가 없습니다. 이미지를 추가해 보세요.</div>'; return; }
    var h = '';
    assetsCache.forEach(function (a) {
      h += '<div class="asset-item">' +
        (isAdmin ? '<button class="asset-del" data-del-asset="' + a.id + '" title="삭제"><i class="fas fa-trash"></i></button>' : '') +
        '<img src="' + a.url + '" alt="' + escapeHtml(a.name) + '" data-view="' + a.id + '" loading="lazy" />' +
        '<div class="asset-cap">' + escapeHtml(a.name) + '</div>' +
        '</div>';
    });
    list.innerHTML = h;
  }

  // 자료 추가 (서버 R2 업로드)
  var assetName = document.getElementById('asset-name');
  var assetFile = document.getElementById('asset-file');
  var pendingFile = null;
  assetFile.addEventListener('change', function () {
    var f = assetFile.files[0]; if (!f) { pendingFile = null; return; }
    if (f.size > 8 * 1024 * 1024) { alert('이미지 용량이 큽니다(최대 8MB). 더 작은 이미지를 사용해 주세요.'); assetFile.value = ''; return; }
    pendingFile = f;
  });
  document.getElementById('asset-save').addEventListener('click', function () {
    if (!isAdmin) { alert('자료 등록은 관리자만 할 수 있습니다.'); return; }
    if (!pendingFile) { alert('이미지를 먼저 선택해 주세요.'); return; }
    var name = assetName.value.trim() || pendingFile.name || '자료';
    var saveBtn = document.getElementById('asset-save');
    var origHtml = saveBtn.innerHTML;
    saveBtn.disabled = true; saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 업로드 중…';

    var fd = new FormData();
    fd.append('file', pendingFile);
    fd.append('name', name);
    fetch('/api/assets', { method: 'POST', headers: { 'x-admin-key': adminKey }, body: fd })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        if (res.status === 401) { alert('관리자 인증에 실패했습니다. 다시 로그인해 주세요.'); return; }
        if (!res.d || !res.d.ok) { alert('업로드 실패: ' + ((res.d && res.d.error) || '알 수 없는 오류')); return; }
        assetName.value = ''; assetFile.value = ''; pendingFile = null;
        loadAssetsFromServer();
      })
      .catch(function () { alert('네트워크 오류로 업로드에 실패했습니다.'); })
      .then(function () { saveBtn.disabled = false; saveBtn.innerHTML = origHtml; });
  });

  // 자료 삭제 / 크게보기
  document.getElementById('asset-list').addEventListener('click', function (e) {
    var del = e.target.closest('[data-del-asset]');
    if (del) {
      if (!isAdmin) return;
      var id = del.getAttribute('data-del-asset');
      if (!confirm('이 자료를 삭제할까요? (서버에서 영구 삭제됩니다)')) return;
      fetch('/api/assets/' + encodeURIComponent(id), { method: 'DELETE', headers: { 'x-admin-key': adminKey } })
        .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
        .then(function (res) {
          if (res.status === 401) { alert('관리자 인증에 실패했습니다. 다시 로그인해 주세요.'); return; }
          if (!res.d || !res.d.ok) { alert('삭제 실패: ' + ((res.d && res.d.error) || '오류')); return; }
          loadAssetsFromServer();
        })
        .catch(function () { alert('네트워크 오류로 삭제에 실패했습니다.'); });
      return;
    }
    var view = e.target.closest('[data-view]');
    if (view) {
      var vid = view.getAttribute('data-view');
      var a = null; for (var i = 0; i < assetsCache.length; i++) if (assetsCache[i].id === vid) a = assetsCache[i];
      if (a) { document.getElementById('img-big').src = a.url; document.getElementById('img-caption').textContent = a.name; document.getElementById('img-modal').classList.remove('hidden'); }
    }
  });
  document.getElementById('img-close').addEventListener('click', function () { document.getElementById('img-modal').classList.add('hidden'); });
  document.getElementById('img-modal').addEventListener('click', function (e) { if (e.target.id === 'img-modal') document.getElementById('img-modal').classList.add('hidden'); });

  // 관리자: CSV / 백업 / 복원
  document.getElementById('admin-export').addEventListener('click', exportCsv);
  var adminResetBtn = document.getElementById('admin-reset');
  if (adminResetBtn) adminResetBtn.addEventListener('click', fullReset);
  document.getElementById('admin-backup').addEventListener('click', function () {
    // 정산 데이터(회원/날짜/금액)만 백업. 자료실 이미지는 서버(R2)에 자동 보관됨.
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
          widths: d.widths || {}
          // 자료실 이미지는 서버(R2)에 있으므로 복원 대상이 아님
        };
        save(); mgrName.value = state.manager.name || ''; mgrPhone.value = state.manager.phone || '';
        render(); renderAdmin();
        alert('정산 데이터를 복원했습니다. (자료실 이미지는 서버에 그대로 유지됩니다)');
      } catch (x) { alert('올바른 백업 파일이 아닙니다.'); }
      e.target.value = '';
    };
    reader.readAsText(f);
  });

  // ---------- 시작 ----------
  updateAdminBtn();
  render();
  window.addEventListener('load', syncHeaderWidth);
  if (document.fonts && document.fonts.ready) { document.fonts.ready.then(syncHeaderWidth); }
})();
