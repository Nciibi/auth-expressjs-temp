# Express.js Auth Template

A production-ready authentication & authorization server with JWT rotation, RBAC, QR code login, MFA, Google OAuth, Redis-powered registration store, and a full image processing pipeline.

## Features

**Authentication**
- JWT access/refresh token rotation with reuse detection & grace period
- Email + password registration with verification (Redis-backed store)
- Google OAuth (google-auth-library)
- TOTP Multi-Factor Authentication (MFA) setup, verify, disable, login flow
- QR code authentication via Socket.io (phone scans → PC receives tokens)
- Forgot/reset password flow with email notifications
- Account lockout after 5 failed login attempts (15 min cooldown)

**Authorization (RBAC)**
- Three roles: `ADMIN`, `DONATOR`, `ORGANIZER`
- `authorize()` middleware restricts routes by role
- `loadUser()` middleware attaches full user document per role

**Security**
- Helmet, HPP, NoSQL injection sanitization
- CORS with whitelist, httpOnly/Secure/SameSite cookies
- Rate limiting: global (100/15min), login (5/min), email (3/min)
- Zod input validation on all inputs
- Centralized error handler with severity rating (1–10) logged to file + AuditLog DB
- Account lockout, bcrypt (12 rounds), refresh token reuse hijack protection

**Image Processing**
- Deep content validation via `file-type` (not just magic bytes)
- WebP conversion with quality fallback (auto-reduces if >1MB)
- Thumbnail generation (200px) alongside full size (1600px max)
- AVIF variant generation (only when ≥15% smaller than WebP)
- Animated GIF detection and preservation
- Global SHA-256 deduplication via Redis
- EXIF/GPS metadata stripping
- Storage abstraction (swap local disk → S3 by changing one file)
- Image cleanup on user/org/donor update & delete

**Infrastructure**
- Redis for registration store (survives restarts, scales horizontally)
- Response compression (`compression`)
- Pino structured logging (error + audit log files, HTTP request logging)
- Audit log middleware (DB + file)
- Socket.io for real-time QR auth events

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js |
| Framework | Express v5 |
| Database | MongoDB via Mongoose v9 |
| Cache/Store | Redis |
| Auth | JWT, bcryptjs, otplib, google-auth-library |
| Real-time | Socket.io |
| Validation | Zod |
| Image processing | Sharp, file-type |
| Logging | Pino |
| Email | Nodemailer (Gmail SMTP) |

## Project Structure

```
├── config/                # CORS, DB, Redis connections
├── controllers/           # Route handlers (auth, admin, email, qr, campaign)
├── middleware/            # verifyJWT, authorize, loadUser, auditLog, upload, errorHandler
├── models/                # Mongoose schemas (Admin, Donator, Organizer, Campaign, etc.)
├── routes/                # Express routers
├── services/              # Business logic (email, QR, image, storage)
│   └── storage/           # Storage adapter (local disk, swappable to S3)
├── sockets/               # Socket.io init & event handlers
├── utils/                 # AppError, asyncHandler, validators, token utils, logger
├── uploads/               # Processed images (organized by date)
├── logs/                  # Error & audit log files
├── app.js                 # Express app setup
└── server.js              # Entry point (DB, Redis, HTTP, Socket.io)
```

## Setup

### Prerequisites
- Node.js v18+
- MongoDB (local or Atlas)
- Redis (local or Upstash)

### Install
```bash
npm install
```

### Environment Variables
Create `.env` in the root:

```env
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017/auth_template

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your_jwt_secret_here
REFRESH_TOKEN_SECRET=your_refresh_secret_here

# Frontend URL (CORS)
FRONTEND_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id

# Email (Gmail SMTP)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### Run
```bash
node server.js
```

No npm scripts are defined — add your own (e.g., `"start": "node server.js"`) in `package.json`.

## API Reference

### Authentication
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/register` | — | Register (multipart with optional `image`) |
| POST | `/auth/login` | — | Login with email + password |
| POST | `/auth/google-login` | — | Google OAuth login |
| POST | `/auth/logout` | Cookie | Logout, clear refresh token |
| POST | `/auth/verify-registration-email` | — | Verify registration code |
| POST | `/auth/resend-registration-verification` | — | Resend verification code |
| POST | `/auth/send-code` | — | Send email verification code |
| POST | `/auth/verify-code` | — | Verify email code |
| GET | `/auth/verification-status/:email` | — | Check verification status |

