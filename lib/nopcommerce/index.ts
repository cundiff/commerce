import { TAGS } from "lib/constants";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
  revalidateTag,
} from "next/cache";
import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { Cart, Collection, Menu, Page, Product } from "lib/types";

const API_URL = process.env.NOPCOMMERCE_API_URL
  ? process.env.NOPCOMMERCE_API_URL.replace(/\/$/, "")
  : "";

/**
 * Thin fetch wrapper around the nopCommerce Headless Storefront API plugin.
 * The cart/customer session is carried by the `cartId` cookie (the token issued
 * by `createCart`), which we forward via the `X-Nop-Cart-Token` header.
 */
async function nopFetch<T>({
  path,
  method = "GET",
  body,
  token,
  tags,
}: {
  path: string;
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  token?: string;
  tags?: string[];
}): Promise<{ status: number; body: T }> {
  if (!API_URL) {
    throw new Error("NOPCOMMERCE_API_URL environment variable is not set");
  }

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    requestHeaders["X-Nop-Cart-Token"] = token;
  }

  const result = await fetch(`${API_URL}${path}`, {
    method,
    headers: requestHeaders,
    ...(body ? { body: JSON.stringify(body) } : {}),
    ...(tags ? { next: { tags } } : {}),
  });

  if (result.status === 404) {
    return { status: 404, body: undefined as T };
  }

  if (!result.ok) {
    throw new Error(
      `nopCommerce API request failed: ${method} ${path} -> ${result.status}`,
    );
  }

  const text = await result.text();
  const json = text ? (JSON.parse(text) as T) : (undefined as T);

  return { status: result.status, body: json };
}

async function getCartToken(): Promise<string | undefined> {
  return (await cookies()).get("cartId")?.value;
}

export async function createCart(): Promise<Cart> {
  const res = await nopFetch<Cart>({ path: "/cart", method: "POST" });
  return res.body;
}

export async function addToCart(
  lines: { merchandiseId: string; quantity: number }[],
): Promise<Cart> {
  const token = await getCartToken();
  const res = await nopFetch<Cart>({
    path: "/cart/items",
    method: "POST",
    token,
    body: { lines },
  });
  return res.body;
}

export async function removeFromCart(lineIds: string[]): Promise<Cart> {
  const token = await getCartToken();
  const res = await nopFetch<Cart>({
    path: "/cart/items",
    method: "DELETE",
    token,
    body: { lineIds },
  });
  return res.body;
}

export async function updateCart(
  lines: { id: string; merchandiseId: string; quantity: number }[],
): Promise<Cart> {
  const token = await getCartToken();
  const res = await nopFetch<Cart>({
    path: "/cart/items",
    method: "PUT",
    token,
    body: { lines },
  });
  return res.body;
}

export async function getCart(): Promise<Cart | undefined> {
  const token = await getCartToken();

  if (!token) {
    return undefined;
  }

  const res = await nopFetch<Cart>({
    path: "/cart",
    method: "GET",
    token,
  });

  if (res.status === 404 || !res.body) {
    return undefined;
  }

  return res.body;
}

export async function getCollection(
  handle: string,
): Promise<Collection | undefined> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  if (!API_URL) {
    return undefined;
  }

  const res = await nopFetch<Collection>({
    path: `/categories/by-handle/${encodeURIComponent(handle)}`,
    tags: [TAGS.collections],
  });

  return res.body ?? undefined;
}

