
import { DataTypes } from "sequelize";
import sequelize from "../config/db.config.js";
import { genCode } from "../utils/generateClassCode.js";
// define model classes model
const ClassesModel = sequelize.define('Classes', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
            
        },
        className: {
            type: DataTypes.STRING,
            allowNull:false

        },

        teacher_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'User',
                key: 'id'
            }
        },
        
        classCode:{
            type: DataTypes.STRING(10),
            allowNull: false,
            unique: true

        }
    },{
        timestamps: true,
        createdAt: 'created_at',
        updatedAt:false,
        tableName: 'Classes',
        
        //Hooks kiem tra truoc khi tao class gen code xem co bi trung khong?
        hooks: {
            beforeValidate: async (classInstance, options) => {

                if(classInstance.isNewRecord){

                    let code;;
                    let iscodeUnique = false;
                    
                    while(!iscodeUnique){
                        code = genCode(6).toUpperCase();
                        const exsistingCode = await ClassesModel.findOne({where: {classCode: code}});
                        if(!exsistingCode){
                            classInstance.classCode = code
                            break;
                        }
                    }

                }
            }
        }
    })

export default ClassesModel;