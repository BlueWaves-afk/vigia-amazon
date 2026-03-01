export async function handler(event: { geohash7: string }) {
  const { geohash7 } = event;

  // Decode geohash to lat/lon (simplified implementation)
  const { lat, lon } = decodeGeohash(geohash7);

  // Mock reverse geocoding (replace with Amazon Location Service in production)
  const location = {
    continent: 'Asia',
    country: 'India',
    region: 'Odisha',
    city: 'Rourkela',
  };

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(location),
  };
}

function decodeGeohash(geohash: string): { lat: number; lon: number } {
  // Simplified geohash decoding (use proper library in production)
  const base32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let isEven = true;
  let latMin = -90, latMax = 90;
  let lonMin = -180, lonMax = 180;

  for (const char of geohash) {
    const idx = base32.indexOf(char);
    for (let i = 4; i >= 0; i--) {
      const bit = (idx >> i) & 1;
      if (isEven) {
        const lonMid = (lonMin + lonMax) / 2;
        if (bit === 1) lonMin = lonMid;
        else lonMax = lonMid;
      } else {
        const latMid = (latMin + latMax) / 2;
        if (bit === 1) latMin = latMid;
        else latMax = latMid;
      }
      isEven = !isEven;
    }
  }

  return {
    lat: (latMin + latMax) / 2,
    lon: (lonMin + lonMax) / 2,
  };
}
