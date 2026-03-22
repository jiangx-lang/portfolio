export type DeviceType =
  | "iPhone"
  | "Android"
  | "iPad"
  | "Mac"
  | "Windows"
  | "Linux"
  | "Bot"
  | "Unknown";

export type ParsedUA = {
  deviceType: DeviceType;
  deviceIcon: string;
  /** 不含图标，用于与 deviceIcon 拼接展示 */
  label: string;
};

function isLikelyBot(ua: string): boolean {
  const u = ua.toLowerCase();
  if (
    /headlesschrome|googlebot|bingbot|baiduspider|yandexbot|facebookexternalhit|slackbot|discordbot/.test(
      u
    )
  )
    return true;
  if (/\bbot\b|crawler|spider|preview|semrush|ahrefsbot|petalbot/.test(u)) return true;
  // 桌面 Linux + X11、无常见移动端标记 → 多为爬虫/自动化
  if (/x11;\s*linux\s*x86_64/i.test(ua) && !/mobile|android|iphone|ipad/i.test(ua)) {
    return true;
  }
  return false;
}

function iosVersion(ua: string): string | null {
  const m = /os (\d+)[._](\d+)(?:[._](\d+))?/i.exec(ua);
  if (!m || !/iphone|ipad|ipod/i.test(ua)) return null;
  const a = m[1];
  const b = m[2];
  const c = m[3];
  return c ? `${a}.${b}.${c}` : `${a}.${b}`;
}

/** 人类可读设备行：与 deviceIcon 组合为「📱 iPhone iOS 18.4」 */
export function parseUA(ua: string | null | undefined): ParsedUA {
  const raw = (ua || "").trim();
  if (!raw) {
    return { deviceType: "Unknown", deviceIcon: "❔", label: "未知" };
  }

  if (isLikelyBot(raw)) {
    return { deviceType: "Bot", deviceIcon: "🤖", label: "爬虫" };
  }

  if (/iphone/i.test(raw)) {
    const v = iosVersion(raw);
    return {
      deviceType: "iPhone",
      deviceIcon: "📱",
      label: v ? `iPhone iOS ${v}` : "iPhone",
    };
  }

  if (/ipad/i.test(raw) || (/macintosh/i.test(raw) && /like mac os x/i.test(raw))) {
    const v = iosVersion(raw);
    return {
      deviceType: "iPad",
      deviceIcon: "📱",
      label: v ? `iPad iOS ${v}` : "iPad",
    };
  }

  if (/android/i.test(raw)) {
    const m = /android\s+([\d.]+)/i.exec(raw);
    return {
      deviceType: "Android",
      deviceIcon: "📱",
      label: m ? `Android ${m[1]}` : "Android",
    };
  }

  if (/macintosh|mac os x/i.test(raw)) {
    const m = /mac os x\s+(\d+[._]\d+(?:[._]\d+)?)/i.exec(raw);
    const ver = m ? m[1].replace(/_/g, ".") : null;
    return {
      deviceType: "Mac",
      deviceIcon: "💻",
      label: ver ? `Mac macOS ${ver}` : "Mac",
    };
  }

  if (/windows nt/i.test(raw)) {
    return { deviceType: "Windows", deviceIcon: "💻", label: "Windows" };
  }

  if (/linux/i.test(raw)) {
    return { deviceType: "Linux", deviceIcon: "🐧", label: "Linux" };
  }

  return { deviceType: "Unknown", deviceIcon: "🌐", label: "未知" };
}

export function formatDeviceCell(ua: string | null | undefined): string {
  const p = parseUA(ua);
  return `${p.deviceIcon} ${p.label}`;
}
