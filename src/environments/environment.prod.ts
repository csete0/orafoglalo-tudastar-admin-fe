export const environment = {
  production: true,
  // ADM-F1: a prod admin-hozzáférés portja/hosztja még nincs eldöntve (a terv
  // szerint a staging-verifikáció UTÁN kerül sorra) - ezt az értéket akkor
  // kell majd frissíteni, amikor a prod docker-host LAN-only admin nginx
  // vhostja elkészül.
  apiUrl: 'https://TODO-prod-admin-host/api/admin',
};
