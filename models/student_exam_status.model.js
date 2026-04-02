import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const StudentExamStatusModel = sequelize.define('Student_Exam_Status', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
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
    // Số lần đã làm bài
    attempt_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    // Trạng thái hiện tại: not_started, in_progress, completed
    status: {
        type: DataTypes.ENUM('not_started', 'in_progress', 'completed'),
        allowNull: false,
        defaultValue: 'not_started'
    },
    // Lần đầu làm bài khi nào
    first_attempt_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // Lần cuối làm bài khi nào
    last_attempt_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // Điểm cao nhất đạt được
    best_score: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null
    },
    // Điểm lần cuối
    last_score: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null
    },
    // Phần trăm cao nhất
    best_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: null
    },
    // Phần trăm lần cuối
    last_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: null
    },
    // Thời gian hoàn thành (khi submit lần cuối)
    completed_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    // ID của session đang làm (nếu đang in_progress)
    current_session_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'Exam_sessions',
            key: 'id'
        }
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'Student_Exam_Status',
    indexes: [
        {
            // Unique constraint: mỗi student chỉ có 1 record cho mỗi exam
            unique: true,
            fields: ['student_id', 'exam_id'],
            name: 'unique_student_exam_status'
        },
        {
            fields: ['student_id']
        },
        {
            fields: ['exam_id']
        },
        {
            fields: ['status']
        }
    ]
});

export default StudentExamStatusModel;
