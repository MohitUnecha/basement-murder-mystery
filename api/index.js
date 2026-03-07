// Vercel serverless function entry point
// Loads the Express app from server/index.js
const path = require('path');
const app = require(path.join(__dirname, '..', 'server', 'index.js'));

module.exports = app;
