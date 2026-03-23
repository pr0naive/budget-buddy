import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase.js";

// ─── CONFIG ─────────────────────────────────────────────
const USERS = [
  { id: "pranav", name: "Pranav", avatar: "🧑‍💻", color: "#FF6B35" },
  { id: "kesha", name: "Kesha", avatar: "💃", color: "#E040FB" },
];

const DEFAULT_CATEGORIES = {
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

const THEMES = {
  sunset: { name: "Sunset", g1: "#FF6B35", g2: "#FF8F00", accent: "#E040FB" },
  ocean: { name: "Ocean", g1: "#0EA5E9", g2: "#2563EB", accent: "#06B6D4" },
  forest: { name: "Forest", g1: "#16A34A", g2: "#15803D", accent: "#84CC16" },
  berry: { name: "Berry", g1: "#C026D3", g2: "#9333EA", accent: "#F472B6" },
  midnight: { name: "Midnight", g1: "#6366F1", g2: "#4338CA", accent: "#818CF8" },
};

const EMOJI_OPTIONS = ["🍔", "🏋️", "🎮", "☕", "🍺", "💇", "🧹", "🚗", "📦", "🎵", "👶", "💐", "🏥", "📱", "🎓", "✨", "🔧", "🐶", "🎁", "💰"];

const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmt = (n) => "£" + Math.abs(n).toFixed(2);
const mk = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const td = () => new Date().toISOString().split("T")[0];

// ─── SUPABASE ───────────────────────────────────────────
async function fetchTx() {
  const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return []; }
  return data.map(r => ({ id: r.id, userId: r.user_id, type: r.type, category: r.category, emoji: r.emoji, amount: parseFloat(r.amount), note: r.note || "", date: r.date, recurring: r.recurring, sg: r.split_group_id, stotal: r.split_total ? parseFloat(r.split_total) : null, paidBy: r.paid_by || null, receiptUrl: r.receipt_url || null }));
}
async function insertTx(tx) {
  const { error } = await supabase.from("transactions").insert({ user_id: tx.userId, type: tx.type, category: tx.category, emoji: tx.emoji, amount: tx.amount, note: tx.note, date: tx.date, recurring: tx.recurring, split_group_id: tx.sg || null, split_total: tx.stotal || null, paid_by: tx.paidBy || null, receipt_url: tx.receiptUrl || null });
  if (error) console.error(error);
}

