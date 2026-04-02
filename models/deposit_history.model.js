import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const DepositHistoryModel = sequelize.define('DepositHistory', {
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
    bankName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    bankAccountName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    bankAccountNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    deposit_status: {
        type: DataTypes.ENUM('pending', 'success', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
    },
    deposit_code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    deposit_type: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'bank'
    },
    deposit_amount: {
        type: DataTypes.DECIMAL(19, 4),
        allowNull: false
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'deposit_history'
});

export default DepositHistoryModel;


