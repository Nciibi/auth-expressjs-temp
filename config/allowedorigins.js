// List domains that are allowed to access your API
// Leave empty strings to allow Postman/Localhost during development 
// Or fill with production URLs e.g. ["https://myapp.com"]
const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:5173",
    ""
];

module.exports = allowedOrigins;
