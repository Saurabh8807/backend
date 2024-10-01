import dotenv from "dotenv"
import connectDB from "./db/index.js"
import {app} from "./app.js"

dotenv.config({
    path: "./env",
});

connectDB()
.then(() => {
    app.listen(process.env.PORT || 8000, () => {
        console.log("server is runing listening on port", process.env.PORT);
    })
}).catch((error) => {
    console.log("mongodb connection failed", error);
})





















// import mongoose from "mongoose";
// import {DB_NAME}  from "./constants.js";

// import express from "express";
// const app = express();

// (async () => {
//     try {
//         await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`);
//         console.log("Connected to MongoDB");
        
//         app.on("error", (error) => {
//             console.log("Error connecting to express", error);
//         });
//         app.listen(process.env.PORT, () => {
//             console.log("Listening on port", process.env.PORT);
//         })
//     } catch (error) {
//        console.log("Error connecting to MongoDB", error); 
//     }
// })