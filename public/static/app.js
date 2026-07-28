/* 골프 페널티 정산표 — localStorage 기반 스프레드시트 */
(function () {
  'use strict';

  const STORE_KEY = 'golf-penalty-sheet-v1';

  /** @type {{members:Array, dates:Array, cells:Object, manager:{name:string,phone:string}}} */
  let state = load();

  // ---------- 저장/로드 ----------
  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        return {
          members: d.members || [],
          dates: d.dates || [],
          cells: d.cells || {},
          manager: d.manager || { name: '', phone: '' },
        };
      }
    } catch (e) { /* ignore */ }
    return { members: [], dates: [], cells: {}, manager: { name: '', phone: '' } };
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  // ---------- 숫자 포맷 ----------
  function fmt(n) {
    n = Number(n) || 0;
    return n.toLocaleString('ko-KR');
  }
  function parseNum(str) {
    if (str == null) return 0;
    const v = String(str).replace(/[^\d.-]/g, '');
    const n = parseFloat(v);
    return isNaN(n) ? 0 : Math.round(n);
  }

  function cellKey(memberId, dateId) { return memberId + '|' + dateId; }

  // ---------- 합계 계산 ----------
  function memberTotal(memberId) {
    let sum = 0;
    state.dates.forEach(function (d) {
      sum += Number(state.cells[cellKey(memberId, d.id)]) || 0;
    });
    return sum;
  }
  function dateTotal(dateId) {
    let sum = 0;
    state.members.forEach(function (m) {
      sum += Number(state.cells[cellKey(m.id, dateId)]) || 0;
    });
    return sum;
  }
  function grandTotal() {
    let sum = 0;
    state.members.forEach(function (m) { sum += memberTotal(m.id); });
    return sum;
  }

  // ---------- 날짜 포맷 ----------
  function fmtDate(iso) {
    if (!iso) return '';
    const parts = iso.split('-');
    if (parts.length === 3) return parts[1] + '/' + parts[2];
    return iso;
  }
  function todayIso() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  // ---------- 렌더링 ----------
  const head = document.getElementById('sheet-head');
  const body = document.getElementById('sheet-body');
  const foot = document.getElementById('sheet-foot');
  const emptyHint = document.getElementById('empty-hint');

  function render() {
    renderHead();
    renderBody();
    renderFoot();

    const empty = state.members.length === 0 && state.dates.length === 0;
    emptyHint.classList.toggle('hidden', !empty);
    document.getElementById('sheet').style.display = empty ? 'none' : '';
  }

  function renderHead() {
    let html = '<tr>';
    html += '<th class="col-name">회원 \\ 날짜</th>';
    state.dates.forEach(function (d) {
      html += '<th class="col-date"><div class="date-head">' +
        '<span class="date-text">' + fmtDate(d.iso) + '</span>' +
        '<button class="date-del" data-del-date="' + d.id + '" title="날짜 삭제"><i class="fas fa-xmark"></i> 삭제</button>' +
        '</div></th>';
    });
    html += '<th class="col-total"><i class="fas fa-won-sign"></i> 합계</th>';
    html += '</tr>';
    head.innerHTML = html;
  }

  function renderBody() {
    let html = '';
    state.members.forEach(function (m) {
      html += '<tr>';
      // 이름 셀
      html += '<td class="name-cell">' +
        '<span class="m-name">' + escapeHtml(m.name) + '</span>';
      if (m.phone) {
        html += '<span class="m-phone"><i class="fas fa-phone"></i> ' +
          '<a href="tel:' + escapeHtml(m.phone) + '">' + escapeHtml(m.phone) + '</a></span>';
      }
      html += '<span class="name-row-actions">' +
        '<button class="edit-btn" data-edit-member="' + m.id + '" title="수정"><i class="fas fa-pen"></i></button>' +
        '<button data-del-member="' + m.id + '" title="삭제"><i class="fas fa-trash"></i></button>' +
        '</span>';
      html += '</td>';
      // 금액 셀
      state.dates.forEach(function (d) {
        const val = state.cells[cellKey(m.id, d.id)];
        const hasVal = val ? ' has-val' : '';
        html += '<td class="money-cell"><input type="text" inputmode="numeric" ' +
          'data-m="' + m.id + '" data-d="' + d.id + '" ' +
          'class="' + hasVal.trim() + '" value="' + (val ? fmt(val) : '') + '" placeholder="0" /></td>';
      });
      // 회원 합계
      html += '<td class="total-cell" data-total-member="' + m.id + '">' + fmt(memberTotal(m.id)) + '</td>';
      html += '</tr>';
    });
    body.innerHTML = html;
  }

  function renderFoot() {
    if (state.members.length === 0 && state.dates.length === 0) { foot.innerHTML = ''; return; }
    let html = '<tr>';
    html += '<td class="foot-label"><i class="fas fa-calculator"></i> 날짜별 합계</td>';
    state.dates.forEach(function (d) {
      html += '<td data-total-date="' + d.id + '">' + fmt(dateTotal(d.id)) + '</td>';
    });
    html += '<td class="grand-total">' + fmt(grandTotal()) + '</td>';
    html += '</tr>';
    foot.innerHTML = html;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 합계만 갱신 (입력 중 전체 재렌더 방지)
  function refreshTotals() {
    state.members.forEach(function (m) {
      const el = body.querySelector('[data-total-member="' + m.id + '"]');
      if (el) el.textContent = fmt(memberTotal(m.id));
    });
    state.dates.forEach(function (d) {
      const el = foot.querySelector('[data-total-date="' + d.id + '"]');
      if (el) el.textContent = fmt(dateTotal(d.id));
    });
    const g = foot.querySelector('.grand-total');
    if (g) g.textContent = fmt(grandTotal());
  }

  // ---------- 이벤트: 금액 입력 ----------
  body.addEventListener('input', function (e) {
    const inp = e.target;
    if (!inp.matches('input[data-m]')) return;
    const mId = inp.getAttribute('data-m');
    const dId = inp.getAttribute('data-d');
    const num = parseNum(inp.value);
    if (num) state.cells[cellKey(mId, dId)] = num;
    else delete state.cells[cellKey(mId, dId)];
    inp.classList.toggle('has-val', !!num);
    refreshTotals();
    save();
  });

  // 입력 끝나면 천단위 콤마 정리
  body.addEventListener('blur', function (e) {
    const inp = e.target;
    if (!inp.matches('input[data-m]')) return;
    const num = parseNum(inp.value);
    inp.value = num ? fmt(num) : '';
  }, true);

  // 포커스 시 콤마 제거해 편집 편하게
  body.addEventListener('focus', function (e) {
    const inp = e.target;
    if (!inp.matches('input[data-m]')) return;
    const num = parseNum(inp.value);
    inp.value = num ? String(num) : '';
    setTimeout(function () { try { inp.select(); } catch (x) {} }, 0);
  }, true);

  // ---------- 이벤트: 회원/날짜 삭제·수정 ----------
  body.addEventListener('click', function (e) {
    const delBtn = e.target.closest('[data-del-member]');
    if (delBtn) {
      const id = delBtn.getAttribute('data-del-member');
      const m = state.members.find(function (x) { return x.id === id; });
      if (m && confirm('"' + m.name + '" 회원을 삭제할까요? 입력된 금액도 함께 삭제됩니다.')) {
        state.members = state.members.filter(function (x) { return x.id !== id; });
        Object.keys(state.cells).forEach(function (k) { if (k.indexOf(id + '|') === 0) delete state.cells[k]; });
        save(); render();
      }
      return;
    }
    const editBtn = e.target.closest('[data-edit-member]');
    if (editBtn) { openMemberModal(editBtn.getAttribute('data-edit-member')); return; }
  });

  head.addEventListener('click', function (e) {
    const delDate = e.target.closest('[data-del-date]');
    if (delDate) {
      const id = delDate.getAttribute('data-del-date');
      const d = state.dates.find(function (x) { return x.id === id; });
      if (d && confirm('"' + fmtDate(d.iso) + '" 날짜를 삭제할까요? 해당 날짜 금액도 삭제됩니다.')) {
        state.dates = state.dates.filter(function (x) { return x.id !== id; });
        Object.keys(state.cells).forEach(function (k) { if (k.indexOf('|' + id) !== -1 && k.split('|')[1] === id) delete state.cells[k]; });
        save(); render();
      }
    }
  });

  // ---------- 회원 추가/수정 모달 ----------
  const memberModal = document.getElementById('member-modal');
  const mNameInp = document.getElementById('m-name');
  const mPhoneInp = document.getElementById('m-phone');
  const memberModalTitle = document.getElementById('member-modal-title');
  let editingMemberId = null;

  function openMemberModal(id) {
    editingMemberId = id || null;
    if (id) {
      const m = state.members.find(function (x) { return x.id === id; });
      mNameInp.value = m ? m.name : '';
      mPhoneInp.value = m ? (m.phone || '') : '';
      memberModalTitle.innerHTML = '<i class="fas fa-user-pen"></i> 회원 수정';
    } else {
      mNameInp.value = '';
      mPhoneInp.value = '';
      memberModalTitle.innerHTML = '<i class="fas fa-user-plus"></i> 회원 추가';
    }
    memberModal.classList.remove('hidden');
    setTimeout(function () { mNameInp.focus(); }, 50);
  }
  function closeMemberModal() { memberModal.classList.add('hidden'); editingMemberId = null; }

  document.getElementById('btn-add-member').addEventListener('click', function () { openMemberModal(null); });
  document.getElementById('m-cancel').addEventListener('click', closeMemberModal);
  memberModal.addEventListener('click', function (e) { if (e.target === memberModal) closeMemberModal(); });

  document.getElementById('m-save').addEventListener('click', function () {
    const name = mNameInp.value.trim();
    const phone = mPhoneInp.value.trim();
    if (!name) { alert('이름을 입력하세요.'); mNameInp.focus(); return; }
    if (editingMemberId) {
      const m = state.members.find(function (x) { return x.id === editingMemberId; });
      if (m) { m.name = name; m.phone = phone; }
    } else {
      state.members.push({ id: uid(), name: name, phone: phone });
    }
    save(); render(); closeMemberModal();
  });
  mPhoneInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') document.getElementById('m-save').click(); });
  mNameInp.addEventListener('keydown', function (e) { if (e.key === 'Enter') mPhoneInp.focus(); });

  // ---------- 날짜 추가 ----------
  document.getElementById('btn-add-date').addEventListener('click', function () {
    const def = todayIso();
    const input = prompt('골프 친 날짜를 입력하세요 (YYYY-MM-DD)', def);
    if (input === null) return;
    let iso = input.trim();
    if (!iso) iso = def;
    // 간단 검증 & 보정
    if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(iso)) {
      const d = new Date(iso);
      if (isNaN(d.getTime())) { alert('날짜 형식이 올바르지 않습니다. 예: 2026-07-28'); return; }
      const p = (n) => String(n).padStart(2, '0');
      iso = d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    } else {
      const parts = iso.split('-');
      iso = parts[0] + '-' + parts[1].padStart(2, '0') + '-' + parts[2].padStart(2, '0');
    }
    state.dates.push({ id: uid(), iso: iso });
    state.dates.sort(function (a, b) { return a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0; });
    save(); render();
  });

  // ---------- 담당자 ----------
  const mgrName = document.getElementById('manager-name');
  const mgrPhone = document.getElementById('manager-phone');
  mgrName.value = state.manager.name || '';
  mgrPhone.value = state.manager.phone || '';
  mgrName.addEventListener('input', function () { state.manager.name = mgrName.value; save(); });
  mgrPhone.addEventListener('input', function () { state.manager.phone = mgrPhone.value; save(); });

  // ---------- 메뉴 (내보내기 / 초기화) ----------
  const menu = document.getElementById('menu-dropdown');
  document.getElementById('btn-menu').addEventListener('click', function (e) {
    e.stopPropagation();
    menu.classList.toggle('hidden');
  });
  document.addEventListener('click', function () { menu.classList.add('hidden'); });
  menu.addEventListener('click', function (e) { e.stopPropagation(); });

  document.getElementById('btn-clear').addEventListener('click', function () {
    menu.classList.add('hidden');
    if (confirm('모든 회원·날짜·금액 데이터를 삭제합니다. 계속할까요?')) {
      state = { members: [], dates: [], cells: {}, manager: { name: mgrName.value, phone: mgrPhone.value } };
      save(); render();
    }
  });

  document.getElementById('btn-export').addEventListener('click', function () {
    menu.classList.add('hidden');
    exportCsv();
  });

  function exportCsv() {
    if (state.members.length === 0) { alert('내보낼 데이터가 없습니다.'); return; }
    const rows = [];
    const header = ['회원', '전화번호'];
    state.dates.forEach(function (d) { header.push(fmtDate(d.iso)); });
    header.push('합계');
    rows.push(header);

    state.members.forEach(function (m) {
      const row = [m.name, m.phone || ''];
      state.dates.forEach(function (d) {
        row.push(state.cells[cellKey(m.id, d.id)] || 0);
      });
      row.push(memberTotal(m.id));
      rows.push(row);
    });

    const footer = ['날짜별 합계', ''];
    state.dates.forEach(function (d) { footer.push(dateTotal(d.id)); });
    footer.push(grandTotal());
    rows.push(footer);

    const csv = rows.map(function (r) {
      return r.map(function (cell) {
        const s = String(cell == null ? '' : cell);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\n');

    // BOM 추가 (엑셀 한글 깨짐 방지)
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '골프페널티_' + todayIso() + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---------- 초기 렌더 ----------
  render();
})();
