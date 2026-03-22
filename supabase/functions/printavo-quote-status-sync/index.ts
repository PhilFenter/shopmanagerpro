import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRINTAVO_API_URL = "https://www.printavo.com/api/v2";

// Printavo status names that indicate the quote was sent to the customer
const SENT_STATUSES = [
  "quote approval sent",
  "quote sent",
  "approval sent",
];

// Printavo status names that indicate the customer approved
const APPROVED_STATUSES = [
  "quote approved",
  "approved",
  "order confirmed",
  "confirmed",
];

// Printavo status names that indicate payment received
const PAID_STATUSES = [
  "invoice paid",
  "paid",
  "payment received",
  "completed",
];

function normalizeStatus(name: string): string {
  return name.trim().toLowerCase();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const printavoEmail = Deno.env.get("PRINTAVO_API_EMAIL");
    const printavoToken = Deno.env.get("PRINTAVO_API_TOKEN");
    if (!printavoEmail || !printavoToken) {
      throw new Error("Printavo API credentials not configured");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch all quotes that have been pushed to Printavo and aren't yet approved/paid/converted
    const { data: quotes, error: qErr } = await supabase
      .from("quotes")
      .select("id, printavo_order_id, printavo_visual_id, status, converted_job_id")
      .not("printavo_order_id", "is", null)
      .in("status", ["draft", "sent"])
      .is("converted_job_id", null)
      .limit(100);

    if (qErr) throw new Error(`Query error: ${qErr.message}`);

    const results: Array<{
      quote_id: string;
      printavo_id: string;
      old_status: string;
      new_status: string | null;
      printavo_status_name: string | null;
    }> = [];

    let updated = 0;
    let checked = 0;
    let errors = 0;

    for (const q of quotes || []) {
      checked++;
      try {
        // Query Printavo for the quote/order status
        const res = await fetch(PRINTAVO_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            email: printavoEmail,
            token: printavoToken,
          },
          body: JSON.stringify({
            query: `query GetQuoteStatus($id: ID!) {
              quote(id: $id) {
                id
                visualId
                status { name }
              }
            }`,
            variables: { id: q.printavo_order_id },
          }),
        });

        const json = await res.json();
        if (json.errors) {
          console.error(`Printavo error for ${q.printavo_order_id}:`, json.errors);
          errors++;
          results.push({
            quote_id: q.id,
            printavo_id: q.printavo_order_id,
            old_status: q.status,
            new_status: null,
            printavo_status_name: null,
          });
          continue;
        }

        const statusName = json.data?.quote?.status?.name || null;
        if (!statusName) {
          results.push({
            quote_id: q.id,
            printavo_id: q.printavo_order_id,
            old_status: q.status,
            new_status: null,
            printavo_status_name: null,
          });
          continue;
        }

        const normalized = normalizeStatus(statusName);
        let newStatus: string | null = null;

        if (PAID_STATUSES.includes(normalized)) {
          newStatus = "paid";
        } else if (APPROVED_STATUSES.includes(normalized)) {
          newStatus = "approved";
        } else if (SENT_STATUSES.includes(normalized)) {
          newStatus = "sent";
        }

        if (newStatus && newStatus !== q.status) {
          const updateData: Record<string, unknown> = { status: newStatus };
          // Set quote_sent_at when transitioning to "sent" — this starts the follow-up clock
          if (newStatus === "sent" && !q.status?.includes("sent")) {
            updateData.quote_sent_at = new Date().toISOString();
          }

          // When approved or paid, try to link to the matching job created by printavo-sync
          if ((newStatus === "approved" || newStatus === "paid") && !q.converted_job_id) {
            const { data: matchingJob } = await supabase
              .from("jobs")
              .select("id")
              .eq("external_id", q.printavo_order_id)
              .eq("source", "printavo")
              .limit(1)
              .maybeSingle();

            if (matchingJob) {
              updateData.converted_job_id = matchingJob.id;
              console.log(`Linked quote ${q.id} → job ${matchingJob.id}`);
            }
          }

          await supabase
            .from("quotes")
            .update(updateData)
            .eq("id", q.id);
          updated++;
        }

        results.push({
          quote_id: q.id,
          printavo_id: q.printavo_order_id,
          old_status: q.status,
          new_status: newStatus,
          printavo_status_name: statusName,
        });
      } catch (err) {
        console.error(`Error checking quote ${q.id}:`, err);
        errors++;
      }
    }

    console.log(`Printavo status sync: checked=${checked}, updated=${updated}, errors=${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        checked,
        updated,
        errors,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("printavo-quote-status-sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
