const jwt = require("jsonwebtoken");
const { TokenExpiredError } = jwt;

const validatePasswordResetToken = async (req, res, next) => {
  const { token } = req.body;
  if (!token) {
    return res.status(404).json({
      message: "Токен для відновлення паролю не знайдено!",
    });
  }
  console.log(token);
  jwt.verify(
    token,
    process.env.RESET_PASSWORD_TOKEN_SECRET_KEY,
    async (err, decoded) => {
      if (err) {
        if (err instanceof TokenExpiredError) {
          return res.status(400).json({
            message:
              "Токен для відновлення паролю більше недійсний, будь ласка, запросіть новий!",
          });
        }
      }
      if (!decoded) {
        return res.status(400).json({
          message:
            "Токен для відновлення паролю невірний, будь ласка, запросіть новий!",
        });
      }
      const { email } = decoded;
      req.user = { email };
      next();
    }
  );
};

module.exports = validatePasswordResetToken;
