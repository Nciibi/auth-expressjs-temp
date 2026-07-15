# Security & Architecture Explanations

## 1. CSRF (Cross-Site Request Forgery) Protection

### What is it?
CSRF tricks an authenticated user into executing unwanted actions on a web app where they're logged in. An attacker crafts a malicious page that submits a form or makes an AJAX request to your server — and because the browser automatically includes cookies (including httpOnly ones), the server thinks it's a legitimate request.

### Why your current setup is vulnerable
Your auth uses httpOnly cookies to store refresh tokens (`jwt` cookie). Any external site that makes a `fetch('https://your-api.com/auth/register', { credentials: 'include' })` will send that cookie automatically. If the user is logged in, the request appears legitimate.

### Why you probably don't need it (and when you do)
- **SPA + Bearer tokens (your case):** Your access tokens are sent via `Authorization: Bearer` header, not cookies. CSRF only exploits automatic cookie injection — it cannot set custom headers. So if your frontend stores the access token in memory/localStorage and sends it via header, CSRF is not an attack vector.
- **BUT:** Your refresh token is in an httpOnly cookie, and your `/refresh` endpoint accepts it from the cookie. A CSRF attack could theoretically refresh tokens without the user's knowledge. However, CSRF cannot *read* the response (same-origin policy blocks cross-origin reads), so the attacker can't steal the new tokens.
- **Mitigation without a library:** Set `SameSite=Strict` or `SameSite=Lax` on your cookie (you currently use `None` for cross-origin, which is required if frontend is on a different domain). Also require the `Authorization` header for refresh, not just the cookie.

### When to add CSRF protection
- If you use cookie-based sessions (no Bearer tokens)
- If you allow `SameSite=None` (cross-origin cookies) — which you do
- If you want defense-in-depth

### How to implement it

**Option A: `csurf` or `csrf-csrf` middleware**
```js
const { doubleCsrf } = require('csrf-csrf');
const { generateToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => process.env.CSRF_SECRET,
  cookieName: '__Host-csrf-token',
  cookieOptions: { httpOnly: true, sameSite: 'strict', secure: true }
});
// Add to app: app.use(doubleCsrfProtection);
// Client reads csrf token from cookie, sends it in X-CSRF-Token header
```

**Option B: SameSite cookies + custom headers**
Set `sameSite: 'Lax'` on cookies (safe for GET redirects, blocks POST from external forms). For truly sensitive endpoints, require a custom header like `X-Requested-By: YourAppName`.

**Option C: Origin/Referer header check (zero-dependency)**
```js
app.use((req, res, next) => {
  const origin = req.get('Origin');
  const referer = req.get('Referer');
  if (!origin && !referer) return next();
  const allowed = ['https://yourfrontend.com', 'http://localhost:5173'];
  const ok = (origin && allowed.includes(origin)) || 
             (referer && allowed.some(a => referer.startsWith(a)));
  if (!ok) return res.status(403).json({ message: 'CSRF detected' });
  next();
});
```

---

## 2. Linting (ESLint + Prettier)

### What is it?
Linting is static analysis that catches bugs, style violations, and anti-patterns *before* runtime. ESLint checks JS logic; Prettier enforces consistent formatting.

### Why you need it in this project
Your codebase has numerous issues that linting would catch immediately:
- **Typos:** `Organizor` vs `Organizer`, `campain` vs `campaign`, `donator` vs `donor` (inconsistent naming)
- **Unused variables/imports:** `bcrypt` imported in `app.js` but never used there
- **Undefined references:** `bcrypt.compare()` in `adminController.js` without importing bcrypt
- **Console.log left in production:** `app.js` line 42, `authController.js` line 131, etc.
- **Missing error handling:** Many `.catch()` chains not handled
- **Inconsistent formatting:** Mixed quotes, spacing, semicolons across files

### What would a config look like

```js
// .eslintrc.js
module.exports = {
  env: { node: true, es2022: true },
  extends: ['eslint:recommended', 'prettier'],
  rules: {
    'no-unused-vars': 'error',
    'no-undef': 'error',
    'no-console': 'warn',           // flags console.log left in code
    'camelcase': 'warn',            // enforce consistent naming
    'no-shadow': 'error',           // prevents variable shadowing bugs
    'prefer-const': 'error',        // flags unneeded let
    'require-await': 'warn',        // flags async functions without await
    'no-process-env': 'off',        // process.env is fine for Node
  },
};
```

With Prettier, you just add a `.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "all"
}
```

### The real value
Linting shifts bug discovery left — catching a typo like `Organizor` at lint-time instead of runtime. In a template meant for others to fork, it enforces consistency across all future users' code.

---

## 3. Response Compression

### What is it?
`compression` middleware (Node's `compression` package) gzip/brotli-compresses JSON responses before sending them over the wire. JSON is highly compressible — a 50KB response often becomes 5-8KB.

### Why it matters for this project
Your `/auth/login` response returns the entire `userinfo` object (potentially large). Your `/admin/getAllUsers` returns arrays of user documents. Without compression, every API response is sent at full size.

### What to add
```bash
npm install compression
```

```js
// In app.js, after helmet, before routes:
const compression = require('compression');
app.use(compression()); // Compresses all responses
```

### Downsides
- Adds ~1-5ms CPU overhead per response (negligible)
- Not useful if you're behind a reverse proxy like Nginx that already compresses (you'd double-compress)
- Brotli is better than gzip (~20% smaller) but `compression` package only supports gzip. For brotli, use `shrink-ray` or handle at the reverse-proxy level.

---

## 4. Why You Need Redis

