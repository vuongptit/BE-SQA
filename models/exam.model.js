import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const ExamModel = sequelize.define('Exams', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    title: {
        type: DataTypes.STRING,
        allowNull: false
    },
    des: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    total_score: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100
    },
    minutes: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    start_time: {
        type: DataTypes.DATE,
        allowNull: true // Cho phép null khi không giới hạn thời gian
    },
    end_time: {
        type: DataTypes.DATE,
        allowNull: true // Cho phép null khi không giới hạn thời gian
    },
    is_paid: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'User',
            key: 'id'
        }
    },
    is_public: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    count: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    question_creation_method: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
        comment: 'text | editor'
    },
    image_url: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
        comment: 'URL của ảnh đề thi'
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'Exams'
});

export default ExamModel;
