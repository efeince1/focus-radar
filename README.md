# FocusRadar

Find quiet places to work, mix ambient sounds, and focus with a Pomodoro timer, all in one page.

**Live demo:** https://efeince1.github.io/focus-radar/



## Features

- **Workspace Radar:** search a city (or use GPS) and get nearby libraries, cafes and coworking spaces on a map and as cards. Filter by type, sort by distance or name, save favorites, open directions.
- **Ambient Mixer:** 5 looping sounds (rain, cafe, wind, train, forest) with individual volume, master volume, and saved presets.
- **Pomodoro Timer:** 25 / 5 / 15 minute modes, daily session counter, focus time log, sound alert when a session ends.
- **Persistence:** favorites, last search results, volumes, presets and daily stats are stored in `localStorage`.

## APIs and libraries

- [Nominatim (OpenStreetMap)](https://nominatim.org/) for geocoding and place search
- [Leaflet](https://leafletjs.com/) with OpenStreetMap tiles for the map
- [Tailwind CSS](https://tailwindcss.com/) (CDN) for styling
- Browser APIs: Fetch, Geolocation, Web Audio, HTMLAudioElement, localStorage
- UI design generated with [Google Stitch](https://stitch.withgoogle.com/)

## JavaScript concepts used

- `async/await` + `fetch` with timeout (`AbortController`), error handling and a custom `ApiError`
- `map()` to normalize API data and render cards, `filter()` for type filtering, `reduce()` for category counts
- ES modules, destructuring, optional chaining (`?.`), nullish coalescing (`??`), arrow functions, template literals
- A small observable state store (`state.js`) with subscribe/notify and `localStorage` sync

## Project structure
focus-radar/
├── index.html
├── styles.css
├── app.js
└── src/
├── js/
│ ├── api.js # Nominatim requests, normalization, distance
│ ├── state.js # global state + localStorage
│ ├── timer.js # Pomodoro logic
│ ├── audio.js # ambient mixer + presets
│ ├── map.js # Leaflet map
│ ├── ui.js # radar cards, filters, favorites
│ └── nav.js # active section highlight
└── assets/sounds/

## Run locally

ES modules need a local server. In VS Code, install the **Live Server** extension, right-click `index.html` and choose **Open with Live Server**.

## Notes

- Place data comes from OpenStreetMap, so opening hours, addresses and websites are shown only when a place has them.
- The first version used the Overpass API, but its public servers were unreliable (timeouts and 5xx errors), so the project uses the Nominatim search API instead. Nominatim allows 1 request per second, so a search takes a few seconds.

## Credits

- Map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors
- Ambient sounds: From Pixabay