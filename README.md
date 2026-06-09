# DimSim

DimSim dims non-working hours in Google Calendar day and week views.

It helps your working day stand out by lightly shading the parts of the calendar
that sit outside your chosen hours.

## What it does

- Dims time before and after your working day.
- Supports a solid shade or pattern.
- Lets you choose colour, opacity, and pattern style.
- Keeps calendar events visible above the dimmed areas.
- Stores settings in Chrome sync storage.

## Install it

DimSim is not on the Chrome Web Store yet. For now, you install it as an
unpacked extension. That means Chrome requires **Developer mode**.

This is normal for testing or using an extension directly from GitHub, but only
install it if you trust the source code.

### Option 1: Download from GitHub

1. Open the DimSim GitHub repo.
2. Click **Code**.
3. Click **Download ZIP**.
4. Unzip the downloaded file.
5. Keep the unzipped folder somewhere safe. Chrome loads the extension from that
   folder.

### Option 2: Clone with Git

```sh
git clone https://github.com/kyeePi/dimsim.git
```

## Load it in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** in the top right.
3. Click **Load unpacked**.
4. Select the DimSim folder.
5. Open Google Calendar in day or week view.
6. Click the DimSim extension icon to adjust your settings.

If Chrome asks you to confirm Developer mode extensions, that is expected. It is
Chrome warning you that the extension was installed outside the Chrome Web Store.

## Update it

If you downloaded the ZIP:

1. Download the latest ZIP from GitHub.
2. Unzip it.
3. Replace your old DimSim folder with the new one.
4. Open `chrome://extensions`.
5. Click **Reload** on the DimSim extension card.

If you cloned the repo:

```sh
git pull
```

Then click **Reload** on the DimSim extension card in `chrome://extensions`.

## Remove it

1. Open `chrome://extensions`.
2. Find DimSim.
3. Click **Remove**.

## Privacy

DimSim runs locally in Chrome. It does not send calendar data, settings, or
browsing activity to an external server.

It runs on `calendar.google.com` so it can place the dimming overlay on Google
Calendar.

Read the full privacy note in [PRIVACY.md](PRIVACY.md).

## Current limits

- Works on Google Calendar timed grids where hour labels are visible.
- Targets day and week style views.
- Does not shade month view because month view has no hourly grid.
- Treats configured hours as the times shown in Google Calendar's visible grid.
- Uses the Google Calendar page DOM, so Google Calendar markup changes can
  require updates.

## For contributors

Run the checks:

```sh
npm run check
```

Build a local release package:

```sh
npm run release
```

The built extension folder is created at `dist/dimsim`.
The shareable zip is created at `dist/dimsim-v0.1.0.zip`.

## Why Developer mode is required

Chrome only directly installs extensions that are hosted and signed by the
Chrome Web Store. Self-hosted installation on macOS and Windows requires
enterprise policy. Until DimSim is published on the Chrome Web Store, installing
from GitHub means loading it manually as an unpacked extension.

Source: [Chrome extension distribution docs](https://developer.chrome.com/docs/extensions/how-to/distribute)
