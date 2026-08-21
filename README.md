# project-platform

로컬 맥 프로젝트 폴더를 스캔해 기술스택·진행도·규칙 위반을 웹 대시보드로 보여주는 플랫폼.

---

## 실행법

```bash
# 의존성 설치
npm install

# 개발 서버 시작
npm run dev
# → http://localhost:3000

# 테스트 실행
npm test
```

---

## 스캔 루트

대시보드는 다음 두 폴더를 자동으로 스캔합니다.

| 카테고리 | 경로 |
|---|---|
| project | `~/Desktop/Projects` |
| career | `~/Desktop/Career` |

각 루트 바로 아래의 **서브 디렉터리 하나 = 프로젝트 하나**로 인식합니다. 숨김 폴더(`.`으로 시작)와 파일은 제외합니다.

---

## project.json 스키마

프로젝트 루트에 `project.json`을 두면 대시보드에 상세 정보가 표시됩니다. 모든 필드는 선택사항입니다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `description` | string | 프로젝트 한 줄 설명 |
| `status` | `"planning"` \| `"active"` \| `"paused"` \| `"done"` | 진행 상태 |
| `progress` | number (0–100) | 진행률 (%) |
| `run.cmd` | string | 실행 명령어 (예: `npm run dev`) |
| `run.port` | number | 서버 포트 번호 |
| `stack` | string[] | 추가 기술스택 태그 |
| `tags` | string[] | 자유 태그 |

예시:

```json
{
  "description": "프로젝트 설명",
  "status": "active",
  "progress": 60,
  "run": { "cmd": "npm run dev", "port": 3000 },
  "stack": ["react"],
  "tags": ["dashboard"]
}
```

---

## 프로젝트 추가

대시보드의 "+ 새 프로젝트" 버튼으로 규칙 준수 폴더를 자동 생성할 수 있습니다.

### 사용법

1. 대시보드에서 "+ 새 프로젝트" 클릭
2. 필수 정보 입력:
   - **폴더명**: ASCII 소문자·숫자·하이픈만 허용 (예: `my-project`, `project-123`)
   - **카테고리**: `project` (Projects) 또는 `career` (Career)
   - **설명**, **상태**, **태그**: 선택사항
3. "생성" 버튼 클릭 → 로컬 폴더 생성

### 생성되는 파일

생성 시 다음 3개 파일이 자동으로 생성됩니다.

| 파일 | 역할 |
|---|---|
| `CLAUDE.md` | 프로젝트 규칙 문서 (첫 줄: `@AGENTS.md`) |
| `AGENTS.md` | 에이전트 설정 |
| `project.json` | 프로젝트 메타데이터 (설명, 상태, 진행도 등) |

### 주의사항

- **폴더명 규칙**: 기존 폴더명과 중복되면 생성되지 않습니다.
- **경로**: `~/Desktop/Projects/` 또는 `~/Desktop/Career/` 바로 아래에만 생성됩니다.
- **덮어쓰기 금지**: 같은 이름의 폴더가 이미 있으면 409 오류가 발생합니다.

---

## 검사 규칙

스캐너가 각 프로젝트 폴더에 대해 아래 규칙을 검사합니다. 위반 시 대시보드에 경고 또는 오류가 표시됩니다.

| 규칙 ID | 심각도 | 설명 |
|---|---|---|
| `folder-name-format` | error | 폴더명은 ASCII 소문자·숫자·하이픈만 허용 |
| `claudemd-exists` | warn | 루트에 `CLAUDE.md` 파일이 있어야 함 |
| `claudemd-first-line` | warn | `CLAUDE.md` 첫 줄이 `@AGENTS.md` 이어야 함 |
| `agentsmd-exists` | warn | 루트에 `AGENTS.md` 파일이 있어야 함 |
| `manifest-invalid` | warn | `project.json`이 있으면 스키마를 통과해야 함 |

---

## 부팅 자동실행 (macOS)

맥 로그인 시 대시보드가 자동으로 시작되도록 설정할 수 있습니다.

### 설치

```bash
npm run autostart:install
```

설치 후 맥을 재부팅하면 `http://localhost:4319` 에서 대시보드가 자동으로 실행됩니다.

### 해제

```bash
npm run autostart:uninstall
```

### 코드 수정 후 반영

코드를 수정한 후 자동실행 설정에 반영하려면:

```bash
npm run autostart:rebuild
```

### 참고

