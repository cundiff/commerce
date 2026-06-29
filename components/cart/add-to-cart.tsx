"use client";

import { PlusIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { addItem } from "components/cart/actions";
import { getAvailabilityLabel } from "lib/availability";
import { Product, ProductVariant } from "lib/types";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { useCart } from "./cart-context";

function SubmitButton({
  selectedVariant,
  selectedVariantId,
}: {
  selectedVariant: ProductVariant | undefined;
  selectedVariantId: string | undefined;
}) {
  const buttonClasses =
    "relative flex w-full items-center justify-center rounded-full bg-blue-600 p-4 tracking-wide text-white";
  const disabledClasses = "cursor-not-allowed opacity-60 hover:opacity-60";

  if (selectedVariant && !selectedVariant.availableForSale) {
    return (
      <button disabled className={clsx(buttonClasses, disabledClasses)}>
        {getAvailabilityLabel(selectedVariant.availabilityStatus)}
      </button>
    );
  }

  if (!selectedVariantId) {
    return (
      <button
        aria-label="Please select an option"
        disabled
        className={clsx(buttonClasses, disabledClasses)}
      >
        <div className="absolute left-0 ml-4">
          <PlusIcon className="h-5" />
        </div>
        Add To Cart
      </button>
    );
  }

  return (
    <button
      aria-label="Add to cart"
      className={clsx(buttonClasses, {
        "hover:opacity-90": true,
      })}
    >
      <div className="absolute left-0 ml-4">
        <PlusIcon className="h-5" />
      </div>
      Add To Cart
    </button>
  );
}

export function AddToCart({ product }: { product: Product }) {
  const { variants } = product;
  const { addCartItem } = useCart();
  const searchParams = useSearchParams();
  const [message, formAction] = useActionState(addItem, null);

  const variant = variants.find((variant: ProductVariant) =>
    variant.selectedOptions.every(
      (option) => option.value === searchParams.get(option.name.toLowerCase()),
    ),
  );
  const defaultVariantId = variants.length === 1 ? variants[0]?.id : undefined;
  const selectedVariantId = variant?.id || defaultVariantId;
  const selectedVariant =
    variants.find(
      (productVariant) => productVariant.id === selectedVariantId,
    ) ?? variant;
  const addItemAction = formAction.bind(null, selectedVariantId);

  return (
    <form
      action={async () => {
        if (!selectedVariant || !selectedVariant.availableForSale) {
          return;
        }

        addCartItem(selectedVariant, product);
        addItemAction();
      }}
    >
      <SubmitButton
        selectedVariant={selectedVariant}
        selectedVariantId={selectedVariantId}
      />
      <p aria-live="polite" className="sr-only" role="status">
        {message}
      </p>
    </form>
  );
}
