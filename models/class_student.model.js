import { DataTypes } from "sequelize";

import sequelize from "../config/db.config.js";

const ClassStudentModel = sequelize.define('Class_student',{

    id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true
    },

    class_id:{
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Classes',
            key: 'id'
        }
    },

    student_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'User',
            key: 'id'
        }
    },

    joined_at: {
        type:DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },

    is_ban: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
},{
    timestamps:false,
    tableName: 'Class_student',
    indexes: [
        {
          name: 'unique_student_join_class', 
          unique: true,
          fields: ['class_id', 'student_id'] 
        }
      ]
});

export default ClassStudentModel;