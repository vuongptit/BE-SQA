import { 
    createOrUpdateRating, 
    getExamAverageRating,
    getUserRating,
    getExamRatings,
    deleteRating
} from "../controllers/exam_rating.controller.js";
import { verifyToken } from "../middleware/authJWT.js";

const examRatingRoutes = (app) => {
    // Tạo hoặc cập nhật rating cho exam
    app.post('/api/exam-ratings', verifyToken, createOrUpdateRating);
    
    // Lấy rating trung bình của exam
    app.get('/api/exams/:exam_id/rating', getExamAverageRating);
    
    // Lấy rating của user hiện tại cho exam
    app.get('/api/exams/:exam_id/my-rating', verifyToken, getUserRating);
    
    // Lấy tất cả ratings của exam (với phân trang)
    app.get('/api/exams/:exam_id/ratings', getExamRatings);
    
    // Xóa rating
    app.delete('/api/exams/:exam_id/rating', verifyToken, deleteRating);
}

export default examRatingRoutes;

