// ============================================================
// KONFIGURASI SUPABASE - EDIT BAGIAN INI!
// ============================================================
// 
// CARA MENDAPATKAN CREDENTIALS:
// 1. Buka https://supabase.com dan login
// 2. Pilih/buat project
// 3. Klik Settings (⚙️) > API
// 4. Copy "Project URL" dan "anon public key"
// 5. Paste di bawah ini (ganti YOUR_SUPABASE_URL dan YOUR_SUPABASE_ANON_KEY)
//
// CONTOH:
// url: 'https://abcdefghijklmnop.supabase.co',
// anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYzODI4MjM0MCwiZXhwIjoxOTUzODU4MzQwfQ.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
//
// ============================================================

const SUPABASE_CONFIG = {
    url: 'YOUR_SUPABASE_URL',        // 👈 GANTI INI! Format: https://xxxxx.supabase.co
    anonKey: 'YOUR_SUPABASE_ANON_KEY' // 👈 GANTI INI! Key yang panjang dari Supabase
};

// Inisialisasi Supabase Client
let supabaseClient = null;

function initSupabase() {
    try {
        if (typeof supabase === 'undefined') {
            throw new Error('Supabase library belum dimuat. Pastikan CDN Supabase sudah ditambahkan di HTML.');
        }
        
        supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
        console.log('✅ Supabase berhasil diinisialisasi');
        return true;
    } catch (error) {
        console.error('❌ Error inisialisasi Supabase:', error);
        alert('Gagal menghubungkan ke database. Periksa konfigurasi Supabase Anda.');
        return false;
    }
}

// Helper function untuk mendapatkan user ID yang sedang login
function getCurrentUserId() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    return user ? user.id : null;
}

// Helper function untuk format error message
function formatSupabaseError(error) {
    if (error.message) {
        return error.message;
    }
    return 'Terjadi kesalahan pada database';
}
