
const path = require("path")
const nodemailer = require("nodemailer")
const auth = require(path.join(__dirname,'/credentials/auth'))
const webimages = require(path.join(__dirname,'/assets/webimages.json'))

// main function
function sendMail(to,subject,html,attachments,callback){
	// creating msg 

	msg = {
		from : auth.superMail,
		to:to,
		subject:subject,
		html:html,
		attachments:attachments
	}
	// creating request to gmail smtp server on port 465
	nodemailer.createTransport({
	  host: "smtp.gmail.com",
	  port:465,
	  auth: {
	    user: auth.superMail,
	    pass: auth.mailPass,
	  },
	}).sendMail(msg,(err)=>{
		if(err){
			callback(`Email not get sent to \"${to}\" due to ${err}`)
		}else{
			console.log(`Email  has been sent to \"${to}\" with regard of regard of \"${subject}\"`)
			callback()
		}
	})
	

}
// helpers functions 
// template to make success mail
function defaultTemplate(name,email,header,footer){
	return `
		Hi ${name}\n\n<p style="color:black;">${header}</p>
		<div  style="width:100%;height:7rem;background-color: lightgray;border-radius: 5px;display:flex;">
			<span style="width:20%;height:100%;display:flex;align-item:center;margin:0.8rem;">
				<img src="${webimages.contactUs}" style="width:100%;height:70%;">
			</span>
			<div  style="margin-top:0.2rem;margin-right:auto;width:80%;height:100%;">
				<p style="color:black;display:block">Contact us to resolve your queries or problem regard to you premium subscription.</p>
				<div style="padding:.2rem;display:inline;">
					<a target="_blank" style=" background-color: lightgray;color: dodgerblue;border:solid dodgerblue 2px;padding: 5px 8px;border-radius:3px;" href="${auth.googleContactusForm}">Get start</a>  
				</div>
			</div>

		</div>
		<p style="color:black;">${footer}</p>
	`
}
// templates component generator

function  generateHeader(subject,email,extras){
	if(subject == "ACCOUNT_CREATED"){
		return `
			Thank you for creating account in PrimeArchive.Your account is successfully created with email : " ${email} ". \nIf you think your email address is different or you have some other query. Please contact us by filling form below:
		`
	}else if(subject == "TECHNICAL_ISSUE"){
		return `
			Your payment has been received but due to some technical issue your account is not active now. It will get fixed in few hours. If you'll not receive any update under 24 hours, please contact us by providing your corresponding email address (${email}) via form below:
		`
	}else if(subject == "PLANE_NOT_EXISTS"){
		return `
			Plane that you have selected does not exists.0 days has been added to your account. If you have done your payment you can contact us for refund via form below with corresponding email address (${email}):
		`
	}else if(subject == "SUBSCRIPTION_UPGRADED"){
		return `
			Thank you for upgrading your current subscription plane with PrimeArchive.Your plane is upgraded to ${extras.planeDays} days with email : " ${email} " . \nIf you think your email address is different or you have some other query. Please contact us by filling form below:
		`
	}else{
		return `
			Welcome to PrimeArchive
		`
	}
}


module.exports = {
	sendMail,
	defaultTemplate,
	generateHeader,
}