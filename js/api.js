/**
 * ============================================================================
 * Polimedia Peer Counselor — Supabase Integration Layer (js/api.js)
 * ============================================================================
 */

// ----------------------------------------------------------------------
// 1. KONFIGURASI & INISIALISASI KLIEN SUPABASE
// ----------------------------------------------------------------------
const SUPABASE_URL = 'https://nqvohyidkegkwffnkcjg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xdm9oeWlka2Vna3dmZm5rY2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDY4MTAsImV4cCI6MjA5NzE4MjgxMH0.v9L58CSuqyUUd9tdOVp5Zhul0a4zYvsQnI2pGCiwI04';

if (typeof window.supabase === 'undefined') {
    console.error('[api.js] SDK Supabase belum dimuat.');
}

const supabaseClient = window.supabase
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

// Ekspos ke global agar terbaca oleh skrip di HTML
window.supabaseClient = supabaseClient;

// ----------------------------------------------------------------------
// Helper umum dipakai di banyak tempat
// ----------------------------------------------------------------------
const fmtRating = (val) => (val === null || val === undefined ? '0.0' : Number(val).toFixed(1));
const avatarUrl = (seed) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || 'Guest')}`;
const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const setText = (selector, value) => { const el = document.querySelector(selector); if (el) el.textContent = value; };
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function getWeekNumber(date) {
    const firstJan = new Date(date.getFullYear(), 0, 1);
    return Math.ceil((((date - firstJan) / 86400000) + firstJan.getDay() + 1) / 7);
}

function formatTanggalIndo(tanggalStr) {
    if (!tanggalStr) return '-';
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des'];
    const d = new Date(tanggalStr);
    if (isNaN(d.getTime())) return tanggalStr;
    return `${d.getDate()} ${bulan[d.getMonth()]} ${d.getFullYear()}`;
}

function waktuRelatif(tanggalStr) {
    if (!tanggalStr) return '-';
    const now = new Date();
    const d = new Date(tanggalStr);
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Baru saja';
    if (diffMin < 60) return `${diffMin} menit lalu`;
    const diffJam = Math.floor(diffMin / 60);
    if (diffJam < 24) return `${diffJam} jam lalu`;
    const diffHari = Math.floor(diffJam / 24);
    if (diffHari === 1) return 'Kemarin';
    return `${diffHari} hari lalu`;
}

// ----------------------------------------------------------------------
// 2. MODUL AUTENTIKASI
// ----------------------------------------------------------------------
const auth = {
    async getSession() {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) { console.error('getSession error:', error); return null; }
        return data.session;
    },

    async getProfile() {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return null;

        const { data: profile, error } = await supabaseClient
            .from('users')
            .select('*, konselor(id, level, jurusan, spesialisasi, total_sesi, rating_rata, status, bio)')
            .eq('id', user.id)
            .single();

        if (error) { console.error('getProfile error:', error); return null; }
        return profile;
    },

    async logout() {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    },

    async requireLogin() {
        const session = await this.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return null;
        }
        return await this.getProfile();
    },

    async requireKonselor() {
        const profile = await this.requireLogin();
        if (!profile) return null;
        if (profile.role !== 'konselor' || !profile.konselor) {
            alert('Halaman ini hanya untuk konselor.');
            window.location.href = 'index.html';
            return null;
        }
        return profile;
    },
};
window.PolimediaAuth = auth;

// ----------------------------------------------------------------------
// 3. NAVBAR
// ----------------------------------------------------------------------
async function initNavbar() {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();

    const btnLogout = document.getElementById('btnLogout');
    const navAvatar = qs('[data-nav="avatar"]');

    if (session) {
        const profile = await auth.getProfile();
        if (btnLogout) {
            btnLogout.classList.remove('hidden');
            btnLogout.addEventListener('click', async (e) => {
                e.preventDefault();
                await auth.logout();
            });
        }
        if (navAvatar && profile) {
            navAvatar.src = avatarUrl(profile.avatar_seed || profile.nama_lengkap);
        }
    } else if (btnLogout) {
        btnLogout.classList.add('hidden');
    }
}

// ----------------------------------------------------------------------
// 4. HALAMAN LOGIN & REGISTRASI (login.html)
// ----------------------------------------------------------------------
function initLoginPage() {
    window.handleLogin = async (e) => {
        e.preventDefault();
        const email = qs('#loginForm input[type="email"]').value.trim();
        const password = document.getElementById('loginPassword').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Memproses...';

        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            alert('Login gagal: ' + (error.message === 'Invalid login credentials' ? 'Email atau password salah.' : error.message));
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }

        const { data: profile } = await supabaseClient.from('users').select('role').eq('id', data.user.id).single();
        window.location.href = (profile && profile.role === 'konselor') ? 'counselor-dashboard.html' : 'index.html';
    };

window.handleRegister = async (e) => {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        const nama_lengkap = document.getElementById('regNama').value.trim();
        const nim = document.getElementById('regNIM').value.trim();
        
        // Ambil elemen select berdasarkan urutan di DOM login.html
        const selects = form.querySelectorAll('select');
        const program_studi = selects[0] ? selects[0].value : '';
        const semester = selects[1] ? parseInt(selects[1].value, 10) : null;
        
        const teleponInput = form.querySelector('input[type="tel"]');
        const telepon = teleponInput ? teleponInput.value.trim() : '';
        const email = form.querySelector('input[type="email"]').value.trim();
        const password = document.getElementById('regPassword').value;

        if (!nama_lengkap || !nim || !program_studi || !semester || !email || !password) {
            alert('Mohon lengkapi semua data wajib.');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = 'Membuat Akun...';

        // Eksekusi Pendaftaran ke Supabase
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: { nama_lengkap, nim, program_studi, semester, telepon, role: 'mahasiswa' },
            },
        });

        if (error) {
            alert('Registrasi gagal: ' + error.message);
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
            return;
        }

        // Karena 'Confirm email' dimatikan di Supabase, data.session akan langsung tersedia
        if (data.session) {
            window.location.href = 'index.html';
        } else {
            // Pengecualian (Fallback) jika server gagal mengembalikan sesi instan
            alert('Pendaftaran berhasil! Mengalihkan ke halaman masuk...');
            window.location.href = 'login.html';
        }
    };
}

// ----------------------------------------------------------------------
// 5. HALAMAN BERANDA (index.html) -> DIGABUNG DENGAN UI AKORDEON
// ----------------------------------------------------------------------

window.toggleAccordion = function(id) {
    const target = document.getElementById(id);
    if (!target) return;
    const isHidden = target.classList.contains('hidden');
    document.querySelectorAll('.counselor-detail').forEach(el => el.classList.add('hidden'));
    if (isHidden) target.classList.remove('hidden');
};

async function initIndexPage() {
    // 1. Tarik Data Metrik Utama
    const { data: homeStats } = await supabaseClient.from('v_home_stats').select('*').single();
    if (homeStats) {
        setText('#homeTotalResponden', homeStats.total_responden ?? 0);
        setText('#homeRataSkor', fmtRating(homeStats.rata_skor));
        setText('#homePersenRekomendasi', `${homeStats.persen_rekomendasi ?? 0}%`);
    }

    // 2. Tarik Data Ulasan dari Tabel Statis (ulasan_sesi)
    const containerUlasan = document.getElementById('ulasanContainer');
    if (containerUlasan) {
        const { data: ulasan } = await supabaseClient.from('ulasan_sesi').select('*').order('id', { ascending: true }).limit(3);

        if (ulasan && ulasan.length > 0) {
            containerUlasan.innerHTML = ulasan.map((u) => `
                <div class="bg-white p-6 rounded-3xl border border-gray-100 card-shadow flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-start mb-4">
                            <div class="text-[#F59E0B] text-xs tracking-widest">${'★'.repeat(u.rating || 5)}</div>
                            <span class="text-[10px] text-gray-400">${escapeHtml(u.waktu)}</span>
                        </div>
                        <p class="text-sm text-gray-600 leading-relaxed mb-6">"${escapeHtml(u.teks_ulasan)}"</p>
                    </div>
                    <div class="flex items-center gap-3 pt-4 border-t border-gray-50">
                        <div class="w-8 h-8 rounded-full bg-slate-200 overflow-hidden"></div>
                        <h4 class="text-[11px] font-bold text-gray-800">${escapeHtml(u.identitas)}</h4>
                    </div>
                </div>`).join('');
        } else {
            containerUlasan.innerHTML = '<div class="col-span-3 text-center py-10 text-gray-400 text-sm">Belum ada ulasan tersedia.</div>';
        }
    }

    // 3. Tarik Data Topik dari Tabel Statis (topik_konseling)
    const containerTopik = document.getElementById('topikContainer');
    if (containerTopik) {
        const { data: topikData } = await supabaseClient.from('topik_konseling').select('*').order('persentase', { ascending: false });

        if (topikData && topikData.length > 0) {
            containerTopik.innerHTML = topikData.map((item) => `
                <div>
                    <div class="flex justify-between text-xs font-bold text-gray-900 mb-2">
                        <span>${escapeHtml(item.nama_topik).toUpperCase()}</span>
                        <span style="color: ${item.kode_warna_hex}">${item.persentase}%</span>
                    </div>
                    <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div style="background-color: ${item.kode_warna_hex}; width: ${item.persentase}%" class="h-full rounded-full"></div>
                    </div>
                </div>`).join('');
        } else {
            containerTopik.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">Belum ada data topik.</div>';
        }
    }

    // 4. Tarik Profil Konselor dari Tabel Statis (profil_konselor)
    const containerKonselor = document.getElementById('konselorContainer');
    if (containerKonselor) {
        const { data: konselor } = await supabaseClient.from('profil_konselor').select('*').order('kepuasan_persen', { ascending: false }).limit(3);

        if (konselor && konselor.length > 0) {
            containerKonselor.innerHTML = konselor.map((k, index) => {
                const statusHTML = k.status_tersedia
                    ? `<span class="bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 border border-green-100"><span class="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Tersedia</span>`
                    : `<span class="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5 border border-gray-200">Sesi Penuh</span>`;
                
                const chartId = `dynamicChart_${k.id || index}`;

                return `
                <div class="px-6 md:px-10 mb-4">
                    <div onclick="toggleAccordion('detail-${chartId}')" class="cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between p-4 px-6 md:px-8 bg-white rounded-3xl md:rounded-full shadow-sm hover:shadow-md border border-transparent hover:border-brand-blue/20 transition-all">
                        <div class="w-full md:w-1/3 flex items-center gap-4 mb-3 md:mb-0">
                            <div class="w-10 h-10 flex items-center justify-center font-bold text-xs rounded-full" style="background-color: ${k.warna_bg}; color: ${k.warna_teks};">
                                ${escapeHtml(k.inisial)}
                            </div>
                            <div>
                                <h3 class="font-bold text-gray-900 text-sm group-hover:text-brand-blue transition">${escapeHtml(k.nama_lengkap)}</h3>
                                <p class="text-[10px] text-gray-400">Level: ${escapeHtml(k.level)}</p>
                            </div>
                        </div>
                        <div class="w-full md:w-1/4 text-xs text-gray-600 font-medium mb-3 md:mb-0">${escapeHtml(k.jurusan)}</div>
                        <div class="w-full md:w-1/4 flex items-center gap-1.5 text-xs font-bold text-gray-800 mb-3 md:mb-0">
                            <span class="text-[#10B981]">★</span> ${k.kepuasan_persen}% <span class="text-[10px] text-gray-400 font-normal">(${k.total_sesi} Sesi)</span>
                        </div>
                        <div class="w-full md:w-1/6 flex justify-start md:justify-end">${statusHTML}</div>
                    </div>

                    <div id="detail-${chartId}" class="counselor-detail hidden mt-6 mb-8 px-2 md:px-8 fade-in-down">
                        <div class="bg-white rounded-[20px] p-8 mb-6 shadow-sm border border-gray-100 flex justify-between items-center">
                            <div>
                                <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">Rata-rata Penilaian</p>
                                <div class="flex items-baseline gap-2 mb-2">
                                    <h3 class="text-4xl font-black text-gray-900">${k.kepuasan_desimal}</h3>
                                    <span class="text-sm font-bold text-gray-400">/ 5.0</span>
                                </div>
                            </div>
                            <div class="w-14 h-14 bg-[#004A6A] text-white rounded-full flex items-center justify-center text-xl shadow-md">★</div>
                        </div>
                        <div class="bg-white rounded-[20px] p-8 border border-gray-100">
                            <div class="flex justify-between items-center mb-8">
                                <h4 class="font-bold text-gray-800 text-sm">Tren Penilaian Terakhir</h4>
                            </div>
                            <div class="relative h-48 w-full"><canvas id="${chartId}"></canvas></div>
                        </div>
                    </div>
                </div>
                `;
            }).join('');

            if (typeof Chart !== 'undefined') {
                const chartOptions = {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { min: 0, max: 5, ticks: { stepSize: 1, color: '#94A3B8' }, border: { display: false }, grid: { color: '#F1F5F9'} },
                        x: { grid: { display: false }, border: { display: false }, ticks: { color: '#94A3B8' } }
                    }
                };

                konselor.forEach((k, index) => {
                    const ctx = document.getElementById(`dynamicChart_${k.id || index}`);
                    if (ctx) {
                        new Chart(ctx.getContext('2d'), {
                            type: 'bar',
                            data: {
                                labels: ['Sesi 1', 'Sesi 2', 'Sesi 3', 'Sesi 4', 'Terkini'],
                                datasets: [{
                                    data: [0, 0, 0, 0, k.kepuasan_desimal],
                                    backgroundColor: ['#F1F5F9', '#F1F5F9', '#F1F5F9', '#F1F5F9', '#0F172A'],
                                    borderRadius: 4, barThickness: 32
                                }]
                            },
                            options: chartOptions
                        });
                    }
                });
            }
        } else {
            containerKonselor.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">Belum ada data konselor tersedia.</div>';
        }
    }
}

