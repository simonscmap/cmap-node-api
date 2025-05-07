const cluster = require('cluster');

let id;

if (cluster.isMaster) {
  id = 'master';
} else if (cluster.isWorker) {
  id = cluster.worker.id;
}

module.exports = {
  id,
};
