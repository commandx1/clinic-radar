const LEMONSQUEEZY_API_BASE = "https://api.lemonsqueezy.com/v1";

interface CreateCheckoutParams {
  userId: string;
  email: string;
}

export async function createCheckout({ userId, email }: CreateCheckoutParams): Promise<string> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = process.env.LEMONSQUEEZY_PRO_VARIANT_ID;

  if (!apiKey || !storeId || !variantId) {
    throw new Error("lemonsqueezy_not_configured");
  }

  const response = await fetch(`${LEMONSQUEEZY_API_BASE}/checkouts`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email,
            custom: { user_id: userId },
          },
        },
        relationships: {
          store: { data: { type: "stores", id: storeId } },
          variant: { data: { type: "variants", id: variantId } },
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`lemonsqueezy_checkout_failed: ${String(response.status)}`);
  }

  const body = (await response.json()) as { data: { attributes: { url: string } } };
  return body.data.attributes.url;
}