// ----------------------------------------------------------------------
// 6. HALAMAN PILIH KONSELOR (pilih-konselor.html)
// ----------------------------------------------------------------------
function renderKonselorCard(k) {
    const tersedia = k.status === 'Tersedia';
    const spesialisasi = Array.isArray(k.spesialisasi) ? k.spesialisasi : [];

    return `
        <div class="bg-white rounded-[30px] p-6 shadow-sm border border-gray-100 hover:shadow-md transition flex flex-col h-full ${tersedia ? '' : 'opacity-75 hover:opacity-100'}">
            <div class="flex justify-between items-start mb-4">
                <div class="w-16 h-16 rounded-full bg-blue-100 text-brand-blue overflow-hidden flex flex-col items-center justify-center font-bold text-xl">
                    <img src="${avatarUrl(k.avatar_seed || k.nama_lengkap)}" class="w-full h-full object-cover" alt="${escapeHtml(k.nama_lengkap)}">
                </div>
                <span class="${tersedia ? 'bg-green-50 text-brand-green' : 'bg-gray-100 text-gray-500'} px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">${escapeHtml(k.status)}</span>
            </div>
            <h3 class="text-xl font-bold text-gray-800 mb-1">${escapeHtml(k.nama_lengkap)}</h3>
            <p class="text-xs text-gray-400 mb-4">${escapeHtml(k.jurusan || '-')} • ${escapeHtml(k.level || '')}</p>
            <div class="flex items-center gap-1 text-brand-green text-sm mb-4">
                ★ ${fmtRating(k.rating_rata)} <span class="text-gray-400 text-xs ml-1">(${k.total_sesi || 0} Sesi)</span>
            </div>
            <div class="flex flex-wrap gap-2 mb-6">
                ${spesialisasi.map((s) => `<span class="bg-slate-50 text-gray-500 text-xs px-3 py-1.5 rounded-lg border border-gray-100">${escapeHtml(s)}</span>`).join('')}
            </div>
            <div class="flex-grow"></div>
            ${tersedia
                ? `<a href="profil-konselor.html?id=${k.id}" class="block w-full text-center bg-brand-light text-brand-blue hover:bg-brand-blue hover:text-white py-3 rounded-2xl font-semibold transition border border-blue-50 hover:border-transparent">Lihat Profil</a>`
                : `<button disabled class="w-full text-center bg-gray-50 text-gray-400 py-3 rounded-2xl font-semibold cursor-not-allowed">Sesi Penuh</button>`}
        </div>
    `;
}

