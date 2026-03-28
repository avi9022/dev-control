import { ListTablesCommand } from "@aws-sdk/client-dynamodb";
import { dynamoDBManager } from "./dynamodb-manager.js";
import { DYNAMODB_PAGE_SIZE } from "../../shared/constants.js";

export async function listTables(): Promise<string[]> {
  try {
    const tables: string[] = [];
    let lastEvaluatedTableName: string | undefined;

    do {
      const command = new ListTablesCommand({
        ExclusiveStartTableName: lastEvaluatedTableName,
        Limit: DYNAMODB_PAGE_SIZE,
      });

      const response = await dynamoDBManager.getRawClient().send(command);

      if (response.TableNames) {
        tables.push(...response.TableNames);
      }

      lastEvaluatedTableName = response.LastEvaluatedTableName;
    } while (lastEvaluatedTableName);

    return tables;
  } catch (err) {
    throw new Error(`Failed to list DynamoDB tables: ${err instanceof Error ? err.message : String(err)}`)
  }
}
