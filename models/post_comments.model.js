import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";

const PostCommentsModel = sequelize.define('Post_comments', {

    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        primaryKey: true,
        autoIncrement: true
    },

    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'User',
            key: 'id'
        }
    },

    post_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Post_Classes',
            key: 'id'
        }
    },

    text: {
        type: DataTypes.TEXT,
        allowNull: false
    }

}, {
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    tableName: 'Post_comments'
});

export default PostCommentsModel;