function debounce(fn, delay) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); };
}

async function initPilihKonselorPage() {
    const grid = qs('[data-section="konselor-grid"]');
    if (!grid) return;

    const searchInput = qs('[data-filter="search"]');
    const topikSelect = qs('[data-filter="topik"]');
    const statusSelect = qs('[data-filter="status"]');

    async function loadKonselor() {
        grid.innerHTML = '<div class="col-span-3 text-center py-10 text-gray-400 text-sm">Memuat konselor...</div>';

        const { data, error } = await supabaseClient
            .from('konselor')
            .select('id, level, jurusan, spesialisasi, total_sesi, rating_rata, status, bio, users:user_id(nama_lengkap, avatar_seed, is_active)')
            .order('rating_rata', { ascending: false });

        if (error) {
            grid.innerHTML = '<div class="col-span-3 text-center py-10 text-red-400 text-sm">Gagal memuat data konselor.</div>';
            console.error(error);
            return;
        }

        let list = (data || [])
            .filter((k) => k.users && k.users.is_active)
            .map((k) => ({ ...k, nama_lengkap: k.users.nama_lengkap, avatar_seed: k.users.avatar_seed }));

        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const topikFilter = topikSelect ? topikSelect.value : '';
        const statusFilter = statusSelect ? statusSelect.value : '';

        if (searchTerm) {
            list = list.filter((k) =>
                k.nama_lengkap.toLowerCase().includes(searchTerm) ||
                (k.jurusan || '').toLowerCase().includes(searchTerm));
        }
        if (topikFilter) {
            list = list.filter((k) => (k.spesialisasi || []).some((s) => s.toLowerCase().includes(topikFilter.toLowerCase())));
        }
        if (statusFilter === 'tersedia') {
            list = list.filter((k) => k.status === 'Tersedia');
        }

        grid.innerHTML = list.length > 0
            ? list.map(renderKonselorCard).join('')
            : '<div class="col-span-3 text-center py-10 text-gray-400 text-sm">Tidak ada konselor yang cocok dengan pencarianmu.</div>';
    }

    if (searchInput) searchInput.addEventListener('input', debounce(loadKonselor, 300));
    if (topikSelect) topikSelect.addEventListener('change', loadKonselor);
    if (statusSelect) statusSelect.addEventListener('change', loadKonselor);

    await loadKonselor();
}

