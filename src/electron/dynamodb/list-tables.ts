import { ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { dynamoDBManager } from "./dynamodb-manager.js";

export async function listTables(): Promise<string[]> {
  const tables: string[] = [];
  let lastEvaluatedTableName: string | undefined;

  do {
    const command = new ListTablesCommand({
      ExclusiveStartTableName: lastEvaluatedTableName,
      Limit: 100,
    });

    const response = await dynamoDBManager.getRawClient().send(command);

    if (response.TableNames) {
      tables.push(...response.TableNames);
    }

    lastEvaluatedTableName = response.LastEvaluatedTableName;
  } while (lastEvaluatedTableName);

  return tables;
}
