/**
 * OmniCitas — HTTP clients
 *
 * El frontend solo conoce UNA dirección: VITE_API_URL (Nginx).
 * No sabe nada de microservicios, puertos internos ni API Gateway.
 *
 * Dos conectores disponibles:
 *   api      — HTTP/REST  (todos los endpoints /api/*)
 *   graphql  — GraphQL/HTTP (endpoint /graphql vía Strawberry)
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? "https://localhost";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  token?: string | null;
}

// ── Error HTTP nombrado ───────────────────────────────────────────────────────

/**
 * Tabla de códigos HTTP → { nombre, descripción para el usuario }.
 *
 * Regla de visualización:
 *   4xx → se muestra el `detail` del servidor si existe (más específico),
 *          o el `message` genérico de esta tabla como fallback.
 *   5xx → siempre se muestra el `message` genérico (errores de servidor
 *          no son accionables por el usuario y pueden exponer información).
 *   Red → error de conexión antes de llegar al servidor.
 */
const HTTP_ERRORS: Record<number, { name: string; message: string }> = {
  400: { name: "Solicitud inválida",              message: "Los datos enviados no son válidos." },
  401: { name: "No autorizado",                   message: "Debes iniciar sesión para continuar." },
  403: { name: "Acceso denegado",                 message: "No tienes permisos para realizar esta acción." },
  404: { name: "No encontrado",                   message: "El recurso solicitado no existe." },
  408: { name: "Tiempo de espera agotado",        message: "La solicitud tardó demasiado. Intenta de nuevo." },
  409: { name: "Conflicto",                       message: "Ya existe un registro con esos datos." },
  422: { name: "Datos inválidos",                 message: "Verifica los campos e intenta de nuevo." },
  429: { name: "Demasiadas solicitudes",          message: "Has superado el límite de intentos. Espera un momento antes de continuar." },
  500: { name: "Error del servidor",              message: "El servicio no está disponible en este momento. Intenta más tarde." },
  502: { name: "Servicio no disponible",          message: "El servicio está temporalmente fuera de línea. Intenta en unos minutos." },
  503: { name: "En mantenimiento",                message: "El servicio está en mantenimiento. Volveremos pronto." },
  504: { name: "Tiempo de espera del servidor",   message: "El servidor tardó demasiado en responder. Intenta de nuevo." },
};

const FALLBACK_ERROR = {
  name: "Error inesperado",
  message: "Ocurrió un error inesperado. Por favor intenta de nuevo.",
};

/**
 * ApiError — error enriquecido con código HTTP, nombre legible y mensaje al usuario.
 *
 * Uso en componentes:
 *   catch (err) {
 *     if (err instanceof ApiError) {
 *       // err.label   → "401 — No autorizado"
 *       // err.message → texto para mostrar al usuario
 *       // err.status  → número HTTP
 *     }
 *   }
 */
export class ApiError extends Error {
  readonly status: number;
  readonly statusName: string;

  constructor(status: number, statusName: string, userMessage: string) {
    super(userMessage);
    this.status = status;
    this.statusName = statusName;
    this.name = "ApiError";
  }

  /** Etiqueta legible: "500 — Error del servidor" */
  get label(): string {
    return `${this.status} — ${this.statusName}`;
  }

  /** true si el error es de autenticación */
  get isUnauthorized(): boolean { return this.status === 401; }

  /** true si el error es de permisos */
  get isForbidden(): boolean { return this.status === 403; }

  /** true si es un error de servidor (5xx) */
  get isServerError(): boolean { return this.status >= 500; }

  /** true si se superó el rate limit */
  get isRateLimited(): boolean { return this.status === 429; }
}

function buildApiError(status: number, serverDetail?: string): ApiError {
  const entry = HTTP_ERRORS[status] ?? FALLBACK_ERROR;
  // 4xx: preferir el detail del servidor (más específico para el usuario).
  // 5xx: ignorar el detail del servidor (puede ser técnico o sensible).
  const userMessage = status < 500 && serverDetail
    ? serverDetail
    : entry.message;
  return new ApiError(status, entry.name, userMessage);
}

function getStoredToken(): string | null {
  return localStorage.getItem("token") ?? localStorage.getItem("adminToken");
}

// ── Conector HTTP/REST ────────────────────────────────────────────────────────

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;

  const authToken = token !== undefined ? token : getStoredToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // Error de red: el servidor no responde (DNS, conexión rechazada, etc.)
    throw new ApiError(
      503,
      "Sin conexión",
      "No se pudo conectar con el servidor. Verifica tu conexión a internet.",
    );
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw buildApiError(res.status, data?.detail ?? data?.message ?? data?.error);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, token?: string | null) =>
    request<T>(path, { method: "GET", token }),

  post: <T>(path: string, body: unknown, token?: string | null) =>
    request<T>(path, { method: "POST", body, token }),

  put: <T>(path: string, body: unknown, token?: string | null) =>
    request<T>(path, { method: "PUT", body, token }),

  patch: <T>(path: string, body: unknown, token?: string | null) =>
    request<T>(path, { method: "PATCH", body, token }),

  delete: <T>(path: string, token?: string | null) =>
    request<T>(path, { method: "DELETE", token }),
};

// ── Conector GraphQL/HTTP ─────────────────────────────────────────────────────

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/**
 * Ejecuta una operación GraphQL contra /graphql.
 * El token JWT se inyecta automáticamente — el API Gateway lo valida
 * y añade X-User-Id / X-User-Role al reenviar al citas-service.
 */
export async function graphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const token = getStoredToken();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/graphql`, {
      method: "POST",
      headers,
      body: JSON.stringify({ query, variables }),
    });
  } catch {
    throw new ApiError(
      503,
      "Sin conexión",
      "No se pudo conectar con el servidor. Verifica tu conexión a internet.",
    );
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw buildApiError(res.status, data?.detail ?? data?.message);
  }

  const json: GraphQLResponse<T> = await res.json();

  if (json.errors?.length) {
    throw new ApiError(422, "Error de consulta", json.errors[0].message);
  }

  if (!json.data) {
    throw new ApiError(500, "Error del servidor", HTTP_ERRORS[500].message);
  }

  return json.data;
}
