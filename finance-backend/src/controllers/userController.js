const userService = require("../services/userService");

function list(req, res, next) {
  try {
    const { page, limit } = req.query;
    const result = userService.listUsers({
      page: Number(page) || 1,
      limit: Math.min(Number(limit) || 20, 100),
    });
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

function get(req, res, next) {
  try {
    res.json({ data: userService.getUserById(Number(req.params.id)) });
  } catch (err) {
    next(err);
  }
}

function update(req, res, next) {
  try {
    res.json({ data: userService.updateUser(Number(req.params.id), req.body) });
  } catch (err) {
    next(err);
  }
}

function remove(req, res, next) {
  try {
    userService.deleteUser(Number(req.params.id), req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, get, update, remove };
