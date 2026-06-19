/**
 * ============================================================================
 * Polimedia Peer Counselor — Supabase Integration Layer (js/api.js)
 * ============================================================================
 */

// ----------------------------------------------------------------------
// 1. KONFIGURASI KLIEN SUPABASE
// ----------------------------------------------------------------------
const SUPABASE_URL = 'https://nqvohyidkegkwffnkcjg.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xdm9oeWlka2Vna3dmZm5rY2pnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE2MDY4MTAsImV4cCI6MjA5NzE4MjgxMH0.v9L58CSuqyUUd9tdOVp5Zhul0a4zYvsQnI2pGCiwI04';

if (typeof window.supabase === 'undefined') {
    console.error('[api.js] SDK Supabase tidak terdeteksi di DOM.');
}

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
window.supabaseClient = supabaseClient;

// ----------------------------------------------------------------------
// UTILITAS / HELPER GLOBAL
// ----------------------------------------------------------------------
const fmtRating = (val) => (val === null || val === undefined ? '0.0' : Number(val).toFixed(1));
const avatarUrl = (seed) => `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed || 'Guest')}`;
const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const setText = (selector, value) => { const el = document.querySelector(selector); if (el) el.textContent = value; };
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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
// 2. MODUL AUTENTIKASI DAN GUARD KEAMANAN
// ----------------------------------------------------------------------
const auth = {
    async getSession() {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) return null;
        return data.session;
    },
    async getProfile() {
        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return null;
        const { data: profile } = await supabaseClient
            .from('users')
            .select('*, konselor(id, level, jurusan, spesialisasi, total_sesi, rating_rata, status, bio)')
            .eq('id', user.id).single();
        return profile;
    },
    async logout() {
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
    },
    async requireLogin() {
        const session = await this.getSession();
        if (!session) { window.location.href = 'login.html'; return null; }
        return await this.getProfile();
    }
};
window.PolimediaAuth = auth;

async function initNavbar() {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    const btnLogout = document.getElementById('btnLogout');
    const navAvatar = qs('[data-nav="avatar"]');

    if (session) {
        const profile = await auth.getProfile();
        if (btnLogout) {
            btnLogout.classList.remove('hidden');
            btnLogout.addEventListener('click', async (e) => { e.preventDefault(); await auth.logout(); });
        }
        if (navAvatar && profile) navAvatar.src = avatarUrl(profile.avatar_seed || profile.nama_lengkap);
    } else if (btnLogout) {
        btnLogout.classList.add('hidden');
    }
}

