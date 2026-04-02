import express from "express";
import {
  getUserChatHistory,
  getAdminChatHistory,
} from "../controllers/support_chat.controller.js";
import { verifyToken, verifyAdmin } from "../middleware/authJWT.js";

const router = express.Router();

// Lấy lịch sử chat hỗ trợ cho STUDENT/TEACHER (1 hội thoại / user)
router.get("/user/messages", verifyToken, getUserChatHistory);

// Lấy lịch sử chat hỗ trợ cho ADMIN
// Có thể truyền user_id để xem hội thoại cụ thể
router.get("/admin/messages", verifyToken, verifyAdmin, getAdminChatHistory);

export default router;
