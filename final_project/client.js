const {getAllBooks,getBookByISBN,getBooksByAuthor,getBooksByTitle}=require('./router/general');
async function main(){
 await new Promise((resolve,reject)=>getAllBooks((error,data)=>{if(error)return reject(error);console.log('TASK 10 - All books (async callback):',JSON.stringify(data,null,2));resolve();}));
 console.log('TASK 11 - ISBN (async/await):',JSON.stringify(await getBookByISBN('1'),null,2));
 console.log('TASK 12 - Author (Promise):',JSON.stringify(await getBooksByAuthor('Unknown'),null,2));
 console.log('TASK 13 - Title (async/await):',JSON.stringify(await getBooksByTitle('Things Fall Apart'),null,2));
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports=main;
