// app.js

const API_BASE_URL = "https://hms-production-a5ad.up.railway.app";

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem('clinicProToken');
    if (!token) {
        window.location.href = 'admin.html';
        return;
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

    let currentViewData = [];

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

    const submitForm = async (endpoint, method, data, callback) => {
        const filteredData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v != null && v !== ''));
        const result = await authorizedFetch(endpoint, { method, body: JSON.stringify(filteredData) });
        if (result !== null && callback) {
            formModal.hide();
            showToast(`Record has been ${method === 'POST' ? 'created' : 'updated'} successfully.`);
            callback();
        }
    };

    const deleteItem = async (endpoint, typeName, refreshCallback) => {
        if (confirm(`Are you sure you want to delete this ${typeName}?`)) {
            const result = await authorizedFetch(endpoint, { method: "DELETE" });
            if (result === null) {
                showToast(`${typeName.charAt(0).toUpperCase() + typeName.slice(1)} deleted successfully.`);
                refreshCallback();
            }
        }
    };

    const createOptions = (items, valueField, textField, selectedValue) => items.map(item => `<option value="${item[valueField]}" ${item[valueField] == selectedValue ? "selected" : ""}>${item[textField]}</option>`).join("");
    const renderSpinner = (target = mainContent) => target.innerHTML = `<div class="d-flex justify-content-center p-5"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>`;

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
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}<th>Actions</th></tr></thead>
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

    // --- RENDER FUNCTIONS ---
    const renderTable = (data, headers, rowGenerator, emptyMessage) => {
        const tableBody = document.getElementById("table-body");
        if (!data || data.length === 0) { tableBody.innerHTML = `<tr><td colspan="${headers.length + 1}" class="text-center p-5 text-muted">${emptyMessage}</td></tr>`; return; }
        tableBody.innerHTML = data.map(rowGenerator).join('');
    };

    const renderPatientsTable = data => renderTable(data, ["ID", "Name", "Age", "Contact"], p => `<tr><td>${p.patient_id}</td><td>${p.name}</td><td>${p.age}</td><td>${p.contact_info || ""}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="patient" data-id="${p.patient_id}"><i class="bi bi-pencil-fill"></i></button></td></tr>`, "No patients found.");
    const renderBranchesTable = data => renderTable(data, ["ID", "Name", "Address", "Contact"], b => `<tr><td>${b.branch_id}</td><td>${b.name}</td><td>${b.address || ''}</td><td>${b.contact_number || ''}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="branch" data-id="${b.branch_id}"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="branch" data-id="${b.branch_id}"><i class="bi bi-trash-fill"></i></button></td></tr>`, "No branches found.");
    const renderProvidersTable = data => renderTable(data, ["ID", "Name", "Contact Number"], i => `<tr><td>${i.id}</td><td>${i.name}</td><td>${i.contact_number}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="insurance-provider" data-id="${i.id}"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="insurance-provider" data-id="${i.id}"><i class="bi bi-trash-fill"></i></button></td></tr>`, "No insurance providers found.");
    const renderTreatmentsTable = data => renderTable(data, ["Code", "Name", "Price"], t => `<tr><td>${t.service_code}</td><td>${t.name}</td><td>Rs.${parseFloat(t.price).toFixed(2)}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="treatment" data-id="${t.service_code}"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="treatment" data-id="${t.service_code}"><i class="bi bi-trash-fill"></i></button></td></tr>`, "No treatments found.");
    const renderSpecialtiesTable = data => renderTable(data, ["ID", "Name", "Description"], s => `<tr><td>${s.specialty_id}</td><td>${s.name}</td><td>${s.description || ''}</td><td class="table-actions"><button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="specialty" data-id="${s.specialty_id}"><i class="bi bi-pencil-fill"></i></button><button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="specialty" data-id="${s.specialty_id}"><i class="bi bi-trash-fill"></i></button></td></tr>`, "No specialties found.");
    // [ADD THIS NEW FUNCTION]
    const renderStaffAccordions = (data) => {
        const container = document.getElementById("staff-accordion-container");
        if (!container) return;

        if (!data || data.length === 0) {
            container.innerHTML = `<div class="text-center p-5 text-muted">No staff found.</div>`;
            return;
        }

        // 1. Group by Branch
        const branches = {};
        data.forEach(staff => {
            if (!branches[staff.branch_name]) {
                branches[staff.branch_name] = [];
            }
            branches[staff.branch_name].push(staff);
        });

        let accordionHTML = '<div class="accordion" id="staff-accordion">';
        let firstBranch = true;

        // 2. Loop through branches to create accordion items
        for (const branchName in branches) {
            const staffInBranch = branches[branchName];
            const accordionId = `branch-${branchName.replace(/\s+/g, '-')}`;

            // Group staff in this branch by role
            const roles = {};
            staffInBranch.forEach(staff => {
                if (!roles[staff.role_name]) {
                    roles[staff.role_name] = [];
                }
                roles[staff.role_name].push(staff);
            });

            accordionHTML += `
            <div class="accordion-item">
                <h2 class="accordion-header" id="heading-${accordionId}">
                    <button class="accordion-button ${firstBranch ? '' : 'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-${accordionId}">
                        ${branchName} <span class="badge bg-primary ms-2">${staffInBranch.length} Staff</span>
                    </button>
                </h2>
                <div id="collapse-${accordionId}" class="accordion-collapse collapse ${firstBranch ? 'show' : ''}" data-bs-parent="#staff-accordion">
                    <div class="accordion-body">
        `;

            // 3. Loop through roles to create tables
            for (const roleName in roles) {
                const staffInRole = roles[roleName];
                accordionHTML += `<h5 class="role-subheader">${roleName}s</h5>`;
                accordionHTML += `
                <div class="table-responsive mb-3">
                    <table class="table table-sm table-hover">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Name</th>
                                <th>Contact</th>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
                // 4. Add staff members as rows
                staffInRole.forEach(s => {
                    const specialtyDisplay = s.role_name.toLowerCase() === 'doctor' && s.doctor_specialties?.length > 0
                        ? `<br><small class="text-muted">${s.doctor_specialties.map(sp => `<span class="badge bg-info">${sp}</span>`).join(' ')}</small>`
                        : '';
                    accordionHTML += `
                    <tr>
                        <td>${s.staff_id}</td>
                        <td>${s.name} ${s.is_medical_staff ? '<i class="bi bi-heart-pulse text-primary" title="Medical Staff"></i>' : ""}${specialtyDisplay}</td>
                        <td>${s.contact_info || ''}</td>
                        <td>${s.username || ''}</td>
                        <td>${s.email || ''}</td>
                        <td class="table-actions">
                            <button class="btn btn-sm btn-outline-secondary" data-action="edit" data-type="staff" data-id="${s.staff_id}"><i class="bi bi-pencil-fill"></i></button>
                            <button class="btn btn-sm btn-outline-danger" data-action="delete" data-type="staff" data-id="${s.staff_id}"><i class="bi bi-trash-fill"></i></button>
                        </td>
                    </tr>
                `;
                });

                accordionHTML += `</tbody></table></div>`;
            }

            accordionHTML += `</div></div></div>`;
            firstBranch = false;
        }

        accordionHTML += `</div>`;
        container.innerHTML = accordionHTML;
    };
    // --- PAGE LOADERS ---
    const loadDashboard = async () => {
        renderSpinner();
        const [summary, invoices, monthlyRevenue, branchRevenue] = await Promise.all([
            authorizedFetch("/api/stats/summary"),
            authorizedFetch("/api/invoices"),
            authorizedFetch("/api/stats/monthly-revenue"),
            authorizedFetch("/api/stats/branch-revenue")
        ]);
        if (!summary) { mainContent.innerHTML = `<div class="alert alert-danger">Could not load dashboard stats.</div>`; return; }

        mainContent.innerHTML = `
            <h1>Dashboard</h1>
            <div class="row">
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-people-fill fs-2 text-primary me-3"></i><div><div class="text-muted">Total Patients</div><div class="h5 fw-bold">${summary.patients}</div></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-calendar-check-fill fs-2 text-success me-3"></i><div><div class="text-muted">Scheduled Appointments</div><div class="h5 fw-bold">${summary.appointments}</div></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-heart-pulse-fill fs-2 text-info me-3"></i><div><div class="text-muted">Active Doctors</div><div class="h5 fw-bold">${summary.doctors}</div></div></div></div></div></div>
                <div class="col-xl-3 col-md-6 mb-4"><div class="card"><div class="card-body"><div class="d-flex align-items-center"><i class="bi bi-cash-stack fs-2 text-warning me-3"></i><div><div class="text-muted">Total Revenue</div><div class="h5 fw-bold">Rs.${(invoices?.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) - parseFloat(inv.due_amount)), 0) || 0).toFixed(2)}</div></div></div></div></div></div>
            </div>
            <div class="row mt-4">
                <div class="col-lg-8 mb-4">
                    <div class="card">
                        <div class="card-header bg-light">
                            <h5 class="mb-0">Monthly Revenue (Yearly)</h5>
                        </div>
                        <div class="card-body">
                            <canvas id="monthly-revenue-chart" height="80"></canvas>
                        </div>
                    </div>
                </div>
                <div class="col-lg-4 mb-4">
                    <div class="card">
                        <div class="card-header bg-light">
                            <h5 class="mb-0">Revenue by Branch</h5>
                        </div>
                        <div class="card-body d-flex justify-content-center">
                            <div style="width: 100%; max-width: 300px;">
                                <canvas id="branch-revenue-chart"></canvas>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        renderMonthlyRevenueChart(monthlyRevenue);
        renderBranchRevenueChart(branchRevenue);
    };

    const renderMonthlyRevenueChart = (data) => {
        const ctx = document.getElementById('monthly-revenue-chart');
        if (!ctx) return;

        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const revenues = new Array(12).fill(0);

        data?.forEach(item => {
            const monthIndex = parseInt(item.month.split('-')[1]) - 1;
            revenues[monthIndex] = parseFloat(item.total_revenue || 0);
        });

        new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Revenue (Rs.)',
                    data: revenues,
                    borderColor: '#6a5af9',
                    backgroundColor: 'rgba(106, 90, 249, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointBackgroundColor: '#6a5af9',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2,
                    pointHoverRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: { font: { size: 12, weight: '500' }, padding: 15 }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { callback: value => 'Rs.' + value.toFixed(2) },
                        grid: { drawBorder: false, color: 'rgba(0, 0, 0, 0.05)' }
                    },
                    x: {
                        grid: { display: false }
                    }
                }
            }
        });
    };

    const renderBranchRevenueChart = (data) => {
        const ctx = document.getElementById('branch-revenue-chart');
        if (!ctx) return;

        const branchNames = data?.map(item => item.branch_name) || [];
        const percentages = data?.map(item => parseFloat(item.percentage || 0)) || [];
        const colors = ['#6a5af9', '#28a745', '#17a2b8', '#ffc107', '#dc3545', '#fd7e14'];

        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: branchNames,
                datasets: [{
                    data: percentages,
                    backgroundColor: colors.slice(0, branchNames.length),
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 11, weight: '500' }, padding: 15 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return context.label + ': ' + context.parsed + '%';
                            }
                        }
                    }
                }
            }
        });
    };

    const loadReportsPage = () => {
        mainContent.innerHTML = `
            <h1>Reports</h1>
            <p class="text-muted">Select a report to view details and analysis.</p>
            <div class="row g-3">
                <div class="col-lg-6">
                    <div class="card report-card h-100" data-report="branch-summary" style="cursor: pointer; border-left: 4px solid #6a5af9;">
                        <div class="card-body">
                            <div class="d-flex align-items-start justify-content-between mb-2">
                                <div>
                                    <h5 class="card-title fw-bold mb-1">Branch Appointment Summary</h5>
                                    <p class="card-text text-muted small mb-0">View daily appointment statistics by branch with detailed breakdown.</p>
                                </div>
                                <i class="bi bi-building-fill fs-5 text-primary"></i>
                            </div>
                            <div class="mt-3 pt-2 border-top">
                                <span class="badge bg-light text-dark">5 Branches</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="col-lg-6">
                    <div class="card report-card h-100" data-report="doctor-revenue" style="cursor: pointer; border-left: 4px solid #28a745;">
                        <div class="card-body">
                            <div class="d-flex align-items-start justify-content-between mb-2">
                                <div>
                                    <h5 class="card-title fw-bold mb-1">Doctor Revenue Report</h5>
                                    <p class="card-text text-muted small mb-0">Track revenue generated by each doctor with specialties and payment breakdown.</p>
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
                    <div class="card report-card h-100" data-report="outstanding-patients" style="cursor: pointer; border-left: 4px solid #dc3545;">
                        <div class="card-body">
                            <div class="d-flex align-items-start justify-content-between mb-2">
                                <div>
                                    <h5 class="card-title fw-bold mb-1">Outstanding Balances</h5>
                                    <p class="card-text text-muted small mb-0">Monitor patients with pending or overdue payments with detailed balance information.</p>
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
                    <div class="card report-card h-100" data-report="treatment-stats" style="cursor: pointer; border-left: 4px solid #ffc107;">
                        <div class="card-body">
                            <div class="d-flex align-items-start justify-content-between mb-2">
                                <div>
                                    <h5 class="card-title fw-bold mb-1">Treatment Statistics</h5>
                                    <p class="card-text text-muted small mb-0">Analyze treatment utilization and revenue trends by service type and time period.</p>
                                </div>
                                <i class="bi bi-card-list fs-5 text-warning"></i>
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
                                    <p class="card-text text-muted small mb-0">Review insurance claims, coverage rates, and out-of-pocket payment patterns by provider.</p>
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
    };

    const loadAndRenderReport = async (reportName, title, headers, rowGenerator) => {
        switch (reportName) {
            case 'branch-summary':
                loadBranchSummaryReport();
                break;
            case 'doctor-revenue':
                loadDoctorRevenueReport();
                break;
            case 'outstanding-patients':
                loadOutstandingPatientsReport();
                break;
            case 'treatment-stats':
                loadTreatmentStatsReport();
                break;
            case 'insurance-analysis':
                loadInsuranceAnalysisReport();
                break;
            default:
                detailsModalLabel.textContent = title;
                renderSpinner(detailsModalBody);
                detailsModal.show();
                const data = await authorizedFetch(`/api/reports/${reportName}`);
                if (data) {
                    detailsModalBody.innerHTML = `<div class="table-responsive"><table class="table"><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${data.map(rowGenerator).join('')}</tbody></table></div>`;
                } else {
                    detailsModalBody.innerHTML = `<p class="text-center p-4">Could not load report data.</p>`;
                }
        }
    };

    const loadBranchSummaryReport = async () => {
        detailsModalLabel.textContent = 'Branch Appointment Summary';
        renderSpinner(detailsModalBody);
        detailsModal.show();

        const [reportData, branches] = await Promise.all([
            authorizedFetch('/api/reports/branch-summary'),
            authorizedFetch('/api/list/branches')
        ]);

        if (!reportData || !branches) {
            detailsModalBody.innerHTML = `<p class="text-center p-4">Could not load report data.</p>`;
            return;
        }

        const selectedBranch = branches.length > 0 ? branches[0].branch_id : null;
        renderBranchSummaryContent(reportData, branches, selectedBranch);
    };

    const renderBranchSummaryContent = (allData, branches, selectedBranchId) => {
        const filteredData = allData.filter(item => item.branch_id == selectedBranchId);
        const selectedBranchName = branches.find(b => b.branch_id == selectedBranchId)?.name || 'Unknown';

        const groupedByDate = {};
        filteredData.forEach(item => {
            const date = new Date(item.appointment_date).toLocaleDateString();
            if (!groupedByDate[date]) {
                groupedByDate[date] = { total: 0, scheduled: 0, completed: 0, cancelled: 0, rawDate: item.appointment_date };
            }
            groupedByDate[date].total += item.total_appointments;
            groupedByDate[date].scheduled += item.scheduled;
            groupedByDate[date].completed += item.completed;
            groupedByDate[date].cancelled += item.cancelled;
        });

        const branchOptions = branches.map(b => `<option value="${b.branch_id}" ${b.branch_id == selectedBranchId ? 'selected' : ''}>${b.name}</option>`).join('');

        let content = `
            <div class="mb-4">
                <label class="form-label fw-bold">Select Branch:</label>
                <select id="branch-selector" class="form-select">
                    ${branchOptions}
                </select>
            </div>
            <div class="branch-summary-container">
        `;

        if (Object.keys(groupedByDate).length === 0) {
            content += `<p class="text-center text-muted py-5">No appointments for this branch.</p>`;
        } else {
            const sortedDates = Object.keys(groupedByDate).sort((a, b) => new Date(groupedByDate[b].rawDate) - new Date(groupedByDate[a].rawDate));
            sortedDates.forEach((date, index) => {
                const stats = groupedByDate[date];
                const dateKey = `date-${index}`;
                content += `
                    <div class="card mb-3 branch-day-card" data-date="${date}" style="cursor: pointer;">
                        <div class="card-header bg-light d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center gap-2">
                                <h6 class="mb-0 fw-bold">${date}</h6>
                                <i class="bi bi-chevron-down toggle-icon" id="toggle-${dateKey}"></i>
                            </div>
                            <span class="badge bg-primary">${stats.total} Total</span>
                        </div>
                        <div class="card-body">
                            <div class="row text-center">
                                <div class="col-sm-4">
                                    <div class="py-2">
                                        <small class="text-muted d-block">Scheduled</small>
                                        <h5 class="text-info fw-bold">${stats.scheduled}</h5>
                                    </div>
                                </div>
                                <div class="col-sm-4">
                                    <div class="py-2">
                                        <small class="text-muted d-block">Completed</small>
                                        <h5 class="text-success fw-bold">${stats.completed}</h5>
                                    </div>
                                </div>
                                <div class="col-sm-4">
                                    <div class="py-2">
                                        <small class="text-muted d-block">Cancelled</small>
                                        <h5 class="text-danger fw-bold">${stats.cancelled}</h5>
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
        }

        content += `</div>`;
        detailsModalBody.innerHTML = content;

        document.getElementById('branch-selector').addEventListener('change', (e) => {
            renderBranchSummaryContent(allData, branches, e.target.value);
        });

        document.querySelectorAll('.branch-day-card').forEach((card, index) => {
            card.addEventListener('click', async (e) => {
                const dateKey = `date-${index}`;
                const detailsDiv = document.getElementById(`details-${dateKey}`);
                const detailsBody = document.getElementById(`details-body-${dateKey}`);
                const toggleIcon = document.getElementById(`toggle-${dateKey}`);

                if (detailsDiv.style.display === 'none') {
                    const date = card.dataset.date;
                    detailsBody.innerHTML = '<p class="text-center text-muted">Loading appointments...</p>';
                    detailsDiv.style.display = 'block';
                    toggleIcon.style.transform = 'rotate(180deg)';

                    const appointments = await authorizedFetch(`/api/appointments`);
                    if (appointments) {
                        const dateAppointments = appointments.filter(appt => {
                            const apptDate = new Date(appt.schedule_date).toLocaleDateString();
                            return apptDate === date && appt.branch_id == selectedBranchId;
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

    const loadDoctorRevenueReport = async () => {
        detailsModalLabel.textContent = 'Doctor Revenue Report';
        renderSpinner(detailsModalBody);
        detailsModal.show();

        const data = await authorizedFetch('/api/reports/doctor-revenue');
        if (!data) {
            detailsModalBody.innerHTML = `<p class="text-center p-4">Could not load report data.</p>`;
            return;
        }

        let content = `<div class="revenue-report-container">`;

        if (data.length === 0) {
            content += `<p class="text-center text-muted py-5">No doctor revenue data available.</p>`;
        } else {
            data.forEach((doctor, index) => {
                const docKey = `doctor-${index}`;
                content += `
                    <div class="card mb-3 report-card" data-doctor="${doctor.doctor_id}" style="cursor: pointer;">
                        <div class="card-header bg-light d-flex justify-content-between align-items-center">
                            <div class="d-flex align-items-center gap-2">
                                <h6 class="mb-0 fw-bold">${doctor.doctor_name}</h6>
                                <span class="badge bg-secondary">${doctor.specialty || 'No Specialty'}</span>
                                <i class="bi bi-chevron-down toggle-icon" id="toggle-${docKey}"></i>
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
                                    <small class="text-muted d-block">Insured Revenue</small>
                                    <h6 class="fw-bold">Rs.${parseFloat(doctor.insurance_coverage || 0).toFixed(2)}</h6>
                                </div>
                                <div class="col-sm-3">
                                    <small class="text-muted d-block">Out-of-Pocket</small>
                                    <h6 class="fw-bold">Rs.${parseFloat(doctor.out_of_pocket_revenue || 0).toFixed(2)}</h6>
                                </div>
                                <div class="col-sm-3">
                                    <small class="text-muted d-block">Outstanding</small>
                                    <h6 class="fw-bold text-warning">Rs.${parseFloat(doctor.outstanding_balance || 0).toFixed(2)}</h6>
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

    const loadOutstandingPatientsReport = async () => {
        detailsModalLabel.textContent = 'Patients with Outstanding Balances';
        renderSpinner(detailsModalBody);
        detailsModal.show();

        const data = await authorizedFetch('/api/reports/outstanding-patients');
        if (!data) {
            detailsModalBody.innerHTML = `<p class="text-center p-4">Could not load report data.</p>`;
            return;
        }

        let content = `<div class="outstanding-report-container">`;

        if (data.length === 0) {
            content += `<p class="text-center text-muted py-5">No patients with outstanding balances.</p>`;
        } else {
            const sortedData = [...data].sort((a, b) => new Date(b.latest_due_date) - new Date(a.latest_due_date));
            sortedData.forEach((patient, index) => {
                const patKey = `patient-${index}`;
                const statusBadge = patient.payment_status === 'Overdue' ? `<span class="badge bg-danger">Overdue</span>` : `<span class="badge bg-warning">Pending</span>`;
                content += `
                    <div class="card mb-3">
                        <div class="card-header bg-light d-flex justify-content-between align-items-center">
                            <div>
                                <h6 class="mb-0 fw-bold">${patient.patient_name}</h6>
                                <small class="text-muted">${patient.contact_info}</small>
                            </div>
                            <div class="text-end">
                                ${statusBadge}
                                <div class="mt-2">
                                    <h5 class="mb-0 text-danger fw-bold">Rs.${parseFloat(patient.total_outstanding).toFixed(2)}</h5>
                                    <small class="text-muted">Due: ${new Date(patient.latest_due_date).toLocaleDateString()}</small>
                                </div>
                            </div>
                        </div>
                        <div class="card-body small">
                            <div class="row">
                                <div class="col-sm-4">
                                    <span class="text-muted">Total Invoices: </span><strong>${patient.total_invoices}</strong>
                                </div>
                                <div class="col-sm-4">
                                    <span class="text-muted">Total Billed: </span><strong>Rs.${parseFloat(patient.total_billed).toFixed(2)}</strong>
                                </div>
                                <div class="col-sm-4">
                                    <span class="text-muted">Outstanding: </span><strong class="text-danger">Rs.${parseFloat(patient.total_outstanding).toFixed(2)}</strong>
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

    const loadTreatmentStatsReport = async () => {
        detailsModalLabel.textContent = 'Treatment Statistics';
        renderSpinner(detailsModalBody);
        detailsModal.show();

        const data = await authorizedFetch('/api/reports/treatment-stats');
        if (!data) {
            detailsModalBody.innerHTML = `<p class="text-center p-4">Could not load report data.</p>`;
            return;
        }

        const groupedByTreatment = {};
        data.forEach(item => {
            const code = item.service_code;
            if (!groupedByTreatment[code]) {
                groupedByTreatment[code] = {
                    name: item.treatment_name,
                    total_performed: 0,
                    total_revenue: 0,
                    months: []
                };
            }
            groupedByTreatment[code].total_performed += item.times_performed || 0;
            groupedByTreatment[code].total_revenue += parseFloat(item.total_revenue || 0);
            groupedByTreatment[code].months.push({ month: item.month, performed: item.times_performed || 0, revenue: item.total_revenue || 0 });
        });

        let content = `<div class="treatment-report-container">`;

        if (Object.keys(groupedByTreatment).length === 0) {
            content += `<p class="text-center text-muted py-5">No treatment data available.</p>`;
        } else {
            Object.entries(groupedByTreatment).forEach(([code, treatment], index) => {
                const treatKey = `treatment-${index}`;
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
                        <div class="card-body small">
                            <div class="table-responsive">
                                <table class="table table-sm mb-0">
                                    <thead class="table-light">
                                        <tr><th>Month</th><th class="text-end">Times Performed</th><th class="text-end">Revenue</th></tr>
                                    </thead>
                                    <tbody>
                                        ${treatment.months.map(m => `<tr><td>${m.month || 'N/A'}</td><td class="text-end">${m.performed}</td><td class="text-end">Rs.${parseFloat(m.revenue).toFixed(2)}</td></tr>`).join('')}
                                    </tbody>
                                </table>
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
        renderSpinner(detailsModalBody);
        detailsModal.show();

        const data = await authorizedFetch('/api/reports/insurance-analysis');
        if (!data) {
            detailsModalBody.innerHTML = `<p class="text-center p-4">Could not load report data.</p>`;
            return;
        }

        let content = `<div class="insurance-report-container">`;

        if (data.length === 0) {
            content += `<p class="text-center text-muted py-5">No insurance data available.</p>`;
        } else {
            data.forEach((provider, index) => {
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

    const loadPatientsPage = async () => { createPageTemplate({ title: "Patients", type: "patient", headers: ["ID", "Name", "Age", "Contact"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/patients"); renderPatientsTable(currentViewData); setupSearch(renderPatientsTable, ['patient_id', 'name', 'contact_info']); };
    const loadBranchesPage = async () => { createPageTemplate({ title: "Branches", type: "branch", headers: ["ID", "Name", "Address", "Contact"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/branches"); renderBranchesTable(currentViewData); setupSearch(renderBranchesTable, ['branch_id', 'name', 'address']); };
    const loadInsuranceProvidersPage = async () => { createPageTemplate({ title: "Insurance Providers", type: "insurance-provider", headers: ["ID", "Name", "Contact"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/insurance-providers"); renderProvidersTable(currentViewData); setupSearch(renderProvidersTable, ['id', 'name']); };
    const loadTreatmentsPage = async () => { createPageTemplate({ title: "Treatment Catalogue", type: "treatment", headers: ["Code", "Name", "Price"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/treatments"); renderTreatmentsTable(currentViewData); setupSearch(renderTreatmentsTable, ['service_code', 'name']); };
    const loadSpecialtiesPage = async () => { createPageTemplate({ title: "Doctor Specialties", type: "specialty", headers: ["ID", "Name", "Description"] }); renderSpinner(document.getElementById('table-body')); currentViewData = await authorizedFetch("/api/specialties"); renderSpecialtiesTable(currentViewData); setupSearch(renderSpecialtiesTable, ['name', 'description']); };
    // [WITH THIS]
    const loadStaffPage = async () => {
        // 1. Manually create the page structure (no createPageTemplate)
        mainContent.innerHTML = `
        <div class="page-header">
            <h1>Staff Management</h1>
            <div class="d-flex align-items-center gap-2">
                <div class="search-wrapper">
                    <input type="search" id="search-input" class="form-control" placeholder="Search staff...">
                </div>
                <button class="btn btn-primary" data-action="add" data-type="staff">
                    <i class="bi bi-plus-lg me-1"></i> Add Staff
                </button>
            </div>
        </div>
        <div class="card">
            <div class="card-body">
                <div id="staff-accordion-container"></div>
            </div>
        </div>
    `;

        // 2. Show spinner, fetch data
        const container = document.getElementById("staff-accordion-container");
        renderSpinner(container);
        currentViewData = await authorizedFetch("/api/staff");

        // 3. Render the accordion
        renderStaffAccordions(currentViewData);

        // 4. Setup search
        setupSearch(renderStaffAccordions, ['name', 'role_name', 'branch_name', 'username', 'email']);
    };
    // --- FORM HANDLERS ---
    const openPatientForm = async (id = null) => {
        const isEditing = id !== null;
        const [patient, providers] = await Promise.all([isEditing ? authorizedFetch(`/api/patients/${id}`) : Promise.resolve({}), authorizedFetch("/api/list/insurance-providers")]);
        formModalLabel.textContent = isEditing ? "Edit Patient" : "Add Patient";
        formModalBody.innerHTML = `<form id="modal-form">
            <div class="row"><div class="col-md-6 mb-3"><label class="form-label">Name</label><input type="text" class="form-control" name="name" value="${patient.name || ""}" required></div><div class="col-md-6 mb-3"><label class="form-label">Gender</label><select class="form-select" name="gender"><option value="Male" ${patient.gender === "Male" ? "selected" : ""}>Male</option><option value="Female" ${patient.gender === "Female" ? "selected" : ""}>Female</option></select></div><div class="col-md-6 mb-3"><label class="form-label">Date of Birth</label><input type="date" class="form-control" name="date_of_birth" value="${patient.date_of_birth?.split("T")[0] || ""}" required></div><div class="col-md-6 mb-3"><label class="form-label">Contact</label><input type="text" class="form-control" name="contact_info" value="${patient.contact_info || ""}"></div></div><hr><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Insurance Provider</label><select class="form-select" name="insurance_provider_id"><option value="">None</option>${createOptions(providers, "id", "name", patient.insurance_provider_id)}</select></div><div class="col-md-6 mb-3"><label class="form-label">Policy Number</label><input type="text" class="form-control" name="policy_number" value="${patient.policy_number || ""}"></div></div>
            <div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save</button></div></form>`;
        formModal.show();
        document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); submitForm(isEditing ? `/api/patients/${id}` : "/api/patients", isEditing ? "PUT" : "POST", Object.fromEntries(new FormData(e.target)), loadPatientsPage); };
    };

    const openBranchForm = async (id = null) => {
        const isEditing = id !== null;
        if (isEditing) {
            const [data, managers] = await Promise.all([authorizedFetch(`/api/branches/${id}`), authorizedFetch(`/api/staff/managers`)]);
            formModalLabel.textContent = "Edit Branch";
            formModalBody.innerHTML = `<form id="modal-form"><div class="mb-3"><label class="form-label">Name</label><input type="text" class="form-control" name="name" value="${data.name || ''}" required></div><div class="mb-3"><label class="form-label">Address</label><input type="text" class="form-control" name="address" value="${data.address || ''}"></div><div class="mb-3"><label class="form-label">Contact Number</label><input type="text" class="form-control" name="contact_number" value="${data.contact_number || ''}"></div><hr><div class="mb-3"><label class="form-label">Branch Manager</label><select class="form-select" name="manager_user_id"><option value="">No Manager</option>${createOptions(managers, "user_id", "name", data.manager_user_id)}</select></div><div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save Changes</button></div></form>`;
            document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); submitForm(`/api/branches/${id}`, "PUT", Object.fromEntries(new FormData(e.target)), loadBranchesPage); };
        } else {
            formModalLabel.textContent = "Add New Branch";
            formModalBody.innerHTML = `<form id="modal-form"><h5>Branch Details</h5><div class="row"><div class="col-md-12 mb-3"><label class="form-label">Branch Name</label><input type="text" class="form-control" name="name" required></div><div class="col-md-6 mb-3"><label class="form-label">Address</label><input type="text" class="form-control" name="address"></div><div class="col-md-6 mb-3"><label class="form-label">Contact</label><input type="text" class="form-control" name="contact_number"></div></div><hr><h5>Branch Manager Details</h5><p class="text-muted small">Creates a new staff account for the manager.</p><div class="row"><div class="col-md-6 mb-3"><label class="form-label">Manager Name</label><input type="text" class="form-control" name="manager_name" required></div><div class="col-md-6 mb-3"><label class="form-label">Manager Contact</label><input type="text" class="form-control" name="manager_contact_info" required></div><div class="col-md-6 mb-3"><label class="form-label">Username</label><input type="text" class="form-control" name="manager_username" required></div><div class="col-md-6 mb-3"><label class="form-label">Email</label><input type="email" class="form-control" name="manager_email" required></div><div class="col-md-6 mb-3"><label class="form-label">Password</label><input type="password" class="form-control" name="manager_password" required></div></div><div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Create</button></div></form>`;
            document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); submitForm("/api/branches", "POST", Object.fromEntries(new FormData(e.target)), loadBranchesPage); };
        }
        formModal.show();
    };

    // [New openStaffForm function]
    const openStaffForm = async (id = null) => {
        const isEditing = id !== null;

        // Fetch all required lists and existing staff data (if editing)
        const [roles, branches, specialties, staffData] = await Promise.all([
            authorizedFetch("/api/list/roles"),
            authorizedFetch("/api/list/branches"),
            authorizedFetch("/api/list/specialties"),
            isEditing ? authorizedFetch(`/api/staff/${id}`) : Promise.resolve({})
        ]);

        // Check if fetching data failed
        if (isEditing && !staffData) {
            showToast('Could not fetch staff details.', 'danger');
            return;
        }

        formModalLabel.textContent = isEditing ? `Edit Staff: ${staffData.name}` : "Add New Staff";

        formModalBody.innerHTML = `<form id="modal-form">
            <div class="row">
                <h5>Staff Details</h5>
                <div class="col-md-6 mb-3"><label>Full Name</label><input type="text" name="name" class="form-control" value="${staffData.name || ''}" required></div>
                <div class="col-md-6 mb-3"><label>Contact Info</label><input type="text" name="contact_info" class="form-control" value="${staffData.contact_info || ''}" required></div>
                <div class="col-md-6 mb-3"><label>Branch</label><select name="branch_id" class="form-select" required>${createOptions(branches, "branch_id", "name", staffData.branch_id)}</select></div>
                <div class="col-md-6 mb-3 pt-3 form-check"><input type="checkbox" name="is_medical_staff" class="form-check-input" value="1" ${staffData.is_medical_staff ? 'checked' : ''}><label class="form-check-label">Is Medical Staff</label></div>
            </div>
            <hr>
            <h5>Account Details</h5>
            <div class="row">
                <div class="col-md-6 mb-3"><label>Username</label><input type="text" name="username" class="form-control" value="${staffData.username || ''}" required></div>
                <div class="col-md-6 mb-3"><label>Email</label><input type="email" name="email" class="form-control" value="${staffData.email || ''}" required></div>
                <div class="col-md-6 mb-3"><label>Role</label><select name="role_id" class="form-select" required>${createOptions(roles, "role_id", "name", staffData.role_id)}</select></div>
                <div class="col-md-6 mb-3 d-none" id="specialty-container"><label>Specialties</label><div id="specialty-checkboxes" class="border rounded p-2" style="max-height: 200px; overflow-y: auto;">${specialties?.map(s => `<div class="form-check"><input type="checkbox" class="form-check-input specialty-checkbox" name="specialties" value="${s.specialty_id}" id="spec-${s.specialty_id}" ${staffData.doctor_specialties?.includes(s.specialty_id) ? 'checked' : ''}><label class="form-check-label" for="spec-${s.specialty_id}">${s.name}</label></div>`).join('')}</div></div>
                <div class="col-md-6 mb-3"><label>Password</label><input type="password" name="password" class="form-control" placeholder="${isEditing ? 'Leave blank to keep unchanged' : ''}" ${!isEditing ? 'required' : ''}></div>
            </div>
            <div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save</button></div>
        </form>`;

        formModal.show();

        const roleSelect = formModalBody.querySelector('[name="role_id"]');
        const specialtyContainer = document.getElementById('specialty-container');

        // Function to show/hide specialty dropdown based on role
        const toggleSpecialty = () => {
            const selectedRoleText = roleSelect.options[roleSelect.selectedIndex]?.text.toLowerCase();
            specialtyContainer.classList.toggle('d-none', selectedRoleText !== 'doctor');
        };

        roleSelect.onchange = toggleSpecialty;
        toggleSpecialty(); // Run on form load

        // Handle form submission
        document.getElementById("modal-form").onsubmit = e => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);

            // Handle multiple specialties for doctors
            const specialtyCheckboxes = document.querySelectorAll('.specialty-checkbox:checked');
            if (specialtyCheckboxes.length > 0) {
                data.specialties = Array.from(specialtyCheckboxes).map(cb => cb.value);
            }

            // On edit, if password field is empty, don't send it
            if (isEditing && !data.password) {
                delete data.password;
            }

            submitForm(
                isEditing ? `/api/staff/${id}` : "/api/staff",
                isEditing ? "PUT" : "POST",
                data,
                loadStaffPage
            );
        };
    };
    const openSimpleForm = async (type, id = null) => {
        const isEditing = id !== null;
        const data = isEditing ? await authorizedFetch(`/api/${type}s/${id}`) : {};
        const title = `${isEditing ? 'Edit' : 'Add'} ${type.replace('-', ' ')}`;
        let formFields;
        switch (type) {
            case 'insurance-provider': formFields = `<div class="mb-3"><label>Name</label><input type="text" class="form-control" name="name" value="${data.name || ''}" required></div><div class="mb-3"><label>Contact</label><input type="text" class="form-control" name="contact_number" value="${data.contact_number || ''}"></div>`; break;
            case 'treatment': formFields = `<div class="row"><div class="col-md-6 mb-3"><label>Service Code</label><input type="text" class="form-control" name="service_code" value="${data.service_code || ''}" ${isEditing ? 'readonly' : 'required'}></div><div class="col-md-6 mb-3"><label>Name</label><input type="text" class="form-control" name="name" value="${data.name || ''}" required></div></div><div class="mb-3"><label>Price</label><input type="number" step="0.01" class="form-control" name="price" value="${data.price || ''}" required></div><div class="mb-3"><label>Description</label><textarea class="form-control" name="description">${data.description || ''}</textarea></div>`; break;
            case 'specialty': formFields = `<div class="mb-3"><label>Name</label><input type="text" class="form-control" name="name" value="${data.name || ''}" required></div><div class="mb-3"><label>Description</label><textarea class="form-control" name="description">${data.description || ''}</textarea></div>`; break;
        }
        formModalLabel.textContent = title;
        formModalBody.innerHTML = `<form id="modal-form">${formFields}<div class="modal-footer mt-4"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button><button type="submit" class="btn btn-primary">Save</button></div></form>`;
        formModal.show();
        const endpoint = isEditing ? `/api/${type}s/${id}` : `/api/${type}s`;
        const loader = pageLoaders[type + 's'];
        document.getElementById("modal-form").onsubmit = e => { e.preventDefault(); submitForm(endpoint, isEditing ? 'PUT' : 'POST', Object.fromEntries(new FormData(e.target)), loader); };
    };

    // --- ROUTING & EVENT LISTENERS ---
    const pageLoaders = { dashboard: loadDashboard, reports: loadReportsPage, patients: loadPatientsPage, staff: loadStaffPage, branches: loadBranchesPage, "insurance-providers": loadInsuranceProvidersPage, treatments: loadTreatmentsPage, specialties: loadSpecialtiesPage };
    const navigateTo = (page) => { navLinks.forEach(link => link.classList.toggle("active", link.dataset.page === page)); (pageLoaders[page] || pageLoaders.dashboard)(); };
    document.querySelector(".sidebar").addEventListener("click", e => { const navLink = e.target.closest(".nav-link"); if (navLink) { e.preventDefault(); navigateTo(navLink.dataset.page); } });
    document.getElementById('logout-button').addEventListener('click', () => { localStorage.removeItem('clinicProToken'); window.location.href = 'login.html'; });

    mainContent.addEventListener("click", (e) => {
        const actionTarget = e.target.closest("[data-action]");
        const reportTarget = e.target.closest("[data-report]");
        if (reportTarget) {
            e.preventDefault();
            const reportName = reportTarget.dataset.report;
            const reportConfig = {
                'branch-summary': { title: 'Branch Summary', headers: ['Branch', 'Date', 'Total', 'Scheduled', 'Completed', 'Cancelled'], generator: r => `<tr><td>${r.branch_name}</td><td>${new Date(r.appointment_date).toLocaleDateString()}</td><td>${r.total_appointments}</td><td>${r.scheduled}</td><td>${r.completed}</td><td>${r.cancelled}</td></tr>` },
                'doctor-revenue': { title: 'Doctor Revenue', headers: ['Doctor', 'Specialty', 'Appointments', 'Total Revenue'], generator: r => `<tr><td>${r.doctor_name}</td><td>${r.specialty}</td><td>${r.total_appointments}</td><td>Rs.${parseFloat(r.total_revenue || 0).toFixed(2)}</td></tr>` },
                'outstanding-patients': { title: 'Outstanding Balances', headers: ['Patient', 'Contact', 'Total Billed', 'Total Outstanding'], generator: r => `<tr><td>${r.patient_name}</td><td>${r.contact_info}</td><td>Rs.${parseFloat(r.total_billed).toFixed(2)}</td><td>Rs.${parseFloat(r.total_outstanding).toFixed(2)}</td></tr>` },
                'treatment-stats': { title: 'Treatment Statistics', headers: ['Treatment', 'Month', 'Times Performed', 'Total Revenue'], generator: r => `<tr><td>${r.treatment_name}</td><td>${r.month}</td><td>${r.times_performed}</td><td>Rs.${parseFloat(r.total_revenue).toFixed(2)}</td></tr>` },
                'insurance-analysis': { title: 'Insurance Analysis', headers: ['Provider', 'Patients', 'Total Billed', 'Total Covered'], generator: r => `<tr><td>${r.insurance_provider}</td><td>${r.total_patients}</td><td>Rs.${parseFloat(r.total_billed).toFixed(2)}</td><td>Rs.${parseFloat(r.total_insurance_coverage).toFixed(2)} (${r.avg_coverage_percent}%)</td></tr>` },
            };
            loadAndRenderReport(reportName, reportConfig[reportName].title, reportConfig[reportName].headers, reportConfig[reportName].generator);
        }
        if (!actionTarget) return;

        const { action, type, id } = actionTarget.dataset;
        const entityMap = {
            patient: { handler: openPatientForm },
            staff: { handler: openStaffForm },
            branch: { handler: openBranchForm },
            'insurance-provider': { handler: openSimpleForm.bind(null, 'insurance-provider') },
            treatment: { handler: openSimpleForm.bind(null, 'treatment') },
            specialty: { handler: openSimpleForm.bind(null, 'specialty') }
        };

        if (action === "add" || action === "edit") {
            entityMap[type]?.handler(id);
        }
        if (action === "delete") {
            const deleteMap = {
                'staff': { endpoint: `/api/staff/${id}`, name: 'staff member', callback: loadStaffPage },
                'branch': { endpoint: `/api/branches/${id}`, name: 'branch', callback: loadBranchesPage },
                'insurance-provider': { endpoint: `/api/insurance-providers/${id}`, name: 'insurance provider', callback: loadInsuranceProvidersPage },
                'treatment': { endpoint: `/api/treatments/${id}`, name: 'treatment', callback: loadTreatmentsPage },
                'specialty': { endpoint: `/api/specialties/${id}`, name: 'specialty', callback: loadSpecialtiesPage }
            };
            const deleteConfig = deleteMap[type];
            if (deleteConfig) {
                deleteItem(deleteConfig.endpoint, deleteConfig.name, deleteConfig.callback);
            }
        }
    });

    navigateTo("dashboard");
});
