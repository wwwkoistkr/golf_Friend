# 개발 인수인계 문서 (다른 AI/개발자용)

이 문서는 **골프 페널티 정산표** 프로젝트를 다른 AI 또는 개발자가 이어받아
수정할 수 있도록 구조와 핵심 파일을 설명합니다.

## 1. 프로젝트 개요
- 골프 모임 회원(기본 8명)의 날짜별 페널티(벌금) 금액을 기록·합산하는
  엑셀/구글시트 형식의 단일 페이지 웹앱.
- **서버 DB 없음**. 모든 데이터는 브라우저 `localStorage`에 저장됨
  (키: `golf-penalty-sheet-v2`).
- 프레임워크: **Hono + Vite**, 배포 대상: **Cloudflare Pages**.

## 2. 기술 스택
| 항목 | 내용 |
|---|---|
| 백엔드 | Hono (Cloudflare Pages Functions) — HTML 한 페이지만 서빙 |
| 프론트 | 순수 Vanilla JS (프레임워크 없음) |
| 스타일 | 순수 CSS (Font Awesome 아이콘만 CDN) |
| 빌드 | Vite (`@hono/vite-build/cloudflare-pages`) |
| 저장 | 브라우저 localStorage (외부 API/DB 없음) |

## 3. 핵심 파일 (여기만 보면 됨)
```
src/index.tsx           ← 페이지 HTML 전체 (헤더/버튼/표 뼈대). 여기서 페이지 구조 수정
public/static/app.js    ← ★ 모든 로직 (렌더링, 합계 계산, 입력, 저장, CSV). 기능 수정은 대부분 여기
public/static/style.css ← ★ 모든 디자인 (색상/글씨/그리드/반응형). 디자인 수정은 여기
```
그 외 `vite.config.ts`, `wrangler.jsonc`, `package.json`, `tsconfig.json`,
`ecosystem.config.cjs`는 빌드/배포 설정이라 보통 손댈 필요 없음.
`src/renderer.tsx`는 템플릿 잔재로 현재 미사용.

## 4. app.js 데이터 모델
```js
state = {
  members: [{ id, name, phone }],   // 회원 행 (기본 8개 빈 행)
  dates:   [{ id, iso }],           // iso = "YYYY-MM-DD", 날짜순 자동 정렬
  cells:   { "memberId|dateId": 금액(number) },  // 각 셀 값
  manager: { name, phone }          // 담당자 정보
}
```
- 합계: `memberTotal(id)`(회원별), `dateTotal(id)`(날짜별), `grandTotal()`(전체).
- 렌더: `render()` → `renderHead()` / `renderBody()` / `renderFoot()`.
- 입력 중에는 `refreshTotals()`로 합계만 갱신(성능).
- 저장은 모든 변경 후 `save()` 호출 (localStorage 직렬화).

## 5. 로컬 실행 방법
```bash
# 의존성 설치 (최초 1회)
npm install

# 개발/미리보기 (Cloudflare Pages 로컬 서버)
npm run build
npx wrangler pages dev dist --ip 0.0.0.0 --port 3000
# 또는 PM2: pm2 start ecosystem.config.cjs

# 브라우저에서 http://localhost:3000 접속
```
> 참고: 순수 정적 파일이라 `public/static/app.js`, `style.css`만 고칠 때는
> `dist`를 다시 빌드해야 반영됨(`npm run build`). 로컬에서 빠르게 보려면
> `index.tsx`의 HTML을 그대로 열어도 되지만, 정식 확인은 build 후 권장.

## 6. Cloudflare Pages 배포
```bash
npm run build
npx wrangler pages deploy dist --project-name <프로젝트명>
```
(Cloudflare API 토큰/로그인 필요)

## 7. 자주 하는 수정 가이드
- **기본 회원 수 변경**: `app.js` 상단 `DEFAULT_ROWS = 8` 수정.
- **색상 변경**: `style.css` 최상단 `:root` 변수(--green 등) 수정.
- **컬럼 추가**(예: 이메일): `index.tsx`엔 표 뼈대가 없으므로 `app.js`의
  `renderHead()`/`renderBody()`에 `<th>`/`<td>` 추가 + `state.members`에 필드 추가.
- **합계 위치를 왼쪽으로**: `renderBody()`에서 합계 `<td>` 위치와 CSS의
  `.cell-total { right:0 }`를 `left`로 옮기면 됨.
- **여러 명 실시간 공유**: 현재 localStorage → Cloudflare D1/KV 등으로 교체 필요
  (app.js의 load/save를 fetch API 호출로 바꾸고 Hono에 API 라우트 추가).

## 8. 이미지 파일
- 이 프로젝트에는 별도 이미지 파일이 없음.
- 파비콘은 `index.tsx` 내 인라인 SVG(⛳ 이모지) 사용.
- 아이콘은 Font Awesome CDN 사용(오프라인 필요 시 로컬 호스팅으로 교체).
