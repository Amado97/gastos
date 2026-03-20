const SUPABASE_URL = 'https://tcyfpjmgpidojdtrmdal.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_RjDks-Ggg9E36Y7ybmYFJA_NwgAG5u1';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Exchange Rates State
let exchangeRates = null;
const BASE_CURRENCY = 'COP'; // Base currency for internal calculations

// DOM Elements
const authContent = document.getElementById('authContent');
const dashboardContent = document.getElementById('dashboardContent');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const authBtn = document.getElementById('authBtn');
const switchBtn = document.getElementById('switchBtn');
const switchText = document.getElementById('switchText');
const logoutBtn = document.getElementById('logoutBtn');
const transactionList = document.getElementById('transactionList');
const transactionForm = document.getElementById('transactionForm');
const transactionModal = document.getElementById('transactionModal');
const openModalBtn = document.getElementById('openModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const filterRange = document.getElementById('filterRange');
const filterDate = document.getElementById('filterDate');
const confirmModal = document.getElementById('confirmModal');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

// State
let isLogin = true;
let currentUser = null;
let deleteTargetId = null;

// Chart Instance
let financeChart = null;

// Modern Notification System
function showNotify(message, type = 'info') {
    const container = document.getElementById('notifyContainer');
    const bar = document.createElement('div');
    bar.className = `notify-bar`;
    
    bar.innerHTML = `
        <div class="notify-status status-${type}"></div>
        <div class="notify-message">${message}</div>
    `;

    container.appendChild(bar);
    
    // Trigger animation
    setTimeout(() => bar.classList.add('active'), 50);

    // Remove after 3.5s
    setTimeout(() => {
        bar.classList.remove('active');
        setTimeout(() => bar.remove(), 500);
    }, 3500);
}

// Initialization
async function init() {
    await fetchExchangeRates();
    const { data: { session } } = await supabaseClient.auth.getSession();
    handleSession(session);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
        handleSession(session);
    });
}

async function fetchExchangeRates() {
    try {
        const response = await fetch(`https://api.frankfurter.app/latest?from=${BASE_CURRENCY}&to=USD,MXN,EUR`);
        const data = await response.json();
        exchangeRates = data.rates;
        // The API returns rates relative to 1 COP. e.g. 1 COP = 0.00025 USD
        // We'll add COP to local rates as 1
        exchangeRates['COP'] = 1;
    } catch (err) {
        console.error('Error fetching rates:', err);
        // Fallback static rates if API fails (approximate)
        exchangeRates = {
            'COP': 1,
            'USD': 0.00026,
            'MXN': 0.0044,
            'EUR': 0.00024
        };
    }
}

function handleSession(session) {
    if (session) {
        currentUser = session.user;
        showDashboard();
        fetchTransactions();
    } else {
        currentUser = null;
        showAuth();
    }
}

// UI Switching
function showAuth() {
    authContent.style.display = 'flex';
    dashboardContent.style.display = 'none';
}

function showDashboard() {
    authContent.style.display = 'none';
    dashboardContent.style.display = 'flex';
}

switchBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isLogin = !isLogin;
    if (isLogin) {
        authTitle.innerText = 'Bienvenido';
        authBtn.innerText = 'Entrar';
        switchText.innerText = '¿No tienes cuenta?';
        switchBtn.innerText = 'Regístrate';
    } else {
        authTitle.innerText = 'Crea tu Cuenta';
        authBtn.innerText = 'Registrarse';
        switchText.innerText = '¿Ya tienes cuenta?';
        switchBtn.innerText = 'Inicia Sesión';
    }
});

// Auth Logic
authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    authBtn.classList.add('loading');
    
    try {
        if (isLogin) {
            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
        } else {
            const { error } = await supabaseClient.auth.signUp({ 
                email, 
                password,
                options: {
                    emailRedirectTo: window.location.origin + window.location.pathname
                }
            });
            if (error) throw error;
            showNotify('Revisa tu correo para confirmar tu registro.', 'success');
        }
    } catch (err) {
        showNotify(err.message, 'error');
    } finally {
        authBtn.classList.remove('loading');
    }
});

