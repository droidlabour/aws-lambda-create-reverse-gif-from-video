# create-reverse-gif-lambda
Convert mp4/mov to gif (merged with itself to produce bouncing effect) or img if thumbnail length > video length

# Installation using AWS Cloudformation
1. `cd` to project root dir
2. `npm install`
3. `zip -r ~/lambda.zip index.js node_modules package-lock.json package.json`
4. Upload `~/lambda.zip` to an S3 bucket (which must be in the same region as the Lambda)
5. Create cloudformation stack using `main.yaml`

# Cloudformation Parameters
1. `LambdaS3Bucket` The S3 bucket where `~/lambda.zip` is uploaded in `Step #4` above.
2. `LambdaS3Key` The S3 filename which is uploaded into S3 in `Step #4` above.
3. `ThumbnailLength` The duration of the GIF file
