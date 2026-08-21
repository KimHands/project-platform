import type { ServeInfo } from './types'

function collectStrings(v: unknown, out: string[]): void {
  if (typeof v === 'string') out.push(v)
  else if (Array.isArray(v)) v.forEach((x) => collectStrings(x, out))
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => collectStrings(x, out))
}

export function serveParse(text: string): ServeInfo {
  const strings: string[] = []
  try {
    collectStrings(JSON.parse(text), strings)
  } catch {
    // JSON 아니면 라인에서 URL 토큰 추출
    const tokens = text.split(/\s+/)
    strings.push(...tokens)
  }
  const find = (re: RegExp) => strings.find((s) => re.test(s)) ?? null
  const endpoint = find(/^wss?:\/\//)
  const mobileUrl = find(/^orca:\/\//) ?? find(/pair|mobile/i) ?? null
  const browserUrl = strings.find((s) => /^https?:\/\//.test(s) && s !== mobileUrl) ?? null
  return {
    endpoint,
    browserUrl,
    mobileUrl,
  }
}
