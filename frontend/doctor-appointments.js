// doctor-appointments.js

document.addEventListener("DOMContentLoaded", () => {
    const API_BASE_URL = "http://localhost:3000";

    // --- NEW: Secure Token Authentication ---
    const authToken = localStorage.getItem('clinicProToken');
    if (!authToken) {
        // If no token exists, redirect to the login page immediately.
        window.location.href = '/login.html';
        return; // Stop the rest of the script from running
    }

    const appointmentListContainer = document.getElementById("appointment-list-container");
    const patientInfoContainer = document.getElementById("patient-info-container");
    const todayBtn = document.getElementById("btn-today");
    const upcomingBtn = document.getElementById("btn-upcoming");
    const customBtn = document.getElementById("btn-custom");
    const dateRangeContainer = document.getElementById("date-range-container");
    const startDateInput = document.getElementById("start-date");
    const endDateInput = document.getElementById("end-date");
    const applyDateRangeBtn = document.getElementById("apply-date-range");
    const searchInput = document.getElementById("search-input");
    const searchBtn = document.getElementById("search-btn");
    const toastContainer = document.querySelector(".toast-container");

    const patientModal = new bootstrap.Modal(document.getElementById("patientModal"));
    const historyModal = new bootstrap.Modal(document.getElementById("historyModal"));
    const patientModalBody = document.getElementById("patientModalBody");
    const historyModalBody = document.getElementById("historyModalBody");
    const viewHistoryBtn = document.getElementById("view-history-btn");

    const todayTotalEl = document.getElementById("today-total");
    const todayCompletedEl = document.getElementById("today-completed");
    const todayScheduledEl = document.getElementById("today-scheduled");
    const upcomingWeekEl = document.getElementById("upcoming-week");

    let currentAppointments = [];
    let selectedAppointmentId = null;
    let selectedPatientId = null;
    let currentView = 'today';

    // --- HELPER FUNCTIONS ---
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

    // --- NEW: Centralized Authorized Fetch Function ---
    const authorizedFetch = async (endpoint, options = {}) => {
        const defaultHeaders = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        };
        const mergedOptions = {
            ...options,
            headers: { ...defaultHeaders, ...options.headers }
        };

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
            if (response.status === 204) { // Handle No Content response
                return null;
            }
            return await response.json();
        } catch (error) {
            console.error("Fetch error:", error);
            showToast(error.message, 'danger');
            throw error; // Re-throw the error to be caught by the calling function
        }
    };

    // --- UPDATED: Simplified Data Fetching Logic ---
    const updateAppointmentStatus = async (appointmentId, status) => {
        try {
            await authorizedFetch(`/api/doctor/appointments/${appointmentId}/status`, {
                method: 'PUT',
                body: JSON.stringify({ status }),
            });
            showToast("Appointment status updated successfully.");
            loadCurrentView();
            loadStatistics();
        } catch (error) {
            // Error is already shown by authorizedFetch
        }
    };

    const searchAppointments = async (query, startDate, endDate) => {
        try {
            const params = new URLSearchParams();
            if (query) params.append('query', query);
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
            
            const endpoint = `/api/doctor/appointments/search?${params.toString()}`;
            const appointments = await authorizedFetch(endpoint);

            if (appointments) {
                currentAppointments = appointments;
                renderAppointments(appointments);
                currentView = 'search';
            }
        } catch (error) {
            appointmentListContainer.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    };

    // --- RENDER FUNCTIONS ---
    const renderSpinner = (container) => {
        container.innerHTML = `
            <div class="d-flex justify-content-center p-5">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>`;
    };

    const renderAppointments = (appointments) => {
        if (!appointments || appointments.length === 0) {
            appointmentListContainer.innerHTML = `<div class="text-center p-5 text-muted">No appointments found.</div>`;
            return;
        }
        appointmentListContainer.innerHTML = appointments.map(appt => `
            <div class="appointment-item d-flex justify-content-between align-items-center p-3 border rounded mb-2"
                 data-appointment-id="${appt.appointment_id}"
                 data-patient-id="${appt.patient_id}"
                 style="cursor: pointer; transition: all 0.2s;">
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="mb-1 fw-bold">${appt.patient_name}</h6>
                        <span class="status-badge status-${appt.status}">${appt.status}</span>
                    </div>
                    <div class="row text-muted small">
                        <div class="col-sm-6"><i class="bi bi-clock me-1"></i>${new Date(appt.schedule_date).toLocaleString()}</div>
                        <div class="col-sm-6"><i class="bi bi-person me-1"></i>Age: ${appt.patient_age}</div>
                    </div>
                    <div class="row text-muted small mt-1">
                        <div class="col-sm-6"><i class="bi bi-telephone me-1"></i>${appt.patient_contact || 'N/A'}</div>
                        <div class="col-sm-6"><i class="bi bi-shield-check me-1"></i>${appt.insurance_provider || 'No Insurance'}</div>
                    </div>
                </div>
                <div class="ms-3">
                    <div class="d-flex flex-column gap-1">
                        <button class="btn btn-sm btn-outline-primary view-patient-btn"><i class="bi bi-eye"></i></button>
                        ${(appt.status === 'Scheduled' || appt.status === 'Rescheduled') ? `<button class="btn btn-sm btn-success complete-btn"><i class="bi bi-check"></i></button>` : ''}
                    </div>
                </div>
            </div>`).join('');
    };

    const renderPatientDetails = (appointment) => {
        const hasInsurance = appointment.insurance_provider ? 'Yes' : 'No';
        patientInfoContainer.innerHTML = `
            <div class="card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div><i class="bi bi-person-fill me-2"></i>Selected Patient</div>
                </div>
                <div class="card-body">
                    <h5 class="card-title">${appointment.patient_name}</h5>
                    <ul class="list-group list-group-flush">
                        <li class="list-group-item d-flex justify-content-between"><strong>Age:</strong> <span>${appointment.patient_age}</span></li>
                        <li class="list-group-item d-flex justify-content-between"><strong>Contact:</strong> <span>${appointment.patient_contact || 'N/A'}</span></li>
                        <li class="list-group-item d-flex justify-content-between"><strong>Insurance:</strong> <span>${hasInsurance}</span></li>
                        <li class="list-group-item d-flex justify-content-between"><strong>Provider:</strong> <span>${appointment.insurance_provider || 'N/A'}</span></li>
                        <li class="list-group-item d-flex justify-content-between"><strong>Appointment:</strong><span>${new Date(appointment.schedule_date).toLocaleString()}</span></li>
                        <li class="list-group-item d-flex justify-content-between"><strong>Status:</strong><span class="status-badge status-${appointment.status}">${appointment.status}</span></li>
                    </ul>
                    ${(appointment.status === 'Scheduled' || appointment.status === 'Rescheduled') ? `<div class="mt-3"><button class="btn btn-success w-100" onclick="updateAppointmentStatus(${appointment.appointment_id}, 'Completed')"><i class="bi bi-check-circle me-2"></i>Mark as Completed</button></div>` : ''}
                </div>
            </div>`;
    };
    
    const renderInitialPatientView=()=>{patientInfoContainer.innerHTML=`<div class="card"><div class="card-body text-center p-5"><i class="bi bi-person-circle fs-1 text-muted"></i><p class="mt-3 text-muted">Select an appointment to view patient details.</p></div></div>`};const renderPatientModal=(e)=>{const t=e.emergency_contact||"Not provided",o=e.insurance_provider_name||"No insurance",a=e.policy_number||"N/A";patientModalBody.innerHTML=`<div class="row"><div class="col-md-6"><h6 class="text-muted mb-3">Personal Information</h6><table class="table table-borderless"><tbody><tr><td><strong>Full Name:</strong></td><td>${e.name}</td></tr><tr><td><strong>Gender:</strong></td><td>${e.gender||"Not specified"}</td></tr><tr><td><strong>Date of Birth:</strong></td><td>${new Date(e.date_of_birth).toLocaleDateString()}</td></tr><tr><td><strong>Age:</strong></td><td>${e.age} years</td></tr><tr><td><strong>Contact Info:</strong></td><td>${e.contact_info||"Not provided"}</td></tr><tr><td><strong>Emergency Contact:</strong></td><td>${t}</td></tr></tbody></table></div><div class="col-md-6"><h6 class="text-muted mb-3">Insurance Information</h6><table class="table table-borderless"><tbody><tr><td><strong>Provider:</strong></td><td>${o}</td></tr><tr><td><strong>Policy Number:</strong></td><td>${a}</td></tr></tbody></table><div class="mt-4 p-3 bg-light rounded"><h6 class="text-muted mb-2">Quick Actions</h6><button class="btn btn-outline-primary btn-sm me-2" onclick="loadPatientHistory(${e.patient_id})"><i class="bi bi-clock-history me-1"></i>View History</button></div></div></div>`,selectedPatientId=e.patient_id};const renderHistoryModal=(e,t)=>{if(!e||0===e.length)return void(historyModalBody.innerHTML=`
            <div class="text-center p-5 text-muted">
                No appointment history found with this doctor.
            </div>`);document.getElementById("historyModalLabel").innerHTML=`<i class="bi bi-clock-history me-2"></i>Appointment History - ${t}`,historyModalBody.innerHTML=`<div class="timeline">${e.map(e=>`<div class="card mb-3"><div class="card-header d-flex justify-content-between align-items-center"><div><strong>${new Date(e.schedule_date).toLocaleDateString()}</strong><span class="text-muted ms-2">${new Date(e.schedule_date).toLocaleTimeString()}</span></div><div><span class="status-badge status-${e.status}">${e.status}</span>${e.is_emergency?'<span class="badge bg-danger ms-2">Emergency</span>':""}</div></div><div class="card-body">${e.treatments?`<div class="mb-3"><h6 class="text-muted">Treatments:</h6><p class="mb-1">${e.treatments}</p><small class="text-success"><strong>Total Cost: $${e.total_cost}</strong></small></div>`:'<p class="text-muted">No treatments recorded</p>'}</div></div>`).join("")}</div>`};

    // --- PAGE LOADERS & LOGIC ---
    const loadStatistics = async () => {
        try {
            const stats = await authorizedFetch('/api/doctor/stats');
            if (stats) {
                todayTotalEl.textContent = stats.today.total_appointments || 0;
                todayCompletedEl.textContent = stats.today.completed || 0;
                todayScheduledEl.textContent = stats.today.scheduled || 0;
                upcomingWeekEl.textContent = stats.upcoming_week || 0;
            }
        } catch (error) {
            console.error('Failed to load statistics:', error);
        }
    };

    const loadAppointments = async (type) => {
        renderSpinner(appointmentListContainer);
        renderInitialPatientView();
        selectedAppointmentId = null;
        currentView = type;
        const endpoint = type === 'today' ? '/api/doctor/appointments/today' : '/api/doctor/appointments/upcoming';
        try {
            currentAppointments = await authorizedFetch(endpoint);
            renderAppointments(currentAppointments);
        } catch (error) {
            appointmentListContainer.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    };

    const loadCurrentView = () => {
        if (currentView === 'today') loadAppointments('today');
        else if (currentView === 'upcoming') loadAppointments('upcoming');
        else if (currentView === 'search') {
            const query = searchInput.value;
            const startDate = startDateInput.value;
            const endDate = endDateInput.value;
            searchAppointments(query, startDate, endDate);
        }
    };

    const loadPatientDetails = async (patientId) => {
        try {
            renderSpinner(patientModalBody);
            patientModal.show();
            const patient = await authorizedFetch(`/api/doctor/patients/${patientId}`);
            if (patient) renderPatientModal(patient);
        } catch (error) {
            patientModalBody.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    };

    const loadPatientHistory = async (patientId) => {
        try {
            renderSpinner(historyModalBody);
            historyModal.show();
            const history = await authorizedFetch(`/api/doctor/patients/${patientId}/history`);
            const patient = currentAppointments.find(a => a.patient_id == patientId);
            const patientName = patient ? patient.patient_name : 'Unknown Patient';
            if (history) renderHistoryModal(history, patientName);
        } catch (error) {
            historyModalBody.innerHTML = `<div class="alert alert-danger">${error.message}</div>`;
        }
    };
    const loadDoctorProfile = async () => {
        try {
            const profile = await authorizedFetch('/api/doctor/profile');
            if (profile && profile.name) {
                document.getElementById('doctor-name').textContent = profile.name;
            }
        } catch (error) {
            console.error("Failed to load doctor profile:", error);
            document.getElementById('doctor-name').textContent = "Doctor";
        }
    };
    
    // --- NEW: Add event listener for the logout button ---
    document.getElementById('logout-button').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('clinicProToken');
        window.location.href = 'login.html';
    });
    
    // --- EVENT LISTENERS ---
    appointmentListContainer.addEventListener("click",e=>{const t=e.target.closest(".appointment-item");if(t){const o=parseInt(t.dataset.appointmentId,10),a=parseInt(t.dataset.patientId,10);if(e.target.closest(".view-patient-btn"))return e.stopPropagation(),void loadPatientDetails(a);if(e.target.closest(".complete-btn"))return e.stopPropagation(),void updateAppointmentStatus(o,"Completed");const n=currentAppointments.find(e=>e.appointment_id===o);n&&(document.querySelector(".appointment-item.bg-light")?.classList.remove("bg-light"),t.classList.add("bg-light"),selectedAppointmentId=o,renderPatientDetails(n))}});
    todayBtn.addEventListener("change",()=>{todayBtn.checked&&(dateRangeContainer.style.display="none",loadAppointments("today"))});
    upcomingBtn.addEventListener("change",()=>{upcomingBtn.checked&&(dateRangeContainer.style.display="none",loadAppointments("upcoming"))});
    customBtn.addEventListener("change",()=>{if(customBtn.checked){dateRangeContainer.style.display="block";const e=(new Date).toISOString().split("T")[0],t=new Date(Date.now()+6048e5).toISOString().split("T")[0];startDateInput.value=e,endDateInput.value=t}});
    applyDateRangeBtn.addEventListener("click",()=>{const e=startDateInput.value,t=endDateInput.value;return e&&t?new Date(e)>new Date(t)?void showToast("Start date must be before end date","danger"):void searchAppointments("",e,t):void showToast("Please select both start and end dates","danger")});
    const performSearch=()=>{const e=searchInput.value.trim();e.length<2?showToast("Please enter at least 2 characters to search","danger"):searchAppointments(e,"","")};
    searchBtn.addEventListener("click",performSearch);
    searchInput.addEventListener("keypress",e=>{"Enter"===e.key&&performSearch()});
    searchInput.addEventListener("input",e=>{""===e.target.value&&loadCurrentView()});
    viewHistoryBtn.addEventListener("click",()=>{selectedPatientId&&(patientModal.hide(),loadPatientHistory(selectedPatientId))});
    
    // --- GLOBAL FUNCTIONS ---
    window.updateAppointmentStatus=updateAppointmentStatus;
    window.loadPatientHistory=loadPatientHistory;

    // --- INITIAL LOAD ---
    loadAppointments('today');
    loadStatistics();
    loadDoctorProfile();
});