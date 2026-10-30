export function maskDisplayName(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    return '***';
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) {
    const chars = Array.from(parts[0]);
    return `${chars[0]}***`;
  }

  const prefix = parts.slice(0, -1).join(' ');
  const lastWord = parts[parts.length - 1];
  const lastChars = Array.from(lastWord);
  return `${prefix} ${lastChars[0]}***`;
}
