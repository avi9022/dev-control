import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../utils/dynamodb.js";

export interface ScanOptions {
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
  filterExpression?: string;
  expressionAttributeNames?: Record<string, string>;
  expressionAttributeValues?: Record<string, unknown>;
}

export interface ScanResult {
  items: Record<string, unknown>[];
  lastEvaluatedKey?: Record<string, unknown>;
  count: number;
  scannedCount: number;
}

export async function scanTable(
  tableName: string,
  options: ScanOptions = {}
): Promise<ScanResult> {
  const command = new ScanCommand({
    TableName: tableName,
    Limit: options.limit || 50,
    ExclusiveStartKey: options.exclusiveStartKey,
    FilterExpression: options.filterExpression,
    ExpressionAttributeNames: options.expressionAttributeNames,
    ExpressionAttributeValues: options.expressionAttributeValues,
  });

  const response = await docClient.send(command);

  return {
    items: (response.Items || []) as Record<string, unknown>[],
    lastEvaluatedKey: response.LastEvaluatedKey as Record<string, unknown> | undefined,
    count: response.Count || 0,
    scannedCount: response.ScannedCount || 0,
  };
}
