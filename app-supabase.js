// =====================================================
// APLIKASI AKUNTANSI & PERPAJAKAN 2026 - SUPABASE VERSION
// File ini MENGGANTIKAN app.js yang lama
// Rename file ini menjadi app.js atau update referensi di index.html
// =====================================================

// Global Variables
let currentUser = null;
let allAccounts = [];
let allTransactions = [];

// =====================================================
// INITIALIZATION
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Initializing application...');
    
    // Check if user is logged in
    const savedUser = localStorage.getItem('currentUser');
    
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showMainApp();
        await loadInitialData();
    } else {
        showLoginPage();
    }

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    const dateInputs = document.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        if (!input.value) input.value = today;
    });
    
    // Setup event listeners
    setupEventListeners();
});

function setupEventListeners() {
    // Auto calculate totals when inputs change
    document.addEventListener('input', (e) => {
        if (e.target.classList.contains('debit-input') || e.target.classList.contains('kredit-input')) {
            hitungTotal();
        }
    });
}

// =====================================================
// AUTHENTICATION
// =====================================================

async function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    if (!username || !password) {
        showNotification('Username dan password harus diisi!', 'warning');
        return;
    }
    
    showLoading('Memverifikasi...');
    
    const result = await UserService.login(username, password);
    
    hideLoading();
    
    if (result.success) {
        currentUser = result.data;
        showNotification('Login berhasil! Selamat datang ' + currentUser.full_name, 'success');
        showMainApp();
        await loadInitialData();
    } else {
        showNotification(result.message || 'Login gagal!', 'error');
    }
}

async function handleRegister(event) {
    event.preventDefault();
    
    const username = document.getElementById('regUsername').value;
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const fullName = document.getElementById('regFullName').value;
    const email = document.getElementById('regEmail').value;
    
    // Validation
    if (!username || !password || !fullName) {
        showNotification('Semua field wajib diisi!', 'warning');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Password tidak cocok!', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password minimal 6 karakter!', 'error');
        return;
    }
    
    showLoading('Mendaftarkan akun...');
    
    const result = await UserService.register({
        username: username,
        password: password,
        fullName: fullName,
        email: email
    });
    
    hideLoading();
    
    if (result.success) {
        showNotification('Registrasi berhasil! Silakan login.', 'success');
        showLoginForm();
        document.getElementById('formRegister').reset();
    } else {
        showNotification(result.message || 'Registrasi gagal!', 'error');
    }
}

function logout() {
    if (confirm('Anda yakin ingin keluar?')) {
        if (currentUser) {
            AuditService.log(currentUser.id, 'LOGOUT', 'users', currentUser.id);
        }
        localStorage.removeItem('currentUser');
        currentUser = null;
        showLoginPage();
        showNotification('Anda telah keluar', 'info');
    }
}

function showLoginPage() {
    document.body.classList.add('login-page');
    const loginContainer = document.querySelector('.login-container');
    const mainContainer = document.querySelector('.container');
    if (loginContainer) loginContainer.style.display = 'block';
    if (mainContainer) mainContainer.style.display = 'none';
}

function showMainApp() {
    document.body.classList.remove('login-page');
    const loginContainer = document.querySelector('.login-container');
    const mainContainer = document.querySelector('.container');
    if (loginContainer) loginContainer.style.display = 'none';
    if (mainContainer) mainContainer.style.display = 'block';
    
    // Update user info in header
    updateUserInfo();
    
    // Show first tab
    openTab('dashboard');
}

function updateUserInfo() {
    if (!currentUser) return;
    
    const userAvatar = document.querySelector('.user-avatar');
    const userName = document.querySelector('.user-name');
    const userRole = document.querySelector('.user-role');
    
    if (userAvatar) userAvatar.textContent = currentUser.full_name.charAt(0).toUpperCase();
    if (userName) userName.textContent = currentUser.full_name;
    if (userRole) userRole.textContent = currentUser.role === 'admin' ? 'Administrator' : 'User';
}

function showLoginForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
}

function showRegisterForm() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'block';
}

// =====================================================
// LOAD DATA FROM DATABASE
// =====================================================

