# DimSim

DimSim dims non-working hours in Google Calendar day and week views.

It is a small Chrome extension for making work time easier to scan. It runs on
`calendar.google.com`, stores settings in `chrome.storage.sync`, and does not
send data to any external service.

## Features

- Shade time before and after your working day.
- Use a solid shade or pattern.
- Choose colour, opacity, and pattern style.
- Keep calendar events above the shading.

## Install for development

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder.
5. Open Google Calendar in day or week view.

## Build a shareable zip

Run:

```sh
npm run release
```

The built extension folder is created at `dist/dimsim`.
The shareable zip is created at `dist/dimsim-v0.1.0.zip`.

## Share with colleagues

For a quick internal test, share the repository or the zip and ask colleagues to
load the unpacked `dist/dimsim` folder in Developer mode.

For normal installation without Developer mode, publish through the Chrome Web
Store. Chrome only directly installs extensions that are hosted and signed by
the Chrome Web Store, unless your organisation uses enterprise policy.

## Publish checklist

- Run `npm run release`.
- Test `dist/dimsim` as an unpacked extension.
- Create a public GitHub repository.
- Add screenshots and a short demo GIF.
- Publish through the Chrome Web Store if you want non-developer installs.

## Current scope

- Works on Google Calendar timed grids where hour labels are visible.
- Targets day and week style views.
- Does not shade month view because month view has no hourly grid.
- Treats configured hours as the times shown in Google Calendar's visible grid.
- Uses the Calendar page DOM, so Google Calendar markup changes can require updates.
