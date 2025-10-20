// app.js

// --- GLOBAL CONFIGURATION ---
const API_BASE_URL = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", () => {
    // --- ELEMENT SELECTION ---
    const token = localStorage.getItem('clinicProToken');
    if (!token) {
        window.location.href = 'login.html';
        return; // Stop executing the rest of the script
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
        const token = localStorage.getItem('clinicProToken'); 
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        } else {
            window.location.href = 'login.html'; 
            return null;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
        if (response.status === 401) {
             window.location.href = 'login.html';
             return null;
        }
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error("Fetch error:", error);
        mainContent.innerHTML = `<div class="alert alert-danger">Failed to load data. Please try logging in again.</div>`;
        return null;
    }
};

    const submitForm = async(endpoint, method, data, callback) => {
    try {
        const token = localStorage.getItem('clinicProToken'); 
        const headers = { "Content-Type": "application/json" };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        const filteredData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v != null && v !== ''));
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            method,
            headers,
            body: JSON.stringify(filteredData),
        });
        
        if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || err.message || "Form submission failed");
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
            const token = localStorage.getItem('clinicProToken'); 
            const headers = {};
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }

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

    const renderSpinner = (targetId) => {
        document.getElementById(targetId).innerHTML = `<tr><td colspan="100%" class="text-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></td></tr>`;
    };
    
    const renderNoDataMessage = (targetId, message = "No data found.") => {
        document.getElementById(targetId).innerHTML = `<tr><td colspan="100%" class="text-center p-5 text-muted">${message}</td></tr>`;
    };

    const createPageTemplate = (config) => {
        const { title, type, headers, showAddBtn = true, showSearch = true } = config;
        const typeName = type.split('-').join(' ');
        mainContent.innerHTML = `
            <div class="page-header">
                <h1 class="h3">${title}</h1>
                <div class="d-flex align-items-center gap-2">
                    ${showSearch ? `
                    <div class="search-wrapper">
                        <input type="search" id="search-input" class="form-control" placeholder="Search...">
                    </div>` : ''}
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
    
    // --- RENDER FUNCTIONS ---
    const renderPatientsTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { renderNoDataMessage("table-body"); return; }
        tableBody.innerHTML = data.map(p => `<tr><td>${p.patient_id}</td><td>${p.name}</td><td>${p.age}</td><td>${p.contact_info || ""}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="patient" data-id="${p.patient_id}" title="Edit"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="patient" data-id="${p.patient_id}" title="Delete"><i class="bi bi-trash-fill"></i></button></td></tr>`).join("");
    };

    const renderAppointmentsTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { renderNoDataMessage("table-body"); return; }
        const statusColors = { Scheduled: 'primary', Completed: 'success', Cancelled: 'danger', Rescheduled: 'info' };
        tableBody.innerHTML = data.map(a => `<tr><td>${a.appointment_id}</td><td>${new Date(a.schedule_date).toLocaleString("en-SG")}</td><td>${a.patient_name}</td><td>${a.doctor_name}</td><td><span class="badge bg-${statusColors[a.status] || 'secondary'}">${a.status}</span></td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="appointment" data-id="${a.appointment_id}" title="Edit"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="appointment" data-id="${a.appointment_id}" title="Delete"><i class="bi bi-trash-fill"></i></button></td></tr>`).join("");
    };

    // ✅ **MODIFICATION**: Enabled edit and delete buttons
    const renderStaffTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { renderNoDataMessage("table-body"); return; }
        tableBody.innerHTML = data.map(s => `<tr><td>${s.staff_id}</td><td>${s.name} ${s.is_medical_staff ? '<i class="bi bi-heart-pulse text-primary" title="Medical Staff"></i>' : ""}</td><td>${s.role_name}</td><td>${s.contact_info}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="staff" data-id="${s.staff_id}" title="Edit"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="staff" data-id="${s.staff_id}" title="Delete"><i class="bi bi-trash-fill"></i></button></td></tr>`).join("");
    };

    const renderBranchesTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { renderNoDataMessage("table-body"); return; }
        tableBody.innerHTML = data.map(item => `<tr><td>${item.branch_id}</td><td>${item.name}</td><td>${item.address || ''}</td><td>${item.contact_number || ''}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="branch" data-id="${item.branch_id}" title="Edit"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="branch" data-id="${item.branch_id}" title="Delete"><i class="bi bi-trash-fill"></i></button></td></tr>`).join("");
    };

    const renderProvidersTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { renderNoDataMessage("table-body"); return; }
        tableBody.innerHTML = data.map(item => `<tr><td>${item.id}</td><td>${item.name}</td><td>${item.contact_number}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="insurance-provider" data-id="${item.id}" title="Edit"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="insurance-provider" data-id="${item.id}" title="Delete"><i class="bi bi-trash-fill"></i></button></td></tr>`).join("");
    };

    const renderTreatmentsTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { renderNoDataMessage("table-body"); return; }
        tableBody.innerHTML = data.map(item => `<tr><td>${item.service_code}</td><td>${item.name}</td><td>$${parseFloat(item.price).toFixed(2)}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="treatment" data-id="${item.service_code}" title="Edit"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="treatment" data-id="${item.service_code}" title="Delete"><i class="bi bi-trash-fill"></i></button></td></tr>`).join("");
    };

    const renderSpecialtiesTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { renderNoDataMessage("table-body"); return; }
        tableBody.innerHTML = data.map(item => `<tr><td>${item.specialty_id}</td><td>${item.name}</td><td>${item.description || ''}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="specialty" data-id="${item.specialty_id}" title="Edit"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="specialty" data-id="${item.specialty_id}" title="Delete"><i class="bi bi-trash-fill"></i></button></td></tr>`).join("");
    };
    
    // --- PAGE LOADERS ---
    const loadDashboard = async() => {
        mainContent.innerHTML = `
        <h1 class="h3 mb-4">Dashboard</h1>
        <div class="row">
            <div class="col-xl-3 col-md-6 mb-4"><div class="card glass-effect"><div class="card-body"><div class="row no-gutters align-items-center"><div class="col mr-2"><div class="text-xs text-primary text-uppercase mb-1 fw-bold">Total Patients</div><div class="h5 mb-0 fw-bold" id="patient-count">...</div></div><div class="col-auto"><i class="bi bi-people-fill fs-2 text-secondary"></i></div></div></div></div></div>
            <div class="col-xl-3 col-md-6 mb-4"><div class="card glass-effect"><div class="card-body"><div class="row no-gutters align-items-center"><div class="col mr-2"><div class="text-xs text-success text-uppercase mb-1 fw-bold">Scheduled Appointments</div><div class="h5 mb-0 fw-bold" id="appointment-count">...</div></div><div class="col-auto"><i class="bi bi-calendar-check-fill fs-2 text-secondary"></i></div></div></div></div></div>
            <div class="col-xl-3 col-md-6 mb-4"><div class="card glass-effect"><div class="card-body"><div class="row no-gutters align-items-center"><div class="col mr-2"><div class="text-xs text-info text-uppercase mb-1 fw-bold">Active Doctors</div><div class="h5 mb-0 fw-bold" id="doctor-count">...</div></div><div class="col-auto"><i class="bi bi-heart-pulse-fill fs-2 text-secondary"></i></div></div></div></div></div>
            <div class="col-xl-3 col-md-6 mb-4"><div class="card glass-effect"><div class="card-body"><div class="row no-gutters align-items-center"><div class="col mr-2"><div class="text-xs text-warning text-uppercase mb-1 fw-bold">Paid Revenue (All Time)</div><div class="h5 mb-0 fw-bold" id="revenue-total">...</div></div><div class="col-auto"><i class="bi bi-cash-stack fs-2 text-secondary"></i></div></div></div></div></div>
        </div>
        <div class="row">
            <div class="col-xl-8 col-lg-7"><div class="card mb-4"><div class="card-header">Daily Patient Visits (Last 7 Days)</div><div class="card-body"><div class="chart-container" style="height:320px"><canvas id="patientsChart"></canvas></div></div></div></div>
            <div class="col-xl-4 col-lg-5"><div class="card mb-4"><div class="card-header">Top 5 Treatments</div><div class="card-body"><div class="chart-container" style="height:320px"><canvas id="treatmentsChart"></canvas></div></div></div></div>
        </div>`;
        const [summary, invoices, patientData, treatmentData] = await Promise.all([
            fetchData("/api/stats/summary"), 
            fetchData("/api/invoices"), 
            fetchData("/api/stats/daily-patients"), 
            fetchData("/api/stats/treatment-distribution")
        ]);
        if (summary) {
            document.getElementById("patient-count").textContent = summary.patients;
            document.getElementById("appointment-count").textContent = summary.appointments;
            document.getElementById("doctor-count").textContent = summary.doctors;
        }
        if (invoices) {
            const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) - parseFloat(inv.outstanding_balance)), 0);
            document.getElementById("revenue-total").textContent = `$${totalRevenue.toFixed(2)}`;
        }
        Chart.defaults.color = '#8492a6'; 
        Chart.defaults.borderColor = '#dfe7ef';
        renderDailyPatientsChart(patientData); 
        renderTreatmentsChart(treatmentData);
    };

    const renderDailyPatientsChart = (data) => {
        const ctx = document.getElementById("patientsChart")?.getContext("2d");
        if (!ctx || !data) return;
        const labels = [...Array(7).keys()].map(i => { const d = new Date(); d.setDate(d.getDate() - i); return d.toISOString().split('T')[0]; }).reverse();
        const chartData = labels.map(label => { const dayData = data.find(d => d.date.startsWith(label)); return dayData ? dayData.count : 0; });
        const displayLabels = labels.map(l => new Date(l).toLocaleDateString('en-SG', {day:'numeric', month:'short'}));
        new Chart(ctx, { type: 'bar', data: { labels: displayLabels, datasets: [{ label: "Patients", data: chartData, backgroundColor: 'rgba(106, 90, 249, 0.7)', borderColor: 'rgba(106, 90, 249, 1)', borderWidth: 1, borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }, plugins: { legend: { display: false } } } });
    };

    const renderTreatmentsChart = (data) => {
        const ctx = document.getElementById("treatmentsChart")?.getContext("2d");
        if (!ctx || !data || data.length === 0) { if(ctx) { const canvas = ctx.canvas; ctx.font = "16px Poppins"; ctx.fillStyle = "#8492a6"; ctx.textAlign = "center"; ctx.fillText("No treatment data available.", canvas.width / 2, canvas.height / 2);} return; }
        new Chart(ctx, { type: 'doughnut', data: { labels: data.map(d => d.name), datasets: [{ data: data.map(d => d.count), backgroundColor: ['#6a5af9', '#36b9cc', '#1cc88a', '#f6c23e', '#e74a3b'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });
    };

    const loadPatientsPage = async() => {
        createPageTemplate({ title: "Patients", type: "patient", headers: ["ID", "Name", "Age", "Contact"] });
        renderSpinner("table-body");
        currentViewData = await fetchData("/api/patients");
        renderPatientsTable(currentViewData);
        setupSearch(renderPatientsTable, ['patient_id', 'name', 'contact_info']);
    };
    
    const loadAppointmentsPage = async() => {
        createPageTemplate({ title: "Appointments", type: "appointment", headers: ["ID", "Date", "Patient", "Doctor", "Status"] });
        renderSpinner("table-body");
        currentViewData = await fetchData("/api/appointments");
        renderAppointmentsTable(currentViewData);
        setupSearch(renderAppointmentsTable, ['appointment_id', 'patient_name', 'doctor_name', 'status']);
    };

    const loadDoctorsPage = async() => {
        createPageTemplate({ title: "Doctors", type: "doctor", headers: ["ID", "Name", "Branch", "Contact"], showAddBtn: false, showSearch: true });
        renderSpinner("table-body");
        currentViewData = await fetchData("/api/doctors");
        const tableBody = document.getElementById("table-body");
        const renderTable = (data) => {
            if (data && data.length > 0) {
                tableBody.innerHTML = data.map(d => `<tr><td>${d.doctor_id}</td><td>${d.name}</td><td>${d.branch_name}</td><td>${d.contact_info}</td><td></td></tr>`).join("");
            } else {
                renderNoDataMessage("table-body");
            }
        };
        renderTable(currentViewData);
        if(currentViewData && currentViewData.length > 0) document.querySelector("#main-content thead th:last-child").remove();
        setupSearch(renderTable, ['doctor_id', 'name', 'branch_name', 'contact_info']);
    };
    
    const loadStaffPage = async() => {
        createPageTemplate({ title: "Staff", type: "staff", headers: ["ID", "Name", "Role", "Contact"] });
        renderSpinner("table-body");
        currentViewData = await fetchData("/api/staff");
        renderStaffTable(currentViewData);
        setupSearch(renderStaffTable, ['staff_id', 'name', 'role_name', 'contact_info']);
    };
    
    const loadBranchesPage = async() => {
        createPageTemplate({ title: "Branches", type: "branch", headers: ["ID", "Name", "Address", "Contact"] });
        renderSpinner("table-body");
        currentViewData = await fetchData("/api/branches");
        renderBranchesTable(currentViewData);
        setupSearch(renderBranchesTable, ['branch_id', 'name', 'address', 'contact_number']);
    };
    
    const loadInvoicesPage = async() => {
        createPageTemplate({ title: "Invoices & Billing", type: "invoice", headers: ["ID", "Patient", "Total", "Outstanding", "Status", "Due Date"], showAddBtn: false });
        renderSpinner("table-body");
        currentViewData = await fetchData("/api/invoices");
        const tableBody = document.getElementById("table-body");
        const renderInvoices = (data) => {
             if(data && data.length > 0) {
                tableBody.innerHTML = data.map(i => `<tr><td>#${i.invoice_id}</td><td>${i.patient_name}</td><td>$${parseFloat(i.total_amount).toFixed(2)}</td><td>$${parseFloat(i.outstanding_balance).toFixed(2)}</td><td><span class="badge bg-${i.status === "Paid" ? "success" : i.status === "Partially Paid" ? "warning" : "danger"}">${i.status}</span></td><td>${new Date(i.due_date).toLocaleDateString()}</td><td class="table-actions"><button class="btn btn-sm btn-outline-info" title="View Payments" data-action="view" data-type="payment" data-id="${i.invoice_id}"><i class="bi bi-cash"></i></button></td></tr>`).join("");
            } else {
                renderNoDataMessage("table-body");
            }
        }
        renderInvoices(currentViewData);
        setupSearch(renderInvoices, ['invoice_id', 'patient_name', 'status']);
    };
    
    const loadInsuranceProvidersPage = async() => {
        createPageTemplate({ title: "Insurance Providers", type: "insurance-provider", headers: ["ID", "Name", "Contact Number"] });
        renderSpinner("table-body");
        currentViewData = await fetchData("/api/insurance-providers");
        renderProvidersTable(currentViewData);
        setupSearch(renderProvidersTable, ['id', 'name', 'contact_number']);
    };
    
    const loadTreatmentsPage = async() => {
        createPageTemplate({ title: "Treatment Catalogue", type: "treatment", headers: ["Service Code", "Name", "Price"] });
        renderSpinner("table-body");
        currentViewData = await fetchData("/api/treatments");
        renderTreatmentsTable(currentViewData);
        setupSearch(renderTreatmentsTable, ['service_code', 'name', 'price']);
    };
    
    const loadSpecialtiesPage = async() => {
        createPageTemplate({ title: "Doctor Specialties", type: "specialty", headers: ["ID", "Name", "Description"] });
        renderSpinner("table-body");
        currentViewData = await fetchData("/api/specialties");
        renderSpecialtiesTable(currentViewData);
        setupSearch(renderSpecialtiesTable, ['specialty_id', 'name', 'description']);
    };

    // --- FORM HANDLERS (with improved layout) ---
    const openPatientForm = async(id = null) => {
        const isEditing = id !== null;
        const [patient, providers] = await Promise.all([isEditing ? fetchData(`/api/patients/${id}`) : Promise.resolve({}), fetchData("/api/list/insurance-providers")]);
        formModalLabel.textContent = isEditing ? "Edit Patient" : "Add New Patient";
        formModalBody.innerHTML = `<form id="modal-form">
            <div class="row">
                <div class="col-md-6 mb-3"><label class="form-label">Name</label><input type="text" class="form-control" name="name" value="${patient.name || ""}" required></div>
                <div class="col-md-6 mb-3"><label class="form-label">Gender</label><select class="form-select" name="gender"><option value="Male" ${patient.gender === "Male" ? "selected" : ""}>Male</option><option value="Female" ${patient.gender === "Female" ? "selected" : ""}>Female</option></select></div>
                <div class="col-md-6 mb-3"><label class="form-label">Date of Birth</label><input type="date" class="form-control" name="date_of_birth" value="${patient.date_of_birth ? patient.date_of_birth.split("T")[0] : ""}" required></div>
                <div class="col-md-6 mb-3"><label class="form-label">Contact Info</label><input type="text" class="form-control" name="contact_info" value="${patient.contact_info || ""}"></div>
            </div><hr>
            <div class="row">
                <div class="col-md-6 mb-3"><label class="form-label">Insurance Provider</label><select class="form-select" name="insurance_provider_id"><option value="">None</option>${createOptions(providers,"id","name",patient.insurance_provider_id)}</select></div>
                <div class="col-md-6 mb-3"><label class="form-label">Policy Number</label><input type="text" class="form-control" name="policy_number" value="${patient.policy_number || ""}"></div>
            </div>
            <div class="mb-3"><label class="form-label">Emergency Contact</label><input type="text" class="form-control" name="emergency_contact" value="${patient.emergency_contact || ""}"></div>
            <div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">${isEditing ? "Save Changes" : "Create"}</button></div>
        </form>`;
        formModal.show();
        document.getElementById("modal-form").addEventListener("submit", (e) => { e.preventDefault(); const endpoint = isEditing ? `/api/patients/${id}` : "/api/patients"; submitForm(endpoint, isEditing ? "PUT" : "POST", Object.fromEntries(new FormData(e.target)), loadPatientsPage); });
    };

    const openAppointmentForm = async(id = null) => {
        const isEditing = id !== null;
        const [patients, doctors, branches, appointment] = await Promise.all([fetchData("/api/list/patients"), fetchData("/api/list/doctors"), fetchData("/api/list/branches"), isEditing ? fetchData(`/api/appointments/${id}`) : Promise.resolve({})]);
        formModalLabel.textContent = isEditing ? "Edit Appointment" : "Book Appointment";
        const scheduleDate = appointment.schedule_date ? new Date(new Date(appointment.schedule_date).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : "";
        formModalBody.innerHTML = `<form id="modal-form">
            <div class="row">
                <div class="col-md-6 mb-3"><label class="form-label">Patient</label><select class="form-select" name="patient_id" required>${createOptions(patients,"patient_id","name",appointment.patient_id)}</select></div>
                <div class="col-md-6 mb-3"><label class="form-label">Doctor</label><select class="form-select" name="doctor_id" required>${createOptions(doctors,"doctor_id","name",appointment.doctor_id)}</select></div>
                <div class="col-md-6 mb-3"><label class="form-label">Branch</label><select class="form-select" name="branch_id" required>${createOptions(branches,"branch_id","name",appointment.branch_id)}</select></div>
                <div class="col-md-6 mb-3"><label class="form-label">Date & Time</label><input type="datetime-local" class="form-control" name="schedule_date" value="${scheduleDate}" required></div>
                <div class="col-md-6 mb-3"><label class="form-label">Status</label><select class="form-select" name="status"><option ${appointment.status === "Scheduled" ? "selected" : ""}>Scheduled</option><option ${appointment.status === "Completed" ? "selected" : ""}>Completed</option><option ${appointment.status === "Cancelled" ? "selected" : ""}>Cancelled</option><option ${appointment.status === "Rescheduled" ? "selected" : ""}>Rescheduled</option></select></div>
            </div>
            <div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">${isEditing ? "Save Changes" : "Create"}</button></div></form>`;
        formModal.show();
        document.getElementById("modal-form").addEventListener("submit", (e) => { e.preventDefault(); const endpoint = isEditing ? `/api/appointments/${id}` : "/api/appointments"; submitForm(endpoint, isEditing ? "PUT" : "POST", Object.fromEntries(new FormData(e.target)), loadAppointmentsPage); });
    };

    const openBranchForm = async(id = null) => {
        const isEditing = id !== null;
        if (isEditing) {
            const [data, managers] = await Promise.all([
                fetchData(`/api/branches/${id}`),
                fetchData(`/api/staff/managers`)
            ]);
            if (!data || !managers) {
                showToast("Could not load data for the branch form.", 'danger');
                return;
            }
            formModalLabel.textContent = "Edit Branch";
            formModalBody.innerHTML = `<form id="modal-form">
                <div class="mb-3"><label class="form-label">Name</label><input type="text" class="form-control" name="name" value="${data.name || ''}" required></div>
                <div class="mb-3"><label class="form-label">Address</label><input type="text" class="form-control" name="address" value="${data.address || ''}"></div>
                <div class="mb-3"><label class="form-label">Contact Number</label><input type="text" class="form-control" name="contact_number" value="${data.contact_number || ''}"></div>
                <hr class="my-4">
                <div class="mb-3"><label class="form-label">Branch Manager</label><select class="form-select" name="manager_user_id"><option value="">No Manager Assigned</option>${createOptions(managers, "user_id", "name", data.manager_user_id)}</select><div class="form-text">Select an existing staff member with the 'Branch Manager' role.</div></div>
                <div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save Changes</button></div>
            </form>`;
            formModal.show();
            document.getElementById("modal-form").addEventListener("submit", (e) => { e.preventDefault(); submitForm(`/api/branches/${id}`, "PUT", Object.fromEntries(new FormData(e.target)), loadBranchesPage); });
            return;
        }

        formModalLabel.textContent = "Add New Branch";
        formModalBody.innerHTML = `<form id="modal-form">
            <h5>Branch Details</h5>
            <div class="row"><div class="col-md-12 mb-3"><label class="form-label">Branch Name</label><input type="text" class="form-control" name="name" required></div><div class="col-md-6 mb-3"><label class="form-label">Branch Address</label><input type="text" class="form-control" name="address"></div><div class="col-md-6 mb-3"><label class="form-label">Branch Contact Number</label><input type="text" class="form-control" name="contact_number"></div></div>
            <hr class="my-4">
            <h5>Branch Manager Details</h5><p class="text-muted small">This will create a new staff account for the manager.</p>
            <div class="row"><div class="col-md-6 mb-3"><label class="form-label">Manager Full Name</label><input type="text" class="form-control" name="manager_name" required></div><div class="col-md-6 mb-3"><label class="form-label">Manager Contact Info</label><input type="text" class="form-control" name="manager_contact_info" required></div><div class="col-md-6 mb-3"><label class="form-label">Manager Username</label><input type="text" class="form-control" name="manager_username" required></div><div class="col-md-6 mb-3"><label class="form-label">Manager Account Email</label><input type="email" class="form-control" name="manager_email" required></div><div class="col-md-6 mb-3"><label class="form-label">Manager Password</label><input type="password" class="form-control" name="manager_password" required></div></div>
            <div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Create Branch & Manager</button></div>
        </form>`;
        formModal.show();
        document.getElementById("modal-form").addEventListener("submit", (e) => { e.preventDefault(); submitForm("/api/branches", "POST", Object.fromEntries(new FormData(e.target)), loadBranchesPage); });
    };

    const openProviderForm = async(id = null) => {
        const isEditing = id !== null;
        const data = isEditing ? await fetchData(`/api/insurance-providers/${id}`) : {};
        formModalLabel.textContent = isEditing ? "Edit Provider" : "Add Provider";
        formModalBody.innerHTML = `<form id="modal-form"><div class="mb-3"><label class="form-label">Name</label><input type="text" class="form-control" name="name" value="${data.name || ''}" required></div><div class="mb-3"><label class="form-label">Contact Number</label><input type="text" class="form-control" name="contact_number" value="${data.contact_number || ''}"></div><div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save</button></div></form>`;
        formModal.show();
        document.getElementById("modal-form").addEventListener("submit", (e) => { e.preventDefault(); const endpoint = isEditing ? `/api/insurance-providers/${id}` : "/api/insurance-providers"; submitForm(endpoint, isEditing ? "PUT" : "POST", Object.fromEntries(new FormData(e.target)), loadInsuranceProvidersPage); });
    };
    
    const openTreatmentForm = async(id = null) => {
        const isEditing = id !== null;
        const data = isEditing ? await fetchData(`/api/treatments/${id}`) : {};
        formModalLabel.textContent = isEditing ? "Edit Treatment" : "Add Treatment";
        formModalBody.innerHTML = `<form id="modal-form">
            <div class="row">
                <div class="col-md-6 mb-3"><label class="form-label">Service Code</label><input type="text" class="form-control" name="service_code" value="${data.service_code || ''}" ${isEditing ? 'readonly' : 'required'}></div>
                <div class="col-md-6 mb-3"><label class="form-label">Name</label><input type="text" class="form-control" name="name" value="${data.name || ''}" required></div>
                <div class="col-md-6 mb-3"><label class="form-label">Price</label><input type="number" step="0.01" class="form-control" name="price" value="${data.price || ''}" required></div>
            </div>
            <div class="mb-3"><label class="form-label">Description</label><textarea class="form-control" name="description">${data.description || ''}</textarea></div>
            <div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save</button></div>
        </form>`;
        formModal.show();
        document.getElementById("modal-form").addEventListener("submit", (e) => { e.preventDefault(); const endpoint = isEditing ? `/api/treatments/${id}` : "/api/treatments"; submitForm(endpoint, isEditing ? "PUT" : "POST", Object.fromEntries(new FormData(e.target)), loadTreatmentsPage); });
    };

    const openSpecialtyForm = async(id = null) => {
        const isEditing = id !== null;
        const data = isEditing ? await fetchData(`/api/specialties/${id}`) : {};
        formModalLabel.textContent = isEditing ? "Edit Specialty" : "Add Specialty";
        formModalBody.innerHTML = `<form id="modal-form"><div class="mb-3"><label class="form-label">Name</label><input type="text" class="form-control" name="name" value="${data.name || ''}" required></div><div class="mb-3"><label class="form-label">Description</label><textarea class="form-control" name="description">${data.description || ''}</textarea></div><div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save</button></div></form>`;
        formModal.show();
        document.getElementById("modal-form").addEventListener("submit", (e) => { e.preventDefault(); const endpoint = isEditing ? `/api/specialties/${id}` : "/api/specialties"; submitForm(endpoint, isEditing ? "PUT" : "POST", Object.fromEntries(new FormData(e.target)), loadSpecialtiesPage); });
    };

    // ✅ **MODIFICATION**: Replaced the entire function to handle both Add and Edit cases.
    const openStaffForm = async (id = null) => {
        const isEditing = id !== null;

        // Fetch all necessary data: existing staff data (if editing), roles, branches, and specialties
        const [staffData, roles, branches, specialties] = await Promise.all([
            isEditing ? fetchData(`/api/staff/${id}`) : Promise.resolve({}),
            fetchData("/api/list/roles"),
            fetchData("/api/list/branches"),
            fetchData("/api/list/specialties")
        ]);

        if (!roles || !branches || !specialties || (isEditing && !staffData)) {
            showToast('Could not load necessary data for the form.', 'danger');
            return;
        }

        formModalLabel.textContent = isEditing ? "Edit Staff Member" : "Add New Staff";
        formModalBody.innerHTML = `<form id="modal-form">
            <div class="row">
                <div class="col-md-6 mb-3"><label class="form-label">Full Name</label><input type="text" name="name" class="form-control" value="${staffData.name || ''}" required></div>
                <div class="col-md-6 mb-3"><label class="form-label">Contact Info</label><input type="text" name="contact_info" class="form-control" value="${staffData.contact_info || ''}" required></div>
            </div>
            <hr>
            <div class="row">
                <div class="col-md-6 mb-3"><label class="form-label">Username</label><input type="text" name="username" class="form-control" value="${staffData.username || ''}" required></div>
                <div class="col-md-6 mb-3"><label class="form-label">Account Email</label><input type="email" name="email" class="form-control" value="${staffData.email || ''}" required></div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Password</label>
                    <input type="password" name="password" class="form-control" placeholder="${isEditing ? 'Leave blank to keep current' : ''}" ${isEditing ? '' : 'required'}>
                </div>
            </div>
            <hr>
            <div class="row">
                <div class="col-md-6 mb-3"><label class="form-label">Role</label><select name="role_id" class="form-select" required>${createOptions(roles, "role_id", "name", staffData.role_id)}</select></div>
                <div class="col-md-6 mb-3"><label class="form-label">Branch</label><select name="branch_id" class="form-select" required>${createOptions(branches, "branch_id", "name", staffData.branch_id)}</select></div>
                <div class="col-md-6 mb-3 d-none" id="specialty-container">
                    <label class="form-label">Specialty</label>
                    <select name="specialty_id" class="form-select">${createOptions(specialties, "specialty_id", "name", staffData.specialty_id)}</select>
                </div>
            </div>
            <div class="mb-3 form-check">
                <input type="checkbox" name="is_medical_staff" class="form-check-input" value="1" ${staffData.is_medical_staff ? 'checked' : ''}>
                <label class="form-check-label">Is Medical Staff</label>
            </div>
            <div class="modal-footer mt-4">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="submit" class="btn btn-primary">${isEditing ? 'Save Changes' : 'Create Staff'}</button>
            </div>
        </form>`;

        formModal.show();

        const roleSelect = formModalBody.querySelector('[name="role_id"]');
        const specialtyContainer = formModalBody.querySelector('#specialty-container');

        const toggleSpecialtyField = () => {
            const selectedRoleText = roleSelect.selectedOptions[0]?.text;
            if (selectedRoleText === 'Doctor') {
                specialtyContainer.classList.remove('d-none');
            } else {
                specialtyContainer.classList.add('d-none');
            }
        };
        
        // Check on initial load for the edit form
        toggleSpecialtyField();

        // Add event listener for any subsequent changes
        roleSelect.addEventListener('change', toggleSpecialtyField);

        document.getElementById("modal-form").addEventListener("submit", (e) => {
            e.preventDefault();
            const endpoint = isEditing ? `/api/staff/${id}` : "/api/staff";
            const method = isEditing ? "PUT" : "POST";
            submitForm(endpoint, method, Object.fromEntries(new FormData(e.target)), loadStaffPage);
        });
    };

    const viewPayments = async(invoiceId) => {
        detailsModalLabel.textContent = `Payments for Invoice #${invoiceId}`;
        detailsModalBody.innerHTML = `<p class="text-center p-4">Loading...</p>`;
        detailsModal.show();
        const payments = await fetchData(`/api/payments/by-invoice/${invoiceId}`);
        const token = localStorage.getItem('clinicProToken'); 
        let content = `<div class="table-responsive"><table class="table"><thead><tr><th>Date</th><th>Amount</th><th>Method</th></tr></thead><tbody>`;
        if (payments && payments.length > 0) {
            content += payments.map(p => `<tr><td>${new Date(p.payment_date).toLocaleString()}</td><td>$${parseFloat(p.paid_amount).toFixed(2)}</td><td>${p.method_of_payment}</td></tr>`).join("");
        } else {
            content += `<tr><td colspan="3" class="text-center text-muted p-4">No payments found.</td></tr>`;
        }
        content += `</tbody></table></div><hr><h5 class="mb-3">Record New Payment</h5><form id="payment-form"><input type="hidden" name="invoice_id" value="${invoiceId}"><div class="row"><div class="col-md-4 mb-3"><label class="form-label">Amount</label><input type="number" step="0.01" name="paid_amount" class="form-control" required></div><div class="col-md-4 mb-3"><label class="form-label">Method</label><select name="method_of_payment" class="form-select"><option>Cash</option><option>Credit Card</option><option>Bank Transfer</option></select></div><div class="col-md-4 mb-3"><label class="form-label">Date</label><input type="date" name="payment_date" class="form-control" value="${new Date().toISOString().split("T")[0]}" required></div></div><button type="submit" class="btn btn-primary">Record Payment</button></form>`;
        detailsModalBody.innerHTML = content;
        document.getElementById("payment-form").addEventListener("submit", async(e) => {
            e.preventDefault();
            const formData = Object.fromEntries(new FormData(e.target));
            try {
                const response = await fetch(`${API_BASE_URL}/api/payments`, { method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(formData) });
                if (!response.ok) throw new Error("Payment submission failed");
                detailsModal.hide();
                loadInvoicesPage();
                showToast(`Success! Payment has been recorded.`);
            } catch (error) {
                showToast(`An error occurred: ${error.message}`, 'danger');
            }
        });
    };

    // --- ROUTING LOGIC & EVENT LISTENERS ---
    const pageLoaders = { dashboard: loadDashboard, patients: loadPatientsPage, appointments: loadAppointmentsPage, doctors: loadDoctorsPage, staff: loadStaffPage, branches: loadBranchesPage, invoices: loadInvoicesPage, "insurance-providers": loadInsuranceProvidersPage, treatments: loadTreatmentsPage, specialties: loadSpecialtiesPage };
    const navigateTo = (page) => { navLinks.forEach((link) => link.classList.toggle("active", link.dataset.page === page)); (pageLoaders[page] || pageLoaders.dashboard)(); };
    document.querySelector(".sidebar").addEventListener("click", (e) => { const navLink = e.target.closest(".nav-link"); if (navLink) { e.preventDefault(); const page = navLink.dataset.page; history.pushState({page}, '', `#${page}`); navigateTo(page); } });
    window.addEventListener('popstate', (e) => navigateTo(location.hash.substring(1) || 'dashboard'));
    
    mainContent.addEventListener("click", (e) => {
        const target = e.target.closest("button[data-action]");
        if (!target) return;
        const { action, type, id } = target.dataset;
        const entityMap = {
            patient: { refresh: loadPatientsPage, endpoint: 'patients', name: 'patient', handler: openPatientForm },
            staff: { refresh: loadStaffPage, endpoint: 'staff', name: 'staff member', handler: openStaffForm },
            appointment: { refresh: loadAppointmentsPage, endpoint: 'appointments', name: 'appointment', handler: openAppointmentForm },
            branch: { refresh: loadBranchesPage, endpoint: 'branches', name: 'branch', handler: openBranchForm },
            'insurance-provider': { refresh: loadInsuranceProvidersPage, endpoint: 'insurance-providers', name: 'provider', handler: openProviderForm },
            treatment: { refresh: loadTreatmentsPage, endpoint: 'treatments', name: 'treatment', handler: openTreatmentForm },
            specialty: { refresh: loadSpecialtiesPage, endpoint: 'specialties', name: 'specialty', handler: openSpecialtyForm },
            payment: { handler: viewPayments }
        };
        const entity = entityMap[type];
        if (!entity) return;
        if ((action === "add" || action === "edit" || action === "view") && entity.handler) {
            entity.handler(action === "add" ? null : id);
        } else if (action === "delete" && entity.endpoint) {
            deleteItem(`/api/${entity.endpoint}/${id}`, entity.name, entity.refresh);
        }
    });
    
    // --- INITIAL PAGE LOAD ---
    navigateTo(location.hash.substring(1) || "dashboard");
});