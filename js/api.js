/**
 * Polimedia Peer Counselor - API Integration Layer
 * Hubungkan semua halaman HTML dengan backend Flask
 * 
 * Cara pakai: sertakan <script src="js/api.js"></script> di setiap halaman HTML
 */

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000/api'
    : 'https://Jayksss.pythonanywhere.com/api'; 

// ============================================================
// HELPER: HTTP CLIENT
// ============================================================
const api = {
    async request(method, endpoint, body = null, auth = false) {
        const headers = { 'Content-Type': 'application/json' };
        if (auth) {
            const token = localStorage.getItem('polimedia_token');
            if (!token) {
                window.location.href = 'login.html';
                return null;
            }
            headers['Authorization'] = `Bearer ${token}`;
        }
        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : null
            });
            const data = await res.json();
            if (!res.ok && res.status === 401) {
                localStorage.removeItem('polimedia_token');
                localStorage.removeItem('polimedia_user');
                window.location.href = 'login.html';
                return null;
            }
            return data;
        } catch (err) {
            console.error(`[API Error] ${method} ${endpoint}:`, err);
            return { success: false, message: 'Koneksi ke server gagal. Pastikan server berjalan.' };
        }
    },
    get: (endpoint, auth = false) => api.request('GET', endpoint, null, auth),
    post: (endpoint, body, auth = false) => api.request('POST', endpoint, body, auth),
    put: (endpoint, body, auth = false) => api.request('PUT', endpoint, body, auth),
    delete: (endpoint, auth = false) => api.request('DELETE', endpoint, null, auth),
};

// ============================================================
// AUTH: Simpan/baca session
// ============================================================
const auth = {
    getToken: () => localStorage.getItem('polimedia_token'),
    getUser: () => {
        const u = localStorage.getItem('polimedia_user');
        return u ? JSON.parse(u) : null;
    },
    isLoggedIn: () => !!localStorage.getItem('polimedia_token'),
    saveSession: (token, user) => {
        localStorage.setItem('polimedia_token', token);
        localStorage.setItem('polimedia_user', JSON.stringify(user));
    },
    logout: () => {
        localStorage.removeItem('polimedia_token');
        localStorage.removeItem('polimedia_user');
        window.location.href = 'login.html';
    }
};

