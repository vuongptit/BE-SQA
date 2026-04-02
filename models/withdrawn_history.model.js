import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const WithdrawHistoryModel = sequelize.define('WithdrawHistory', {
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
        allowNull: false,
        field: 'bankName'
    },
    bankAccountName: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'bankAccountName'
    },
    bankAccountNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        field: 'bankAccountNumber'
    },
    amount: {
        type: DataTypes.DECIMAL(19, 4),
        allowNull: false
    },
    withdraw_code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending'
    },
    admin_note: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    reject_reason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    processed_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'User',
            key: 'id'
        }
    },
    processed_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'withdrawn_history',
    underscored: false
});

export default WithdrawHistoryModel;


