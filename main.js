const express = require('express')
const moment = require('moment')
const mongoose = require('mongoose')
const path = require('path')
const axios = require('axios')
const fs = require("fs")

const {
	Schema
} = mongoose
// some local files 
const auth = require(path.join(__dirname, '/credentials/auth'))
const {
	createInvoice
} = require(path.join(__dirname, '/invoicePdf.js'))
const {
	sendMail,defaultTemplate,
	generateHeader,
	createSuccessAccountmailTemp,
	technicalIssue,
	planeNotExists
} = require(path.join(__dirname, '/sendMail.js'))
const {
	newMoviePost,
	newPrimeUser
} = require(path.join(__dirname, '/schema.js'))
const subscriptionModle = require(path.join(__dirname, '/credentials/subscriptionModle'))


// connection to data base 
async function connection() {
	await mongoose.connect(auth.DATABASEURI)
}
connection().catch(err => console.log(`Hey JUFFLER this is database connectin error :${err}`))

// specific variables 
const App = express()
const port = process.env.PORT || 3000


// ------------------------------Some middlewares ----------------------
// urlencoder is for using req.body parameter 
App.use(express.urlencoded({
	extended: false
}))
App.use(express.json())
App.use(express.static("assets"))
// utility function 
function getSubscriptionPlane(amount, email) {
	for (let [payedAmount, days] of Object.entries(subscriptionModle)) {
		if (amount % payedAmount == 0) {
			console.log(`days added ${amount / payedAmount * days} to account with email ${email}`)
			return amount / payedAmount * days
		} else {
			//pass
		}
	}
	return null
}
function remainingDays(date) {
	eventDate = moment(date)
	leftDays = eventDate.diff(moment(), "days")
	if (leftDays < 0) {
		return 0
	} else {
		return leftDays
	}
}
// end utility functions 

