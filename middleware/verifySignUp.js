
import UserModel from "../models/user.model.js";

const CheckDuplicateEmail = async(req,res,next) => {
    try{
        const user = await UserModel.findOne({where: {
            email:req.body.email
        }});

        

        if(user){
            return res.status(400).send({message: 'Email existed'})
        }

        next()
    } catch(error){
        return res.status(500).send({message: "A" + error.message})
    }
}


export default CheckDuplicateEmail;