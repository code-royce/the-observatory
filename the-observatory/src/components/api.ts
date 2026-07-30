// If VITE_API_URL is blank (dev), it uses relative paths.
// If it's populated (production), it uses the Cloud Run URL.
const API_BASE = import.meta.env.VITE_API_URL || '';

// A generic, type-safe wrapper for Flask requests
export async function flaskFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    // Return info about 400 errors with specific validation messages.
    const body = await response.json().catch(() => null);
    const message = body?.errors?.join(', ') || body?.error || response.statusText;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}
