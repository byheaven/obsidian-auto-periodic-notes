let debugEnabled = false;

export function setDebugEnabled(enabled: boolean): void {
  debugEnabled = enabled;
}

export default function debug(msg: string): void {
  if (debugEnabled) {
    console.debug(`[JH:APN] ${msg}`);
  }
}
