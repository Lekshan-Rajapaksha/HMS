// ============================================================================
// DOCTOR PORTAL - MAIN JAVASCRIPT
// Phase 3: Clinical Documentation UI
// ============================================================================

const API_BASE = 'http://localhost:3000/api';
let currentDoctor = null;
let currentAppointmentModal = null;
let currentNotesEditor = null;
let currentTreatmentRecorder = null;
let currentPage = 'dashboard'; // Track the current page

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getToken() {
    return localStorage.getItem('token');
}

function showToast(message, type = 'info') {
    const toastContainer = document.querySelector('.toast-container');
    const toastId = 'toast-' + Date.now();

    const bgClass = {
        'success': 'bg-success',
        'danger': 'bg-danger',
        'warning': 'bg-warning',
        'info': 'bg-info'
    }[type] || 'bg-info';

    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;

    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, { delay: 3000 });
    toast.show();

    toastElement.addEventListener('hidden.bs.toast', () => {
        toastElement.remove();
    });
}

async function fetchAPI(endpoint, options = {}) {
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const defaultOptions = {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    };

    const response = await fetch(`${API_BASE}${endpoint}`, { ...defaultOptions, ...options });

    if (response.status === 401) {
        showToast('Session expired. Please login again.', 'danger');
        setTimeout(() => {
            localStorage.removeItem('token');
            window.location.href = 'login.html';
        }, 2000);
        throw new Error('Unauthorized');
    }

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Request failed');
    }

    return response.json();
}

// Auto-refresh function - refreshes current page content
async function refreshCurrentPage() {
    console.log('Refreshing current page:', currentPage);
    switch (currentPage) {
        case 'dashboard':
            await loadDashboard();
            break;
        case 'appointments':
            await loadAppointments();
            break;
        case 'patients':
            await loadPatients();
            break;
        case 'reports':
            await loadReports();
            break;
        case 'profile':
            await loadProfile();
            break;
    }
}

// ============================================================================
// TREATMENT RECORDER CLASS
// ============================================================================

class TreatmentRecorder {
    constructor(appointmentId, appointmentStatus) {
        this.appointmentId = appointmentId;
        this.appointmentStatus = appointmentStatus;
        this.selectedTreatments = [];
        this.catalogueCache = null;
    }

    async loadTreatmentCatalogue() {
        if (this.catalogueCache) return this.catalogueCache;

        try {
            this.catalogueCache = await fetchAPI('/doctor/treatments/catalogue');
            return this.catalogueCache;
        } catch (err) {
            showToast('Failed to load treatment catalogue', 'danger');
            return [];
        }
    }

    async loadExistingTreatments() {
        try {
            const data = await fetchAPI(`/doctor/appointments/${this.appointmentId}/treatments`);
            this.selectedTreatments = data.treatments || [];
            return this.selectedTreatments;
        } catch (err) {
            showToast('Failed to load existing treatments', 'danger');
            return [];
        }
    }

    async addTreatment(serviceCode, actualPrice, notes) {
        const response = await fetch(`${API_BASE}/doctor/appointments/${this.appointmentId}/treatments`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                service_code: serviceCode,
                actual_price: actualPrice || null,
                notes: notes || ''
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message);
        }

