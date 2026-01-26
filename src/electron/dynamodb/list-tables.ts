import { ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { dynamoDBClient } from "../utils/dynamodb.js";

export async function listTables(): Promise<string[]> {
  const tables: string[] = [];
  let lastEvaluatedTableName: string | undefined;

  do {
    const command = new ListTablesCommand({
      ExclusiveStartTableName: lastEvaluatedTableName,
      Limit: 100,
    });

    const response = await dynamoDBClient.send(command);

    if (response.TableNames) {
      tables.push(...response.TableNames);
    }

    lastEvaluatedTableName = response.LastEvaluatedTableName;
  } while (lastEvaluatedTableName);

  return tables;
}
