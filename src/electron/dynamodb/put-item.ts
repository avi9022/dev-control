import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDBManager } from "./dynamodb-manager.js";

export async function putItem(
  tableName: string,
  item: Record<string, unknown>
): Promise<void> {
  try {
    const command = new PutCommand({
      TableName: tableName,
      Item: item,
    });

    await dynamoDBManager.getDocClient().send(command);
  } catch (err) {
    throw new Error(`Failed to put item into ${tableName}: ${err instanceof Error ? err.message : String(err)}`)
  }
}
