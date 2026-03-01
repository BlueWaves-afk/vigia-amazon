import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { GeoPlacesClient, SearchTextCommand, ReverseGeocodeCommand } from '@aws-sdk/client-geo-places';

const client = new GeoPlacesClient({ region: 'us-east-1' });

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { query, position } = body;

    if (query) {
      // Text search with worldwide bounding box
      const command = new SearchTextCommand({
        QueryText: query,
        MaxResults: 10,
        Filter: {
          BoundingBox: [-180, -90, 180, 90], // Worldwide
        },
      });
      const response = await client.send(command);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response),
      };
    } else if (position) {
      // Reverse geocode
      const command = new ReverseGeocodeCommand({
        QueryPosition: position,
        MaxResults: 1,
      });
      const response = await client.send(command);
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(response),
      };
    } else {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing query or position' }),
      };
    }
  } catch (error: any) {
    console.error('Places search error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message || 'Internal server error' }),
    };
  }
};
