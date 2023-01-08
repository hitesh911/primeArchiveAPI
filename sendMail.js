
const path = require("path")
const nodemailer = require("nodemailer")
const auth = require(path.join(__dirname,'/credentials/auth'))


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

function defaultTemplate(subject,name,email,header,footer){
	return `
		 <table style="margin: auto;font-family: Arial;max-width:600px" >
    	<tr>
    		<th>
    			<img src="${auth.currentDomain}/logo.jpg" width="70%" height="300" style="border-radius:3px;border-bottom:6px solid  #e8e8e8;display:block;margin:auto; ">	
    			<span style="border-bottom:2px solid #ff3332;display:block;width:69%;margin:auto;border-radious:20rem;"></span>
    			
    		</th>
    	</tr>
    	<tr>
    		<td>
    			<table  style="margin:auto;">
    				<tr height="80">
    					<th>${subject}</th>
    				</tr>
    				<tr>
    					<td  align="center" style="color:#808080;">${header}</td>
    				</tr>
    				<tr>
    					<td height="60">
    								<a href="${auth.googleContactusForm}" style="margin:auto;display:block;padding: 0.6rem;border-radius: 8px;border: none;background-color: #e8e8e8;    text-decoration:none;color: black;">Contact Us</a>
    					</td>
    				</tr>
    			</table>
    		</td>
    	</tr>
    	<tr>
    		<td height="30"></td>
    	</tr>
    	<tr>
    		<td bgcolor="#e8e8e8" >
    			<table style="margin:auto;border-top: 2px solid #ff3332;">
    				<tr>
    					<th height="100">Team PrimeArchive</th> 
    				</tr>
    				<tr>
    					<td align="center" style="padding:0 2rem;font-size:0.875em;">This message was sent to ${email} because you created new account in PrimeArchive.It will only appear again when you buy or upgrade your subscription next. click <a style="text-decoration: none" href="#">here</a> to unsubscripe 
    					</td>
    				</tr>
    				<tr>
    					<td align="center" style="display:flex;justify-content:space-around;">
    						<a href="${auth.facebookProfileLink}"><img width="80" height="80" src="${auth.currentDomain}/facebook.png"></a>
    						<a href="${auth.instagramProfileLink}"><img width="80" height="80" src="${auth.currentDomain}/instagram.png"></a>
    						<a href="${auth.telegramProfileLink}"><img width="80" height="80" src="${auth.currentDomain}/telegram.png"></a>
    						<a href="${auth.twitterProfileLink}"><img width="80" height="80" src="${auth.currentDomain}/twitter.png"></a>
    						<a href="${auth.youtubeProfileLink}"><img width="80" height="80" src="${auth.currentDomain}/youtube.png"></a>
    					</td>
    				</tr>
    			</table>

    		</td>
    	</tr>
    </table>
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