async function loadInitialData() {
    showLoading('Memuat data dari database...');
    
    try {
        // Load Chart of Accounts
        const coaResult = await COAService.getAll();
        if (coaResult.success) {
            allAccounts = coaResult.data;
            console.log(`✅ Loaded ${allAccounts.length} accounts`);
            populateAccountSelects();
        } else {
            throw new Error('Gagal memuat Chart of Accounts');
        }
        
        // Load Transactions
        await loadTransactions();
        
        // Load Company Info
        await loadCompanyInfo();
        
        // Update all reports
        updateAllReports();
        
        // Update dashboard
        updateDashboard();
        
        hideLoading();
        console.log('✅ Data loaded successfully');
    } catch (error) {
        console.error('Error loading data:', error);
        hideLoading();
        showNotification('Gagal memuat data: ' + error.message, 'error');
    }
}

async function loadTransactions() {
    const result = await TransactionService.getAll();
    if (result.success) {
        allTransactions = result.data;
        console.log(`✅ Loaded ${allTransactions.length} transactions`);
    } else {
        console.error('Failed to load transactions:', result.message);
    }
}

async function loadCompanyInfo() {
    const result = await CompanyService.getInfo();
    if (result.success && result.data) {
        const info = result.data;
        const npwpInput = document.getElementById('npwpBadan');
        const nameInput = document.getElementById('namaWP');
        const addressInput = document.getElementById('alamatWP');
        const businessInput = document.getElementById('jenisUsaha');
        
        if (npwpInput && info.npwp) npwpInput.value = info.npwp;
        if (nameInput && info.company_name) nameInput.value = info.company_name;
        if (addressInput && info.address) addressInput.value = info.address;
        if (businessInput && info.business_type) businessInput.value = info.business_type;
    }
}

function updateAllReports() {
    tampilkanJurnalUmum();
    tampilkanBukuBesar();
    tampilkanNeracaSaldo();
    tampilkanLabaRugi();
    tampilkanNeraca();
    tampilkanArusKas();
}

// =====================================================
// CHART OF ACCOUNTS (COA)
// =====================================================