logoutBtn.addEventListener('click', async () => {
    await supabaseClient.auth.signOut();
});

// Transaction Logic
openModalBtn.addEventListener('click', () => transactionModal.classList.add('active'));
closeModalBtn.addEventListener('click', () => transactionModal.classList.remove('active'));

transactionForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const description = document.getElementById('desc').value;
    const amount = parseFloat(document.getElementById('amount').value);
    const currency = document.getElementById('currency').value;
    const type = document.getElementById('type').value;
    const payment_method = document.getElementById('method').value;
    const is_recurring = document.getElementById('recurring').checked;
    const editingId = document.getElementById('editingId').value;

    const saveBtn = document.getElementById('saveTransactionBtn');
    saveBtn.classList.add('loading');

    try {
        if (editingId) {
            const { error } = await supabaseClient
                .from('transactions')
                .update({
                    description,
                    amount,
                    currency,
                    type,
                    payment_method,
                    is_recurring
                })
                .eq('id', editingId);
            if (error) throw error;
        } else {
            const { error } = await supabaseClient
                .from('transactions')
                .insert([{
                    user_id: currentUser.id,
                    description,
                    amount,
                    currency,
                    type,
                    payment_method,
                    is_recurring
                }]);
            if (error) throw error;
        }
        
        closeModal();
        fetchTransactions();
        showNotify(editingId ? 'Movimiento actualizado correctamente' : 'Movimiento guardado con éxito', 'success');
    } catch (err) {
        showNotify(err.message, 'error');
    } finally {
        saveBtn.classList.remove('loading');
    }
});

function closeModal() {
    transactionModal.classList.remove('active');
    transactionForm.reset();
    document.getElementById('editingId').value = '';
    document.getElementById('modalTitle').innerText = 'Nuevo Movimiento';
}

closeModalBtn.addEventListener('click', closeModal);

async function editTransaction(id) {
    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        showNotify(error.message, 'error');
        return;
    }

    document.getElementById('desc').value = data.description;
    document.getElementById('amount').value = data.amount;
    document.getElementById('currency').value = data.currency;
    document.getElementById('type').value = data.type;
    document.getElementById('method').value = data.payment_method;
    document.getElementById('recurring').checked = data.is_recurring;
    document.getElementById('editingId').value = data.id;
    document.getElementById('modalTitle').innerText = 'Editar Movimiento';
    
    transactionModal.classList.add('active');
}

async function deleteTransaction(id) {
    deleteTargetId = id;
    confirmModal.classList.add('active');
}

confirmDeleteBtn.addEventListener('click', async () => {
    if (!deleteTargetId) return;
    
    confirmDeleteBtn.classList.add('loading');
    const { error } = await supabaseClient
        .from('transactions')
        .delete()
        .eq('id', deleteTargetId);
    
    confirmDeleteBtn.classList.remove('loading');
    confirmModal.classList.remove('active');
    
    if (error) {
        showNotify(error.message, 'error');
    } else {
        fetchTransactions();
        showNotify('Movimiento eliminado', 'info');
    }
    deleteTargetId = null;
});

cancelDeleteBtn.addEventListener('click', () => {
    confirmModal.classList.remove('active');
    deleteTargetId = null;
});

// Filter Listeners
filterRange.addEventListener('change', () => {
    filterDate.value = ''; // Reset date picker if range is used
    fetchTransactions();
});

filterDate.addEventListener('change', () => {
    filterRange.value = 'all'; // Reset range if specific date is used
    fetchTransactions();
});

async function fetchTransactions() {
    let query = supabaseClient
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

    const range = filterRange.value;
    const specificDate = filterDate.value;

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    if (specificDate) {
        const start = new Date(specificDate + 'T00:00:00');
        const end = new Date(specificDate + 'T23:59:59');
        query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString());
    } else if (range !== 'all') {
        let start;
        switch (range) {
            case 'today':
                start = startOfDay;
                break;
            case 'yesterday':
                const yesterday = new Date(now);
                yesterday.setDate(now.getDate() - 1);
                const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
                const endOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59).toISOString();
                query = query.gte('created_at', startOfYesterday).lte('created_at', endOfYesterday);
                break;
            case 'week':
                const weekAgo = new Date(now);
                weekAgo.setDate(now.getDate() - 7);
                start = weekAgo.toISOString();
                break;
            case 'month':
                const monthAgo = new Date(now);
                monthAgo.setMonth(now.getMonth() - 1);
                start = monthAgo.toISOString();
                break;
        }
        if (range !== 'yesterday') {
            query = query.gte('created_at', start);
        }
    }

    const { data, error } = await query;

    if (error) {
        console.error(error);
        return;
    }

    renderTransactions(data);
    updateSummary(data);
}

