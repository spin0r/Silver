const NodeCache = require('node-cache');

// 10 minutes cache (600 seconds)
const cache = new NodeCache({ stdTTL: 600 });

module.exports = cache;
