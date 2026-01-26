import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../utils/dynamodb.js";

export async function putItem(
  tableName: string,
  item: Record<string, unknown>
): Promise<void> {
  const command = new PutCommand({
    TableName: tableName,
    Item: item,
  });

  await docClient.send(command);
}
