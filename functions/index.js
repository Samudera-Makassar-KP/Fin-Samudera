const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2/options");
const legacyFunctions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const vision = require("@google-cloud/vision");
const { PDFDocument } = require("pdf-lib");
const { formatCurrency, formatDateIndonesia } = require("./lib/format");
const { buildUserDirectoryEntry } = require("./lib/userDirectory");
const { textContainsAmount } = require("./lib/pengembalianMatcher");

const emailUserSecret = defineSecret("EMAIL");
const emailPasswordSecret = defineSecret("EMAIL_PASSWORD");

setGlobalOptions({
    region: "asia-southeast2",
    secrets: [emailUserSecret, emailPasswordSecret],
    // Bagian BO: kuota Cloud Run "Total CPU allocation" project ini di
    // asia-southeast2 hanya 20 vCPU AKTIF bersamaan (semua instance yang
    // sedang hidup, termasuk yang masih hangat setelah melayani request).
    // Default Firebase memberi tiap fungsi 1 vCPU penuh, jadi ~20 instance
    // hangat dari 23 fungsi sudah menghabiskan kuota dan revisi baru gagal
    // start ("Quota exceeded for total allowable CPU"). "gcf_gen1" memberi CPU
    // pecahan sesuai memori (256MiB = 1/6 vCPU, 512MiB = 1/3 vCPU) -- cukup
    // untuk fungsi yang kerjanya kirim email/panggil API.
    cpu: "gcf_gen1",
    maxInstances: 20
});

// Inisialisasi Firebase Admin
initializeApp();
const db = getFirestore();
const visionClient = new vision.ImageAnnotatorClient();

let cachedTransporter = null;
let cachedEmailUser = null;

const getOptionalString = (value) => {
    if (typeof value !== "string") return undefined;
    const trimmedValue = value.trim();
    return trimmedValue ? trimmedValue : undefined;
};

const readSecretValue = (secret) => {
    try {
        return getOptionalString(secret.value());
    } catch (error) {
        return undefined;
    }
};

const getEmailCredentials = () => {
    let emailConfig = {};

    try {
        emailConfig = legacyFunctions.config()?.email || {};
    } catch (error) {
        emailConfig = {};
    }

    return {
        user: getOptionalString(process.env.EMAIL)
            || readSecretValue(emailUserSecret)
            || getOptionalString(emailConfig.user),
        pass: getOptionalString(process.env.EMAIL_PASSWORD)
            || readSecretValue(emailPasswordSecret)
            || getOptionalString(emailConfig.password)
    };
};

const getMailTransporter = () => {
    const credentials = getEmailCredentials();

    if (!credentials.user || !credentials.pass) {
        throw new Error("Konfigurasi EMAIL atau EMAIL_PASSWORD belum tersedia.");
    }

    if (!cachedTransporter || cachedEmailUser !== credentials.user) {
        cachedTransporter = nodemailer.createTransport({
            service: "gmail",
            auth: credentials
        });
        cachedEmailUser = credentials.user;
    }

    return { transporter: cachedTransporter, fromEmail: credentials.user };
};

// Helper Function: Mengambil data user dari Firestore
const getUserData = async (uid) => {
    if (!uid) return null;
    const userDoc = await db.collection("users").doc(uid).get();
    return userDoc.exists ? userDoc.data() : null;
};

const getUserDataByEmail = async (email) => {
    if (!email) return null;
    const trimmedEmail = email.trim();
    const normalizedEmail = trimmedEmail.toLowerCase();
    const emailCandidates = [...new Set([trimmedEmail, normalizedEmail])];
    const docsById = new Map();

    for (const candidate of emailCandidates) {
        const snapshot = await db.collection("users")
            .where("email", "==", candidate)
            .limit(2)
            .get();

        snapshot.docs.forEach((doc) => docsById.set(doc.id, doc));
    }

    if (docsById.size === 0) return null;

    const exactEmailDocs = [...docsById.values()].filter((doc) => {
        const data = doc.data();
        return typeof data.email === "string" && data.email.trim().toLowerCase() === normalizedEmail;
    });

    if (exactEmailDocs.length !== 1) return null;

    const doc = exactEmailDocs[0];
    return { id: doc.id, data: doc.data() };
};

const syncAuthenticatedUserProfile = async (authContext) => {
    if (!authContext?.uid) {
        throw new HttpsError("unauthenticated", "Anda harus login untuk menjalankan aksi ini.");
    }

    const uidUser = await getUserData(authContext.uid);
    if (uidUser) {
        return { ...uidUser, uid: authContext.uid };
    }

    const authEmail = authContext.token?.email;
    const emailUser = await getUserDataByEmail(authEmail);
    if (!emailUser?.data) {
        throw new HttpsError("permission-denied", "Profil pengguna tidak ditemukan. Silakan hubungi Super Admin.");
    }

    const syncedUser = {
        ...emailUser.data,
        email: emailUser.data.email || authEmail,
        uid: authContext.uid,
        migratedFromUid: emailUser.id,
        updatedAt: new Date().toISOString(),
    };

    await db.collection("users").doc(authContext.uid).set(syncedUser, { merge: true });
    return syncedUser;
};

exports.syncCurrentUserProfile = onCall(async (request) => {
    const userData = await syncAuthenticatedUserProfile(request.auth);

    return {
        uid: request.auth.uid,
        nama: userData.nama || "",
        email: userData.email || request.auth.token?.email || "",
        role: userData.role || "",
        posisi: userData.posisi || "",
        unit: userData.unit || [],
        department: userData.department || [],
        bankName: userData.bankName || "",
        accountNumber: userData.accountNumber || "",
        reviewer1: userData.reviewer1 || [],
        reviewer2: userData.reviewer2 || [],
        validator: userData.validator || [],
        lokasi: userData.lokasi || [],
    };
});

// Helper Function: Template HTML untuk email
const createEmailTemplate = (content, submitterData, newData, showSubmitterInfo = true, status = 'approval') => {
    // Deteksi tipe dokumen
    const documentType = newData.documentType ||
        (newData.displayId?.includes('LPJ') ? 'LPJ' :
        newData.bonSementara ? 'BS' : 'RBS');

    // Set label dan amount berdasarkan tipe dokumen
    let documentLabel = 'Nomor Dokumen';
    let amountLabel = 'Jumlah';
    let amount = '';

    if (documentType === 'BS') {
        documentLabel = 'Nomor BS';
        amountLabel = 'Jumlah BS';
        amount = formatCurrency(newData.bonSementara?.[0]?.jumlahBS || 0);
    } else if (documentType === 'LPJ') {
        documentLabel = 'Nomor Dokumen';
        amountLabel = 'Jumlah BS';
        amount = formatCurrency(newData.lpjDetail?.jumlahBS || newData.jumlahBS || 0);
    } else {
        documentLabel = 'Nomor Dokumen';
        amountLabel = 'Jumlah';
        amount = formatCurrency(newData.totalBiaya || 0);
    }

    let headerText;
    switch(status) {
        case 'approved':
            headerText = 'Pengajuan Disetujui';
            break;
        case 'rejected':
            headerText = 'Pengajuan Ditolak';
            break;
        case 'reminder':
            headerText = 'Pengingat Approval';
            break;
        case 'financeReminder':
            headerText = 'Reminder untuk Finance';
            break;
        case 'pengembalianReminder':
            headerText = 'Reminder Bukti Pengembalian BS';
            break;
        case 'approvedForFinance':
            headerText = 'Pengajuan Disetujui - Siap Diproses';
            break;
        default:
            headerText = 'Permintaan Approval';
    }

    // Generate table rows
    let tableRows = `
        <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>${documentLabel}</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${newData.displayId}</td>
        </tr>`;

    // Tambahkan rows untuk LPJ terlebih dahulu jika tipe dokumen adalah LPJ
    if (documentType === 'LPJ') {
        const lpjData = newData.lpjDetail || newData;
        // Bagian BO: LPJ yang nomor BS-nya diketik manual (BS tidak pernah
        // dibuat lewat sistem ini) tidak menampilkan baris BS sama sekali --
        // sebelumnya Finance mengira ada BS di sistem yang ikut terpicu.
        if (newData.bsFromSystem !== false) {
            tableRows += `
        <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>Nomor BS</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${lpjData.nomorBS || 0}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>Jumlah BS</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${formatCurrency(lpjData.jumlahBS || 0)}</td>
        </tr>`;
        }
        tableRows += `
        <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>Total Pengeluaran</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${formatCurrency(lpjData.totalBiaya || 0)}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>Sisa Lebih BS</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${formatCurrency(lpjData.sisaLebih || 0)}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>Kurang Bayar ke Pegawai</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${formatCurrency(lpjData.sisaKurang || 0)}</td>
        </tr>`;
    } else {
        tableRows += `
        <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>${amountLabel}</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${amount}</td>
        </tr>`;
    }

    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
        <div style="background-color: #ED1C24; color: white; padding: 15px; text-align: center; border-top-left-radius: 8px; border-top-right-radius: 8px;">
            <h2 style="margin: 0; font-size: 20px;">${headerText}</h2>
        </div>

        <div style="padding: 20px;">
            <p style="font-size: 16px; margin-bottom: 10px;">${content}</p>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px;">
                ${tableRows}
            </table>

            <div style="text-align: center;">
                <a href="https://smdr-mks.com"
                    style="background-color: #ED1C24;
                        color: white;
                        padding: 12px 24px;
                        text-decoration: none;
                        border-radius: 5px;
                        font-weight: bold;
                        display: inline-block;">
                    Buka Website
                </a>
            </div>

            ${showSubmitterInfo ? `
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd;">
                    <p style="margin: 5px 0; font-size: 14px;">Diajukan oleh</p>
                    <p style="margin: 5px 0; font-size: 14px;"><strong>${submitterData?.nama || 'User'}</strong></p>
                    <p style="margin: 5px 0; font-size: 14px;">${newData?.user?.unit || 'Unit'}</p>
                    <p style="margin: 5px 0; font-size: 14px;"><br>Terima Kasih</p>
                </div>
            ` : ''}
        </div>

        <div style="background-color: #f4f4f4; padding: 15px; text-align: center; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px; font-size: 12px;">
            <p style="color: #777; font-size: 11px; margin: 5px 0;">
                Email ini dikirim secara otomatis. Mohon tidak membalas email ini.
            </p>
        </div>
    </div>
    `;
};

// Bagian BO: LPJ boleh diajukan dengan nomor BS yang diketik manual (BS-nya
// dibuat di luar sistem, lihat CreatableSelect di FormLpjUmum/Marketing.jsx).
// Untuk LPJ seperti itu, email TIDAK boleh menyebut BS -- dihitung sekali
// saat LPJ dibuat lalu disimpan sebagai `bsFromSystem`; LPJ lama yang belum
// punya field ini dicek ulang ke koleksi bonSementara.
const resolveLpjBsFromSystem = async (lpjData) => {
    if (typeof lpjData?.bsFromSystem === "boolean") return lpjData.bsFromSystem;
    const nomorBS = typeof lpjData?.nomorBS === "string" ? lpjData.nomorBS.trim() : "";
    if (!nomorBS) return false;
    const candidates = [...new Set([nomorBS, nomorBS.toUpperCase()])];
    const snapshot = await db.collection("bonSementara")
        .where("displayId", "in", candidates)
        .limit(1)
        .get();
    return !snapshot.empty;
};

const getLpjLabel = (lpjData) => (lpjData?.bsFromSystem === false ? "LPJ" : "LPJ BS");

// Helper Function: Mengirim email
const sendEmail = async (to, subject, htmlContent = null, attachments = []) => {
    if (!to) return false;

    try {
        const { transporter, fromEmail } = getMailTransporter();
        const mailOptions = {
            from: '"No Reply - Notifikasi Samudera" <' + fromEmail + '>',
            to,
            subject,
            html: htmlContent,
            ...(attachments.length > 0 ? { attachments } : {})
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email berhasil dikirim ke ${to}`);
        return true;
    } catch (error) {
        console.error("❌ Gagal mengirim email:", error);
        return false;
    }
};

const requireSuperAdmin = async (authContext) => {
    if (!authContext?.uid) {
        throw new HttpsError("unauthenticated", "Anda harus login untuk menjalankan aksi ini.");
    }

    const requesterData = await syncAuthenticatedUserProfile(authContext);
    if (requesterData?.role !== "Super Admin") {
        throw new HttpsError("permission-denied", "Hanya Super Admin yang dapat menjalankan aksi ini.");
    }

    return requesterData;
};

