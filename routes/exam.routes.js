import { 
    createExam, 
    getExamById, 
    getExams, 
    updateExam, 
    deleteExam,
    switchQuestionCreationMethod,
    getSimilarExams
} from "../controllers/exam.controller.js";
import { verifyToken, verifyTeacher } from "../middleware/authJWT.js";

const examRoutes = (app) => {
    // Create exam (only teacher)
    app.post('/api/exams', verifyToken, verifyTeacher, createExam);
    
    // Get all exams (teacher and student - role-based logic inside)
    app.get('/api/exams', verifyToken, getExams);
    
    // Get exam by ID (teacher and student - role-based logic inside)
    app.get('/api/exams/:id', verifyToken, getExamById);
    
    // Get similar exams (cùng class, cùng chủ đề, hoặc tên liên quan)
    app.get('/api/exams/:id/similar', verifyToken, getSimilarExams);
    
    // Update exam (only teacher who created it)
    app.put('/api/exams/:id', verifyToken, verifyTeacher, updateExam);

    // Switch question creation method (reset all questions)
    app.post('/api/exams/:id/switch-question-method', verifyToken, verifyTeacher, switchQuestionCreationMethod);
    
    // Delete exam (only teacher who created it)
    app.delete('/api/exams/:id', verifyToken, verifyTeacher, deleteExam);
}

export default examRoutes;

