// Storage adapter — swap implementations here
// To use S3: module.exports = require('./s3Storage');
// To use Cloudinary: module.exports = require('./cloudinaryStorage');
const localStorage = require('./localStorage');

module.exports = localStorage;