// ----------------------------------------------------------------------
// 4. LOGIKA AUTENTIKASI MASUK & DAFTAR (login.html)
// ----------------------------------------------------------------------
function initLoginPage() {
    window.handleLogin = async (e) => {
        e.preventDefault();
        const email = qs('#loginForm input[type="email"]').value.trim();
        const password = document.getElementById('loginPassword').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        submitBtn.disabled = true; submitBtn.innerHTML = 'Memproses...';
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

        if (error) {
            alert('Login gagal: Email atau sandi salah.');
            submitBtn.disabled = false; submitBtn.innerHTML = originalText; return;
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
        const program_studi = document.getElementById('regProdi').value;
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;

        if (!nama_lengkap || !nim || !program_studi || !email || !password) {
            alert('Mohon lengkapi semua data wajib.'); return;
        }

        submitBtn.disabled = true; submitBtn.innerHTML = 'Membuat Akun...';

        try {
            const { data, error: authError } = await supabaseClient.auth.signUp({
                email, password,
                options: { data: { nama_lengkap, nim, program_studi, role: 'mahasiswa' } }
            });

            if (authError) throw authError;

            if (data && data.user) {
                const { error: dbError } = await supabaseClient.from('users').insert([
                    { id: data.user.id, email: email, nama_lengkap, nim, program_studi, role: 'mahasiswa', avatar_seed: nama_lengkap }
                ]);

                if (dbError) throw dbError;

                alert('Pendaftaran berhasil dilakukan!');
                if (typeof window.toggleView === 'function') window.toggleView('login');
            }
        } catch (error) {
            console.error('[Register Error]:', error);
            alert('Registrasi gagal: ' + error.message);
        } finally {
            submitBtn.disabled = false; submitBtn.innerHTML = originalText;
        }
    };
}

// ----------------------------------------------------------------------
// 5. LOGIKA HALAMAN BERANDA (index.html)
// ----------------------------------------------------------------------
window.toggleAccordion = function(id) {
    const target = document.getElementById(id);
    if (!target) return;
    const isHidden = target.classList.contains('hidden');
    document.querySelectorAll('.counselor-detail').forEach(el => el.classList.add('hidden'));
    if (isHidden) target.classList.remove('hidden');
};

async function initIndexPage() {
    async function loadStats() {
        const { data } = await supabaseClient.from('kuesioner_evaluasi').select('*');
        if (data) {
            const total = data.length;
            let skorGlobal = 0, rek = 0;
            data.forEach(row => {
                skorGlobal += (row.q_mendengarkan + row.q_memahami + row.q_penjelasan + row.q_solusi + row.q_komunikasi + row.q_profesional + row.q_nyaman + row.q_rahasia) / 8;
                if (row.rekomendasi) rek++;
            });
            setText('#homeTotalResponden', total.toLocaleString('id-ID'));
            setText('#homeRataSkor', total > 0 ? (skorGlobal / total).toFixed(2) : "0.00");
            setText('#homePersenRekomendasi', total > 0 ? Math.round((rek / total) * 100) + '%' : "0%");
        }
    }

    async function loadUlasan() {
        const container = document.getElementById('ulasanContainer');
        if (!container) return;
        const { data: ulasan } = await supabaseClient
            .from('penilaian')
            .select('komentar, skor_total, created_at, sesi!inner(users(program_studi))')
            .not('komentar', 'is', null).order('created_at', { ascending: false }).limit(3);

        if (ulasan && ulasan.length > 0) {
            container.innerHTML = ulasan.map((u) => {
                const rating = Math.round(u.skor_total || 5);
                const prodi = u.sesi?.users?.program_studi || 'Polimedia';
                return `
                <div class="bg-white p-6 rounded-3xl border border-gray-100 card-shadow flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-start mb-4">
                            <div class="text-[#F59E0B] text-xs tracking-widest">${'★'.repeat(rating)}</div>
                            <span class="text-[10px] text-gray-400">${waktuRelatif(u.created_at)}</span>
                        </div>
                        <p class="text-sm text-gray-600 leading-relaxed mb-6">"${escapeHtml(u.komentar)}"</p>
                    </div>
                    <div class="flex items-center gap-3 pt-4 border-t border-gray-50">
                        <div class="w-8 h-8 rounded-full bg-slate-200 overflow-hidden"><img src="${avatarUrl(prodi)}" class="w-full h-full object-cover"></div>
                        <h4 class="text-[11px] font-bold text-gray-800">Mahasiswa ${escapeHtml(prodi)}</h4>
                    </div>
                </div>`;
            }).join('');
        } else {
            container.innerHTML = '<div class="col-span-3 text-center py-10 text-gray-400 text-sm">Belum ada ulasan tersedia. Selesaikan sesi pertama Anda.</div>';
        }
    }

    async function loadTopik() {
        const container = document.getElementById('topikContainer');
        if (!container) return;
        const { data: sesiTopik } = await supabaseClient.from('sesi').select('topik').eq('status', 'Selesai').not('topik', 'is', null);

        if (sesiTopik && sesiTopik.length > 0) {
            const counts = {}; sesiTopik.forEach((s) => { counts[s.topik] = (counts[s.topik] || 0) + 1; });
            const total = sesiTopik.length; const palet = ['#00668F', '#4D7C0F', '#4F46E5', '#D97706', '#E11D48'];
            const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);

            container.innerHTML = sorted.map(([nama, jumlah], i) => {
                const persen = Math.round((jumlah / total) * 100); const warna = palet[i % palet.length];
                return `
                <div>
                    <div class="flex justify-between text-xs font-bold text-gray-900 mb-2">
                        <span>${escapeHtml(nama).toUpperCase()}</span><span style="color: ${warna}">${persen}%</span>
                    </div>
                    <div class="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div style="background-color: ${warna}; width: ${persen}%" class="h-full rounded-full transition-all duration-500"></div>
                    </div>
                </div>`;
            }).join('');
        } else {
            container.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">Belum ada data distribusi topik.</div>';
        }
    }

    async function loadKonselor() {
        const container = document.getElementById('konselorContainer');
        if (!container) return;
        const { data: konselor } = await supabaseClient
            .from('konselor')
            .select('id, level, jurusan, status, total_sesi, rating_rata, users(nama_lengkap, avatar_seed)')
            .order('rating_rata', { ascending: false }).limit(3);

        if (konselor && konselor.length > 0) {
            container.innerHTML = konselor.map((k, index) => {
                const isTersedia = k.status === 'Tersedia';
                const statusHTML = isTersedia ? `<span class="bg-green-50 text-green-700 px-3 py-1.5 rounded-full text-[10px] font-bold flex items-center gap-1.5"><span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> Tersedia</span>` : `<span class="bg-gray-100 text-gray-500 px-3 py-1.5 rounded-full text-[10px] font-bold">Sesi Penuh</span>`;
                const chartId = `dynamicChart_${k.id || index}`;
                const kepuasanDesimal = fmtRating(k.rating_rata);
                const kepuasanPersen = Math.round((k.rating_rata / 5) * 100) || 0;
                const nama = k.users?.nama_lengkap || 'Konselor Sebaya';

                return `
                <div class="px-6 md:px-10 mb-4">
                    <div onclick="toggleAccordion('detail-${chartId}')" class="cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between p-4 px-6 md:px-8 bg-white rounded-3xl md:rounded-full shadow-sm hover:shadow-md border border-transparent hover:border-brand-blue/20 transition-all">
                        <div class="w-full md:w-1/3 flex items-center gap-4 mb-3 md:mb-0">
                            <div class="w-10 h-10 flex items-center justify-center font-bold text-xs rounded-full bg-blue-50 text-brand-blue overflow-hidden"><img src="${avatarUrl(k.users?.avatar_seed || nama)}" class="w-full h-full object-cover"></div>
                            <div><h3 class="font-bold text-gray-900 text-sm">${escapeHtml(nama)}</h3><p class="text-[10px] text-gray-400">Level: ${escapeHtml(k.level || 'Peer')}</p></div>
                        </div>
                        <div class="w-full md:w-1/4 text-xs text-gray-600 font-medium mb-3 md:mb-0">${escapeHtml(k.jurusan || '-')}</div>
                        <div class="w-full md:w-1/4 flex items-center gap-1.5 text-xs font-bold text-gray-800 mb-3 md:mb-0"><span class="text-[#10B981]">★</span> ${kepuasanPersen}% <span class="text-[10px] text-gray-400 font-normal">(${k.total_sesi || 0} Sesi)</span></div>
                        <div class="w-full md:w-1/6 flex justify-start md:justify-end">${statusHTML}</div>
                    </div>
                    <div id="detail-${chartId}" class="counselor-detail hidden mt-6 mb-8 px-2 md:px-8 fade-in-down">
                        <div class="bg-white rounded-[20px] p-8 mb-6 shadow-sm border border-gray-100 flex justify-between items-center">
                            <div><p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-2">Rata-rata Penilaian</p><div class="flex items-baseline gap-2 mb-2"><h3 class="text-4xl font-black text-gray-900">${kepuasanDesimal}</h3><span class="text-sm font-bold text-gray-400">/ 5.0</span></div></div>
                            <div class="w-14 h-14 bg-[#004A6A] text-white rounded-full flex items-center justify-center text-xl shadow-md">★</div>
                        </div>
                        <div class="bg-white rounded-[20px] p-8 border border-gray-100">
                            <h4 class="font-bold text-gray-800 text-sm mb-4">Tren Penilaian Terakhir</h4>
                            <div class="relative h-48 w-full"><canvas id="${chartId}"></canvas></div>
                        </div>
                    </div>
                </div>`;
            }).join('');

            // Memuat Chart Tren Penilaian Konselor
            if (typeof Chart !== 'undefined') {
                for (const k of konselor) {
                    const ctx = document.getElementById(`dynamicChart_${k.id}`);
                    if (!ctx) continue;

                    const { data: listPenilaian } = await supabaseClient
                        .from('penilaian')
                        .select('skor_total, created_at, sesi!inner(konselor_id)')
                        .eq('sesi.konselor_id', k.id);

                    const bulanan = {}; const labelBulan = []; const dataPoin = []; const skrg = new Date();

                    for (let i = 4; i >= 0; i--) {
                        const d = new Date(skrg.getFullYear(), skrg.getMonth() - i, 1);
                        const kuncian = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        bulanan[kuncian] = []; labelBulan.push(d.toLocaleDateString('id-ID', { month: 'short' }));
                    }

                    if (listPenilaian) {
                        listPenilaian.forEach(p => { const m = p.created_at.slice(0, 7); if (bulanan[m]) bulanan[m].push(p.skor_total); });
                    }

                    Object.keys(bulanan).forEach(kunci => {
                        const arr = bulanan[kunci];
                        dataPoin.push(arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null);
                    });

                    new Chart(ctx.getContext('2d'), {
                        type: 'bar',
                        data: { labels: labelBulan, datasets: [{ data: dataPoin, backgroundColor: '#0F172A', borderRadius: 4, barThickness: 32 }] },
                        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { min: 0, max: 5 }, x: { grid: { display: false } } } }
                    });
                }
            }
        }
    }

    await Promise.all([loadStats(), loadUlasan(), loadTopik(), loadKonselor()]);

    supabaseClient.channel('beranda-sinkronisasi-global')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'kuesioner_evaluasi' }, loadStats)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'penilaian' }, () => { loadUlasan(); loadKonselor(); })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sesi' }, () => { loadTopik(); loadKonselor(); }).subscribe();
}

// ----------------------------------------------------------------------
// 6. HALAMAN PILIH KONSELOR (pilih-konselor.html)
// ----------------------------------------------------------------------
function debounce(fn, delay) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), delay); }; }