const normalizeText = (value, fieldName, maxLength = 120, required = true) => {
    if (value === undefined || value === null || value === "") {
        if (required) {
            throw new HttpsError("invalid-argument", `${fieldName} wajib diisi.`);
        }
        return "";
    }

    if (typeof value !== "string") {
        throw new HttpsError("invalid-argument", `${fieldName} harus berupa teks.`);
    }

    const trimmed = value.trim();
    if (required && !trimmed) {
        throw new HttpsError("invalid-argument", `${fieldName} wajib diisi.`);
    }

    if (trimmed.length > maxLength) {
        throw new HttpsError("invalid-argument", `${fieldName} terlalu panjang.`);
    }

    return trimmed;
};

const normalizeStringArray = (value, fieldName, maxItems = 20) => {
    if (!value) return [];
    if (!Array.isArray(value)) {
        throw new HttpsError("invalid-argument", `${fieldName} harus berupa daftar.`);
    }

    if (value.length > maxItems) {
        throw new HttpsError("invalid-argument", `${fieldName} terlalu banyak.`);
    }

    return value
        .filter((item) => typeof item === "string" && item.trim())
        .map((item) => item.trim());
};

const normalizeManagedUser = (input) => {
    const allowedRoles = ["Employee", "Validator", "Reviewer", "Admin", "Super Admin"];
    const role = normalizeText(input?.role, "Role", 40);

    if (!allowedRoles.includes(role)) {
        throw new HttpsError("invalid-argument", "Role tidak dikenali.");
    }

    const isSuperAdminRole = role === "Super Admin";

    return {
        nama: normalizeText(input?.nama, "Nama", 120),
        email: normalizeText(input?.email, "Email", 254).toLowerCase(),
        role,
        posisi: isSuperAdminRole ? "" : normalizeText(input?.posisi, "Posisi", 80, false),
        unit: isSuperAdminRole ? [] : normalizeStringArray(input?.unit, "Unit bisnis"),
        department: isSuperAdminRole ? [] : normalizeStringArray(input?.department, "Department"),
        bankName: isSuperAdminRole ? "" : normalizeText(input?.bankName, "Nama bank", 80, false),
        accountNumber: isSuperAdminRole ? "" : normalizeText(input?.accountNumber, "Nomor rekening", 80, false),
        reviewer1: isSuperAdminRole ? [] : normalizeStringArray(input?.reviewer1, "Reviewer 1"),
        reviewer2: isSuperAdminRole ? [] : normalizeStringArray(input?.reviewer2, "Reviewer 2"),
        validator: isSuperAdminRole ? [] : normalizeStringArray(input?.validator, "Validator"),
        lokasi: isSuperAdminRole ? [] : normalizeStringArray(input?.lokasi, "Lokasi"),
        platKendaraan: isSuperAdminRole ? [] : normalizeStringArray(input?.platKendaraan, "Plat Kendaraan"),
    };
};

exports.createManagedUser = onCall(async (request) => {
    await requireSuperAdmin(request.auth);

    const userData = normalizeManagedUser(request.data || {});
    const temporaryPassword = `${crypto.randomBytes(18).toString("base64url")}aA1!`;
    let userRecord;

    try {
        userRecord = await getAuth().createUser({
            email: userData.email,
            displayName: userData.nama,
            password: temporaryPassword,
            emailVerified: false,
            disabled: false,
        });

        await db.collection("users").doc(userRecord.uid).set({
            uid: userRecord.uid,
            ...userData,
            createdAt: new Date().toISOString(),
            createdBy: request.auth.uid,
        });
    } catch (error) {
        if (userRecord?.uid) {
            await getAuth().deleteUser(userRecord.uid).catch(() => undefined);
        }

        if (error.code === "auth/email-already-exists") {
            throw new HttpsError("already-exists", "Email sudah terdaftar. Gunakan email lain.");
        }

        if (error.code === "auth/invalid-email") {
            throw new HttpsError("invalid-argument", "Format email tidak valid.");
        }

        console.error("Gagal membuat managed user:", error);
        throw new HttpsError("internal", "Gagal menambahkan pengguna.");
    }

    try {
        const resetLink = await getAuth().generatePasswordResetLink(userData.email);
        await sendEmail(
            userData.email,
            "Akun Samudera Indonesia Anda",
            `
                <p>Dear <strong>${userData.nama}</strong>,</p>
                <p>Akun Samudera Indonesia Anda telah dibuat. Silakan atur kata sandi melalui tautan berikut:</p>
                <p><a href="${resetLink}">Atur kata sandi</a></p>
                <p>Jika Anda tidak merasa meminta akun ini, abaikan email ini.</p>
            `
        );
    } catch (error) {
        console.error("Gagal mengirim email reset password pengguna baru:", error);
    }

    return { uid: userRecord.uid };
});

exports.deleteManagedUser = onCall(async (request) => {
    await requireSuperAdmin(request.auth);

    const uid = normalizeText(request.data?.uid, "UID", 128);
    if (uid === request.auth.uid) {
        throw new HttpsError("failed-precondition", "Anda tidak dapat menghapus akun sendiri.");
    }

    try {
        await getAuth().deleteUser(uid).catch((error) => {
            if (error.code !== "auth/user-not-found") {
                throw error;
            }
        });

        await db.collection("users").doc(uid).delete();
        return { uid };
    } catch (error) {
        console.error("Gagal menghapus managed user:", error);
        throw new HttpsError("internal", "Gagal menghapus pengguna.");
    }
});

// buildUserDirectoryEntry() dipisah ke functions/lib/userDirectory.js supaya
// bisa dites langsung (lihat komentar di file itu untuk konteks kenapa).
exports.syncUserDirectoryOnWrite = onDocumentWritten("users/{uid}", async (event) => {
    const uid = event.params.uid;
    const directoryRef = db.collection("userDirectory").doc(uid);

    if (!event.data?.after?.exists) {
        await directoryRef.delete().catch(() => undefined);
        return;
    }

    const userData = event.data.after.data();
    await directoryRef.set(buildUserDirectoryEntry(uid, userData));

    // Custom claim `role` dipakai storage.rules (lihat isSuperAdminRole()) supaya
    // tidak perlu firestore.get() dari Storage Rules -- mekanisme itu TERBUKTI
    // tidak berfungsi di produksi (rollback darurat Bagian K/21.8). Token client
    // baru bawa claim terbaru setelah refresh (otomatis tiap ~1 jam, atau re-login) --
    // ini batasan bawaan custom claims, bukan bug. Kegagalan set claim TIDAK
    // menggagalkan trigger ini (sinkronisasi userDirectory tetap harus jalan).
    try {
        await getAuth().setCustomUserClaims(uid, {
            role: typeof userData?.role === "string" ? userData.role : null
        });
    } catch (error) {
        console.error(`Gagal set custom claim role untuk ${uid}:`, error);
    }
});

// Migrasi satu-kali (aman dipanggil berkali-kali) untuk mengisi custom claim
// `role` di token Auth semua user LAMA -- trigger di atas hanya jalan untuk
// write BARU ke /users, bukan retroaktif (pola sama seperti backfillUserDirectory).
// Dipakai lewat tombol di Manage Users setelah fitur ini live.
exports.backfillCustomClaims = onCall(async (request) => {
    await requireSuperAdmin(request.auth);

    const usersSnapshot = await db.collection("users").get();

    const results = await Promise.allSettled(
        usersSnapshot.docs.map((userDoc) => {
            const data = userDoc.data();
            return getAuth().setCustomUserClaims(userDoc.id, {
                role: typeof data?.role === "string" ? data.role : null
            });
        })
    );

    const updated = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.length - updated;
    if (failed > 0) {
        console.error(`backfillCustomClaims: ${failed} user gagal di-set claim-nya.`);
    }

    return { updated, failed };
});

// Migrasi satu-kali untuk user LAMA yang sudah ada sebelum trigger di atas
// live (trigger hanya jalan untuk write BARU, bukan retroaktif). Aman dipanggil
// berkali-kali (idempotent) -- dipakai lewat tombol "Sinkronkan Direktori
// Pengguna" di halaman Manage User.
exports.backfillUserDirectory = onCall(async (request) => {
    await requireSuperAdmin(request.auth);

    const usersSnapshot = await db.collection("users").get();
    const chunks = [];
    for (let i = 0; i < usersSnapshot.docs.length; i += 400) {
        chunks.push(usersSnapshot.docs.slice(i, i + 400));
    }

    let synced = 0;
    for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach((userDoc) => {
            batch.set(db.collection("userDirectory").doc(userDoc.id), buildUserDirectoryEntry(userDoc.id, userDoc.data()));
        });
        await batch.commit();
        synced += chunk.length;
    }

    return { synced };
});

// Migrasi satu-kali untuk dokumen bonSementara/reimbursement/lpj LAMA yang sudah
// ada sebelum /displayIdOwners (lihat Bagian K/21.2) diperkenalkan -- tanpa ini,
// storage.rules akan menolak pemilik dokumen lama sendiri saat mencetak ulang
// PDF-nya (mis. tombol "Print" di Detail BS/RBS/LPJ, atau "Cetak" di
// ReimbursementTable.jsx), karena isOwnerOfDisplayId() tidak menemukan entri
// kepemilikan untuk displayId yang dibuat sebelum fitur ini live. Aman dipanggil
// berkali-kali (idempotent, pakai merge). Dipakai lewat tombol "Sinkronkan
// Kepemilikan Dokumen" di halaman Manage User.
exports.backfillDisplayIdOwners = onCall(async (request) => {
    await requireSuperAdmin(request.auth);

    const collectionsToBackfill = ["bonSementara", "reimbursement", "lpj"];
    let synced = 0;

    for (const collectionName of collectionsToBackfill) {
        const snapshot = await db.collection(collectionName).get();
        const eligibleDocs = snapshot.docs.filter((docSnap) => {
            const data = docSnap.data();
            return typeof data?.displayId === "string" && data.displayId && typeof data?.user?.uid === "string" && data.user.uid;
        });

        for (let i = 0; i < eligibleDocs.length; i += 400) {
            const chunk = eligibleDocs.slice(i, i + 400);
            const batch = db.batch();
            chunk.forEach((docSnap) => {
                const data = docSnap.data();
                batch.set(db.collection("displayIdOwners").doc(data.displayId), { uid: data.user.uid }, { merge: true });
            });
            await batch.commit();
            synced += chunk.length;
        }
    }

    return { synced };
});

