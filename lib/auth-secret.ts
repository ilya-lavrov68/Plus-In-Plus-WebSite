/** Edge-safe: shared by Auth.js and middleware. No fallback signing secret. */
export function getAuthSecret(): string | undefined {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
}

export function isAuthConfigured(): boolean {
  const secret = getAuthSecret();
  return Boolean(secret && secret.length >= 32);
}
