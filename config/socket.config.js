import { Server } from "socket.io";
import { saveMessage } from "../controllers/support_chat.controller.js";

let io = null;

export const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    /**
     * CHAT HỖ TRỢ GIỮA GIÁO VIÊN / HỌC SINH VÀ ADMIN
     * ------------------------------------------------
     * - Tất cả client join vào room chung: "support_chat"
     * - Khi có tin nhắn mới, server broadcast lại cho toàn bộ room
     * - Tạm thời chưa lưu DB, chỉ realtime qua WebSocket
     */

    // Client join vào room chat hỗ trợ
    socket.on("join_support_chat", (data) => {
      try {
        const { user_id, role, full_name } = data || {};

        // Kiểm tra xem socket đã join room này chưa để tránh duplicate
        const rooms = Array.from(socket.rooms);
        if (rooms.includes("support_chat")) {
          console.log(
            `Client ${socket.id} already in support_chat, skipping join`
          );
          return;
        }

        // Lưu thông tin user/admin trên socket để phân biệt hội thoại
        // - Đối với student/teacher: user_id là ID user tham gia hội thoại
        // - Đối với admin: lưu admin_id riêng, còn user_id sẽ được truyền
        //   theo từng message (target user) để biết hội thoại nào
        if (role === "admin") {
          socket.data.admin_id = user_id;
          socket.data.user_id = null;
        } else {
          socket.data.user_id = user_id;
          socket.data.admin_id = null;
        }
        socket.data.role = role;
        socket.data.full_name = full_name;

        socket.join("support_chat");
        console.log(
          `Client ${socket.id} joined support_chat as ${role || "unknown"} (${
            user_id || "no-id"
          })`
        );

        // Thông báo cho các client khác (không phải chính socket vừa join) rằng có user mới tham gia
        // Chỉ emit một lần cho mỗi socket join
        const systemEvent = {
          type: "user_join",
          user_id,
          role,
          full_name,
          socket_id: socket.id,
          timestamp: new Date().toISOString(),
        };

        // Lưu system event vào DB (không await để không block)
        saveMessage({
          content: `${full_name || "Người dùng"} đã tham gia chat hỗ trợ`,
          user_id,
          role,
          full_name,
          socket_id: socket.id,
          message_type: "system",
        }).catch((err) => {
          console.error("Error saving system event:", err);
        });

        socket.to("support_chat").emit("support_system_event", systemEvent);
      } catch (error) {
        console.error("Error in join_support_chat:", error);
      }
    });

    // Client gửi tin nhắn chat hỗ trợ
    socket.on("support_message", (payload) => {
      try {
        const { content } = payload || {};
        if (!content || typeof content !== "string") {
          return;
        }

        // Xác định hội thoại (1 admin <-> 1 user)
        // - Nếu là student/teacher: hội thoại gắn với chính user đó (socket.data.user_id)
        // - Nếu là admin: cần biết admin đang trả lời user nào (payload.target_user_id)
        let conversationUserId = null;
        let role = socket.data.role || payload.role || "unknown";
        let full_name =
          socket.data.full_name || payload.full_name || "Người dùng";

        if (role === "admin") {
          conversationUserId = payload.target_user_id || null;
        } else {
          conversationUserId = socket.data.user_id || payload.user_id || null;
        }

        const message = {
          content: content.trim(),
          user_id: conversationUserId,
          role,
          full_name,
          socket_id: socket.id,
          timestamp: new Date().toISOString(),
        };

        // Lưu message vào DB (không await để không block realtime)
        saveMessage({
          content: message.content,
          user_id: message.user_id,
          role: message.role,
          full_name: message.full_name,
          socket_id: message.socket_id,
          message_type: "message",
        })
          .then((savedMessage) => {
            // Broadcast với ID từ DB để client có thể track
            io.to("support_chat").emit("support_message", {
              ...message,
              id: savedMessage.id,
            });
          })
          .catch((err) => {
            console.error("Error saving message:", err);
            // Vẫn broadcast message ngay cả khi lưu DB lỗi
            io.to("support_chat").emit("support_message", message);
          });
      } catch (error) {
        console.error("Error in support_message:", error);
      }
    });

    // Xử lý khi client join room để theo dõi exam cụ thể
    socket.on("join_exam_monitoring", (data) => {
      const { exam_id } = data;
      if (exam_id) {
        socket.join(`exam_${exam_id}`);
        console.log(`Client ${socket.id} joined exam_${exam_id}`);
      }
    });

    // Xử lý khi client leave room
    socket.on("leave_exam_monitoring", (data) => {
      const { exam_id } = data;
      if (exam_id) {
        socket.leave(`exam_${exam_id}`);
        console.log(`Client ${socket.id} left exam_${exam_id}`);
      }
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.IO not initialized. Call initializeSocket first.");
  }
  return io;
};

