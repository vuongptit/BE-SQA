import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const ExamResultModel = sequelize.define('Exam_results', {
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
    total_score: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    correct_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    wrong_count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    submitted_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    status: {
        type: DataTypes.ENUM('pending', 'graded', 'reviewed', 'finalized'),
        allowNull: false,
        defaultValue: 'graded'
    },
    feedback: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
    }
}, {
    timestamps: false,
    tableName: 'Exam_results'
});

export default ExamResultModel;

