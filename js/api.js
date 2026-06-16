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

// 6. ROUTING INISIALISASI
document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    if (page === 'login.html') initLoginPage();
    if (page === 'penilaian.html') initPenilaianPage();
    if (page === 'pilih-konselor.html') initPilihKonselorPage();
});