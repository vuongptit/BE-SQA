import { AccessToken } from "livekit-server-sdk";

const LIVEKIT_URL = process.env.LIVEKIT_URL;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

/**
 * Generate LiveKit access token cho user để join room
 * @param {Object} params
 * @param {string} params.roomName - Tên room
 * @param {string} params.participantName - Tên người tham gia
 * @param {string} params.participantIdentity - Identity của người tham gia (user ID)
 * @param {string} params.participantRole - Role: 'publisher' (có thể publish video/audio) hoặc 'subscriber' (chỉ xem)
 * @returns {Promise<string>} Access token (JWT string)
 */
export const generateAccessToken = async ({
  roomName,
  participantName,
  participantIdentity,
  participantRole = "publisher",
}) => {
  try {
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
      throw new Error(
        "LiveKit credentials chưa được cấu hình. Vui lòng thêm LIVEKIT_API_KEY, LIVEKIT_API_SECRET vào file .env"
      );
    }

    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantIdentity,
      name: participantName,
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: participantRole === "publisher",
      canSubscribe: true,
      canPublishData: true,
    });

    // toJwt() trả về Promise<string>, cần await
    const token = await at.toJwt();
    return token;
  } catch (error) {
    console.error("Error generating LiveKit access token:", error);
    throw error;
  }
};

/**
 * Tạo room name unique cho lớp học
 * @param {number} classId - ID lớp học
 * @param {string} title - Tiêu đề meeting
 * @returns {string} Room name
 */
export const generateRoomName = (classId, title) => {
  // Format: class-{classId}-{timestamp}-{title slug}
  const timestamp = Date.now();
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 20);
  return `class-${classId}-${timestamp}-${titleSlug}`;
};

/**
 * Lấy LiveKit URL
 * @returns {string} LiveKit WebSocket URL
 */
export const getLiveKitUrl = () => {
  if (!LIVEKIT_URL) {
    throw new Error(
      "LIVEKIT_URL chưa được cấu hình. Vui lòng thêm vào file .env"
    );
  }
  return LIVEKIT_URL;
};
