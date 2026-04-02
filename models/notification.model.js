import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const NotificationModel = sequelize.define('Notifications', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    recipient_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'User',
            key: 'id'
        }
    },
    type: {
        type: DataTypes.ENUM(
            'student_joined_class',
            'exam_assigned_to_class',
            'exam_submitted',
            'feedback_updated',
            'exam_reminder'
        ),
        allowNull: false
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    data: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'JSON chứa thông tin chi tiết như class_id, exam_id, student_id, etc.'
    },
    is_read: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    read_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'Notifications'
});

export default NotificationModel;