// Trigger saat BS pertama kali dibuat
exports.notifyReviewer1OnCreateBS = onDocumentCreated("bonSementara/{docId}", async (event) => {
    const newData = event.data.data();
    if (!newData?.user?.reviewer1?.[0]) return;
    
    // Perbarui dokumen dengan field currentApproverUid dan lastStatusChange
    await db.collection("bonSementara").doc(event.params.docId).update({
        currentApproverUid: newData.user.reviewer1[0],
        lastStatusChange: new Date().toISOString()
    });

    const [reviewer1Data, submitterData] = await Promise.all([
        getUserData(newData.user.reviewer1[0]),
        getUserData(newData.user.uid)
    ]);

    if (!reviewer1Data?.email) return;

    const subject = `Permintaan Approval BS - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;

    const emailContent = `
        Dear <strong>${reviewer1Data.nama}</strong>,
        <br><br>Mohon untuk melakukan approval atas pengajuan BS berikut:
    `;

    await sendEmail(
        reviewer1Data.email,
        subject,
        createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
    );
});

// Trigger saat status BS berubah
exports.notifyReviewersAndUserCreateBS = onDocumentUpdated("bonSementara/{docId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();

    if (!newData || !oldData || newData.status === oldData.status) return;

    // Perbarui dokumen dengan lastStatusChange
    const docRef = db.collection("bonSementara").doc(event.params.docId);
    await docRef.update({
        lastStatusChange: new Date().toISOString()
    });

    const [reviewer1Data, reviewer2Data, submitterData] = await Promise.all([
        getUserData(newData.user.reviewer1?.[0]),
        getUserData(newData.user.reviewer2?.[0]),
        getUserData(newData.user.uid)
    ]);

    const latestStatus = newData.statusHistory?.[newData.statusHistory.length - 1];
    const actorData = latestStatus?.actor ? await getUserData(latestStatus.actor) : null;

    const getApproverInfo = async (status) => {
        const actor = status?.actor ? await getUserData(status.actor) : null;
        const isSuperAdmin = actor?.role === 'Super Admin';
        return {
            name: actor?.nama || 'Unknown',
            isSuperAdmin,
            status: status?.status || ''
        };
    };

    if (newData.status === "Ditolak") {
        await docRef.update({ currentApproverUid: null }); // Hapus current approver
        const subject = `Pengajuan BS Ditolak - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const rejectorName = actorData?.nama ||
            (latestStatus?.actor === reviewer1Data?.uid ? reviewer1Data?.nama : reviewer2Data?.nama) ||
            'Reviewer';
        const rejectReason = newData.rejectReason;
        const emailContent = `
            Dear <strong>${submitterData?.nama || newData.user.nama}</strong>,
            <br><br>Dokumen pengajuan BS anda telah ditolak oleh ${rejectorName} dengan alasan berikut:
            <br><div style="background-color: #f8d7da; padding: 10px; border-radius: 5px; color: #721c24; border: 1px solid #f5c6cb;">
                "<strong><em>${rejectReason}</em></strong>"
            </div>
        `;
        if (!submitterData?.email) {
            console.error("❌ Email pengaju tidak ditemukan untuk BS:", newData.displayId);
            return;
        }
        await sendEmail(
            submitterData.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData, false, 'rejected')
        );
        return;
    }

    if (newData.status === "Diproses" && oldData.status === "Diajukan") {
        await docRef.update({ currentApproverUid: newData.user.reviewer2?.[0] || null });
        const subject = `Permintaan Approval BS - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const approverInfo = await getApproverInfo(latestStatus);
        const approverName = approverInfo.isSuperAdmin ?
            `${approverInfo.name}` :
            (reviewer1Data?.nama || 'Reviewer 1');
        if (reviewer2Data?.email) {
            const emailContent = `
                Dear <strong>${reviewer2Data.nama}</strong>,
                <br><br>Dokumen ini telah disetujui oleh ${approverName}
                <br>Mohon untuk melakukan approval atas pengajuan BS berikut:
            `;
            await sendEmail(
                reviewer2Data.email,
                subject,
                createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
            );
        }
    }

    if (newData.status === "Disetujui" && oldData.status === "Diproses") {
        await docRef.update({ currentApproverUid: null }); // Hapus current approver
        const subject = `Pengajuan BS Disetujui - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const firstApproval = newData.statusHistory.find(
            status => status.status.includes('Disetujui') &&
            (status.status.includes('Reviewer 1') || status.status.includes('Super Admin (Pengganti Reviewer 1)'))
        );
        const secondApproval = newData.statusHistory.find(
            status => status.status.includes('Disetujui') &&
            (status.status.includes('Reviewer 2') || status.status.includes('Super Admin (Pengganti Reviewer 2)'))
        );
        const [firstApproverInfo, secondApproverInfo] = await Promise.all([
            getApproverInfo(firstApproval),
            getApproverInfo(secondApproval)
        ]);
        let approvalMessage;
        if (firstApproverInfo.isSuperAdmin && secondApproverInfo.isSuperAdmin) {
            approvalMessage = `${firstApproverInfo.name}`;
        } else if (firstApproverInfo.isSuperAdmin) {
            approvalMessage = `${firstApproverInfo.name} dan ${reviewer2Data?.nama || 'Reviewer 2'}`;
        } else if (secondApproverInfo.isSuperAdmin) {
            approvalMessage = `${reviewer1Data?.nama || 'Reviewer 1'} dan ${secondApproverInfo.name}`;
        } else {
            approvalMessage = `${reviewer1Data?.nama || 'Reviewer 1'} dan ${reviewer2Data?.nama || 'Reviewer 2'}`;
        }
        const emailContent = `
            Dear <strong>${submitterData?.nama || newData.user.nama}</strong>,
            <br><br>Dokumen pengajuan BS anda telah disetujui oleh ${approvalMessage}
        `;
        if (!submitterData?.email) {
            console.error("❌ Email pengaju tidak ditemukan untuk BS:", newData.displayId);
            return;
        }
        await sendEmail(
            submitterData.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData, false, 'approved')
        );
    }
});

// Bagian BP: satu pembuat handler untuk semua tombol "Kirim Reminder ke
// Finance" (BS -- Bagian L, RBS -- Bagian BK, LPJ -- baru). Validasinya
// identik dengan versi lama per-modul: login wajib, dokumen milik pemanggil,
// status "Disetujui", Validator tujuan benar-benar role Validator dan berbagi
// Unit Bisnis dengan pengaju (defense-in-depth, jangan percaya validatorUid
// dari client). Bedanya: email sekarang melampirkan form + lampiran dokumen
// yang SUDAH DIGABUNG jadi satu PDF (buildFormWithLampiranAttachments).
const createFinanceReminderHandler = ({ collectionName, idField, notFoundLabel, ownLabel, rejectIfTransferred = false, describe }) =>
    async (request) => {
        if (!request.auth?.uid) {
            throw new HttpsError("unauthenticated", "Anda harus login untuk menjalankan aksi ini.");
        }

        const docId = normalizeText(request.data?.[idField], `ID ${notFoundLabel}`, 200);
        const validatorUid = normalizeText(request.data?.validatorUid, "UID Validator", 128);
        const pdfUrl = normalizeText(request.data?.pdfUrl, "URL PDF", 2000, false);

        const docSnap = await db.collection(collectionName).doc(docId).get();
        if (!docSnap.exists) {
            throw new HttpsError("not-found", `Data ${notFoundLabel} tidak ditemukan.`);
        }
        const data = docSnap.data();

        if (data.user?.uid !== request.auth.uid) {
            throw new HttpsError("permission-denied", `Anda hanya bisa mengirim reminder untuk ${ownLabel} milik sendiri.`);
        }
        if (data.status !== "Disetujui") {
            throw new HttpsError("failed-precondition", `${notFoundLabel} belum berstatus Disetujui.`);
        }
        // Bagian BO: RBS yang sudah ditandai Transferred tidak perlu reminder.
        if (rejectIfTransferred && data.transferred) {
            throw new HttpsError("failed-precondition", `${notFoundLabel} ini sudah ditandai Transferred.`);
        }

        const [validatorData, submitterData] = await Promise.all([
            getUserData(validatorUid),
            getUserData(request.auth.uid)
        ]);

        if (!validatorData || validatorData.role !== "Validator") {
            throw new HttpsError("invalid-argument", "Finance (Validator) yang dipilih tidak ditemukan atau bukan role Validator.");
        }
        if (!validatorData.email) {
            throw new HttpsError("failed-precondition", "Finance yang dipilih tidak memiliki alamat email terdaftar.");
        }

        const submitterUnits = Array.isArray(submitterData?.unit) ? submitterData.unit : [];
        const validatorUnits = Array.isArray(validatorData?.unit) ? validatorData.unit : [];
        if (!submitterUnits.some((unit) => validatorUnits.includes(unit))) {
            throw new HttpsError("permission-denied", "Finance yang dipilih tidak terdaftar di Unit Bisnis Anda.");
        }

        const { subject, request: requestText } = await describe(data);
        const { attachments, note } = await buildFormWithLampiranAttachments(data.displayId, pdfUrl, data.lampiranUrl);

        const sent = await sendEmail(
            validatorData.email,
            subject,
            createEmailTemplate(`
                Dear <strong>${validatorData.nama}</strong>,
                <br><br>${requestText}
                <br>${note}
            `, submitterData, data, true, "financeReminder"),
            attachments
        );

        if (!sent) {
            throw new HttpsError("internal", "Gagal mengirim email reminder ke Finance.");
        }

        return { sent: true, to: validatorData.email };
    };

// Dipanggil dari tombol "Kirim Reminder ke Finance" di BsTable.jsx (khusus BS
// Disetujui). Lampiran BS hanya ada untuk BS > Rp3 juta (Bagian BO).
exports.sendBsFinanceReminder = onCall({ memory: "512MiB", timeoutSeconds: 120 }, createFinanceReminderHandler({
    collectionName: "bonSementara",
    idField: "bsId",
    notFoundLabel: "Bon Sementara",
    ownLabel: "BS",
    describe: async (data) => ({
        subject: `Reminder Pencairan BS - ${data.displayId}`,
        request: "Mohon dibantu maker atas BS berikut:"
    })
}));

// Bagian BK: versi RBS -- dipanggil dari ReimbursementTable.jsx. Sengaja tetap
// manual (pengingat kalau Finance lama memproses), bukan tahap approval baru.
exports.sendRbsFinanceReminder = onCall({ memory: "512MiB", timeoutSeconds: 120 }, createFinanceReminderHandler({
    collectionName: "reimbursement",
    idField: "rbsId",
    notFoundLabel: "Reimbursement",
    ownLabel: "Reimbursement",
    rejectIfTransferred: true,
    describe: async (data) => ({
        subject: `Reminder Pencairan Reimbursement - ${data.displayId}`,
        request: "Mohon dibantu maker atas Reimbursement berikut:"
    })
}));

// Bagian BP: versi LPJ -- dipanggil dari LpjBsTable.jsx. Label "LPJ"/"LPJ BS"
// mengikuti apakah BS-nya dibuat lewat sistem (Bagian BO).
exports.sendLpjFinanceReminder = onCall({ memory: "512MiB", timeoutSeconds: 120 }, createFinanceReminderHandler({
    collectionName: "lpj",
    idField: "lpjId",
    notFoundLabel: "LPJ",
    ownLabel: "LPJ",
    describe: async (data) => {
        data.bsFromSystem = await resolveLpjBsFromSystem(data);
        const label = getLpjLabel(data);
        return {
            subject: `Reminder ${label} - ${data.displayId}`,
            request: `Mohon dibantu proses atas ${label} berikut:`
        };
    }
}));


// Baca teks dari bukti pengembalian (foto/PDF struk transfer) lewat Google Cloud
// Vision OCR. Gambar pakai textDetection biasa; PDF butuh endpoint terpisah
// (batchAnnotateFiles + DOCUMENT_TEXT_DETECTION) karena Vision tidak menerima
// PDF di textDetection biasa.
const extractTextFromBuktiFile = async (buffer, contentType) => {
    if (contentType === "application/pdf") {
        const [result] = await visionClient.batchAnnotateFiles({
            requests: [{
                inputConfig: { content: buffer.toString("base64"), mimeType: "application/pdf" },
                features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
                pages: [1, 2, 3, 4, 5]
            }]
        });

        return (result.responses?.[0]?.responses || [])
            .map((page) => page.fullTextAnnotation?.text || "")
            .join("\n");
    }

    const [result] = await visionClient.textDetection({ image: { content: buffer } });
    return result.fullTextAnnotation?.text || "";
};

// textContainsAmount() dipisah ke functions/lib/pengembalianMatcher.js supaya
// bisa dites langsung.

