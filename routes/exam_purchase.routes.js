import { verifyToken } from "../middleware/authJWT.js";
import { 
    purchaseExam, 
    getPurchasedExams, 
    checkPurchaseStatus,
    getPurchaseStatistics 
} from "../controllers/exam_purchase.controller.js";

export default function(app) {
    app.use(function(req, res, next) {
        res.header(
            "Access-Control-Allow-Headers",
            "x-access-token, Origin, Content-Type, Accept"
        );
        next();
    });

    // Mua đề thi
    app.post(
        "/api/exam-purchase/purchase",
        [verifyToken],
        purchaseExam
    );

    // Xem danh sách đề thi đã mua
    app.get(
        "/api/exam-purchase/my-purchases",
        [verifyToken],
        getPurchasedExams
    );

    // Kiểm tra trạng thái mua đề thi
    app.get(
        "/api/exam-purchase/check/:exam_id",
        [verifyToken],
        checkPurchaseStatus
    );

    // Lấy thống kê về các đề thi đã mua
    app.get(
        "/api/exam-purchase/statistics",
        [verifyToken],
        getPurchaseStatistics
    );
}

