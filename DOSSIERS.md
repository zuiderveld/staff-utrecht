# Staff dossiers

Per persoon bijhouden: **staffwarns**, **ontslagen**, berichten en notities.

## Pagina

`/dossiers.html` — menu **Dossiers**

## Wie mag wat?

| Actie | Wie (Discord role ID) |
|-------|------------------------|
| Dossiers bekijken & bewerken | **Founder** `1502448623252930601` |
| | **Beheer Team** `1502448635709751457` |
| | **Lead Coördinator** `1502448671957061702` |

Andere staff-rollen zien geen menu-item Dossiers.

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
