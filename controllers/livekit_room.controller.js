import LiveKitRoomModel from "../models/livekit_room.model.js";
import ClassesModel from "../models/classes.model.js";
import UserModel from "../models/user.model.js";
import {
  generateRoomName,
  generateAccessToken,
  getLiveKitUrl,
} from "../services/livekit.service.js";

/**
 * Tạo LiveKit room cho lớp học
 * POST /api/classes/:classId/livekit-rooms
 */
export const createRoom = async (req, res) => {
  try {
    const { classId } = req.params;
    const teacherId = req.userId;
    const { title, description, max_participants, scheduled_start_time, settings } = req.body;

    // Kiểm tra lớp học có tồn tại không và giáo viên có quyền không
    const classData = await ClassesModel.findOne({
      where: { id: classId, teacher_id: teacherId },
    });

    if (!classData) {
      return res.status(404).json({
        status: false,
        message: "Không tìm thấy lớp học hoặc bạn không có quyền tạo room cho lớp này",
      });
    }

    // Kiểm tra dữ liệu đầu vào
    if (!title || !title.trim()) {
      return res.status(400).json({
        status: false,
        message: "Tiêu đề room là bắt buộc",
      });
    }

    // Tạo room name unique
    const roomName = generateRoomName(classId, title.trim());

    // Lưu thông tin room vào database
    const room = await LiveKitRoomModel.create({
      class_id: classId,
      teacher_id: teacherId,
      title: title.trim(),
      description: description || null,
      room_name: roomName,
      status: "scheduled",
      max_participants: parseInt(max_participants) || 50,
      scheduled_start_time: scheduled_start_time || null,
      settings: settings || null,
    });

    res.status(201).json({
      status: true,
      message: "Tạo LiveKit room thành công",
      data: {
        id: room.id,
        class_id: room.class_id,
        title: room.title,
        description: room.description,
        room_name: room.room_name,
        status: room.status,
        max_participants: room.max_participants,
        scheduled_start_time: room.scheduled_start_time,
        created_at: room.created_at,
      },
    });
  } catch (error) {
    console.error("Error creating LiveKit room:", error);
    res.status(500).json({
      status: false,
      message: "Lỗi khi tạo room",
      error: error.message,
    });
  }
};

/**
 * Lấy danh sách LiveKit rooms của lớp học
 * GET /api/classes/:classId/livekit-rooms
 */
export const getClassRooms = async (req, res) => {
  try {
    const { classId } = req.params;
    const userId = req.userId;
    const userRole = req.role;

    // Kiểm tra lớp học có tồn tại không
    const classData = await ClassesModel.findOne({
      where: { id: classId },
    });

    if (!classData) {
      return res.status(404).json({
        status: false,
        message: "Không tìm thấy lớp học",
      });
    }

    // Kiểm tra quyền: giáo viên hoặc học sinh trong lớp
    if (userRole === "teacher" && classData.teacher_id !== userId) {
      return res.status(403).json({
        status: false,
        message: "Bạn không có quyền xem rooms của lớp này",
      });
    }

    const rooms = await LiveKitRoomModel.findAll({
      where: { class_id: classId },
      order: [["created_at", "DESC"]],
      limit: 50,
    });

    // Format response
    const formattedRooms = rooms.map((room) => ({
      id: room.id,
      title: room.title,
      description: room.description,
      room_name: room.room_name,
      status: room.status,
      max_participants: room.max_participants,
      scheduled_start_time: room.scheduled_start_time,
      started_at: room.started_at,
      ended_at: room.ended_at,
      created_at: room.created_at,
    }));

    res.status(200).json({
      status: true,
      data: formattedRooms,
      total: formattedRooms.length,
    });
  } catch (error) {
    console.error("Error getting class rooms:", error);
    res.status(500).json({
      status: false,
      message: "Lỗi khi lấy danh sách rooms",
      error: error.message,
    });
  }
};

/**
 * Generate access token để join LiveKit room
 * POST /api/livekit-rooms/:roomId/token
 */
