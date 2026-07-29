import { Hono } from 'hono'

// R2 최소 타입 선언 (@cloudflare/workers-types 미설치 환경 대비)
interface R2Object { key: string; uploaded?: any; customMetadata?: Record<string, string>; httpMetadata?: { contentType?: string }; body: any }
interface R2Bucket {
  list(opts?: any): Promise<{ objects: R2Object[] }>;
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: any, opts?: any): Promise<any>;
  delete(key: string): Promise<void>;
}

type Bindings = {
  ASSETS_BUCKET: R2Bucket;
  ADMIN_KEY?: string;  // 관리자 쓰기 보호 키 (secret). 미설정 시 기본값 사용
}

const app = new Hono<{ Bindings: Bindings }>()

// 관리자 쓰기 키 검증. secret ADMIN_KEY 가 설정돼 있으면 그 값과,
// 없으면 기본값 'admin1234' 와 비교(로컬/초기용).
function checkAdmin(c: any): boolean {
  const expected = (c.env && c.env.ADMIN_KEY) ? c.env.ADMIN_KEY : 'admin1234';
  const got = c.req.header('x-admin-key') || '';
  return got === expected;
}

// ---------- 자료실 API (Cloudflare R2) ----------

// 목록: R2에 저장된 이미지들의 메타데이터(id, name, ts) 반환
app.get('/api/assets', async (c) => {
  try {
    const list = await c.env.ASSETS_BUCKET.list({ prefix: 'assets/', include: ['customMetadata'] });
    const items = list.objects.map((o) => {
      const meta = (o.customMetadata || {}) as Record<string, string>;
      const id = o.key.replace(/^assets\//, '');
      return {
        id,
        name: meta.name || id,
        ts: meta.ts ? Number(meta.ts) : (o.uploaded ? new Date(o.uploaded).getTime() : 0),
        url: '/api/assets/' + encodeURIComponent(id)
      };
    });
    // 최신 업로드가 위로
    items.sort((a, b) => b.ts - a.ts);
    return c.json({ ok: true, assets: items });
  } catch (e: any) {
    return c.json({ ok: false, error: String(e && e.message || e) }, 500);
  }
});

// 이미지 원본 조회 (누구나 볼 수 있음 = 공유)
app.get('/api/assets/:id', async (c) => {
  const id = c.req.param('id');
  const obj = await c.env.ASSETS_BUCKET.get('assets/' + id);
  if (!obj) return c.notFound();
  const headers = new Headers();
  const ct = (obj.httpMetadata && obj.httpMetadata.contentType) || 'application/octet-stream';
  headers.set('Content-Type', ct);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  return new Response(obj.body, { headers });
});

// 업로드 (관리자만): multipart/form-data { file, name }
app.post('/api/assets', async (c) => {
  if (!checkAdmin(c)) return c.json({ ok: false, error: 'unauthorized' }, 401);
  try {
    const form = await c.req.formData();
    const file = form.get('file');
    const name = (form.get('name') as string) || '';
    if (!file || typeof file === 'string') return c.json({ ok: false, error: 'no file' }, 400);
    const f = file as unknown as File;
    if (f.size > 8 * 1024 * 1024) return c.json({ ok: false, error: 'too large (max 8MB)' }, 400);

    const ext = (f.name && f.name.indexOf('.') >= 0) ? f.name.slice(f.name.lastIndexOf('.')) : '';
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + ext;
    const buf = await f.arrayBuffer();
    await c.env.ASSETS_BUCKET.put('assets/' + id, buf, {
      httpMetadata: { contentType: f.type || 'application/octet-stream' },
      customMetadata: { name: (name || f.name || '자료'), ts: String(Date.now()) }
    });
    return c.json({ ok: true, asset: { id, name: (name || f.name || '자료'), ts: Date.now(), url: '/api/assets/' + encodeURIComponent(id) } });
  } catch (e: any) {
    return c.json({ ok: false, error: String(e && e.message || e) }, 500);
  }
});

// 삭제 (관리자만)
app.delete('/api/assets/:id', async (c) => {
  if (!checkAdmin(c)) return c.json({ ok: false, error: 'unauthorized' }, 401);
  try {
    await c.env.ASSETS_BUCKET.delete('assets/' + c.req.param('id'));
    return c.json({ ok: true });
  } catch (e: any) {
    return c.json({ ok: false, error: String(e && e.message || e) }, 500);
  }
});

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
          <p class="admin-desc"><i class="fas fa-cloud"></i> 이미지는 <b>서버(Cloudflare R2)</b>에 저장되어 <b>모든 사람이 함께 보고</b>, 자동으로 <b>영구 보관·백업</b>됩니다. 브라우저를 지워도 사라지지 않습니다. (이미지당 최대 8MB)</p>
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

  <!-- 금액 빠른입력 팝오버 (천원 단위) -->
  <div id="quick-pad" class="quick-pad hidden">
    <div class="quick-pad-cur"><span id="quick-cur">0</span> 원</div>
    <div class="quick-pad-btns">
      <button class="qp-btn qp-add" data-add="1000">+1천</button>
      <button class="qp-btn qp-add" data-add="2000">+2천</button>
      <button class="qp-btn qp-add" data-add="3000">+3천</button>
      <button class="qp-btn qp-add" data-add="5000">+5천</button>
      <button class="qp-btn qp-add" data-add="10000">+1만</button>
      <button class="qp-btn qp-clear" data-clear="1"><i class="fas fa-eraser"></i> 지움</button>
    </div>
    <div class="quick-pad-foot">
      <button class="qp-done"><i class="fas fa-check"></i> 완료</button>
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
