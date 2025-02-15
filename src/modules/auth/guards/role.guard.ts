import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Request } from "express";
import { ROLE_KEY } from "src/common/decorators/role.decorator";
import { Roles } from "src/common/enums/role.enum";

@Injectable()//when we want create a guard we should use canactiv.
export class RoleGuard implements CanActivate {
    constructor(private reflector : Reflector){}
    canActivate(context: ExecutionContext) {
        const requiredRoles = this.reflector.getAllAndOverride<Roles[]>(
            ROLE_KEY ,//in reflector get all role keys in handler or class.
            [ 
                context.getHandler() ,
                context.getClass  
            ]
        );
        //if dont specifies any role it means true and request can access.
        if(!requiredRoles || requiredRoles.length == 0) return true;
        const request : Request = context.switchToHttp().getRequest<Request>()
        const user = request.user;
        const userRole = user?.role ?? Roles.User;
        if(user.role === Roles.Admin) return true;//if this condition is true admin access all routes.**
        if(requiredRoles.includes(userRole as Roles)) return true;
        throw new ForbiddenException()//if user shouldnt access this error came.
    }
}




//why we use injectable:
//1. Enabling Dependency Injection
//Core DI Mechanism: @Injectable() marks a class as a "provider" that can be injected into other classes
//(e.g., controllers, services). NestJS's DI container uses this decorator to resolve and instantiate
//dependencies automatically.
//in simple way we can use class in other services or controller.