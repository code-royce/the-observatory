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
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}
