const mongoose = require('mongoose')
const {Schema} = mongoose
const moment = require("moment")
// --------------------------------------- SCHEMA SECTION -----------------------------------
// creating schema for movie post
const moviePost =  new Schema({
	imdbID:String,
	fileID:String,
	owner:{type:Number,default:3}   //note 3 is default because 3 is the id of superUser "juffler"
})
const seriesPost = new Schema({
	imdbID:String,
	episodesImdbIds:{type:[String],default:[]},
	filesID:{type:[String],default:[]},
	owner:{type:Number,default:3}
})
// submitting schema into modal of posts collection of moviesPost database
const newMoviePost = mongoose.model('post', moviePost);

// schema for payment webhook me 
const primeUser =  new Schema({
	paymentDetails:{type:[Object],required:true},  //this payment id provided by payu to track transactions 
	transactionDetails:{type:[Object],required:true},
	email:{type:String,required:true},
	deviceId:{type:String,default:""},
	wishList:{type:[String],default:[]},
	amount:Number,
	expireAt:{type:Date,default:undefined},
	createdAt:{type:String,default:String(moment().format())}
})
// making exireAt field get expire with date time 
// primeUser.index({"expireAt":1},{expireAfterSeconds:0})
// submitting schema into modal of user collection in primeUser database
const newPrimeUser = mongoose.model('user', primeUser);
module.exports = {
	newMoviePost,
	newPrimeUser
}