//------------------------- primeUser API Routs webhook----------------------------------
// create user and save payment is same 
App.post("/savePayment/:key", async (req, res) => {
	try {
		if (req.params.key === auth.key) {
			data = req.body
			if (data.status == "success") {
				// checking transactionid must not already exists in database 
				transactionAlreadyExists = await newPrimeUser.findOne({
					transactionDetails: {
						$elemMatch: {
							transactionId: data.txnid
						}
					}
				}).exec()
				if (transactionAlreadyExists || null) {
					// sending mail to user (customer)
					sendMail(data.email, "Payment is received but Account status not updated ", html = defaultTemplate(subject="Payment is received but Account status not updated",name=data.email.split("@")[0], email=data.email,header=generateHeader(subject="TECHNICAL_ISSUE",data.email),footer="We are sorry for this unconvenience"))
					// sending mail to primeArchive owner 
					sendMail(auth.superMail, "receive existing TransactionId", html = `Payment is received for ${data.email} but account status has not been  update because transactionId already exists in database please make Full api request using endpoint : /savePayment with proper parameters`)
					console.log(`payment received but transactionid already exists email is : ${data.email.toLowerCase()}`)
					return res.json({
						"status": false
					})
				} else {
					// cheking if plane is avalable 
					planeDays = getSubscriptionPlane(data.amount, data.email)
					if (planeDays) {
						existance = await newPrimeUser.findOne({
							"email": data.email.toLowerCase()
						}).exec()
						if (!existance) {
							const newPaidUser = newPrimeUser({
								paymentDetails: {
									"paymentId": data.mihpayid,
								}, //this payment id provided by payu to track transactions 
								transactionDetails: {
									"transactionId": data.txnid,
									"transactionDate": moment().format("DD/MM/YYYY HH:mm"),
									"transactionAmount": data.amount,
									"subscription": [moment().format("DD/MM/YYYY"), moment().add(planeDays, "days").format("DD/MM/YYYY")]
								},
								email: data.email.toLowerCase(),
								deviceId: data.deviceId,
								wishList: data.wishList,
								amount: data.amount,
								expireAt: moment().add(planeDays, "days")
							})
							newPaidUser.save((err, doc) => {
								if (!err) {
									console.log("new  PrimeUser listed successFully ", doc)
									// generating invoice 
									identifier = {
										"transactionId": data.txnid
									}
									createInvoice(identifier, fileName = data.txnid, async (problem, pdf) => {
										if (problem) {
											sendMail(auth.superMail, "Application error", problem)
											console.log(problem)
										} else {
											// sending invoice email to user 
											sendMail(to = doc.email,
												subject = "Account created successFully",
												html = defaultTemplate(subject="Account created successFully",name=doc.email.split("@")[0], email=doc.email,header=generateHeader("ACCOUNT_CREATED",doc.email),footer="Download invoice below to see your transaction detials"),

												attachments = [{
													filename: "invoice.pdf",
													path: pdf
												}],
												(err)=>{
													if(err){
														console.log(err)
													}else{
														//pass
													}
												}
											)
											// sending invoice copy to our supermail address 
											sendMail(to = auth.superMail,
												subject = "Notify new account",
												html = defaultTemplate(subject="Notify new account",name="Owner",email=doc.email,header=generateHeader("ACCOUNT_CREATED",doc.email),footer="Download invoice below to see your transaction detials"),

												attachments = [{
													filename: "invoice.pdf",
													path: pdf
												}],
												(err)=>{
													if(err){
														console.log(err)
													}else{
														// deleting invoice from server 
														fs.unlink(pdf,(err)=>{
															if(err){
																console.log('unable to delete temporary invoice files it might not in existance')
															}else{
																console.log('One Temp invoice file removed ')
															}
														})
													}
												}
											)

										}
									})

									return res.json({
										"status": true
									})
								} else {
									console.log("new User not listed because : ", err)
									sendMail(data.email,"Account not created",technicalIssue(data.email.split("@")[0],data.email))
									sendMail(auth.superMail, "Unable to save document in database",html=`Unable to save document in database. newPaidUser is not saved with email : ${data.email}`)
									return res.json({
										"status": false
									})
								}
							})
						} else {
							newPrimeUser.updateOne({
								_id: existance._id
							}, {
								expireAt: moment().add(remainingDays(existance.expireAt)+planeDays,"days"),
								amount: existance.amount + parseInt(data.amount),
								$push: {
									paymentDetails: {
										"paymentId": data.mihpayid,
									},
									transactionDetails: {
										"transactionId": data.txnid,
										"transactionDate": moment().format("DD/MM/YYYY HH:mm"),
										"transactionAmount": data.amount,
										"subscription": [moment().add(remainingDays(existance.expireAt),"days").format("DD/MM/YYYY"), moment().add(remainingDays(existance.expireAt)+planeDays,"days").format("DD/MM/YYYY")]
									}
								}
							},
								(err) => {
									if (!err) {
										console.log(`More ${planeDays} days has been added to ${existance.email} email address`)
										// generating invoice 
									identifier = {
										"transactionId": data.txnid
									}
									createInvoice(identifier, fileName = data.txnid, (problem, pdf) => {
										if (problem) {
											sendMail(auth.superMail, "Application error", problem)
											console.log(problem)
										} else {
											// sending invoice email to user 
											sendMail(to = existance.email,
												subject = "Subscription upgraded successFully",
												html = defaultTemplate(subject="Subscription upgraded successFully",name=existance.email.split("@")[0],email=existance.email,header=generateHeader(subject="SUBSCRIPTION_UPGRADED",email=existance.email,extras={"planeDays":planeDays}),footer="Download invoice below to see your transaction detials"),
												attachments = [{
													filename: "invoice.pdf",
													path: pdf
												}],
												(err)=>{
													if(err){
														console.log(err)
													}else{
														//pass
													}
												}
											)
											// sending invoice copy to our supermail address 
											sendMail(to = auth.superMail,
												subject = "Notify subscription upgraded",
												html = defaultTemplate(subject="Notify subscription upgraded",name="Owner",email=existance.email,header=generateHeader("SUBSCRIPTION_UPGRADED",existance.email,extras={planeDays}),footer="Download invoice below to see your transaction detials"),
												attachments = [{
													filename: "invoice.pdf",
													path: pdf
												}],
												(err)=>{
													if(err){
														console.log(err)
													}else{
														// deleting invoice from server 
														fs.unlink(pdf,(err)=>{
															if(err){
																console.log('unable to delete temporary invoice files it might not in existance')
															}else{
																console.log('One Temp invoice file removed ')
															}
														})
													}
												}
											)

										}
									})
										return res.json({
											"status": true
										})
									} else {
										console.log("New subscription failed ", err)
										return res.json({
											"status": false
										})
									}
								})

						}

					}else {
						// if plane is not avalable 
						// notify user that he/she tooks non existing subscription plane 
						sendMail(data.email, "Plane does not exists", html = defaultTemplate(subject="Plane does not exists",name=data.email.split('@')[0],email=data.email,header=generateHeader(subject="PLANE_NOT_EXISTS",data.email),footer="Sorry for unconvenience"))
						// notify admin of prime archive 
						sendMail(auth.superMail, "Unknown amount payed", html = `Somehow user with email ${data.email} have bought non existing subscription plane check Contact us form for more info`)
						console.log(`user with email: ${data.email.toLowerCase()} exedienty bought non-existing subscription`)
						return res.json({
							"status": false
						})
					}
				}
			}
			 else {
				console.log(`payment not received for ${data.email.toLowerCase()}`)
				return res.json({
					"status": false
				})
			}
		} else {
			return res.json({
				"status": false,
				"description": "your auth key is wrong "
			})
		}
	} catch (e) {
		console.log("server error JUFFLER:", e);
		return res.json({
			"status": false,
			"description": "Some error in server read docs or contact JUFFLER"
		})
	}
})
// api for creating invoice from transactionId or email 
App.get("/getInvoice/:key",async (req,res)=>{
	try {
		if(req.params.key === auth.key){
			data = req.query
			if(data.transactionId){
				identifier = {
					"transactionId":data.txnid
				}
				createInvoice(identifier,
					data.txnid,
					(problem,pdf)=>{
						if(problem){
							return res.json({"status":false,"description":problem})
						}else{
							const stream = fs.createReadStream(pdf)
							res.setHeader("Content-Type","applicaiton/pdf")
							res.setHeader("Content-Disposition",'attachment; filename="invoice.pdf"')
							stream.pipe(res)
						}
						fs.unlink(pdf,(err)=>{
							if(err){
								console.log(err)
							}else{
								console.log('One temp invoice deleted')
							}
						})
					}
				)
			}else if(data.email){
				identifier={
					"email":data.email
				}
				createInvoice(identifier,
					data.email,
					(problem ,pdf)=>{
						if(problem){
							return res.json({"status":false,"description":problem})
						}else{
							const stream = fs.createReadStream(pdf)
							res.setHeader("Content-Type","applicaiton/pdf")
							res.setHeader("Content-Disposition",'attachment; filename="invoice.pdf"')
							stream.pipe(res)
						}
						fs.unlink(pdf,(err)=>{
							if(err){
								console.log(err)
							}else{
								console.log('One temp invoice deleted')
							}
						})
					}
				)

			}
			else{
				return res.json({"status":false,"description":"transactionId ya email both  is not provided"})
			}
		}else{
			return res.json({"status":false,"description":"your auth key is wrong"})
		}
	} catch(e) {
		// statements
		console.log(e);
	}
})
//making invoices excel file for payu (payment gateway company ) 
App.get("/needInvoices/:key",async (req,res)=>{
	try {
		if(req.params.key === auth.key){
			return res.json({"status":true,"description":"this api is under development for now "})
		}else{
			return res.json({"status":false,"description":"your auth key is wrong"})
		}
	} catch(e) {
		// statements
		console.log(e);
	}
})
// read users  
App.post("/readUser/:key", async (req, res) => {
	try {
		if (req.params.key === auth.key) {
			data = req.body
			existance = await newPrimeUser.findOne({
				"email": data.email.toLowerCase()
			}).exec()
			if (!existance) {
				return res.json({
					"status": false,
					"description": "use with email does not exists"
				})
			} else {
				return res.json({
					"status": true,
					"data": existance
				})
			}
		} else {
			return res.json({
				"status": false,
				"description": "your auth key is wrong "
			})
		}

	} catch (e) {
		// statements
		console.log(e);
		return res.json({
			"status": false,
			"description": "Your request method is wrong read docs"
		})
	}
})

