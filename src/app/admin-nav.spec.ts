import { Routes } from '@angular/router';
import { ADMIN_MENU, ADMIN_NAV, ADMIN_TILES } from './admin-nav';
import { routes } from './app.routes';

function paths(rs: Routes, prefix = ''): string[] {
  return rs.flatMap((r) => {
    const p = [prefix, r.path].filter(Boolean).join('/');
    return r.children ? paths(r.children, p) : [`/${p}`];
  });
}

/** WP-D1: a menü és a kezdőlap-csempék közös forrása nem mutathat nem létező oldalra, és nem hagyhat ki oldalt. */
describe('ADMIN_NAV', () => {
  const routePaths = paths(routes).filter((p) => p !== '/login' && p !== '/**');

  it('minden menüpont és csempe létező útvonalra mutat', () => {
    for (const item of ADMIN_NAV) {
      expect(routePaths, item.path).toContain(item.path);
    }
  });

  it('minden oldalnak van csempéje (a kezdőlap és a paraméteres részletező kivételével)', () => {
    const tilePaths = new Set(ADMIN_TILES.map((t) => t.path));
    expect(routePaths.filter((p) => p !== '/' && !p.includes(':') && !tilePaths.has(p))).toEqual([]);
  });

  it('a menüben minden útvonal legfeljebb egyszer szerepel', () => {
    const menuPaths = ADMIN_MENU.map((m) => m.path);
    expect(new Set(menuPaths).size).toBe(menuPaths.length);
  });
});
