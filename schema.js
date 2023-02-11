const mongoose = require('mongoose')
const {Schema} = mongoose
const moment = require("moment")
// --------------------------------------- SCHEMA SECTION -----------------------------------



// schema for payment webhook
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

// submitting schema into modal of user collection in primeUser database
const newPrimeUser = mongoose.model('user', primeUser);
module.exports = {
	newPrimeUser

}