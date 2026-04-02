import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";



const PostClassesModel = sequelize.define('Post_Classes',{
    
    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
    },

    // Only teacher
    user_id:{
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'User',
            key: 'id'
        }
    },

    class_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Classes',
            key: 'id'
        }
    },

    title: {
        type: DataTypes.TEXT,
        allowNull: false
    },

    text: {
        type:DataTypes.TEXT,
        allowNull: false
    }


},{
    timestamps:true,
    createdAt: 'created_at',
    tableName: 'Post_Classes'
}
) 


export default PostClassesModel;