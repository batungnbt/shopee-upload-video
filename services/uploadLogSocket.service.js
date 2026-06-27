let webSocketServer = null;

function initUploadLogSocket(server) {
  const { WebSocketServer } = require('ws');
  webSocketServer = new WebSocketServer({
    server,
    path: '/ws/upload-logs'
  });
}

function emitUploadLog(payload) {
  if (!webSocketServer) {
    return;
  }
  const data = JSON.stringify({
    type: 'upload_log',
    payload
  });
  webSocketServer.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}

function emitUploadAccountUpdate(payload) {
  if (!webSocketServer) {
    return;
  }
  const data = JSON.stringify({
    type: 'account_upload_update',
    payload
  });
  webSocketServer.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(data);
    }
  });
}

module.exports = {
  initUploadLogSocket,
  emitUploadLog,
  emitUploadAccountUpdate
};
