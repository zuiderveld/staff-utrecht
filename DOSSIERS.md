# Staff dossiers

Per persoon bijhouden: **staffwarns**, **ontslagen**, berichten en notities.

## Pagina

`/dossiers.html` — menu **Dossiers**

## Wie mag wat?

| Actie | Wie |
|-------|-----|
| Dossiers bekijken | Alle ingelogde staff |
| Persoon toevoegen, registratie, verwijderen | **Beheer** (Founder / Co-Founder) |

## Registraties

- **Staffwarn** — gele markering  
- **Ontslag** — rood  
- **Bericht** — communicatie / gesprek  
- **Notitie** — overige notities  

## Vercel

`BLOB_READ_WRITE_TOKEN` moet staan (zelfde als regels-beheer). Data wordt opgeslagen in blob `urp-staff-dossiers.json`.

## Upload

- `dossiers.html`
- `data/dossiers.json`
- `server/lib/routes/staff-dossiers.js`
- `api/router.js`, `vercel.json`
- `js/app.js`, `css/staff.css`, `dashboard.html`
