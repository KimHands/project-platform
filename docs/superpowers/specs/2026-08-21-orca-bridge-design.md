# Orca 연동 (F) 설계

작성일: 2026-08-21
범위: 통합 플랫폼의 **5차 스펙** — 대시보드에 Orca 연동 패널을 얹어, Orca 세션을 모바일·다른 컴퓨터(웹)에서 이어갈 수 있게 링크를 노출한다.

## 배경

A+B(대시보드), C(부팅 자동실행), D(프로젝트 추가)는 main에 병합됨. 이 스펙은 "Orca를 연동하여 모바일에서 기존 세션에서 이어서 개발" 요구(F)를 구현한다.

**Orca**(stablyai/orca)는 여러 코딩 에이전트를 git worktree 단위로 병렬 실행하는 데스크톱 앱 + 모바일 컴패니언이며, agent-agnostic(Claude Code·Codex 등). 랩탑에 이미 설치·실행 중(v1.4.184, `/usr/local/bin/orca`, `/Applications/Orca.app`).

**핵심 스코프 결정:** 크로스 디바이스·모바일 이어가기는 **Orca의 네이티브 기능**이다. 우리 플랫폼은 이를 재구현하지 않고, Orca CLI로 넘겨주고 Orca의 이어가기 수단을 화면에 노출하는 **얇은 연동 계층(bridge)** 만 만든다.

**확인된 Orca CLI 메커니즘(실측):**
- `orca status --json` → 앱/런타임 준비 상태, 버전.
- `orca serve [--port <p>] [--pairing-address <host>] [--mobile-pairing] [--json]` → 런타임 서버(포그라운드). bound/advertised endpoint·pairing 상태 출력. 웹 클라이언트 번들이 있으면 **browser URL(페어링 내장)** 도 출력. `--mobile-pairing`이면 모바일 QR/링크.
- `--pairing-address` = 클라이언트에 광고되는 주소. LAN·Tailscale·SSH-forward·리버스프록시 중 도달 가능한 것.
- `orca environment list --json` (add/show/rm 존재) → 저장된 원격 런타임.

**Windows 제약:** 이어갈 다른 컴퓨터는 Windows이고 Orca 미설치 → **Orca 웹 클라이언트(browser URL)** 로 해결(설치 불필요, 브라우저만). `--pairing-address`에 랩탑 Tailscale IP를 주면 같은 tailnet의 Windows가 접속.

## 스코프

- **F1 (앱 코드, 이 스펙):** Orca 상태 표시 + 이어가기 링크(모바일 QR + Windows용 브라우저 URL) + 저장된 원격 환경 목록.
- **F2 (런북, 문서):** Windows↔랩탑 도달성을 위한 Tailscale 수동 설정 절차. 플랫폼이 클라우드 VM을 자동 생성하지 않음(안전 게이트). README에 문서화.

비범위: 프로젝트를 Orca로 여는 per-project 버튼(사용자가 Orca 데스크톱에서 직접 시작), 클라우드 VM 자동 프로비저닝, 공개 인터넷 노출.

## 아키텍처 & 안전 모델

"이어가기 링크"를 주려면 `orca serve`가 도달 가능한 주소로 떠 있어야 한다. 이는 랩탑 Orca 런타임(터미널·에이전트 실행 가능)을 네트워크에 노출하는 것이라 보안이 핵심이다.

```
lib/orca/            서버 전용. 한정된 orca 서브커맨드만 shell-out (임의 실행 금지)
├─ statusParse.ts     `orca status --json` 파싱 → OrcaStatus (순수, TDD)
├─ serveParse.ts      `orca serve --json` 출력 파싱 → { browserUrl, mobileUrl, endpoint } (순수, TDD)
├─ envParse.ts        `orca environment list --json` 파싱 → 목록 (순수, TDD)
├─ reachability.ts    주소 분류 tailscale/lan/public + Tailscale IP 감지 (순수 분류 + 얇은 감지)
├─ orcaCli.ts         execFile('orca', [고정 args]) 얇은 래퍼
└─ continuation.ts    `orca serve` 자식 프로세스 관리 (start/stop, 모듈 싱글턴)
```

**안전 레일:**
- 서버는 **고정된 서브커맨드만** 실행: `status`, `environment list`, `serve --pairing-address <검증된 주소> [--mobile-pairing]`. 사용자 입력이 셸 인자로 직접 안 들어감(execFile + 배열 인자, 셸 없음).
- `--pairing-address`는 **사설 IP만 허용**: Tailscale CGNAT `100.64.0.0/10`, 사설 `10.0.0.0/8`·`172.16.0.0/12`·`192.168.0.0/16`, 루프백. **공개 IP·도메인·리버스프록시 거부**.
- "이어가기 시작"은 **명시적 사용자 클릭 + 노출 경고**. 자동 시작 안 함. (사용자 규칙의 안전 게이트: 권한·외부 노출)
- 단일 인스턴스: 재시작 시 이전 serve 먼저 종료. stop 시 kill.

