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

    // Create BS Routes
    '/create-bs/create',
    '/create-bs/cek-pengajuan',
    '/create-bs/:id', // Dynamic route

    // LPJ BS Routes
    '/lpj/umum',
    '/lpj/marketing',
    '/lpj/cek-pengajuan',
    '/lpj/:id', // Dynamic route

    // User Management Routes
    '/manage-users',
    '/manage-users/add',
    '/manage-users/edit',

    // Catch-all for NotFound
    '*'
];