const http = require('https');
const options = {
  hostname: 'api.github.com',
  path: '/repos/Sachin-pandey13/Melopra-/actions/runs/24045424193/jobs',
  headers: { 'User-Agent': 'node.js' }
};
http.get(options, (res) => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
     const data = JSON.parse(body);
     const jobId = data.jobs[0].id;
     http.get({ hostname: 'api.github.com', path: '/repos/Sachin-pandey13/Melopra-/actions/jobs/' + jobId + '/logs', headers: { 'User-Agent': 'node.js' } }, (res2) => {
         // this redirects
         if (res2.statusCode === 302) {
             const loc = res2.headers.location;
             http.get(loc, (res3) => {
                 let logBody = '';
                 res3.on('data', chunk => logBody += chunk);
                 res3.on('end', () => {
                     require('fs').writeFileSync('gh-log.txt', logBody);
                     console.log('Saved to gh-log.txt');
                 });
             });
         }
     });
  });
});
