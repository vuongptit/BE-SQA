import { 
    createAnswer, 
    getAnswerById, 
    getAnswers, 
    updateAnswer, 
    deleteAnswer 
} from "../controllers/question_answer.controller.js";
import { verifyToken, verifyTeacher } from "../middleware/authJWT.js";

const questionAnswerRoutes = (app) => {
    // Create answer (only teacher)
    app.post('/api/question-answers', verifyToken, verifyTeacher, createAnswer);
    
    // Get all answers (teacher can see answers for their own questions)
    app.get('/api/question-answers', verifyToken, verifyTeacher, getAnswers);
    
    // Get answer by ID
    app.get('/api/question-answers/:id', verifyToken, verifyTeacher, getAnswerById);
    
    // Update answer (only teacher who created the question)
    app.put('/api/question-answers/:id', verifyToken, verifyTeacher, updateAnswer);
    
    // Delete answer (only teacher who created the question)
    app.delete('/api/question-answers/:id', verifyToken, verifyTeacher, deleteAnswer);
}

export default questionAnswerRoutes;

