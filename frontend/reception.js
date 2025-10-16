// reception.js

const API_BASE_URL = "http://localhost:3000";

// --- GLOBAL AUTH TOKEN ---
// This token should be saved in localStorage after a successful login
const authToken = localStorage.getItem('clinicProToken');
if (!authToken) {
    // If no token, the user is not logged in. Redirect to a login page.
    alert("You are not logged in. Redirecting...");
    window.location.href = '/login.html'; // Assumes you have a login.html
}

document.addEventListener("DOMContentLoaded", () => {
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

    let currentViewData = [];

    // --- GENERIC HELPER FUNCTIONS (Modified for Auth) ---

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
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        };
        const mergedOptions = { ...defaultOptions, ...options, headers: { ...defaultOptions.headers, ...options.headers } };

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, mergedOptions);
            if (response.status === 401 || response.status === 403) {
                localStorage.removeItem('clinicProToken');
                window.location.href = '/login.html';
                return null;
            }
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                return response.json();
            }
            return; // Return nothing for non-json responses like 204 No Content
        } catch (error) {
            console.error("Fetch error:", error);
            showToast(`Error: ${error.message}`, 'danger');
            return null;
        }
    };
    
    const submitForm = async(endpoint, method, data, callback) => {
        try {
            const filteredData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v != null && v !== ''));
            const result = await authorizedFetch(endpoint, {
                method,
                body: JSON.stringify(filteredData),
            });

            if (result !== null && callback) {
                formModal.hide();
                const action = method === 'POST' ? 'created' : 'updated';
                // Adjust entity name for 'invoice'
                let entity = endpoint.split('/')[2].slice(0, -1); 
                if (endpoint.includes('invoices')) {
                    entity = 'invoice';
                }
                showToast(`${entity.charAt(0).toUpperCase() + entity.slice(1)} ${action} successfully.`);
                callback(); // Reload the page data
            }
            return result;

        } catch (error) {
            console.error("Submit error:", error);
            showToast(`An error occurred: ${error.message}`, 'danger');
            return null;
        }
    };
    
    const deleteItem = async (type, id, callback) => {
        const entityName = type.charAt(0).toUpperCase() + type.slice(1);
        if (confirm(`Are you sure you want to delete this ${entityName}? This action cannot be undone.`)) {
            const result = await authorizedFetch(`/api/${type}s/${id}`, { // Pluralizes type for endpoint
                method: 'DELETE',
            });
            if (result !== null) {
                showToast(`${entityName} deleted successfully.`);
                if (callback) {
                    callback();
                }
            }
        }
    };

    // --- PAGE TEMPLATES & RENDERERS ---

    const createOptions = (items, valueField, textField, selectedValue) =>
        items.map((item) => `<option value="${item[valueField]}" ${item[valueField] == selectedValue ? "selected" : ""}>${item[textField]}</option>`).join("");

    const renderSpinner = (targetId) => {
        const target = document.getElementById(targetId);
        if (target) {
            target.innerHTML = `<div class="d-flex justify-content-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>`;
        }
    };

    const renderNoDataMessage = (targetId, message = "No data found.") => {
        const target = document.getElementById(targetId);
        if (target) {
            target.innerHTML = `<div class="text-center p-5 text-muted">${message}</div>`;
        }
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
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}${headers.length > 0 ? '<th>Actions</th>' : ''}</tr></thead>
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
    
    const renderPatientsTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { 
            tableBody.innerHTML = `<tr><td colspan="100%" class="text-center p-5 text-muted">No patients found.</td></tr>`;
            return;
        }
        tableBody.innerHTML = data.map(p => `
            <tr>
                <td>${p.patient_id}</td>
                <td>${p.name}</td>
                <td>${p.age}</td>
                <td>${p.contact_info || ""}</td>
                <td class="table-actions">
                    <button class="btn btn-sm btn-outline-primary" data-action="details" data-type="patient" data-id="${p.patient_id}" title="View Details">
                        <i class="bi bi-person-vcard"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="patient" data-id="${p.patient_id}" title="Edit">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                </td>
            </tr>`).join("");
    };

    const openPatientDetailsModal = async (patientId) => {
        detailsModalLabel.textContent = `Patient Details`;
        detailsModalBody.innerHTML = `<div class="d-flex justify-content-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>`;
        detailsModal.show();

        const data = await authorizedFetch(`/api/patients/${patientId}/details`);

        if (!data) {
            detailsModalBody.innerHTML = `<div class="text-center p-5 text-muted">Could not load patient details.</div>`;
            return;
        }

        const { profile, history } = data;
        const statusColors = { 'Paid': 'success', 'Partially Paid': 'info', 'Pending': 'warning', 'Completed': 'success', 'Scheduled': 'primary', 'Cancelled': 'danger' };
        
        detailsModalLabel.textContent = `Details for ${profile.name}`;
        detailsModalBody.innerHTML = `
            <div class="card mb-4">
                <div class="card-header"><h5 class="mb-0">Patient Profile</h5></div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-md-6"><strong>DOB:</strong> ${new Date(profile.date_of_birth).toLocaleDateString()} (${profile.age} years old)</div>
                        <div class="col-md-6"><strong>Gender:</strong> ${profile.gender}</div>
                        <div class="col-md-6"><strong>Contact:</strong> ${profile.contact_info || 'N/A'}</div>
                        <div class="col-md-6"><strong>Emergency Contact:</strong> ${profile.emergency_contact || 'N/A'}</div>
                    </div>
                     <hr>
                    <div class="row">
                        <div class="col-md-6"><strong>Insurance Provider:</strong> ${profile.insurance_provider_name || 'None'}</div>
                        <div class="col-md-6"><strong>Policy Number:</strong> ${profile.policy_number || 'N/A'}</div>
                    </div>
                </div>
            </div>

            <h5>Appointment & Billing History</h5>
            ${history.length > 0 ? history.map(appt => `
                <div class="card mb-3">
                    <div class="card-body p-3">
                        <div class="d-flex justify-content-between align-items-start">
                            <div>
                                <h6 class="mb-1">Appointment with ${appt.doctor_name}</h6>
                                <small class="text-muted">${new Date(appt.schedule_date).toLocaleString()}</small>
                            </div>
                            <span class="badge bg-${statusColors[appt.status] || 'secondary'}">${appt.status}</span>
                        </div>
                        ${appt.invoice_id ? `
                            <hr class="my-2">
                            <div class="billing-details">
                                <p class="mb-1">
                                    <strong>Invoice #${appt.invoice_id}</strong>
                                    <span class="badge bg-${statusColors[appt.invoice_status] || 'secondary'} ms-2">${appt.invoice_status}</span>
                                </p>
                                <ul class="list-unstyled small">
                                    <li>Total: $${Number(appt.total_amount).toFixed(2)}</li>
                                    <li><strong>Amount Due: $${Number(appt.due_amount).toFixed(2)}</strong></li>
                                    ${appt.payments.length > 0 ? `
                                        <li class="mt-1"><strong>Payments Recorded:</strong>
                                            <ul class="list-group list-group-flush">
                                            ${appt.payments.map(p => `
                                                <li class="list-group-item d-flex justify-content-between align-items-center p-1">
                                                    <span>- Paid $${Number(p.paid_amount).toFixed(2)} via ${p.method_of_payment}</span>
                                                    <small class="text-muted">${new Date(p.payment_date).toLocaleDateString()}</small>
                                                </li>
                                            `).join('')}
                                            </ul>
                                        </li>
                                    ` : '<li>No payments recorded for this invoice.</li>'}
                                </ul>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('') : '<div class="text-center p-4 text-muted">No appointment history found.</div>'}
        `;
    };

    const renderAppointmentsTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="100%" class="text-center p-5 text-muted">No appointments found.</td></tr>`;
            return;
        }
        
        const statusColors = { Scheduled: 'primary', Completed: 'success', Cancelled: 'danger', Rescheduled: 'warning' };

        tableBody.innerHTML = data.map(a => `
            <tr>
                <td>
                    ${a.appointment_id}
                    ${a.is_walk_in ? '<span class="badge bg-warning text-dark ms-1" title="Emergency Walk-in"><i class="bi bi-exclamation-triangle-fill"></i> Walk-in</span>' : ''}
                </td>
                <td>${new Date(a.schedule_date).toLocaleString("en-SG")}</td>
                <td>${a.patient_name}</td>
                <td>${a.doctor_name}</td>
                <td>
                    <span class="badge bg-${statusColors[a.status] || 'secondary'}">${a.status}</span>
                    ${a.status === 'Cancelled' && a.cancellation_reason ? `<br><small class="text-muted" title="Cancelled by: ${a.cancelled_by_name || 'Unknown'}">Reason: ${a.cancellation_reason.substring(0, 50)}${a.cancellation_reason.length > 50 ? '...' : ''}</small>` : ''}
                </td>
                <td class="table-actions">
                    ${a.status === 'Scheduled' || a.status === 'Rescheduled' ? `
                    <button class="btn btn-sm btn-outline-primary" data-action="reschedule" data-type="appointment" data-id="${a.appointment_id}" title="Reschedule">
                        <i class="bi bi-calendar-event-fill"></i>
                    </button>` : ''}
                    <button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="appointment" data-id="${a.appointment_id}" title="Edit">
                        <i class="bi bi-pencil-fill"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="appointment" data-id="${a.appointment_id}" title="Delete">
                        <i class="bi bi-trash-fill"></i>
                    </button>
                </td>
            </tr>`).join("");
    };

    const renderSchedulesTable = (schedulesByDoctor) => {
        const tableBody = document.getElementById('table-body');
        if (!schedulesByDoctor || schedulesByDoctor.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-5 text-muted">No doctors found or unable to load schedules.</td></tr>`;
            return;
        }

        tableBody.innerHTML = schedulesByDoctor.map(doc => `
            <tr>
                <td>${doc.name}</td>
                <td>${doc.specialty}</td>
                <td>
                    <ul class="time-slot-list">
                        ${doc.appointments.length > 0 ? doc.appointments.map(appt => `
                            <li class="booked">
                                <strong>${new Date(appt.schedule_date).toLocaleTimeString('en-SG', {hour: '2-digit', minute:'2-digit', hour12: true})}</strong><br>
                                <small>${appt.patient_name}</small>
                            </li>
                        `).join('') : '<li class="text-muted small">No bookings</li>'}
                    </ul>
                </td>
                <td>
                     <ul class="time-slot-list">
                        ${doc.availability.length > 0 ? doc.availability.map(slot => `
                            <li class="available">${slot}</li>
                        `).join('') : '<li class="text-muted small">No available slots</li>'}
                    </ul>
                </td>
            </tr>
        `).join('');
    };
    
    // --- START: NEW INVOICE RENDERER ---
    const renderInvoicesTable = (data) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="100%" class="text-center p-5 text-muted">No invoices found.</td></tr>`;
            return;
        }

        const statusColors = { 'Pending': 'warning', 'Paid': 'success', 'Partially Paid': 'info', 'Overdue': 'danger' };
        
        tableBody.innerHTML = data.map(i => `
            <tr>
                <td>${i.invoice_id}</td>
                <td>${i.patient_name}</td>
                <td>$${Number(i.total_amount).toFixed(2)}</td>
                <td>$${Number(i.due_amount).toFixed(2)}</td>
                <td><span class="badge bg-${statusColors[i.status] || 'secondary'}">${i.status}</span></td>
                <td>${new Date(i.due_date).toLocaleDateString("en-SG")}</td>
                <td class="table-actions">
                    ${i.status !== 'Paid' ? `
                    <button class="btn btn-sm btn-outline-success" 
                            data-action="pay" 
                            data-type="invoice" 
                            data-id="${i.invoice_id}" 
                            data-due="${i.due_amount}" 
                            title="Record Payment">
                        <i class="bi bi-cash-coin"></i>
                    </button>` : ''}
                    <button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="invoice" data-id="${i.invoice_id}" title="Delete">
                         <i class="bi bi-trash-fill"></i>
                    </button>
                </td>
            </tr>
        `).join("");
    };
    // --- END: NEW INVOICE RENDERER ---

    // --- FORM HANDLERS ---
    const openPatientForm = async (id = null) => {
        const isEditing = id !== null;
        const [patient, providers] = await Promise.all([isEditing ? authorizedFetch(`/api/patients/${id}`) : Promise.resolve({}), authorizedFetch("/api/list/insurance-providers")]);
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

    const updateAvailableTimes = async (doctorId, date, selectedTime = null) => {
        const timeSelect = document.getElementById("appointment-time");
        if (!doctorId || !date) {
            timeSelect.innerHTML = '<option value="">Select a doctor and date first</option>';
            timeSelect.disabled = true;
            return;
        }

        timeSelect.disabled = true;
        timeSelect.innerHTML = '<option value="">Loading slots...</option>';
        const availableSlots = await authorizedFetch(`/api/doctors/${doctorId}/availability?date=${date}`);

        if (availableSlots && availableSlots.length > 0) {
            timeSelect.innerHTML = createOptions(availableSlots.map(slot => ({ value: slot, text: slot })), 'value', 'text', selectedTime);
            timeSelect.disabled = false;
        } else {
            timeSelect.innerHTML = '<option value="">No available slots</option>';
        }
    };

    const openAppointmentForm = async (id = null) => {
        const isEditing = id !== null;
        const [patients, doctors, branches, appointment] = await Promise.all([
            authorizedFetch("/api/list/patients"),
            authorizedFetch("/api/list/doctors"),
            authorizedFetch("/api/list/branches"),
            isEditing ? authorizedFetch(`/api/appointments/${id}`) : Promise.resolve({})
        ]);

        formModalLabel.textContent = isEditing ? "Edit Appointment" : "Book Appointment";

        let scheduleDate = '';
        let scheduleTime = '';
        if (appointment.schedule_date) {
            const localDate = new Date(new Date(appointment.schedule_date).getTime() - (new Date().getTimezoneOffset() * 60000));
            scheduleDate = localDate.toISOString().split('T')[0];
            scheduleTime = localDate.toISOString().substring(11, 16);
        }

        formModalBody.innerHTML = `<form id="modal-form">
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Patient</label>
                    <select class="form-select" name="patient_id" required>${createOptions(patients,"patient_id","name",appointment.patient_id)}</select>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Doctor</label>
                    <select class="form-select" name="doctor_id" id="appointment-doctor" required>${createOptions(doctors,"doctor_id","name",appointment.doctor_id)}</select>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Branch</label>
                    <select class="form-select" name="branch_id" required>${createOptions(branches,"branch_id","name",appointment.branch_id)}</select>
                </div>
                 <div class="col-md-6 mb-3">
                    <label class="form-label">Status</label>
                    <select class="form-select" name="status" id="appointment-status">
                        <option ${appointment.status === "Scheduled" ? "selected" : ""}>Scheduled</option>
                        <option ${appointment.status === "Completed" ? "selected" : ""}>Completed</option>
                        <option ${appointment.status === "Cancelled" ? "selected" : ""}>Cancelled</option>
                    </select>
                </div>
            </div>
            <hr/>
            <div class="row">
                 <div class="col-md-6 mb-3">
                    <label class="form-label">Date</label>
                    <input type="date" class="form-control" name="schedule_date_only" id="appointment-date" value="${scheduleDate}" required>
                </div>
                <div class="col-md-6 mb-3">
                    <label class="form-label">Time</label>
                    <select class="form-select" name="schedule_time" id="appointment-time" required disabled>
                        <option value="">Select a doctor and date first</option>
                    </select>
                </div>
            </div>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" name="is_walk_in" id="is-walk-in" value="1" ${appointment.is_walk_in ? "checked" : ""}>
                        <label class="form-check-label" for="is-walk-in">
                            <strong>Emergency Walk-in</strong>
                            <small class="text-muted d-block">Check if this is an unscheduled emergency appointment</small>
                        </label>
                    </div>
                </div>
            </div>
            <div class="row" id="cancellation-reason-container" style="display: ${appointment.status === 'Cancelled' ? 'block' : 'none'};">
                <div class="col-12 mb-3">
                    <label class="form-label">Cancellation Reason</label>
                    <textarea class="form-control" name="cancellation_reason" id="cancellation-reason" rows="3" placeholder="Enter reason for cancellation...">${appointment.cancellation_reason || ''}</textarea>
                </div>
            </div>
            <div class="modal-footer mt-4">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="submit" class="btn btn-primary">${isEditing ? "Save Changes" : "Create"}</button>
            </div>
        </form>`;

        formModal.show();
        const doctorSelect = document.getElementById("appointment-doctor");
        const dateInput = document.getElementById("appointment-date");
        const statusSelect = document.getElementById("appointment-status");
        const cancellationContainer = document.getElementById("cancellation-reason-container");

        // Show/hide cancellation reason based on status
        statusSelect.addEventListener("change", () => {
            if (statusSelect.value === "Cancelled") {
                cancellationContainer.style.display = "block";
            } else {
                cancellationContainer.style.display = "none";
            }
        });

        const fetchAndRenderTimes = () => {
            const doctorId = doctorSelect.value;
            const date = dateInput.value;
            const timeToSelect = (isEditing && date === scheduleDate) ? scheduleTime : null;
            updateAvailableTimes(doctorId, date, timeToSelect);
        };

        doctorSelect.addEventListener("change", fetchAndRenderTimes);
        dateInput.addEventListener("change", fetchAndRenderTimes);

        if (isEditing && doctorSelect.value && dateInput.value) {
            fetchAndRenderTimes();
        }

        document.getElementById("modal-form").addEventListener("submit", (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            const formatForMySQL = (dateStr, timeStr) => {
                const d = new Date(`${dateStr}T${timeStr}`);
                const year = d.getFullYear();
                const month = (d.getMonth() + 1).toString().padStart(2, '0');
                const day = d.getDate().toString().padStart(2, '0');
                const hours = d.getHours().toString().padStart(2, '0');
                const minutes = d.getMinutes().toString().padStart(2, '0');
                const seconds = d.getSeconds().toString().padStart(2, '0');
                return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            };

            data.schedule_date = formatForMySQL(data.schedule_date_only, data.schedule_time);
            delete data.schedule_date_only;
            delete data.schedule_time;

            const endpoint = isEditing ? `/api/appointments/${id}` : "/api/appointments";
            submitForm(endpoint, isEditing ? "PUT" : "POST", data, loadAppointmentsPage);
        });
    };

    const openRescheduleForm = async (id) => {
        const appointment = currentViewData.find(a => a.appointment_id == id);
        if (!appointment) {
            showToast("Could not find appointment details.", "danger");
            return;
        }

        formModalLabel.textContent = "Reschedule Appointment";
        const scheduleDate = appointment.schedule_date ? new Date(new Date(appointment.schedule_date).getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : "";

        formModalBody.innerHTML = `
            <div class="alert alert-info small">
                <strong>Patient:</strong> ${appointment.patient_name}<br>
                <strong>Doctor:</strong> ${appointment.doctor_name}
            </div>
            <form id="modal-form">
                <div class="mb-3">
                    <label class="form-label">New Date & Time</label>
                    <input type="datetime-local" class="form-control" name="schedule_date" value="${scheduleDate}" required>
                </div>
                
                <div class="mb-3">
                    <label class="form-label">Reason for Rescheduling</label>
                    <textarea class="form-control" name="reschedule_reason" rows="2" placeholder="e.g., Patient request, Doctor unavailable..."></textarea>
                </div>
                <div class="modal-footer mt-4">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="submit" class="btn btn-primary">Reschedule</button>
                </div>
            </form>`;

        formModal.show();

        document.getElementById("modal-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const data = Object.fromEntries(new FormData(e.target));
            data.status = 'Rescheduled';
            const result = await submitForm(`/api/appointments/${id}`, "PUT", data);
            
            if (result !== null) {
                formModal.hide();
                showToast(`Appointment has been rescheduled successfully.`);
                loadAppointmentsPage();
            }
        });
    };
    
    // --- START: NEW INVOICE FORM ---
   const openInvoiceForm = async (id = null) => {
        const isEditing = id !== null;
        formModalLabel.textContent = isEditing ? "Edit Invoice" : "Create New Invoice";

        const [invoice, uninvoicedAppointments] = await Promise.all([
            isEditing ? authorizedFetch(`/api/invoices/${id}`) : Promise.resolve({}),
            !isEditing ? authorizedFetch('/api/appointments/uninvoiced') : Promise.resolve([])
        ]);

        const today = new Date().toISOString().split('T')[0];
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 30);
        const defaultDueDate = dueDate.toISOString().split('T')[0];
        
        const showInsuranceField = isEditing && invoice.insurance_coverage > 0;

        formModalBody.innerHTML = `<form id="modal-form">
            <div class="mb-3">
                <label class="form-label">Appointment</label>
                ${isEditing ? `<input type="text" class="form-control" value="Apt ID: ${invoice.appointment_id} - ${invoice.patient_name}" disabled>` 
                            : `<select class="form-select" name="appointment_id" id="appointment-select" required>
                                   <option value="">Select a completed appointment</option>
                                   ${uninvoicedAppointments.map(a => 
                                        `<option value="${a.appointment_id}" data-has-insurance="${!!a.insurance_provider_id}">
                                            ID ${a.appointment_id} - ${a.patient_name} on ${new Date(a.schedule_date).toLocaleDateString()}
                                        </option>`
                                    ).join('')}
                               </select>`
                }
            </div>
            <hr>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Total Amount ($)</label>
                    <input type="number" step="0.01" class="form-control" name="total_amount" id="total_amount" value="${invoice.total_amount || ''}" required>
                </div>
                <div class="col-md-6 mb-3" id="insurance-field-wrapper" style="display: ${showInsuranceField ? 'block' : 'none'};">
                    <label class="form-label">Insurance Coverage ($)</label>
                    <input type="number" step="0.01" class="form-control" name="insurance_coverage" id="insurance_coverage" value="${invoice.insurance_coverage || 0}">
                </div>
            </div>
            <div class="row align-items-end">
                <div class="col-md-6 mb-3">
                    <label class="form-label">Out-of-Pocket ($)</label>
                    <input type="text" class="form-control" id="out_of_pocket_amount" value="$${(invoice.out_of_pocket_amount || 0).toFixed(2)}" disabled>
                </div>

                ${!isEditing ? `
                <div class="col-md-6 mb-3">
                    <label class="form-label">Initial Payment ($)</label>
                    <input type="number" step="0.01" min="0" class="form-control" name="initial_payment" id="initial_payment" placeholder="Amount paid now">
                </div>` : ''}
            </div>
            <hr>
            <div class="row">
                 <div class="col-md-4 mb-3">
                    <label class="form-label">Status</label>
                     <select class="form-select" name="status" required>
                         <option value="Pending" ${invoice.status === 'Pending' ? 'selected' : ''}>Pending</option>
                         <option value="Paid" ${invoice.status === 'Paid' ? 'selected' : ''}>Paid</option>
                         <option value="Partially Paid" ${invoice.status === 'Partially Paid' ? 'selected' : ''}>Partially Paid</option>
                     </select>
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label">Issued Date</label>
                    <input type="date" class="form-control" name="issued_date" value="${invoice.issued_date ? invoice.issued_date.split('T')[0] : today}" required>
                </div>
                <div class="col-md-4 mb-3">
                    <label class="form-label">Due Date</label>
                    <input type="date" class="form-control" name="due_date" value="${invoice.due_date ? invoice.due_date.split('T')[0] : defaultDueDate}" required>
                </div>
            </div>
            <div class="modal-footer mt-4">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                <button type="submit" class="btn btn-primary">${isEditing ? "Save Changes" : "Create Invoice"}</button>
            </div>
        </form>`;
        formModal.show();
        
        // --- Logic for dynamic fields ---
        const totalInput = document.getElementById('total_amount');
        const insuranceInput = document.getElementById('insurance_coverage');
        const oopDisplay = document.getElementById('out_of_pocket_amount');
        const insuranceWrapper = document.getElementById('insurance-field-wrapper');
        const appointmentSelect = document.getElementById('appointment-select');
        const initialPaymentInput = document.getElementById('initial_payment');

        const updateOop = () => {
            const total = parseFloat(totalInput.value) || 0;
            const insurance = insuranceWrapper.style.display !== 'none' ? (parseFloat(insuranceInput.value) || 0) : 0;
            const oop = total - insurance;
            oopDisplay.value = `$${oop.toFixed(2)}`;

            // Also update the max value for the initial payment input
            if (initialPaymentInput) {
                initialPaymentInput.max = oop.toFixed(2);
            }
        };
        
        totalInput.addEventListener('input', updateOop);
        insuranceInput.addEventListener('input', updateOop);

        if (appointmentSelect) {
            appointmentSelect.addEventListener('change', (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const hasInsurance = selectedOption.dataset.hasInsurance === 'true';

                insuranceWrapper.style.display = hasInsurance ? 'block' : 'none';
                if (!hasInsurance) {
                    insuranceInput.value = 0;
                }
                updateOop();
            });
        }
        
        document.getElementById("modal-form").addEventListener("submit", (e) => {
            e.preventDefault();
            const endpoint = isEditing ? `/api/invoices/${id}` : "/api/invoices";
            submitForm(endpoint, isEditing ? "PUT" : "POST", Object.fromEntries(new FormData(e.target)), loadInvoicesPage);
        });
    };
     const openPaymentForm = (id, dueAmount) => {
        formModalLabel.textContent = `Record Payment for Invoice #${id}`;
        const today = new Date().toISOString().split('T')[0];
        const due = Number(dueAmount).toFixed(2);

        formModalBody.innerHTML = `
            <div class="alert alert-info">
                Amount Due: <strong>$${due}</strong>
            </div>
            <form id="modal-form">
                <input type="hidden" name="invoice_id" value="${id}">
                <div class="row">
                    <div class="col-md-6 mb-3">
                        <label class="form-label">Payment Amount ($)</label>
                        <input type="number" step="0.01" min="0.01" max="${due}" class="form-control" name="paid_amount" required>
                    </div>
                     <div class="col-md-6 mb-3">
                        <label class="form-label">Payment Date</label>
                        <input type="date" class="form-control" name="payment_date" value="${today}" required>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label">Method of Payment</label>
                    <select class="form-select" name="method_of_payment" required>
                        <option value="Cash">Cash</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Other">Other</option>
                    </select>
                </div>
                <div class="modal-footer mt-4">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    <button type="submit" class="btn btn-primary">Submit Payment</button>
                </div>
            </form>
        `;
        formModal.show();

        document.getElementById("modal-form").addEventListener("submit", (e) => {
            e.preventDefault();
            // We use a custom endpoint for payments
            submitForm("/api/payments", "POST", Object.fromEntries(new FormData(e.target)), loadInvoicesPage);
        });
    };
    // --- END: NEW INVOICE FORM ---


    // --- PAGE LOADERS (Receptionist Version) ---
    const loadPatientsPage = async () => {
        createPageTemplate({ title: "Patients", type: "patient", headers: ["ID", "Name", "Age", "Contact"] });
        renderSpinner("table-body");
        currentViewData = await authorizedFetch("/api/patients");
        renderPatientsTable(currentViewData);
        setupSearch(renderPatientsTable, ['patient_id', 'name', 'contact_info']);
    };

    const loadAppointmentsPage = async () => {
        createPageTemplate({ title: "Appointments", type: "appointment", headers: ["ID", "Date", "Patient", "Doctor", "Status"] });
        renderSpinner("table-body");
        currentViewData = await authorizedFetch("/api/appointments");
        renderAppointmentsTable(currentViewData);
        setupSearch(renderAppointmentsTable, ['appointment_id', 'patient_name', 'doctor_name', 'status']);
    };

    const loadSchedulesPage = async () => {
        createPageTemplate({
            title: "Doctor Schedules",
            type: "schedule",
            headers: ["Doctor", "Specialty", "Booked Slots", "Available Slots"],
            showAddBtn: false,
            showSearch: false,
        });

        const pageHeader = mainContent.querySelector('.page-header .d-flex');
        const datePickerHtml = `
            <div class="d-flex align-items-center gap-2 ms-auto">
                 <label for="schedule-date-picker" class="col-form-label">Date:</label>
                 <input type="date" id="schedule-date-picker" class="form-control" style="width: auto;">
            </div>
        `;
        pageHeader.insertAdjacentHTML('beforeend', datePickerHtml);
        
        const datePicker = document.getElementById('schedule-date-picker');
        const today = new Date().toISOString().split('T')[0];
        datePicker.value = today;

        const fetchAndRenderSchedules = async () => {
            const selectedDate = datePicker.value;
            renderSpinner('table-body');

            const doctors = await authorizedFetch('/api/list/doctors');
            if (!doctors) {
                renderNoDataMessage('table-body', 'Could not load doctors.');
                return;
            }
            
            const schedulePromises = doctors.map(async (doctor) => {
                const [availability, appointments] = await Promise.all([
                    authorizedFetch(`/api/doctors/${doctor.doctor_id}/availability?date=${selectedDate}`),
                    authorizedFetch(`/api/appointments/doctor/${doctor.doctor_id}?date=${selectedDate}`)
                ]);
                return {
                    ...doctor,
                    availability: availability || [],
                    appointments: appointments || []
                };
            });

            const schedulesByDoctor = await Promise.all(schedulePromises);
            renderSchedulesTable(schedulesByDoctor);
        };

        datePicker.addEventListener('change', fetchAndRenderSchedules);
        fetchAndRenderSchedules(); // Initial load
    };

    // --- START: NEW INVOICE PAGE LOADER ---
    const loadInvoicesPage = async () => {
        createPageTemplate({
            title: "Invoicing",
            type: "invoice",
            headers: ["Invoice ID", "Patient", "Total", "Due", "Status", "Due Date"]
        });

        // 1. Add the filter buttons to the page header
        const pageHeader = mainContent.querySelector('.page-header .d-flex');
        const filterHtml = `
            <div class="btn-group" role="group" id="invoice-filter-group">
                <button type="button" class="btn btn-outline-secondary active" data-status="All">All</button>
                <button type="button" class="btn btn-outline-secondary" data-status="Pending">Pending</button>
                <button type="button" class="btn btn-outline-secondary" data-status="Partially Paid">Partially Paid</button>
                <button type="button" class="btn btn-outline-secondary" data-status="Paid">Paid</button>
            </div>
        `;
        // Insert filters before the search bar
        pageHeader.insertAdjacentHTML('afterbegin', filterHtml);

        renderSpinner("table-body");
        currentViewData = await authorizedFetch("/api/invoices");
        renderInvoicesTable(currentViewData);
        
        // 2. Set up combined filtering and searching
        setupCombinedFilters();
    };
    // --- END: NEW INVOICE PAGE LOADER ---
    const setupCombinedFilters = () => {
        const searchInput = document.getElementById('search-input');
        const filterGroup = document.getElementById('invoice-filter-group');
        
        let activeStatus = 'All';
        let searchTerm = '';

        const applyFilters = () => {
            // Start with the full dataset
            let filteredData = [...currentViewData];

            // 1. Apply status filter
            if (activeStatus !== 'All') {
                filteredData = filteredData.filter(item => item.status === activeStatus);
            }

            // 2. Apply search filter to the already status-filtered data
            if (searchTerm) {
                const lowerCaseSearchTerm = searchTerm.toLowerCase();
                const searchableKeys = ['invoice_id', 'patient_name', 'status'];
                filteredData = filteredData.filter(item =>
                    searchableKeys.some(key =>
                        item[key] && item[key].toString().toLowerCase().includes(lowerCaseSearchTerm)
                    )
                );
            }
            
            renderInvoicesTable(filteredData);
        };

        // Listener for filter buttons
        filterGroup.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                // Update active button style
                filterGroup.querySelector('.active').classList.remove('active');
                e.target.classList.add('active');
                
                // Update active status and apply filters
                activeStatus = e.target.dataset.status;
                applyFilters();
            }
        });

        // Listener for search input
        searchInput.addEventListener('input', (e) => {
            searchTerm = e.target.value;
            applyFilters();
        });
    };

    // --- ROUTING LOGIC & EVENT LISTENERS ---
    const pageLoaders = {
        patients: loadPatientsPage,
        appointments: loadAppointmentsPage,
        schedules: loadSchedulesPage,
        invoices: loadInvoicesPage, // Add new page loader
    };

    const navigateTo = (page) => {
        navLinks.forEach((link) => link.classList.toggle("active", link.dataset.page === page));
        (pageLoaders[page] || pageLoaders.appointments)();
    };

    document.querySelector(".sidebar").addEventListener("click", (e) => {
        const navLink = e.target.closest(".nav-link");
        if (navLink) {
            e.preventDefault();
            navigateTo(navLink.dataset.page);
        }
    });

    document.getElementById('logout-button').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('clinicProToken');
        window.location.href = 'login.html';
    });
    
    mainContent.addEventListener("click", (e) => {
        const target = e.target.closest("button[data-action]");
        if (!target) return;
        
        const { action, type, id } = target.dataset;

        // MODIFIED: Added a handler for the 'details' action
        const entityActionMap = {
            patient: {
                add: openPatientForm,
                edit: openPatientForm,
                details: openPatientDetailsModal, // New handler
            },
            appointment: {
                add: openAppointmentForm,
                edit: openAppointmentForm,
                reschedule: openRescheduleForm,
                delete: (id) => deleteItem('appointment', id, loadAppointmentsPage)
            },
            invoice: {
                add: openInvoiceForm,
                pay: (id) => {
                    const dueAmount = target.dataset.due;
                    openPaymentForm(id, dueAmount);
                },
                delete: (id) => deleteItem('invoice', id, loadInvoicesPage)
            }
        };
        
        const handler = entityActionMap[type]?.[action];
        if (handler) {
            handler(id); 
        }
    });

    // --- INITIAL PAGE LOAD ---
    navigateTo("patients"); // Default to appointments page
});

