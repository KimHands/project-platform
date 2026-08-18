function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function renderPlist({ label, nodeBin, appDir, port, logDir }) {
  const runScript = `${appDir}/scripts/autostart/run.sh`
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${esc(label)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>${esc(runScript)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${esc(appDir)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${esc(nodeBin)}:/usr/bin:/bin</string>
    <key>PORT</key>
    <string>${esc(port)}</string>
    <key>NODE_ENV</key>
    <string>production</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ThrottleInterval</key>
  <integer>10</integer>
  <key>StandardOutPath</key>
  <string>${esc(logDir)}/out.log</string>
  <key>StandardErrorPath</key>
  <string>${esc(logDir)}/err.log</string>
</dict>
</plist>
`
}

// CLI 사용: node render-plist.mjs <label> <nodeBin> <appDir> <port> <logDir>
import { fileURLToPath } from 'node:url'
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [, , label, nodeBin, appDir, port, logDir] = process.argv
  process.stdout.write(renderPlist({ label, nodeBin, appDir, port: Number(port), logDir }))
}
