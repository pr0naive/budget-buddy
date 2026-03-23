import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

// ─── CONFIG ─────────────────────────────────────────────
const USERS = [
  { id: "pranav", name: "Pranav", avatar: "🧑‍💻", color: "#FF6B35" },
  { id: "kesha", name: "Kesha", avatar: "💃", color: "#E040FB" },
];
const CATEGORIES = {
  income: [
    { name: "Salary", emoji: "💰" }, { name: "Freelance", emoji: "💻" },
    { name: "Gift", emoji: "🎁" }, { name: "Refund", emoji: "🔄" }, { name: "Other Income", emoji: "📥" },
  ],
  expense: [
    { name: "Groceries", emoji: "🛒" }, { name: "Eating Out", emoji: "🍕" },
    { name: "Transport", emoji: "🚌" }, { name: "Shopping", emoji: "🛍️" },
    { name: "Bills", emoji: "📄" }, { name: "Rent", emoji: "🏠" },
    { name: "Entertainment", emoji: "🎬" }, { name: "Health", emoji: "💊" },
    { name: "Education", emoji: "📚" }, { name: "Subscriptions", emoji: "📱" },
    { name: "Gifts", emoji: "🎀" }, { name: "Travel", emoji: "✈️" },
    { name: "Pets", emoji: "🐾" }, { name: "Savings", emoji: "🏦" }, { name: "Other", emoji: "📦" },
  ],
};
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (n) => "£" + Math.abs(n).toFixed(2);
const mk = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const td = () => new Date().toISOString().split("T")[0];

// ─── SUPABASE HELPERS ───────────────────────────────────
async function fetchTransactions() {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) { console.error("Fetch error:", error); return []; }
  return data.map(row => ({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    category: row.category,
    emoji: row.emoji,
    amount: parseFloat(row.amount),
    note: row.note || "",
    date: row.date,
    recurring: row.recurring,
    sg: row.split_group_id,
    stotal: row.split_total ? parseFloat(row.split_total) : null,
  }));
}

async function insertTransaction(tx) {
  const { error } = await supabase.from("transactions").insert({
    user_id: tx.userId,
    type: tx.type,
    category: tx.category,
    emoji: tx.emoji,
    amount: tx.amount,
    note: tx.note,
    date: tx.date,
    recurring: tx.recurring,
    split_group_id: tx.sg || null,
    split_total: tx.stotal || null,
  });
  if (error) console.error("Insert error:", error);
}

async function deleteTransactionById(id) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) console.error("Delete error:", error);
}

async function deleteTransactionsByGroup(groupId) {
  const { error } = await supabase.from("transactions").delete().eq("split_group_id", groupId);
  if (error) console.error("Delete group error:", error);
}

async function getSetting(key, fallback) {
  const { data, error } = await supabase.from("settings").select("value").eq("key", key).single();
  if (error || !data) return fallback;
  return JSON.parse(JSON.stringify(data.value));
}

async function setSetting(key, value) {
  await supabase.from("settings").upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() });
}

// ─── COMPONENTS ─────────────────────────────────────────
function AnimNum({ value }) {
  const [d, setD] = useState(value);
  const r = useRef();
  useEffect(() => {
    let s = d, e = value, st = null;
    const go = (ts) => { if (!st) st = ts; let p = Math.min((ts - st) / 450, 1); p = 1 - Math.pow(1 - p, 3); setD(s + (e - s) * p); if (p < 1) r.current = requestAnimationFrame(go); };
    r.current = requestAnimationFrame(go);
    return () => cancelAnimationFrame(r.current);
  }, [value]);
  return <>£{Math.abs(d).toFixed(2)}</>;
}

