const jwt = require("jsonwebtoken");
const { TokenExpiredError } = jwt;

const validateEmailVerifyToken = async (req, res, next) => {
  const { token } = req.body;
  if (!token) {
    return res.status(404).json({
      message: "Неможливо знайти токен підтвердження Email. Будь ласка, запросіть інше посилання на активацію!",
    });
  }
  jwt.verify(
    token,
    process.env.EMAIL_VERIFY_TOKEN_SECRET_KEY,
    async (err, decoded) => {
      if (err) {
        if (err instanceof TokenExpiredError) {
          return res.status(400).json({
            message:
              "Токен перевірки Email застарів. Будь ласка, запросіть ще одне посилання на активацію!",
          });
        }
      }
      if (!decoded) {
        return res.status(400).json({
          message:
            "Токен перевірки Email недійсний. Будь ласка, запросіть ще одне посилання на активацію.!",
        });
      }
      const { email } = decoded;
      req.user = { email };
      next();
    }
  );
};

module.exports = validateEmailVerifyToken;
