import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDBManager } from "./dynamodb-manager.js";

export async function getItem(
  tableName: string,
  key: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  try {
    const command = new GetCommand({
      TableName: tableName,
      Key: key,
    });

    const response = await dynamoDBManager.getDocClient().send(command);
    return (response.Item ?? null) as Record<string, unknown> | null;
  } catch (err) {
    throw new Error(`Failed to get item from ${tableName}: ${err instanceof Error ? err.message : String(err)}`)
  }
}
