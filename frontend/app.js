// app.js

const API_BASE_URL = "https://hms-production-a5ad.up.railway.app";

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem('clinicProToken');
    if (!token) {
        window.location.href = 'admin.html';
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
                window.location.href = 'index.html';
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
    const renderBranchesTable = data => renderTable(data, ["ID", "Name", "Address", "Contact"], b => `<tr><td>${b.branch_id}</td><td>${b.name}</td><td>${b.address || ''}</td><td>${b.contact_number || ''}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="branch" data-id="${b.branch_id}"><i class="bi bi-pencil-fill"></i></button></td></tr>`, "No branches found.");
    const renderProvidersTable = data => renderTable(data, ["ID", "Name", "Contact Number"], i => `<tr><td>${i.id}</td><td>${i.name}</td><td>${i.contact_number}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="insurance-provider" data-id="${i.id}"><i class="bi bi-pencil-fill"></i></button></td></tr>`, "No insurance providers found.");
    const renderTreatmentsTable = data => renderTable(data, ["Code", "Name", "Price"], t => `<tr><td>${t.service_code}</td><td>${t.name}</td><td>Rs.${parseFloat(t.price).toFixed(2)}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="treatment" data-id="${t.service_code}"><i class="bi bi-pencil-fill"></i></button></td></tr>`, "No treatments found.");
    const renderSpecialtiesTable = data => renderTable(data, ["ID", "Name", "Description"], s => `<tr><td>${s.specialty_id}</td><td>${s.name}</td><td>${s.description || ''}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="specialty" data-id="${s.specialty_id}"><i class="bi bi-pencil-fill"></i></button></td></tr>`, "No specialties found.");
    // [ADD THIS NEW FUNCTION]
    const renderStaffAccordions = (data) => {
        const container = document.getElementById("staff-accordion-container");
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `<div class="text-center p-5 text-muted">No staff found.</div>`;
            return;
        }

        // 1. Group by Branch
        const branches = {};
        data.forEach(staff => {
            if (!branches[staff.branch_name]) {
                branches[staff.branch_name] = [];
            }
            branches[staff.branch_name].push(staff);
        });

        let accordionHTML = '<div class="accordion" id="staff-accordion">';
        let firstBranch = true;

        // 2. Loop through branches to create accordion items
        for (const branchName in branches) {
            const staffInBranch = branches[branchName];
            const accordionId = `branch-${branchName.replace(/\s+/g, '-')}`;

            // Group staff in this branch by role
            const roles = {};
            staffInBranch.forEach(staff => {
                if (!roles[staff.role_name]) {
                    roles[staff.role_name] = [];
                }
                roles[staff.role_name].push(staff);
            });

            accordionHTML += `
            <div class="accordion-item">
                <h2 class="accordion-header" id="heading-${accordionId}">
                    <button class="accordion-button ${firstBranch ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${accordionId}">
                        ${branchName} <span class="badge bg-primary ms-2">${staffInBranch.length} Staff</span>
                    </button>
                </h2>
                <div id="collapse-${accordionId}" class="accordion-collapse collapse ${firstBranch ? 'show' : ''}" data-bs-parent="#staff-accordion">
                    <div class="accordion-body">
        `;

            // 3. Loop through roles to create tables
            for (const roleName in roles) {
                const staffInRole = roles[roleName];
                accordionHTML += `<h5 class="role-subheader">${roleName}s</h5>`;
                accordionHTML += `
                <div class="table-responsive mb-3">
                    <table class="table table-sm table-hover">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Contact</th>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
                // 4. Add staff members as rows
                staffInRole.forEach(s => {
                    accordionHTML += `
                    <tr>
                        <td>${s.staff_id}</td>
                        <td>${s.name} ${s.is_medical_staff ? '<i class="bi bi-heart-pulse text-primary" title="Medical Staff"></i>' : ""}</td>
                        <td>${s.contact_info || ''}</td>
                        <td>${s.username || ''}</td>
                        <td>${s.email || ''}</td>
                        <td class="table-actions">
                            <button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="staff" data-id="${s.staff_id}"><i class="bi bi-pencil-fill"></i></button>
                            <button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="staff" data-id="${s.staff_id}"><i class="bi bi-trash-fill"></i></button>
                        </td>
                    </tr>
                `;
                });

                accordionHTML += `</tbody></table></div>`;
            }

            accordionHTML += `</div></div></div>`;
            firstBranch = false;
        }

        accordionHTML += `</div>`;
        container.innerHTML = accordionHTML;
    };
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
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-cash-stack fs-2 text-warning me-3"></i><div><div class="text-muted">Total Revenue</div><div class="h5 fw-bold">Rs.${(invoices?.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) - parseFloat(inv.due_amount)), 0) || 0).toFixed(2)}</div></div></div></div></div></div>
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
    const loadBranchesPage = async () => { createPageTemplate({ title: "Branches", type: "branch", headers: ["ID", "Name", "Address", "Contact"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/branches"); renderBranchesTable(currentViewData); setupSearch(renderBranchesTable, ['branch_id', 'name', 'address']); };
    const loadInsuranceProvidersPage = async () => { createPageTemplate({ title: "Insurance Providers", type: "insurance-provider", headers: ["ID", "Name", "Contact"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/insurance-providers"); renderProvidersTable(currentViewData); setupSearch(renderProvidersTable, ['id', 'name']); };
    const loadTreatmentsPage = async () => { createPageTemplate({ title: "Treatment Catalogue", type: "treatment", headers: ["Code", "Name", "Price"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/treatments"); renderTreatmentsTable(currentViewData); setupSearch(renderTreatmentsTable, ['service_code', 'name']); };
    const loadSpecialtiesPage = async () => { createPageTemplate({ title: "Doctor Specialties", type: "specialty", headers: ["ID", "Name", "Description"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/specialties"); renderSpecialtiesTable(currentViewData); setupSearch(renderSpecialtiesTable, ['name', 'description']); };
    // [WITH THIS]
    const loadStaffPage = async () => {
        // 1. Manually create the page structure (no createPageTemplate)
        mainContent.innerHTML = `
        <div class="page-header">
            <h1>Staff Management</h1>
            <div class="d-flex align-items-center gap-2">
                <div class="search-wrapper">
                    <input type="search" id="search-input" class="form-control" placeholder="Search staff...">
                </div>
                <button class="btn btn-primary" data-action="add" data-type="staff">
                    <i class="bi bi-plus-lg me-1"></i> Add Staff
                </button>
            </div>
        </div>
        <div class="card">
            <div class="card-body">
                <div id="staff-accordion-container"></div>
            </div>
        </div>
    `;

        // 2. Show spinner, fetch data
        const container = document.getElementById("staff-accordion-container");
        renderSpinner(container);
        currentViewData = await authorizedFetch("/api/staff");

        // 3. Render the accordion
        renderStaffAccordions(currentViewData);

        // 4. Setup search
        setupSearch(renderStaffAccordions, ['name', 'role_name', 'branch_name', 'username', 'email']);
    };
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

    // [New openStaffForm function]
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
                'doctor-revenue': { title: 'Doctor Revenue', headers: ['Doctor', 'Specialty', 'Appointments', 'Total Revenue'], generator: r => `<tr><td>${r.doctor_name}</td><td>${r.specialty}</td><td>${r.total_appointments}</td><td>Rs.${parseFloat(r.total_revenue || 0).toFixed(2)}</td></tr>` },
                'outstanding-patients': { title: 'Outstanding Balances', headers: ['Patient', 'Contact', 'Total Billed', 'Total Outstanding'], generator: r => `<tr><td>${r.patient_name}</td><td>${r.contact_info}</td><td>Rs.${parseFloat(r.total_billed).toFixed(2)}</td><td>Rs.${parseFloat(r.total_outstanding).toFixed(2)}</td></tr>` },
                'treatment-stats': { title: 'Treatment Statistics', headers: ['Treatment', 'Month', 'Times Performed', 'Total Revenue'], generator: r => `<tr><td>${r.treatment_name}</td><td>${r.month}</td><td>${r.times_performed}</td><td>Rs.${parseFloat(r.total_revenue).toFixed(2)}</td></tr>` },
                'insurance-analysis': { title: 'Insurance Analysis', headers: ['Provider', 'Patients', 'Total Billed', 'Total Covered'], generator: r => `<tr><td>${r.insurance_provider}</td><td>${r.total_patients}</td><td>Rs.${parseFloat(r.total_billed).toFixed(2)}</td><td>Rs.${parseFloat(r.total_insurance_coverage).toFixed(2)} (${r.avg_coverage_percent}%)</td></tr>` },
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
        if (action === "delete" && type === "staff") {
            deleteItem(`/api/staff/${id}`, 'staff member', loadStaffPage);
        }
    });

    navigateTo("dashboard");
});
