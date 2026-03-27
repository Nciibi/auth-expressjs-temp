const express = require('express');
const router = express.Router();

const { 
    createQrSession, 
    scanQrSession, 
    approveQrLogin, 
    getQrStatus 
} = require('../controllers/qrAuth.controller');

// Import your JWT protection middleware (re-using the one from your existing routes)
const verifyJWT = require('../middleware/verifyJWT');
const loadUser = require('../middleware/loadUser');

const protect = [verifyJWT, loadUser];

// ----- ROUTES -----

// 1. PC: Create session
router.post('/create', createQrSession);

// 2. Phone: Scan QR code -> Check validity (Could be public or protected depending on UI flow)
router.get('/scan/:sessionId', scanQrSession);

// 3. Phone: Approve logic -> MUST BE PROTECTED! Only logged-in phone app can approve this
const auditLog = require('../middleware/auditLog');
router.post('/approve', protect, auditLog('Approve QR Login'), approveQrLogin);

// 4. PC: Poll status (Optional fallback)
router.get('/status/:sessionId', getQrStatus);

module.exports = router;
