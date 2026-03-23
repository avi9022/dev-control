import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDBManager } from "./dynamodb-manager.js";
import { DYNAMODB_DEFAULT_SCAN_LIMIT } from "../../shared/constants.js";

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
  try {
    const command = new ScanCommand({
      TableName: tableName,
      Limit: options.limit || DYNAMODB_DEFAULT_SCAN_LIMIT,
      ExclusiveStartKey: options.exclusiveStartKey,
      FilterExpression: options.filterExpression,
      ExpressionAttributeNames: options.expressionAttributeNames,
      ExpressionAttributeValues: options.expressionAttributeValues,
    });

    const response = await dynamoDBManager.getDocClient().send(command);

    return {
      items: (response.Items ?? []) as Record<string, unknown>[],
      lastEvaluatedKey: response.LastEvaluatedKey as Record<string, unknown> | undefined,
      count: response.Count ?? 0,
      scannedCount: response.ScannedCount ?? 0,
    };
  } catch (err) {
    throw new Error(`Failed to scan table ${tableName}: ${err instanceof Error ? err.message : String(err)}`)
  }
}
