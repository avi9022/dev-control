import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDBManager } from "./dynamodb-manager.js";

export async function putItem(
  connectionId: string,
  tableName: string,
  item: Record<string, unknown>
): Promise<void> {
  const command = new PutCommand({
    TableName: tableName,
    Item: item,
  });

  await dynamoDBManager.getDocClient(connectionId).send(command);
}
