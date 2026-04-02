import jwt from "jsonwebtoken";

import authConfig from "../config/auth.config.js";


export const verifyToken = (req,res,next) => {
   
    let token = req.headers['authorization'];


    if (!token || !token.startsWith('Bearer ')){
        return res.status(403).send({message: "Token authorization not valid"})
    }

    token = token.slice(7,token.length);

    jwt.verify(token,authConfig.secret,(err,decoded) => {
        if (err){
            return res.status(404).send({messgae: "Token expried or not valid"})
        }
        
        console.log(decoded)
        req.userId = decoded.id;
        req.role = decoded.role
        next();

    })


}


export const verifyTeacher = (req, res, next) => {
    
    if (req.role !== 'teacher'){
        return res.status(403).send({message: 'This action need role teacher'});
    }

    next();
}


export const verifyStudent = (req,res,next) => {
    if(req.role !== 'student'){
        return res.status(403).send({messgae: 'This action need role student'});
    }

    next();
}

// Verify admin
export const verifyAdmin = (req, res, next) => {
    if (req.role !== 'admin') {
        return res.status(403).send({message: 'This action requires admin privileges'});
    }

    next();
}

export const verifyTeacherOrAdmin = (req, res, next) => {
    if (req.role !== 'teacher' && req.role !== 'admin') {
        return res.status(403).send({message: 'This action requires teacher or admin privileges'});
    }

    next();
}



