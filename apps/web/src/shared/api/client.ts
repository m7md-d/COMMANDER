/**
 * The only axios instance. Features import the typed helpers below; no
 * component ever imports axios (CONSTITUTION §4).
 */

import axios, { AxiosError, type AxiosInstance } from "axios";
import type { ApiResponse, FieldIssue } from "@commander/shared";

/** Carries the API's i18n key so callers translate rather than invent wording. */
export class ApiError extends Error {
  readonly i18nKey: string;
  readonly status: number;
  readonly issues: FieldIssue[];

  constructor(i18nKey: string, status: number, issues: FieldIssue[] = []) {
    super(i18nKey);
    this.name = "ApiError";
    this.i18nKey = i18nKey;
    this.status = status;
    this.issues = issues;
  }
}

export const http: AxiosInstance = axios.create({
  baseURL: "/api",
  // Required for the session cookie; without it every request is anonymous.
  withCredentials: true,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

/**
 * Normalizes every failure into ApiError so callers handle one shape: a network
 * outage, a 422 with field issues and a 500 all arrive the same way.
 */
function toApiError(error: unknown): ApiError {
  if (error instanceof AxiosError) {
    const body = error.response?.data as ApiResponse<unknown> | undefined;
    const status = error.response?.status ?? 0;

    if (body && body.ok === false) {
      return new ApiError(body.error, status, body.details ?? []);
    }
    if (status === 0) return new ApiError("error.network", 0);
    return new ApiError("error.unknown", status);
  }

  return new ApiError("error.unknown", 0);
}

/** Unwraps the { ok, data } envelope so features work with plain payloads. */
async function request<T>(run: () => Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    const response = await run();
    if (!response.data.ok) {
      throw new ApiError(response.data.error, 200, response.data.details ?? []);
    }
    return response.data.data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw toApiError(error);
  }
}

export const api = {
  get: <T>(url: string, params?: Record<string, unknown>) =>
    request<T>(() => http.get<ApiResponse<T>>(url, { params })),

  post: <T>(url: string, body?: unknown) =>
    request<T>(() => http.post<ApiResponse<T>>(url, body)),

  put: <T>(url: string, body?: unknown) => request<T>(() => http.put<ApiResponse<T>>(url, body)),

  patch: <T>(url: string, body?: unknown) =>
    request<T>(() => http.patch<ApiResponse<T>>(url, body)),

  delete: <T>(url: string) => request<T>(() => http.delete<ApiResponse<T>>(url)),
};

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}
