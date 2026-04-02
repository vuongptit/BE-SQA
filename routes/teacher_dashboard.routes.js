import { getTeacherDashboardStats } from "../controllers/teacher_dashboard.controller.js";
import { getTeacherExamPurchases, getTeacherExamRevenue } from "../controllers/teacher_exam_purchase.controller.js";
import { verifyToken, verifyTeacher } from "../middleware/authJWT.js";

const teacherDashboardRoutes = (app) => {
    // Get teacher dashboard statistics
    app.get('/api/teacher/dashboard/stats', verifyToken, verifyTeacher, getTeacherDashboardStats);
    
    // Get exam purchases for teacher's exams
    app.get('/api/teacher/exam-purchases', verifyToken, verifyTeacher, getTeacherExamPurchases);
    
    // Get revenue statistics for teacher
    app.get('/api/teacher/exam-revenue', verifyToken, verifyTeacher, getTeacherExamRevenue);
}

export default teacherDashboardRoutes;

