export function apiMessage(error: unknown, fallback: string): string {
  const err = error as {
    response?: { data?: { message?: string | string[] } };
  };
  const message = err?.response?.data?.message;
  if (Array.isArray(message) && message.length > 0) return message.join('\n');
  if (typeof message === 'string' && message.trim()) return message;
  return fallback;
}
