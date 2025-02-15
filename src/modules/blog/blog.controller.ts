import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { BlogService } from './blog.service';
import { CreateBlogDto, FilterBlogDto, UpdateBlogDto } from './dto/blog.dto';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { SwaggerConsumes } from 'src/common/enums/swagger-consumes.enum';
import { AuthGuard } from '../auth/guards/auth.guard';
import { Pagination } from 'src/common/decorators/pagination.decorators';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import { SkipAuth } from 'src/common/decorators/skip-auth.decorators';
import { FilterBlog } from 'src/common/decorators/filter.decorator';

@Controller('blog')
@ApiTags('Blog')
@ApiBearerAuth('Authorization')
@UseGuards(AuthGuard)
export class BlogController {
  constructor(private readonly blogService: BlogService) {}


  @Post('/')
  @ApiConsumes(SwaggerConsumes.UrlEncoded , SwaggerConsumes.Json)
  create(@Body() blogDto : CreateBlogDto){
    return this.blogService.create(blogDto)
  }
  @Get('/mine')
  myBlogs(){
    return this.blogService.myBlog()
  } 
  
  @Get('/')
  @SkipAuth()//for this route user dont need authentication.//set it in authGuard(reflector)
  @Pagination()
  @FilterBlog()
  find(@Query() paginationDto : PaginationDto , @Query() filterDto : FilterBlogDto){
    return this.blogService.blogList(paginationDto , filterDto)
  } 
  @Get('/like/:id')
  likeToggle(@Param('id' , ParseIntPipe) id : number){
    return this.blogService.likeToggle(id)
  }
  @Get('/bookmark/:id')
  bookmarkToggle(@Param('id' , ParseIntPipe) id : number){
    return this.blogService.bookmarkToggle(id)
  }
  @Delete('/:id')
  delete(@Param('id' , ParseIntPipe) id : number ){
    return this.blogService.delete(id)
  } 
  @Put('/:id')
  @ApiConsumes(SwaggerConsumes.UrlEncoded , SwaggerConsumes.Json)
  update(@Param('id' , ParseIntPipe) id : number , @Body() blogDto : UpdateBlogDto){
    return this.blogService.update(id , blogDto)
  }
}
