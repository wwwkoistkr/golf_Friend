import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
  <meta name="theme-color" content="#1f7a4d">
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⛳</text></svg>">
  <title>골프 페널티 정산표</title>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link href="/static/style.css" rel="stylesheet">
</head>
<body>
  <header class="app-header">
    <h1><i class="fas fa-golf-ball-tee"></i> 골프 페널티 정산표</h1>
    <div class="header-actions">
      <button id="btn-add-member" class="btn btn-light"><i class="fas fa-user-plus"></i><span class="btn-text"> 회원추가</span></button>
      <button id="btn-add-date" class="btn btn-light"><i class="fas fa-calendar-plus"></i><span class="btn-text"> 날짜추가</span></button>
      <button id="btn-export" class="btn btn-light"><i class="fas fa-file-csv"></i><span class="btn-text"> 엑셀저장</span></button>
      <button id="btn-clear" class="btn btn-light"><i class="fas fa-rotate-left"></i><span class="btn-text"> 초기화</span></button>
      <button id="btn-admin" class="btn btn-gold"><i class="fas fa-user-shield"></i><span class="btn-text"> 관리자</span></button>
    </div>
  </header>

  <div class="manager-bar">
    <span class="mgr-label"><i class="fas fa-user-tie"></i> 담당자</span>
    <input id="manager-name" type="text" placeholder="이름" />
    <input id="manager-phone" type="tel" placeholder="양지번호" inputmode="tel" />
    <span class="mgr-hint">칸 경계선을 드래그하면 너비를 조절할 수 있어요 · 자동 저장됨</span>
  </div>

  <main class="app-main" id="view-sheet">
    <div id="mode-banner" class="mode-banner mode-user">
      <i class="fas fa-pen"></i> 일반 사용자 모드 · <b>새 입력만</b> 가능합니다 (수정·삭제는 관리자)
    </div>
    <div class="table-wrap" id="table-wrap">
      <table id="sheet" class="sheet">
        <thead id="sheet-head"></thead>
        <tbody id="sheet-body"></tbody>
        <tfoot id="sheet-foot"></tfoot>
      </table>
    </div>
  </main>

  <!-- 관리자 자료실 화면 -->
  <main class="app-main hidden" id="view-admin">
    <section class="admin-panel">
      <div class="admin-top">
        <h2><i class="fas fa-database"></i> 관리자 자료실</h2>
        <div class="admin-top-btns">
          <button id="btn-admin-close" class="btn btn-gray"><i class="fas fa-table"></i> 정산표로</button>
          <button id="btn-logout" class="btn btn-red"><i class="fas fa-right-from-bracket"></i> 로그아웃</button>
        </div>
      </div>
      <p class="admin-note"><i class="fas fa-circle-info"></i> 관리자 모드에서는 정산표의 모든 값을 <b>수정·삭제</b>할 수 있습니다. 로그아웃하면 일반 사용자는 <b>새 입력만</b> 가능합니다.</p>

      <div class="admin-cards">
        <div class="admin-card">
          <h3><i class="fas fa-chart-simple"></i> 데이터 요약</h3>
          <div id="admin-summary" class="admin-summary"></div>
          <div class="admin-btns">
            <button id="admin-export" class="btn btn-green"><i class="fas fa-file-csv"></i> 정산표 CSV 내보내기</button>
            <button id="admin-backup" class="btn btn-green"><i class="fas fa-download"></i> 전체 백업(JSON)</button>
            <label class="btn btn-gray file-btn"><i class="fas fa-upload"></i> 백업 복원
              <input id="admin-restore" type="file" accept="application/json" hidden />
            </label>
          </div>
        </div>

        <div class="admin-card">
          <h3><i class="fas fa-images"></i> 자료실 (이미지 · 이름)</h3>
          <p class="admin-desc">회원 사진, 영수증, 모임 사진 등 자료를 이름과 함께 등록·관리합니다.</p>
          <div class="asset-add">
            <input id="asset-name" type="text" placeholder="자료 이름 (예: 김회원 사진)" />
            <label class="btn btn-green file-btn"><i class="fas fa-image"></i> 이미지 선택
              <input id="asset-file" type="file" accept="image/*" hidden />
            </label>
            <button id="asset-save" class="btn btn-gold"><i class="fas fa-plus"></i> 등록</button>
          </div>
          <div id="asset-list" class="asset-list"></div>
        </div>
      </div>
    </section>
  </main>

  <!-- 관리자 로그인 모달 -->
  <div id="login-modal" class="modal hidden">
    <div class="modal-box">
      <h3><i class="fas fa-user-shield"></i> 관리자 로그인</h3>
      <label>아이디
        <input id="login-id" type="text" placeholder="admin" autocomplete="username" />
      </label>
      <label>비밀번호
        <input id="login-pw" type="password" placeholder="비밀번호" autocomplete="current-password" />
      </label>
      <p id="login-error" class="login-error hidden">아이디 또는 비밀번호가 올바르지 않습니다.</p>
      <div class="modal-actions">
        <button id="login-cancel" class="btn btn-gray">취소</button>
        <button id="login-ok" class="btn btn-green">로그인</button>
      </div>
    </div>
  </div>

  <!-- 이미지 크게 보기 -->
  <div id="img-modal" class="modal hidden">
    <div class="img-view">
      <button id="img-close" class="img-close"><i class="fas fa-xmark"></i></button>
      <img id="img-big" src="" alt="" />
      <div id="img-caption" class="img-caption"></div>
    </div>
  </div>

  <script src="/static/app.js"></script>
</body>
</html>`)
})

export default app
