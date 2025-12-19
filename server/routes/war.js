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
    console.log('[WarAPI] Отримано запит на /api/war/state');

    try {
        // Запит останньої версії (history/last)
        console.log('[WarAPI] Запит останньої версії (history/last)...');
        const data = await fetchUrl('https://deepstatemap.live/api/history/last');
        
        let geoJson;

        // ЛОГІКА З GEO.HTML:
        // Перевіряємо, чи є поле .map і чи воно схоже на FeatureCollection
        if (data.map && data.map.type === 'FeatureCollection') {
            console.log('[WarAPI] GeoJSON знайдено в полі .map');
            geoJson = data.map;
        } else if (data.type === 'FeatureCollection') {
            console.log('[WarAPI] GeoJSON знайдено в корені відповіді');
            geoJson = data;
        } else if (data.id) {
            // ФОЛБЕК: Якщо .map немає, але є ID, пробуємо завантажити окремо (про всяк випадок)
            console.log(`[WarAPI] Поле .map відсутнє, але є ID ${data.id}. Пробуємо завантажити geojson окремо...`);
            geoJson = await fetchUrl(`https://deepstatemap.live/api/history/${data.id}/geojson`);
        } else {
            throw new Error('Невідомий формат відповіді від DeepState');
        }

        if (geoJson && geoJson.features) {
            console.log(`[WarAPI] Успіх! Отримано ${geoJson.features.length} об'єктів.`);
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