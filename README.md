# Run Hub

A Strava dashboard for runners that you can open before a run or after one. It opens on a hub, a short board that links to its pages. Local Legends is the first of those pages.

- **Before a run:** see which Local Legend titles are about to slip and which ones are within reach.
- **After a run:** see your daily, weekly, monthly and year-to-date mileage next to your own normal.

Live at **https://carpe-canem.github.io/RunHub/**. To try it without connecting anything, add `?demo` to the end of the address.

## Privacy

- **No server.** The page is static: HTML, CSS and a few JavaScript files. Your browser talks to `www.strava.com` directly.
- **Everything stays in your browser.** Your Client ID, Client Secret, tokens and cached data are kept in that browser's `localStorage`. Nothing is sent to the site owner or anyone else.
- **Each runner brings their own Strava API app**, so everyone's keys, data and rate limits are separate.
- **Leaders stay anonymous.** The page keeps only the Local Legend leader's athlete ID, to tell whether the leader is you, and their effort count. It never stores or shows their name or photo.
- **Two ways out, on the Data page.** "Forget this browser" wipes everything from that browser and leaves your other devices connected. "Disconnect everywhere" also revokes the page's access at Strava, which signs out every device.
- **Note for the site owner:** every GitHub Pages project site on this account shares the origin `carpe-canem.github.io`, and so shares `localStorage`. Only host pages you trust under this account. Better still, use a custom domain for this dashboard.

## Connecting (each runner, once per browser)

1. Go to <https://www.strava.com/settings/api> and create an app:
   - **Category:** Visualizer
   - **Website:** `https://carpe-canem.github.io/RunHub/`
   - **Authorization Callback Domain:** `carpe-canem.github.io`
2. Upload any icon, then copy the **Client ID** and **Client Secret**.
3. Open the dashboard, paste them in, click **Connect with Strava**, and approve on Strava's screen.

The page asks Strava for `read,activity:read_all`. Private runs count toward your mileage, but only public runs (visible to "Everyone") count toward Local Legends.

## Setting up another device

Every browser keeps its own storage, and so does the iPhone home-screen app, so each one asks for the keys again. A setup link carries them across.

1. On a connected device, open **Data**, find **Set up another device** and press **Create setup link**.
2. Open the link on the other device. For the home-screen app, paste it into the box on its setup screen, because a link always opens in the browser.

**A setup link is as sensitive as a password.** It holds your Client ID, Client Secret and Strava refresh token. Anyone holding it can read all of your Strava activities, private ones included, until you use "Disconnect everywhere". Send it only to yourself. The page does not store the link, and it rides after the `#` in the address, which browsers do not send to any site.

The link is for your own devices. A friend connects with their own Strava app, as above.

## How the numbers are counted

| Metric | Definition |
|---|---|
| Titles at risk | Titles you hold where some of your public efforts drop out of the 90-day window in the next 7 days |
| Within reach | Segments where you're 3 or fewer efforts behind the current Local Legend |
| Titles held | Segments you ran in the last 90 days where you're the current Local Legend |
| This week | Run, TrailRun and VirtualRun distance, Monday to today, compared with your average over the previous 12 weeks |
| Year to date | Distance since January 1, compared with the same date last year |

**Limits to know about:**

- **The leader's count comes from an undocumented field.** It's the `local_legend` field returned by `GET /segments/{id}`, and Strava may change or remove it. The Data status panel shows whether the field is still being returned.
- **Strava doesn't say who's in second place**, so "at risk" means your own efforts are about to expire. It doesn't mean a rival is closing in.

## Refresh and rate limits

- **Data refreshes when you open the page.** It also refreshes when you come back to the tab after 15 minutes.
- **Leader counts are re-checked on a schedule.** At-risk and within-reach segments are re-checked every 6 hours, and all others once a day.
- **The page counts its own API calls.** It stays under 90 per 15 minutes and 900 per day, which is below Strava's read limits of 100 and 1,000. If it hits the limit, it pauses and picks up again when the window resets.
- **The first sync can take a few minutes** if you've run a lot of segments.

## Local development

```bash
python -m http.server 8080
```

Open <http://localhost:8080/>. Strava always allows `localhost` as a callback, so the same Strava app works both locally and on GitHub Pages.

## Publishing

In the GitHub repo, open **Settings → Pages**, set **Source** to "Deploy from a branch", choose `main` and `/ (root)`, and save.

Compatible with Strava. Not affiliated with or endorsed by Strava.
