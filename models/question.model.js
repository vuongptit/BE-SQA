import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const QuestionModel = sequelize.define('Questions', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    teacher_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'User',
            key: 'id'
        }
    },
    question_text: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    exam_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Exams',
            key: 'id'
        }
    },
    image_url: {
        type: DataTypes.STRING,
        allowNull: true
    },
    type: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'multiple_choice' // multiple_choice, true_false, short_answer, etc.
    },
    difficulty: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: 'medium' // easy, medium, hard
    },
    order: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'Questions'
});

export default QuestionModel;

