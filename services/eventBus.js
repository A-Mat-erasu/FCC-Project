// In-process pub/sub. Step 6 (WebSockets) subscribes here and pushes to browsers.
const EventEmitter = require('events');
module.exports = new EventEmitter();
