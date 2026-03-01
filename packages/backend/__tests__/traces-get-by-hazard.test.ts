import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler } from '../src/traces/get-by-hazard';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';

const dynamoMock = mockClient(DynamoDBDocumentClient);

describe('GET /traces/{hazardId}', () => {
  beforeEach(() => {
    dynamoMock.reset();
    process.env.TRACES_TABLE_NAME = 'test-traces-table';
  });

  it('should return 400 if hazardId is missing', async () => {
    const event = {
      pathParameters: null,
    } as any;

    const response = await handler(event, {} as any, {} as any);

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Missing hazardId parameter');
  });

  it('should return 404 if trace not found', async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [],
    });

    const event = {
      pathParameters: { hazardId: 'POTHOLE-2026-03-01T14:00:00.000Z' },
    } as any;

    const response = await handler(event, {} as any, {} as any);

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Trace not found');
    expect(body.message).toBe('Agent has not processed this hazard yet');
  });

  it('should return trace if found', async () => {
    const mockTrace = {
      traceId: 'trace-123',
      hazardId: 'POTHOLE-2026-03-01T14:00:00.000Z',
      reasoning: 'Verified pothole with high confidence',
      verificationScore: 85,
      createdAt: '2026-03-01T14:00:05.000Z',
    };

    dynamoMock.on(QueryCommand).resolves({
      Items: [mockTrace],
    });

    const event = {
      pathParameters: { hazardId: 'POTHOLE-2026-03-01T14:00:00.000Z' },
    } as any;

    const response = await handler(event, {} as any, {} as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.trace).toEqual(mockTrace);
  });

  it('should query with correct parameters', async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [],
    });

    const hazardId = 'POTHOLE-2026-03-01T14:00:00.000Z';
    const event = {
      pathParameters: { hazardId },
    } as any;

    await handler(event, {} as any, {} as any);

    expect(dynamoMock.calls()).toHaveLength(1);
    const call = dynamoMock.call(0);
    expect(call.args[0].input).toMatchObject({
      TableName: 'test-traces-table',
      IndexName: 'HazardIdIndex',
      KeyConditionExpression: 'hazardId = :hazardId',
      ExpressionAttributeValues: {
        ':hazardId': hazardId,
      },
      Limit: 1,
      ScanIndexForward: false,
    });
  });

  it('should return most recent trace if multiple exist', async () => {
    const olderTrace = {
      traceId: 'trace-old',
      hazardId: 'POTHOLE-2026-03-01T14:00:00.000Z',
      reasoning: 'Old reasoning',
      verificationScore: 70,
      createdAt: '2026-03-01T14:00:05.000Z',
    };

    const newerTrace = {
      traceId: 'trace-new',
      hazardId: 'POTHOLE-2026-03-01T14:00:00.000Z',
      reasoning: 'Updated reasoning',
      verificationScore: 85,
      createdAt: '2026-03-01T14:00:10.000Z',
    };

    // DynamoDB returns most recent first due to ScanIndexForward: false
    dynamoMock.on(QueryCommand).resolves({
      Items: [newerTrace, olderTrace],
    });

    const event = {
      pathParameters: { hazardId: 'POTHOLE-2026-03-01T14:00:00.000Z' },
    } as any;

    const response = await handler(event, {} as any, {} as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.trace.traceId).toBe('trace-new');
  });

  it('should handle DynamoDB errors gracefully', async () => {
    dynamoMock.on(QueryCommand).rejects(new Error('DynamoDB error'));

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const event = {
      pathParameters: { hazardId: 'POTHOLE-2026-03-01T14:00:00.000Z' },
    } as any;

    const response = await handler(event, {} as any, {} as any);

    expect(response.statusCode).toBe(500);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Failed to fetch trace');
    expect(consoleSpy).toHaveBeenCalledWith('Error fetching trace:', expect.any(Error));

    consoleSpy.mockRestore();
  });

  it('should include CORS headers in all responses', async () => {
    dynamoMock.on(QueryCommand).resolves({
      Items: [],
    });

    const event = {
      pathParameters: { hazardId: 'POTHOLE-2026-03-01T14:00:00.000Z' },
    } as any;

    const response = await handler(event, {} as any, {} as any);

    expect(response.headers).toMatchObject({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
  });

  it('should handle special characters in hazardId', async () => {
    const hazardId = 'POTHOLE-2026-03-01T14:00:00.000Z+special%20chars';
    
    dynamoMock.on(QueryCommand).resolves({
      Items: [{
        traceId: 'trace-123',
        hazardId,
        reasoning: 'Test',
        verificationScore: 80,
      }],
    });

    const event = {
      pathParameters: { hazardId },
    } as any;

    const response = await handler(event, {} as any, {} as any);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.trace.hazardId).toBe(hazardId);
  });
});
