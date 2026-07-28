import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0">
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
      <button id="btn-add-member" class="btn btn-light"><i class="fas fa-user-plus"></i><span class="btn-text"> 회원 추가</span></button>
      <button id="btn-add-date" class="btn btn-light"><i class="fas fa-calendar-plus"></i><span class="btn-text"> 날짜 추가</span></button>
      <button id="btn-export" class="btn btn-light"><i class="fas fa-file-csv"></i><span class="btn-text"> 엑셀저장</span></button>
      <button id="btn-clear" class="btn btn-light"><i class="fas fa-rotate-left"></i><span class="btn-text"> 초기화</span></button>
    </div>
  </header>

  <div class="manager-bar">
    <span class="mgr-label"><i class="fas fa-user-tie"></i> 담당자</span>
    <input id="manager-name" type="text" placeholder="이름" />
    <input id="manager-phone" type="tel" placeholder="전화번호" inputmode="tel" />
    <span class="mgr-hint">입력 내용은 자동 저장됩니다</span>
  </div>

  <main class="app-main">
    <div class="table-wrap" id="table-wrap">
      <table id="sheet" class="sheet">
        <thead id="sheet-head"></thead>
        <tbody id="sheet-body"></tbody>
        <tfoot id="sheet-foot"></tfoot>
      </table>
    </div>
  </main>

  <script src="/static/app.js"></script>
</body>
</html>`)
})

export default app
