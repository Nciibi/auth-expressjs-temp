const express = require('express');
const router = express.Router();
const verifyJWT = require('../middleware/verifyJWT');
const loadUser = require('../middleware/loadUser');

const protect = [verifyJWT, loadUser];
router.use(protect);
router.get('/me', (req, res) => {
    res.json(req.user);
});

module.exports = router;