import { 
    createComment, 
    getCommentsByExam, 
    getCommentById, 
    updateComment, 
    deleteComment 
} from "../controllers/exam_comment.controller.js";
import { verifyToken } from "../middleware/authJWT.js";

const examCommentRoutes = (app) => {
    // Create a comment (root comment or reply)
    app.post('/api/exam-comments', verifyToken, createComment);
    
    // Get all comments for an exam (with replies nested)
    app.get('/api/exams/:exam_id/comments', verifyToken, getCommentsByExam);
    
    // Get comment by ID
    app.get('/api/exam-comments/:comment_id', verifyToken, getCommentById);
    
    // Update comment (only owner can update)
    app.put('/api/exam-comments/:comment_id', verifyToken, updateComment);
    
    // Delete comment (only owner can delete, will also delete replies)
    app.delete('/api/exam-comments/:comment_id', verifyToken, deleteComment);
}

export default examCommentRoutes;

