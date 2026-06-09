// js/app.js

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('registrationForm');

    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault(); // Mencegah reload halaman bawaan browser

            // Mengambil value dari input
            const nama = document.getElementById('nama').value;
            const tanggalLahir = document.getElementById('tanggalLahir').value;
            const jurusan = document.getElementById('jurusan').value;
            const terms = document.getElementById('terms').checked;

            // Validasi DOM (Mengecek apakah form kosong)
            if (!nama || !tanggalLahir || !jurusan) {
                alert('Mohon lengkapi data Nama, Tanggal Lahir, dan Jurusan terlebih dahulu!');
                return; // Menghentikan proses jika ada yang kosong
            }

            // Mengecek apakah checkbox disetujui
            if (!terms) {
                alert('Anda harus menyetujui Syarat & Ketentuan.');
                return; // Menghentikan proses jika checkbox tidak dicentang
            }

            // Jika semua form sudah diisi (Simulasi sukses)
            alert(`Pendaftaran atas nama ${nama} berhasil! Mengarahkan ke halaman penjadwalan...`);
            
            // Redirect ke halaman penjadwalan
            window.location.href = 'penjadwalan.html';
        });
    }
});