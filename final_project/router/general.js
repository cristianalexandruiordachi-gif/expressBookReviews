const express=require('express');
const axios=require('axios');
const books=require('./booksdb');
const {registerUser}=require('./auth_users');
const general=express.Router();
general.post('/register',async(req,res,next)=>{try{const result=await registerUser(req.body?.username,req.body?.password);res.status(result.status).json({message:result.message});}catch(err){next(err);}});
general.get('/',(req,res)=>res.json(books));
general.get('/isbn/:isbn',(req,res)=>{if(!Object.hasOwn(books,req.params.isbn))return res.status(404).json({message:'Book not found'});res.json(books[req.params.isbn]);});
function matchingBooks(field,value){const query=value.trim().toLowerCase();return Object.fromEntries(Object.entries(books).filter(([,book])=>book[field].toLowerCase()===query));}
general.get('/author/:author',(req,res)=>{const matches=matchingBooks('author',req.params.author);res.status(Object.keys(matches).length?200:404).json(Object.keys(matches).length?matches:{message:'No books by this author'});});
general.get('/title/:title',(req,res)=>{const matches=matchingBooks('title',req.params.title);res.status(Object.keys(matches).length?200:404).json(Object.keys(matches).length?matches:{message:'No books with this title'});});
general.get('/review/:isbn',(req,res)=>{if(!Object.hasOwn(books,req.params.isbn))return res.status(404).json({message:'Book not found'});res.json(books[req.params.isbn].reviews);});
// Tasks 10-13: asynchronous Axios clients. The routes above serve the catalog
// directly, avoiding recursive requests when these clients call the running API.
const client=()=>axios.create({baseURL:process.env.BOOK_API_URL||'http://127.0.0.1:5000',timeout:5000,proxy:false});
function getAllBooks(callback){const request=client().get('/').then(response=>response.data);if(typeof callback==='function')request.then(data=>callback(null,data),error=>callback(error));return request;}
async function getBookByISBN(isbn){const response=await client().get(`/isbn/${encodeURIComponent(isbn)}`);return response.data;}
function getBooksByAuthor(author){return client().get(`/author/${encodeURIComponent(author)}`).then(response=>response.data);}
async function getBooksByTitle(title){const response=await client().get(`/title/${encodeURIComponent(title)}`);return response.data;}
module.exports={general,getAllBooks,getBookByISBN,getBooksByAuthor,getBooksByTitle};
