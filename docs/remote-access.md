# Orca 원격 이어가기 — Tailscale 런북

## 시나리오

연구실 맥 노트북에서 Orca 작업을 시작했고, 집의 Windows 브라우저에서 계속하고 싶을 때 사용합니다.

- **노트북**: Orca를 닫은 후 대시보드의 "원격 이어가기 시작" 버튼을 클릭 → 브라우저 URL 표시
- **집 Windows**: 표시된 URL을 웹 브라우저로 열기 → Orca 설치 불필요, 즉시 작업 이어가기

## 성립 조건

다음 세 조건이 모두 만족되어야 정상 작동합니다.

1. **노트북 유지**: 연구실 맥이 켜져 있고, 잠자기 모드가 아니어야 함
2. **Tailscale 설정**: 노트북과 Windows가 같은 Tailscale 계정으로 로그인 (같은 tailnet)
3. **Orca 닫음**: Orca 데스크톱을 완전히 종료하고 "원격 이어가기 시작" 클릭

## 사용법

1. 대시보드 상단 Orca 패널에서 **"원격 이어가기 시작"** 버튼 클릭
2. 표시되는 **브라우저 URL** (또는 QR 코드) 확인
3. 집의 Windows 브라우저에서 URL 입력 또는 QR 코드 스캔
4. 완료 후 **"중지"** 버튼으로 원격 세션 종료

> ⚠️ **경고**: 공개 인터넷(예: 리버스 프록시, 포트 포워딩)에 노출하면 보안 위험입니다. **Tailscale 등 사설망만 사용하세요.**

## Tailscale 설정 런북 (F2)

### 1단계: Tailscale 설치

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

### 2단계: 같은 계정 확인

- **Tailscale 웹 대시보드** ([login.tailscale.com](https://login.tailscale.com))에서 로그인
- 두 기기가 모두 **같은 tailnet** 아래 표시되는지 확인
  - 노트북: `macbook-...` 형태의 이름
  - Windows: `desktop-...` 형태의 이름
- 각 기기의 상태가 "Connected"여야 함

### 3단계: 연결 테스트

터미널(macOS)이나 PowerShell(Windows)에서:
```bash
# 노트북 Tailscale IP 확인
tailscale ip -4

# Windows: 노트북의 Tailscale IP로 핑 테스트
ping <노트북의-Tailscale-IP>
```

모두 정상이면 "원격 이어가기" 준비 완료입니다.
