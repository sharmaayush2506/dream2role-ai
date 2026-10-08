// Certificate payments. Uses Razorpay when RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are set;
// otherwise (outside production) a demo checkout that charges nothing.
import crypto from "node:crypto";
import { PRICING, type Pack } from "../shared/certs.ts";
import type { PaymentRecord, UserRecord } from "./db.ts";
import { HttpError } from "./http.ts";

const KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";

export const paymentMode: "razorpay" | "demo" | "off" =
  KEY_ID && KEY_SECRET ? "razorpay" : process.env.NODE_ENV === "production" && process.env.DEMO_PAYMENTS !== "1" ? "off" : "demo";

export async function createOrder(user: UserRecord, pack: Pack) {
  if (paymentMode === "off") throw new HttpError(503, "Payments aren't set up yet");
  const { amount, credits } = PRICING[pack];
  let orderId: string;

  if (paymentMode === "razorpay") {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${KEY_ID}:${KEY_SECRET}`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount: amount * 100, // paise
        currency: PRICING.currency,
        receipt: `${user.id.slice(0, 8)}-${Date.now()}`,
        notes: { userId: user.id, pack },
      }),
    });
    if (!res.ok) throw new HttpError(502, "Couldn't start the payment. Please try again.");
    orderId = ((await res.json()) as { id: string }).id;
  } else {
    orderId = `demo_${crypto.randomUUID()}`;
  }

  const record: PaymentRecord = { orderId, provider: paymentMode, pack, amount, credits, status: "created", createdAt: new Date().toISOString() };
  user.payments.push(record);
  return { provider: paymentMode, keyId: KEY_ID || null, orderId, amount, currency: PRICING.currency, credits };
}

/** Confirms a payment and adds the credits. Safe to call twice for the same order. */
export function confirmPayment(user: UserRecord, orderId: string, paymentId: string, signature: string) {
  const order = user.payments.find((p) => p.orderId === orderId);
  if (!order) throw new HttpError(404, "Order not found");
  if (order.status === "paid") return order;

  if (order.provider === "razorpay") {
    const expected = crypto.createHmac("sha256", KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    const ok = signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    if (!ok) throw new HttpError(400, "Payment couldn't be verified");
  } else if (paymentMode !== "demo") {
    throw new HttpError(400, "Demo payments are disabled");
  }

  order.status = "paid";
  order.paymentId = paymentId || `demo_pay_${Date.now()}`;
  user.certCredits += order.credits;
  return order;
}
