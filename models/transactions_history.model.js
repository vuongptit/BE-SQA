import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const TransactionHistoryModel = sequelize.define('TransactionHistory', {
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
    transactionType: {
        type: DataTypes.ENUM('deposit', 'withdraw', 'purchase', 'adjustment'),
        allowNull: false
    },
    referenceId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Liên kết tới bảng giao dịch gốc (deposit/withdraw/purchase)'
    },
    amount: {
        type: DataTypes.DECIMAL(19, 4),
        allowNull: false
    },
    beforeBalance: {
        type: DataTypes.DECIMAL(19, 4),
        allowNull: false
    },
    afterBalance: {
        type: DataTypes.DECIMAL(19, 4),
        allowNull: false
    },
    transactionStatus: {
        type: DataTypes.ENUM('pending', 'success', 'failed'),
        allowNull: false,
        defaultValue: 'success'
    },
    transferType: {
        type: DataTypes.STRING,
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Nội dung giao dịch'
    }
}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    tableName: 'transactions_history'
});

export default TransactionHistoryModel;


