module.exports = async (req, res) => {
  res.json({ ok: true, env: process.env.SMTP_USER ? 'set' : 'missing' });
};
