/**
 * Staff Discord rollen — pas ID's hier aan en push (of via Vercel env)
 */
module.exports = {
  clientId: '1105558581304098867',

  /** Ranks van hoog naar laag (lage volgorde = hoogste rang) */
  ranks: [
    { id: 'founder', naam: 'Founder', kleur: '#ffd700', volgorde: 1, discordRoleId: '1502448623252930601' },
    { id: 'co-founder', naam: 'Co-Founder', kleur: '#facc15', volgorde: 2, discordRoleId: '1502448625366732971' },
    { id: 'beheer-team', naam: 'Beheer Team', kleur: '#a855f7', volgorde: 3, discordRoleId: '1502448635709751457' },
    { id: 'bestuur-team', naam: 'Bestuur Team', kleur: '#ef4444', volgorde: 4, discordRoleId: '1502448643041661088' },
    { id: 'hogerop-team', naam: 'Hogerop Team', kleur: '#f97316', volgorde: 5, discordRoleId: '1502448648930459792' },
    { id: 'staff', naam: 'Staff', kleur: '#22c55e', volgorde: 6, discordRoleId: '1502448659839582230' },
  ],

  /** Mag het beheer-panel — alleen Founder & Co-Founder */
  beheerRoleIds: [
    '1502448623252930601',
    '1502448625366732971',
  ],

  /** Staff dossiers bekijken/bewerken — Lead Coördinator, Beheer Team, Founder */
  dossierViewRoleIds: [
    '1502448623252930601',
    '1502448635709751457',
    '1502448671957061702',
  ],

  /** Onderwereld Coordinator — gangshop prijzen */
  onderwereldCoordinatorRoleId: '1502448673710280845',

  /** Volledige toegang overal (staff, beheer, dossiers, onderwereld) — Founder */
  fullAccessRoleIds: ['1502448623252930601'],
};
