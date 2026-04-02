import { 
    submitExam, 
    getResult, 
    getStudentResults,
    getExamResults,
    updateFeedback,
    getStudentComparison,
    exportExamResults
} from "../controllers/exam_result.controller.js";
import { verifyToken, verifyStudent, verifyTeacher } from "../middleware/authJWT.js";

const examResultRoutes = (app) => {
    // Submit bài thi (nộp bài và tính điểm) - chỉ student
    app.post('/api/sessions/:session_id/submit', verifyToken, verifyStudent, submitExam);
    
    // Lấy kết quả thi của một session - chỉ student
    app.get('/api/sessions/:session_id/result', verifyToken, verifyStudent, getResult);
    
    // Lấy tất cả kết quả thi của student - chỉ student
    app.get('/api/exam-results/my-results', verifyToken, verifyStudent, getStudentResults);
    
    // Lấy tất cả kết quả của một exam (cho teacher) - chỉ teacher
    app.get('/api/exams/:exam_id/results', verifyToken, verifyTeacher, getExamResults);

    // Export kết quả thi (CSV/JSON) - chỉ teacher
    app.get('/api/exams/:exam_id/results/export', verifyToken, verifyTeacher, exportExamResults);

    // So sánh kết quả của student với lớp và tất cả mọi người cùng làm exam - chỉ student
    app.get('/api/exams/:exam_id/my-comparison', verifyToken, verifyStudent, getStudentComparison);
    
    // Teacher cập nhật feedback cho exam result - chỉ teacher
    app.put('/api/exam-results/:result_id/feedback', verifyToken, verifyTeacher, updateFeedback);
}

export default examResultRoutes;

