import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const ExamCheatingLogModel = sequelize.define('Exam_cheating_logs', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    session_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Exam_sessions',
            key: 'id'
        }
    },
    student_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'User',
            key: 'id'
        }
    },
    exam_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Exams',
            key: 'id'
        }
    },
    cheating_type: {
        type: DataTypes.ENUM(
            'tab_switch',           // Chuyển tab
            'window_blur',          // Mất focus cửa sổ
            'fullscreen_exit',      // Thoát chế độ toàn màn hình
            'copy_paste',           // Copy/Paste
            'right_click',          // Click chuột phải
            'keyboard_shortcut',    // Phím tắt (Ctrl+C, Ctrl+V, etc.)
            'multiple_tabs',        // Nhiều tab cùng lúc
            'time_suspicious',      // Thời gian trả lời bất thường
            'answer_pattern',       // Mẫu trả lời bất thường
            'device_change',        // Thay đổi thiết bị
            'ip_change',            // Thay đổi IP
            'browser_change',       // Thay đổi trình duyệt
            'other'                 // Hành vi gian lận khác
        ),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        // Lưu thông tin chi tiết như: IP address, User Agent, timestamp, etc.
    },
    severity: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'critical'),
        allowNull: false,
        defaultValue: 'medium'
    },
    detected_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    timestamps: false,
    tableName: 'Exam_cheating_logs',
    indexes: [
        {
            fields: ['session_id']
        },
        {
            fields: ['student_id']
        },
        {
            fields: ['exam_id']
        },
        {
            fields: ['cheating_type']
        },
        {
            fields: ['detected_at']
        }
    ]
});

export default ExamCheatingLogModel;