        return await response.json();
    }

    async removeTreatment(serviceCode) {
        const response = await fetch(
            `${API_BASE}/doctor/appointments/${this.appointmentId}/treatments/${serviceCode}`,
            {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${getToken()}` }
            }
        );

        if (!response.ok) {
            throw new Error('Failed to remove treatment');
        }
    }

    async render(containerId) {
        const container = document.getElementById(containerId);

        if (!container) {
            console.error('Treatment recorder container not found:', containerId);
            return;
        }

        // Show warning if appointment not completed
        if (this.appointmentStatus !== 'Completed') {
            container.innerHTML = `
                <div class="alert alert-warning">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    <strong>Appointment must be marked as Completed before adding treatments.</strong>
                    <br>Please complete the appointment first using the status dropdown above.
                </div>
            `;
            return;
        }

        // Load catalogue and render interface
        try {
            const catalogue = await this.loadTreatmentCatalogue();

            let html = `
                <div class="treatment-selector">
                    <h6><i class="bi bi-clipboard2-pulse me-2"></i>Add Treatments</h6>
                    <div class="mb-3">
                        <label class="form-label">Select Treatment</label>
                        <select id="treatment-select-${this.appointmentId}" class="form-select">
                            <option value="">Choose a treatment...</option>
            `;

            catalogue.forEach(t => {
                html += `<option value="${t.service_code}" data-price="${t.base_price}">
                    ${t.name} - $${parseFloat(t.base_price).toFixed(2)}
                </option>`;
            });

            html += `
                        </select>
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Price Override (optional)</label>
                        <input type="number" id="treatment-price-${this.appointmentId}" class="form-control" step="0.01" placeholder="Leave blank to use standard price">
                    </div>
                    <div class="mb-3">
                        <label class="form-label">Notes</label>
                        <textarea id="treatment-notes-${this.appointmentId}" class="form-control" rows="2" placeholder="Additional notes for this treatment..."></textarea>
                    </div>
                    <button id="add-treatment-btn-${this.appointmentId}" class="btn btn-primary">
                        <i class="bi bi-plus-circle me-2"></i>Add Treatment
                    </button>
                </div>
                <hr>
                <h6><i class="bi bi-list-check me-2"></i>Selected Treatments</h6>
                <div id="selected-treatments-list-${this.appointmentId}"></div>
            `;

            container.innerHTML = html;

            // Event listener for add button
            document.getElementById(`add-treatment-btn-${this.appointmentId}`).addEventListener('click', async () => {
                await this.handleAddTreatment();
            });

            // Load and display existing treatments
            await this.loadExistingTreatments();
            this.renderSelectedTreatments();

        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">Failed to load treatment recorder</div>`;
        }
    }

    async handleAddTreatment() {
        const select = document.getElementById(`treatment-select-${this.appointmentId}`);
        const serviceCode = select.value;
        const price = document.getElementById(`treatment-price-${this.appointmentId}`).value;
        const notes = document.getElementById(`treatment-notes-${this.appointmentId}`).value;

        if (!serviceCode) {
            showToast('Please select a treatment', 'warning');
            return;
        }

        try {
            await this.addTreatment(serviceCode, price || null, notes);
            showToast('Treatment added successfully', 'success');

            // Reset form
            select.value = '';
            document.getElementById(`treatment-price-${this.appointmentId}`).value = '';
            document.getElementById(`treatment-notes-${this.appointmentId}`).value = '';

            // Reload list
            await this.loadExistingTreatments();
            this.renderSelectedTreatments();

            // Refresh dashboard stats and appointments list
            await refreshCurrentPage();

        } catch (error) {
            showToast(error.message, 'danger');
        }
    }

    renderSelectedTreatments() {
        const container = document.getElementById(`selected-treatments-list-${this.appointmentId}`);

        if (!container) return;

        if (this.selectedTreatments.length === 0) {
            container.innerHTML = '<p class="text-muted">No treatments added yet.</p>';
            return;
        }

        let html = '<div class="list-group">';
        this.selectedTreatments.forEach(treatment => {
            html += `
                <div class="list-group-item d-flex justify-content-between align-items-start">
                    <div>
                        <strong>${treatment.name}</strong><br>
                        <small class="text-muted">Code: ${treatment.service_code}</small><br>
                        <small>Price: $${parseFloat(treatment.actual_price).toFixed(2)}</small>
                        ${treatment.notes ? `<br><small class="text-info">${treatment.notes}</small>` : ''}
                    </div>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeTreatmentGlobal('${this.appointmentId}', '${treatment.service_code}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `;
        });
        html += '</div>';

        container.innerHTML = html;
    }
}

