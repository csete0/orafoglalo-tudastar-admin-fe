/** Kezdőlap-csempe: felirat + rövid leírás. */
export interface AdminTile {
  readonly label: string;
  readonly note: string;
}

/**
 * Az admin felület egy oldala: a felső menü és a kezdőlap csempéi ebből az egy listából épülnek (owner-döntés 2).
 * `nav`: a menüpont felirata (ha nincs, nem szerepel a menüben); `tile`: a kezdőlap-csempe (ha nincs, nincs csempéje).
 * A sorrend mindkettőben a lista sorrendje. A Kezdőlap és a Háttérfeladatok (Hangfire) menüpont a fejléc sablonjában van.
 */
export interface AdminNavItem {
  readonly path: string;
  readonly nav?: string;
  readonly tile?: AdminTile;
}

export const ADMIN_NAV: readonly AdminNavItem[] = [
  { path: '/users', nav: 'Felhasználók', tile: { label: 'Felhasználó-kereső / 360°', note: 'A2 - kész' } },
  { path: '/users', tile: { label: 'Támogatói műveletek', note: 'A3 - kész (a felhasználó-részletezőben)' } },
  { path: '/gift-coupons', nav: 'Ajándékkódok', tile: { label: 'Ajándékkód-kezelés', note: 'A1 - kész' } },
  { path: '/payments', nav: 'Fizetések', tile: { label: 'Fizetés-lista', note: 'A4 - kész' } },
  { path: '/audit-log', nav: 'Audit-napló', tile: { label: 'Audit-napló', note: 'A5 - kész' } },
  { path: '/app-status', nav: 'Alkalmazás-állapot', tile: { label: 'Alkalmazás-állapot', note: 'A6 - kész' } },
  {
    path: '/kodfuttato-terheles',
    nav: 'Kódfuttató terhelés',
    tile: { label: 'Kódfuttató terhelés', note: 'Judge0: várakozás, p95, túlterhelés' },
  },
  { path: '/jelentkezesek', nav: 'Jelentkezések', tile: { label: 'Tanári jelentkezések', note: 'migrálva' } },
  { path: '/tanarok', nav: 'Tanárok', tile: { label: 'Tanári aktivitás', note: 'A7 - kész' } },
  { path: '/intezmenyek', nav: 'Intézmények', tile: { label: 'Intézményi licencek', note: 'migrálva' } },
  { path: '/demok', nav: 'Demók', tile: { label: 'Demók', note: 'saját élő demó és lejáró iskolai demók' } },
  { path: '/ellenorzes', nav: 'Ellenőrzés', tile: { label: 'Kérdés-jelentések / érdeklődések', note: 'migrálva' } },
  // B3: a kuponkódoknak nincs menüpontja (csak csempéje) - a menü így is zsúfolt.
  { path: '/kuponok', tile: { label: 'Kuponkódok (általános)', note: 'migrálva' } },
  { path: '/ai-koltes', nav: 'AI-költés', tile: { label: 'AI-költés pult', note: 'migrálva' } },
  {
    path: '/projektmuhely',
    nav: 'Projektműhely',
    tile: { label: 'Projektműhely', note: 'haladás, tölcsér, AI- és Judge0-költés' },
  },
  { path: '/git', nav: 'Git', tile: { label: 'Git', note: 'kvóták, tárolók, zárolás' } },
  {
    path: '/csapatok',
    nav: 'Csapatok',
    tile: { label: 'Csapatok', note: 'vizsgaremek-csapatok, GitHub-tükrözés, MI-átnézések' },
  },
  {
    path: '/novekedes',
    nav: 'Növekedés',
    tile: { label: 'Növekedés', note: 'kohorszok, aktiválódás, megmaradás, lemondási okok' },
  },
  {
    path: '/probaerettsegi',
    nav: 'Próbaérettségi',
    tile: { label: 'Próbaérettségi', note: 'esemény, kitöltés, MI-keret, megtérülés' },
  },
  {
    path: '/erettsegi-eredmenyek',
    nav: 'Érettségi-eredmények',
    tile: { label: 'Érettségi-eredmények', note: 'valódi eredmények, előrejelzés-pontosság, idézetek' },
  },
  {
    path: '/szempontlistak',
    nav: 'Szempontlisták',
    tile: { label: 'Szempontlisták', note: 'a hivatalos feladatok pontozási szempontjai, jóváhagyás' },
  },
  {
    path: '/gyakorlo-ertekelesek',
    nav: 'Gyakorló értékelések',
    tile: { label: 'Gyakorló értékelések', note: 'darab, költség, keret-kihasználtság, toplista' },
  },
  {
    path: '/verseny',
    nav: 'Verseny',
    tile: { label: 'Verseny', note: 'feladatok közzétételi kapuja, forgalom' },
  },
];

/** A felső menü pontjai (a Kezdőlap és a Háttérfeladatok nélkül). */
export const ADMIN_MENU = ADMIN_NAV.flatMap((item) => (item.nav ? [{ path: item.path, label: item.nav }] : []));

/** A kezdőlap csempéi. */
export const ADMIN_TILES = ADMIN_NAV.flatMap((item) => (item.tile ? [{ path: item.path, ...item.tile }] : []));