// checkApi checks takes email and device id as body parameter and set device id according to email basically this should called every time when use login to the app
// parameters email , deviceId
App.post("/checkApi", async (req, res) => {
	try {
		data = req.body
		existance = await newPrimeUser.findOne({
			"email": data.email.toLowerCase()
		}).exec()
		if (!existance) {
			return res.json({
				"status": 0,
				"description": "user has no account"
			})
		} else {
			if(remainingDays(existance.expireAt) == 0){
				// resetting deviceid
				existance.deviceid = ""
				return res.json({
							"status": 3,
							"expireAt":moment(existance.expireAt).format("DD/MM/YYYY"),
							"description": "Subscription has been expired"
						})
			}else{
				if (existance.deviceId == "" || existance.deviceId == data.deviceId) {
					newPrimeUser.updateOne({
						_id: existance._id
					}, {
						"deviceId": data.deviceId
					}, (err, data) => {
						if (!err) {
							console.log(`User ${existance.email} is logged in`)
							return res.json({
								"status": 1,
								"description": "device id is added successFully or same as previously"
							})
						} else {
							console.log(`Database error to update deviceId for ${existance.email} address`)
							return res.json({
								"status": 4,
								"description": "Database error to update deviceId"
							})
						}
					})
				} else {
					console.log(`DeviceId already exists which is different for ${existance.email}`)
					return res.json({
						"status": 2,
						"description": `DeviceId already exists which is different for ${existance.email}`
					})
				}
			}
		}

	} catch (e) {
		// statements
		console.log(e);
		return res.json({
			"status": false,
			"description": "Your request method is wrong read docs"
		});
	}

})
// logout method takes key as parameter and take email as query and then remove deviceId from that account 

