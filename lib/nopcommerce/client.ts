import { TAGS } from "lib/constants";

const API_URL = process.env.NOPCOMMERCE_API_URL ?? "";
const SESSION_COOKIE = "nopSession";

export function isNopCommerceConfigured(): boolean {
  return Boolean(API_URL);
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export async function nopFetch<T>({
  path,
  method = "GET",
  body,
  sessionToken,
  cache,
  tags,
}: {
  path: string;
  method?: string;
  body?: unknown;
  sessionToken?: string;
  cache?: RequestCache;
  tags?: string[];
}): Promise<T> {
  if (!isNopCommerceConfigured()) {
    throw new Error("NOPCOMMERCE_API_URL is not configured");
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (sessionToken) {
    headers["X-Storefront-Session"] = sessionToken;
  }

  const url = `${API_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: cache ?? (method === "GET" ? "force-cache" : "no-store"),
    ...(tags?.length ? { next: { tags } } : {}),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `nopCommerce API ${method} ${path} failed (${response.status}): ${errorBody}`,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export { API_URL, SESSION_COOKIE, TAGS };