async function initPilihKonselorPage() {
    const grid = qs('[data-section="konselor-grid"]'); if (!grid) return;
    const searchInput = qs('[data-filter="search"]');
    const topikSelect = qs('[data-filter="topik"]');
    const statusSelect = qs('[data-filter="status"]');

    async function loadDaftarKonselor() {
        grid.innerHTML = '<div class="col-span-3 text-center py-10 text-gray-400 text-sm">Memuat konselor...</div>';
        const { data, error } = await supabaseClient.from('konselor').select('id, level, jurusan, spesialisasi, total_sesi, rating_rata, status, bio, users(nama_lengkap, avatar_seed, is_active)').order('rating_rata', { ascending: false });
        if (error) { grid.innerHTML = '<div class="col-span-3 text-center py-10 text-red-400 text-sm">Gagal memuat data konselor.</div>'; return; }

        let list = (data || []).filter(k => k.users && k.users.is_active).map(k => ({ ...k, nama_lengkap: k.users.nama_lengkap, avatar_seed: k.users.avatar_seed }));
        const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
        const topikFilter = topikSelect ? topikSelect.value : '';
        const statusFilter = statusSelect ? statusSelect.value : '';

        if (searchTerm) list = list.filter(k => k.nama_lengkap.toLowerCase().includes(searchTerm) || (k.jurusan || '').toLowerCase().includes(searchTerm));
        if (topikFilter) list = list.filter(k => (k.spesialisasi || []).some(s => s.toLowerCase().includes(topikFilter.toLowerCase())));
        if (statusFilter === 'tersedia') list = list.filter(k => k.status === 'Tersedia');

        grid.innerHTML = list.length > 0 ? list.map(k => {
            const tersedia = k.status === 'Tersedia'; const sp = Array.isArray(k.spesialisasi) ? k.spesialisasi : [];
            return `
            <div class="bg-white rounded-[30px] p-6 shadow-sm border border-gray-100 hover:shadow-md transition flex flex-col h-full ${tersedia ? '' : 'opacity-75'}">
                <div class="flex justify-between items-start mb-4">
                    <div class="w-16 h-16 rounded-full bg-blue-100 text-brand-blue overflow-hidden"><img src="${avatarUrl(k.avatar_seed)}" class="w-full h-full object-cover"></div>
                    <span class="${tersedia ? 'bg-green-50 text-brand-green' : 'bg-gray-100 text-gray-500'} px-3 py-1 rounded-full text-[10px] font-bold uppercase">${escapeHtml(k.status)}</span>
                </div>
                <h3 class="text-xl font-bold text-gray-800 mb-1">${escapeHtml(k.nama_lengkap)}</h3>
                <p class="text-xs text-gray-400 mb-4">${escapeHtml(k.jurusan)} • ${escapeHtml(k.level)}</p>
                <div class="flex items-center gap-1 text-brand-green text-sm mb-4">★ ${fmtRating(k.rating_rata)} <span class="text-gray-400 text-xs ml-1">(${k.total_sesi} Sesi)</span></div>
                <div class="flex flex-wrap gap-2 mb-6">${sp.map(s => `<span class="bg-slate-50 text-gray-500 text-xs px-3 py-1.5 rounded-lg border">${escapeHtml(s)}</span>`).join('')}</div>
                <div class="flex-grow"></div>
                ${tersedia ? `<a href="profil-konselor.html?id=${k.id}" class="block w-full text-center bg-brand-light text-brand-blue hover:bg-brand-blue hover:text-white py-3 rounded-2xl font-semibold transition">Lihat Profil</a>` : `<button disabled class="w-full text-center bg-gray-50 text-gray-400 py-3 rounded-2xl cursor-not-allowed">Sesi Penuh</button>`}
            </div>`;
        }).join('') : '<div class="col-span-3 text-center py-10 text-gray-400 text-sm">Tidak ada konselor yang cocok.</div>';
    }

    if (searchInput) searchInput.addEventListener('input', debounce(loadDaftarKonselor, 300));
    if (topikSelect) topikSelect.addEventListener('change', loadDaftarKonselor);
    if (statusSelect) statusSelect.addEventListener('change', loadDaftarKonselor);
    await loadDaftarKonselor();
}

// ----------------------------------------------------------------------
// 7. HALAMAN PROFIL KONSELOR (profil-konselor.html)
// ----------------------------------------------------------------------
async function initProfilKonselorPage() {
    const params = new URLSearchParams(window.location.search); const konselorId = params.get('id'); if (!konselorId) return;
    const { data: k, error } = await supabaseClient.from('konselor').select('*, users(nama_lengkap, avatar_seed)').eq('id', konselorId).single();
    if (error || !k) { qs('main').insertAdjacentHTML('afterbegin', '<div class="text-center py-10 text-red-400 text-sm">Konselor tidak ditemukan.</div>'); return; }

    setText('[data-konselor="nama"]', k.users?.nama_lengkap);
    setText('[data-konselor="info"]', `${k.jurusan || '-'} • ${k.level}`);
    setText('[data-konselor="rating"]', `${fmtRating(k.rating_rata)} / 5.0 (${k.total_sesi} Sesi Berhasil)`);
    setText('[data-konselor="bio"]', k.bio || '');

    const btnJanji = qs('[data-action="buat-janji"]'); if (btnJanji) btnJanji.href = `penjadwalan.html?konselor_id=${k.id}`;

    const containerUlasan = qs('[data-section="ulasan-konselor"]');
    if (containerUlasan) {
        const { data: ulasan } = await supabaseClient
            .from('penilaian')
            .select('komentar, skor_total, created_at, sesi!inner(konselor_id, users(program_studi))')
            .eq('sesi.konselor_id', k.id).not('komentar', 'is', null).order('created_at', { ascending: false }).limit(5);

        if (ulasan && ulasan.length > 0) {
            containerUlasan.innerHTML = ulasan.map((u) => `
                <div class="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                    <div class="flex justify-between items-center mb-3">
                        <div class="text-brand-green text-xs">${'★'.repeat(Math.round(u.skor_total || 5))}</div>
                        <span class="text-xs text-gray-400">${waktuRelatif(u.created_at)}</span>
                    </div>
                    <p class="text-sm text-gray-600 mb-4 leading-relaxed">"${escapeHtml(u.komentar)}"</p>
                    <div class="flex items-center gap-3">
                        <div class="w-6 h-6 bg-slate-200 rounded-full overflow-hidden"><img src="${avatarUrl(u.sesi?.users?.program_studi)}" class="w-full h-full object-cover"></div>
                        <span class="text-xs font-medium text-gray-500">Mahasiswa ${escapeHtml(u.sesi?.users?.program_studi || 'Polimedia')}</span>
                    </div>
                </div>`).join('');
        } else { containerUlasan.innerHTML = '<div class="text-center py-6 text-gray-400 text-sm">Belum ada ulasan untuk konselor ini.</div>'; }
    }
}

// ----------------------------------------------------------------------
// 8. HALAMAN PENJADWALAN (penjadwalan.html)
// ----------------------------------------------------------------------
async function initPenjadwalanPage() {
    const profile = await auth.requireLogin(); if (!profile) return;
    if (profile.role !== 'mahasiswa') { window.location.href = 'index.html'; return; }

    const params = new URLSearchParams(window.location.search); const konselorId = params.get('konselor_id');
    const btnConfirm = document.getElementById('btn-confirm'); if (!btnConfirm || !konselorId) return;

    const { data: k } = await supabaseClient.from('konselor').select('users(nama_lengkap)').eq('id', konselorId).single();
    if (k) qsa('[data-konselor="nama-jadwal"]').forEach((el) => { el.textContent = k.users?.nama_lengkap; });

    let selectedDate = null, selectedTime = null;
    const dateButtons = qsa('.date-btn'), timeButtons = qsa('.time-btn');
    const summaryDate = document.getElementById('summary-date'), summaryTime = document.getElementById('summary-time');

    dateButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            dateButtons.forEach(b => { b.classList.remove('bg-brand-green', 'text-white'); b.classList.add('bg-green-50', 'text-brand-green'); });
            btn.classList.remove('bg-green-50', 'text-brand-green'); btn.classList.add('bg-brand-green', 'text-white');
            selectedDate = btn.getAttribute('data-full-date');
            if (summaryDate) summaryDate.textContent = formatTanggalIndo(selectedDate);
        });
    });

    timeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            timeButtons.forEach(b => { b.classList.remove('bg-brand-blue', 'text-white'); b.classList.add('bg-slate-50', 'text-gray-600'); });
            btn.classList.remove('bg-slate-50', 'text-gray-600'); btn.classList.add('bg-brand-blue', 'text-white');
            selectedTime = btn.getAttribute('data-time'); if (summaryTime) summaryTime.textContent = selectedTime;
        });
    });

    btnConfirm.addEventListener('click', async () => {
        if (!selectedDate || !selectedTime) { alert('Pilih tanggal dan jam terlebih dahulu.'); return; }
        btnConfirm.disabled = true; btnConfirm.innerHTML = 'Menjadwalkan...';
        const topikSelect = document.getElementById('topik-sesi');
        const { data: sesi, error } = await supabaseClient.from('sesi').insert([{
            kode_sesi: `SES-${Date.now()}`, mahasiswa_id: profile.id, konselor_id: konselorId,
            tanggal: selectedDate, waktu_mulai: selectedTime, topik: topikSelect ? topikSelect.value : 'Umum', status: 'Menunggu'
        }]).select().single();

        if (error) { alert('Gagal menjadwalkan: ' + error.message); btnConfirm.disabled = false; btnConfirm.innerHTML = 'Konfirmasi Jadwal'; return; }
        localStorage.setItem('active_session_id', sesi.id); window.location.href = 'live-chat.html?sesi_id=' + sesi.id;
    });
}

