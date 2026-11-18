// Ko-fi → Settings → API → Webhooks. Ko-fi POSTs form data with a `data` field (JSON).
// We check the verification token, then record the donor email.
import { admin, isEmail, normEmail } from "../_shared/util.ts";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const form = await req.formData().catch(() => null);
  const raw = form?.get("data");
  if (typeof raw !== "string") return new Response("bad request", { status: 400 });

  let d: any;
  try { d = JSON.parse(raw); } catch { return new Response("bad json", { status: 400 }); }
  if (d.verification_token !== Deno.env.get("KOFI_VERIFICATION_TOKEN")) {
    return new Response("unauthorized", { status: 401 });
  }

  const email = normEmail(d.email);
  // Ko-fi's "Send test" always uses jo.example@example.com — never let it unlock anything
  if (email.endsWith("@example.com")) {
    console.log("kofi test donation received (not stored)", d.type ?? null);
    return new Response("ok", { status: 200 });
  }
  if (isEmail(email)) {
    const { error } = await admin().from("donations").upsert({
      email,
      source: "kofi",
      amount: Number(d.amount) || null,
      currency: d.currency ?? null,
      external_id: `kofi_${d.kofi_transaction_id ?? d.message_id}`,
    }, { onConflict: "external_id", ignoreDuplicates: true });
    if (error) return new Response("db error", { status: 500 }); // Ko-fi will retry
  }
  return new Response("ok", { status: 200 });
});
