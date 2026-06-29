// Admin Command Center JavaScript
// This file handles all admin dashboard functionality

// State management
let currentView = 'users';
let currentPage = 1;
let pageSize = 10;
let allUsers = [];
let allLicenses = [];
let currentAdmin = null;

// Check authentication using token stored in localStorage
async function checkAuth() {
    const token = localStorage.getItem('adminToken');
    if (!token) {
        window.location.href = '/admin/login.html';
        return false;
    }
    try {
        const response = await fetch('/api/admin/verify', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            const data = await response.json();
            currentAdmin = data.user || {};
            const emailEl = document.getElementById('adminEmailTop');
            if (emailEl) {
                emailEl.textContent = currentAdmin.email || 'Admin';
                emailEl.classList.remove('hidden');
            }
            return true;
        } else {
            localStorage.removeItem('adminToken');
            window.location.href = '/admin/login.html';
            return false;
        }
    } catch {
        window.location.href = '/admin/login.html';
        return false;
    }
}

// Fetch data
async function fetchData() {
    const token = localStorage.getItem('adminToken');
    try {
        const response = await fetch('/api/admin/data', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch data');
        return await response.json();
    } catch (error) {
        console.error('Data fetch error:', error);
        return { users: [], licenses: [] };
    }
}

// Render functions
function renderStats(data) {
    document.getElementById('statTotalUsers').textContent = data.users?.length || 0;
    document.getElementById('statActiveLicenses').textContent =
        data.licenses?.filter(l => l.status === 'active').length || 0;
    document.getElementById('statPendingPayments').textContent =
        data.licenses?.filter(l => l.status === 'pending').length || 0;
    document.getElementById('statDevices').textContent =
        data.users?.reduce((sum, u) => sum + (u.devices?.length || 0), 0) || 0;
}

function renderTable(view, page = 1) {
    currentPage = page;
    const data = view === 'users' ? allUsers : allLicenses;
    const totalPages = Math.ceil(data.length / pageSize);
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageData = data.slice(start, end);

    const headerEl = document.getElementById('dynamicTableHeader');
    headerEl.innerHTML = view === 'users'
        ? '<th>Email</th><th>Devices</th><th>Joined</th><th>Status</th><th>Actions</th>'
        : '<th>License Key</th><th>User</th><th>Plan</th><th>Expires</th><th>Status</th><th>Actions</th>';

    const bodyEl = document.getElementById('dynamicTableBody');
    if (pageData.length === 0) {
        bodyEl.innerHTML = '<tr><td colspan="5" class="text-center py-8 text-gray-500">No data found</td></tr>';
    } else {
        bodyEl.innerHTML = pageData.map(item => view === 'users'
            ? `<tr>
                <td>${item.email || 'N/A'}</td>
                <td>${item.devices?.length || 0}</td>
                <td>${item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'N/A'}</td>
                <td><span class="gold-badge">${item.status || 'active'}</span></td>
                <td><button class="action-btn px-3 py-1 rounded-lg text-sm">View</button></td>
               </tr>`
            : `<tr>
                <td class="license-key">${item.licenseKey || 'N/A'}</td>
                <td>${item.userEmail || 'N/A'}</td>
                <td>${item.plan || 'free'}</td>
                <td>${item.expiresAt ? new Date(item.expiresAt).toLocaleDateString() : 'Never'}</td>
                <td><span class="gold-badge">${item.status || 'active'}</span></td>
                <td><button class="action-btn px-3 py-1 rounded-lg text-sm">Manage</button></td>
               </tr>`
        ).join('');
    }

    renderPagination(totalPages, page);
}

function renderPagination(totalPages, currentPage) {
    const container = document.getElementById('paginationControls');
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="${i === currentPage ? 'active-page' : ''}" onclick="renderTable('${currentView}', ${i})">${i}</button>`;
    }
    container.innerHTML = html;
}

function setupEventListeners() {
    document.getElementById('logoutTop')?.addEventListener('click', () => {
        localStorage.removeItem('adminToken');
        window.location.href = '/admin/login.html';
    });

    document.getElementById('paginationSizeSelect')?.addEventListener('change', (e) => {
        pageSize = parseInt(e.target.value);
        currentPage = 1;
        renderTable(currentView, 1);
    });

    document.getElementById('statTotalUsersBox')?.addEventListener('click', () => {
        currentView = 'users';
        document.getElementById('panelTitle').innerHTML = '<i class="fas fa-users mr-2"></i>Registered Users';
        renderTable('users', 1);
    });

    document.getElementById('statActiveLicensesBox')?.addEventListener('click', () => {
        currentView = 'licenses';
        document.getElementById('panelTitle').innerHTML = '<i class="fas fa-key mr-2"></i>License Management';
        renderTable('licenses', 1);
    });
}

// Initialize app
async function init() {
    setupEventListeners();

    const isAuth = await checkAuth();
    if (!isAuth) return;

    const data = await fetchData();
    allUsers = data.users || [];
    allLicenses = data.licenses || [];

    renderStats(data);
    renderTable('users', 1);
}

// Start
document.addEventListener('DOMContentLoaded', init);
