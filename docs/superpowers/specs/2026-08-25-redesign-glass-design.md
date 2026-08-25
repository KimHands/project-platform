# UI 전면 리디자인 (글래스 + 그라데이션, 다크) 설계

작성일: 2026-08-25
범위: 대시보드·상세·모달 등 전체 UI를 다크 글래스모피즘 + 그라데이션으로 리스타일. **순수 비주얼 변경**(동작·API·로직·데이터 흐름 불변). 이 카테고리(개발자 대시보드)의 검증된 패턴을 참고한 오리지널 디자인.

## 배경

현재 UI는 흰 배경 + 하드코딩 slate 카드라 "템플릿 기본값" 느낌. 또한 `globals.css`의 `body { font-family: Arial }`가 이미 로드된 Geist 폰트를 덮어써 실제로 안 쓰이고, 카드가 전부 하드코딩 라이트라 다크모드도 안 먹는다. 이 기회에 폰트 버그를 고치고 통일된 다크 글래스 테마로 전환한다.

## 방향 (브레인스토밍 확정)

- **다크 베이스 글래스 + 그라데이션.** 유리 효과가 살아나도록 어두운 그라데이션 캔버스 위에 반투명 프로스티드 글래스 카드.
- 순수 비주얼: 마크업/클래스 + `globals.css`만. 동작·API·상태 로직 변경 없음.

## 파운데이션 (`app/globals.css`, `app/layout.tsx`)

- **그라데이션 캔버스:** 깊은 다크 베이스(예 `#0b0b13`)에 크고 부드러운 컬러 블롭 2~3개(인디고→바이올렛→시안)를 `radial-gradient`로 은은하게. 배경은 정적(성능: 블롭에 blur 애니메이션 남발 금지, 느린 드리프트는 선택).
- **글래스 유틸(`.glass`):** `background: rgba(255,255,255,0.05)` + `backdrop-blur(14px)` + `border: 1px solid rgba(255,255,255,0.08)` + 부드러운 그림자 + 미세한 top inset 하이라이트. 호버 시 `translateY(-2px)` + 테두리·글로우 강화.
- **팔레트(상태색 비비드):** 기획=슬레이트, 진행중=에메랄드, 중단=앰버, 완료=바이올렛/블루, 규칙위반=로즈. 포인트 그라데이션 = 인디고→푸시아.
- **타이포:** `body{font-family:Arial}` 제거 → 본문 **Geist Sans**, 숫자·경로·명령·PID는 **Geist Mono**. 헤더 타이틀은 그라데이션 텍스트(`bg-clip-text`).
- **접근성/대비:** 유리 위 본문은 거의 흰색(≈`#f4f4f8`), 보조는 흰색 60~70%. 포커스 링 유지. 상태 pill은 배경 대비 충분한 텍스트색.
- CSS 변수/토큰은 `@theme inline`(Tailwind v4)와 `:root`에 정의해 컴포넌트가 유틸 클래스로 재사용.

## 컴포넌트 리스타일 (동작 불변)

- **헤더/상단바(`app/page.tsx`):** 그라데이션 타이틀 + 요약(규칙위반/경고/총 N)을 글래스 pill. "+ 새 프로젝트"는 인디고→푸시아 그라데이션 버튼(호버 글로우). 상단바 스크롤 시 blur 고정(선택).
- **ProjectCard:** 글래스 카드 + 호버 lift/glow. 상태=글로우 점+pill. 진행도 바=그라데이션 채움(없으면 은은한 `—`). 스택=글래스 chip. git 신선도·경고=하단 모노 미니 배지. 매니페스트 없으면 살짝 흐리게(opacity).
- **StatusBadge / StackIcons:** 반투명 pill·chip 통일, 아이콘 대비 보정(어두운 배경에서 흰 아이콘 가독).
- **OrcaPanel:** 상단 히어로 글래스 패널. QR은 흰 배경 카드에 얹어 스캔성 확보. 상태 배지·주소·시작/중지 유지.
- **RunControls:** 동작/중지 버튼 강조, 로그 `pre`는 어두운 글래스 + 모노, 포트 링크=액센트.
- **상세 뷰(`app/project/[name]/page.tsx`):** 섹션 헤더 위계 정리, 글래스 카드로 그룹(설명·스택·진행도·Git·실행·규칙).
- **NewProjectDialog:** 글래스 모달 + 백드롭 블러, 생성 위치 미리보기 강조. 실시간 검증·에러 표시 유지.

## 범위 / 비범위

- 대상 파일: `app/globals.css`, `app/layout.tsx`, `app/page.tsx`, `app/project/[name]/page.tsx`, `components/ProjectCard.tsx`, `components/StatusBadge.tsx`, `components/StackIcons.tsx`, `components/OrcaPanel.tsx`, `components/RunControls.tsx`, `components/NewProjectDialog.tsx`.
- **비범위:** 어떤 동작·API·상태 로직·데이터 흐름·라우팅 변경도 없음. 스캐너/러너/Orca/creator 로직 불변. 새 의존성 추가 없음(Tailwind v4 유틸 + 커스텀 CSS로 충분; QR은 기존 `qrcode.react` 유지). 새 페이지/기능 없음.

## 안전 / 검증

- 순수 CSS/마크업 변경이라 스냅샷 테스트가 없으므로 **기존 87개 테스트는 영향 없이 그대로 통과**해야 한다(변경 후 `npm test`로 확인).
- `npm run build` 성공.
- gstack로 대시보드·상세·모달(+ Orca 패널) 스크린샷을 찍어 전/후 비교 및 가독성 확인. 실제 실행 버튼 클릭·프로세스 시작은 하지 않음.
- 성능: backdrop-blur는 카드/모달 등 제한적으로. 배경 블롭은 정적 또는 저비용 드리프트.

## 테스트 관점

- UI 스타일 변경은 로직 무관 → 신규 단위 테스트 없음. 검증은 빌드 + 브라우저 스크린샷(gstack) + 기존 스위트 회귀.
- 접근성: 대비(본문/보조/pill 텍스트), 포커스 링, 링크 식별성 확인.
