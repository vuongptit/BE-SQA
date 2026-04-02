import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const SupportChatMessageModel = sequelize.define('SupportChatMessages', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'User',
            key: 'id'
        },
        comment: 'ID của user gửi (NULL nếu là system message)'
    },
    role: {
        type: DataTypes.ENUM('admin', 'teacher', 'student', 'system'),
        allowNull: false,
        defaultValue: 'system'
    },
    full_name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    content: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    socket_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Socket ID của connection khi gửi message'
    },
    message_type: {
        type: DataTypes.ENUM('message', 'system'),
        allowNull: false,
        defaultValue: 'message',
        comment: 'Loại message: message (tin nhắn thường) hoặc system (thông báo hệ thống)'
    }
}, {
    tableName: 'support_chat_messages',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
        {
            fields: ['user_id']
        },
        {
            fields: ['role']
        },
        {
            fields: ['created_at']
        },
        {
            fields: ['message_type']
        }
    ]
});

export default SupportChatMessageModel;
