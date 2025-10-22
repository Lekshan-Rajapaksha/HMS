// branch.js
const API_BASE_URL = "https://hms-production-a5ad.up.railway.app";

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem('clinicProToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const mainContent = document.getElementById("main-content");
    const navLinks = document.querySelectorAll(".nav-link");
    const toastContainer = document.querySelector(".toast-container");
    const formModal = new bootstrap.Modal(document.getElementById("formModal"));
    const formModalLabel = document.getElementById("formModalLabel");
    const formModalBody = document.getElementById("formModalBody");

    let currentViewData = [];
    let userProfile = {};

    const showToast = (message, type = 'success') => {
        const toastId = 'toast-' + Math.random().toString(36).substring(2, 9);
        const icon = type === 'success' ? 'check-circle-fill' : 'exclamation-triangle-fill';
        const toastHTML = `
            <div id="${toastId}" class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="d-flex">
                    <div class="toast-body"><i class="bi bi-${icon} me-2"></i>${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
            </div>`;
        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(document.getElementById(toastId), { delay: 4000 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    };

    const authorizedFetch = async (endpoint, options = {}) => {
        const defaultOptions = { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` } };
        const mergedOptions = { ...defaultOptions, ...options, headers: { ...defaultOptions.headers, ...options.headers } };
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, mergedOptions);
            if ([401, 403].includes(response.status)) {
                localStorage.removeItem('clinicProToken');
                window.location.href = 'login.html';
                return null;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            return response.status === 204 ? null : response.json();
        } catch (error) {
            console.error("Fetch error:", error);
            showToast(error.message, 'danger');
            return null;
        }
    };
    const renderSpinner = (target) => {
        if (target) target.innerHTML = `<div class="d-flex justify-content-center p-5"><div class="spinner-border text-primary"></div></div>`;
    };
    const submitForm = async (endpoint, method, data, callback) => {
        const filteredData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v != null && v !== ''));
        const result = await authorizedFetch(endpoint, { method, body: JSON.stringify(filteredData) });
        if (result !== null && callback) {
            formModal.hide();
            showToast(`Record has been ${method === 'POST' ? 'created' : 'updated'} successfully.`);
            callback();
        }
    };

    const createPageTemplate = (config) => {
        const { title, type, headers, showAddBtn = true, showSearch = true } = config;
        const typeName = type.split('-').join(' ');
        mainContent.innerHTML = `
            <div class="page-header">
                <h1>${title}</h1>
                <div class="d-flex align-items-center gap-2">
                    ${showSearch ? `<div class="search-wrapper"><input type="search" id="search-input" class="form-control" placeholder="Search..."></div>` : ''}
                    ${showAddBtn ? `<button class="btn btn-primary" data-action="add" data-type="${type}"><i class="bi bi-plus-lg me-1"></i> Add ${typeName.charAt(0).toUpperCase() + typeName.slice(1)}</button>` : ""}
                </div>
            </div>
            <div class="card"><div class="card-body"><div class="table-responsive">
                <table class="table table-hover">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}${headers.length > 0 ? '<th>Actions</th>' : ''}</tr></thead>
                    <tbody id="table-body"></tbody>
                </table>
            </div></div></div>`;
    };

    const setupSearch = (renderFunction, searchableKeys) => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const filteredData = !term ? currentViewData : currentViewData.filter(item => searchableKeys.some(key => item[key]?.toString().toLowerCase().includes(term)));
                renderFunction(filteredData);
            });
        }
    };

    const renderTable = (data, headers, rowGenerator, emptyMessage) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) {
            const colspan = headers.length > 0 ? headers.length + 1 : 1;
            tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-center p-5 text-muted">${emptyMessage}</td></tr>`;
            return;
        }
        tableBody.innerHTML = data.map(rowGenerator).join('');
    };

    // PAGE LOADERS & RENDERERS
    const loadDashboard = async () => {
        const stats = await authorizedFetch("/api/branch-manager/stats");
        if (!stats) { mainContent.innerHTML = `<div class="alert alert-danger">Could not load dashboard.</div>`; return; }
        mainContent.innerHTML = `
            <h1>Branch Dashboard</h1>
            <div class="row">
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-calendar-day fs-2 text-primary me-3"></i><div><div class="text-muted">Scheduled Today</div><div class="h5 fw-bold">${stats.scheduled_today}</div></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-calendar-check fs-2 text-success me-3"></i><div><div class="text-muted">Completed Today</div><div class="h5 fw-bold">${stats.completed_today}</div></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-calendar-x fs-2 text-danger me-3"></i><div><div class="text-muted">Cancelled Today</div><div class="h5 fw-bold">${stats.canceled_today || 0}</div></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-people-fill fs-2 text-info me-3"></i><div><div class="text-muted">Total Staff</div><div class="h5 fw-bold">${stats.staff}</div></div></div></div></div></div>
            </div>`;
    };

    const renderAppointmentsTable = (data) => {
        const statusColors = { Scheduled: 'primary', Completed: 'success', Cancelled: 'danger', Rescheduled: 'warning' };
        renderTable(data, ["ID", "Date", "Patient", "Doctor", "Status"],
            a => `<tr><td>${a.appointment_id}</td><td>${new Date(a.schedule_date).toLocaleString()}</td><td>${a.patient_name}</td><td>${a.doctor_name}</td><td><span class="badge bg-${statusColors[a.status] || 'secondary'}">${a.status}</span></td><td class="table-actions"><button class="btn btn-sm btn-outline-danger" data-action="cancel" data-type="appointment" data-id="${a.appointment_id}" title="Cancel Appointment"><i class="bi bi-calendar-x"></i></button></td></tr>`,
            "No appointments found for this branch."
        );
    };

    const loadAppointmentsPage = async () => {
        createPageTemplate({ title: "Branch Appointments", type: "appointment", headers: ["ID", "Date", "Patient", "Doctor", "Status"], showAddBtn: false });
        currentViewData = await authorizedFetch("/api/branch-manager/appointments");
        renderAppointmentsTable(currentViewData);
        setupSearch(renderAppointmentsTable, ['appointment_id', 'patient_name', 'doctor_name']);
    };

    const renderStaffTable = (data) => {
        renderTable(data, ["ID", "Name", "Role", "Contact"],
            s => `<tr><td>${s.staff_id}</td><td>${s.name} ${s.is_medical_staff ? '<i class="bi bi-heart-pulse text-primary" title="Medical Staff"></i>' : ""}</td><td>${s.role_name}</td><td>${s.contact_info}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="staff" data-id="${s.staff_id}"><i class="bi bi-pencil-fill"></i></button></td></tr>`,
            "No staff found for this branch."
        );
    };

    const loadStaffPage = async () => {
        createPageTemplate({ title: "Branch Staff", type: "staff", headers: ["ID", "Name", "Role", "Contact"] });
        currentViewData = await authorizedFetch("/api/branch-manager/staff");
        renderStaffTable(currentViewData)
        setupSearch(renderStaffTable, ['staff_id', 'name', 'role_name']);
    };

    const renderInvoicesTable = (data) => {
        const statusColors = { Paid: 'success', 'Partially Paid': 'warning', Pending: 'danger' };
        renderTable(data, ["ID", "Patient", "Total", "Due", "Status", "Due Date"],
            i => `<tr>
                <td>#${i.invoice_id}</td>
                <td>${i.patient_name}</td>
                <td>Rs.${parseFloat(i.total_amount).toFixed(2)}</td>
                <td>Rs.${parseFloat(i.due_amount).toFixed(2)}</td>
                <td><span class="badge bg-${statusColors[i.status] || 'secondary'}">${i.status}</span></td>
                <td>${new Date(i.due_date).toLocaleDateString()}</td>
                <td class="table-actions">
                    ${i.status !== 'Paid' ? `<button class="btn btn-sm btn-outline-success" data-action="pay" data-type="invoice" data-id="${i.invoice_id}" title="Record Payment"><i class="bi bi-cash-coin"></i></button>` : ''}
                </td>
            </tr>`,
            "No invoices found for this branch."
        );
    };

    const loadInvoicesPage = async () => {
        createPageTemplate({ title: "Branch Billing", type: "invoice", headers: ["ID", "Patient", "Total", "Due", "Status", "Due Date"], showAddBtn: false });
        renderSpinner(document.getElementById("table-body"));
        currentViewData = await authorizedFetch("/api/branch-manager/invoices");
        if (!currentViewData) return;
        renderInvoicesTable(currentViewData);
        setupSearch(renderInvoicesTable, ['invoice_id', 'patient_name', 'status']);
    };

    const loadReportsPage = async () => {
        mainContent.innerHTML = `<h1>Branch Reports</h1>`;
        const [revenue, balances] = await Promise.all([authorizedFetch('/api/branch-manager/reports/doctor-revenue'), authorizedFetch('/api/branch-manager/reports/outstanding-balances')]);
        mainContent.innerHTML += `
            <div class="row">
                <div class="col-lg-6 mb-4">
                    <div class="card">
                        <div class="card-header">Doctor Revenue (Paid Invoices)</div>
                        <div class="card-body">
                            <div class="table-responsive" id="revenue-report"></div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6 mb-4">
                    <div class="card">
                        <div class="card-header">Patients with Outstanding Balances</div>
                        <div class="card-body">
                           <div class="table-responsive" id="balances-report"></div>
                        </div>
                    </div>
                </div>
            </div>`;

        const revenueContainer = document.getElementById('revenue-report');
        if (revenue && revenue.length > 0) {
            revenueContainer.innerHTML = `<table class="table"><thead><tr><th>Doctor</th><th>Revenue</th></tr></thead><tbody>${revenue.map(r => `<tr><td>${r.doctor_name}</td><td>Rs.${parseFloat(r.total_revenue).toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
        } else {
            revenueContainer.innerHTML = `<p class="text-muted text-center p-3">No revenue data available.</p>`;
        }

        const balancesContainer = document.getElementById('balances-report');
        if (balances && balances.length > 0) {
            balancesContainer.innerHTML = `<table class="table"><thead><tr><th>Patient</th><th>Invoice ID</th><th>Amount Due</th></tr></thead><tbody>${balances.map(b => `<tr><td>${b.patient_name}</td><td>#${b.invoice_id}</td><td>Rs.${parseFloat(b.due_amount).toFixed(2)}</td></tr>`).join('')}</tbody></table>`;
        } else {
            balancesContainer.innerHTML = `<p class="text-muted text-center p-3">No outstanding balances.</p>`;
        }
    };

    // --- FORM HANDLERS ---
    // Replace the existing openStaffForm function with this one

// Replace the existing openStaffForm function in BOTH app.js and branch.js

const openStaffForm = async (id = null) => {
    const isEditing = id !== null;

    // Fetch all required lists and existing staff data (if editing)
    // Assumes GET /api/staff/:id now returns staffData.specialty_ids as an array e.g., [1, 5]
    const [roles, branches, specialties, staffData] = await Promise.all([
        authorizedFetch("/api/list/roles"),
        authorizedFetch("/api/list/branches"),
        authorizedFetch("/api/list/specialties"),
        isEditing ? authorizedFetch(`/api/staff/${id}`) : Promise.resolve({})
    ]);

    // Check if fetching any required data failed
    if (!roles || !branches || !specialties || (isEditing && !staffData)) {
        showToast('Could not fetch required data to open form.', 'danger');
        return;
    }
    // For Branch Manager: Filter out Admin/Manager roles when *adding* new staff
    // Assumes 'userProfile' is globally available in branch.js
    const isBranchManagerAdding = typeof userProfile !== 'undefined' && userProfile.branch_id && !isEditing;
    const availableRoles = isBranchManagerAdding
        ? roles.filter(r => !['admin', 'branch manager'].includes(r.name.toLowerCase()))
        : roles;


    formModalLabel.textContent = isEditing ? `Edit Staff: ${staffData.name}` : "Add New Staff";

    // --- Generate Specialty Checkboxes ---
    let specialtyCheckboxesHTML = '';
    if (specialties && specialties.length > 0) {
        specialtyCheckboxesHTML = specialties.map(spec => `
            <div class="form-check form-check-inline col-md-3 mb-2"> {/* Adjust layout */}
                <input class="form-check-input specialty-checkbox" type="checkbox" name="specialty_ids[]" value="${spec.specialty_id}" id="spec-${spec.specialty_id}"
                       ${isEditing && staffData.specialty_ids && staffData.specialty_ids.includes(spec.specialty_id) ? 'checked' : ''}>
                <label class="form-check-label" for="spec-${spec.specialty_id}">${spec.name}</label>
            </div>
        `).join('');
    } else {
        specialtyCheckboxesHTML = '<p class="text-muted">No specialties available to assign.</p>';
    }
    // ------------------------------------

    formModalBody.innerHTML = `<form id="modal-form">
        ${
            // Include hidden branch_id only for Branch Manager adding staff
            isBranchManagerAdding
            ? `<input type="hidden" name="branch_id" value="${userProfile.branch_id}">`
            : ''
        }
        <div class="row">
            <h5>Staff Details</h5>
            <div class="col-md-6 mb-3"><label>Full Name</label><input type="text" name="name" class="form-control" value="${staffData.name || ''}" required></div>
            <div class="col-md-6 mb-3"><label>Contact Info</label><input type="text" name="contact_info" class="form-control" value="${staffData.contact_info || ''}" required></div>
            ${
                // Show Branch dropdown only for Admin (or if Branch Manager context isn't defined)
                !isBranchManagerAdding
                ? `<div class="col-md-6 mb-3"><label>Branch</label><select name="branch_id" class="form-select" required>${createOptions(branches, "branch_id", "name", staffData.branch_id)}</select></div>`
                : '' // Branch Manager's branch is set via hidden input or backend logic
            }
            <div class="col-md-6 mb-3 pt-3 form-check"><input type="checkbox" name="is_medical_staff" class="form-check-input" value="1" ${staffData.is_medical_staff ? 'checked' : ''}><label class="form-check-label">Is Medical Staff</label></div>
        </div>
        <hr>
        <h5>Account Details</h5>
        <div class="row">
            <div class="col-md-6 mb-3"><label>Username</label><input type="text" name="username" class="form-control" value="${staffData.username || ''}" required></div>
            <div class="col-md-6 mb-3"><label>Email</label><input type="email" name="email" class="form-control" value="${staffData.email || ''}" required></div>
            <div class="col-md-6 mb-3"><label>Role</label><select name="role_id" class="form-select" required>${createOptions(availableRoles, "role_id", "name", staffData.role_id)}</select></div>
            <div class="col-md-6 mb-3"><label>Password</label><input type="password" name="password" class="form-control" placeholder="${isEditing ? 'Leave blank to keep unchanged' : ''}" ${!isEditing ? 'required' : ''}></div>
        </div>
        <hr>
        <div id="specialty-container" class="mb-3 d-none">
             <h5>Specialties (for Doctors)</h5>
             <div class="row"> {/* Use row for better checkbox layout */}
                ${specialtyCheckboxesHTML}
             </div>
        </div>

        <div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save</button></div>
    </form>`;

    formModal.show();

    const form = document.getElementById("modal-form");
    const roleSelect = form.querySelector('[name="role_id"]');
    const specialtyContainer = document.getElementById('specialty-container');

    // Function to show/hide specialty checkboxes based on role
    const toggleSpecialty = () => {
        const selectedRoleText = roleSelect.options[roleSelect.selectedIndex]?.text.toLowerCase();
        specialtyContainer.classList.toggle('d-none', selectedRoleText !== 'doctor');
    };

    roleSelect.onchange = toggleSpecialty;
    toggleSpecialty(); // Run on form load to set initial state

    // --- Handle form submission ---
    form.onsubmit = e => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries()); // Basic key-value pairs

        // --- Manually collect checked specialty IDs ---
        const selectedSpecialtyIds = [];
        const specialtyCheckboxes = form.querySelectorAll('.specialty-checkbox:checked');
        specialtyCheckboxes.forEach(checkbox => {
            selectedSpecialtyIds.push(checkbox.value); // Collect values
        });
        // Add the array to the data payload (use the key your backend expects, e.g., "specialty_ids")
        data.specialty_ids = selectedSpecialtyIds;
        // Clean up the placeholder key if FormData created it
        delete data['specialty_ids[]'];
        // -------------------------------------------


        // If the role is not 'Doctor', remove the specialty_ids
        const selectedRoleText = roleSelect.options[roleSelect.selectedIndex]?.text.toLowerCase();
        if (selectedRoleText !== 'doctor') {
            delete data.specialty_ids;
        } else {
             // If it IS a doctor but NO specialties selected, send empty array if backend needs it
             // Or delete if backend handles absence correctly
             if (!data.specialty_ids || data.specialty_ids.length === 0) {
                 // Option 1: Send empty array
                  data.specialty_ids = [];
                 // Option 2: Delete the key (choose based on backend)
                 // delete data.specialty_ids;
             }
        }


        // On edit, if password field is empty, don't send it
        if (isEditing && !data.password) {
            delete data.password;
        }

        // Handle checkbox 'is_medical_staff'
        data.is_medical_staff = formData.has('is_medical_staff') ? '1' : '0';

        // Determine correct refresh function based on context (Admin vs Branch Manager)
        const refreshFunction = (typeof userProfile !== 'undefined' && userProfile.branch_id) ? loadStaffPage : loadStaffPage; // Assuming loadStaffPage works for both, adjust if needed


        submitForm(
            isEditing ? `/api/staff/${id}` : "/api/staff",
            isEditing ? "PUT" : "POST",
            data,
            refreshFunction // Use determined refresh function
        );
    };
};

    const openPaymentForm = async (invoiceId) => {
        formModalLabel.textContent = `Record Payment for Invoice #${invoiceId}`;
        formModalBody.innerHTML = `<form id="modal-form"><div class="mb-3"><label>Amount</label><input type="number" step="0.01" name="paid_amount" class="form-control" required></div><div class="mb-3"><label>Method</label><select name="method_of_payment" class="form-select"><option>Cash</option><option>Credit Card</option><option>Bank Transfer</option></select></div><div class="mb-3"><label>Date</label><input type="date" name="payment_date" class="form-control" value="${new Date().toISOString().split("T")[0]}" required></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Record</button></div></form>`;
        formModal.show();
        document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); submitForm(`/api/branch-manager/invoices/${invoiceId}/payments`, "POST", Object.fromEntries(new FormData(e.target)), loadInvoicesPage); };
    };

    // --- ROUTING & INIT ---
    const pageLoaders = { dashboard: loadDashboard, appointments: loadAppointmentsPage, staff: loadStaffPage, invoices: loadInvoicesPage, reports: loadReportsPage };
    const navigateTo = (page) => { navLinks.forEach(link => link.classList.toggle("active", link.dataset.page === page)); (pageLoaders[page] || pageLoaders.dashboard)(); };

    document.querySelector(".sidebar").addEventListener("click", e => { const navLink = e.target.closest(".nav-link"); if (navLink) { e.preventDefault(); navigateTo(navLink.dataset.page); } });
    document.getElementById('logout-button').addEventListener('click', () => { localStorage.removeItem('clinicProToken'); window.location.href = 'login.html'; });

    mainContent.addEventListener("click", (e) => {
        const target = e.target.closest("button[data-action]");
        if (!target) return;
        const { action, type, id } = target.dataset;

        if (action === "cancel" && type === "appointment") {
            if (confirm("Are you sure you want to cancel this appointment?")) {
                authorizedFetch(`/api/branch-manager/appointments/${id}`, { method: 'DELETE' }).then(res => {
                    if (res !== null) { showToast('Appointment cancelled.'); loadAppointmentsPage(); }
                });
            }
        }
        if (action === "edit" && type === "staff") openStaffForm(id);
        if (action === "add" && type === "staff") openStaffForm();
        if (action === "pay" && type === "invoice") openPaymentForm(id);
    });

    const initializeDashboard = async () => {
        userProfile = await authorizedFetch("/api/branch-manager/profile");
        if (userProfile) {
            document.getElementById('manager-name').textContent = userProfile.staff_name;
            document.getElementById('branch-name').textContent = userProfile.branch_name;
            navigateTo("dashboard");
        }
    };


    initializeDashboard();
});

