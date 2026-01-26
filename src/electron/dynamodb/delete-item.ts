import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../utils/dynamodb.js";

export async function deleteItem(
  tableName: string,
  key: Record<string, unknown>
): Promise<void> {
  const command = new DeleteCommand({
    TableName: tableName,
    Key: key,
  });

  await docClient.send(command);
}
