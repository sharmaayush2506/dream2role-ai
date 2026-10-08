import { api, type Me, type Order } from "./api.ts";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (ev: string, cb: () => void) => void };
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load the payment window"));
    document.body.appendChild(s);
  });
}

/** Opens Razorpay Checkout and resolves with the updated user once the payment is verified. */
export async function payWithRazorpay(order: Order, me: Me): Promise<Me> {
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rzp = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount * 100,
      currency: order.currency,
      name: "Dream2Role",
      description: order.credits === 1 ? "1 certificate exam" : `${order.credits} certificate exams`,
      prefill: { name: me.name, email: me.email },
      theme: { color: "#58cc02" },
      handler: async (r: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        try {
          const { user } = await api.verifyPayment(r.razorpay_order_id, r.razorpay_payment_id, r.razorpay_signature);
          resolve(user);
        } catch (e) {
          reject(e);
        }
      },
      modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
    });
    rzp.on("payment.failed", () => reject(new Error("Payment failed. You haven't been charged.")));
    rzp.open();
  });
}
