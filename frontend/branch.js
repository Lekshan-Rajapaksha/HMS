// branch.js
const API_BASE_URL = "https://hms-production-a5ad.up.railway.app";

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem('clinicProToken');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    const mainContent = document.getElementById("main-content");
    const navLinks = document.querySelectorAll(".nav-link");
    const toastContainer = document.querySelector(".toast-container");
    const formModal = new bootstrap.Modal(document.getElementById("formModal"));
    const detailsModal = new bootstrap.Modal(document.getElementById("detailsModal"));
    const formModalLabel = document.getElementById("formModalLabel");
    const formModalBody = document.getElementById("formModalBody");
    const detailsModalLabel = document.getElementById("detailsModalLabel");
    const detailsModalBody = document.getElementById("detailsModalBody");

    let currentViewData = [];
    let userProfile = {};
    let chartInstances = { revenue: null, arrivals: null };

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
        const toast = new bootstrap.Toast(document.getElementById(toastId), { delay: 4000 });
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
    const renderSpinner = (target) => {
        if (target) target.innerHTML = `<div class="d-flex justify-content-center p-5"><div class="spinner-border text-primary"></div></div>`;
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
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}${headers.length > 0 ? '<th>Actions</th>' : ''}</tr></thead>
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

    const renderTable = (data, headers, rowGenerator, emptyMessage) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) {
            const colspan = headers.length > 0 ? headers.length + 1 : 1;
            tableBody.innerHTML = `<tr><td colspan="${colspan}" class="text-center p-5 text-muted">${emptyMessage}</td></tr>`;
            return;
        }
        tableBody.innerHTML = data.map(rowGenerator).join('');
    };

    // PAGE LOADERS & RENDERERS
    const loadDashboard = async () => {
        const stats = await authorizedFetch("/api/branch-manager/stats");
        if (!stats) { mainContent.innerHTML = `<div class="alert alert-danger">Could not load dashboard.</div>`; return; }
        mainContent.innerHTML = `
            <h1>Branch Dashboard</h1>
            <div class="row">
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-calendar-day fs-2 text-primary me-3"></i><div><div class="text-muted">Scheduled Today</div><div class="h5 fw-bold">${stats.scheduled_today}</div></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-calendar-check fs-2 text-success me-3"></i><div><div class="text-muted">Completed Today</div><div class="h5 fw-bold">${stats.completed_today}</div></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-calendar-x fs-2 text-danger me-3"></i><div><div class="text-muted">Cancelled Today</div><div class="h5 fw-bold">${stats.canceled_today || 0}</div></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-people-fill fs-2 text-info me-3"></i><div><div class="text-muted">Total Staff</div><div class="h5 fw-bold">${stats.staff}</div></div></div></div></div></div>
            </div>
            <div class="row mt-4">
                <div class="col-lg-6 mb-4"><div class="card"><div class="card-header">Yearly Revenue Trend</div><div class="card-body"><div class="chart-container"><canvas id="yearly-revenue-chart"></canvas></div></div></div></div>
                <div class="col-lg-6 mb-4"><div class="card"><div class="card-header">Patient Arrivals (Monthly)</div><div class="card-body"><div class="chart-container"><canvas id="patient-arrivals-chart"></canvas></div></div></div></div>
            </div>`;

        const [yearlyRevenue, patientArrivals] = await Promise.all([
            authorizedFetch('/api/branch-manager/reports/yearly-revenue'),
            authorizedFetch('/api/branch-manager/reports/patient-arrivals')
        ]);

        if (yearlyRevenue && yearlyRevenue.length > 0) {
            renderYearlyRevenueChart(yearlyRevenue);
        }
        if (patientArrivals && patientArrivals.length > 0) {
            renderPatientArrivalsChart(patientArrivals);
        }
    };

    const renderYearlyRevenueChart = (data) => {
        const ctx = document.getElementById('yearly-revenue-chart');
        if (!ctx) return;

        if (chartInstances.revenue) chartInstances.revenue.destroy();

        const months = data.map(d => d.month);
        const totalRevenue = data.map(d => parseFloat(d.total_revenue || 0));
        const paidRevenue = data.map(d => parseFloat(d.paid_revenue || 0));
        const pendingRevenue = data.map(d => parseFloat(d.pending_revenue || 0));

        chartInstances.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Total Revenue',
                        data: totalRevenue,
                        borderColor: '#6a5af9',
                        backgroundColor: 'rgba(106, 90, 249, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 5,
                        pointBackgroundColor: '#6a5af9'
                    },
                    {
                        label: 'Paid',
                        data: paidRevenue,
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        tension: 0.4,
                        fill: false,
                        borderDash: [5, 5],
                        pointRadius: 4,
                        pointBackgroundColor: '#28a745'
                    },
                    {
                        label: 'Pending',
                        data: pendingRevenue,
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.1)',
                        tension: 0.4,
                        fill: false,
                        borderDash: [5, 5],
                        pointRadius: 4,
                        pointBackgroundColor: '#dc3545'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true, padding: 15 } },
                    tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, titleFont: { size: 14 }, bodyFont: { size: 13 } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: (value) => 'Rs.' + value.toFixed(0) } }
                }
            }
        });
    };

    const renderPatientArrivalsChart = (data) => {
        const ctx = document.getElementById('patient-arrivals-chart');
        if (!ctx) return;

        if (chartInstances.arrivals) chartInstances.arrivals.destroy();

        const months = data.map(d => d.month);
        const uniquePatients = data.map(d => d.unique_patients);
        const totalAppointments = data.map(d => d.total_appointments);
        const completed = data.map(d => d.completed);

        chartInstances.arrivals = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Unique Patients',
                        data: uniquePatients,
                        borderColor: '#17a2b8',
                        backgroundColor: 'rgba(23, 162, 184, 0.1)',
                        tension: 0.4,
                        fill: true,
                        pointRadius: 5,
                        pointBackgroundColor: '#17a2b8'
                    },
                    {
                        label: 'Total Appointments',
                        data: totalAppointments,
                        borderColor: '#ffc107',
                        backgroundColor: 'rgba(255, 193, 7, 0.1)',
                        tension: 0.4,
                        fill: false,
                        borderDash: [5, 5],
                        pointRadius: 4,
                        pointBackgroundColor: '#ffc107'
                    },
                    {
                        label: 'Completed',
                        data: completed,
                        borderColor: '#28a745',
                        backgroundColor: 'rgba(40, 167, 69, 0.1)',
                        tension: 0.4,
                        fill: false,
                        borderDash: [5, 5],
                        pointRadius: 4,
                        pointBackgroundColor: '#28a745'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top', labels: { usePointStyle: true, padding: 15 } },
                    tooltip: { backgroundColor: 'rgba(0,0,0,0.8)', padding: 12, titleFont: { size: 14 }, bodyFont: { size: 13 } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { stepSize: 1 } }
                }
            }
        });
    };

    const renderAppointmentsTable = (data) => {
        const statusColors = { Scheduled: 'primary', Completed: 'success', Cancelled: 'danger', Rescheduled: 'warning' };
        renderTable(data, ["ID", "Date", "Patient", "Doctor", "Status"],
            a => `<tr><td>${a.appointment_id}</td><td>${new Date(a.schedule_date).toLocaleString()}</td><td>${a.patient_name}</td><td>${a.doctor_name}</td><td><span class="badge bg-${statusColors[a.status] || 'secondary'}">${a.status}</span></td><td class="table-actions"><button class="btn btn-sm btn-outline-danger" data-action="cancel" data-type="appointment" data-id="${a.appointment_id}" title="Cancel Appointment"><i class="bi bi-calendar-x"></i></button></td></tr>`,
            "No appointments found for this branch."
        );
    };

    const loadAppointmentsPage = async () => {
        createPageTemplate({ title: "Branch Appointments", type: "appointment", headers: ["ID", "Date", "Patient", "Doctor", "Status"], showAddBtn: false });
        currentViewData = await authorizedFetch("/api/branch-manager/appointments");
        renderAppointmentsTable(currentViewData);
        setupSearch(renderAppointmentsTable, ['appointment_id', 'patient_name', 'doctor_name']);
    };

    const renderStaffTable = (data) => {
        renderTable(data, ["ID", "Name", "Role", "Specialty", "Contact"],
            s => `<tr>
                <td>${s.staff_id}</td>
                <td>${s.name} ${s.is_medical_staff ? '<i class="bi bi-heart-pulse text-primary" title="Medical Staff"></i>' : ""}</td>
                <td>${s.role_name}</td>
                <td><small>${s.specialty_name || 'N/A'}</small></td>
                <td>${s.contact_info}</td>
                <td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="staff" data-id="${s.staff_id}"><i class="bi bi-pencil-fill"></i></button></td>
             </tr>`,
            "No staff found for this branch."
        );
    };

    const loadStaffPage = async () => {
        createPageTemplate({ title: "Branch Staff", type: "staff", headers: ["ID", "Name", "Role", "Specialty", "Contact"] });
        currentViewData = await authorizedFetch("/api/branch-manager/staff");
        renderStaffTable(currentViewData)
        setupSearch(renderStaffTable, ['staff_id', 'name', 'role_name', 'specialty_name']);
    };

    const renderInvoicesTable = (data) => {
        const statusColors = { Paid: 'success', 'Partially Paid': 'warning', Pending: 'danger' };
        renderTable(data, ["ID", "Patient", "Total", "Due", "Status", "Due Date"],
            i => `<tr>
                <td>#${i.invoice_id}</td>
                <td>${i.patient_name}</td>
                <td>Rs.${parseFloat(i.total_amount).toFixed(2)}</td>
                <td>Rs.${parseFloat(i.due_amount).toFixed(2)}</td>
                <td><span class="badge bg-${statusColors[i.status] || 'secondary'}">${i.status}</span></td>
                <td>${new Date(i.due_date).toLocaleDateString()}</td>
                <td class="table-actions">
                    ${i.status !== 'Paid' ? `<button class="btn btn-sm btn-outline-success" data-action="pay" data-type="invoice" data-id="${i.invoice_id}" title="Record Payment"><i class="bi bi-cash-coin"></i></button>` : ''}
                </td>
            </tr>`,
            "No invoices found for this branch."
        );
    };

    const loadInvoicesPage = async () => {
        createPageTemplate({ title: "Branch Billing", type: "invoice", headers: ["ID", "Patient", "Total", "Due", "Status", "Due Date"], showAddBtn: false });
        renderSpinner(document.getElementById("table-body"));
        currentViewData = await authorizedFetch("/api/branch-manager/invoices");
        if (!currentViewData) return;
        renderInvoicesTable(currentViewData);
        setupSearch(renderInvoicesTable, ['invoice_id', 'patient_name', 'status']);
    };

    const loadReportsPage = async () => {
        mainContent.innerHTML = `
            <h1>Reports</h1>
            <p class="text-muted">Select a report to view details and analysis.</p>
            <div class="row g-3">
                <div class="col-lg-6">
                    <div class="card report-card h-100" data-report="doctor-revenue" style="cursor: pointer; border-left: 4px solid #28a745;">
                        <div class="card-body">
                            <div class="d-flex align-items-start justify-content-between mb-2">
                                <div>
                                    <h5 class="card-title fw-bold mb-1">Doctor Revenue Report</h5>
                                    <p class="card-text text-muted small mb-0">Track revenue generated by each doctor with performance metrics.</p>
                                </div>
                                <i class="bi bi-person-hearts fs-5 text-success"></i>
                            </div>
                            <div class="mt-3 pt-2 border-top">
                                <span class="badge bg-light text-dark">Revenue Tracking</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="card report-card h-100" data-report="outstanding-balances" style="cursor: pointer; border-left: 4px solid #dc3545;">
                        <div class="card-body">
                            <div class="d-flex align-items-start justify-content-between mb-2">
                                <div>
                                    <h5 class="card-title fw-bold mb-1">Outstanding Balances</h5>
                                    <p class="card-text text-muted small mb-0">Monitor patients with pending or overdue payments.</p>
                                </div>
                                <i class="bi bi-person-exclamation fs-5 text-danger"></i>
                            </div>
                            <div class="mt-3 pt-2 border-top">
                                <span class="badge bg-light text-dark">Payment Tracking</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="card report-card h-100" data-report="branch-summary" style="cursor: pointer; border-left: 4px solid #ffc107;">
                        <div class="card-body">
                            <div class="d-flex align-items-start justify-content-between mb-2">
                                <div>
                                    <h5 class="card-title fw-bold mb-1">Appointment Summary</h5>
                                    <p class="card-text text-muted small mb-0">View daily appointment statistics with detailed breakdown.</p>
                                </div>
                                <i class="bi bi-calendar-check fs-5 text-warning"></i>
                            </div>
                            <div class="mt-3 pt-2 border-top">
                                <span class="badge bg-light text-dark">Daily Metrics</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="card report-card h-100" data-report="treatment-stats" style="cursor: pointer; border-left: 4px solid #6f42c1;">
                        <div class="card-body">
                            <div class="d-flex align-items-start justify-content-between mb-2">
                                <div>
                                    <h5 class="card-title fw-bold mb-1">Treatment Statistics</h5>
                                    <p class="card-text text-muted small mb-0">Analyze treatment utilization and revenue trends.</p>
                                </div>
                                <i class="bi bi-card-list fs-5 text-secondary"></i>
                            </div>
                            <div class="mt-3 pt-2 border-top">
                                <span class="badge bg-light text-dark">Service Analysis</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="card report-card h-100" data-report="insurance-analysis" style="cursor: pointer; border-left: 4px solid #17a2b8;">
                        <div class="card-body">
                            <div class="d-flex align-items-start justify-content-between mb-2">
                                <div>
                                    <h5 class="card-title fw-bold mb-1">Insurance Coverage Analysis</h5>
                                    <p class="card-text text-muted small mb-0">Review insurance claims and coverage patterns.</p>
                                </div>
                                <i class="bi bi-shield-check fs-5 text-info"></i>
                            </div>
                            <div class="mt-3 pt-2 border-top">
                                <span class="badge bg-light text-dark">Coverage Insights</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;

        mainContent.addEventListener('click', (e) => {
            const reportCard = e.target.closest('.report-card');
            if (reportCard) {
                const reportType = reportCard.dataset.report;
                loadReportDetail(reportType);
            }
        });
    };

    const loadReportDetail = async (reportType) => {
        detailsModalLabel.textContent = 'Loading...';
        renderSpinner(detailsModalBody);
        detailsModal.show();

        switch (reportType) {
            case 'doctor-revenue':
                loadDoctorRevenueReport();
                break;
            case 'outstanding-balances':
                loadOutstandingBalancesReport();
                break;
            case 'branch-summary':
                loadBranchSummaryReport();
                break;
            case 'treatment-stats':
                loadTreatmentStatsReport();
                break;
            case 'insurance-analysis':
                loadInsuranceAnalysisReport();
                break;
        }
    };


    const loadDoctorRevenueReport = async () => {
        detailsModalLabel.textContent = 'Doctor Revenue Report';
        const data = await authorizedFetch('/api/branch-manager/reports/doctor-revenue');

        if (!data || data.length === 0) {
            detailsModalBody.innerHTML = `<p class="text-center text-muted py-5">No doctor revenue data available.</p>`;
            return;
        }

        let content = `<div class="revenue-report-container">`;
        data.forEach((doctor, index) => {
            const docKey = `doctor-${index}`;
            content += `
                <div class="card mb-3 report-card">
                    <div class="card-header bg-light d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center gap-2">
                            <h6 class="mb-0 fw-bold">${doctor.doctor_name}</h6>
                            <i class="bi bi-chevron-down toggle-icon" id="toggle-${docKey}" style="transition: transform 0.3s;"></i>
                        </div>
                        <span class="badge bg-success">Rs.${parseFloat(doctor.total_revenue || 0).toFixed(2)}</span>
                    </div>
                    <div class="card-body">
                        <div class="row text-center small">
                            <div class="col-sm-3">
                                <small class="text-muted d-block">Appointments</small>
                                <h6 class="fw-bold">${doctor.total_appointments || 0}</h6>
                            </div>
                            <div class="col-sm-3">
                                <small class="text-muted d-block">Revenue</small>
                                <h6 class="fw-bold">Rs.${parseFloat(doctor.total_revenue || 0).toFixed(2)}</h6>
                            </div>
                            <div class="col-sm-3">
                                <small class="text-muted d-block">Out-of-Pocket</small>
                                <h6 class="fw-bold">Rs.${parseFloat(doctor.out_of_pocket_revenue || 0).toFixed(2)}</h6>
                            </div>
                            <div class="col-sm-3">
                                <small class="text-muted d-block">Insurance</small>
                                <h6 class="fw-bold">Rs.${parseFloat(doctor.insurance_coverage || 0).toFixed(2)}</h6>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        content += `</div>`;
        detailsModalBody.innerHTML = content;
    };

    const loadOutstandingBalancesReport = async () => {
        detailsModalLabel.textContent = 'Outstanding Balances';
        const data = await authorizedFetch('/api/branch-manager/reports/outstanding-balances');

        if (!data || data.length === 0) {
            detailsModalBody.innerHTML = `<p class="text-center text-muted py-5">No outstanding balances.</p>`;
            return;
        }

        let content = `<div class="table-responsive"><table class="table table-hover"><thead><tr><th>Patient</th><th>Invoice ID</th><th>Amount Due</th></tr></thead><tbody>`;
        data.forEach(b => {
            content += `<tr><td>${b.patient_name}</td><td>#${b.invoice_id}</td><td>Rs.${parseFloat(b.due_amount).toFixed(2)}</td></tr>`;
        });
        content += `</tbody></table></div>`;
        detailsModalBody.innerHTML = content;
    };

    const loadBranchSummaryReport = async () => {
        detailsModalLabel.textContent = 'Appointment Summary';
        const data = await authorizedFetch('/api/branch-manager/reports/branch-summary');

        if (!data || data.length === 0) {
            detailsModalBody.innerHTML = `<p class="text-center text-muted py-5">No appointment data available.</p>`;
            return;
        }

        let content = `<div class="branch-summary-container">`;
        data.slice(0, 20).forEach((summary, index) => {
            const dateKey = `date-${index}`;
            const dateStr = new Date(summary.appointment_date).toLocaleDateString();
            content += `
                <div class="card mb-3 branch-day-card" data-date="${dateStr}" style="cursor: pointer;">
                    <div class="card-header bg-light d-flex justify-content-between align-items-center">
                        <div class="d-flex align-items-center gap-2">
                            <h6 class="mb-0 fw-bold">${dateStr}</h6>
                            <i class="bi bi-chevron-down toggle-icon" id="toggle-${dateKey}" style="transition: transform 0.3s;"></i>
                        </div>
                        <span class="badge bg-primary">${summary.total_appointments} Total</span>
                    </div>
                    <div class="card-body">
                        <div class="row text-center">
                            <div class="col-sm-4">
                                <div class="py-2">
                                    <small class="text-muted d-block">Scheduled</small>
                                    <h5 class="text-info fw-bold">${summary.scheduled}</h5>
                                </div>
                            </div>
                            <div class="col-sm-4">
                                <div class="py-2">
                                    <small class="text-muted d-block">Completed</small>
                                    <h5 class="text-success fw-bold">${summary.completed}</h5>
                                </div>
                            </div>
                            <div class="col-sm-4">
                                <div class="py-2">
                                    <small class="text-muted d-block">Cancelled</small>
                                    <h5 class="text-danger fw-bold">${summary.cancelled}</h5>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="appointment-details" id="details-${dateKey}" style="display: none;">
                        <div class="card-body border-top" id="details-body-${dateKey}">
                            <p class="text-center text-muted">Loading appointments...</p>
                        </div>
                    </div>
                </div>
            `;
        });
        content += `</div>`;
        detailsModalBody.innerHTML = content;

        document.querySelectorAll('.branch-day-card').forEach((card, index) => {
            card.addEventListener('click', async (e) => {
                const dateKey = `date-${index}`;
                const detailsDiv = document.getElementById(`details-${dateKey}`);
                const detailsBody = document.getElementById(`details-body-${dateKey}`);
                const toggleIcon = document.getElementById(`toggle-${dateKey}`);

                if (detailsDiv.style.display === 'none') {
                    const dateStr = card.dataset.date;
                    detailsBody.innerHTML = '<p class="text-center text-muted">Loading appointments...</p>';
                    detailsDiv.style.display = 'block';
                    toggleIcon.style.transform = 'rotate(180deg)';

                    const appointments = await authorizedFetch(`/api/branch-manager/appointments`);
                    if (appointments) {
                        const dateAppointments = appointments.filter(appt => {
                            const apptDate = new Date(appt.schedule_date).toLocaleDateString();
                            return apptDate === dateStr;
                        });

                        if (dateAppointments.length === 0) {
                            detailsBody.innerHTML = '<p class="text-center text-muted py-3">No appointments for this date.</p>';
                        } else {
                            let appointmentHTML = `
                                <div class="table-responsive">
                                    <table class="table table-sm mb-0">
                                        <thead>
                                            <tr>
                                                <th>Time</th>
                                                <th>Patient</th>
                                                <th>Doctor</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                            `;
                            dateAppointments.forEach(appt => {
                                const time = new Date(appt.schedule_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                                const statusColor = appt.status === 'Completed' ? 'success' : appt.status === 'Cancelled' ? 'danger' : 'info';
                                appointmentHTML += `
                                    <tr>
                                        <td><strong>${time}</strong></td>
                                        <td>${appt.patient_name}</td>
                                        <td>${appt.doctor_name}</td>
                                        <td><span class="badge bg-${statusColor}">${appt.status}</span></td>
                                    </tr>
                                `;
                            });
                            appointmentHTML += `</tbody></table></div>`;
                            detailsBody.innerHTML = appointmentHTML;
                        }
                    }
                } else {
                    detailsDiv.style.display = 'none';
                    toggleIcon.style.transform = 'rotate(0deg)';
                }
            });
        });
    };

    const loadTreatmentStatsReport = async () => {
        detailsModalLabel.textContent = 'Treatment Statistics';
        const data = await authorizedFetch('/api/branch-manager/reports/treatment-stats');

        if (!data || data.length === 0) {
            detailsModalBody.innerHTML = `<p class="text-center text-muted py-5">No treatment data available.</p>`;
            return;
        }

        const groupedByTreatment = {};
        data.forEach(item => {
            const code = item.service_code;
            if (!groupedByTreatment[code]) {
                groupedByTreatment[code] = {
                    name: item.treatment_name,
                    total_performed: 0,
                    total_revenue: 0
                };
            }
            groupedByTreatment[code].total_performed += item.times_performed || 0;
            groupedByTreatment[code].total_revenue += parseFloat(item.total_revenue || 0);
        });

        let content = `<div class="treatment-report-container">`;

        if (Object.keys(groupedByTreatment).length === 0) {
            content += `<p class="text-center text-muted py-5">No treatment data available.</p>`;
        } else {
            Object.entries(groupedByTreatment).forEach(([code, treatment]) => {
                content += `
                    <div class="card mb-3">
                        <div class="card-header bg-light d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-0 fw-bold">${treatment.name}</h6>
                                <small class="text-muted">Code: ${code}</small>
                            </div>
                            <div class="text-end">
                                <h5 class="mb-0 text-success fw-bold">Rs.${treatment.total_revenue.toFixed(2)}</h5>
                                <small class="text-muted">${treatment.total_performed} performed</small>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        content += `</div>`;
        detailsModalBody.innerHTML = content;
    };

    const loadInsuranceAnalysisReport = async () => {
        detailsModalLabel.textContent = 'Insurance Coverage Analysis';
        const data = await authorizedFetch('/api/branch-manager/reports/insurance-analysis');

        if (!data || data.length === 0) {
            detailsModalBody.innerHTML = `<p class="text-center text-muted py-5">No insurance data available.</p>`;
            return;
        }

        let content = `<div class="insurance-report-container">`;

        if (data.length === 0) {
            content += `<p class="text-center text-muted py-5">No insurance data available.</p>`;
        } else {
            data.forEach((provider) => {
                const totalBilled = parseFloat(provider.total_billed || 0);
                const insuredAmount = parseFloat(provider.total_insurance_coverage || 0);
                const outOfPocket = parseFloat(provider.total_out_of_pocket || 0);
                const coveragePercent = provider.avg_coverage_percent || 0;

                content += `
                    <div class="card mb-3">
                        <div class="card-header bg-light">
                            <div class="d-flex justify-content-between align-items-center">
                                <h6 class="mb-0 fw-bold">${provider.insurance_provider}</h6>
                                <span class="badge bg-info">${provider.total_patients || 0} Patients</span>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="row mb-3">
                                <div class="col-sm-6">
                                    <small class="text-muted d-block">Total Billed</small>
                                    <h5 class="fw-bold">Rs.${totalBilled.toFixed(2)}</h5>
                                </div>
                                <div class="col-sm-6 text-end">
                                    <small class="text-muted d-block">Coverage %</small>
                                    <h5 class="fw-bold text-success">${coveragePercent}%</h5>
                                </div>
                            </div>
                            <hr class="my-2">
                            <div class="row small">
                                <div class="col-sm-6">
                                    <span class="text-muted">Insurance Coverage: </span><strong>Rs.${insuredAmount.toFixed(2)}</strong>
                                </div>
                                <div class="col-sm-6 text-end">
                                    <span class="text-muted">Out-of-Pocket: </span><strong>Rs.${outOfPocket.toFixed(2)}</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });
        }

        content += `</div>`;
        detailsModalBody.innerHTML = content;
    };

    // --- FORM HANDLERS ---
    const openStaffForm = async (id = null) => {
        const isEditing = id !== null;
        if (isEditing) {
            const staff = await authorizedFetch(`/api/branch-manager/staff/${id}`);
            if (!staff) return;
            formModalLabel.textContent = `Edit Staff: ${staff.name}`;
            formModalBody.innerHTML = `<form id="modal-form"><div class="alert alert-secondary">Only name and contact can be changed.</div><div class="mb-3"><label>Full Name</label><input type="text" class="form-control" name="name" value="${staff.name || ''}" required></div><div class="mb-3"><label>Contact Info</label><input type="text" class="form-control" name="contact_info" value="${staff.contact_info || ''}" required></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save</button></div></form>`;
            document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); submitForm(`/api/branch-manager/staff/${id}`, "PUT", Object.fromEntries(new FormData(e.target)), loadStaffPage); };
        } else {
            const roles = await authorizedFetch('/api/list/roles');
            const specialties = await authorizedFetch('/api/list/specialties');
            const filteredRoles = roles.filter(r => !['admin', 'branch manager'].includes(r.name.toLowerCase()));
            formModalLabel.textContent = "Add New Staff to Your Branch";
            formModalBody.innerHTML = `<form id="modal-form"><input type="hidden" name="branch_id" value="${userProfile.branch_id}"><div class="row"><div class="col-md-6 mb-3"><label>Full Name</label><input type="text" name="name" class="form-control" required></div><div class="col-md-6 mb-3"><label>Contact</label><input type="text" name="contact_info" class="form-control" required></div><div class="col-md-6 mb-3"><label>Role</label><select class="form-select" name="role_id" required>${filteredRoles.map(r => `<option value="${r.role_id}">${r.name}</option>`).join('')}</select></div><div class="col-md-6 mb-3 d-none" id="specialty-container"><label>Specialties</label><div id="specialty-checkboxes" style="max-height: 150px; overflow-y: auto; border: 1px solid #dee2e6; padding: 8px; border-radius: 4px;"></div></div><div class="col-md-6 mb-3"><label>Username</label><input type="text" name="username" class="form-control" required></div><div class="col-md-6 mb-3"><label>Password</label><input type="password" name="password" class="form-control" required></div><div class="col-md-6 mb-3"><label>Email</label><input type="email" name="email" class="form-control" required></div></div><div class="form-check mb-3"><input type="checkbox" name="is_medical_staff" class="form-check-input" value="1"><label class="form-check-label">Is Medical Staff</label></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Create Staff</button></div></form>`;

            const specialtyContainer = document.getElementById('specialty-checkboxes');
            if (specialties && specialties.length > 0) {
                specialtyContainer.innerHTML = specialties.map(s => `<div class="form-check"><input type="checkbox" class="form-check-input specialty-checkbox" id="spec-${s.specialty_id}" value="${s.specialty_id}" data-specialty-name="${s.name}"><label class="form-check-label" for="spec-${s.specialty_id}">${s.name}</label></div>`).join('');
            }

            const roleSelect = formModalBody.querySelector('[name="role_id"]');
            roleSelect.onchange = e => {
                const isDoctor = e.target.selectedOptions[0].text.toLowerCase() === 'doctor';
                document.getElementById('specialty-container').classList.toggle('d-none', !isDoctor);
            };

            document.getElementById("modal-form").onsubmit = e => {
                e.preventDefault();
                const formData = new FormData(e.target);
                const data = Object.fromEntries(formData);
                const selectedSpecialties = Array.from(document.querySelectorAll('.specialty-checkbox:checked')).map(cb => parseInt(cb.value));
                if (selectedSpecialties.length > 0) {
                    data.specialty_ids = selectedSpecialties;
                }
                submitForm("/api/staff", "POST", data, loadStaffPage);
            };
        }
        formModal.show();
    };

    const openPaymentForm = async (invoiceId) => {
        formModalLabel.textContent = `Record Payment for Invoice #${invoiceId}`;
        formModalBody.innerHTML = `<form id="modal-form"><div class="mb-3"><label>Amount</label><input type="number" step="0.01" name="paid_amount" class="form-control" required></div><div class="mb-3"><label>Method</label><select name="method_of_payment" class="form-select"><option>Cash</option><option>Credit Card</option><option>Bank Transfer</option></select></div><div class="mb-3"><label>Date</label><input type="date" name="payment_date" class="form-control" value="${new Date().toISOString().split("T")[0]}" required></div><div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Record</button></div></form>`;
        formModal.show();
        document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); submitForm(`/api/branch-manager/invoices/${invoiceId}/payments`, "POST", Object.fromEntries(new FormData(e.target)), loadInvoicesPage); };
    };

    // --- ROUTING & INIT ---
    const pageLoaders = { dashboard: loadDashboard, appointments: loadAppointmentsPage, staff: loadStaffPage, invoices: loadInvoicesPage, reports: loadReportsPage };
    const navigateTo = (page) => { navLinks.forEach(link => link.classList.toggle("active", link.dataset.page === page)); (pageLoaders[page] || pageLoaders.dashboard)(); };

    document.querySelector(".sidebar").addEventListener("click", e => { const navLink = e.target.closest(".nav-link"); if (navLink) { e.preventDefault(); navigateTo(navLink.dataset.page); } });
    document.getElementById('logout-button').addEventListener('click', () => { localStorage.removeItem('clinicProToken'); window.location.href = 'index.html'; });
    // Profile & Password Change
    const profileModal = new bootstrap.Modal(document.getElementById("profileModal"));
    document.getElementById('profile-button').addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('password-change-form').reset();
        profileModal.show();
    });

    document.getElementById('password-change-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);

        if (data.newPassword !== data.confirmPassword) {
            showToast('Passwords do not match', 'danger');
            return;
        }

        const result = await authorizedFetch('/api/profile/change-password', {
            method: 'PUT',
            body: JSON.stringify({
                currentPassword: data.currentPassword,
                newPassword: data.newPassword
            })
        });

        if (result) {
            profileModal.hide();
            showToast('Password changed successfully. Please login again.', 'success');
            setTimeout(() => {
                localStorage.removeItem('clinicProToken');
                window.location.href = 'index.html';
            }, 2000);
        }
    });
    mainContent.addEventListener("click", (e) => {
        const target = e.target.closest("button[data-action]");
        if (!target) return;
        const { action, type, id } = target.dataset;

        if (action === "cancel" && type === "appointment") {
            if (confirm("Are you sure you want to cancel this appointment?")) {
                authorizedFetch(`/api/branch-manager/appointments/${id}`, { method: 'DELETE' }).then(res => {
                    if (res !== null) { showToast('Appointment cancelled.'); loadAppointmentsPage(); }
                });
            }
        }
        if (action === "edit" && type === "staff") openStaffForm(id);
        if (action === "add" && type === "staff") openStaffForm();
        if (action === "pay" && type === "invoice") openPaymentForm(id);
    });

    const initializeDashboard = async () => {
        userProfile = await authorizedFetch("/api/branch-manager/profile");
        if (userProfile) {
            document.getElementById('manager-name').textContent = userProfile.staff_name;
            document.getElementById('branch-name').textContent = userProfile.branch_name;
            navigateTo("dashboard");
        }
    };

    initializeDashboard();
});