// Upload bukti pengembalian (JPG/PNG/PDF, lihat storage.rules `lpj_pengembalian/`)
// divalidasi di sini lewat OCR: nominal `sisaLebih` LPJ harus muncul di teks hasil
// baca file. Dipanggil client SAAT upload (form LPJ maupun Detail LPJ) supaya
// pengaju langsung dapat feedback valid/tidak sesuai, bukan menunggu review manual.
exports.validatePengembalianBukti = onCall(async (request) => {
    if (!request.auth?.uid) {
        throw new HttpsError("unauthenticated", "Anda harus login untuk menjalankan aksi ini.");
    }

    const lpjId = normalizeText(request.data?.lpjId, "ID LPJ", 200);
    const fileUrl = normalizeText(request.data?.fileUrl, "URL bukti pengembalian", 2000);

    const lpjDoc = await db.collection("lpj").doc(lpjId).get();
    if (!lpjDoc.exists) {
        throw new HttpsError("not-found", "Data LPJ tidak ditemukan.");
    }
    const lpjData = lpjDoc.data();

    const requesterData = await getUserData(request.auth.uid);
    const isOwner = lpjData.user?.uid === request.auth.uid;
    const isSuperAdmin = requesterData?.role === "Super Admin";
    if (!isOwner && !isSuperAdmin) {
        throw new HttpsError("permission-denied", "Anda hanya bisa mengunggah bukti pengembalian untuk LPJ milik sendiri.");
    }

    const sisaLebih = Number(lpjData.sisaLebih) || 0;
    if (sisaLebih <= 0) {
        throw new HttpsError("failed-precondition", "LPJ ini tidak memiliki sisa lebih yang perlu dikembalikan.");
    }

    let status;
    let note;
    try {
        const response = await fetch(fileUrl);
        if (!response.ok) {
            throw new Error(`Fetch bukti gagal, status ${response.status}`);
        }
        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get("content-type") || "";

        const extractedText = await extractTextFromBuktiFile(buffer, contentType);
        const isValid = textContainsAmount(extractedText, sisaLebih);

        status = isValid ? "valid" : "tidak_sesuai";
        note = extractedText.slice(0, 1000);
    } catch (error) {
        // Bagian BA: sertakan pesan error ASLI (mis. dari Cloud Vision atau
        // fetch) ke `note` -- sebelumnya cuma pesan generik yang sama untuk
        // SEMUA jenis kegagalan (file gagal di-fetch, Vision API menolak
        // ukuran/format file, dst), jadi kalau gagal lagi di masa depan tidak
        // ada cara mendiagnosis dari UI/data tanpa buka Cloud Functions log
        // (yang tidak semua orang punya akses). Detail error tetap TIDAK
        // dianggap "sensitif" -- ini cuma info teknis soal proses baca file,
        // bukan data pribadi user lain.
        const reason = error?.message || String(error) || "error tidak diketahui"
        console.error("Gagal membaca/validasi bukti pengembalian:", reason, error);
        status = "gagal_baca";
        note = `Sistem tidak bisa membaca isi file (${reason}). Silakan cek manual atau upload ulang dengan foto/scan yang lebih jelas.`;
    }

    await lpjDoc.ref.update({
        pengembalianBuktiUrl: fileUrl,
        pengembalianStatus: status,
        pengembalianValidationNote: note,
        pengembalianUploadedAt: new Date().toISOString()
    });

    return { status, expectedAmount: sisaLebih };
});

// Bagian BM: migrasi satu-kali (aman dijalankan ulang kapan pun) untuk
// menyembuhkan LPJ yang SALAH ditandai "tidak_sesuai" oleh bug `textContainsAmount`
// yang baru diperbaiki (lihat catatan panjang di functions/lib/pengembalianMatcher.js
// -- Vision OCR kadang kehilangan separator desimal/sen PERSIS sebelum "00"
// terakhir di screenshot bukti transfer bank, bikin nominal terbaca 100x lebih
// besar & tidak pernah cocok walau foto buktinya sudah benar). Teks hasil OCR
// SUDAH tersimpan di `pengembalianValidationNote` sejak awal (Bagian BA) --
// jadi TIDAK PERLU fetch ulang file/panggil Vision API lagi, cukup cocokkan
// ulang teks yang sudah ada pakai logika BARU. Hanya menyentuh status
// "tidak_sesuai" (BUKAN "gagal_baca", yang teksnya mungkin kosong/tidak
// representatif -- tetap butuh upload ulang beneran).
exports.backfillPengembalianValidation = onCall(async (request) => {
    await requireSuperAdmin(request.auth);

    const snapshot = await db.collection("lpj")
        .where("pengembalianStatus", "==", "tidak_sesuai")
        .get();

    let fixed = 0;
    const fixedDisplayIds = [];
    for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const sisaLebih = Number(data.sisaLebih) || 0;
        if (sisaLebih <= 0 || !data.pengembalianValidationNote) continue;

        const nowValid = textContainsAmount(data.pengembalianValidationNote, sisaLebih);
        if (!nowValid) continue;

        await docSnap.ref.update({
            pengembalianStatus: "valid",
            pengembalianRevalidatedAt: new Date().toISOString()
        });
        fixed += 1;
        fixedDisplayIds.push(data.displayId);
    }

    return { checked: snapshot.size, fixed, fixedDisplayIds };
});

// -----------------------------------------------------------------------------------
// Bagian BO: dokumen Disetujui -> Finance, dan bukti pengembalian di lampiran LPJ
// -----------------------------------------------------------------------------------

// Hanya URL unduhan Firebase Storage milik project ini yang boleh di-fetch
// server -- supaya callable di bawah tidak bisa dipakai mengambil URL sembarang.
const isOwnStorageUrl = (url) => {
    if (typeof url !== "string" || !url) return false;
    const bucketName = getStorage().bucket().name;
    return url.startsWith(`https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/`);
};

