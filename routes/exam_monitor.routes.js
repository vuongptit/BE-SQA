import { 
    logCheatingEvent,
    getSessionCheatingLogs,
    getExamCheatingLogs,
    getStudentExamCheatingLogs,
    getStudentAllCheatingLogs
} from "../controllers/exam_monitor.controller.js";
import { verifyToken, verifyStudent, verifyTeacher } from "../middleware/authJWT.js";

const examMonitorRoutes = (app) => {
    // Ghi log gian lận trong lúc thi (chỉ student - tự báo cáo từ client)
    app.post('/api/sessions/:session_id/cheating-log', verifyToken, verifyStudent, logCheatingEvent);
    
    // Lấy lịch sử gian lận của một session (cho student xem lịch sử của mình)
    app.get('/api/sessions/:session_id/cheating-logs', verifyToken, verifyStudent, getSessionCheatingLogs);
    
    // Lấy lịch sử gian lận của một exam (cho teacher xem tất cả gian lận trong exam)
    app.get('/api/exams/:exam_id/cheating-logs', verifyToken, verifyTeacher, getExamCheatingLogs);
    
    // Lấy lịch sử gian lận của một student trong một exam (cho teacher)
    app.get('/api/exams/:exam_id/students/:student_id/cheating-logs', verifyToken, verifyTeacher, getStudentExamCheatingLogs);
    
    // Lấy tất cả lịch sử gian lận của một student (cho student xem tất cả gian lận của mình)
    app.get('/api/student/cheating-logs', verifyToken, verifyStudent, getStudentAllCheatingLogs);
}

export default examMonitorRoutes;

