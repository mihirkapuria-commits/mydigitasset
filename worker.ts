const CATEGORIES = [
  "India Startups & Funding",
  "India Banking & FinTech",
  "Indian Stock Market & Economy",
  "Artificial Intelligence & Tech India",
  "Government Schemes & Policy",
  "Real Estate & Infrastructure India",
  "Automobile Industry India",
  "FMCG & Retail Market India",
  "Renewable Energy & Electric Vehicles",
  "Agriculture & AgriTech India",
  "Pharma & Healthcare India",
  "MSME & Manufacturing India",
  "Telecom & Media India",
  "Logistics & Supply Chain India",
  "Global Economy & India Impact"
];

async function sendTelegramMessage(token, chatId, text, replyMarkup = null) {
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: "Markdown"
  };
  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. Categories API
    if (url.pathname === "/api/categories") {
      if (request.method === "GET") {
        return new Response(JSON.stringify(CATEGORIES), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
    }

    // 2. Customer Registration / Trial API
    if (url.pathname === "/api/register" && request.method === "POST") {
      try {
        const data = await request.json();
        const { first_name, surname, email, country_code, mobile_number, password, category } = data;

        if (!email || !password || !mobile_number || !category) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        const trialExpires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

        await env.DB.prepare(
          `INSERT INTO users (first_name, surname, email, country_code, mobile_number, password, category, trial_expires_at, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'trial')`
        ).bind(first_name || "", surname || "", email, country_code || "+91", mobile_number, password, category, trialExpires).run();

        const token = env.TELEGRAM_BOT_TOKEN;
        const chatId = env.OWNER_TELEGRAM_CHAT_ID;
        if (token && chatId) {
          const msg = `🚀 *New Trial Signup!*\n\n*Name:* ${first_name} ${surname}\n*Mobile:* ${country_code} ${mobile_number}\n*Email:* ${email}\n*Category:* ${category}`;
          await sendTelegramMessage(token, chatId, msg);
        }

        return new Response(JSON.stringify({ success: true, trial_expires_at: trialExpires }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      }
    }

    // 3. Telegram Webhook Handler
    if (url.pathname === "/api/telegram/webhook" && request.method === "POST") {
      try {
        const update = await request.json();
        const token = env.TELEGRAM_BOT_TOKEN;

        if (update.callback_query) {
          const callback = update.callback_query;
          const data = callback.data; 
          const chatId = callback.message.chat.id;

          const [action, userId] = data.split("_");

          if (action === "APPROVE") {
            await env.DB.prepare("UPDATE users SET status = 'active' WHERE id = ?").bind(userId).run();
            await sendTelegramMessage(token, chatId, `✅ User #${userId} has been approved and activated!`);
          } else if (action === "STOP") {
            await env.DB.prepare("UPDATE users SET status = 'stopped' WHERE id = ?").bind(userId).run();
            await sendTelegramMessage(token, chatId, `❌ User #${userId} subscription has been stopped.`);
          }
        }

        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500 });
      }
    }

    let response = await env.ASSETS.fetch(request);
    if (response.status === 404) {
      const indexUrl = new URL("/index.html", request.url);
      response = await env.ASSETS.fetch(new Request(indexUrl, request));
    }
    return response;
  },

  async scheduled(event, env, ctx) {
    console.log("Cron triggered");
  }
};

export { worker_default as default };
