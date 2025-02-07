const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const nodemailer = require("nodemailer");

// Inisialisasi Firebase Admin
initializeApp();
const db = getFirestore();

// Konfigurasi transporter untuk Nodemailer
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASSWORD
    }
});

// Format currency ke format Rupiah
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR'
    }).format(amount);
};

// Format tanggal ke format Indonesia
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

// Function untuk mengambil data user dari Firestore
const getUserData = async (uid) => {
    if (!uid) return null;
    const userDoc = await db.collection("users").doc(uid).get();
    return userDoc.exists ? userDoc.data() : null;
};

// Template HTML untuk email
const createEmailTemplate = (content, submitterData, newData) => `
    <div style="font-family: Arial, sans-serif; padding: 20px;">
        ${content}
        <div style="margin: 20px 0;">
            <a href="https://smdr-mks.com" 
               style="background-color: #ED1C24; 
                      color: white; 
                      padding: 10px 20px; 
                      text-decoration: none; 
                      border-radius: 5px;
                      display: inline-block;">
                Buka Website
            </a>
        </div>
        <div style="margin-top: 20px;">
            <p>Diajukan oleh ${submitterData?.nama || 'User'}</p>
            <p>${newData?.user?.unit || 'Unit'}</p>
        </div>
        <p>Terima Kasih</p>
    </div>
`;

// Fungsi untuk mengirim email
const sendEmail = async (to, subject, htmlContent = null) => {
    if (!to) return;
    try {
        const mailOptions = {
            from: process.env.EMAIL,
            to,
            subject,
            html: htmlContent
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Email berhasil dikirim ke ${to}`);
    } catch (error) {
        console.error("❌ Gagal mengirim email:", error);
    }
};

// Trigger saat BS pertama kali dibuat
exports.notifyReviewer1OnCreate = onDocumentCreated("bonSementara/{docId}", async (event) => {
    const newData = event.data.data();
    if (!newData?.user?.reviewer1?.[0]) return;

    const [reviewer1Data, submitterData] = await Promise.all([
        getUserData(newData.user.reviewer1[0]),
        getUserData(newData.user.uid)
    ]);
    
    if (!reviewer1Data?.email) return;

    const subject = `Permintaan Approval BS - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
    
    const emailContent = `
        <p>Dear ${reviewer1Data.nama},</p>
        <p>Mohon untuk melakukan approval atas pengajuan BS dengan nomor ${newData.displayId} senilai ${formatCurrency(newData.bonSementara[0].jumlahBS)}</p>
    `;

    await sendEmail(
        reviewer1Data.email,
        subject,
        createEmailTemplate(emailContent, submitterData, newData)
    );
});

// Trigger saat status BS berubah
exports.notifyReviewersAndUser = onDocumentUpdated("bonSementara/{docId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();

    if (!newData || !oldData || newData.status === oldData.status) return;

    // Get all relevant user data including the submitter
    const [reviewer1Data, reviewer2Data, submitterData] = await Promise.all([
        getUserData(newData.user.reviewer1[0]),
        getUserData(newData.user.reviewer2[0]),
        getUserData(newData.user.uid)
    ]);

    // Get the latest status history entry to identify who made the change
    const latestStatus = newData.statusHistory?.[newData.statusHistory.length - 1];
    const actorData = latestStatus?.actor ? await getUserData(latestStatus.actor) : null;

    // Notification for rejection
    if (newData.status === "Ditolak") {
        const subject = `Pengajuan BS Ditolak - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        
        const rejectorName = actorData?.nama || 
            (latestStatus?.actor === reviewer1Data?.uid ? reviewer1Data?.nama : reviewer2Data?.nama) || 
            'Reviewer'
        ;
        
        const emailContent = `
            <p>Dear ${submitterData?.nama || newData.user.nama},</p>
            <p>Dokumen pengajuan BS dengan nomor ${newData.displayId} senilai ${formatCurrency(newData.bonSementara[0].jumlahBS)}</p>
            <p>telah ditolak oleh ${rejectorName}</p>
        `;

        if (!submitterData?.email) {
            console.error("❌ Email pengaju tidak ditemukan untuk BS:", newData.displayId);
            return;
        }

        await sendEmail(
            submitterData.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData)
        );
        return;
    }

    // Notification for Reviewer 2 when status changes to "Diproses"
    if (newData.status === "Diproses" && oldData.status === "Diajukan" && reviewer2Data?.email) {
        const subject = `Permintaan Approval BS - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
        
        const emailContent = `
            <p>Dear ${reviewer2Data.nama},</p>
            <p>Dokumen ini telah disetujui oleh ${reviewer1Data?.nama || 'Reviewer 1'}</p>
            <p>Mohon untuk melakukan approval atas pengajuan BS dengan nomor ${newData.displayId} senilai ${formatCurrency(newData.bonSementara[0].jumlahBS)}</p>
        `;

        await sendEmail(
            reviewer2Data.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData)
        );
    }

    // Notification for User when status changes to "Disetujui"
    if (newData.status === "Disetujui" && oldData.status === "Diproses") {
        const subject = `Pengajuan BS Disetujui - ${newData.displayId} - ${formatDateIndonesia(newData.tanggalPengajuan)}`;
    
        const emailContent = `
            <p>Dear ${submitterData?.nama || newData.user.nama},</p>
            <p>Dokumen pengajuan BS dengan nomor ${newData.displayId} senilai ${formatCurrency(newData.bonSementara[0].jumlahBS)}</p>
            <p>telah disetujui oleh ${reviewer1Data?.nama || 'Reviewer 1'} dan ${reviewer2Data?.nama || 'Reviewer 2'}</p>
        `;
    
        if (!submitterData?.email) {
            console.error("❌ Email pengaju tidak ditemukan untuk BS:", newData.displayId);
            return;
        }
    
        await sendEmail(
            submitterData.email,
            subject,
            createEmailTemplate(emailContent, submitterData, newData)
        );
    }
});