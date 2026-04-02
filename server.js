import express from "express";

import 'dotenv/config.js';
import cors from 'cors';

import sequelize from "./config/db.config.js";
import "./models/index.model.js";
import authRoutes from "./routes/auth.routes.js";
import authClasses from "./routes/classes.routes.js";
import authUser from "./routes/user.routes.js";
import examRoutes from "./routes/exam.routes.js";
import questionRoutes from "./routes/question.routes.js";
import questionAnswerRoutes from "./routes/question_answer.routes.js";
import examFavoriteRoutes from "./routes/exam_favorite.routes.js";
import examCommentRoutes from "./routes/exam_comment.routes.js";
import examRatingRoutes from "./routes/exam_rating.routes.js";
import examSessionRoutes from "./routes/exam_session.routes.js";
import studentAnswerRoutes from "./routes/student_answer.routes.js";
import examResultRoutes from "./routes/exam_result.routes.js";
import { startAutoSubmitScheduler } from "./services/exam_result.service.js";
import notificationRoutes from "./routes/notification.routes.js";
import studentExamStatusRoutes from "./routes/student_exam_status.routes.js";
import examPurchaseRoutes from "./routes/exam_purchase.routes.js";
import examMonitorRoutes from "./routes/exam_monitor.routes.js";
import adminRoutes from "./routes/admin/index.admin.routes.js";
import teacherDashboardRoutes from "./routes/teacher_dashboard.routes.js";
import walletRoutes from "./routes/wallet.routes.js";
import { startDepositExpiryScheduler } from "./services/wallet.service.js";
import uploadRoutes from "./routes/upload.routes.js";
import postRoutes from "./routes/posts.routes.js";
import supportChatRoutes from "./routes/support_chat.routes.js";
import livekitRoomRoutes from "./routes/livekit_room.routes.js";
import path from "path";
import { fileURLToPath } from "url";
import { initializeSocket } from "./config/socket.config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express()

app.use(cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
}));
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Serve static files from public directory
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

sequelize.sync()
    .then(async () => {
        console.log("Database synced (altered)");

    })
    .catch(err => console.error(err));




authRoutes(app);
authClasses(app)
authUser(app)
studentExamStatusRoutes(app)  // Phải đăng ký trước examRoutes để tránh conflict
examRoutes(app)
questionRoutes(app)
questionAnswerRoutes(app)
examFavoriteRoutes(app)
examCommentRoutes(app)
examRatingRoutes(app)
examSessionRoutes(app)
studentAnswerRoutes(app)
postRoutes(app)
examResultRoutes(app)
notificationRoutes(app)
examPurchaseRoutes(app)
examMonitorRoutes(app)
adminRoutes(app)
teacherDashboardRoutes(app)
walletRoutes(app)
uploadRoutes(app)
app.use("/api/support-chat", supportChatRoutes)
app.use("/api", livekitRoomRoutes)

// Error handling middleware - phải đặt sau tất cả routes
app.use((err, req, res, next) => {
    console.error('Error occurred:', err);
    console.error('Stack trace:', err.stack);

    // Không leak thông tin lỗi chi tiết cho client trong production
    const message = process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message;

    res.status(err.status || 500).json({
        message: message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        message: 'Route not found'
    });
});

// Xử lý uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT EXCEPTION! Shutting down...');
    console.error(error.name, error.message);
    console.error(error.stack);
    // Đóng server gracefully
    process.exit(1);
});

// Xử lý unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION! Shutting down...');
    console.error('Reason:', reason);
    console.error('Promise:', promise);
    // Đóng server gracefully
    process.exit(1);
});

startAutoSubmitScheduler();
startDepositExpiryScheduler();
const PORT = process.env.PORT || 5005;
const server = app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`)
});

// Khởi tạo Socket.IO
initializeSocket(server);
console.log("Socket.IO initialized");

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('Process terminated');
        sequelize.close().then(() => {
            console.log('Database connection closed');
            process.exit(0);
        });
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    server.close(() => {
        console.log('Process terminated');
        sequelize.close().then(() => {
            console.log('Database connection closed');
            process.exit(0);
        });
    });
});