// Global function for remove button (needs to be accessible from inline onclick)
async function removeTreatmentGlobal(appointmentId, serviceCode) {
    if (!confirm('Remove this treatment?')) return;

    try {
        if (currentTreatmentRecorder && currentTreatmentRecorder.appointmentId == appointmentId) {
            await currentTreatmentRecorder.removeTreatment(serviceCode);
            showToast('Treatment removed', 'success');
            await currentTreatmentRecorder.loadExistingTreatments();
            currentTreatmentRecorder.renderSelectedTreatments();

            // Refresh dashboard stats and appointments list
            await refreshCurrentPage();
        }
    } catch (error) {
        showToast('Failed to remove treatment', 'danger');
    }
}

// ============================================================================
// CONSULTATION NOTES EDITOR CLASS
// ============================================================================

class ConsultationNotesEditor {
    constructor(appointmentId) {
        this.appointmentId = appointmentId;
        this.autoSaveInterval = null;
        this.lastSavedContent = '';
        this.isDirty = false;
    }

    async load() {
        try {
            const data = await fetchAPI(`/doctor/appointments/${this.appointmentId}/notes`);
            return data;
        } catch (err) {
            showToast('Failed to load consultation notes', 'danger');
            return { consultation_notes: '', can_edit: false };
        }
    }

    async save(notes) {
        const response = await fetch(`${API_BASE}/doctor/appointments/${this.appointmentId}/notes`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ consultation_notes: notes })
        });

        if (!response.ok) {
            throw new Error('Failed to save notes');
        }

        return await response.json();
    }

    async render(containerId) {
        const container = document.getElementById(containerId);

        if (!container) {
            console.error('Notes editor container not found:', containerId);
            return;
        }

        try {
            const data = await this.load();

            container.innerHTML = `
                <div class="consultation-notes-editor">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <h6><i class="bi bi-journal-medical me-2"></i>Consultation Notes</h6>
                        <span id="save-status-${this.appointmentId}" class="text-muted small">
                            <i class="bi bi-check-circle text-success"></i> All changes saved
                        </span>
                    </div>
                    <textarea
                        id="consultation-notes-textarea-${this.appointmentId}"
                        class="form-control"
                        rows="8"
                        placeholder="Enter detailed diagnosis, observations, and treatment plan..."
                    >${data.consultation_notes || ''}</textarea>
                    <div class="text-muted small mt-2">
                        <i class="bi bi-info-circle me-1"></i>
                        Auto-saves every 30 seconds
                    </div>
                </div>
            `;

            this.lastSavedContent = data.consultation_notes || '';
            this.startAutoSave();

        } catch (err) {
            container.innerHTML = `<div class="alert alert-danger">Failed to load notes editor</div>`;
        }
    }

    startAutoSave() {
        const textarea = document.getElementById(`consultation-notes-textarea-${this.appointmentId}`);

        if (!textarea) return;

        // Track changes
        textarea.addEventListener('input', () => {
            this.isDirty = textarea.value !== this.lastSavedContent;
            if (this.isDirty) {
                this.updateSaveStatus('Unsaved changes...', 'warning');
            }
        });

        // Auto-save every 30 seconds
        this.autoSaveInterval = setInterval(() => {
            if (this.isDirty) {
                this.performAutoSave();
            }
        }, 30000); // 30 seconds
    }

    async performAutoSave() {
        const textarea = document.getElementById(`consultation-notes-textarea-${this.appointmentId}`);
        if (!textarea) return;

        const content = textarea.value;

        try {
            this.updateSaveStatus('Saving...', 'info');
            const result = await this.save(content);
            this.lastSavedContent = content;
            this.isDirty = false;
            this.updateSaveStatus(`Saved at ${new Date(result.saved_at).toLocaleTimeString()}`, 'success');
        } catch (error) {
            this.updateSaveStatus('Save failed', 'danger');
            console.error('Auto-save error:', error);
        }
    }

    updateSaveStatus(message, type) {
        const statusEl = document.getElementById(`save-status-${this.appointmentId}`);
        if (!statusEl) return;

        const icons = {
            'success': 'check-circle',
            'warning': 'exclamation-triangle',
            'info': 'arrow-clockwise',
            'danger': 'x-circle'
        };

        const colors = {
            'success': 'text-success',
            'warning': 'text-warning',
            'info': 'text-info',
            'danger': 'text-danger'
        };

        statusEl.innerHTML = `<i class="bi bi-${icons[type]} ${colors[type]}"></i> ${message}`;
    }

    destroy() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
    }
}

