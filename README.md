# MUNDA — Textile Lighting Systems (demonstration website)

A corporate website for **MUNDA Textile Lichtsysteme GmbH** — the company behind
textile lighting systems (LED light woven into technical textiles, premiered in the
Audi A3 Facelift 2024).

> **Content note:** the copy is based on the public content of [munda.tech](https://www.munda.tech/en/)
> (retrieved via the Wayback Machine, since the live site currently serves a broken TLS config).
> This is an educational demonstration build, not affiliated with or endorsed by MUNDA.

## Stack — no Python anywhere

| Layer    | Tech                          |
|----------|-------------------------------|
| Backend  | **Node.js + Express**         |
| Frontend | Plain HTML + CSS + vanilla JS |
| Assets   | Hand-written inline SVG       |
| Storage  | JSON file (`data/messages.json`) for contact submissions |

## Quick start

```bash
npm install
npm start          # → http://localhost:3000
# or: npm run dev  # auto-restarts on file changes (node --watch)
```

## Routes

| Route            | Description                                |
|------------------|--------------------------------------------|
| `/`              | Homepage                                   |
| `/technology`    | How textile light guides work              |
| `/company`       | The AUNDE × MENTOR joint venture           |
| `/sales`         | Sales contacts (AUNDE / MENTOR)            |
| `/career`        | Jobs & application info                    |
| `/game`          | **"Light Works"** adventure game — explore 5 zones of the Light Works facility: collect light orbs, flip switches, dodge dark zones, light the nodes (keyboard + touch) |
| `/contact`       | Contact form (wired to the API)            |
| `/api/health`    | Health check                               |
| `/api/contact`   | `POST` a contact message (validated, stored to JSON) |
| `/api/messages`  | `GET` stored messages (demo admin view)    |

## Project layout

```
munda_project/
├── server.js          # Express app (routes, validation, JSON storage)
├── package.json
├── public/
│   ├── index.html     # + technology / company / sales / career / contact / 404
│   ├── css/style.css  # design system (dark "textile light" theme)
│   ├── js/main.js     # nav, scroll reveals, contact form fetch
│   └── img/           # SVG assets (logo, fibre mat, weave diagram, car panel)
└── data/messages.json # created at runtime (gitignored)
```

## API example

```bash
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Ada","email":"ada@example.com","company":"Acme","subject":"Hello","message":"I would like to know more about textile lighting."}'
```

## Demo endpoints

- `GET /api/messages` — list stored submissions
- `GET /api/health` — uptime + status
