import { TAGS } from "lib/constants";
import {
  isNopCommerceConfigured,
  nopFetch,
  SESSION_COOKIE,
} from "lib/nopcommerce/client";
import type {
  Cart,
  CartItem,
  Collection,
  Image,
  Menu,
  Page,
  Product,
} from "lib/nopcommerce/types";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
  revalidateTag,
} from "next/cache";
import { cookies, headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

type NopMoney = { amount: string; currencyCode: string };
type NopImage = { url: string; altText: string; width: number; height: number };
type NopProduct = Product;
type NopCollection = {
  handle: string;
  title: string;
  description: string;
  seo: { title: string; description: string };
  path: string;
  updatedAt: string;
};
type NopCartLine = {
  id: string;
  quantity: number;
  cost: { totalAmount: NopMoney };
  merchandise: {
    id: string;
    title: string;
    selectedOptions: { name: string; value: string }[];
    product: {
      id: string;
      handle: string;
      title: string;
      featuredImage: NopImage;
    };
  };
};
type NopCart = {
  id: string;
  checkoutUrl: string;
  cost: {
    subtotalAmount: NopMoney;
    totalAmount: NopMoney;
    totalTaxAmount: NopMoney;
  };
  lines: NopCartLine[];
  totalQuantity: number;
};

async function getSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

function reshapeImage(image: NopImage): Image {
  return {
    url: image.url,
    altText: image.altText || "",
    width: image.width || 0,
    height: image.height || 0,
  };
}

function reshapeProduct(product: NopProduct): Product {
  return {
    ...product,
    images: product.images.map(reshapeImage),
    featuredImage: reshapeImage(product.featuredImage),
  };
}

function reshapeCollection(collection: NopCollection): Collection {
  return {
    handle: collection.handle,
    title: collection.title,
    description: collection.description,
    seo: collection.seo,
    updatedAt: collection.updatedAt,
    path: collection.path,
  };
}

function reshapeCartLine(line: NopCartLine): CartItem {
  return {
    id: line.id,
    quantity: line.quantity,
    cost: { totalAmount: line.cost.totalAmount },
    merchandise: {
      id: line.merchandise.id,
      title: line.merchandise.title,
      selectedOptions: line.merchandise.selectedOptions,
      product: {
        id: line.merchandise.product.id,
        handle: line.merchandise.product.handle,
        title: line.merchandise.product.title,
        featuredImage: reshapeImage(line.merchandise.product.featuredImage),
      },
    },
  };
}

async function reshapeCart(cart: NopCart, checkoutUrl?: string): Promise<Cart> {
  return {
    id: cart.id,
    checkoutUrl: checkoutUrl ?? cart.checkoutUrl,
    cost: cart.cost,
    lines: cart.lines.map(reshapeCartLine),
    totalQuantity: cart.totalQuantity,
  };
}

export async function createCart(): Promise<Cart> {
  const { sessionToken } = await nopFetch<{ sessionToken: string }>({
    path: "/sessions",
    method: "POST",
    cache: "no-store",
  });

  (await cookies()).set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  const cart = await nopFetch<NopCart>({
    path: "/cart",
    sessionToken,
    cache: "no-store",
  });

  return reshapeCart(cart);
}

export async function addToCart(
  lines: { merchandiseId: string; quantity: number }[],
): Promise<Cart> {
  let sessionToken = await getSessionToken();
  if (!sessionToken) {
    await createCart();
    sessionToken = await getSessionToken();
  }

  let cart: NopCart | null = null;
  for (const line of lines) {
    cart = await nopFetch<NopCart>({
      path: "/cart/items",
      method: "POST",
      sessionToken: sessionToken!,
      body: {
        productId: parseInt(line.merchandiseId, 10),
        quantity: line.quantity,
      },
      cache: "no-store",
    });
  }

  return reshapeCart(cart!);
}

export async function removeFromCart(lineIds: string[]): Promise<Cart> {
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    throw new Error("No cart session");
  }

  let cart: NopCart | null = null;
  for (const lineId of lineIds) {
    cart = await nopFetch<NopCart>({
      path: `/cart/items/${lineId}`,
      method: "DELETE",
      sessionToken,
      cache: "no-store",
    });
  }

  return reshapeCart(cart!);
}

export async function updateCart(
  lines: { id: string; merchandiseId: string; quantity: number }[],
): Promise<Cart> {
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    throw new Error("No cart session");
  }

  let cart: NopCart | null = null;
  for (const line of lines) {
    cart = await nopFetch<NopCart>({
      path: `/cart/items/${line.id}`,
      method: "PATCH",
      sessionToken,
      body: { quantity: line.quantity },
      cache: "no-store",
    });
  }

  return reshapeCart(cart!);
}

