// doctor-portal-combined.js

// --- CONFIGURATION & GLOBAL SETUP (Centralized and Defined Once) ---
const API_BASE_URL = "https://hms-production-a5ad.up.railway.app";
const authToken = localStorage.getItem('clinicProToken');

// Global authentication check
if (!authToken) {
    window.location.href = '/login.html';
}

// --- GLOBAL STATE ---
let currentAppointments = [];
let treatmentCatalogue = [];
let prescribedTreatments = [];
let selectedAppointment = null;
let currentAvailability = {}; // For availability tab

// --- AVAILABILITY CONFIGURATION ---
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const defaultStartTime = '09:00';
const defaultEndTime = '17:00';

// --- HELPER FUNCTIONS (Based on doctor-appointments.js implementation) ---

// NOTE: This showToast uses the toastContainer defined inside DOMContentLoaded, 
// so it must be placed inside the main block or the variable must be globally scoped.
// To keep it clean, we'll redefine it inside the DOMContentLoaded block where it has access to elements.

const authorizedFetch = async (endpoint, options = {}) => {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        }
    };
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: { ...defaultOptions.headers, ...options.headers }
    };

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, mergedOptions);

        if ([401, 403].includes(response.status)) {
            localStorage.removeItem('clinicProToken');
            window.location.href = '/login.html';
            return null;
        }

        if (!response.ok) {
            // Error handling from appointments script (more detailed)
            const err = await response.json();
            throw new Error(err.message || `HTTP error! status: ${response.status}`);
        }

        return response.status === 204 ? null : response.json();
    } catch (error) {
        console.error("Fetch error:", error);
        // showToast is defined inside DOMContentLoaded, so error logging here is sufficient.
        return null;
    }
};

// --- MAIN DOCUMENT READY BLOCK ---

