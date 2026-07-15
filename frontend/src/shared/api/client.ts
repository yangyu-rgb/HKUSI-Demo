import { clearDemoSession, getDemoSession, setDemoSession } from "../../features/auth/session";
import { englishDisplayText, localizeDemoPayload } from "../displayText";

export { clearDemoSession, getDemoSession, setDemoSession };

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8000";


export function getDemoPersonaId(): string {
  return getDemoSession()?.personaId ?? "commuter-user";
}


type ErrorEnvelope = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
    request_id?: string;
    category?: string;
    retryable?: boolean;
    user_action?: string | null;
  };
};


export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details: unknown = {},
    readonly requestId: string | null = null,
    readonly category: string = "unknown",
    readonly retryable: boolean = false,
    readonly userAction: string | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}


export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  const session = getDemoSession();
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(session ? { "X-Demo-Persona-ID": session.personaId } : {}),
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new ApiError(
      error instanceof Error ? error.message : "Unable to connect to the server",
      0,
      "NETWORK_ERROR",
    );
  }

  if (!response.ok) {
    let payload: ErrorEnvelope = {};
    try {
      payload = await response.json() as ErrorEnvelope;
    } catch {
      // Non-JSON upstream errors use the status-based fallback below.
    }
    const requestId = payload.error?.request_id
      ?? response.headers.get("X-Request-ID");
    throw new ApiError(
      englishDisplayText(payload.error?.message ?? `Request failed (${response.status})`),
      response.status,
      payload.error?.code ?? "HTTP_ERROR",
      payload.error?.details ?? {},
      requestId,
      payload.error?.category ?? "unknown",
      payload.error?.retryable ?? response.status >= 500,
      payload.error?.user_action ? englishDisplayText(payload.error.user_action) : null,
    );
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return localizeDemoPayload(await response.json() as T);
}


export function userFacingError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "An unknown error occurred";
  }
  if (error.code === "NETWORK_ERROR") {
    return "Unable to connect to the server. Check that the backend is running.";
  }
  if (error.status >= 500) {
    const guidance = error.userAction ?? (error.retryable ? "try again later" : "contact the Demo operator");
    return `The service is temporarily unavailable; ${guidance}${error.requestId ? ` (request ${error.requestId})` : ""}.`;
  }
  return error.message;
}
