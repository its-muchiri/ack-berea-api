module.exports = async (req, res) => {
  res.json({ status: 'ok', env: process.env.ENV || 'development' });
};
