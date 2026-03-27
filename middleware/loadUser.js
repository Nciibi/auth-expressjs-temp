const Admin = require('../models/admin');
const Donator = require('../models/donator');
const Organizer = require('../models/organizer');

const loadUser = async (req, res, next) => {
    try {
        if (!req.userId || !req.userRole) {
            return res.status(401).json({ success: false, message: 'Unauthorized: No user info found in request' });
        }

        let Model;
        switch (req.userRole.toUpperCase()) {
            case 'ADMIN': Model = Admin; break;
            case 'DONATOR': Model = Donator; break;
            case 'ORGANIZER': Model = Organizer; break;
            default:
                return res.status(403).json({ success: false, message: 'Forbidden: Invalid role' });
        }

        const user = await Model.findById(req.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('loadUser middleware error:', error);
        res.status(500).json({ success: false, message: 'Server error loading user' });
    }
};

module.exports = loadUser;
