// reception.js
const API_BASE_URL = "https://hms-production-a5ad.up.railway.app";
const authToken = localStorage.getItem('clinicProToken');
if (!authToken) window.location.href = '/login.html';

document.addEventListener("DOMContentLoaded", () => {
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

    const showToast = (message, type = 'success') => {
        const toastId = 'toast-' + Math.random().toString(36).substring(2, 9);
        const icon = type === 'success' ? 'check-circle-fill' : 'exclamation-triangle-fill';
        const toastHTML = `<div id="${toastId}" class="toast align-items-center text-bg-${type} border-0" role="alert" aria-live="assertive" aria-atomic="true"><div class="d-flex"><div class="toast-body"><i class="bi bi-${icon} me-2"></i>${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`;
        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    };

    const authorizedFetch = async (endpoint, options = {}) => {
        const defaultOptions = { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` } };
        const mergedOptions = { ...defaultOptions, ...options, headers: { ...defaultOptions.headers, ...options.headers } };
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, mergedOptions);
            if ([401, 403].includes(response.status)) { localStorage.removeItem('clinicProToken'); window.location.href = '/login.html'; return null; }
            if (!response.ok) { const err = await response.json(); throw new Error(err.message || `HTTP error! status: ${response.status}`); }
            return response.status === 204 ? null : response.json();
        } catch (error) { console.error("Fetch error:", error); showToast(`Error: ${error.message}`, 'danger'); return null; }
    };

    const submitForm = async (endpoint, method, data, callback) => {
        const filteredData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v != null && v !== ''));
        const result = await authorizedFetch(endpoint, { method, body: JSON.stringify(filteredData) });
        if (result !== null && callback) { formModal.hide(); showToast(`Record ${method === 'POST' ? 'created' : 'updated'} successfully.`); callback(); }
        return result;
    };

    const deleteItem = async (type, id, callback) => {
        if (confirm(`Are you sure you want to delete this ${type}?`)) {
            const result = await authorizedFetch(`/api/${type}s/${id}`, { method: 'DELETE' });
            if (result === null) { showToast(`${type} deleted successfully.`); callback(); }
        }
    };

    const createOptions = (items, valueField, textField, selectedValue) => items.map(item => `<option value="${item[valueField]}" ${item[valueField] == selectedValue ? "selected" : ""}>${item[textField]}</option>`).join("");
    const renderSpinner = (target) => target.innerHTML = `<div class="d-flex justify-content-center p-5"><div class="spinner-border text-primary"></div></div>`;
    const renderNoData = (target, msg) => {
        if (target) target.innerHTML = `<div class="text-center p-5 text-muted">${msg}</div>`;
    };
    const createPageTemplate = (config) => {
        const { title, type, headers, showAddBtn = true, showSearch = true } = config;
        const typeName = type.split('-').join(' ');
        mainContent.innerHTML = `<div class="page-header"><h1>${title}</h1><div class="d-flex align-items-center gap-2">${showSearch ? `<div class="search-wrapper"><input type="search" id="search-input" class="form-control" placeholder="Search..."></div>` : ''}${showAddBtn ? `<button class="btn btn-primary" data-action="add" data-type="${type}"><i class="bi bi-plus-lg me-1"></i> Add ${typeName.charAt(0).toUpperCase() + typeName.slice(1)}</button>` : ""}</div></div><div class="card"><div class="card-body"><div class="table-responsive"><table class="table table-hover"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}${headers.length > 0 ? '<th>Actions</th>' : ''}</tr></thead><tbody id="table-body"></tbody></table></div></div></div>`;
    };

    const setupSearch = (renderFunction, searchableKeys) => {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.oninput = e => {
                const term = e.target.value.toLowerCase();
                const filtered = !term ? currentViewData : currentViewData.filter(item => searchableKeys.some(key => item[key]?.toString().toLowerCase().includes(term)));
                renderFunction(filtered);
            };
        }
    };

    // RENDERERS
    const renderPatientsTable = data => {
        const tableBody = document.getElementById("table-body");
        if (!tableBody) return;
        if (!data || data.length === 0) { renderNoData(tableBody, 'No patients found.'); return; }
        tableBody.innerHTML = data.map(p => `<tr><td>${p.patient_id}</td><td>${p.name}</td><td>${p.age}</td><td>${p.contact_info || ""}</td><td class="table-actions"><button class="btn btn-sm btn-outline-primary" data-action="details" data-type="patient" data-id="${p.patient_id}"><i class="bi bi-person-vcard"></i></button><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="patient" data-id="${p.patient_id}"><i class="bi bi-pencil-fill"></i></button></td></tr>`).join("");
    };

    const renderAppointmentsTable = data => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { renderNoData(tableBody, 'No appointments found.'); return; }
        const statusColors = { Scheduled: 'primary', Completed: 'success', Cancelled: 'danger', Rescheduled: 'warning' };
        tableBody.innerHTML = data.map(a => `<tr><td>${a.appointment_id}</td><td>${new Date(a.schedule_date).toLocaleString()}</td><td>${a.patient_name}</td><td>${a.doctor_name}</td><td><span class="badge bg-${statusColors[a.status] || 'secondary'}">${a.status}</span></td><td class="table-actions">${['Scheduled', 'Rescheduled'].includes(a.status) ? `<button class="btn btn-sm btn-outline-primary" data-action="reschedule" data-type="appointment" data-id="${a.appointment_id}"><i class="bi bi-calendar-event"></i></button>` : ''}<button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="appointment" data-id="${a.appointment_id}"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="appointment" data-id="${a.appointment_id}"><i class="bi bi-trash-fill"></i></button></td></tr>`).join("");
    };

    const renderSchedulesTable = schedules => {
        const tableBody = document.getElementById('table-body');
        if (!schedules || schedules.length === 0) { renderNoData(tableBody, 'Could not load schedules.'); return; }
        tableBody.innerHTML = schedules.map(doc => `<tr><td>${doc.name}</td><td>${doc.specialty}</td><td><ul class="time-slot-list">${doc.appointments.length > 0 ? doc.appointments.map(a => `<li class="booked"><strong>${new Date(a.schedule_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong><br><small>${a.patient_name}</small></li>`).join('') : '<li class="text-muted small">No bookings</li>'}</ul></td><td><ul class="time-slot-list">${doc.availability.length > 0 ? doc.availability.map(s => `<li class="available">${s}</li>`).join('') : '<li class="text-muted small">No available slots</li>'}</ul></td></tr>`).join('');
    };

    const renderInvoicesTable = data => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { renderNoData(tableBody, 'No invoices found.'); return; }
        const statusColors = { 'Pending': 'warning', 'Paid': 'success', 'Partially Paid': 'info', 'Overdue': 'danger' };
        tableBody.innerHTML = data.map(i => `<tr><td>${i.invoice_id}</td><td>${i.patient_name}</td><td>Rs.${Number(i.total_amount).toFixed(2)}</td><td>Rs.${Number(i.due_amount).toFixed(2)}</td><td><span class="badge bg-${statusColors[i.status] || 'secondary'}">${i.status}</span></td><td>${new Date(i.due_date).toLocaleDateString()}</td><td class="table-actions">${i.status !== 'Paid' ? `<button class="btn btn-sm btn-outline-success" data-action="pay" data-type="invoice" data-id="${i.invoice_id}" data-due="${i.due_amount}"><i class="bi bi-cash-coin"></i></button>` : ''}<button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="invoice" data-id="${i.invoice_id}"><i class="bi bi-trash-fill"></i></button></td></tr>`).join("");
    };

    // PAGE LOADERS
    const loadPatientsPage = async () => { createPageTemplate({ title: "Patients", type: "patient", headers: ["ID", "Name", "Age", "Contact"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/patients"); renderPatientsTable(currentViewData); setupSearch(renderPatientsTable, ['patient_id', 'name', 'contact_info']); };
    const loadAppointmentsPage = async () => { createPageTemplate({ title: "Appointments", type: "appointment", headers: ["ID", "Date", "Patient", "Doctor", "Status"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/appointments"); renderAppointmentsTable(currentViewData); setupSearch(renderAppointmentsTable, ['appointment_id', 'patient_name', 'doctor_name']); };
    const loadInvoicesPage = async () => { createPageTemplate({ title: "Invoicing", type: "invoice", headers: ["ID", "Patient", "Total", "Due", "Status", "Due Date"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/invoices"); renderInvoicesTable(currentViewData); setupSearch(renderInvoicesTable, ['invoice_id', 'patient_name']); };

    const loadSchedulesPage = () => {
        createPageTemplate({ title: "Doctor Schedules", type: "schedule", headers: ["Doctor", "Specialty", "Booked Slots", "Available Slots"], showAddBtn: false, showSearch: false });
        const header = mainContent.querySelector('.page-header .d-flex');
        header.insertAdjacentHTML('beforeend', `<div class="d-flex align-items-center gap-2 ms-auto"><label class="col-form-label">Date:</label><input type="date" id="schedule-date-picker" class="form-control" style="width: auto;"></div>`);
        const datePicker = document.getElementById('schedule-date-picker');
        datePicker.value = new Date().toISOString().split('T')[0];
        const fetchAndRender = async () => {
            renderSpinner(document.getElementById('table-body'));
            const doctors = await authorizedFetch('/api/list/doctors');
            if (!doctors) { renderNoData(document.getElementById('table-body'), 'Could not load doctors.'); return; }
            const schedules = await Promise.all(doctors.map(async doc => {
                const [availability, appointments] = await Promise.all([authorizedFetch(`/api/doctors/${doc.doctor_id}/availability?date=${datePicker.value}`), authorizedFetch(`/api/appointments/doctor/${doc.doctor_id}?date=${datePicker.value}`)]);
                return { ...doc, availability: availability || [], appointments: appointments || [] };
            }));
            renderSchedulesTable(schedules);
        };
        datePicker.onchange = fetchAndRender;
        fetchAndRender();
    };

    // FORM HANDLERS
    const openPatientForm = async (id = null) => {
        const isEditing = id !== null;
        const [patient, providers] = await Promise.all([isEditing ? authorizedFetch(`/api/patients/${id}`) : Promise.resolve({}), authorizedFetch("/api/list/insurance-providers")]);
        formModalLabel.textContent = isEditing ? "Edit Patient" : "Add Patient";
        formModalBody.innerHTML = `<form id="modal-form"><div class="row"><div class="col-md-6 mb-3"><label>Name</label><input type="text" class="form-control" name="name" value="${patient.name || ''}" required></div><div class="col-md-6 mb-3"><label>Gender</label><select class="form-select" name="gender"><option value="Male" ${patient.gender === "Male" ? "selected" : ""}>Male</option><option value="Female" ${patient.gender === "Female" ? "selected" : ""}>Female</option></select></div><div class="col-md-6 mb-3"><label>Date of Birth</label><input type="date" class="form-control" name="date_of_birth" value="${patient.date_of_birth?.split("T")[0] || ''}" required></div><div class="col-md-6 mb-3"><label>Contact</label><input type="text" class="form-control" name="contact_info" value="${patient.contact_info || ''}"></div></div><hr><div class="row"><div class="col-md-6 mb-3"><label>Insurance Provider</label><select class="form-select" name="insurance_provider_id"><option value="">None</option>${createOptions(providers, "id", "name", patient.insurance_provider_id)}</select></div><div class="col-md-6 mb-3"><label>Policy Number</label><input type="text" class="form-control" name="policy_number" value="${patient.policy_number || ''}"></div></div><div class="mb-3"><label>Emergency Contact</label><input type="text" class="form-control" name="emergency_contact" value="${patient.emergency_contact || ''}"></div><div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save</button></div></form>`;
        formModal.show();
        document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); submitForm(isEditing ? `/api/patients/${id}` : "/api/patients", isEditing ? "PUT" : "POST", Object.fromEntries(new FormData(e.target)), loadPatientsPage); };
    };

    const openPatientDetailsModal = async (patientId) => {
        detailsModalLabel.textContent = `Patient Details`; renderSpinner(detailsModalBody); detailsModal.show();
        const data = await authorizedFetch(`/api/patients/${patientId}/details`);
        if (!data) { renderNoData(detailsModalBody, 'Could not load patient details.'); return; }
        const { profile, history } = data;
        const statusColors = { 'Paid': 'success', 'Partially Paid': 'info', 'Pending': 'warning', 'Completed': 'success', 'Scheduled': 'primary', 'Cancelled': 'danger' };
        detailsModalLabel.textContent = `Details for ${profile.name}`;
        detailsModalBody.innerHTML = `<div class="card mb-4"><div class="card-header"><h5 class="mb-0">Profile</h5></div><div class="card-body"><div class="row"><div class="col-md-6"><strong>DOB:</strong> ${new Date(profile.date_of_birth).toLocaleDateString()} (${profile.age} years)</div><div class="col-md-6"><strong>Gender:</strong> ${profile.gender}</div><div class="col-md-6"><strong>Contact:</strong> ${profile.contact_info || 'N/A'}</div><div class="col-md-6"><strong>Emergency:</strong> ${profile.emergency_contact || 'N/A'}</div></div><hr><div class="row"><div class="col-md-6"><strong>Insurance:</strong> ${profile.insurance_provider_name || 'None'}</div><div class="col-md-6"><strong>Policy #:</strong> ${profile.policy_number || 'N/A'}</div></div></div></div><h5>History</h5>${history.length > 0 ? history.map(appt => `<div class="card mb-3"><div class="card-body p-3"><div class="d-flex justify-content-between"><div><h6 class="mb-1">Apt with ${appt.doctor_name}</h6><small class="text-muted">${new Date(appt.schedule_date).toLocaleString()}</small></div><span class="badge bg-${statusColors[appt.status] || 'secondary'}">${appt.status}</span></div>${appt.invoice_id ? `<hr class="my-2"><div class="billing-details"><p class="mb-1"><strong>Invoice #${appt.invoice_id}</strong> <span class="badge bg-${statusColors[appt.invoice_status] || 'secondary'} ms-2">${appt.invoice_status}</span></p><ul class="list-unstyled small"><li>Total: Rs.${Number(appt.total_amount).toFixed(2)}</li><li><strong>Due: Rs.${Number(appt.due_amount).toFixed(2)}</strong></li>${appt.payments.length > 0 ? `<li class="mt-1"><strong>Payments:</strong><ul>${appt.payments.map(p => `<li>Rs.${Number(p.paid_amount).toFixed(2)} via ${p.method_of_payment} on ${new Date(p.payment_date).toLocaleDateString()}</li>`).join('')}</ul></li>` : ''}</ul></div>` : ''}</div></div>`).join('') : '<div class="text-center p-4 text-muted">No history found.</div>'}`;
    };

    const openAppointmentForm = async (id = null) => {
        const isEditing = id !== null;
        const [patients, doctors, branches, appointment] = await Promise.all([authorizedFetch("/api/list/patients"), authorizedFetch("/api/list/doctors"), authorizedFetch("/api/list/branches"), isEditing ? authorizedFetch(`/api/appointments/${id}`) : Promise.resolve({})]);
        formModalLabel.textContent = isEditing ? "Edit Appointment" : "Book Appointment";
        const localDate = appointment.schedule_date ? new Date(new Date(appointment.schedule_date).getTime() - (new Date().getTimezoneOffset() * 60000)) : null;
        formModalBody.innerHTML = `<form id="modal-form"><div class="row"><div class="col-md-6 mb-3"><label>Patient</label><select class="form-select" name="patient_id" required>${createOptions(patients, "patient_id", "name", appointment.patient_id)}</select></div><div class="col-md-6 mb-3"><label>Doctor</label><select class="form-select" name="doctor_id" id="appointment-doctor" required>${createOptions(doctors, "doctor_id", "name", appointment.doctor_id)}</select></div><div class="col-md-6 mb-3"><label>Branch</label><select class="form-select" name="branch_id" required>${createOptions(branches, "branch_id", "name", appointment.branch_id)}</select></div><div class="col-md-6 mb-3"><label>Status</label><select class="form-select" name="status"><option ${appointment.status === "Scheduled" ? "selected" : ""}>Scheduled</option><option ${appointment.status === "Completed" ? "selected" : ""}>Completed</option><option ${appointment.status === "Cancelled" ? "selected" : ""}>Cancelled</option></select></div></div><hr/><div class="row"><div class="col-md-6 mb-3"><label>Date</label><input type="date" class="form-control" name="schedule_date_only" id="appointment-date" value="${localDate?.toISOString().split('T')[0] || ''}" required></div><div class="col-md-6 mb-3"><label>Time</label><select class="form-select" name="schedule_time" id="appointment-time" required disabled><option>Select doctor and date</option></select></div></div><div class="form-check mb-3"><input type="checkbox" name="is_emergency" value="1" class="form-check-input" ${appointment.is_emergency ? "checked" : ""}><label class="form-check-label">Emergency Walk-in</label></div><div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save</button></div></form>`;
        formModal.show();

        const doctorSelect = document.getElementById("appointment-doctor"), dateInput = document.getElementById("appointment-date"), timeSelect = document.getElementById("appointment-time");
        const updateTimes = async () => {
            if (!doctorSelect.value || !dateInput.value) { timeSelect.innerHTML = '<option>Select doctor and date</option>'; timeSelect.disabled = true; return; }
            timeSelect.disabled = true; timeSelect.innerHTML = '<option>Loading...</option>';
            const slots = await authorizedFetch(`/api/doctors/${doctorSelect.value}/availability?date=${dateInput.value}`);
            const timeToSelect = (isEditing && dateInput.value === localDate?.toISOString().split('T')[0]) ? localDate.toISOString().substring(11, 16) : null;
            if (slots) { timeSelect.innerHTML = createOptions(slots.map(s => ({ v: s, t: s })), 'v', 't', timeToSelect); timeSelect.disabled = false; } else { timeSelect.innerHTML = '<option>No slots</option>'; }
        };
        doctorSelect.onchange = updateTimes; dateInput.onchange = updateTimes;
        if (isEditing) updateTimes();

        document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.target)); data.schedule_date = `${data.schedule_date_only} ${data.schedule_time}`; delete data.schedule_date_only; delete data.schedule_time; submitForm(isEditing ? `/api/appointments/${id}` : "/api/appointments", isEditing ? "PUT" : "POST", data, loadAppointmentsPage); };
    };

    const openRescheduleForm = async id => {
        const appt = currentViewData.find(a => a.appointment_id == id);
        formModalLabel.textContent = "Reschedule Appointment";
        formModalBody.innerHTML = `<div class="alert alert-info small"><strong>Patient:</strong> ${appt.patient_name}<br><strong>Doctor:</strong> ${appt.doctor_name}</div><form id="modal-form"><div class="mb-3"><label>New Date & Time</label><input type="datetime-local" class="form-control" name="schedule_date" value="${new Date(new Date(appt.schedule_date).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16)}" required></div><div class="mb-3"><label>Reason</label><textarea class="form-control" name="reschedule_reason" rows="2"></textarea></div><div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Reschedule</button></div></form>`;
        formModal.show();
        document.getElementById("modal-form").onsubmit = async e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.target)); data.status = 'Rescheduled'; if (await submitForm(`/api/appointments/${id}`, "PUT", data)) { formModal.hide(); showToast('Rescheduled successfully.'); loadAppointmentsPage(); } };
    };

    const openInvoiceForm = async () => {
        formModalLabel.textContent = "Create New Invoice";
        const uninvoiced = await authorizedFetch('/api/appointments/uninvoiced');
        const today = new Date().toISOString().split('T')[0];
        const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);
        formModalBody.innerHTML = `<form id="modal-form"><div class="mb-3"><label>Appointment</label><select class="form-select" name="appointment_id" id="appointment-select" required><option value="">Select a completed appointment</option>${uninvoiced.map(a => `<option value="${a.appointment_id}" data-has-insurance="${!!a.insurance_provider_id}">ID ${a.appointment_id} - ${a.patient_name} on ${new Date(a.schedule_date).toLocaleDateString()}</option>`).join('')}</select></div><hr><div class="row"><div class="col-md-6 mb-3 d-none" id="insurance-field-wrapper"><label>Insurance Coverage ($)</label><input type="number" step="0.01" class="form-control" name="insurance_coverage" id="insurance_coverage" value="0"></div></div><div class="row"><div class="col-md-6 mb-3"><label>Initial Payment ($)</label><input type="number" step="0.01" min="0" class="form-control" name="initial_payment" placeholder="Amount paid now"></div></div><hr><div class="row"><div class="col-md-6 mb-3"><label>Issued Date</label><input type="date" class="form-control" name="issued_date" value="${today}" required></div><div class="col-md-6 mb-3"><label>Due Date</label><input type="date" class="form-control" name="due_date" value="${dueDate.toISOString().split('T')[0]}" required></div></div><div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Create</button></div></form>`;
        formModal.show();
        document.getElementById('appointment-select').onchange = e => document.getElementById('insurance-field-wrapper').classList.toggle('d-none', e.target.options[e.target.selectedIndex].dataset.hasInsurance !== 'true');
        document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); submitForm("/api/invoices", "POST", Object.fromEntries(new FormData(e.target)), loadInvoicesPage); };
    };

    const openPaymentForm = (id, dueAmount) => {
        formModalLabel.textContent = `Record Payment for Invoice #${id}`;
        formModalBody.innerHTML = `<div class="alert alert-info">Amount Due: <strong>Rs.${Number(dueAmount).toFixed(2)}</strong></div><form id="modal-form"><input type="hidden" name="invoice_id" value="${id}"><div class="row"><div class="col-md-6 mb-3"><label>Payment Amount ($)</label><input type="number" step="0.01" min="0.01" max="${dueAmount}" class="form-control" name="paid_amount" required></div><div class="col-md-6 mb-3"><label>Payment Date</label><input type="date" class="form-control" name="payment_date" value="${new Date().toISOString().split('T')[0]}" required></div></div><div class="mb-3"><label>Method</label><select class="form-select" name="method_of_payment" required><option>Cash</option><option>Credit Card</option><option>Bank Transfer</option></select></div><div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Submit Payment</button></div></form>`;
        formModal.show();
        document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); submitForm("/api/payments", "POST", Object.fromEntries(new FormData(e.target)), loadInvoicesPage); };
    };

    // ROUTING & EVENT LISTENERS
    const pageLoaders = { patients: loadPatientsPage, appointments: loadAppointmentsPage, schedules: loadSchedulesPage, invoices: loadInvoicesPage };
    const navigateTo = page => { navLinks.forEach(l => l.classList.toggle("active", l.dataset.page === page)); (pageLoaders[page] || pageLoaders.appointments)(); };
    document.querySelector(".sidebar").onclick = e => { const navLink = e.target.closest(".nav-link"); if (navLink) { e.preventDefault(); navigateTo(navLink.dataset.page); } };
    document.getElementById('logout-button').onclick = e => { e.preventDefault(); localStorage.removeItem('clinicProToken'); window.location.href = 'login.html'; };

    mainContent.onclick = e => {
        const target = e.target.closest("button[data-action]");
        if (!target) return;
        const { action, type, id } = target.dataset;
        const map = {
            patient: { add: openPatientForm, edit: openPatientForm, details: openPatientDetailsModal },
            appointment: { add: openAppointmentForm, edit: openAppointmentForm, reschedule: openRescheduleForm, delete: id => deleteItem('appointment', id, loadAppointmentsPage) },
            invoice: { add: openInvoiceForm, pay: id => openPaymentForm(id, target.dataset.due), delete: id => deleteItem('invoice', id, loadInvoicesPage) }
        };
        map[type]?.[action]?.(id);
    };

    navigateTo("appointments");
});