// ============================================================================
// PAGE RENDERING FUNCTIONS
// ============================================================================

async function loadDashboard() {
    const mainContent = document.getElementById('main-content');

    try {
        const stats = await fetchAPI('/doctor/stats');
        const todayAppointments = await fetchAPI('/doctor/appointments/today');

        mainContent.innerHTML = `
            <div class="page-header">
                <h1>Dashboard</h1>
            </div>

            <div class="row">
                <div class="col-md-3">
                    <div class="stat-card" style="background: linear-gradient(135deg, #6a5af9 0%, #5a4ae4 100%);">
                        <h3>${stats.today?.total_appointments || 0}</h3>
                        <p>Today's Appointments</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card" style="background: linear-gradient(135deg, #1cc88a 0%, #17a673 100%);">
                        <h3>${stats.upcoming_week || 0}</h3>
                        <p>Upcoming (This Week)</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card" style="background: linear-gradient(135deg, #f6c23e 0%, #dda20a 100%);">
                        <h3>${stats.total_completed || 0}</h3>
                        <p>Total Completed</p>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="stat-card" style="background: linear-gradient(135deg, #e74a3b 0%, #c9302c 100%);">
                        <h3>${stats.total_patients || 0}</h3>
                        <p>Total Patients</p>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h5><i class="bi bi-calendar-check me-2"></i>Today's Appointments</h5>
                </div>
                <div class="card-body">
                    ${renderAppointmentsTable(todayAppointments)}
                </div>
            </div>
        `;
    } catch (err) {
        mainContent.innerHTML = `<div class="alert alert-danger">Failed to load dashboard: ${err.message}</div>`;
    }
}

async function loadAppointments() {
    const mainContent = document.getElementById('main-content');

    try {
        const appointments = await fetchAPI('/doctor/appointments/upcoming');

        mainContent.innerHTML = `
            <div class="page-header">
                <h1>My Appointments</h1>
            </div>

            <div class="card">
                <div class="card-header">
                    <h5><i class="bi bi-calendar3 me-2"></i>Upcoming & Recent Appointments</h5>
                </div>
                <div class="card-body">
                    ${renderAppointmentsTable(appointments)}
                </div>
            </div>
        `;
    } catch (err) {
        mainContent.innerHTML = `<div class="alert alert-danger">Failed to load appointments: ${err.message}</div>`;
    }
}

function renderAppointmentsTable(appointments) {
    if (appointments.length === 0) {
        return '<p class="text-muted">No appointments found.</p>';
    }

    let html = `
        <div class="table-responsive">
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>Date & Time</th>
                        <th>Patient</th>
                        <th>Contact</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
    `;

    appointments.forEach(apt => {
        const date = new Date(apt.schedule_date);
        html += `
            <tr>
                <td>${date.toLocaleString()}</td>
                <td>${apt.patient_name}</td>
                <td>${apt.patient_contact || 'N/A'}</td>
                <td><span class="badge status-${apt.status}">${apt.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="showAppointmentDetails(${apt.appointment_id})">
                        <i class="bi bi-eye"></i> View Details
                    </button>
                </td>
            </tr>
        `;
    });

    html += `
                </tbody>
            </table>
        </div>
    `;

    return html;
}

