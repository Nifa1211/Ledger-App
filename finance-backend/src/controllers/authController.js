const authService = require("../services/authService");

async function register(req, res, next) {
  try {
    
    const user = await authService.register(req.body, req.user ?? null);
    res.status(201).json({ data: user });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const result = await authService.login(req.body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

function me(req, res) {
  res.json({ data: req.user });
}

module.exports = { register, login, me };