// Upload receipt to Supabase Storage
async function uploadReceipt(file) {
  const ext = file.name.split('.').pop();
  const path = `receipts/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
  const { data, error } = await supabase.storage.from("receipts").upload(path, file);
  if (error) { console.error("Upload error:", error); return null; }
  const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
  return urlData?.publicUrl || null;
}
async function deleteTxById(id) { await supabase.from("transactions").delete().eq("id", id); }
async function deleteTxByGroup(gid) { await supabase.from("transactions").delete().eq("split_group_id", gid); }
async function getS(key, fb) {
  try {
    const { data, error } = await supabase.from("settings").select("value").eq("key", key).single();
    if (error || !data) return fb;
    let v = data.value;
    // Unwrap double-stringified JSON (Supabase stores JSONB, we JSON.stringify on save)
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { /* already plain */ } }
    if (typeof v === 'string') { try { v = JSON.parse(v); } catch { /* already plain */ } }
    return v;
  } catch { return fb; }
}
async function setS(key, val) {
  await supabase.from("settings").upsert({ key, value: val, updated_at: new Date().toISOString() });
}

// ─── COMPONENTS ─────────────────────────────────────────
function AnimNum({ value }) {
  const [d, setD] = useState(value); const r = useRef();
  useEffect(() => { let s = d, e = value, st = null; const go = ts => { if (!st) st = ts; let p = Math.min((ts - st) / 450, 1); p = 1 - Math.pow(1 - p, 3); setD(s + (e - s) * p); if (p < 1) r.current = requestAnimationFrame(go); }; r.current = requestAnimationFrame(go); return () => cancelAnimationFrame(r.current); }, [value]);
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
        {data.map((d, i) => { const pct = d.value / total, start = acc; acc += pct; const a1 = start * 2 * Math.PI - Math.PI / 2, a2 = (start + pct) * 2 * Math.PI - Math.PI / 2;
          return <path key={i} d={`M ${cx + rad * Math.cos(a1)} ${cy + rad * Math.sin(a1)} A ${rad} ${rad} 0 ${pct > 0.5 ? 1 : 0} 1 ${cx + rad * Math.cos(a2)} ${cy + rad * Math.sin(a2)}`} fill="none" stroke={pal[i % pal.length]} strokeWidth={sw} strokeLinecap="round" style={{ animation: `dd 0.8s ease ${i * 0.08}s both` }} />;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.12, fontWeight: 700, fontFamily: "'Fraunces',serif" }}>{fmt(total)}</span>
        <span style={{ fontSize: size * 0.06, opacity: 0.4 }}>total</span>
      </div>
    </div>
  );
}

function BarChart({ data, color, maxVal }) {
  if (!data.length) return null;
  const mx = maxVal || Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 100, padding: "0 4px" }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={{ fontSize: 8, fontWeight: 600, opacity: 0.7 }}>{d.value > 0 ? fmt(d.value) : ""}</span>
          <div style={{ width: "100%", maxWidth: 28, borderRadius: 4, background: color, opacity: d.value > 0 ? 0.8 : 0.15, height: `${Math.max((d.value / mx) * 70, 2)}px`, transition: "height 0.5s ease", animation: `bg 0.6s ease ${i * 0.05}s both` }} />
          <span style={{ fontSize: 8, opacity: 0.5 }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
export default function App() {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(true);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);
  const [storedPin, setStoredPin] = useState(null); // null = no pin set yet
  const [settingPin, setSettingPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [txs, setTxs] = useState([]);
  const [budget, setBudget] = useState(1500);
  const [dark, setDark] = useState(false);
  const [theme, setTheme] = useState("sunset");
  const [customCats, setCustomCats] = useState({ income: [], expense: [] });
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
  // Custom categories
  const [newCatName, setNewCatName] = useState("");
  const [newCatEmoji, setNewCatEmoji] = useState("📦");
  const [newCatType, setNewCatType] = useState("expense");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [settleHistory, setSettleHistory] = useState([]);
  // Currency converter
  const [convFrom, setConvFrom] = useState("GBP");
  const [convTo, setConvTo] = useState("EUR");
  const [convAmt, setConvAmt] = useState("");
  const [convResult, setConvResult] = useState(null);
  const [convLoading, setConvLoading] = useState(false);
  const [convRates, setConvRates] = useState(null);
  // Receipt photo
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState(null);
  // Budget alerts
  const [budgetAlert, setBudgetAlert] = useState(null);
  const [alertDismissed, setAlertDismissed] = useState(false);

  // Load
  useEffect(() => { (async () => {
    const [t, b, d, th, cc, sh, pin] = await Promise.all([
      fetchTx(), getS("monthly_budget", 1500), getS("dark_mode", false),
      getS("theme", "sunset"), getS("custom_categories", { income: [], expense: [] }),
      getS("settle_history", []), getS("app_pin", null),
    ]);
    setTxs(t); setBudget(parseFloat(b) || 1500); setBgtIn(String(parseFloat(b) || 1500));
    setDark(d === true || d === "true" || d === true);
    setTheme((typeof th === 'string' && THEMES[th]) ? th : "sunset");
    setCustomCats(cc && typeof cc === 'object' ? cc : { income: [], expense: [] });
    setSettleHistory(Array.isArray(sh) ? sh : []);
    setStoredPin(pin ? String(pin) : null);
    if (!pin) { setLocked(false); setSettingPin(true); } // No PIN set → prompt to create one
    setReady(true);
  })(); }, []);

  // Realtime
  useEffect(() => {
    const ch = supabase.channel("bb-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, async () => { setTxs(await fetchTx()); })
      .on("postgres_changes", { event: "*", schema: "public", table: "settings" }, async () => {
        const b = await getS("monthly_budget", 1500);
        const d = await getS("dark_mode", false);
        setBudget(parseFloat(b) || 1500);
        setDark(d === true || d === "true");
      }).subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const flash = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 2400); };

  // Categories merged
  const allCats = {
    income: [...DEFAULT_CATEGORIES.income, ...(customCats.income || [])],
    expense: [...DEFAULT_CATEGORIES.expense, ...(customCats.expense || [])],
  };

  // Theme colors
  const th = THEMES[theme] || THEMES.sunset;
  const c = dark ? {
    bg: "#0D0D14", card: "#161622", ca: "#1C1C2A", p: th.g1, pg: `${th.g1}18`,
    inc: "#34D399", ig: "rgba(52,211,153,0.09)", exp: "#F87171", eg: "rgba(248,113,113,0.09)",
    tx: "#EEEEF2", sf: "#8585A0", mu: "#50506A", bd: "#252535", ac: th.accent, ag: `${th.accent}18`,
    sh: "0 3px 14px rgba(0,0,0,0.3)", g1: th.g1, g2: th.g2,
  } : {
    bg: "#F4F1EA", card: "#FFFFFF", ca: "#FFF8F0", p: th.g1, pg: `${th.g1}0F`,
    inc: "#16A34A", ig: "rgba(22,163,74,0.06)", exp: "#DC2626", eg: "rgba(220,38,38,0.06)",
    tx: "#1A1A2E", sf: "#6B6B80", mu: "#A0A0B4", bd: "#E5E1D9", ac: th.accent, ag: `${th.accent}0F`,
    sh: "0 2px 8px rgba(0,0,0,0.035)", g1: th.g1, g2: th.g2,
  };

  // Computed
  const mTx = txs.filter(x => x.date.startsWith(month) && (filter === "all" || x.userId === filter));
  const totI = mTx.filter(x => x.type === "income").reduce((s, x) => s + x.amount, 0);
  const totE = mTx.filter(x => x.type === "expense").reduce((s, x) => s + x.amount, 0);
  const bal = totI - totE;
  const bPct = budget > 0 ? Math.min((totE / budget) * 100, 100) : 0;

  const ebc = {}; mTx.filter(x => x.type === "expense").forEach(x => { ebc[x.category] = (ebc[x.category] || 0) + x.amount; });
  const sExp = Object.entries(ebc).sort((a, b) => b[1] - a[1]);

  const uStats = USERS.map(u => {
    const ut = txs.filter(x => x.date.startsWith(month) && x.userId === u.id);
    return { ...u, inc: ut.filter(x => x.type === "income").reduce((s, x) => s + x.amount, 0), exp: ut.filter(x => x.type === "expense").reduce((s, x) => s + x.amount, 0) };
  });

  const splitGrps = {}; mTx.filter(x => x.sg).forEach(x => { if (!splitGrps[x.sg]) splitGrps[x.sg] = []; splitGrps[x.sg].push(x); });
  const splitKeys = Object.keys(splitGrps);

  // Splitwise-style settle up: track who PAID for split expenses
  // When Pranav pays £40 and splits it → Kesha owes Pranav £20
  // When Kesha pays £100 and splits it → Pranav owes Kesha £50
  // Net balance = what's owed between them
  const allMonthTx = txs.filter(x => x.date.startsWith(month));
  const splitTxsAll = allMonthTx.filter(x => x.sg && x.paidBy);

  // Group by split group and calculate debts
  const splitDebts = {}; // groupId -> { paidBy, total, half }
  splitTxsAll.forEach(tx => {
    if (!splitDebts[tx.sg]) splitDebts[tx.sg] = { paidBy: tx.paidBy, total: tx.stotal || tx.amount * 2, half: tx.amount, emoji: tx.emoji, category: tx.category, note: tx.note, date: tx.date };
  });

  // Calculate running balance: positive = Kesha owes Pranav, negative = Pranav owes Kesha
  let runningBalance = 0;
  const debtItems = [];
  Object.entries(splitDebts).forEach(([gid, d]) => {
    const otherPerson = d.paidBy === "pranav" ? "kesha" : "pranav";
    if (d.paidBy === "pranav") {
      runningBalance += d.half; // Kesha owes Pranav
    } else {
      runningBalance -= d.half; // Pranav owes Kesha
    }
    debtItems.push({ ...d, gid, owes: otherPerson, amount: d.half });
  });

  // Subtract any settled amounts for this month
  const monthSettled = settleHistory.filter(s => s.month === month);
  monthSettled.forEach(s => {
    if (s.from === "kesha") runningBalance -= s.amount; // kesha paid pranav back
    else runningBalance += s.amount; // pranav paid kesha back
  });

  const settleAmount = Math.abs(runningBalance);
  const whoOwes = runningBalance > 0 ? "kesha" : "pranav";
  const whoIsOwed = runningBalance > 0 ? "pranav" : "kesha";

  // Monthly report data (last 6 months)
  const reportData = () => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i);
      const key = mk(d);
      const label = MO[d.getMonth()];
      const mTxAll = txs.filter(x => x.date.startsWith(key));
      months.push({
        key, label,
        income: mTxAll.filter(x => x.type === "income").reduce((s, x) => s + x.amount, 0),
        expense: mTxAll.filter(x => x.type === "expense").reduce((s, x) => s + x.amount, 0),
      });
    }
    return months;
  };

  const navM = d => { const [y, m] = month.split("-").map(Number); setMonth(mk(new Date(y, m - 1 + d))); };
  const [cy, cm] = month.split("-").map(Number);
  const mLabel = `${MO[cm - 1]} ${cy}`;
  const isNow = month === mk(new Date());
  const reset = () => { setCat(null); setAmt(""); setNote(""); setDate(td()); setRecurring(false); setSplit("solo"); setReceiptFile(null); setReceiptPreview(null); };

  const toggleDark = async () => { setDark(!dark); await setS("dark_mode", !dark); };
  const saveBudget = async v => { setBudget(v); setEditBgt(false); await setS("monthly_budget", v); };
  const changeTheme = async t => { setTheme(t); await setS("theme", t); };

  // PIN functions
  const verifyPin = (input) => {
    const check = input || pinInput;
    if (String(check) === String(storedPin)) { setLocked(false); setPinInput(""); setPinError(false); }
    else { setPinError(true); setPinInput(""); setTimeout(() => setPinError(false), 1500); }
  };

  const saveNewPin = async () => {
    if (newPin.length < 4) { flash("PIN must be at least 4 digits", "error"); return; }
    if (newPin !== confirmPin) { flash("PINs don't match!", "error"); return; }
    const pinStr = String(newPin);
    await setS("app_pin", pinStr);
    setStoredPin(pinStr); setSettingPin(false); setNewPin(""); setConfirmPin("");
    setLocked(false);
    flash("PIN set! 🔐");
  };

  const changePin = () => { setSettingPin(true); setNewPin(""); setConfirmPin(""); };

  const removePin = async () => {
    await setS("app_pin", null);
    setStoredPin(null); flash("PIN removed");
  };

  // Currency converter
  const CURRENCIES = [
    { code: "GBP", name: "British Pound", flag: "🇬🇧" },
    { code: "EUR", name: "Euro", flag: "🇪🇺" },
    { code: "USD", name: "US Dollar", flag: "🇺🇸" },
    { code: "INR", name: "Indian Rupee", flag: "🇮🇳" },
    { code: "JPY", name: "Japanese Yen", flag: "🇯🇵" },
    { code: "AUD", name: "Australian Dollar", flag: "🇦🇺" },
    { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦" },
    { code: "CHF", name: "Swiss Franc", flag: "🇨🇭" },
    { code: "CNY", name: "Chinese Yuan", flag: "🇨🇳" },
    { code: "SEK", name: "Swedish Krona", flag: "🇸🇪" },
    { code: "TRY", name: "Turkish Lira", flag: "🇹🇷" },
    { code: "THB", name: "Thai Baht", flag: "🇹🇭" },
    { code: "AED", name: "UAE Dirham", flag: "🇦🇪" },
    { code: "PLN", name: "Polish Złoty", flag: "🇵🇱" },
    { code: "CZK", name: "Czech Koruna", flag: "🇨🇿" },
    { code: "HUF", name: "Hungarian Forint", flag: "🇭🇺" },
  ];

  const fetchRates = async (base) => {
    try {
      setConvLoading(true);
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
      const data = await res.json();
      setConvRates(data.rates);
      setConvLoading(false);
      return data.rates;
    } catch (e) {
      console.error(e);
      setConvLoading(false);
      flash("Couldn't fetch rates. Check your connection.", "error");
      return null;
    }
  };

  const convert = async () => {
    if (!convAmt || isNaN(parseFloat(convAmt))) return;
    let rates = convRates;
    if (!rates) rates = await fetchRates(convFrom);
    if (!rates) return;
    const rate = rates[convTo];
    if (rate) setConvResult({ amount: parseFloat(convAmt) * rate, rate });
  };

  const swapCurrencies = () => {
    setConvFrom(convTo); setConvTo(convFrom); setConvResult(null); setConvRates(null);
  };

  // Receipt handling
  const handleReceiptSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { flash("Photo too large (max 5MB)", "error"); return; }
    setReceiptFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setReceiptPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const clearReceipt = () => { setReceiptFile(null); setReceiptPreview(null); };

  const scanReceipt = async () => {
    if (!receiptPreview) return;
    setOcrLoading(true);
    try {
      const base64 = receiptPreview.split(",")[1];
      const mediaType = receiptPreview.split(";")[0].split(":")[1];
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
              { type: "text", text: 'Read this receipt. Return ONLY a JSON object with these fields: {"total": number, "store": "string or null", "date": "YYYY-MM-DD or null", "items": "brief summary of items or null"}. If you cannot read the total, return {"total": null}. No other text.' }
            ]
          }]
        })
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || "";
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      if (parsed.total && parsed.total > 0) {
        setAmt(String(parsed.total));
        if (parsed.store) setNote(parsed.store + (parsed.items ? ` — ${parsed.items}` : ""));
        if (parsed.date) setDate(parsed.date);
        flash(`Read ${fmt(parsed.total)} from receipt! 📸`);
      } else {
        flash("Couldn't read the total — fill it in manually", "info");
      }
    } catch (e) {
      console.error("OCR error:", e);
      flash("Couldn't scan receipt — fill in manually", "info");
    }
    setOcrLoading(false);
  };

  // Budget alerts
  useEffect(() => {
    if (!ready || alertDismissed) return;
    const currentMonthKey = mk(new Date());
    const currentMonthTxs = txs.filter(x => x.date.startsWith(currentMonthKey) && x.type === "expense");
    const currentSpent = currentMonthTxs.reduce((s, x) => s + x.amount, 0);
    const pct = budget > 0 ? (currentSpent / budget) * 100 : 0;

    if (pct >= 100) setBudgetAlert({ level: "over", pct: Math.round(pct), msg: `You've exceeded your £${budget} budget by ${fmt(currentSpent - budget)}!`, color: "#DC2626", emoji: "🚨" });
    else if (pct >= 90) setBudgetAlert({ level: "critical", pct: Math.round(pct), msg: `${Math.round(pct)}% of your budget used — only ${fmt(budget - currentSpent)} left!`, color: "#DC2626", emoji: "⚠️" });
    else if (pct >= 75) setBudgetAlert({ level: "warning", pct: Math.round(pct), msg: `${Math.round(pct)}% spent — ${fmt(budget - currentSpent)} remaining this month`, color: "#F59E0B", emoji: "📊" });
    else if (pct >= 50) setBudgetAlert({ level: "info", pct: Math.round(pct), msg: `Halfway through your budget — ${fmt(budget - currentSpent)} left`, color: "#3B82F6", emoji: "💡" });
    else setBudgetAlert(null);
  }, [txs, budget, ready, alertDismissed]);

  const addCustomCat = async () => {
    if (!newCatName.trim()) { flash("Enter a category name!", "error"); return; }
    const updated = { ...customCats };
    if (!updated[newCatType]) updated[newCatType] = [];
    if ([...DEFAULT_CATEGORIES[newCatType], ...updated[newCatType]].find(c => c.name.toLowerCase() === newCatName.trim().toLowerCase())) {
      flash("Category already exists!", "error"); return;
    }
    updated[newCatType].push({ name: newCatName.trim(), emoji: newCatEmoji, custom: true });
    setCustomCats(updated); await setS("custom_categories", updated);
    setNewCatName(""); flash(`Added "${newCatName.trim()}"! ✨`);
  };

  const removeCustomCat = async (type, name) => {
    const updated = { ...customCats };
    updated[type] = updated[type].filter(c => c.name !== name);
    setCustomCats(updated); await setS("custom_categories", updated);
    flash("Category removed");
  };

  const settleUp = async () => {
    const entry = { date: new Date().toISOString(), month: month, amount: settleAmount, from: whoOwes, to: whoIsOwed };
    const updated = [...settleHistory, entry];
    setSettleHistory(updated); await setS("settle_history", updated);
    flash("Settled up! 🎉");
  };

  const exportCSV = () => {
    const headers = ["Date", "Who", "Type", "Category", "Amount", "Note", "Split"];
    const rows = mTx.map(tx => [tx.date, USERS.find(u => u.id === tx.userId)?.name || tx.userId, tx.type, tx.category, tx.amount.toFixed(2), `"${tx.note}"`, tx.sg ? "Yes" : "No"]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `budget-buddy-${month}.csv`; a.click();
    URL.revokeObjectURL(url); flash("CSV downloaded! 📥");
  };

  const addTx = async () => {
    if (!cat || !amt || isNaN(parseFloat(amt)) || parseFloat(amt) <= 0) { flash("Fill in amount & category!", "error"); return; }
    setSaving(true);
    const raw = parseFloat(parseFloat(amt).toFixed(2));

    // Upload receipt if present
    let receiptUrl = null;
    if (receiptFile) {
      receiptUrl = await uploadReceipt(receiptFile);
      if (!receiptUrl) flash("Receipt upload failed, saving without it", "info");
    }

    const base = { type: txType, category: cat.name, emoji: cat.emoji, note: note.trim(), date, recurring, receiptUrl };
    if (split === "split") {
      const half = parseFloat((raw / 2).toFixed(2)); const gid = `s_${Date.now()}`;
      await insertTx({ ...base, userId: "pranav", amount: half, sg: gid, stotal: raw, paidBy: curUser });
      await insertTx({ ...base, userId: "kesha", amount: half, sg: gid, stotal: raw, paidBy: curUser });
      const payer = USERS.find(u => u.id === curUser)?.name;
      const other = USERS.find(u => u.id !== curUser)?.name;
      flash(`${payer} paid ${fmt(raw)}, ${other} owes ${fmt(half)} 🤝`);
    } else {
      await insertTx({ ...base, userId: curUser, amount: raw });
      flash(txType === "income" ? "Income added! 🎉" : "Expense logged! ✅");
    }
    setTxs(await fetchTx()); setSaving(false); reset(); setView("home");
  };

  const delTx = async id => {
    const tx = txs.find(x => x.id === id);
    if (tx?.sg) await deleteTxByGroup(tx.sg); else await deleteTxById(id);
    setTxs(await fetchTx()); setDelId(null); flash("Deleted", "info");
  };

  const B = { border: "none", borderRadius: 13, cursor: "pointer", fontFamily: "'DM Sans',sans-serif", fontWeight: 600, transition: "all 0.17s ease" };
  const C = { background: c.card, borderRadius: 18, padding: "15px 16px", boxShadow: c.sh, border: `1px solid ${c.bd}` };

  if (!ready) return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: "#F4F1EA", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", animation: "fi 0.5s" }}><p style={{ fontSize: 40, marginBottom: 8 }}>💸</p><p style={{ color: "#888", fontSize: 14 }}>Loading Budget Buddy...</p></div>
    </div>
  );

  // PIN Lock Screen
  if (locked && storedPin) return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: `linear-gradient(135deg, ${THEMES[theme]?.g1 || '#FF6B35'}, ${THEMES[theme]?.g2 || '#FF8F00'})`, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&family=Fraunces:opsz,wght@9..144,700;9..144,800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}input:focus{outline:none}
        @keyframes fi{from{opacity:0}to{opacity:1}}
        @keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8px)}50%{transform:translateX(8px)}75%{transform:translateX(-4px)}}
        @keyframes popIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
      `}</style>
      <div style={{ textAlign: "center", animation: "popIn 0.4s ease", maxWidth: 320, width: "100%" }}>
        <p style={{ fontSize: 48, marginBottom: 12 }}>🔐</p>
        <h1 style={{ fontFamily: "'Fraunces',serif", fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Budget Buddy</h1>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginBottom: 28 }}>Enter your PIN to continue</p>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 20, animation: pinError ? "shake 0.4s ease" : "none" }}>
          {[0, 1, 2, 3].map(i => (
            <div key={i} style={{ width: 16, height: 16, borderRadius: "50%", background: pinInput.length > i ? "#fff" : "rgba(255,255,255,0.3)", transition: "background 0.15s ease" }} />
          ))}
        </div>
        {pinError && <p style={{ color: "#FEE2E2", fontSize: 12, marginBottom: 12, fontWeight: 600 }}>Wrong PIN, try again</p>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, maxWidth: 240, margin: "0 auto" }}>
          {[1,2,3,4,5,6,7,8,9,null,0,'⌫'].map((n, i) => (
            n === null ? <div key={i} /> :
            <button key={i} onClick={() => {
              if (n === '⌫') { setPinInput(p => p.slice(0, -1)); }
              else if (pinInput.length < 4) {
                const next = pinInput + String(n);
                setPinInput(next);
                if (next.length === 4) { setTimeout(() => verifyPin(next), 150); }
              }
            }} style={{ width: "100%", aspectRatio: "1", borderRadius: 16, border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", fontSize: 22, fontWeight: 600, fontFamily: "'DM Sans',sans-serif", cursor: "pointer", transition: "all 0.12s ease", backdropFilter: "blur(10px)" }}>
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // PIN Setup Screen (first time)
  if (settingPin) return (
    <div style={{ fontFamily: "'DM Sans',sans-serif", background: c.bg, color: c.tx, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700&family=Fraunces:opsz,wght@9..144,700;9..144,800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}input:focus{outline:none}
        @keyframes fi{from{opacity:0}to{opacity:1}}
        @keyframes su{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <div style={{ textAlign: "center", animation: "fi 0.4s ease", maxWidth: 320, width: "100%" }}>
        <p style={{ fontSize: 40, marginBottom: 10 }}>🔐</p>
        <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{storedPin ? "Change PIN" : "Set a PIN"}</h2>
        <p style={{ color: c.sf, fontSize: 11, marginBottom: 24 }}>{storedPin ? "Choose a new 4+ digit PIN" : "Protect your budget with a PIN (4+ digits)"}</p>

        <div style={{ marginBottom: 14, animation: "su 0.3s ease" }}>
          <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 5, color: c.sf }}>New PIN</p>
          <input value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))} type="password" inputMode="numeric" maxLength={8} placeholder="••••"
            style={{ width: "100%", maxWidth: 200, border: `2px solid ${c.bd}`, borderRadius: 12, padding: "12px 16px", fontSize: 22, fontFamily: "'DM Sans',sans-serif", color: c.tx, background: c.card, textAlign: "center", letterSpacing: 8 }} />
        </div>

        <div style={{ marginBottom: 20, animation: "su 0.4s ease" }}>
          <p style={{ fontSize: 11, fontWeight: 600, marginBottom: 5, color: c.sf }}>Confirm PIN</p>
          <input value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, ""))} type="password" inputMode="numeric" maxLength={8} placeholder="••••"
            style={{ width: "100%", maxWidth: 200, border: `2px solid ${newPin && confirmPin && newPin !== confirmPin ? c.exp : c.bd}`, borderRadius: 12, padding: "12px 16px", fontSize: 22, fontFamily: "'DM Sans',sans-serif", color: c.tx, background: c.card, textAlign: "center", letterSpacing: 8 }} />
          {newPin && confirmPin && newPin !== confirmPin && <p style={{ fontSize: 10, color: c.exp, marginTop: 4 }}>PINs don't match</p>}
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          {storedPin && <button onClick={() => setSettingPin(false)} style={{ border: "none", borderRadius: 12, padding: "11px 20px", fontSize: 13, fontWeight: 600, background: c.bd, color: c.tx, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Cancel</button>}
          <button onClick={saveNewPin} style={{ border: "none", borderRadius: 12, padding: "11px 24px", fontSize: 13, fontWeight: 600, background: `linear-gradient(135deg,${c.g1},${c.g2})`, color: "#fff", cursor: "pointer", fontFamily: "'DM Sans',sans-serif", boxShadow: `0 4px 12px ${c.g1}44` }}>
            {storedPin ? "Update PIN" : "Set PIN"}
          </button>
        </div>
        {!storedPin && <button onClick={() => { setSettingPin(false); setLocked(false); }} style={{ border: "none", background: "none", color: c.mu, fontSize: 11, marginTop: 14, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>Skip for now →</button>}
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
        @keyframes bg{from{width:0}}@keyframes dd{from{stroke-dasharray:0 1000}to{stroke-dasharray:1000 1000}}
        @keyframes gl{0%,100%{box-shadow:0 0 14px ${c.g1}20}50%{box-shadow:0 0 24px ${c.g1}55}}
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
            <div style={{ display: "flex", gap: 5 }}>
              <button onClick={() => setView("settings")} className="h" style={{ ...B, width: 38, height: 38, borderRadius: 11, background: c.ca, border: `1px solid ${c.bd}`, fontSize: 16 }}>⚙️</button>
              <button onClick={toggleDark} className="h" style={{ ...B, width: 38, height: 38, borderRadius: 11, background: c.ca, border: `1px solid ${c.bd}`, fontSize: 16 }}>{dark ? "☀️" : "🌙"}</button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 5, marginBottom: 12 }}>
            {[{ id: "all", name: "Together", avatar: "👫", color: c.p }, ...USERS].map(u => (
              <button key={u.id} className="h" onClick={() => setFilter(u.id)} style={{ ...B, flex: 1, padding: "8px 4px", borderRadius: 12, fontSize: 10.5, background: filter === u.id ? (dark ? c.ca : u.color + "10") : c.card, border: filter === u.id ? `2px solid ${u.color}` : `1px solid ${c.bd}`, color: filter === u.id ? u.color : c.sf }}>
                <span style={{ fontSize: 14, display: "block", marginBottom: 1 }}>{u.avatar}</span>{u.name}
              </button>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <button onClick={() => navM(-1)} className="h" style={{ ...B, width: 30, height: 30, borderRadius: 9, background: c.card, border: `1px solid ${c.bd}`, fontSize: 12, color: c.tx }}>‹</button>
            <span style={{ fontWeight: 600, fontSize: 13.5, minWidth: 80, textAlign: "center" }}>{mLabel}</span>
            <button onClick={() => navM(1)} className="h" style={{ ...B, width: 30, height: 30, borderRadius: 9, background: isNow ? c.bg : c.card, border: `1px solid ${c.bd}`, fontSize: 12, color: isNow ? c.mu : c.tx }} disabled={isNow}>›</button>
          </div>

          {/* Budget alert banner */}
          {budgetAlert && !alertDismissed && isNow && (
            <div style={{ ...C, marginBottom: 10, animation: "su 0.2s", borderLeft: `3px solid ${budgetAlert.color}`, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{budgetAlert.emoji}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: budgetAlert.color }}>{budgetAlert.level === "over" ? "Over Budget!" : budgetAlert.level === "critical" ? "Budget Critical" : budgetAlert.level === "warning" ? "Budget Warning" : "Budget Update"}</p>
                <p style={{ fontSize: 10, color: c.sf, marginTop: 1 }}>{budgetAlert.msg}</p>
              </div>
              <button onClick={() => setAlertDismissed(true)} style={{ ...B, background: "none", fontSize: 14, color: c.mu, padding: "2px 4px", flexShrink: 0 }}>×</button>
            </div>
          )}

          {/* Balance hero */}
          <div style={{ background: `linear-gradient(135deg,${c.g1},${c.g2})`, borderRadius: 20, padding: "22px 18px", color: "#fff", boxShadow: `0 7px 24px ${c.g1}33`, marginBottom: 10, animation: "su 0.35s" }}>
            <p style={{ fontSize: 10, opacity: 0.8, fontWeight: 500, marginBottom: 2 }}>{filter === "all" ? "Combined Balance" : USERS.find(u => u.id === filter)?.name + "'s Balance"}</p>
            <p style={{ fontFamily: "'Fraunces',serif", fontSize: 32, fontWeight: 800, letterSpacing: -1, marginBottom: 14 }}>{bal < 0 ? "−" : ""}<AnimNum value={Math.abs(bal)} /></p>
            <div style={{ display: "flex", gap: 7 }}>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "8px 9px" }}><p style={{ fontSize: 9, opacity: 0.7, marginBottom: 1 }}>↑ Income</p><p style={{ fontSize: 15, fontWeight: 700 }}><AnimNum value={totI} /></p></div>
              <div style={{ flex: 1, background: "rgba(255,255,255,0.15)", borderRadius: 12, padding: "8px 9px" }}><p style={{ fontSize: 9, opacity: 0.7, marginBottom: 1 }}>↓ Spent</p><p style={{ fontSize: 15, fontWeight: 700 }}><AnimNum value={totE} /></p></div>
            </div>
          </div>

          {/* Budget bar */}
          <div style={{ ...C, marginBottom: 10, animation: "su 0.4s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 11.5, fontWeight: 600 }}>Monthly Budget</span>
              {!editBgt ? (<button onClick={() => { setEditBgt(true); setBgtIn(String(budget)); }} style={{ ...B, background: "none", fontSize: 10.5, color: c.p, padding: "1px 3px" }}>{fmt(budget)} ✎</button>
              ) : (<div style={{ display: "flex", gap: 3, alignItems: "center" }}><span style={{ fontSize: 11, color: c.sf }}>£</span><input value={bgtIn} onChange={e => setBgtIn(e.target.value)} type="number" autoFocus style={{ width: 60, border: `2px solid ${c.p}`, borderRadius: 7, padding: "2px 4px", fontSize: 11, background: c.bg, color: c.tx, fontFamily: "'DM Sans',sans-serif" }} /><button onClick={() => { const v = parseFloat(bgtIn); if (v > 0) saveBudget(v); }} style={{ ...B, background: c.p, color: "#fff", padding: "2px 6px", fontSize: 10, borderRadius: 7 }}>✓</button></div>)}
            </div>
            <div style={{ height: 6, background: c.bd, borderRadius: 6, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 6, animation: "bg 0.7s ease", width: `${bPct}%`, background: bPct > 90 ? c.exp : bPct > 70 ? "#F59E0B" : c.inc, transition: "width 0.5s,background 0.5s" }} />
            </div>
            <p style={{ fontSize: 9.5, color: c.sf, marginTop: 3 }}>{fmt(totE)} / {fmt(budget)}{bPct >= 100 ? " — Over budget! 🚨" : bPct > 80 ? " — Getting close!" : ` — ${fmt(budget - totE)} left`}</p>
          </div>

          {/* Per-user + settle up */}
          {filter === "all" && (
            <>
              <div style={{ display: "flex", gap: 7, marginBottom: 10, animation: "su 0.45s" }}>
                {uStats.map(u => (<div key={u.id} style={{ ...C, flex: 1, padding: "11px 10px", textAlign: "center", borderLeft: `3px solid ${u.color}` }}>
                  <span style={{ fontSize: 18 }}>{u.avatar}</span><p style={{ fontSize: 10.5, fontWeight: 600, marginTop: 2 }}>{u.name}</p>
                  <p style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Fraunces',serif", color: c.exp, marginTop: 2 }}>{fmt(u.exp)}</p><p style={{ fontSize: 8.5, color: c.sf }}>spent</p>
                </div>))}
              </div>

              {/* Settle up card - Splitwise style */}
              {(settleAmount > 0.01 || debtItems.length > 0) && (
                <div style={{ ...C, marginBottom: 10, animation: "su 0.47s", borderLeft: `3px solid #F59E0B`, padding: "13px 15px" }}>
                  {settleAmount > 0.01 ? (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: debtItems.length > 0 ? 10 : 0 }}>
                      <div>
                        <p style={{ fontSize: 11.5, fontWeight: 600 }}>⚖️ Settle Up</p>
                        <p style={{ fontSize: 14, fontWeight: 700, color: "#F59E0B", marginTop: 3 }}>
                          {USERS.find(u => u.id === whoOwes)?.name} owes {USERS.find(u => u.id === whoIsOwed)?.name}
                        </p>
                        <p style={{ fontFamily: "'Fraunces',serif", fontSize: 22, fontWeight: 800, marginTop: 2 }}>{fmt(settleAmount)}</p>
                      </div>
                      <button className="h" onClick={settleUp} style={{ ...B, background: "#F59E0B", color: "#fff", padding: "9px 14px", borderRadius: 10, fontSize: 11 }}>Settle Up</button>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "4px 0" }}>
                      <p style={{ fontSize: 11.5, fontWeight: 600 }}>✅ All settled!</p>
                      <p style={{ fontSize: 9.5, color: c.sf, marginTop: 2 }}>No one owes anything this month</p>
                    </div>
                  )}

                  {/* Individual debt breakdown */}
                  {debtItems.length > 0 && (
                    <div style={{ borderTop: `1px solid ${c.bd}`, paddingTop: 8, marginTop: settleAmount > 0.01 ? 0 : 8 }}>
                      <p style={{ fontSize: 9.5, color: c.sf, marginBottom: 6 }}>Breakdown:</p>
                      {debtItems.slice(-5).reverse().map((d, i) => {
                        const payer = USERS.find(u => u.id === d.paidBy);
                        const ower = USERS.find(u => u.id === d.owes);
                        return (
                          <div key={d.gid} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, animation: `su ${0.1 + i * 0.04}s ease` }}>
                            <span style={{ fontSize: 12, width: 24, height: 24, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", background: c.eg }}>{d.emoji}</span>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 10, fontWeight: 500 }}>
                                <span style={{ color: payer?.color }}>{payer?.name}</span>
                                <span style={{ color: c.mu }}> paid </span>
                                <span style={{ fontWeight: 600 }}>{fmt(d.total)}</span>
                                <span style={{ color: c.mu }}> for {d.category}</span>
                              </p>
                              <p style={{ fontSize: 8.5, color: c.mu }}>
                                {ower?.name} owes {fmt(d.amount)} · {new Date(d.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Split summary */}
          {splitKeys.length > 0 && filter === "all" && (
            <div style={{ ...C, marginBottom: 10, animation: "su 0.48s", borderLeft: `3px solid ${c.ac}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><p style={{ fontSize: 11.5, fontWeight: 600 }}>🤝 Split Expenses</p><p style={{ fontSize: 9.5, color: c.sf, marginTop: 1 }}>{splitKeys.length} shared · {fmt(splitKeys.reduce((s, k) => s + (splitGrps[k][0]?.stotal || 0), 0))} total</p></div>
                <button className="h" onClick={() => setShowSplits(!showSplits)} style={{ ...B, background: c.ag, color: c.ac, padding: "5px 10px", borderRadius: 9, fontSize: 10 }}>{showSplits ? "Hide" : "View"}</button>
              </div>
              {showSplits && (<div style={{ marginTop: 8, borderTop: `1px solid ${c.bd}`, paddingTop: 8 }}>
                {splitKeys.map((gid, gi) => { const f = splitGrps[gid][0]; return (
                  <div key={gi} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: gi < splitKeys.length - 1 ? 7 : 0 }}>
                    <span style={{ fontSize: 13, width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: c.eg }}>{f.emoji}</span>
                    <div style={{ flex: 1 }}><p style={{ fontSize: 11, fontWeight: 500 }}>{f.category}</p><p style={{ fontSize: 8.5, color: c.mu }}>{new Date(f.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{f.note ? ` · ${f.note}` : ""}</p></div>
                    <div style={{ textAlign: "right" }}><p style={{ fontSize: 11, fontWeight: 600, color: c.exp }}>{fmt(f.stotal)}</p><p style={{ fontSize: 8.5, color: c.sf }}>{fmt(f.amount)} each</p></div>
                  </div>); })}
              </div>)}
            </div>
          )}

          {/* Donut */}
          {sExp.length > 0 && (<div style={{ ...C, marginBottom: 10, animation: "su 0.5s" }}>
            <h3 style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 10 }}>Where the money goes</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Donut data={sExp.map(([n, v]) => ({ name: n, value: v }))} size={108} />
              <div style={{ flex: 1 }}>{sExp.slice(0, 6).map(([ct, am], i) => { const co = allCats.expense.find(x => x.name === ct); const pal = ["#FF6B35", "#E040FB", "#00BFA5", "#FFB300", "#42A5F5", "#EF5350"]; return (<div key={ct} style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}><div style={{ width: 6, height: 6, borderRadius: 3, background: pal[i % pal.length], flexShrink: 0 }} /><span style={{ fontSize: 10, color: c.sf, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{co?.emoji} {ct}</span><span style={{ fontSize: 10, fontWeight: 600 }}>{fmt(am)}</span></div>); })}</div>
            </div>
          </div>)}

          {/* Quick actions */}
          <div style={{ display: "flex", gap: 6, marginBottom: 10, animation: "su 0.52s" }}>
            <button className="h" onClick={() => setView("report")} style={{ ...B, ...C, flex: 1, padding: "10px 8px", textAlign: "center", fontSize: 10.5 }}>📊 Reports</button>
            <button className="h" onClick={() => { setView("convert"); setConvResult(null); setConvRates(null); }} style={{ ...B, ...C, flex: 1, padding: "10px 8px", textAlign: "center", fontSize: 10.5 }}>💱 Convert</button>
            <button className="h" onClick={exportCSV} style={{ ...B, ...C, flex: 1, padding: "10px 8px", textAlign: "center", fontSize: 10.5 }}>📥 CSV</button>
          </div>

          {/* Recent */}
          <div style={{ ...C, animation: "su 0.55s" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ fontSize: 11.5, fontWeight: 600 }}>Recent</h3>
              {mTx.length > 5 && <button onClick={() => setView("history")} style={{ ...B, background: "none", fontSize: 10, color: c.p, padding: "1px 3px" }}>See all →</button>}
            </div>
            {mTx.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}><p style={{ fontSize: 28, marginBottom: 4 }}>📝</p><p style={{ color: c.sf, fontSize: 11 }}>No transactions yet</p><p style={{ color: c.mu, fontSize: 9, marginTop: 1 }}>Tap + to get started!</p></div>
            ) : (mTx.slice(0, 6).map((tx, i) => { const u = USERS.find(u => u.id === tx.userId); return (
              <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: i < Math.min(mTx.length, 6) - 1 ? `1px solid ${c.bd}` : "none", animation: `su ${0.12 + i * 0.04}s ease` }}>
                <span style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, background: tx.type === "income" ? c.ig : c.eg }}>{tx.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}><p style={{ fontSize: 11.5, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.category}</p>
                    {tx.sg && <span style={{ fontSize: 7.5, background: c.ag, color: c.ac, padding: "0.5px 3.5px", borderRadius: 4, fontWeight: 600 }}>Split</span>}
                    {tx.recurring && <span style={{ fontSize: 7.5 }}>🔁</span>}
                    {tx.receiptUrl && <span onClick={(e) => { e.stopPropagation(); setViewingReceipt(tx.receiptUrl); }} style={{ fontSize: 7.5, cursor: "pointer" }}>📷</span>}</div>
                  <p style={{ fontSize: 8.5, color: c.mu, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u?.avatar} {u?.name} · {new Date(tx.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{tx.note ? ` · ${tx.note}` : ""}</p>
                </div>
                <p style={{ fontSize: 12.5, fontWeight: 600, flexShrink: 0, color: tx.type === "income" ? c.inc : c.exp }}>{tx.type === "income" ? "+" : "−"}{fmt(tx.amount)}</p>
              </div>); }))}
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
            <div style={{ display: "flex", gap: 6 }}>{USERS.map(u => (<button key={u.id} className="h" onClick={() => setCurUser(u.id)} style={{ ...B, flex: 1, padding: "8px 4px", borderRadius: 11, fontSize: 11, background: curUser === u.id ? (dark ? c.ca : u.color + "10") : "transparent", border: curUser === u.id ? `2px solid ${u.color}` : `1px solid ${c.bd}`, color: curUser === u.id ? u.color : c.sf }}>{u.avatar} {u.name}</button>))}</div>
          </div>

          <div style={{ display: "flex", background: c.card, borderRadius: 12, padding: 2.5, border: `1px solid ${c.bd}`, marginBottom: 8 }}>
            {["expense", "income"].map(t => (<button key={t} onClick={() => { setTxType(t); setCat(null); setSplit("solo"); }} style={{ ...B, flex: 1, padding: "9px 0", fontSize: 11.5, borderRadius: 10, background: txType === t ? (t === "expense" ? c.exp : c.inc) : "transparent", color: txType === t ? "#fff" : c.sf }}>{t === "expense" ? "💸 Expense" : "💰 Income"}</button>))}
          </div>

          <div style={{ ...C, marginBottom: 8, textAlign: "center", padding: "18px 14px" }}>
            <p style={{ fontSize: 9.5, color: c.sf, marginBottom: 4, fontWeight: 500 }}>Amount</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Fraunces',serif", color: c.sf }}>£</span>
              <input value={amt} onChange={e => setAmt(e.target.value)} type="number" placeholder="0.00" inputMode="decimal" step="0.01" style={{ fontSize: 36, fontWeight: 800, fontFamily: "'Fraunces',serif", border: "none", background: "transparent", textAlign: "center", color: c.tx, width: "60%" }} />
            </div>
            {txType === "expense" && (<div style={{ display: "flex", justifyContent: "center", gap: 5, marginTop: 7 }}>
              {[{ id: "solo", l: "Just me" }, { id: "split", l: "Split 50/50 🤝" }].map(o => (<button key={o.id} className="h" onClick={() => setSplit(o.id)} style={{ ...B, padding: "4px 10px", borderRadius: 8, fontSize: 10.5, background: split === o.id ? c.ag : "transparent", border: split === o.id ? `2px solid ${c.ac}` : `1px solid ${c.bd}`, color: split === o.id ? c.ac : c.sf }}>{o.l}</button>))}
            </div>)}
            {split === "split" && amt && <p style={{ fontSize: 9.5, color: c.ac, marginTop: 4 }}>Each pays {fmt(parseFloat(amt || 0) / 2)}</p>}
          </div>

          <div style={{ ...C, marginBottom: 8 }}>
            <p style={{ fontSize: 10.5, fontWeight: 600, marginBottom: 7 }}>Category</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {allCats[txType].map(ct => (<button key={ct.name} className="h" onClick={() => setCat(ct)} style={{ ...B, padding: "5px 10px", fontSize: 10.5, borderRadius: 8, background: cat?.name === ct.name ? (txType === "income" ? c.ig : c.eg) : (dark ? c.ca : c.bd + "80"), color: cat?.name === ct.name ? (txType === "income" ? c.inc : c.exp) : c.sf, border: cat?.name === ct.name ? `2px solid ${txType === "income" ? c.inc : c.exp}` : "2px solid transparent" }}>{ct.emoji} {ct.name}</button>))}
            </div>
          </div>

          <div style={{ ...C, marginBottom: 12 }}>
            <div style={{ marginBottom: 8 }}><p style={{ fontSize: 10.5, fontWeight: 600, marginBottom: 3 }}>Note (optional)</p>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Tesco weekly shop" style={{ width: "100%", border: `1.5px solid ${c.bd}`, borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontFamily: "'DM Sans',sans-serif", color: c.tx, background: c.bg }} onFocus={e => e.target.style.borderColor = c.p} onBlur={e => e.target.style.borderColor = c.bd} /></div>
            <div style={{ display: "flex", gap: 7, alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}><p style={{ fontSize: 10.5, fontWeight: 600, marginBottom: 3 }}>Date</p>
                <input value={date} onChange={e => setDate(e.target.value)} type="date" style={{ width: "100%", border: `1.5px solid ${c.bd}`, borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontFamily: "'DM Sans',sans-serif", color: c.tx, background: c.bg }} /></div>
              <button className="h" onClick={() => setRecurring(!recurring)} style={{ ...B, padding: "7px 10px", borderRadius: 8, fontSize: 10.5, background: recurring ? c.pg : "transparent", border: recurring ? `2px solid ${c.p}` : `1.5px solid ${c.bd}`, color: recurring ? c.p : c.sf }}>🔁 Recurring</button>
            </div>
          </div>

          {/* Receipt photo */}
          {txType === "expense" && (
            <div style={{ ...C, marginBottom: 12 }}>
              <p style={{ fontSize: 10.5, fontWeight: 600, marginBottom: 7 }}>📸 Receipt (optional)</p>
              {!receiptPreview ? (
                <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "14px 0", border: `2px dashed ${c.bd}`, borderRadius: 10, cursor: "pointer", color: c.sf, fontSize: 11 }}>
                  <span style={{ fontSize: 18 }}>📷</span> Tap to add a receipt photo
                  <input type="file" accept="image/*" capture="environment" onChange={handleReceiptSelect} style={{ display: "none" }} />
                </label>
              ) : (
                <div>
                  <div style={{ position: "relative", marginBottom: 8 }}>
                    <img src={receiptPreview} alt="Receipt" style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 10, border: `1px solid ${c.bd}` }} />
                    <button onClick={clearReceipt} style={{ position: "absolute", top: 6, right: 6, ...B, width: 26, height: 26, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                  </div>
                  <button onClick={scanReceipt} disabled={ocrLoading} className="h" style={{
                    ...B, width: "100%", padding: "9px 0", fontSize: 11.5, borderRadius: 10,
                    background: ocrLoading ? c.mu : c.ag, color: ocrLoading ? "#fff" : c.ac,
                    border: `1.5px solid ${ocrLoading ? c.mu : c.ac}`, opacity: ocrLoading ? 0.7 : 1,
                  }}>
                    {ocrLoading ? "🔍 Scanning receipt..." : "🤖 Auto-read amount from receipt"}
                  </button>
                </div>
              )}
            </div>
          )}

          <button onClick={addTx} disabled={saving} className="h" style={{ ...B, width: "100%", padding: "13px 0", fontSize: 13, borderRadius: 14, background: saving ? c.mu : `linear-gradient(135deg,${c.g1},${c.g2})`, color: "#fff", boxShadow: saving ? "none" : `0 5px 18px ${c.g1}40`, opacity: saving ? 0.7 : 1 }}>
            {saving ? "Saving..." : `Save ${txType === "income" ? "Income 💰" : "Expense 💸"}`}
          </button>
        </div>
      )}

      {/* ═══ HISTORY ═══ */}
      {view === "history" && (
        <div style={{ padding: "16px 14px 105px", animation: "fi 0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setView("home")} className="h" style={{ ...B, background: c.card, border: `1px solid ${c.bd}`, width: 34, height: 34, borderRadius: 10, fontSize: 14 }}>←</button>
              <div><h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 700 }}>All Transactions</h2><p style={{ fontSize: 9.5, color: c.sf }}>{mLabel} · {mTx.length} items</p></div>
            </div>
            <button className="h" onClick={exportCSV} style={{ ...B, background: c.pg, color: c.p, padding: "6px 10px", borderRadius: 9, fontSize: 10 }}>📥 CSV</button>
          </div>
          {mTx.length === 0 ? (<div style={{ textAlign: "center", padding: 30 }}><p style={{ fontSize: 28, marginBottom: 4 }}>🔍</p><p style={{ color: c.sf, fontSize: 11 }}>Nothing here</p></div>
          ) : (<div style={{ ...C, padding: "3px 11px" }}>
            {mTx.map((tx, i) => { const u = USERS.find(u => u.id === tx.userId); return (
              <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: i < mTx.length - 1 ? `1px solid ${c.bd}` : "none", animation: `su ${0.08 + i * 0.03}s ease` }}>
                <span style={{ width: 32, height: 32, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0, background: tx.type === "income" ? c.ig : c.eg }}>{tx.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}><p style={{ fontSize: 11, fontWeight: 500 }}>{tx.category}</p>{tx.sg && <span style={{ fontSize: 7, background: c.ag, color: c.ac, padding: "0.5px 3px", borderRadius: 3.5, fontWeight: 600 }}>Split</span>}</div>
                  <p style={{ fontSize: 8.5, color: c.mu, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u?.avatar} {new Date(tx.date).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}{tx.note ? ` · ${tx.note}` : ""}</p>
                </div>
                <p style={{ fontSize: 11.5, fontWeight: 600, flexShrink: 0, color: tx.type === "income" ? c.inc : c.exp }}>{tx.type === "income" ? "+" : "−"}{fmt(tx.amount)}</p>
                <button onClick={() => setDelId(tx.id)} className="h" style={{ ...B, background: "none", fontSize: 12, color: c.mu, padding: "1px 2px" }}>×</button>
              </div>); })}
          </div>)}
        </div>
      )}

      {/* ═══ REPORTS ═══ */}
      {view === "report" && (() => {
        const rd = reportData();
        const maxI = Math.max(...rd.map(r => r.income), 1);
        const maxE = Math.max(...rd.map(r => r.expense), 1);
        const maxAll = Math.max(maxI, maxE);
        const totalI6 = rd.reduce((s, r) => s + r.income, 0);
        const totalE6 = rd.reduce((s, r) => s + r.expense, 0);
        const avgE = totalE6 / 6;
        return (
          <div style={{ padding: "16px 14px 105px", animation: "fi 0.2s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <button onClick={() => setView("home")} className="h" style={{ ...B, background: c.card, border: `1px solid ${c.bd}`, width: 34, height: 34, borderRadius: 10, fontSize: 14 }}>←</button>
              <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 700 }}>Monthly Reports</h2>
            </div>

            <div style={{ ...C, marginBottom: 10, animation: "su 0.3s" }}>
              <h3 style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 8 }}>📈 Income (Last 6 Months)</h3>
              <BarChart data={rd.map(r => ({ label: r.label, value: r.income }))} color={c.inc} maxVal={maxAll} />
            </div>

            <div style={{ ...C, marginBottom: 10, animation: "su 0.4s" }}>
              <h3 style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 8 }}>📉 Expenses (Last 6 Months)</h3>
              <BarChart data={rd.map(r => ({ label: r.label, value: r.expense }))} color={c.exp} maxVal={maxAll} />
            </div>

            <div style={{ display: "flex", gap: 7, marginBottom: 10, animation: "su 0.5s" }}>
              <div style={{ ...C, flex: 1, textAlign: "center", padding: "14px 10px" }}>
                <p style={{ fontSize: 9, color: c.sf }}>6-Month Income</p>
                <p style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Fraunces',serif", color: c.inc, marginTop: 4 }}>{fmt(totalI6)}</p>
              </div>
              <div style={{ ...C, flex: 1, textAlign: "center", padding: "14px 10px" }}>
                <p style={{ fontSize: 9, color: c.sf }}>6-Month Expenses</p>
                <p style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Fraunces',serif", color: c.exp, marginTop: 4 }}>{fmt(totalE6)}</p>
              </div>
            </div>

            <div style={{ ...C, animation: "su 0.55s", padding: "14px 16px" }}>
              <p style={{ fontSize: 9, color: c.sf }}>Average Monthly Spend</p>
              <p style={{ fontSize: 20, fontWeight: 700, fontFamily: "'Fraunces',serif", marginTop: 4 }}>{fmt(avgE)}</p>
              <p style={{ fontSize: 9.5, color: c.sf, marginTop: 4 }}>{totE > avgE ? `This month you're spending ${fmt(totE - avgE)} more than average 📈` : `This month you're ${fmt(avgE - totE)} under your average — nice! 🎉`}</p>
            </div>
          </div>
        );
      })()}

      {/* ═══ SETTINGS ═══ */}
      {view === "settings" && (
        <div style={{ padding: "16px 14px 105px", animation: "fi 0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button onClick={() => setView("home")} className="h" style={{ ...B, background: c.card, border: `1px solid ${c.bd}`, width: 34, height: 34, borderRadius: 10, fontSize: 14 }}>←</button>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 700 }}>Settings</h2>
          </div>

          {/* Theme picker */}
          <div style={{ ...C, marginBottom: 10, animation: "su 0.3s" }}>
            <p style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 8 }}>🎨 Colour Theme</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {Object.entries(THEMES).map(([key, t]) => (
                <button key={key} className="h" onClick={() => changeTheme(key)} style={{
                  ...B, padding: "8px 12px", borderRadius: 10, fontSize: 10.5,
                  background: `linear-gradient(135deg, ${t.g1}, ${t.g2})`, color: "#fff",
                  border: theme === key ? "3px solid #fff" : "3px solid transparent",
                  boxShadow: theme === key ? `0 0 0 2px ${t.g1}` : "none",
                }}>{t.name}</button>
              ))}
            </div>
          </div>

          {/* Custom categories */}
          <div style={{ ...C, marginBottom: 10, animation: "su 0.4s" }}>
            <p style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 8 }}>🏷️ Custom Categories</p>

            <div style={{ display: "flex", gap: 4, marginBottom: 8 }}>
              {["expense", "income"].map(t => (
                <button key={t} onClick={() => setNewCatType(t)} style={{ ...B, flex: 1, padding: "6px 0", fontSize: 10.5, borderRadius: 8, background: newCatType === t ? c.pg : "transparent", border: newCatType === t ? `2px solid ${c.p}` : `1px solid ${c.bd}`, color: newCatType === t ? c.p : c.sf }}>{t === "expense" ? "Expense" : "Income"}</button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} style={{ ...B, width: 38, height: 38, borderRadius: 10, background: c.ca, border: `1px solid ${c.bd}`, fontSize: 16 }}>{newCatEmoji}</button>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Category name..." style={{ flex: 1, border: `1.5px solid ${c.bd}`, borderRadius: 8, padding: "7px 10px", fontSize: 11.5, fontFamily: "'DM Sans',sans-serif", color: c.tx, background: c.bg }} onFocus={e => e.target.style.borderColor = c.p} onBlur={e => e.target.style.borderColor = c.bd} />
              <button className="h" onClick={addCustomCat} style={{ ...B, background: c.p, color: "#fff", padding: "7px 12px", borderRadius: 8, fontSize: 11 }}>Add</button>
            </div>

            {showEmojiPicker && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8, padding: 8, background: c.ca, borderRadius: 10, border: `1px solid ${c.bd}` }}>
                {EMOJI_OPTIONS.map(e => (
                  <button key={e} onClick={() => { setNewCatEmoji(e); setShowEmojiPicker(false); }} style={{ ...B, width: 32, height: 32, borderRadius: 8, background: newCatEmoji === e ? c.pg : "transparent", border: newCatEmoji === e ? `2px solid ${c.p}` : "none", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>{e}</button>
                ))}
              </div>
            )}

            {/* List custom cats */}
            {(customCats[newCatType] || []).length > 0 && (
              <div style={{ borderTop: `1px solid ${c.bd}`, paddingTop: 8 }}>
                <p style={{ fontSize: 9.5, color: c.sf, marginBottom: 6 }}>Your custom {newCatType} categories:</p>
                {customCats[newCatType].map(cc => (
                  <div key={cc.name} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 0" }}>
                    <span style={{ fontSize: 11 }}>{cc.emoji} {cc.name}</span>
                    <button onClick={() => removeCustomCat(newCatType, cc.name)} style={{ ...B, background: "none", fontSize: 11, color: c.exp, padding: "2px 6px" }}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PIN management */}
          <div style={{ ...C, marginBottom: 10, animation: "su 0.45s" }}>
            <p style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 8 }}>🔐 PIN Lock</p>
            {storedPin ? (
              <div>
                <p style={{ fontSize: 10, color: c.sf, marginBottom: 8 }}>Your app is protected with a PIN</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="h" onClick={changePin} style={{ ...B, flex: 1, padding: "8px 0", background: c.pg, color: c.p, fontSize: 10.5, borderRadius: 8 }}>Change PIN</button>
                  <button className="h" onClick={removePin} style={{ ...B, flex: 1, padding: "8px 0", background: c.eg, color: c.exp, fontSize: 10.5, borderRadius: 8 }}>Remove PIN</button>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ fontSize: 10, color: c.sf, marginBottom: 8 }}>No PIN set — anyone with the link can access your budget</p>
                <button className="h" onClick={() => { setSettingPin(true); setNewPin(""); setConfirmPin(""); }} style={{ ...B, width: "100%", padding: "8px 0", background: c.pg, color: c.p, fontSize: 10.5, borderRadius: 8 }}>Set a PIN</button>
              </div>
            )}
          </div>

          {/* Settle history */}
          {settleHistory.length > 0 && (
            <div style={{ ...C, animation: "su 0.5s" }}>
              <p style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 8 }}>📋 Settle Up History</p>
              {settleHistory.slice(-5).reverse().map((s, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: i < Math.min(settleHistory.length, 5) - 1 ? `1px solid ${c.bd}` : "none" }}>
                  <span style={{ fontSize: 10, color: c.sf }}>{new Date(s.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span style={{ fontSize: 10 }}>{USERS.find(u => u.id === s.from)?.avatar} → {USERS.find(u => u.id === s.to)?.avatar} {fmt(s.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ CURRENCY CONVERTER ═══ */}
      {view === "convert" && (
        <div style={{ padding: "16px 14px 105px", animation: "fi 0.2s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <button onClick={() => setView("home")} className="h" style={{ ...B, background: c.card, border: `1px solid ${c.bd}`, width: 34, height: 34, borderRadius: 10, fontSize: 14 }}>←</button>
            <h2 style={{ fontFamily: "'Fraunces',serif", fontSize: 18, fontWeight: 700 }}>💱 Currency Converter</h2>
          </div>

          <div style={{ ...C, marginBottom: 10, animation: "su 0.3s", textAlign: "center", padding: "20px 16px" }}>
            <p style={{ fontSize: 9.5, color: c.sf, marginBottom: 6, fontWeight: 500 }}>Amount</p>
            <input value={convAmt} onChange={e => { setConvAmt(e.target.value); setConvResult(null); }} type="number" placeholder="100" inputMode="decimal" step="0.01"
              style={{ fontSize: 34, fontWeight: 800, fontFamily: "'Fraunces',serif", border: "none", background: "transparent", textAlign: "center", color: c.tx, width: "80%" }} />
          </div>

          <div style={{ ...C, marginBottom: 10, animation: "su 0.35s" }}>
            <p style={{ fontSize: 10.5, fontWeight: 600, marginBottom: 8 }}>From</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {CURRENCIES.map(cur => (
                <button key={cur.code} className="h" onClick={() => { setConvFrom(cur.code); setConvResult(null); setConvRates(null); }} style={{
                  ...B, padding: "5px 10px", fontSize: 10.5, borderRadius: 8,
                  background: convFrom === cur.code ? c.pg : (dark ? c.ca : c.bd + "80"),
                  color: convFrom === cur.code ? c.p : c.sf,
                  border: convFrom === cur.code ? `2px solid ${c.p}` : "2px solid transparent",
                }}>{cur.flag} {cur.code}</button>
              ))}
            </div>
          </div>

          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <button className="h" onClick={swapCurrencies} style={{ ...B, width: 40, height: 40, borderRadius: "50%", background: c.card, border: `1px solid ${c.bd}`, fontSize: 16 }}>🔄</button>
          </div>

          <div style={{ ...C, marginBottom: 12, animation: "su 0.4s" }}>
            <p style={{ fontSize: 10.5, fontWeight: 600, marginBottom: 8 }}>To</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {CURRENCIES.map(cur => (
                <button key={cur.code} className="h" onClick={() => { setConvTo(cur.code); setConvResult(null); }} style={{
                  ...B, padding: "5px 10px", fontSize: 10.5, borderRadius: 8,
                  background: convTo === cur.code ? c.pg : (dark ? c.ca : c.bd + "80"),
                  color: convTo === cur.code ? c.p : c.sf,
                  border: convTo === cur.code ? `2px solid ${c.p}` : "2px solid transparent",
                }}>{cur.flag} {cur.code}</button>
              ))}
            </div>
          </div>

          <button onClick={convert} disabled={convLoading || !convAmt} className="h" style={{
            ...B, width: "100%", padding: "13px 0", fontSize: 13, borderRadius: 14,
            background: convLoading || !convAmt ? c.mu : `linear-gradient(135deg,${c.g1},${c.g2})`, color: "#fff",
            boxShadow: convLoading ? "none" : `0 5px 18px ${c.g1}40`, opacity: convLoading ? 0.7 : 1, marginBottom: 12,
          }}>{convLoading ? "Converting..." : "Convert"}</button>

          {convResult && (
            <div style={{ ...C, animation: "su 0.3s", textAlign: "center", padding: "20px 16px", borderLeft: `3px solid ${c.inc}` }}>
              <p style={{ fontSize: 10, color: c.sf, marginBottom: 4 }}>
                {CURRENCIES.find(c => c.code === convFrom)?.flag} {parseFloat(convAmt).toFixed(2)} {convFrom} =
              </p>
              <p style={{ fontFamily: "'Fraunces',serif", fontSize: 30, fontWeight: 800, color: c.inc }}>
                {CURRENCIES.find(c => c.code === convTo)?.flag} {convResult.amount.toFixed(2)} {convTo}
              </p>
              <p style={{ fontSize: 9, color: c.mu, marginTop: 6 }}>Rate: 1 {convFrom} = {convResult.rate.toFixed(4)} {convTo}</p>
            </div>
          )}
        </div>
      )}

      {/* Receipt viewer modal */}
      {viewingReceipt && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fi 0.15s" }} onClick={() => setViewingReceipt(null)}>
          <div style={{ maxWidth: 360, width: "100%", animation: "pi 0.25s" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button onClick={() => setViewingReceipt(null)} style={{ ...B, width: 32, height: 32, borderRadius: "50%", background: "rgba(255,255,255,0.2)", color: "#fff", fontSize: 16 }}>×</button>
            </div>
            <img src={viewingReceipt} alt="Receipt" style={{ width: "100%", borderRadius: 14, boxShadow: "0 8px 30px rgba(0,0,0,0.3)" }} />
          </div>
        </div>
      )}

      {/* Delete modal */}
      {delId && (
        <div style={{ position: "fixed", inset: 0, background: dark ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.28)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, animation: "fi 0.12s" }} onClick={() => setDelId(null)}>
          <div style={{ background: c.card, borderRadius: 18, padding: 22, maxWidth: 260, width: "100%", animation: "pi 0.2s", textAlign: "center", border: `1px solid ${c.bd}` }} onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 28, marginBottom: 6 }}>🗑️</p><p style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Delete this?</p>
            {txs.find(x => x.id === delId)?.sg && <p style={{ fontSize: 10, color: c.ac, marginBottom: 2 }}>Deletes both sides of the split</p>}
            <p style={{ fontSize: 10, color: c.sf, marginBottom: 14 }}>Can't be undone</p>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setDelId(null)} className="h" style={{ ...B, flex: 1, padding: "9px 0", background: c.bd, color: c.tx, fontSize: 11, borderRadius: 10 }}>Keep</button>
              <button onClick={() => delTx(delId)} className="h" style={{ ...B, flex: 1, padding: "9px 0", background: c.exp, color: "#fff", fontSize: 11, borderRadius: 10 }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: dark ? "rgba(13,13,20,0.92)" : "rgba(244,241,234,0.92)", backdropFilter: "blur(16px)", borderTop: `1px solid ${c.bd}`, display: "flex", justifyContent: "space-around", alignItems: "center", padding: "4px 0 8px", zIndex: 100 }}>
        <button className="h" onClick={() => setView("home")} style={{ ...B, background: view === "home" ? c.pg : "transparent", padding: "5px 13px", borderRadius: 10, fontSize: 10, color: view === "home" ? c.p : c.mu }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 16, marginBottom: 0.5 }}>🏠</div>Home</div></button>
        <button onClick={() => { setView("add"); setTxType("expense"); reset(); }} style={{ ...B, width: 50, height: 50, borderRadius: "50%", background: `linear-gradient(135deg,${c.g1},${c.g2})`, color: "#fff", fontSize: 24, transform: "translateY(-8px)", boxShadow: `0 4px 14px ${c.g1}44`, animation: mTx.length === 0 ? "gl 2s ease infinite" : "none" }}>+</button>
        <button className="h" onClick={() => setView("history")} style={{ ...B, background: view === "history" ? c.pg : "transparent", padding: "5px 13px", borderRadius: 10, fontSize: 10, color: view === "history" ? c.p : c.mu }}><div style={{ textAlign: "center" }}><div style={{ fontSize: 16, marginBottom: 0.5 }}>📋</div>History</div></button>
      </div>
    </div>
  );
}