async function showAppointmentDetails(appointmentId) {
    try {
        // Fetch appointment details
        const appointments = await fetchAPI('/doctor/appointments/upcoming');
        const appointment = appointments.find(a => a.appointment_id == appointmentId);

        if (!appointment) {
            showToast('Appointment not found', 'danger');
            return;
        }

        const modalBody = document.getElementById('appointmentDetailsModalBody');

        modalBody.innerHTML = `
            <div class="row">
                <div class="col-md-4">
                    <h6>Patient Information</h6>
                    <p><strong>Name:</strong> ${appointment.patient_name}</p>
                    <p><strong>Contact:</strong> ${appointment.patient_contact || 'N/A'}</p>
                    <button class="btn btn-sm btn-outline-primary" onclick="viewMedicalHistory(${appointment.patient_id})">
                        <i class="bi bi-file-medical"></i> View Medical History
                    </button>
                </div>
                <div class="col-md-8">
                    <h6>Appointment Details</h6>
                    <p><strong>Date:</strong> ${new Date(appointment.schedule_date).toLocaleString()}</p>
                    <p><strong>Status:</strong> <span class="badge status-${appointment.status}">${appointment.status}</span></p>

                    <div class="mb-3">
                        <label class="form-label">Change Status:</label>
                        <select id="status-select-${appointmentId}" class="form-select">
                            <option value="Scheduled" ${appointment.status === 'Scheduled' ? 'selected' : ''}>Scheduled</option>
                            <option value="Completed" ${appointment.status === 'Completed' ? 'selected' : ''}>Completed</option>
                            <option value="Cancelled" ${appointment.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                        <button class="btn btn-primary btn-sm mt-2" onclick="updateAppointmentStatus(${appointmentId})">
                            Update Status
                        </button>
                    </div>

                    <hr>

                    <!-- Consultation Notes -->
                    <div id="notes-container-${appointmentId}"></div>

                    <hr>

                    <!-- Treatment Recorder -->
                    <div id="treatment-container-${appointmentId}"></div>
                </div>
            </div>
        `;

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('appointmentDetailsModal'));
        modal.show();

        // Initialize components
        currentNotesEditor = new ConsultationNotesEditor(appointmentId);
        await currentNotesEditor.render(`notes-container-${appointmentId}`);

        currentTreatmentRecorder = new TreatmentRecorder(appointmentId, appointment.status);
        await currentTreatmentRecorder.render(`treatment-container-${appointmentId}`);

        // Cleanup on modal close
        document.getElementById('appointmentDetailsModal').addEventListener('hidden.bs.modal', () => {
            if (currentNotesEditor) {
                currentNotesEditor.destroy();
                currentNotesEditor = null;
            }
        }, { once: true });

    } catch (error) {
        showToast('Failed to load appointment details', 'danger');
        console.error(error);
    }
}

async function updateAppointmentStatus(appointmentId) {
    const status = document.getElementById(`status-select-${appointmentId}`).value;

    try {
        const response = await fetch(`${API_BASE}/doctor/appointments/${appointmentId}/status`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });

        if (!response.ok) throw new Error('Failed to update status');

        showToast('Status updated successfully', 'success');

        // Reload appointment details to refresh treatment section
        bootstrap.Modal.getInstance(document.getElementById('appointmentDetailsModal')).hide();

        // Refresh the current page to update stats and appointments list
        await refreshCurrentPage();

        setTimeout(() => {
            showAppointmentDetails(appointmentId);
        }, 500);

    } catch (error) {
        showToast(error.message, 'danger');
    }
}

