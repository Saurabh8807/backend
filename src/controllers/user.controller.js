import {asyncHandler} from "../utils/asyncHandler.js"
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/Cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessAndRefreshTokens = async(userId) => {
    try {
        const user =  await User.findById(userId)
        const accessToken = user.generateAccessToken() ;
        const refreshToken = user.generateRefreshToken(); 
        
        console.log(user)
    console.log("user in generateAccessAndRefreshTokens controller", user);

        user.refreshToken = refreshToken

        await user.save({validateBeforeSave:false})
    
        return {accessToken, refreshToken}
    } catch (error) {
        throw new ApiError(500, "something went wrong while generating access and refresh token")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists : email username
    // check for images  check for avatar
    // upload them to cloudinary , avatar
    // create a new user - create entry in db
    //remove password and refresh token field from response
    // check from user creation 
    // return res

    const { fullName, email, username, password } = req.body;
    console.log(req.body)
    console.log(req.files);

    // if(fullname === ""){
    //     throw new ApiError(400, "fullname cannot be empty")
    // }

    // if([fullname, email, username, password].includes("")){
    //     throw new ApiError(400, "all fields are required")
    // }

    if([fullName, email, username, password].some((field) => field?.trim() === "")){
       throw new ApiError(400, "all fields are required") 
    }

    const existedUser =await User.findOne({
        $or : [
            {username},
            {email}
        ]
    })

    if(existedUser){
        throw new ApiError(409, `user already exists :- ${existedUser}`)
    }

    const avatarLocalpath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage[0]?.path;

    if(!avatarLocalpath){
        throw new ApiError(400, "avatar is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalpath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
    throw new ApiError(400, "avatar is required");
    }

    const user = await User.create({
        fullName,
        email,
        username : username?.toLowerCase()||"",
        password,
        avatar : avatar?.url || "",
        coverImage : coverImage?.url || "",
    })
    
    const createdUser = await User.findById(user._id).select("-password -refreshToken")

    if(!createdUser){
        throw new ApiError(400, "something went wong while creating a user")
    }

    return res.status(201).json(
        new ApiResponse(201, {
         user: createdUser
        }, "user created successfully",)
    )
})

const loginUser = asyncHandler(async (req, res) => {
    // req body -> data
    // username or email
    // find the user 
    // password check
    // send cookie 

    const {username, email, password} = req.body;

    if(!username && !email){
        throw new ApiError(400, "all fields are required")
    }

    const user = await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(401, "user does not exist")

    }

    const isPasswordCorrect =  await user.isPasswordCorrect(password);
    if (!isPasswordCorrect) {
      throw new ApiError(401 , "password incorrect");
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)
    console.log("user in login controller",user)
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly : true,
        secure :true
    }

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(200, {
          user: loggedInUser,
          accessToken: accessToken,
          refreshToken: refreshToken,
        }, "user logged in successfully",)
      );
})

const logoutUser = asyncHandler(async (req, res) => {
    await  User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        }
    )

    const options = {
        httpOnly:true,
        secure:true
    }

    return res
      .status(200)
      .clearCookie("accessToken", options)
      .clearCookie("refreshToken", options)
      .json(new ApiResponse(200, "user logged out successfully"))

})

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken;
    if(!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized Request")
    }

    try {
        const decodedToken = jwt.verify(
          incomingRefreshToken,
          process.env.REFRESH_TOKEN_SECRET
        );
    
        console.log(decodedToken)
    
        const user = await User.findById(decodedToken?._id)
        
        if(!user){
            throw new ApiError(401, "Invalid Request")
        }
    
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly : true,
            secure :true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        return res
          .status(200)
          .cookie("accessToken", accessToken, options)
          .cookie("refreshToken", newRefreshToken, options)
          .json(
            new ApiResponse(
              200,
              {
                user: user,
                accessToken: accessToken,
                refreshToken: newRefreshToken,
              },
              "Access token refresh successfully"
            )
          );
    
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh Token")
    }
})

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const {oldPassword , newPassword} = req.body

    console.log(req)
    console.log(req.user);

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect =  await user.isPasswordCorrect(oldPassword);
    if (!isPasswordCorrect) {
      throw new ApiError(401 , "password incorrect");
    }

    user.password =  newPassword

    await user.save()
    return res
      .status(200)
      .json(
        new ApiResponse(200, {
          user: user
        }, "password changed successfully",)
      );
})

const getCurrentUser = asyncHandler((req,res) => {
    return res
      .status(200)
      .json(
        new ApiResponse(200, {
          user: req.user
        }, "current user fetched successfully",)
      );
})

const updateAccountDetails = asyncHandler(async (req, res) => {
    const {fullName, email } = req.body;

    if(!fullName && !email){
        throw new ApiError(400, "all fields are required")  
    } 
    
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{  
                fullName: fullName,
                email: email
            }
        },{
            new :true
        }
    ).select("-password")

    return res
      .status(200)
      .json(
        new ApiResponse(200, {
          user: user
        }, "account details updated successfully",)
      );
})

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath) {
        throw new ApiError(400, "avatar is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    console.log(avatar)

    if(!avatar) {
        throw new ApiError(500, "something went wrong while uploading avatar")
    }



    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{  
                avatar: avatar.url
            }
        },{
            new :true
        }
    ).select("-password")

    return res
      .status(200)
      .json(
        new ApiResponse(200, {
          user: user
        }, "avatar updated successfully",)
      );
})
 
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "coverImage is required");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  console.log(coverImage);

  if (!coverImage) {
    throw new ApiError(500, "something went wrong while uploading coverImage");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
   .status(200)
   .json(
      new ApiResponse(200, {
        user: user,
      }, "coverImage updated successfully",)
    );
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params

  if (!username?.trim()) {
    throw new ApiError(400, "username is required") 
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields:{
        subscribersCount: {
          $size: "$subscribers"
        },

        channelsSubscribedToCount: {
          $size: "$subscribedTo"
        },

        isSubscribed :{
          $cond:{
            if :{
              $in :[
                req.user?._id,"$subscribers.subscriber"]
            },
            then:true,
            else:false
          }
        }
      }
    },
    {
      $project : {
        fullName : 1,
        username : 1,
        avatar : 1,
        coverImage:1,
        email:1,
        subscribersCount : 1,
        channelsSubscribedToCount : 1,
        isSubscribed : 1
      }
    }
  ]);
  
  if(!channel?.length) {
    throw new ApiError("channel not found", 404)
  }
  console.log(channel)

  return res
    .status(200)
    .json(
      new ApiResponse(200, {
        channel: channel[0]
      }, "channel fetched successfully",)
    );  

})

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateUserCoverImage,
};