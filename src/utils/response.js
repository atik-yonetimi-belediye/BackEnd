const AppError = require("./AppError");

function successResponse(res, message, data = null, statusCode = 200) {
  const response = {
    success: true,
    message,
    data: data?.__paginated ? data.items : data,
  };

  if (data?.__paginated) {
    response.meta = { pagination: data.pagination };
  }

  return res.status(statusCode).json(response);
}

function errorResponse(res, message, statusCode = 500, errors = null) {
  throw new AppError(message, statusCode, errors);
}

module.exports = {
  successResponse,
  errorResponse,
};
