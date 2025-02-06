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

// Fungsi untuk mengirim email
const sendEmail = async (to, subject, text) => {
    if (!to) return;
    try {
        await transporter.sendMail({ from: process.env.EMAIL, to, subject, text });
        console.log(`✅ Email berhasil dikirim ke ${to}`);
    } catch (error) {
        console.error("❌ Gagal mengirim email:", error);
    }
};

// **🔹 Trigger baru: Kirim email ke Reviewer 1 saat BS pertama kali dibuat**
exports.notifyReviewer1OnCreate = onDocumentCreated("bonSementara/{docId}", async (event) => {
    const newData = event.data.data();

    const reviewer1Uid = newData.user.reviewer1[0];
    const reviewer1EmailRef = db.collection("users").doc(reviewer1Uid);
    const reviewer1Data = await reviewer1EmailRef.get();

    const reviewer1Email = reviewer1Data.exists ? reviewer1Data.data().email : null;

    if (reviewer1Email) {
        await sendEmail(reviewer1Email, "Pengajuan BS Baru", `Ada pengajuan baru dengan Nomor BS: ${newData.displayId}.`);
    }
});

// **🔹 Trigger lama: Notifikasi saat status berubah**
exports.notifyReviewersAndUser = onDocumentUpdated("bonSementara/{docId}", async (event) => {
    const newData = event.data.after.data();
    const oldData = event.data.before.data();

    if (!newData || !oldData) return;

    const reviewer2Uid = newData.user.reviewer2[0];
    const reviewer2EmailRef = db.collection("users").doc(reviewer2Uid);
    const reviewer2Data = await reviewer2EmailRef.get();
    const reviewer2Email = reviewer2Data.exists ? reviewer2Data.data().email : null;

    const userRef = db.collection("users").doc(newData.user.uid);
    const userData = await userRef.get();
    const userEmail = userData.exists ? userData.data().email : null;

    const displayId = newData.displayId || "BS Tanpa ID";

    if (newData.status === "Diproses" && oldData.status !== "Diproses") {
        await sendEmail(reviewer2Email, "BS Perlu Review", `BS dengan Nomor BS: ${displayId} telah disetujui oleh Reviewer 1.`);
    }

    if (newData.status === "Disetujui" && oldData.status !== "Disetujui") {
        await sendEmail(userEmail, "BS Disetujui", `BS dengan Nomor BS: ${displayId} telah disetujui oleh Reviewer 2.`);
    }
});
