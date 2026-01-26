import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export const dynamoDBClient = new DynamoDBClient({
  region: "eu-west-1",
  endpoint: "http://localhost:8000",
  credentials: {
    accessKeyId: "root",
    secretAccessKey: "root",
  },
});

export const docClient = DynamoDBDocumentClient.from(dynamoDBClient, {
  marshallOptions: {
    removeUndefinedValues: true,
  },
});
