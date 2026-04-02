import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const RecentLoginModel = sequelize.define('recent_logins', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: { model: 'User', key: 'id' } 
    },

    device: {
        type: DataTypes.STRING, 
        allowNull: true,
    },

    ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
    },
  
    location: {
        type: DataTypes.STRING,
        allowNull: true,
    },
  
    login_time: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW, 
        allowNull: false
    }
}, {

    tableName: 'recent_logins', 
    timestamps: false, 
});

export default RecentLoginModel;