function renderTransactions(transactions) {
    transactionList.innerHTML = transactions.length === 0 
        ? '<p style="color: var(--text-muted); text-align: center; margin-top: 1rem;">No hay movimientos aún.</p>'
        : '';

    transactions.forEach(t => {
        const date = new Date(t.created_at);
        const day = date.getDate().toString().padStart(2, '0');
        const month = date.toLocaleString('default', { month: 'short' }).toUpperCase();
        const year = date.getFullYear();
        const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        const item = document.createElement('div');
        item.className = 'transaction-item';
        item.innerHTML = `
            <div class="transaction-date">
                <span style="font-weight: 700; color: var(--text-main);">${day} ${month} ${year}</span>
                <span style="font-size: 0.75rem;">${time}</span>
            </div>
            <div class="transaction-main">
                <span style="font-weight: 600;">${t.description}</span>
                <span class="transaction-type-badge badge-${t.type}">
                    ${t.type === 'income' ? 'Ingreso' : 'Egreso'}
                </span>
            </div>
            <div class="transaction-amount ${t.type}" style="font-weight: 700;">
                ${t.type === 'income' ? '+' : '-'}${t.currency} ${t.amount.toFixed(2)}
            </div>
            <div class="transaction-actions">
                <button class="action-btn btn-edit" onclick="editTransaction('${t.id}')" title="Editar">
                    ✎
                </button>
                <button class="action-btn btn-delete" onclick="deleteTransaction('${t.id}')" title="Eliminar">
                    🗑
                </button>
            </div>
        `;
        transactionList.appendChild(item);
    });
}

function translateMethod(method) {
    const methods = {
        'credit': 'Tarjeta de Crédito',
        'debit': 'Tarjeta de Débito',
        'cash': 'Efectivo'
    };
    return methods[method] || method;
}

function updateSummary(transactions) {
    let totalIncomeCOP = 0;
    let totalExpensesCOP = 0;

    transactions.forEach(t => {
        // Convert to COP for calculation: amount / rate
        // If 1 COP = 0.00025 USD, then 10 USD = 10 / 0.00025 = 40,000 COP
        const rate = exchangeRates[t.currency];
        const amountInCOP = t.amount / rate;

        if (t.type === 'income') totalIncomeCOP += amountInCOP;
        else totalExpensesCOP += amountInCOP;
    });

    const balanceCOP = totalIncomeCOP - totalExpensesCOP;

    // Display formatted strings
    document.getElementById('totalBalance').innerText = formatCurrency(balanceCOP, 'COP');
    document.getElementById('totalIncome').innerText = formatCurrency(totalIncomeCOP, 'COP');
    document.getElementById('totalExpenses').innerText = formatCurrency(totalExpensesCOP, 'COP');

    updateChart(totalIncomeCOP, totalExpensesCOP, balanceCOP);
}

function updateChart(income, expenses, balance) {
    const ctx = document.getElementById('financeChart').getContext('2d');
    
    if (financeChart) {
        financeChart.destroy();
    }

    financeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Ingresos', 'Gastos', 'Balance'],
            datasets: [{
                label: 'Pesos Colombianos (COP)',
                data: [income, expenses, balance],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.6)', // Green for income
                    'rgba(239, 68, 68, 0.6)',   // Red for expenses
                    'rgba(99, 102, 241, 0.6)'  // Blue for balance
                ],
                borderColor: [
                    '#10b981',
                    '#ef4444',
                    '#6366f1'
                ],
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.1)' },
                    ticks: { color: '#94a3b8' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

function formatCurrency(amount, currency) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0
    }).format(amount);
}

init();