// ----------------------------------------------------------------------
// 7. HALAMAN PROFIL KONSELOR (profil-konselor.html?id=...)
// ----------------------------------------------------------------------
async function initProfilKonselorPage() {
    const params = new URLSearchParams(window.location.search);
    const konselorId = params.get('id');
    if (!konselorId) return;

    const { data: k, error } = await supabaseClient
        .from('konselor')
        .select('*, users:user_id(nama_lengkap, avatar_seed)')
        .eq('id', konselorId)
        .single();

    if (error || !k) {
        const main = qs('main') || document.body;
        main.insertAdjacentHTML('afterbegin', '<div class="text-center py-10 text-red-400 text-sm">Konselor tidak ditemukan.</div>');
        return;
    }

    setText('[data-konselor="nama"]', k.users.nama_lengkap);
    setText('[data-konselor="info"]', `${k.jurusan || '-'} • ${k.level}`);
    setText('[data-konselor="rating"]', `${fmtRating(k.rating_rata)} / 5.0 (${k.total_sesi} Sesi Berhasil)`);
    setText('[data-konselor="bio"]', k.bio || '');

    const btnJanji = qs('[data-action="buat-janji"]');
    if (btnJanji) btnJanji.href = `penjadwalan.html?konselor_id=${k.id}`;

    const containerUlasan = qs('[data-section="ulasan-konselor"]');
    if (containerUlasan) {
        const { data: ulasan } = await supabaseClient
            .from('penilaian')
            .select('komentar, skor_rata_konselor, created_at, users:mahasiswa_id(program_studi)')
            .eq('konselor_id', konselorId)
            .not('komentar', 'is', null)
            .order('created_at', { ascending: false })
            .limit(5);

        if (ulasan && ulasan.length > 0) {
            containerUlasan.innerHTML = ulasan.map((u) => `
                <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div class="flex justify-between items-center mb-3">
                        <div class="text-brand-green text-xs">${'★'.repeat(Math.round(u.skor_rata_konselor || 0))}${'☆'.repeat(5 - Math.round(u.skor_rata_konselor || 0))}</div>
                        <span class="text-xs text-gray-400">${waktuRelatif(u.created_at)}</span>
                    </div>
                    <p class="text-sm text-gray-600 mb-4 leading-relaxed">"${escapeHtml(u.komentar)}"</p>
                    <div class="flex items-center gap-3">
                        <div class="w-6 h-6 bg-slate-200 rounded-full"></div>
                        <span class="text-xs font-medium text-gray-500">Anonim (Mahasiswa ${escapeHtml(u.users?.program_studi || '')})</span>
                    </div>
                </div>
            `).join('');
        } else {
            containerUlasan.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">Belum ada ulasan untuk konselor ini.</div>';
        }
    }
}

