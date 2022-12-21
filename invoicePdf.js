// createInvoice.js

const fs = require('fs');
const PDFDocument = require('pdfkit')
const moment = require("moment")
const path = require("path")

// local imports 
const { newPrimeUser } = require(path.join( __dirname,'/schema.js'))

// utility fucntion 
function generateHr(doc, y) {
  doc
    .strokeColor("#aaaaaa")
    .lineWidth(1)
    .moveTo(50, y)
    .lineTo(550, y)
    .stroke();
}

// main page design  functions 
function generateHeader(doc) {
	doc.image('./assets/logo.jpg', 50, 45, { width: 50 })
		.fillColor('#444444')
		.fontSize(20)
		.text('PrimeArchive.', 110, 57)
		.fontSize(10)
		.text('Rampur kullu', 200, 65, { align: 'right' })
		.text('H.P, India, 172023', 200, 80, { align: 'right' })
		.moveDown();
}
function generateCustomerInformation(doc, invoice) {
	doc.fontSize(20).text('Invoice', 50, 170)
	generateHr(doc,191)
	doc.fontSize(10).text(`User Id: ${invoice.userId}`, 50, 200)
		.text(`Invoice Date: ${moment().format("DD/MM/YYYY HH:mm")}`, 50, 215)
		.text(`Total Amount: ${invoice.totalAmount}`, 50, 230)

		.text(invoice.email, 300, 200)
		.text("Address line______,______", 300, 215)
		.text(
			`________, ________, ______`,
			300,
			230,
		)
		.moveDown();
		generateHr(doc,250)
}
function generateTableRow(doc, y, c1, c2, c3,c4) {
	doc.fontSize(10)
		.font("Helvetica")
		.text(c1, 50, y)
		.text(c2, 187.5, y)
		.text(c3, 325, y)
		.text(`${c4} Rs.`, 20, y, { align: 'right' })
}
function generateTable(doc,invoice,y){
	doc.font('Helvetica-Bold')
		.text("Service",50,y)
		.text("Date",215,y)
		.text("Transaction Id",325,y)
		.text("Sub-total",20,y, { align: 'right' })
	let start_y = 360
	for(let i=0;i<invoice.transactionslist.length;i++){
		generateHr(doc,start_y)
		start_y += 15	
		generateTableRow(doc,start_y,"Unlimited usage",invoice.transactionslist[i].transactionDate,invoice.transactionslist[i].transactionId,invoice.transactionslist[i].transactionAmount)
		start_y += 15
	}
	generateHr(doc,start_y)
	doc.fontSize(13)
	.font('Helvetica-Bold').fontSize(10)
	.text('Subscription', 50, start_y+45)
	.text(`Starts from ${invoice.createDate} to ${invoice.expireDate}`,20,start_y+45,{align:"right"})
	

}


function generateFooter(doc) {
	doc.fontSize(15)
	.font('Helvetica-Bold')
	.text('Grand Total', 50, 655)
	.text(`${invoice.totalAmount} Rs.`,20,655,{align:"right"})

	doc.fontSize(
		14,
	).text(
		'Thank you for buying our services.',
		50,
		700,
		{ align: 'center', width: 500 },
	);
}


async function createInvoice(identifier,fileName,callback) {
	try {
		if(identifier.transactionId){
			// getting user related to this particular transactionId
			user = await newPrimeUser.findOne({
				transactionDetails: {$elemMatch:{transactionId:identifier.transactionId}}
			}).exec()
			if(user){
				// getting current transaction from many transations happened in user account  by iterating all transactions
				let currentTransaction = user.transactionDetails.find(obj=>obj.transactionId==identifier.transactionId)
				// creating invoice 
				invoice = {
					"userId":user._id,
					"totalAmount":currentTransaction.transactionAmount, //this is not total amount of user, it total amount of this particular transaction
					"email":user.email,
					"transactionslist":[currentTransaction], //transaction list will contain only one transactioin because this is single transaction invoice
					"createDate":currentTransaction.subscription[0], //it is an array with only two elements (1) createdDate & (2) expireDate 
					"expireDate":currentTransaction.subscription[1],

				}
				// creating a pdf document 
				const doc = new PDFDocument({ margin: 50})
				generateHeader(doc)
				generateCustomerInformation(doc,invoice)
				generateTable(doc,invoice,345)
				generateFooter(doc)

				doc.end();
				doc.pipe(fs.createWriteStream(`tempInvoices/${fileName}.pdf`));
				callback(null,path.join(__dirname,`tempInvoices/${fileName}.pdf`))
			}else{
				callback(`Unable to find any matching transactionId for creating invoice. ID: ${identifier.transactionId} `)
			}
			
		}else if(identifier.email){
			// getting user with email 
			user = await newPrimeUser.findOne({
							"email": identifier.email.toLowerCase()
						}).exec()
			if(user){
				invoice = {
					"userId":user._id,
					"totalAmount":user.amount,
					"email":user.email,
					"transactionslist":user.transactionDetails,
					"createDate":moment(user.createdAt).format("DD/MM/YYYY"),
					"expireDate":moment(user.expireAt).format("DD/MM/YYYY")
				}
				// creating a pdf document 
				const doc = new PDFDocument({margin:50})
				generateHeader(doc)
				generateCustomerInformation(doc,invoice)
				generateTable(doc,invoice,345)
				generateFooter(doc)

				doc.end();
				doc.pipe(fs.createWriteStream(`tempInvoices/${fileName}.pdf`));
				callback(err=null,path.join(__dirname,`tempInvoices/${fileName}.pdf`))
			}else{
				callback(`Unable to find any matching transactionId for creating invoice. ID: ${identifier.email} `)
			}

		}else{
			console.log('Invoice can only be generate for transactionId or email')
		}

	} catch(e) {
		console.log(e);
	}
}

module.exports = {
	createInvoice,
};