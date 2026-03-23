// Vercel Serverless Function — Monthly Budget Summary Email
// Triggered by Vercel Cron on the 1st of each month, or manually from the app

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const USERS = [
  { id: "pranav", name: "Pranav", avatar: "🧑‍💻", color: "#FF6B35" },
  { id: "kesha", name: "Kesha", avatar: "💃", color: "#E040FB" },
];

const MO = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const fmt = n => "£" + Math.abs(n).toFixed(2);

async function getS(key, fb) {
  try {
    const { data, error } = await supabase.from("settings").select("value").eq("key", key).single();
    if (error || !data) return fb;
    let v = data.value;
    if (typeof v === "string") try { v = JSON.parse(v); } catch {}
    if (typeof v === "string") try { v = JSON.parse(v); } catch {}
    return v;
  } catch { return fb; }
}

export default async function handler(req, res) {
  // Allow both GET (cron) and POST (manual trigger)
  
  try {
    // Get email from settings
    const email = await getS("summary_email", null);
    if (!email) {
      return res.status(400).json({ error: "No email configured. Set your email in Budget Buddy settings." });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return res.status(500).json({ error: "RESEND_API_KEY not configured in Vercel environment variables." });
    }

    // Figure out which month to summarize (last month)
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const monthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, "0")}`;
    const monthName = `${MO[lastMonth.getMonth()]} ${lastMonth.getFullYear()}`;

    // Fetch transactions for that month
    const { data: txs, error } = await supabase
      .from("transactions")
      .select("*")
      .like("date", `${monthKey}%`)
      .order("date", { ascending: true });

    if (error) {
      return res.status(500).json({ error: "Failed to fetch transactions", details: error.message });
    }

    const transactions = (txs || []).map(r => ({
      userId: r.user_id,
      type: r.type,
      category: r.category,
      emoji: r.emoji,
      amount: parseFloat(r.amount),
      note: r.note || "",
      date: r.date,
      sg: r.split_group_id,
    }));

    // Calculate stats
    const totalIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const balance = totalIncome - totalExpense;
    const budget = parseFloat(await getS("monthly_budget", 1500)) || 1500;
    const budgetPct = budget > 0 ? Math.round((totalExpense / budget) * 100) : 0;

    // Per-user stats
    const userStats = USERS.map(u => {
      const ut = transactions.filter(t => t.userId === u.id);
      return {
        ...u,
        income: ut.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0),
        expense: ut.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0),
        txCount: ut.length,
      };
    });

    // Top categories
    const catTotals = {};
    transactions.filter(t => t.type === "expense").forEach(t => {
      catTotals[t.category] = (catTotals[t.category] || 0) + t.amount;
    });
    const topCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 6);

    // Build HTML email
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4F1EA;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:480px;margin:0 auto;padding:20px">
  
  <!-- Header -->
  <div style="background:linear-gradient(135deg,#FF6B35,#FF8F00);border-radius:20px;padding:28px 24px;color:#fff;text-align:center;margin-bottom:16px">
    <p style="font-size:36px;margin:0 0 4px">💸</p>
    <h1 style="margin:0;font-size:22px;font-weight:800">Budget Buddy</h1>
    <p style="margin:4px 0 0;opacity:0.85;font-size:13px">Monthly Summary — ${monthName}</p>
  </div>

  <!-- Balance Card -->
  <div style="background:#fff;border-radius:16px;padding:20px;text-align:center;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.04)">
    <p style="margin:0;font-size:11px;color:#6B6B80;text-transform:uppercase;letter-spacing:0.5px">Net Balance</p>
    <p style="margin:6px 0 0;font-size:34px;font-weight:800;color:${balance >= 0 ? '#16A34A' : '#DC2626'}">${balance >= 0 ? '+' : '-'}${fmt(Math.abs(balance))}</p>
  </div>

  <!-- Income / Expense -->
  <div style="display:flex;gap:10px;margin-bottom:12px">
    <div style="flex:1;background:#fff;border-radius:14px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04)">
      <p style="margin:0;font-size:10px;color:#6B6B80">↑ Income</p>
      <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#16A34A">${fmt(totalIncome)}</p>
    </div>
    <div style="flex:1;background:#fff;border-radius:14px;padding:16px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.04)">
      <p style="margin:0;font-size:10px;color:#6B6B80">↓ Spent</p>
      <p style="margin:6px 0 0;font-size:20px;font-weight:700;color:#DC2626">${fmt(totalExpense)}</p>
    </div>
  </div>

  <!-- Budget Progress -->
  <div style="background:#fff;border-radius:14px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.04)">
    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
      <span style="font-size:11px;font-weight:600">Budget</span>
      <span style="font-size:11px;color:#6B6B80">${fmt(totalExpense)} / ${fmt(budget)} (${budgetPct}%)</span>
    </div>
    <div style="height:8px;background:#E5E1D9;border-radius:8px;overflow:hidden">
      <div style="height:100%;border-radius:8px;width:${Math.min(budgetPct, 100)}%;background:${budgetPct > 90 ? '#DC2626' : budgetPct > 70 ? '#F59E0B' : '#16A34A'}"></div>
    </div>
    ${budgetPct > 100 ? `<p style="margin:6px 0 0;font-size:10px;color:#DC2626;font-weight:600">🚨 Over budget by ${fmt(totalExpense - budget)}</p>` : `<p style="margin:6px 0 0;font-size:10px;color:#6B6B80">${fmt(budget - totalExpense)} remaining</p>`}
  </div>

  <!-- Per Person -->
  <div style="display:flex;gap:10px;margin-bottom:12px">
    ${userStats.map(u => `
    <div style="flex:1;background:#fff;border-radius:14px;padding:14px;text-align:center;border-left:3px solid ${u.color};box-shadow:0 2px 8px rgba(0,0,0,0.04)">
      <p style="font-size:20px;margin:0">${u.avatar}</p>
      <p style="margin:4px 0;font-size:12px;font-weight:600">${u.name}</p>
      <p style="margin:0;font-size:14px;font-weight:700;color:#DC2626">${fmt(u.expense)}</p>
      <p style="margin:2px 0 0;font-size:9px;color:#6B6B80">${u.txCount} transactions</p>
    </div>`).join("")}
  </div>

  <!-- Top Categories -->
  ${topCats.length > 0 ? `
  <div style="background:#fff;border-radius:14px;padding:16px;margin-bottom:12px;box-shadow:0 2px 8px rgba(0,0,0,0.04)">
    <p style="margin:0 0 10px;font-size:12px;font-weight:600">Top Spending Categories</p>
    ${topCats.map(([cat, amount]) => {
      const pct = totalExpense > 0 ? Math.round((amount / totalExpense) * 100) : 0;
      return `
      <div style="margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;margin-bottom:3px">
          <span style="font-size:11px">${cat}</span>
          <span style="font-size:11px;font-weight:600">${fmt(amount)} (${pct}%)</span>
        </div>
        <div style="height:4px;background:#E5E1D9;border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:#FF6B35;border-radius:4px"></div>
        </div>
      </div>`;
    }).join("")}
  </div>` : ""}

  <!-- Footer -->
  <div style="text-align:center;padding:16px 0">
    <p style="margin:0;font-size:10px;color:#A0A0B4">Sent by Budget Buddy 💕</p>
    <p style="margin:4px 0 0;font-size:9px;color:#A0A0B4">Pranav & Kesha's shared budget app</p>
  </div>
</div>
</body>
</html>`;

    // Send via Resend
    const sendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendKey}`,
      },
      body: JSON.stringify({
        from: "Budget Buddy <onboarding@resend.dev>",
        to: [email],
        subject: `💸 Budget Summary — ${monthName}`,
        html,
      }),
    });

    const sendData = await sendRes.json();

    if (!sendRes.ok) {
      return res.status(500).json({ error: "Failed to send email", details: sendData });
    }

    return res.status(200).json({ success: true, month: monthName, email, id: sendData.id });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
