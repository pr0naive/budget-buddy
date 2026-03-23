# Budget Buddy — Setup Guide

### Your personal budget app for Pranav & Kesha
### Total cost: £0 | Time: ~30 minutes | No coding experience needed

---

## What You're Building

A real app that lives on both your phones (iPhone + Android). When Pranav logs an expense, Kesha sees it instantly on her phone — and vice versa. It looks and feels like a native app, not a website.

**Tech stack (all free):**
- **Supabase** — your database (stores all transactions, syncs between phones)
- **Vercel** — hosts the app (makes it accessible via a URL)
- **GitHub** — stores the code (connects to Vercel for auto-deploy)

---

## STEP 1: Create a GitHub Account (5 min)

1. Go to **github.com** and click **Sign Up**
2. Use your email, pick a username, create a password
3. Verify your email
4. Once logged in, click the **+** icon (top right) → **New repository**
5. Name it: `budget-buddy`
6. Keep it **Public** (free tier requirement for Vercel)
7. Check **"Add a README file"**
8. Click **Create repository**

---

## STEP 2: Upload the Project Files (5 min)

1. In your new repo, click **"Add file"** → **"Upload files"**
2. Drag and drop ALL of these files from the project folder:
   - `package.json`
   - `vite.config.js`
   - `index.html`
   - `.gitignore`
3. Click **"Commit changes"**

Now create the folders. Click **"Add file"** → **"Create new file"**:

4. Type `public/manifest.json` as the filename, paste the content from the project's `public/manifest.json`
5. Click **"Commit changes"**
6. Repeat for:
   - `public/icon-192.png` (upload via "Upload files" into the public folder)
   - `public/icon-512.png` (same)
   - `src/main.jsx`
   - `src/supabase.js`
   - `src/App.jsx`

**Tip:** You can also install GitHub Desktop (free) to drag the entire folder at once — much easier than uploading file by file.

---

## STEP 3: Set Up Supabase (10 min)

This is your free database that syncs data between both phones.

1. Go to **supabase.com** and click **Start your project** (sign in with GitHub)
2. Click **New Project**
3. Name: `budget-buddy`
4. Set a database password (save this somewhere — you won't need it daily but keep it safe)
5. Region: Pick **London** (closest to you)
6. Click **Create new project** — wait ~2 minutes for it to set up

### Run the Database Setup

7. In your Supabase dashboard, click **SQL Editor** in the left sidebar
8. Click **New Query**
9. Open the `supabase-setup.sql` file from the project
10. Copy the ENTIRE contents and paste it into the SQL editor
11. Click **Run** (the green play button)
12. You should see "Success. No rows returned" — that's perfect!

### Get Your Keys

13. Go to **Settings** → **API** (in the left sidebar)
14. Copy these two values (you'll need them in the next step):
    - **Project URL** — looks like `https://abcdefg.supabase.co`
    - **anon public key** — a long string starting with `eyJ...`

---

## STEP 4: Deploy on Vercel (5 min)

1. Go to **vercel.com** and click **Sign Up** → **Continue with GitHub**
2. Authorize Vercel to access your GitHub
3. Click **"Add New..."** → **"Project"**
4. Find `budget-buddy` in your repo list and click **Import**
5. Under **Environment Variables**, add these two:

   | Key | Value |
   |-----|-------|
   | `VITE_SUPABASE_URL` | Your Project URL from Step 3 |
   | `VITE_SUPABASE_ANON_KEY` | Your anon public key from Step 3 |

6. Click **Deploy**
7. Wait 1-2 minutes — Vercel will build and deploy your app
8. You'll get a URL like `budget-buddy-abc123.vercel.app`

**That's your app! It's live!**

---

## STEP 5: Install on Both Phones (2 min)

### On Pranav's iPhone:
1. Open **Safari** (must be Safari, not Chrome)
2. Go to your Vercel URL
3. Tap the **Share** button (square with arrow)
4. Scroll down and tap **"Add to Home Screen"**
5. Tap **Add**
6. Budget Buddy now appears as an app icon!

### On Kesha's Android:
1. Open **Chrome**
2. Go to your Vercel URL
3. Tap the **three dots** menu (top right)
4. Tap **"Add to Home screen"** or **"Install app"**
5. Tap **Install**
6. Budget Buddy now appears as an app icon!

---

## STEP 6: Test It! (1 min)

1. Open the app on Pranav's phone
2. Add an expense (e.g., £25 Groceries, split 50/50)
3. Open the app on Kesha's phone
4. The expense should appear within a few seconds!

If it doesn't show up immediately, pull down to refresh the page.

---

## How It Works Day-to-Day

- **Open the app** from your home screen (feels like a native app)
- **Tap +** to add income or expenses
- **Choose who's adding** — Pranav or Kesha
- **Split 50/50** for shared expenses (rent, groceries, bills)
- **Filter by person** to see individual spending
- **Dark mode** — tap the moon icon

Changes sync automatically between both phones via Supabase's realtime feature.

---

## Troubleshooting

**App won't load:**
- Check that your environment variables in Vercel are correct (no extra spaces)
- Go to Vercel dashboard → your project → Settings → Environment Variables → verify both are set

**Data not syncing:**
- Make sure both phones have internet access
- Try refreshing the page (pull down on the app)
- Check Supabase dashboard → Table Editor → transactions to see if data is there

**"Add to Home Screen" not showing on iPhone:**
- You MUST use Safari (not Chrome or Firefox)
- The option is under the Share menu (square with upward arrow)

**Want to change something?**
- Edit files in your GitHub repo
- Vercel automatically redeploys when you push changes

---

## Future Upgrades You Can Ask Claude For

- Monthly reports / charts
- Export to CSV
- Custom categories
- Notifications when budget is nearly spent
- Currency converter for holidays abroad
- Receipt photo attachment

---

**That's it! You now have a fully working, free budget app shared between your iPhone and Kesha's Android. Enjoy! 💸**
