# AWS Lambda@Edge Image Resize

## 참고

### 이미지 크기

- 최대 압축 크기는 오리진 이벤트의 경우 50MB, 최종 사용자 이벤트의 경우 1MB를 초과할 수 없다
  - 라는 문서가 아직도 유지되는거 보면 지금도 인것 같은데, 나중에 필요하면 사이즈 제한을 걸어야겠다.
  - [aws 문서](https://docs.developers.optimizely.com/feature-experimentation/docs/aws-lambda-at-edge)

```javascript
// 대에충 요런식?
// 응답의 Body를 조작하는데, 크기는 1MB = 1046528byte 이하여야 한다.
// 이미지의 크기를 한 번 조절했을 때 1MB를 넘는 경우를 대처해야 한다.
// 응답을 조작하지 않는다면 1MB 이상의 응답이 가능하다.
let metaData,
  resizedImage,
  bytelength = 0;

while (true) {
  resizedImage = await sharp(s3Object.body).rotate();
  metaData = await resizedImage.metadata();

  if (metaData.width > width || metaData.height > height) {
    resizedImage.resize(width, height, { fit: type });
  }

  if (bytelength >= 1046528 || originalFormat !== requiredFormat) {
    resizedImage.toFormat(requiredFormat, { quality: quality });
  }

  resizedImage = await resizedImage.toBuffer();
  bytelength = Buffer.byteLength(resizedImage, "base64");

  if (bytelength >= 1046528) {
    quality -= 10;
  } else {
    break;
  }
}
```

## 2024.03.21

### 트러블 슈팅

- AWS sdk 가 3이 되면서 stream 기반으로 바뀜(node: Readable, browser: Blob or ReadableStream)
  - [관련글](https://transang.me/modern-fetch-and-how-to-get-buffer-output-from-aws-sdk-v3-getobjectcommand/)
  - [관련 이슈](https://stackoverflow.com/questions/67100921/migration-aws-sdk-js-v2-to-v3-error-sharp-input-file-is-missing)
- sharp
  - 0.33 대 sharp 는 cpu / os 지정해도 문제가 있다(시간날때 자세히 볼까? 말까?).
  - [github issue](https://github.com/lovell/sharp/issues/3870)
  - 다음 명령어로 버전 고정: `npm install --platform=linux --arch=x64 sharp@0.32.6`

### lambda edge test json object

```json
{
  "Records": [
    {
      "cf": {
        "config": {
          "distributionDomainName": "본인 cf 도메인",
          "distributionId": "본인 cf 아이디",
          "eventType": "origin-response",
          "requestId": "xGN7KWpVEmB9Dp7ctcVFQC4E-nrcOcEKS3QyAez--06dV7TEXAMPLE=="
        },
        "request": {
          "clientIp": "2001:0db8:85a3:0:0:8a2e:0370:7334",
          "method": "GET",
          "uri": "/john/john_home_cherry_blossom_2.jpeg",
          "querystring": "w=100&webp=1",
          "headers": {
            "host": [
              {
                "key": "Host",
                "value": "본인 cf 도메인"
              }
            ],
            "user-agent": [
              {
                "key": "User-Agent",
                "value": "curl/7.18.1"
              }
            ]
          }
        },
        "response": {
          "status": "200",
          "statusDescription": "OK",
          "headers": {
            "server": [
              {
                "key": "Server",
                "value": "MyCustomOrigin"
              }
            ],
            "set-cookie": [
              {
                "key": "Set-Cookie",
                "value": "theme=light"
              },
              {
                "key": "Set-Cookie",
                "value": "sessionToken=abc123; Expires=Wed, 09 Jun 2021 10:18:14 GMT"
              }
            ]
          }
        }
      }
    }
  ]
}
```
