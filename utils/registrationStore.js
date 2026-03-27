// In-memory store for pending registrations
// Note: In production, consider using Redis or a proper database
const pendingRegistrations = new Map();
module.exports = pendingRegistrations;
