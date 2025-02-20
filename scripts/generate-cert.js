import selfsigned from 'selfsigned';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const attrs = [{ name: 'commonName', value: 'localhost' }];
const pems = selfsigned.generate(attrs, {
    algorithm: 'sha256',
    days: 365,
    keySize: 2048,
    extensions: [{
        name: 'subjectAltName',
        altNames: [
            { type: 2, value: 'localhost' },
            { type: 2, value: '192.168.8.120' }
        ]
    }]
});

const certDir = path.join(__dirname, '..', '.cert');
if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir);
}

fs.writeFileSync(path.join(certDir, 'cert.pem'), pems.cert);
fs.writeFileSync(path.join(certDir, 'key.pem'), pems.private);

console.log('SSL certificate generated successfully!');
