import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const certsDir = path.join(process.cwd(), 'certs');

// Create certs directory if it doesn't exist
if (!fs.existsSync(certsDir)) {
  fs.mkdirSync(certsDir, { recursive: true });
}

// Generate self-signed certificate
try {
  console.log('Generating self-signed SSL certificate...');
  
  // On Windows with OpenSSL installed
  execSync(
    `openssl req -x509 -newkey rsa:2048 -nodes -keyout "${path.join(certsDir, 'key.pem')}" -out "${path.join(certsDir, 'cert.pem')}" -days 365 -subj "/CN=localhost"`,
    { stdio: 'inherit' }
  );
  
  console.log('Certificate generated successfully!');
  console.log('Key file: certs/key.pem');
  console.log('Cert file: certs/cert.pem');
  console.log('');
  console.log('To use HTTPS, run: HTTPS=true npm run dev');
  console.log('');
  console.log('Note: You will need to accept the self-signed certificate warning in your browser.');
} catch (error) {
  console.error('Error generating certificate:', error.message);
  console.error('');
  console.error('Make sure OpenSSL is installed and available in your PATH.');
  console.error('On Windows, you can install OpenSSL via:');
  console.error('  - Chocolatey: choco install openssl');
  console.error('  - Git for Windows (includes OpenSSL)');
  console.error('  - Or download from: https://slproweb.com/products/Win32OpenSSL.html');
  process.exit(1);
}
