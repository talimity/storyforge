const API_BASE_URL = "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T>;
async function apiRequest(
  endpoint: string,
  options?: RequestInit
): Promise<void>;
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T | void> {
  const url = `${API_BASE_URL}${endpoint}`;

  const config: RequestInit = {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorText = await response.text();
      throw new ApiError(
        response.status,
        errorText || `HTTP ${response.status}`
      );
    }

    if (response.status === 204) {
      return;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(
      0,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

/** Generic REST API client. */
export const api = {
  get: <T>(endpoint: string) => apiRequest<T>(endpoint),

  post: <T>(endpoint: string, data: unknown) =>
    apiRequest<T>(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  put: <T>(endpoint: string, data: unknown) =>
    apiRequest<T>(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (endpoint: string) =>
    apiRequest<void>(endpoint, {
      method: "DELETE",
    }),
};