export const getAccessToken = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId;
    const userRole = req.role;

    // Lấy thông tin room
    const room = await LiveKitRoomModel.findOne({
      where: { id: roomId },
      include: [
        {
          model: ClassesModel,
          as: "class",
          attributes: ["id", "className", "teacher_id"],
        },
        {
          model: UserModel,
          as: "teacher",
          attributes: ["id", "fullName"],
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        status: false,
        message: "Không tìm thấy room",
      });
    }

    // Kiểm tra quyền: giáo viên hoặc học sinh trong lớp
    if (userRole === "teacher" && room.class.teacher_id !== userId) {
      return res.status(403).json({
        status: false,
        message: "Bạn không có quyền join room này",
      });
    }

    // Lấy thông tin user hiện tại
    const currentUser = await UserModel.findOne({
      where: { id: userId },
      attributes: ["id", "fullName", "email"],
    });

    if (!currentUser) {
      return res.status(404).json({
        status: false,
        message: "Không tìm thấy thông tin user",
      });
    }

    // Xác định role: giáo viên là publisher, học sinh cũng là publisher (có thể bật/tắt video)
    const participantRole = "publisher";

    // Generate access token
    const token = await generateAccessToken({
      roomName: room.room_name,
      participantName: currentUser.fullName || currentUser.email,
      participantIdentity: String(userId),
      participantRole: participantRole,
    });

    // Cập nhật status room thành "active" nếu chưa active
    if (room.status === "scheduled") {
      await room.update({
        status: "active",
        started_at: new Date(),
      });
    }

    res.status(200).json({
      status: true,
      data: {
        token: token,
        url: getLiveKitUrl(),
        room_name: room.room_name,
        participant_name: currentUser.fullName || currentUser.email,
        participant_identity: String(userId),
      },
    });
  } catch (error) {
    console.error("Error generating access token:", error);
    res.status(500).json({
      status: false,
      message: "Lỗi khi generate access token",
      error: error.message,
    });
  }
};

/**
 * Cập nhật trạng thái room (ended, cancelled)
 * PATCH /api/livekit-rooms/:roomId/status
 */
export const updateRoomStatus = async (req, res) => {
  try {
    const { roomId } = req.params;
    const { status } = req.body;
    const userId = req.userId;
    const userRole = req.role;

    if (!["ended", "cancelled"].includes(status)) {
      return res.status(400).json({
        status: false,
        message: "Status không hợp lệ",
      });
    }

    const room = await LiveKitRoomModel.findOne({
      where: { id: roomId },
      include: [
        {
          model: ClassesModel,
          as: "class",
          attributes: ["teacher_id"],
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        status: false,
        message: "Không tìm thấy room",
      });
    }

    // Chỉ giáo viên mới có quyền cập nhật status
    if (userRole !== "teacher" || room.class.teacher_id !== userId) {
      return res.status(403).json({
        status: false,
        message: "Chỉ giáo viên mới có quyền cập nhật trạng thái room",
      });
    }

    const updateData = { status };
    if (status === "ended") {
      updateData.ended_at = new Date();
    }

    await room.update(updateData);

    res.status(200).json({
      status: true,
      message: "Cập nhật trạng thái room thành công",
      data: {
        id: room.id,
        status: room.status,
        ended_at: room.ended_at,
      },
    });
  } catch (error) {
    console.error("Error updating room status:", error);
    res.status(500).json({
      status: false,
      message: "Lỗi khi cập nhật trạng thái room",
      error: error.message,
    });
  }
};

/**
 * Xóa LiveKit room
 * DELETE /api/livekit-rooms/:roomId
 */
export const deleteRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId;
    const userRole = req.role;

    const room = await LiveKitRoomModel.findOne({
      where: { id: roomId },
      include: [
        {
          model: ClassesModel,
          as: "class",
          attributes: ["teacher_id"],
        },
      ],
    });

    if (!room) {
      return res.status(404).json({
        status: false,
        message: "Không tìm thấy room",
      });
    }

    // Chỉ giáo viên mới có quyền xóa
    if (userRole !== "teacher" || room.class.teacher_id !== userId) {
      return res.status(403).json({
        status: false,
        message: "Chỉ giáo viên mới có quyền xóa room",
      });
    }

    // Xóa record trong database
    await room.destroy();

    res.status(200).json({
      status: true,
      message: "Xóa room thành công",
    });
  } catch (error) {
    console.error("Error deleting room:", error);
    res.status(500).json({
      status: false,
      message: "Lỗi khi xóa room",
      error: error.message,
    });
  }
};