export async function getCart(): Promise<Cart | undefined> {
  "use cache: private";
  cacheTag(TAGS.cart);
  cacheLife("seconds");

  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    return undefined;
  }

  try {
    const cart = await nopFetch<NopCart>({
      path: "/cart",
      sessionToken,
      cache: "no-store",
    });
    return reshapeCart(cart);
  } catch {
    return undefined;
  }
}

export async function getCollection(
  handle: string,
): Promise<Collection | undefined> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  if (!handle) {
    return undefined;
  }

  if (!isNopCommerceConfigured()) {
    return undefined;
  }

  try {
    const collection = await nopFetch<NopCollection>({
      path: `/categories/${handle}`,
      tags: [TAGS.collections],
    });
    return reshapeCollection(collection);
  } catch {
    return undefined;
  }
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

  if (!isNopCommerceConfigured()) {
    return [];
  }

  const params = new URLSearchParams();
  if (sortKey) {
    params.set("sortKey", sortKey);
  }
  if (reverse) {
    params.set("reverse", "true");
  }

  const query = params.toString();
  const products = await nopFetch<NopProduct[]>({
    path: `/categories/${collection}/products${query ? `?${query}` : ""}`,
    tags: [TAGS.collections, TAGS.products],
  });

  return products.map(reshapeProduct);
}

export async function getCollections(): Promise<Collection[]> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  if (!isNopCommerceConfigured()) {
    return [
      {
        handle: "",
        title: "All",
        description: "All products",
        seo: { title: "All", description: "All products" },
        path: "/search",
        updatedAt: new Date().toISOString(),
      },
    ];
  }

  const categories = await nopFetch<NopCollection[]>({
    path: "/categories",
    tags: [TAGS.collections],
  });

  const collections = categories
    .map(reshapeCollection)
    .filter((c) => !c.handle.startsWith("hidden"));

  return [
    {
      handle: "",
      title: "All",
      description: "All products",
      seo: { title: "All", description: "All products" },
      path: "/search",
      updatedAt: new Date().toISOString(),
    },
    ...collections,
  ];
}

export async function getMenu(handle: string): Promise<Menu[]> {
  "use cache";
  cacheTag(TAGS.collections);
  cacheLife("days");

  if (handle === "next-js-frontend-footer-menu") {
    return [
      { title: "Home", path: "/" },
      { title: "Search", path: "/search" },
    ];
  }

  const collections = await getCollections();
  return collections
    .filter((c) => c.handle)
    .map((c) => ({
      title: c.title,
      path: c.path,
    }));
}

export async function getPage(handle: string): Promise<Page> {
  return {
    id: handle,
    title: handle,
    handle,
    body: "",
    bodySummary: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export async function getPages(): Promise<Page[]> {
  return [];
}

export async function getProduct(
  handle: string,
): Promise<Product | undefined> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("days");

  if (!isNopCommerceConfigured()) {
    return undefined;
  }

  try {
    const product = await nopFetch<NopProduct>({
      path: `/products/${handle}`,
      tags: [TAGS.products],
    });
    return reshapeProduct(product);
  } catch {
    return undefined;
  }
}

export async function getProductRecommendations(
  productId: string,
): Promise<Product[]> {
  "use cache";
  cacheTag(TAGS.products);
  cacheLife("days");

  const products = await getProducts({});
  return products.filter((p) => p.id !== productId).slice(0, 4);
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

  if (!isNopCommerceConfigured()) {
    return [];
  }

  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  if (sortKey) {
    params.set("sortKey", sortKey);
  }
  if (reverse) {
    params.set("reverse", "true");
  }

  const qs = params.toString();
  const products = await nopFetch<NopProduct[]>({
    path: `/products${qs ? `?${qs}` : ""}`,
    tags: [TAGS.products],
  });

  return products.map(reshapeProduct);
}

export async function revalidate(req: NextRequest): Promise<NextResponse> {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.NOPCOMMERCE_REVALIDATION_SECRET) {
    console.error("Invalid revalidation secret.");
    return NextResponse.json({ status: 401 });
  }

  const topic = (await headers()).get("x-nopcommerce-topic") || "unknown";
  if (topic.includes("product")) {
    revalidateTag(TAGS.products, "seconds");
  }
  if (topic.includes("category")) {
    revalidateTag(TAGS.collections, "seconds");
  }

  return NextResponse.json({ status: 200, revalidated: true, now: Date.now() });
}

export async function getCheckoutUrl(): Promise<string> {
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    throw new Error("No cart session");
  }

  const { checkoutUrl } = await nopFetch<{ checkoutUrl: string }>({
    path: "/checkout",
    method: "POST",
    sessionToken,
    cache: "no-store",
  });

  return checkoutUrl;
}
