import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
  <meta name="theme-color" content="#166534">
  <title>골프 페널티 정산표</title>
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⛳</text></svg>">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link href="/static/style.css" rel="stylesheet">
</head>
<body>
  <header class="app-header">
    <h1><i class="fas fa-golf-ball-tee"></i> 골프 페널티 정산표</h1>
    <div class="header-actions">
      <button id="btn-add-member" class="btn btn-light"><i class="fas fa-user-plus"></i> 회원 추가</button>
      <button id="btn-add-date" class="btn btn-light"><i class="fas fa-calendar-plus"></i> 날짜 추가</button>
      <button id="btn-menu" class="btn btn-light btn-icon"><i class="fas fa-ellipsis-vertical"></i></button>
    </div>
  </header>

  <div id="menu-dropdown" class="menu-dropdown hidden">
    <button id="btn-export"><i class="fas fa-file-csv"></i> CSV 내보내기</button>
    <button id="btn-clear"><i class="fas fa-trash"></i> 전체 초기화</button>
  </div>

  <main class="app-main">
    <section class="info-bar">
      <label class="manager-field">
        <i class="fas fa-user-tie"></i>
        <span class="manager-label">담당자</span>
        <input id="manager-name" type="text" placeholder="담당자 이름" />
        <i class="fas fa-phone"></i>
        <input id="manager-phone" type="tel" placeholder="전화번호" inputmode="tel" />
      </label>
    </section>

    <section class="table-wrap" id="table-wrap">
      <table id="sheet" class="sheet">
        <thead id="sheet-head"></thead>
        <tbody id="sheet-body"></tbody>
        <tfoot id="sheet-foot"></tfoot>
      </table>
      <p id="empty-hint" class="empty-hint hidden">
        <i class="fas fa-arrow-up"></i> 상단의 "회원 추가"와 "날짜 추가"로 시작하세요.
      </p>
    </section>
  </main>

  <div id="member-modal" class="modal hidden">
    <div class="modal-box">
      <h3 id="member-modal-title"><i class="fas fa-user"></i> 회원 정보</h3>
      <label>이름
        <input id="m-name" type="text" placeholder="회원 이름" />
      </label>
      <label>전화번호
        <input id="m-phone" type="tel" placeholder="010-0000-0000" inputmode="tel" />
      </label>
      <div class="modal-actions">
        <button id="m-cancel" class="btn btn-gray">취소</button>
        <button id="m-save" class="btn btn-green">저장</button>
      </div>
    </div>
  </div>

  <script src="/static/app.js"></script>
</body>
</html>`)
})

export default app
