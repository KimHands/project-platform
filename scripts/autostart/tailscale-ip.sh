#!/bin/bash
# Tailscale IPv4(100.64.0.0/10)만 출력한다. 없으면 exit 1.
# 맥 en0에 공인 IP가 직결돼 있어 0.0.0.0 바인딩은 인터넷 노출이므로 폴백하지 않는다.
set -uo pipefail

find_tailscale() {
  command -v tailscale 2>/dev/null && return
  for candidate in /usr/local/bin/tailscale /opt/homebrew/bin/tailscale \
                   /Applications/Tailscale.app/Contents/MacOS/Tailscale; do
    [ -x "$candidate" ] && { echo "$candidate"; return; }
  done
  return 1
}

is_tailscale_ip() {
  [[ "$1" =~ ^100\.([0-9]{1,3})\.[0-9]{1,3}\.[0-9]{1,3}$ ]] || return 1
  local second="${BASH_REMATCH[1]}"
  [ "$second" -ge 64 ] && [ "$second" -le 127 ]
}

tailscale_bin="$(find_tailscale)" || { echo "tailscale CLI를 찾을 수 없습니다." >&2; exit 1; }
ip="$("$tailscale_bin" ip -4 2>/dev/null | head -n1 | tr -d '[:space:]')"
is_tailscale_ip "$ip" || { echo "Tailscale IPv4를 얻지 못했습니다 (Tailscale이 꺼져 있나요?)." >&2; exit 1; }
echo "$ip"