function populateAccountSelects() {
    const selects = document.querySelectorAll('.akun-select');
    selects.forEach(select => {
        select.innerHTML = '<option value="">Pilih Akun</option>';
        allAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.code} - ${account.name}`;
            option.dataset.normalBalance = account.normal_balance;
            option.dataset.accountType = account.account_type;
            select.appendChild(option);
        });
    });
    
    // Populate filter select for Buku Besar
    const filterSelect = document.getElementById('filterAkun');
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="">Semua Akun</option>';
        allAccounts.forEach(account => {
            const option = document.createElement('option');
            option.value = account.id;
            option.textContent = `${account.code} - ${account.name}`;
            filterSelect.appendChild(option);
        });
    }
}

async function bukaModalTambahAkun() {
    openModal('modalTambahAkun');
    const form = document.getElementById('formTambahAkun');
    if (form) form.reset();
}

async function simpanAkun(event) {
    event.preventDefault();
    
    const accountData = {
        code: document.getElementById('kodeAkun').value,
        name: document.getElementById('namaAkun').value,
        account_type: document.getElementById('jenisAkun').value,
        normal_balance: document.getElementById('saldoNormal').value,
        description: document.getElementById('keteranganAkun').value || null
    };
    
    showLoading('Menyimpan akun...');
    
    const result = await COAService.create(accountData);
    
    hideLoading();
    
    if (result.success) {
        showNotification('Akun berhasil ditambahkan!', 'success');
        closeModal('modalTambahAkun');
        await loadInitialData();
    } else {
        showNotification(result.message || 'Gagal menyimpan akun', 'error');
    }
}

// =====================================================
// TRANSACTIONS
// =====================================================

function tambahBaris() {
    const container = document.getElementById('jurnalEntries');
    const templateEntry = container.querySelector('.jurnal-entry');
    
    if (!templateEntry) {
        console.error('Template entry not found');
        return;
    }
    
    const newEntry = templateEntry.cloneNode(true);
    
    // Reset values
    newEntry.querySelectorAll('input, select').forEach(input => {
        if (input.tagName === 'SELECT') {
            input.selectedIndex = 0;
        } else {
            input.value = '';
        }
    });
    
    container.appendChild(newEntry);
    populateAccountSelects();
    hitungTotal();
}

function hapusBaris() {
    const entries = document.querySelectorAll('.jurnal-entry');
    if (entries.length > 1) {
        entries[entries.length - 1].remove();
        hitungTotal();
    } else {
        showNotification('Minimal harus ada 1 baris jurnal', 'warning');
    }
}

function hitungTotal() {
    const entries = document.querySelectorAll('.jurnal-entry');
    let totalDebit = 0;
    let totalKredit = 0;
    
    entries.forEach(entry => {
        const debit = parseFloat(entry.querySelector('.debit-input').value) || 0;
        const kredit = parseFloat(entry.querySelector('.kredit-input').value) || 0;
        totalDebit += debit;
        totalKredit += kredit;
    });
    
    const totalDebitEl = document.getElementById('totalDebit');
    const totalKreditEl = document.getElementById('totalKredit');
    const selisihEl = document.getElementById('selisih');
    
    if (totalDebitEl) totalDebitEl.textContent = formatRupiah(totalDebit);
    if (totalKreditEl) totalKreditEl.textContent = formatRupiah(totalKredit);
    
    const selisih = totalDebit - totalKredit;
    
    if (selisihEl) {
        selisihEl.textContent = formatRupiah(Math.abs(selisih));
        
        if (Math.abs(selisih) < 0.01) {
            selisihEl.style.color = 'var(--success-color)';
        } else {
            selisihEl.style.color = 'var(--danger-color)';
        }
    }
}

async function simpanTransaksi(event) {
    event.preventDefault();
    
    const tanggal = document.getElementById('tanggalTransaksi').value;
    const nomorBukti = document.getElementById('nomorBukti').value;
    const keterangan = document.getElementById('keteranganTransaksi').value;
    
    if (!tanggal || !keterangan) {
        showNotification('Tanggal dan keterangan harus diisi!', 'warning');
        return;
    }
    
    const transactionData = {
        transaction_date: tanggal,
        voucher_number: nomorBukti || null,
        description: keterangan
    };
    
    // Collect journal entries
    const entries = [];
    document.querySelectorAll('.jurnal-entry').forEach(entry => {
        const accountId = entry.querySelector('.akun-select').value;
        const debit = parseFloat(entry.querySelector('.debit-input').value) || 0;
        const kredit = parseFloat(entry.querySelector('.kredit-input').value) || 0;
        
        if (accountId && (debit > 0 || kredit > 0)) {
            entries.push({
                account_id: accountId,
                debit: debit,
                credit: kredit
            });
        }
    });
    
    if (entries.length < 2) {
        showNotification('Minimal harus ada 2 akun dalam jurnal!', 'warning');
        return;
    }
    
    // Validate balance
    const totalDebit = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalKredit = entries.reduce((sum, e) => sum + e.credit, 0);
    
    if (Math.abs(totalDebit - totalKredit) > 0.01) {
        showNotification('Total Debit dan Kredit harus sama!', 'error');
        return;
    }
    
    showLoading('Menyimpan transaksi...');
    
    const result = await TransactionService.create(transactionData, entries);
    
    hideLoading();
    
    if (result.success) {
        showNotification('Transaksi berhasil disimpan!', 'success');
        
        // Reset form
        document.getElementById('formTransaksi').reset();
        resetJurnalEntries();
        
        // Reload data
        await loadTransactions();
        updateAllReports();
        updateDashboard();
    } else {
        showNotification(result.message || 'Gagal menyimpan transaksi', 'error');
    }
}

function resetJurnalEntries() {
    const container = document.getElementById('jurnalEntries');
    if (!container) return;
    
    container.innerHTML = `
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
    
    populateAccountSelects();
    hitungTotal();
}

async function hapusTransaksi(transactionId) {
    if (!confirm('Yakin ingin menghapus transaksi ini?')) return;
    
    showLoading('Menghapus transaksi...');
    
    const result = await TransactionService.delete(transactionId);
    
    hideLoading();
    
    if (result.success) {
        showNotification('Transaksi berhasil dihapus!', 'success');
        await loadTransactions();
        updateAllReports();
        updateDashboard();
    } else {
        showNotification(result.message || 'Gagal menghapus transaksi', 'error');
    }
}

// =====================================================
// REPORTS - JURNAL UMUM
// =====================================================

function tampilkanJurnalUmum() {
    const tbody = document.getElementById('bodyJurnal');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!allTransactions || allTransactions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center" style="padding: 30px;">Belum ada transaksi</td></tr>';
        return;
    }
    
    allTransactions.forEach(trans => {
        if (!trans.journal_entries || trans.journal_entries.length === 0) return;
        
        trans.journal_entries.forEach((entry, index) => {
            const row = tbody.insertRow();
            
            if (index === 0) {
                row.insertCell(0).textContent = formatTanggal(trans.transaction_date);
                row.insertCell(1).textContent = trans.voucher_number || '-';
                row.insertCell(2).textContent = trans.description;
            } else {
                row.insertCell(0).textContent = '';
                row.insertCell(1).textContent = '';
                row.insertCell(2).textContent = '';
            }
            
            const accountName = entry.coa ? `${entry.coa.code} - ${entry.coa.name}` : 'Unknown Account';
            row.insertCell(3).textContent = accountName;
            
            const debitCell = row.insertCell(4);
            debitCell.textContent = entry.debit > 0 ? formatRupiah(entry.debit) : '';
            debitCell.className = 'text-right';
            
            const creditCell = row.insertCell(5);
            creditCell.textContent = entry.credit > 0 ? formatRupiah(entry.credit) : '';
            creditCell.className = 'text-right';
            
            if (index === 0) {
                const actionsCell = row.insertCell(6);
                actionsCell.className = 'text-center';
                actionsCell.innerHTML = `
                    <button class="btn btn-small btn-danger" onclick="hapusTransaksi('${trans.id}')">🗑️</button>
                `;
                actionsCell.rowSpan = trans.journal_entries.length;
            }
        });
        
        // Add separator row
        const sepRow = tbody.insertRow();
        sepRow.style.height = '5px';
        sepRow.style.background = 'var(--light-color)';
        sepRow.innerHTML = '<td colspan="7"></td>';
    });
    
    // Update period display
    const periodeEl = document.getElementById('periodeJurnal');
    if (periodeEl && allTransactions.length > 0) {
        const dates = allTransactions.map(t => new Date(t.transaction_date));
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        periodeEl.textContent = `${formatTanggal(minDate)} s/d ${formatTanggal(maxDate)}`;
    }
}

