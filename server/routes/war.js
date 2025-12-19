// server/routes/war.js
import express from 'express';
import https from 'https';

// Допоміжна функція для запитів
function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                return reject(new Error(`Status Code: ${res.statusCode}`));
            }
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        }).on('error', (err) => reject(err));
    });
}

export default function warRoutes() {
  const router = express.Router();

  router.get('/state', async (req, res) => {
    try {
        // КРОК 1: Запит останньої версії
        const data = await fetchUrl('https://deepstatemap.live/api/history/last');
        
        let geoJson;

        // КРОК 2: Визначення структури відповіді
        if (data.map && data.map.type === 'FeatureCollection') {
            geoJson = data.map;
        } else if (data.type === 'FeatureCollection') {
            geoJson = data;
        } else if (data.id) {
            // Фолбек: завантаження за ID
            geoJson = await fetchUrl(`https://deepstatemap.live/api/history/${data.id}/geojson`);
        } else {
            throw new Error('Невідомий формат відповіді від DeepState');
        }

        // КРОК 3: Перевірка та відправка
        if (geoJson && geoJson.features) {
            res.json(geoJson);
        } else {
            throw new Error('GeoJSON отримано, але він не містить features');
        }

    } catch (err) {
        console.error('[WarAPI] Помилка:', err.message);
        res.status(500).json({ error: 'Failed to fetch war data', details: err.message });
    }
  });

  return router;
}