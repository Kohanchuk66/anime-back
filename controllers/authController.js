const User = require("../models/userModel");
const bcrypt = require("bcrypt");
const {
  generateAccessToken,
  generateRefreshToken,
} = require("../middlewares/generateTokens");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/nodemailer");
const verifyEmailTemplate = require("../utils/Emails_Templates/verifyEmailTemplate");
const forgotPasswordTemplate = require("../utils/Emails_Templates/forgotPasswordTemplate");
const generateEmailVerifyToken = require("../middlewares/generateEmailVerifyToken");
const generatePasswordResetToken = require("../middlewares/generatePasswordResetToken");

module.exports = {
  register: async (req, res) => {
    const { username, email, password, firstName, lastName } = req.body;
    if (!username || !email || !password || !firstName || !lastName) {
      return res.status(422).json({
        message: "Відсутні обов'язкові поля!",
      });
    }
    try {
      let existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          message: "Аккаунт з даним Email вже існує!",
        });
      }
      existingUser = null;
      existingUser = await User.findOne({ username }, { __v: 0, password: 0 });
      if (existingUser) {
        return res.status(400).json({
          message: "Аккаунт з даним нікнеймом вже існує!",
        });
      }
      delete existingUser;
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await User.create({
        firstName: firstName,
        lastName: lastName,
        email: email,
        username: username,
        password: hashedPassword,
      });
      
      const token = generateEmailVerifyToken(email);

      let options = {
        email: email,
        subject: "Підтвердіть ваш Email",
        html: verifyEmailTemplate(user, token),
      };

      await sendEmail(options);

      return res.status(201).json({
        message: `Email був відправлений на: ${email}. Виконуйте інструкції для активації акаунту.`,
      });
    } catch (err) {
      return res.status(400).json({
        message: err.message,
      });
    }
  },
  login: async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({
        message: "Email або пароль відсутні!",
      });
    }
    try {
      const userExisted = await User.findOne({ email });
      if (!userExisted) {
        return res.status(400).json({
          message: "Користувача з даним Email не існує!",
        });
      }
      const passwordValid = await bcrypt.compare(
        password,
        userExisted.password
      );
      if (!passwordValid) {
        return res.status(400).json({
          message: "Невірний пароль!",
        });
      }
      if (!userExisted.isVerified) {
        return res.status(400).json({
          message: "Спершу вам треба активувати ваш аккаунт!",
        });
      }
      const accessToken = generateAccessToken(userExisted);
      const refreshToken = generateRefreshToken(
        userExisted,
        process.env.REFRESH_TOKEN_EXPIRATION
      );

      res.cookie("refreshToken", refreshToken, {
        maxAge: 1000 * 60 * 60 * 24,
        httpOnly: true,
        sameSite: "Strict",
        path: "/refresh_token",
      });

      delete userExisted.password;
      delete userExisted.__v;

      return res.status(200).json({
        message: "Вхід виконано успішно!",
        token: accessToken,
        user: userExisted,
        isLoggedIn: true,
      });
    } catch (err) {
      return res.json({
        message: err.message,
      });
    }
  },
  refresh_token: async (req, res) => {
    let { refreshToken } = req.cookies;
    if (!refreshToken) {
      return res.status(403).json({
        message: "Неавторизовано, ви повинні виконати вхід!",
      });
    }
    try {
      const payload = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET_KEY
      );
      const user = await User.findOne(
        { email: payload.email },
        { __v: 0, password: 0 }
      );
      if (!user) {
        return res.json({
          message: "Неавторизовано, ви повинні виконати вхід!",
        });
      }

      const expiration = payload.exp - Math.floor(Date.now() / 1000);
      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user, expiration);

      res.cookie("refreshToken", newRefreshToken, {
        maxAge: expiration * 1000,
        httpOnly: true,
        sameSite: "Strict",
        path: "/refresh_token",
      });

      return res.json({
        user: user,
        token: newAccessToken,
      });
    } catch (err) {
      console.log(err);
    }
  },
  logout: async (req, res) => {
    try {
      const { username } = req.user;
      if (!username) {
        return res.status(400).json({
          message: "Ви не в системі!",
        });
      }
      res.cookie("refreshToken", "Connetwork Forum", {
        maxAge: -1,
        httpOnly: true,
        sameSite: "Strict",
        path: "/refresh_token",
      });
      return res.json({
        message: "Користувач успішно вийшов з системи!",
      });
    } catch (err) {
      return res.json(err.message);
    }
  },
  emailVerify: async (req, res) => {
    try {
      const { email } = req.user;
      if (!email) {
        return res.status(404).json({
          message: "Відсутній токен верифікації Email!",
        });
      }
      const user = await User.findOne({ email }, { __v: 0, password: 0 });
      if (!user) {
        return res.status(404).json({
          message: "Користувача з даним Email не існує!",
        });
      }
      if (user.isVerified) {
        return res.status(400).json({
          message: "Ваш Email вже підтвержений!",
        });
      }
      if (!user.isVerified) {
        await User.findOneAndUpdate(
          { email },
          {
            isVerified: true,
          }
        );
        return res.status(200).json({
          message: "Ваш Email успішно верифіковано!",
        });
      }
    } catch (err) {
      console.log(err.message);
    }
  },
  sendEmailVerification: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({
          message: "Email не вказано. Будь ласка, вкажіть Email!",
        });
      }
      const user = await User.findOne({ email }, { __v: 0, password: 0 });
      if (!user) {
        return res.status(404).json({
          message: "Користувача з даним Email не існує!",
        });
      }
      if (user.isVerified) {
        return res.status(400).json({
          message: "Ваш email вже верифіковано!",
        });
      }
      if (!user.isVerified) {
        const token = generateEmailVerifyToken(email);
        let options = {
          email: email,
          subject: "Підтвердіть ваш Email",
          html: verifyEmailTemplate(user, token),
        };

        await sendEmail(options);
        return res.status(200).json({
          message: `Посилання для активації було відправлено на: ${email}`,
        });
      }
    } catch (err) {
      console.log(err.message);
    }
  },
  resetPassword: async (req, res) => {
    try {
      const { email } = req.user;
      const { newPassword, confirmNewPassword } = req.body;
      if (!email) {
        return res.status(404).json({
          message: "Відсутній токен оновлення паролю!",
        });
      }
      if (!newPassword?.trim() || !confirmNewPassword?.trim()) {
        return res.status(404).json({
          message: "Ви повинні ввести обидва паролі!",
        });
      }
      if (newPassword?.trim() !== confirmNewPassword?.trim()) {
        return res.status(404).json({
          message:
            "Обидва паролі повинні бути однакові!",
        });
      }
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(404).json({
          message: "Користувача з даним Email не існує!",
        });
      }
      const hashedPassword = await bcrypt.hash(newPassword?.trim(), 10);
      user.password = hashedPassword;
      await user.save();
      return res.status(200).json({
        message: "Ваш пароль було скинуто успішно",
      });
    } catch (err) {
      console.log(err.message);
    }
  },
  sendForgotPassword: async (req, res) => {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({
          message: "Email не вказано. Будь ласка, вкажіть Email!",
        });
      }
      const user = await User.findOne({ email }, { __v: 0, password: 0 });
      if (!user) {
        return res.status(404).json({
          message: "Користувача з даним Email не існує!",
        });
      }
      const token = generatePasswordResetToken(email);
      let options = {
        email: email,
        subject: "Скинути пароль",
        html: forgotPasswordTemplate(user, token),
      };

      await sendEmail(options);
      return res.status(200).json({
        message: `Email для відновлення паролю відправлено на: ${email}`,
      });
    } catch (err) {
      console.log(err.message);
    }
  },
};