// ----------------------------------------------------------------------
// 8. HALAMAN PENJADWALAN (penjadwalan.html?konselor_id=...)
// ----------------------------------------------------------------------
async function initPenjadwalanPage() {
    const params = new URLSearchParams(window.location.search);
    const konselorId = params.get('konselor_id');
    const btnConfirm = document.getElementById('btn-confirm');
    if (!btnConfirm) return;

    if (!konselorId) {
        alert('Konselor tidak ditemukan. Silakan pilih konselor terlebih dahulu.');
        window.location.href = 'pilih-konselor.html';
        return;
    }

    const { data: k } = await supabaseClient
        .from('konselor')
        .select('id, jurusan, level, users:user_id(nama_lengkap)')
        .eq('id', konselorId)
        .single();

    if (k) {
        qsa('[data-konselor="nama-jadwal"]').forEach((el) => { el.textContent = k.users.nama_lengkap; });
    }

    let selectedDate = null; 
    let selectedTime = null; 

    const dateButtons = qsa('.date-btn');
    const timeButtons = qsa('.time-btn');
    const summaryDate = document.getElementById('summary-date');
    const summaryTime = document.getElementById('summary-time');

    dateButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            dateButtons.forEach((b) => {
                b.classList.remove('bg-brand-green', 'text-white', 'shadow-md');
                b.classList.add('bg-green-50', 'text-brand-green');
            });
            btn.classList.remove('bg-green-50', 'text-brand-green');
            btn.classList.add('bg-brand-green', 'text-white', 'shadow-md');

            const day = btn.getAttribute('data-date');
            const now = new Date();
            const tahun = now.getFullYear();
            const bulan = String(now.getMonth() + 1).padStart(2, '0');
            selectedDate = `${tahun}-${bulan}-${String(day).padStart(2, '0')}`;
            if (summaryDate) summaryDate.textContent = formatTanggalIndo(selectedDate);
        });
    });

    timeButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            timeButtons.forEach((b) => {
                b.classList.remove('bg-brand-blue', 'text-white', 'shadow-md');
                b.classList.add('bg-slate-50', 'text-gray-600', 'border-gray-100');
            });
            btn.classList.remove('bg-slate-50', 'text-gray-600', 'border-gray-100');
            btn.classList.add('bg-brand-blue', 'text-white', 'shadow-md');

            selectedTime = btn.getAttribute('data-time');
            if (summaryTime) summaryTime.textContent = selectedTime;
        });
    });

    btnConfirm.addEventListener('click', async () => {
        const profile = await auth.requireLogin();
        if (!profile) return;

        if (!selectedDate || !selectedTime) {
            alert('Mohon pilih tanggal dan jam sesi terlebih dahulu.');
            return;
        }

        const topikSelect = document.getElementById('topik-sesi');
        const topik = topikSelect ? topikSelect.value : (params.get('topik') || 'Umum');

        btnConfirm.disabled = true;
        btnConfirm.innerHTML = 'Menjadwalkan...';

        const kodeSesi = `SES-${Date.now()}`;
        const { data: sesi, error } = await supabaseClient
            .from('sesi')
            .insert([{
                kode_sesi: kodeSesi,
                mahasiswa_id: profile.id,
                konselor_id: konselorId,
                tanggal: selectedDate,
                waktu_mulai: selectedTime,
                topik,
                status: 'Menunggu',
            }])
            .select()
            .single();

        if (error) {
            alert('Gagal menjadwalkan sesi: ' + error.message);
            btnConfirm.disabled = false;
            btnConfirm.innerHTML = 'Konfirmasi Jadwal ➔';
            return;
        }

        localStorage.setItem('active_session_id', sesi.id);
        alert(`Jadwal berhasil dikonfirmasi pada ${formatTanggalIndo(selectedDate)} pukul ${selectedTime}.`);
        window.location.href = 'live-chat.html?sesi_id=' + sesi.id;
    });
}

