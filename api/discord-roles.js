/**
 * Staff Discord rollen — pas ID's hier aan en push (of via Vercel env)
 */
module.exports = {
  clientId: '1105558581304098867',

  /** Ranks van hoog naar laag (lage volgorde = hoogste rang) */
  ranks: [
    { id: 'founder', naam: 'Founder', kleur: '#ffd700', volgorde: 1, discordRoleId: '1502448623252930601' },
    { id: 'beheer-team', naam: 'Beheer Team', kleur: '#a855f7', volgorde: 2, discordRoleId: '1502448635709751457' },
    { id: 'bestuur-team', naam: 'Bestuur Team', kleur: '#ef4444', volgorde: 3, discordRoleId: '1502448643041661088' },
    { id: 'hogerop-team', naam: 'Hogerop Team', kleur: '#f97316', volgorde: 4, discordRoleId: '1502448648930459792' },
    { id: 'staff', naam: 'Staff', kleur: '#22c55e', volgorde: 5, discordRoleId: '1502448659839582230' },
  ],

  /** Mag het beheer-panel gebruiken */
  beheerRoleIds: [
    '1502448623252930601',
    '1502448635709751457',
    '1502448643041661088',
  ],
};
