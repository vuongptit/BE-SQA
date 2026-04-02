import { 
    addFavorite, 
    removeFavorite, 
    getFavorites, 
    checkFavorite 
} from "../controllers/exam_favorite.controller.js";
import { verifyToken } from "../middleware/authJWT.js";

const examFavoriteRoutes = (app) => {
    // Add exam to favorites (all authenticated users)
    app.post('/api/exam-favorites', verifyToken, addFavorite);
    
    // Get all favorite exams for current user
    app.get('/api/exam-favorites', verifyToken, getFavorites);
    
    // Check if exam is favorited by user
    app.get('/api/exam-favorites/:exam_id/check', verifyToken, checkFavorite);
    
    // Remove exam from favorites
    app.delete('/api/exam-favorites/:exam_id', verifyToken, removeFavorite);
}

export default examFavoriteRoutes;

