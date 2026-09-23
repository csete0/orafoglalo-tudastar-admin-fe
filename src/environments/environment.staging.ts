export const environment = {
  production: false,
  // Ugyanaz az origin, mint maga az admin-fe (7443) - az nginx vhost proxy-zza
  // az /api/admin-ot az Admin.API-hoz. SZÁNDÉKOSAN nincs CORS az Admin.API-n
  // (ld. Program.cs) - a same-origin ezt feleslegessé teszi, és szűkebb
  // biztonsági felületet ad, mint egy explicit CORS-engedélyezés.
  apiUrl: 'https://192.168.1.77:7443/api/admin',
};
