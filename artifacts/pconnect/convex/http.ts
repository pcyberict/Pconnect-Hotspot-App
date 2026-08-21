import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/flutterwave/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const dbHash = await ctx.runQuery(api.siteSettings.getValueInternal, { key: "flutterwave_webhook_hash" });
    const expectedHash = dbHash ?? process.env.FLUTTERWAVE_WEBHOOK_HASH ?? "";
    const receivedHash = request.headers.get("verif-hash");
    if (!expectedHash || !receivedHash || receivedHash !== expectedHash) {
      return new Response("Invalid signature", { status: 401 });
    }
    const body = (await request.json()) as { data?: { id?: number; tx_ref?: string } };
    const transactionId = body.data?.id;
    if (!transactionId) return new Response(null, { status: 200 });
    await ctx.runAction(api.wallet.deposits.verifyAndFinalizeDeposit, { providerTransactionId: String(transactionId) });
    return new Response(null, { status: 200 });
  }),
});

export default http;
