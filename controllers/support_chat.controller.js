import SupportChatMessageModel from "../models/support_chat_message.model.js";

/**
 * Lấy lịch sử chat hỗ trợ cho STUDENT/TEACHER
 * Mỗi user (student/teacher) có một hội thoại riêng với admin,
 * được xác định theo user_id của chính user đó.
 *
 * GET /api/support-chat/user/messages
 */
export const getUserChatHistory = async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    // Chỉ cho phép student/teacher dùng endpoint này
    if (req.role !== "student" && req.role !== "teacher") {
      return res.status(403).json({
        status: false,
        message: "Chỉ học sinh hoặc giáo viên mới được truy cập lịch sử chat này",
      });
    }

    const messages = await SupportChatMessageModel.findAll({
      where: {
        user_id: req.userId,
      },
      order: [["created_at", "ASC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      user_id: msg.user_id,
      role: msg.role,
      full_name: msg.full_name,
      content: msg.content,
      timestamp: msg.created_at.toISOString(),
      message_type: msg.message_type,
    }));

    res.status(200).json({
      status: true,
      data: formattedMessages,
      total: formattedMessages.length,
    });
  } catch (error) {
    console.error("Error getting user chat history:", error);
    res.status(500).json({
      status: false,
      message: "Lỗi khi lấy lịch sử chat của người dùng",
      error: error.message,
    });
  }
};

/**
 * Lấy lịch sử chat hỗ trợ cho ADMIN
 *
 * - Admin có thể xem toàn bộ lịch sử
 * - Hoặc lọc theo user_id cụ thể (1 hội thoại admin <-> 1 user)
 *
 * GET /api/support-chat/admin/messages?user_id=123
 */
export const getAdminChatHistory = async (req, res) => {
  try {
    const { limit = 100, offset = 0, user_id } = req.query;

    const whereClause = {};
    if (user_id) {
      whereClause.user_id = user_id;
    }

    const messages = await SupportChatMessageModel.findAll({
      where: whereClause,
      order: [["created_at", "ASC"]],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      user_id: msg.user_id,
      role: msg.role,
      full_name: msg.full_name,
      content: msg.content,
      timestamp: msg.created_at.toISOString(),
      message_type: msg.message_type,
    }));

    res.status(200).json({
      status: true,
      data: formattedMessages,
      total: formattedMessages.length,
    });
  } catch (error) {
    console.error("Error getting admin chat history:", error);
    res.status(500).json({
      status: false,
      message: "Lỗi khi lấy lịch sử chat cho admin",
      error: error.message,
    });
  }
};

/**
 * Lưu tin nhắn vào database (được gọi từ socket handler)
 * @param {Object} messageData - Dữ liệu tin nhắn
 * @returns {Promise<Object>} Message đã lưu
 */
export const saveMessage = async (messageData) => {
  try {
    const {
      content,
      user_id,
      role,
      full_name,
      socket_id,
      message_type = "message",
    } = messageData;

    if (!content || !role || !full_name) {
      throw new Error("Missing required fields: content, role, full_name");
    }

    const message = await SupportChatMessageModel.create({
      // user_id ở đây là ID của user phía STUDENT/TEACHER,
      // dùng để xác định hội thoại 1-1 giữa admin và user đó
      user_id: user_id || null,
      role,
      full_name,
      content,
      socket_id: socket_id || null,
      message_type,
    });

    return {
      id: message.id,
      user_id: message.user_id,
      role: message.role,
      full_name: message.full_name,
      content: message.content,
      timestamp: message.created_at.toISOString(),
      message_type: message.message_type,
    };
  } catch (error) {
    console.error("Error saving message:", error);
    throw error;
  }
};
