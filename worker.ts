export interface Env {
  DB: D1Database;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  // Handles incoming browser requests & API calls
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // API route to get dynamic content from D1
    if (url.pathname === '/api/content') {
      if (request.method === 'GET') {
        try {
          const { results } = await env.DB.prepare(
            'SELECT key, value FROM site_content'
          ).all();

          const contentMap: Record<string, string> = {};
          if (results) {
            for (const row of results as { key: string; value: string }[]) {
              contentMap[row.key] = row.value;
            }
          }

          return new Response(JSON.stringify(contentMap), {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
              'Cache-Control': 'no-cache',
            },
          });
        } catch (error: any) {
          return new Response(
            JSON.stringify({ error: 'Failed to retrieve content', details: error.message }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }

      // API route to update dynamic content via POST
      if (request.method === 'POST') {
        try {
          const body = (await request.json()) as { key: string; value: string };
          if (!body.key || body.value === undefined) {
            return new Response(JSON.stringify({ error: 'Missing key or value' }), { status: 400 });
          }

          await env.DB.prepare(
            'INSERT INTO site_content (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
          ).bind(body.key, body.value).run();

          return new Response(JSON.stringify({ success: true, key: body.key }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error: any) {
          return new Response(
            JSON.stringify({ error: 'Failed to update content', details: error.message }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      }
    }

    // Serve static site assets for all other routes
    return env.ASSETS.fetch(request);
  },

  // Handles your daily 00:45 cron trigger
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Cron triggered at:', new Date(event.scheduledTime).toISOString());
  },
};