// ----------------------------------------------------------------------
// 9. HALAMAN LIVE CHAT (live-chat.html)
// ----------------------------------------------------------------------
async function initLiveChatPage() {
    const profile = await auth.requireLogin(); if (!profile) return;
    if (profile.role !== 'mahasiswa') { window.location.href = 'index.html'; return; }

    const btnKirim = document.getElementById('btn-kirim-chat');
    const inputChat = qs('input[placeholder="Tuliskan isi hatimu di sini..."]');
    const chatArea = qs('[data-section="chat-area"]'); if (!btnKirim) return;

    const sesiId = new URLSearchParams(window.location.search).get('sesi_id') || localStorage.getItem('active_session_id');
    if (!sesiId) { window.location.href = 'pilih-konselor.html'; return; }

    async function loadPesan() {
        const { data: pesan, error } = await supabaseClient.from('pesan').select('*, users(nama_lengkap)').eq('sesi_id', sesiId).order('created_at', { ascending: true });
        if (error || !chatArea) return;

        chatArea.innerHTML = (pesan || []).map((p) => {
            const milikSaya = p.pengirim_id === profile.id; const jam = new Date(p.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            return milikSaya
                ? `<div class="flex flex-col items-end self-end max-w-[80%]"><div class="bg-brand-blue text-white px-6 py-4 rounded-3xl rounded-br-sm text-sm">${escapeHtml(p.isi)}</div><span class="text-[10px] text-gray-400 mt-1">Anda • ${jam}</span></div>`
                : `<div class="flex flex-col items-start max-w-[80%]"><div class="bg-gray-100 text-gray-700 px-6 py-4 rounded-3xl rounded-tl-sm text-sm">${escapeHtml(p.isi)}</div><span class="text-[10px] text-gray-400 mt-1">${escapeHtml(p.users?.nama_lengkap || 'Konselor')} • ${jam}</span></div>`;
        }).join('');
        chatArea.scrollTop = chatArea.scrollHeight;
    }

    async function kirimPesan() {
        const isi = inputChat.value.trim(); if (!isi) return; inputChat.value = '';
        await supabaseClient.from('pesan').insert([{ sesi_id: sesiId, pengirim_id: profile.id, isi }]); loadPesan();
    }

    btnKirim.addEventListener('click', kirimPesan);
    if (inputChat) inputChat.addEventListener('keypress', (e) => { if (e.key === 'Enter') kirimPesan(); });

    await loadPesan();
    supabaseClient.channel(`pesan-${sesiId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pesan', filter: `sesi_id=eq.${sesiId}` }, loadPesan).subscribe();

    const btnAkhiri = document.getElementById('btn-akhiri-sesi');
    if (btnAkhiri) {
        btnAkhiri.addEventListener('click', async () => {
            await supabaseClient.from('sesi').update({ status: 'Selesai' }).eq('id', sesiId);
            window.location.href = `ringkasan-sesi.html?sesi_id=${sesiId}`;
        });
    }
}

// ----------------------------------------------------------------------
// 10. HALAMAN RINGKASAN SESI (ringkasan-sesi.html)
// ----------------------------------------------------------------------
async function initRingkasanSesiPage() {
    const sesiId = new URLSearchParams(window.location.search).get('sesi_id') || localStorage.getItem('active_session_id'); if (!sesiId) return;
    const { data: sesi } = await supabaseClient.from('sesi').select('*, konselor(users(nama_lengkap, avatar_seed))').eq('id', sesiId).single(); if (!sesi) return;

    setText('[data-sesi="kode"]', sesi.kode_sesi); setText('[data-sesi="tanggal"]', formatTanggalIndo(sesi.tanggal));
    setText('[data-sesi="konselor-nama"]', sesi.konselor?.users?.nama_lengkap || '-');
    setText('[data-sesi="catatan-konselor"]', sesi.catatan_konselor || 'Konselor belum menambahkan catatan.');

    const avatarKonselor = qs('[data-sesi="konselor-avatar"]');
    if (avatarKonselor) avatarKonselor.src = avatarUrl(sesi.konselor?.users?.avatar_seed);
    const linkPenilaian = qs('[data-action="ke-penilaian"]'); if (linkPenilaian) linkPenilaian.href = `penilaian.html?sesi_id=${sesiId}`;
}

// ----------------------------------------------------------------------
// 11. HALAMAN PENILAIAN (penilaian.html)
// ----------------------------------------------------------------------
function initPenilaianPage() {
    const form = document.getElementById('evaluationForm'); if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const profile = await auth.requireLogin(); if (!profile) return;
        if (profile.role !== 'mahasiswa') { window.location.href = 'index.html'; return; }

        const sesiId = new URLSearchParams(window.location.search).get('sesi_id') || localStorage.getItem('active_session_id');
        if (!sesiId) { alert('Sesi tidak valid.'); return; }

        const formData = new FormData(form); const btnSubmit = document.getElementById('btn-submit');
        const num = (name) => parseInt(formData.get(name), 10);

        btnSubmit.disabled = true; btnSubmit.innerHTML = 'Menyimpan...';
        const { data: sesi } = await supabaseClient.from('sesi').select('konselor_id').eq('id', sesiId).single();
        if (!sesi) { alert('Sesi tidak ditemukan.'); btnSubmit.disabled = false; return; }

        const qA1 = num('qA1') || 5; const qA2 = num('qA2') || 5; const qB1 = num('qB1') || 5;
        const qW1 = num('qW1') || 5; const qW2 = num('qW2') || 5;
        const isRekomendasi = formData.get('rekomendasi') === 'ya';

        // 1. Eksekusi penyimpanan ke tabel Penilaian
        const payloadPenilaian = {
            sesi_id: sesiId,
            skor_total: Number(((qA1 + qA2 + qB1 + qW1 + qW2) / 5).toFixed(2)),
            rekomendasi: isRekomendasi ? 1 : 0,
            komentar: formData.get('saran') || null,
        };

        const { error: errPenilaian } = await supabaseClient.from('penilaian').insert([payloadPenilaian]);
        if (errPenilaian) { alert('Gagal mengirim penilaian: ' + errPenilaian.message); btnSubmit.disabled = false; return; }

        // 2. Eksekusi sinkronisasi ke tabel Evaluasi UX
        const payloadKuesioner = {
            jurusan: profile.program_studi || 'Umum',
            q_mendengarkan: qA1, q_memahami: qA2, q_solusi: qB1, q_komunikasi: qW1, q_nyaman: qW2,
            q_penjelasan: qB1, q_profesional: qB1, q_rahasia: qB1, q_navigasi: qB1, q_visual: qB1, q_informasi: qB1, q_respon: qB1,
            rekomendasi: isRekomendasi
        };
        await supabaseClient.from('kuesioner_evaluasi').insert([payloadKuesioner]);

        localStorage.removeItem('active_session_id'); alert('Penilaian Anda berhasil tersimpan.'); window.location.href = 'index.html';
    });
}

// ----------------------------------------------------------------------
// 12. HALAMAN RIWAYAT (riwayat.html)
// ----------------------------------------------------------------------
async function initRiwayatPage() {
    const profile = await auth.requireLogin(); if (!profile) return;
    if (profile.role !== 'mahasiswa') { window.location.href = 'index.html'; return; }

    const container = qs('[data-section="sesi-list"]'); if (!container) return;

    const { data: daftarSesi } = await supabaseClient
        .from('sesi')
        .select('*, konselor(jurusan, users(nama_lengkap, avatar_seed))')
        .eq('mahasiswa_id', profile.id).order('tanggal', { ascending: false });

    if (daftarSesi && daftarSesi.length > 0) {
        container.innerHTML = daftarSesi.map(s => {
            const isSelesai = s.status === 'Selesai';
            return `
            <div class="bg-white p-8 rounded-[35px] border border-gray-100 shadow-sm flex flex-col justify-between">
                <div class="flex justify-between items-start mb-8">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-gray-50 rounded-xl overflow-hidden"><img src="${avatarUrl(s.konselor?.users?.avatar_seed)}" class="w-full h-full object-cover"></div>
                        <div><h3 class="font-bold text-gray-900">${escapeHtml(s.konselor?.users?.nama_lengkap)}</h3><p class="text-[11px] text-gray-400">${escapeHtml(s.konselor?.jurusan)}</p></div>
                    </div>
                    <span class="px-3 py-1.5 rounded-full text-[9px] font-bold uppercase ${isSelesai ? 'bg-[#E0F2FE] text-[#0369A1]' : 'bg-[#DBF69D] text-[#166534]'}">${escapeHtml(s.status)}</span>
                </div>
                <div class="mb-8"><p class="text-[10px] text-gray-400 font-bold uppercase mb-1">Jadwal Sesi</p><h2 class="text-2xl font-bold text-gray-600">${formatTanggalIndo(s.tanggal)}, ${s.waktu_mulai}</h2></div>
                <a href="${isSelesai ? 'ringkasan-sesi.html' : 'live-chat.html'}?sesi_id=${s.id}" class="w-full bg-${isSelesai ? 'btn-blue-light' : '[#4D7C0F]'} hover:bg-${isSelesai ? '[#38BDF8]' : 'green-800'} text-${isSelesai ? '[#0369A1]' : 'white'} font-semibold py-3.5 rounded-2xl text-center block transition">${isSelesai ? '📄 Lihat Ringkasan' : '💬 Hubungi Konselor'}</a>
            </div>`;
        }).join('');
        
        const targetBulan = String(new Date().getMonth() + 1).padStart(2, '0');
        const sesiBulanIni = daftarSesi.filter(s => s.tanggal.slice(5, 7) === targetBulan && s.status === 'Selesai');
        setText('[data-stat="total-sesi-bulan"]', String(sesiBulanIni.length).padStart(2, '0'));
        setText('[data-stat="total-menit-bulan"]', sesiBulanIni.length * 60);
    } else { container.innerHTML = '<div class="col-span-3 text-center py-10 text-gray-400">Belum ada riwayat sesi.</div>'; }
}

// ----------------------------------------------------------------------
// 13. HALAMAN DASHBOARD ANALISIS (dashboard.html)
// ----------------------------------------------------------------------
window.initDashboardPage = async () => {
    const label = document.getElementById('dataSourceLabel'); if (!label) return;
    label.textContent = 'Menghubungkan ke pangkalan data...';

    let rawData = [];
    const fetchDashboardData = async () => {
        const { data, error } = await supabaseClient.from('kuesioner_evaluasi').select('*');
        if (error) { label.textContent = '⚠ Galat: ' + error.message; return; }
        rawData = data || []; label.textContent = '🟢 Terhubung ke Supabase Realtime (kuesioner_evaluasi)';
        updateDashboard(rawData);
    };

    await fetchDashboardData();
    document.querySelectorAll('.filter-select, input[type="date"]').forEach(el => { el.addEventListener('change', () => updateDashboard(rawData)); });
    supabaseClient.channel('dashboard-metrics').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kuesioner_evaluasi' }, fetchDashboardData).subscribe();
};

function updateDashboard(data) {
    const filterJurusan = document.getElementById('filterJurusan')?.value || 'Semua Jurusan';
    const start = new Date(document.getElementById('filterTanggalStart')?.value || '2026-01-01');
    const end = new Date(document.getElementById('filterTanggalEnd')?.value || '2026-12-31'); end.setHours(23, 59, 59);

    const filtered = data.filter(row => {
        const rowDate = new Date(row.created_at); const matchJurusan = filterJurusan === 'Semua Jurusan' || row.jurusan === filterJurusan;
        return matchJurusan && rowDate >= start && rowDate <= end;
    });

    const total = filtered.length; setText('#statTotal', total); setText('#statTotal2', total);
    if(total > 0) {
        let sum = 0; filtered.forEach(row => { sum += (row.q_mendengarkan + row.q_memahami + row.q_penjelasan + row.q_solusi + row.q_komunikasi + row.q_profesional + row.q_nyaman + row.q_rahasia) / 8; });
        setText('#statMean', (sum / total).toFixed(2)); setText('#rekPct', Math.round((filtered.filter(r => r.rekomendasi).length / total) * 100) + '%');
    } else { setText('#statMean', '0.00'); setText('#rekPct', '0%'); }
}

// ----------------------------------------------------------------------
// 14. LOGIKA ROUTER KONSELOR 
// ----------------------------------------------------------------------
async function verifyCounselorGuard() {
    const profile = await auth.requireLogin(); if (!profile) return null;
    if (profile.role !== 'konselor') { window.location.href = 'index.html'; return null; }
    return profile;
}

// ----------------------------------------------------------------------
// FASE A: HALAMAN ANTREAN KONSELOR (counselor-queue.html)
// ----------------------------------------------------------------------
async function initCounselorQueuePage() {
    // Role Guard: Hanya konselor yang diizinkan masuk
    const profile = await verifyCounselorGuard(); 
    if (!profile) return;

    // Menarik ID Relasional Konselor dengan aman (Menangani objek vs array dari Supabase)
    const konselorId = Array.isArray(profile.konselor) ? profile.konselor[0]?.id : profile.konselor?.id;
    if (!konselorId) {
        console.error('[Queue] Profil konselor tidak ditemukan pada identitas ini.');
        return;
    }

    const queueContainer = document.getElementById('queueContainer');
    const searchInput = document.getElementById('searchInput');
    const statAntrean = document.getElementById('statTotalAntrean');
    const statWaktu = document.getElementById('statRerataTunggu');
    const statSelesai = document.getElementById('statSesiSelesai');

    let rawQueueData = [];

    // Fungsi Utama Penarikan Data (Data Fetcher)
    async function loadQueue() {
        const { data, error } = await supabaseClient
            .from('sesi')
            .select('id, status, topik, tanggal, waktu_mulai, created_at, mahasiswa:mahasiswa_id(nama_lengkap, avatar_seed)')
            .eq('konselor_id', konselorId);

        if (error) {
            console.error('[Queue] Gagal memuat antrean:', error);
            if (queueContainer) queueContainer.innerHTML = '<div class="col-span-full text-center py-10 text-red-500">Gagal memuat data antrean dari peladen.</div>';
            return;
        }

        // Pemisahan berdasarkan status
        const selesaiData = data.filter(s => s.status === 'Selesai');
        rawQueueData = data.filter(s => s.status === 'Menunggu')
                           .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)); // FIFO (First In First Out)

        // Kalkulasi Statistik Real-time
        const totalAntrean = rawQueueData.length;
        let rerataTunggu = 0;
        if (totalAntrean > 0) {
            const now = new Date();
            const totalMins = rawQueueData.reduce((acc, s) => acc + Math.floor((now - new Date(s.created_at)) / 60000), 0);
            rerataTunggu = Math.floor(totalMins / totalAntrean);
        }

        // Injeksi ke DOM
        if (statAntrean) statAntrean.textContent = totalAntrean;
        if (statWaktu) statWaktu.textContent = `${rerataTunggu} Menit`;
        if (statSelesai) statSelesai.textContent = selesaiData.length;

        renderQueue();
    }

    // Fungsi Pembuatan Visual Antarmuka (Renderer)
    function renderQueue() {
        if (!queueContainer) return;
        const term = searchInput ? searchInput.value.trim().toLowerCase() : '';
        
        // Logika Filter
        const filtered = rawQueueData.filter(s => {
            const nama = (s.mahasiswa?.nama_lengkap || '').toLowerCase();
            const topik = (s.topik || '').toLowerCase();
            return nama.includes(term) || topik.includes(term);
        });

        // Tampilan Kosong (Empty State)
        if (filtered.length === 0) {
            queueContainer.innerHTML = '<div class="col-span-full flex flex-col items-center justify-center py-16 text-gray-400"><div class="text-4xl mb-3">☕</div><p class="text-sm">Tidak ada mahasiswa dalam antrean saat ini. Waktunya bernapas.</p></div>';
            return;
        }

        const now = new Date();
        queueContainer.innerHTML = filtered.map(s => {
            const diffMin = Math.floor((now - new Date(s.created_at)) / 60000);
            const isUrgent = diffMin > 10;
            const urgentBadge = isUrgent 
                ? `<span class="bg-red-50 text-red-500 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-red-100 flex items-center gap-1.5"><span class="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span> Urgent</span>` 
                : '';

            return `
            <div class="student-card bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between hover:shadow-md transition">
                <div class="flex justify-between items-start mb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-blue-50 rounded-full overflow-hidden border border-blue-100 flex-shrink-0">
                            <img src="${avatarUrl(s.mahasiswa?.avatar_seed || s.mahasiswa?.nama_lengkap)}" class="w-full h-full object-cover">
                        </div>
                        <div>
                            <h3 class="font-bold text-gray-900 text-sm line-clamp-1">${escapeHtml(s.mahasiswa?.nama_lengkap || 'Mahasiswa')}</h3>
                            <p class="text-[10px] text-gray-400 mt-0.5">${waktuRelatif(s.created_at)}</p>
                        </div>
                    </div>
                    ${urgentBadge}
                </div>
                <div class="mb-6">
                    <div class="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-1">Topik Sesi</p>
                        <p class="text-xs font-semibold text-gray-700">${escapeHtml(s.topik || 'Umum')}</p>
                    </div>
                </div>
                <div class="flex items-center justify-between mt-auto pt-2">
                    <div class="text-[11px] font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-md">
                        ${formatTanggalIndo(s.tanggal)} • ${s.waktu_mulai}
                    </div>
                    <a href="counselor-chat.html?sesi_id=${s.id}" class="w-10 h-10 bg-brand-blue hover:bg-brand-dark text-white rounded-full flex items-center justify-center transition shadow-sm" title="Mulai Obrolan">
                        💬
                    </a>
                </div>
            </div>`;
        }).join('');
    }

    // Event Listener Filter (Menggunakan fungsi debounce bawaan)
    if (searchInput) searchInput.addEventListener('input', debounce(renderQueue, 300));

    // Pemuatan Perdana
    await loadQueue();

    // Sirkuit Real-time: Memantau tabel sesi khusus untuk konselor ini
    supabaseClient.channel('counselor-queue-channel')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sesi', filter: `konselor_id=eq.${konselorId}` }, () => {
            console.log('[Queue] Perubahan status sesi terdeteksi. Merender ulang...');
            loadQueue();
        })
        .subscribe();
}

