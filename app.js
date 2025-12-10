// ===== INDEXEDDB INITIALIZATION =====
let db;
const DB_NAME = 'AkuntansiDB';
const DB_VERSION = 1;

// Initialize IndexedDB
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            db = event.target.result;
            
            // Store untuk Users
            if (!db.objectStoreNames.contains('users')) {
                const userStore = db.createObjectStore('users', { keyPath: 'id', autoIncrement: true });
                userStore.createIndex('username', 'username', { unique: true });
                userStore.createIndex('email', 'email', { unique: true });
            }
            
            // Store untuk Data per User
            if (!db.objectStoreNames.contains('userData')) {
                const dataStore = db.createObjectStore('userData', { keyPath: 'id', autoIncrement: true });
                dataStore.createIndex('userId', 'userId', { unique: false });
                dataStore.createIndex('type', 'type', { unique: false });
            }
        };
    });
}

// ===== DATABASE & STATE MANAGEMENT =====
let dataAkun = [];
let dataTransaksi = [];
let dataInvoice = [];
let dataPembelian = [];
let dataAset = [];
let currentTab = 'dashboard';
let currentInvoiceId = null;
let currentPembelianId = null;
let currentAsetId = null;
let currentUser = null;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async function() {
    // Initialize IndexedDB
    try {
        await initDB();
        
        // Create default admin if not exists
        await createDefaultAdmin();
        
        // Check if user is logged in
        checkAuth();
    } catch (error) {
        console.error('Error initializing database:', error);
        alert('Error membuka database. Silakan refresh halaman.');
    }
});

async function initApp() {
    // Set tanggal hari ini
    const today = new Date().toISOString().split('T')[0];
    if (document.getElementById('tanggalTransaksi')) {
        document.getElementById('tanggalTransaksi').value = today;
    }
    
    // Load data dari database
    await loadUserData();
    
    // Initialize default accounts jika belum ada
    if (dataAkun.length === 0) {
        initializeDefaultAccounts();
    }
    
    // Populate select options
    populateAkunSelect();
    populateFilterAkun();
    
    // Update tampilan
    updateDashboard();
    tampilkanJurnal();
    tampilkanDaftarAkun();
    
    // Setup event listeners untuk perhitungan otomatis
    setupCalculationListeners();
    
    // Load identitas WP untuk SPT
    loadIdentitasWP();
    
    // Setup UI berdasarkan role
    setupRoleBasedUI();
}

// ===== AUTHENTICATION & USER MANAGEMENT =====
async function createDefaultAdmin() {
    const transaction = db.transaction(['users'], 'readwrite');
    const store = transaction.objectStore('users');
    const count = await new Promise((resolve, reject) => {
        const countRequest = store.count();
        countRequest.onsuccess = () => resolve(countRequest.result);
        countRequest.onerror = () => reject(countRequest.error);
    });
    
    if (count === 0) {
        const admin = {
            username: 'admin',
            password: btoa('admin123'), // Simple encoding
            namaLengkap: 'Administrator',
            email: 'admin@system.com',
            role: 'Admin',
            status: 'active',
            createdAt: new Date().toISOString()
        };
        
        await new Promise((resolve, reject) => {
            const addRequest = store.add(admin);
            addRequest.onsuccess = () => resolve();
            addRequest.onerror = () => reject(addRequest.error);
        });
    }
}

function switchLoginTab(tab) {
    document.querySelectorAll('.tab-link').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tab === 'login') {
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    } else {
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    }
}

