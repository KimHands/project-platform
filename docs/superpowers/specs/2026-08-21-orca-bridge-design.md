# Orca 연동 (F) 설계

작성일: 2026-08-21
범위: 통합 플랫폼의 **5차 스펙** — 연구실 노트북에 켜둔 Orca 세션을, 퇴근 후 집의 다른 컴퓨터(Windows, Orca 미설치) 브라우저에서 이어서 작업할 수 있게, 대시보드에서 "원격 이어가기 모드"를 켜고 접속 링크를 얻는다.

## 배경 & 시나리오

A+B(대시보드), C(부팅 자동실행), D(프로젝트 추가)는 main에 병합됨. 이 스펙은 "Orca를 연동하여 다른 기기에서 기존 세션을 이어서 개발" 요구(F)를 구현한다.

**구체 시나리오:** 연구실 노트북에 Orca 세션을 켜둔 채 퇴근 → 집 Windows 컴퓨터 브라우저에서 그 노트북의 세션에 접속해 이어 작업. 노트북이 "host"이고 연구실에 켜둔 채 있는다.

**Orca**(stablyai/orca): 코딩 에이전트를 git worktree 단위로 실행하는 데스크톱 앱 + 모바일 컴패니언. 노트북에 설치·실행 중(v1.4.184).

## 실측으로 확정된 제약 (설계의 근거)

1. **페어링 링크(모바일 QR·웹 URL)를 만드는 유일한 명령은 `orca serve`** 다. 실행 중인 데스크톱에서 링크만 뽑는 별도 CLI는 없음(228개 명령 확인).
2. **`orca serve`와 Orca 데스크톱 앱은 같은 머신에서 공존 불가** — 같은 userData 프로필 single-instance 락. 즉 원격 접속 링크를 얻으려면 **데스크톱을 닫고 `orca serve`(헤드리스)로 전환**해야 한다.
3. `orca serve --json`은 bound/advertised endpoint·pairing 상태를 출력하고, 웹 클라이언트 번들이 있으면 **browser URL(집 Windows용)**, `--mobile-pairing`이면 **모바일 QR/링크**를 낸다.
4. `--pairing-address`에 노트북의 **Tailscale IP**를 주면, 같은 tailnet의 집 Windows가 그 주소로 접속. `orca status --json`·`orca environment list --json`은 정상 동작.

## 성립 조건 (사용자 워크플로우)

1. 노트북이 연구실에서 켜져 있음(잠자기 방지).
2. 노트북과 집 Windows가 **Tailscale 같은 tailnet**(사설망).
3. 노트북이 **`orca serve` 모드**(데스크톱 닫힘)로 떠 있음 → 집 Windows 브라우저용 URL 제공.

## 스코프

- **F1 (앱 코드, 이 스펙):** 대시보드에서 (a) Orca 상태 표시, (b) Tailscale 주소 자동 감지, (c) **"원격 이어가기 모드" 관리**(detached `orca serve` 시작/중지) — 집 Windows용 브라우저 URL + 모바일 QR + endpoint 표시, (d) 저장된 원격환경 목록.
- **F2 (런북, 문서):** 노트북·Windows Tailscale 설정 절차. 클라우드 자동 프로비저닝 없음(안전 게이트). README 문서화.

비범위: 프로젝트를 Orca로 여는 per-project 버튼, 클라우드 VM 자동 생성, 공개 인터넷 노출, 데스크톱 자동 종료(사용자가 직접 닫음).

## 확인 못 한 리스크 (정직하게 명시)

데스크톱에서 **한창 실행 중이던 에이전트 작업**이 serve 모드 전환 후 그대로 이어질지는 미검증. 프로젝트·worktree·저장 세션은 유지되나, 진행 중이던 실행은 재시작이 필요할 수 있음(코드·브랜치 손실은 없음). serve 출력 JSON의 **정확한 필드명**도 구현 시 실측 캡처로 확정 필요(§테스트).

## 아키텍처 & 안전 모델

```
lib/orca/            서버 전용. 고정 orca 서브커맨드만 shell-out (임의 실행 금지)
├─ statusParse.ts     `orca status --json` 파싱 → OrcaStatus (순수, TDD)
├─ serveParse.ts      `orca serve --json` 출력 파싱 → ServeInfo (순수, TDD; fixture 실측)
├─ envParse.ts        `orca environment list --json` 파싱 (순수, TDD)
├─ reachability.ts    주소 분류(tailscale/lan/loopback/public) + Tailscale IP 감지
├─ orcaCli.ts         execFile('orca', [고정 args]) 얇은 래퍼 (status, environment list)
└─ serveManager.ts    detached `orca serve` 프로세스 관리 (start/stop/getState, 상태파일 영속)
```

**detached serve:** `spawn('orca', ['serve','--pairing-address',<addr>,'--mobile-pairing','--json'], { detached:true, stdio:['ignore', logFd, logFd] })` 후 `unref()` → **대시보드를 꺼도(=Next 재시작) 저녁 내내 유지**. 로그 파일을 폴링해 초기 JSON에서 ServeInfo 파싱. 상태(pid·address·serve·startedAt)를 상태파일에 저장. `getState`는 상태파일 + `process.kill(pid,0)`로 생존 확인.