// ----------------------------------------------------------------------
// 9. HALAMAN LIVE CHAT MAHASISWA (live-chat.html?sesi_id=...)
// ----------------------------------------------------------------------
async function initLiveChatPage() {
    const btnKirim = document.getElementById('btn-kirim-chat');
    const inputChat = qs('input[placeholder="Tuliskan isi hatimu di sini..."]');
    const chatArea = qs('[data-section="chat-area"]');
    if (!btnKirim) return;

    const profile = await auth.requireLogin();
    if (!profile) return;

    const params = new URLSearchParams(window.location.search);
    let sesiId = params.get('sesi_id') || localStorage.getItem('active_session_id');

    if (!sesiId) {
        alert('Sesi tidak ditemukan. Silakan jadwalkan sesi terlebih dahulu.');
        window.location.href = 'pilih-konselor.html';
        return;
    }

    async function loadPesan() {
        const { data: pesan, error } = await supabaseClient
            .from('pesan')
            .select('*, users:pengirim_id(nama_lengkap, role, avatar_seed)')
            .eq('sesi_id', sesiId)
            .order('created_at', { ascending: true });

        if (error || !chatArea) return;

        chatArea.innerHTML = (pesan || []).map((p) => {
            const milikSaya = p.pengirim_id === profile.id;
            const jam = new Date(p.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            return milikSaya
                ? `<div class="flex flex-col items-end self-end max-w-[80%]">
                       <div class="bg-brand-blue text-white px-6 py-4 rounded-3xl rounded-br-sm text-sm leading-relaxed shadow-sm">${escapeHtml(p.isi)}</div>
                       <span class="text-[10px] text-gray-400 mt-1.5 mr-2 uppercase">Anda • ${jam}</span>
                   </div>`
                : `<div class="flex flex-col items-start max-w-[80%]">
                       <div class="bg-gray-100 text-gray-700 px-6 py-4 rounded-3xl rounded-tl-sm text-sm leading-relaxed shadow-sm">${escapeHtml(p.isi)}</div>
                       <span class="text-[10px] text-gray-400 mt-1.5 ml-2 uppercase">${escapeHtml(p.users?.nama_lengkap || 'Konselor')} • ${jam}</span>
                   </div>`;
        }).join('');
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    async function kirimPesan() {
        const isi = inputChat.value.trim();
        if (!isi) return;

        inputChat.value = '';
        const { error } = await supabaseClient.from('pesan').insert([{ sesi_id: sesiId, pengirim_id: profile.id, isi }]);
        if (error) { console.error(error); return; }
        await loadPesan();
    }

    btnKirim.addEventListener('click', kirimPesan);
    if (inputChat) {
        inputChat.addEventListener('keypress', (e) => { if (e.key === 'Enter') kirimPesan(); });
    }

    await loadPesan();

    supabaseClient
        .channel(`pesan-sesi-${sesiId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pesan', filter: `sesi_id=eq.${sesiId}` }, () => loadPesan())
        .subscribe();

    const btnAkhiri = document.getElementById('btn-akhiri-sesi');
    if (btnAkhiri) {
        btnAkhiri.addEventListener('click', async () => {
            await supabaseClient.from('sesi').update({ status: 'Selesai', waktu_selesai: new Date().toTimeString().slice(0, 5) }).eq('id', sesiId);
            window.location.href = `ringkasan-sesi.html?sesi_id=${sesiId}`;
        });
    }
}

// ----------------------------------------------------------------------
// 10. HALAMAN RINGKASAN SESI (ringkasan-sesi.html?sesi_id=...)
// ----------------------------------------------------------------------
async function initRingkasanSesiPage() {
    const params = new URLSearchParams(window.location.search);
    const sesiId = params.get('sesi_id') || localStorage.getItem('active_session_id');
    if (!sesiId) return;

    const { data: sesi, error } = await supabaseClient
        .from('sesi')
        .select('*, konselor:konselor_id(jurusan, level, users:user_id(nama_lengkap, avatar_seed))')
        .eq('id', sesiId)
        .single();

    if (error || !sesi) return;

    setText('[data-sesi="kode"]', sesi.kode_sesi);
    setText('[data-sesi="tanggal"]', formatTanggalIndo(sesi.tanggal));
    setText('[data-sesi="konselor-nama"]', sesi.konselor?.users?.nama_lengkap || '-');
    setText('[data-sesi="catatan-konselor"]', sesi.catatan_konselor || 'Konselor belum menambahkan catatan untuk sesi ini.');

    const avatarKonselor = qs('[data-sesi="konselor-avatar"]');
    if (avatarKonselor) avatarKonselor.src = avatarUrl(sesi.konselor?.users?.avatar_seed);

    const linkPenilaian = qs('[data-action="ke-penilaian"]');
    if (linkPenilaian) linkPenilaian.href = `penilaian.html?sesi_id=${sesiId}`;
}

// ----------------------------------------------------------------------
// 11. HALAMAN PENILAIAN (penilaian.html?sesi_id=...)
// ----------------------------------------------------------------------
function initPenilaianPage() {
    const form = document.getElementById('evaluationForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const profile = await auth.requireLogin();
        if (!profile) return;

        const params = new URLSearchParams(window.location.search);
        const sesiId = params.get('sesi_id') || localStorage.getItem('active_session_id');
        if (!sesiId) {
            alert('Sesi tidak ditemukan. Penilaian harus dikaitkan dengan sesi yang sudah selesai.');
            return;
        }

        const formData = new FormData(form);
        const btnSubmit = document.getElementById('btn-submit');

        const required = ['qA1', 'qA2', 'qB1', 'qB2', 'qC1', 'qW1', 'qW2', 'qW3', 'rekomendasi'];
        for (const name of required) {
            if (!formData.get(name)) {
                alert('Mohon lengkapi seluruh pertanyaan sebelum mengirim.');
                return;
            }
        }

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = 'Menyimpan Penilaian... ⏳';

        const num = (name) => parseInt(formData.get(name), 10);

        const { data: sesi } = await supabaseClient.from('sesi').select('konselor_id').eq('id', sesiId).single();
        if (!sesi) {
            alert('Sesi tidak valid.');
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'Kirim Penilaian';
            return;
        }

        const skorKonselor = [num('qA1'), num('qA2'), num('qB1'), num('qB2'), num('qC1')];
        const skorPlatform = [num('qW1'), num('qW2'), num('qW3'), num('qW4') || num('qW3')];
        const rataKonselor = skorKonselor.reduce((a, b) => a + b, 0) / skorKonselor.length;
        const rataPlatform = skorPlatform.reduce((a, b) => a + b, 0) / skorPlatform.length;

        const payload = {
            sesi_id: sesiId,
            mahasiswa_id: profile.id,
            konselor_id: sesi.konselor_id,
            skor_empati: num('qA1'),
            skor_komunikasi: num('qA2'),
            skor_solusi: num('qB1'),
            skor_kenyamanan: num('qB2'),
            skor_kerahasiaan: num('qC1'),
            skor_navigasi: num('qW1'),
            skor_visual: num('qW2'),
            skor_instruksi: num('qW3'),
            skor_respon_sistem: num('qW4') || num('qW3'),
            skor_rata_konselor: Number(rataKonselor.toFixed(2)),
            skor_rata_platform: Number(rataPlatform.toFixed(2)),
            skor_total: Number(((rataKonselor + rataPlatform) / 2).toFixed(2)),
            rekomendasi: formData.get('rekomendasi') === 'ya',
            komentar: formData.get('saran') || null,
        };

        const { error } = await supabaseClient.from('penilaian').insert([payload]);

        if (error) {
            alert('Gagal mengirim penilaian: ' + error.message);
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = 'Kirim Penilaian';
            return;
        }

        localStorage.removeItem('active_session_id');
        alert('Terima kasih! Penilaian Anda berhasil tersimpan.');
        window.location.href = 'index.html';
    });
}

// ----------------------------------------------------------------------
// 12. HALAMAN RIWAYAT (riwayat.html)
// ----------------------------------------------------------------------
function renderSesiCard(s) {
    const namaKonselor = s.konselor?.users?.nama_lengkap || 'Konselor';
    const jurusanKonselor = s.konselor?.jurusan || '-';
    const tanggalFmt = formatTanggalIndo(s.tanggal);

    if (s.status === 'Berlangsung' || s.status === 'Menunggu') {
        return `
            <div class="bg-white p-8 rounded-[35px] border border-gray-100 shadow-sm flex flex-col justify-between">
                <div class="flex justify-between items-start mb-8">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center text-xs border border-gray-100 shadow-sm">
                            <img src="${avatarUrl(s.konselor?.users?.avatar_seed)}" class="w-full h-full object-cover">
                        </div>
                        <div>
                            <h3 class="font-bold text-gray-900 text-lg leading-tight">${escapeHtml(namaKonselor)}</h3>
                            <p class="text-[11px] text-gray-400 font-medium mt-0.5">${escapeHtml(jurusanKonselor)}</p>
                        </div>
                    </div>
                    <div class="bg-[#DBF69D] rounded-full px-3 py-2 flex items-center gap-2">
                        <div class="w-1.5 h-1.5 bg-[#166534] rounded-full"></div>
                        <span class="text-[9px] font-extrabold text-[#166534] uppercase tracking-wider">${s.status === 'Berlangsung' ? 'Berlangsung' : 'Menunggu'}</span>
                    </div>
                </div>
                <div class="mb-8">
                    <p class="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-1">Tanggal & Jam Sesi</p>
                    <h2 class="text-3xl font-bold text-brand-blue leading-tight">${tanggalFmt},<br>${s.waktu_mulai} WIB</h2>
                </div>
                <a href="live-chat.html?sesi_id=${s.id}" class="w-full bg-[#4D7C0F] hover:bg-green-800 text-white font-semibold py-3.5 rounded-2xl transition flex justify-center items-center gap-2">💬 Hubungi Konselor</a>
            </div>`;
    }

    if (s.status === 'Selesai') {
        return `
            <div class="bg-white p-8 rounded-[35px] border border-gray-100 shadow-sm flex flex-col justify-between">
                <div class="flex justify-between items-start mb-8">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center text-xs border border-gray-100">
                            <img src="${avatarUrl(s.konselor?.users?.avatar_seed)}" class="w-full h-full object-cover">
                        </div>
                        <div>
                            <h3 class="font-bold text-gray-900 text-lg leading-tight">${escapeHtml(namaKonselor)}</h3>
                            <p class="text-[11px] text-gray-500">${escapeHtml(jurusanKonselor)}</p>
                        </div>
                    </div>
                    <span class="bg-[#E0F2FE] text-[#0369A1] text-[9px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">Selesai</span>
                </div>
                <div class="mb-8">
                    <p class="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-1">Tanggal & Jam Sesi</p>
                    <h2 class="text-3xl font-bold text-gray-400 leading-tight">${tanggalFmt},<br>${s.waktu_mulai} WIB</h2>
                </div>
                <a href="ringkasan-sesi.html?sesi_id=${s.id}" class="w-full bg-btn-blue-light hover:bg-[#38BDF8] text-[#0369A1] hover:text-white font-semibold py-3.5 rounded-2xl transition flex justify-center items-center gap-2">📄 Lihat Ringkasan</a>
            </div>`;
    }

    return `
        <div class="bg-card-gray p-8 rounded-[35px] flex flex-col justify-between opacity-70">
            <div class="flex justify-between items-start mb-8">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">👤</div>
                    <div>
                        <h3 class="font-bold text-gray-900 text-lg leading-tight">${escapeHtml(namaKonselor)}</h3>
                        <p class="text-[11px] text-gray-500">${escapeHtml(jurusanKonselor)}</p>
                    </div>
                </div>
                <span class="bg-gray-200 text-gray-600 text-[9px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wider">Dibatalkan</span>
            </div>
            <div class="mb-8">
                <p class="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-1">Tanggal & Jam Sesi</p>
                <h2 class="text-3xl font-bold text-gray-400 leading-tight">${tanggalFmt},<br>${s.waktu_mulai} WIB</h2>
            </div>
            <button disabled class="w-full bg-gray-200 text-gray-400 font-semibold py-3.5 rounded-2xl cursor-not-allowed">Sesi Dibatalkan</button>
        </div>`;
}

async function initRiwayatPage() {
    const container = qs('[data-section="sesi-list"]');
    if (!container) return;

    const profile = await auth.requireLogin();
    if (!profile) return;

    const { data: daftarSesi, error } = await supabaseClient
        .from('sesi')
        .select('*, konselor:konselor_id(jurusan, users:user_id(nama_lengkap, avatar_seed))')
        .eq('mahasiswa_id', profile.id)
        .order('tanggal', { ascending: false })
        .order('waktu_mulai', { ascending: false });

    if (error) { console.error(error); return; }

    container.innerHTML = (daftarSesi && daftarSesi.length > 0)
        ? daftarSesi.map(renderSesiCard).join('')
        : '<div class="col-span-3 text-center py-10 text-gray-400 text-sm">Kamu belum memiliki riwayat sesi konseling.</div>';

    const bulanIni = new Date().getMonth();
    const tahunIni = new Date().getFullYear();
    const sesiBulanIni = (daftarSesi || []).filter((s) => {
        const d = new Date(s.tanggal);
        return d.getMonth() === bulanIni && d.getFullYear() === tahunIni && s.status === 'Selesai';
    });
    setText('[data-stat="total-sesi-bulan"]', String(sesiBulanIni.length).padStart(2, '0'));
    setText('[data-stat="total-menit-bulan"]', sesiBulanIni.length * 60);
}

// ----------------------------------------------------------------------
// INIT: EKSEKUSI BERDASARKAN URL
// ----------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    await initNavbar();

    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';

    switch (page) {
        case '':
        case 'index.html':
            await initIndexPage();
            break;
        case 'login.html':
        case 'pendaftaran.html':
            initLoginPage();
            break;
        case 'pilih-konselor.html':
            await initPilihKonselorPage();
            break;
        case 'profil-konselor.html':
            await initProfilKonselorPage();
            break;
        case 'penjadwalan.html':
            await initPenjadwalanPage();
            break;
        case 'live-chat.html':
            await initLiveChatPage();
            break;
        case 'ringkasan-sesi.html':
            await initRingkasanSesiPage();
            break;
        case 'penilaian.html':
            initPenilaianPage();
            break;
        case 'riwayat.html':
            await initRiwayatPage();
            break;
        default:
            console.warn(`[Router] Bypass eksekusi: Tidak ada instruksi inisialisasi untuk ${page}`);
            break;
    }
});