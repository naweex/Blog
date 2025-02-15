import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback } from "passport-google-oauth20";

@Injectable()                                                   //name of strategy is google
export class GoogleStrategy extends PassportStrategy(Strategy , 'google') {
    constructor(){
        super({//in passportStrategy constructor,below variables are exist with super we call them again.***
            clientID : process.env.GOOGLE_CLIENT_ID ,
            clientSecret : process.env.GOOGLE_SECRET_ID ,
            callbackURL : "http://localhost:3000/auth/google/redirect" ,
            scope : ['email' , 'profile']
        })
    }
        async validate(accessToken : string , refreshToken : string , profile : any , done : VerifyCallback){
            const {name , emails , photos} = profile;
            const {givenName : firstName , familyName : lastName} = name;
            const [emailData] = emails
            const [image] = photos
            const user = {
                firstName ,
                lastName ,
                emails : emailData?.value ,
                profile_image : image?.value ,
                accessToken ,   
            }
            done(null , user)
        }
}