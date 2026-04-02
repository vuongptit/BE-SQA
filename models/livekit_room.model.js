import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const LiveKitRoomModel = sequelize.define('LiveKitRooms', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    class_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Classes',
            key: 'id'
        },
        comment: 'ID của lớp học'
    },
    teacher_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'User',
            key: 'id'
        },
        comment: 'ID của giáo viên tạo room'
    },
    title: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Tiêu đề cuộc họp'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Mô tả cuộc họp'
    },
    room_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'Tên room trong LiveKit (unique)'
    },
    status: {
        type: DataTypes.ENUM('scheduled', 'active', 'ended', 'cancelled'),
        allowNull: false,
        defaultValue: 'scheduled',
        comment: 'Trạng thái room'
    },
    max_participants: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 50,
        comment: 'Số lượng người tham gia tối đa'
    },
    scheduled_start_time: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Thời gian dự kiến bắt đầu (có thể null nếu instant room)'
    },
    started_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Thời gian bắt đầu thực tế'
    },
    ended_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Thời gian kết thúc'
    },
    settings: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Các settings của room (video, audio, screen sharing, etc.)'
    }
}, {
    tableName: 'livekit_rooms',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['class_id']
        },
        {
            fields: ['teacher_id']
        },
        {
            fields: ['room_name']
        },
        {
            fields: ['status']
        }
    ]
});

export default LiveKitRoomModel;
