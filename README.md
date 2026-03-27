# Express.js Authentication & User Management Template

A robust, enterprise-ready authentication and user management system built with Express.js, Mongoose, and Socket.io. This template provides a solid foundation for applications requiring secure user registration, multi-role authorization, and advanced authentication methods like QR code login.

## 🚀 Key Features

- **JWT Authentication**: Secure access and refresh token rotation.
- **Role-Based Access Control (RBAC)**: Manage `admin`, `user`, and custom roles with dedicated middleware.
- **QR Code Authentication**: Real-time authentication using Socket.io and QR codes.
- **User Management**: Complete CRUD for profiles, including image uploads and processing.
- **Security First**:
  - **Rate Limiting**: Prevent brute-force attacks on auth routes.
  - **Input Validation**: Strict schema validation using **Zod**.
  - **Security Headers**: Integrated **Helmet** and **HPP**.
  - **Sanitization**: Protection against NoSQL injection.
- **Email System**: Built-in support for verification emails and notifications via Nodemailer.
- **Logging**: High-performance logging with **Pino** and human-readable output via `pino-pretty`.
- **File Handling**: Advanced upload middleware with **Multer** and image optimization via **Sharp**.

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js (v5+)
- **Database**: MongoDB (Mongoose)
- **Real-time**: Socket.io
- **Security**: JWT, Bcryptjs, Helmet, HPP
- **Validation**: Zod
- **Logging**: Pino
- **File Processing**: Sharp, Multer

## 📂 Project Structure

```text
├── config/             # Database, CORS, and global configurations
├── controllers/        # Business logic for auth, admin, and users
├── middleware/         # Auth, validation, upload, and security middleware
├── routes/             # API route definitions
├── services/           # External service integrations (Email, QR)
├── sockets/            # Socket.io event handlers
├── utils/              # Helper functions and validation schemas
├── uploads/            # Temporary/Static storage for processed files
├── app.js              # Express app initialization
└── server.js           # Server entry point and database connection
```

## ⚙️ Setup Instructions

### 1. Prerequisites
- Node.js (v18+)
- MongoDB (Local or Atlas)

### 2. Installation
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory and configure the following:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=your_mongodb_connection_string
ACCESS_TOKEN_SECRET=your_access_secret
REFRESH_TOKEN_SECRET=your_refresh_secret
FRONTEND_URL=http://localhost:3000

# Email Config (Nodemailer)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### 4. Running the Project
```bash
# Development mode
npm run dev

# Production mode
npm start
```

## 🛣️ API Endpoints Summary

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| POST | `/auth/register` | Register a new user | No |
| POST | `/auth/login` | Login and get tokens | No |
| POST | `/auth/logout` | Logout and clear tokens | Yes (JWT) |
| GET | `/auth/refresh` | Rotate access token | Yes (Refresh) |
| POST | `/auth/qr/generate` | Generate QR for login | No |
| GET | `/user/profile` | Get logged-in user info | Yes (JWT) |
| PUT | `/user/update` | Update user profile/avatar | Yes (JWT) |

## 🛡️ Security Best Practices
This template follows OWASP recommendations:
- Passwords are hashed with `bcryptjs`.
- JWTs are stored in `HttpOnly` cookies (for refresh) and managed via clean rotation logic.
- All inputs are validated via `validationSchemas.js` using Zod.
- Sensitive routes are protected by rate limiters to prevent DoS/Brute-force.


