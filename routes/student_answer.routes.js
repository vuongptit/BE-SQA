import { 
    answerQuestion, 
    getSessionAnswers, 
    getAnswer 
} from "../controllers/student_answer.controller.js";
import { verifyToken, verifyStudent } from "../middleware/authJWT.js";

const studentAnswerRoutes = (app) => {
    // Trả lời một câu hỏi trong session (hoặc cập nhật câu trả lời)
    app.post('/api/sessions/:session_id/answer', verifyToken, verifyStudent, answerQuestion);
    
    // Lấy tất cả câu trả lời của một session
    app.get('/api/sessions/:session_id/answers', verifyToken, verifyStudent, getSessionAnswers);
    
    // Lấy một câu trả lời cụ thể
    app.get('/api/sessions/:session_id/answers/:question_id', verifyToken, verifyStudent, getAnswer);
}

export default studentAnswerRoutes;