### Password Management
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/forgot-password` | — | Send reset link |
| POST | `/auth/reset-password` | — | Reset password with token |

### Token Refresh
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/refresh` | Cookie | Rotate refresh token |

### Multi-Factor Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/mfa/setup` | JWT | Generate TOTP secret & QR |
| POST | `/auth/mfa/verify` | JWT | Verify TOTP & enable MFA |
| POST | `/auth/mfa/disable` | JWT | Verify TOTP & disable MFA |
| POST | `/auth/mfa/verify-login` | — | Complete login with MFA code |

### QR Code Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth/qr/create` | — | Create QR session |
| GET | `/auth/qr/scan/:sessionId` | — | Validate session (phone) |
| POST | `/auth/qr/approve` | JWT | Approve login (phone) |
| GET | `/auth/qr/status/:sessionId` | — | Poll session status (PC) |

### User
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/user/me` | JWT | Get current user profile |

### Admin
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/admin/admin-login` | — | Admin login |
| GET | `/admin/refresh` | Cookie | Admin refresh token |
| POST | `/admin/logout` | Cookie | Admin logout |
| GET | `/admin/admin/dashboard` | ADMIN | Dashboard |
| GET | `/admin/getAllUsers` | ADMIN | All users |
| GET | `/admin/all` | ADMIN | All organizers |
| GET | `/admin/getOrganizor/:id` | ADMIN | Organizer by ID |
| PUT | `/admin/updateOrganizor/:id` | ADMIN | Update organizer (multipart with optional `image`) |
| DELETE | `/admin/deleteOrganizor/:id` | ADMIN | Delete organizer |
| GET | `/admin/getDonor/:id` | ADMIN | Donor by ID |
| PUT | `/admin/updateDonor/:id` | ADMIN | Update donor (multipart with optional `image`) |
| DELETE | `/admin/deleteDonor/:id` | ADMIN | Delete donor |
| GET | `/admin/getAllCampains` | ADMIN | All campaigns |
| GET | `/admin/getCampainById/:id` | ADMIN | Campaign by ID |
| PUT | `/admin/updateCampain/:id` | ADMIN | Update campaign (multipart) |
| DELETE | `/admin/deleteCampain/:id` | ADMIN | Delete campaign |
| GET | `/admin/getAllVerifications` | ADMIN | All verifications |
| PUT | `/admin/updateVerification/:id` | ADMIN | Approve/reject verification |
| GET | `/admin/getAllDonations` | ADMIN | All donations |
| PUT | `/admin/updateDonation/:id` | ADMIN | Update donation status |
| GET | `/admin/getAllAuditLogs` | ADMIN | All audit logs |
| DELETE | `/admin/deleteAuditLog/:id` | ADMIN | Delete audit log |

### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | — | Health check |

## Error Handling

All errors return a consistent shape:

```json
{
  "success": false,
  "message": "Human-readable message",
  "severity": "5/10"
}
```

Every error is logged to `logs/errorlogs/error.log` with its severity label (`CRITICAL`, `HIGH`, `MODERATE`, `LOW`) and written to the `AuditLog` MongoDB collection. Severity is auto-assigned by status code (500=9, 403/401=5, 400=3) or set explicitly when throwing:

```js
throw new AppError('Invalid credentials', 401); // auto → severity 5
throw new AppError('Custom', 400, 7);           // explicit severity 7
```

## Image Upload

All routes that accept images use the same middleware chain:

```
upload.single('image') → processImage → uploadErrorHandler → controller
```

The `processImage` middleware generates these variants:

| Variant | Format | Max Size | Quality |
|---------|--------|----------|---------|
| Full | WebP | 1600×1600 | 80 (auto-reduces if >1MB) |
| Thumbnail | WebP | 200×200 | 70 |
| AVIF (optional) | AVIF | 1600×1600 | 50–60 (only if ≥15% smaller) |

Results attach to `req.uploadedFile`:

```js
req.uploadedFile = {
  url: "/uploads/images/2026/07/15/hash-uuid.webp",
  thumbnailUrl: "/uploads/images/2026/07/15/hash-uuid_thumb.webp",
  hash: "sha256hex...",
  variants: { full: {...}, thumb: {...}, avif: {...} }
}
```

Old images are automatically cleaned up from disk when a user update replaces their photo, or when an organizer/donor is deleted.
