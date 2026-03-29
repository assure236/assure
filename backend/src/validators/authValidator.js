const Joi = require('joi');

exports.registerSchema = Joi.object({
  full_name: Joi.string().min(3).max(100).required(),
  email: Joi.string().email().required(),
  mobile: Joi.string().pattern(/^[0-9]{10}$/).required(),
  mpin: Joi.string().length(6).pattern(/^[0-9]{6}$/).required(),
  referral_code: Joi.string().optional()
});

exports.loginSchema = Joi.object({
  // mobile + mpin (app login)
  mobile: Joi.string().pattern(/^\d{10}$/),
  mpin: Joi.string().length(6),
  // email + password (web/admin login)
  email: Joi.string().email(),
  password: Joi.string().min(6),
}).or('mobile', 'email');

exports.forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

exports.resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  newPassword: Joi.string().min(6).required()
});