async function viewMedicalHistory(patientId) {
    try {
        const data = await fetchAPI(`/doctor/patients/${patientId}/medical-history`);

        const modalBody = document.getElementById('medicalHistoryModalBody');
        modalBody.innerHTML = `
            <div class="mb-3">
                <label class="form-label"><strong>Medical History</strong></label>
                <textarea id="medical-history-input" class="form-control" rows="4">${data.medical_history || ''}</textarea>
            </div>
            <div class="mb-3">
                <label class="form-label"><strong>Allergies</strong></label>
                <textarea id="allergies-input" class="form-control" rows="2">${data.allergies || ''}</textarea>
            </div>
            <div class="mb-3">
                <label class="form-label"><strong>Current Medications</strong></label>
                <textarea id="current-medications-input" class="form-control" rows="3">${data.current_medications || ''}</textarea>
            </div>
        `;

        const modal = new bootstrap.Modal(document.getElementById('medicalHistoryModal'));
        modal.show();

        // Handle save button
        document.getElementById('save-medical-history-btn').onclick = async () => {
            await saveMedicalHistory(patientId);
        };

    } catch (error) {
        showToast('Failed to load medical history', 'danger');
    }
}

async function saveMedicalHistory(patientId) {
    try {
        const medicalHistory = document.getElementById('medical-history-input').value;
        const allergies = document.getElementById('allergies-input').value;
        const currentMedications = document.getElementById('current-medications-input').value;

        await fetch(`${API_BASE}/doctor/patients/${patientId}/medical-history`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                medical_history: medicalHistory,
                allergies: allergies,
                current_medications: currentMedications
            })
        });

        showToast('Medical history updated successfully', 'success');
        bootstrap.Modal.getInstance(document.getElementById('medicalHistoryModal')).hide();

    } catch (error) {
        showToast('Failed to update medical history', 'danger');
    }
}

async function loadProfile() {
    const mainContent = document.getElementById('main-content');

    try {
        const profile = await fetchAPI('/doctor/profile');

        mainContent.innerHTML = `
            <div class="page-header">
                <h1>My Profile</h1>
            </div>

            <div class="card">
                <div class="card-body">
                    <h5>${profile.name}</h5>
                    <p><strong>Specialty:</strong> ${profile.specialty || 'N/A'}</p>
                    <p><strong>Qualifications:</strong> ${profile.qualifications || 'N/A'}</p>
                    <p><strong>Contact:</strong> ${profile.contact_info || 'N/A'}</p>
                    <p><strong>Email:</strong> ${profile.email || 'N/A'}</p>
                </div>
            </div>
        `;
    } catch (err) {
        mainContent.innerHTML = `<div class="alert alert-danger">Failed to load profile</div>`;
    }
}

async function loadReports() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="page-header">
            <h1>Reports & Analytics</h1>
        </div>
        <div class="alert alert-info">
            <i class="bi bi-info-circle me-2"></i>
            Reports functionality coming soon in Phase 4
        </div>
    `;
}

async function loadPatients() {
    const mainContent = document.getElementById('main-content');
    mainContent.innerHTML = `
        <div class="page-header">
            <h1>Patients</h1>
        </div>
        <div class="alert alert-info">
            <i class="bi bi-info-circle me-2"></i>
            Patient search functionality coming soon
        </div>
    `;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const token = getToken();
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    // Load doctor profile for sidebar
    try {
        const profile = await fetchAPI('/doctor/profile');
        currentDoctor = profile;
        document.getElementById('doctor-name-text').textContent = profile.name;
    } catch (err) {
        showToast('Failed to load doctor profile', 'danger');
    }

    // Navigation event listeners
    document.querySelectorAll('.nav-link[data-page]').forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();

            // Update active state
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            const page = link.getAttribute('data-page');
            currentPage = page; // Update current page tracker

            switch (page) {
                case 'dashboard':
                    await loadDashboard();
                    break;
                case 'appointments':
                    await loadAppointments();
                    break;
                case 'patients':
                    await loadPatients();
                    break;
                case 'reports':
                    await loadReports();
                    break;
                case 'profile':
                    await loadProfile();
                    break;
            }
        });
    });

    // Logout
    document.getElementById('logout-btn').addEventListener('click', (e) => {
        e.preventDefault();
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    });

    // Load dashboard by default
    await loadDashboard();
});
