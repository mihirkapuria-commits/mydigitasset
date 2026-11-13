const CATEGORIES = [
  { id: 'banking-fintech', title: 'Banking and Fintech', telegramChatId: '-1004377330142' },
  { id: 'consumer-fmcg', title: 'India Consumer & FMCG', telegramChatId: '-1004356285380' },
  { id: 'economy-business', title: 'Economy and Business', telegramChatId: '-1003773612503' },
  { id: 'energy-renewal', title: 'Energy and Renewal', telegramChatId: '-1004305076677' },
  { id: 'hr-employment', title: 'HR and Employment', telegramChatId: '-1003756538856' },
  { id: 'it-ai-cybersecurity', title: 'IT AI Cybersecurity', telegramChatId: '-1004404579614' },
  { id: 'manufacturing-auto', title: 'Manufacturing and Auto', telegramChatId: '-1004328043113' },
  { id: 'marketing-advertising', title: 'Marketing and Advertising', telegramChatId: '-1003914193738' },
  { id: 'real-estate', title: 'Real Estate', telegramChatId: '-1004322510775' },
  { id: 'bollywood', title: 'Bollywood', telegramChatId: '-1004339246354' },
  { id: 'kids', title: 'Kids', telegramChatId: '-1004312693379' },
  { id: 'women', title: 'Women', telegramChatId: '-1003821497200' },
  { id: 'politics', title: 'Politics', telegramChatId: '-1004350871154' },
  { id: 'stock-market', title: 'Stock Market', telegramChatId: '-1004343493425' },
  { id: 'startup', title: 'Startup', telegramChatId: '-1003720483555' }
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
    if (url.pathname === "/api/auth/register" && request.method === "POST") {
      try {
        const data = await request.json();
        const { firstName, surname, email, countryCode, mobileNumber, password, category } = data;

        if (!email || !password || !mobileNumber || !category) {
          return new Response(JSON.stringify({ error: "Missing required fields" }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        const trialExpires = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

        const insertResult = await env.DB.prepare(
          `INSERT INTO users (first_name, surname, email, country_code, mobile_number, password, category, trial_expires_at, status) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'trial')`
        ).bind(firstName || "", surname || "", email, countryCode || "+91", mobileNumber, password, category, trialExpires).run();

        const userId = insertResult.meta.last_row_id;
        const tokenVal = "dummy_token_" + userId;

        const matchedCat = CATEGORIES.find(c => c.id === category || c.title === category);
        const catTitle = matchedCat ? matchedCat.title : category;
        
        // Send Admin Approval Request strictly to Owner/Admin Chat ID (not the public news channel)
        const token = env.TELEGRAM_BOT_TOKEN;
        const adminChatId = env.OWNER_TELEGRAM_CHAT_ID;

        if (token && adminChatId) {
          const msg = `🚀 *New Trial Signup!*\n\n*User ID:* ${userId}\n*Name:* ${firstName || ""} ${surname || ""}\n*Mobile:* ${countryCode || "+91"} ${mobileNumber}\n*Email:* ${email}\n*Category:* ${catTitle}`;
          
          const keyboard = {
            inline_keyboard: [
              [
                { text: "✅ Approve", callback_data: `APPROVE_${userId}` },
                { text: "❌ Stop", callback_data: `STOP_${userId}` }
              ]
            ]
          };

          await sendTelegramMessage(token, adminChatId, msg, keyboard);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          token: tokenVal, 
          user: { id: userId, email, first_name: firstName, surname, category, status: 'trial', role: 'customer' } 
        }), {
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
    try {
      console.log("Automated 6:15 AM IST news broadcast triggered.");
      const token = env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        console.error("TELEGRAM_BOT_TOKEN is missing in environment variables.");
        return;
      }

      // Loop through all 15 categories to broadcast morning briefings automatically at 6:15 AM IST
      for (const cat of CATEGORIES) {
        if (!cat.telegramChatId) continue;

        const broadcastText = `🌅 *MyDigitAsset Morning Briefing*\n\n` +
          `Category: *${cat.title}*\n\n` +
          `Good morning! Here are today's top curated business, market, and policy developments to keep you ahead.\n\n` +
          `_Stay tuned for live updates throughout the day._`;

        await sendTelegramMessage(token, cat.telegramChatId, broadcastText);
        console.log(`Successfully sent morning briefing to channel: ${cat.title} (${cat.telegramChatId})`);
      }
    } catch (err) {
      console.error("Cron broadcast error:", err.message);
    }
  }
};

export { worker_default as default };
