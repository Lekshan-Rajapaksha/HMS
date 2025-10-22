const API_BASE_URL = "https://hms-production-a5ad.up.railway.app";

document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem('clinicProToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    const appointmentsTab = document.getElementById('appointments-tab');
    const availabilityTab = document.getElementById('availability-tab');
    const tabLinks = document.querySelectorAll('.nav-tab-link');
    const availabilityGrid = document.getElementById('availability-grid');
    const saveBtn = document.getElementById('save-availability-btn');
    const resetBtn = document.getElementById('reset-availability-btn');

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const defaultStartTime = '09:00';
    const defaultEndTime = '17:00';

    let currentAvailability = {};

    const authorizedFetch = async (endpoint, options = {}) => {
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
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
                window.location.href = 'login.html';
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

    const showToast = (message, type = 'success') => {
        const toastContainer = document.querySelector('.toast-container');
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
                        <label class="mb-0" for="day-${dayOfWeek}">${dayName}</label>
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

    const loadAvailability = async () => {
        const availability = await authorizedFetch('/api/doctor/availability');

        currentAvailability = {};
        for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
            currentAvailability[dayOfWeek] = {
                dayOfWeek,
                startTime: defaultStartTime,
                endTime: defaultEndTime,
                isAvailable: true
            };
        }

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

        const result = await authorizedFetch('/api/doctor/availability', {
            method: 'POST',
            body: JSON.stringify({ availabilitySlots })
        });

        if (result) {
            showToast('Availability saved successfully!', 'success');
        }
    };

    const switchTab = (tabName) => {
        tabLinks.forEach(link => {
            if (link.dataset.tab === tabName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        if (tabName === 'appointments') {
            appointmentsTab.classList.add('active');
            appointmentsTab.style.display = 'block';
            availabilityTab.classList.remove('active');
            availabilityTab.style.display = 'none';
        } else {
            appointmentsTab.classList.remove('active');
            appointmentsTab.style.display = 'none';
            availabilityTab.classList.add('active');
            availabilityTab.style.display = 'block';
            loadAvailability();
        }
    };

    tabLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(link.dataset.tab);
        });
    });

    saveBtn.addEventListener('click', saveAvailability);

    resetBtn.addEventListener('click', () => {
        loadAvailability();
        showToast('Changes discarded', 'info');
    });

    loadAvailability();
});
