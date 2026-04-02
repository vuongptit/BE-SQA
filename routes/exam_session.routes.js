import { 
    startExam, 
    getCurrentSession, 
    getStudentSessions,
    getSessionQuestionsForStudent
} from "../controllers/exam_session.controller.js";
import { verifyToken, verifyStudent } from "../middleware/authJWT.js";

const examSessionRoutes = (app) => {
    // Bắt đầu bài thi (chỉ student)
    app.post('/api/exams/:exam_id/start', verifyToken, verifyStudent, startExam);
    
    // Lấy exam session hiện tại của student
    app.get('/api/exams/:exam_id/session', verifyToken, verifyStudent, getCurrentSession);
    
    // Lấy tất cả exam sessions của student
    app.get('/api/exam-sessions/my-sessions', verifyToken, verifyStudent, getStudentSessions);

    // Lấy đề thi cho session
    app.get('/api/sessions/:session_id/questions', verifyToken, verifyStudent, getSessionQuestionsForStudent);
}

export default examSessionRoutes;

