import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const ExamFavoriteModel = sequelize.define('Exam_favorites', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
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
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'Exam_favorites',
    indexes: [
        {
            unique: true,
            fields: ['user_id', 'exam_id'],
            name: 'unique_user_exam_favorite'
        }
    ]
});

export default ExamFavoriteModel;