// ----------------------------------------------------------------------
// FASE B: HALAMAN LIVE CHAT KONSELOR (counselor-chat.html)
// ----------------------------------------------------------------------
async function initCounselorChatPage() {
    const profile = await verifyCounselorGuard();
    if (!profile) return;

    const konselorId = Array.isArray(profile.konselor) ? profile.konselor[0]?.id : profile.konselor?.id;
    if (!konselorId) return;

    // DOM Elements
    const contactList = document.getElementById('contactList');
    const chatArea = document.getElementById('chatArea');
    const headerName = document.getElementById('headerName');
    const headerAvatar = document.getElementById('headerAvatar');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatEmptyState = document.getElementById('chatEmptyState');
    const chatInterface = document.getElementById('chatInterface');

    let currentChatId = null;
    let activePesanChannel = null;
    let sessionList = [];

    // B.1 Menarik Daftar Kontak Sesi (Hanya Menunggu & Berlangsung)
    async function loadContacts(autoSelectId = null) {
        const { data, error } = await supabaseClient
            .from('sesi')
            .select('id, status, topik, mahasiswa:mahasiswa_id(nama_lengkap, avatar_seed)')
            .eq('konselor_id', konselorId)
            .in('status', ['Menunggu', 'Berlangsung'])
            .order('created_at', { ascending: true });

        if (error) { console.error('Error load contacts:', error); return; }
        sessionList = data || [];

        if (sessionList.length === 0) {
            if (contactList) contactList.innerHTML = '<div class="text-center py-10 text-gray-400 text-xs">Belum ada obrolan aktif.</div>';
            return;
        }

        if (contactList) {
            contactList.innerHTML = sessionList.map(s => {
                const isAktif = s.id === currentChatId;
                const badgeStatus = s.status === 'Menunggu' 
                    ? '<span class="w-2 h-2 bg-yellow-400 rounded-full animate-pulse absolute top-0 right-0"></span>' 
                    : '<span class="w-2 h-2 bg-brand-green rounded-full absolute top-0 right-0"></span>';

                return `
                <div class="contact-item p-4 border-b border-gray-50 cursor-pointer transition flex gap-3 ${isAktif ? 'bg-blue-50/50 border-l-4 border-l-brand-blue' : 'hover:bg-gray-50 border-l-4 border-l-transparent'}" data-id="${s.id}">
                    <div class="relative w-10 h-10 rounded-full bg-blue-100 flex-shrink-0 border border-blue-50">
                        <img src="${avatarUrl(s.mahasiswa?.avatar_seed || s.mahasiswa?.nama_lengkap)}" class="w-full h-full object-cover rounded-full">
                        ${badgeStatus}
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-center mb-1">
                            <h4 class="font-bold text-gray-900 text-sm truncate">${escapeHtml(s.mahasiswa?.nama_lengkap)}</h4>
                            <span class="text-[9px] text-gray-400 uppercase">${s.status}</span>
                        </div>
                        <p class="text-xs text-gray-500 truncate">${escapeHtml(s.topik || 'Sesi Konseling')}</p>
                    </div>
                </div>`;
            }).join('');

            // Pasang event listener ke setiap kontak
            const items = contactList.querySelectorAll('.contact-item');
            items.forEach(item => {
                item.addEventListener('click', () => selectContact(item.getAttribute('data-id')));
            });
        }

        // TUGAS B: Jika ada URL Parameter atau autoSelect, langsung buka obrolan
        const params = new URLSearchParams(window.location.search);
        const targetId = autoSelectId || params.get('sesi_id');
        if (targetId && sessionList.some(s => s.id === targetId)) {
            selectContact(targetId);
        }
    }

    // Fungsi Saat Kontak Diklik
    async function selectContact(sesiId) {
        if (currentChatId === sesiId) return; // Cegah re-render jika klik kontak yang sama
        currentChatId = sesiId;
        
        // 1. Ubah UI Empty State menjadi Interface Chat
        if (chatEmptyState) chatEmptyState.classList.add('hidden');
        if (chatInterface) chatInterface.classList.remove('hidden');

        // 2. Perbarui Tampilan Aktif di Sidebar
        loadContacts(); // Re-render sidebar agar class 'active' pindah
        
        // 3. Update Header Chat
        const targetSession = sessionList.find(s => s.id === sesiId);
        if (targetSession) {
            if (headerName) headerName.textContent = targetSession.mahasiswa?.nama_lengkap;
            if (headerAvatar) headerAvatar.src = avatarUrl(targetSession.mahasiswa?.avatar_seed || targetSession.mahasiswa?.nama_lengkap);
            
            // B.4 Tandai sesi sebagai Berlangsung jika sebelumnya Menunggu
            if (targetSession.status === 'Menunggu') {
                await supabaseClient.from('sesi').update({ status: 'Berlangsung' }).eq('id', sesiId);
                // Trigger realtime tabel sesi akan otomatis me-refresh loadContacts() nantinya
            }
        }

        // 4. Load Pesan dan Pindah Channel
        loadMessages(sesiId);
    }

    // B.2 Penarikan dan Render Pesan
    async function loadMessages(sesiId) {
        if (!chatArea) return;
        const { data: pesan, error } = await supabaseClient
            .from('pesan')
            .select('*, users:pengirim_id(nama_lengkap)')
            .eq('sesi_id', sesiId)
            .order('created_at', { ascending: true });

        if (error) { console.error('Error load messages:', error); return; }

        chatArea.innerHTML = (pesan || []).map(p => {
            const milikSaya = p.pengirim_id === profile.id;
            const jam = new Date(p.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
            
            if (milikSaya) {
                return `
                <div class="flex flex-col items-end self-end max-w-[85%] fade-in-up">
                    <div class="bg-brand-blue text-white px-5 py-3.5 rounded-2xl rounded-tr-sm text-sm shadow-sm leading-relaxed">${escapeHtml(p.isi)}</div>
                    <span class="text-[10px] text-gray-400 mt-1 mr-1">Anda • ${jam}</span>
                </div>`;
            } else {
                return `
                <div class="flex flex-col items-start self-start max-w-[85%] fade-in-up">
                    <div class="bg-white border border-gray-100 text-gray-700 px-5 py-3.5 rounded-2xl rounded-tl-sm text-sm shadow-sm leading-relaxed">${escapeHtml(p.isi)}</div>
                    <span class="text-[10px] text-gray-400 mt-1 ml-1">${escapeHtml(p.users?.nama_lengkap || 'Mahasiswa')} • ${jam}</span>
                </div>`;
            }
        }).join('');
        
        chatArea.scrollTop = chatArea.scrollHeight;

        // B.5 Manajemen Memori Saluran Real-time (Mencegah penumpukan socket)
        if (activePesanChannel) {
            supabaseClient.removeChannel(activePesanChannel);
        }

        activePesanChannel = supabaseClient.channel(`pesan-konselor-${sesiId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pesan', filter: `sesi_id=eq.${sesiId}` }, () => {
                // Tarik ulang pesan agar UI terbarui saat ada insert baru
                loadMessages(sesiId);
            }).subscribe();
    }

    // B.3 Fungsi Kirim Pesan
    async function kirimPesan() {
        if (!currentChatId || !messageInput) return;
        const isi = messageInput.value.trim();
        if (!isi) return;

        messageInput.value = ''; // Kosongkan input instan
        
        const { error } = await supabaseClient.from('pesan').insert([{ 
            sesi_id: currentChatId, 
            pengirim_id: profile.id, 
            isi 
        }]);
        
        if (error) {
            console.error('Gagal kirim:', error);
            alert('Gagal mengirim pesan.');
        }
        // Tidak perlu panggil loadMessages() karena Real-time Channel (activePesanChannel) akan bereaksi
    }

    if (sendBtn) sendBtn.addEventListener('click', kirimPesan);
    if (messageInput) messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') kirimPesan(); });

    // Eksekusi Pemuatan Awal
    await loadContacts();

    // B.5 Saluran Real-time untuk Tabel Sesi (Memperbarui sidebar jika ada antrean baru/berubah status)
    supabaseClient.channel('counselor-sesi-sidebar')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sesi', filter: `konselor_id=eq.${konselorId}` }, () => {
            console.log('[Chat] Perubahan status antrean terdeteksi. Menyinkronkan sidebar...');
            loadContacts(currentChatId); // Tetap pertahankan ID obrolan yang sedang aktif
        })
        .subscribe();
}

// ----------------------------------------------------------------------
// FASE C: HALAMAN RIWAYAT & ULASAN KONSELOR (counselor-history.html)
// ----------------------------------------------------------------------
async function initCounselorHistoryPage() {
    // 1. Role Guard
    const profile = await verifyCounselorGuard();
    if (!profile) return;

    const konselorId = Array.isArray(profile.konselor) ? profile.konselor[0]?.id : profile.konselor?.id;
    if (!konselorId) return;

    // 2. DOM Elements
    const reviewsContainer = document.getElementById('reviewsContainer');
    const filterInput = document.getElementById('filterInput');

    let rawReviewsData = [];

    // 3. Fungsi Penarikan Data (Query Lintas Tabel)
    async function loadReviews() {
        if (!reviewsContainer) return;
        
        // Query kompleks: Ambil Penilaian -> Inner Join ke Sesi (filter by konselor_id) -> Join ke Mahasiswa (Program Studi)
        const { data, error } = await supabaseClient
            .from('penilaian')
            .select(`
                id,
                skor_total,
                komentar,
                created_at,
                sesi!inner(
                    topik,
                    konselor_id,
                    users:mahasiswa_id(program_studi)
                )
            `)
            .eq('sesi.konselor_id', konselorId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[History] Gagal memuat ulasan:', error);
            reviewsContainer.innerHTML = '<div class="text-center py-10 text-red-500">Gagal memuat riwayat ulasan.</div>';
            return;
        }

        rawReviewsData = data || [];
        renderReviews();
    }

    // 4. Fungsi Renderer dengan Logika Filter
    function renderReviews() {
        if (!reviewsContainer) return;

        const term = filterInput ? filterInput.value.trim().toLowerCase() : '';
        
        // Logika Filter JS: Mencari berdasarkan isi komentar atau nama Program Studi
        const filtered = rawReviewsData.filter(r => {
            const komentar = (r.komentar || '').toLowerCase();
            const prodi = (r.sesi?.users?.program_studi || '').toLowerCase();
            return komentar.includes(term) || prodi.includes(term);
        });

        // Empty State
        if (filtered.length === 0) {
            reviewsContainer.innerHTML = `
                <div class="flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-[30px] border border-gray-100 border-dashed">
                    <span class="text-4xl mb-3">📄</span>
                    <p class="text-sm">Tidak ada ulasan atau riwayat yang sesuai.</p>
                </div>`;
            return;
        }

        reviewsContainer.innerHTML = filtered.map(r => {
            const rating = Math.round(r.skor_total || 5);
            const prodi = r.sesi?.users?.program_studi || 'Polimedia';
            const topik = r.sesi?.topik || 'Umum';
            
            // Logika fallback jika komentar kosong
            const komentarHTML = r.komentar 
                ? `<p class="text-sm text-gray-600 leading-relaxed">"${escapeHtml(r.komentar)}"</p>`
                : `<span class="inline-block bg-gray-50 text-gray-400 text-xs px-3 py-1.5 rounded-lg border border-gray-100 font-medium">Tanpa komentar</span>`;

            return `
            <div class="bg-white p-6 rounded-[24px] border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between fade-in-up">
                <div>
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <div class="text-[#F59E0B] text-xs tracking-widest mb-1">${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}</div>
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 px-2 py-0.5 rounded">Topik: ${escapeHtml(topik)}</span>
                        </div>
                        <span class="text-[10px] text-gray-400 font-medium">${waktuRelatif(r.created_at)}</span>
                    </div>
                    <div class="mb-6 min-h-[40px]">
                        ${komentarHTML}
                    </div>
                </div>
                <div class="flex items-center gap-3 pt-4 border-t border-gray-50">
                    <div class="w-8 h-8 rounded-full bg-blue-50 border border-blue-100 overflow-hidden flex-shrink-0">
                        <img src="${avatarUrl(prodi)}" class="w-full h-full object-cover">
                    </div>
                    <h4 class="text-[11px] font-bold text-gray-700">Mahasiswa ${escapeHtml(prodi)}</h4>
                </div>
            </div>`;
        }).join('');
    }

    // 5. Integrasi Debounce Filter
    if (filterInput) filterInput.addEventListener('input', debounce(renderReviews, 300));

    // Eksekusi Pemuatan Perdana
    await loadReviews();

    // 6. Sirkuit Real-time (Memantau tabel penilaian)
    // Catatan Arsitektur: Karena tabel 'penilaian' tidak memiliki kolom 'konselor_id' secara langsung, 
    // kita memantau semua INSERT, namun fungsi loadReviews() akan memfilternya dengan aman di tingkat query.
    supabaseClient.channel('counselor-history-channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'penilaian' }, () => {
            console.log('[History] Ulasan baru terdeteksi. Memperbarui layar...');
            loadReviews(); // Tarik ulang ulasan
        })
        .subscribe();
}

// ======================================================================
// FUNGSI REUSABLE GLOBAL: TREN PENILAIAN BULANAN (Dipakai Beranda & Dasbor)
// ======================================================================
async function getTrenPenilaian(konselorId) {
    const { data: listPenilaian } = await supabaseClient
        .from('penilaian')
        .select('skor_total, created_at, sesi!inner(konselor_id)')
        .eq('sesi.konselor_id', konselorId);

    const bulanan = {};
    const labelBulan = [];
    const dataPoin = [];
    const skrg = new Date();

    // Bangun struktur 5 bulan ke belakang secara dinamis
    for (let i = 4; i >= 0; i--) {
        const d = new Date(skrg.getFullYear(), skrg.getMonth() - i, 1);
        const kuncian = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        bulanan[kuncian] = [];
        labelBulan.push(d.toLocaleDateString('id-ID', { month: 'short' }));
    }

    // Kelompokkan skor berdasarkan bulan created_at
    if (listPenilaian) {
        listPenilaian.forEach(p => {
            const m = p.created_at.slice(0, 7);
            if (bulanan[m]) bulanan[m].push(p.skor_total);
        });
    }

    // Hitung rata-rata tiap bulan (kembalikan null jika bulan kosong)
    Object.keys(bulanan).forEach(kunci => {
        const arr = bulanan[kunci];
        dataPoin.push(arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null);
    });

    return { labels: labelBulan, data: dataPoin };
}

// ----------------------------------------------------------------------
// FASE D: HALAMAN DASHBOARD UTAMA KONSELOR (counselor-dashboard.html)
// ----------------------------------------------------------------------
async function initCounselorDashboardPage() {
    // 1. Guard Keamanan Akses (Pemanggilan API hanya terjadi SEKALI di sini)
    const profile = await verifyCounselorGuard();
    if (!profile) return;

    const konselorObj = Array.isArray(profile.konselor) ? profile.konselor[0] : profile.konselor;
    const konselorId = konselorObj?.id;
    if (!konselorId) return;

    // --- FIX BUG: Injeksi Data Header Langsung dari Objek Profil ---
    const headerNama = document.getElementById('headerNamaKonselor');
    const headerInfo = document.getElementById('headerInfoKonselor');
    if (headerNama) headerNama.textContent = profile.nama_lengkap;
    if (headerInfo) headerInfo.textContent = `${profile.nim || '-'} • ${konselorObj.jurusan || '-'}`;
    // ---------------------------------------------------------------

    // DOM Elements (Lanjutan kode asli Anda...)
    const toggle = document.getElementById('toggleKetersediaan');
    const statusText = document.getElementById('statusText');
    const labelStatus = document.getElementById('labelStatus');
    const kepuasanChartCtx = document.getElementById('kepuasanChart');

    let kepuasanChartInst = null;

    // UI Status Updater
    function updateStatusUI(status) {
        const tersedia = status === 'Tersedia';
        if (toggle) toggle.checked = tersedia;
        if (statusText) statusText.textContent = status;
        
        if (labelStatus) {
            labelStatus.className = `px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                tersedia ? 'bg-green-50 text-brand-green border border-green-100' : 'bg-red-50 text-red-500 border border-red-100'
            }`;
        }
    }

    // D.2 Menampilkan Statistik Ringkasan Statis & Posisi Toggle Kontrol
    async function loadDashboardStats() {
        const { data: k, error } = await supabaseClient
            .from('konselor')
            .select('status, total_sesi, rating_rata')
            .eq('id', konselorId)
            .single();

        if (error || !k) return;

        // Set Angka Metrik ke DOM
        setText('#statTotalSesi', k.total_sesi || 0);
        setText('#statRatingRata', fmtRating(k.rating_rata));
        
        // Sinkronisasi Posisi Sakelar Toggle
        updateStatusUI(k.status);
    }

    // D.3 Rendering Grafik Kepuasan Menggunakan Fungsi Reusable
    async function renderDashboardChart() {
        if (!kepuasanChartCtx || typeof Chart === 'undefined') return;

        const tren = await getTrenPenilaian(konselorId);

        if (kepuasanChartInst) {
            kepuasanChartInst.destroy(); // Hancurkan instansi lama untuk mencegah tumpang tindih memori
        }

        kepuasanChartInst = new Chart(kepuasanChartCtx.getContext('2d'), {
            type: 'bar',
            data: {
                labels: tren.labels,
                datasets: [{
                    label: 'Rerata Kepuasan',
                    data: tren.data,
                    backgroundColor: '#00668F',
                    borderRadius: 6,
                    barThickness: 28
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { min: 0, max: 5, ticks: { stepSize: 1, color: '#94A3B8' }, grid: { color: '#F1F5F9' } },
                    x: { grid: { display: false }, ticks: { color: '#94A3B8' } }
                }
            }
        });
    }

    // D.1 Event Listener Sakelar Mengubah Status Real-time
    if (toggle) {
        toggle.addEventListener('change', async () => {
            const statusBaru = toggle.checked ? 'Tersedia' : 'Sibuk';
            
            // Efek Optimistik: Ubah UI lokal terlebih dahulu demi responsivitas kilat
            updateStatusUI(statusBaru);

            const { error } = await supabaseClient
                .from('konselor')
                .update({ status: statusBaru })
                .eq('id', konselorId);

            if (error) {
                console.error('Gagal memperbarui ketersediaan:', error);
                alert('Gagal menyinkronkan status ke server.');
                loadDashboardStats(); // Batalkan perubahan lokal, tarik ulang dari server
            }
        });
    }

    // Eksekusi Pemuatan Pertama
    await Promise.all([loadDashboardStats(), renderDashboardChart()]);

    // D.4 Pemasangan Saluran Real-time Saluran Ganda
    supabaseClient.channel(`dashboard-counselor-${konselorId}`)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'konselor', filter: `id=eq.${konselorId}` }, (payload) => {
            console.log('[Dashboard] Statistik profil konselor diperbarui oleh trigger database.');
            setText('#statTotalSesi', payload.new.total_sesi || 0);
            setText('#statRatingRata', fmtRating(payload.new.rating_rata));
        })
        .subscribe();

    supabaseClient.channel(`dashboard-reviews-${konselorId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'penilaian' }, () => {
            console.log('[Dashboard] Ada penilaian masuk. Memperbarui grafik tren kepuasan...');
            renderDashboardChart();
        })
        .subscribe();
}

// ----------------------------------------------------------------------
// ROUTER PUSAT: EKSEKUSI BERDASARKAN URL
// ----------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
    await initNavbar();
    const path = window.location.pathname.split('/').pop() || 'index.html';

    if (path === 'index.html' || path === '') await initIndexPage();
    else if (path === 'login.html') initLoginPage();
    else if (path === 'pilih-konselor.html') await initPilihKonselorPage();
    else if (path === 'profil-konselor.html') await initProfilKonselorPage();
    else if (path === 'penjadwalan.html') await initPenjadwalanPage();
    else if (path === 'live-chat.html') await initLiveChatPage();
    else if (path === 'ringkasan-sesi.html') await initRingkasanSesiPage();
    else if (path === 'penilaian.html') initPenilaianPage();
    else if (path === 'riwayat.html') await initRiwayatPage();
    else if (path === 'dashboard.html') await window.initDashboardPage();
    else if (path === 'counselor-queue.html') await initCounselorQueuePage();
    else if (path === 'counselor-chat.html') await initCounselorChatPage();
    else if (path === 'counselor-history.html') await initCounselorHistoryPage();
    else if (path === 'counselor-dashboard.html') await initCounselorDashboardPage();
});