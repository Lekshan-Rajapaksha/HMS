// --- GLOBAL CONFIGURATION ---
const API_BASE_URL = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", () => {
    // --- AUTH CHECK ---
    const token = localStorage.getItem('clinicProToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // --- ELEMENT SELECTION ---
    const mainContent = document.getElementById("main-content");
    const navLinks = document.querySelectorAll(".nav-link");
    const toastContainer = document.querySelector(".toast-container");
    const formModal = new bootstrap.Modal(document.getElementById("formModal"));
    const formModalLabel = document.getElementById("formModalLabel");
    const formModalBody = document.getElementById("formModalBody");
    const detailsModal = new bootstrap.Modal(document.getElementById("detailsModal"));
    const detailsModalLabel = document.getElementById("detailsModalLabel");
    const detailsModalBody = document.getElementById("detailsModalBody");

    let currentViewData = []; // Store data for the current view for filtering
    let userProfile = {}; // Declare userProfile in the main scope

    // --- GENERIC HELPER FUNCTIONS ---

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

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

    const fetchData = async (endpoint) => {
        try {
            console.log(`🔍 Fetching: ${endpoint}`); // Debug log
            const headers = { 'Authorization': `Bearer ${token}` };
            const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });

            // *** IMPROVED ERROR HANDLING ***
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                const errorMessage = errorData?.message || `HTTP error! Status: ${response.status}`;

                console.error(`❌ Error response:`, errorData); // Debug log

                if (response.status === 401 || response.status === 403) {
                    mainContent.innerHTML = `<div class="alert alert-danger m-4"><h4>Access Denied</h4><p>${errorMessage}</p><p>You will be redirected to the login page shortly.</p></div>`;
                    setTimeout(() => {
                        localStorage.removeItem('clinicProToken');
                        window.location.href = 'login.html';
                    }, 4000);
                    return null;
                }
                throw new Error(errorMessage);
            }
            return await response.json();
        } catch (error) {
            console.error("Fetch error:", error);
            mainContent.innerHTML = `<div class="alert alert-danger m-4"><strong>Error:</strong> ${error.message}</div>`;
            return null;
        }
    };

    const submitForm = async (endpoint, method, data, callback) => {
        try {
            const headers = { "Content-Type": "application/json", 'Authorization': `Bearer ${token}` };
            const filteredData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v != null && v !== ''));
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method,
                headers,
                body: JSON.stringify(filteredData),
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Form submission failed");
            }
            if (formModal._element.classList.contains('show')) {
                formModal.hide();
            }
            if (detailsModal._element.classList.contains('show')) {
                detailsModal.hide();
            }
            callback();
            showToast(`Record has been ${method === "POST" ? "created" : "updated"} successfully.`);
        } catch (error) {
            console.error("Submit error:", error);
            showToast(`An error occurred: ${error.message}`, 'danger');
        }
    };

    const deleteItem = async (endpoint, typeName, refreshCallback) => {
        const confirmationModalHTML = `
            <div class="modal fade" id="confirmationModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header"><h5 class="modal-title">Confirm Deletion</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>
                        <div class="modal-body"><p>Are you sure you want to delete this ${typeName}?</p></div>
                        <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-danger" id="confirmDeleteBtn">Delete</button></div>
                    </div>
                </div>
            </div>`;
        const existingModal = document.getElementById('confirmationModal');
        if (existingModal) {
            existingModal.remove();
        }
        document.body.insertAdjacentHTML('beforeend', confirmationModalHTML);
        const confirmationModal = new bootstrap.Modal(document.getElementById('confirmationModal'));
        confirmationModal.show();

        document.getElementById('confirmDeleteBtn').onclick = async () => {
            try {
                const headers = { 'Authorization': `Bearer ${token}` };
                const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: "DELETE", headers });
                if (!response.ok) {
                    const err = await response.json().catch(() => ({ message: "Deletion failed" }));
                    throw new Error(err.message);
                }
                refreshCallback();
                showToast(`${typeName.charAt(0).toUpperCase() + typeName.slice(1)} deleted successfully.`);
            } catch (error) {
                console.error("Delete error:", error);
                showToast(error.message || "Could not delete record.", 'danger');
            } finally {
                confirmationModal.hide();
                document.getElementById('confirmationModal')?.remove();
            }
        };
    };

    const createOptions = (items, valueField, textField, selectedValue) =>
        items.map((item) => `<option value="${item[valueField]}" ${item[valueField] == selectedValue ? "selected" : ""}>${item[textField]}</option>`).join("");

    const renderSpinner = (target = mainContent) => {
        target.innerHTML = `<div class="d-flex justify-content-center align-items-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>`;
    };

    const createPageTemplate = (config) => {
        const { title, type, headers, showAddBtn = true, showSearch = true } = config;
        const typeName = type.split('-').join(' ');
        mainContent.innerHTML = `
            <div class="page-header">
                <h1 class="h3">${title}</h1>
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
                const searchTerm = e.target.value.toLowerCase();
                const filteredData = !searchTerm ? currentViewData :
                    currentViewData.filter(item =>
                        searchableKeys.some(key =>
                            item[key] && item[key].toString().toLowerCase().includes(searchTerm)
                        )
                    );
                renderFunction(filteredData);
            });
        }
    };

    // --- PAGE LOADERS & RENDERERS ---

    const loadDashboard = async () => {
        renderSpinner();
        const stats = await fetchData("/api/branch-manager/stats");
        if (!stats) return; // Stop if fetch failed
        mainContent.innerHTML = `
            <h1 class="h3 mb-4">Branch Dashboard</h1>
            <div class="row">
                <div class="col-xl-3 col-md-6 mb-4"><div class="card glass-effect"><div class="card-body"><div class="row no-gutters align-items-center"><div class="col mr-2"><div class="text-xs text-primary text-uppercase mb-1 fw-bold">Scheduled Today</div><div class="h5 mb-0 fw-bold">${stats.scheduled_today}</div></div><div class="col-auto"><i class="bi bi-calendar-day fs-2 text-secondary"></i></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card glass-effect"><div class="card-body"><div class="row no-gutters align-items-center"><div class="col mr-2"><div class="text-xs text-success text-uppercase mb-1 fw-bold">Completed Today</div><div class="h5 mb-0 fw-bold">${stats.completed_today}</div></div><div class="col-auto"><i class="bi bi-calendar-check fs-2 text-secondary"></i></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card glass-effect"><div class="card-body"><div class="row no-gutters align-items-center"><div class="col mr-2"><div class="text-xs text-danger text-uppercase mb-1 fw-bold">Canceled Today</div><div class="h5 mb-0 fw-bold">${stats.canceled_today}</div></div><div class="col-auto"><i class="bi bi-calendar-x fs-2 text-secondary"></i></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card glass-effect"><div class="card-body"><div class="row no-gutters align-items-center"><div class="col mr-2"><div class="text-xs text-info text-uppercase mb-1 fw-bold">Total Staff</div><div class="h5 mb-0 fw-bold">${stats.staff}</div></div><div class="col-auto"><i class="bi bi-people-fill fs-2 text-secondary"></i></div></div></div></div></div>
            </div>`;
    };

    const loadPatientsPage = async () => {
        createPageTemplate({ title: "Manage Patients", type: "patient", headers: ["ID", "Name", "Age", "Contact"] });
        renderSpinner(document.getElementById("table-body"));
        console.log('🔍 About to fetch patients...'); // Debug
        currentViewData = await fetchData("/api/patients");
        console.log('📦 Patients data received:', currentViewData); // Debug
        if (!currentViewData) return;
        renderPatientsTable(currentViewData);
        setupSearch(renderPatientsTable, ['patient_id', 'name', 'contact_info']);
    };

    const renderPatientsTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No patients found. Add one to get started.</td></tr>'; return; }
        tableBody.innerHTML = data.map(p => `<tr><td>${p.patient_id}</td><td>${p.name}</td><td>${p.age ?? 'N/A'}</td><td>${p.contact_info || ""}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="patient" data-id="${p.patient_id}"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="patient" data-id="${p.patient_id}"><i class="bi bi-trash-fill"></i></button></td></tr>`).join("");
    };

    const loadAppointmentsPage = async () => {
        createPageTemplate({ title: "Branch Appointments", type: "appointment", headers: ["ID", "Date", "Patient", "Doctor", "Status"], showAddBtn: false });
        renderSpinner(document.getElementById("table-body"));
        currentViewData = await fetchData("/api/branch-manager/appointments");
        if (!currentViewData) return;
        renderAppointmentsTable(currentViewData);
        setupSearch(renderAppointmentsTable, ['appointment_id', 'patient_name', 'doctor_name', 'status']);
    };

    const renderAppointmentsTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">No appointments found for this branch.</td></tr>'; return; }
        const statusColors = { Scheduled: 'primary', Completed: 'success', Canceled: 'danger', Rescheduled: 'warning' };
        tableBody.innerHTML = data.map(a => `<tr><td>${a.appointment_id}</td><td>${formatDate(a.schedule_date)}</td><td>${a.patient_name}</td><td>${a.doctor_name}</td><td><span class="badge bg-${statusColors[a.status] || 'secondary'}">${a.status}</span></td><td class="table-actions"><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="branch-appointment" data-id="${a.appointment_id}" title="Cancel Appointment"><i class="bi bi-trash-fill"></i></button></td></tr>`).join("");
    };

    const loadStaffPage = async () => {
        createPageTemplate({ title: "Branch Staff", type: "staff", headers: ["ID", "Name", "Role", "Contact"], showAddBtn: true });
        renderSpinner(document.getElementById("table-body"));
        currentViewData = await fetchData("/api/branch-manager/staff");
        if (!currentViewData) return;
        renderStaffTable(currentViewData);
        setupSearch(renderStaffTable, ['staff_id', 'name', 'role_name']);
    };

    const renderStaffTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No staff found for this branch.</td></tr>'; return; }
        tableBody.innerHTML = data.map(s => `<tr><td>${s.staff_id}</td><td>${s.name} ${s.is_medical_staff ? '<i class="bi bi-heart-pulse text-primary" title="Medical Staff"></i>' : ""}</td><td>${s.role_name}</td><td>${s.contact_info}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="staff-edit" data-id="${s.staff_id}"><i class="bi bi-pencil-fill"></i></button></td></tr>`).join("");
    };

    const loadInvoicesPage = async () => {
        createPageTemplate({ title: "Branch Billing", type: "invoice", headers: ["ID", "Patient", "Total", "Due", "Status", "Due Date"], showAddBtn: false });
        renderSpinner(document.getElementById("table-body"));
        currentViewData = await fetchData("/api/branch-manager/invoices");
        if (!currentViewData) return;
        renderInvoicesTable(currentViewData);
        setupSearch(renderInvoicesTable, ['invoice_id', 'patient_name', 'status']);
    };

    const renderInvoicesTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-4">No invoices found for this branch.</td></tr>'; return; }
        const statusColors = { Paid: 'success', 'Partially Paid': 'warning', Pending: 'danger' };
        tableBody.innerHTML = data.map(i => {
            const dueAmount = i.due_amount !== undefined && i.due_amount !== null ? parseFloat(i.due_amount).toFixed(2) : '0.00';
            return `<tr><td>#${i.invoice_id}</td><td>${i.patient_name}</td><td>$${parseFloat(i.total_amount).toFixed(2)}</td><td>$${dueAmount}</td><td><span class="badge bg-${statusColors[i.status] || 'secondary'}">${i.status}</span></td><td>${formatDate(i.due_date)}</td><td class="table-actions">${i.status !== 'Paid' ? `<button class="btn btn-sm btn-outline-success" title="Record Payment" data-action="add" data-type="payment" data-id="${i.invoice_id}"><i class="bi bi-cash-coin"></i></button>` : ''}</td></tr>`;
        }).join("");
    };

    // branch.js

    const loadReportsLandingPage = () => {
        mainContent.innerHTML = `
            <div class="page-header">
                <h1 class="h3">Branch Reports</h1>
            </div>
            <div class="alert alert-info" role="alert">
                <i class="bi bi-info-circle-fill me-2"></i>Select a report category to view the details.
            </div>
            <div class="row mt-4">
                <div class="col-md-6 mb-4">
                    <div class="card report-card" data-action="view" data-type="doctor-revenue-report" style="cursor: pointer;">
                        <div class="card-body text-center p-4">
                            <i class="bi bi-person-hearts fs-1 text-primary mb-3"></i>
                            <h5 class="card-title">Doctor Reports</h5>
                            <p class="card-text text-muted">View revenue generated by each doctor.</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6 mb-4">
                    <div class="card report-card" data-action="view" data-type="outstanding-balances-report" style="cursor: pointer;">
                        <div class="card-body text-center p-4">
                            <i class="bi bi-cash-stack fs-1 text-danger mb-3"></i>
                            <h5 class="card-title">Outstanding Payments</h5>
                            <p class="card-text text-muted">See all patients with outstanding balances.</p>
                        </div>
                    </div>
                </div>
            </div>`;
    };

    const loadDoctorRevenueReport = async () => {
        mainContent.innerHTML = `
            <div class="page-header">
                 <h1 class="h3">Doctor Revenue Report</h1>
                 <button class="btn btn-outline-secondary" data-action="back" data-type="reports-landing"><i class="bi bi-arrow-left me-2"></i>Back to Reports</button>
            </div>
            <div class="card"><div class="card-body" id="report-container"></div></div>`;

        const container = document.getElementById('report-container');
        renderSpinner(container);
        const revenues = await fetchData("/api/branch-manager/reports/doctor-revenue");
        renderReportTable(container, ['Doctor', 'Total Revenue (from Paid Invoices)'], revenues, (item) => `<tr><td>${item.doctor_name}</td><td>$${parseFloat(item.total_revenue).toFixed(2)}</td></tr>`, "No paid invoice data found for any doctor.");
    };

    const loadOutstandingBalancesReport = async () => {
        mainContent.innerHTML = `
            <div class="page-header">
                 <h1 class="h3">Outstanding Balances Report</h1>
                 <button class="btn btn-outline-secondary" data-action="back" data-type="reports-landing"><i class="bi bi-arrow-left me-2"></i>Back to Reports</button>
            </div>
            <div class="card"><div class="card-body" id="report-container"></div></div>`;

        const container = document.getElementById('report-container');
        renderSpinner(container);
        const balances = await fetchData("/api/branch-manager/reports/outstanding-balances");
        renderReportTable(container, ['Patient', 'Invoice ID', 'Outstanding Amount'], balances, (item) => `<tr><td>${item.patient_name}</td><td>#${item.invoice_id}</td><td>$${parseFloat(item.due_amount).toFixed(2)}</td></tr>`, "No outstanding balances found.");
    };

    const renderReportTable = (container, headers, data, rowRenderer, emptyMessage) => {
        let content = `<div class="table-responsive"><table class="table table-hover"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
        if (data && data.length > 0) {
            content += data.map(rowRenderer).join('');
        } else {
            content += `<tr><td colspan="${headers.length}" class="text-center p-4 text-muted">${emptyMessage}</td></tr>`;
        }
        content += `</tbody></table></div>`;
        container.innerHTML = content;
    };

    const openPatientForm = async (id = null) => {
        const isEditing = id !== null;
        const [patient, providers] = await Promise.all([
            isEditing ? fetchData(`/api/patients/${id}`) : Promise.resolve({}),
            fetchData("/api/list/insurance-providers")
        ]);

        if (providers === null && !patient) return;

        formModalLabel.textContent = isEditing ? "Edit Patient" : "Add New Patient";
        formModalBody.innerHTML = `<form id="modal-form">
            <div class="row"><div class="col-md-6 mb-3"><label class="form-label">Name</label><input type="text" class="form-control" name="name" value="${patient.name || ""}" required></div><div class="col-md-6 mb-3"><label class="form-label">Gender</label><select class="form-select" name="gender"><option value="Male" ${patient.gender === "Male" ? "selected" : ""}>Male</option><option value="Female" ${patient.gender === "Female" ? "selected" : ""}>Female</option></select></div><div class="col-md-6 mb-3"><label class="form-label">Date of Birth</label><input type="date" class="form-control" name="date_of_birth" value="${patient.date_of_birth ? patient.date_of_birth.split("T")[0] : ""}" required></div><div class="col-md-6 mb-3"><label class="form-label">Contact Info</label><input type="text" class="form-control" name="contact_info" value="${patient.contact_info || ""}"></div></div><hr><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Insurance Provider</label><select class="form-select" name="insurance_provider_id"><option value="">None</option>${createOptions(providers || [], "id", "name", patient.insurance_provider_id)}</select></div><div class="col-md-6 mb-3"><label class="form-label">Policy Number</label><input type="text" class="form-control" name="policy_number" value="${patient.policy_number || ""}"></div></div>
            <div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">${isEditing ? "Save Changes" : "Create"}</button></div></form>`;
        formModal.show();
        document.getElementById("modal-form").addEventListener("submit", (e) => { e.preventDefault(); const endpoint = isEditing ? `/api/patients/${id}` : "/api/patients"; submitForm(endpoint, isEditing ? "PUT" : "POST", Object.fromEntries(new FormData(e.target)), loadPatientsPage); });
    };

    const openStaffForm = async () => {
        const [roles, specialties] = await Promise.all([
            fetchData("/api/list/roles"),
            fetchData("/api/list/specialties")
        ]);
        if (!roles || !specialties) return;

        const filteredRoles = roles.filter(r => r.name.toLowerCase() !== 'admin' && r.name.toLowerCase() !== 'branch manager');

        formModalLabel.textContent = "Add New Staff Member";
        formModalBody.innerHTML = `<form id="modal-form">
        <input type="hidden" name="branch_id" value="${userProfile.branch_id}">
        <div class="row">
            <div class="col-md-6 mb-3"><label class="form-label">Full Name</label><input type="text" class="form-control" name="name" required></div>
            <div class="col-md-6 mb-3"><label class="form-label">Contact Info</label><input type="text" class="form-control" name="contact_info" required></div>
        </div>
        <div class="row">
            <div class="col-md-6 mb-3">
                <label class="form-label">Role</label>
                <select class="form-select" id="staff-role-select" name="role_id" required>${createOptions(filteredRoles, "role_id", "name")}</select>
            </div>
            <div class="col-md-6 mb-3">
                <label class="form-label">Is Medical Staff?</label>
                <select class="form-select" id="medical-staff-select" name="is_medical_staff"><option value="1">Yes</option><option value="0" selected>No</option></select>
            </div>
        </div>
        
        <div class="row" id="specialty-field-container" style="display: none;">
             <div class="col-md-6 mb-3">
                <label class="form-label">Specialty</label>
                 <select class="form-select" name="specialty_id">
                     <option value="">Select specialty...</option>
                     ${createOptions(specialties, "specialty_id", "name")}
                 </select>
            </div>
        </div>
        <hr>

        <h5 class="mb-3">Account Credentials</h5>
        <div class="row">
            <div class="col-md-4 mb-3"><label class="form-label">Username</label><input type="text" class="form-control" name="username" required></div>
            <div class="col-md-4 mb-3"><label class="form-label">Email</label><input type="email" class="form-control" name="email"></div>
            <div class="col-md-4 mb-3"><label class="form-label">Password</label><input type="password" class="form-control" name="password" required></div>
        </div>
        <div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Create Staff Member</button></div>
    </form>`;
        formModal.show();

        const roleSelect = document.getElementById("staff-role-select");
        const medicalSelect = document.getElementById("medical-staff-select");
        const specialtyContainer = document.getElementById("specialty-field-container");

        const roleNameMap = Object.fromEntries(filteredRoles.map(r => [r.role_id, r.name.toLowerCase()]));

        const toggleSpecialtyField = () => {
            const selectedRoleName = roleNameMap[roleSelect.value];
            if (selectedRoleName === 'doctor') {
                specialtyContainer.style.display = "flex";
                medicalSelect.value = "1";
            } else {
                specialtyContainer.style.display = "none";
            }
        };

        roleSelect.addEventListener("change", toggleSpecialtyField);

        // ⭐ ADD THIS LINE - Check on initial load
        toggleSpecialtyField();

        document.getElementById("modal-form").addEventListener("submit", (e) => {
            e.preventDefault();
            submitForm("/api/staff", "POST", Object.fromEntries(new FormData(e.target)), loadStaffPage);
        });
    };
    const openStaffEditForm = async (id) => {
        const staff = await fetchData(`/api/branch-manager/staff/${id}`);
        if (!staff) return;

        formModalLabel.textContent = `Edit Staff: ${staff.name}`;
        formModalBody.innerHTML = `<form id="modal-form">
        <div class="alert alert-secondary">
            Role and credentials cannot be changed from this panel. Contact an Administrator for assistance.
        </div>
        <div class="row">
            <div class="col-md-6 mb-3">
                <label class="form-label">Full Name</label>
                <input type="text" class="form-control" name="name" value="${staff.name || ''}" required>
            </div>
            <div class="col-md-6 mb-3">
                <label class="form-label">Contact Info</label>
                <input type="text" class="form-control" name="contact_info" value="${staff.contact_info || ''}" required>
            </div>
        </div>
        <div class="row">
            <div class="col-md-6 mb-3">
                <label class="form-label">Role</label>
                <input type="text" class="form-control" value="${staff.role_name}" disabled>
            </div>
            ${staff.specialty_name ? `
            <div class="col-md-6 mb-3">
                <label class="form-label">Specialty</label>
                <input type="text" class="form-control" value="${staff.specialty_name}" disabled>
            </div>` : ''}
        </div>
        <div class="modal-footer mt-4">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
        </div>
    </form>`;
        formModal.show();
        document.getElementById("modal-form").addEventListener("submit", (e) => {
            e.preventDefault();
            const endpoint = `/api/branch-manager/staff/${id}`;
            submitForm(endpoint, "PUT", Object.fromEntries(new FormData(e.target)), loadStaffPage);
        });
    };
    const openPaymentForm = async (invoiceId) => {
        formModalLabel.textContent = `Record Payment for Invoice #${invoiceId}`;
        formModalBody.innerHTML = `<form id="modal-form">
            <div class="alert alert-info">You are recording a new payment for this invoice.</div>
            <div class="row">
                <div class="col-md-4 mb-3"><label class="form-label">Amount</label><input type="number" step="0.01" name="paid_amount" class="form-control" required></div>
                <div class="col-md-4 mb-3"><label class="form-label">Method</label><select name="method_of_payment" class="form-select"><option>Cash</option><option>Credit Card</option><option>Bank Transfer</option></select></div>
                <div class="col-md-4 mb-3"><label class="form-label">Date</label><input type="date" name="payment_date" class="form-control" value="${new Date().toISOString().split("T")[0]}" required></div>
            </div>
            <div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Record Payment</button></div>
        </form>`;
        formModal.show();

        document.getElementById("modal-form").addEventListener("submit", (e) => {
            e.preventDefault();
            const endpoint = `/api/branch-manager/invoices/${invoiceId}/payments`;
            submitForm(endpoint, "POST", Object.fromEntries(new FormData(e.target)), loadInvoicesPage);
        });
    };

    // --- ROUTING & INITIALIZATION ---
    const pageLoaders = {
        dashboard: loadDashboard,
        patients: loadPatientsPage,
        appointments: loadAppointmentsPage,
        staff: loadStaffPage,
        invoices: loadInvoicesPage,
        reports: loadReportsLandingPage // Changed from loadReportsPage
    };

    const navigateTo = (page) => {
        navLinks.forEach((link) => link.classList.toggle("active", link.dataset.page === page));
        const loader = pageLoaders[page] || pageLoaders.dashboard;
        loader();
    };

    document.querySelector(".sidebar").addEventListener("click", (e) => {
        const navLink = e.target.closest(".nav-link");
        if (navLink) {
            e.preventDefault();
            navigateTo(navLink.dataset.page);
        }
    });

    mainContent.addEventListener("click", (e) => {
        const target = e.target.closest("button[data-action], div[data-action='view']"); // Listen for div clicks too
        if (!target) return;
        const { action, type, id } = target.dataset;

        // Handle report navigation
        if (action === "view" && type === "doctor-revenue-report") {
            loadDoctorRevenueReport();
            return;
        }
        if (action === "view" && type === "outstanding-balances-report") {
            loadOutstandingBalancesReport();
            return;
        }
        if (action === "back" && type === "reports-landing") {
            loadReportsLandingPage();
            return;
        }

        const entityMap = {
            patient: { refresh: loadPatientsPage, endpoint: 'patients', name: 'patient', handler: openPatientForm },
            staff: { refresh: loadStaffPage, endpoint: 'staff', name: 'staff member', handler: openStaffForm },
            'staff-edit': { refresh: loadStaffPage, handler: openStaffEditForm },
            appointment: { refresh: loadAppointmentsPage, endpoint: 'branch-manager/appointments', name: 'appointment' },
            'branch-appointment': { refresh: loadAppointmentsPage, endpoint: 'branch-manager/appointments', name: 'appointment' },
            payment: { handler: openPaymentForm }
        };
        const entity = entityMap[type];
        if (!entity) return;

        if (action === "add" && entity.handler) {
            entity.handler(id || null);
        } else if (action === "edit" && entity.handler) {
            entity.handler(id);
        } else if (action === "delete" && entity.endpoint) {
            deleteItem(`/api/${entity.endpoint}/${id}`, entity.name, entity.refresh);
        }
    });
    // --- LOGOUT HANDLER ---
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('clinicProToken'); // Clear the token
        window.location.href = 'login.html'; // Redirect to login
    });
    // Initial Load
    const initializeDashboard = async () => {
        const profile = await fetchData("/api/branch-manager/profile");
        if (profile) {
            userProfile = profile;
            document.getElementById('welcome-message').textContent = `Welcome, ${profile.staff_name}!`;
            document.getElementById('branch-info').textContent = `Managing: ${profile.branch_name}`;
            navigateTo("dashboard");
        }
    };

    initializeDashboard();
});