### Current problem
`utils/registrationStore.js` stores pending registrations in a `Map`:
```js
const pendingRegistrations = new Map();
module.exports = pendingRegistrations;
```

### What breaks with in-memory storage
1. **Server restart = all pending registrations lost** — users who received a verification code but haven't verified yet will never be able to verify. They get no error, just a silent "invalid code."
2. **Doesn't scale horizontally** — two server instances behind a load balancer each have their own memory. User registers on instance A, verification request goes to instance B — code not found.
3. **Memory leak potential** — expired entries accumulate in the Map until the 10-min cleanup runs, which is `setTimeout`-based and can be unreliable under heavy load.
4. **Session data vulnerability** — the `Map` grows unbounded with concurrent registrations. A trivial DoS attack fills it with fake registrations.

### What Redis solves
Redis is an in-memory data store with automatic TTL (time-to-live). Every key auto-expires:
```js
const redis = require('redis');
const client = redis.createClient({ url: process.env.REDIS_URL });

// Store with 10-minute TTL
await client.setEx(`reg:${email}`, 600, JSON.stringify(registrationData));

// Retrieve
const data = await client.get(`reg:${email}`);
```

- **Auto-expiry:** Keys auto-delete after 10 minutes. No manual cleanup.
- **Shared across instances:** All servers read from the same Redis.
- **Persistent (optional):** Redis can snapshot to disk, so restart doesn't lose data.
- **Rate limiting:** Atomic counters make login rate limiting more precise.
- **Session/queue storage:** Can be reused for MFA temp tokens, WebSocket session mapping, email rate-limit counters, and job queues.

### Other uses in this project
- **Rate limit counters (distributed):** Currently `express-rate-limit` is per-process. With Redis as a store, rate limits are shared across all instances.
- **Socket.io adapter:** `socket.io` can use `@socket.io/redis-adapter` to broadcast events across multiple server instances.
- **Refresh token blacklist:** Instead of DB queries on every refresh, check a Redis set for revoked tokens.

### Minimal install
```bash
npm install redis
```
```js
// config/redis.js
const redis = require('redis');
const client = redis.createClient({ url: process.env.REDIS_URL });
client.on('error', (err) => console.error('Redis error:', err));
client.connect();
module.exports = client;
```

---

## 5. Centralized Error Handling

### Current problem
Every controller function has duplicated try/catch blocks. Here are **all the patterns currently in use**, each slightly different:

```js
// Pattern A (authController.js - most functions)
try {
  // ... logic
} catch (error) {
  console.error('Registration error:', error);
  return res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
}

// Pattern B (authController.js - refresh)
// No try/catch at all! Unhandled promise rejections.

// Pattern C (authController.js - resetPassword)
res.status(200).json(...)
// ^ No return keyword — execution continues past the response

// Pattern D (adminController.js)
try { ... } catch (error) {
  res.status(500).json({ success: false, message: error.message });
}
// ^ Leaks error.message to client (security risk)

// Pattern E (setupMfa)
try { ... } catch (error) {
  res.status(500).json({ message: 'MFA setup failed' });
}
// ^ Generic message, no logging at all
```

### The solution: an async error wrapper

**Step 1: Create `utils/asyncHandler.js`**
```js
// Wraps any async route handler to catch errors and pass them to Express error middleware
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
```

**Step 2: Create `utils/AppError.js` (custom error class)**
```js
class AppError extends Error {
  constructor(message, statusCode, context = {}) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distinguishes expected errors from programming bugs
    this.context = context;    // extra info for logging (userId, role, etc.)
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
```

**Step 3: Rewrite a controller like this:**
```js
// Before (18 lines, manual try/catch, console.log, magic status codes)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
    // ... 40 more lines
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// After (no try/catch, no console.log, no magic messages)
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw new AppError('Invalid credentials', 401);

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new AppError('Invalid credentials', 401);

  // ... rest of logic, throw errors instead of returning res.status...
  // On success, return normally:
  res.json({ success: true, accessToken, userinfo: user });
});
```

**Step 4: Final error handler in `app.js` becomes the single catch-all:**
```js
// Replace the final error handler with:
app.use((err, req, res, next) => {
  // Log everything in ONE place
  errorFileLogger.error({
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.userId || null,
    errorMessage: err.message,
    stack: err.stack,
    status: err.statusCode || 500,
  });

  // Log to DB asynchronously
  setImmediate(() => {
    AuditLog.create({ /* ... */ }).catch(() => {});
  });

  // Respond safely — never leak stack in production
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.isOperational ? err.message : 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});
```

### Benefits
- **Zero try/catch in controllers** — every error automatically flows to the single handler
- **Consistent responses** — every error is `{ success: false, message }` with the right status code
- **No console.log scattered everywhere** — one logging location, one format
- **No forgotten error paths** — `refresh()` has no try/catch today; this catches that
- **No information leaks** — only `isOperational` errors expose their messages; programming bugs (typos, `cannot read property of undefined`) return generic "Internal server error"
- **Easy to add monitoring** — hook Sentry/Datadog in one place, not 40 controllers

### Migration strategy
1. Create `AppError` and `asyncHandler` (5 minutes)
2. Wrap all routes in `asyncHandler` — find-and-replace, no logic changes yet (15 minutes)
3. Replace `return res.status(x).json({ success: false, message: '...' })` with `throw new AppError('...', x)` in controllers (30 minutes)
4. Remove all `catch (error) { res.status(500).json(...) }` blocks (5 minutes)
5. Verify your final error handler covers everything properly (10 minutes)

Total: about 1 hour for the entire refactor.
