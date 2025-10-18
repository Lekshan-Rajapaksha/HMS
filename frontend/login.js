// login.js

const API_BASE_URL = "http://localhost:3000";

document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("login-form");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const errorMessage = document.getElementById("error-message");

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault(); // Prevent the form from submitting the traditional way
        errorMessage.classList.add('d-none'); // Hide previous error messages

        const username = usernameInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch(`${API_BASE_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (!response.ok) {
                // If response is not 2xx, throw an error to be caught below
                throw new Error(data.message || "An unknown error occurred.");
            }

            // --- SUCCESS ---
            // The server sends back a token and the user's role
            const { token, role } = data;

            // Save the token to localStorage. This is the key part!
            localStorage.setItem('clinicProToken', token);

            // Redirect based on the user's role
            if (role === 'admin') {
                window.location.href = 'index.html'; // Admin dashboard
            } else if (role === 'receptionist') {
                window.location.href = 'reception.html'; // Receptionist dashboard
            }
            else if (role === 'branch manager') {
                window.location.href = 'branch.html'; // Receptionist dashboard
            }
            else if (role === 'doctor') {
                window.location.href = 'doctor-portal.html'; // Receptionist dashboard
            }else {
                // Fallback for any other roles
                errorMessage.textContent = "Your user role does not have a dashboard.";
                errorMessage.classList.remove('d-none');
            }

        } catch (error) {
            // --- FAILURE ---
            // Show the error message from the server (e.g., "Invalid credentials.")
            errorMessage.textContent = error.message;
            errorMessage.classList.remove('d-none');
        }
    });
});