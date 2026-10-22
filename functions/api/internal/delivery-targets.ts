
interface Env {
  DB: {
    prepare(query: string): {
      bind(...values: unknown[]): {
        first(): Promise<any>;
        all(): Promise<{ results: any[] }>;
      };
    };
  };
  DELIVERY_API_SECRET?: string;
}

export async function onRequest(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });

  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Fail closed unless the server-side secret is configured.
  const secret = env.DELIVERY_API_SECRET;
  if (!secret) {
    return json({ error: "Delivery service is not configured" }, 503);
  }

  const authorization = request.headers.get("Authorization") || "";
  if (
    authorization.length !== secret.length + 7 ||
    authorization.slice(0, 7) !== "Bearer " ||
    authorization.slice(7) !== secret
  ) {
    return json({ error: "Unauthorized" }, 401);
  }

  const url = new URL(request.url);
  const categoryId = url.searchParams.get("categoryId");
  const deliveryDate = url.searchParams.get("deliveryDate");

  if (
    !categoryId ||
    categoryId.length > 128 ||
    !deliveryDate ||
    !/^\d{4}-\d{2}-\d{2}$/.test(deliveryDate)
  ) {
    return json({
      error: "Valid categoryId and deliveryDate (YYYY-MM-DD) are required",
    }, 400);
  }

  // Reject impossible calendar dates.
  const parsedDate = new Date(`${deliveryDate}T00:00:00Z`);
  if (
    Number.isNaN(parsedDate.getTime()) ||
    parsedDate.toISOString().slice(0, 10) !== deliveryDate
  ) {
    return json({ error: "Invalid delivery date" }, 400);
  }

  try {
    const category = await env.DB.prepare(`
      SELECT id, title
      FROM categories
      WHERE id = ? AND active = 1
    `).bind(categoryId).first();

    if (!category) {
      return json({ error: "Active category not found" }, 404);
    }

    const result = await env.DB.prepare(`
      SELECT DISTINCT
        u.id AS customer_id,
        u.name AS customer_name,
        u.telegram_chat_id,
        c.id AS category_id,
        c.title AS category_title
      FROM users u
      JOIN categories c ON c.id = ?
      WHERE
        u.role = 'customer'
        AND u.telegram_chat_id IS NOT NULL
        AND TRIM(u.telegram_chat_id) <> ''
        AND u.admin_access_override <> 'deny'
        AND (
          EXISTS (
            SELECT 1
            FROM json_each(
              CASE
                WHEN json_valid(u.categories) THEN u.categories
                ELSE '[]'
              END
            ) selected
            WHERE CAST(selected.value AS TEXT) = c.id
          )
          OR u.category = c.id
        )
        AND (
          (
            u.admin_access_override = 'allow'
            AND (
              u.admin_access_until IS NULL
              OR datetime(u.admin_access_until) >=
                 datetime(? || ' 23:59:59')
            )
          )
          OR
          (
            u.admin_access_override = 'normal'
            AND (
              -- Trial news starts the day after registration.
              (
                date(u.trial_start) < date(?)
                AND date(u.trial_expiry) >= date(?)
              )

              OR

              -- Verified paid access is category-specific.
              EXISTS (
                SELECT 1
                FROM category_access ca
                WHERE ca.user_id = u.id
                  AND ca.category_id = c.id
                  AND ca.access_status = 'active'
                  AND date(ca.starts_at) <= date(?)
                  AND (
                    ca.expires_at IS NULL
                    OR date(ca.expires_at) >= date(?)
                  )
              )

              OR

              -- A submitted, unreviewed payment allows courtesy
              -- delivery until an administrator changes access
              -- or rejects the payment.
              EXISTS (
                SELECT 1
                FROM payments p
                WHERE p.user_id = u.id
                  AND p.category_id = c.id
                  AND p.status = 'pending'
              )
            )
          )
        )
      ORDER BY u.name COLLATE NOCASE
    `).bind(
      categoryId,
      deliveryDate,
      deliveryDate,
      deliveryDate,
      deliveryDate,
      deliveryDate,
      deliveryDate
    ).all();

    return json({
      categoryId: category.id,
      categoryTitle: category.title,
      deliveryDate,
      count: result.results.length,
      recipients: result.results.map((row: any) => ({
        customerId: row.customer_id,
        customerName: row.customer_name,
        telegramChatId: row.telegram_chat_id,
        categoryId: row.category_id,
        categoryTitle: row.category_title,
      })),
    });
  } catch {
    // Do not return database errors or internal details to callers.
    return json({ error: "Unable to retrieve delivery targets" }, 500);
  }
}
