/**
 * Polimedia Peer Counselor - Supabase Integration Layer
 */

// 1. INISIALISASI SUPABASE KLIEN
const SUPABASE_URL = 'https://nqvohyidkegkwffnkcjg.supabase.co'; 
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xdm9oeWlka2Vna3dmZm5rY2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDY4MTAsImV4cCI6MjA5NzE4MjgxMH0.v9L58CSuqyUUd9tdOVp5Zhul0a4zYvsQnI2pGCiwI04'; // GANTI INI
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 2. MODUL AUTENTIKASI (Menggunakan Supabase Auth)
const auth = {
    async getUser() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return null;
        
        // Ambil data spesifik dari tabel public.users
        const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('email', user.email)
            .single();
            
        return profile;
    },
    async logout() {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    }
};

// 3. MODUL LOGIN & REGISTRASI
async function initLoginPage() {
    window.handleRegister = async (e) => {
        e.preventDefault();
        const email = document.querySelector('input[type="email"]').value;
        const password = document.getElementById('regPassword').value;
        const nama_lengkap = document.getElementById('regNama').value;
        const program_studi = document.querySelector('select').value;
        const nim = document.getElementById('regNIM').value;

        // Daftar ke Supabase Auth
        const { data: authData, error: authErr } = await supabase.auth.signUp({ email, password });
        
        if (authErr) { alert("Registrasi gagal: " + authErr.message); return; }

        // Masukkan data demografi ke tabel public.users
        const { error: dbErr } = await supabase.from('users').insert([{
            nama_lengkap, email, role: 'mahasiswa', nim, program_studi, avatar_seed: nama_lengkap.split(' ')[0]
        }]);

        if (dbErr) { alert("Gagal menyimpan profil: " + dbErr.message); return; }
        
        alert("Pendaftaran berhasil! Silakan login.");
        window.toggleView('login');
    };

    window.handleLogin = async (e) => {
        e.preventDefault();
        const email = document.querySelector('#loginForm input[type="email"]').value;
        const password = document.getElementById('loginPassword').value;

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        
        if (error) { alert("Kredensial tidak valid."); return; }
        window.location.href = 'index.html';
    };
}

// 4. MODUL KUESIONER / PENILAIAN (penilaian.html)
async function initPenilaianPage() {
    window.submitForm = async (e) => {
        e.preventDefault();
        const params = new URLSearchParams(window.location.search);
        const sesiId = params.get('sesi'); // UUID dari URL
        
        if (!sesiId) { alert("Parameter Sesi ID tidak ditemukan."); return; }

        const form = document.getElementById('evaluationForm');
        
        // Asumsi Kalkulasi Skor Total (Contoh Sederhana)
        const qA1 = parseInt(form.querySelector('input[name="qA1"]:checked')?.value || 0);
        const qB1 = parseInt(form.querySelector('input[name="qB1"]:checked')?.value || 0);
        const skor_total = (qA1 + qB1) / 2; // Sesuaikan dengan logika rata-rata Anda

        const komentar = form.querySelector('textarea')?.value || '';
        const rekomendasi = form.querySelector('input[name="rekomendasi"]:checked')?.value === 'ya' ? 1 : 0;

        const { error } = await supabase.from('penilaian').insert([{
            sesi_id: sesiId,
            skor_total: skor_total,
            rekomendasi: rekomendasi,
            komentar: komentar
        }]);

        if (error) {
            alert("Gagal merekam data ke Supabase: " + error.message);
        } else {
            alert("Penilaian berhasil disimpan!");
            window.location.href = 'index.html';
        }
    };
}

