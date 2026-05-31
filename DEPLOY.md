# Deploy staff-utrecht op Vercel (gratis Hobby)

## Fout: "No more than 12 Serverless Functions"

Je GitHub-repo had te veel bestanden in `api/` (elk bestand = 1 function).

**Oplossing:** alleen `api/router.js` + code in `server/lib/`.

---

## Upload naar GitHub (verplicht nieuwe versie)

Upload **de hele map** `utrecht-staff-portaal` naar  
https://github.com/zuiderveld/staff-utrecht

### Moet in je repo zitten

```
api/router.js          ← ALLEEN dit in api/
server/lib/            ← alle API-logica
scripts/vercel-prep.js
vercel.json
index.html, dashboard.html, js/, css/, data/, admin/, ...
```

### Mag NIET meer in api/ staan

- ~~api/staff-auth.js~~
- ~~api/lib/~~ (hele map)

De build `node scripts/vercel-prep.js` verwijdert oude api-bestanden automatisch als je per ongeluk nog oude files uploadt.

---

## Vercel instellingen

| Instelling | Waarde |
|------------|--------|
| Root Directory | *(leeg — repo is al staff-portaal)* |
| Framework | Other |
| Build Command | `node scripts/vercel-prep.js` (staat in vercel.json) |
| Output | `.` |

Environment Variables: Discord + Blob (zie `.env.example`).

---

## Geen Vercel Pro nodig

Met **1** serverless function past dit op **Hobby (gratis)**.
