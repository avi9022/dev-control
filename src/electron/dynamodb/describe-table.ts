import { DescribeTableCommand } from "@aws-sdk/client-dynamodb";
import { dynamoDBManager } from "./dynamodb-manager.js";

export interface DynamoDBTableInfo {
  tableName: string;
  tableStatus: string;
  itemCount: number;
  tableSizeBytes: number;
  creationDateTime?: Date;
  keySchema: Array<{
    attributeName: string;
    keyType: "HASH" | "RANGE";
  }>;
  attributeDefinitions: Array<{
    attributeName: string;
    attributeType: "S" | "N" | "B";
  }>;
  globalSecondaryIndexes?: Array<{
    indexName: string;
    keySchema: Array<{
      attributeName: string;
      keyType: "HASH" | "RANGE";
    }>;
  }>;
  localSecondaryIndexes?: Array<{
    indexName: string;
    keySchema: Array<{
      attributeName: string;
      keyType: "HASH" | "RANGE";
    }>;
  }>;
}

export async function describeTable(tableName: string): Promise<DynamoDBTableInfo> {
  const command = new DescribeTableCommand({ TableName: tableName });
  const response = await dynamoDBManager.getRawClient().send(command);

  if (!response.Table) {
    throw new Error(`Table ${tableName} not found`);
  }

  const table = response.Table;

  return {
    tableName: table.TableName || tableName,
    tableStatus: table.TableStatus || "UNKNOWN",
    itemCount: table.ItemCount || 0,
    tableSizeBytes: table.TableSizeBytes || 0,
    creationDateTime: table.CreationDateTime,
    keySchema: (table.KeySchema || []).map((key) => ({
      attributeName: key.AttributeName || "",
      keyType: key.KeyType as "HASH" | "RANGE",
    })),
    attributeDefinitions: (table.AttributeDefinitions || []).map((attr) => ({
      attributeName: attr.AttributeName || "",
      attributeType: attr.AttributeType as "S" | "N" | "B",
    })),
    globalSecondaryIndexes: table.GlobalSecondaryIndexes?.map((gsi) => ({
      indexName: gsi.IndexName || "",
      keySchema: (gsi.KeySchema || []).map((key) => ({
        attributeName: key.AttributeName || "",
        keyType: key.KeyType as "HASH" | "RANGE",
      })),
    })),
    localSecondaryIndexes: table.LocalSecondaryIndexes?.map((lsi) => ({
      indexName: lsi.IndexName || "",
      keySchema: (lsi.KeySchema || []).map((key) => ({
        attributeName: key.AttributeName || "",
        keyType: key.KeyType as "HASH" | "RANGE",
      })),
    })),
  };
}
