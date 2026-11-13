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

async function parseRequestBody(request) {
  const contentType = request.headers.get("content-type") || "";
  try {
    if (contentType.includes("application/json")) {
      return await request.json();
    } else if (contentType.includes("form")) {
      const formData = await request.formData();
      const obj = {};
      for (let [key, value] of formData.entries()) {
        obj[key] = value;
      }
      return obj;
    } else {
      const text = await request.text();
      return text ? JSON.parse(text) : {};
    }
  } catch (e) {
    return {};
  }
}

var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Initialize Database Tables
    try {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          first_name TEXT,
          surname TEXT,
          email TEXT UNIQUE,
          country_code TEXT,
          mobile_number TEXT,
          password TEXT,
          category TEXT,
          trial_expires_at TEXT,
          status TEXT DEFAULT 'trial',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          utr_number TEXT,
          payment_proof TEXT,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
    } catch (e) {}

    // 1. Categories API
    if (url.pathname === "/api/categories" && request.method === "GET") {
      return new Response(JSON.stringify(CATEGORIES), {
        status: 200,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 2. Admin Stats API
    if (url.pathname === "/api/admin/stats" && request.method === "GET") {
      try {
        const userCount = await env.DB.prepare(`SELECT COUNT(*) as count FROM users`).first();
        const activeCount = await env.DB.prepare(`SELECT COUNT(*) as count FROM users WHERE status = 'active'`).first();
        const trialCount = await env.DB.prepare(`SELECT COUNT(*) as count FROM users WHERE status = 'trial'`).first();
        
        let totalReceipts = 0;
        try {
          const paymentsSum = await env.DB.prepare(`SELECT SUM(amount) as total FROM payments WHERE status = 'approved'`).first();
          totalReceipts = paymentsSum?.total || 0;
        } catch (err) {}

        return new Response(JSON.stringify({
          totalUsers: userCount?.count || 0,
          activeSubscribers: activeCount?.count || 0,
          trialSubscribers: trialCount?.count || 0,
          totalReceipts: totalReceipts,
          gstRate: 18,
          annualPrice: 297.36
        }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }

    // 3. Customer Trial Registration API (Sends Trial Alert with Category to Admin)
    if (url.pathname === "/api/auth/register" && request.method === "POST") {
      try {
        const data = await parseRequestBody(request);
        const { firstName, surname, email, countryCode, mobileNumber, password, category } = data || {};

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

        // Admin Message #1: Trial Start Alert (Name, User ID, Mobile Number, and News Category)
        const token = env.TELEGRAM_BOT_TOKEN;
        const adminChatId = env.OWNER_TELEGRAM_CHAT_ID;

        if (token && adminChatId) {
          const msg = `⏳ *New Trial Started!*\n\n` +
            `*User ID:* #${userId}\n` +
            `*Name:* ${firstName || ""} ${surname || ""}\n` +
            `*Mobile:* ${countryCode || "+91"} ${mobileNumber}\n` +
            `*Email:* ${email}\n` +
            `*Category:* ${catTitle}`;
          await sendTelegramMessage(token, adminChatId, msg);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          token: tokenVal, 
          user: { id: userId, email, first_name: firstName, surname, category, status: 'trial' } 
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

    // 4. Annual Subscription Payment & Proof Submission API (Sends Message #2 to Admin with Buttons)
    if (url.pathname === "/api/auth/submit-payment" && request.method === "POST") {
      try {
        const data = await parseRequestBody(request);
        const { userId, utrNumber, paymentProof } = data || {};

        if (!userId || !utrNumber) {
          return new Response(JSON.stringify({ error: "Missing user ID or UTR number" }), {
            status: 400,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        }

        const user = await env.DB.prepare(`SELECT first_name, surname, email, mobile_number, category FROM users WHERE id = ?`).bind(userId).first();

        await env.DB.prepare(
          `INSERT INTO payments (user_id, utr_number, payment_proof, status) VALUES (?, ?, ?, 'pending')`
        ).bind(userId, utrNumber, paymentProof || "").run();

        const token = env.TELEGRAM_BOT_TOKEN;
        const adminChatId = env.OWNER_TELEGRAM_CHAT_ID;

        if (token && adminChatId && user) {
          const matchedCat = CATEGORIES.find(c => c.id === user.category || c.title === user.category);
          const catTitle = matchedCat ? matchedCat.title : user.category;

          const msg = `💳 *Annual Subscription Payment Submitted!*\n\n` +
            `*User ID:* #${userId}\n` +
            `*Name:* ${user.first_name} ${user.surname}\n` +
            `*Mobile:* ${user.mobile_number}\n` +
            `*Email:* ${user.email}\n` +
            `*Category:* ${catTitle}\n` +
            `*UTR / Ref No:* \`${utrNumber}\`\n` +
            `*Payment Proof:* ${paymentProof ? "Attached / Uploaded" : "Not Provided"}`;

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

        return new Response(JSON.stringify({ success: true, message: "Payment submitted successfully for verification." }), {
          status: 200,
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      }
    }

    // 5. Telegram Webhook Handler (Processes Approve / Stop button clicks)
    if (url.pathname === "/api/telegram/webhook" && request.method === "POST") {
      try {
        const update = await parseRequestBody(request);
        const token = env.TELEGRAM_BOT_TOKEN;

        if (update.callback_query) {
          const callback = update.callback_query;
          const data = callback.data; 
          const chatId = callback.message.chat.id;

          const [action, userId] = data.split("_");

          if (action === "APPROVE") {
            await env.DB.prepare("UPDATE users SET status = 'active' WHERE id = ?").bind(userId).run();
            await env.DB.prepare("UPDATE payments SET status = 'approved' WHERE user_id = ?").bind(userId).run();
            await sendTelegramMessage(token, chatId, `✅ User #${userId} subscription has been approved and activated for the full year!`);
          } else if (action === "STOP") {
            await env.DB.prepare("UPDATE users SET status = 'stopped' WHERE id = ?").bind(userId).run();
            await env.DB.prepare("UPDATE payments SET status = 'rejected' WHERE user_id = ?").bind(userId).run();
            await sendTelegramMessage(token, chatId, `❌ User #${userId} subscription has been stopped/rejected.`);
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
  }
};

export { worker_default as default };