// ============================================================
// UTIL: Format tanggal Indonesia
// ============================================================
const fmt = {
    tanggal: (iso) => {
        if (!iso) return '-';
        const d = new Date(iso);
        return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    },
    waktu: (t) => t ? t.substring(0, 5) : '-',
    rating: (n) => n ? (n / 100).toFixed(1) : '0.0',
    bintang: (n) => {
        const r = n ? Math.round(n / 100) : 0;
        return '★'.repeat(r) + '☆'.repeat(5 - r);
    },
    selisihWaktu: (iso) => {
        const d = new Date(iso);
        const now = new Date();
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return `${diff} detik lalu`;
        if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
        if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
        return `${Math.floor(diff / 86400)} hari lalu`;
    },
    statusBadge: (status) => {
        const map = {
            'Berlangsung': 'bg-green-100 text-green-700',
            'Menunggu':    'bg-yellow-100 text-yellow-700',
            'Selesai':     'bg-blue-100 text-blue-700',
            'Dibatalkan':  'bg-red-100 text-red-700',
            'Tersedia':    'bg-green-50 text-green-700',
            'Sesi Penuh':  'bg-gray-100 text-gray-500',
        };
        return map[status] || 'bg-gray-100 text-gray-600';
    },
    avatarUrl: (seed) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed || 'User'}`,
};

// ============================================================
// MODUL: LOGIN PAGE (login.html)
// ============================================================
async function initLoginPage() {
    // Jika sudah login, redirect langsung
    if (auth.isLoggedIn()) {
        const user = auth.getUser();
        window.location.href = user?.role === 'konselor' ? 'counselor-dashboard.html' : 'index.html';
        return;
    }

    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const errorDiv = document.getElementById('loginError');

    // Override handleLogin
    window.handleLogin = async (e) => {
        e.preventDefault();
        const email = loginForm.querySelector('input[type="email"]').value;
        const password = document.getElementById('loginPassword').value;
        const btn = loginForm.querySelector('button[type="submit"]');

        btn.textContent = 'Memproses...';
        btn.disabled = true;

        const result = await api.post('/auth/login', { email, password });

        if (result?.success) {
            auth.saveSession(result.token, result.user);
            showToast('Login berhasil! Mengarahkan...', 'success');
            setTimeout(() => window.location.href = result.redirect, 800);
        } else {
            showToast(result?.message || 'Login gagal', 'error');
            btn.textContent = 'Confirm';
            btn.disabled = false;
        }
    };

    // Override handleRegister
    window.handleRegister = async (e) => {
        e.preventDefault();
        const data = {
            nama_lengkap: registerForm.querySelector('#regNama')?.value || registerForm.querySelectorAll('input[type="text"]')[0]?.value,
            nim: registerForm.querySelector('#regNIM')?.value || registerForm.querySelectorAll('input[type="text"]')[1]?.value,
            program_studi: registerForm.querySelector('select')?.value,
            angkatan: registerForm.querySelectorAll('select')[1]?.value,
            semester: registerForm.querySelectorAll('select')[2]?.value,
            email: registerForm.querySelector('input[type="email"]')?.value,
            password: document.getElementById('regPassword')?.value,
            telepon: registerForm.querySelector('input[type="tel"]')?.value,
        };

        const btn = registerForm.querySelector('button[type="submit"]');
        btn.textContent = 'Mendaftarkan...';
        btn.disabled = true;

        const result = await api.post('/auth/register', data);

        if (result?.success) {
            showToast('Pendaftaran berhasil! Silakan login.', 'success');
            setTimeout(() => window.toggleView('login'), 1500);
        } else {
            showToast(result?.message || 'Pendaftaran gagal', 'error');
        }
        btn.textContent = 'Confirm';
        btn.disabled = false;
    };
}

// ============================================================
// MODUL: HOMEPAGE (index.html)
// ============================================================
async function initHomePage() {
    updateNavUser();
    const result = await api.get('/home/stats');
    if (!result?.success) return;

    const { stats, ulasan, konselor_terbaik, tren_mingguan, topik_stats } = result.data;

    // Update stat cards
    const statCards = [
        { el: document.querySelector('[data-stat="total-responden"]'), val: stats.total_responden?.toLocaleString('id-ID') || '0', suffix: '' },
        { el: document.querySelector('[data-stat="rata-skor"]'), val: stats.rata_skor || '0.0', suffix: '' },
        { el: document.querySelector('[data-stat="persen-rekomendasi"]'), val: stats.persen_rekomendasi || '0', suffix: '%' },
    ];
    statCards.forEach(({ el, val, suffix }) => {
        if (el) el.textContent = val + suffix;
    });

    // Update ulasan
    const ulasanContainer = document.querySelector('[data-section="ulasan"]');
    if (ulasanContainer && ulasan.length > 0) {
        const ulasanHTML = ulasan.slice(0, 3).map(u => `
            <div class="bg-white p-6 rounded-3xl border border-gray-100 card-shadow flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-start mb-4">
                        <div class="text-[#F59E0B] text-xs tracking-widest">★★★★★</div>
                        <span class="text-[10px] text-gray-400">${fmt.selisihWaktu(u.created_at)}</span>
                    </div>
                    <p class="text-sm text-gray-600 leading-relaxed mb-6">"${u.komentar}"</p>
                </div>
                <div class="flex items-center gap-3 pt-4 border-t border-gray-50">
                    <img src="${fmt.avatarUrl(u.nama_lengkap.split(' ')[0])}" class="w-8 h-8 rounded-full bg-slate-200" alt="">
                    <h4 class="text-[11px] font-bold text-gray-800">${u.nama_lengkap} (${u.program_studi || 'Mahasiswa'})</h4>
                </div>
            </div>`).join('');
        ulasanContainer.innerHTML = ulasanHTML;
    }

    // Update konselor terbaik
    const konselorContainer = document.querySelector('[data-section="konselor-terbaik"]');
    if (konselorContainer && konselor_terbaik.length > 0) {
        const topKonselor = konselor_terbaik[0];
        const konselorHTML = konselor_terbaik.map((k, i) => {
            const inisial = k.nama_lengkap.split(' ').map(n => n[0]).join('').slice(0,2);
            const colors = ['bg-[#DCFCE7] text-[#16A34A]', 'bg-[#E0E7FF] text-[#4F46E5]', 'bg-[#E0F2FE] text-[#0284C7]'];
            const statusClass = k.status === 'Tersedia' ? 'bg-green-50 text-green-700 border-green-100' : 'bg-gray-100 text-gray-500 border-gray-200';
            const dot = k.status === 'Tersedia' ? '<span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span>' : '';
            return `
            <div class="flex flex-col md:flex-row items-start md:items-center justify-between p-4 px-6 md:px-8 bg-white rounded-3xl md:rounded-full shadow-sm">
                <div class="w-full md:w-1/3 flex items-center gap-4 mb-3 md:mb-0">
                    <div class="w-10 h-10 ${colors[i % 3]} flex items-center justify-center font-bold text-xs rounded-full">${inisial}</div>
                    <div><h3 class="font-bold text-gray-900 text-sm">${k.nama_lengkap}</h3><p class="text-[10px] text-gray-400">Level: ${k.level}</p></div>
                </div>
                <div class="w-full md:w-1/4 text-xs text-gray-600 font-medium mb-3 md:mb-0">${k.jurusan}</div>
                <div class="w-full md:w-1/4 flex items-center gap-1.5 text-xs font-bold text-gray-800 mb-3 md:mb-0">
                    <span class="text-[#10B981]">★</span> ${(k.rating * 100).toFixed(0)}% <span class="text-[10px] text-gray-400 font-normal">(${k.total_sesi}+ Sesi)</span>
                </div>
                <div class="w-full md:w-1/6 flex justify-start md:justify-end">
                    <span class="${statusClass} px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 border">${dot} ${k.status}</span>
                </div>
            </div>`;
        }).join('');
        konselorContainer.innerHTML = konselorHTML;
    }

    // Update topik stats
    if (topik_stats.length > 0) {
        const total = topik_stats.reduce((s, t) => s + t.total, 0);
        const topikColors = ['bg-brand-blue', 'bg-[#4D7C0F]', 'bg-[#4F46E5]', 'bg-[#F59E0B]', 'bg-[#EC4899]'];
        const topikTextColors = ['text-brand-blue', 'text-[#4D7C0F]', 'text-[#4F46E5]', 'text-[#F59E0B]', 'text-[#EC4899]'];
        const topikContainer = document.querySelector('[data-section="topik-stats"]');
        if (topikContainer) {
            topikContainer.innerHTML = topik_stats.map((t, i) => {
                const pct = Math.round(t.total / total * 100);
                return `
                <div>
                    <div class="flex justify-between text-xs font-bold text-gray-900 mb-2">
                        <span>${t.topik.toUpperCase()}</span>
                        <span class="${topikTextColors[i % 5]}">${pct}%</span>
                    </div>
                    <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div class="${topikColors[i % 5]} h-full rounded-full" style="width: ${pct}%"></div>
                    </div>
                </div>`;
            }).join('');
        }
    }

    // Update tren chart
    if (tren_mingguan.length > 0 && window.Chart) {
        const ctx = document.getElementById('trenChart');
        if (ctx) {
            const labels = tren_mingguan.map((_, i) => `Minggu ${i + 1}`);
            const dataPoints = tren_mingguan.map(t => t.avg || 0);
            const bgColors = dataPoints.map((_, i) => i === dataPoints.length - 1 ? '#0F172A' : '#F1F5F9');
            ctx.chart?.destroy();
            new Chart(ctx.getContext('2d'), {
                type: 'bar',
                data: { labels, datasets: [{ data: dataPoints, backgroundColor: bgColors, borderRadius: 4, barThickness: 32 }] },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { min: 0, max: 5, ticks: { stepSize: 1, color: '#94A3B8', font: { size: 10, weight: 'bold' } }, grid: { color: '#F1F5F9' }, border: { display: false } },
                        x: { grid: { display: false }, border: { display: false }, ticks: { color: '#94A3B8', font: { size: 10, weight: 'bold' } } }
                    }
                }
            });
        }
    }
}

// ============================================================
// MODUL: PILIH KONSELOR (pilih-konselor.html)
// ============================================================
async function initPilihKonselorPage() {
    updateNavUser();
    const grid = document.querySelector('.grid');
    if (!grid) return;

    async function loadKonselor(params = {}) {
        const query = new URLSearchParams(params).toString();
        const result = await api.get(`/konselor?${query}`);
        if (!result?.success) { grid.innerHTML = '<p class="text-center text-gray-400 col-span-3">Gagal memuat data konselor.</p>'; return; }

        grid.innerHTML = result.data.map(k => {
            const inisial = k.nama_lengkap.split(' ').map(n => n[0]).join('').slice(0, 2);
            const statusBadge = k.status === 'Tersedia'
                ? '<span class="bg-green-50 text-brand-green px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Tersedia</span>'
                : '<span class="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">Sesi Penuh</span>';
            const btn = k.status === 'Tersedia'
                ? `<a href="profil-konselor.html?id=${k.id}" class="block w-full text-center bg-brand-light text-brand-blue hover:bg-brand-blue hover:text-white py-3 rounded-2xl font-semibold transition border border-blue-50 hover:border-transparent">Lihat Profil</a>`
                : `<button disabled class="w-full text-center bg-gray-50 text-gray-400 py-3 rounded-2xl font-semibold cursor-not-allowed">Sesi Penuh</button>`;
            const spesialisasi = (k.spesialisasi || []).map(s =>
                `<span class="bg-slate-50 text-gray-500 text-xs px-3 py-1.5 rounded-lg border border-gray-100">${s}</span>`).join('');
            return `
            <div class="bg-white rounded-[30px] p-6 shadow-sm border border-gray-100 hover:shadow-md transition flex flex-col h-full ${k.status !== 'Tersedia' ? 'opacity-75 hover:opacity-100' : ''}">
                <div class="flex justify-between items-start mb-4">
                    <div class="w-16 h-16 rounded-full bg-blue-100 text-brand-blue flex items-center justify-center font-bold text-xl">${inisial}</div>
                    ${statusBadge}
                </div>
                <h3 class="text-xl font-bold text-gray-800 mb-1">${k.nama_lengkap}</h3>
                <p class="text-xs text-gray-400 mb-4">${k.jurusan} • ${k.level}</p>
                <div class="flex items-center gap-1 text-brand-green text-sm mb-4">
                    ${fmt.bintang(k.rating_rata)} <span class="text-gray-400 text-xs ml-1">(${fmt.rating(k.rating_rata)} / ${k.total_sesi} Sesi)</span>
                </div>
                <div class="flex flex-wrap gap-2 mb-6">${spesialisasi}</div>
                <div class="flex-grow"></div>
                ${btn}
            </div>`;
        }).join('') || '<p class="text-center text-gray-400 col-span-3 py-12">Tidak ada konselor ditemukan.</p>';
    }

    // Load awal
    await loadKonselor();

    // Filter realtime
    const searchInput = document.querySelector('input[placeholder*="konselor"]');
    const topikSelect = document.querySelectorAll('select')[0];
    const statusSelect = document.querySelectorAll('select')[1];
    const getFilters = () => ({
        search: searchInput?.value || '',
        topik: topikSelect?.value || '',
        status: statusSelect?.value || ''
    });

    searchInput?.addEventListener('input', debounce(() => loadKonselor(getFilters()), 400));
    topikSelect?.addEventListener('change', () => loadKonselor(getFilters()));
    statusSelect?.addEventListener('change', () => loadKonselor(getFilters()));
}

// ============================================================
// MODUL: RIWAYAT SESI (riwayat.html)
// ============================================================
async function initRiwayatPage() {
    updateNavUser();
    if (!auth.isLoggedIn()) { window.location.href = 'login.html'; return; }

    const result = await api.get('/sesi/riwayat', true);
    if (!result?.success) return;

    const container = document.querySelector('[data-section="sesi-list"]');
    if (!container || result.data.length === 0) return;

    container.innerHTML = result.data.map(s => {
        const statusClass = fmt.statusBadge(s.status);
        const nama = s.nama_konselor || s.nama_mahasiswa || '-';
        const inisial = nama.split(' ').map(n => n[0]).join('').slice(0, 2);
        const statusDot = s.status === 'Berlangsung' ? '<div class="w-1.5 h-1.5 bg-[#166534] rounded-full"></div>' : '';
        return `
        <div class="bg-white p-8 rounded-[35px] border border-gray-100 shadow-sm flex flex-col justify-between">
            <div class="flex justify-between items-start mb-8">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center text-xs border border-gray-100 shadow-sm">📄</div>
                    <div>
                        <h3 class="font-bold text-gray-900 text-lg leading-tight">${nama}</h3>
                        <p class="text-[11px] text-gray-400 font-medium mt-0.5">${s.jurusan_konselor || s.program_studi || ''}</p>
                    </div>
                </div>
                <div class="rounded-full px-3 py-2 flex items-center gap-2 mt-1 ${statusClass} border">
                    ${statusDot}
                    <span class="text-[9px] font-extrabold uppercase tracking-wider">${s.status}</span>
                </div>
            </div>
            <div class="mb-6">
                <p class="text-xs text-gray-500">📅 ${fmt.tanggal(s.tanggal)} · ⏰ ${fmt.waktu(s.waktu_mulai)}</p>
                <p class="text-xs text-gray-500 mt-1">🏷 Topik: ${s.topik || '-'}</p>
                <p class="text-xs text-gray-400 mt-1">Kode: ${s.kode_sesi}</p>
            </div>
            <div class="flex gap-2 flex-wrap">
                ${s.status === 'Berlangsung' ? `<a href="live-chat.html?sesi=${s.id}" class="flex-1 text-center bg-brand-blue text-white text-xs font-bold py-3 rounded-2xl hover:bg-brand-dark transition">💬 Lanjut Chat</a>` : ''}
                ${s.status === 'Selesai' ? `<a href="ringkasan-sesi.html?sesi=${s.id}" class="flex-1 text-center bg-[#BAE6FD] text-[#0369A1] text-xs font-bold py-3 rounded-2xl hover:bg-blue-200 transition">📋 Ringkasan</a>` : ''}
                ${s.status === 'Selesai' ? `<a href="penilaian.html?sesi=${s.id}" class="flex-1 text-center bg-[#D9F99D] text-[#4D7C0F] text-xs font-bold py-3 rounded-2xl hover:bg-lime-200 transition">⭐ Nilai</a>` : ''}
            </div>
        </div>`;
    }).join('');

    // Update stat summary cards jika ada
    const berlangsung = result.data.filter(s => s.status === 'Berlangsung').length;
    const selesai = result.data.filter(s => s.status === 'Selesai').length;
    const totalEl = document.querySelector('[data-stat="total-sesi"]');
    const berlangsungEl = document.querySelector('[data-stat="berlangsung"]');
    if (totalEl) totalEl.textContent = selesai;
    if (berlangsungEl) berlangsungEl.textContent = berlangsung;
}

// ============================================================
// MODUL: PENILAIAN (penilaian.html)
// ============================================================
async function initPenilaianPage() {
    const params = new URLSearchParams(window.location.search);
    const sesiId = params.get('sesi');
    if (!sesiId) return;

    const form = document.getElementById('evaluationForm');
    if (!form) return;

    // Override submitForm
    window.submitForm = async (e) => {
        e.preventDefault();
        const scores = {};
        const fields = ['empati', 'komunikasi', 'solusi', 'kenyamanan', 'kerahasiaan', 'navigasi', 'visual', 'instruksi', 'respon_sistem'];
        
        for (const field of fields) {
            const radio = form.querySelector(`input[name="${field}"]:checked`);
            if (!radio) { showToast(`Mohon isi semua penilaian (${field})`, 'error'); return; }
            scores[`skor_${field}`] = parseInt(radio.value);
        }

        const komentar = form.querySelector('textarea')?.value || '';
        const rekomendasi = form.querySelector('input[name="rekomendasi"]:checked')?.value === '1' ? 1 : 0;

        const result = await api.post('/penilaian', {
            sesi_id: parseInt(sesiId),
            ...scores,
            komentar,
            rekomendasi
        }, true);

        if (result?.success) {
            showToast('Penilaian berhasil dikirim! Terima kasih 🎉', 'success');
            setTimeout(() => window.location.href = `ringkasan-sesi.html?sesi=${sesiId}`, 1500);
        } else {
            showToast(result?.message || 'Gagal mengirim penilaian', 'error');
        }
    };
}

// ============================================================
// MODUL: DASHBOARD KONSELOR (counselor-dashboard.html)
// ============================================================
async function initCounselorDashboard() {
    if (!auth.isLoggedIn() || auth.getUser()?.role !== 'konselor') {
        window.location.href = 'login.html'; return;
    }
    updateNavUser();

    const result = await api.get('/dashboard/konselor', true);
    if (!result?.success) return;

    const { konselor, stats, rating, sesi_terbaru, antrian } = result.data;

    // Update stat cards
    const setEl = (sel, val) => { const el = document.querySelector(sel); if (el) el.textContent = val; };
    setEl('[data-stat="total-sesi"]', stats.total_selesai || 0);
    setEl('[data-stat="berlangsung"]', stats.sedang_berlangsung || 0);
    setEl('[data-stat="antrian"]', antrian.length || 0);
    setEl('[data-stat="sesi-hari-ini"]', stats.sesi_hari_ini || 0);
    setEl('[data-stat="rating"]', (rating.avg_rating || 0).toFixed(1));
    setEl('[data-stat="rekomendasi"]', `${rating.persen_rekomendasi || 0}%`);
    setEl('[data-stat="nama-konselor"]', konselor.nama_lengkap || '');
    setEl('[data-stat="level-konselor"]', konselor.level || '');

    // Update antrian list
    const antrianContainer = document.querySelector('[data-section="antrian"]');
    if (antrianContainer) {
        antrianContainer.innerHTML = antrian.length > 0
            ? antrian.map(a => `
            <div class="flex items-center justify-between p-4 bg-gray-50 rounded-2xl" id="antrian-${a.id}">
                <div class="flex items-center gap-3">
                    <img src="${fmt.avatarUrl(a.avatar_seed)}" class="w-9 h-9 rounded-full" alt="">
                    <div>
                        <p class="font-semibold text-sm text-gray-800">${a.nama_lengkap}</p>
                        <p class="text-[11px] text-gray-400">${a.program_studi} · Sem ${a.semester}</p>
                        <p class="text-[11px] text-brand-blue mt-0.5">${a.topik || 'Umum'}</p>
                    </div>
                </div>
                <div class="flex gap-2">
                    <button onclick="terimaAntrian(${a.id})" class="bg-green-100 text-green-700 px-3 py-2 rounded-xl text-xs font-bold hover:bg-green-200 transition">Terima</button>
                    <button onclick="tolakAntrian(${a.id})" class="bg-red-50 text-red-500 px-3 py-2 rounded-xl text-xs font-bold hover:bg-red-100 transition">Tolak</button>
                </div>
            </div>`).join('')
            : '<p class="text-sm text-gray-400 text-center py-4">Tidak ada antrian saat ini</p>';
    }

    // Update sesi terbaru
    const sesiContainer = document.querySelector('[data-section="sesi-terbaru"]');
    if (sesiContainer) {
        sesiContainer.innerHTML = sesi_terbaru.length > 0
            ? sesi_terbaru.map(s => `
            <div class="flex items-center justify-between py-4 border-b border-gray-50 last:border-0">
                <div class="flex items-center gap-3">
                    <img src="${fmt.avatarUrl(s.avatar_seed)}" class="w-8 h-8 rounded-full" alt="">
                    <div>
                        <p class="font-semibold text-sm text-gray-800">${s.nama_mahasiswa}</p>
                        <p class="text-[11px] text-gray-400">${fmt.tanggal(s.tanggal)} · ${s.topik || '-'}</p>
                    </div>
                </div>
                <span class="text-[10px] font-bold px-2 py-1 rounded-full ${fmt.statusBadge(s.status)}">${s.status}</span>
            </div>`).join('')
            : '<p class="text-sm text-gray-400 text-center py-4">Belum ada sesi</p>';
    }
}

window.terimaAntrian = async (id) => {
    const result = await api.put(`/antrian/${id}`, { status: 'Diterima' }, true);
    if (result?.success) {
        document.getElementById(`antrian-${id}`)?.remove();
        showToast('Antrian diterima!', 'success');
    }
};
window.tolakAntrian = async (id) => {
    const result = await api.put(`/antrian/${id}`, { status: 'Ditolak' }, true);
    if (result?.success) {
        document.getElementById(`antrian-${id}`)?.remove();
        showToast('Antrian ditolak', 'info');
    }
};

// ============================================================
// MODUL: ANTRIAN KONSELOR (counselor-queue.html)
// ============================================================
async function initCounselorQueuePage() {
    if (!auth.isLoggedIn() || auth.getUser()?.role !== 'konselor') {
        window.location.href = 'login.html'; return;
    }
    updateNavUser();

    const result = await api.get('/antrian/konselor', true);
    if (!result?.success) return;

    const container = document.querySelector('[data-section="queue-list"]');
    if (!container) return;

    const rows = result.data;
    setElText('[data-stat="total-antrian"]', rows.length);

    container.innerHTML = rows.length > 0
        ? rows.map(a => `
        <div class="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition" id="queue-${a.id}">
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center gap-4">
                    <img src="${fmt.avatarUrl(a.avatar_seed)}" class="w-12 h-12 rounded-full" alt="">
                    <div>
                        <h3 class="font-bold text-gray-900">${a.nama_lengkap}</h3>
                        <p class="text-xs text-gray-400">${a.program_studi} · Semester ${a.semester}</p>
                        <p class="text-xs text-gray-400">NIM: ${a.nim || '-'}</p>
                    </div>
                </div>
                <span class="text-[10px] font-bold text-yellow-700 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-100">Menunggu</span>
            </div>
            ${a.topik ? `<p class="text-sm text-gray-600 mb-2"><span class="font-semibold">Topik:</span> ${a.topik}</p>` : ''}
            ${a.pesan_awal ? `<p class="text-sm text-gray-500 italic mb-4">"${a.pesan_awal}"</p>` : ''}
            <p class="text-[11px] text-gray-400 mb-4">Masuk ${fmt.selisihWaktu(a.created_at)}</p>
            <div class="flex gap-3">
                <button onclick="terimaAntrian(${a.id}); this.closest('[id]').remove();" class="flex-1 bg-brand-blue text-white py-2.5 rounded-xl text-sm font-bold hover:bg-brand-dark transition">✓ Terima</button>
                <button onclick="tolakAntrian(${a.id}); this.closest('[id]').remove();" class="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-200 transition">✕ Tolak</button>
            </div>
        </div>`).join('')
        : '<div class="col-span-3 text-center py-16 text-gray-400"><p class="text-4xl mb-4">✨</p><p class="font-medium">Antrian kosong saat ini</p></div>';
}

// ============================================================
// MODUL: DASHBOARD ANALITIK (dashboard.html)
// ============================================================
async function initDashboardPage() {
    updateNavUser();
    const result = await api.get('/penilaian/statistik');
    if (!result?.success) return;

    const { global: g, dimensi_konselor: dk, dimensi_platform: dp, tren_mingguan, per_konselor, topik_populer } = result.data;

    // Update global stats
    setElText('[data-stat="total-responden"]', g.total_responden || 0);
    setElText('[data-stat="rata-skor"]', g.rata_skor || '0.0');
    setElText('[data-stat="persen-rekomendasi"]', `${g.persen_rekomendasi || 0}%`);

    // Update tabel per konselor
    const tabelContainer = document.querySelector('[data-section="tabel-konselor"]');
    if (tabelContainer && per_konselor.length > 0) {
        tabelContainer.innerHTML = per_konselor.map(k => `
            <tr>
                <td class="py-4 px-4 font-semibold text-gray-800">${k.nama_lengkap}</td>
                <td class="py-4 px-4 text-gray-500">${k.jurusan}</td>
                <td class="py-4 px-4">${k.total_sesi || 0}</td>
                <td class="py-4 px-4">
                    <div class="flex items-center gap-2">
                        <div class="flex-1 h-2 bg-gray-100 rounded-full">
                            <div class="h-2 bg-brand-blue rounded-full" style="width: ${((k.rata_skor || 0) / 5 * 100).toFixed(0)}%"></div>
                        </div>
                        <span class="text-xs font-bold text-gray-700">${(k.rata_skor || 0).toFixed(2)}</span>
                    </div>
                </td>
                <td class="py-4 px-4">
                    <span class="text-xs font-bold px-2 py-1 rounded-full ${fmt.statusBadge(k.status)}">${k.status}</span>
                </td>
            </tr>`).join('');
    }
}

// ============================================================
// MODUL: PENDAFTARAN (pendaftaran.html)
// ============================================================
async function initPendaftaranPage() {
    const form = document.getElementById('registrationForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            nama_lengkap: document.getElementById('nama')?.value,
            tanggal_lahir: document.getElementById('tanggalLahir')?.value,
            gender: document.getElementById('gender')?.value,
            program_studi: document.getElementById('jurusan')?.value,
            telepon: document.getElementById('telepon')?.value,
            email: document.getElementById('email')?.value,
        };
        if (!data.nama_lengkap || !data.program_studi) {
            showToast('Lengkapi data Nama dan Jurusan!', 'error'); return;
        }
        if (!document.getElementById('terms')?.checked) {
            showToast('Setujui Syarat & Ketentuan terlebih dahulu!', 'error'); return;
        }
        showToast(`Data ${data.nama_lengkap} berhasil disimpan! Mengarahkan ke penjadwalan...`, 'success');
        localStorage.setItem('pendaftaran_data', JSON.stringify(data));
        setTimeout(() => window.location.href = 'penjadwalan.html', 1500);
    });
}

// ============================================================
// HELPER: Update navbar user
// ============================================================
function updateNavUser() {
    const user = auth.getUser();
    const avatarEls = document.querySelectorAll('.nav-avatar, [data-nav="avatar"]');
    avatarEls.forEach(el => {
        if (user) el.src = fmt.avatarUrl(user.avatar_seed);
    });
    // Tombol logout
    const logoutBtns = document.querySelectorAll('[data-action="logout"]');
    logoutBtns.forEach(btn => btn.addEventListener('click', auth.logout));
}

// ============================================================
// HELPER: Toast notifikasi
// ============================================================
function showToast(message, type = 'info') {
    const existing = document.getElementById('toast-container');
    if (existing) existing.remove();
    const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-brand-blue', warning: 'bg-yellow-500' };
    const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
    const toast = document.createElement('div');
    toast.id = 'toast-container';
    toast.className = `fixed top-4 right-4 z-[9999] flex items-center gap-3 ${colors[type]} text-white px-5 py-3 rounded-2xl shadow-xl text-sm font-medium transition-all duration-300 max-w-sm`;
    toast.innerHTML = `<span class="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">${icons[type]}</span>${message}`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-10px)'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function setElText(sel, val) {
    const el = document.querySelector(sel);
    if (el) el.textContent = val;
}

function debounce(fn, delay) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

// ============================================================
// AUTO-INIT berdasarkan halaman aktif
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    const pageMap = {
        'login.html':                initLoginPage,
        'index.html':                initHomePage,
        '':                          initHomePage,
        'pilih-konselor.html':       initPilihKonselorPage,
        'riwayat.html':              initRiwayatPage,
        'penilaian.html':            initPenilaianPage,
        'counselor-dashboard.html':  initCounselorDashboard,
        'counselor-queue.html':      initCounselorQueuePage,
        'dashboard.html':            initDashboardPage,
        'pendaftaran.html':          initPendaftaranPage,
    };
    const initFn = pageMap[page];
    if (initFn) initFn();
});
