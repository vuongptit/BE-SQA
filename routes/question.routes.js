import { 
    createQuestion, 
    getQuestionById, 
    getQuestions, 
    updateQuestion, 
    deleteQuestion,
    updateQuestionOrder
} from "../controllers/question.controller.js";
import { verifyToken, verifyTeacher } from "../middleware/authJWT.js";

const questionRoutes = (app) => {
    // Create question (only teacher)
    app.post('/api/questions', verifyToken, verifyTeacher, createQuestion);
    
    // Get all questions (teacher can see their own questions)
    app.get('/api/questions', verifyToken, verifyTeacher, getQuestions);
    
    // Get question by ID
    app.get('/api/questions/:id', verifyToken, verifyTeacher, getQuestionById);
    
    // Update question (only teacher who created it)
    app.put('/api/questions/:id', verifyToken, verifyTeacher, updateQuestion);
    
    // Delete question (only teacher who created it)
    app.delete('/api/questions/:id', verifyToken, verifyTeacher, deleteQuestion);
    
    // Update question order for an exam (bulk update)
    app.put('/api/exams/:exam_id/questions/order', verifyToken, verifyTeacher, updateQuestionOrder);
}

export default questionRoutes;

