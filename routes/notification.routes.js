import {
    getNotifications,
    getUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification
} from "../controllers/notification.controller.js";
import { verifyToken } from "../middleware/authJWT.js";

const notificationRoutes = (app) => {
    // Lấy danh sách thông báo (có phân trang)
    app.get('/api/notifications', verifyToken, getNotifications);
    
    // Lấy số lượng thông báo chưa đọc
    app.get('/api/notifications/unread-count', verifyToken, getUnreadCount);
    
    // Đánh dấu một thông báo là đã đọc
    app.put('/api/notifications/:notification_id/read', verifyToken, markAsRead);
    
    // Đánh dấu tất cả thông báo là đã đọc
    app.put('/api/notifications/read-all', verifyToken, markAllAsRead);
    
    // Xóa một thông báo
    app.delete('/api/notifications/:notification_id', verifyToken, deleteNotification);
}

export default notificationRoutes;

