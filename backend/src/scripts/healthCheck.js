const http = require('http');

const port = process.env.PORT || 5001;
const url = `http://localhost:${port}/api/health`;

http.get(url, (res) => {
  if (res.statusCode >= 200 && res.statusCode < 300) {
    console.log(`Health check OK: ${url}`);
    process.exit(0);
  }
  console.error(`Health check failed with status ${res.statusCode}`);
  process.exit(1);
}).on('error', (error) => {
  console.error(`Health check failed: ${error.message}`);
  process.exit(1);
});