// parameters are   email ,deviceId
App.post("/logout/:key", async (req, res) => {
	try {
		data = req.body
		if (req.params.key === auth.key) {
			existance = await newPrimeUser.findOne({
				"email": data.email.toLowerCase()
			}).exec()
			if (!existance) {
				return res.json({
					"status": false,
					"description": `No premium account found with ${data.email.toLowerCase()}`
				})
			} else {
				if (existance.deviceId.trim().length === 0) {
					return res.json({
						"status": false,
						"description": `${data.email.toLowerCase()} address is not logged in any device please login first `
					})
				} else {
					if (existance.deviceId == data.deviceId) {
						newPrimeUser.updateOne({
							_id: existance._id
						}, {
							"deviceId": ""
						}, (err, data) => {
							if (!err) {
								console.log(`Device logout success for ${existance.email}`)
								return res.json({
									"status": true,
									"description": "device is logged out successFully"
								})
							} else {
								console.log(`Database error to logout deviceId for ${existance.email} address`)
								return res.json({
									"status": false,
									"description": "Database error to logout deviceId"
								})
							}
						})
					} else {
						return res.json({
							"status": false,
							"description": "Your device id is not as same as in database"
						})
					}

				}
			}
		} else {
			return res.json({
				"status": false,
				"description": "Yout can't access api without key"
			})
		}
	} catch (e) {
		console.log(e);
		return res.json({
			"status": false,
			"description": "Some error happen you are requesting it right "
		})

	}

})
// -----------------routs for crud operations in posts collection of moviesPost database it is movie smug api's-----------
// default gateway 
App.get("/", async (req, res) => {
	res.json({
		"status": "running"
	})
})

