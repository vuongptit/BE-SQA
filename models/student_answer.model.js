import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const StudentAnswerModel = sequelize.define('Student_answers', {
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
    exam_question_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Questions',
            key: 'id'
        }
    },
    selected_answer_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'Question_answers',
            key: 'id'
        }
    },
    answer_text: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    score: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: null
    },
    answered_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    is_correct: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        defaultValue: null
    }
}, {
    timestamps: false,
    tableName: 'Student_answers'
});

export default StudentAnswerModel;

