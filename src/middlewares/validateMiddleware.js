const AppError = require("../utils/AppError");

function formatIssues(issues) {
  return issues.map((issue) => ({
    field: issue.path.join(".") || "request",
    message: issue.message,
  }));
}

function validate(schema, source) {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(
        new AppError(
          "Gönderilen veriler geçersiz.",
          400,
          formatIssues(result.error.issues)
        )
      );
    }

    req[source] = result.data;
    return next();
  };
}

const validateBody = (schema) => validate(schema, "body");
const validateParams = (schema) => validate(schema, "params");
const validateQuery = (schema) => validate(schema, "query");

module.exports = {
  validateBody,
  validateParams,
  validateQuery,
};
