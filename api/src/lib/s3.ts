// Creates presigned POSTs for poster uploads. CONCEPT: presigned-urls
// A presigned POST is a signed "permission slip": for 5 minutes, the browser may upload ONE file to ONE
// key, with the content type and size range written into the signed policy. S3 checks the policy itself,
// so the API never has to receive (or pay to proxy) the file bytes.
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { config } from "../config";

const client = new S3Client({ region: config.region });

export async function presignPosterUpload(key: string, contentType: string, maxBytes: number) {
  return createPresignedPost(client, {
    Bucket: config.postersBucket,
    Key: key,
    Fields: { "Content-Type": contentType },
    Conditions: [
      ["content-length-range", 1, maxBytes], // S3 rejects empty or oversized files
      ["eq", "$Content-Type", contentType], // and any other content type
    ],
    Expires: 300, // seconds
  });
}
