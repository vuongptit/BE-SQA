import express from "express";
import {
  createRoom,
  getClassRooms,
  getAccessToken,
  updateRoomStatus,
  deleteRoom,
} from "../controllers/livekit_room.controller.js";
import { verifyToken, verifyTeacher } from "../middleware/authJWT.js";

const router = express.Router();

// Tạo room cho lớp học (chỉ giáo viên)
router.post(
  "/classes/:classId/livekit-rooms",
  verifyToken,
  verifyTeacher,
  createRoom
);

// Lấy danh sách rooms của lớp (giáo viên và học sinh)
router.get("/classes/:classId/livekit-rooms", verifyToken, getClassRooms);

// Generate access token để join room (giáo viên và học sinh)
router.post("/livekit-rooms/:roomId/token", verifyToken, getAccessToken);

// Cập nhật trạng thái room (chỉ giáo viên)
router.patch(
  "/livekit-rooms/:roomId/status",
  verifyToken,
  verifyTeacher,
  updateRoomStatus
);

// Xóa room (chỉ giáo viên)
router.delete(
  "/livekit-rooms/:roomId",
  verifyToken,
  verifyTeacher,
  deleteRoom
);

export default router;
