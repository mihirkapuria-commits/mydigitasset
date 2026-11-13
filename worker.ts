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

    // Ensure database tables exist on request if needed
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS news_briefings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category_id TEXT NOT NULL,
          content TEXT NOT NULL,
          date_str TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    } catch (e) {
      // Table may already exist
    }

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

    // 2. Admin Endpoint to Post Daily Briefings for a Category
    if (url.pathname === "/api/admin/post-news" && request.method === "POST") {
      try {
        const { categoryId, content, dateStr } = await request.json();
        if (!categoryId || !content) {
          return new Response(JSON.stringify({ error: "Missing categoryId or content" }), { status: 400 });
        }
        const today = dateStr || new Date().toISOString().split('T')[0];

        await env.DB.prepare(
          `INSERT INTO news_briefings (category_id, content, date_str) VALUES (?, ?, ?)`
        ).bind(categoryId, content, today).run();

        return new Response(JSON.stringify({ success: true, message: "News briefing posted successfully!" }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 3. Customer Registration / Trial API
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
        
        // Send Admin Approval Request strictly to Owner/Admin Chat ID
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

    // 4. Telegram Webhook Handler
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

      const todayStr = new Date().toISOString().split('T')[0];

      // Loop through all 15 categories to broadcast rich daily briefings at 6:15 AM IST
      for (const cat of CATEGORIES) {
        if (!cat.telegramChatId) continue;

        // Check if a customized briefing was posted for today in D1
        let briefingContent = "";
        try {
          const record = await env.DB.prepare(
            `SELECT content FROM news_briefings WHERE category_id = ? AND date_str = ? ORDER BY id DESC LIMIT 1`
          ).bind(cat.id, todayStr).first();

          if (record && record.content) {
            briefingContent = record.content;
          }
        } catch (dbErr) {
          console.error("Error fetching news briefing from DB:", dbErr);
        }

        // Fallback professional formatted briefing if none posted for today yet
        if (!briefingContent) {
          briefingContent = `🚀 *${cat.title.toUpperCase()} — DAILY BRIEF*\n` +
            `📅 ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} • Market & Ecosystem Updates\n\n` +
            `1. Key sector developments show robust growth and expanded enterprise partnerships.\n` +
            `Major stakeholders report positive quarterly momentum and strategic expansions. [MyDigitAsset]\n\n` +
            `2. Regulatory updates and policy shifts align with long-term industry projections.\n` +
            `Stakeholders are advised to monitor upcoming compliance frameworks. [Industry Watch]`;
        }

        await sendTelegramMessage(token, cat.telegramChatId, briefingContent);
        console.log(`Successfully sent rich briefing to channel: ${cat.title} (${cat.telegramChatId})`);
      }
    } catch (err) {
      console.error("Cron broadcast error:", err.message);
    }
  }
};

export { worker_default as default };