// Creating posts 
App.post('/create/:key', async (req, res) => {
	try {
		data = req.body
		if (req.params.key === auth.key) {
			nextExistance = await newMoviePost.findOne({
				"next": data.next
			}).exec()
			previousExistance = await newMoviePost.findOne({
				"previous": data.previous
			}).exec()
			if (nextExistance) {
				return res.json({
					"status": false,
					"description": `Next Id is already set for movie named: ${nextExistance.name}`
				})
			} else if (previousExistance) {
				return res.json({
					"status": false,
					"description": `Previous Id is already set for movie named: ${previousExistance.name}`
				})
			} else {
				if (data.releaseDate) {
					const newPost = newMoviePost({
						type: data.type,
						name: data.name,
						size: data.size,
						image: data.image,
						caption: data.caption,
						releaseDate: data.releaseDate,
						movieID: data.movieID,
						next: data.next,
						previous: data.previous,
						isSeries: data.isSeries,
						skip: data.skip,
						owner: data.owner


					})
					newPost.save((err, doc) => {
						if (!err) {
							return res.json({
								"status": true,
								"description": `Movie post successFully saved  with ${doc} details `
							})
						} else {
							console.log(`Error while saving movie post  ${err}`)
							return res.json({
								"status": false,
								"description": `ERROR whiles saving : ${err}`
							})
						}
					})
				} else {
					const newPost = newMoviePost({
						type: data.type,
						name: data.name,
						size: data.size,
						image: data.image,
						caption: data.caption,
						movieID: data.movieID,
						next: data.next,
						previous: data.previous,
						isSeries: data.isSeries,
						skip: data.skip,
						owner: data.owner
					})
					newPost.save((err, doc) => {
						if (!err) {
							return res.json({
								"status": true,
								"description": `Movie post successFully saved  with ${doc} details `
							})
						} else {
							console.log(`Error while saving movie post  ${err}`)
							return res.json({
								"status": false,
								"description": `ERROR whiles saving : ${err}`
							})
						}
					})

				}
			}
		} else {
			return res.json({
				"status": false,
				"description": "you must pass key as a parameter"
			})
		}
	} catch (e) {

		console.log(e);
		return res.json({
			"status": false,
			"description": "Your request method is wrong read docs"
		})
	}

})
App.get('/getOwnerMovies/:key', async (req, res) => {
	// try {
	if (req.params.key === auth.key) {
		const data = req.query
		if (data.owner) {
			ownerMovies = await newMoviePost.find({
				"owner": data.owner
			}).sort({
				_id: -1
			}).exec()
			simplifiedMoviesList = JSON.parse(JSON.stringify(ownerMovies))
			// setting default value of Movies list 
			MoviesList = simplifiedMoviesList
			// if user requesting for data after a specific index in that case 
			if (data.afterIndex) {
				MoviesList = simplifiedMoviesList.filter(element => {
					if (simplifiedMoviesList.indexOf(element) > data.afterIndex) {
						return true
					} else {
						return false
					}
				})
			}
			// if user request for data before specific index 
			if (data.beforeIndex) {
				// and after index is also mentioned 
				if (data.afterIndex) {
					MoviesList = MoviesList.filter(element => {
						if (simplifiedMoviesList.indexOf(element) < data.beforeIndex) {
							return true
						} else {
							return false
						}
					})
				} else {
					MoviesList = simplifiedMoviesList.filter(element => {
						if (simplifiedMoviesList.indexOf(element) < data.beforeIndex) {
							return true
						} else {
							return false
						}
					})
				}
			}
			// if User need all data after and before is defigned 
			return res.json({
				"status": true,
				"data": MoviesList
			})
			// return res.json({"status":true,"data":simplifiedMoviesList})
		} else {
			return res.json({
				"status": false,
				"description": "Owner id is not provided"
			})
		}

	} else {
		return res.json({
			"status": false,
			"description": "Key is wrong"
		})
	}
	// } 
	// catch(e) {
	// 	console.log(e);
	// }
})
// reading posts 
App.post('/read/:key', async (req, res) => {
	try {
		if (req.params.key === auth.key) {
			// getting headers 
			const data = req.body
			var contentList = []
			console.log("data", data)
			// if both email and deviceId is given in headers 
			if (data.email.toLowerCase() && data.deviceId) {
				// checking existance of user 
				existance = await newPrimeUser.findOne({
					"email": data.email.toLowerCase()
				}).exec()
				if (existance && existance.deviceId == data.deviceId) {
					if (data.id) {
						newMoviePost.findById(data.id, (err, doc) => {
							if (!err) {
								return res.json({
									"status": true,
									"data": doc
								})
							} else {
								console.log(err)
								return res.json({
									"status": false,
									"description": "No id found. But you can still contact JUFFLER"
								})

							}
						})
					} else {
						if (data.isSeries == true) {
							// -----------------------------------------including Series ---------------------------
							// getting data from various parameters 
							if (data.type) {
								// if data.type is like this {"type":["anime","jumanju"]}
								if (data.type instanceof Array) {
									const dataFromTypeAndName = await newMoviePost.find({
										"type": data.type[0],
										"name": {
											"$regex": data.type[1],
											"$options": "i"
										}
									}).sort({
										releaseDate: 'descending'
									}).exec()
									contentList = contentList.concat(JSON.parse(JSON.stringify(dataFromTypeAndName)))
								} else {
									const dataFromType = await newMoviePost.find({
										"type": data.type
									}).sort({
										releaseDate: 'descending'
									}).exec()
									contentList = contentList.concat(JSON.parse(JSON.stringify(dataFromType)))
								}
							}
							if (data.name) {
								const dataFromName = await newMoviePost.find({
									"name": {
										"$regex": data.name,
										"$options": "i"
									}
								}).sort({
									releaseDate: 'descending'
								}).exec()
								contentList = contentList.concat(JSON.parse(JSON.stringify(dataFromName)))
							}
							// if no filter seach is not used so adding all data 
							if (!data.type && !data.name && !data.id) {
								// else reading all posts 
								const allData = await newMoviePost.find().sort({
									releaseDate: 'descending'
								}).exec()
								contentList = contentList.concat(JSON.parse(JSON.stringify(allData)))
							}
						} else {
							// --------------------excluding series ---------------------------
							// getting data from various parameters 
							if (data.type) {
								// if data.type is like this {"type":["anime","jumanju"]}
								if (data.type instanceof Array) {
									const dataFromTypeAndName = await newMoviePost.find({
										"isSeries": false,
										"type": data.type[0],
										"name": {
											"$regex": data.type[1],
											"$options": "i"
										}
									}).sort({
										releaseDate: 'descending'
									}).exec()
									contentList = contentList.concat(JSON.parse(JSON.stringify(dataFromTypeAndName)))
								} else {
									const dataFromType = await newMoviePost.find({
										"isSeries": false,
										"type": data.type
									}).sort({
										releaseDate: 'descending'
									}).exec()
									contentList = contentList.concat(JSON.parse(JSON.stringify(dataFromType)))
								}
							}
							if (data.name) {
								const dataFromName = await newMoviePost.find({
									"isSeries": false,
									"name": {
										"$regex": data.name,
										"$options": "i"
									}
								}).sort({
									releaseDate: 'descending'
								}).exec()
								contentList = contentList.concat(JSON.parse(JSON.stringify(dataFromName)))
							}
							// if no filter seach is not used so adding all data 
							if (!data.type && !data.name) {
								// else reading all posts 
								const allData = await newMoviePost.find({
									"isSeries": false
								}).sort({
									releaseDate: 'descending'
								}).exec()
								console.log("giving all data")
								contentList = contentList.concat(JSON.parse(JSON.stringify(allData)))
							}
						}

						// removing duplicates from contentList
						const uniqueIds = []
						const filteredContentList = contentList.filter(element => {
							const isDuplicated = uniqueIds.includes(element._id)
							if (!isDuplicated) {
								uniqueIds.push(element._id)
								return true
							}
							return false
						})

						// checking if we get any data 
						if (filteredContentList.length == 0) {
							return res.json({
								"status": false,
								"description": "NO results found for your search Query. May be your database is empty Try make request with no filter parameters"
							})
						} else {
							return res.json({
								"status": true,
								"data": filteredContentList,
								"size": filteredContentList.length
							})
						}
					}
				} else {
					return res.json({
						"status": false,
						"description": "your provided email and deviceid combination not found in database"
					})
				}
			} else {
				return res.json({
					"status": false,
					"description": "you have to pass email and deviceId to read movies data"
				})
			}
		} else {
			return res.json({
				"status": false,
				"description": "provided Key is not right"
			})
		}
	} catch (e) {
		// statements
		console.log(e);
		return res.json({
			"status": false,
			"description": "Some error with Api contact JUFFLER"
		})

	}
})
App.put("/update/:key", async (req, res) => {
	try {
		data = req.body
		if (req.params.key === auth.key) {
			if (data.id) {
				if (data.fields) {
					// making python string to json 
					const toUpdateFields = JSON.parse(data.fields)
					const newDocument = await newMoviePost.findByIdAndUpdate(data.id, {
						"$set": toUpdateFields
					}).exec()
					return res.json({
						"status": true,
						"description": `field  is updated to ${newDocument}`
					})
				} else {
					return res.json({
						"status": false,
						"description": `field  is ${data.fields}. Please provide some fields to update e.g {"name":"Some new name"}`
					})
				}
			} else {
				return res.json({
					"status": false,
					"description": "you must pass Id to update in body (data)"
				})
			}
		} else {
			return res.json({
				"status": false,
				"description": "you must pass key as a parameter"
			})
		}
	} catch (e) {
		// statements
		console.log(e);
		return res.json({
			"status": false,
			"description": "Your request method is wrong read docs"
		})
	}
})
App.delete('/deleteOne/:key', async (req, res) => {
	try {
		data = req.body
		if (req.params.key === auth.key) {
			if (data.id) {
				newMoviePost.findByIdAndDelete(data.id, (err, doc) => {
					if (!err) {
						return res.json({
							"status": true,
							"description": `ho gya delete ya : ${doc}`
						})
					} else {
						console.log(err)
						return res.json({
							"status": false,
							"description": "Your given id looks wrong. But you can still contact JUFFLER for more details"
						})
					}
				})
			} else {
				return res.json({
					"status": false,
					"description": "you must pass Id to delete for in body (data)"
				})
			}
		} else {
			return res.json({
				"status": false,
				"description": "you must pass key as a parameter"
			})
		}
	} catch (e) {
		// statements
		console.log(e);
		return res.json({
			"status": false,
			"description": "Your request method is wrong read docs"
		})
	}
})
// advance operation functions 
App.delete('/deleteAll/:key', async (req, res) => {
	try {
		if (req.params.key === auth.key) {
			newMoviePost.deleteMany({}, (err, doc) => {
				if (!err) {
					return res.json({
						"status": true,
						"description": "all posts deleted successFully"
					})
				} else {
					console.log(`this is error ${err}`)
					return res.json({
						"status": false,
						"description": "Database error while deleating all posts"
					})
				}
			})
		} else {
			return res.json({
				"status": false,
				"description": "you must pass key as a parameter"
			})
		}
	} catch (e) {
		console.log(e);
		return res.json({
			"status": false,
			"description": "Your request method is wrong read docs"
		})
	}

})