export async function getCollectionProducts({
  collection,
  reverse,
  sortKey,
}: {
  collection: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  "use cache";
  cacheTag(TAGS.collections, TAGS.products);
  cacheLife("days");

  if (!API_URL) {
    return [];
  }

  // The storefront uses synthetic "hidden-homepage-*" collections for the
  // homepage carousel and featured grid. Map those to the products that are
  // flagged "show on home page" in nopCommerce.
  if (collection.startsWith("hidden-homepage")) {
    const res = await nopFetch<Product[]>({
      path: "/products/homepage",
      tags: [TAGS.products],
    });
    return res.body ?? [];
  }

  const params = new URLSearchParams();
  if (sortKey) params.set("sort", sortKey);
  if (reverse) params.set("reverse", "true");

  const res = await nopFetch<Product[]>({
    path: `/categories/by-handle/${encodeURIComponent(collection)}/products?${params.toString()}`,
    tags: [TAGS.collections, TAGS.products],
  });

  return res.body ?? [];
}

export async function getCollections(): Promise<Collection[]> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  const allCollection: Collection = {
    handle: "",
    title: "All",
    description: "All products",
    seo: {
      title: "All",
      description: "All products",
    },
    path: "/search",
    updatedAt: new Date().toISOString(),
  };

  if (!API_URL) {
    return [allCollection];
  }

  const res = await nopFetch<Collection[]>({
    path: "/categories",
    tags: [TAGS.collections],
  });

  const collections = [
    allCollection,
    // Hide any collections whose handle starts with `hidden`.
    ...(res.body ?? []).filter(
      (collection) => !collection.handle.startsWith("hidden"),
    ),
  ];

  return collections;
}

export async function getMenu(handle: string): Promise<Menu[]> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  if (!API_URL) {
    return [];
  }

  const res = await nopFetch<Menu[]>({
    path: `/menus/${encodeURIComponent(handle)}`,
    tags: [TAGS.collections],
  });

  return res.body ?? [];
}

export async function getPage(handle: string): Promise<Page> {
  const res = await nopFetch<Page>({
    path: `/pages/${encodeURIComponent(handle)}`,
  });

  return res.body;
}

export async function getPages(): Promise<Page[]> {
  if (!API_URL) {
    return [];
  }

  const res = await nopFetch<Page[]>({ path: "/pages" });

  return res.body ?? [];
}

export async function getProduct(handle: string): Promise<Product | undefined> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("days");

  if (!API_URL) {
    return undefined;
  }

  const res = await nopFetch<Product>({
    path: `/products/by-handle/${encodeURIComponent(handle)}`,
    tags: [TAGS.products],
  });

  return res.body ?? undefined;
}

export async function getProductRecommendations(
  productId: string,
): Promise<Product[]> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("days");

  if (!API_URL) {
    return [];
  }

  const res = await nopFetch<Product[]>({
    path: `/products/${encodeURIComponent(productId)}/recommendations`,
    tags: [TAGS.products],
  });

  return res.body ?? [];
}

export async function getProducts({
  query,
  reverse,
  sortKey,
}: {
  query?: string;
  reverse?: boolean;
  sortKey?: string;
}): Promise<Product[]> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("days");

  if (!API_URL) {
    return [];
  }

  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (sortKey) params.set("sort", sortKey);
  if (reverse) params.set("reverse", "true");

  const res = await nopFetch<Product[]>({
    path: `/products?${params.toString()}`,
    tags: [TAGS.products],
  });

  return res.body ?? [];
}

// This is called from `app/api/revalidate/route.ts` so providers can control
// revalidation logic. The nopCommerce Headless API plugin posts here with the
// `x-nop-topic` header when catalog/category/content data changes.
export async function revalidate(req: NextRequest): Promise<NextResponse> {
  const collectionTopics = ["collections/update"];
  const productTopics = ["products/update"];

  const topic =
    (await headers()).get("x-nop-topic") ||
    (await headers()).get("x-shopify-topic") ||
    "unknown";
  const secret = req.nextUrl.searchParams.get("secret");

  const isCollectionUpdate = collectionTopics.includes(topic);
  const isProductUpdate = productTopics.includes(topic);

  if (!secret || secret !== process.env.NOPCOMMERCE_REVALIDATION_SECRET) {
    console.error("Invalid revalidation secret.");
    return NextResponse.json({ status: 401 });
  }

  if (!isCollectionUpdate && !isProductUpdate) {
    return NextResponse.json({ status: 200 });
  }

  if (isCollectionUpdate) {
    revalidateTag(TAGS.collections, "seconds");
  }

  if (isProductUpdate) {
    revalidateTag(TAGS.products, "seconds");
  }

  return NextResponse.json({ status: 200, revalidated: true, now: Date.now() });
}
