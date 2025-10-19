// doctor-appointments.js
const API_BASE_URL = "http://localhost:3000";
const authToken = localStorage.getItem('clinicProToken');
if (!authToken) window.location.href = '/login.html';

document.addEventListener("DOMContentLoaded", () => {
    // Element & Modal Selection
    const appointmentListContainer = document.getElementById("appointment-list-container");
    const patientInfoContainer = document.getElementById("patient-info-container");
    const toastContainer = document.querySelector(".toast-container");
    const historyModal = new bootstrap.Modal(document.getElementById("historyModal"));
    const historyModalBody = document.getElementById("historyModalBody");
    const completionModal = new bootstrap.Modal(document.getElementById("completionModal"));
    const completionForm = document.getElementById("completion-form");

    // State
    let currentAppointments = [], treatmentCatalogue = [], prescribedTreatments = [], selectedAppointment = null;

    // --- HELPER FUNCTIONS ---
    const showToast = (message, type = 'success') => {
        const toastId = `toast-${Date.now()}`;
        const icon = type === 'success' ? 'check-circle-fill' : 'exclamation-triangle-fill';
        toastContainer.insertAdjacentHTML('beforeend', `<div id="${toastId}" class="toast align-items-center text-bg-${type} border-0" role="alert"><div class="d-flex"><div class="toast-body"><i class="bi bi-${icon} me-2"></i>${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div></div>`);
        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(document.getElementById(toastId), { delay: 4000 });
        toast.show();
        document.getElementById(toastId).addEventListener('hidden.bs.toast', e => e.target.remove());
    };

    const authorizedFetch = async (endpoint, options = {}) => {
        const defaultOptions = { headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` } };
        const mergedOptions = { ...defaultOptions, ...options, headers: { ...defaultOptions.headers, ...options.headers } };
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, mergedOptions);
            if ([401, 403].includes(response.status)) { localStorage.removeItem('clinicProToken'); window.location.href = '/login.html'; return null; }
            if (!response.ok) { const err = await response.json(); throw new Error(err.message || `HTTP error! status: ${response.status}`); }
            return response.status === 204 ? null : response.json();
        } catch (error) { showToast(error.message, 'danger'); return null; }
    };

    // --- RENDER FUNCTIONS ---
    const renderSpinner = container => container.innerHTML = `<div class="d-flex justify-content-center p-5"><div class="spinner-border text-primary"></div></div>`;
    const renderInitialPatientView = () => patientInfoContainer.innerHTML = `<div class="card patient-info-widget"><div class="card-body text-center p-5"><i class="bi bi-person-circle fs-1 text-muted"></i><p class="mt-3 text-muted">Select an appointment to view patient details.</p></div></div>`;

    const renderAppointments = (appointments) => {
        if (!appointments || appointments.length === 0) {
            appointmentListContainer.innerHTML = `<div class="text-center p-5 text-muted">No appointments found.</div>`;
            renderInitialPatientView(); return;
        }
        appointmentListContainer.innerHTML = appointments.map(appt => {
            const time = new Date(appt.schedule_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `<div class="appointment-item status-${(appt.status || 'scheduled').toLowerCase()}" data-appointment-id="${appt.appointment_id}">
                <div class="time-slot"><div class="time">${time}</div><div class="duration">30 min</div></div>
                <div class="patient-details"><div class="fw-bold">${appt.patient_name}</div><div class="small text-muted">Age: ${appt.patient_age} | ${appt.insurance_provider || 'No Insurance'}</div></div>
                <i class="bi bi-chevron-right text-muted ms-auto"></i>
            </div>`;
        }).join('');

        const firstApptId = appointments[0].appointment_id;
        document.querySelector(`.appointment-item[data-appointment-id="${firstApptId}"]`).classList.add('active');
        selectedAppointment = appointments.find(a => a.appointment_id == firstApptId);
        renderPatientDetails(selectedAppointment);
    };

    const renderPatientDetails = (appt) => {
        if (!appt) { renderInitialPatientView(); return; }
        const apptDate = new Date(appt.schedule_date);
        patientInfoContainer.innerHTML = `
            <div class="card patient-info-widget">
                <div class="card-body">
                    <div class="text-center pb-4 mb-4 border-bottom">
                        <div class="patient-avatar">${appt.patient_name.match(/\b(\w)/g).join('').substring(0, 2)}</div>
                        <h5 class="mt-3">${appt.patient_name}</h5>
                        <p class="text-muted mb-0">Apt ID: #${appt.appointment_id}</p>
                    </div>
                    <ul class="patient-info-list">
                        <li><i class="bi bi-person"></i> <div><strong>Gender:</strong> ${appt.patient_gender || 'N/A'}</div></li>
                        <li><i class="bi bi-cake2"></i> <div><strong>Age:</strong> ${appt.patient_age} years</div></li>
                        <li><i class="bi bi-telephone"></i> <div><strong>Contact:</strong> ${appt.patient_contact || 'N/A'}</div></li>
                        <li><i class="bi bi-shield-check"></i> <div><strong>Insurance:</strong> ${appt.insurance_provider || 'No Insurance'}</div></li>
                        <li><i class="bi bi-calendar-event"></i> <div><strong>Appointment:</strong> ${apptDate.toLocaleString()}</div></li>
                    </ul>
                    <div class="d-grid gap-2 mt-4">
                        ${['Scheduled', 'Rescheduled'].includes(appt.status) ? `<button class="btn btn-success" data-action="complete"><i class="bi bi-check-circle me-2"></i>Complete Appointment</button>` : `<div class="alert alert-success text-center">Appointment Completed</div>`}
                        <button class="btn btn-outline-secondary" data-action="view-history"><i class="bi bi-clock-history me-2"></i>View Patient History</button>
                    </div>
                </div>
            </div>`;
    };

    const renderHistoryModal = (history, patientName) => {
        document.getElementById("historyModalLabel").innerHTML = `<i class="bi bi-clock-history me-2"></i>History for ${patientName}`;
        if (!history || history.length === 0) { historyModalBody.innerHTML = `<div class="text-center p-5 text-muted">No appointment history found with this doctor.</div>`; return; }
        historyModalBody.innerHTML = `<div class="list-group list-group-flush">${history.map(a => `
            <div class="list-group-item"><div class="d-flex w-100 justify-content-between"><h6 class="mb-1">${new Date(a.schedule_date).toLocaleDateString()}</h6><span class="badge bg-${a.status === 'Completed' ? 'success' : 'danger'}">${a.status}</span></div>
            <p class="mb-1"><strong>Treatments:</strong> ${a.treatments || 'Consultation only'}</p>
            <small class="text-success"><strong>Total Cost: $${parseFloat(a.total_cost || 0).toFixed(2)}</strong></small></div>`).join('')}</div>`;
    };

    const renderAddedTreatments = () => {
        const list = document.getElementById("added-treatments-list");
        const msg = document.getElementById("no-treatments-msg");
        if (prescribedTreatments.length === 0) { msg.style.display = 'block'; list.innerHTML = ''; }
        else {
            msg.style.display = 'none';
            list.innerHTML = prescribedTreatments.map((t, i) => `<li class="list-group-item d-flex justify-content-between align-items-center"><div><strong>${t.name}</strong></div><div><span class="badge bg-primary me-2">$${parseFloat(t.actual_price).toFixed(2)}</span><button type="button" class="btn btn-sm btn-outline-danger" data-index="${i}"><i class="bi bi-trash"></i></button></div></li>`).join('');
        }
    };

    // --- DATA LOADERS & LOGIC ---
    const loadAppointments = async (filter) => {
        renderSpinner(appointmentListContainer); renderInitialPatientView(); selectedAppointment = null;
        const appointments = await authorizedFetch(`/api/doctor/appointments/${filter}`);
        currentAppointments = appointments; renderAppointments(currentAppointments);
    };

    const searchAppointments = async (query, startDate, endDate) => {
        renderSpinner(appointmentListContainer); renderInitialPatientView();
        const params = new URLSearchParams({ query, startDate, endDate });
        const appointments = await authorizedFetch(`/api/doctor/appointments/search?${params.toString()}`);
        currentAppointments = appointments; renderAppointments(currentAppointments);
    };

    const loadInitialData = async () => {
        const [profile, stats, treatments] = await Promise.all([
            authorizedFetch('/api/doctor/profile'),
            authorizedFetch('/api/doctor/stats'),
            authorizedFetch('/api/list/treatments')
        ]);
        if (profile) document.getElementById('doctor-name').textContent = profile.name;
        if (stats) {
            document.getElementById("today-total").textContent = stats.today.total_appointments || 0;
            document.getElementById("today-completed").textContent = stats.today.completed || 0;
            document.getElementById("today-scheduled").textContent = stats.today.scheduled || 0;
            document.getElementById("upcoming-week").textContent = stats.upcoming_week || 0;
        }
        if (treatments) {
            treatmentCatalogue = treatments;
            document.getElementById("treatment-select").innerHTML = `<option value="">Select treatment...</option>` + treatments.map(t => `<option value="${t.service_code}" data-price="${t.price}">${t.name} ($${t.price})</option>`).join('');
        }
        loadAppointments('today');
    };

    // --- EVENT LISTENERS ---
    document.querySelector('.btn-group').addEventListener('change', e => {
        const container = document.getElementById('date-range-container');
        if (e.target.id === 'btn-today') { container.style.display = "none"; loadAppointments("today"); }
        if (e.target.id === 'btn-upcoming') { container.style.display = "none"; loadAppointments("upcoming"); }
        if (e.target.id === 'btn-custom') { container.style.display = "block"; }
    });

    document.getElementById('apply-date-range').onclick = () => {
        const start = document.getElementById('start-date').value;
        const end = document.getElementById('end-date').value;
        if (start && end) searchAppointments("", start, end); else showToast("Please select both dates", "danger");
    };

    const performSearch = () => searchAppointments(document.getElementById('search-input').value, "", "");
    document.getElementById('search-btn').onclick = performSearch;
    document.getElementById('search-input').onkeypress = e => { if (e.key === "Enter") performSearch(); };

    appointmentListContainer.onclick = e => {
        const item = e.target.closest(".appointment-item");
        if (!item) return;
        document.querySelector(".appointment-item.active")?.classList.remove("active");
        item.classList.add("active");
        selectedAppointment = currentAppointments.find(a => a.appointment_id == item.dataset.appointmentId);
        if (selectedAppointment) renderPatientDetails(selectedAppointment);
    };

    patientInfoContainer.onclick = async e => {
        const action = e.target.closest('button')?.dataset.action;
        if (!action || !selectedAppointment) return;
        if (action === 'complete') {
            prescribedTreatments = [];
            completionForm.reset();
            renderAddedTreatments();
            document.getElementById("completion-patient-info").innerHTML = `Completing appointment for <strong>${selectedAppointment.patient_name}</strong>.`;
            completionModal.show();
        }
        if (action === 'view-history') {
            renderSpinner(historyModalBody); historyModal.show();
            const history = await authorizedFetch(`/api/doctor/patients/${selectedAppointment.patient_id}/history`);
            renderHistoryModal(history, selectedAppointment.patient_name);
        }
    };

    document.getElementById('add-treatment-btn').onclick = () => {
        const select = document.getElementById("treatment-select");
        const priceInput = document.getElementById("treatment-price");
        if (!select.value) { showToast("Please select a treatment.", 'danger'); return; }
        const option = select.options[select.selectedIndex];
        prescribedTreatments.push({ service_code: select.value, name: option.text.split(' ($')[0], actual_price: parseFloat(priceInput.value || option.dataset.price) });
        renderAddedTreatments();
        select.value = ''; priceInput.value = '';
    };

    document.getElementById("treatment-select").onchange = e => {
        const price = e.target.options[e.target.selectedIndex].dataset.price;
        document.getElementById("treatment-price").value = price || '';
    };

    document.getElementById("added-treatments-list").onclick = e => {
        const btn = e.target.closest('button[data-index]');
        if (btn) { prescribedTreatments.splice(parseInt(btn.dataset.index, 10), 1); renderAddedTreatments(); }
    };

    completionForm.onsubmit = async e => {
        e.preventDefault();
        const data = { consultation_notes: document.getElementById("consultation_notes").value, treatments: prescribedTreatments };
        if (!data.consultation_notes) { showToast("Consultation notes are required.", 'danger'); return; }

        const result = await authorizedFetch(`/api/doctor/appointments/${selectedAppointment.appointment_id}/complete`, { method: 'POST', body: JSON.stringify(data) });
        if (result !== null) {
            completionModal.hide(); showToast("Appointment completed successfully.");
            loadAppointments(document.getElementById('btn-today').checked ? 'today' : 'upcoming'); // Refresh current view
        }
    };

    document.getElementById('logout-button').onclick = () => { localStorage.removeItem('clinicProToken'); window.location.href = 'login.html'; };

    loadInitialData();
});
