const express=require('express');
const jwt=require('jsonwebtoken');
const {randomBytes,scrypt:scryptCallback,timingSafeEqual}=require('node:crypto');
const {promisify}=require('node:util');
const books=require('./booksdb');
const scrypt=promisify(scryptCallback);
const authenticated=express.Router();
const users=new Map();
const jwtSecret=process.env.JWT_SECRET||randomBytes(32).toString('hex');
function validCredentials(username,password){return typeof username==='string' && /^[a-zA-Z0-9_]{3,40}$/.test(username) && !['__proto__','constructor','prototype'].includes(username) && typeof password==='string' && password.length>=8 && password.length<=128;}
const isValid=username=>users.has(username);
async function registerUser(username,password){
 if(!validCredentials(username,password))return {status:400,message:'Use a 3-40 character username and an 8-128 character password'};
 if(isValid(username))return {status:409,message:'Username already registered'};
 const salt=randomBytes(16).toString('hex');const hash=(await scrypt(password,salt,64)).toString('hex');
 if(isValid(username))return {status:409,message:'Username already registered'};
 users.set(username,{salt,hash});return {status:201,message:'User successfully registered. You can now log in.'};
}
async function authenticatedUser(username,password){if(!validCredentials(username,password))return false;const user=users.get(username);if(!user)return false;const candidate=await scrypt(password,user.salt,64);return timingSafeEqual(candidate,Buffer.from(user.hash,'hex'));}
function requireAuth(req,res,next){
 const bearer=req.get('authorization');const token=bearer ? /^Bearer (.+)$/i.exec(bearer)?.[1] : req.session?.authorization?.accessToken;
 if(!token)return res.status(401).json({message:'Please log in to manage reviews'});
 try{const payload=jwt.verify(token,jwtSecret,{algorithms:['HS256'],issuer:'bookshop',audience:'bookshop-customers'});if(!users.has(payload.sub))return res.status(401).json({message:'User is no longer registered'});req.authenticatedUsername=payload.sub;next();}catch{return res.status(401).json({message:'Invalid or expired authentication'});}
}
authenticated.post('/login',async(req,res,next)=>{try{const {username,password}=req.body||{};if(!(await authenticatedUser(username,password)))return res.status(401).json({message:'Invalid username or password'});req.session.regenerate(err=>{if(err)return next(err);req.session.authorization={accessToken:jwt.sign({sub:username},jwtSecret,{algorithm:'HS256',expiresIn:'1h',issuer:'bookshop',audience:'bookshop-customers'}),username};req.session.save(err=>err?next(err):res.json({message:'Customer successfully logged in',username}));});}catch(err){next(err);}});
authenticated.put('/auth/review/:isbn',(req,res)=>{if(!Object.hasOwn(books,req.params.isbn))return res.status(404).json({message:'Book not found'});const review=req.body?.review??req.query.review;if(typeof review!=='string'||!review.trim()||review.length>3000)return res.status(400).json({message:'Provide a nonempty review of at most 3000 characters'});const book=books[req.params.isbn];const username=req.authenticatedUsername;const existed=Object.hasOwn(book.reviews,username);book.reviews[username]=review.trim();res.status(existed?200:201).json({message:existed?'Review successfully modified':'Review successfully added',isbn:req.params.isbn,reviews:book.reviews});});
authenticated.delete('/auth/review/:isbn',(req,res)=>{if(!Object.hasOwn(books,req.params.isbn))return res.status(404).json({message:'Book not found'});const reviews=books[req.params.isbn].reviews;const username=req.authenticatedUsername;if(!Object.hasOwn(reviews,username))return res.status(404).json({message:'No review belonging to this user was found'});delete reviews[username];res.json({message:'Your review was successfully deleted',isbn:req.params.isbn,reviews});});
module.exports={authenticated,isValid,users,registerUser,authenticatedUser,requireAuth};
