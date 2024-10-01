import { User } from "../models/user.model.js";
import {ApiError} from "../utils/ApiError.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import jwt from "jsonwebtoken"

export const verifyJWT = asyncHandler(async(req, res, next) => {
   try {
    console.log(req);
    console.log(req.cookies);
    console.log(req.cookies.accessToken);
     const token = req.cookies?.accessToken || req.header ("Authorization")?.replace("Bearer ", "")

     if(!token) {
         return next(new ApiError(401,"Unauthorized"))
     }
 
     const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
 
     const user =await User.findById(decodedToken?.id).select("-password -refreshToken")
 
     if(!user){
         throw new ApiError(401, "Invalid Access Token")
     }
 
     req.user = user;
     next()
   } catch (error) {
     throw new ApiError(401, error?.message || "Invalid Access Token")
   }
})