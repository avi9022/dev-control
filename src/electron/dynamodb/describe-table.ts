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

type DynamoDBKeyType = "HASH" | "RANGE"
type DynamoDBAttributeType = "S" | "N" | "B"

function isValidKeyType(value: string | undefined): value is DynamoDBKeyType {
  return value === "HASH" || value === "RANGE"
}

function isValidAttributeType(value: string | undefined): value is DynamoDBAttributeType {
  return value === "S" || value === "N" || value === "B"
}

export async function describeTable(tableName: string): Promise<DynamoDBTableInfo> {
  try {
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
      keySchema: (table.KeySchema || [])
        .filter((key) => isValidKeyType(key.KeyType))
        .map((key) => ({
          attributeName: key.AttributeName || "",
          keyType: key.KeyType as DynamoDBKeyType,
        })),
      attributeDefinitions: (table.AttributeDefinitions || [])
        .filter((attr) => isValidAttributeType(attr.AttributeType))
        .map((attr) => ({
          attributeName: attr.AttributeName || "",
          attributeType: attr.AttributeType as DynamoDBAttributeType,
        })),
      globalSecondaryIndexes: table.GlobalSecondaryIndexes?.map((gsi) => ({
        indexName: gsi.IndexName || "",
        keySchema: (gsi.KeySchema || [])
          .filter((key) => isValidKeyType(key.KeyType))
          .map((key) => ({
            attributeName: key.AttributeName || "",
            keyType: key.KeyType as DynamoDBKeyType,
          })),
      })),
      localSecondaryIndexes: table.LocalSecondaryIndexes?.map((lsi) => ({
        indexName: lsi.IndexName || "",
        keySchema: (lsi.KeySchema || [])
          .filter((key) => isValidKeyType(key.KeyType))
          .map((key) => ({
            attributeName: key.AttributeName || "",
            keyType: key.KeyType as DynamoDBKeyType,
          })),
      })),
    };
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Table ')) throw err
    throw new Error(`Failed to describe table ${tableName}: ${err instanceof Error ? err.message : String(err)}`)
  }
}
