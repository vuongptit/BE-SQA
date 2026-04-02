import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const ExamClassModel = sequelize.define('Exam_Classes', {
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
        },
        onDelete: 'CASCADE'
    },
    class_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Classes',
            key: 'id'
        },
        onDelete: 'CASCADE'
    }
}, {
    timestamps: false,
    tableName: 'Exam_Classes',
    indexes: [
        {
            unique: true,
            fields: ['exam_id', 'class_id'],
            name: 'unique_exam_class'
        },
        {
            fields: ['exam_id']
        },
        {
            fields: ['class_id']
        }
    ]
});

export default ExamClassModel;