const fetchStorageFile = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Fetch file gagal, status ${response.status}`);
    }
    return {
        buffer: Buffer.from(await response.arrayBuffer()),
        contentType: response.headers.get("content-type") || ""
    };
};

const mergePdfBuffers = async (buffers) => {
    const merged = await PDFDocument.create();
    for (const buffer of buffers) {
        const source = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const pages = await merged.copyPages(source, source.getPageIndices());
        pages.forEach((page) => merged.addPage(page));
    }
    return Buffer.from(await merged.save());
};

// Batas lampiran Gmail 25MB -- disisakan ruang untuk overhead encoding email.
const EMAIL_ATTACHMENT_MAX_BYTES = 18 * 1024 * 1024;

// Bagian BP: lampiran email ke Finance = PDF form resmi + lampiran dokumen,
// digabung jadi SATU file. Dipakai email "Disetujui - Siap Diproses" dan
// semua tombol "Reminder ke Finance" (BS/RBS/LPJ). Kalau penggabungan gagal
// (mis. PDF lampiran rusak), dikirim sebagai dua file terpisah; kalau terlalu
// besar untuk email, tidak dilampirkan dan `note` meminta Finance membuka
// website. `note` siap disisipkan ke isi email.
const buildFormWithLampiranAttachments = async (displayId, formPdfUrl, lampiranUrl) => {
    const pdfParts = [];
    for (const url of [formPdfUrl, lampiranUrl]) {
        if (!isOwnStorageUrl(url)) continue;
        try {
            pdfParts.push((await fetchStorageFile(url)).buffer);
        } catch (error) {
            console.error(`Gagal mengambil file untuk ${displayId}:`, error);
        }
    }

    if (pdfParts.length === 0) {
        return { attachments: [], note: "Form/lampiran tidak berhasil dilampirkan, silakan buka & cetak melalui website." };
    }

    let combined;
    try {
        combined = await mergePdfBuffers(pdfParts);
    } catch (error) {
        console.error(`Gagal menggabungkan PDF ${displayId}, dikirim terpisah:`, error);
    }
    const files = combined
        ? [{ filename: `${displayId}.pdf`, content: combined }]
        : pdfParts.map((content, index) => ({
            filename: index === 0 ? `${displayId}.pdf` : `Lampiran_${displayId}.pdf`,
            content
        }));

    const totalBytes = files.reduce((sum, file) => sum + file.content.length, 0);
    if (totalBytes > EMAIL_ATTACHMENT_MAX_BYTES) {
        return { attachments: [], note: "File form + lampiran terlalu besar untuk dikirim lewat email, silakan buka & cetak melalui website." };
    }

    return {
        attachments: files.map((file) => ({ ...file, contentType: "application/pdf" })),
        note: pdfParts.length > 1
            ? "Terlampir form beserta lampirannya dalam satu file PDF."
            : "Terlampir form dalam file PDF."
    };
};

// Dipanggil client (utils/approvalWorkflow.js) tepat setelah RBS/LPJ mencapai
// "Disetujui" penuh -- client lebih dulu men-generate & mengunggah PDF form resmi
// (react-pdf cuma bisa dirender di client), lalu fungsi ini menggabungkan form +
// lampiran jadi SATU PDF dan mengirimkannya ke SEMUA Validator (Finance) yang
// terdaftar di Unit Bisnis dokumen tsb. Idempoten lewat `approvedNotifSentAt`.
exports.sendApprovedDocToValidators = onCall({ memory: "512MiB", timeoutSeconds: 120 }, async (request) => {
    if (!request.auth?.uid) {
        throw new HttpsError("unauthenticated", "Anda harus login untuk menjalankan aksi ini.");
    }

    const collectionName = request.data?.collectionName;
    if (!["reimbursement", "lpj"].includes(collectionName)) {
        throw new HttpsError("invalid-argument", "Jenis dokumen tidak dikenali.");
    }
    const docId = normalizeText(request.data?.docId, "ID dokumen", 200);
    const pdfUrl = normalizeText(request.data?.pdfUrl, "URL PDF", 2000, false);

    const docRef = db.collection(collectionName).doc(docId);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
        throw new HttpsError("not-found", "Dokumen tidak ditemukan.");
    }
    const data = docSnap.data();
    if (data.status !== "Disetujui") {
        throw new HttpsError("failed-precondition", "Dokumen belum berstatus Disetujui.");
    }

    const requesterData = await getUserData(request.auth.uid);
    const isSuperAdmin = requesterData?.role === "Super Admin";
    const isApprover = ["validator", "reviewer1", "reviewer2"].some((field) =>
        Array.isArray(data.user?.[field]) && data.user[field].includes(request.auth.uid)
    );
    if (!isSuperAdmin && !isApprover) {
        throw new HttpsError("permission-denied", "Hanya approver dokumen ini yang bisa mengirimkannya ke Finance.");
    }

    // Klaim lewat transaksi supaya dua panggilan bersamaan tidak sama-sama
    // mengirim email; klaim dilepas lagi kalau pengiriman gagal total.
    const claimed = await db.runTransaction(async (transaction) => {
        const fresh = await transaction.get(docRef);
        const freshData = fresh.data() || {};
        if (freshData.approvedNotifSentAt || freshData.approvedNotifClaimedAt) return false;
        transaction.update(docRef, { approvedNotifClaimedAt: new Date().toISOString() });
        return true;
    });
    if (!claimed) {
        return { skipped: true };
    }

    try {
        if (collectionName === "lpj") {
            data.bsFromSystem = await resolveLpjBsFromSystem(data);
        }
        const docLabel = collectionName === "lpj" ? getLpjLabel(data) : "Reimbursement";
        const docUnit = data.user?.unit;

        const validatorsSnapshot = await db.collection("users").where("role", "==", "Validator").get();
        const recipients = validatorsSnapshot.docs
            .map((userDoc) => userDoc.data())
            .filter((user) => user.email && Array.isArray(user.unit) && user.unit.includes(docUnit));

        if (recipients.length === 0) {
            console.warn(`Tidak ada Validator untuk unit ${docUnit}, ${data.displayId} tidak dikirim ke Finance.`);
            await docRef.update({ approvedNotifClaimedAt: null });
            return { sent: 0, reason: "no-validator" };
        }

        const { attachments, note: attachmentNote } = await buildFormWithLampiranAttachments(data.displayId, pdfUrl, data.lampiranUrl);

        const submitterData = await getUserData(data.user?.uid);
        const subject = `${docLabel} Disetujui - ${data.displayId} - Siap Diproses`;
        const results = await Promise.all(recipients.map((validator) => sendEmail(
            validator.email,
            subject,
            createEmailTemplate(`
                Dear <strong>${validator.nama}</strong>,
                <br><br>Pengajuan ${docLabel} berikut telah disetujui penuh dan siap diproses.
                <br>${attachmentNote}
            `, submitterData, data, true, "approvedForFinance"),
            attachments
        )));

        const sentTo = recipients.filter((_, index) => results[index]).map((validator) => validator.email);
        if (sentTo.length === 0) {
            await docRef.update({ approvedNotifClaimedAt: null });
            throw new HttpsError("internal", "Gagal mengirim email ke Finance.");
        }

        await docRef.update({
            approvedNotifSentAt: new Date().toISOString(),
            approvedNotifRecipients: sentTo
        });
        return { sent: sentTo.length, withAttachment: attachments.length > 0 };
    } catch (error) {
        if (error instanceof HttpsError) throw error;
        await docRef.update({ approvedNotifClaimedAt: null }).catch(() => {});
        console.error(`sendApprovedDocToValidators gagal untuk ${data.displayId}:`, error);
        throw new HttpsError("internal", "Gagal mengirim dokumen ke Finance.");
    }
});

// Kata-kata khas bukti transfer -- dipakai bersama pencocokan nominal supaya
// nota belanja biasa di lampiran yang kebetulan bernilai sama dengan sisa lebih
// tidak dianggap bukti pengembalian.
const TRANSFER_PROOF_PATTERN = /(transfer|trf|berhasil|sukses|successful|rekening|penerima|pengirim|no\.?\s*ref|referensi|mutasi|setor|m-?banking|livin|brimo|bca|mandiri|bni|bri|btn|bsi|cimb|ocbc|danamon|permata|jago|seabank)/i;
const LAMPIRAN_OCR_MAX_PAGES = 30;
const VISION_PAGES_PER_REQUEST = 5;

// OCR per halaman lampiran (PDF gabungan atau gambar). Halaman dibaca dari
// BELAKANG (bukti transfer biasanya dilampirkan paling akhir) dan berhenti di
// halaman pertama yang cocok, supaya panggilan Vision API seminimal mungkin.
const findPengembalianInLampiran = async (buffer, contentType, sisaLebih) => {
    const matches = (text) => textContainsAmount(text, sisaLebih) && TRANSFER_PROOF_PATTERN.test(text);

    if (contentType !== "application/pdf") {
        const [result] = await visionClient.textDetection({ image: { content: buffer } });
        const text = result.fullTextAnnotation?.text || "";
        return matches(text) ? { page: 1, text } : null;
    }

    let pageCount = VISION_PAGES_PER_REQUEST;
    try {
        pageCount = (await PDFDocument.load(buffer, { ignoreEncryption: true })).getPageCount();
    } catch (error) {
        console.warn("Gagal membaca jumlah halaman lampiran, OCR 5 halaman pertama saja:", error?.message);
    }

    const firstPage = Math.max(1, pageCount - LAMPIRAN_OCR_MAX_PAGES + 1);
    for (let end = pageCount; end >= firstPage; end -= VISION_PAGES_PER_REQUEST) {
        const start = Math.max(firstPage, end - VISION_PAGES_PER_REQUEST + 1);
        const pages = [];
        for (let page = start; page <= end; page++) pages.push(page);

        const [result] = await visionClient.batchAnnotateFiles({
            requests: [{
                inputConfig: { content: buffer.toString("base64"), mimeType: "application/pdf" },
                features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
                pages
            }]
        });
        const pageResponses = result.responses?.[0]?.responses || [];
        for (let index = pageResponses.length - 1; index >= 0; index--) {
            const text = pageResponses[index]?.fullTextAnnotation?.text || "";
            if (matches(text)) return { page: pages[index], text };
        }
    }
    return null;
};

// Permintaan SMDR-Finance: kalau pengaju menaruh bukti transfer pengembalian di
// Lampiran LPJ biasa (bukan lewat tombol "Upload Bukti Pengembalian"), sistem
// membacanya otomatis. Jalan saat LPJ dibuat ATAU lampirannya diganti. Hanya
// menandai "valid" kalau ketemu -- kalau tidak ketemu, status pengembalian
// dibiarkan apa adanya (lampiran biasa memang tidak wajib berisi bukti
// transfer, jadi tidak boleh menandainya "tidak sesuai").
exports.autoValidatePengembalianFromLampiran = onDocumentWritten(
    { document: "lpj/{docId}", memory: "512MiB", timeoutSeconds: 120 },
    async (event) => {
        const after = event.data?.after?.data();
        if (!after) return;
        const before = event.data?.before?.data();
        if (before && before.lampiranUrl === after.lampiranUrl) return;

        const sisaLebih = Number(after.sisaLebih) || 0;
        if (sisaLebih <= 0 || !isOwnStorageUrl(after.lampiranUrl)) return;
        if (["valid", "grandfathered"].includes(after.pengembalianStatus)) return;

        let found;
        try {
            const { buffer, contentType } = await fetchStorageFile(after.lampiranUrl);
            found = await findPengembalianInLampiran(buffer, contentType, sisaLebih);
        } catch (error) {
            console.error(`OCR lampiran LPJ ${after.displayId} gagal:`, error?.message || error);
            return;
        }
        if (!found) return;

        const docRef = event.data.after.ref;
        await db.runTransaction(async (transaction) => {
            const fresh = (await transaction.get(docRef)).data() || {};
            if (["valid", "grandfathered"].includes(fresh.pengembalianStatus)) return;
            if (fresh.lampiranUrl !== after.lampiranUrl) return;
            transaction.update(docRef, {
                pengembalianBuktiUrl: after.lampiranUrl,
                pengembalianStatus: "valid",
                pengembalianSource: "lampiran_lpj",
                pengembalianValidationNote: `Terdeteksi otomatis dari Lampiran LPJ (halaman ${found.page}): ${found.text.slice(0, 900)}`,
                pengembalianUploadedAt: new Date().toISOString()
            });
        });
        console.log(`Bukti pengembalian ${after.displayId} terdeteksi otomatis di lampiran halaman ${found.page}.`);
    }
);

// Bagian AW: upload file (lampiran RBS/LPJ, PDF resmi hasil cetak, bukti
// pengembalian) untuk path Storage yang SEBELUMNYA divalidasi client-side
// tanpa cek kepemilikan sama sekali (lihat "ROLLBACK DARURAT" di
// storage.rules -- mekanisme firestore.get() cross-service dari DALAM
// Storage Rules TERBUKTI tidak bekerja di produksi, sempat memblokir SEMUA
// upload untuk SEMUA user). Solusinya: upload lewat Cloud Function ini
// (Admin SDK, query Firestore BIASA -- bukan cross-service, terbukti selalu
// bekerja) yang mengecek kepemilikan SEBELUM menulis ke Storage.
// storage.rules sekarang `allow write: if false` untuk path-path ini --
// SEMUA upload wajib lewat sini.
//
// `ownership.mode`:
//  - 'displayIdOwners': untuk lampiran RBS/LPJ (baru diajukan ATAU sedang
//    diedit Super Admin). Kalau /displayIdOwners/{displayId} SUDAH ada
//    (pengajuan lama, sedang diedit), uid pemiliknya harus cocok dengan
//    pengunggah (kecuali Super Admin). Kalau BELUM ada (pengajuan baru,
//    belum sempat submit dokumen utamanya), diizinkan -- kepemilikan
//    sebenarnya dikunci nanti oleh firestore.rules `canCreateWorkflow` saat
//    dokumen bonSementara/reimbursement/lpj-nya benar-benar dibuat.
//  - 'workflowDoc': untuk cetak ulang PDF resmi dokumen yang SUDAH ADA
//    (Disetujui) -- kepemilikan dicek langsung ke dokumen bonSementara/
//    reimbursement/lpj asli (pemilik ATAU validator/reviewer1/reviewer2
//    yang tercatat di dokumen itu, sama seperti canReadWorkflow() di
//    firestore.rules, supaya approver yang berhak lihat dokumennya juga
//    tetap bisa cetak ulang PDF-nya).
// Super Admin selalu diizinkan tanpa syarat tambahan, di kedua mode.
const ALLOWED_STORAGE_PREFIXES = ["Reimbursement/", "BonSementara/", "LPJ/", "lampiran_lpj/", "lpj_pengembalian/"];
const UPLOAD_MAX_BYTES = 20 * 1024 * 1024; // 20MB -- lihat catatan batas request Cloud Functions di uploadPdfFile.js

exports.uploadOwnedFile = onCall({ memory: "512MiB", timeoutSeconds: 60 }, async (request) => {
    if (!request.auth?.uid) {
        throw new HttpsError("unauthenticated", "Anda harus login untuk mengunggah file.");
    }

    const storagePath = normalizeText(request.data?.storagePath, "Path penyimpanan", 500);
    const contentType = normalizeText(request.data?.contentType, "Tipe konten", 100);
    const fileBase64 = request.data?.fileBase64;
    const ownership = request.data?.ownership || {};

    if (!ALLOWED_STORAGE_PREFIXES.some((prefix) => storagePath.startsWith(prefix))) {
        throw new HttpsError("invalid-argument", "Lokasi penyimpanan tidak diizinkan.");
    }
    // Cegah path traversal (mis. "Reimbursement/../../secret") -- storagePath
    // dipakai langsung sebagai path objek Storage di bawah.
    if (storagePath.includes("..") || storagePath.includes("//")) {
        throw new HttpsError("invalid-argument", "Path penyimpanan tidak valid.");
    }
    if (typeof fileBase64 !== "string" || !fileBase64) {
        throw new HttpsError("invalid-argument", "File tidak boleh kosong.");
    }

    let buffer;
    try {
        buffer = Buffer.from(fileBase64, "base64");
    } catch (error) {
        throw new HttpsError("invalid-argument", "File gagal dibaca.");
    }
    if (buffer.length === 0 || buffer.length > UPLOAD_MAX_BYTES) {
        throw new HttpsError("invalid-argument", `Ukuran file maksimal ${Math.round(UPLOAD_MAX_BYTES / (1024 * 1024))}MB.`);
    }

    const uid = request.auth.uid;
    const requesterData = await syncAuthenticatedUserProfile(request.auth);
    const isSuperAdmin = requesterData?.role === "Super Admin";

    if (!isSuperAdmin) {
        if (ownership.mode === "displayIdOwners") {
            const displayId = normalizeText(ownership.displayId, "displayId", 200);
            const ownerDoc = await db.collection("displayIdOwners").doc(displayId).get();
            if (ownerDoc.exists && ownerDoc.data()?.uid !== uid) {
                throw new HttpsError("permission-denied", "Anda tidak berhak mengunggah file untuk dokumen ini.");
            }
        } else if (ownership.mode === "workflowDoc") {
            const collectionName = ownership.collectionName;
            if (!["bonSementara", "reimbursement", "lpj"].includes(collectionName)) {
                throw new HttpsError("invalid-argument", "Koleksi dokumen tidak dikenali.");
            }
            const docId = normalizeText(ownership.docId, "ID dokumen", 200);
            const docSnap = await db.collection(collectionName).doc(docId).get();
            if (!docSnap.exists) {
                throw new HttpsError("not-found", "Dokumen tidak ditemukan.");
            }
            const data = docSnap.data();
            const isOwner = data.user?.uid === uid;
            const isApprover = ["validator", "reviewer1", "reviewer2"].some((field) =>
                Array.isArray(data.user?.[field]) && data.user[field].includes(uid)
            );
            if (!isOwner && !isApprover) {
                throw new HttpsError("permission-denied", "Anda tidak berhak mengunggah file untuk dokumen ini.");
            }
        } else {
            throw new HttpsError("invalid-argument", "Mode kepemilikan tidak dikenali.");
        }
    }

    const bucket = getStorage().bucket();
    const file = bucket.file(storagePath);
    const downloadToken = crypto.randomUUID();
    // contentType disertakan DUA kali dengan sengaja (shorthand top-level DAN
    // nested di dalam `metadata`) -- beberapa versi @google-cloud/storage cuma
    // menghormati salah satu bentuk tergantung apakah `metadata` juga
    // disertakan di request yang sama. Redundan tapi aman, menghilangkan
    // ambiguitas supaya contentType (dipakai validatePengembalianBukti buat
    // menentukan PDF vs gambar) selalu tersimpan benar di objek Storage-nya.
    await file.save(buffer, {
        resumable: false,
        contentType,
        metadata: {
            contentType,
            metadata: { firebaseStorageDownloadTokens: downloadToken }
        }
    });

    // Format URL identik dengan yang dikembalikan getDownloadURL() client SDK
    // (token-based, bisa diakses tanpa header auth) supaya field lampiranUrl/
    // pdfUrl yang disimpan ke Firestore tetap bisa dibuka seperti sebelumnya.
    const encodedPath = encodeURIComponent(storagePath);
    const downloadURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodedPath}?alt=media&token=${downloadToken}`;

    return { downloadURL };
});

