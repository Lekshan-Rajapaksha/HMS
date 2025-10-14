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

    const fetchData = async(endpoint) => {
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
            
            // *** IMPROVED ERROR HANDLING ***
            if (!response.ok) {
                const errorData = await response.json().catch(() => null); 
                const errorMessage = errorData?.message || `HTTP error! Status: ${response.status}`;
                
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

    const submitForm = async(endpoint, method, data, callback) => {
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
            formModal.hide();
            callback();
            showToast(`Record has been ${method === "POST" ? "created" : "updated"} successfully.`);
        } catch (error) {
            console.error("Submit error:", error);
            showToast(`An error occurred: ${error.message}`, 'danger');
        }
    };

    const deleteItem = async(endpoint, typeName, refreshCallback) => {
        if (confirm(`Are you sure you want to delete this ${typeName}?`)) {
            try {
                const headers = { 'Authorization': `Bearer ${token}` };
                const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: "DELETE", headers });
                if (!response.ok) throw new Error("Deletion failed");
                refreshCallback();
                showToast(`${typeName.charAt(0).toUpperCase() + typeName.slice(1)} deleted successfully.`);
            } catch (error) {
                console.error("Delete error:", error);
                showToast("Could not delete record. It might be in use.", 'danger');
            }
        }
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
                <div class="col-xl-4 col-md-6 mb-4"><div class="card glass-effect"><div class="card-body"><div class="row no-gutters align-items-center"><div class="col mr-2"><div class="text-xs text-primary text-uppercase mb-1 fw-bold">Scheduled Appointments</div><div class="h5 mb-0 fw-bold" id="appointment-count">${stats?.appointments ?? '...'}</div></div><div class="col-auto"><i class="bi bi-calendar-check-fill fs-2 text-secondary"></i></div></div></div></div></div>
                <div class="col-xl-4 col-md-6 mb-4"><div class="card glass-effect"><div class="card-body"><div class="row no-gutters align-items-center"><div class="col mr-2"><div class="text-xs text-success text-uppercase mb-1 fw-bold">Staff Members</div><div class="h5 mb-0 fw-bold" id="staff-count">${stats?.staff ?? '...'}</div></div><div class="col-auto"><i class="bi bi-person-badge-fill fs-2 text-secondary"></i></div></div></div></div></div>
                <div class="col-xl-4 col-md-6 mb-4"><div class="card glass-effect"><div class="card-body"><div class="row no-gutters align-items-center"><div class="col mr-2"><div class="text-xs text-info text-uppercase mb-1 fw-bold">Appointments Today</div><div class="h5 mb-0 fw-bold" id="today-count">${stats?.daily_appointments ?? '...'}</div></div><div class="col-auto"><i class="bi bi-clock-fill fs-2 text-secondary"></i></div></div></div></div></div>
            </div>`;
    };
    
    const loadPatientsPage = async () => {
        createPageTemplate({ title: "Branch Patients", type: "patient", headers: ["ID", "Name", "Age", "Contact"] });
        renderSpinner(document.getElementById("table-body"));
        // *** CORRECTED API ENDPOINT ***
        currentViewData = await fetchData("/api/branch-manager/patients"); 
        if (!currentViewData) return;
        renderPatientsTable(currentViewData);
        setupSearch(renderPatientsTable, ['patient_id', 'name', 'contact_info']);
    };
    
    const renderPatientsTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No patients found for this branch.</td></tr>'; return; }
        tableBody.innerHTML = data.map(p => `<tr><td>${p.patient_id}</td><td>${p.name}</td><td>${p.age ?? 'N/A'}</td><td>${p.contact_info || ""}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="patient" data-id="${p.patient_id}"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="patient" data-id="${p.patient_id}"><i class="bi bi-trash-fill"></i></button></td></tr>`).join("");
    };

    const loadAppointmentsPage = async () => {
        createPageTemplate({ title: "Branch Appointments", type: "appointment", headers: ["ID", "Date", "Patient", "Doctor", "Status"] });
        renderSpinner(document.getElementById("table-body"));
        currentViewData = await fetchData("/api/branch-manager/appointments");
        if (!currentViewData) return;
        renderAppointmentsTable(currentViewData);
        setupSearch(renderAppointmentsTable, ['appointment_id', 'patient_name', 'doctor_name', 'status']);
    };
    
    const renderAppointmentsTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">No appointments found for this branch.</td></tr>'; return; }
        const statusColors = { Scheduled: 'primary', Completed: 'success', Cancelled: 'danger', Rescheduled: 'warning' };
        tableBody.innerHTML = data.map(a => `<tr><td>${a.appointment_id}</td><td>${new Date(a.schedule_date).toLocaleString()}</td><td>${a.patient_name}</td><td>${a.doctor_name}</td><td><span class="badge bg-${statusColors[a.status] || 'secondary'}">${a.status}</span></td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="appointment" data-id="${a.appointment_id}"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="appointment" data-id="${a.appointment_id}"><i class="bi bi-trash-fill"></i></button></td></tr>`).join("");
    };
    
    const loadStaffPage = async () => {
        createPageTemplate({ title: "Branch Staff", type: "staff", headers: ["ID", "Name", "Role", "Contact"], showAddBtn: false });
        renderSpinner(document.getElementById("table-body"));
        currentViewData = await fetchData("/api/branch-manager/staff");
        if (!currentViewData) return;
        renderStaffTable(currentViewData);
        setupSearch(renderStaffTable, ['staff_id', 'name', 'role_name']);
    };
    
    const renderStaffTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { tableBody.innerHTML = '<tr><td colspan="5" class="text-center p-4">No staff found for this branch.</td></tr>'; return; }
        tableBody.innerHTML = data.map(s => `<tr><td>${s.staff_id}</td><td>${s.name} ${s.is_medical_staff ? '<i class="bi bi-heart-pulse text-primary" title="Medical Staff"></i>' : ""}</td><td>${s.role_name}</td><td>${s.contact_info}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" disabled title="Contact Admin to Edit"><i class="bi bi-pencil-fill"></i></button></td></tr>`).join("");
    };

    const loadInvoicesPage = async () => {
        createPageTemplate({ title: "Branch Billing", type: "invoice", headers: ["ID", "Patient", "Total", "Status", "Due Date"], showAddBtn: false });
        renderSpinner(document.getElementById("table-body"));
        currentViewData = await fetchData("/api/branch-manager/invoices");
        if (!currentViewData) return;
        renderInvoicesTable(currentViewData);
        setupSearch(renderInvoicesTable, ['invoice_id', 'patient_name', 'status']);
    };
    
    const renderInvoicesTable = (data) => {
         const tableBody = document.getElementById("table-body");
         if (!data || data.length === 0) { tableBody.innerHTML = '<tr><td colspan="6" class="text-center p-4">No invoices found for this branch.</td></tr>'; return; }
         const statusColors = { Paid: 'success', 'Partially Paid': 'warning', Pending: 'danger' };
         tableBody.innerHTML = data.map(i => `<tr><td>#${i.invoice_id}</td><td>${i.patient_name}</td><td>$${parseFloat(i.total_amount).toFixed(2)}</td><td><span class="badge bg-${statusColors[i.status] || 'secondary'}">${i.status}</span></td><td>${new Date(i.due_date).toLocaleDateString()}</td><td class="table-actions"><button class="btn btn-sm btn-outline-info" title="View Payments" data-action="view" data-type="payment" data-id="${i.invoice_id}"><i class="bi bi-cash"></i></button></td></tr>`).join("");
    };

    // --- FORM HANDLERS ---
    const openPatientForm = async(id = null) => {
        const isEditing = id !== null;
        const [patient, providers] = await Promise.all([isEditing ? fetchData(`/api/patients/${id}`) : Promise.resolve({}), fetchData("/api/list/insurance-providers")]);
        formModalLabel.textContent = isEditing ? "Edit Patient" : "Add New Patient";
        formModalBody.innerHTML = `<form id="modal-form">
            <div class="row"><div class="col-md-6 mb-3"><label class="form-label">Name</label><input type="text" class="form-control" name="name" value="${patient.name || ""}" required></div><div class="col-md-6 mb-3"><label class="form-label">Gender</label><select class="form-select" name="gender"><option value="Male" ${patient.gender === "Male" ? "selected" : ""}>Male</option><option value="Female" ${patient.gender === "Female" ? "selected" : ""}>Female</option></select></div><div class="col-md-6 mb-3"><label class="form-label">Date of Birth</label><input type="date" class="form-control" name="date_of_birth" value="${patient.date_of_birth ? patient.date_of_birth.split("T")[0] : ""}" required></div><div class="col-md-6 mb-3"><label class="form-label">Contact Info</label><input type="text" class="form-control" name="contact_info" value="${patient.contact_info || ""}"></div></div><hr><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Insurance Provider</label><select class="form-select" name="insurance_provider_id"><option value="">None</option>${createOptions(providers,"id","name",patient.insurance_provider_id)}</select></div><div class="col-md-6 mb-3"><label class="form-label">Policy Number</label><input type="text" class="form-control" name="policy_number" value="${patient.policy_number || ""}"></div></div>
            <div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">${isEditing ? "Save Changes" : "Create"}</button></div></form>`;
        formModal.show();
        document.getElementById("modal-form").addEventListener("submit", (e) => { e.preventDefault(); const endpoint = isEditing ? `/api/patients/${id}` : "/api/patients"; submitForm(endpoint, isEditing ? "PUT" : "POST", Object.fromEntries(new FormData(e.target)), loadPatientsPage); });
    };

    const openAppointmentForm = async(id = null) => {
        const isEditing = id !== null;
        const [patients, doctors, branches, appointment] = await Promise.all([fetchData("/api/list/patients"), fetchData("/api/list/doctors"), fetchData("/api/list/branches"), isEditing ? fetchData(`/api/appointments/${id}`) : Promise.resolve({})]);
        formModalLabel.textContent = isEditing ? "Edit Appointment" : "Book Appointment";
        const scheduleDate = appointment.schedule_date ? new Date(new Date(appointment.schedule_date).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : "";
        formModalBody.innerHTML = `<form id="modal-form">
            <div class="row"><div class="col-md-6 mb-3"><label class="form-label">Patient</label><select class="form-select" name="patient_id" required>${createOptions(patients,"patient_id","name",appointment.patient_id)}</select></div><div class="col-md-6 mb-3"><label class="form-label">Doctor</label><select class="form-select" name="doctor_id" required>${createOptions(doctors,"doctor_id","name",appointment.doctor_id)}</select></div><div class="col-md-6 mb-3"><label class="form-label">Branch</label><select class="form-select" name="branch_id" required>${createOptions(branches,"branch_id","name",appointment.branch_id)}</select></div><div class="col-md-6 mb-3"><label class="form-label">Date & Time</label><input type="datetime-local" class="form-control" name="schedule_date" value="${scheduleDate}" required></div><div class="col-md-6 mb-3"><label class="form-label">Status</label><select class="form-select" name="status"><option ${appointment.status === "Scheduled" ? "selected" : ""}>Scheduled</option><option ${appointment.status === "Completed" ? "selected" : ""}>Completed</option><option ${appointment.status === "Cancelled" ? "selected" : ""}>Cancelled</option></select></div></div>
            <div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">${isEditing ? "Save Changes" : "Create"}</button></div></form>`;
        formModal.show();
        document.getElementById("modal-form").addEventListener("submit", (e) => { e.preventDefault(); const endpoint = isEditing ? `/api/appointments/${id}` : "/api/appointments"; submitForm(endpoint, isEditing ? "PUT" : "POST", Object.fromEntries(new FormData(e.target)), loadAppointmentsPage); });
    };

    const viewPayments = async(invoiceId) => {
        detailsModalLabel.textContent = `Payments for Invoice #${invoiceId}`;
        detailsModalBody.innerHTML = `<p class="text-center p-4">Loading...</p>`;
        detailsModal.show();
        const payments = await fetchData(`/api/payments/by-invoice/${invoiceId}`);
        let content = `<div class="table-responsive"><table class="table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th></tr></thead><tbody>`;
        if (payments && payments.length > 0) {
            content += payments.map(p => `<tr><td>${new Date(p.payment_date).toLocaleString()}</td><td>$${parseFloat(p.paid_amount).toFixed(2)}</td><td>${p.method_of_payment}</td></tr>`).join("");
        } else {
            content += `<tr><td colspan="3" class="text-center text-muted p-4">No payments found.</td></tr>`;
        }
        content += `</tbody></table></div><hr><h5 class="mb-3">Record New Payment</h5><form id="payment-form"><input type="hidden" name="invoice_id" value="${invoiceId}"><div class="row"><div class="col-md-4 mb-3"><label class="form-label">Amount</label><input type="number" step="0.01" name="paid_amount" class="form-control" required></div><div class="col-md-4 mb-3"><label class="form-label">Method</label><select name="method_of_payment" class="form-select"><option>Cash</option><option>Credit Card</option><option>Bank Transfer</option></select></div><div class="col-md-4 mb-3"><label class="form-label">Date</label><input type="date" name="payment_date" class="form-control" value="${new Date().toISOString().split("T")[0]}" required></div></div><button type="submit" class="btn btn-primary">Record Payment</button></form>`;
        detailsModalBody.innerHTML = content;
        document.getElementById("payment-form").addEventListener("submit", (e) => {
            e.preventDefault();
            submitForm("/api/payments", "POST", Object.fromEntries(new FormData(e.target)), () => {
                detailsModal.hide();
                loadInvoicesPage();
            });
        });
    };

    // --- ROUTING & INITIALIZATION ---
    const pageLoaders = {
        dashboard: loadDashboard,
        patients: loadPatientsPage,
        appointments: loadAppointmentsPage,
        staff: loadStaffPage,
        invoices: loadInvoicesPage
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
        const target = e.target.closest("button[data-action]");
        if (!target) return;
        const { action, type, id } = target.dataset;
        const entityMap = {
            patient: { refresh: loadPatientsPage, endpoint: 'patients', name: 'patient', handler: openPatientForm },
            appointment: { refresh: loadAppointmentsPage, endpoint: 'appointments', name: 'appointment', handler: openAppointmentForm },
            payment: { handler: viewPayments }
        };
        const entity = entityMap[type];
        if (!entity) return;
        if ((action === "add" || action === "edit" || action === "view") && entity.handler) {
            entity.handler(id);
        } else if (action === "delete" && entity.endpoint) {
            deleteItem(`/api/${entity.endpoint}/${id}`, entity.name, entity.refresh);
        }
    });
    
    document.getElementById("logout-btn").addEventListener("click", () => {
        localStorage.removeItem('clinicProToken');
        localStorage.removeItem('clinicProRole');
        window.location.href = 'login.html';
    });
    
    // Initial Load
    const initializeDashboard = async () => {
        const profile = await fetchData("/api/branch-manager/profile");
        if (profile) {
            document.getElementById('welcome-message').textContent = `Welcome, ${profile.staff_name}!`;
            document.getElementById('branch-info').textContent = `Managing: ${profile.branch_name}`;
            navigateTo("dashboard");
        }
    };

    initializeDashboard();
});

