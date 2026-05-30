export function normalizeHandle(input: string): string {
  return input.trim().toLowerCase();
}

export function isValidHandle(input: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(normalizeHandle(input));
}

export function generateRandomHandle(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let suffix = "";
  for (let i = 0; i < 8; i++) {
    suffix += chars[Math.floor(Math.random() * chars.length)];
  }
  return `user_${suffix}`;
}