// Trigger saat Reimbursement pertama kali dibuat
exports.notifyValidatorOnCreateRBS = onDocumentCreated("reimbursement/{docId}", async (event) => {
    const newData = event.data.data();
    if (!newData?.user?.validator?.length) return;

    // Perbarui dokumen dengan currentApproverUid dan lastStatusChange
    await db.collection("reimbursement").doc(event.params.docId).update({
        currentApproverUid: newData.user.validator[0],
        lastStatusChange: new Date().toISOString()
    });

    const submitterData = await getUserData(newData.user.uid);
    const validatorPromises = newData.user.validator.map(validatorId => getUserData(validatorId));
    const validatorsData = await Promise.all(validatorPromises);
    const emailPromises = validatorsData
        .filter(validator => validator?.email)
        .map(validatorData => {
            const subject = `Permintaan Approval Reimbursement - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
            const emailContent = `
                Dear <strong>${validatorData.nama}</strong>,
                <br><br>Mohon untuk melakukan validasi atas pengajuan Reimbursement berikut:
            `;
            return sendEmail(
                validatorData.email,
                subject,
                createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
            );
        });
    await Promise.all(emailPromises);
});

// Trigger saat status Reimbursement berubah
exports.notifyReviewersAndUserRBS = onDocumentUpdated("reimbursement/{docId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    if (!newData || !oldData || newData.status === oldData.status) return;

    // Perbarui dokumen dengan lastStatusChange
    const docRef = db.collection("reimbursement").doc(event.params.docId);
    await docRef.update({
        lastStatusChange: new Date().toISOString()
    });

    const [reviewer1Data, reviewer2Data, submitterData] = await Promise.all([
        getUserData(newData.user.reviewer1?.[0]),
        getUserData(newData.user.reviewer2?.[0]),
        getUserData(newData.user.uid)
    ]);
    const latestStatus = newData.statusHistory?.[newData.statusHistory.length - 1];
    const actorData = latestStatus?.actor ? await getUserData(latestStatus.actor) : null;

    if (newData.status === "Ditolak") {
        await docRef.update({ currentApproverUid: null });
        const subject = `Pengajuan Reimbursement Ditolak - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const rejectorName = actorData?.nama || 'Reviewer';
        const rejectReason = newData.rejectReason;
        const emailContent = `
            Dear <strong>${submitterData?.nama || newData.user.nama}</strong>,
            <br><br>Dokumen pengajuan Reimbursement anda telah ditolak oleh ${rejectorName} dengan alasan berikut:
            <br><div style="background-color: #f8d7da; padding: 10px; border-radius: 5px; color: #721c24; border: 1px solid #f5c6cb;">
                "<strong><em>${rejectReason}</em></strong>"
            </div>
        `;
        if (submitterData?.email) {
            await sendEmail(
                submitterData.email,
                subject,
                createEmailTemplate(emailContent, submitterData, newData, false, 'rejected')
            );
        }
        return;
    }
    const latestStatusType = latestStatus?.status;
    const statusHistory = newData.statusHistory || [];
    // PENTING: sentinel harus `undefined`, BUKAN `null`. Di bawah, currentApproverUid
    // cuma di-update kalau nextApproverUid !== undefined -- kalau diinisialisasi `null`,
    // pengecekan itu selalu true, jadi status yang TIDAK cocok dengan salah satu string
    // di bawah (mis. typo baru di frontend, atau status yang belum ditangani di sini)
    // akan diam-diam menge-null-kan currentApproverUid walau approval belum selesai,
    // membuat dokumen itu tidak muncul lagi di dashboard approver mana pun.
    let nextApproverUid;

    if (latestStatusType === "Disetujui oleh Super Admin (Pengganti Validator)" && reviewer1Data?.email) {
        nextApproverUid = newData.user.reviewer1[0];
        const subject = `Permintaan Approval Reimbursement - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const emailContent = `
            Dear <strong>${reviewer1Data.nama}</strong>,
            <br><br>Dokumen ini telah divalidasi oleh ${actorData?.nama || 'Super Admin'}
            <br>Mohon untuk melakukan approval atas pengajuan Reimbursement berikut:
        `;
        await sendEmail(
            reviewer1Data.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
        );
    } else if (latestStatusType === "Disetujui oleh Super Admin (Pengganti Reviewer 1)" && reviewer2Data?.email) {
        nextApproverUid = newData.user.reviewer2[0];
        const validatorStatus = statusHistory.find(status =>
            status.status === "Disetujui oleh Super Admin (Pengganti Validator)"
        );
        const isSameSuperAdmin = validatorStatus && validatorStatus.actor === latestStatus.actor;
        const subject = `Permintaan Approval Reimbursement - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        let emailContent;
        if (isSameSuperAdmin) {
            emailContent = `
                Dear <strong>${reviewer2Data.nama}</strong>,
                <br><br>Dokumen ini telah divalidasi dan disetujui oleh ${actorData?.nama || 'Super Admin'}
                <br>Mohon untuk melakukan approval atas pengajuan Reimbursement berikut:
            `;
        } else {
            const validatorData = validatorStatus?.actor ? await getUserData(validatorStatus.actor) : null;
            emailContent = `
                Dear <strong>${reviewer2Data.nama}</strong>,
                <br><br>Dokumen ini telah divalidasi oleh ${validatorData?.nama || 'Validator'} dan disetujui oleh ${actorData?.nama || 'Super Admin'}
                <br>Mohon untuk melakukan approval atas pengajuan Reimbursement berikut:
            `;
        }
        await sendEmail(
            reviewer2Data.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
        );
    } else if (latestStatusType === "Disetujui oleh Reviewer 1 Sekaligus Validator" && reviewer2Data?.email) {
        nextApproverUid = newData.user.reviewer2[0];
        const subject = `Permintaan Approval Reimbursement - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const emailContent = `
            Dear <strong>${reviewer2Data.nama}</strong>,
            <br><br>Dokumen ini telah divalidasi dan disetujui oleh ${actorData?.nama || 'Validator & Reviewer 1'}
            <br>Mohon untuk melakukan approval atas pengajuan Reimbursement berikut:
        `;
        await sendEmail(
            reviewer2Data.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
        );
    } else if (latestStatusType === "Disetujui oleh Validator" && reviewer1Data?.email) {
        nextApproverUid = newData.user.reviewer1[0];
        const subject = `Permintaan Approval Reimbursement - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const emailContent = `
            Dear <strong>${reviewer1Data.nama}</strong>,
            <br><br>Dokumen ini telah divalidasi oleh ${actorData?.nama || 'Validator'}
            <br>Mohon untuk melakukan approval atas pengajuan Reimbursement berikut:
        `;
        await sendEmail(
            reviewer1Data.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
        );
    } else if (latestStatusType === "Disetujui oleh Reviewer 1" && reviewer2Data?.email) {
        nextApproverUid = newData.user.reviewer2[0];
        const validatorStatus = newData.statusHistory?.find(status =>
            status.status === "Disetujui oleh Validator" ||
            status.status === "Disetujui oleh Super Admin (Pengganti Validator)"
        );
        const validatorData = validatorStatus?.actor ? await getUserData(validatorStatus.actor) : null;
        const subject = `Permintaan Approval Reimbursement - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const emailContent = `
            Dear <strong>${reviewer2Data.nama}</strong>,
            <br><br>Dokumen ini telah divalidasi oleh ${validatorData?.nama || 'Validator'} dan disetujui oleh ${reviewer1Data?.nama || 'Reviewer 1'}
            <br>Mohon untuk melakukan approval atas pengajuan Reimbursement berikut:
        `;
        await sendEmail(
            reviewer2Data.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
        );
    } else if ((latestStatusType === "Disetujui oleh Reviewer 2" || latestStatusType === "Disetujui oleh Super Admin (Pengganti Reviewer 2)")
        && newData.status === "Disetujui") {
        nextApproverUid = null; // Approval selesai, tidak ada lagi approver
        const subject = `Pengajuan Reimbursement Disetujui - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const hasValidatorReviewer1Status = statusHistory.some(status =>
            status.status === "Disetujui oleh Reviewer 1 Sekaligus Validator"
        );
        const allSuperAdminApprovals =
            statusHistory.some(status => status.status.includes("Super Admin (Pengganti Validator)")) &&
            statusHistory.some(status => status.status.includes("Super Admin (Pengganti Reviewer 1)")) &&
            statusHistory.some(status => status.status.includes("Super Admin (Pengganti Reviewer 2)"));
        let emailContent;
        if (allSuperAdminApprovals) {
            const superAdminData = actorData;
            emailContent = `
                Dear <strong>${submitterData?.nama || newData.user.nama}</strong>,
                <br><br>Dokumen pengajuan Reimbursement anda telah sepenuhnya disetujui oleh ${superAdminData?.nama || 'Super Admin'}
            `;
        } else if (hasValidatorReviewer1Status) {
            const lastApprover = latestStatusType === "Disetujui oleh Super Admin (Pengganti Reviewer 2)" ?
                actorData?.nama || 'Super Admin' :
                reviewer2Data?.nama || 'Reviewer 2';
            emailContent = `
                Dear <strong>${submitterData?.nama || newData.user.nama}</strong>,
                <br><br>Dokumen pengajuan Reimbursement anda telah divalidasi dan disetujui oleh ${reviewer1Data?.nama || 'Reviewer 1'} serta ${lastApprover}
            `;
        } else {
            const validatorStatus = statusHistory.find(status =>
                status.status === "Disetujui oleh Validator" ||
                status.status === "Disetujui oleh Super Admin (Pengganti Validator)"
            );
            const reviewer1Status = statusHistory.find(status =>
                status.status === "Disetujui oleh Reviewer 1" ||
                status.status === "Disetujui oleh Super Admin (Pengganti Reviewer 1)"
            );
            const validatorData = validatorStatus?.actor ? await getUserData(validatorStatus.actor) : null;
            const reviewer1ActorData = reviewer1Status?.actor ? await getUserData(reviewer1Status.actor) : null;
            const isSameSuperAdmin = validatorStatus?.actor === reviewer1Status?.actor &&
                validatorStatus?.status.includes("Super Admin") &&
                reviewer1Status?.status.includes("Super Admin");
            if (isSameSuperAdmin) {
                const superAdminData = validatorData;
                const reviewer2Name = latestStatusType === "Disetujui oleh Super Admin (Pengganti Reviewer 2)" ?
                    `${actorData?.nama || 'Super Admin'}` :
                    `${reviewer2Data?.nama || 'Reviewer 2'}`;
                emailContent = `
                    Dear <strong>${submitterData?.nama || newData.user.nama}</strong>,
                    <br><br>Dokumen pengajuan Reimbursement anda telah divalidasi dan disetujui oleh ${superAdminData?.nama || 'Super Admin'} serta ${reviewer2Name}
                `;
            } else {
                const validatorName = validatorStatus?.status.includes("Super Admin") ?
                    `${validatorData?.nama || 'Super Admin'}` :
                    `${validatorData?.nama || 'Validator'}`;
                const reviewer1Name = reviewer1Status?.status.includes("Super Admin") ?
                    `${reviewer1ActorData?.nama || 'Super Admin'}` :
                    `${reviewer1Data?.nama || 'Reviewer 1'}`;
                const reviewer2Name = latestStatusType === "Disetujui oleh Super Admin (Pengganti Reviewer 2)" ?
                    `${actorData?.nama || 'Super Admin'}` :
                    `${reviewer2Data?.nama || 'Reviewer 2'}`;
                emailContent = `
                    Dear <strong>${submitterData?.nama || newData.user.nama}</strong>,
                    <br><br>Dokumen pengajuan Reimbursement anda telah divalidasi oleh ${validatorName} serta disetujui oleh ${reviewer1Name} dan ${reviewer2Name}
                `;
            }
        }
        if (submitterData?.email) {
            await sendEmail(
                submitterData.email,
                subject,
                createEmailTemplate(emailContent, submitterData, newData, false, 'approved')
            );
        }
    }
    // Perbarui dokumen dengan currentApproverUid yang baru
    if (nextApproverUid !== undefined) {
        await docRef.update({ currentApproverUid: nextApproverUid });
    }
});

// Trigger saat LPJ pertama kali dibuat
exports.notifyValidatorOnCreateLPJ = onDocumentCreated("lpj/{docId}", async (event) => {
    const newData = event.data.data();
    if (!newData?.user?.validator?.length) return;

    newData.bsFromSystem = await resolveLpjBsFromSystem(newData);
    const lpjLabel = getLpjLabel(newData);

    // Perbarui dokumen dengan currentApproverUid dan lastStatusChange
    await db.collection("lpj").doc(event.params.docId).update({
        currentApproverUid: newData.user.validator[0],
        lastStatusChange: new Date().toISOString(),
        bsFromSystem: newData.bsFromSystem
    });

    const submitterData = await getUserData(newData.user.uid);
    const validatorPromises = newData.user.validator.map(validatorId => getUserData(validatorId));
    const validatorsData = await Promise.all(validatorPromises);
    const emailPromises = validatorsData
        .filter(validator => validator?.email)
        .map(validatorData => {
            const subject = `Permintaan Approval ${lpjLabel} - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
            const emailContent = `
                Dear <strong>${validatorData.nama}</strong>,
                <br><br>Mohon untuk melakukan validasi atas pengajuan ${lpjLabel} berikut:
            `;
            return sendEmail(
                validatorData.email,
                subject,
                createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
            );
        });
    await Promise.all(emailPromises);
});

// Trigger saat status LPJ berubah
exports.notifyReviewersAndUserLPJ = onDocumentUpdated("lpj/{docId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();
    if (!newData || !oldData || newData.status === oldData.status) return;

    // Perbarui dokumen dengan lastStatusChange
    const docRef = db.collection("lpj").doc(event.params.docId);
    await docRef.update({
        lastStatusChange: new Date().toISOString()
    });

    const [reviewer1Data, reviewer2Data, submitterData] = await Promise.all([
        getUserData(newData.user.reviewer1?.[0]),
        getUserData(newData.user.reviewer2?.[0]),
        getUserData(newData.user.uid)
    ]);
    newData.bsFromSystem = await resolveLpjBsFromSystem(newData);
    const lpjLabel = getLpjLabel(newData);
    const latestStatus = newData.statusHistory?.[newData.statusHistory.length - 1];
    const actorData = latestStatus?.actor ? await getUserData(latestStatus.actor) : null;
    // PENTING: sentinel harus `undefined`, BUKAN `null` -- lihat penjelasan di
    // notifyReviewersAndUserRBS. Kalau diinisialisasi `null`, status yang tidak cocok
    // dengan string manapun di bawah akan diam-diam menge-null-kan currentApproverUid.
    let nextApproverUid;

    if (newData.status === "Ditolak") {
        await docRef.update({ currentApproverUid: null });
        const subject = `Pengajuan ${lpjLabel} Ditolak - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const rejectorName = actorData?.nama || 'Reviewer';
        const rejectReason = newData.rejectReason;
        const emailContent = `
            Dear <strong>${submitterData?.nama || newData.user.nama}</strong>,
            <br><br>Dokumen pengajuan ${lpjLabel} anda telah ditolak oleh ${rejectorName} dengan alasan berikut:
            <br><div style="background-color: #f8d7da; padding: 10px; border-radius: 5px; color: #721c24; border: 1px solid #f5c6cb;">
                "<strong><em>${rejectReason}</em></strong>"
            </div>
        `;
        if (submitterData?.email) {
            await sendEmail(
                submitterData.email,
                subject,
                createEmailTemplate(emailContent, submitterData, newData, false, 'rejected')
            );
        }
        return;
    }
    const latestStatusType = latestStatus?.status;
    const statusHistory = newData.statusHistory || [];
    if (latestStatusType === "Disetujui oleh Super Admin (Pengganti Validator)" && reviewer1Data?.email) {
        nextApproverUid = newData.user.reviewer1[0];
        const subject = `Permintaan Approval ${lpjLabel} - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const emailContent = `
            Dear <strong>${reviewer1Data.nama}</strong>,
            <br><br>Dokumen ini telah divalidasi oleh ${actorData?.nama || 'Super Admin'}
            <br>Mohon untuk melakukan approval atas pengajuan ${lpjLabel} berikut:
        `;
        await sendEmail(
            reviewer1Data.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
        );
    } else if (latestStatusType === "Disetujui oleh Super Admin (Pengganti Reviewer 1)" && reviewer2Data?.email) {
        nextApproverUid = newData.user.reviewer2[0];
        const validatorStatus = statusHistory.find(status =>
            status.status === "Disetujui oleh Super Admin (Pengganti Validator)"
        );
        const isSameSuperAdmin = validatorStatus && validatorStatus.actor === latestStatus.actor;
        const subject = `Permintaan Approval ${lpjLabel} - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        let emailContent;
        if (isSameSuperAdmin) {
            emailContent = `
                Dear <strong>${reviewer2Data.nama}</strong>,
                <br><br>Dokumen ini telah divalidasi dan disetujui oleh ${actorData?.nama || 'Super Admin'}
                <br>Mohon untuk melakukan approval atas pengajuan ${lpjLabel} berikut:
            `;
        } else {
            const validatorData = validatorStatus?.actor ? await getUserData(validatorStatus.actor) : null;
            emailContent = `
                Dear <strong>${reviewer2Data.nama}</strong>,
                <br><br>Dokumen ini telah divalidasi oleh ${validatorData?.nama || 'Validator'} dan disetujui oleh ${actorData?.nama || 'Super Admin'}
                <br>Mohon untuk melakukan approval atas pengajuan ${lpjLabel} berikut:
            `;
        }
        await sendEmail(
            reviewer2Data.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
        );
    } else if (latestStatusType === "Disetujui oleh Reviewer 1 Sekaligus Validator" && reviewer2Data?.email) {
        nextApproverUid = newData.user.reviewer2[0];
        const subject = `Permintaan Approval ${lpjLabel} - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const emailContent = `
            Dear <strong>${reviewer2Data.nama}</strong>,
            <br><br>Dokumen ini telah divalidasi dan disetujui oleh ${actorData?.nama || 'Validator & Reviewer 1'}
            <br>Mohon untuk melakukan approval atas pengajuan ${lpjLabel} berikut:
        `;
        await sendEmail(
            reviewer2Data.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
        );
    } else if (latestStatusType === "Disetujui oleh Validator" && reviewer1Data?.email) {
        nextApproverUid = newData.user.reviewer1[0];
        const subject = `Permintaan Approval ${lpjLabel} - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const emailContent = `
            Dear <strong>${reviewer1Data.nama}</strong>,
            <br><br>Dokumen ini telah divalidasi oleh ${actorData?.nama || 'Validator'}
            <br>Mohon untuk melakukan approval atas pengajuan ${lpjLabel} berikut:
        `;
        await sendEmail(
            reviewer1Data.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
        );
    } else if (latestStatusType === "Disetujui oleh Reviewer 1" && reviewer2Data?.email) {
        nextApproverUid = newData.user.reviewer2[0];
        const validatorStatus = newData.statusHistory?.find(status =>
            status.status === "Disetujui oleh Validator" ||
            status.status === "Disetujui oleh Super Admin (Pengganti Validator)"
        );
        const validatorData = validatorStatus?.actor ? await getUserData(validatorStatus.actor) : null;
        const subject = `Permintaan Approval ${lpjLabel} - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const emailContent = `
            Dear <strong>${reviewer2Data.nama}</strong>,
            <br><br>Dokumen ini telah divalidasi oleh ${validatorData?.nama || 'Validator'} dan disetujui oleh ${reviewer1Data?.nama || 'Reviewer 1'}
            <br>Mohon untuk melakukan approval atas pengajuan ${lpjLabel} berikut:
        `;
        await sendEmail(
            reviewer2Data.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
        );
    } else if ((latestStatusType === "Disetujui oleh Reviewer 2" || latestStatusType === "Disetujui oleh Super Admin (Pengganti Reviewer 2)")
        && newData.status === "Disetujui") {
        nextApproverUid = null;
        const subject = `Pengajuan ${lpjLabel} Disetujui - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const hasValidatorReviewer1Status = statusHistory.some(status =>
            status.status === "Disetujui oleh Reviewer 1 Sekaligus Validator"
        );
        const allSuperAdminApprovals =
            statusHistory.some(status => status.status.includes("Super Admin (Pengganti Validator)")) &&
            statusHistory.some(status => status.status.includes("Super Admin (Pengganti Reviewer 1)")) &&
            statusHistory.some(status => status.status.includes("Super Admin (Pengganti Reviewer 2)"));
        let emailContent;
        if (allSuperAdminApprovals) {
            const superAdminData = actorData;
            emailContent = `
                Dear <strong>${submitterData?.nama || newData.user.nama}</strong>,
                <br><br>Dokumen pengajuan ${lpjLabel} anda telah sepenuhnya disetujui oleh ${superAdminData?.nama || 'Super Admin'}
            `;
        } else if (hasValidatorReviewer1Status) {
            const lastApprover = latestStatusType === "Disetujui oleh Super Admin (Pengganti Reviewer 2)" ?
                actorData?.nama || 'Super Admin' :
                reviewer2Data?.nama || 'Reviewer 2';
            emailContent = `
                Dear <strong>${submitterData?.nama || newData.user.nama}</strong>,
                <br><br>Dokumen pengajuan ${lpjLabel} anda telah divalidasi dan disetujui oleh ${reviewer1Data?.nama || 'Reviewer 1'} serta ${lastApprover}
            `;
        } else {
            const validatorStatus = statusHistory.find(status =>
                status.status === "Disetujui oleh Validator" ||
                status.status === "Disetujui oleh Super Admin (Pengganti Validator)"
            );
            const reviewer1Status = statusHistory.find(status =>
                status.status === "Disetujui oleh Reviewer 1" ||
                status.status === "Disetujui oleh Super Admin (Pengganti Reviewer 1)"
            );
            const validatorData = validatorStatus?.actor ? await getUserData(validatorStatus.actor) : null;
            const reviewer1ActorData = reviewer1Status?.actor ? await getUserData(reviewer1Status.actor) : null;
            const isSameSuperAdmin = validatorStatus?.actor === reviewer1Status?.actor &&
                validatorStatus?.status.includes("Super Admin") &&
                reviewer1Status?.status.includes("Super Admin");
            if (isSameSuperAdmin) {
                const superAdminData = validatorData;
                const reviewer2Name = latestStatusType === "Disetujui oleh Super Admin (Pengganti Reviewer 2)" ?
                    `${actorData?.nama || 'Super Admin'}` :
                    `${reviewer2Data?.nama || 'Reviewer 2'}`;
                emailContent = `
                    Dear <strong>${submitterData?.nama || newData.user.nama}</strong>,
                    <br><br>Dokumen pengajuan ${lpjLabel} anda telah divalidasi dan disetujui oleh ${superAdminData?.nama || 'Super Admin'} serta ${reviewer2Name}
                `;
            } else {
                const validatorName = validatorStatus?.status.includes("Super Admin") ?
                    `${validatorData?.nama || 'Super Admin'}` :
                    `${validatorData?.nama || 'Validator'}`;
                const reviewer1Name = reviewer1Status?.status.includes("Super Admin") ?
                    `${reviewer1ActorData?.nama || 'Super Admin'}` :
                    `${reviewer1Data?.nama || 'Reviewer 1'}`;
                const reviewer2Name = latestStatusType === "Disetujui oleh Super Admin (Pengganti Reviewer 2)" ?
                    `${actorData?.nama || 'Super Admin'}` :
                    `${reviewer2Data?.nama || 'Reviewer 2'}`;
                emailContent = `
                    Dear <strong>${submitterData?.nama || newData.user.nama}</strong>,
                    <br><br>Dokumen pengajuan ${lpjLabel} anda telah divalidasi oleh ${validatorName} serta disetujui oleh ${reviewer1Name} dan ${reviewer2Name}
                `;
            }
        }
        if (submitterData?.email) {
            await sendEmail(
                submitterData.email,
                subject,
                createEmailTemplate(emailContent, submitterData, newData, false, 'approved')
            );
        }
    }
    // Perbarui dokumen dengan currentApproverUid yang baru
    if (nextApproverUid !== undefined) {
        await docRef.update({ currentApproverUid: nextApproverUid });
    }
});

// -----------------------------------------------------------------------------------
// ---- FUNGSI TERJADWAL UNTUK PENGINGAT (REMINDER) - FIXED ----
// -----------------------------------------------------------------------------------

// PERBAIKAN: Fungsi processReminder dipindahkan ke ATAS sebelum sendApprovalReminders memanggilnya
const resolveCurrentApproverUid = (data, docType) => {
    if (data.currentApproverUid) return data.currentApproverUid;

    if (docType.type === "BS") {
        if (data.status === "Diajukan") return data.user?.reviewer1?.[0] || null;
        if (data.status === "Diproses") return data.user?.reviewer2?.[0] || null;
        return null;
    }

    if (data.status === "Diajukan") return data.user?.validator?.[0] || null;
    if (data.status === "Divalidasi") return data.user?.reviewer1?.[0] || null;
    if (data.status === "Diproses") return data.user?.reviewer2?.[0] || null;

    return null;
};

const getReminderRoleLabel = (data, docType) => {
    if (docType.type === "BS") {
        if (data.status === "Diajukan") return "Reviewer 1";
        if (data.status === "Diproses") return "Reviewer 2";
        return "Approver";
    }

    if (data.status === "Diajukan") return "Validator";
    if (data.status === "Divalidasi") return "Reviewer 1";
    if (data.status === "Diproses") return "Reviewer 2";

    return "Approver";
};

const processReminder = async (docSnapshot, docType, approverUid, nowTimestamp) => {
    const data = docSnapshot.data();
    
    try {
        const [approverData, submitterData] = await Promise.all([
            getUserData(approverUid),
            getUserData(data.user.uid)
        ]);

        if (!approverData?.email) {
            console.log(`⚠️ Skip: Email approver tidak ditemukan untuk ${approverData?.nama}`);
            return;
        }

        const roleLabel = getReminderRoleLabel(data, docType);
        const subject = `[REMINDER] Menunggu Approval ${roleLabel} - ${docType.type} ${data.displayId}`;
        
        const emailContent = `
            Dear <strong>${approverData.nama}</strong>,
            <br><br>
            Ini adalah pengingat otomatis. Dokumen <strong>${docType.type}</strong> berikut menunggu persetujuan Anda sejak kemarin.
            <br><br>
            <strong>Detail Dokumen:</strong>
            <ul>
                <li>Nomor: ${data.displayId}</li>
                <li>Pengaju: ${submitterData?.nama || 'User'}</li>
                <li>Tanggal Update Terakhir: ${formatDateIndonesia(data.lastStatusChange || data.tanggalPengajuan)}</li>
                <li>Status Saat Ini: ${data.status}</li>
            </ul>
            <br>
            Mohon segera melakukan pengecekan melalui dashboard aplikasi.
        `;

        // Kirim Email
        const emailSent = await sendEmail(
            approverData.email, 
            subject, 
            createEmailTemplate(emailContent, submitterData, data, true, 'reminder')
        );

        if (!emailSent) {
            console.error(`❌ Reminder tidak ditandai terkirim karena email gagal: ${data.displayId}`);
            return;
        }

        // Update database bahwa reminder sudah dikirim hari ini
        await db.collection(docType.collection).doc(docSnapshot.id).update({
            lastReminderSent: nowTimestamp.toISOString()
        });

    } catch (err) {
        console.error(`❌ Gagal kirim reminder untuk ${data.displayId}:`, err);
    }
};

/**
 * Fungsi ini akan berjalan setiap hari pada pukul 09:00 WITA.
 */
const REMINDER_TIME_ZONE = "Asia/Makassar";
const REMINDER_TIMEZONE_OFFSET = "+08:00";

exports.sendApprovalReminders = onSchedule({
    schedule: "0 9 * * *",      // Jalan setiap jam 09:00
    timeZone: REMINDER_TIME_ZONE,
    timeoutSeconds: 540,        // Timeout diperpanjang (9 menit) untuk antisipasi data banyak
    memory: "256MiB"
}, async (event) => {
    console.log("⏰ Mulai pengecekan pengajuan untuk Reminder jam 09:00 WITA...");

    const now = new Date();
    
    // Tentukan batas waktu (Cutoff) ke jam 00:00:00 WITA hari ini secara akurat.
    const formatter = new Intl.DateTimeFormat('en-US', { 
        timeZone: REMINDER_TIME_ZONE,
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
    });
    
    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    
    const startOfTodayLocalString = `${year}-${month}-${day}T00:00:00${REMINDER_TIMEZONE_OFFSET}`;
    const startOfToday = new Date(startOfTodayLocalString);

    // Definisi Status Flow untuk validasi tambahan
    // BS: Diajukan (Rev1) -> Diproses (Rev2)
    // RBS/LPJ: Diajukan (Val) -> Disetujui oleh Validator (Rev1) -> Disetujui oleh Reviewer 1 (Rev2)
    const documentTypes = [
        { collection: "bonSementara", type: "BS" },
        { collection: "lpj", type: "LPJ" },
        { collection: "reimbursement", type: "RBS" },
    ];

    for (const docType of documentTypes) {
        try {
            // 1. Ambil dokumen yang statusnya masih aktif (belum selesai)
            const querySnapshot = await db.collection(docType.collection)
                .where('status', 'not-in', ['Disetujui', 'Ditolak', 'Dibatalkan'])
                .get();

            if (querySnapshot.empty) continue;

            for (const doc of querySnapshot.docs) {
                const data = doc.data();
                
                
                // 2. Cek Current Approver (Siapa yang sedang pegang bola?)
                const approverUid = resolveCurrentApproverUid(data, docType);
                if (!approverUid) {
                    console.log(`⚠️ Skip ${docType.type} ${data.displayId}: Tidak ada currentApproverUid.`);
                    continue;
                }

                if (!data.currentApproverUid) {
                    await doc.ref.update({ currentApproverUid: approverUid });
                }

                // 3. Cek Kapan Terakhir Berubah
                const lastChangeStr = data.lastStatusChange || data.tanggalPengajuan;
                if (!lastChangeStr) continue;
                
                const lastChangeDate = new Date(lastChangeStr);

                // 4. Cek Logika Waktu:
                // Apakah perubahan terakhir terjadi SEBELUM hari ini jam 00:00 WIB?
                // Jika YA, berarti sudah lewat pukul 24:00 kemarin.
                const isOverdue = lastChangeDate < startOfToday;

                // 5. Cek apakah sudah diingatkan HARI INI?
                const lastReminderSentDate = data.lastReminderSent ? new Date(data.lastReminderSent) : null;
                const alreadyRemindedToday = lastReminderSentDate && lastReminderSentDate >= startOfToday;

                if (isOverdue && !alreadyRemindedToday) {
                    // Dieksekusi berurutan (await) untuk mencegah rate-limit pengiriman email
                    await processReminder(doc, docType, approverUid, now);
                }
            }
        } catch (error) {
            console.error(`❌ Error pada koleksi ${docType.collection}:`, error);
        }
    }

    console.log("✅ Selesai pengecekan pengajuan.");
});

const PENGEMBALIAN_REMINDER_INTERVAL_MS = 2 * 24 * 60 * 60 * 1000; // 2 hari

// Reminder email berkala (tiap 2 hari, mulai 2 hari sejak LPJ diajukan) untuk LPJ
// yang punya sisaLebih (BS ada pengembalian ke perusahaan) tapi buktinya belum
// diupload/belum valid. Berhenti otomatis begitu pengembalianStatus == 'valid'
// ATAU 'grandfathered' (lihat grandfatherPengembalianLpj di bawah -- insiden
// 2026-09-07: fitur ini diterapkan retroaktif ke SEMUA LPJ lama yang punya
// sisaLebih, bukan cuma LPJ baru, jadi run pertama scheduler ini langsung
// menganggap ratusan LPJ lama "jatuh tempo" sekaligus dan mengirim email
// beruntun ke user yang sama -- lihat SUMMARY_PENGEMBANGAN.md Bagian R).
// Terpisah dari sendApprovalReminders() karena beda concern (bukti pengembalian,
// bukan approval) meski keduanya jalan harian.
exports.sendPengembalianReminders = onSchedule({
    schedule: "30 9 * * *",
    timeZone: REMINDER_TIME_ZONE,
    timeoutSeconds: 300,
    memory: "256MiB"
}, async () => {
    console.log("⏰ Mulai pengecekan bukti pengembalian LPJ...");

    const now = new Date();

    const querySnapshot = await db.collection("lpj")
        .where("sisaLebih", ">", 0)
        .get();

    for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();

        if (data.pengembalianStatus === "valid" || data.pengembalianStatus === "grandfathered") continue;
        if (!data.user?.uid) continue;

        const lastReminderAt = data.pengembalianLastReminderAt
            ? new Date(data.pengembalianLastReminderAt)
            : null;
        const baseline = lastReminderAt || new Date(data.tanggalPengajuan || data.createdAt);
        if (isNaN(baseline.getTime())) continue;

        const dueAt = new Date(baseline.getTime() + PENGEMBALIAN_REMINDER_INTERVAL_MS);
        if (now < dueAt) continue;

        try {
            const submitterData = await getUserData(data.user.uid);
            if (!submitterData?.email) {
                console.log(`⚠️ Skip reminder pengembalian ${data.displayId}: email pengaju tidak ditemukan.`);
                continue;
            }

            const subject = `[REMINDER] Bukti Pengembalian BS Belum Diupload - ${data.displayId}`;
            const emailContent = `
                Dear <strong>${submitterData.nama}</strong>,
                <br><br>
                Ini adalah pengingat otomatis. Anda belum mengupload bukti pengembalian BS atas LPJ berikut,
                atau bukti yang diupload belum sesuai dengan nominal yang harus dikembalikan.
                <br><br>
                Silakan upload bukti pengembalian pada halaman Detail LPJ.
            `;

            const sent = await sendEmail(
                submitterData.email,
                subject,
                createEmailTemplate(emailContent, submitterData, data, true, "pengembalianReminder")
            );

            if (!sent) {
                console.error(`❌ Gagal kirim reminder pengembalian untuk ${data.displayId}`);
                continue;
            }

            await docSnap.ref.update({
                pengembalianLastReminderAt: now.toISOString(),
                pengembalianReminderCount: (data.pengembalianReminderCount || 0) + 1
            });
        } catch (error) {
            console.error(`❌ Error reminder pengembalian untuk ${data.displayId}:`, error);
        }
    }

    console.log("✅ Selesai pengecekan bukti pengembalian LPJ.");
});

// INSIDEN 2026-09-07: sendPengembalianReminders() di atas menerapkan aturan
// bukti pengembalian ke SEMUA LPJ lama yang punya sisaLebih>0 (bukan cuma LPJ
// baru sejak fitur ini live) -- run pertama scheduler langsung menganggap
// SEMUA LPJ lama "jatuh tempo" sekaligus (baseline = tanggalPengajuan yang
// sudah lama lewat), mengirim email reminder beruntun ke user yang sama
// dalam hitungan menit ("bom email"). Mencari bukti pengembalian yang lama
// terlewat sudah tidak realistis, jadi migrasi ini menandai LPJ LAMA (sampai
// batas waktu tetap di bawah, BUKAN "sekarang" -- supaya fungsi ini AMAN
// dijalankan ulang kapan pun tanpa ikut menghapus reminder LPJ baru yang
// genuinely belum upload) sebagai selesai TANPA lampiran asli, ditandai jelas
// beda dari validasi OCR sungguhan (status 'grandfathered', bukan 'valid') --
// lihat describePengembalianStatus di pengembalianStatus.js untuk labelnya.
const PENGEMBALIAN_GRANDFATHER_CUTOFF = "2026-09-07T23:59:59+08:00";

exports.grandfatherPengembalianLpj = onCall(async (request) => {
    await requireSuperAdmin(request.auth);

    const cutoff = new Date(PENGEMBALIAN_GRANDFATHER_CUTOFF);
    const querySnapshot = await db.collection("lpj")
        .where("sisaLebih", ">", 0)
        .get();

    const refsToUpdate = [];
    for (const docSnap of querySnapshot.docs) {
        const data = docSnap.data();
        if (data.pengembalianStatus === "valid" || data.pengembalianStatus === "grandfathered") continue;

        const createdAt = new Date(data.createdAt || data.tanggalPengajuan);
        if (isNaN(createdAt.getTime()) || createdAt > cutoff) continue;

        refsToUpdate.push(docSnap.ref);
    }

    const chunks = [];
    for (let i = 0; i < refsToUpdate.length; i += 400) {
        chunks.push(refsToUpdate.slice(i, i + 400));
    }

    let updated = 0;
    for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach((ref) => {
            batch.update(ref, {
                pengembalianStatus: "grandfathered",
                pengembalianValidationNote: "Ditandai selesai otomatis (migrasi 2026-09-07) -- LPJ diajukan sebelum fitur validasi bukti pengembalian aktif, bukti lama tidak realistis dicari ulang.",
                pengembalianGrandfatheredAt: new Date().toISOString()
            });
        });
        await batch.commit();
        updated += chunk.length;
    }

    return { updated };
});
