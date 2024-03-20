import querystring from "node:querystring";
import Sharp from "sharp";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

const BUCKET = "image.juntae.kim";

const s3Client = new S3Client({
  region: "ap-northeast-2",
});

async function getObject(key) {
  const stream = await s3Client.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    })
  )
    .then((response) => response.Body);

  return new Promise((resolve, reject) => {
    const chunks = []
    stream.on('data', chunk => chunks.push(chunk))
    stream.once('end', () => resolve(Buffer.concat(chunks)))
    stream.once('error', reject)
  })
}

async function resize(key, { format, w }) {
  const originImage = await getObject(key);

  const info = await Sharp(originImage).metadata();
  let parsedWidth = w && parseInt(w);
  if (info.width <= parsedWidth) {
    parsedWidth = info.width;
  }
  const width = parsedWidth && Math.min(parsedWidth, 1024);

  let task = Sharp(originImage);
  if (width) {
    task = task.resize({ width });
  }
  task = await task.withMetadata().toFormat(format).toBuffer();
  const image = task;

  return image.toString("base64");
}

export const handler = async (event, context, callback) => {
  const response = event.Records[0].cf.response;
  const request = event.Records[0].cf.request;

  const params = querystring.parse(request.querystring);
  console.log("params:", params);

  const { w, webp = 0 } = params;

  const uri = request.uri;
  console.log("uri:", request.uri);
  const [, imageName, extension] = uri.match(/\/(.*)\.(.*)/);

  // no params given -> return original data OR gif
  if (Object.values(params).every((value) => !value) || extension === "gif") {
    callback(null, response);
    return;
  }

  const originalFormat = extension == "jpg" ? "jpeg" : extension.toLowerCase();
  const format = webp === "1" ? "webp" : originalFormat;

  response.headers["content-type"] = [
    {
      key: "Content-type",
      value: "image/" + format,
    },
  ];

  if (!response.headers["cache-control"]) {
    response.headers["cache-control"] = [
      {
        key: "Cache-Control",
        value: "public, max-age=86400",
      },
    ];
  }

  try {
    const originalKey = decodeURI(imageName) + "." + extension;
    const image = await resize(originalKey, { format, w });
    if (image === null) {
      callback(null, response);
    }

    response.status = 200;
    response.body = image;
    response.bodyEncoding = "base64";

    return callback(null, response);
  } catch (error) {
    console.log("error:", error);
    return callback(null, response);
  }
};

console.log(querystring.parse("id=1&name=aa").id);
