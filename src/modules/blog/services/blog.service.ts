import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
  Scope,
} from '@nestjs/common';
import { BlogEntity } from '../entities/blog.entity';
import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CreateBlogDto, FilterBlogDto, UpdateBlogDto } from '../dto/blog.dto';
import { BlogStatus } from '../enum/status.enum';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { randomId } from 'src/common/utils/functions.utils';
import { PaginationDto } from 'src/common/dtos/pagination.dto';
import {
  paginationGenerator,
  paginationSolver,
} from 'src/common/utils/pagination.util';
import { isArray } from 'class-validator';
import { CategoryService } from '../../category/category.service';
import { BlogCategoryEntity } from '../entities/blog-category.entity';
import { EntitiName } from 'src/common/enums/entity.enum';
import { BlogLikesEntity } from '../entities/like.entity';
import { PublicMessage } from 'src/common/enums/message.enum';
import { BlogBookmarkEntity } from '../entities/bookmark.entity';
import { BlogCommentService } from './comment.service';

@Injectable({ scope: Scope.REQUEST })
export class BlogService {
  constructor(
    @InjectRepository(BlogEntity)
    private blogRepository: Repository<BlogEntity>,
    @InjectRepository(BlogCategoryEntity)
    private blogCategoryRepository: Repository<BlogCategoryEntity>,
    @InjectRepository(BlogLikesEntity)
    private blogLikeRepository: Repository<BlogLikesEntity>,
    @InjectRepository(BlogBookmarkEntity)
    private blogBookmarkRepository: Repository<BlogBookmarkEntity>,
    @Inject(REQUEST) private request: Request, //LAST Request belong to express.
    private categoryService: CategoryService ,
    private blogCommentService : BlogCommentService ,
    private dataSource : DataSource ,
  ) {}
    