// =====================================================
// REPORTS - BUKU BESAR  
// =====================================================

function tampilkanBukuBesar() {
    const container = document.getElementById('contentBukuBesar');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!allAccounts || allAccounts.length === 0) {
        container.innerHTML = '<p class="text-center" style="padding: 30px;">Belum ada data akun</p>';
        return;
    }
    
    const selectedAccountId = document.getElementById('filterAkun')?.value;
    const accountsToShow = selectedAccountId 
        ? allAccounts.filter(acc => acc.id === selectedAccountId)
        : allAccounts.filter(acc => acc.level === 3 || acc.level === 2);
    
    accountsToShow.forEach(account => {
        // Get entries for this account
        const entries = [];
        
        if (allTransactions) {
            allTransactions.forEach(trans => {
                if (trans.journal_entries) {
                    trans.journal_entries.forEach(entry => {
                        if (entry.account_id === account.id) {
                            entries.push({
                                date: trans.transaction_date,
                                voucher: trans.voucher_number,
                                description: trans.description,
                                debit: entry.debit || 0,
                                credit: entry.credit || 0
                            });
                        }
                    });
                }
            });
        }
        
        if (entries.length === 0 && !selectedAccountId) return;
        
        if (entries.length === 0 && selectedAccountId) {
            container.innerHTML += `
                <div class="card" style="margin-bottom: 20px;">
                    <h3>${account.code} - ${account.name}</h3>
                    <p class="text-center" style="padding: 20px;">Belum ada transaksi</p>
                </div>
            `;
            return;
        }
        
        // Sort by date
        entries.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Calculate running balance
        let balance = 0;
        const entriesWithBalance = entries.map(entry => {
            if (account.normal_balance === 'Debit') {
                balance += entry.debit - entry.credit;
            } else {
                balance += entry.credit - entry.debit;
            }
            return { ...entry, balance: balance };
        });
        
        // Create table HTML
        let html = `
            <div class="card" style="margin-bottom: 20px;">
                <h3>${account.code} - ${account.name}</h3>
                <p style="color: #6b7280; margin-bottom: 15px;">Saldo Normal: ${account.normal_balance}</p>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>No. Bukti</th>
                                <th>Keterangan</th>
                                <th class="text-right">Debit</th>
                                <th class="text-right">Kredit</th>
                                <th class="text-right">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        entriesWithBalance.forEach(entry => {
            html += `
                <tr>
                    <td>${formatTanggal(entry.date)}</td>
                    <td>${entry.voucher || '-'}</td>
                    <td>${entry.description}</td>
                    <td class="text-right">${entry.debit > 0 ? formatRupiah(entry.debit) : ''}</td>
                    <td class="text-right">${entry.credit > 0 ? formatRupiah(entry.credit) : ''}</td>
                    <td class="text-right"><strong>${formatRupiah(Math.abs(entry.balance))}</strong></td>
                </tr>
            `;
        });
        
        html += `
                        </tbody>
                        <tfoot>
                            <tr style="background: var(--light-color); font-weight: 700;">
                                <td colspan="5" class="text-right">SALDO AKHIR</td>
                                <td class="text-right">${formatRupiah(Math.abs(balance))}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        `;
        
        container.innerHTML += html;
    });
    
    // Update period
    const periodeEl = document.getElementById('periodeBukuBesar');
    if (periodeEl) {
        periodeEl.textContent = formatTanggal(new Date());
    }
}

// =====================================================
// REPORTS - NERACA SALDO
// =====================================================

function tampilkanNeracaSaldo() {
    const tbody = document.getElementById('bodyNeracaSaldo');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    let totalDebit = 0;
    let totalKredit = 0;
    
    allAccounts.forEach(account => {
        // Calculate balance for this account
        let debit = 0;
        let kredit = 0;
        
        if (allTransactions) {
            allTransactions.forEach(trans => {
                if (trans.journal_entries) {
                    trans.journal_entries.forEach(entry => {
                        if (entry.account_id === account.id) {
                            debit += entry.debit || 0;
                            kredit += entry.credit || 0;
                        }
                    });
                }
            });
        }
        
        // Only show accounts with balance
        if (debit === 0 && kredit === 0) return;
        
        const row = tbody.insertRow();
        row.insertCell(0).textContent = account.code;
        row.insertCell(1).textContent = account.name;
        
        const debitCell = row.insertCell(2);
        const kreditCell = row.insertCell(3);
        debitCell.className = 'text-right';
        kreditCell.className = 'text-right';
        
        if (account.normal_balance === 'Debit') {
            const balance = debit - kredit;
            if (balance >= 0) {
                debitCell.textContent = formatRupiah(balance);
                kreditCell.textContent = '';
                totalDebit += balance;
            } else {
                debitCell.textContent = '';
                kreditCell.textContent = formatRupiah(Math.abs(balance));
                totalKredit += Math.abs(balance);
            }
        } else {
            const balance = kredit - debit;
            if (balance >= 0) {
                debitCell.textContent = '';
                kreditCell.textContent = formatRupiah(balance);
                totalKredit += balance;
            } else {
                debitCell.textContent = formatRupiah(Math.abs(balance));
                kreditCell.textContent = '';
                totalDebit += Math.abs(balance);
            }
        }
    });
    
    // Update totals
    const totalDebitEl = document.getElementById('totalDebitNS');
    const totalKreditEl = document.getElementById('totalKreditNS');
    
    if (totalDebitEl) totalDebitEl.textContent = formatRupiah(totalDebit);
    if (totalKreditEl) totalKreditEl.textContent = formatRupiah(totalKredit);
    
    // Update date
    const tanggalEl = document.getElementById('tanggalNeracaSaldo');
    if (tanggalEl) tanggalEl.textContent = formatTanggal(new Date());
}

// =====================================================
// REPORTS - LABA RUGI
// =====================================================

function tampilkanLabaRugi() {
    const tbody = document.getElementById('bodyLabaRugi');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    let totalPendapatan = 0;
    let totalBeban = 0;
    
    // PENDAPATAN
    tbody.insertRow().innerHTML = '<td colspan="2" style="background: var(--light-color); font-weight: 700; padding: 15px;">PENDAPATAN</td>';
    
    allAccounts.filter(acc => acc.account_type === 'Pendapatan').forEach(account => {
        let kredit = 0, debit = 0;
        
        if (allTransactions) {
            allTransactions.forEach(trans => {
                if (trans.journal_entries) {
                    trans.journal_entries.forEach(entry => {
                        if (entry.account_id === account.id) {
                            kredit += entry.credit || 0;
                            debit += entry.debit || 0;
                        }
                    });
                }
            });
        }
        
        const balance = kredit - debit;
        if (balance !== 0) {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = account.name;
            row.insertCell(0).style.paddingLeft = '30px';
            row.insertCell(1).textContent = formatRupiah(balance);
            row.insertCell(1).className = 'text-right';
            totalPendapatan += balance;
        }
    });
    
    const rowTotalPendapatan = tbody.insertRow();
    rowTotalPendapatan.style.fontWeight = '700';
    rowTotalPendapatan.style.background = 'var(--light-color)';
    rowTotalPendapatan.insertCell(0).textContent = 'TOTAL PENDAPATAN';
    rowTotalPendapatan.insertCell(1).textContent = formatRupiah(totalPendapatan);
    rowTotalPendapatan.cells[1].className = 'text-right';
    
    // BEBAN
    tbody.insertRow().innerHTML = '<td colspan="2" style="background: var(--light-color); font-weight: 700; padding: 15px; padding-top: 25px;">BEBAN</td>';
    
    allAccounts.filter(acc => acc.account_type === 'Beban').forEach(account => {
        let debit = 0, kredit = 0;
        
        if (allTransactions) {
            allTransactions.forEach(trans => {
                if (trans.journal_entries) {
                    trans.journal_entries.forEach(entry => {
                        if (entry.account_id === account.id) {
                            debit += entry.debit || 0;
                            kredit += entry.credit || 0;
                        }
                    });
                }
            });
        }
        
        const balance = debit - kredit;
        if (balance !== 0) {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = account.name;
            row.insertCell(0).style.paddingLeft = '30px';
            row.insertCell(1).textContent = formatRupiah(balance);
            row.insertCell(1).className = 'text-right';
            totalBeban += balance;
        }
    });
    
    const rowTotalBeban = tbody.insertRow();
    rowTotalBeban.style.fontWeight = '700';
    rowTotalBeban.style.background = 'var(--light-color)';
    rowTotalBeban.insertCell(0).textContent = 'TOTAL BEBAN';
    rowTotalBeban.insertCell(1).textContent = formatRupiah(totalBeban);
    rowTotalBeban.cells[1].className = 'text-right';
    
    // LABA/RUGI
    const labaRugi = totalPendapatan - totalBeban;
    const rowLabaRugi = tbody.insertRow();
    rowLabaRugi.style.fontWeight = '700';
    rowLabaRugi.style.fontSize = '1.1rem';
    rowLabaRugi.style.background = labaRugi >= 0 ? '#d1fae5' : '#fee2e2';
    rowLabaRugi.style.color = labaRugi >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
    rowLabaRugi.insertCell(0).textContent = labaRugi >= 0 ? 'LABA BERSIH' : 'RUGI BERSIH';
    rowLabaRugi.insertCell(1).textContent = formatRupiah(Math.abs(labaRugi));
    rowLabaRugi.cells[1].className = 'text-right';
    
    // Update period
    const periodeEl = document.getElementById('periodeLabaRugi');
    if (periodeEl) periodeEl.textContent = 'Tahun 2026';
}

// =====================================================
// REPORTS - NERACA
// =====================================================

function tampilkanNeraca() {
    const tbody = document.getElementById('bodyNeraca');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    let totalAset = 0;
    let totalKewajiban = 0;
    let totalModal = 0;
    
    // ASET
    tbody.insertRow().innerHTML = '<td colspan="2" style="background: var(--primary-color); color: white; font-weight: 700; padding: 15px;">ASET</td>';
    
    allAccounts.filter(acc => acc.account_type === 'Aset').forEach(account => {
        let debit = 0, kredit = 0;
        
        if (allTransactions) {
            allTransactions.forEach(trans => {
                if (trans.journal_entries) {
                    trans.journal_entries.forEach(entry => {
                        if (entry.account_id === account.id) {
                            debit += entry.debit || 0;
                            kredit += entry.credit || 0;
                        }
                    });
                }
            });
        }
        
        const balance = debit - kredit;
        if (balance !== 0) {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = account.name;
            row.insertCell(0).style.paddingLeft = (account.level * 15) + 'px';
            row.insertCell(1).textContent = formatRupiah(Math.abs(balance));
            row.insertCell(1).className = 'text-right';
            totalAset += balance;
        }
    });
    
    const rowTotalAset = tbody.insertRow();
    rowTotalAset.style.fontWeight = '700';
    rowTotalAset.style.background = 'var(--light-color)';
    rowTotalAset.insertCell(0).textContent = 'TOTAL ASET';
    rowTotalAset.insertCell(1).textContent = formatRupiah(totalAset);
    rowTotalAset.cells[1].className = 'text-right';
    
    // KEWAJIBAN
    tbody.insertRow().innerHTML = '<td colspan="2" style="background: var(--danger-color); color: white; font-weight: 700; padding: 15px; padding-top: 25px;">KEWAJIBAN</td>';
    
    allAccounts.filter(acc => acc.account_type === 'Kewajiban').forEach(account => {
        let kredit = 0, debit = 0;
        
        if (allTransactions) {
            allTransactions.forEach(trans => {
                if (trans.journal_entries) {
                    trans.journal_entries.forEach(entry => {
                        if (entry.account_id === account.id) {
                            kredit += entry.credit || 0;
                            debit += entry.debit || 0;
                        }
                    });
                }
            });
        }
        
        const balance = kredit - debit;
        if (balance !== 0) {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = account.name;
            row.insertCell(0).style.paddingLeft = (account.level * 15) + 'px';
            row.insertCell(1).textContent = formatRupiah(Math.abs(balance));
            row.insertCell(1).className = 'text-right';
            totalKewajiban += balance;
        }
    });
    
    const rowTotalKewajiban = tbody.insertRow();
    rowTotalKewajiban.style.fontWeight = '700';
    rowTotalKewajiban.style.background = 'var(--light-color)';
    rowTotalKewajiban.insertCell(0).textContent = 'TOTAL KEWAJIBAN';
    rowTotalKewajiban.insertCell(1).textContent = formatRupiah(totalKewajiban);
    rowTotalKewajiban.cells[1].className = 'text-right';
    
    // MODAL
    tbody.insertRow().innerHTML = '<td colspan="2" style="background: var(--success-color); color: white; font-weight: 700; padding: 15px; padding-top: 25px;">MODAL</td>';
    
    allAccounts.filter(acc => acc.account_type === 'Modal').forEach(account => {
        let kredit = 0, debit = 0;
        
        if (allTransactions) {
            allTransactions.forEach(trans => {
                if (trans.journal_entries) {
                    trans.journal_entries.forEach(entry => {
                        if (entry.account_id === account.id) {
                            kredit += entry.credit || 0;
                            debit += entry.debit || 0;
                        }
                    });
                }
            });
        }
        
        const balance = kredit - debit;
        if (balance !== 0) {
            const row = tbody.insertRow();
            row.insertCell(0).textContent = account.name;
            row.insertCell(0).style.paddingLeft = (account.level * 15) + 'px';
            row.insertCell(1).textContent = formatRupiah(Math.abs(balance));
            row.insertCell(1).className = 'text-right';
            totalModal += balance;
        }
    });
    
    // Calculate and add profit/loss
    let totalPendapatan = 0, totalBeban = 0;
    
    if (allTransactions) {
        allTransactions.forEach(trans => {
            if (trans.journal_entries) {
                trans.journal_entries.forEach(entry => {
                    const account = allAccounts.find(acc => acc.id === entry.account_id);
                    if (account) {
                        if (account.account_type === 'Pendapatan') {
                            totalPendapatan += (entry.credit || 0) - (entry.debit || 0);
                        } else if (account.account_type === 'Beban') {
                            totalBeban += (entry.debit || 0) - (entry.credit || 0);
                        }
                    }
                });
            }
        });
    }
    
    const labaRugi = totalPendapatan - totalBeban;
    
    const rowLabaRugi = tbody.insertRow();
    rowLabaRugi.insertCell(0).textContent = labaRugi >= 0 ? 'Laba Tahun Berjalan' : 'Rugi Tahun Berjalan';
    rowLabaRugi.cells[0].style.paddingLeft = '30px';
    rowLabaRugi.insertCell(1).textContent = formatRupiah(Math.abs(labaRugi));
    rowLabaRugi.cells[1].className = 'text-right';
    totalModal += labaRugi;
    
    const rowTotalModal = tbody.insertRow();
    rowTotalModal.style.fontWeight = '700';
    rowTotalModal.style.background = 'var(--light-color)';
    rowTotalModal.insertCell(0).textContent = 'TOTAL MODAL';
    rowTotalModal.insertCell(1).textContent = formatRupiah(totalModal);
    rowTotalModal.cells[1].className = 'text-right';
    
    // TOTAL KEWAJIBAN + MODAL
    const rowTotal = tbody.insertRow();
    rowTotal.style.fontWeight = '700';
    rowTotal.style.fontSize = '1.1rem';
    rowTotal.style.background = 'var(--dark-color)';
    rowTotal.style.color = 'white';
    rowTotal.insertCell(0).textContent = 'TOTAL KEWAJIBAN & MODAL';
    rowTotal.insertCell(1).textContent = formatRupiah(totalKewajiban + totalModal);
    rowTotal.cells[1].className = 'text-right';
    
    // Update date
    const tanggalEl = document.getElementById('tanggalNeraca');
    if (tanggalEl) tanggalEl.textContent = formatTanggal(new Date());
}

// =====================================================
// REPORTS - ARUS KAS (Placeholder)
// =====================================================

function tampilkanArusKas() {
    const tbody = document.getElementById('bodyArusKas');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="2" class="text-center" style="padding: 30px;">Laporan Arus Kas - Coming Soon</td></tr>';
}

// =====================================================
// DASHBOARD
// =====================================================

function updateDashboard() {
    // Calculate financial metrics
    let totalAset = 0;
    let totalKewajiban = 0;
    let totalPendapatan = 0;
    let totalBeban = 0;
    
    if (allTransactions && allAccounts) {
        allTransactions.forEach(trans => {
            if (trans.journal_entries) {
                trans.journal_entries.forEach(entry => {
                    const account = allAccounts.find(acc => acc.id === entry.account_id);
                    if (account) {
                        if (account.account_type === 'Aset') {
                            totalAset += (entry.debit || 0) - (entry.credit || 0);
                        } else if (account.account_type === 'Kewajiban') {
                            totalKewajiban += (entry.credit || 0) - (entry.debit || 0);
                        } else if (account.account_type === 'Pendapatan') {
                            totalPendapatan += (entry.credit || 0) - (entry.debit || 0);
                        } else if (account.account_type === 'Beban') {
                            totalBeban += (entry.debit || 0) - (entry.credit || 0);
                        }
                    }
                });
            }
        });
    }
    
    const labaRugi = totalPendapatan - totalBeban;
    
    // Update dashboard cards if they exist
    const dashboardCards = document.querySelectorAll('.card-value');
    if (dashboardCards.length >= 4) {
        dashboardCards[0].textContent = formatRupiah(totalAset);
        dashboardCards[1].textContent = formatRupiah(totalKewajiban);
        dashboardCards[2].textContent = formatRupiah(totalPendapatan);
        dashboardCards[3].textContent = formatRupiah(labaRugi);
        
        // Update color for profit/loss
        if (labaRugi >= 0) {
            dashboardCards[3].style.color = 'var(--success-color)';
        } else {
            dashboardCards[3].style.color = 'var(--danger-color)';
        }
    }
}

// =====================================================
// COMPANY INFO
// =====================================================

async function simpanIdentitasWP(event) {
    event.preventDefault();
    
    const companyData = {
        npwp: document.getElementById('npwpBadan').value,
        company_name: document.getElementById('namaWP').value,
        address: document.getElementById('alamatWP').value,
        business_type: document.getElementById('jenisUsaha').value
    };
    
    showLoading('Menyimpan informasi perusahaan...');
    
    const result = await CompanyService.update(companyData);
    
    hideLoading();
    
    if (result.success) {
        showNotification('Informasi perusahaan berhasil disimpan!', 'success');
    } else {
        showNotification(result.message || 'Gagal menyimpan informasi', 'error');
    }
}

// =====================================================
// UTILITY FUNCTIONS
// =====================================================

function formatRupiah(angka) {
    const number = parseFloat(angka) || 0;
    return 'Rp ' + number.toLocaleString('id-ID', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function formatTanggal(tanggal) {
    const date = new Date(tanggal);
    if (isNaN(date.getTime())) return '-';
    
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
    });
}

function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.getElementById('notification');
    if (existing) existing.remove();
    
    // Create notification element
    const notification = document.createElement('div');
    notification.id = 'notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 8px;
        background: ${type === 'success' ? 'var(--success-color)' : 
                     type === 'error' ? 'var(--danger-color)' : 
                     type === 'warning' ? 'var(--warning-color)' : 
                     'var(--primary-color)'};
        color: white;
        font-weight: 600;
        box-shadow: var(--shadow-lg);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        max-width: 400px;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showLoading(message = 'Memproses...') {
    let loader = document.getElementById('globalLoader');
    
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'globalLoader';
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        loader.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 12px; text-align: center; min-width: 200px;">
                <div style="width: 50px; height: 50px; border: 4px solid var(--light-color); border-top-color: var(--primary-color); border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;"></div>
                <p id="loaderMessage" style="color: var(--dark-color); font-weight: 600;">${message}</p>
            </div>
        `;
        document.body.appendChild(loader);
    } else {
        loader.style.display = 'flex';
        const messageEl = loader.querySelector('#loaderMessage');
        if (messageEl) messageEl.textContent = message;
    }
}

function hideLoading() {
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.style.display = 'none';
    }
}

// =====================================================
// TAB NAVIGATION
// =====================================================

function openTab(tabId) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active class from all nav tabs
    document.querySelectorAll('.nav-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Show selected tab
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Add active class to clicked nav tab
    const clickedTab = event?.target;
    if (clickedTab) {
        clickedTab.classList.add('active');
    }
    
    // Refresh data for specific tabs
    if (tabId === 'buku-besar') {
        tampilkanBukuBesar();
    }
}

// =====================================================
// MODAL FUNCTIONS
// =====================================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

console.log('✅ App.js loaded - Supabase Database Version');
console.log('📦 Ready to connect to Supabase');
