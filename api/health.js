const { sendJson } = require('./lib/response');

module.exports = async (req, res) => {
  sendJson(res, 200, { status: 'ok' });
};