- **포트**: 자동실행은 포트 4319에서 실행됩니다. 개발 서버(`npm run dev`, 포트 3000)와는 포트가 다르므로 동시에 실행 가능합니다.
- **로그**: 자동실행 로그는 `~/Library/Logs/project-platform/{out,err}.log` 에 기록됩니다.

---

## Orca 원격 이어가기

### 시나리오

연구실 맥 노트북에서 Orca 작업을 시작했고, 집의 Windows 브라우저에서 계속하고 싶을 때 사용합니다.

- **노트북**: Orca를 닫은 후 대시보드의 "원격 이어가기 시작" 버튼을 클릭 → 브라우저 URL 표시
- **집 Windows**: 표시된 URL을 웹 브라우저로 열기 → Orca 설치 불필요, 즉시 작업 이어가기

### 성립 조건

다음 세 조건이 모두 만족되어야 정상 작동합니다.

1. **노트북 유지**: 연구실 맥이 켜져 있고, 잠자기 모드가 아니어야 함
2. **Tailscale 설정**: 노트북과 Windows가 같은 Tailscale 계정으로 로그인 (같은 tailnet)
3. **Orca 닫음**: Orca 데스크톱을 완전히 종료하고 "원격 이어가기 시작" 클릭

### 사용법

1. 대시보드 상단 Orca 패널에서 **"원격 이어가기 시작"** 버튼 클릭
2. 표시되는 **브라우저 URL** (또는 QR 코드) 확인
3. 집의 Windows 브라우저에서 URL 입력 또는 QR 코드 스캔
4. 완료 후 **"중지"** 버튼으로 원격 세션 종료

> ⚠️ **경고**: 공개 인터넷(예: 리버스 프록시, 포트 포워딩)에 노출하면 보안 위험입니다. **Tailscale 등 사설망만 사용하세요.**

### Tailscale 설정 런북 (F2)

#### 1단계: Tailscale 설치

**macOS (노트북):**
```bash
brew install tailscale
sudo /Applications/Tailscale.app/Contents/MacOS/Tailscale up
# → 웹 브라우저가 열려 로그인 페이지로 이동
# → 계정으로 로그인하면 tailnet 추가
```

**Windows (집 컴퓨터):**
- [tailscale.com/download/windows](https://tailscale.com/download/windows)에서 설치 관리자 다운로드
- 실행 후 "Connect" 클릭
- 웹 브라우저에서 같은 Tailscale 계정으로 로그인

#### 2단계: 같은 계정 확인

- **Tailscale 웹 대시보드** ([login.tailscale.com](https://login.tailscale.com))에서 로그인
- 두 기기가 모두 **같은 tailnet** 아래 표시되는지 확인
  - 노트북: `macbook-...` 형태의 이름
  - Windows: `desktop-...` 형태의 이름
- 각 기기의 상태가 "Connected"여야 함

#### 3단계: 연결 테스트

터미널(macOS)이나 PowerShell(Windows)에서:
```bash
# 노트북 Tailscale IP 확인
tailscale ip -4

# Windows: 노트북의 Tailscale IP로 핑 테스트
ping <노트북의-Tailscale-IP>
```

모두 정상이면 "원격 이어가기" 준비 완료입니다.

---

## 프로젝트 실행

상세 뷰에서 "동작" 버튼으로 프로젝트 매니페스트의 `run.cmd`를 실행할 수 있습니다.

### 동작

1. 상세 뷰에서 "동작" 버튼 클릭
2. 프로세스 그룹으로 실행 (detached)
3. 실시간 로그 표시
4. 서버 포트 링크 클릭 → 로컬 서버 접속

### 보안

- 명령은 **매니페스트(`project.json`)에서만** 읽음
- 웹 브라우저에서 명령을 주입할 수 없음
- 서버 측에서 폴더명과 명령 재검증 후 실행

### 중지

"중지" 버튼 클릭 → 프로세스 그룹 전체 정리 (`kill -pid`)

---

## 로드맵

로드맵 A–F 전체 완료. 모든 핵심 기능이 구현되었습니다.

| 단계 | 내용 |
|---|---|
| A | 프로젝트 그리드 대시보드 + 상세 뷰 (완료) |
| B | 규칙 위반 검사 및 표시 (완료) |
| C | 부팅 시 자동 실행 (완료) |
| D | 대시보드에서 새 프로젝트 추가 (완료) |
| E | 실행 버튼으로 dev 서버 직접 기동 (완료) |
| F | Orca 원격 이어가기 (완료) |