document.addEventListener("DOMContentLoaded", () => {
    console.log('[PORTAL] Combined Script initialized');

    // --- ELEMENT SELECTION (Combined from both files) ---
    const appointmentListContainer = document.getElementById("appointment-list-container");
    const patientInfoContainer = document.getElementById("patient-info-container");
    const toastContainer = document.querySelector(".toast-container");
    const historyModal = new bootstrap.Modal(document.getElementById("historyModal"));
    const historyModalBody = document.getElementById("historyModalBody");
    const completionModal = new bootstrap.Modal(document.getElementById("completionModal"));
    const completionForm = document.getElementById("completion-form");

    // Elements for Tab Switching & Availability
    const appointmentsTab = document.getElementById('appointments-tab');
    const availabilityTab = document.getElementById('availability-tab');
    const tabLinks = document.querySelectorAll('.nav-tab-link');
    const availabilityGrid = document.getElementById('availability-grid');
    const saveBtn = document.getElementById('save-availability-btn');
    const resetBtn = document.getElementById('reset-availability-btn');

    // --- HELPER FUNCTION (Redefined inside scope to access toastContainer) ---
    const showToast = (message, type = 'success') => {
        if (!toastContainer) return;

        const toastId = `toast-${Date.now()}`;
        const icon = type === 'success' ? 'check-circle-fill' : 'exclamation-triangle-fill';
        toastContainer.insertAdjacentHTML('beforeend', `
            <div id="${toastId}" class="toast align-items-center text-bg-${type} border-0" role="alert">
                <div class="d-flex">
                    <div class="toast-body">
                        <i class="bi bi-${icon} me-2"></i>${message}
                    </div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            </div>
        `);
        const toastEl = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    };

    // Re-writing a simpler authorizedFetch for the local scope:
    const localShowToast = showToast;
    const localAuthorizedFetch = async (endpoint, options = {}) => {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            }
        };
        const mergedOptions = {
            ...defaultOptions,
            ...options,
            headers: { ...defaultOptions.headers, ...options.headers }
        };

        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, mergedOptions);

            if ([401, 403].includes(response.status)) {
                localStorage.removeItem('clinicProToken');
                window.location.href = '/login.html';
                return null;
            }

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || `HTTP error! status: ${response.status}`);
            }

            return response.status === 204 ? null : response.json();
        } catch (error) {
            console.error("Fetch error:", error);
            localShowToast(error.message, 'danger'); // Now uses local showToast
            return null;
        }
    };


    // --- APPOINTMENTS LOGIC (Functions from doctor-appointments.js) ---

    const renderSpinner = container => {
        if (container) {
            container.innerHTML = `
                <div class="d-flex justify-content-center p-5">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                </div>
            `;
        }
    };

    const renderInitialPatientView = () => {
        patientInfoContainer.innerHTML = `
            <div class="card patient-info-widget">
                <div class="card-body text-center p-5">
                    <i class="bi bi-person-circle fs-1 text-muted"></i>
                    <p class="mt-3 text-muted">Select an appointment to view patient details.</p>
                </div>
            </div>
        `;
    };

    const renderAppointments = (appointments) => {
        if (!appointments || appointments.length === 0) {
            appointmentListContainer.innerHTML = `
                <div class="text-center p-5 text-muted">
                    <i class="bi bi-calendar-x fs-1 d-block mb-3"></i>
                    No appointments found.
                </div>
            `;
            renderInitialPatientView();
            return;
        }

        appointmentListContainer.innerHTML = appointments.map(appt => {
            const time = new Date(appt.schedule_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const statusClass = (appt.status || 'scheduled').toLowerCase();

            return `
                <div class="appointment-item status-${statusClass}" data-appointment-id="${appt.appointment_id}">
                    <div class="time-slot">
                        <div class="time">${time}</div>
                        <div class="duration">30 min</div>
                    </div>
                    <div class="patient-details">
                        <div class="fw-bold">${appt.patient_name}</div>
                        <div class="small text-muted">
                            Age: ${appt.patient_age} | ${appt.insurance_provider || 'No Insurance'}
                        </div>
                    </div>
                    <i class="bi bi-chevron-right text-muted ms-auto"></i>
                </div>
            `;
        }).join('');

        // Auto-select first appointment
        const firstApptId = appointments[0].appointment_id;
        const firstApptElement = document.querySelector(`.appointment-item[data-appointment-id="${firstApptId}"]`);
        if (firstApptElement) {
            firstApptElement.classList.add('active');
        }
        selectedAppointment = appointments[0];
        renderPatientDetails(selectedAppointment);
    };

    const renderPatientDetails = (appt) => {
        if (!appt) {
            renderInitialPatientView();
            return;
        }

        const apptDate = new Date(appt.schedule_date);
        const today = new Date();

        // Check if appointment is today and in a completable status
        const isToday = apptDate.toDateString() === today.toDateString();
        const canComplete = isToday && ['Scheduled', 'Rescheduled'].includes(appt.status);

        patientInfoContainer.innerHTML = `
        <div class="card patient-info-widget">
            <div class="card-body">
                <div class="text-center pb-4 mb-4 border-bottom">
                    <div class="patient-avatar">
                        ${appt.patient_name.match(/\b(\w)/g).join('').substring(0, 2).toUpperCase()}
                    </div>
                    <h5 class="mt-3 mb-1">${appt.patient_name}</h5>
                    <p class="text-muted mb-0">Appointment ID: #${appt.appointment_id}</p>
                    <span class="badge bg-${appt.status === 'Completed' ? 'success' : 'primary'} mt-2">
                        ${appt.status}
                    </span>
                    ${!isToday && ['Scheduled', 'Rescheduled'].includes(appt.status) ? `
                        <div class="alert alert-warning mt-2 small p-2">
                            <i class="bi bi-info-circle me-1"></i>Can only complete today's appointments
                        </div>
                    ` : ''}
                </div>
                
                <ul class="patient-info-list">
                    <li>
                        <i class="bi bi-person"></i>
                        <div>
                            <strong>Gender:</strong> ${appt.patient_gender || 'N/A'}
                        </div>
                    </li>
                    <li>
                        <i class="bi bi-cake2"></i>
                        <div>
                            <strong>Age:</strong> ${appt.patient_age} years
                        </div>
                    </li>
                    <li>
                        <i class="bi bi-telephone"></i>
                        <div>
                            <strong>Contact:</strong> ${appt.patient_contact || 'N/A'}
                        </div>
                    </li>
                    <li>
                        <i class="bi bi-shield-check"></i>
                        <div>
                            <strong>Insurance:</strong> ${appt.insurance_provider || 'No Insurance'}
                        </div>
                    </li>
                    <li>
                        <i class="bi bi-calendar-event"></i>
                        <div>
                            <strong>Appointment:</strong> ${apptDate.toLocaleString()}
                        </div>
                    </li>
                </ul>
                
                <div class="d-grid gap-2 mt-4">
                    ${canComplete ? `
                        <button class="btn btn-success" data-action="complete">
                            <i class="bi bi-check-circle me-2"></i>Complete Appointment
                        </button>
                    ` : appt.status === 'Completed' ? `
                        <div class="alert alert-success text-center mb-0">
                            <i class="bi bi-check-circle-fill me-2"></i>Appointment Completed
                        </div>
                    ` : `
                        <button class="btn btn-secondary" disabled>
                            <i class="bi bi-clock me-2"></i>Complete (Available on Appointment Day)
                        </button>
                    `}
                    <button class="btn btn-outline-secondary" data-action="view-history">
                        <i class="bi bi-clock-history me-2"></i>View Patient History
                    </button>
                </div>
            </div>
        </div>
    `;
    };

    const renderHistoryModal = (history, patientName) => {
        document.getElementById("historyModalLabel").innerHTML = `
            <i class="bi bi-clock-history me-2"></i>History for ${patientName}
        `;

        if (!history || history.length === 0) {
            historyModalBody.innerHTML = `
                <div class="text-center p-5 text-muted">
                    <i class="bi bi-inbox fs-1 d-block mb-3"></i>
                    No appointment history found with this doctor.
                </div>
            `;
            return;
        }

        historyModalBody.innerHTML = `
            <div class="list-group list-group-flush">
                ${history.map(a => `
                    <div class="list-group-item">
                        <div class="d-flex w-100 justify-content-between align-items-start mb-2">
                            <h6 class="mb-1">
                                <i class="bi bi-calendar-event me-2"></i>
                                ${new Date(a.schedule_date).toLocaleDateString()}
                            </h6>
                            <span class="badge bg-${a.status === 'Completed' ? 'success' : 'danger'}">
                                ${a.status}
                            </span>
                        </div>
                        <p class="mb-2">
                            <strong>Treatments:</strong> ${a.treatments || 'Consultation only'}
                        </p>
                        ${a.total_cost ? `
                            <small class="text-success">
                                <i class="bi bi-currency-dollar me-1"></i>
                                <strong>Total Cost: Rs.${parseFloat(a.total_cost).toFixed(2)}</strong>
                            </small>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    };

    const renderAddedTreatments = () => {
        const list = document.getElementById("added-treatments-list");
        const msg = document.getElementById("no-treatments-msg");
        const countBadge = document.getElementById("treatment-count");
        const totalSection = document.getElementById("treatments-total-section");
        const totalElement = document.getElementById("treatments-total");

        if (!list) return;

        if (prescribedTreatments.length === 0) {
            if (msg) msg.style.display = 'block';
            list.innerHTML = `
                <li class="list-group-item text-center text-muted py-4" id="no-treatments-msg">
                    <i class="bi bi-inbox fs-4 d-block mb-2"></i>
                    No treatments added yet
                </li>
            `;
            if (countBadge) countBadge.textContent = '0';
            if (totalSection) totalSection.style.display = 'none';
        } else {
            if (msg) msg.style.display = 'none';

            // Calculate total
            const total = prescribedTreatments.reduce((sum, t) => sum + parseFloat(t.actual_price), 0);

            list.innerHTML = prescribedTreatments.map((t, i) => `
                <li class="list-group-item">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="flex-grow-1">
                            <div class="fw-bold">${t.name}</div>
                            <small class="text-muted">Code: ${t.service_code}</small>
                            ${t.notes ? `<div class="small text-muted mt-1">
                                <i class="bi bi-chat-left-text"></i> ${t.notes}
                            </div>` : ''}
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            <span class="badge bg-success fs-6">
                                Rs.${parseFloat(t.actual_price).toFixed(2)}
                            </span>
                            <button type="button" 
                                    class="btn btn-sm btn-outline-danger" 
                                    data-index="${i}"
                                    title="Remove treatment">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </li>
            `).join('');

            if (countBadge) countBadge.textContent = prescribedTreatments.length;
            if (totalSection) {
                totalSection.style.display = 'block';
                if (totalElement) totalElement.textContent = `Rs.${total.toFixed(2)}`;
            }
        }
    };

    // DATA LOADERS & LOGIC
    const loadAppointments = async (filter) => {
        renderSpinner(appointmentListContainer);
        renderInitialPatientView();
        selectedAppointment = null;

        const appointments = await localAuthorizedFetch(`/api/doctor/appointments/${filter}`);
        currentAppointments = appointments || [];
        renderAppointments(currentAppointments);
    };

    const searchAppointments = async (query, startDate, endDate) => {
        renderSpinner(appointmentListContainer);
        renderInitialPatientView();

        const params = new URLSearchParams();
        if (query) params.append('query', query);
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);

        const appointments = await localAuthorizedFetch(`/api/doctor/appointments/search?${params.toString()}`);
        currentAppointments = appointments || [];
        renderAppointments(currentAppointments);
    };

    const loadInitialData = async () => {
        const [profile, stats, treatments] = await Promise.all([
            localAuthorizedFetch('/api/doctor/profile'),
            localAuthorizedFetch('/api/doctor/stats'),
            localAuthorizedFetch('/api/list/treatments')
        ]);

        if (profile) {
            document.getElementById('doctor-name').textContent = profile.name;
        }

        if (stats) {
            document.getElementById("today-total").textContent = stats.today.total_appointments || 0;
            document.getElementById("today-completed").textContent = stats.today.completed || 0;
            document.getElementById("today-scheduled").textContent = stats.today.scheduled || 0;
            document.getElementById("upcoming-week").textContent = stats.upcoming_week || 0;
        }

        if (treatments) {
            treatmentCatalogue = treatments;
            const treatmentSelect = document.getElementById("treatment-select");
            if (treatmentSelect) {
                treatmentSelect.innerHTML = `<option value="">Choose a treatment...</option>` +
                    treatments.map(t => `
                        <option value="${t.service_code}" data-price="${t.price}">
                            ${t.name} (Rs.${parseFloat(t.price).toFixed(2)})
                        </option>
                    `).join('');
            }
        }

        loadAppointments('today');
    };

    // --- AVAILABILITY LOGIC (Functions from doctor-availability.js) ---

    // RENDER FUNCTIONS
    const renderAvailabilityGrid = () => {
        let html = '';

        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            const dayName = days[dayOfWeek];
            const availability = currentAvailability[dayOfWeek] || {
                dayOfWeek,
                startTime: defaultStartTime,
                endTime: defaultEndTime,
                isAvailable: true
            };

            html += `
                <div class="day-availability">
                    <h6>
                        <input type="checkbox" 
                               class="day-checkbox" 
                               data-day="${dayOfWeek}" 
                               ${availability.isAvailable ? 'checked' : ''}>
                        <label class="mb-0">${dayName}</label>
                    </h6>
                    <div class="time-inputs">
                        <input type="time" 
                               class="start-time" 
                               data-day="${dayOfWeek}" 
                               value="${availability.startTime}"
                               ${!availability.isAvailable ? 'disabled' : ''}>
                        <span>to</span>
                        <input type="time" 
                               class="end-time" 
                               data-day="${dayOfWeek}" 
                               value="${availability.endTime}"
                               ${!availability.isAvailable ? 'disabled' : ''}>
                    </div>
                </div>
            `;
        }

        availabilityGrid.innerHTML = html;
        attachAvailabilityEventListeners();
    };

    const attachAvailabilityEventListeners = () => {
        document.querySelectorAll('.day-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const dayOfWeek = parseInt(e.target.dataset.day);
                const startInput = document.querySelector(`.start-time[data-day="${dayOfWeek}"]`);
                const endInput = document.querySelector(`.end-time[data-day="${dayOfWeek}"]`);

                if (e.target.checked) {
                    startInput.disabled = false;
                    endInput.disabled = false;
                    currentAvailability[dayOfWeek].isAvailable = true;
                } else {
                    startInput.disabled = true;
                    endInput.disabled = true;
                    currentAvailability[dayOfWeek].isAvailable = false;
                }
            });
        });

        document.querySelectorAll('.start-time, .end-time').forEach(input => {
            input.addEventListener('change', (e) => {
                const dayOfWeek = parseInt(e.target.dataset.day);
                const isStart = e.target.classList.contains('start-time');

                if (isStart) {
                    currentAvailability[dayOfWeek].startTime = e.target.value;
                } else {
                    currentAvailability[dayOfWeek].endTime = e.target.value;
                }
            });
        });
    };

    // TAB SWITCHING (Crucial for fixing the original issue)
    const switchTab = (tabName) => {
        // Update tab link styling
        tabLinks.forEach(link => {
            const linkTab = link.getAttribute('data-tab');
            if (linkTab === tabName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Update tab content visibility
        if (tabName === 'appointments') {
            appointmentsTab.classList.add('active');
            appointmentsTab.style.display = 'block';
            availabilityTab.classList.remove('active');
            availabilityTab.style.display = 'none';
        } else if (tabName === 'availability') {
            appointmentsTab.classList.remove('active');
            appointmentsTab.style.display = 'none';
            availabilityTab.classList.add('active');
            availabilityTab.style.display = 'block';
            loadAvailability(); // Loads data when switching to the tab
        }
    };

    // DATA LOADERS
    const loadAvailability = async () => {
        const availability = await localAuthorizedFetch('/api/doctor/availability');

        // Initialize with defaults
        currentAvailability = {};
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            currentAvailability[dayOfWeek] = {
                dayOfWeek,
                startTime: defaultStartTime,
                endTime: defaultEndTime,
                isAvailable: true
            };
        }

        // Override with database values if available
        if (availability && Array.isArray(availability)) {
            availability.forEach(slot => {
                const startTime = slot.start_time.substring(0, 5);
                const endTime = slot.end_time.substring(0, 5);
                currentAvailability[slot.day_of_week] = {
                    dayOfWeek: slot.day_of_week,
                    startTime: startTime,
                    endTime: endTime,
                    isAvailable: slot.is_available
                };
            });
        }

        renderAvailabilityGrid();
    };

    const saveAvailability = async () => {
        const availabilitySlots = Object.values(currentAvailability);

        const result = await localAuthorizedFetch('/api/doctor/availability', {
            method: 'POST',
            body: JSON.stringify({ availabilitySlots })
        });

        if (result) {
            showToast('Availability saved successfully!', 'success');
        }
    };


    // --- EVENT LISTENERS (Combined from both files) ---

    // Tab switching event listeners (from doctor-availability.js)
    tabLinks.forEach((link) => {
        const tabName = link.getAttribute('data-tab');
        link.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            switchTab(tabName);
        });
    });

    // Filter buttons (from doctor-appointments.js)
    document.querySelector('.btn-group').addEventListener('change', e => {
        const container = document.getElementById('date-range-container');

        if (e.target.id === 'btn-today') {
            container.style.display = "none";
            loadAppointments("today");
        }

        if (e.target.id === 'btn-upcoming') {
            container.style.display = "none";
            loadAppointments("upcoming");
        }

        if (e.target.id === 'btn-custom') {
            container.style.display = "block";
        }
    });

    // Date range filter
    document.getElementById('apply-date-range').onclick = () => {
        const start = document.getElementById('start-date').value;
        const end = document.getElementById('end-date').value;

        if (start && end) {
            searchAppointments("", start, end);
        } else {
            showToast("Please select both start and end dates", "danger");
        }
    };

    // Search functionality
    const performSearch = () => {
        const query = document.getElementById('search-input').value;
        searchAppointments(query, "", "");
    };

    document.getElementById('search-btn').onclick = performSearch;
    document.getElementById('search-input').onkeypress = e => {
        if (e.key === "Enter") performSearch();
    };

    // Appointment selection
    appointmentListContainer.onclick = e => {
        const item = e.target.closest(".appointment-item");
        if (!item) return;

        document.querySelector(".appointment-item.active")?.classList.remove("active");
        item.classList.add("active");

        const appointmentId = item.dataset.appointmentId;
        selectedAppointment = currentAppointments.find(a => a.appointment_id == appointmentId);

        if (selectedAppointment) {
            renderPatientDetails(selectedAppointment);
        }
    };

    // Patient info actions
    patientInfoContainer.onclick = async e => {
        const button = e.target.closest('button');
        if (!button) return;

        const action = button.dataset.action;
        if (!action || !selectedAppointment) return;

        if (action === 'complete') {
            prescribedTreatments = [];
            completionForm.reset();
            renderAddedTreatments();

            document.getElementById("completion-patient-info").innerHTML = `
                Completing appointment for <strong>${selectedAppointment.patient_name}</strong>.
            `;

            completionModal.show();
        }

        if (action === 'view-history') {
            renderSpinner(historyModalBody);
            historyModal.show();

            const history = await localAuthorizedFetch(
                `/api/doctor/patients/${selectedAppointment.patient_id}/history`
            );
            renderHistoryModal(history, selectedAppointment.patient_name);
        }
    };

    // Treatment selection - auto-populate price
    document.getElementById("treatment-select").onchange = e => {
        const priceInput = document.getElementById("treatment-price");
        if (!priceInput) return;

        const selectedOption = e.target.options[e.target.selectedIndex];
        if (selectedOption && selectedOption.dataset.price) {
            priceInput.value = selectedOption.dataset.price;
        } else {
            priceInput.value = '';
        }
    };

    // Add treatment button
    document.getElementById('add-treatment-btn').onclick = () => {
        const select = document.getElementById("treatment-select");
        const priceInput = document.getElementById("treatment-price");

        if (!select || !priceInput) {
            showToast("Form elements not found.", 'danger');
            return;
        }

        if (!select.value) {
            showToast("Please select a treatment.", 'danger');
            return;
        }

        const price = parseFloat(priceInput.value);
        if (!price || price <= 0) {
            showToast("Please enter a valid price.", 'danger');
            return;
        }

        const option = select.options[select.selectedIndex];
        const treatmentName = option.text.split(' (Rs')[0];

        // Check if treatment already added
        const alreadyAdded = prescribedTreatments.some(t => t.service_code === select.value);
        if (alreadyAdded) {
            showToast("This treatment has already been added.", 'warning');
            return;
        }

        prescribedTreatments.push({
            service_code: select.value,
            name: treatmentName,
            actual_price: price,
            notes: null
        });

        renderAddedTreatments();

        // Reset form
        select.value = '';
        priceInput.value = '';

        showToast(`${treatmentName} added successfully.`, 'success');
    };

    // Remove treatment
    document.getElementById("added-treatments-list").onclick = e => {
        const btn = e.target.closest('button[data-index]');
        if (btn) {
            const index = parseInt(btn.dataset.index, 10);
            if (!isNaN(index) && index >= 0 && index < prescribedTreatments.length) {
                const removed = prescribedTreatments.splice(index, 1);
                renderAddedTreatments();
                showToast(`${removed[0].name} removed.`, 'info');
            }
        }
    };

    // Completion form submit
    completionForm.onsubmit = async e => {
        e.preventDefault();

        const consultationNotes = document.getElementById("consultation_notes").value.trim();

        if (!consultationNotes) {
            showToast("Consultation notes are required.", 'danger');
            return;
        }

        if (consultationNotes.length < 10) {
            showToast("Please provide more detailed consultation notes (at least 10 characters).", 'danger');
            return;
        }

        // Treatments are optional, but show confirmation if none added
        if (prescribedTreatments.length === 0) {
            const confirmNoTreatments = confirm(
                "No treatments have been added. This will be recorded as a consultation only. Continue?"
            );
            if (!confirmNoTreatments) return;
        }

        const data = {
            consultation_notes: consultationNotes,
            treatments: prescribedTreatments
        };

        const submitBtn = e.target.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';
        }

        const result = await localAuthorizedFetch(
            `/api/doctor/appointments/${selectedAppointment.appointment_id}/complete`,
            { method: 'POST', body: JSON.stringify(data) }
        );

        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Mark as Completed';
        }

        if (result !== null) {
            completionModal.hide();
            showToast("Appointment completed successfully.", 'success');

            // Refresh the current view
            const currentFilter = document.querySelector('input[name="btnradio"]:checked');
            if (currentFilter) {
                if (currentFilter.id === 'btn-today') {
                    loadAppointments('today');
                } else if (currentFilter.id === 'btn-upcoming') {
                    loadAppointments('upcoming');
                }
            }

            // Clear the prescribed treatments array
            prescribedTreatments = [];
        }
    };

    // Availability save and reset buttons
    if (saveBtn) {
        saveBtn.addEventListener('click', saveAvailability);
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            loadAvailability();
            showToast('Changes discarded', 'info');
        });
    }

    // Logout
    document.getElementById('logout-button').onclick = () => {
        localStorage.removeItem('clinicProToken');
        window.location.href = 'login.html';
    };

    // --- INITIALIZATION (Combined and executed only once) ---
    loadInitialData(); // Loads profile, stats, treatments, and appointments ('today')
    loadAvailability(); // Initializes the availability grid and data

    console.log('[PORTAL] Initialization complete');
});