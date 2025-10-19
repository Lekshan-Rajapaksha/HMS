// app.js

const API_BASE_URL = "http://localhost:3000";

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
    const detailsModal = new bootstrap.Modal(document.getElementById("detailsModal"));
    const detailsModalLabel = document.getElementById("detailsModalLabel");
    const detailsModalBody = document.getElementById("detailsModalBody");

    let currentViewData = [];

    // --- GENERIC HELPER FUNCTIONS ---
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
        const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
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

    const submitForm = async (endpoint, method, data, callback) => {
        const filteredData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v != null && v !== ''));
        const result = await authorizedFetch(endpoint, { method, body: JSON.stringify(filteredData) });
        if (result !== null && callback) {
            formModal.hide();
            showToast(`Record has been ${method === 'POST' ? 'created' : 'updated'} successfully.`);
            callback();
        }
    };

    const deleteItem = async (endpoint, typeName, refreshCallback) => {
        if (confirm(`Are you sure you want to delete this ${typeName}?`)) {
            const result = await authorizedFetch(endpoint, { method: "DELETE" });
            if (result === null) {
                showToast(`${typeName.charAt(0).toUpperCase() + typeName.slice(1)} deleted successfully.`);
                refreshCallback();
            }
        }
    };

    const createOptions = (items, valueField, textField, selectedValue) => items.map(item => `<option value="${item[valueField]}" ${item[valueField] == selectedValue ? "selected" : ""}>${item[textField]}</option>`).join("");
    const renderSpinner = (target = mainContent) => target.innerHTML = `<div class="d-flex justify-content-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>`;

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
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}<th>Actions</th></tr></thead>
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

    // --- RENDER FUNCTIONS ---
    const renderTable = (data, headers, rowGenerator, emptyMessage) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { tableBody.innerHTML = `<tr><td colspan="${headers.length + 1}" class="text-center p-5 text-muted">${emptyMessage}</td></tr>`; return; }
        tableBody.innerHTML = data.map(rowGenerator).join('');
    };

    const renderPatientsTable = data => renderTable(data, ["ID", "Name", "Age", "Contact"], p => `<tr><td>${p.patient_id}</td><td>${p.name}</td><td>${p.age}</td><td>${p.contact_info || ""}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="patient" data-id="${p.patient_id}"><i class="bi bi-pencil-fill"></i></button></td></tr>`, "No patients found.");
    const renderStaffTable = data => renderTable(data, ["ID", "Name", "Role", "Branch"], s => `<tr><td>${s.staff_id}</td><td>${s.name} ${s.is_medical_staff ? '<i class="bi bi-heart-pulse text-primary" title="Medical Staff"></i>' : ""}</td><td>${s.role_name}</td><td>${s.branch_name || 'N/A'}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="staff" data-id="${s.staff_id}"><i class="bi bi-pencil-fill"></i></button></td></tr>`, "No staff found.");
    const renderBranchesTable = data => renderTable(data, ["ID", "Name", "Address", "Contact"], b => `<tr><td>${b.branch_id}</td><td>${b.name}</td><td>${b.address || ''}</td><td>${b.contact_number || ''}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="branch" data-id="${b.branch_id}"><i class="bi bi-pencil-fill"></i></button></td></tr>`, "No branches found.");
    const renderProvidersTable = data => renderTable(data, ["ID", "Name", "Contact Number"], i => `<tr><td>${i.id}</td><td>${i.name}</td><td>${i.contact_number}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="insurance-provider" data-id="${i.id}"><i class="bi bi-pencil-fill"></i></button></td></tr>`, "No insurance providers found.");
    const renderTreatmentsTable = data => renderTable(data, ["Code", "Name", "Price"], t => `<tr><td>${t.service_code}</td><td>${t.name}</td><td>$${parseFloat(t.price).toFixed(2)}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="treatment" data-id="${t.service_code}"><i class="bi bi-pencil-fill"></i></button></td></tr>`, "No treatments found.");
    const renderSpecialtiesTable = data => renderTable(data, ["ID", "Name", "Description"], s => `<tr><td>${s.specialty_id}</td><td>${s.name}</td><td>${s.description || ''}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="specialty" data-id="${s.specialty_id}"><i class="bi bi-pencil-fill"></i></button></td></tr>`, "No specialties found.");

    // --- PAGE LOADERS ---
    const loadDashboard = async () => {
        renderSpinner();
        const [summary, invoices] = await Promise.all([authorizedFetch("/api/stats/summary"), authorizedFetch("/api/invoices")]);
        if (!summary) { mainContent.innerHTML = `<div class="alert alert-danger">Could not load dashboard stats.</div>`; return; }

        mainContent.innerHTML = `
            <h1>Dashboard</h1>
            <div class="row">
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-people-fill fs-2 text-primary me-3"></i><div><div class="text-muted">Total Patients</div><div class="h5 fw-bold">${summary.patients}</div></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-calendar-check-fill fs-2 text-success me-3"></i><div><div class="text-muted">Scheduled Appointments</div><div class="h5 fw-bold">${summary.appointments}</div></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-heart-pulse-fill fs-2 text-info me-3"></i><div><div class="text-muted">Active Doctors</div><div class="h5 fw-bold">${summary.doctors}</div></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-cash-stack fs-2 text-warning me-3"></i><div><div class="text-muted">Total Revenue</div><div class="h5 fw-bold">$${(invoices?.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) - parseFloat(inv.due_amount)), 0) || 0).toFixed(2)}</div></div></div></div></div></div>
            </div>`;
    };

    const loadReportsPage = () => {
        mainContent.innerHTML = `
            <h1>Reports</h1>
            <p class="text-muted">Select a report to view details.</p>
            <div class="list-group">
                <a href="#" class="list-group-item list-group-item-action" data-report="branch-summary"><i class="bi bi-building-fill me-2"></i>Branch Appointment Summary</a>
                <a href="#" class="list-group-item list-group-item-action" data-report="doctor-revenue"><i class="bi bi-person-hearts me-2"></i>Doctor Revenue Report</a>
                <a href="#" class="list-group-item list-group-item-action" data-report="outstanding-patients"><i class="bi bi-person-exclamation me-2"></i>Patients with Outstanding Balances</a>
                <a href="#" class="list-group-item list-group-item-action" data-report="treatment-stats"><i class="bi bi-card-list me-2"></i>Treatment Statistics</a>
                <a href="#" class="list-group-item list-group-item-action" data-report="insurance-analysis"><i class="bi bi-shield-check me-2"></i>Insurance Coverage Analysis</a>
            </div>`;
    };

    const loadAndRenderReport = async (reportName, title, headers, rowGenerator) => {
        detailsModalLabel.textContent = title;
        renderSpinner(detailsModalBody);
        detailsModal.show();
        const data = await authorizedFetch(`/api/reports/${reportName}`);
        if (data) {
            detailsModalBody.innerHTML = `<div class="table-responsive"><table class="table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${data.map(rowGenerator).join('')}</tbody></table></div>`;
        } else {
            detailsModalBody.innerHTML = `<p class="text-center p-4">Could not load report data.</p>`;
        }
    };

    const loadPatientsPage = async () => { createPageTemplate({ title: "Patients", type: "patient", headers: ["ID", "Name", "Age", "Contact"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/patients"); renderPatientsTable(currentViewData); setupSearch(renderPatientsTable, ['patient_id', 'name', 'contact_info']); };
    const loadStaffPage = async () => { createPageTemplate({ title: "Staff", type: "staff", headers: ["ID", "Name", "Role", "Branch"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/staff"); renderStaffTable(currentViewData); setupSearch(renderStaffTable, ['staff_id', 'name', 'role_name', 'branch_name']); };
    const loadBranchesPage = async () => { createPageTemplate({ title: "Branches", type: "branch", headers: ["ID", "Name", "Address", "Contact"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/branches"); renderBranchesTable(currentViewData); setupSearch(renderBranchesTable, ['branch_id', 'name', 'address']); };
    const loadInsuranceProvidersPage = async () => { createPageTemplate({ title: "Insurance Providers", type: "insurance-provider", headers: ["ID", "Name", "Contact"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/insurance-providers"); renderProvidersTable(currentViewData); setupSearch(renderProvidersTable, ['id', 'name']); };
    const loadTreatmentsPage = async () => { createPageTemplate({ title: "Treatment Catalogue", type: "treatment", headers: ["Code", "Name", "Price"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/treatments"); renderTreatmentsTable(currentViewData); setupSearch(renderTreatmentsTable, ['service_code', 'name']); };
    const loadSpecialtiesPage = async () => { createPageTemplate({ title: "Doctor Specialties", type: "specialty", headers: ["ID", "Name", "Description"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/specialties"); renderSpecialtiesTable(currentViewData); setupSearch(renderSpecialtiesTable, ['name', 'description']); };

    // --- FORM HANDLERS ---
    const openPatientForm = async (id = null) => {
        const isEditing = id !== null;
        const [patient, providers] = await Promise.all([isEditing ? authorizedFetch(`/api/patients/${id}`) : Promise.resolve({}), authorizedFetch("/api/list/insurance-providers")]);
        formModalLabel.textContent = isEditing ? "Edit Patient" : "Add Patient";
        formModalBody.innerHTML = `<form id="modal-form">
            <div class="row"><div class="col-md-6 mb-3"><label class="form-label">Name</label><input type="text" class="form-control" name="name" value="${patient.name || ""}" required></div><div class="col-md-6 mb-3"><label class="form-label">Gender</label><select class="form-select" name="gender"><option value="Male" ${patient.gender === "Male" ? "selected" : ""}>Male</option><option value="Female" ${patient.gender === "Female" ? "selected" : ""}>Female</option></select></div><div class="col-md-6 mb-3"><label class="form-label">Date of Birth</label><input type="date" class="form-control" name="date_of_birth" value="${patient.date_of_birth?.split("T")[0] || ""}" required></div><div class="col-md-6 mb-3"><label class="form-label">Contact</label><input type="text" class="form-control" name="contact_info" value="${patient.contact_info || ""}"></div></div><hr><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Insurance Provider</label><select class="form-select" name="insurance_provider_id"><option value="">None</option>${createOptions(providers, "id", "name", patient.insurance_provider_id)}</select></div><div class="col-md-6 mb-3"><label class="form-label">Policy Number</label><input type="text" class="form-control" name="policy_number" value="${patient.policy_number || ""}"></div></div>
            <div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save</button></div></form>`;
        formModal.show();
        document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); submitForm(isEditing ? `/api/patients/${id}` : "/api/patients", isEditing ? "PUT" : "POST", Object.fromEntries(new FormData(e.target)), loadPatientsPage); };
    };

    const openBranchForm = async (id = null) => {
        const isEditing = id !== null;
        if (isEditing) {
            const [data, managers] = await Promise.all([authorizedFetch(`/api/branches/${id}`), authorizedFetch(`/api/staff/managers`)]);
            formModalLabel.textContent = "Edit Branch";
            formModalBody.innerHTML = `<form id="modal-form"><div class="mb-3"><label class="form-label">Name</label><input type="text" class="form-control" name="name" value="${data.name || ''}" required></div><div class="mb-3"><label class="form-label">Address</label><input type="text" class="form-control" name="address" value="${data.address || ''}"></div><div class="mb-3"><label class="form-label">Contact Number</label><input type="text" class="form-control" name="contact_number" value="${data.contact_number || ''}"></div><hr><div class="mb-3"><label class="form-label">Branch Manager</label><select class="form-select" name="manager_user_id"><option value="">No Manager</option>${createOptions(managers, "user_id", "name", data.manager_user_id)}</select></div><div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save Changes</button></div></form>`;
            document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); submitForm(`/api/branches/${id}`, "PUT", Object.fromEntries(new FormData(e.target)), loadBranchesPage); };
        } else {
            formModalLabel.textContent = "Add New Branch";
            formModalBody.innerHTML = `<form id="modal-form"><h5>Branch Details</h5><div class="row"><div class="col-md-12 mb-3"><label class="form-label">Branch Name</label><input type="text" class="form-control" name="name" required></div><div class="col-md-6 mb-3"><label class="form-label">Address</label><input type="text" class="form-control" name="address"></div><div class="col-md-6 mb-3"><label class="form-label">Contact</label><input type="text" class="form-control" name="contact_number"></div></div><hr><h5>Branch Manager Details</h5><p class="text-muted small">Creates a new staff account for the manager.</p><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Manager Name</label><input type="text" class="form-control" name="manager_name" required></div><div class="col-md-6 mb-3"><label class="form-label">Manager Contact</label><input type="text" class="form-control" name="manager_contact_info" required></div><div class="col-md-6 mb-3"><label class="form-label">Username</label><input type="text" class="form-control" name="manager_username" required></div><div class="col-md-6 mb-3"><label class="form-label">Email</label><input type="email" class="form-control" name="manager_email" required></div><div class="col-md-6 mb-3"><label class="form-label">Password</label><input type="password" class="form-control" name="manager_password" required></div></div><div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Create</button></div></form>`;
            document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); submitForm("/api/branches", "POST", Object.fromEntries(new FormData(e.target)), loadBranchesPage); };
        }
        formModal.show();
    };

    const openStaffForm = async (id = null) => {
        if (id) { showToast('Editing staff details is not permitted for this role.', 'warning'); return; }
        const [roles, branches, specialties] = await Promise.all([authorizedFetch("/api/list/roles"), authorizedFetch("/api/list/branches"), authorizedFetch("/api/list/specialties")]);
        formModalLabel.textContent = "Add New Staff";
        formModalBody.innerHTML = `<form id="modal-form"><div class="row"><div class="col-md-6 mb-3"><label>Full Name</label><input type="text" name="name" class="form-control" required></div><div class="col-md-6 mb-3"><label>Contact Info</label><input type="text" name="contact_info" class="form-control" required></div><div class="col-md-6 mb-3"><label>Username</label><input type="text" name="username" class="form-control" required></div><div class="col-md-6 mb-3"><label>Email</label><input type="email" name="email" class="form-control" required></div><div class="col-md-6 mb-3"><label>Password</label><input type="password" name="password" class="form-control" required></div><div class="col-md-6 mb-3"><label>Role</label><select name="role_id" class="form-select" required>${createOptions(roles, "role_id", "name")}</select></div><div class="col-md-6 mb-3"><label>Branch</label><select name="branch_id" class="form-select" required>${createOptions(branches, "branch_id", "name")}</select></div><div class="col-md-6 mb-3 d-none" id="specialty-container"><label>Specialty</label><select name="specialty_id" class="form-select">${createOptions(specialties, "specialty_id", "name")}</select></div></div><div class="mb-3 form-check"><input type="checkbox" name="is_medical_staff" class="form-check-input" value="1"><label class="form-check-label">Is Medical Staff</label></div><div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Create</button></div></form>`;
        formModal.show();
        const roleSelect = formModalBody.querySelector('[name="role_id"]');
        roleSelect.onchange = e => document.getElementById('specialty-container').classList.toggle('d-none', e.target.selectedOptions[0].text.toLowerCase() !== 'doctor');
        document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); submitForm("/api/staff", "POST", Object.fromEntries(new FormData(e.target)), loadStaffPage); };
    };

    const openSimpleForm = async (type, id = null) => {
        const isEditing = id !== null;
        const data = isEditing ? await authorizedFetch(`/api/${type}s/${id}`) : {};
        const title = `${isEditing ? 'Edit' : 'Add'} ${type.replace('-', ' ')}`;
        let formFields;
        switch (type) {
            case 'insurance-provider': formFields = `<div class="mb-3"><label>Name</label><input type="text" class="form-control" name="name" value="${data.name || ''}" required></div><div class="mb-3"><label>Contact</label><input type="text" class="form-control" name="contact_number" value="${data.contact_number || ''}"></div>`; break;
            case 'treatment': formFields = `<div class="row"><div class="col-md-6 mb-3"><label>Service Code</label><input type="text" class="form-control" name="service_code" value="${data.service_code || ''}" ${isEditing ? 'readonly' : 'required'}></div><div class="col-md-6 mb-3"><label>Name</label><input type="text" class="form-control" name="name" value="${data.name || ''}" required></div></div><div class="mb-3"><label>Price</label><input type="number" step="0.01" class="form-control" name="price" value="${data.price || ''}" required></div><div class="mb-3"><label>Description</label><textarea class="form-control" name="description">${data.description || ''}</textarea></div>`; break;
            case 'specialty': formFields = `<div class="mb-3"><label>Name</label><input type="text" class="form-control" name="name" value="${data.name || ''}" required></div><div class="mb-3"><label>Description</label><textarea class="form-control" name="description">${data.description || ''}</textarea></div>`; break;
        }
        formModalLabel.textContent = title;
        formModalBody.innerHTML = `<form id="modal-form">${formFields}<div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save</button></div></form>`;
        formModal.show();
        const endpoint = isEditing ? `/api/${type}s/${id}` : `/api/${type}s`;
        const loader = pageLoaders[type + 's'];
        document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); submitForm(endpoint, isEditing ? 'PUT' : 'POST', Object.fromEntries(new FormData(e.target)), loader); };
    };

    // --- ROUTING & EVENT LISTENERS ---
    const pageLoaders = { dashboard: loadDashboard, reports: loadReportsPage, patients: loadPatientsPage, staff: loadStaffPage, branches: loadBranchesPage, "insurance-providers": loadInsuranceProvidersPage, treatments: loadTreatmentsPage, specialties: loadSpecialtiesPage };
    const navigateTo = (page) => { navLinks.forEach(link => link.classList.toggle("active", link.dataset.page === page)); (pageLoaders[page] || pageLoaders.dashboard)(); };
    document.querySelector(".sidebar").addEventListener("click", e => { const navLink = e.target.closest(".nav-link"); if (navLink) { e.preventDefault(); navigateTo(navLink.dataset.page); } });
    document.getElementById('logout-button').addEventListener('click', () => { localStorage.removeItem('clinicProToken'); window.location.href = 'login.html'; });

    mainContent.addEventListener("click", (e) => {
        const actionTarget = e.target.closest("[data-action]");
        const reportTarget = e.target.closest("[data-report]");
        if (reportTarget) {
            e.preventDefault();
            const reportName = reportTarget.dataset.report;
            const reportConfig = {
                'branch-summary': { title: 'Branch Summary', headers: ['Branch', 'Date', 'Total', 'Scheduled', 'Completed', 'Cancelled'], generator: r => `<tr><td>${r.branch_name}</td><td>${new Date(r.appointment_date).toLocaleDateString()}</td><td>${r.total_appointments}</td><td>${r.scheduled}</td><td>${r.completed}</td><td>${r.cancelled}</td></tr>` },
                'doctor-revenue': { title: 'Doctor Revenue', headers: ['Doctor', 'Specialty', 'Appointments', 'Total Revenue'], generator: r => `<tr><td>${r.doctor_name}</td><td>${r.specialty}</td><td>${r.total_appointments}</td><td>$${parseFloat(r.total_revenue || 0).toFixed(2)}</td></tr>` },
                'outstanding-patients': { title: 'Outstanding Balances', headers: ['Patient', 'Contact', 'Total Billed', 'Total Outstanding'], generator: r => `<tr><td>${r.patient_name}</td><td>${r.contact_info}</td><td>$${parseFloat(r.total_billed).toFixed(2)}</td><td>$${parseFloat(r.total_outstanding).toFixed(2)}</td></tr>` },
                'treatment-stats': { title: 'Treatment Statistics', headers: ['Treatment', 'Month', 'Times Performed', 'Total Revenue'], generator: r => `<tr><td>${r.treatment_name}</td><td>${r.month}</td><td>${r.times_performed}</td><td>$${parseFloat(r.total_revenue).toFixed(2)}</td></tr>` },
                'insurance-analysis': { title: 'Insurance Analysis', headers: ['Provider', 'Patients', 'Total Billed', 'Total Covered'], generator: r => `<tr><td>${r.insurance_provider}</td><td>${r.total_patients}</td><td>$${parseFloat(r.total_billed).toFixed(2)}</td><td>$${parseFloat(r.total_insurance_coverage).toFixed(2)} (${r.avg_coverage_percent}%)</td></tr>` },
            };
            loadAndRenderReport(reportName, reportConfig[reportName].title, reportConfig[reportName].headers, reportConfig[reportName].generator);
        }
        if (!actionTarget) return;

        const { action, type, id } = actionTarget.dataset;
        const entityMap = {
            patient: { handler: openPatientForm },
            staff: { handler: openStaffForm },
            branch: { handler: openBranchForm },
            'insurance-provider': { handler: openSimpleForm.bind(null, 'insurance-provider') },
            treatment: { handler: openSimpleForm.bind(null, 'treatment') },
            specialty: { handler: openSimpleForm.bind(null, 'specialty') }
        };

        if (action === "add" || action === "edit") {
            entityMap[type]?.handler(id);
        }
    });

    navigateTo("dashboard");
});
