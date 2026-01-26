import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../utils/dynamodb.js";

export async function getItem(
  tableName: string,
  key: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const command = new GetCommand({
    TableName: tableName,
    Key: key,
  });

  const response = await docClient.send(command);
  return (response.Item as Record<string, unknown>) || null;
}
