// Read-only Printavo check: lists every UNPAID / PARTIAL_PAYMENT invoice so they
// can be compared with ShopManagerPro jobs (jobs are paid-in-full only).
// Service role only (pg_cron / internal.call_edge_function); verify_jwt is on,
// so the gateway has already checked the signature before the role is read.
Deno.serve(async (req) => {
  const tok = (req.headers.get("Authorization") || "").replace("Bearer ", "");
  let role = "";
  try { role = JSON.parse(atob(tok.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role; } catch { /* not a JWT */ }
  if (role !== "service_role") return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const email = Deno.env.get("PRINTAVO_API_EMAIL")!, token = Deno.env.get("PRINTAVO_API_TOKEN")!;
  const out: unknown[] = []; const errs: unknown[] = [];
  for (const ps of ["UNPAID", "PARTIAL_PAYMENT"]) {
    let after: string | null = null;
    for (let page = 0; page < 40; page++) {
      const r = await fetch("https://www.printavo.com/api/v2", {
        method: "POST",
        headers: { "Content-Type": "application/json", email, token },
        body: JSON.stringify({
          query: `query($after: String) { invoices(first: 25, after: $after, paymentStatus: ${ps}, sortOn: VISUAL_ID, sortDescending: true) { nodes { id visualId createdAt total amountPaid amountOutstanding paidInFull status { name } contact { fullName } } pageInfo { hasNextPage endCursor } } }`,
          variables: { after },
        }),
      });
      const j = await r.json();
      if (j.errors) { errs.push(j.errors); break; }
      const c = j.data.invoices;
      for (const n of c.nodes) out.push({ ps, id: n.id, v: n.visualId, at: n.createdAt, total: n.total, paid: n.amountPaid, owed: n.amountOutstanding, full: n.paidInFull, st: n.status?.name, who: n.contact?.fullName });
      if (!c.pageInfo.hasNextPage) break;
      after = c.pageInfo.endCursor;
      await new Promise((res) => setTimeout(res, 300));
    }
  }
  return new Response(JSON.stringify({ n: out.length, errs, rows: out }), { headers: { "Content-Type": "application/json" } });
});
