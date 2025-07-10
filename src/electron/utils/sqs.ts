import { SQSClient } from "@aws-sdk/client-sqs";

export const client = new SQSClient({
  region: "eu-west-1",
  endpoint: "http://localhost:9324",
  credentials: {
    accessKeyId: "root",
    secretAccessKey: "root",
  },
});
