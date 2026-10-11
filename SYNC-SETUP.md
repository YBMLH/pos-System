# Letting the owner watch the shop from anywhere

The shop PC keeps working exactly as it does now. Nothing below changes how a
sale or a booking is made, and nothing below needs the internet to be up.

What it adds: every change made on the shop PC is copied up to a small database,
and the owner opens a page on their phone that shows the shop as it stands.
When the internet is down the changes pile up on the PC and go up by themselves
once it is back.

**It only goes one way.** The owner's page can look; it can never change
anything. The till can only be changed at the counter.

---

## What you need

- A free Supabase account. No card is required.
- About 15 minutes, once.

---

## 1 — Make the project

1. Go to **supabase.com** and sign up.
2. **New project**. Give it any name. Choose the region closest to you
   (Frankfurt or Paris are the nearest to Algeria). Set a database password and
   keep it somewhere safe — you will not need it again for this.
3. Wait for it to finish building, about two minutes.

## 2 — Create the table

1. In the left menu: **SQL Editor** → **New query**.
2. Open `supabase-setup.sql` (next to this file), copy **all** of it, paste it
   in, and press **Run**.
3. It should say Success. You can close the query.

## 3 — Make two logins

Left menu: **Authentication** → **Users** → **Add user** → *Create new user*.
Do this twice. Tick **Auto Confirm User** both times.

| | Email | Password | What it is |
|---|---|---|---|
| 1 | `pc@yourshop.local` | make one up, long | the shop PC |
| 2 | your real email | make one up | the owner |

The first email does not have to be a real address — nothing is ever sent to
it. The second can be real or not; it is only a username.

Write both passwords down. You will type the first one into the shop PC once,
and the second into your phone once.

## 4 — Say who belongs to the shop

Back to **SQL Editor** → **New query**. Paste this, and change the three
values marked, then **Run**:

```sql
insert into public.shop_members (shop_id, user_id, role)
select 'stylebyib', id, 'device' from auth.users where email = 'pc@yourshop.local'
on conflict (shop_id, user_id) do update set role = excluded.role;

insert into public.shop_members (shop_id, user_id, role)
select 'stylebyib', id, 'owner' from auth.users where email = 'your@email.com'
on conflict (shop_id, user_id) do update set role = excluded.role;
```

- `stylebyib` → a short name for your shop, lowercase, no spaces. **Use the same
  one everywhere below.**
- the two emails → the ones you just created.

To check: run `select * from public.shop_members;` — you should see two rows.

## 5 — Find the two values the apps need

Left menu: **Project Settings** → **API**.

- **Project URL** — looks like `https://abcdefgh.supabase.co`
- **anon public** key — a very long string starting `eyJ...`

The anon key is meant to be public. On its own it opens nothing: the rules from
step 2 mean a person still has to sign in, and still has to be listed as a
member of your shop.

## 6 — Connect the shop PC

On the shop PC, open the app → **Settings** → **Owner's live view**, and fill in:

| Field | What to put |
|---|---|
| Project URL | from step 5 |
| Public key | the anon key from step 5 |
| Shop name | `stylebyib` — exactly as in step 4 |
| This PC's sign-in | `pc@yourshop.local` |
| This PC's password | the first password |

Press **Connect**. It checks the connection, then uploads everything currently
on the PC. On a shop with a few thousand records this takes a few seconds.

You should now see **Online** at the top of the screen, next to your name.

## 7 — Open the owner's page

On the owner's phone, open **live.html**. Easiest ways to get it there:

- Put `live.html` on any free static host (Netlify Drop, Cloudflare Pages,
  GitHub Pages) and open that address, or
- email the file to yourself and open it, or
- serve it from the shop PC if the phone is on the same wifi.

Fill in the same Project URL, the same public key, the same shop name, and
**the owner's** email and password from step 3. Press **Open the shop**.

On a phone: use **Add to Home Screen** so it opens like an app.

---

## What the owner sees

- Cash in the till, caution held, the repair fund, the store's own money
- How many dresses are out, how many reserved, how many overdue
- Who is coming in today, what is due back today, anything late
- A running list of what the staff are doing as they do it

It refreshes every 4 seconds while the page is open.

## What the status light means

| On the shop PC | Means |
|---|---|
| **Online** | everything has gone up |
| **Sending…** | pushing a batch right now |
| **Waiting · 12** | 12 changes queued, will go when the line is back |
| **Offline** | no internet — the shop carries on as normal |
| **Sync problem** | it reached the internet but was refused; tap it to see why |

| On the owner's page | Means |
|---|---|
| green dot, **Live** | reading fine |
| yellow, **Catching up** | a read was missed, trying again |
| red | cannot reach the database from this phone |
| a banner saying *nothing from the shop for 2h* | the page is fine, the shop PC is offline or closed — the figures shown are from then |

That last one matters: a quiet shop and a broken connection look the same from
a distance, so the page says which it is rather than showing stale numbers as
if they were current.

---

## Things worth knowing

**The shop never waits for the internet.** Sales, bookings, returns, the till —
all of it is on the PC and stays there. The mirror is a copy that trails behind.
If Supabase were deleted tomorrow the shop would not notice.

**After restoring a backup, or resetting the app,** what is online no longer
matches the PC. Go to Settings → **Re-upload everything**. It wipes the online
copy and sends the PC's data again.

**Changing the shop name** in Settings after connecting means the owner's page
is looking at the old name and will go empty. Keep it the same, or change it in
both places and re-upload.

**The shop PC's password is stored on that PC** so it can sign back in by itself
after a reboot without anyone being there. It is a device account that can only
write to your own shop, nothing else. Do not reuse a password you use elsewhere.

**Cost.** A boutique's whole history is a few megabytes against a 500 MB free
allowance, and the traffic is a handful of requests a minute. Free projects are
paused after 7 days with no traffic at all; a shop that is open will never hit
that. If you do get paused, opening the Supabase dashboard brings it back.

**Moving off Supabase later.** The app speaks ordinary HTTPS to one table. Any
server that accepts the same shape of request works; nothing here is locked in.
