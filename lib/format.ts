export function formatTotalMinutes(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  if (hours === 0) return `${minutes}분`;
  if (minutes === 0) return `${hours}시간`;
  return `${hours}시간 ${minutes}분`;
}

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// 표시용 축약 문자열만 만든다 — 실제 이동은 원본 url(href)을 그대로 사용해야 한다.
export function formatShortUrl(raw: string, maxLen = 22): string {
  let display: string;
  try {
    const u = new URL(raw);
    display = `${u.hostname}${u.pathname}${u.search}`;
  } catch {
    display = raw;
  }
  display = display.replace(/^www\./, "");

  if (display.length <= maxLen) return display;

  const headLen = Math.ceil((maxLen - 3) * 0.6);
  const tailLen = maxLen - 3 - headLen;
  return `${display.slice(0, headLen)}...${display.slice(-tailLen)}`;
}
