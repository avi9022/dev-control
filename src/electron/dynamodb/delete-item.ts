import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamoDBManager } from "./dynamodb-manager.js";

export async function deleteItem(
  tableName: string,
  key: Record<string, unknown>
): Promise<void> {
  const command = new DeleteCommand({
    TableName: tableName,
    Key: key,
  });

  await dynamoDBManager.getDocClient().send(command);
}
