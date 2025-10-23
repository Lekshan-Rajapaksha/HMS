# ClinicPro - Clinic Management System

ClinicPro is a comprehensive, multi-user Hospital Management System (HMS) designed to manage all aspects of a clinic's operations. It features a Node.js (Express) backend, a complex MySQL database, and a dynamic frontend built with HTML, CSS, and vanilla JavaScript.

The system supports multiple user roles, each with a dedicated dashboard and specific permissions.

## Key Features

* **Role-Based Access Control:** Secure JWT authentication for distinct user roles (Admin, Branch Manager, Doctor, Receptionist, Patient).
* **Multi-Branch Management:** Admins can create and manage multiple clinic branches, each with its own staff and manager.
* **Appointment Scheduling:** Receptions and patients can book appointments, which are filtered by doctor availability and branch.
* **Patient Management:** Full CRUD (Create, Read, Update, Delete) functionality for patient records, including insurance and medical history.
* **Doctor Portal:** A dedicated interface for doctors to view their daily schedule, manage their availability, and complete appointments with consultation notes.
* **Invoicing & Billing:** Receptions can generate invoices from completed appointments, apply insurance coverage, and record payments.
* **Reporting Dashboards:**
    * **Admin:** System-wide reports on revenue, branch performance, and more.
    * **Branch Manager:** Branch-specific reports on staff performance, patient arrivals, and local revenue.

## Technology Stack

* **Backend:** Node.js, Express.js
* **Database:** MySQL (Includes Triggers, Stored Procedures, and Views)
* **Frontend:** HTML5, CSS3 (Bootstrap, Custom Styles), Vanilla JavaScript
* **Authentication:** JSON Web Tokens (JWT), bcrypt for password hashing
  
## Setup and Installation

1.  **Database:**
    * Ensure you have a running MySQL server.
    * Create a database (e.g., `clinicpro_db`).
    * Import the `database.sql` file to create all tables, views, and sample data.

2.  **Backend:**
    * Navigate to the project's root directory.
    * Install dependencies: `npm install`
    * Create a `.env` file and add your database credentials and a JWT secret:
        ```env
        MYSQL_HOST=localhost
        MYSQL_USER=your_mysql_user
        MYSQL_PASSWORD=your_mysql_password
        MYSQL_DATABASE=clinicpro_db
        MYSQL_PORT=3306
        JWT_SECRET=your_super_secret_key
        ```
    * Start the server: `node server.js`
    * The API will be running on `http://localhost:3000` (or your specified port).

3.  **Frontend:**
    * Open the `frontend` folder.
    * All JavaScript files (`login.js`, `app.js`, etc.) are pre-configured to connect to the deployed API (`https://hms-production-a5ad.up.railway.app`).
    * To use your *local* server, you must change the `API_BASE_URL` variable at the top of each `.js` file from the Railway URL to `http://localhost:3000`.
    * Open `index.html` in your browser to log in.

## Default Logins

You can use the sample data from `database.sql` to log in:

| Role | Username | Password |
| --- | --- | --- |
| Admin | `lekshan` | `admin123` |
| Branch Manager | `manager_colombo` | `manager123` |
| Doctor | `dr.silva` | `doctor123` |
| Receptionist | `reception_colombo` | `reception123` |
