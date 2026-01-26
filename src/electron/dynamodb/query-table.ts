import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../utils/dynamodb.js";

export type SKOperator = "=" | "<" | "<=" | ">" | ">=" | "begins_with" | "between";

export interface QueryOptions {
  indexName?: string;
  pkValue: string | number;
  pkName: string;
  skName?: string;
  skValue?: string | number;
  skValue2?: string | number; // For "between" operator
  skOperator?: SKOperator;
  limit?: number;
  exclusiveStartKey?: Record<string, unknown>;
  scanIndexForward?: boolean; // true = ascending, false = descending
  filterExpression?: string;
  filterNames?: Record<string, string>;
  filterValues?: Record<string, unknown>;
}

export interface QueryResult {
  items: Record<string, unknown>[];
  lastEvaluatedKey?: Record<string, unknown>;
  count: number;
  scannedCount: number;
}

export async function queryTable(
  tableName: string,
  options: QueryOptions
): Promise<QueryResult> {
  const expressionAttributeNames: Record<string, string> = {
    "#pk": options.pkName,
  };
  const expressionAttributeValues: Record<string, unknown> = {
    ":pkval": options.pkValue,
  };

  let keyConditionExpression = "#pk = :pkval";

  // Handle sort key condition if provided
  if (options.skName && options.skValue !== undefined && options.skOperator) {
    expressionAttributeNames["#sk"] = options.skName;
    expressionAttributeValues[":skval"] = options.skValue;

    switch (options.skOperator) {
      case "=":
        keyConditionExpression += " AND #sk = :skval";
        break;
      case "<":
        keyConditionExpression += " AND #sk < :skval";
        break;
      case "<=":
        keyConditionExpression += " AND #sk <= :skval";
        break;
      case ">":
        keyConditionExpression += " AND #sk > :skval";
        break;
      case ">=":
        keyConditionExpression += " AND #sk >= :skval";
        break;
      case "begins_with":
        keyConditionExpression += " AND begins_with(#sk, :skval)";
        break;
      case "between":
        if (options.skValue2 !== undefined) {
          expressionAttributeValues[":skval2"] = options.skValue2;
          keyConditionExpression += " AND #sk BETWEEN :skval AND :skval2";
        }
        break;
    }
  }

  // Merge filter expression names and values if provided
  if (options.filterNames) {
    Object.assign(expressionAttributeNames, options.filterNames);
  }
  if (options.filterValues) {
    Object.assign(expressionAttributeValues, options.filterValues);
  }

  const command = new QueryCommand({
    TableName: tableName,
    IndexName: options.indexName,
    KeyConditionExpression: keyConditionExpression,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    FilterExpression: options.filterExpression,
    Limit: options.limit || 50,
    ExclusiveStartKey: options.exclusiveStartKey,
    ScanIndexForward: options.scanIndexForward ?? true,
  });

  const response = await docClient.send(command);

  return {
    items: (response.Items || []) as Record<string, unknown>[],
    lastEvaluatedKey: response.LastEvaluatedKey as Record<string, unknown> | undefined,
    count: response.Count || 0,
    scannedCount: response.ScannedCount || 0,
  };
}
