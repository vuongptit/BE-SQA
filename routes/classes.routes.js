import { createClass,getClasses,joinClassByCode,GetStudentFromClass,BanStudent,DeleteClass,updateClass } from "../controllers/classes.controller.js";
import { verifyToken,verifyTeacher, verifyStudent } from "../middleware/authJWT.js";


const authClasses = (app) =>{
    //Create class
    app.post('/api/classes',verifyToken,verifyTeacher,createClass)

    //Get all class
    app.get('/api/classes',verifyToken,getClasses)

    //Update class
    app.put('/api/classes/:id',verifyToken,verifyTeacher,updateClass)

    //Join Class
    app.get('/api/classes/join',verifyToken,verifyStudent,joinClassByCode)

    // Get student from class (teacher: full info, student: basic info only)
    app.get('/api/classes/students',verifyToken,GetStudentFromClass)

    // Ban student
    app.post('/api/classes/student/ban',verifyToken,verifyTeacher,BanStudent)

    //Delete class
    app.delete('/api/classes',verifyToken,verifyTeacher,DeleteClass)
}


export default authClasses;