function Donut({ data, size = 115 }) {
  if (!data.length) return null;
  const total = data.reduce((s, d) => s + d.value, 0);
  const pal = ["#FF6B35", "#E040FB", "#00BFA5", "#FFB300", "#42A5F5", "#EF5350", "#AB47BC", "#66BB6A", "#FF7043", "#8D6E63"];
  let acc = 0; const cx = size / 2, cy = size / 2, rad = size * 0.37, sw = size * 0.15;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        {data.map((d, i) => {
          const pct = d.value / total, start = acc; acc += pct;
          const a1 = start * 2 * Math.PI - Math.PI / 2, a2 = (start + pct) * 2 * Math.PI - Math.PI / 2;
          return <path key={i} d={`M ${cx + rad * Math.cos(a1)} ${cy + rad * Math.sin(a1)} A ${rad} ${rad} 0 ${pct > 0.5 ? 1 : 0} 1 ${cx + rad * Math.cos(a2)} ${cy + rad * Math.sin(a2)}`}
            fill="none" stroke={pal[i % pal.length]} strokeWidth={sw} strokeLinecap="round"
            style={{ animation: `dd 0.8s ease ${i * 0.08}s both` }} />;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.12, fontWeight: 700, fontFamily: "'Fraunces',serif" }}>{fmt(total)}</span>
        <span style={{ fontSize: size * 0.06, opacity: 0.4 }}>total</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [ready, setReady] = useState(false);
  const [txs, setTxs] = useState([]);
  const [budget, setBudget] = useState(1500);
  const [dark, setDark] = useState(false);
  const [curUser, setCurUser] = useState("pranav");
  const [filter, setFilter] = useState("all");
  const [month, setMonth] = useState(mk(new Date()));
  const [view, setView] = useState("home");
  const [txType, setTxType] = useState("expense");
  const [cat, setCat] = useState(null);
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(td());
  const [recurring, setRecurring] = useState(false);
  const [split, setSplit] = useState("solo");
  const [toast, setToast] = useState(null);
  const [delId, setDelId] = useState(null);
  const [editBgt, setEditBgt] = useState(false);
  const [bgtIn, setBgtIn] = useState("1500");
  const [showSplits, setShowSplits] = useState(false);
  const [saving, setSaving] = useState(false);

  // ── Initial load ──
  useEffect(() => {
    (async () => {
      const [transactions, budgetVal, darkVal] = await Promise.all([
        fetchTransactions(),
        getSetting("monthly_budget", 1500),
        getSetting("dark_mode", false),
      ]);
      setTxs(transactions);
      setBudget(parseFloat(budgetVal) || 1500);
      setBgtIn(String(parseFloat(budgetVal) || 1500));
      setDark(darkVal === true || darkVal === "true");
      setReady(true);
    })();
  }, []);

  // ── Realtime subscription ──
  useEffect(() => {
    const channel = supabase
      .channel("budget-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, async () => {
        // Re-fetch all transactions when anything changes
        const fresh = await fetchTransactions();
        setTxs(fresh);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, async () => {
        const b = await getSetting("monthly_budget", 1500);
        const d = await getSetting("dark_mode", false);
        setBudget(parseFloat(b) || 1500);
        setDark(d === true || d === "true");
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const flash = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2400); };

  // ── Theme ──
  const c = dark ? {
    bg: "#0D0D14", card: "#161622", ca: "#1C1C2A", p: "#FF7A45", pg: "rgba(255,122,69,0.11)",
    inc: "#34D399", ig: "rgba(52,211,153,0.09)", exp: "#F87171", eg: "rgba(248,113,113,0.09)",
    tx: "#EEEEF2", sf: "#8585A0", mu: "#50506A", bd: "#252535", ac: "#E040FB", ag: "rgba(224,64,251,0.09)",
    sh: "0 3px 14px rgba(0,0,0,0.3)", g1: "#FF7A45", g2: "#E65100",
  } : {
    bg: "#F4F1EA", card: "#FFFFFF", ca: "#FFF8F0", p: "#FF6B35", pg: "rgba(255,107,53,0.06)",
    inc: "#16A34A", ig: "rgba(22,163,74,0.06)", exp: "#DC2626", eg: "rgba(220,38,38,0.06)",
    tx: "#1A1A2E", sf: "#6B6B80", mu: "#A0A0B4", bd: "#E5E1D9", ac: "#9C27B0", ag: "rgba(156,39,176,0.06)",
    sh: "0 2px 8px rgba(0,0,0,0.035)", g1: "#FF6B35", g2: "#FF8F00",
  };

  // ── Computed ──
  const mTx = txs.filter(x => x.date.startsWith(month) && (filter === "all" || x.userId === filter));
  const totI = mTx.filter(x => x.type === "income").reduce((s, x) => s + x.amount, 0);
  const totE = mTx.filter(x => x.type === "expense").reduce((s, x) => s + x.amount, 0);
  const bal = totI - totE;
  const bPct = budget > 0 ? Math.min((totE / budget) * 100, 100) : 0;

  const ebc = {};
  mTx.filter(x => x.type === "expense").forEach(x => { ebc[x.category] = (ebc[x.category] || 0) + x.amount; });
  const sExp = Object.entries(ebc).sort((a, b) => b[1] - a[1]);

  const uStats = USERS.map(u => {
    const ut = txs.filter(x => x.date.startsWith(month) && x.userId === u.id);
    return { ...u, exp: ut.filter(x => x.type === "expense").reduce((s, x) => s + x.amount, 0) };
  });

  const splitGrps = {};
  mTx.filter(x => x.sg).forEach(x => { if (!splitGrps[x.sg]) splitGrps[x.sg] = []; splitGrps[x.sg].push(x); });
  const splitKeys = Object.keys(splitGrps);

  const navM = (d) => { const [y, m] = month.split("-").map(Number); setMonth(mk(new Date(y, m - 1 + d))); };
  const [cy, cm] = month.split("-").map(Number);
  const mLabel = `${MO[cm - 1]} ${cy}`;
  const isNow = month === mk(new Date());

  const reset = () => { setCat(null); setAmt(""); setNote(""); setDate(td()); setRecurring(false); setSplit("solo"); };

  const toggleDark = async () => {
    const next = !dark;
    setDark(next);
    await setSetting("dark_mode", next);
  };

  const saveBudget = async (val) => {
    setBudget(val);
    setEditBgt(false);
    await setSetting("monthly_budget", val);
  };

  const addTx = async () => {
    if (!cat || !amt || isNaN(parseFloat(amt)) || parseFloat(amt) <= 0) { flash("Fill in amount & category!", "error"); return; }
    setSaving(true);
    const raw = parseFloat(parseFloat(amt).toFixed(2));
    const base = { type: txType, category: cat.name, emoji: cat.emoji, note: note.trim(), date, recurring };

    if (split === "split") {
      const half = parseFloat((raw / 2).toFixed(2));
      const gid = `s_${Date.now()}`;
      await insertTransaction({ ...base, userId: "pranav", amount: half, sg: gid, stotal: raw });
      await insertTransaction({ ...base, userId: "kesha", amount: half, sg: gid, stotal: raw });
      flash(`Split ${fmt(raw)} equally! 🤝`);
    } else {
      await insertTransaction({ ...base, userId: curUser, amount: raw });
      flash(txType === "income" ? "Income added! 🎉" : "Expense logged! ✅");
    }

    // Re-fetch to get server-generated IDs
    const fresh = await fetchTransactions();
    setTxs(fresh);
    setSaving(false);
    reset();
    setView("home");
  };

  const delTx = async (id) => {
    const tx = txs.find(x => x.id === id);
    if (tx?.sg) {
      await deleteTransactionsByGroup(tx.sg);
    } else {
      await deleteTransactionById(id);
    }
    const fresh = await fetchTransactions();
    setTxs(fresh);
    setDelId(null);
    flash("Deleted", "info");
  };

  const B = { border: "none", borderRadius: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: 600, transition: "all 0.17s ease" };
  const C = { background: c.card, borderRadius: 18, padding: "15px 16px", boxShadow: c.sh, border: `1px solid ${c.bd}` };

  if (!ready) return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#F4F1EA", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", animation: "fi 0.5s ease" }}>
        <p style={{ fontSize: 40, marginBottom: 8 }}>💸</p>
        <p style={{ color: "#888", fontSize: 14 }}>Loading Budget Buddy...</p>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: c.bg, color: c.tx, minHeight: "100vh", maxWidth: 480, margin: "0 auto", position: "relative", transition: "background 0.3s,color 0.3s" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600;9..40,700&family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}html,body{overscroll-behavior:none}
        input:focus,button:focus{outline:none}
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}
        input[type=number]{-moz-appearance:textfield}::-webkit-scrollbar{width:0}
        @keyframes su{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fi{from{opacity:0}to{opacity:1}}
        @keyframes pi{from{opacity:0;transform:scale(0.92)}to{opacity:1;transform:scale(1)}}
        @keyframes sd{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bg{from{width:0}} @keyframes dd{from{stroke-dasharray:0 1000}to{stroke-dasharray:1000 1000}}
        @keyframes gl{0%,100%{box-shadow:0 0 14px rgba(255,107,53,0.12)}50%{box-shadow:0 0 24px rgba(255,107,53,0.3)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .h{transition:all 0.14s ease}.h:hover{transform:translateY(-1px)}.h:active{transform:scale(0.97)}
      `}</style>

      {toast && <div style={{ position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", background: toast.type === "error" ? c.exp : toast.type === "info" ? "#3B82F6" : c.inc, color: "#fff", padding: "9px 18px", borderRadius: 13, fontWeight: 600, fontSize: 12, zIndex: 1000, animation: "sd 0.3s ease", boxShadow: c.sh, maxWidth: "86%" }}>{toast.msg}</div>}

      {/* ═══ HOME ═══ */}
      {view === "home" && (
        <div style={{ padding: "16px 14px 105px", animation: "fi 0.25s" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Budget Buddy</h1>
              <p style={{ color: c.sf, fontSize: 10.5, marginTop: 1 }}>Pranav & Kesha 💕</p>
            </div>
            <button onClick={toggleDark} className="h" style={{ ...B, width: 38, height: 38, borderRadius: 11, background: c.ca, border: `1px solid ${c.bd}`, fontSize: 16 }}>{dark ? "☀️" : "🌙"}</button>
          </div>

          <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
            {[{ id: "all", name: "Together", avatar: "👫", color: c.p }, ...USERS].map(u => (
              <button key={u.id} className="h" onClick={() => setFilter(u.id)} style={{
                ...B, flex: 1, padding: "8px 4px", borderRadius: 12, fontSize: 10.5,
                background: filter === u.id ? (dark ? c.ca : u.color + "10") : c.card,
                border: filter === u.id ? `2px solid ${u.color}` : `1px solid ${c.bd}`,
                color: filter === u.id ? u.color : c.sf,
              }}><span style={{ fontSize: 14, display: "block", marginBottom: 1 }}>{u.avatar}</span>{u.name}</button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <button onClick={() => navM(-1)} className="h" style={{ ...B, width: 30, height: 30, borderRadius: 9, background: c.card, border: `1px solid ${c.bd}`, fontSize: 12, color: c.tx }}>‹</button>
            <span style={{ fontWeight: 600, fontSize: 13.5, minWidth: 80, textAlign: "center" }}>{mLabel}</span>
            <button onClick={() => navM(1)} className="h" style={{ ...B, width: 30, height: 30, borderRadius: 9, background: isNow ? c.bg : c.card, border: `1px solid ${c.bd}`, fontSize: 12, color: isNow ? c.mu : c.tx }} disabled={isNow}>›</button>
          </div>

          <div style={{ background: `linear-gradient(135deg,${c.g1},${c.g2})`, borderRadius: 20, padding: "22px 18px", color: "#fff", boxShadow: `0 7px 24px ${dark ? "rgba(255,107,53,0.16)" : "rgba(255,107,53,0.2)"}`, marginBottom: 10, animation: "su 0.35s" }}>
            <p style={{ fontSize: 10, opacity: 0.8, fontWeight: 500, marginBottom: 2 }}>{filter === "all" ? "Combined Balance" : USERS.find(u => u.id === filter)?.name + "'s Balance"}</p>
            <p style={{ fontFamily: "'Fraunces',serif", fontSize: 32, fontWeight: 800, letterSpacing: -1, marginBottom: 14 }}>{bal < 0 ? "−" : ""}<AnimNum value={Math.abs(bal)} /></p>
            <div style={{ display: "flex", gap: 7 }}>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "8px 9px" }}>
                <p style={{ fontSize: 9, opacity: 0.7, marginBottom: 1 }}>↑ Income</p>
                <p style={{ fontSize: 15, fontWeight: 700 }}><AnimNum value={totI} /></p>
              </div>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "8px 9px" }}>
                <p style={{ fontSize: 9, opacity: 0.7, marginBottom: 1 }}>↓ Spent</p>
                <p style={{ fontSize: 15, fontWeight: 700 }}><AnimNum value={totE} /></p>
              </div>
            </div>
          </div>

          <div style={{ ...C, marginBottom: 10, animation: "su 0.4s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600 }}>Monthly Budget</span>
              {!editBgt ? (
                <button onClick={() => { setEditBgt(true); setBgtIn(String(budget)); }} style={{ ...B, background: "none", fontSize: 10.5, color: c.p, padding: "1px 3px" }}>{fmt(budget)} ✎</button>
              ) : (
                <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
                  <span style={{ fontSize: 11, color: c.sf }}>£</span>
                  <input value={bgtIn} onChange={e => setBgtIn(e.target.value)} type="number" autoFocus style={{ width: 60, border: `2px solid ${c.p}`, borderRadius: 7, padding: "2px 4px", fontSize: 11, background: c.bg, color: c.tx, fontFamily: "'DM Sans',sans-serif" }} />
                  <button onClick={() => { const v = parseFloat(bgtIn); if (v > 0) saveBudget(v); }} style={{ ...B, background: c.p, color: "#fff", padding: "2px 6px", fontSize: 10, borderRadius: 7 }}>✓</button>
                </div>
              )}
            </div>
            <div style={{ height: 6, background: c.bd, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 6, animation: "bg 0.7s ease", width: `${bPct}%`, background: bPct > 90 ? c.exp : bPct > 70 ? "#F59E0B" : c.inc, transition: "width 0.5s,background 0.5s" }} />
            </div>
            <p style={{ fontSize: 9.5, color: c.sf, marginTop: 3 }}>{fmt(totE)} / {fmt(budget)}{bPct >= 100 ? " — Over budget! 🚨" : bPct > 80 ? " — Getting close!" : ` — ${fmt(budget - totE)} left`}</p>
          </div>

          {filter === "all" && (
            <div style={{ display: "flex", gap: 7, marginBottom: 10, animation: "su 0.45s" }}>
              {uStats.map(u => (
                <div key={u.id} style={{ ...C, flex: 1, padding: "11px 10px", textAlign: "center", borderLeft: `3px solid ${u.color}` }}>
                  <span style={{ fontSize: 18 }}>{u.avatar}</span>
                  <p style={{ fontSize: 10.5, fontWeight: 600, marginTop: 2 }}>{u.name}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Fraunces',serif", color: c.exp, marginTop: 2 }}>{fmt(u.exp)}</p>
                  <p style={{ fontSize: 8.5, color: c.sf }}>spent</p>
                </div>
              ))}
            </div>
          )}

          {splitKeys.length > 0 && filter === "all" && (
            <div style={{ ...C, marginBottom: 10, animation: "su 0.48s", borderLeft: `3px solid ${c.ac}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 11.5, fontWeight: 600 }}>🤝 Split Expenses</p>
                  <p style={{ fontSize: 9.5, color: c.sf, marginTop: 1 }}>{splitKeys.length} shared · {fmt(splitKeys.reduce((s, k) => s + (splitGrps[k][0]?.stotal || 0), 0))} total</p>
                </div>
                <button className="h" onClick={() => setShowSplits(!showSplits)} style={{ ...B, background: c.ag, color: c.ac, padding: "5px 10px", borderRadius: 9, fontSize: 10 }}>{showSplits ? "Hide" : "View"}</button>
              </div>
              {showSplits && (
                <div style={{ marginTop: 8, borderTop: `1px solid ${c.bd}`, paddingTop: 8 }}>
                  {splitKeys.map((gid, gi) => { const g = splitGrps[gid]; const f = g[0]; return (
                    <div key={gi} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: gi < splitKeys.length - 1 ? 7 : 0, animation: `su ${0.12 + gi * 0.04}s ease` }}>
                      <span style={{ fontSize: 13, width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: c.eg }}>{f.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, fontWeight: 500 }}>{f.category}</p>
                        <p style={{ fontSize: 8.5, color: c.mu }}>{new Date(f.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{f.note ? ` · ${f.note}` : ""}</p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: c.exp }}>{fmt(f.stotal)}</p>
                        <p style={{ fontSize: 8.5, color: c.sf }}>{fmt(f.amount)} each</p>
                      </div>
                    </div>
                  ); })}
                </div>
              )}
            </div>
          )}

          {sExp.length > 0 && (
            <div style={{ ...C, marginBottom: 10, animation: "su 0.5s" }}>
              <h3 style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 10 }}>Where the money goes</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Donut data={sExp.map(([n, v]) => ({ name: n, value: v }))} size={108} />
                <div style={{ flex: 1 }}>
                  {sExp.slice(0, 6).map(([cat, amt], i) => {
                    const co = CATEGORIES.expense.find(x => x.name === cat);
                    const pal = ["#FF6B35", "#E040FB", "#00BFA5", "#FFB300", "#42A5F5", "#EF5350"];
                    return (<div key={cat} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                      <div style={{ width: 6, height: 6, borderRadius: 3, background: pal[i % pal.length], flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: c.sf, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{co?.emoji} {cat}</span>
                      <span style={{ fontSize: 10, fontWeight: 600 }}>{fmt(amt)}</span>
                    </div>);
                  })}
                </div>
              </div>
            </div>
          )}

          <div style={{ ...C, animation: "su 0.55s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ fontSize: 11.5, fontWeight: 600 }}>Recent</h3>
              {mTx.length > 5 && <button onClick={() => setView("history")} style={{ ...B, background: "none", fontSize: 10, color: c.p, padding: "1px 3px" }}>See all →</button>}
            </div>
            {mTx.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ fontSize: 28, marginBottom: 4 }}>📝</p>
                <p style={{ color: c.sf, fontSize: 11 }}>No transactions yet</p>
                <p style={{ color: c.mu, fontSize: 9, marginTop: 1 }}>Tap + to get started!</p>
              </div>
            ) : (
              mTx.slice(0, 6).map((tx, i) => { const u = USERS.find(u => u.id === tx.userId); return (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: i < Math.min(mTx.length, 6) - 1 ? `1px solid ${c.bd}` : "none", animation: `su ${0.12 + i * 0.04}s ease` }}>
                  <span style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, background: tx.type === "income" ? c.ig : c.eg }}>{tx.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      <p style={{ fontSize: 11.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.category}</p>
                      {tx.sg && <span style={{ fontSize: 7.5, background: c.ag, color: c.ac, padding: "0.5px 3.5px", borderRadius: 4, fontWeight: 600 }}>Split</span>}
                      {tx.recurring && <span style={{ fontSize: 7.5 }}>🔁</span>}
                    </div>
                    <p style={{ fontSize: 8.5, color: c.mu, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u?.avatar} {u?.name} · {new Date(tx.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{tx.note ? ` · ${tx.note}` : ""}</p>
                  </div>
                  <p style={{ fontSize: 12.5, fontWeight: 600, flexShrink: 0, color: tx.type === "income" ? c.inc : c.exp }}>{tx.type === "income" ? "+" : "−"}{fmt(tx.amount)}</p>
                </div>
              ); })
            )}
          </div>
        </div>
      )}

      {/* ═══ ADD ═══ */}
      {view === "add" && (
        <div style={{ padding: "16px 14px 105px", animation: "fi 0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button onClick={() => { setView("home"); reset(); }} className="h" style={{ ...B, background: c.card, border: `1px solid ${c.bd}`, width: 34, height: 34, borderRadius: 10, fontSize: 14 }}>←</button>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 700 }}>New Transaction</h2>
          </div>

          <div style={{ ...C, marginBottom: 8, padding: "11px 13px" }}>
            <p style={{ fontSize: 10.5, fontWeight: 600, marginBottom: 6, color: c.sf }}>Who's adding?</p>
            <div style={{ display: "flex", gap: 6 }}>
              {USERS.map(u => (
                <button key={u.id} className="h" onClick={() => setCurUser(u.id)} style={{
                  ...B, flex: 1, padding: "8px 4px", borderRadius: 11, fontSize: 11,
                  background: curUser === u.id ? (dark ? c.ca : u.color + "10") : "transparent",
                  border: curUser === u.id ? `2px solid ${u.color}` : `1px solid ${c.bd}`,
                  color: curUser === u.id ? u.color : c.sf,
                }}>{u.avatar} {u.name}</button>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", background: c.card, borderRadius: 12, padding: 2.5, border: `1px solid ${c.bd}`, marginBottom: 8 }}>
            {["expense", "income"].map(t => (
              <button key={t} onClick={() => { setTxType(t); setCat(null); setSplit("solo"); }} style={{
                ...B, flex: 1, padding: "9px 0", fontSize: 11.5, borderRadius: 10,
                background: txType === t ? (t === "expense" ? c.exp : c.inc) : "transparent",
                color: txType === t ? "#fff" : c.sf,
              }}>{t === "expense" ? "💸 Expense" : "💰 Income"}</button>
            ))}
          </div>

          <div style={{ ...C, marginBottom: 8, textAlign: "center", padding: "18px 14px" }}>
            <p style={{ fontSize: 9.5, color: c.sf, marginBottom: 4, fontWeight: 500 }}>Amount</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Fraunces',serif", color: c.sf }}>£</span>
              <input value={amt} onChange={e => setAmt(e.target.value)} type="number" placeholder="0.00" inputMode="decimal" step="0.01"
                style={{ fontSize: 36, fontWeight: 800, fontFamily: "'Fraunces',serif", border: "none", background: "transparent", textAlign: "center", color: c.tx, width: "60%" }} />
            </div>
            {txType === "expense" && (
              <div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 7 }}>
                {[{ id: "solo", l: "Just me" }, { id: "split", l: "Split 50/50 🤝" }].map(o => (
                  <button key={o.id} className="h" onClick={() => setSplit(o.id)} style={{
                    ...B, padding: "4px 10px", borderRadius: 8, fontSize: 10.5,
                    background: split === o.id ? c.ag : "transparent",
                    border: split === o.id ? `2px solid ${c.ac}` : `1px solid ${c.bd}`,
                    color: split === o.id ? c.ac : c.sf,
                  }}>{o.l}</button>
                ))}
              </div>
            )}
            {split === "split" && amt && <p style={{ fontSize: 9.5, color: c.ac, marginTop: 4 }}>Each pays {fmt(parseFloat(amt || 0) / 2)}</p>}
          </div>

          <div style={{ ...C, marginBottom: 8 }}>
            <p style={{ fontSize: 10.5, fontWeight: 600, marginBottom: 7 }}>Category</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {CATEGORIES[txType].map(ct => (
                <button key={ct.name} className="h" onClick={() => setCat(ct)} style={{
                  ...B, padding: "5px 10px", fontSize: 10.5, borderRadius: 8,
                  background: cat?.name === ct.name ? (txType === "income" ? c.ig : c.eg) : (dark ? c.ca : c.bd + "80"),
                  color: cat?.name === ct.name ? (txType === "income" ? c.inc : c.exp) : c.sf,
                  border: cat?.name === ct.name ? `2px solid ${txType === "income" ? c.inc : c.exp}` : "2px solid transparent",
                }}>{ct.emoji} {ct.name}</button>
              ))}
            </div>
          </div>

          <div style={{ ...C, marginBottom: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <p style={{ fontSize: 10.5, fontWeight: 600, marginBottom: 3 }}>Note (optional)</p>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Tesco weekly shop"
                style={{ width: "100%", border: `1.5px solid ${c.bd}`, borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontFamily: "'DM Sans',sans-serif", color: c.tx, background: c.bg }}
                onFocus={e => e.target.style.borderColor = c.p} onBlur={e => e.target.style.borderColor = c.bd} />
            </div>
            <div style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 10.5, fontWeight: 600, marginBottom: 3 }}>Date</p>
                <input value={date} onChange={e => setDate(e.target.value)} type="date"
                  style={{ width: "100%", border: `1.5px solid ${c.bd}`, borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontFamily: "'DM Sans',sans-serif", color: c.tx, background: c.bg }} />
              </div>
              <button className="h" onClick={() => setRecurring(!recurring)} style={{
                ...B, padding: "7px 10px", borderRadius: 8, fontSize: 10.5,
                background: recurring ? c.pg : "transparent",
                border: recurring ? `2px solid ${c.p}` : `1.5px solid ${c.bd}`,
                color: recurring ? c.p : c.sf,
              }}>🔁 Recurring</button>
            </div>
          </div>

          <button onClick={addTx} disabled={saving} className="h" style={{
            ...B, width: "100%", padding: "13px 0", fontSize: 13, borderRadius: 14,
            background: saving ? c.mu : `linear-gradient(135deg,${c.g1},${c.g2})`, color: "#fff",
            boxShadow: saving ? "none" : `0 5px 18px ${dark ? "rgba(255,107,53,0.18)" : "rgba(255,107,53,0.25)"}`,
            opacity: saving ? 0.7 : 1,
          }}>
            {saving ? "Saving..." : `Save ${txType === "income" ? "Income 💰" : "Expense 💸"}`}
          </button>
        </div>
      )}

      {/* ═══ HISTORY ═══ */}
      {view === "history" && (
        <div style={{ padding: "16px 14px 105px", animation: "fi 0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button onClick={() => setView("home")} className="h" style={{ ...B, background: c.card, border: `1px solid ${c.bd}`, width: 34, height: 34, borderRadius: 10, fontSize: 14 }}>←</button>
            <div><h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 700 }}>All Transactions</h2>
              <p style={{ fontSize: 9.5, color: c.sf }}>{mLabel} · {mTx.length} items</p></div>
          </div>
          {mTx.length === 0 ? (
            <div style={{ textAlign: "center", padding: 30 }}><p style={{ fontSize: 28, marginBottom: 4 }}>🔍</p><p style={{ color: c.sf, fontSize: 11 }}>Nothing here</p></div>
          ) : (
            <div style={{ ...C, padding: "3px 11px" }}>
              {mTx.map((tx, i) => { const u = USERS.find(u => u.id === tx.userId); return (
                <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: i < mTx.length - 1 ? `1px solid ${c.bd}` : "none", animation: `su ${0.08 + i * 0.03}s ease` }}>
                  <span style={{ width: 32, height: 32, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, background: tx.type === "income" ? c.ig : c.eg }}>{tx.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <p style={{ fontSize: 11, fontWeight: 500 }}>{tx.category}</p>
                      {tx.sg && <span style={{ fontSize: 7, background: c.ag, color: c.ac, padding: "0.5px 3px", borderRadius: 3.5, fontWeight: 600 }}>Split</span>}
                    </div>
                    <p style={{ fontSize: 8.5, color: c.mu, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u?.avatar} {new Date(tx.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{tx.note ? ` · ${tx.note}` : ""}</p>
                  </div>
                  <p style={{ fontSize: 11.5, fontWeight: 600, flexShrink: 0, color: tx.type === "income" ? c.inc : c.exp }}>{tx.type === "income" ? "+" : "−"}{fmt(tx.amount)}</p>
                  <button onClick={() => setDelId(tx.id)} className="h" style={{ ...B, background: "none", fontSize: 12, color: c.mu, padding: "1px 2px" }}>×</button>
                </div>
              ); })}
            </div>
          )}
        </div>
      )}

      {delId && (
        <div style={{ position: "fixed", inset: 0, background: dark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.28)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fi 0.12s" }} onClick={() => setDelId(null)}>
          <div style={{ background: c.card, borderRadius: 18, padding: 22, maxWidth: 260, width: "100%", animation: "pi 0.2s", textAlign: "center", border: `1px solid ${c.bd}` }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 28, marginBottom: 6 }}>🗑️</p>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Delete this?</p>
            {txs.find(x => x.id === delId)?.sg && <p style={{ fontSize: 10, color: c.ac, marginBottom: 2 }}>Deletes both sides of the split</p>}
            <p style={{ fontSize: 10, color: c.sf, marginBottom: 14 }}>Can't be undone</p>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setDelId(null)} className="h" style={{ ...B, flex: 1, padding: "9px 0", background: c.bd, color: c.tx, fontSize: 11, borderRadius: 10 }}>Keep</button>
              <button onClick={() => delTx(delId)} className="h" style={{ ...B, flex: 1, padding: "9px 0", background: c.exp, color: "#fff", fontSize: 11, borderRadius: 10 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div style={{
        position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480,
        background: dark ? "rgba(13,13,20,0.92)" : "rgba(244,241,234,0.92)",
        backdropFilter: "blur(16px)", borderTop: `1px solid ${c.bd}`,
        display: "flex", justifyContent: "space-around", alignItems: "center", padding: "4px 0 8px", zIndex: 100,
      }}>
        <button className="h" onClick={() => setView("home")} style={{ ...B, background: view === "home" ? c.pg : "transparent", padding: "5px 13px", borderRadius: 10, fontSize: 10, color: view === "home" ? c.p : c.mu }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, marginBottom: 0.5 }}>🏠</div>Home</div>
        </button>
        <button onClick={() => { setView("add"); setTxType("expense"); reset(); }} style={{
          ...B, width: 50, height: 50, borderRadius: "50%", background: `linear-gradient(135deg,${c.g1},${c.g2})`,
          color: "#fff", fontSize: 24, transform: "translateY(-8px)",
          boxShadow: `0 4px 14px ${dark ? "rgba(255,107,53,0.22)" : "rgba(255,107,53,0.28)"}`,
          animation: mTx.length === 0 ? "gl 2s ease infinite" : "none",
        }}>+</button>
        <button className="h" onClick={() => setView("history")} style={{ ...B, background: view === "history" ? c.pg : "transparent", padding: "5px 13px", borderRadius: 10, fontSize: 10, color: view === "history" ? c.p : c.mu }}>
          <div style={{ textAlign: "center" }}><div style={{ fontSize: 16, marginBottom: 0.5 }}>📋</div>History</div>
        </button>
      </div>
    </div>
  );
}
