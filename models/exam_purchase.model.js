import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const ExamPurchaseModel = sequelize.define('ExamPurchase', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false

    },
    exam_id: {
        type: DataTypes.INTEGER,
        allowNull: false

    },
    purchase_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    purchase_date: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    timestamps: false,
    tableName: 'ExamPurchase',
    indexes: [
        // Removed unique constraint to allow multiple purchases (pay-per-attempt)
        {
            unique: false,
            fields: ['user_id', 'exam_id']
        }
    ]
});

export default ExamPurchaseModel;

