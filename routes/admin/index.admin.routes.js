import { verifyToken, verifyAdmin } from "../../middleware/authJWT.js";

// Dashboard
import { getDashboard } from "../../controllers/admin/dashboard.admin.controller.js";

// User Management
import {
    getAllUsers,
    getUserById,
    createUser,
    updateUser,
    deleteUser,
    adjustUserBalance
} from "../../controllers/admin/user.admin.controller.js";

// Exam Management
import {
    getAllExams,
    getExamById,
    updateExam,
    deleteExam,
    getExamResults
} from "../../controllers/admin/exam.admin.controller.js";

// Class Management
import {
    getAllClasses,
    getClassById,
    deleteClass,
    getClassStudents
} from "../../controllers/admin/class.admin.controller.js";

// Purchase Management
import {
    getAllPurchases,
    getPurchaseById,
    refundPurchase,
    getTransactionHistory
} from "../../controllers/admin/purchase.admin.controller.js";

// Reports
import {
    getRevenueReport,
    getUserActivityReport,
    getExamStatsReport
} from "../../controllers/admin/report.admin.controller.js";

// Notifications
import {
    broadcastNotification,
    getNotificationHistory
} from "../../controllers/admin/notification.admin.controller.js";

// Content Moderation
import {
    getAllPosts,
    hidePost,
    showPost,
    deletePost,
    getAllComments,
    deleteComment
} from "../../controllers/admin/content.admin.controller.js";

// Withdrawal Management
import {
    getAllWithdrawals,
    getWithdrawalById,
    approveWithdrawal,
    rejectWithdrawal
} from "../../controllers/admin/withdrawal.admin.controller.js";

export default function(app) {
    app.use(function(req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    app.get(
        "/api/admin/dashboard",
        [verifyToken, verifyAdmin],
        getDashboard
    );

    app.get(
        "/api/admin/users",
        [verifyToken, verifyAdmin],
        getAllUsers
    );

    app.get(
        "/api/admin/users/:id",
        [verifyToken, verifyAdmin],
        getUserById
    );

    app.post(
        "/api/admin/users",
        [verifyToken, verifyAdmin],
        createUser
    );

    app.put(
        "/api/admin/users/:id",
        [verifyToken, verifyAdmin],
        updateUser
    );

    app.delete(
        "/api/admin/users/:id",
        [verifyToken, verifyAdmin],
        deleteUser
    );

    app.post(
        "/api/admin/users/:id/adjust-balance",
        [verifyToken, verifyAdmin],
        adjustUserBalance
    );

    // ==================== EXAM MANAGEMENT ====================
    
    app.get(
        "/api/admin/exams",
        [verifyToken, verifyAdmin],
        getAllExams
    );

    app.get(
        "/api/admin/exams/:id",
        [verifyToken, verifyAdmin],
        getExamById
    );

    app.put(
        "/api/admin/exams/:id",
        [verifyToken, verifyAdmin],
        updateExam
    );

    app.delete(
        "/api/admin/exams/:id",
        [verifyToken, verifyAdmin],
        deleteExam
    );

    app.get(
        "/api/admin/exams/:id/results",
        [verifyToken, verifyAdmin],
        getExamResults
    );

    // ==================== CLASS MANAGEMENT ====================
    
    app.get(
        "/api/admin/classes",
        [verifyToken, verifyAdmin],
        getAllClasses
    );

    app.get(
        "/api/admin/classes/:id",
        [verifyToken, verifyAdmin],
        getClassById
    );

    app.delete(
        "/api/admin/classes/:id",
        [verifyToken, verifyAdmin],
        deleteClass
    );

    app.get(
        "/api/admin/classes/:id/students",
        [verifyToken, verifyAdmin],
        getClassStudents
    );

    // ==================== PURCHASE MANAGEMENT ====================
    
    app.get(
        "/api/admin/purchases",
        [verifyToken, verifyAdmin],
        getAllPurchases
    );

    app.get(
        "/api/admin/purchases/:id",
        [verifyToken, verifyAdmin],
        getPurchaseById
    );

    app.post(
        "/api/admin/purchases/:id/refund",
        [verifyToken, verifyAdmin],
        refundPurchase
    );

    app.get(
        "/api/admin/transactions",
        [verifyToken, verifyAdmin],
        getTransactionHistory
    );

    // ==================== REPORTS ====================
    
    app.get(
        "/api/admin/reports/revenue",
        [verifyToken, verifyAdmin],
        getRevenueReport
    );

    app.get(
        "/api/admin/reports/user-activity",
        [verifyToken, verifyAdmin],
        getUserActivityReport
    );

    app.get(
        "/api/admin/reports/exam-stats",
        [verifyToken, verifyAdmin],
        getExamStatsReport
    );

    // ==================== NOTIFICATIONS ====================
    
    app.post(
        "/api/admin/notifications/broadcast",
        [verifyToken, verifyAdmin],
        broadcastNotification
    );

    app.get(
        "/api/admin/notifications/history",
        [verifyToken, verifyAdmin],
        getNotificationHistory
    );

    // ==================== CONTENT MODERATION ====================
    
    // Posts
    app.get(
        "/api/admin/posts",
        [verifyToken, verifyAdmin],
        getAllPosts
    );

    app.put(
        "/api/admin/posts/:id/hide",
        [verifyToken, verifyAdmin],
        hidePost
    );

    app.put(
        "/api/admin/posts/:id/show",
        [verifyToken, verifyAdmin],
        showPost
    );

    app.delete(
        "/api/admin/posts/:id",
        [verifyToken, verifyAdmin],
        deletePost
    );

    // Comments
    app.get(
        "/api/admin/comments",
        [verifyToken, verifyAdmin],
        getAllComments
    );

    app.delete(
        "/api/admin/comments/:id",
        [verifyToken, verifyAdmin],
        deleteComment
    );

    // ==================== WITHDRAWAL MANAGEMENT ====================
    
    // Get all withdrawal requests
    app.get(
        "/api/admin/withdrawals",
        [verifyToken, verifyAdmin],
        getAllWithdrawals
    );

    // Get withdrawal detail by ID
    app.get(
        "/api/admin/withdrawals/:id",
        [verifyToken, verifyAdmin],
        getWithdrawalById
    );

    // Approve withdrawal request
    app.put(
        "/api/admin/withdrawals/:id/approve",
        [verifyToken, verifyAdmin],
        approveWithdrawal
    );

    // Reject withdrawal request
    app.put(
        "/api/admin/withdrawals/:id/reject",
        [verifyToken, verifyAdmin],
        rejectWithdrawal
    );
}