**안전 레일:**
- 서버는 고정 서브커맨드만: `status`, `environment list`, `serve --pairing-address <검증된 사설주소> --mobile-pairing`. execFile+배열 인자(셸 없음).
- `--pairing-address`는 **사설 IP만**: Tailscale `100.64.0.0/10`, 사설 `10/8`·`172.16/12`·`192.168/16`, 루프백. **공개 IP·도메인 거부**.
- "원격 이어가기 시작"은 **명시적 클릭 + 노출 경고**. 데스크톱 실행 중이면 시작 거부(먼저 닫으라 안내) — 자동 종료 안 함.
- 단일 인스턴스: 이미 serve 떠 있으면 중복 시작 거부(또는 기존 상태 반환).

## 데이터 모델 / 인터페이스

```
interface OrcaStatus { installed: boolean; desktopRunning: boolean; ready: boolean; version: string | null; reachable: boolean }
interface OrcaEnvironment { name: string; endpoint?: string; [k: string]: unknown }
interface ServeInfo { endpoint: string | null; browserUrl: string | null; mobileUrl: string | null }
type AddressKind = 'tailscale' | 'lan' | 'loopback' | 'public'
interface Reachability { address: string | null; kind: AddressKind; allowed: boolean; tailscaleAvailable: boolean }
interface ServeState { running: boolean; pid: number | null; address: string | null; serve: ServeInfo | null; startedAt: number | null }

// statusParse(jsonText): OrcaStatus     // installed=파싱성공; desktopRunning=result.app.running; ready=result.runtime.state==='ready'; version=result.runtime.appVersion; reachable=result.runtime.reachable
// serveParse(jsonText): ServeInfo       // browser URL / mobile 링크 / advertised endpoint 추출, 없으면 null (정확 필드명 실측 확정)
// envParse(jsonText): OrcaEnvironment[] // result.environments
// classifyAddress(ip): AddressKind ; isAllowedAddress(ip): boolean  // 사설/tailscale/loopback→true, public→false
```

## API

- `GET /api/orca/status` → `{ status: OrcaStatus, environments: OrcaEnvironment[], reachability: Reachability, serve: ServeState }`. orca 미설치/미실행이면 안전 기본값으로 정상 응답(크래시 없음).
- `POST /api/orca/serve` `{ action: 'start' | 'stop' }`:
  - `start`: orca 미설치→400 `{code:'orca-missing'}`; 데스크톱 실행 중→409 `{code:'desktop-running'}`; reachability.allowed=false→400 `{code:'unreachable'}`; 이미 running→200 기존 상태. 통과 시 detached serve 시작→로그 폴링(최대 ~15s)→`ServeState` 반환.
  - `stop`: 저장된 pid kill, `{running:false}`.
  - 오류 형식 `{ error, code }`.

## UI (글로벌 Orca 패널)

`components/OrcaPanel.tsx`(클라이언트), 대시보드 배치. 초기 로드 + 폴링으로 `GET /api/orca/status`.
- **상태 배지**: 설치·데스크톱 실행·버전·reachable. 미설치→brew 안내, 데스크톱 실행 중→"원격 모드는 데스크톱을 닫아야 합니다" 안내.
- **도달성**: 감지된 Tailscale IP(권장). 없으면 "Tailscale 설정 필요"(F2 런북 링크).
- **원격 이어가기**: "시작" 버튼(무엇이 노출되는지 경고). 시작되면 **집 Windows용 브라우저 URL**(복사 + QR) + **모바일 QR/링크** + advertised endpoint + "중지". 데스크톱 실행 중이면 버튼 비활성 + 안내.
- **원격 환경**: `environments` 목록.

## F2 런북 (README, 자동화 아님)

1. 노트북·Windows 양쪽 Tailscale 설치·같은 계정(같은 tailnet).
2. 노트북 Tailscale IP는 대시보드가 자동 감지·표시.
3. 퇴근 전: 노트북에서 Orca **데스크톱 닫고** 대시보드 "원격 이어가기 시작" → 표시된 브라우저 URL 기록. 노트북 잠자기 해제.
4. 집: Windows 브라우저로 그 URL 접속(Orca 설치 불필요).
- **공개 인터넷 노출(리버스프록시) 금지** 명시.

## 오류 처리

- orca/tailscale CLI 부재·실패 → 파서·감지가 안전 기본값 반환, 패널은 안내만. 크래시 없음.
- serve 자식이 즉시 죽거나 URL 미출력 → ServeInfo 필드 null + 로그 경로 안내.
- 공개 주소 start 시도 → 거부(400). 데스크톱 실행 중 start → 거부(409).
- 상태파일의 pid가 죽어 있으면 running:false로 정리.

## 테스트 (web.md의 TDD)

순수 함수 우선(실측 orca 출력 fixture):
- `statusParse`: 실측 `orca status --json`(app.running·runtime.state·appVersion·reachable) → 매핑; 깨진/빈 → installed:false.
- `serveParse`: `orca serve --json` 출력 → browser URL·mobile 링크·endpoint 추출, 없으면 null. **구현 시 실제 출력을 한 번 캡처해 fixture 확정**(데스크톱 잠시 닫아야 하므로 사용자 인지 하에; 못 하면 문서상 shape로 작성 후 사용자 확인 단계).
- `envParse`: `result.environments` → 배열, 빈/깨짐 → [].
- `classifyAddress`/`isAllowedAddress`: `100.64.1.20`→tailscale(allow), `192.168/10/172.16`→lan(allow), `127.0.0.1`→loopback(allow), 공개 IP·도메인→deny.
- `serveManager`: spawn·fs·process.kill 목으로 start(→ServeState)·stop·getState(pid 생존) 통합. 실제 serve 구동은 사용자 검증.
