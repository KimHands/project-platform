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

## 로드맵

현재 구현 범위는 **A(시각화) + B(규칙 검사)** 입니다. 이후 단계는 아직 구현되지 않았습니다.

| 단계 | 내용 |
|---|---|
| A | 프로젝트 그리드 대시보드 + 상세 뷰 (완료) |
| B | 규칙 위반 검사 및 표시 (완료) |
| C | 부팅 시 자동 실행 (완료) |
| D | 대시보드에서 새 프로젝트 추가 (계획) |
| E | 실행 버튼으로 dev 서버 직접 기동 (계획) |
| F | Orca 모바일 뷰 (계획) |
