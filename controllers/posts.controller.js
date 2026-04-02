import { text } from "express";
import {PostCommentsModel,PostClassesModel,UserModel,ClassesModel} from "../models/index.model.js";
import { where } from "sequelize";


// Create Post
export const CreatePost = async (req,res) => {
    try{


        const userId = req.userId;
        const {classId,title, post} = req.body;
        const createdPost = await PostClassesModel.create({
            user_id: userId,
            class_id: classId,
            title: title,
            text: post
        })
        
        const result = await PostClassesModel.findByPk(createdPost.id,{
            include: [{ model: UserModel, as: 'author', attributes: ['id', 'fullName'] }]
        })


        return res.status(200).send(result)
        

    }catch(error){
        return res.status(500).send({message: error.message})
    }
}

// Get List Post Of A Class
export const GetPostsClass = async (req,res) => {
    try{
        const classId = req.params.classId;

        const posts = await PostClassesModel.findAll({
            where: {
                class_id: classId
            },
            include:[
                {
                    model: UserModel,
                    as: 'author',
                    attributes: ['id','fullName']
                }
            ],

            order: [['created_at', 'DESC']]
        })

        res.status(200).send(posts);
    }
    catch(error){
        return res.status(500).send(error.message)
    }
}


// Create Comment
export const CreateCommentPost = async (req,res) => {
    try{

        const userId = req.userId;
        const {postId,comment} = req.body

        const createdComment = await PostCommentsModel.create({
            post_id: postId,
            user_id: userId,
            text: comment

        })

        const result = await PostCommentsModel.findByPk(createdComment.id,{
            
            include:[{
                model:UserModel,
                as: 'author',
                attributes: ['fullName']
            }],
            
        })

        return res.status(200).send(result)
        
    }catch(error){
        return res.status(500).send(error.message)
    }
}


// Get Comment of A post
export const GetCommentPost = async(req,res) => {
    try{

        const {postId} = req.params
        

        const comments = await PostCommentsModel.findAll({
            where: {
                post_id: postId
            },

            include: [{
                model:UserModel,
                'as': 'author',
                attributes: ['fullName','email','role']
            }]

        })
        return res.status(200).send(comments)
        
    }catch(error){
        return res.status(500).send(error.message)
    }
}

//delete post

export const DeletePost = async(req,res) => {
    try{

        const {postId} = req.params;

        const deletedPost = await PostClassesModel.destroy({
            where: {
                id: postId
            }
        })

        if(!deletedPost){
            return res.status(404).send("Post Not Found")
        }

        return res.status(200).send("Delete Success Fully")
        
    }catch(error){
        return res.status(500).send(error.message)
    }
}

//deletecomment

export const DeleteComment = async (req, res) => {
    try {
        const { commentId } = req.params;


        const deletedComment = await PostCommentsModel.destroy({
            where: {
                id: commentId
            }
        });


        if (!deletedComment) {
            return res.status(404).send("Comment Not Found");
        }


        return res.status(200).send("Comment Deleted Successfully");

    } catch (error) {
        return res.status(500).send(error.message);
    }
};

//Update Post

export const UpdatePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { title, post } = req.body;


        const existingPost = await PostClassesModel.findByPk(postId);

        if (!existingPost) {
            return res.status(404).send("Post Not Found");
        }

        existingPost.title = title || existingPost.title;
        existingPost.text = post || existingPost.text;


        await existingPost.save();

  
        return res.status(200).send(existingPost);

    } catch (error) {
        return res.status(500).send(error.message);
    }
};