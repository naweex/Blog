import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { isJWT } from "class-validator";
import { Request } from "express";
import { Observable } from "rxjs";
import { AuthService } from "../auth.service";

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private authService : AuthService){}
    async canActivate(context: ExecutionContext){
        const httpContext = context.switchToHttp();
        const request : Request = httpContext.getRequest<Request>();
        const token = this.extractToken(request)
        request.user = await this.authService.validateAccessToken(token)
        return true;
    }
    //Private methods/members are accessible only from inside the class.
    //Protected methods/members are accessible from inside the class and extending class as well.
    protected extractToken(request : Request){
        const { authorization } = request.headers;
        if(!authorization || authorization?.trim() == ""){
            throw new UnauthorizedException('please login to your current account')
        }
        const [bearer , token] = authorization?.split(" ")
        if(bearer?.toLowerCase() !== 'bearer' || !token || !isJWT(token)){
            throw new UnauthorizedException('please login to your current account')
        }
        return token;
    }
}