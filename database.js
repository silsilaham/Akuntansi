// =====================================================
// DATABASE SERVICE LAYER - SUPABASE OPERATIONS
// =====================================================

// =====================================================
// USERS OPERATIONS
// =====================================================

const UserService = {
    // Login user
    async login(username, password) {
        try {
            const { data, error } = await supabaseClient
                .from('users')
                .select('*')
                .eq('username', username)
                .eq('password', password) // Note: Dalam production, gunakan proper password hashing
                .eq('is_active', true)
                .single();

            if (error) throw error;
            
            if (data) {
                // Simpan ke localStorage
                localStorage.setItem('currentUser', JSON.stringify(data));
                
                // Log activity
                await AuditService.log(data.id, 'LOGIN', 'users', data.id);
                
                return { success: true, data };
            }
            
            return { success: false, message: 'Username atau password salah' };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Register new user
    async register(userData) {
        try {
            const { data, error } = await supabaseClient
                .from('users')
                .insert([{
                    username: userData.username,
                    password: userData.password, // Note: Dalam production, hash password
                    full_name: userData.fullName,
                    email: userData.email,
                    role: userData.role || 'user'
                }])
                .select()
                .single();

            if (error) throw error;

            await AuditService.log(null, 'CREATE', 'users', data.id, null, data);

            return { success: true, data };
        } catch (error) {
            console.error('Register error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Get all users
    async getAll() {
        try {
            const { data, error } = await supabaseClient
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get users error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Update user
    async update(userId, userData) {
        try {
            const { data, error } = await supabaseClient
                .from('users')
                .update(userData)
                .eq('id', userId)
                .select()
                .single();

            if (error) throw error;

            await AuditService.log(getCurrentUserId(), 'UPDATE', 'users', userId, null, data);

            return { success: true, data };
        } catch (error) {
            console.error('Update user error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Delete user
    async delete(userId) {
        try {
            const { error } = await supabaseClient
                .from('users')
                .delete()
                .eq('id', userId);

            if (error) throw error;

            await AuditService.log(getCurrentUserId(), 'DELETE', 'users', userId);

            return { success: true };
        } catch (error) {
            console.error('Delete user error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    }
};

// =====================================================
// COA (CHART OF ACCOUNTS) OPERATIONS
// =====================================================

const COAService = {
    // Get all accounts
    async getAll() {
        try {
            const { data, error } = await supabaseClient
                .from('coa')
                .select('*')
                .eq('is_active', true)
                .order('code', { ascending: true });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get COA error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Get account by ID
    async getById(accountId) {
        try {
            const { data, error } = await supabaseClient
                .from('coa')
                .select('*')
                .eq('id', accountId)
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get account error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Create new account
    async create(accountData) {
        try {
            const { data, error } = await supabaseClient
                .from('coa')
                .insert([{
                    ...accountData,
                    created_by: getCurrentUserId()
                }])
                .select()
                .single();

            if (error) throw error;

            await AuditService.log(getCurrentUserId(), 'CREATE', 'coa', data.id, null, data);

            return { success: true, data };
        } catch (error) {
            console.error('Create account error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Update account
    async update(accountId, accountData) {
        try {
            const { data, error } = await supabaseClient
                .from('coa')
                .update(accountData)
                .eq('id', accountId)
                .select()
                .single();

            if (error) throw error;

            await AuditService.log(getCurrentUserId(), 'UPDATE', 'coa', accountId, null, data);

            return { success: true, data };
        } catch (error) {
            console.error('Update account error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Delete account
    async delete(accountId) {
        try {
            const { error } = await supabaseClient
                .from('coa')
                .update({ is_active: false })
                .eq('id', accountId);

            if (error) throw error;

            await AuditService.log(getCurrentUserId(), 'DELETE', 'coa', accountId);

            return { success: true };
        } catch (error) {
            console.error('Delete account error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    }
};

// =====================================================
// TRANSACTIONS OPERATIONS
// =====================================================

const TransactionService = {
    // Get all transactions
    async getAll(filters = {}) {
        try {
            let query = supabaseClient
                .from('transactions')
                .select(`
                    *,
                    journal_entries (
                        *,
                        coa (code, name)
                    )
                `)
                .order('transaction_date', { ascending: false });

            // Apply filters
            if (filters.startDate) {
                query = query.gte('transaction_date', filters.startDate);
            }
            if (filters.endDate) {
                query = query.lte('transaction_date', filters.endDate);
            }

            const { data, error } = await query;

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get transactions error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Get transaction by ID
    async getById(transactionId) {
        try {
            const { data, error } = await supabaseClient
                .from('transactions')
                .select(`
                    *,
                    journal_entries (
                        *,
                        coa (code, name)
                    )
                `)
                .eq('id', transactionId)
                .single();

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get transaction error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Create new transaction with journal entries
    async create(transactionData, journalEntries) {
        try {
            // Hitung total debit dan kredit
            const totalDebit = journalEntries.reduce((sum, entry) => sum + (parseFloat(entry.debit) || 0), 0);
            const totalCredit = journalEntries.reduce((sum, entry) => sum + (parseFloat(entry.credit) || 0), 0);

            // Validasi balance
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                return { success: false, message: 'Total Debit dan Kredit harus sama!' };
            }

            // Insert transaction
            const { data: transaction, error: transError } = await supabaseClient
                .from('transactions')
                .insert([{
                    transaction_date: transactionData.transaction_date,
                    voucher_number: transactionData.voucher_number,
                    description: transactionData.description,
                    total_debit: totalDebit,
                    total_credit: totalCredit,
                    created_by: getCurrentUserId()
                }])
                .select()
                .single();

            if (transError) throw transError;

            // Insert journal entries
            const entries = journalEntries.map(entry => ({
                transaction_id: transaction.id,
                account_id: entry.account_id,
                debit: parseFloat(entry.debit) || 0,
                credit: parseFloat(entry.credit) || 0,
                description: entry.description || transactionData.description
            }));

            const { error: entriesError } = await supabaseClient
                .from('journal_entries')
                .insert(entries);

            if (entriesError) throw entriesError;

            await AuditService.log(getCurrentUserId(), 'CREATE', 'transactions', transaction.id, null, transaction);

            return { success: true, data: transaction };
        } catch (error) {
            console.error('Create transaction error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Update transaction
    async update(transactionId, transactionData, journalEntries) {
        try {
            // Hitung total debit dan kredit
            const totalDebit = journalEntries.reduce((sum, entry) => sum + (parseFloat(entry.debit) || 0), 0);
            const totalCredit = journalEntries.reduce((sum, entry) => sum + (parseFloat(entry.credit) || 0), 0);

            // Validasi balance
            if (Math.abs(totalDebit - totalCredit) > 0.01) {
                return { success: false, message: 'Total Debit dan Kredit harus sama!' };
            }

            // Update transaction
            const { data: transaction, error: transError } = await supabaseClient
                .from('transactions')
                .update({
                    transaction_date: transactionData.transaction_date,
                    voucher_number: transactionData.voucher_number,
                    description: transactionData.description,
                    total_debit: totalDebit,
                    total_credit: totalCredit
                })
                .eq('id', transactionId)
                .select()
                .single();

            if (transError) throw transError;

            // Delete old entries
            await supabaseClient
                .from('journal_entries')
                .delete()
                .eq('transaction_id', transactionId);

            // Insert new entries
            const entries = journalEntries.map(entry => ({
                transaction_id: transactionId,
                account_id: entry.account_id,
                debit: parseFloat(entry.debit) || 0,
                credit: parseFloat(entry.credit) || 0,
                description: entry.description || transactionData.description
            }));

            const { error: entriesError } = await supabaseClient
                .from('journal_entries')
                .insert(entries);

            if (entriesError) throw entriesError;

            await AuditService.log(getCurrentUserId(), 'UPDATE', 'transactions', transactionId, null, transaction);

            return { success: true, data: transaction };
        } catch (error) {
            console.error('Update transaction error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Delete transaction
    async delete(transactionId) {
        try {
            const { error } = await supabaseClient
                .from('transactions')
                .delete()
                .eq('id', transactionId);

            if (error) throw error;

            await AuditService.log(getCurrentUserId(), 'DELETE', 'transactions', transactionId);

            return { success: true };
        } catch (error) {
            console.error('Delete transaction error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    }
};

// =====================================================
// ASSETS OPERATIONS
// =====================================================

const AssetService = {
    // Get all assets
    async getAll(filters = {}) {
        try {
            let query = supabaseClient
                .from('assets')
                .select('*')
                .order('asset_code', { ascending: true });

            if (filters.status) {
                query = query.eq('status', filters.status);
            }

            const { data, error } = await query;

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get assets error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Create new asset
    async create(assetData) {
        try {
            const bookValue = assetData.acquisition_cost - (assetData.accumulated_depreciation || 0);
            
            const { data, error } = await supabaseClient
                .from('assets')
                .insert([{
                    ...assetData,
                    book_value: bookValue,
                    created_by: getCurrentUserId()
                }])
                .select()
                .single();

            if (error) throw error;

            await AuditService.log(getCurrentUserId(), 'CREATE', 'assets', data.id, null, data);

            return { success: true, data };
        } catch (error) {
            console.error('Create asset error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Update asset
    async update(assetId, assetData) {
        try {
            if (assetData.acquisition_cost && assetData.accumulated_depreciation !== undefined) {
                assetData.book_value = assetData.acquisition_cost - assetData.accumulated_depreciation;
            }

            const { data, error } = await supabaseClient
                .from('assets')
                .update(assetData)
                .eq('id', assetId)
                .select()
                .single();

            if (error) throw error;

            await AuditService.log(getCurrentUserId(), 'UPDATE', 'assets', assetId, null, data);

            return { success: true, data };
        } catch (error) {
            console.error('Update asset error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Delete asset
    async delete(assetId) {
        try {
            const { error } = await supabaseClient
                .from('assets')
                .update({ status: 'Dihapus' })
                .eq('id', assetId);

            if (error) throw error;

            await AuditService.log(getCurrentUserId(), 'DELETE', 'assets', assetId);

            return { success: true };
        } catch (error) {
            console.error('Delete asset error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Record depreciation
    async recordDepreciation(assetId, depreciationData) {
        try {
            // Insert depreciation history
            const { data: history, error: historyError } = await supabaseClient
                .from('depreciation_history')
                .insert([{
                    asset_id: assetId,
                    period_date: depreciationData.period_date,
                    depreciation_amount: depreciationData.depreciation_amount,
                    accumulated_before: depreciationData.accumulated_before,
                    accumulated_after: depreciationData.accumulated_after,
                    book_value: depreciationData.book_value,
                    notes: depreciationData.notes,
                    created_by: getCurrentUserId()
                }])
                .select()
                .single();

            if (historyError) throw historyError;

            // Update asset
            const { error: assetError } = await supabaseClient
                .from('assets')
                .update({
                    accumulated_depreciation: depreciationData.accumulated_after,
                    book_value: depreciationData.book_value
                })
                .eq('id', assetId);

            if (assetError) throw assetError;

            return { success: true, data: history };
        } catch (error) {
            console.error('Record depreciation error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Get depreciation history
    async getDepreciationHistory(assetId) {
        try {
            const { data, error } = await supabaseClient
                .from('depreciation_history')
                .select('*')
                .eq('asset_id', assetId)
                .order('period_date', { ascending: false });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get depreciation history error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    }
};

// =====================================================
// TAX RECORDS OPERATIONS
// =====================================================

const TaxService = {
    // Get all tax records
    async getAll(filters = {}) {
        try {
            let query = supabaseClient
                .from('tax_records')
                .select('*')
                .order('tax_period', { ascending: false });

            if (filters.taxType) {
                query = query.eq('tax_type', filters.taxType);
            }
            if (filters.startDate) {
                query = query.gte('tax_period', filters.startDate);
            }
            if (filters.endDate) {
                query = query.lte('tax_period', filters.endDate);
            }

            const { data, error } = await query;

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get tax records error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Create tax record
    async create(taxData) {
        try {
            const { data, error } = await supabaseClient
                .from('tax_records')
                .insert([{
                    ...taxData,
                    created_by: getCurrentUserId()
                }])
                .select()
                .single();

            if (error) throw error;

            await AuditService.log(getCurrentUserId(), 'CREATE', 'tax_records', data.id, null, data);

            return { success: true, data };
        } catch (error) {
            console.error('Create tax record error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Update tax record
    async update(taxId, taxData) {
        try {
            const { data, error } = await supabaseClient
                .from('tax_records')
                .update(taxData)
                .eq('id', taxId)
                .select()
                .single();

            if (error) throw error;

            await AuditService.log(getCurrentUserId(), 'UPDATE', 'tax_records', taxId, null, data);

            return { success: true, data };
        } catch (error) {
            console.error('Update tax record error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Delete tax record
    async delete(taxId) {
        try {
            const { error } = await supabaseClient
                .from('tax_records')
                .delete()
                .eq('id', taxId);

            if (error) throw error;

            await AuditService.log(getCurrentUserId(), 'DELETE', 'tax_records', taxId);

            return { success: true };
        } catch (error) {
            console.error('Delete tax record error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    }
};

// =====================================================
// REPORTING OPERATIONS
// =====================================================

const ReportService = {
    // Get Trial Balance (Neraca Saldo)
    async getTrialBalance(asOfDate = null) {
        try {
            const { data, error } = await supabaseClient
                .rpc('get_trial_balance', { as_of_date: asOfDate });

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            // Fallback jika stored procedure tidak ada
            console.log('Using fallback trial balance calculation');
            return await this.getTrialBalanceFallback(asOfDate);
        }
    },

    // Fallback Trial Balance calculation
    async getTrialBalanceFallback(asOfDate = null) {
        try {
            // Get all accounts
            const { data: accounts } = await COAService.getAll();
            
            // Get all journal entries
            let query = supabaseClient
                .from('journal_entries')
                .select(`
                    *,
                    transactions!inner(transaction_date)
                `);

            if (asOfDate) {
                query = query.lte('transactions.transaction_date', asOfDate);
            }

            const { data: entries, error } = await query;
            
            if (error) throw error;

            // Calculate balances
            const balances = {};
            entries.forEach(entry => {
                if (!balances[entry.account_id]) {
                    balances[entry.account_id] = { debit: 0, credit: 0 };
                }
                balances[entry.account_id].debit += parseFloat(entry.debit) || 0;
                balances[entry.account_id].credit += parseFloat(entry.credit) || 0;
            });

            // Combine with accounts
            const trialBalance = accounts.data.map(account => {
                const balance = balances[account.id] || { debit: 0, credit: 0 };
                const netBalance = account.normal_balance === 'Debit' 
                    ? balance.debit - balance.credit 
                    : balance.credit - balance.debit;

                return {
                    ...account,
                    total_debit: balance.debit,
                    total_credit: balance.credit,
                    balance: Math.abs(netBalance)
                };
            });

            return { success: true, data: trialBalance };
        } catch (error) {
            console.error('Trial balance error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Get Income Statement (Laba Rugi)
    async getIncomeStatement(startDate, endDate) {
        try {
            const { data: entries, error } = await supabaseClient
                .from('journal_entries')
                .select(`
                    *,
                    coa!inner(code, name, account_type),
                    transactions!inner(transaction_date)
                `)
                .gte('transactions.transaction_date', startDate)
                .lte('transactions.transaction_date', endDate)
                .in('coa.account_type', ['Pendapatan', 'Beban']);

            if (error) throw error;

            // Group by account
            const accounts = {};
            entries.forEach(entry => {
                const accountId = entry.account_id;
                if (!accounts[accountId]) {
                    accounts[accountId] = {
                        ...entry.coa,
                        total: 0
                    };
                }
                
                if (entry.coa.account_type === 'Pendapatan') {
                    accounts[accountId].total += (parseFloat(entry.credit) || 0) - (parseFloat(entry.debit) || 0);
                } else {
                    accounts[accountId].total += (parseFloat(entry.debit) || 0) - (parseFloat(entry.credit) || 0);
                }
            });

            return { success: true, data: Object.values(accounts) };
        } catch (error) {
            console.error('Income statement error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Get Balance Sheet (Neraca)
    async getBalanceSheet(asOfDate) {
        try {
            const { data: entries, error } = await supabaseClient
                .from('journal_entries')
                .select(`
                    *,
                    coa!inner(code, name, account_type, normal_balance),
                    transactions!inner(transaction_date)
                `)
                .lte('transactions.transaction_date', asOfDate)
                .in('coa.account_type', ['Aset', 'Kewajiban', 'Modal']);

            if (error) throw error;

            // Group by account
            const accounts = {};
            entries.forEach(entry => {
                const accountId = entry.account_id;
                if (!accounts[accountId]) {
                    accounts[accountId] = {
                        ...entry.coa,
                        balance: 0
                    };
                }
                
                const debit = parseFloat(entry.debit) || 0;
                const credit = parseFloat(entry.credit) || 0;
                
                if (entry.coa.normal_balance === 'Debit') {
                    accounts[accountId].balance += debit - credit;
                } else {
                    accounts[accountId].balance += credit - debit;
                }
            });

            return { success: true, data: Object.values(accounts) };
        } catch (error) {
            console.error('Balance sheet error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    }
};

// =====================================================
// COMPANY INFO OPERATIONS
// =====================================================

const CompanyService = {
    // Get company info
    async getInfo() {
        try {
            const { data, error } = await supabaseClient
                .from('company_info')
                .select('*')
                .limit(1)
                .single();

            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
            return { success: true, data: data || {} };
        } catch (error) {
            console.error('Get company info error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    },

    // Update company info
    async update(companyData) {
        try {
            // Check if exists
            const { data: existing } = await this.getInfo();
            
            let result;
            if (existing.data && existing.data.id) {
                // Update
                result = await supabaseClient
                    .from('company_info')
                    .update({
                        ...companyData,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.data.id)
                    .select()
                    .single();
            } else {
                // Insert
                result = await supabaseClient
                    .from('company_info')
                    .insert([{
                        ...companyData,
                        created_by: getCurrentUserId()
                    }])
                    .select()
                    .single();
            }

            if (result.error) throw result.error;

            await AuditService.log(getCurrentUserId(), 'UPDATE', 'company_info', result.data.id);

            return { success: true, data: result.data };
        } catch (error) {
            console.error('Update company info error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    }
};

// =====================================================
// AUDIT LOG OPERATIONS
// =====================================================

const AuditService = {
    // Log activity
    async log(userId, action, tableName, recordId = null, oldValues = null, newValues = null) {
        try {
            await supabaseClient
                .from('audit_log')
                .insert([{
                    user_id: userId,
                    action: action,
                    table_name: tableName,
                    record_id: recordId,
                    old_values: oldValues,
                    new_values: newValues,
                    ip_address: null, // Could be populated from request
                    user_agent: navigator.userAgent
                }]);
        } catch (error) {
            console.error('Audit log error:', error);
            // Don't throw error, just log it
        }
    },

    // Get audit logs
    async getLogs(filters = {}) {
        try {
            let query = supabaseClient
                .from('audit_log')
                .select(`
                    *,
                    users(username, full_name)
                `)
                .order('created_at', { ascending: false })
                .limit(100);

            if (filters.userId) {
                query = query.eq('user_id', filters.userId);
            }
            if (filters.action) {
                query = query.eq('action', filters.action);
            }
            if (filters.tableName) {
                query = query.eq('table_name', filters.tableName);
            }

            const { data, error } = await query;

            if (error) throw error;
            return { success: true, data };
        } catch (error) {
            console.error('Get audit logs error:', error);
            return { success: false, message: formatSupabaseError(error) };
        }
    }
};

// =====================================================
// INITIALIZE DATABASE ON PAGE LOAD
// =====================================================

document.addEventListener('DOMContentLoaded', async () => {
    const initialized = initSupabase();
    if (initialized) {
        console.log('✅ Database service siap digunakan');
    }
});