## 데이터 모델 / 인터페이스

```
interface OrcaStatus { installed: boolean; running: boolean; ready: boolean; version: string | null; reachable: boolean }
interface OrcaEnvironment { name: string; endpoint?: string; [k: string]: unknown }
interface ServeInfo { endpoint: string | null; browserUrl: string | null; mobileUrl: string | null }
type AddressKind = 'tailscale' | 'lan' | 'loopback' | 'public'
interface Reachability { address: string | null; kind: AddressKind; allowed: boolean; tailscaleAvailable: boolean }
interface ContinuationState { running: boolean; startedAt: number | null; serve: ServeInfo | null; address: string | null }

// statusParse(jsonText: string): OrcaStatus   // installed=파싱성공, running/ready/version/reachable from JSON
// serveParse(jsonText: string): ServeInfo      // `orca serve --json` 출력에서 browser URL / mobile 링크 / advertised endpoint 추출, 없으면 null. 정확한 필드명은 구현 시 실측 캡처로 확정.
// envParse(jsonText: string): OrcaEnvironment[]
// classifyAddress(ip: string): AddressKind     // 사설 대역 판정
// isAllowedAddress(ip: string): boolean        // tailscale|lan|loopback → true, public → false
```

## API

- `GET /api/orca/status` → `{ status: OrcaStatus, environments: OrcaEnvironment[], continuation: ContinuationState, reachability: Reachability }`. orca 미설치/미실행이면 `status.installed/running=false`로 정상 응답(크래시 없음).
- `POST /api/orca/continuation` `{ action: 'start' | 'stop' }`:
  - `start`: reachability.allowed=false면 400 `{ error, code: 'unreachable' }`. 통과 시 `orca serve --pairing-address <addr> --mobile-pairing --json` 자식 시작, stdout 파싱해 `ServeInfo` 반환(201/200).
  - `stop`: 자식 kill, `{ running: false }`.
  - orca 미설치면 400 `{ error, code: 'orca-missing' }`.
  - 오류 형식 `{ error, code }`.

## UI (글로벌 Orca 패널)

`components/OrcaPanel.tsx`(클라이언트) — 대시보드에 배치. `GET /api/orca/status` 폴링/초기 로드.
- **상태 배지**: 설치·실행·버전·reachable. 미설치→"Orca 미설치"(brew 안내), 미실행→"Orca 실행 필요"(`orca open` 안내).
- **도달성**: 감지된 Tailscale IP(권장) 또는 LAN IP. Tailscale 없으면 "LAN은 같은 네트워크에서만" 경고.
- **이어가기**: "이어가기 시작" 버튼(노출 경고 문구 포함) → 시작 시 **Windows용 브라우저 URL**(복사·QR) + **모바일 QR/링크** + advertised endpoint + "중지". 없으면 시작 전 안내.
- **원격 환경**: `environments` 목록(이름·endpoint). 비어 있으면 F2 런북 링크.

## F2 런북 (README 문서, 자동화 아님)

Windows가 랩탑 Orca에 닿기 위한 수동 절차:
1. 랩탑·Windows 양쪽에 Tailscale 설치·같은 계정 로그인(같은 tailnet).
2. 랩탑 Tailscale IP는 대시보드가 자동 감지해 표시.
3. 대시보드 "이어가기 시작" → 표시된 브라우저 URL을 Windows 브라우저로 열기(Orca 설치 불필요).
- **공개 인터넷 노출(리버스프록시) 금지** 명시. 클라우드 VM 자동 생성 안 함.

## 오류 처리

- orca CLI 부재/실패 → 파서가 안전 기본값(installed:false 등) 반환, 패널은 안내만. 크래시 없음.
- serve 자식이 즉시 죽거나 URL 미출력 → `ServeInfo` 필드 null + 로그 안내.
- 공개 주소로 start 시도 → 거부(400).
- 서버 프로세스 종료 시 자식 정리(가능한 범위). 단일 인스턴스 보장.

## 테스트 (web.md의 TDD)

순수 함수 우선(실측 orca 출력 fixture 사용):
- `statusParse`: 정상 JSON → 필드 매핑, 깨진/빈 입력 → installed:false.
- `serveParse`: `orca serve --json` 출력에서 browser URL·mobile 링크·advertised endpoint 추출, 없으면 각각 null. **구현 시 실제 `orca serve --json`을 잠깐 띄워 출력을 캡처해 fixture로 확정**(정확한 필드명 의존성).
- `envParse`: 목록 JSON → 배열, 빈/깨짐 → [].
- `classifyAddress`/`isAllowedAddress`: `100.64.1.20`→tailscale(allow), `192.168.x`·`10.x`·`172.16.x`→lan(allow), `127.0.0.1`→loopback(allow), 공개 IP·도메인→public(deny).
- `continuation`·`orcaCli`: execFile 목으로 통합(start→serveParse 경유 상태, stop→종료). 실제 orca 구동은 사용자 검증.
