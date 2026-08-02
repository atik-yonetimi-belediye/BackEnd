const AppError = require("../utils/AppError");
const { hasPermission } = require("../services/permission.service");

function requirePermission(code) {
  return async (req, res, next) => {
    try {
      if (!req.user) return next(new AppError("Kimlik doğrulama gerekli.", 401));
      if (req.user.role === "admin") return next();
      if (!(await hasPermission(req.user.role, req.user.id, code))) {
        return next(new AppError("Bu işlem için yöneticiniz tarafından yetki verilmemiş.", 403));
      }
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

requirePermission.dynamic = (resolver) => async (req, res, next) => {
  try {
    if (!req.user) return next(new AppError("Kimlik doğrulama gerekli.", 401));
    if (req.user.role === "admin") return next();
    const code = resolver(req);
    if (!code || !(await hasPermission(req.user.role, req.user.id, code))) {
      return next(new AppError("Bu işlem için yöneticiniz tarafından yetki verilmemiş.", 403));
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = requirePermission;
