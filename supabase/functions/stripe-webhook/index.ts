// Stripe Dashboard → Developers → Webhooks → endpoint for `checkout.session.completed`.
// Works with a Stripe Payment Link (no checkout server code needed).
import Stripe from "npm:stripe@17.7.0";
import { admin, isEmail, normEmail } from "../_shared/util.ts";

// Only signature verification is used (no Stripe API calls), so no secret key is
// needed: the placeholder just satisfies the constructor. Needs STRIPE_WEBHOOK_SECRET only.
const stripe = new Stripe("sk_not_needed", { httpClient: Stripe.createFetchHttpClient() });
const crypto = Stripe.createSubtleCryptoProvider();

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body, sig!, Deno.env.get("STRIPE_WEBHOOK_SECRET")!, undefined, crypto,
    );
  } catch (e) {
    return new Response(`signature: ${(e as Error).message}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const s = event.data.object as Stripe.Checkout.Session;
    // The Stripe account is shared with Wood Gate, whose heart purchases are API-created
    // sessions with a player id. AdRank donations come only from a Payment Link.
    if (!s.payment_link || s.client_reference_id || s.metadata?.player_id) {
      return new Response(JSON.stringify({ received: true, ignored: "not an AdRank payment link" }),
        { headers: { "Content-Type": "application/json" } });
    }
    const email = normEmail(s.customer_details?.email ?? s.customer_email);
    if (s.payment_status === "paid" && isEmail(email)) {
      const { error } = await admin().from("donations").upsert({
        email,
        source: "stripe",
        amount: s.amount_total != null ? s.amount_total / 100 : null,
        currency: s.currency?.toUpperCase() ?? null,
        external_id: `stripe_${s.id}`,
      }, { onConflict: "external_id", ignoreDuplicates: true });
      if (error) return new Response("db error", { status: 500 }); // Stripe retries
    }
  }
  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
