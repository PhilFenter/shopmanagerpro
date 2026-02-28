import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRINTAVO_API_URL = "https://www.printavo.com/api/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validate user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const printavoEmail = Deno.env.get("PRINTAVO_API_EMAIL");
    const printavoToken = Deno.env.get("PRINTAVO_API_TOKEN");

    if (!printavoEmail || !printavoToken) {
      return new Response(
        JSON.stringify({ error: "Printavo API credentials not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const maxPages = body.maxPages || 100;

    // Query all contacts from Printavo
    const contactsQuery = `
      query GetContacts($first: Int!, $after: String) {
        contacts(first: $first, after: $after) {
          nodes {
            id
            fullName
            email
            phone
            company
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const makePrintavoRequest = async (gqlQuery: string, variables: Record<string, unknown>) => {
      return await fetch(PRINTAVO_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          email: printavoEmail,
          token: printavoToken,
        },
        body: JSON.stringify({ query: gqlQuery, variables }),
      });
    };

    let allContacts: any[] = [];
    let hasNextPage = true;
    let endCursor: string | null = null;
    let pageCount = 0;

    while (hasNextPage && pageCount < maxPages) {
      pageCount++;
      console.log(`Fetching contacts page ${pageCount}...`);

      const variables: Record<string, unknown> = { first: 25 };
      if (endCursor) variables.after = endCursor;

      const response = await makePrintavoRequest(contactsQuery, variables);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Printavo API error:`, response.status, errorText);
        return new Response(
          JSON.stringify({ error: `Printavo API error: ${response.status}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      if (data.errors) {
        console.error("GraphQL errors:", data.errors);
        return new Response(
          JSON.stringify({ error: "Printavo GraphQL error", details: data.errors }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pageData = data.data?.contacts;
      const nodes = pageData?.nodes || [];
      allContacts.push(...nodes.filter((n: any) => n?.id && n?.fullName));

      hasNextPage = pageData?.pageInfo?.hasNextPage || false;
      endCursor = pageData?.pageInfo?.endCursor || null;

      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Fetched ${allContacts.length} contacts across ${pageCount} pages`);

    // Get existing customers to avoid duplicates (match by name + source)
    const { data: existingCustomers } = await supabase
      .from("customers")
      .select("id, name, email, source")
      .eq("source", "printavo");

    const existingByName = new Map(
      (existingCustomers || []).map(c => [c.name?.toLowerCase().trim(), c])
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const contact of allContacts) {
      const name = contact.fullName?.trim();
      if (!name) { skipped++; continue; }

      const existing = existingByName.get(name.toLowerCase());

      if (existing) {
        // Update email/phone if we have better data
        const updates: Record<string, any> = {};
        if (contact.email && !existing.email) updates.email = contact.email;
        if (contact.phone) updates.phone = contact.phone;
        if (contact.company) updates.company = contact.company;

        if (Object.keys(updates).length > 0) {
          await supabase.from("customers").update(updates).eq("id", existing.id);
          updated++;
        } else {
          skipped++;
        }
      } else {
        const { error } = await supabase.from("customers").insert({
          name,
          email: contact.email || null,
          phone: contact.phone || null,
          company: contact.company || null,
          source: "printavo",
        });
        if (error) {
          console.error(`Error inserting ${name}:`, error.message);
          skipped++;
        } else {
          inserted++;
          existingByName.set(name.toLowerCase(), { id: '', name, email: contact.email, source: 'printavo' });
        }
      }
    }

    console.log(`Done: ${inserted} inserted, ${updated} updated, ${skipped} skipped`);

    return new Response(
      JSON.stringify({
        success: true,
        total: allContacts.length,
        inserted,
        updated,
        skipped,
        pages: pageCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
