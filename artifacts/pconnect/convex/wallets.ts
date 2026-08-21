import { ConvexError } from "convex/values";
import { query } from "./_generated/server";

export const getMyWallet = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError({ code: "UNAUTHENTICATED", message: "User not logged in" });
    const user = await ctx.db.query("users").withIndex("by_token", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier)).unique();
    if (!user) return null;
    return await ctx.db.query("wallets").withIndex("by_user", (q) => q.eq("userId", user._id)).unique();
  },
});
