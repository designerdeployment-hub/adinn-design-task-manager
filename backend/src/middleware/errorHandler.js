function notFound(req, res) {
  res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
}

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const payload = {
    message: err.message || 'Something went wrong.'
  };

  if (process.env.NODE_ENV !== 'production') {
    payload.details = err.stack;
  }

  if (status >= 500) {
    console.error(err);
  } else if (process.env.NODE_ENV !== 'production') {
    console.warn(err.message);
  }

  res.status(status).json(payload);
}

module.exports = { notFound, errorHandler };
