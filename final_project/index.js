const express = require('express');
const session = require('express-session');
const { randomBytes } = require('node:crypto');
const { authenticated, requireAuth } = require('./router/auth_users');
const { general } = require('./router/general');
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '16kb' }));
app.use('/customer', session({name:'bookshop.sid',secret:process.env.SESSION_SECRET || randomBytes(32).toString('hex'),resave:false,saveUninitialized:false,cookie:{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV === 'production',maxAge:3600000}}));
app.use('/customer/auth', requireAuth);
app.use('/customer', authenticated);
app.use('/', general);
app.use((req,res)=>res.status(404).json({message:'Endpoint not found'}));
app.use((err,req,res,next)=>{if(err instanceof SyntaxError && err.status===400)return res.status(400).json({message:'Invalid JSON body'});console.error(err.message);res.status(500).json({message:'Internal server error'});});
if(require.main===module){const port=Number(process.env.PORT||5000);const host=process.env.HOST||'127.0.0.1';app.listen(port,host,()=>console.log(`Book review API listening at http://${host}:${port}`));}
module.exports=app;
