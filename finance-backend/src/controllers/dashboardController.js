const dashboardService = require("../services/dashboardService");

function summary(req, res, next) {
  try {
    res.json({ data: dashboardService.getSummary() });
  } catch (err) {
    next(err);
  }
}

function categoryTotals(req, res, next) {
  try {
    res.json({ data: dashboardService.getCategoryTotals() });
  } catch (err) {
    next(err);
  }
}

function monthlyTrends(req, res, next) {
  try {
    const months = Math.min(Number(req.query.months) || 12, 24);
    res.json({ data: dashboardService.getMonthlyTrends({ months }) });
  } catch (err) {
    next(err);
  }
}

function weeklyTrends(req, res, next) {
  try {
    const weeks = Math.min(Number(req.query.weeks) || 8, 52);
    res.json({ data: dashboardService.getWeeklyTrends({ weeks }) });
  } catch (err) {
    next(err);
  }
}

function recentActivity(req, res, next) {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    res.json({ data: dashboardService.getRecentActivity({ limit }) });
  } catch (err) {
    next(err);
  }
}

module.exports = { summary, categoryTotals, monthlyTrends, weeklyTrends, recentActivity };
