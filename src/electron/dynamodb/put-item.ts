import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDBManager } from "./dynamodb-manager.js";

export async function putItem(
  tableName: string,
  item: Record<string, unknown>
): Promise<void> {
  const command = new PutCommand({
    TableName: tableName,
    Item: item,
  });

  await dynamoDBManager.getDocClient().send(command);
}
