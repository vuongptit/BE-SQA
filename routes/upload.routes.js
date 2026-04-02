import { upload, uploadAvatar, uploadExamImage, uploadUserAvatar } from "../controllers/upload.controller.js";
import { verifyToken } from "../middleware/authJWT.js";

const uploadRoutes = (app) => {
    // Upload ảnh đề thi
    app.post('/api/upload/exam-image', verifyToken, upload.single('image'), uploadExamImage);
    
    // Upload avatar user
    app.post('/api/upload/avatar', verifyToken, uploadAvatar.single('avatar'), uploadUserAvatar);
}

export default uploadRoutes;

