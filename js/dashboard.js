// js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    const btnExport = document.getElementById('btn-export');
    
    if (btnExport) {
        btnExport.addEventListener('click', () => {
            // Merubah tombol saat diklik untuk efek visual
            const originalText = btnExport.innerHTML;
            btnExport.innerHTML = "⏳ Menyiapkan...";
            btnExport.classList.add('opacity-75', 'cursor-not-allowed');
            
            setTimeout(() => {
                // Membuat file CSV palsu di memori browser
                const csvContent = "data:text/csv;charset=utf-8,Pertanyaan,Mean,Median,Std_Deviasi,Probabilitas\n"
                                 + "Seberapa mudah navigasi aplikasi?,4.82,5.0,0.21,91%\n"
                                 + "Apakah visual interface membantu ketenangan?,4.91,5.0,0.15,98%\n"
                                 + "Kejelasan instruksi dalam fitur Journaling.,4.45,4.5,0.42,82%\n"
                                 + "Respon sistem saat memuat modul terapi.,4.30,4.0,0.51,76%";
                
                // Menjalankan fungsi download otomatis
                const encodedUri = encodeURI(csvContent);
                const link = document.createElement("a");
                link.setAttribute("href", encodedUri);
                link.setAttribute("download", "Laporan_Kuantitatif_Polimedia.csv");
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Kembalikan tombol ke semula
                btnExport.innerHTML = originalText;
                btnExport.classList.remove('opacity-75', 'cursor-not-allowed');
            }, 800); // Simulasi delay 0.8 detik
        });
    }
});