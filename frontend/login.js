// login.js

const API_BASE_URL = "https://hms-production-a5ad.up.railway.app/";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const errorMessage = document.getElementById("error-message");

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        errorMessage.classList.add('d-none');

        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "An unknown error occurred.");
            }

            const { token, role } = data;
            localStorage.setItem('clinicProToken', token);

            switch (role) {
                case 'admin':
                    window.location.href = 'index.html';
                    break;
                case 'receptionist':
                    window.location.href = 'reception.html';
                    break;
                case 'branch manager':
                    window.location.href = 'branch.html';
                    break;
                case 'doctor':
                    window.location.href = 'doctor-portal.html';
                    break;
                default:
                    errorMessage.textContent = "Your user role does not have a dashboard.";
                    errorMessage.classList.remove('d-none');
            }

        } catch (error) {
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('d-none');
        }
    });
});
