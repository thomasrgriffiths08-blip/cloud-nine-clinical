# Cloud Nine Clinical — demo site

A scroll-driven walk from the forest, up the drive and through the doors of a timber lodge into the
shop, ending square on to the counter and its wall of jars. Every jar opens a side panel for its
cultivar, with "View more" for the full page.

| Page | What it is |
|---|---|
| `experience.html` | The home page and the walk (477 frames drawn to a canvas by `assets/walk/walk.js`) |
| `cultivars.html` | Every cultivar, filterable by Indica / Hybrid / Sativa |
| `cultivar.html?id=…` | One cultivar: lean, THC, CBD, terpenes, notes, stock |
| `admin.html` | Add, edit or remove cultivars and assign them to jars (local server only) |
| `patients.html` | The demo patient sign-in |

## Run it

```bash
python3 shoot/serve.py
```

Then open http://localhost:8744/experience.html. The admin page saves through this server
(`PUT /api/products`, `POST /api/upload`), which only answers to the local machine; on any static
host the site is read-only.

## Notes

- **Products** live in `data/products.json`. `slot` is the jar on the wall, 1–15 in reading order
  (5 per shelf); 11 and 15 are spare.
- **Demo photographs** are from Pexels (free for commercial use), credited on each page. They are
  replaced with the clinic's own photography before launch.
- **Launch switch:** `data-walk="outside"` on the runway in `experience.html` stops the walk at the
  open door instead of entering the shop. See `COMPLIANCE-AND-EVIDENCE.md` (HMR 2012 regs 279/284,
  CAP 12.12); whether the inside may be shown publicly is the client's lawyer's call.
- `{{PLACEHOLDERS}}` mark details waiting for the clinic (CQC number, fees, address, booking link).
- Frame sets: `h` 1920px (laptops/desktops with a wide canvas), `d` 1600px, `m` 960px (phones).
