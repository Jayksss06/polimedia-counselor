// polimedia_conselor/js/weekly-trend-chart.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Simulasikan respon data JSON statis (di pertemuan 5 ini akan diganti respon API)
    // Data ini untuk diagram tren mingguan di Beranda (5 batang)
    const jsonData = {
        meta: {
            chart_type: 'weekly_session_trend',
            unit: 'number_of_sessions'
        },
        data: {
            labels: ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4', 'Minggu 5'],
            datasets: [{
                label: 'Sesi',
                counts: [12, 19, 15, 8, 22] // Data statis (belum real-time)
            }]
        }
    };

    // 2. Translasikan JSON ke format yang dimengerti Chart.js
    const chartData = {
        labels: jsonData.data.labels,
        datasets: [{
            label: jsonData.data.datasets[0].label,
            data: jsonData.data.datasets[0].counts,
            backgroundColor: '#004A6A', // brand-dark
            borderRadius: 6,
            barThickness: 25,
            hoverBackgroundColor: '#00668F' // brand-blue
        }]
    };

    // 3. Konfigurasi Grafik Tren Mingguan
    const config = {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#333', titleFont: { size: 12 } }
            },
            scales: {
                y: { display: false, beginAtZero: true }, // Menyembunyikan sumbu Y sesuai desain
                x: { 
                    grid: { display: false }, 
                    ticks: { color: '#888', font: { size: 10 } }
                }
            }
        }
    };

    // 4. Render Grafik ke Canvas di HTML
    const ctx = document.getElementById('weeklyTrendChart').getContext('2d');
    new Chart(ctx, config);
});