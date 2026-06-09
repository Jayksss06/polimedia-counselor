// js/chat.js

document.addEventListener('DOMContentLoaded', () => {
    const btnKirim = document.getElementById('btn-kirim-chat');
    const inputChat = document.querySelector('input[placeholder="Tuliskan isi hatimu di sini..."]');

    if (btnKirim) {
        btnKirim.addEventListener('click', function() {
            const pesan = inputChat.value.trim();

            if (pesan === "") {
                alert("Tuliskan pesan penutupmu terlebih dahulu sebelum mengakhiri sesi.");
                return;
            }

            // Simulasi pengiriman pesan (merubah teks tombol)
            btnKirim.innerHTML = "Mengirim... ⌛";
            btnKirim.disabled = true;
            btnKirim.classList.add('opacity-50', 'cursor-not-allowed');

            // Beri jeda 1 detik agar dosen bisa melihat proses "Mengirim"
            setTimeout(() => {
                alert("Pesan terkirim! Sesi konseling Anda telah berakhir. Menuju halaman ringkasan...");
                
                // Redirect ke halaman ringkasan sesi
                window.location.href = 'ringkasan-sesi.html';
            }, 1000);
        });
    }
});