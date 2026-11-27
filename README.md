# Run Hub

A Strava dashboard for runners that you can open before a run or after one. It opens on a hub that reads like a finish-line announcer: the countdown to your next start, then a few plain sentences with the numbers set in clock digits (this week against your usual week, this year against the same date last year, your last race, your totals), then your latest results and your records. Races is the other page.

- **Your races:** every run you flagged as a race on Strava is listed with its time, pace and class (5K, 10K, Half and so on), taken from the race's name or, failing that, its GPS distance. Open one to see its course, how it compares with your other races of that class, and the same race in other years. Upcoming races are read from your Strava bio (one line per race, `MM/DD/YYYY Name`) or added by hand with "Add race", and show under "Up next" until their date has passed. The first scan reads your whole history in the background and can take a few minutes. The Data page shows how it is going, with counts only, and can rescan.
- **Your mileage:** on the hub, this week's and this year's mileage are sentences set next to your own normal. "Last 13 weeks" opens the weekly bars, with today's and this month's figures.
- **The status strip:** the dot-matrix strip at the top says when the page last synced, what the next start is and the week so far; during a sync it shows the progress. It scrolls only when the text does not fit, and pressing it stops the scrolling. Ziggy, the dog beside it, trots while a sync runs, sits when it is done and naps when Strava cannot be reached. With reduced motion switched on in your device, nothing scrolls, counts up or flashes.
- **Miles or kilometres:** the Units setting on the Data page switches mileage and race distances, paces, splits and heights between the two. It is kept in this browser only.

Live at **https://carpe-canem.github.io/RunHub/**. To try it without connecting anything, add `?demo` to the end of the address.

## Privacy

- **No server.** The page is static: HTML, CSS and a few JavaScript files. Your browser talks to `www.strava.com` directly. The only other outside hosts are `cdnjs.cloudflare.com`, which serves the Leaflet map library (script and stylesheet) on every page view, OpenStreetMap and `basemaps.cartocdn.com` (CARTO), for the map tiles on the race page's course map (the tile host sees roughly where a race was) (CARTO is used on the site's own address and can be switched to OpenStreetMap with the Map switch on the Data page): tile requests for the area shown, with the site's address and a public API key. That key is public by design: CARTO restricts it to the site's address, so it is of no use elsewhere. And `archive-api.open-meteo.com`, which reads each race's weather. Open-Meteo is sent a start point rounded to about 1 km and a date, for each race, and nothing else: no names, times, tokens or athlete ID. `nominatim.openstreetmap.org` (OpenStreetMap's Nominatim) names the town of each race start: it is sent a start point rounded to about 1 km, once per place, at most one request every 1.5 seconds, and nothing else. The "Place lookups" switch on the Data page turns it off. See its [usage policy](https://operations.osmfoundation.org/policies/nominatim/).
- **Everything stays in your browser.** Your Client ID, Client Secret, tokens and cached data (race history included) are kept in that browser's `localStorage`. Nothing is sent to the site owner or anyone else.
- **Each runner brings their own Strava API app**, so everyone's keys, data and rate limits are separate.
- **Two ways out, on the Data page.** "Forget this browser" wipes everything from that browser and leaves your other devices connected. "Disconnect everywhere" also revokes the page's access at Strava, which signs out every device.
- **Note for the site owner:** every GitHub Pages project site on this account shares the origin `carpe-canem.github.io`, and so shares `localStorage`. Only host pages you trust under this account. Better still, use a custom domain for this dashboard.

## Connecting (each runner, once per browser)

1. Go to <https://www.strava.com/settings/api> and create an app:
   - **Category:** Visualizer
   - **Website:** `https://carpe-canem.github.io/RunHub/`
   - **Authorization Callback Domain:** `carpe-canem.github.io`
2. Upload any icon, then copy the **Client ID** and **Client Secret**.
3. Open the dashboard, paste them in, click **Connect with Strava**, and approve on Strava's screen.

The page asks Strava for `read,activity:read_all`. Private runs count toward your mileage, and a private run flagged as a race shows in your races.

## Setting up another device

Every browser keeps its own storage, and so does the iPhone home-screen app, so each one asks for the keys again. A setup link carries them across.

1. On a connected device, open **Data**, find **Set up another device** and press **Create setup link**.
2. Open the link on the other device. For the home-screen app, paste it into the box on its setup screen, because a link always opens in the browser.

**A setup link is as sensitive as a password.** It holds your Client ID, Client Secret and Strava refresh token. Anyone holding it can read all of your Strava activities, private ones included, until you use "Disconnect everywhere". Send it only to yourself. The page does not store the link, and it rides after the `#` in the address, which browsers do not send to any site.

The link is for your own devices. A friend connects with their own Strava app, as above.

## Upcoming races

Up next on Races, and the countdown on the hub, come from two places. The countdown runs to midnight at the start of race day, then reads "Race day". A race leaves both once Strava has a race on that date with the same name or distance, or at the end of race day.

- **Your Strava bio.** Put one race per line, with the date first as month/day/year (the page reads that order only):

  ```
  06/14/2027 Riverbend 5K
  7/9/2027 Frostbite Half Marathon
  ```

  The page reads the bio once a day and on every "Refresh now". A race you delete from the bio disappears on the next read. Data counts the lines that look like a date but could not be read.
- **Add race.** Adds a race by hand, with an optional start time and place. A race added by hand is kept only in that browser (Strava has no copy), and it is dropped once its date has passed, because finished races come in from Strava.

To move hand-added races to another browser or the home-screen app, open **Data**, find **Races you added** and press **Export**. Where the browser allows it you can **Download file**; copy and paste works everywhere. On the other device paste the text into **Import** (or choose the file). Races already there are not added twice. Leaving ("Forget this browser" or "Disconnect everywhere") offers an export first.

## How the numbers are counted

| Metric | Definition |
|---|---|
| This week | Run, TrailRun and VirtualRun distance, Monday to today, compared with your average over the previous 12 weeks |
| This month | Distance since the 1st, compared with your average over the previous 6 months |
| Year to date | Distance since January 1, compared with the same date last year |

## Refresh and rate limits

- **Data refreshes when you open the page.** It also refreshes when you come back to the tab after 15 minutes.
- **Each refresh is small.** It lists your recent runs (one request per 200), and once a day re-lists the last 95 days to pick up edits and deletions.
- **The page counts its own API calls.** It stays under 90 per 15 minutes and 900 per day, which is below Strava's read limits of 100 and 1,000. If it hits the limit, it pauses and picks up again when the window resets.
- **The bio is read once a day, and on Refresh now.** It is one request, to find your upcoming races. Only the races found in the bio are kept, never the text.
- **The first sync can take a few minutes** if you have a long race history: it reads one detail per race.

## Local development

```bash
python -m http.server 8080
```

Open <http://localhost:8080/>. Strava always allows `localhost` as a callback, so the same Strava app works both locally and on GitHub Pages.

## Publishing

In the GitHub repo, open **Settings → Pages**, set **Source** to "Deploy from a branch", choose `main` and `/ (root)`, and save.

Compatible with Strava. Not affiliated with or endorsed by Strava.
