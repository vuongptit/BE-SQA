import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const ExamSessionModel = sequelize.define('Exam_sessions', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    exam_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Exams',
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
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    start_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    end_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    total_score: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null
    },
    status: {
        type: DataTypes.ENUM('in_progress', 'completed', 'submitted', 'expired'),
        allowNull: false,
        defaultValue: 'in_progress'
    },
    submitted_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    timestamps: false,
    tableName: 'Exam_sessions'
});

export default ExamSessionModel;

