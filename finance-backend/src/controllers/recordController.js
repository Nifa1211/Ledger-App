const recordService = require("../services/recordService");

function list(req, res, next) {
  try {
    const { type, category, date_from, date_to, page, limit } = req.query;
    const result = recordService.listRecords(
      { type, category, date_from, date_to },
      { page: Number(page) || 1, limit: Number(limit) || 20 }
    );
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
}

function get(req, res, next) {
  try {
    res.json({ data: recordService.getRecordById(Number(req.params.id)) });
  } catch (err) {
    next(err);
  }
}

function create(req, res, next) {
  try {
    const record = recordService.createRecord(req.body, req.user.id);
    res.status(201).json({ data: record });
  } catch (err) {
    next(err);
  }
}

function update(req, res, next) {
  try {
    res.json({ data: recordService.updateRecord(Number(req.params.id), req.body) });
  } catch (err) {
    next(err);
  }
}

function remove(req, res, next) {
  try {
    recordService.deleteRecord(Number(req.params.id));
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

module.exports = { list, get, create, update, remove };
