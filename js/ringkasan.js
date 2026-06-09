// js/ringkasan.js

document.addEventListener('DOMContentLoaded', () => {
    const btnPdf = document.getElementById('btn-pdf');
    const btnNextSession = document.getElementById('btn-next-session');

    // Logika Tombol "Simpan Sebagai PDF" (Direct Download)
    if (btnPdf) {
        btnPdf.addEventListener('click', () => {
            // Ubah teks tombol untuk memberikan visual loading
            btnPdf.innerHTML = "Mengunduh PDF... ⏳";
            btnPdf.disabled = true; // Nonaktifkan tombol sementara
            btnPdf.classList.add('opacity-75', 'cursor-not-allowed');

            // Ambil elemen yang ingin dijadikan PDF
            const element = document.getElementById('area-cetak');

            // Konfigurasi PDF
            const opt = {
                margin:       [0.5, 0.5, 0.5, 0.5], // Margin atas, kiri, bawah, kanan (dalam inchi)
                filename:     'Ringkasan_Konseling_Polimedia.pdf', // Nama file saat terunduh
                image:        { type: 'jpeg', quality: 0.98 }, // Kualitas ketajaman
                html2canvas:  { scale: 2, useCORS: true }, // Scale 2 agar HD, tidak pecah
                jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' } // Ukuran kertas A4
            };

            // Jalankan library html2pdf
            html2pdf().set(opt).from(element).save().then(() => {
                // Kembalikan tombol seperti semula setelah selesai terunduh
                btnPdf.innerHTML = "Simpan Sebagai PDF";
                btnPdf.disabled = false;
                btnPdf.classList.remove('opacity-75', 'cursor-not-allowed');
            });
        });
    }

    // Logika Tombol "Jadwalkan Sesi Berikutnya"
    if (btnNextSession) {
        btnNextSession.addEventListener('click', () => {
            alert("Mengarahkan Anda kembali ke halaman pencarian konselor untuk memilih jadwal baru...");
            window.location.href = 'pilih-konselor.html'; 
        });
    }
});