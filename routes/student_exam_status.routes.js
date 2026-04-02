import {
    getExamStatus,
    getAllExamsWithStatus,
    getExamsByStatus
} from "../controllers/student_exam_status.controller.js";
import { verifyToken, verifyStudent } from "../middleware/authJWT.js";

const studentExamStatusRoutes = (app) => {
    // Lấy trạng thái của student cho một exam cụ thể
    app.get('/api/student/exams/:exam_id/status', verifyToken, verifyStudent, getExamStatus);
    
    // Lấy tất cả exams với trạng thái của student
    app.get('/api/student/exams/with-status', verifyToken, verifyStudent, getAllExamsWithStatus);
    
    // Lấy exams theo trạng thái (not_started, in_progress, completed)
    app.get('/api/student/exams/by-status', verifyToken, verifyStudent, getExamsByStatus);
}

export default studentExamStatusRoutes;
