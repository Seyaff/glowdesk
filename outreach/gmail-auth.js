import { google } from 'googleapis';
import http from 'node:http';
const port = 8765;
const redirectUri = `http://127.0.0.1:${port}/callback`;
const client = new google.auth.OAuth2(process.env.GMAIL_CLIENT_ID, process.env.GMAIL_CLIENT_SECRET, redirectUri);
const url = client.generateAuthUrl({access_type:'offline',prompt:'consent',scope:['https://www.googleapis.com/auth/gmail.compose']});
const server = http.createServer(async(req,res)=>{
  try {
    const code = new URL(req.url, redirectUri).searchParams.get('code');
    if (!code) {res.writeHead(400);res.end('Missing code');return;}
    const {tokens}=await client.getToken(code);
    res.end('Authorized. Return to PowerShell; keep your refresh token private.');
    console.log('\nGMAIL_REFRESH_TOKEN='+tokens.refresh_token+'\n');
  } catch(e){res.writeHead(500);res.end('Authorization failed');console.error(e.message)}
  finally {setTimeout(()=>server.close(),1000)}
});
server.listen(port,'127.0.0.1',()=>console.log('Open this URL in your browser:\n'+url));