  async create(blogDto: CreateBlogDto) {
    const user = this.request.user; //user in the request.user we created it by using express name space in request.d.ts file.
    let {
      title,
      slug,
      content,
      description,
      image,
      time_for_study,
      categories,
    } = blogDto;
    if (!isArray(categories) && typeof categories === 'string') {
      categories = categories.split(',');
    } else if (!isArray(categories)) {
      throw new BadRequestException('invalid category');
    }
    let slugData = slug ?? title; //slugify dont soppurt persian and arabic we should use regexp.**
    slug = slugData
      ?.replace(/[ًٌٍَُِّ\.\+\-_)(*&%$^#@!~'";:?><`ء)]+/g, '')
      ?.replace(/[\s]+/g, '-'); //regexp = where exist 1 or more than one space replace them with "-".
    const isExist = await this.checkBlogBySlug(slug);
    if (isExist) {
      slug += `-${randomId()}`; //if user create new blog and the slug of blog already exist__
      //patch a randome id to end of the new slugs blog.
    }
    let blog = this.blogRepository.create({
      slug,
      title,
      description,
      content,
      image,
      status: BlogStatus.Draft,
      time_for_study,
      authorId: user.id,
    });
    blog = await this.blogRepository.save(blog);
    for (const categoryTitle of categories) {
      let category = await this.categoryService.findOneByTitle(categoryTitle);
      if (!category) {
        category = await this.categoryService.insertByTitle(categoryTitle);
      }
      await this.blogCategoryRepository.insert({
        blogId: blog.id,
        categoryId: category.id,
      });
    }
    return {
      message: 'created successfully',
    };
  }
  async checkBlogBySlug(slug: string) {
    //if blog exist with the same name turn to false
    const blog = await this.blogRepository.findOneBy({ slug });
    return blog; //!! this exclamation mark turn value to boolean.
  }
  async myBlog() {
    const { id } = this.request.user;
    return this.blogRepository.find({
      where: {
        authorId: id,
      },
      order: {
        id: 'DESC', //order and give blogs to author from last blog until first blog.
      },
    });
  }
  //blog list is list of all blogs for main page of website.
  async blogList(paginationDto: PaginationDto, filterDto: FilterBlogDto) {
    const { limit, page, skip } = paginationSolver(paginationDto);
    let { category, search } = filterDto;
    let where = '';
    if (category) {
      category = category.toLowerCase();
      if (where.length > 0) where += ' AND ';
      where += 'category.title = LOWER(:category)';
    }
    if (search) {
      if (where.length > 0) where += ' AND ';
      search = `%${search}%`; //because we use ILIKE dont need use tolowercase.**
      where +=
        'CONCAT(blog.title , blog.description , blog.content) ILIKE :search'; //concat stick a few string together.
    }
    const [blogs, count] = await this.blogRepository
      .createQueryBuilder(EntitiName.Blog)
      .leftJoin('blog.categories', 'categories') //second parameter is alias(nickname for first parameter)
      .leftJoin('categories.category', 'category') //second parameter is alias(nickname for first parameter)
      .leftJoin('blog.author', 'author')
      .leftJoin('author.profile', 'profile')
      .addSelect([
        'categories.id',
        'category.title',
        'author.username',
        'author.id',
        'profile.nick_name',
      ])
      .where(where, { category, search })
      .loadRelationCountAndMap('blog.likes', 'blog.likes') //show and count likes.
      .loadRelationCountAndMap('blog.bookmarks', 'blog.bookmarks') //show and count bookmarks.
      .loadRelationCountAndMap(
        'blog.comments',
        'blog.comments',
        'comments',
        (qb) => qb.where('comments.accepted = :accepted', { accepted: true }) //only count comments that accepted.
      ) //show and count comments.
      .orderBy('blog.id', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    // const [blogs , count] =  await this.blogRepository.findAndCount({
    //     relations : { //relation on category
    //         categories : {
    //             category : true
    //         }
    //     },
    //     where,
    //     select : {
    //         categories : {
    //             id : true ,
    //             category : {
    //                 title : true
    //             }
    //         }
    //     },
    //     order : {
    //         id : 'DESC' //order and give blogs to author from last blog until first blog.
    //     },
    //     skip ,
    //     take : limit
    // });
    return {
      pagination: paginationGenerator(count, page, limit),
      blogs,
    };
  }
  async checkExistBlogById(id: number) {
    const blog = await this.blogRepository.findOneBy({ id });
    if (!blog) throw new NotFoundException('not found any blog');
    return blog;
  }
  async delete(id: number) {
    await this.checkExistBlogById(id);
    await this.blogRepository.delete({ id });
    return {
      message: 'blog deleted successfully',
    };
  }
  async update(id: number, blogDto: UpdateBlogDto) {
    const user = this.request.user; //user in the request.user we created it by using express name space in request.d.ts file.
    let {
      title,
      slug,
      content,
      description,
      image,
      time_for_study,
      categories,
    } = blogDto;
    const blog = await this.checkExistBlogById(id);
    if (!isArray(categories) && typeof categories === 'string') {
      categories = categories.split(',');
    } else if (!isArray(categories)) {
      throw new BadRequestException('invalid category');
    }
    let slugData = null;
    if (title) {
      slugData = title;
      blog.title = title;
    }
    if (slug) slugData = slug;
    if (slugData) {
      slug = slugData
        ?.replace(/[ًٌٍَُِّ\.\+\-_)(*&%$^#@!~'";:?><`ء)]+/g, '')
        ?.replace(/[\s]+/g, '-');
      const isExist = await this.checkBlogBySlug(slug);
      if (isExist && isExist.id !== id) {
        slug += `-${randomId()}`;
      }
      blog.slug = slug;
    }
    if (description) blog.description = description; //if description exist update it.
    if (content) blog.content = content; //if content exist update it.
    if (image) blog.image = image;
    if (time_for_study) blog.time_for_study = time_for_study;
    await this.blogRepository.save(blog);
    if (categories && isArray(categories) && categories.length > 0) {
      await this.blogCategoryRepository.delete({ blogId: blog.id });
    }
    for (const categoryTitle of categories) {
      let category = await this.categoryService.findOneByTitle(categoryTitle);
      if (!category) {
        category = await this.categoryService.insertByTitle(categoryTitle);
      }
      await this.blogCategoryRepository.insert({
        blogId: blog.id,
        categoryId: category.id,
      });
    }
    return {
      message: 'updated successfully',
    };
  }
  async likeToggle(blogId: number) {
    const { id: userId } = this.request.user; //for take id of user in request.
    const blog = await this.checkExistBlogById(blogId);
    const isLiked = await this.blogLikeRepository.findOneBy({ userId, blogId });
    let message = PublicMessage.Like;
    if (isLiked) {
      await this.blogLikeRepository.delete({ id: isLiked.id });
      message = PublicMessage.DisLike;
    } else {
      await this.blogLikeRepository.insert({
        blogId,
        userId,
      });
    }
    return {
      message,
    };
  }
  async bookmarkToggle(blogId: number) {
    const { id: userId } = this.request.user; //for take id of user in request.
    const blog = await this.checkExistBlogById(blogId);
    const isBookmarked = await this.blogBookmarkRepository.findOneBy({
      userId,
      blogId,
    });
    let message = PublicMessage.Bookmark;
    if (isBookmarked) {
      await this.blogBookmarkRepository.delete({ id: isBookmarked.id });
      message = PublicMessage.UnBookmark;
    } else {
      await this.blogBookmarkRepository.insert({
        blogId,
        userId,
      });
    }
    return {
      message,
    };
  }
  //add pagination for comments//if comments of one blogs are too many we can pagination that.
  async findOneBySlug(slug: string , paginationDto : PaginationDto) {
    const userId = this.request?.user?.id;
    const blog = await this.blogRepository
      .createQueryBuilder(EntitiName.Blog)
      .leftJoin('blog.categories', 'categories') //second parameter is alias(nickname for first parameter)
      .leftJoin('categories.category', 'category') //second parameter is alias(nickname for first parameter)
      .leftJoin('blog.author', 'author')
      .leftJoin('author.profile', 'profile')
      .addSelect([
        'categories.id',
        'category.title',
        'author.username',
        'author.id',
        'profile.nick_name',
      ])
      .where({ slug })//search blogs base on slugs.***
      .loadRelationCountAndMap('blog.likes', 'blog.likes') //show and count likes.
      .loadRelationCountAndMap('blog.bookmarks', 'blog.bookmarks') //show and count bookmarks.
      .getOne();
      if(!blog) throw new NotFoundException('not found any blogs')
      const commentsData = await this.blogCommentService.findCommentsOfBlog(blog.id , paginationDto)
      let isLiked = false;
      let isBookmarked = false;
      if(userId && !isNaN(userId) && userId > 0){
        isLiked = !!(await this.blogLikeRepository.findOneBy({userId , blogId: blog.id}))//if exist means user liked this blog.
        isBookmarked = !!(await this.blogBookmarkRepository.findOneBy({userId , blogId: blog.id}))//if exist means user bookmarke this blog.
      }
      const queryRunner=  this.dataSource.createQueryRunner();
      await queryRunner.connect(); //connect to querry runner
      //suggest 3 blog in every blog randomly.**
      const suggestBlogs = await queryRunner.query(`
        WITH suggested_blogs AS (
            SELECT 
                    blog.id,
                    blog.slug,
                    blog.title,
                    blog.description,
                    blog.time_for_study,
                    blog.image,
                    json_build_object(
                        'username', u.username,
                        'author_name', p.nick_name,
                        'image', p.image_profile
                    ) AS author,
                    array_agg(DISTINCT cat.title) AS categories,
                    (
                        SELECT COUNT(*) FROM blog_likes
                        WHERE blog_likes."blogId" = blog.id
                    ) AS likes,
                    (
                        SELECT COUNT(*) FROM blog_bookmarks
                        WHERE blog_bookmarks."blogId" = blog.id
                    ) AS bookmarks,
                    (
                        SELECT COUNT(*) FROM blog_comments
                        WHERE blog_comments."blogId" = blog.id
                    ) AS comments
                FROM blog
                LEFT JOIN public.user u ON blog."authorId" = u.id
                LEFT JOIN profile p ON p."userId" = u.id
                LEFT JOIN blog_category bc ON blog.id = bc."blogId"
                LEFT JOIN category cat ON bc."categoryId" = cat.id
                GROUP BY blog.id, u.username, p.nick_name, p.image_profile
                ORDER BY RANDOM()
                LIMIT 3

            )
            SELECT * FROM suggested_blogs
        `);
      return {
        blog ,
        isLiked ,
        isBookmarked ,
        commentsData ,
        suggestBlogs
      }
  }
}
