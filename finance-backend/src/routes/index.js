const { Router } = require("express");
const { authenticate, requireRole } = require("../middleware/auth");
const { validate, registerSchema, loginSchema, updateUserSchema,
        createRecordSchema, updateRecordSchema, recordQuerySchema } = require("../middleware/validate");

const authCtrl      = require("../controllers/authController");
const userCtrl      = require("../controllers/userController");
const recordCtrl    = require("../controllers/recordController");
const dashboardCtrl = require("../controllers/dashboardController");

const router = Router();


router.post("/auth/register", validate(registerSchema), authCtrl.register);
router.post("/auth/login",    validate(loginSchema),    authCtrl.login);
router.get ("/auth/me",       authenticate,             authCtrl.me);


router.get   ("/users",     authenticate, requireRole("admin"), userCtrl.list);
router.get   ("/users/:id", authenticate, requireRole("admin"), userCtrl.get);
router.patch ("/users/:id", authenticate, requireRole("admin"), validate(updateUserSchema), userCtrl.update);
router.delete("/users/:id", authenticate, requireRole("admin"), userCtrl.remove);

router.get   ("/records",     authenticate, validate(recordQuerySchema, "query"), recordCtrl.list);
router.get   ("/records/:id", authenticate, recordCtrl.get);
router.post  ("/records",     authenticate, requireRole("analyst"), validate(createRecordSchema), recordCtrl.create);
router.patch ("/records/:id", authenticate, requireRole("analyst"), validate(updateRecordSchema), recordCtrl.update);
router.delete("/records/:id", authenticate, requireRole("admin"),   recordCtrl.remove);

router.get("/dashboard/summary",          authenticate, dashboardCtrl.summary);
router.get("/dashboard/categories",       authenticate, dashboardCtrl.categoryTotals);
router.get("/dashboard/trends/monthly",   authenticate, dashboardCtrl.monthlyTrends);
router.get("/dashboard/trends/weekly",    authenticate, dashboardCtrl.weeklyTrends);
router.get("/dashboard/recent-activity",  authenticate, dashboardCtrl.recentActivity);

module.exports = router;
