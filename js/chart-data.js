// js/chart-data.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Persiapan Dummy Data (Format JSON/Object) 
    // Format ini sangat disukai Back-End karena mudah diganti dengan respon API nantinya
    const dummyData = {
        labels: ['Masalah Akademik', 'Kecemasan', 'Hubungan Interpersonal', 'Burnout Organisasi', 'Adaptasi Kampus'],
        datasets: [{
            label: 'Jumlah Sesi Konseling Bulan Ini',
            data: [65, 42, 25, 30, 15], // Data statis
            backgroundColor: [
                '#00668F', // Primary Blue
                '#4CAF50', // Success Green
                '#004A6A', // Dark Blue
                '#888888', // Muted
                '#E2E8F0'  // Light Border
            ],
            borderWidth: 0,
            borderRadius: 8 // Membuat ujung grafik melengkung seperti desain UI modern
        }]
    };

    // 2. Konfigurasi Grafik Chart.js
    const config = {
        type: 'bar', // Menggunakan diagram batang
        data: dummyData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                },
                title: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#F1F5F9' // Warna garis latar yang tipis
                    }
                },
                x: {
                    grid: {
                        display: false // Menghilangkan garis vertikal agar lebih bersih
                    }
                }
            }
        }
    };

    // 3. Render Grafik ke Canvas HTML
    const ctx = document.getElementById('metrikChart').getContext('2d');
    new Chart(ctx, config);
});