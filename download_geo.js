import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';

// Налаштування шляхів
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'js', 'data');

// URL-адреси Gist
const URLS = {
    oblast: 'https://gist.githubusercontent.com/SARAFANUA/d79fd2cc5313e3c925b7f2908a551674/raw',
    raion: 'https://gist.githubusercontent.com/SARAFANUA/50760a14bf568b8b3de659b8a59a5f73/raw',
    hromada: 'https://gist.githubusercontent.com/SARAFANUA/0393bb541dab1266a277d9c0ed723e6e/raw'
};

// Створюємо папку js/data, якщо її немає
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log(`[Created] ${DATA_DIR}`);
}

// Функція завантаження
const downloadFile = (name, url) => {
    return new Promise((resolve, reject) => {
        const destPath = path.join(DATA_DIR, `${name}.json`);
        const file = fs.createWriteStream(destPath);

        console.log(`[Downloading] ${name} -> ${destPath}...`);

        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Status Code: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                console.log(`[Success] ${name}.json saved.`);
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(destPath, () => {}); // Видалити битий файл
            reject(err);
        });
    });
};

// Запуск
const run = async () => {
    try {
        await downloadFile('oblast', URLS.oblast);
        await downloadFile('raion', URLS.raion);
        await downloadFile('hromada', URLS.hromada);
        console.log('\nAll files downloaded successfully!');
        console.log('Now restart your server or refresh the page.');
    } catch (error) {
        console.error('Download failed:', error);
    }
};

run();