App.post("/getToken/:key", async (req, res) => {
	data = req.body
	rootNode = await newMoviePost.findById(data.postId).exec()
	if (!rootNode) {
		return res.json({
			"status": false,
			"description": `No post with id :${data.postId} in database`
		})
	} else {
		// init some variables 
		currentNode = rootNode
		nextList = []
		previousList = []
		rootList = []
		containsNextIdAlready = (element) => {
			if (element._id == currentNode.next) {
				return true
			} else {
				return false
			}
		}
		// ------------------------------getting next list with ticket-----------------------------------
		// }so the condition is currentNode.next should not be of zero length or should not already added in nextList or it should not be pointing on rootNode  Note: All these conditions is for avoiding infinite loop 

		while (currentNode.next.trim().length != 0 && !nextList.some(containsNextIdAlready) && currentNode.next != rootNode._id) {
			nextNode = await newMoviePost.findById(currentNode.next).exec()
			if (!nextNode) {
				break;
			} else {
				response = await axios.get(`https://zerotwomaiis.herokuapp.com/ticket/${nextNode.movieID}`)
				if (response.status == 200 && response.data.status) {
					// converting newNode which is instance of "mongodb Object" to javascript object
					nodeObject = JSON.parse(JSON.stringify(nextNode))
					nodeObject["ticket"] = response.data.ticket
					nextList.push(nodeObject)
				} else {
					console.log(`ticket not generated for movie : ${nextNode.name}`)
				}

				currentNode = nextNode
			}
		}
		// ------------------------getting previous list with ticket------------------------
		// redefigning some variables 
		currentNode = rootNode
		containsPreviousIdAlready = (element) => {
			if (element._id == currentNode.previous) {
				return true
			} else {
				return false
			}
		}
		// so the condition is that currentNode.previous should not be of zero length , should not already added in previous or next lists or should not be rootNode Note: All these conditions is for avoiding infinite loop
		while (currentNode.previous.trim().length != 0 && !previousList.some(containsPreviousIdAlready) && !nextList.some(containsPreviousIdAlready) && currentNode.next != rootNode._id) {
			previousNode = await newMoviePost.findById(currentNode.previous).exec()
			if (!previousNode) {
				break;
			} else {
				response = await axios.get(`https://zerotwomaiis.herokuapp.com/ticket/${previousNode.movieID}`)
				if (response.status == 200 && response.data.status) {
					// converting newNode which is instance of "mongodb Object" to javascript object
					nodeObject = JSON.parse(JSON.stringify(previousNode))
					nodeObject["ticket"] = response.data.ticket
					previousList.push(nodeObject)
				} else {
					console.log(`ticket not generated for movie : ${previousNode.name}`)
				}

				currentNode = previousNode
			}
		}
		//------------------------------------------ getting rootNode with ticket -----------------------------

		ticketResponse = await axios.get(`https://zerotwomaiis.herokuapp.com/ticket/${rootNode.movieID}`)
		if (ticketResponse.status == 200 && ticketResponse.data.status) {
			// converting newNode which is instance of "mongodb Object" to javascript object
			nodeObject = JSON.parse(JSON.stringify(rootNode))
			nodeObject["ticket"] = ticketResponse.data.ticket
			rootList.push(nodeObject)
		} else {
			console.log(`ticket not generated for root movie named : ${previousNode.name}`)
		}
		finalMovieList = previousList.concat(rootList, nextList)
		return res.json({
			"status": true,
			"data": finalMovieList
		})
	}
})



App.listen(port, () => {
	console.log(`App listening on :${port}`)
})