// 5. MODUL JELAJAH KONSELOR (pilih-konselor.html)
async function initPilihKonselorPage() {
    const { data: konselor, error } = await supabase
        .from('konselor')
        .select(`*, users ( nama_lengkap, avatar_seed )`)
        .eq('status', 'Tersedia');

    if (error) { console.error("Gagal memuat:", error); return; }

    const grid = document.querySelector('.grid');
    if (grid && konselor) {
        grid.innerHTML = konselor.map(k => `
            <div class="bg-white rounded-[30px] p-6 shadow-sm border border-gray-100 flex flex-col h-full">
                <h3 class="text-xl font-bold text-gray-800 mb-1">${k.users.nama_lengkap}</h3>
                <p class="text-xs text-gray-400 mb-4">${k.jurusan} • ${k.level}</p>
                <div class="flex items-center gap-1 text-green-500 text-sm mb-4">
                    ★ ${k.rating_rata} <span class="text-gray-400 text-xs ml-1">(${k.total_sesi} Sesi)</span>
                </div>
                <a href="profil-konselor.html?id=${k.id}" class="block w-full text-center bg-blue-50 text-blue-700 py-3 rounded-2xl font-semibold">Lihat Profil</a>
            </div>
        `).join('');
    }
}

// 5. MODUL BERANDA UTAMA (index.html)
async function initIndexPage() {
    // A. Render Statistika Deskriptif (Chart.js)
    const ctx = document.getElementById('trenChart');
    if (ctx) {
        // Data di bawah ini menggunakan sampel agregat untuk keperluan demonstrasi pameran
        // Pada eksekusi production penuh, data ini harus ditarik dari perhitungan tabel public.penilaian
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
                datasets: [{
                    label: 'Nilai Mean (Rata-rata) Kepuasan',
                    data: [4.2, 4.5, 4.1, 4.8, 4.9, 4.8, 5.0],
                    borderColor: '#0284C7',
                    backgroundColor: 'rgba(2, 132, 199, 0.1)',
                    borderWidth: 2,
                    pointBackgroundColor: '#00668F',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { 
                    y: { 
                        beginAtZero: false, 
                        min: 3, 
                        max: 5,
                        grid: { borderDash: [5, 5] } 
                    },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // B. Tarik Data Konselor Berperingkat Tinggi
    const containerKonselor = document.querySelector('[data-section="konselor-terbaik"]');
    if (containerKonselor) {
        // Melakukan kueri asinkronus ke Supabase, dibatasi 3 entitas teratas
        const { data: konselor, error } = await supabase
            .from('konselor')
            .select(`*, users ( nama_lengkap )`)
            .order('rating_rata', { ascending: false })
            .limit(3);

        if (error || !konselor || konselor.length === 0) {
            containerKonselor.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">Data agregat belum tersedia di database.</div>';
            return;
        }

        // Injeksi Node DOM
        containerKonselor.innerHTML = konselor.map(k => `
            <div class="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
                <div class="w-1/3 font-bold text-gray-800 text-sm flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                        ${k.users.nama_lengkap.charAt(0)}
                    </div>
                    ${k.users.nama_lengkap}
                </div>
                <div class="w-1/4 text-xs text-gray-500 font-medium">${k.jurusan}</div>
                <div class="w-1/4 text-sm font-black text-green-500">★ ${k.rating_rata.toFixed(1)}</div>
                <div class="w-1/6 text-right">
                    <span class="text-[10px] font-bold px-3 py-1.5 ${k.status === 'Tersedia' ? 'bg-[#D1F48D] text-green-900' : 'bg-gray-100 text-gray-500'} rounded-full uppercase tracking-wider">
                        ${k.status}
                    </span>
                </div>
            </div>
        `).join('');
    }
}

// 6. ROUTING INISIALISASI
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html'; // Mendukung root domain ("/") Vercel
    
    if (page === 'login.html') initLoginPage();
    if (page === 'penilaian.html') initPenilaianPage();
    if (page === 'pilih-konselor.html') initPilihKonselorPage();
    
    // Pastikan root ("") dan "index.html" memicu fungsi beranda
    if (page === 'index.html' || page === '') initIndexPage(); 
});