// Centralized error handler middleware
module.exports = (err, req, res, next) => {
  console.error('Unhandled error middleware:', err && err.stack ? err.stack : err);
  const payload = { error: true, message: 'Internal server error' };
  if (process.env.NODE_ENV === 'development') payload.details = err && err.message ? String(err.message) : String(err);
  res.status(500).json(payload);
};