async function loginUser(event) {
    event.preventDefault();
    
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const transaction = db.transaction(['users'], 'readonly');
        const store = transaction.objectStore('users');
        const index = store.index('username');
        
        const user = await new Promise((resolve, reject) => {
            const request = index.get(username);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        if (!user) {
            alert('❌ Username tidak ditemukan!');
            return;
        }
        
        if (user.status === 'inactive') {
            alert('❌ Akun Anda telah dinonaktifkan. Hubungi administrator.');
            return;
        }
        
        if (atob(user.password) !== password) {
            alert('❌ Password salah!');
            return;
        }
        
        // Login sukses
        currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        
        // Show main app
        document.body.classList.remove('login-page');
        
        // Update user info
        document.getElementById('userAvatar').textContent = user.namaLengkap.charAt(0).toUpperCase();
        document.getElementById('userName').textContent = user.namaLengkap;
        document.getElementById('userRole').textContent = user.role;
        
        // Initialize app
        await initApp();
        
        alert(`✅ Selamat datang, ${user.namaLengkap}!`);
    } catch (error) {
        console.error('Login error:', error);
        alert('❌ Terjadi kesalahan saat login.');
    }
}

async function registerUser(event) {
    event.preventDefault();
    
    const namaLengkap = document.getElementById('regNamaLengkap').value;
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;
    const role = document.getElementById('regRole').value;
    
    if (password !== passwordConfirm) {
        alert('❌ Password dan konfirmasi password tidak sama!');
        return;
    }
    
    try {
        const transaction = db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        
        // Check if username exists
        const usernameIndex = store.index('username');
        const existingUser = await new Promise((resolve) => {
            const request = usernameIndex.get(username);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
        
        if (existingUser) {
            alert('❌ Username sudah digunakan!');
            return;
        }
        
        // Check if email exists
        const emailIndex = store.index('email');
        const existingEmail = await new Promise((resolve) => {
            const request = emailIndex.get(email);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
        
        if (existingEmail) {
            alert('❌ Email sudah terdaftar!');
            return;
        }
        
        const newUser = {
            username: username,
            password: btoa(password),
            namaLengkap: namaLengkap,
            email: email,
            role: role,
            status: 'active',
            createdAt: new Date().toISOString()
        };
        
        await new Promise((resolve, reject) => {
            const request = store.add(newUser);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        alert('✅ Registrasi berhasil! Silakan login dengan akun Anda.');
        
        // Reset form dan switch ke login
        document.getElementById('registerForm').querySelector('form').reset();
        switchLoginTab('login');
        
    } catch (error) {
        console.error('Registration error:', error);
        alert('❌ Terjadi kesalahan saat registrasi.');
    }
}

function checkAuth() {
    const userSession = sessionStorage.getItem('currentUser');
    
    if (userSession) {
        currentUser = JSON.parse(userSession);
        document.body.classList.remove('login-page');
        
        // Update user info
        document.getElementById('userAvatar').textContent = currentUser.namaLengkap.charAt(0).toUpperCase();
        document.getElementById('userName').textContent = currentUser.namaLengkap;
        document.getElementById('userRole').textContent = currentUser.role;
        
        initApp();
    } else {
        document.body.classList.add('login-page');
    }
}

function logoutUser() {
    if (!confirm('Yakin ingin logout?')) return;
    
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    
    // Clear data
    dataAkun = [];
    dataTransaksi = [];
    dataInvoice = [];
    dataAset = [];
    
    // Show login page
    document.body.classList.add('login-page');
    
    // Reset login form
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
    
    alert('✅ Anda telah logout.');
}

async function manageUsers() {
    if (currentUser.role !== 'Admin') {
        alert('❌ Hanya Admin yang dapat mengelola user!');
        return;
    }
    
    await loadAllUsers();
    document.getElementById('modalUsers').style.display = 'block';
}

async function loadAllUsers() {
    const transaction = db.transaction(['users'], 'readonly');
    const store = transaction.objectStore('users');
    
    const users = await new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    
    const tbody = document.getElementById('bodyDaftarUsers');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 40px;">Belum ada user terdaftar.</td></tr>';
        return;
    }
    
    let html = '';
    users.forEach(user => {
        const statusClass = user.status === 'active' ? 'status-lunas' : 'status-belum';
        const statusText = user.status === 'active' ? 'Aktif' : 'Nonaktif';
        
        html += `<tr>
            <td><strong>${user.username}</strong></td>
            <td>${user.namaLengkap}</td>
            <td>${user.email}</td>
            <td><span class="status-badge" style="background: #dbeafe; color: #1e40af;">${user.role}</span></td>
            <td>${new Date(user.createdAt).toLocaleDateString('id-ID')}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td class="text-center">
                <div class="btn-group">
                    ${user.username !== 'admin' && user.id !== currentUser.id ? `
                        <button class="btn ${user.status === 'active' ? 'btn-warning' : 'btn-success'} btn-small" 
                                onclick="toggleUserStatus(${user.id}, '${user.status}')" 
                                title="${user.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}">
                            ${user.status === 'active' ? '🔒' : '🔓'}
                        </button>
                        <button class="btn btn-danger btn-small" onclick="deleteUser(${user.id})" title="Hapus">🗑️</button>
                    ` : '<span style="color: #9ca3af;">-</span>'}
                </div>
            </td>
        </tr>`;
    });
    
    tbody.innerHTML = html;
}

async function toggleUserStatus(userId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    
    try {
        const transaction = db.transaction(['users'], 'readwrite');
        const store = transaction.objectStore('users');
        
        const user = await new Promise((resolve, reject) => {
            const request = store.get(userId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
        
        user.status = newStatus;
        
        await new Promise((resolve, reject) => {
            const request = store.put(user);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        alert(`✅ Status user berhasil diubah menjadi ${newStatus === 'active' ? 'Aktif' : 'Nonaktif'}`);
        await loadAllUsers();
    } catch (error) {
        console.error('Toggle status error:', error);
        alert('❌ Terjadi kesalahan saat mengubah status.');
    }
}

async function deleteUser(userId) {
    if (!confirm('Yakin ingin menghapus user ini?\n\nSemua data user akan ikut terhapus!')) return;
    
    try {
        // Delete user
        const userTransaction = db.transaction(['users'], 'readwrite');
        const userStore = userTransaction.objectStore('users');
        
        await new Promise((resolve, reject) => {
            const request = userStore.delete(userId);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
        
        // Delete user data
        const dataTransaction = db.transaction(['userData'], 'readwrite');
        const dataStore = dataTransaction.objectStore('userData');
        const index = dataStore.index('userId');
        
        const userDataKeys = await new Promise((resolve, reject) => {
            const keys = [];
            const request = index.openCursor(IDBKeyRange.only(userId));
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    keys.push(cursor.primaryKey);
                    cursor.continue();
                } else {
                    resolve(keys);
                }
            };
            request.onerror = () => reject(request.error);
        });
        
        for (const key of userDataKeys) {
            await new Promise((resolve, reject) => {
                const request = dataStore.delete(key);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
        
        alert('✅ User berhasil dihapus!');
        await loadAllUsers();
    } catch (error) {
        console.error('Delete user error:', error);
        alert('❌ Terjadi kesalahan saat menghapus user.');
    }
}

function setupRoleBasedUI() {
    if (!currentUser) return;
    
    // Admin: full access
    // Akuntan: can input and view reports
    // User: view only
    
    const btnManageUsers = document.getElementById('btnManageUsers');
    const btnHapusSemua = document.getElementById('btnHapusSemua');
    
    if (currentUser.role === 'Admin') {
        // Full access
        btnManageUsers.style.display = 'block';
    } else {
        // Hide admin features
        btnManageUsers.style.display = 'none';
        
        if (currentUser.role === 'User') {
            // Read only - hide delete buttons and input forms
            btnHapusSemua.style.display = 'none';
            
            // Disable input tabs (could be extended)
            const transaksiTab = document.querySelector('[onclick*="transaksi"]');
            if (transaksiTab) {
                transaksiTab.style.opacity = '0.5';
                transaksiTab.title = 'Role User hanya dapat melihat laporan';
            }
        }
    }
}

// ===== MASTER DATA AKUN DEFAULT =====
function initializeDefaultAccounts() {
    const defaultAccounts = [
        // ASET
        { kode: '1-1000', nama: 'Kas', kelompok: 'Aset', saldo: 0 },
        { kode: '1-1100', nama: 'Bank', kelompok: 'Aset', saldo: 0 },
        { kode: '1-1200', nama: 'Persediaan Barang', kelompok: 'Aset', saldo: 0 },
        { kode: '1-1300', nama: 'Piutang Usaha', kelompok: 'Aset', saldo: 0 },
        { kode: '1-1400', nama: 'Perlengkapan', kelompok: 'Aset', saldo: 0 },
        { kode: '1-1500', nama: 'Asuransi Dibayar Dimuka', kelompok: 'Aset', saldo: 0 },
        { kode: '1-1600', nama: 'PPN Masukan', kelompok: 'Aset', saldo: 0 },
        { kode: '1-2000', nama: 'Peralatan', kelompok: 'Aset', saldo: 0 },
        { kode: '1-2100', nama: 'Akumulasi Penyusutan Peralatan', kelompok: 'Aset', saldo: 0 },
        { kode: '1-2200', nama: 'Gedung', kelompok: 'Aset', saldo: 0 },
        { kode: '1-2300', nama: 'Akumulasi Penyusutan Gedung', kelompok: 'Aset', saldo: 0 },
        { kode: '1-2400', nama: 'Kendaraan', kelompok: 'Aset', saldo: 0 },
        { kode: '1-2500', nama: 'Akumulasi Penyusutan Kendaraan', kelompok: 'Aset', saldo: 0 },
        
        // KEWAJIBAN
        { kode: '2-1000', nama: 'Hutang Usaha', kelompok: 'Kewajiban', saldo: 0 },
        { kode: '2-1100', nama: 'Hutang Gaji', kelompok: 'Kewajiban', saldo: 0 },
        { kode: '2-1200', nama: 'Hutang Pajak PPh 21', kelompok: 'Kewajiban', saldo: 0 },
        { kode: '2-1300', nama: 'Hutang Pajak PPh 23', kelompok: 'Kewajiban', saldo: 0 },
        { kode: '2-1400', nama: 'Hutang PPN', kelompok: 'Kewajiban', saldo: 0 },
        { kode: '2-2000', nama: 'Hutang Bank Jangka Panjang', kelompok: 'Kewajiban', saldo: 0 },
        
        // MODAL
        { kode: '3-1000', nama: 'Modal Pemilik', kelompok: 'Modal', saldo: 0 },
        { kode: '3-2000', nama: 'Prive', kelompok: 'Modal', saldo: 0 },
        { kode: '3-3000', nama: 'Laba Ditahan', kelompok: 'Modal', saldo: 0 },
        
        // PENDAPATAN
        { kode: '4-1000', nama: 'Pendapatan Penjualan', kelompok: 'Pendapatan', saldo: 0 },
        { kode: '4-1100', nama: 'Pendapatan Jasa', kelompok: 'Pendapatan', saldo: 0 },
        { kode: '4-2000', nama: 'Pendapatan Lain-lain', kelompok: 'Pendapatan', saldo: 0 },
        { kode: '4-3000', nama: 'Potongan Penjualan', kelompok: 'Pendapatan', saldo: 0 },
        
        // BEBAN
        { kode: '5-1000', nama: 'Beban Gaji', kelompok: 'Beban', saldo: 0 },
        { kode: '5-1100', nama: 'Beban Listrik', kelompok: 'Beban', saldo: 0 },
        { kode: '5-1200', nama: 'Beban Air', kelompok: 'Beban', saldo: 0 },
        { kode: '5-1300', nama: 'Beban Telepon & Internet', kelompok: 'Beban', saldo: 0 },
        { kode: '5-1400', nama: 'Beban Sewa', kelompok: 'Beban', saldo: 0 },
        { kode: '5-1500', nama: 'Beban Perlengkapan', kelompok: 'Beban', saldo: 0 },
        { kode: '5-1600', nama: 'Beban Penyusutan', kelompok: 'Beban', saldo: 0 },
        { kode: '5-1700', nama: 'Beban Asuransi', kelompok: 'Beban', saldo: 0 },
        { kode: '5-1800', nama: 'Beban Pemeliharaan', kelompok: 'Beban', saldo: 0 },
        { kode: '5-1900', nama: 'Beban Transport', kelompok: 'Beban', saldo: 0 },
        { kode: '5-2000', nama: 'Beban ATK', kelompok: 'Beban', saldo: 0 },
        { kode: '5-2100', nama: 'Beban Pajak', kelompok: 'Beban', saldo: 0 },
        { kode: '5-2200', nama: 'Beban Bunga', kelompok: 'Beban', saldo: 0 },
        { kode: '5-9000', nama: 'Beban Lain-lain', kelompok: 'Beban', saldo: 0 }
    ];
    
    dataAkun = defaultAccounts;
    saveData();
}

// ===== DATABASE STORAGE FUNCTIONS =====
async function saveData() {
    if (!currentUser) return;
    
    try {
        const transaction = db.transaction(['userData'], 'readwrite');
        const store = transaction.objectStore('userData');
        const index = store.index('userId');
        
        // Delete existing data for this user
        const existingKeys = await new Promise((resolve, reject) => {
            const keys = [];
            const request = index.openCursor(IDBKeyRange.only(currentUser.id));
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    keys.push(cursor.primaryKey);
                    cursor.continue();
                } else {
                    resolve(keys);
                }
            };
            request.onerror = () => reject(request.error);
        });
        
        for (const key of existingKeys) {
            await new Promise((resolve, reject) => {
                const request = store.delete(key);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
        
        // Save new data
        const dataToSave = [
            { userId: currentUser.id, type: 'akun', data: dataAkun },
            { userId: currentUser.id, type: 'transaksi', data: dataTransaksi },
            { userId: currentUser.id, type: 'invoice', data: dataInvoice },
            { userId: currentUser.id, type: 'pembelian', data: dataPembelian },
            { userId: currentUser.id, type: 'aset', data: dataAset }
        ];
        
        for (const item of dataToSave) {
            await new Promise((resolve, reject) => {
                const request = store.add(item);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(request.error);
            });
        }
    } catch (error) {
        console.error('Save data error:', error);
    }
}

async function loadUserData() {
    if (!currentUser) return;
    
    try {
        const transaction = db.transaction(['userData'], 'readonly');
        const store = transaction.objectStore('userData');
        const index = store.index('userId');
        
        const allData = await new Promise((resolve, reject) => {
            const data = [];
            const request = index.openCursor(IDBKeyRange.only(currentUser.id));
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    data.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(data);
                }
            };
            request.onerror = () => reject(request.error);
        });
        
        dataAkun = [];
        dataTransaksi = [];
        dataInvoice = [];
        dataPembelian = [];
        dataAset = [];
        
        allData.forEach(item => {
            switch (item.type) {
                case 'akun':
                    dataAkun = item.data || [];
                    break;
                case 'transaksi':
                    dataTransaksi = item.data || [];
                    break;
                case 'invoice':
                    dataInvoice = item.data || [];
                    break;
                case 'pembelian':
                    dataPembelian = item.data || [];
                    break;
                case 'aset':
                    dataAset = item.data || [];
                    break;
            }
        });
    } catch (error) {
        console.error('Load data error:', error);
    }
}

// ===== MOBILE MENU =====
function toggleMobileMenu() {
    const navTabs = document.getElementById('navTabs');
    navTabs.classList.toggle('show');
}

// ===== TAB NAVIGATION =====
function switchTab(tabName) {
    // Update active tab
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    // Close mobile menu if open
    if (window.innerWidth <= 768) {
        const navTabs = document.getElementById('navTabs');
        navTabs.classList.remove('show');
    }
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    currentTab = tabName;
    
    // Refresh data untuk tab yang dipilih
    switch(tabName) {
        case 'dashboard':
            updateDashboard();
            break;
        case 'jurnal':
            tampilkanJurnal();
            break;
        case 'buku-besar':
            tampilkanBukuBesar();
            break;
        case 'neraca-saldo':
            tampilkanNeracaSaldo();
            break;
        case 'laba-rugi':
            tampilkanLabaRugi();
            break;
        case 'neraca':
            tampilkanNeraca();
            break;
        case 'arus-kas':
            tampilkanArusKas();
            break;
        case 'pajak':
            tampilkanPerpajakan();
            break;
        case 'spt-tahunan':
            tampilkanSPTTahunan();
            break;
        case 'invoice':
            tampilkanDaftarInvoice();
            break;
        case 'pembelian':
            tampilkanDaftarPembelian();
            break;
        case 'penyusutan':
            tampilkanDaftarAset();
            break;
        case 'akun':
            tampilkanDaftarAkun();
            break;
    }
}

// ===== MASTER AKUN FUNCTIONS =====
function simpanAkun(event) {
    event.preventDefault();
    
    const kode = document.getElementById('kodeAkun').value;
    const nama = document.getElementById('namaAkun').value;
    const kelompok = document.getElementById('kelompokAkun').value;
    
    // Cek duplikasi kode
    if (dataAkun.find(a => a.kode === kode)) {
        alert('Kode akun sudah digunakan!');
        return;
    }
    
    dataAkun.push({
        kode: kode,
        nama: nama,
        kelompok: kelompok,
        saldo: 0
    });
    
    saveData();
    populateAkunSelect();
    populateFilterAkun();
    tampilkanDaftarAkun();
    
    // Reset form
    document.getElementById('formAkun').reset();
    
    alert('Akun berhasil ditambahkan!');
}

function hapusAkun(kode) {
    if (!confirm('Yakin ingin menghapus akun ini?')) return;
    
    // Cek apakah akun sudah digunakan
    const sudahDigunakan = dataTransaksi.some(t => 
        t.detail.some(d => d.akun === kode)
    );
    
    if (sudahDigunakan) {
        alert('Akun tidak dapat dihapus karena sudah digunakan dalam transaksi!');
        return;
    }
    
    dataAkun = dataAkun.filter(a => a.kode !== kode);
    saveData();
    populateAkunSelect();
    populateFilterAkun();
    tampilkanDaftarAkun();
}

function tampilkanDaftarAkun() {
    const tbody = document.getElementById('bodyDaftarAkun');
    
    if (dataAkun.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding: 40px; color: #9ca3af;">Belum ada data akun</td></tr>';
        return;
    }
    
    // Urutkan berdasarkan kode
    const sortedAkun = [...dataAkun].sort((a, b) => a.kode.localeCompare(b.kode));
    
    let html = '';
    let currentKelompok = '';
    
    sortedAkun.forEach(akun => {
        if (currentKelompok !== akun.kelompok) {
            currentKelompok = akun.kelompok;
            html += `<tr style="background: var(--light-color); font-weight: 700;">
                <td colspan="5">${currentKelompok}</td>
            </tr>`;
        }
        
        const saldo = hitungSaldoAkun(akun.kode);
        
        html += `<tr>
            <td>${akun.kode}</td>
            <td>${akun.nama}</td>
            <td><span class="badge badge-${akun.kelompok === 'Aset' ? 'debit' : 'credit'}">${akun.kelompok}</span></td>
            <td class="text-right">${formatRupiah(Math.abs(saldo))}</td>
            <td>
                <button class="btn btn-danger" style="padding: 5px 10px; font-size: 0.85rem;" onclick="hapusAkun('${akun.kode}')">Hapus</button>
            </td>
        </tr>`;
    });
    
    tbody.innerHTML = html;
}

function populateAkunSelect() {
    const selects = document.querySelectorAll('.akun-select');
    const sortedAkun = [...dataAkun].sort((a, b) => a.kode.localeCompare(b.kode));
    
    let optionsHtml = '<option value="">Pilih Akun</option>';
    let currentKelompok = '';
    
    sortedAkun.forEach(akun => {
        if (currentKelompok !== akun.kelompok) {
            if (currentKelompok !== '') optionsHtml += '</optgroup>';
            currentKelompok = akun.kelompok;
            optionsHtml += `<optgroup label="${akun.kelompok}">`;
        }
        optionsHtml += `<option value="${akun.kode}">${akun.kode} - ${akun.nama}</option>`;
    });
    optionsHtml += '</optgroup>';
    
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = optionsHtml;
        select.value = currentValue;
    });
}

function populateFilterAkun() {
    const select = document.getElementById('filterAkun');
    if (!select) return;
    
    const sortedAkun = [...dataAkun].sort((a, b) => a.kode.localeCompare(b.kode));
    
    let optionsHtml = '<option value="">Semua Akun</option>';
    sortedAkun.forEach(akun => {
        optionsHtml += `<option value="${akun.kode}">${akun.kode} - ${akun.nama}</option>`;
    });
    
    select.innerHTML = optionsHtml;
}

// ===== TRANSAKSI FUNCTIONS =====
function setupCalculationListeners() {
    document.getElementById('jurnalEntries').addEventListener('input', function(e) {
        if (e.target.classList.contains('debit-input') || e.target.classList.contains('kredit-input')) {
            hitungTotal();
        }
    });
}

function tambahBaris() {
    const container = document.getElementById('jurnalEntries');
    const newEntry = document.createElement('div');
    newEntry.className = 'form-row jurnal-entry';
    newEntry.style.cssText = 'margin-bottom: 15px; padding: 15px; background: var(--light-color); border-radius: 8px;';
    
    newEntry.innerHTML = `
        <div class="form-group" style="margin-bottom: 0;">
            <label>Akun *</label>
            <select class="form-control akun-select" required>
                <option value="">Pilih Akun</option>
            </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label>Debit</label>
            <input type="number" class="form-control debit-input" min="0" step="0.01" placeholder="0">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label>Kredit</label>
            <input type="number" class="form-control kredit-input" min="0" step="0.01" placeholder="0">
        </div>
    `;
    
    container.appendChild(newEntry);
    populateAkunSelect();
}

function hapusBaris() {
    const entries = document.querySelectorAll('.jurnal-entry');
    if (entries.length > 1) {
        entries[entries.length - 1].remove();
        hitungTotal();
    } else {
        alert('Minimal harus ada 1 baris jurnal!');
    }
}

function hitungTotal() {
    let totalDebit = 0;
    let totalKredit = 0;
    
    document.querySelectorAll('.debit-input').forEach(input => {
        totalDebit += parseFloat(input.value) || 0;
    });
    
    document.querySelectorAll('.kredit-input').forEach(input => {
        totalKredit += parseFloat(input.value) || 0;
    });
    
    document.getElementById('totalDebit').textContent = formatRupiah(totalDebit);
    document.getElementById('totalKredit').textContent = formatRupiah(totalKredit);
    
    const selisih = totalDebit - totalKredit;
    const selisihEl = document.getElementById('selisih');
    selisihEl.textContent = formatRupiah(Math.abs(selisih));
    
    if (selisih === 0) {
        selisihEl.style.color = 'var(--success-color)';
    } else {
        selisihEl.style.color = 'var(--danger-color)';
    }
}

function simpanTransaksi(event) {
    event.preventDefault();
    
    const tanggal = document.getElementById('tanggalTransaksi').value;
    const nomorBukti = document.getElementById('nomorBukti').value || 'AUTO-' + Date.now();
    const keterangan = document.getElementById('keteranganTransaksi').value;
    
    // Ambil detail jurnal
    const entries = document.querySelectorAll('.jurnal-entry');
    const detail = [];
    
    entries.forEach(entry => {
        const akun = entry.querySelector('.akun-select').value;
        const debit = parseFloat(entry.querySelector('.debit-input').value) || 0;
        const kredit = parseFloat(entry.querySelector('.kredit-input').value) || 0;
        
        if (akun && (debit > 0 || kredit > 0)) {
            detail.push({ akun, debit, kredit });
        }
    });
    
    if (detail.length < 2) {
        alert('Minimal harus ada 2 akun dalam jurnal!');
        return;
    }
    
    // Validasi balance
    const totalDebit = detail.reduce((sum, d) => sum + d.debit, 0);
    const totalKredit = detail.reduce((sum, d) => sum + d.kredit, 0);
    
    if (Math.abs(totalDebit - totalKredit) > 0.01) {
        alert('Total Debit dan Kredit harus seimbang!');
        return;
    }
    
    // Simpan transaksi
    dataTransaksi.push({
        id: Date.now(),
        tanggal: tanggal,
        nomorBukti: nomorBukti,
        keterangan: keterangan,
        detail: detail
    });
    
    saveData();
    
    // Reset form
    document.getElementById('formTransaksi').reset();
    document.getElementById('tanggalTransaksi').value = new Date().toISOString().split('T')[0];
    
    // Reset jurnal entries
    document.getElementById('jurnalEntries').innerHTML = `
        <div class="form-row jurnal-entry" style="margin-bottom: 15px; padding: 15px; background: var(--light-color); border-radius: 8px;">
            <div class="form-group" style="margin-bottom: 0;">
                <label>Akun *</label>
                <select class="form-control akun-select" required>
                    <option value="">Pilih Akun</option>
                </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Debit</label>
                <input type="number" class="form-control debit-input" min="0" step="0.01" placeholder="0">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Kredit</label>
                <input type="number" class="form-control kredit-input" min="0" step="0.01" placeholder="0">
            </div>
        </div>
    `;
    
    populateAkunSelect();
    hitungTotal();
    
    alert('Transaksi berhasil disimpan!');
    
    // Update semua tampilan
    updateDashboard();
    tampilkanJurnal();
}

// ===== DASHBOARD FUNCTIONS =====
function updateDashboard() {
    // Hitung totals
    const totals = hitungTotals();
    
    document.getElementById('totalAset').textContent = formatRupiah(totals.aset);
    document.getElementById('totalKewajiban').textContent = formatRupiah(totals.kewajiban);
    document.getElementById('totalModal').textContent = formatRupiah(totals.modal);
    document.getElementById('labaBersih').textContent = formatRupiah(totals.labaBersih);
    document.getElementById('totalPendapatan').textContent = formatRupiah(totals.pendapatan);
    document.getElementById('totalBeban').textContent = formatRupiah(totals.beban);
    
    // Tampilkan transaksi terakhir
    tampilkanTransaksiTerakhir();
}

function hitungTotals() {
    let aset = 0, kewajiban = 0, modal = 0, pendapatan = 0, beban = 0;
    
    dataAkun.forEach(akun => {
        const saldo = hitungSaldoAkun(akun.kode);
        
        switch(akun.kelompok) {
            case 'Aset':
                aset += saldo;
                break;
            case 'Kewajiban':
                kewajiban += saldo;
                break;
            case 'Modal':
                modal += saldo;
                break;
            case 'Pendapatan':
                pendapatan += saldo;
                break;
            case 'Beban':
                beban += saldo;
                break;
        }
    });
    
    const labaBersih = pendapatan - beban;
    
    return {
        aset: aset,
        kewajiban: Math.abs(kewajiban),
        modal: Math.abs(modal),
        pendapatan: Math.abs(pendapatan),
        beban: beban,
        labaBersih: labaBersih
    };
}

function hitungSaldoAkun(kodeAkun) {
    let saldo = 0;
    const akun = dataAkun.find(a => a.kode === kodeAkun);
    if (!akun) return 0;
    
    dataTransaksi.forEach(transaksi => {
        transaksi.detail.forEach(detail => {
            if (detail.akun === kodeAkun) {
                // Untuk akun normal debit (Aset, Beban): debit menambah, kredit mengurangi
                // Untuk akun normal kredit (Kewajiban, Modal, Pendapatan): kredit menambah, debit mengurangi
                if (['Aset', 'Beban'].includes(akun.kelompok)) {
                    saldo += detail.debit - detail.kredit;
                } else {
                    saldo += detail.kredit - detail.debit;
                }
            }
        });
    });
    
    return saldo;
}

function tampilkanTransaksiTerakhir() {
    const tbody = document.getElementById('recentTransactions');
    
    if (dataTransaksi.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="padding: 40px; color: #9ca3af;">Belum ada transaksi</td></tr>';
        return;
    }
    
    // Ambil 10 transaksi terakhir
    const recent = [...dataTransaksi].reverse().slice(0, 10);
    
    let html = '';
    recent.forEach(transaksi => {
        transaksi.detail.forEach((detail, idx) => {
            const akun = dataAkun.find(a => a.kode === detail.akun);
            const namaAkun = akun ? akun.nama : detail.akun;
            
            html += `<tr>
                ${idx === 0 ? `<td rowspan="${transaksi.detail.length}">${formatTanggal(transaksi.tanggal)}</td>` : ''}
                ${idx === 0 ? `<td rowspan="${transaksi.detail.length}">${transaksi.keterangan}</td>` : ''}
                <td>${namaAkun}</td>
                <td class="text-right">${detail.debit > 0 ? formatRupiah(detail.debit) : '-'}</td>
                <td class="text-right">${detail.kredit > 0 ? formatRupiah(detail.kredit) : '-'}</td>
                ${idx === 0 ? `<td rowspan="${transaksi.detail.length}" class="text-center">
                    <div class="btn-group">
                        <button class="btn btn-primary btn-small" onclick="editTransaksi(${transaksi.id})">✏️</button>
                        <button class="btn btn-danger btn-small" onclick="hapusTransaksi(${transaksi.id})">🗑️</button>
                    </div>
                </td>` : ''}
            </tr>`;
        });
    });
    
    tbody.innerHTML = html;
}

// ===== JURNAL UMUM =====
function tampilkanJurnal() {
    const tbody = document.getElementById('bodyJurnal');
    const periode = document.getElementById('periodeJurnal');
    
    if (dataTransaksi.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 40px; color: #9ca3af;">Belum ada transaksi</td></tr>';
        periode.textContent = 'Semua Periode';
        return;
    }
    
    // Sort by date
    const sorted = [...dataTransaksi].sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
    
    let html = '';
    let totalDebit = 0;
    let totalKredit = 0;
    
    sorted.forEach(transaksi => {
        transaksi.detail.forEach((detail, idx) => {
            const akun = dataAkun.find(a => a.kode === detail.akun);
            const namaAkun = akun ? `${akun.kode} - ${akun.nama}` : detail.akun;
            
            totalDebit += detail.debit;
            totalKredit += detail.kredit;
            
            html += `<tr>
                ${idx === 0 ? `<td rowspan="${transaksi.detail.length}">${formatTanggal(transaksi.tanggal)}</td>` : ''}
                ${idx === 0 ? `<td rowspan="${transaksi.detail.length}">${transaksi.nomorBukti}</td>` : ''}
                ${idx === 0 ? `<td rowspan="${transaksi.detail.length}">${transaksi.keterangan}</td>` : ''}
                <td>${namaAkun}</td>
                <td class="text-right">${detail.debit > 0 ? formatRupiah(detail.debit) : '-'}</td>
                <td class="text-right">${detail.kredit > 0 ? formatRupiah(detail.kredit) : '-'}</td>
                ${idx === 0 ? `<td rowspan="${transaksi.detail.length}" class="text-center">
                    <div class="btn-group">
                        <button class="btn btn-primary btn-small" onclick="editTransaksi(${transaksi.id})">✏️</button>
                        <button class="btn btn-danger btn-small" onclick="hapusTransaksi(${transaksi.id})">🗑️</button>
                    </div>
                </td>` : ''}
            </tr>`;
        });
    });
    
    // Total row
    html += `<tr style="background: var(--light-color); font-weight: 700;">
        <td colspan="4" class="text-right">TOTAL</td>
        <td class="text-right">${formatRupiah(totalDebit)}</td>
        <td class="text-right">${formatRupiah(totalKredit)}</td>
        <td></td>
    </tr>`;
    
    tbody.innerHTML = html;
    
    // Set periode
    if (sorted.length > 0) {
        const firstDate = new Date(sorted[0].tanggal);
        const lastDate = new Date(sorted[sorted.length - 1].tanggal);
        periode.textContent = `${formatTanggal(sorted[0].tanggal)} s/d ${formatTanggal(sorted[sorted.length - 1].tanggal)}`;
    }
}

// ===== BUKU BESAR =====
function tampilkanBukuBesar() {
    const container = document.getElementById('contentBukuBesar');
    const periode = document.getElementById('periodeBukuBesar');
    const filterAkun = document.getElementById('filterAkun').value;
    
    const akunList = filterAkun ? [dataAkun.find(a => a.kode === filterAkun)] : dataAkun;
    
    let html = '';
    
    akunList.forEach(akun => {
        if (!akun) return;
        
        // Filter transaksi untuk akun ini
        const transaksiAkun = [];
        dataTransaksi.forEach(transaksi => {
            transaksi.detail.forEach(detail => {
                if (detail.akun === akun.kode) {
                    transaksiAkun.push({
                        tanggal: transaksi.tanggal,
                        keterangan: transaksi.keterangan,
                        nomorBukti: transaksi.nomorBukti,
                        debit: detail.debit,
                        kredit: detail.kredit
                    });
                }
            });
        });
        
        if (transaksiAkun.length === 0) return;
        
        // Sort by date
        transaksiAkun.sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
        
        html += `
            <div class="card" style="margin-bottom: 20px;">
                <h3 style="margin-bottom: 15px; color: var(--primary-color);">${akun.kode} - ${akun.nama}</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Keterangan</th>
                                <th>No. Bukti</th>
                                <th class="text-right">Debit (Rp)</th>
                                <th class="text-right">Kredit (Rp)</th>
                                <th class="text-right">Saldo (Rp)</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        let saldo = 0;
        transaksiAkun.forEach(t => {
            if (['Aset', 'Beban'].includes(akun.kelompok)) {
                saldo += t.debit - t.kredit;
            } else {
                saldo += t.kredit - t.debit;
            }
            
            html += `<tr>
                <td>${formatTanggal(t.tanggal)}</td>
                <td>${t.keterangan}</td>
                <td>${t.nomorBukti}</td>
                <td class="text-right">${t.debit > 0 ? formatRupiah(t.debit) : '-'}</td>
                <td class="text-right">${t.kredit > 0 ? formatRupiah(t.kredit) : '-'}</td>
                <td class="text-right ${saldo >= 0 ? 'text-success' : 'text-danger'}">${formatRupiah(Math.abs(saldo))}</td>
            </tr>`;
        });
        
        html += `
                        <tr style="background: var(--light-color); font-weight: 700;">
                            <td colspan="5" class="text-right">SALDO AKHIR</td>
                            <td class="text-right ${saldo >= 0 ? 'text-success' : 'text-danger'}">${formatRupiah(Math.abs(saldo))}</td>
                        </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    });
    
    if (html === '') {
        html = '<div class="empty-state">Tidak ada transaksi untuk akun yang dipilih</div>';
    }
    
    container.innerHTML = html;
    periode.textContent = 'Semua Periode';
}

// ===== NERACA SALDO =====
function tampilkanNeracaSaldo() {
    const tbody = document.getElementById('bodyNeracaSaldo');
    const tanggal = document.getElementById('tanggalNeracaSaldo');
    
    let html = '';
    let totalDebit = 0;
    let totalKredit = 0;
    
    // Group by kelompok
    const kelompokList = ['Aset', 'Kewajiban', 'Modal', 'Pendapatan', 'Beban'];
    
    kelompokList.forEach(kelompok => {
        const akunKelompok = dataAkun.filter(a => a.kelompok === kelompok);
        
        if (akunKelompok.length > 0) {
            html += `<tr style="background: var(--light-color); font-weight: 700;">
                <td colspan="4">${kelompok}</td>
            </tr>`;
            
            akunKelompok.forEach(akun => {
                const saldo = hitungSaldoAkun(akun.kode);
                const absSaldo = Math.abs(saldo);
                
                if (absSaldo > 0) {
                    let debit = 0, kredit = 0;
                    
                    if (['Aset', 'Beban'].includes(kelompok)) {
                        if (saldo >= 0) debit = saldo;
                        else kredit = absSaldo;
                    } else {
                        if (saldo >= 0) kredit = saldo;
                        else debit = absSaldo;
                    }
                    
                    totalDebit += debit;
                    totalKredit += kredit;
                    
                    html += `<tr>
                        <td>${akun.kode}</td>
                        <td>${akun.nama}</td>
                        <td class="text-right">${debit > 0 ? formatRupiah(debit) : '-'}</td>
                        <td class="text-right">${kredit > 0 ? formatRupiah(kredit) : '-'}</td>
                    </tr>`;
                }
            });
        }
    });
    
    tbody.innerHTML = html;
    document.getElementById('totalDebitNS').textContent = formatRupiah(totalDebit);
    document.getElementById('totalKreditNS').textContent = formatRupiah(totalKredit);
    tanggal.textContent = formatTanggal(new Date().toISOString().split('T')[0]);
}

// ===== LABA RUGI =====
function tampilkanLabaRugi() {
    const tbody = document.getElementById('bodyLabaRugi');
    const periode = document.getElementById('periodeLabaRugi');
    
    let html = '';
    let totalPendapatan = 0;
    let totalBeban = 0;
    
    // PENDAPATAN
    html += `<tr style="background: var(--light-color); font-weight: 700;">
        <td colspan="2">PENDAPATAN</td>
    </tr>`;
    
    const akunPendapatan = dataAkun.filter(a => a.kelompok === 'Pendapatan');
    akunPendapatan.forEach(akun => {
        const saldo = Math.abs(hitungSaldoAkun(akun.kode));
        if (saldo > 0) {
            totalPendapatan += saldo;
            html += `<tr>
                <td style="padding-left: 30px;">${akun.nama}</td>
                <td class="text-right">${formatRupiah(saldo)}</td>
            </tr>`;
        }
    });
    
    html += `<tr style="font-weight: 700; background: #f0f9ff;">
        <td>Total Pendapatan</td>
        <td class="text-right text-success">${formatRupiah(totalPendapatan)}</td>
    </tr>`;
    
    // BEBAN
    html += `<tr style="background: var(--light-color); font-weight: 700;">
        <td colspan="2">BEBAN OPERASIONAL</td>
    </tr>`;
    
    const akunBeban = dataAkun.filter(a => a.kelompok === 'Beban');
    akunBeban.forEach(akun => {
        const saldo = hitungSaldoAkun(akun.kode);
        if (saldo > 0) {
            totalBeban += saldo;
            html += `<tr>
                <td style="padding-left: 30px;">${akun.nama}</td>
                <td class="text-right">${formatRupiah(saldo)}</td>
            </tr>`;
        }
    });
    
    html += `<tr style="font-weight: 700; background: #fef2f2;">
        <td>Total Beban</td>
        <td class="text-right text-danger">${formatRupiah(totalBeban)}</td>
    </tr>`;
    
    // LABA BERSIH
    const labaBersih = totalPendapatan - totalBeban;
    html += `<tr style="font-weight: 700; background: ${labaBersih >= 0 ? '#d1fae5' : '#fee2e2'}; font-size: 1.1rem;">
        <td>LABA ${labaBersih >= 0 ? 'BERSIH' : 'RUGI'}</td>
        <td class="text-right ${labaBersih >= 0 ? 'text-success' : 'text-danger'}">${formatRupiah(Math.abs(labaBersih))}</td>
    </tr>`;
    
    tbody.innerHTML = html;
    periode.textContent = 'Tahun 2026';
}

// ===== NERACA =====
function tampilkanNeraca() {
    const tbody = document.getElementById('bodyNeraca');
    const tanggal = document.getElementById('tanggalNeraca');
    
    let html = '';
    let totalAset = 0;
    let totalKewajiban = 0;
    let totalModal = 0;
    
    // ASET
    html += `<tr style="background: var(--primary-color); color: white; font-weight: 700;">
        <td colspan="2">ASET</td>
    </tr>`;
    
    const akunAset = dataAkun.filter(a => a.kelompok === 'Aset');
    akunAset.forEach(akun => {
        const saldo = hitungSaldoAkun(akun.kode);
        if (saldo !== 0) {
            totalAset += saldo;
            html += `<tr>
                <td style="padding-left: 30px;">${akun.nama}</td>
                <td class="text-right">${formatRupiah(Math.abs(saldo))}</td>
            </tr>`;
        }
    });
    
    html += `<tr style="font-weight: 700; background: #dbeafe;">
        <td>TOTAL ASET</td>
        <td class="text-right">${formatRupiah(totalAset)}</td>
    </tr>`;
    
    // KEWAJIBAN
    html += `<tr style="background: var(--danger-color); color: white; font-weight: 700;">
        <td colspan="2">KEWAJIBAN</td>
    </tr>`;
    
    const akunKewajiban = dataAkun.filter(a => a.kelompok === 'Kewajiban');
    akunKewajiban.forEach(akun => {
        const saldo = Math.abs(hitungSaldoAkun(akun.kode));
        if (saldo > 0) {
            totalKewajiban += saldo;
            html += `<tr>
                <td style="padding-left: 30px;">${akun.nama}</td>
                <td class="text-right">${formatRupiah(saldo)}</td>
            </tr>`;
        }
    });
    
    html += `<tr style="font-weight: 700; background: #fee2e2;">
        <td>TOTAL KEWAJIBAN</td>
        <td class="text-right">${formatRupiah(totalKewajiban)}</td>
    </tr>`;
    
    // MODAL
    html += `<tr style="background: var(--warning-color); color: white; font-weight: 700;">
        <td colspan="2">MODAL</td>
    </tr>`;
    
    const akunModal = dataAkun.filter(a => a.kelompok === 'Modal');
    akunModal.forEach(akun => {
        const saldo = Math.abs(hitungSaldoAkun(akun.kode));
        if (saldo > 0) {
            totalModal += saldo;
            html += `<tr>
                <td style="padding-left: 30px;">${akun.nama}</td>
                <td class="text-right">${formatRupiah(saldo)}</td>
            </tr>`;
        }
    });
    
    // Tambahkan laba bersih ke modal
    const totals = hitungTotals();
    if (totals.labaBersih !== 0) {
        totalModal += totals.labaBersih;
        html += `<tr>
            <td style="padding-left: 30px;">Laba Bersih Tahun Berjalan</td>
            <td class="text-right">${formatRupiah(Math.abs(totals.labaBersih))}</td>
        </tr>`;
    }
    
    html += `<tr style="font-weight: 700; background: #fef3c7;">
        <td>TOTAL MODAL</td>
        <td class="text-right">${formatRupiah(totalModal)}</td>
    </tr>`;
    
    html += `<tr style="font-weight: 700; background: var(--light-color); font-size: 1.1rem;">
        <td>TOTAL KEWAJIBAN & MODAL</td>
        <td class="text-right">${formatRupiah(totalKewajiban + totalModal)}</td>
    </tr>`;
    
    tbody.innerHTML = html;
    tanggal.textContent = formatTanggal(new Date().toISOString().split('T')[0]);
}

// ===== ARUS KAS =====
function tampilkanArusKas() {
    const tbody = document.getElementById('bodyArusKas');
    const periode = document.getElementById('periodeArusKas');
    
    // Untuk aplikasi sederhana, kita hitung dari perubahan kas
    const akunKas = dataAkun.filter(a => a.nama.toLowerCase().includes('kas') || a.nama.toLowerCase().includes('bank'));
    
    let html = '';
    let kasAwal = 0; // Bisa diambil dari saldo awal
    let kasAkhir = 0;
    
    akunKas.forEach(akun => {
        kasAkhir += hitungSaldoAkun(akun.kode);
    });
    
    const totals = hitungTotals();
    
    html += `<tr style="background: var(--light-color); font-weight: 700;">
        <td colspan="2">ARUS KAS DARI AKTIVITAS OPERASI</td>
    </tr>`;
    
    html += `<tr>
        <td style="padding-left: 30px;">Pendapatan</td>
        <td class="text-right text-success">${formatRupiah(totals.pendapatan)}</td>
    </tr>`;
    
    html += `<tr>
        <td style="padding-left: 30px;">Beban</td>
        <td class="text-right text-danger">(${formatRupiah(totals.beban)})</td>
    </tr>`;
    
    const kasOperasi = totals.pendapatan - totals.beban;
    
    html += `<tr style="font-weight: 700; background: #f0f9ff;">
        <td>Kas Bersih dari Aktivitas Operasi</td>
        <td class="text-right ${kasOperasi >= 0 ? 'text-success' : 'text-danger'}">${formatRupiah(Math.abs(kasOperasi))}</td>
    </tr>`;
    
    html += `<tr style="background: var(--light-color); font-weight: 700;">
        <td colspan="2">ARUS KAS DARI AKTIVITAS INVESTASI</td>
    </tr>`;
    
    html += `<tr>
        <td style="padding-left: 30px;">Pembelian Aset Tetap</td>
        <td class="text-right">-</td>
    </tr>`;
    
    html += `<tr style="font-weight: 700; background: #f0f9ff;">
        <td>Kas Bersih dari Aktivitas Investasi</td>
        <td class="text-right">Rp 0</td>
    </tr>`;
    
    html += `<tr style="background: var(--light-color); font-weight: 700;">
        <td colspan="2">ARUS KAS DARI AKTIVITAS PENDANAAN</td>
    </tr>`;
    
    html += `<tr>
        <td style="padding-left: 30px;">Penambahan Modal</td>
        <td class="text-right">${formatRupiah(totals.modal)}</td>
    </tr>`;
    
    html += `<tr style="font-weight: 700; background: #f0f9ff;">
        <td>Kas Bersih dari Aktivitas Pendanaan</td>
        <td class="text-right">${formatRupiah(totals.modal)}</td>
    </tr>`;
    
    const perubahanKas = kasOperasi + totals.modal;
    
    html += `<tr style="font-weight: 700; background: var(--light-color);">
        <td>Kenaikan (Penurunan) Kas</td>
        <td class="text-right ${perubahanKas >= 0 ? 'text-success' : 'text-danger'}">${formatRupiah(Math.abs(perubahanKas))}</td>
    </tr>`;
    
    html += `<tr>
        <td>Kas Awal Periode</td>
        <td class="text-right">${formatRupiah(kasAwal)}</td>
    </tr>`;
    
    html += `<tr style="font-weight: 700; background: #d1fae5; font-size: 1.1rem;">
        <td>KAS AKHIR PERIODE</td>
        <td class="text-right text-success">${formatRupiah(kasAkhir)}</td>
    </tr>`;
    
    tbody.innerHTML = html;
    periode.textContent = 'Tahun 2026';
}

// ===== PERPAJAKAN =====
function tampilkanPerpajakan() {
    const periode = document.getElementById('periodePajak');
    
    // Hitung pajak
    const totals = hitungTotals();
    
    // PPh 21 (5% dari beban gaji sebagai simulasi)
    const bebanGaji = hitungSaldoAkun('5-1000');
    const pph21 = bebanGaji * 0.05;
    
    // PPh 23 (2% dari pendapatan jasa)
    const pendapatanJasa = Math.abs(hitungSaldoAkun('4-1100'));
    const pph23 = pendapatanJasa * 0.02;
    
    // PPN (11% dari pendapatan)
    const ppn = totals.pendapatan * 0.11;
    
    document.getElementById('totalPPh21').textContent = formatRupiah(pph21);
    document.getElementById('totalPPh23').textContent = formatRupiah(pph23);
    document.getElementById('totalPPN').textContent = formatRupiah(ppn);
    
    periode.textContent = 'Tahun 2026';
}

function tampilkanDetailPPh21() {
    const bebanGaji = hitungSaldoAkun('5-1000');
    const pph21 = bebanGaji * 0.05;
    
    const html = `
        <div class="card">
            <h3 style="margin-bottom: 15px;">Detail PPh Pasal 21</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Keterangan</th>
                            <th class="text-right">Jumlah (Rp)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Total Beban Gaji</td>
                            <td class="text-right">${formatRupiah(bebanGaji)}</td>
                        </tr>
                        <tr>
                            <td>Tarif PPh 21 (5%)</td>
                            <td class="text-right">5%</td>
                        </tr>
                        <tr style="background: var(--light-color); font-weight: 700;">
                            <td>PPh 21 Terutang</td>
                            <td class="text-right text-danger">${formatRupiah(pph21)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="alert alert-info" style="margin-top: 20px;">
                ℹ️ Perhitungan ini merupakan simulasi. Untuk perhitungan aktual, silakan konsultasikan dengan konsultan pajak.
            </div>
        </div>
    `;
    
    document.getElementById('detailPajak').innerHTML = html;
}

function tampilkanDetailPPh23() {
    const pendapatanJasa = Math.abs(hitungSaldoAkun('4-1100'));
    const pph23 = pendapatanJasa * 0.02;
    
    const html = `
        <div class="card">
            <h3 style="margin-bottom: 15px;">Detail PPh Pasal 23</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Keterangan</th>
                            <th class="text-right">Jumlah (Rp)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Total Pendapatan Jasa</td>
                            <td class="text-right">${formatRupiah(pendapatanJasa)}</td>
                        </tr>
                        <tr>
                            <td>Tarif PPh 23 (2%)</td>
                            <td class="text-right">2%</td>
                        </tr>
                        <tr style="background: var(--light-color); font-weight: 700;">
                            <td>PPh 23 Dipotong</td>
                            <td class="text-right text-danger">${formatRupiah(pph23)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="alert alert-info" style="margin-top: 20px;">
                ℹ️ PPh 23 dipotong oleh pemberi penghasilan (withholding tax).
            </div>
        </div>
    `;
    
    document.getElementById('detailPajak').innerHTML = html;
}

function tampilkanDetailPPN() {
    const totals = hitungTotals();
    const ppn = totals.pendapatan * 0.11;
    
    const html = `
        <div class="card">
            <h3 style="margin-bottom: 15px;">Detail PPN (Pajak Pertambahan Nilai)</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Keterangan</th>
                            <th class="text-right">Jumlah (Rp)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>Dasar Pengenaan Pajak (DPP)</td>
                            <td class="text-right">${formatRupiah(totals.pendapatan)}</td>
                        </tr>
                        <tr>
                            <td>Tarif PPN (11%)</td>
                            <td class="text-right">11%</td>
                        </tr>
                        <tr style="background: var(--light-color); font-weight: 700;">
                            <td>PPN Keluaran</td>
                            <td class="text-right text-success">${formatRupiah(ppn)}</td>
                        </tr>
                        <tr>
                            <td>PPN Masukan</td>
                            <td class="text-right">Rp 0</td>
                        </tr>
                        <tr style="background: #fef3c7; font-weight: 700;">
                            <td>PPN yang Harus Dibayar</td>
                            <td class="text-right text-danger">${formatRupiah(ppn)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div class="alert alert-info" style="margin-top: 20px;">
                ℹ️ Tarif PPN 11% berlaku sejak 1 April 2022. PPN Masukan dapat dikreditkan jika ada pembelian dari PKP.
            </div>
        </div>
    `;
    
    document.getElementById('detailPajak').innerHTML = html;
}

// ===== SPT TAHUNAN BADAN =====
let identitasWP = {
    npwp: '',
    nama: '',
    alamat: '',
    jenisUsaha: ''
};

function loadIdentitasWP() {
    const saved = localStorage.getItem('identitasWP');
    if (saved) {
        identitasWP = JSON.parse(saved);
        document.getElementById('npwpBadan').value = identitasWP.npwp || '';
        document.getElementById('namaWP').value = identitasWP.nama || '';
        document.getElementById('alamatWP').value = identitasWP.alamat || '';
        document.getElementById('jenisUsaha').value = identitasWP.jenisUsaha || '';
    }
}

function simpanIdentitasWP(event) {
    event.preventDefault();
    
    identitasWP = {
        npwp: document.getElementById('npwpBadan').value,
        nama: document.getElementById('namaWP').value,
        alamat: document.getElementById('alamatWP').value,
        jenisUsaha: document.getElementById('jenisUsaha').value
    };
    
    localStorage.setItem('identitasWP', JSON.stringify(identitasWP));
    alert('✅ Identitas Wajib Pajak berhasil disimpan!');
    tampilkanSPTTahunan();
}

function tampilkanSPTTahunan() {
    loadIdentitasWP();
    hitungSPTTahunan();
    tampilkanLampiran1A();
    tampilkanLampiran1B();
    tampilkanKreditPajak();
    tampilkanStatusPembayaran();
    
    const tahun = new Date().getFullYear();
    document.getElementById('tahunPajakSPT').textContent = tahun;
}

function hitungSPTTahunan() {
    const totals = hitungTotals();
    
    // 1. Peredaran Usaha (Pendapatan)
    const peredaran_usaha = totals.pendapatan;
    
    // 2. Harga Pokok Penjualan (jika ada akun HPP)
    const hpp = hitungSaldoAkun('5-0100') || 0; // Asumsi kode akun HPP
    
    // 3. Laba Bruto
    const laba_bruto = peredaran_usaha - hpp;
    
    // 4. Biaya Usaha Lainnya
    const biaya_usaha = totals.beban - hpp;
    
    // 5. Laba (Rugi) Usaha
    const laba_usaha = laba_bruto - biaya_usaha;
    
    // 6. Penghasilan dari luar usaha
    const penghasilan_luar_usaha = Math.abs(hitungSaldoAkun('4-2000')) || 0;
    
    // 7. Beban dari luar usaha
    const beban_bunga = hitungSaldoAkun('5-2200') || 0;
    const beban_luar_usaha = beban_bunga;
    
    // 8. Laba (Rugi) Sebelum Pajak
    const laba_sebelum_pajak = laba_usaha + penghasilan_luar_usaha - beban_luar_usaha;
    
    // 9. Koreksi Fiskal Positif
    const koreksi_fiskal_positif = hitungKoreksiFiskalPositif();
    
    // 10. Koreksi Fiskal Negatif
    const koreksi_fiskal_negatif = hitungKoreksiFiskalNegatif();
    
    // 11. Penghasilan Neto Fiskal
    const penghasilan_neto_fiskal = laba_sebelum_pajak + koreksi_fiskal_positif - koreksi_fiskal_negatif;
    
    // 12. Kompensasi Kerugian (jika ada)
    const kompensasi_kerugian = 0; // Bisa diinput manual
    
    // 13. Penghasilan Kena Pajak (PKP)
    const pkp = Math.max(0, penghasilan_neto_fiskal - kompensasi_kerugian);
    
    // 14. PPh Terutang
    let pph_terutang = 0;
    
    // Cek fasilitas tarif untuk omzet <= 4,8 M
    if (peredaran_usaha <= 4800000000) {
        // Fasilitas PP 23: bagian penghasilan s.d. 4,8M dapat fasilitas
        const penghasilan_fasilitas = Math.min(pkp, 4800000000);
        const tarif_fasilitas = 0.22 * 0.5; // 50% dari tarif normal 22%
        const tarif_normal = 0.22;
        
        if (pkp <= 4800000000) {
            pph_terutang = pkp * tarif_fasilitas;
        } else {
            pph_terutang = (penghasilan_fasilitas * tarif_fasilitas) + ((pkp - penghasilan_fasilitas) * tarif_normal);
        }
    } else {
        // Tarif normal 22%
        pph_terutang = pkp * 0.22;
    }
    
    // 15. Kredit Pajak
    const kredit_pajak = hitungTotalKreditPajak();
    
    // 16. PPh Kurang/(Lebih) Bayar
    const pph_kurang_lebih_bayar = pph_terutang - kredit_pajak;
    
    // Tampilkan di tabel
    const tbody = document.getElementById('bodyRingkasanSPT');
    
    let html = `
        <tr style="background: var(--light-color); font-weight: 700;">
            <td colspan="2">A. PERHITUNGAN PENGHASILAN NETO FISKAL</td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">1. Peredaran Usaha (Pendapatan)</td>
            <td class="text-right">${formatRupiah(peredaran_usaha)}</td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">2. Harga Pokok Penjualan</td>
            <td class="text-right">(${formatRupiah(hpp)})</td>
        </tr>
        <tr style="background: #f0f9ff;">
            <td style="padding-left: 30px; font-weight: 600;">3. Laba Bruto</td>
            <td class="text-right font-weight: 600;">${formatRupiah(laba_bruto)}</td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">4. Biaya Usaha</td>
            <td class="text-right">(${formatRupiah(biaya_usaha)})</td>
        </tr>
        <tr style="background: #f0f9ff;">
            <td style="padding-left: 30px; font-weight: 600;">5. Laba (Rugi) Usaha</td>
            <td class="text-right font-weight: 600;">${formatRupiah(laba_usaha)}</td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">6. Penghasilan dari Luar Usaha</td>
            <td class="text-right">${formatRupiah(penghasilan_luar_usaha)}</td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">7. Biaya dari Luar Usaha</td>
            <td class="text-right">(${formatRupiah(beban_luar_usaha)})</td>
        </tr>
        <tr style="background: #fef3c7; font-weight: 700;">
            <td style="padding-left: 30px;">8. Laba (Rugi) Sebelum Pajak (Komersial)</td>
            <td class="text-right">${formatRupiah(laba_sebelum_pajak)}</td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">9. Koreksi Fiskal Positif</td>
            <td class="text-right text-danger">${formatRupiah(koreksi_fiskal_positif)}</td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">10. Koreksi Fiskal Negatif</td>
            <td class="text-right text-success">(${formatRupiah(koreksi_fiskal_negatif)})</td>
        </tr>
        <tr style="background: #dcfce7; font-weight: 700;">
            <td style="padding-left: 30px;">11. Penghasilan Neto Fiskal</td>
            <td class="text-right">${formatRupiah(penghasilan_neto_fiskal)}</td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">12. Kompensasi Kerugian Tahun Sebelumnya</td>
            <td class="text-right">(${formatRupiah(kompensasi_kerugian)})</td>
        </tr>
        <tr style="background: var(--light-color); font-weight: 700;">
            <td colspan="2">B. PERHITUNGAN PPh TERUTANG</td>
        </tr>
        <tr style="background: #dbeafe; font-weight: 700; font-size: 1.05rem;">
            <td style="padding-left: 30px;">13. PENGHASILAN KENA PAJAK (PKP)</td>
            <td class="text-right">${formatRupiah(pkp)}</td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">14. PPh Terutang (Tarif ${peredaran_usaha <= 4800000000 ? '11% / 22%' : '22%'})</td>
            <td class="text-right text-danger">${formatRupiah(pph_terutang)}</td>
        </tr>
        <tr>
            <td style="padding-left: 30px;">15. Kredit Pajak (PPh Pasal 22, 23, 25)</td>
            <td class="text-right text-success">(${formatRupiah(kredit_pajak)})</td>
        </tr>
        <tr style="background: ${pph_kurang_lebih_bayar >= 0 ? '#fee2e2' : '#d1fae5'}; font-weight: 700; font-size: 1.1rem;">
            <td style="padding-left: 30px;">16. PPh ${pph_kurang_lebih_bayar >= 0 ? 'KURANG BAYAR' : 'LEBIH BAYAR'}</td>
            <td class="text-right ${pph_kurang_lebih_bayar >= 0 ? 'text-danger' : 'text-success'}">${formatRupiah(Math.abs(pph_kurang_lebih_bayar))}</td>
        </tr>
    `;
    
    if (peredaran_usaha <= 4800000000) {
        html += `
        <tr>
            <td colspan="2" style="padding: 15px; background: #fffbeb; border-left: 4px solid var(--warning-color);">
                ⭐ <strong>Fasilitas Tarif:</strong> Wajib Pajak mendapat fasilitas pengurangan tarif 50% karena omzet ≤ Rp 4,8 Miliar<br>
                Tarif efektif: 11% (50% x 22%) untuk bagian penghasilan s.d. 4,8M
            </td>
        </tr>
        `;
    }
    
    tbody.innerHTML = html;
}

function hitungKoreksiFiskalPositif() {
    // Koreksi Fiskal Positif: biaya yang tidak boleh dikurangkan secara fiskal
    let total = 0;
    
    // 1. Biaya yang tidak ada bukti
    // 2. Biaya untuk kepentingan pribadi
    // 3. Premi asuransi untuk kepentingan pribadi
    // 4. Sanksi administrasi pajak
    // 5. PPh yang terutang
    
    const bebanPajak = hitungSaldoAkun('5-2100') || 0;
    total += bebanPajak;
    
    // Penyusutan komersial yang berbeda dengan fiskal
    const penyusutanKomersial = hitungSaldoAkun('5-1600') || 0;
    const penyusutanFiskal = hitungTotalPenyusutanFiskal();
    
    if (penyusutanKomersial > penyusutanFiskal) {
        total += (penyusutanKomersial - penyusutanFiskal);
    }
    
    return total;
}

function hitungKoreksiFiskalNegatif() {
    // Koreksi Fiskal Negatif: penghasilan yang sudah dikenakan PPh Final
    let total = 0;
    
    // Penyusutan fiskal lebih besar dari komersial
    const penyusutanKomersial = hitungSaldoAkun('5-1600') || 0;
    const penyusutanFiskal = hitungTotalPenyusutanFiskal();
    
    if (penyusutanFiskal > penyusutanKomersial) {
        total += (penyusutanFiskal - penyusutanKomersial);
    }
    
    return total;
}

function tampilkanLampiran1A() {
    const totals = hitungTotals();
    const tbody = document.getElementById('bodyLampiran1A');
    
    let html = `
        <tr style="background: var(--light-color); font-weight: 700;">
            <td colspan="2">I. PEREDARAN USAHA</td>
        </tr>
    `;
    
    // Tampilkan detail pendapatan
    const akunPendapatan = dataAkun.filter(a => a.kelompok === 'Pendapatan');
    let totalPendapatan = 0;
    
    akunPendapatan.forEach(akun => {
        const saldo = Math.abs(hitungSaldoAkun(akun.kode));
        if (saldo > 0) {
            totalPendapatan += saldo;
            html += `<tr>
                <td style="padding-left: 30px;">${akun.nama}</td>
                <td class="text-right">${formatRupiah(saldo)}</td>
            </tr>`;
        }
    });
    
    html += `
        <tr style="background: #dcfce7; font-weight: 700;">
            <td>JUMLAH PEREDARAN USAHA</td>
            <td class="text-right">${formatRupiah(totalPendapatan)}</td>
        </tr>
        <tr style="background: var(--light-color); font-weight: 700;">
            <td colspan="2">II. BIAYA USAHA</td>
        </tr>
    `;
    
    // Tampilkan detail beban
    const akunBeban = dataAkun.filter(a => a.kelompok === 'Beban');
    let totalBeban = 0;
    
    akunBeban.forEach(akun => {
        const saldo = hitungSaldoAkun(akun.kode);
        if (saldo > 0) {
            totalBeban += saldo;
            html += `<tr>
                <td style="padding-left: 30px;">${akun.nama}</td>
                <td class="text-right">${formatRupiah(saldo)}</td>
            </tr>`;
        }
    });
    
    html += `
        <tr style="background: #fee2e2; font-weight: 700;">
            <td>JUMLAH BIAYA USAHA</td>
            <td class="text-right">${formatRupiah(totalBeban)}</td>
        </tr>
    `;
    
    tbody.innerHTML = html;
}

function tampilkanLampiran1B() {
    const tbody = document.getElementById('bodyLampiran1B');
    
    // Data aset tetap yang disusutkan
    const asetTetap = [
        { nama: 'Peralatan', kode: '1-2000', kelompok: 'I', tarif: 0.25 },
        { nama: 'Gedung', kode: '1-2200', kelompok: 'Bangunan Permanen', tarif: 0.05 },
        { nama: 'Kendaraan', kode: '1-2400', kelompok: 'II', tarif: 0.125 }
    ];
    
    let html = '';
    let totalPenyusutan = 0;
    const tahunSekarang = new Date().getFullYear();
    
    asetTetap.forEach(aset => {
        const nilaiPerolehan = hitungSaldoAkun(aset.kode);
        if (nilaiPerolehan > 0) {
            const penyusutan = nilaiPerolehan * aset.tarif;
            totalPenyusutan += penyusutan;
            
            html += `<tr>
                <td>${aset.nama}</td>
                <td class="text-center">${tahunSekarang}</td>
                <td class="text-right">${formatRupiah(nilaiPerolehan)}</td>
                <td class="text-center">${aset.kelompok}</td>
                <td class="text-right">${(aset.tarif * 100).toFixed(2)}%</td>
                <td class="text-right">${formatRupiah(penyusutan)}</td>
            </tr>`;
        }
    });
    
    if (html === '') {
        html = '<tr><td colspan="6" class="text-center" style="padding: 20px; color: #9ca3af;">Tidak ada aset tetap yang disusutkan</td></tr>';
    } else {
        html += `<tr style="background: var(--light-color); font-weight: 700;">
            <td colspan="5" class="text-right">TOTAL PENYUSUTAN FISKAL</td>
            <td class="text-right">${formatRupiah(totalPenyusutan)}</td>
        </tr>`;
    }
    
    tbody.innerHTML = html;
}

function hitungTotalPenyusutanFiskal() {
    const asetTetap = [
        { kode: '1-2000', tarif: 0.25 },
        { kode: '1-2200', tarif: 0.05 },
        { kode: '1-2400', tarif: 0.125 }
    ];
    
    let total = 0;
    asetTetap.forEach(aset => {
        const nilaiPerolehan = hitungSaldoAkun(aset.kode);
        total += nilaiPerolehan * aset.tarif;
    });
    
    return total;
}

function tampilkanKreditPajak() {
    const tbody = document.getElementById('bodyKreditPajak');
    
    // Kredit pajak yang dapat diperhitungkan
    const pph22 = 0; // PPh Pasal 22 (jika ada)
    const pph23 = Math.abs(hitungSaldoAkun('2-1300')) || 0; // Hutang PPh 23 yang sudah dibayar
    const pph25 = 0; // PPh Pasal 25 (angsuran bulanan)
    
    const total = pph22 + pph23 + pph25;
    
    let html = `
        <tr>
            <td>PPh Pasal 22</td>
            <td class="text-right">${formatRupiah(pph22)}</td>
        </tr>
        <tr>
            <td>PPh Pasal 23</td>
            <td class="text-right">${formatRupiah(pph23)}</td>
        </tr>
        <tr>
            <td>PPh Pasal 25 (Angsuran Bulanan)</td>
            <td class="text-right">${formatRupiah(pph25)}</td>
        </tr>
        <tr style="background: var(--light-color); font-weight: 700;">
            <td>TOTAL KREDIT PAJAK</td>
            <td class="text-right text-success">${formatRupiah(total)}</td>
        </tr>
    `;
    
    tbody.innerHTML = html;
}

function hitungTotalKreditPajak() {
    const pph22 = 0;
    const pph23 = Math.abs(hitungSaldoAkun('2-1300')) || 0;
    const pph25 = 0;
    
    return pph22 + pph23 + pph25;
}

function tampilkanStatusPembayaran() {
    const container = document.getElementById('statusPembayaran');
    const totals = hitungTotals();
    
    // Hitung PKP dan PPh Terutang
    const peredaran_usaha = totals.pendapatan;
    const laba_sebelum_pajak = totals.labaBersih;
    const koreksi_fiskal_positif = hitungKoreksiFiskalPositif();
    const koreksi_fiskal_negatif = hitungKoreksiFiskalNegatif();
    const penghasilan_neto_fiskal = laba_sebelum_pajak + koreksi_fiskal_positif - koreksi_fiskal_negatif;
    const pkp = Math.max(0, penghasilan_neto_fiskal);
    
    let pph_terutang = 0;
    if (peredaran_usaha <= 4800000000 && pkp <= 4800000000) {
        pph_terutang = pkp * 0.11;
    } else if (peredaran_usaha <= 4800000000) {
        pph_terutang = (4800000000 * 0.11) + ((pkp - 4800000000) * 0.22);
    } else {
        pph_terutang = pkp * 0.22;
    }
    
    const kredit_pajak = hitungTotalKreditPajak();
    const pph_kurang_lebih_bayar = pph_terutang - kredit_pajak;
    
    let statusHtml = '';
    
    if (pph_kurang_lebih_bayar > 0) {
        statusHtml = `
            <div class="alert alert-danger">
                <strong>⚠️ STATUS: KURANG BAYAR</strong><br>
                Jumlah yang harus dibayar: <strong>${formatRupiah(pph_kurang_lebih_bayar)}</strong><br>
                <br>
                <strong>Batas Waktu:</strong><br>
                • Pembayaran: Paling lambat tanggal 30 April ${new Date().getFullYear() + 1}<br>
                • Pelaporan SPT: Paling lambat tanggal 30 April ${new Date().getFullYear() + 1}<br>
                <br>
                <strong>Cara Pembayaran:</strong><br>
                • Melalui e-Billing DJP Online<br>
                • Bank Persepsi atau Kantor Pos<br>
                • Kode Akun Pajak: 411128 (PPh Badan)<br>
                • Kode Jenis Setoran: 200 (SPT Tahunan PPh Badan)
            </div>
        `;
    } else if (pph_kurang_lebih_bayar < 0) {
        statusHtml = `
            <div class="alert alert-success">
                <strong>✅ STATUS: LEBIH BAYAR</strong><br>
                Jumlah lebih bayar: <strong>${formatRupiah(Math.abs(pph_kurang_lebih_bayar))}</strong><br>
                <br>
                <strong>Pilihan:</strong><br>
                1. Dikembalikan (Restitusi) - perlu permohonan<br>
                2. Dikompensasikan ke tahun pajak berikutnya<br>
                <br>
                • Tetap wajib lapor SPT paling lambat 30 April ${new Date().getFullYear() + 1}
            </div>
        `;
    } else {
        statusHtml = `
            <div class="alert alert-info">
                <strong>🟢 STATUS: NIHIL</strong><br>
                PPh Terutang sudah sesuai dengan kredit pajak<br>
                <br>
                • Tetap wajib lapor SPT paling lambat 30 April ${new Date().getFullYear() + 1}
            </div>
        `;
    }
    
    container.innerHTML = statusHtml;
}

function hitungUlangSPT() {
    if (confirm('🔄 Hitung ulang semua data SPT Tahunan?')) {
        tampilkanSPTTahunan();
        alert('✅ SPT Tahunan berhasil dihitung ulang!');
    }
}

// ===== UTILITY FUNCTIONS =====
function formatRupiah(angka) {
    if (isNaN(angka) || angka === null) return 'Rp 0';
    
    const number = Math.round(angka);
    return 'Rp ' + number.toLocaleString('id-ID');
}

function formatTanggal(tanggal) {
    const date = new Date(tanggal);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('id-ID', options);
}

function exportToExcel(reportType) {
    alert('Fitur export ke Excel akan segera tersedia.\n\nUntuk saat ini, Anda dapat menggunakan fitur Print (Ctrl+P) dan pilih "Save as PDF".');
}

function filterByPeriode() {
    tampilkanJurnal();
}

// ===== CRUD TRANSAKSI =====
function editTransaksi(id) {
    const transaksi = dataTransaksi.find(t => t.id === id);
    if (!transaksi) {
        alert('Transaksi tidak ditemukan!');
        return;
    }
    
    // Isi form edit
    document.getElementById('editTransaksiId').value = transaksi.id;
    document.getElementById('editTanggal').value = transaksi.tanggal;
    document.getElementById('editNomorBukti').value = transaksi.nomorBukti;
    document.getElementById('editKeterangan').value = transaksi.keterangan;
    
    // Isi detail jurnal
    const container = document.getElementById('editJurnalEntries');
    container.innerHTML = '';
    
    transaksi.detail.forEach(detail => {
        const entry = document.createElement('div');
        entry.className = 'form-row jurnal-entry';
        entry.style.cssText = 'margin-bottom: 15px; padding: 15px; background: var(--light-color); border-radius: 8px;';
        
        entry.innerHTML = `
            <div class="form-group" style="margin-bottom: 0;">
                <label>Akun *</label>
                <select class="form-control edit-akun-select" required>
                    <option value="">Pilih Akun</option>
                </select>
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Debit</label>
                <input type="number" class="form-control edit-debit-input" min="0" step="0.01" value="${detail.debit}" placeholder="0">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
                <label>Kredit</label>
                <input type="number" class="form-control edit-kredit-input" min="0" step="0.01" value="${detail.kredit}" placeholder="0">
            </div>
        `;
        
        container.appendChild(entry);
        
        // Populate select
        const select = entry.querySelector('.edit-akun-select');
        populateEditAkunSelect(select, detail.akun);
    });
    
    // Setup listeners
    setupEditCalculationListeners();
    hitungTotalEdit();
    
    // Show modal
    document.getElementById('modalEditTransaksi').style.display = 'block';
}

function populateEditAkunSelect(selectElement, selectedValue) {
    const sortedAkun = [...dataAkun].sort((a, b) => a.kode.localeCompare(b.kode));
    
    let optionsHtml = '<option value="">Pilih Akun</option>';
    let currentKelompok = '';
    
    sortedAkun.forEach(akun => {
        if (currentKelompok !== akun.kelompok) {
            if (currentKelompok !== '') optionsHtml += '</optgroup>';
            currentKelompok = akun.kelompok;
            optionsHtml += `<optgroup label="${akun.kelompok}">`;
        }
        optionsHtml += `<option value="${akun.kode}" ${akun.kode === selectedValue ? 'selected' : ''}>${akun.kode} - ${akun.nama}</option>`;
    });
    optionsHtml += '</optgroup>';
    
    selectElement.innerHTML = optionsHtml;
}

function setupEditCalculationListeners() {
    document.getElementById('editJurnalEntries').addEventListener('input', function(e) {
        if (e.target.classList.contains('edit-debit-input') || e.target.classList.contains('edit-kredit-input')) {
            hitungTotalEdit();
        }
    });
}

function tambahBarisEdit() {
    const container = document.getElementById('editJurnalEntries');
    const newEntry = document.createElement('div');
    newEntry.className = 'form-row jurnal-entry';
    newEntry.style.cssText = 'margin-bottom: 15px; padding: 15px; background: var(--light-color); border-radius: 8px;';
    
    newEntry.innerHTML = `
        <div class="form-group" style="margin-bottom: 0;">
            <label>Akun *</label>
            <select class="form-control edit-akun-select" required>
                <option value="">Pilih Akun</option>
            </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label>Debit</label>
            <input type="number" class="form-control edit-debit-input" min="0" step="0.01" placeholder="0">
        </div>
        <div class="form-group" style="margin-bottom: 0;">
            <label>Kredit</label>
            <input type="number" class="form-control edit-kredit-input" min="0" step="0.01" placeholder="0">
        </div>
    `;
    
    container.appendChild(newEntry);
    populateEditAkunSelect(newEntry.querySelector('.edit-akun-select'), '');
}

function hapusBarisEdit() {
    const entries = document.querySelectorAll('#editJurnalEntries .jurnal-entry');
    if (entries.length > 1) {
        entries[entries.length - 1].remove();
        hitungTotalEdit();
    } else {
        alert('Minimal harus ada 1 baris jurnal!');
    }
}

function hitungTotalEdit() {
    let totalDebit = 0;
    let totalKredit = 0;
    
    document.querySelectorAll('.edit-debit-input').forEach(input => {
        totalDebit += parseFloat(input.value) || 0;
    });
    
    document.querySelectorAll('.edit-kredit-input').forEach(input => {
        totalKredit += parseFloat(input.value) || 0;
    });
    
    document.getElementById('editTotalDebit').textContent = formatRupiah(totalDebit);
    document.getElementById('editTotalKredit').textContent = formatRupiah(totalKredit);
}

function updateTransaksi(event) {
    event.preventDefault();
    
    const id = parseInt(document.getElementById('editTransaksiId').value);
    const tanggal = document.getElementById('editTanggal').value;
    const nomorBukti = document.getElementById('editNomorBukti').value;
    const keterangan = document.getElementById('editKeterangan').value;
    
    // Ambil detail jurnal
    const entries = document.querySelectorAll('#editJurnalEntries .jurnal-entry');
    const detail = [];
    
    entries.forEach(entry => {
        const akun = entry.querySelector('.edit-akun-select').value;
        const debit = parseFloat(entry.querySelector('.edit-debit-input').value) || 0;
        const kredit = parseFloat(entry.querySelector('.edit-kredit-input').value) || 0;
        
        if (akun && (debit > 0 || kredit > 0)) {
            detail.push({ akun, debit, kredit });
        }
    });
    
    if (detail.length < 2) {
        alert('Minimal harus ada 2 akun dalam jurnal!');
        return;
    }
    
    // Validasi balance
    const totalDebit = detail.reduce((sum, d) => sum + d.debit, 0);
    const totalKredit = detail.reduce((sum, d) => sum + d.kredit, 0);
    
    if (Math.abs(totalDebit - totalKredit) > 0.01) {
        alert('Total Debit dan Kredit harus seimbang!');
        return;
    }
    
    // Update transaksi
    const index = dataTransaksi.findIndex(t => t.id === id);
    if (index !== -1) {
        dataTransaksi[index] = {
            id: id,
            tanggal: tanggal,
            nomorBukti: nomorBukti,
            keterangan: keterangan,
            detail: detail
        };
        
        saveData();
        closeModal('modalEditTransaksi');
        
        alert('Transaksi berhasil diupdate!');
        
        // Refresh tampilan
        updateDashboard();
        tampilkanJurnal();
        tampilkanTransaksiTerakhir();
    }
}

function hapusTransaksi(id) {
    if (!confirm('⚠️ Yakin ingin menghapus transaksi ini?\\n\\nTransaksi yang dihapus tidak dapat dikembalikan!')) {
        return;
    }
    
    dataTransaksi = dataTransaksi.filter(t => t.id !== id);
    saveData();
    
    alert('✅ Transaksi berhasil dihapus!');
    
    // Refresh tampilan
    updateDashboard();
    tampilkanJurnal();
    tampilkanTransaksiTerakhir();
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
    
    // Close mobile menu when clicking outside
    const navTabs = document.getElementById('navTabs');
    const hamburger = document.querySelector('.hamburger');
    
    if (navTabs && hamburger && window.innerWidth <= 768) {
        if (!event.target.closest('.nav-tabs') && !event.target.closest('.hamburger') && !event.target.closest('.mobile-header')) {
            navTabs.classList.remove('show');
        }
    }
}

// Handle window resize
let resizeTimer;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
        if (window.innerWidth > 768) {
            const navTabs = document.getElementById('navTabs');
            if (navTabs) {
                navTabs.classList.remove('show');
                navTabs.style.display = 'flex';
            }
        }
    }, 250);
});

// ===== BACKUP & RESTORE =====
function backupData() {
    const backup = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        dataAkun: dataAkun,
        dataTransaksi: dataTransaksi,
        dataInvoice: dataInvoice,
        dataPembelian: dataPembelian,
        dataAset: dataAset,
        identitasWP: identitasWP
    };
    
    const dataStr = JSON.stringify(backup, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup-keuangan-${new Date().toISOString().split('T')[0]}.json`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert('Data berhasil di-backup!\n\nFile backup telah diunduh.\nSimpan file ini dengan aman.');
}

function restoreData() {
    if (!confirm('Restore Data\n\nProses ini akan mengganti semua data yang ada dengan data dari file backup.\n\nYakin ingin melanjutkan?')) {
        return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const backup = JSON.parse(event.target.result);
                
                // Validasi struktur backup
                if (!backup.dataAkun || !backup.dataTransaksi) {
                    alert('File backup tidak valid!');
                    return;
                }
                
                // Restore data
                dataAkun = backup.dataAkun;
                dataTransaksi = backup.dataTransaksi;
                dataInvoice = backup.dataInvoice || [];
                dataPembelian = backup.dataPembelian || [];
                dataAset = backup.dataAset || [];
                if (backup.identitasWP) {
                    identitasWP = backup.identitasWP;
                    localStorage.setItem('identitasWP', JSON.stringify(identitasWP));
                }
                
                saveData();
                
                alert(`Data berhasil di-restore!\n\nTimestamp backup: ${new Date(backup.timestamp).toLocaleString('id-ID')}\n\nHalaman akan di-refresh.`);
                
                // Refresh halaman
                location.reload();
            } catch (error) {
                alert('Error membaca file backup!\n\n' + error.message);
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

function hapusSemuaData() {
    const confirmText = prompt('PERINGATAN!\n\nAnda akan menghapus SEMUA data termasuk:\n- Semua transaksi\n- Semua akun custom\n- Identitas WP\n\nKetik "HAPUS SEMUA" untuk konfirmasi:');
    
    if (confirmText !== 'HAPUS SEMUA') {
        alert('Penghapusan dibatalkan.');
        return;
    }
    
    // Clear all data
    localStorage.clear();
    
    alert('Semua data berhasil dihapus!\n\nHalaman akan di-refresh dan data default akan dimuat.');
    
    // Reload page
    location.reload();
}

// ===== INVOICE MANAGEMENT =====
function tampilkanDaftarInvoice() {
    const tbody = document.getElementById('bodyDaftarInvoice');
    
    if (dataInvoice.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 40px; color: #9ca3af;">Belum ada invoice. Klik "Buat Invoice Baru" untuk memulai.</td></tr>';
        return;
    }
    
    // Sort by date descending
    const sorted = [...dataInvoice].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    
    let html = '';
    sorted.forEach(invoice => {
        const statusClass = invoice.status === 'Lunas' ? 'status-lunas' : 
                           invoice.status === 'Overdue' ? 'status-overdue' : 'status-belum';
        
        html += `<tr>
            <td>${invoice.nomor}</td>
            <td>${formatTanggal(invoice.tanggal)}</td>
            <td>${invoice.pelanggan.nama}</td>
            <td class="text-right">${formatRupiah(invoice.subtotal)}</td>
            <td class="text-right">${formatRupiah(invoice.ppn)}</td>
            <td class="text-right"><strong>${formatRupiah(invoice.total)}</strong></td>
            <td><span class="status-badge ${statusClass}">${invoice.status}</span></td>
            <td class="text-center">
                <div class="btn-group">
                    <button class="btn btn-primary btn-small" onclick="lihatInvoice(${invoice.id})" title="Lihat/Cetak">👁️</button>
                    <button class="btn btn-warning btn-small" onclick="editInvoice(${invoice.id})" title="Edit">✏️</button>
                    <button class="btn btn-danger btn-small" onclick="hapusInvoice(${invoice.id})" title="Hapus">🗑️</button>
                </div>
            </td>
        </tr>`;
    });
    
    tbody.innerHTML = html;
}

function buatInvoiceBaru() {
    currentInvoiceId = null;
    document.getElementById('judulModalInvoice').textContent = '📄 Buat Invoice Baru';
    document.getElementById('formInvoice').reset();
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tanggalInvoice').value = today;
    
    // Generate nomor invoice otomatis
    const lastInvoice = dataInvoice.length > 0 ? dataInvoice[dataInvoice.length - 1].nomor : 'INV-000';
    const lastNumber = parseInt(lastInvoice.split('-')[1]) || 0;
    document.getElementById('nomorInvoice').value = `INV-${String(lastNumber + 1).padStart(3, '0')}`;
    
    // Reset items
    document.getElementById('invoiceItems').innerHTML = '';
    tambahItemInvoice();
    tambahItemInvoice();
    
    hitungTotalInvoice();
    document.getElementById('modalInvoice').style.display = 'block';
}

function tambahItemInvoice() {
    const container = document.getElementById('invoiceItems');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'form-row';
    itemDiv.style.cssText = 'margin-bottom: 15px; padding: 15px; background: var(--light-color); border-radius: 8px;';
    
    itemDiv.innerHTML = `
        <div class="form-group" style="flex: 2; margin-bottom: 0;">
            <label>Deskripsi *</label>
            <input type="text" class="form-control item-deskripsi" required placeholder="Jasa konsultasi, Produk A, dll">
        </div>
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label>Qty *</label>
            <input type="number" class="form-control item-qty" min="1" value="1" required>
        </div>
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label>Harga Satuan *</label>
            <input type="number" class="form-control item-harga" min="0" step="0.01" required placeholder="0">
        </div>
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label>Subtotal</label>
            <input type="text" class="form-control item-subtotal" readonly style="background: #f3f4f6;">
        </div>
    `;
    
    container.appendChild(itemDiv);
    
    // Add event listeners
    itemDiv.querySelector('.item-qty').addEventListener('input', hitungTotalInvoice);
    itemDiv.querySelector('.item-harga').addEventListener('input', hitungTotalInvoice);
}

function hapusItemInvoice() {
    const items = document.querySelectorAll('#invoiceItems .form-row');
    if (items.length > 1) {
        items[items.length - 1].remove();
        hitungTotalInvoice();
    } else {
        alert('Minimal harus ada 1 item!');
    }
}

function hitungTotalInvoice() {
    let subtotal = 0;
    
    const items = document.querySelectorAll('#invoiceItems .form-row');
    items.forEach(item => {
        const qty = parseFloat(item.querySelector('.item-qty').value) || 0;
        const harga = parseFloat(item.querySelector('.item-harga').value) || 0;
        const itemSubtotal = qty * harga;
        
        item.querySelector('.item-subtotal').value = formatRupiah(itemSubtotal);
        subtotal += itemSubtotal;
    });
    
    const includePPN = document.getElementById('includePPN').value === 'true';
    const ppn = includePPN ? subtotal * 0.11 : 0;
    const total = subtotal + ppn;
    
    document.getElementById('invoiceSubtotal').textContent = formatRupiah(subtotal);
    document.getElementById('invoicePPN').textContent = formatRupiah(ppn);
    document.getElementById('invoiceTotal').textContent = formatRupiah(total);
}

function simpanInvoice(event) {
    event.preventDefault();
    
    const id = currentInvoiceId || Date.now();
    const nomor = document.getElementById('nomorInvoice').value;
    const tanggal = document.getElementById('tanggalInvoice').value;
    const jatuhTempo = document.getElementById('jatuhTempo').value;
    
    const pelanggan = {
        nama: document.getElementById('namaPelanggan').value,
        telp: document.getElementById('telpPelanggan').value,
        alamat: document.getElementById('alamatPelanggan').value
    };
    
    // Ambil items
    const items = [];
    document.querySelectorAll('#invoiceItems .form-row').forEach(itemDiv => {
        const deskripsi = itemDiv.querySelector('.item-deskripsi').value;
        const qty = parseFloat(itemDiv.querySelector('.item-qty').value);
        const harga = parseFloat(itemDiv.querySelector('.item-harga').value);
        
        if (deskripsi && qty > 0 && harga >= 0) {
            items.push({
                deskripsi: deskripsi,
                qty: qty,
                harga: harga,
                subtotal: qty * harga
            });
        }
    });
    
    if (items.length === 0) {
        alert('Minimal harus ada 1 item invoice!');
        return;
    }
    
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const includePPN = document.getElementById('includePPN').value === 'true';
    const ppn = includePPN ? subtotal * 0.11 : 0;
    const total = subtotal + ppn;
    
    const invoice = {
        id: id,
        nomor: nomor,
        tanggal: tanggal,
        jatuhTempo: jatuhTempo,
        pelanggan: pelanggan,
        items: items,
        subtotal: subtotal,
        ppn: ppn,
        total: total,
        catatan: document.getElementById('catatanInvoice').value,
        status: 'Belum Lunas',
        createdAt: currentInvoiceId ? dataInvoice.find(inv => inv.id === id).createdAt : new Date().toISOString()
    };
    
    const isEdit = currentInvoiceId !== null;
    
    if (currentInvoiceId) {
        // Update existing
        const index = dataInvoice.findIndex(inv => inv.id === id);
        dataInvoice[index] = invoice;
    } else {
        // Add new
        dataInvoice.push(invoice);
        
        // INTEGRASI AKUNTANSI: Catat piutang dan pendapatan
        const detailJurnal = [];
        
        // Debit: Piutang Usaha
        detailJurnal.push({
            akun: '1-1300', // Piutang Usaha
            debit: total,
            kredit: 0
        });
        
        // Kredit: Pendapatan Jasa/Penjualan
        detailJurnal.push({
            akun: '4-1100', // Pendapatan Jasa
            debit: 0,
            kredit: subtotal
        });
        
        // Jika ada PPN, kredit: Hutang PPN
        if (ppn > 0) {
            detailJurnal.push({
                akun: '2-1400', // Hutang PPN
                debit: 0,
                kredit: ppn
            });
        }
        
        const transaksi = {
            id: Date.now() + 1,
            tanggal: tanggal,
            nomorBukti: nomor,
            keterangan: `Invoice ${nomor} - ${pelanggan.nama}${items.length > 0 ? ' (' + items[0].deskripsi + (items.length > 1 ? ', dll' : '') + ')' : ''}`,
            detail: detailJurnal
        };
        
        dataTransaksi.push(transaksi);
    }
    
    saveData();
    closeModal('modalInvoice');
    tampilkanDaftarInvoice();
    
    if (isEdit) {
        alert('Invoice berhasil diperbarui!');
    } else {
        alert('✅ Invoice berhasil disimpan!\n\n📝 Jurnal akuntansi telah dicatat:\n- Debit: Piutang Usaha ' + formatRupiah(total) + '\n- Kredit: Pendapatan ' + formatRupiah(subtotal) + (ppn > 0 ? '\n- Kredit: Hutang PPN ' + formatRupiah(ppn) : ''));
    }
    
    // Refresh dashboard
    if (typeof hitungTotals === 'function') {
        hitungTotals();
    }
}

function editInvoice(id) {
    const invoice = dataInvoice.find(inv => inv.id === id);
    if (!invoice) return;
    
    currentInvoiceId = id;
    document.getElementById('judulModalInvoice').textContent = '✏️ Edit Invoice';
    
    document.getElementById('nomorInvoice').value = invoice.nomor;
    document.getElementById('tanggalInvoice').value = invoice.tanggal;
    document.getElementById('jatuhTempo').value = invoice.jatuhTempo;
    document.getElementById('namaPelanggan').value = invoice.pelanggan.nama;
    document.getElementById('telpPelanggan').value = invoice.pelanggan.telp;
    document.getElementById('alamatPelanggan').value = invoice.pelanggan.alamat;
    document.getElementById('catatanInvoice').value = invoice.catatan;
    document.getElementById('includePPN').value = invoice.ppn > 0 ? 'true' : 'false';
    
    // Load items
    document.getElementById('invoiceItems').innerHTML = '';
    invoice.items.forEach(item => {
        tambahItemInvoice();
        const lastItem = document.querySelector('#invoiceItems .form-row:last-child');
        lastItem.querySelector('.item-deskripsi').value = item.deskripsi;
        lastItem.querySelector('.item-qty').value = item.qty;
        lastItem.querySelector('.item-harga').value = item.harga;
    });
    
    hitungTotalInvoice();
    document.getElementById('modalInvoice').style.display = 'block';
}

function hapusInvoice(id) {
    const invoice = dataInvoice.find(inv => inv.id === id);
    if (!invoice) return;
    
    if (invoice.status === 'Lunas') {
        alert('❌ Invoice yang sudah lunas tidak dapat dihapus!\n\nUntuk membatalkan, gunakan fitur jurnal koreksi di tab Transaksi.');
        return;
    }
    
    if (!confirm(`Yakin ingin menghapus invoice ${invoice.nomor}?\n\n⚠️ PERHATIAN:\nTransaksi piutang terkait juga akan dihapus dari jurnal akuntansi.`)) return;
    
    // Hapus transaksi terkait (yang nomorBukti-nya sama dengan nomor invoice)
    const transaksiTerkait = dataTransaksi.filter(t => t.nomorBukti === invoice.nomor);
    if (transaksiTerkait.length > 0) {
        dataTransaksi = dataTransaksi.filter(t => t.nomorBukti !== invoice.nomor);
    }
    
    dataInvoice = dataInvoice.filter(inv => inv.id !== id);
    saveData();
    tampilkanDaftarInvoice();
    
    if (transaksiTerkait.length > 0) {
        alert('✅ Invoice dan transaksi akuntansi terkait berhasil dihapus!');
    } else {
        alert('✅ Invoice berhasil dihapus!');
    }
    
    // Refresh dashboard
    if (typeof hitungTotals === 'function') {
        hitungTotals();
    }
}

function lihatInvoice(id) {
    const invoice = dataInvoice.find(inv => inv.id === id);
    if (!invoice) return;
    
    currentInvoiceId = id;
    
    // Generate invoice HTML
    const invoiceHTML = generateInvoiceHTML(invoice);
    document.getElementById('previewInvoice').innerHTML = invoiceHTML;
    document.getElementById('modalCetakInvoice').style.display = 'block';
}

function generateInvoiceHTML(invoice) {
    // Load identitas perusahaan
    const perusahaan = identitasWP.nama || 'NAMA PERUSAHAAN';
    const alamatPerusahaan = identitasWP.alamat || 'Alamat Perusahaan';
    const npwp = identitasWP.npwp || '';
    
    let itemsHTML = '';
    invoice.items.forEach((item, index) => {
        itemsHTML += `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td>${item.deskripsi}</td>
                <td class="text-center">${item.qty}</td>
                <td class="text-right">${formatRupiah(item.harga)}</td>
                <td class="text-right">${formatRupiah(item.subtotal)}</td>
            </tr>
        `;
    });
    
    return `
        <div class="invoice-container">
            <div class="invoice-header">
                <div class="company-info">
                    <h2>${perusahaan}</h2>
                    <p>${alamatPerusahaan}</p>
                    ${npwp ? `<p>NPWP: ${npwp}</p>` : ''}
                </div>
                <div class="invoice-title">
                    <h1>INVOICE</h1>
                    <p style="margin: 0; color: #6b7280;">${invoice.nomor}</p>
                </div>
            </div>

            <div class="invoice-details">
                <div class="detail-box">
                    <h4>Kepada:</h4>
                    <p><strong>${invoice.pelanggan.nama}</strong></p>
                    <p>${invoice.pelanggan.alamat || '-'}</p>
                    ${invoice.pelanggan.telp ? `<p>Telp: ${invoice.pelanggan.telp}</p>` : ''}
                </div>
                <div class="detail-box" style="text-align: right;">
                    <p><strong>Tanggal:</strong> ${formatTanggal(invoice.tanggal)}</p>
                    ${invoice.jatuhTempo ? `<p><strong>Jatuh Tempo:</strong> ${formatTanggal(invoice.jatuhTempo)}</p>` : ''}
                    <p><strong>Status:</strong> <span class="status-badge ${invoice.status === 'Lunas' ? 'status-lunas' : 'status-belum'}">${invoice.status}</span></p>
                </div>
            </div>

            <table class="invoice-table">
                <thead>
                    <tr>
                        <th style="width: 50px;">No</th>
                        <th>Deskripsi</th>
                        <th style="width: 80px;" class="text-center">Qty</th>
                        <th style="width: 150px;" class="text-right">Harga Satuan</th>
                        <th style="width: 150px;" class="text-right">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>

            <div class="invoice-summary">
                <table>
                    <tr>
                        <td><strong>Subtotal:</strong></td>
                        <td class="text-right">${formatRupiah(invoice.subtotal)}</td>
                    </tr>
                    ${invoice.ppn > 0 ? `
                    <tr>
                        <td><strong>PPN (11%):</strong></td>
                        <td class="text-right">${formatRupiah(invoice.ppn)}</td>
                    </tr>
                    ` : ''}
                    <tr class="total-row">
                        <td><strong>TOTAL:</strong></td>
                        <td class="text-right"><strong>${formatRupiah(invoice.total)}</strong></td>
                    </tr>
                </table>
            </div>

            ${invoice.catatan ? `
            <div style="margin-top: 20px; padding: 15px; background: var(--light-color); border-radius: 8px;">
                <strong>Catatan:</strong><br>
                ${invoice.catatan}
            </div>
            ` : ''}

            <div class="invoice-footer">
                <p style="margin-bottom: 10px;"><strong>Informasi Pembayaran:</strong></p>
                <p style="margin: 5px 0;">Transfer ke: Bank XYZ - 1234567890 a.n. ${perusahaan}</p>
                <p style="margin: 5px 0; color: #6b7280; font-size: 0.9rem;">Harap sertakan nomor invoice sebagai keterangan transfer</p>
            </div>

            <div class="signature-box">
                <div>
                    <p style="margin-bottom: 10px;">Hormat kami,</p>
                    <div class="signature-line">
                        <p style="margin: 0; font-weight: 600;">${perusahaan}</p>
                    </div>
                </div>
                <div>
                    <p style="margin-bottom: 10px;">Penerima,</p>
                    <div class="signature-line">
                        <p style="margin: 0; font-weight: 600;">${invoice.pelanggan.nama}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function cetakInvoice() {
    window.print();
}

function downloadInvoicePDF() {
    alert('Fitur download PDF sedang dalam pengembangan.\n\nUntuk saat ini, gunakan Print (Ctrl+P) dan pilih "Save as PDF".');
}

function ubahStatusInvoice() {
    if (!currentInvoiceId) return;
    
    const invoice = dataInvoice.find(inv => inv.id === currentInvoiceId);
    if (!invoice) return;
    
    const statusBaru = prompt(`Status saat ini: ${invoice.status}\n\nPilih status baru:\n1. Belum Lunas\n2. Lunas\n3. Overdue\n\nMasukkan pilihan (1-3):`, '1');
    
    if (!statusBaru) return;
    
    const statusMap = {
        '1': 'Belum Lunas',
        '2': 'Lunas',
        '3': 'Overdue'
    };
    
    const newStatus = statusMap[statusBaru];
    if (!newStatus) {
        alert('Pilihan tidak valid!');
        return;
    }
    
    invoice.status = newStatus;
    
    // Jika lunas, catat pembayaran ke transaksi
    if (newStatus === 'Lunas' && invoice.status !== 'Lunas') {
        const konfirmasi = confirm('Invoice akan ditandai Lunas.\n\nApakah ingin mencatat penerimaan pembayaran ke jurnal akuntansi?');
        
        if (konfirmasi) {
            // Catat penerimaan pembayaran
            const detailPembayaran = [];
            
            // Debit: Kas/Bank
            detailPembayaran.push({
                akun: '1-1100', // Kas/Bank
                debit: invoice.total,
                kredit: 0
            });
            
            // Kredit: Piutang Usaha
            detailPembayaran.push({
                akun: '1-1300', // Piutang Usaha
                debit: 0,
                kredit: invoice.total
            });
            
            const transaksi = {
                id: Date.now(),
                tanggal: new Date().toISOString().split('T')[0],
                nomorBukti: invoice.nomor + '-PMT',
                keterangan: `Penerimaan pembayaran invoice ${invoice.nomor} dari ${invoice.pelanggan.nama}`,
                detail: detailPembayaran
            };
            
            dataTransaksi.push(transaksi);
            
            alert('✅ Pembayaran berhasil dicatat!\n\n📝 Jurnal akuntansi:\n- Debit: Kas/Bank ' + formatRupiah(invoice.total) + '\n- Kredit: Piutang Usaha ' + formatRupiah(invoice.total));
        }
    }
    
    saveData();
    
    // Refresh tampilan
    const updatedInvoice = dataInvoice.find(inv => inv.id === currentInvoiceId);
    document.getElementById('previewInvoice').innerHTML = generateInvoiceHTML(updatedInvoice);
    tampilkanDaftarInvoice();
    
    alert(`Status invoice berhasil diubah menjadi: ${newStatus}`);
}

function exportInvoiceExcel() {
    alert('Fitur export Excel sedang dalam pengembangan.\n\nUntuk saat ini, gunakan Print untuk setiap invoice.');
}

// ===== PENYUSUTAN ASET TETAP =====
function tampilkanDaftarAset() {
    const tbody = document.getElementById('bodyDaftarAset');
    
    if (dataAset.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="text-center" style="padding: 40px; color: #9ca3af;">Belum ada aset tetap. Klik "Tambah Aset Baru" untuk memulai.</td></tr>';
        return;
    }
    
    let html = '';
    dataAset.forEach(aset => {
        const akumulasiPenyusutan = hitungAkumulasiPenyusutan(aset);
        const nilaiBuku = aset.hargaPerolehan - akumulasiPenyusutan;
        
        html += `<tr>
            <td>${aset.kode}</td>
            <td>${aset.nama}</td>
            <td>${aset.kelompok}</td>
            <td>${aset.metode === 'garis-lurus' ? 'Garis Lurus' : 'Saldo Menurun'}</td>
            <td>${formatTanggal(aset.tanggalPerolehan)}</td>
            <td class="text-right">${formatRupiah(aset.hargaPerolehan)}</td>
            <td class="text-right">${formatRupiah(aset.nilaiResidu)}</td>
            <td class="text-center">${aset.umurEkonomis}</td>
            <td class="text-right">${formatRupiah(akumulasiPenyusutan)}</td>
            <td class="text-right"><strong>${formatRupiah(nilaiBuku)}</strong></td>
            <td class="text-center">
                <div class="btn-group">
                    <button class="btn btn-warning btn-small" onclick="editAset(${aset.id})" title="Edit">✏️</button>
                    <button class="btn btn-danger btn-small" onclick="hapusAset(${aset.id})" title="Hapus">🗑️</button>
                </div>
            </td>
        </tr>`;
    });
    
    tbody.innerHTML = html;
}

function buatAsetBaru() {
    currentAsetId = null;
    document.getElementById('judulModalAset').textContent = '➕ Tambah Aset Tetap Baru';
    document.getElementById('formAset').reset();
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tanggalPerolehan').value = today;
    
    // Generate kode aset otomatis
    const lastAset = dataAset.length > 0 ? dataAset[dataAset.length - 1].kode : 'AST-000';
    const lastNumber = parseInt(lastAset.split('-')[1]) || 0;
    document.getElementById('kodeAset').value = `AST-${String(lastNumber + 1).padStart(3, '0')}`;
    
    document.getElementById('modalAset').style.display = 'block';
}

function setMetodePenyusutan() {
    const kelompok = document.getElementById('kelompokAset').value;
    const metodeSelect = document.getElementById('metodePenyusutan');
    const umurInput = document.getElementById('umurEkonomis');
    
    // Set default umur ekonomis berdasarkan kelompok
    const umurDefault = {
        'Bangunan': 20,
        'Kendaraan': 8,
        'Mesin': 8,
        'Elektronik': 4,
        'Furniture': 8,
        'Lainnya': 5
    };
    
    if (umurDefault[kelompok]) {
        umurInput.value = umurDefault[kelompok];
    }
    
    // Set default metode
    if (kelompok === 'Bangunan') {
        metodeSelect.value = 'garis-lurus';
    }
}

function simpanAset(event) {
    event.preventDefault();
    
    const id = currentAsetId || Date.now();
    const kode = document.getElementById('kodeAset').value;
    const nama = document.getElementById('namaAset').value;
    const kelompok = document.getElementById('kelompokAset').value;
    const metode = document.getElementById('metodePenyusutan').value;
    const tanggalPerolehan = document.getElementById('tanggalPerolehan').value;
    const hargaPerolehan = parseFloat(document.getElementById('hargaPerolehan').value);
    const nilaiResidu = parseFloat(document.getElementById('nilaiResidu').value) || 0;
    const umurEkonomis = parseInt(document.getElementById('umurEkonomis').value);
    const keterangan = document.getElementById('keteranganAset').value;
    
    // Validasi
    if (!currentAsetId && dataAset.find(a => a.kode === kode)) {
        alert('Kode aset sudah digunakan!');
        return;
    }
    
    if (nilaiResidu >= hargaPerolehan) {
        alert('Nilai residu harus lebih kecil dari harga perolehan!');
        return;
    }
    
    const aset = {
        id: id,
        kode: kode,
        nama: nama,
        kelompok: kelompok,
        metode: metode,
        tanggalPerolehan: tanggalPerolehan,
        hargaPerolehan: hargaPerolehan,
        nilaiResidu: nilaiResidu,
        umurEkonomis: umurEkonomis,
        keterangan: keterangan,
        createdAt: currentAsetId ? dataAset.find(a => a.id === id).createdAt : new Date().toISOString()
    };
    
    const isEdit = currentAsetId !== null;
    
    if (currentAsetId) {
        // Update existing
        const index = dataAset.findIndex(a => a.id === id);
        dataAset[index] = aset;
    } else {
        // Add new
        dataAset.push(aset);
        
        // INTEGRASI AKUNTANSI: Catat perolehan aset
        const konfirmasi = confirm(`Aset akan disimpan.\n\nApakah transaksi perolehan aset ini sudah dicatat di jurnal?\n\nKlik OK jika belum (akan otomatis dicatat)\nKlik Cancel jika sudah dicatat manual`);
        
        if (konfirmasi) {
            const detailJurnal = [];
            
            // Tentukan akun aset berdasarkan kelompok
            let kodeAkunAset = '1-2000'; // Default: Peralatan
            if (kelompok === 'Bangunan') kodeAkunAset = '1-2200';
            else if (kelompok === 'Kendaraan') kodeAkunAset = '1-2400';
            else if (kelompok === 'Mesin') kodeAkunAset = '1-2000';
            else if (kelompok === 'Elektronik') kodeAkunAset = '1-2000';
            else if (kelompok === 'Furniture') kodeAkunAset = '1-2000';
            
            // Debit: Aset Tetap
            detailJurnal.push({
                akun: kodeAkunAset,
                debit: hargaPerolehan,
                kredit: 0
            });
            
            // Kredit: Kas/Bank (asumsi dibayar tunai)
            detailJurnal.push({
                akun: '1-1100', // Bank
                debit: 0,
                kredit: hargaPerolehan
            });
            
            const transaksi = {
                id: Date.now() + 2,
                tanggal: tanggalPerolehan,
                nomorBukti: kode,
                keterangan: `Perolehan ${kelompok}: ${nama}`,
                detail: detailJurnal
            };
            
            dataTransaksi.push(transaksi);
        }
    }
    
    saveData();
    closeModal('modalAset');
    tampilkanDaftarAset();
    
    if (isEdit) {
        alert('✅ Data aset berhasil diperbarui!');
    } else {
        alert('✅ Aset tetap berhasil disimpan!');
    }
    
    // Refresh dashboard
    if (typeof hitungTotals === 'function') {
        hitungTotals();
    }
}

function editAset(id) {
    const aset = dataAset.find(a => a.id === id);
    if (!aset) return;
    
    currentAsetId = id;
    document.getElementById('judulModalAset').textContent = '✏️ Edit Aset Tetap';
    
    document.getElementById('kodeAset').value = aset.kode;
    document.getElementById('namaAset').value = aset.nama;
    document.getElementById('kelompokAset').value = aset.kelompok;
    document.getElementById('metodePenyusutan').value = aset.metode;
    document.getElementById('tanggalPerolehan').value = aset.tanggalPerolehan;
    document.getElementById('hargaPerolehan').value = aset.hargaPerolehan;
    document.getElementById('nilaiResidu').value = aset.nilaiResidu;
    document.getElementById('umurEkonomis').value = aset.umurEkonomis;
    document.getElementById('keteranganAset').value = aset.keterangan;
    
    document.getElementById('modalAset').style.display = 'block';
}

function hapusAset(id) {
    const aset = dataAset.find(a => a.id === id);
    if (!aset) return;
    
    if (!confirm(`Yakin ingin menghapus aset "${aset.nama}"?\n\n⚠️ PERHATIAN:\nRiwayat penyusutan aset ini juga akan hilang.`)) return;
    
    dataAset = dataAset.filter(a => a.id !== id);
    saveData();
    tampilkanDaftarAset();
    alert('✅ Aset berhasil dihapus!');
    
    // Refresh dashboard
    if (typeof hitungTotals === 'function') {
        hitungTotals();
    }
}

function hitungAkumulasiPenyusutan(aset) {
    const tanggalPerolehan = new Date(aset.tanggalPerolehan);
    const today = new Date();
    
    // Hitung jumlah bulan sejak perolehan
    const bulanBerjalan = (today.getFullYear() - tanggalPerolehan.getFullYear()) * 12 + 
                          (today.getMonth() - tanggalPerolehan.getMonth());
    
    if (bulanBerjalan <= 0) return 0;
    
    const nilaiYangDisusutkan = aset.hargaPerolehan - aset.nilaiResidu;
    
    if (aset.metode === 'garis-lurus') {
        // Metode Garis Lurus
        const penyusutanPerBulan = nilaiYangDisusutkan / (aset.umurEkonomis * 12);
        const totalPenyusutan = penyusutanPerBulan * bulanBerjalan;
        
        // Maksimal tidak boleh melebihi nilai yang dapat disusutkan
        return Math.min(totalPenyusutan, nilaiYangDisusutkan);
    } else {
        // Metode Saldo Menurun (Declining Balance) - 2x tarif garis lurus
        const tarifTahunan = (2 / aset.umurEkonomis);
        let nilaiSisa = aset.hargaPerolehan;
        let akumulasi = 0;
        
        const tahunBerjalan = Math.floor(bulanBerjalan / 12);
        const bulanSisa = bulanBerjalan % 12;
        
        // Hitung penyusutan per tahun
        for (let i = 0; i < tahunBerjalan; i++) {
            const penyusutanTahun = nilaiSisa * tarifTahunan;
            akumulasi += penyusutanTahun;
            nilaiSisa -= penyusutanTahun;
            
            // Stop jika sudah mencapai nilai residu
            if (nilaiSisa <= aset.nilaiResidu) {
                return aset.hargaPerolehan - aset.nilaiResidu;
            }
        }
        
        // Tambah penyusutan bulan berjalan (proporsional)
        if (bulanSisa > 0) {
            const penyusutanTahunIni = nilaiSisa * tarifTahunan;
            akumulasi += (penyusutanTahunIni / 12) * bulanSisa;
        }
        
        return Math.min(akumulasi, nilaiYangDisusutkan);
    }
}

function hitungPenyusutanBulanan() {
    if (dataAset.length === 0) {
        alert('Belum ada aset tetap yang terdaftar!');
        return;
    }
    
    const today = new Date();
    const bulanIni = today.getMonth() + 1;
    const tahunIni = today.getFullYear();
    const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                       'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][bulanIni - 1];
    
    let totalPenyusutan = 0;
    let detailPenyusutan = [];
    
    dataAset.forEach(aset => {
        const tanggalPerolehan = new Date(aset.tanggalPerolehan);
        
        // Cek apakah aset sudah dimiliki bulan ini
        if (tanggalPerolehan <= today) {
            const nilaiYangDisusutkan = aset.hargaPerolehan - aset.nilaiResidu;
            const akumulasiSekarang = hitungAkumulasiPenyusutan(aset);
            
            // Cek apakah masih bisa disusutkan
            if (akumulasiSekarang < nilaiYangDisusutkan) {
                let penyusutanBulanIni = 0;
                
                if (aset.metode === 'garis-lurus') {
                    penyusutanBulanIni = nilaiYangDisusutkan / (aset.umurEkonomis * 12);
                } else {
                    // Saldo menurun
                    const tarifTahunan = 2 / aset.umurEkonomis;
                    const nilaiBuku = aset.hargaPerolehan - akumulasiSekarang;
                    penyusutanBulanIni = (nilaiBuku * tarifTahunan) / 12;
                }
                
                // Pastikan tidak melebihi sisa yang bisa disusutkan
                const sisaBisaDisusutkan = nilaiYangDisusutkan - akumulasiSekarang;
                penyusutanBulanIni = Math.min(penyusutanBulanIni, sisaBisaDisusutkan);
                
                if (penyusutanBulanIni > 0) {
                    totalPenyusutan += penyusutanBulanIni;
                    detailPenyusutan.push({
                        aset: aset,
                        penyusutan: penyusutanBulanIni
                    });
                }
            }
        }
    });
    
    if (totalPenyusutan === 0) {
        alert('Tidak ada penyusutan yang perlu dicatat untuk bulan ini.');
        return;
    }
    
    // Tampilkan detail
    let detailText = `Penyusutan ${namaBulan} ${tahunIni}:\n\n`;
    detailPenyusutan.forEach(item => {
        detailText += `• ${item.aset.nama}: ${formatRupiah(item.penyusutan)}\n`;
    });
    detailText += `\nTotal: ${formatRupiah(totalPenyusutan)}\n\nCatat ke jurnal akuntansi?`;
    
    if (!confirm(detailText)) return;
    
    // INTEGRASI AKUNTANSI: Catat jurnal penyusutan
    const detailJurnal = [];
    
    // Debit: Beban Penyusutan
    detailJurnal.push({
        akun: '5-1600', // Beban Penyusutan
        debit: totalPenyusutan,
        kredit: 0
    });
    
    // Kredit: Akumulasi Penyusutan (sesuai kelompok aset)
    // Group by kelompok untuk efisiensi
    const groupByKelompok = {};
    detailPenyusutan.forEach(item => {
        const kelompok = item.aset.kelompok;
        if (!groupByKelompok[kelompok]) {
            groupByKelompok[kelompok] = 0;
        }
        groupByKelompok[kelompok] += item.penyusutan;
    });
    
    Object.keys(groupByKelompok).forEach(kelompok => {
        let kodeAkunAkumulasi = '1-2100'; // Default: Akumulasi Penyusutan Peralatan
        if (kelompok === 'Bangunan') kodeAkunAkumulasi = '1-2300';
        else if (kelompok === 'Kendaraan') kodeAkunAkumulasi = '1-2500';
        
        detailJurnal.push({
            akun: kodeAkunAkumulasi,
            debit: 0,
            kredit: groupByKelompok[kelompok]
        });
    });
    
    const transaksi = {
        id: Date.now() + 3,
        tanggal: today.toISOString().split('T')[0],
        nomorBukti: `DEP-${tahunIni}${String(bulanIni).padStart(2, '0')}`,
        keterangan: `Penyusutan aset tetap bulan ${namaBulan} ${tahunIni}`,
        detail: detailJurnal
    };
    
    dataTransaksi.push(transaksi);
    saveData();
    
    alert(`✅ Penyusutan berhasil dicatat!\n\n📝 Jurnal:\n- Debit: Beban Penyusutan ${formatRupiah(totalPenyusutan)}\n- Kredit: Akumulasi Penyusutan ${formatRupiah(totalPenyusutan)}`);
    
    // Refresh dashboard
    if (typeof hitungTotals === 'function') {
        hitungTotals();
    }
}

function tampilkanRekapPenyusutan() {
    document.getElementById('tahunRekap').value = new Date().getFullYear();
    document.getElementById('modalRekapPenyusutan').style.display = 'block';
    generateRekapPenyusutan();
}

function generateRekapPenyusutan() {
    const tbody = document.getElementById('bodyRekapPenyusutan');
    const periode = document.getElementById('periodeRekap').value;
    const tahun = parseInt(document.getElementById('tahunRekap').value);
    
    if (dataAset.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 40px; color: #9ca3af;">Belum ada aset tetap.</td></tr>';
        return;
    }
    
    let html = '';
    let totalHargaPerolehan = 0;
    let totalAkumulasiLalu = 0;
    let totalPenyusutanPeriode = 0;
    let totalAkumulasiSekarang = 0;
    let totalNilaiBuku = 0;
    
    dataAset.forEach(aset => {
        const tanggalPerolehan = new Date(aset.tanggalPerolehan);
        const hargaPerolehan = aset.hargaPerolehan;
        const nilaiYangDisusutkan = hargaPerolehan - aset.nilaiResidu;
        
        // Hitung akumulasi sampai periode sebelumnya
        let akumulasiLalu = 0;
        let penyusutanPeriode = 0;
        
        if (periode === 'bulanan') {
            // Hitung untuk bulan berjalan
            const bulanSekarang = new Date().getMonth();
            const tahunSekarang = new Date().getFullYear();
            
            if (tahunSekarang === tahun) {
                // Akumulasi sampai bulan lalu
                const targetDate = new Date(tahun, bulanSekarang - 1, 1);
                akumulasiLalu = hitungAkumulasiSampaiTanggal(aset, targetDate);
                
                // Akumulasi sampai bulan ini
                const akumulasiSekarang = hitungAkumulasiPenyusutan(aset);
                penyusutanPeriode = akumulasiSekarang - akumulasiLalu;
            }
        } else if (periode === 'tahunan') {
            // Akumulasi sampai akhir tahun lalu
            const targetDate = new Date(tahun - 1, 11, 31);
            akumulasiLalu = hitungAkumulasiSampaiTanggal(aset, targetDate);
            
            // Akumulasi sampai akhir tahun ini
            const targetDateSekarang = new Date(tahun, 11, 31);
            const akumulasiSekarang = hitungAkumulasiSampaiTanggal(aset, targetDateSekarang);
            penyusutanPeriode = akumulasiSekarang - akumulasiLalu;
        } else {
            // Keseluruhan
            akumulasiLalu = 0;
            penyusutanPeriode = hitungAkumulasiPenyusutan(aset);
        }
        
        const akumulasiSekarang = akumulasiLalu + penyusutanPeriode;
        const nilaiBuku = hargaPerolehan - akumulasiSekarang;
        
        totalHargaPerolehan += hargaPerolehan;
        totalAkumulasiLalu += akumulasiLalu;
        totalPenyusutanPeriode += penyusutanPeriode;
        totalAkumulasiSekarang += akumulasiSekarang;
        totalNilaiBuku += nilaiBuku;
        
        html += `<tr>
            <td>${aset.nama}</td>
            <td>${aset.kelompok}</td>
            <td class="text-right">${formatRupiah(hargaPerolehan)}</td>
            <td class="text-right">${formatRupiah(akumulasiLalu)}</td>
            <td class="text-right">${formatRupiah(penyusutanPeriode)}</td>
            <td class="text-right">${formatRupiah(akumulasiSekarang)}</td>
            <td class="text-right"><strong>${formatRupiah(nilaiBuku)}</strong></td>
        </tr>`;
    });
    
    html += `<tr style="background: var(--light-color); font-weight: 700; border-top: 3px solid var(--primary-color);">
        <td colspan="2">TOTAL</td>
        <td class="text-right">${formatRupiah(totalHargaPerolehan)}</td>
        <td class="text-right">${formatRupiah(totalAkumulasiLalu)}</td>
        <td class="text-right">${formatRupiah(totalPenyusutanPeriode)}</td>
        <td class="text-right">${formatRupiah(totalAkumulasiSekarang)}</td>
        <td class="text-right">${formatRupiah(totalNilaiBuku)}</td>
    </tr>`;
    
    tbody.innerHTML = html;
}

function hitungAkumulasiSampaiTanggal(aset, targetDate) {
    const tanggalPerolehan = new Date(aset.tanggalPerolehan);
    
    if (targetDate < tanggalPerolehan) return 0;
    
    // Hitung jumlah bulan
    const bulanBerjalan = (targetDate.getFullYear() - tanggalPerolehan.getFullYear()) * 12 + 
                          (targetDate.getMonth() - tanggalPerolehan.getMonth());
    
    if (bulanBerjalan <= 0) return 0;
    
    const nilaiYangDisusutkan = aset.hargaPerolehan - aset.nilaiResidu;
    
    if (aset.metode === 'garis-lurus') {
        const penyusutanPerBulan = nilaiYangDisusutkan / (aset.umurEkonomis * 12);
        const totalPenyusutan = penyusutanPerBulan * bulanBerjalan;
        return Math.min(totalPenyusutan, nilaiYangDisusutkan);
    } else {
        // Metode Saldo Menurun
        const tarifTahunan = 2 / aset.umurEkonomis;
        let nilaiSisa = aset.hargaPerolehan;
        let akumulasi = 0;
        
        const tahunBerjalan = Math.floor(bulanBerjalan / 12);
        const bulanSisa = bulanBerjalan % 12;
        
        for (let i = 0; i < tahunBerjalan; i++) {
            const penyusutanTahun = nilaiSisa * tarifTahunan;
            akumulasi += penyusutanTahun;
            nilaiSisa -= penyusutanTahun;
            
            if (nilaiSisa <= aset.nilaiResidu) {
                return aset.hargaPerolehan - aset.nilaiResidu;
            }
        }
        
        if (bulanSisa > 0) {
            const penyusutanTahunIni = nilaiSisa * tarifTahunan;
            akumulasi += (penyusutanTahunIni / 12) * bulanSisa;
        }
        
        return Math.min(akumulasi, nilaiYangDisusutkan);
    }
}

function exportRekapPenyusutan() {
    alert('Fitur export Excel sedang dalam pengembangan.\n\nUntuk saat ini, gunakan Print/Screenshot untuk laporan ini.');
}

// ===== INVOICE PEMBELIAN (PURCHASE INVOICE) =====
function tampilkanDaftarPembelian() {
    const tbody = document.getElementById('bodyDaftarPembelian');
    
    if (dataPembelian.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center" style="padding: 40px; color: #9ca3af;">Belum ada invoice pembelian. Klik "Buat Invoice Pembelian" untuk memulai.</td></tr>';
        return;
    }
    
    // Sort by date descending
    const sorted = [...dataPembelian].sort((a, b) => new Date(b.tanggal) - new Date(a.tanggal));
    
    let html = '';
    sorted.forEach(pembelian => {
        const statusClass = pembelian.status === 'Lunas' ? 'status-lunas' : 
                           pembelian.status === 'Overdue' ? 'status-overdue' : 'status-belum';
        
        html += `<tr>
            <td>${pembelian.nomor}</td>
            <td>${formatTanggal(pembelian.tanggal)}</td>
            <td>${pembelian.supplier.nama}</td>
            <td class="text-right">${formatRupiah(pembelian.subtotal)}</td>
            <td class="text-right">${formatRupiah(pembelian.ppn)}</td>
            <td class="text-right"><strong>${formatRupiah(pembelian.total)}</strong></td>
            <td><span class="status-badge ${statusClass}">${pembelian.status}</span></td>
            <td class="text-center">
                <div class="btn-group">
                    <button class="btn btn-primary btn-small" onclick="lihatPembelian(${pembelian.id})" title="Lihat/Cetak">👁️</button>
                    <button class="btn btn-warning btn-small" onclick="editPembelian(${pembelian.id})" title="Edit">✏️</button>
                    <button class="btn btn-danger btn-small" onclick="hapusPembelian(${pembelian.id})" title="Hapus">🗑️</button>
                </div>
            </td>
        </tr>`;
    });
    
    tbody.innerHTML = html;
}

function buatPembelianBaru() {
    currentPembelianId = null;
    document.getElementById('judulModalPembelian').textContent = '🛒 Buat Invoice Pembelian Baru';
    document.getElementById('formPembelian').reset();
    
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('tanggalPembelian').value = today;
    
    // Generate nomor pembelian otomatis
    const lastPembelian = dataPembelian.length > 0 ? dataPembelian[dataPembelian.length - 1].nomor : 'PO-000';
    const lastNumber = parseInt(lastPembelian.split('-')[1]) || 0;
    document.getElementById('nomorPembelian').value = `PO-${String(lastNumber + 1).padStart(3, '0')}`;
    
    // Reset items
    document.getElementById('pembelianItems').innerHTML = '';
    tambahItemPembelian();
    tambahItemPembelian();
    
    hitungTotalPembelian();
    document.getElementById('modalPembelian').style.display = 'block';
}

function tambahItemPembelian() {
    const container = document.getElementById('pembelianItems');
    const itemDiv = document.createElement('div');
    itemDiv.className = 'form-row';
    itemDiv.style.cssText = 'margin-bottom: 15px; padding: 15px; background: var(--light-color); border-radius: 8px;';
    
    itemDiv.innerHTML = `
        <div class="form-group" style="flex: 2; margin-bottom: 0;">
            <label>Deskripsi *</label>
            <input type="text" class="form-control pembelian-item-deskripsi" required placeholder="Bahan baku, Perlengkapan, dll">
        </div>
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label>Qty *</label>
            <input type="number" class="form-control pembelian-item-qty" min="1" value="1" required>
        </div>
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label>Harga Satuan *</label>
            <input type="number" class="form-control pembelian-item-harga" min="0" step="0.01" required placeholder="0">
        </div>
        <div class="form-group" style="flex: 1; margin-bottom: 0;">
            <label>Subtotal</label>
            <input type="text" class="form-control pembelian-item-subtotal" readonly style="background: #f3f4f6;">
        </div>
    `;
    
    container.appendChild(itemDiv);
    
    // Add event listeners
    itemDiv.querySelector('.pembelian-item-qty').addEventListener('input', hitungTotalPembelian);
    itemDiv.querySelector('.pembelian-item-harga').addEventListener('input', hitungTotalPembelian);
}

function hapusItemPembelian() {
    const items = document.querySelectorAll('#pembelianItems .form-row');
    if (items.length > 1) {
        items[items.length - 1].remove();
        hitungTotalPembelian();
    } else {
        alert('Minimal harus ada 1 item!');
    }
}

function hitungTotalPembelian() {
    let subtotal = 0;
    
    const items = document.querySelectorAll('#pembelianItems .form-row');
    items.forEach(item => {
        const qty = parseFloat(item.querySelector('.pembelian-item-qty').value) || 0;
        const harga = parseFloat(item.querySelector('.pembelian-item-harga').value) || 0;
        const itemSubtotal = qty * harga;
        
        item.querySelector('.pembelian-item-subtotal').value = formatRupiah(itemSubtotal);
        subtotal += itemSubtotal;
    });
    
    const includePPN = document.getElementById('includePPNPembelian').value === 'true';
    const ppn = includePPN ? subtotal * 0.11 : 0;
    const total = subtotal + ppn;
    
    document.getElementById('pembelianSubtotal').textContent = formatRupiah(subtotal);
    document.getElementById('pembelianPPN').textContent = formatRupiah(ppn);
    document.getElementById('pembelianTotal').textContent = formatRupiah(total);
}

function simpanPembelian(event) {
    event.preventDefault();
    
    const id = currentPembelianId || Date.now();
    const nomor = document.getElementById('nomorPembelian').value;
    const tanggal = document.getElementById('tanggalPembelian').value;
    const jatuhTempo = document.getElementById('jatuhTempoPembelian').value;
    
    const supplier = {
        nama: document.getElementById('namaSupplier').value,
        telp: document.getElementById('telpSupplier').value,
        alamat: document.getElementById('alamatSupplier').value
    };
    
    // Ambil items
    const items = [];
    document.querySelectorAll('#pembelianItems .form-row').forEach(itemDiv => {
        const deskripsi = itemDiv.querySelector('.pembelian-item-deskripsi').value;
        const qty = parseFloat(itemDiv.querySelector('.pembelian-item-qty').value);
        const harga = parseFloat(itemDiv.querySelector('.pembelian-item-harga').value);
        
        if (deskripsi && qty > 0 && harga >= 0) {
            items.push({
                deskripsi: deskripsi,
                qty: qty,
                harga: harga,
                subtotal: qty * harga
            });
        }
    });
    
    if (items.length === 0) {
        alert('Minimal harus ada 1 item pembelian!');
        return;
    }
    
    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const includePPN = document.getElementById('includePPNPembelian').value === 'true';
    const ppn = includePPN ? subtotal * 0.11 : 0;
    const total = subtotal + ppn;
    
    const pembelian = {
        id: id,
        nomor: nomor,
        tanggal: tanggal,
        jatuhTempo: jatuhTempo,
        supplier: supplier,
        items: items,
        subtotal: subtotal,
        ppn: ppn,
        total: total,
        catatan: document.getElementById('catatanPembelian').value,
        status: 'Belum Lunas',
        createdAt: currentPembelianId ? dataPembelian.find(p => p.id === id).createdAt : new Date().toISOString()
    };
    
    const isEdit = currentPembelianId !== null;
    
    if (currentPembelianId) {
        // Update existing
        const index = dataPembelian.findIndex(p => p.id === id);
        dataPembelian[index] = pembelian;
    } else {
        // Add new
        dataPembelian.push(pembelian);
        
        // INTEGRASI AKUNTANSI: Catat hutang dan pembelian
        const detailJurnal = [];
        
        // Debit: Pembelian/Persediaan/Beban
        detailJurnal.push({
            akun: '1-1200', // Persediaan Barang (bisa disesuaikan)
            debit: subtotal,
            kredit: 0
        });
        
        // Debit: PPN Masukan (jika ada PPN)
        if (ppn > 0) {
            detailJurnal.push({
                akun: '1-1600', // PPN Masukan (perlu ditambahkan di chart of accounts)
                debit: ppn,
                kredit: 0
            });
        }
        
        // Kredit: Hutang Usaha
        detailJurnal.push({
            akun: '2-1000', // Hutang Usaha
            debit: 0,
            kredit: total
        });
        
        const transaksi = {
            id: Date.now() + 1,
            tanggal: tanggal,
            nomorBukti: nomor,
            keterangan: `Pembelian ${nomor} - ${supplier.nama}${items.length > 0 ? ' (' + items[0].deskripsi + (items.length > 1 ? ', dll' : '') + ')' : ''}`,
            detail: detailJurnal
        };
        
        dataTransaksi.push(transaksi);
    }
    
    saveData();
    closeModal('modalPembelian');
    tampilkanDaftarPembelian();
    
    if (isEdit) {
        alert('Invoice pembelian berhasil diperbarui!');
    } else {
        alert('✅ Invoice pembelian berhasil disimpan!\n\n📝 Jurnal akuntansi telah dicatat:\n- Debit: Persediaan/Pembelian ' + formatRupiah(subtotal) + (ppn > 0 ? '\n- Debit: PPN Masukan ' + formatRupiah(ppn) : '') + '\n- Kredit: Hutang Usaha ' + formatRupiah(total));
    }
    
    // Refresh dashboard
    if (typeof hitungTotals === 'function') {
        hitungTotals();
    }
}

function editPembelian(id) {
    const pembelian = dataPembelian.find(p => p.id === id);
    if (!pembelian) return;
    
    currentPembelianId = id;
    document.getElementById('judulModalPembelian').textContent = '✏️ Edit Invoice Pembelian';
    
    document.getElementById('nomorPembelian').value = pembelian.nomor;
    document.getElementById('tanggalPembelian').value = pembelian.tanggal;
    document.getElementById('jatuhTempoPembelian').value = pembelian.jatuhTempo;
    document.getElementById('namaSupplier').value = pembelian.supplier.nama;
    document.getElementById('telpSupplier').value = pembelian.supplier.telp;
    document.getElementById('alamatSupplier').value = pembelian.supplier.alamat;
    document.getElementById('catatanPembelian').value = pembelian.catatan;
    document.getElementById('includePPNPembelian').value = pembelian.ppn > 0 ? 'true' : 'false';
    
    // Load items
    document.getElementById('pembelianItems').innerHTML = '';
    pembelian.items.forEach(item => {
        tambahItemPembelian();
        const lastItem = document.querySelector('#pembelianItems .form-row:last-child');
        lastItem.querySelector('.pembelian-item-deskripsi').value = item.deskripsi;
        lastItem.querySelector('.pembelian-item-qty').value = item.qty;
        lastItem.querySelector('.pembelian-item-harga').value = item.harga;
    });
    
    hitungTotalPembelian();
    document.getElementById('modalPembelian').style.display = 'block';
}

function hapusPembelian(id) {
    const pembelian = dataPembelian.find(p => p.id === id);
    if (!pembelian) return;
    
    if (pembelian.status === 'Lunas') {
        alert('❌ Invoice pembelian yang sudah lunas tidak dapat dihapus!\n\nUntuk membatalkan, gunakan fitur jurnal koreksi di tab Transaksi.');
        return;
    }
    
    if (!confirm(`Yakin ingin menghapus invoice pembelian ${pembelian.nomor}?\n\n⚠️ PERHATIAN:\nTransaksi hutang terkait juga akan dihapus dari jurnal akuntansi.`)) return;
    
    // Hapus transaksi terkait
    const transaksiTerkait = dataTransaksi.filter(t => t.nomorBukti === pembelian.nomor);
    if (transaksiTerkait.length > 0) {
        dataTransaksi = dataTransaksi.filter(t => t.nomorBukti !== pembelian.nomor);
    }
    
    dataPembelian = dataPembelian.filter(p => p.id !== id);
    saveData();
    tampilkanDaftarPembelian();
    
    if (transaksiTerkait.length > 0) {
        alert('✅ Invoice pembelian dan transaksi akuntansi terkait berhasil dihapus!');
    } else {
        alert('✅ Invoice pembelian berhasil dihapus!');
    }
    
    // Refresh dashboard
    if (typeof hitungTotals === 'function') {
        hitungTotals();
    }
}

function lihatPembelian(id) {
    const pembelian = dataPembelian.find(p => p.id === id);
    if (!pembelian) return;
    
    currentPembelianId = id;
    
    // Generate invoice HTML
    const pembelianHTML = generatePembelianHTML(pembelian);
    document.getElementById('previewPembelian').innerHTML = pembelianHTML;
    document.getElementById('modalCetakPembelian').style.display = 'block';
}

function generatePembelianHTML(pembelian) {
    // Load identitas perusahaan
    const perusahaan = identitasWP.nama || 'NAMA PERUSAHAAN';
    const alamatPerusahaan = identitasWP.alamat || 'Alamat Perusahaan';
    const npwp = identitasWP.npwp || '';
    
    let itemsHTML = '';
    pembelian.items.forEach((item, index) => {
        itemsHTML += `
            <tr>
                <td class="text-center">${index + 1}</td>
                <td>${item.deskripsi}</td>
                <td class="text-center">${item.qty}</td>
                <td class="text-right">${formatRupiah(item.harga)}</td>
                <td class="text-right">${formatRupiah(item.subtotal)}</td>
            </tr>
        `;
    });
    
    return `
        <div class="invoice-container">
            <div class="invoice-header">
                <div class="company-info">
                    <h2>${perusahaan}</h2>
                    <p>${alamatPerusahaan}</p>
                    ${npwp ? `<p>NPWP: ${npwp}</p>` : ''}
                </div>
                <div class="invoice-title">
                    <h1>PURCHASE ORDER</h1>
                    <p style="margin: 0; color: #6b7280;">${pembelian.nomor}</p>
                </div>
            </div>

            <div class="invoice-details">
                <div class="detail-box">
                    <h4>Kepada:</h4>
                    <p><strong>${pembelian.supplier.nama}</strong></p>
                    <p>${pembelian.supplier.alamat || '-'}</p>
                    ${pembelian.supplier.telp ? `<p>Telp: ${pembelian.supplier.telp}</p>` : ''}
                </div>
                <div class="detail-box" style="text-align: right;">
                    <p><strong>Tanggal:</strong> ${formatTanggal(pembelian.tanggal)}</p>
                    ${pembelian.jatuhTempo ? `<p><strong>Jatuh Tempo:</strong> ${formatTanggal(pembelian.jatuhTempo)}</p>` : ''}
                    <p><strong>Status:</strong> <span class="status-badge ${pembelian.status === 'Lunas' ? 'status-lunas' : 'status-belum'}">${pembelian.status}</span></p>
                </div>
            </div>

            <table class="invoice-table">
                <thead>
                    <tr>
                        <th style="width: 50px;">No</th>
                        <th>Deskripsi</th>
                        <th style="width: 80px;" class="text-center">Qty</th>
                        <th style="width: 150px;" class="text-right">Harga Satuan</th>
                        <th style="width: 150px;" class="text-right">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHTML}
                </tbody>
            </table>

            <div class="invoice-summary">
                <table>
                    <tr>
                        <td><strong>Subtotal:</strong></td>
                        <td class="text-right">${formatRupiah(pembelian.subtotal)}</td>
                    </tr>
                    ${pembelian.ppn > 0 ? `
                    <tr>
                        <td><strong>PPN (11%):</strong></td>
                        <td class="text-right">${formatRupiah(pembelian.ppn)}</td>
                    </tr>
                    ` : ''}
                    <tr class="total-row">
                        <td><strong>TOTAL:</strong></td>
                        <td class="text-right"><strong>${formatRupiah(pembelian.total)}</strong></td>
                    </tr>
                </table>
            </div>

            ${pembelian.catatan ? `
            <div style="margin-top: 20px; padding: 15px; background: var(--light-color); border-radius: 8px;">
                <strong>Catatan:</strong><br>
                ${pembelian.catatan}
            </div>
            ` : ''}

            <div class="signature-box">
                <div>
                    <p style="margin-bottom: 10px;">Menyetujui,</p>
                    <div class="signature-line">
                        <p style="margin: 0; font-weight: 600;">${perusahaan}</p>
                    </div>
                </div>
                <div>
                    <p style="margin-bottom: 10px;">Supplier,</p>
                    <div class="signature-line">
                        <p style="margin: 0; font-weight: 600;">${pembelian.supplier.nama}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function cetakPembelian() {
    window.print();
}

function downloadPembelianPDF() {
    alert('Fitur download PDF sedang dalam pengembangan.\n\nUntuk saat ini, gunakan Print (Ctrl+P) dan pilih "Save as PDF".');
}

function ubahStatusPembelian() {
    if (!currentPembelianId) return;
    
    const pembelian = dataPembelian.find(p => p.id === currentPembelianId);
    if (!pembelian) return;
    
    const statusBaru = prompt(`Status saat ini: ${pembelian.status}\n\nPilih status baru:\n1. Belum Lunas\n2. Lunas\n3. Overdue\n\nMasukkan pilihan (1-3):`, '1');
    
    if (!statusBaru) return;
    
    const statusMap = {
        '1': 'Belum Lunas',
        '2': 'Lunas',
        '3': 'Overdue'
    };
    
    const newStatus = statusMap[statusBaru];
    if (!newStatus) {
        alert('Pilihan tidak valid!');
        return;
    }
    
    pembelian.status = newStatus;
    
    // Jika lunas, catat pembayaran ke transaksi
    if (newStatus === 'Lunas' && pembelian.status !== 'Lunas') {
        const konfirmasi = confirm('Invoice pembelian akan ditandai Lunas.\n\nApakah ingin mencatat pembayaran ke jurnal akuntansi?');
        
        if (konfirmasi) {
            // Catat pembayaran
            const detailPembayaran = [];
            
            // Debit: Hutang Usaha
            detailPembayaran.push({
                akun: '2-1000', // Hutang Usaha
                debit: pembelian.total,
                kredit: 0
            });
            
            // Kredit: Kas/Bank
            detailPembayaran.push({
                akun: '1-1100', // Kas/Bank
                debit: 0,
                kredit: pembelian.total
            });
            
            const transaksi = {
                id: Date.now(),
                tanggal: new Date().toISOString().split('T')[0],
                nomorBukti: pembelian.nomor + '-PMT',
                keterangan: `Pembayaran invoice pembelian ${pembelian.nomor} ke ${pembelian.supplier.nama}`,
                detail: detailPembayaran
            };
            
            dataTransaksi.push(transaksi);
            
            alert('✅ Pembayaran berhasil dicatat!\n\n📝 Jurnal akuntansi:\n- Debit: Hutang Usaha ' + formatRupiah(pembelian.total) + '\n- Kredit: Kas/Bank ' + formatRupiah(pembelian.total));
        }
    }
    
    saveData();
    
    // Refresh tampilan
    const updatedPembelian = dataPembelian.find(p => p.id === currentPembelianId);
    document.getElementById('previewPembelian').innerHTML = generatePembelianHTML(updatedPembelian);
    tampilkanDaftarPembelian();
    
    alert(`Status invoice pembelian berhasil diubah menjadi: ${newStatus}`);
}

function exportPembelianExcel() {
    alert('Fitur export Excel sedang dalam pengembangan.\n\nUntuk saat ini, gunakan Print untuk setiap invoice.');
}

// ===== PRINT OPTIMIZATION =====
window.addEventListener('beforeprint', function() {
    document.body.classList.add('printing');
});

window.addEventListener('afterprint', function() {
    document.body.classList.remove('printing');
});
