export const routesConfig = [
    '/', // Login route
    '/dashboard/admin',
    '/dashboard/reviewer',
    '/dashboard/validator',
    '/dashboard/employee',

    // Reimbursement Routes
    '/reimbursement/bbm',
    '/reimbursement/operasional',
    '/reimbursement/umum',
    '/reimbursement/cek-pengajuan',
    '/reimbursement/:id', // Dynamic route

    // Bon Sementara Routes
    '/bon-sementara/ajukan',
    '/bon-sementara/cek-pengajuan',
    '/bon-sementara/:id', // Dynamic route

    // LPJ BS Routes
    '/lpj/umum',
    '/lpj/marketing',
    '/lpj/cek-pengajuan',
    '/lpj/:id', // Dynamic route

    // User Management Routes
    '/manage-users',
    '/manage-users/add',
    '/manage-users/edit',

    // Export Route
    '/ekspor-laporan-pengajuan',

    // Catch-all for NotFound
    '*'
];