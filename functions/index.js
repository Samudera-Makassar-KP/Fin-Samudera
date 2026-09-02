const { onDocumentCreated, onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { setGlobalOptions } = require("firebase-functions/v2/options");
const legacyFunctions = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

const emailUserSecret = defineSecret("EMAIL");
const emailPasswordSecret = defineSecret("EMAIL_PASSWORD");

setGlobalOptions({
    region: "asia-southeast2",
    secrets: [emailUserSecret, emailPasswordSecret]
});

// Inisialisasi Firebase Admin
initializeApp();
const db = getFirestore();

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

// Helper Function: Format currency ke format Rupiah
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        currencyDisplay: 'narrowSymbol',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount).replace(/\s+/g, '');
};

// Helper Function: Format tanggal ke format Indonesia
const formatDateIndonesia = (dateString) => {
    const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const date = new Date(dateString);
    const day = date.getDate();
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    return `${day} ${month} ${year}`;
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
        tableRows += `
        <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>Nomor BS</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${lpjData.nomorBS || 0}</td>
        </tr>
        <tr>
            <td style="padding: 10px; border: 1px solid #ddd; background-color: #f9f9f9;"><strong>Jumlah BS</strong></td>
            <td style="padding: 10px; border: 1px solid #ddd;">${formatCurrency(lpjData.jumlahBS || 0)}</td>
        </tr>
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

// /userDirectory adalah mirror read-only dari /users yang HANYA berisi field
// aman (bukan bankName/accountNumber dkk) -- dibaca client manapun yang login
// (lihat firestore.rules) untuk kebutuhan lintas-user yang legit tapi tidak
// butuh data finansial: dropdown Reviewer/Validator, dropdown plat BBM lintas
// user, dan nama approver di PDF/Detail. Sebelumnya semua kebutuhan itu
// query langsung ke /users collection, yang berarti SIAPA PUN yang login bisa
// baca profil lengkap user lain termasuk nomor rekening bank (lihat Bagian
// H/18.4). Mirror ini disinkron otomatis oleh trigger di bawah setiap kali
// /users/{uid} ditulis (baik lewat Cloud Function createManagedUser, maupun
// lewat update langsung client Super Admin di FormEditUser.jsx).
const buildUserDirectoryEntry = (data) => ({
    nama: typeof data?.nama === "string" ? data.nama : "",
    role: typeof data?.role === "string" ? data.role : "",
    unit: Array.isArray(data?.unit) ? data.unit : [],
    platKendaraan: Array.isArray(data?.platKendaraan) ? data.platKendaraan : [],
});

exports.syncUserDirectoryOnWrite = onDocumentWritten("users/{uid}", async (event) => {
    const uid = event.params.uid;
    const directoryRef = db.collection("userDirectory").doc(uid);

    if (!event.data?.after?.exists) {
        await directoryRef.delete().catch(() => undefined);
        return;
    }

    await directoryRef.set(buildUserDirectoryEntry(event.data.after.data()));
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
            batch.set(db.collection("userDirectory").doc(userDoc.id), buildUserDirectoryEntry(userDoc.data()));
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

// Dipanggil dari tombol "Kirim Reminder ke Finance" di BsTable.jsx (kolom Aksi,
// khusus BS berstatus Disetujui). Finance = user role Validator. Mengirim satu
// email berisi narasi permintaan bantuan pencairan + detail BS (format sama
// seperti email notifikasi lain, lihat createEmailTemplate) + lampiran PDF BS
// (format sama seperti PDF hasil "Print", digenerate & di-upload client lewat
// generateBsPDF sebelum memanggil ini, lalu diambil ulang di sini lewat
// pdfUrl -- downloadURL Firebase Storage sudah membawa token akses sendiri,
// jadi bisa di-fetch tanpa Admin SDK Storage).
exports.sendBsFinanceReminder = onCall(async (request) => {
    if (!request.auth?.uid) {
        throw new HttpsError("unauthenticated", "Anda harus login untuk menjalankan aksi ini.");
    }

    const bsId = normalizeText(request.data?.bsId, "ID BS", 200);
    const validatorUid = normalizeText(request.data?.validatorUid, "UID Validator", 128);
    const pdfUrl = normalizeText(request.data?.pdfUrl, "URL PDF", 2000, false);

    const bsDoc = await db.collection("bonSementara").doc(bsId).get();
    if (!bsDoc.exists) {
        throw new HttpsError("not-found", "Data Bon Sementara tidak ditemukan.");
    }
    const bsData = bsDoc.data();

    if (bsData.user?.uid !== request.auth.uid) {
        throw new HttpsError("permission-denied", "Anda hanya bisa mengirim reminder untuk BS milik sendiri.");
    }
    if (bsData.status !== "Disetujui") {
        throw new HttpsError("failed-precondition", "BS belum berstatus Disetujui.");
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

    // Defense-in-depth: jangan percaya begitu saja validatorUid dari client --
    // pastikan Validator ini memang ditugaskan di salah satu Unit Bisnis yang
    // sama dengan submitter (mencegah kirim reminder ke Validator unit lain).
    const submitterUnits = Array.isArray(submitterData?.unit) ? submitterData.unit : [];
    const validatorUnits = Array.isArray(validatorData?.unit) ? validatorData.unit : [];
    const sharesUnit = submitterUnits.some((unit) => validatorUnits.includes(unit));
    if (!sharesUnit) {
        throw new HttpsError("permission-denied", "Finance yang dipilih tidak terdaftar di Unit Bisnis Anda.");
    }

    let attachments = [];
    if (pdfUrl) {
        try {
            const response = await fetch(pdfUrl);
            if (response.ok) {
                const arrayBuffer = await response.arrayBuffer();
                attachments = [{
                    filename: `${bsData.displayId}.pdf`,
                    content: Buffer.from(arrayBuffer),
                    contentType: "application/pdf"
                }];
            } else {
                console.error("Gagal mengambil PDF BS untuk lampiran reminder, status:", response.status);
            }
        } catch (error) {
            console.error("Gagal mengambil PDF BS untuk lampiran reminder:", error);
        }
    }

    const subject = `Reminder Pencairan BS - ${bsData.displayId}`;
    const emailContent = `
        Dear <strong>${validatorData.nama}</strong>,
        <br><br>Mohon dibantu maker atas BS berikut:
    `;

    const sent = await sendEmail(
        validatorData.email,
        subject,
        createEmailTemplate(emailContent, submitterData, bsData, true, "financeReminder"),
        attachments
    );

    if (!sent) {
        throw new HttpsError("internal", "Gagal mengirim email reminder ke Finance.");
    }

    return { sent: true, to: validatorData.email };
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

    // Perbarui dokumen dengan currentApproverUid dan lastStatusChange
    await db.collection("lpj").doc(event.params.docId).update({
        currentApproverUid: newData.user.validator[0],
        lastStatusChange: new Date().toISOString()
    });

    const submitterData = await getUserData(newData.user.uid);
    const validatorPromises = newData.user.validator.map(validatorId => getUserData(validatorId));
    const validatorsData = await Promise.all(validatorPromises);
    const emailPromises = validatorsData
        .filter(validator => validator?.email)
        .map(validatorData => {
            const subject = `Permintaan Approval LPJ BS - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
            const emailContent = `
                Dear <strong>${validatorData.nama}</strong>,
                <br><br>Mohon untuk melakukan validasi atas pengajuan LPJ BS berikut:
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
    const latestStatus = newData.statusHistory?.[newData.statusHistory.length - 1];
    const actorData = latestStatus?.actor ? await getUserData(latestStatus.actor) : null;
    // PENTING: sentinel harus `undefined`, BUKAN `null` -- lihat penjelasan di
    // notifyReviewersAndUserRBS. Kalau diinisialisasi `null`, status yang tidak cocok
    // dengan string manapun di bawah akan diam-diam menge-null-kan currentApproverUid.
    let nextApproverUid;

    if (newData.status === "Ditolak") {
        await docRef.update({ currentApproverUid: null });
        const subject = `Pengajuan LPJ BS Ditolak - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const rejectorName = actorData?.nama || 'Reviewer';
        const rejectReason = newData.rejectReason;
        const emailContent = `
            Dear <strong>${submitterData?.nama || newData.user.nama}</strong>,
            <br><br>Dokumen pengajuan LPJ BS anda telah ditolak oleh ${rejectorName} dengan alasan berikut:
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
        const subject = `Permintaan Approval LPJ BS - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const emailContent = `
            Dear <strong>${reviewer1Data.nama}</strong>,
            <br><br>Dokumen ini telah divalidasi oleh ${actorData?.nama || 'Super Admin'}
            <br>Mohon untuk melakukan approval atas pengajuan LPJ BS berikut:
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
        const subject = `Permintaan Approval LPJ BS - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        let emailContent;
        if (isSameSuperAdmin) {
            emailContent = `
                Dear <strong>${reviewer2Data.nama}</strong>,
                <br><br>Dokumen ini telah divalidasi dan disetujui oleh ${actorData?.nama || 'Super Admin'}
                <br>Mohon untuk melakukan approval atas pengajuan LPJ BS berikut:
            `;
        } else {
            const validatorData = validatorStatus?.actor ? await getUserData(validatorStatus.actor) : null;
            emailContent = `
                Dear <strong>${reviewer2Data.nama}</strong>,
                <br><br>Dokumen ini telah divalidasi oleh ${validatorData?.nama || 'Validator'} dan disetujui oleh ${actorData?.nama || 'Super Admin'}
                <br>Mohon untuk melakukan approval atas pengajuan LPJ BS berikut:
            `;
        }
        await sendEmail(
            reviewer2Data.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
        );
    } else if (latestStatusType === "Disetujui oleh Reviewer 1 Sekaligus Validator" && reviewer2Data?.email) {
        nextApproverUid = newData.user.reviewer2[0];
        const subject = `Permintaan Approval LPJ BS - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const emailContent = `
            Dear <strong>${reviewer2Data.nama}</strong>,
            <br><br>Dokumen ini telah divalidasi dan disetujui oleh ${actorData?.nama || 'Validator & Reviewer 1'}
            <br>Mohon untuk melakukan approval atas pengajuan LPJ BS berikut:
        `;
        await sendEmail(
            reviewer2Data.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
        );
    } else if (latestStatusType === "Disetujui oleh Validator" && reviewer1Data?.email) {
        nextApproverUid = newData.user.reviewer1[0];
        const subject = `Permintaan Approval LPJ BS - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const emailContent = `
            Dear <strong>${reviewer1Data.nama}</strong>,
            <br><br>Dokumen ini telah divalidasi oleh ${actorData?.nama || 'Validator'}
            <br>Mohon untuk melakukan approval atas pengajuan LPJ BS berikut:
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
        const subject = `Permintaan Approval LPJ BS - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        const emailContent = `
            Dear <strong>${reviewer2Data.nama}</strong>,
            <br><br>Dokumen ini telah divalidasi oleh ${validatorData?.nama || 'Validator'} dan disetujui oleh ${reviewer1Data?.nama || 'Reviewer 1'}
            <br>Mohon untuk melakukan approval atas pengajuan LPJ BS berikut:
        `;
        await sendEmail(
            reviewer2Data.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData, true, 'approval')
        );
    } else if ((latestStatusType === "Disetujui oleh Reviewer 2" || latestStatusType === "Disetujui oleh Super Admin (Pengganti Reviewer 2)")
        && newData.status === "Disetujui") {
        nextApproverUid = null;
        const subject = `Pengajuan LPJ BS Disetujui - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
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
                <br><br>Dokumen pengajuan LPJ BS anda telah sepenuhnya disetujui oleh ${superAdminData?.nama || 'Super Admin'}
            `;
        } else if (hasValidatorReviewer1Status) {
            const lastApprover = latestStatusType === "Disetujui oleh Super Admin (Pengganti Reviewer 2)" ?
                actorData?.nama || 'Super Admin' :
                reviewer2Data?.nama || 'Reviewer 2';
            emailContent = `
                Dear <strong>${submitterData?.nama || newData.user.nama}</strong>,
                <br><br>Dokumen pengajuan LPJ BS anda telah divalidasi dan disetujui oleh ${reviewer1Data?.nama || 'Reviewer 1'} serta ${lastApprover}
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
                    <br><br>Dokumen pengajuan LPJ BS anda telah divalidasi dan disetujui oleh ${superAdminData?.nama || 'Super Admin'} serta ${reviewer2Name}
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
                    <br><br>Dokumen pengajuan LPJ BS anda telah divalidasi oleh ${validatorName} serta disetujui oleh ${reviewer1Name} dan ${reviewer2Name}
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
