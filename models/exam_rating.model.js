import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const ExamRatingModel = sequelize.define('Exam_ratings', {
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
    },
    rating: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: {
            min: 1,
            max: 5
        },
        comment: 'Rating từ 1 đến 5 sao'
    },
    comment: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Nhận xét về bài thi'
    },
    result_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'Exam_results',
            key: 'id'
        },
        comment: 'ID của kết quả thi (để biết đánh giá sau khi thi xong)'
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'Exam_ratings',
    indexes: [
        {
            unique: true,
            fields: ['user_id', 'exam_id'],
            name: 'unique_user_exam_rating'
        }
    ]
});

export default ExamRatingModel;

